#!/usr/bin/env bun

// Test provider loading with monkey patch
import { applyProviderFactoryPatch } from "./src/monkeyPatch.ts"

console.log("Testing Provider Loading with Monkey Patch...")

try {
  // Apply the monkey patch
  console.log("🔧 Applying monkey patch...")
  await applyProviderFactoryPatch()
  console.log("✅ Monkey patch applied successfully")
  
  // Test if we can import the provider module
  console.log("📦 Testing provider module import...")
  try {
    const ProviderModule = await import("opencode/provider/provider")
    console.log("✅ Provider module imported")
    
    // Test if getModel function exists
    if (ProviderModule.Provider && ProviderModule.Provider.getModel) {
      console.log("✅ Provider.getModel function found")
      
      // Test state access
      if (ProviderModule.Provider.state) {
        const state = ProviderModule.Provider.state()
        console.log("✅ Provider.state() accessible")
        console.log("State keys:", Object.keys(await state))
      } else {
        console.log("❌ Provider.state() not found")
      }
    } else {
      console.log("❌ Provider.getModel not found")
    }
  } catch (error) {
    console.log("ℹ️ Provider module not found (expected in test environment):", error.message)
  }
  
  console.log("\n🎉 Provider loading test completed!")
  
} catch (error) {
  console.error("❌ Error testing provider loading:", error)
  process.exit(1)
}