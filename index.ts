import type { Plugin, Hooks } from "@opencode-ai/plugin"
import { createCodexProvider } from "./src/codexProvider"

const PACKAGE_NAME = "opencode-codex-provider"

export { createCodexProvider }

export const CodexProviderPlugin: Plugin = async () => {
  const providerNpm = PACKAGE_NAME
  const defaultModels = {
    "gpt-5-codex": { name: "GPT-5 Codex", reasoning: true },
    "gpt-5": { name: "GPT-5", reasoning: true }
  } satisfies Record<string, Record<string, unknown>>

  return {
    async config(config) {
      config.provider = config.provider ?? {}
      const existing = config.provider["codex"] ?? {}
      const options = {
        ...(existing.options ?? {}),
      }
      if (!options.providerFactory) {
        const isFileProtocol = import.meta.url.startsWith("file://")
        if (isFileProtocol) {
          options.providerFactory = new URL("./provider.ts", import.meta.url).pathname
        } else {
          options.providerFactory = "opencode-codex-provider/provider"
        }
      }
      const existingModels = {
        ...defaultModels,
        ...(existing.models ?? {}),
      }
      config.provider["codex"] = {
        ...existing,
        npm: existing.npm ?? providerNpm,
        name: existing.name ?? "Codex CLI",
        models: existingModels,
        options,
      }
    },
  } satisfies Hooks
}
