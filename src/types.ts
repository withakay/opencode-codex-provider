type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type JsonRpcRequest = {
  jsonrpc: string
  id: number
  method: string
  params?: JsonValue
}

export type JsonRpcNotification = {
  jsonrpc: string
  method: string
  params?: JsonValue
}

export type JsonRpcResponse = {
  jsonrpc: string
  id: number | string
  result?: JsonValue
  error?: {
    code: number
    message: string
    data?: JsonValue
  }
}

export type CodexClientHooks = {
  onSend?: (payload: JsonValue) => void
  onReceive?: (payload: JsonValue) => void
}

export type CodexProviderOptions = {
  binary?: string
  args?: string[]
  env?: Record<string, string>
  spawnCwd?: string
  cwd?: string
  approvalPolicy?: "untrusted" | "on-failure" | "on-request" | "never"
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access"
  model?: string
  reasoningEffort?: "minimal" | "low" | "medium" | "high"
  streamCommandOutput?: boolean
  streamReasoning?: boolean
  includeMessageSource?: boolean
  clientInfo?: {
    name?: string
    version?: string
  }
}

export const JSONRPC_VERSION = "2.0"
export const MCP_PROTOCOL_VERSION = "2025-06-18"

export function toRequestKey(id: number | string) {
  return typeof id === "string" ? id : String(id)
}
