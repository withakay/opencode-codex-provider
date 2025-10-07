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
import type { CodexProviderOptions, JsonRpcNotification, JsonValue } from "./types"
import { buildConversationPayload, DEFAULT_REASONING, extractTextFromResult, mapApprovalPolicy, mapSandboxMode } from "./utils"

class CodexLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const
  readonly provider = "codex"
  readonly supportedUrls: Record<string, RegExp[]> = { "*/*": [] }

  constructor(public readonly modelId: string) { }

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
      usage: usage ?? {
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
        let finished = false
        let finishedViaNotification = false
        let textStarted = false
        let textCompleted = false
        let execStreamStarted = false
        let execStreamCompleted = false
        let reasoningStreamStarted = false
        let reasoningStreamCompleted = false
        let abortCleanup = () => { }
        let callRequestId: number | undefined
        let clientClosed = false
        let lastAgentMessage = ""
        let lastReasoningMessage = ""
        let reasoningDeltaSeen = false
        let lastReasoningChunk = ""
        let lastReasoningNormalized = ""
        const includeCommandOutput = providerOptions.streamCommandOutput ?? false
        const includeReasoning = providerOptions.streamReasoning ?? true
        const includeMessageSource = providerOptions.includeMessageSource ?? false

        const ensureTextStart = () => {
          if (textStarted) return
          textStarted = true
          controller.enqueue({ type: "text-start", id: "codex-text" })
        }

        const ensureExecStreamStart = () => {
          if (execStreamStarted) return
          execStreamStarted = true
          controller.enqueue({ type: "text-start", id: "codex-exec" })
        }

        const ensureReasoningStart = () => {
          if (reasoningStreamStarted) return
          reasoningStreamStarted = true
          controller.enqueue({ type: "text-start", id: "codex-reasoning" })
        }

        const isLikelyText = (value: string) => {
          for (let index = 0; index < value.length; index += 1) {
            const code = value.charCodeAt(index)
            if (code === 0xfffd) return false
            if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
              return false
            }
          }
          return true
        }

        const decodeExecChunk = (raw: string): string | null => {
          if (!raw) return null

          const compressed = raw.replace(/\s+/g, "")
          const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/
          if (compressed.length > 0 && compressed.length % 4 === 0 && base64Pattern.test(compressed)) {
            try {
              const decoded = Buffer.from(compressed, "base64").toString("utf-8")
              if (decoded && isLikelyText(decoded)) {
                return decoded
              }
            } catch {
              // ignore invalid base64
            }
          }

          return isLikelyText(raw) ? raw : null
        }

        const pushText = (chunk: string, source?: string) => {
          if (!chunk) return
          ensureTextStart()
          const delta = includeMessageSource && source ? `[${source}] ${chunk}` : chunk
          controller.enqueue({ type: "text-delta", id: "codex-text", delta })
        }

        const sharedPrefixLength = (a: string, b: string) => {
          const max = Math.min(a.length, b.length)
          let index = 0
          while (index < max && a.charCodeAt(index) === b.charCodeAt(index)) {
            index += 1
          }
          return index
        }

        const pushExecText = (chunk: string, source?: string) => {
          if (!chunk) return
          ensureExecStreamStart()
          const delta = includeMessageSource && source ? `[${source}] ${chunk}` : chunk
          controller.enqueue({ type: "text-delta", id: "codex-exec", delta })
        }

        const normalizeReasoning = (value: string) => value.trim().replace(/\*/g, "").replace(/\s+/g, " ")

        const pushReasoning = (chunk: string, source?: string) => {
          if (!chunk || !includeReasoning) return
          const normalized = normalizeReasoning(chunk)
          if (!normalized && chunk === "\n" && lastReasoningChunk === "\n") {
            return
          }
          if (normalized && normalized === lastReasoningNormalized) {
            return
          }
          if (!normalized && lastReasoningChunk === chunk) {
            return
          }
          ensureReasoningStart()
          reasoningDeltaSeen = true
          const delta = includeMessageSource && source ? `[${source}] ${chunk}` : chunk
          controller.enqueue({ type: "text-delta", id: "codex-reasoning", delta })
          lastReasoningChunk = chunk
          if (normalized) {
            lastReasoningNormalized = normalized
          }
        }

        const closeClient = () => {
          if (clientClosed) return
          clientClosed = true
          void client.close()
        }

        const finishStream = (reason: LanguageModelV2FinishReason, error?: Error) => {
          if (finished) return
          finished = true
          abortCleanup()
          abortCleanup = () => { }
          if (error) {
            controller.enqueue({ type: "error", error })
          }
          if (textStarted && !textCompleted) {
            controller.enqueue({ type: "text-end", id: "codex-text" })
            textCompleted = true
          }
          if (execStreamStarted && !execStreamCompleted) {
            controller.enqueue({ type: "text-end", id: "codex-exec" })
            execStreamCompleted = true
          }
          if (reasoningStreamStarted && !reasoningStreamCompleted) {
            controller.enqueue({ type: "text-end", id: "codex-reasoning" })
            reasoningStreamCompleted = true
          }
          controller.enqueue({
            type: "finish",
            finishReason: reason,
            usage: {
              inputTokens: undefined,
              outputTokens: undefined,
              totalTokens: undefined,
            },
          })
          controller.close()
          closeClient()
        }

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
            pushText(msg.delta, "agent_message_delta")
            lastAgentMessage = `${lastAgentMessage}${msg.delta}`
            return
          }

          if (type === "agent_message" && typeof msg.message === "string") {
            const message = msg.message
            if (!message) {
              lastAgentMessage = message
              return
            }
            if (!textStarted) {
              pushText(message, "agent_message")
            } else {
              const prefixLength = sharedPrefixLength(lastAgentMessage, message)
              const delta = message.slice(prefixLength)
              if (delta) {
                pushText(delta, "agent_message_delta_from_full")
              }
            }
            lastAgentMessage = message
            return
          }

          if (includeReasoning && type === "agent_reasoning_delta" && typeof msg.delta === "string" && msg.delta) {
            pushReasoning(msg.delta, "agent_reasoning_delta")
            lastReasoningMessage = `${lastReasoningMessage}${msg.delta}`
            return
          }

          if (includeReasoning && type === "agent_reasoning" && typeof msg.text === "string") {
            const text = msg.text
            if (!text) {
              lastReasoningMessage = text
              return
            }
            if (!reasoningStreamStarted) {
              pushReasoning(text, "agent_reasoning")
            } else if (!reasoningDeltaSeen) {
              pushReasoning(text, "agent_reasoning")
            } else {
              const prefixLength = sharedPrefixLength(lastReasoningMessage, text)
              const delta = text.slice(prefixLength)
              if (delta) {
                pushReasoning(delta, "agent_reasoning_delta_from_full")
              }
            }
            lastReasoningMessage = text
            return
          }

          if (includeReasoning && type === "agent_reasoning_section_break") {
            pushReasoning("\n", "agent_reasoning_section_break")
            lastReasoningMessage = `${lastReasoningMessage}\n`
            return
          }

          if (includeCommandOutput && type === "exec_command_output_delta" && typeof msg.chunk === "string") {
            const decoded = decodeExecChunk(msg.chunk)
            if (decoded) {
              pushExecText(decoded, "exec_command_output_delta")
            }
            return
          }

          if (type === "task_complete") {
            finishedViaNotification = true
            if (
              !textStarted &&
              typeof msg.last_agent_message === "string" &&
              msg.last_agent_message &&
              msg.last_agent_message.trim()
            ) {
              pushText(msg.last_agent_message, "task_complete")
            }
            finishStream("stop")
            return
          }

          if (type === "stream_error") {
            finishedViaNotification = true
            const message = typeof msg.message === "string" ? msg.message : "Codex stream error"
            finishStream("error", new Error(message))
            return
          }
          if (type === "error") {
            finishedViaNotification = true
            const message = typeof msg.message === "string" ? msg.message : "Codex error"
            finishStream("error", new Error(message))
            return
          }

          codexLog("notification.ignored_event", { type })
        })

        const errorCleanup = client.onError((error) => {
          finishStream("error", error)
        })

        const exitCleanup = client.onExit((code, signal) => {
          if (finished) return
          const message = `codex mcp-server exited unexpectedly (${code ?? "null"}${signal ? `, ${signal}` : ""})`
          finishStream("error", new Error(message))
        })

        const cleanupAll = () => {
          notificationCleanup()
          errorCleanup()
          exitCleanup()
          abortCleanup()
          abortCleanup = () => { }
          closeClient()
        }

        const abortHandler = () => {
          finishStream("error", new DOMException("Aborted", "AbortError"))
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
          const callPromise = client.callCodex(toolArgs, {
            abortSignal: options.abortSignal,
            onNotification: (notification) => codexLog("notification", { notification }),
            onRequestId: (id) => {
              callRequestId = id
            },
          })
          const { result } = await callPromise
          if (finishedViaNotification) {
            return
          }
          if (!result || typeof result !== "object") {
            throw new Error("Codex MCP tool returned an invalid result")
          }
          const text = extractTextFromResult(result)
          const isError =
            !!(
              result &&
              typeof result === "object" &&
              "isError" in result &&
              (result as Record<string, any>)["isError"]
            )
          if (isError) {
            throw new Error(text || "Codex MCP tool invocation failed")
          }
          if (text) {
            pushText(text, "call_result")
          }
          if (textStarted && !textCompleted) {
            controller.enqueue({ type: "text-end", id: "codex-text" })
            textCompleted = true
          }
          finishStream("stop")
        } catch (error) {
          if (finishedViaNotification) {
            codexLog("callCodex.finished_after_notification", {
              error:
                error instanceof Error
                  ? { message: error.message, name: error.name }
                  : { message: String(error) },
            })
          } else {
            finishStream("error", error instanceof Error ? error : new Error(String(error)))
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
    textEmbeddingModel: (modelId: string) => {
      throw new Error(`Codex provider does not support text embeddings (requested model: ${modelId})`)
    },
    imageModel: (modelId: string) => {
      throw new Error(`Codex provider does not support image models (requested model: ${modelId})`)
    },
  }
}
