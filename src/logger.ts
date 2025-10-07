const shouldLog = () => process.env["OPENCODE_CODEX_PROVIDER_DEBUG"]

export const codexLog = (message: string, extra?: Record<string, any>) => {
  if (!shouldLog()) return
  const parts = ["[opencode-codex-provider]", message]
  if (extra && Object.keys(extra).length > 0) {
    parts.push(JSON.stringify(extra))
  }
  console.debug(parts.join(" "))
}
