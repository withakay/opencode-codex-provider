#!/usr/bin/env bun

// Manual integration test for opencode-codex-provider
import { CodexProviderPlugin } from "./index.ts"

console.log("Testing Codex Provider Plugin...")

// Test plugin loading
try {
  const plugin = await CodexProviderPlugin()
  console.log("✅ Plugin loaded successfully")
  
  // Test config hook
  const testConfig = {
    provider: {}
  }
  
  await plugin.config(testConfig)
  console.log("✅ Config hook executed")
  console.log("Updated config:", JSON.stringify(testConfig, null, 2))
  
  // Check if codex provider was registered
  if (testConfig.provider?.codex) {
    console.log("✅ Codex provider registered successfully")
    console.log("Provider name:", testConfig.provider.codex.name)
    console.log("Provider models:", Object.keys(testConfig.provider.codex.models))
  } else {
    console.log("❌ Codex provider not found in config")
  }
  
} catch (error) {
  console.error("❌ Error testing plugin:", error)
  process.exit(1)
}

console.log("\n🎉 Manual integration test completed!")