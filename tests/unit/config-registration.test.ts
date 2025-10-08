import { describe, test, expect } from "bun:test"
import { CodexProviderPlugin } from "../../index"

describe("Provider Config Registration", () => {
  test("registers codex provider with default models", async () => {
    const plugin = await CodexProviderPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
      worktree: "/test",
      $: {} as any
    })
    
    const config: any = { provider: {} }
    await plugin.config!(config)
    
    expect(config.provider.codex).toBeDefined()
    expect(config.provider.codex.name).toBe("Codex CLI")
    expect(config.provider.codex.models["gpt-5-codex"]).toBeDefined()
    expect(config.provider.codex.models["gpt-5"]).toBeDefined()
  })
  
  test("sets providerFactory option", async () => {
    const plugin = await CodexProviderPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
      worktree: "/test",
      $: {} as any
    })

    const config: any = { provider: {} }
    await plugin.config!(config)

    // Should set providerFactory to either file path or npm package path
    expect(config.provider.codex.options.providerFactory).toBeDefined()
    expect(typeof config.provider.codex.options.providerFactory).toBe("string")
  })
  
  test("preserves existing provider config", async () => {
    const plugin = await CodexProviderPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
      worktree: "/test",
      $: {} as any
    })
    
    const config: any = {
      provider: {
        codex: {
          name: "Custom Name",
          models: { "custom-model": { name: "Custom" } }
        }
      }
    }
    
    await plugin.config!(config)
    
    // Should preserve custom name
    expect(config.provider.codex.name).toBe("Custom Name")
    // Should preserve custom models
    expect(config.provider.codex.models["custom-model"]).toBeDefined()
    // Should still add default models
    expect(config.provider.codex.models["gpt-5-codex"]).toBeDefined()
  })
  
  test("sets npm package name", async () => {
    const plugin = await CodexProviderPlugin({
      client: {} as any,
      project: {} as any,
      directory: "/test",
      worktree: "/test",
      $: {} as any
    })
    
    const config: any = { provider: {} }
    await plugin.config!(config)
    
    expect(config.provider.codex.npm).toBe("opencode-codex-provider")
  })
})
