import { spawn, type ChildProcessWithoutNullStreams } from "child_process"
import readline from "readline"
import type { CodexClientHooks, CodexProviderOptions, JsonRpcNotification, JsonRpcRequest, JsonRpcResponse, JsonValue } from "./types"
import { JSONRPC_VERSION, MCP_PROTOCOL_VERSION, toRequestKey } from "./types"

export class CodexMCPClient {
  private readonly child: ChildProcessWithoutNullStreams
  private readonly stdout: readline.Interface
  private readonly pending = new Map<
    string,
    {
      resolve: (value: JsonValue) => void
      reject: (reason: Error) => void
      cleanup: () => void
    }
  >()
  private readonly notificationHandlers = new Set<(notification: JsonRpcNotification) => void>()
  private readonly exitHandlers = new Set<(code: number | null, signal: NodeJS.Signals | null) => void>()
  private readonly errorHandlers = new Set<(error: Error) => void>()
  private readonly hooks: CodexClientHooks
  private readonly stderrChunks: string[] = []
  private closed = false
  private requestCounter = 0
  private initializing?: Promise<void>
  private initialized = false

  constructor(
    command = "codex",
    args: string[] = ["mcp-server"],
    options: { cwd?: string; env?: Record<string, string> } = {},
    hooks: CodexClientHooks = {},
  ) {
    this.hooks = hooks
    this.child = spawn(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    })

    this.child.once("error", (error) => {
      this.handleError(error instanceof Error ? error : new Error(String(error)))
    })

    this.child.on("exit", (code, signal) => {
      this.handleExit(code, signal)
    })

    if (!this.child.stdin) {
      throw new Error("codex mcp-server stdin not available")
    }

    if (this.child.stderr) {
      this.child.stderr.on("data", (chunk) => {
        this.stderrChunks.push(String(chunk))
      })
    }

    this.stdout = readline.createInterface({
      input: this.child.stdout,
      crlfDelay: Infinity,
    })
    this.stdout.on("line", (line) => {
      this.handleLine(line)
    })
  }

  async initialize(clientInfo?: CodexProviderOptions["clientInfo"]) {
    if (this.initialized) return
    if (this.initializing) {
      await this.initializing
      return
    }
    this.initializing = this.initializeInternal(clientInfo)
    try {
      await this.initializing
      this.initialized = true
    } finally {
      this.initializing = undefined
    }
  }

  async callCodex(
    args: Record<string, JsonValue>,
    options?: {
      abortSignal?: AbortSignal
      onNotification?: (notification: JsonRpcNotification) => void
      onRequestId?: (id: number) => void
    },
  ): Promise<{ requestId: number; result: JsonValue }> {
    await this.initialize()

    const handler =
      options?.onNotification &&
      this.onNotification((notification) => {
        if (notification.method.startsWith("codex/event")) {
          options.onNotification?.(notification)
        }
      })

    try {
      const { id, promise } = this.sendRequest("tools/call", { name: "codex", arguments: args }, options?.abortSignal)
      options?.onRequestId?.(id)
      const result = await promise
      return { requestId: id, result }
    } finally {
      handler?.()
    }
  }

  async close() {
    if (this.closed) return
    this.closed = true
    this.stdout.close()
    try {
      this.child.stdin?.end()
    } catch {
      // ignore
    }
    this.child.kill("SIGTERM")
  }

  onNotification(handler: (notification: JsonRpcNotification) => void) {
    this.notificationHandlers.add(handler)
    return () => this.notificationHandlers.delete(handler)
  }

  onExit(handler: (code: number | null, signal: NodeJS.Signals | null) => void) {
    this.exitHandlers.add(handler)
    return () => this.exitHandlers.delete(handler)
  }

  onError(handler: (error: Error) => void) {
    this.errorHandlers.add(handler)
    return () => this.errorHandlers.delete(handler)
  }

  private async initializeInternal(clientInfo?: CodexProviderOptions["clientInfo"]) {
    const params: JsonValue = {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: clientInfo?.name ?? "opencode",
        version: clientInfo?.version ?? "0.0.0",
      },
    }

    const { promise } = this.sendRequest("initialize", params)
    const result = await promise
    if (result && typeof result === "object" && "error" in result) {
      throw new Error("Codex MCP server returned an error during initialization")
    }
    await this.sendNotification("notifications/initialized", undefined)
  }

  private handleLine(line: string) {
    if (!line.trim()) return
    let message: JsonValue
    try {
      message = JSON.parse(line)
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(`Failed to parse MCP message: ${String(error)}`),
      )
      return
    }

    this.hooks.onReceive?.(message)

    if (!message || typeof message !== "object") return
    if ("id" in message) {
      const response = message as JsonRpcResponse
      const key = toRequestKey(response.id)
      const pending = this.pending.get(key)
      if (!pending) return
      pending.cleanup()
      this.pending.delete(key)
      if (response.error) {
        pending.reject(
          new Error(
            response.error.data
              ? `${response.error.message}: ${JSON.stringify(response.error.data)}`
              : response.error.message,
          ),
        )
      } else {
        pending.resolve(response.result ?? null)
      }
      return
    }

    if ("method" in message) {
      const notification = message as JsonRpcNotification
      this.notificationHandlers.forEach((handler) => handler(notification))
      return
    }
  }

  private handleError(error: Error) {
    if (this.closed) return
    this.errorHandlers.forEach((handler) => handler(error))
    for (const [, pending] of this.pending) {
      pending.cleanup()
      pending.reject(error)
    }
    this.pending.clear()
    this.closed = true
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null) {
    if (this.closed) return
    const stderr = this.stderrChunks.join("")
    const error = new Error(
      `codex mcp-server exited with code ${code ?? "null"}${signal ? ` signal ${signal}` : ""}${stderr ? `\n${stderr}` : ""}`,
    )
    this.handleError(error)
    this.exitHandlers.forEach((handler) => handler(code, signal))
  }

  private sendRequest(method: string, params?: JsonValue, abortSignal?: AbortSignal) {
    const id = this.requestCounter++
    const key = toRequestKey(id)

    const promise = new Promise<JsonValue>((resolve, reject) => {
      const onAbort = () => {
        this.pending.delete(key)
        this.sendNotification("notifications/cancelled", { requestId: typeof id === "number" ? id : String(id) }).catch(
          () => { },
        )
        reject(new DOMException("Aborted", "AbortError"))
      }

      const cleanup = () => {
        abortSignal?.removeEventListener("abort", onAbort)
      }

      if (abortSignal) {
        if (abortSignal.aborted) {
          onAbort()
          return
        }
        abortSignal.addEventListener("abort", onAbort, { once: true })
      }

      this.pending.set(key, {
        resolve: (value) => {
          cleanup()
          resolve(value)
        },
        reject: (error) => {
          cleanup()
          reject(error)
        },
        cleanup,
      })

      const request: JsonRpcRequest = {
        jsonrpc: JSONRPC_VERSION,
        id,
        method,
        params,
      }
      this.writeMessage(request)
    })

    return { id, promise }
  }

  private async sendNotification(method: string, params?: JsonValue) {
    const notification: JsonRpcNotification = {
      jsonrpc: JSONRPC_VERSION,
      method,
      params,
    }
    this.writeMessage(notification)
  }

  private writeMessage(message: JsonRpcRequest | JsonRpcNotification) {
    if (this.closed) return
    this.hooks.onSend?.(message)
    this.child.stdin.write(JSON.stringify(message) + "\n")
  }
}
