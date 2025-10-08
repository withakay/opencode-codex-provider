import { describe, test, expect } from "bun:test"

// This will fail initially - that's the RED phase
describe("Factory Extraction", () => {
  test("extracts createCodexProvider named export", async () => {
    // Dynamic import to test after implementation
    const { extractFactory } = await import("../../src/monkeyPatch")
    
    const mockModule = {
      createCodexProvider: () => ({ languageModel: () => ({}) })
    }
    
    const factory = extractFactory(mockModule, "test-module")
    expect(factory).toBeDefined()
    expect(typeof factory).toBe("function")
  })
  
  test("extracts default export as function", async () => {
    const { extractFactory } = await import("../../src/monkeyPatch")
    
    const mockModule = {
      default: () => ({ languageModel: () => ({}) })
    }
    
    const factory = extractFactory(mockModule, "test-module")
    expect(factory).toBeDefined()
    expect(typeof factory).toBe("function")
  })
  
  test("extracts default.createCodexProvider", async () => {
    const { extractFactory } = await import("../../src/monkeyPatch")
    
    const mockModule = {
      default: {
        createCodexProvider: () => ({ languageModel: () => ({}) })
      }
    }
    
    const factory = extractFactory(mockModule, "test-module")
    expect(factory).toBeDefined()
    expect(typeof factory).toBe("function")
  })
  
  test("throws error when no factory found", async () => {
    const { extractFactory } = await import("../../src/monkeyPatch")
    
    const mockModule = { randomExport: "value" }
    
    expect(() => extractFactory(mockModule, "test-module")).toThrow(
      /did not expose createCodexProvider/
    )
  })
  
  test("returns exact factory function from createCodexProvider", async () => {
    const { extractFactory } = await import("../../src/monkeyPatch")
    
    const expectedFactory = () => ({ languageModel: () => "test" })
    const mockModule = { createCodexProvider: expectedFactory }
    
    const factory = extractFactory(mockModule, "test-module")
    expect(factory).toBe(expectedFactory)
  })
})
