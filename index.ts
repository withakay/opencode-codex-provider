import type { Plugin, Hooks } from "@opencode-ai/plugin"
import { createCodexProvider } from "./src/codexProvider"

const PACKAGE_NAME = "opencode-codex-provider"

export { createCodexProvider }

export const CodexProviderPlugin: Plugin = async () => {
  const providerNpm = PACKAGE_NAME
  const defaultModels = {
    "gpt-5-codex": { name: "GPT-5 Codex", reasoning: true },
    "gpt-5": { name: "GPT-5", reasoning: true },
    "gpt-5-mini": { name: "GPT-5 Mini" },
    "o3": { name: "O3", reasoning: true },
    "o3-mini": { name: "O3 Mini", reasoning: true },
    "o4-mini": { name: "O4 Mini" },
    "codex-mini-latest": { name: "Codex Mini" },
    "gpt-4o": { name: "GPT-4o" },
    "gpt-4.1": { name: "GPT-4.1" },
    "gpt-3.5-turbo": { name: "GPT-3.5 Turbo" },
  } satisfies Record<string, Record<string, unknown>>

  return {
    async config(config) {
      config.provider = config.provider ?? {}
      const existing = config.provider["codex"] ?? {}
      const options = {
        ...(existing.options ?? {}),
      }
      if (!options.providerFactory) {
        options.providerFactory = "opencode-codex-provider/provider"
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
