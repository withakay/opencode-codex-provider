import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
  SharedV2Headers,
  ProviderV2,
} from "@ai-sdk/provider"
import { CodexMCPClient } from "./codexClient"
import { codexLog } from "./logger"
import { StreamState } from "./stream-state"
import type { CodexProviderOptions, JsonValue } from "./types"
import {
  buildConversationPayload,
  decodeExecChunk,
  DEFAULT_REASONING,
  extractTextFromResult,
  mapApprovalPolicy,
  mapSandboxMode,
  sharedPrefixLength,
} from "./utils"

class CodexLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const
  readonly provider = "codex"
  readonly supportedUrls: Record<string, RegExp[]> = { "*/*": [] }

  constructor(public readonly modelId: string) {}

  get modelIdForLogging() {
    return this.modelId
  }

  get modelIdLabel() {
    return this.modelId
  }

  get modelIdValue() {
    return this.modelId
  }

  async doGenerate(options: LanguageModelV2CallOptions) {
    const { stream } = await this.doStream(options)
    const reader = stream.getReader()
    let text = ""
    let finishReason: LanguageModelV2FinishReason = "stop"
    let usage: LanguageModelV2Usage | undefined

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      switch (value.type) {
        case "text-delta":
          text += value.delta
          break
        case "finish":
          finishReason = value.finishReason
          usage = value.usage
          break
        case "error":
          throw value.error instanceof Error ? value.error : new Error(String(value.error))
      }
    }

    const content: LanguageModelV2Content[] = text
      ? [
          {
            type: "text",
            text,
          },
        ]
      : []

    return {
      content,
      finishReason,
      usage:
        usage ?? {
          inputTokens: undefined,
          outputTokens: undefined,
          totalTokens: undefined,
        },
      warnings: [],
    }
  }

  async doStream(
    options: LanguageModelV2CallOptions,
  ): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>
    request?: { body?: unknown }
    response?: { headers?: SharedV2Headers }
  }> {
    const providerOptions = this.extractProviderOptions(options)
    const { baseInstructions, userText, assistantText } = buildConversationPayload(options.prompt)
    let prompt = userText || "Please respond to the request."
    if (baseInstructions) {
      prompt = `${baseInstructions}\n\n${prompt}`
    }
    if (assistantText) {
      prompt = `${prompt}\n\nAssistant context:\n${assistantText}`
    }
    const reasoningEffort = providerOptions.reasoningEffort ?? DEFAULT_REASONING
    const cwd = providerOptions.cwd ?? process.cwd()
    const approvalPolicy = mapApprovalPolicy(providerOptions.approvalPolicy)
    const sandbox = mapSandboxMode(providerOptions.sandboxMode)

    const toolArgs: Record<string, JsonValue> = {
      prompt,
      model: providerOptions.model ?? this.modelId,
      cwd,
      "approval-policy": approvalPolicy,
      sandbox,
      "include-plan-tool": false,
      config: {
        model_reasoning_effort: reasoningEffort,
      },
    }

    const client = new CodexMCPClient(
      providerOptions.binary,
      providerOptions.args,
      {
        cwd: providerOptions.spawnCwd,
        env: providerOptions.env,
      },
      {
        onSend: (payload) => codexLog("rpc.send", { payload }),
        onReceive: (payload) => codexLog("rpc.receive", { payload }),
      },
    )

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start: async (controller) => {
        const streamState = new StreamState(controller, client, providerOptions.streamReasoning ?? true)
        let finishedViaNotification = false
        let abortCleanup = () => {}
        let callRequestId: number | undefined
        let lastAgentMessage = ""
        let lastReasoningMessage = ""
        const includeCommandOutput = providerOptions.streamCommandOutput ?? false
        const includeReasoning = providerOptions.streamReasoning ?? true

        const notificationCleanup = client.onNotification((notification) => {
          if (!notification.method.startsWith("codex/event")) return
          const params = (notification.params ?? {}) as Record<string, any>
          const meta = params["_meta"] as Record<string, any> | undefined
          if (callRequestId !== undefined && meta && Object.prototype.hasOwnProperty.call(meta, "requestId")) {
            const rawMetaRequestId = meta.requestId
            const metaRequestId =
              typeof rawMetaRequestId === "number"
                ? rawMetaRequestId
                : typeof rawMetaRequestId === "string"
                ? Number.parseInt(rawMetaRequestId, 10)
                : undefined
            if (Number.isFinite(metaRequestId) && metaRequestId !== callRequestId) {
              return
            }
          }
          const msg = params["msg"] ?? {}
          const type = typeof msg.type === "string" ? msg.type : notification.method.split("/").at(-1) ?? ""

          if (type === "agent_message_delta" && typeof msg.delta === "string" && msg.delta) {
            streamState.pushDelta("text", msg.delta, "agent_message_delta")
            lastAgentMessage = `${lastAgentMessage}${msg.delta}`
            return
          }

          if (type === "agent_message" && typeof msg.message === "string") {
            const message = msg.message
            if (!message) {
              lastAgentMessage = message
              return
            }
            streamState.ensureStreamStart("text")
            const prefixLength = sharedPrefixLength(lastAgentMessage, message)
            const delta = message.slice(prefixLength)
            if (delta) {
              streamState.pushDelta("text", delta, "agent_message_delta_from_full")
            }
            lastAgentMessage = message
            return
          }

          if (includeReasoning && type === "agent_reasoning_delta" && typeof msg.delta === "string" && msg.delta) {
            streamState.pushReasoning(msg.delta, "agent_reasoning_delta")
            lastReasoningMessage = `${lastReasoningMessage}${msg.delta}`
            return
          }

          if (includeReasoning && type === "agent_reasoning" && typeof msg.text === "string") {
            const text = msg.text
            if (!text) {
              lastReasoningMessage = text
              return
            }
            if (!streamState.reasoningDeltaSeen) {
              streamState.pushReasoning(text, "agent_reasoning")
            }
            lastReasoningMessage = text
            return
          }

          if (includeReasoning && type === "agent_reasoning_section_break") {
            streamState.pushReasoning("\n", "agent_reasoning_section_break")
            lastReasoningMessage = `${lastReasoningMessage}\n`
            return
          }

          if (includeCommandOutput && type === "exec_command_output_delta" && typeof msg.chunk === "string") {
            const decoded = decodeExecChunk(msg.chunk)
            if (decoded) {
              streamState.pushDelta("exec", decoded, "exec_command_output_delta")
            }
            return
          }

          if (type === "task_complete") {
            finishedViaNotification = true
            // if (typeof msg.last_agent_message === "string" && msg.last_agent_message && msg.last_agent_message.trim()) {
            //   streamState.pushDelta("text", msg.last_agent_message, "task_complete")
            // }
            streamState.finish("stop")
            return
          }

          if (type === "stream_error" || type === "error") {
            finishedViaNotification = true
            const message = typeof msg.message === "string" ? msg.message : `Codex ${type}`
            streamState.finish("error", new Error(message))
            return
          }

          codexLog("notification.ignored_event", { type })
        })

        const errorCleanup = client.onError((error) => {
          streamState.finish("error", error)
        })

        const exitCleanup = client.onExit((code, signal) => {
          const message = `codex mcp-server exited unexpectedly (${code ?? "null"}${signal ? `, ${signal}` : ""})`
          streamState.finish("error", new Error(message))
        })

        const cleanupAll = () => {
          notificationCleanup()
          errorCleanup()
          exitCleanup()
          abortCleanup()
          abortCleanup = () => {}
          client.close()
        }

        const abortHandler = () => {
          streamState.finish("error", new DOMException("Aborted", "AbortError"))
        }

        if (options.abortSignal) {
          if (options.abortSignal.aborted) {
            abortHandler()
            cleanupAll()
            return
          }
          options.abortSignal.addEventListener("abort", abortHandler, { once: true })
          abortCleanup = () => options.abortSignal?.removeEventListener("abort", abortHandler)
        }

        try {
          await client.initialize(providerOptions.clientInfo)
          const { result } = await client.callCodex(toolArgs, {
            abortSignal: options.abortSignal,
            onNotification: (notification) => codexLog("notification", { notification }),
            onRequestId: (id) => {
              callRequestId = id
            },
          })
          if (finishedViaNotification) {
            return
          }
          if (!result || typeof result !== "object") {
            throw new Error("Codex MCP tool returned an invalid result")
          }
          const text = extractTextFromResult(result)
          const isError =
            !!(result && typeof result === "object" && "isError" in result && (result as Record<string, any>)["isError"])
          if (isError) {
            throw new Error(text || "Codex MCP tool invocation failed")
          }
          if (text) {
            const prefixLength = sharedPrefixLength(lastAgentMessage, text)
            const delta = text.slice(prefixLength)
            if (delta) {
              streamState.pushDelta("text", delta, "call_result")
            }
          }
          streamState.finish("stop")
        } catch (error) {
          if (finishedViaNotification) {
            codexLog("callCodex.finished_after_notification", {
              error:
                error instanceof Error
                  ? { message: error.message, name: error.name }
                  : { message: String(error) },
            })
          } else {
            streamState.finish("error", error instanceof Error ? error : new Error(String(error)))
          }
        } finally {
          cleanupAll()
        }
      },
      cancel: async () => {
        await client.close()
      },
    })

    return { stream }
  }

  private extractProviderOptions(options: LanguageModelV2CallOptions): CodexProviderOptions {
    const providerSpecific =
      ((options.providerOptions ?? {}) as Record<string, CodexProviderOptions | undefined>)[this.provider] ?? {}
    return providerSpecific
  }
}

export function createCodexProvider(): ProviderV2 {
  return {
    languageModel: (modelId: string) => new CodexLanguageModel(modelId),
    textEmbeddingModel: (modelId:string) => {
      throw new Error(`Codex provider does not support text embeddings (requested model: ${modelId})`)
    },
    imageModel: (modelId: string) => {
      throw new Error(`Codex provider does not support image models (requested model: ${modelId})`)
    },
  }
}
