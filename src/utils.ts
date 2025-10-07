import type { LanguageModelV2CallOptions } from "@ai-sdk/provider"
import type { CodexProviderOptions, JsonValue } from "./types"

export const DEFAULT_REASONING: CodexProviderOptions["reasoningEffort"] = "minimal"

export function extractTextFromResult(result: JsonValue): string {
  if (result && typeof result === "object" && "content" in result) {
    const content = (result as { content?: unknown }).content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block === "object" && "type" in block && (block as any).type === "text") {
          const text = (block as any).text
          if (typeof text === "string") {
            return text
          }
        }
      }
    }
  }
  if (result && typeof result === "object" && "toolResult" in result) {
    const toolResult = (result as { toolResult?: JsonValue }).toolResult
    if (toolResult && typeof toolResult === "object" && "text" in toolResult) {
      const text = (toolResult as any).text
      if (typeof text === "string") return text
    }
  }
  return ""
}

export function mapApprovalPolicy(policy: CodexProviderOptions["approvalPolicy"]) {
  switch (policy) {
    case "untrusted":
      return "untrusted"
    case "on-failure":
      return "on-failure"
    case "never":
      return "never"
    case "on-request":
    default:
      return "on-request"
  }
}

export function mapSandboxMode(mode: CodexProviderOptions["sandboxMode"]) {
  switch (mode) {
    case "read-only":
      return "read-only"
    case "danger-full-access":
      return "danger-full-access"
    case "workspace-write":
    default:
      return "workspace-write"
  }
}

export function extractTextFromMessage(message: any) {
  if (typeof message.content === "string") {
    return message.content.trim()
  }
  if (Array.isArray(message.content)) {
    return extractTextFromParts(message.content)
  }
  return ""
}

export function extractTextFromParts(parts: any[]) {
  const textSegments: string[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    if (part.type === "text" && typeof part.text === "string") {
      const trimmed = part.text.trim()
      if (trimmed) textSegments.push(trimmed)
    } else if (part.type === "tool-result" && typeof part.output === "object" && part.output !== null) {
      const serialized = JSON.stringify(part.output)
      if (serialized) textSegments.push(serialized)
    } else if (part.type === "tool-call" && part.toolName) {
      textSegments.push(`Tool call: ${part.toolName}`)
    }
  }
  return textSegments.join("\n").trim()
}

export function buildConversationPayload(messages: LanguageModelV2CallOptions["prompt"]) {
  const systemSegments: string[] = []
  const userSegments: string[] = []
  const assistantSegments: string[] = []

  const iterable = Array.isArray(messages) ? (messages as unknown[]) : []

  for (const raw of iterable) {
    const message = raw as {
      role: string
      content: string | { type: string; text?: string }[]
    }
    if (message.role === "system") {
      if (typeof message.content === "string") {
        const trimmed = message.content.trim()
        if (trimmed) systemSegments.push(trimmed)
      } else if (Array.isArray(message.content)) {
        const text = extractTextFromParts(message.content)
        if (text) systemSegments.push(text)
      }
      continue
    }

    const text = extractTextFromMessage(message as any)
    if (!text) continue

    if (message.role === "assistant") {
      assistantSegments.push(text)
      continue
    }
    if (message.role === "user") {
      userSegments.push(text)
      continue
    }
  }

  const baseInstructions = systemSegments.length ? systemSegments.join("\n\n").trim() : undefined
  const userText = userSegments.join("\n\n").trim()
  const assistantText = assistantSegments.join("\n\n").trim()
  return { baseInstructions, userText, assistantText }
}

export function isLikelyText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code === 0xfffd) return false
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      return false
    }
  }
  return true
}

export function decodeExecChunk(raw: string): string | null {
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

export function sharedPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let index = 0
  while (index < max && a.charCodeAt(index) === b.charCodeAt(index)) {
    index += 1
  }
  return index
}