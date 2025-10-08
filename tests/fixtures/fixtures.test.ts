/**
 * Test Fixtures Validation Tests
 * 
 * These tests verify that our test fixtures are properly structured
 * and work correctly for integration testing scenarios.
 */

import { describe, test, expect } from "bun:test"
import {
  createMockProvider,
  createMockState,
  createMockConfig,
  createTestEnvironment,
  createScenarioFixtures,
  isValidMockProvider,
  isValidMockState,
  isValidMockConfig,
  validateFixtures,
  MockModelNotFoundError,
  MockInitError
} from "./index"

describe("Test Fixtures", () => {
  describe("Mock Provider", () => {
    test("creates valid mock provider with default options", () => {
      const mockProvider = createMockProvider()
      
      expect(isValidMockProvider(mockProvider)).toBe(true)
      expect(mockProvider.Provider).toBeDefined()
      expect(typeof mockProvider.Provider.getModel).toBe('function')
      expect(typeof mockProvider.Provider.state).toBe('function')
      expect(mockProvider.Provider.ModelNotFoundError).toBe(MockModelNotFoundError)
      expect(mockProvider.Provider.InitError).toBe(MockInitError)
    })

    test("simulates successful model loading", async () => {
      const mockProvider = createMockProvider({ simulateSuccess: true })
      
      const result = await mockProvider.Provider.getModel('codex', 'gpt-5-codex')
      
      expect(result).toBeDefined()
      expect(result.modelID).toBe('gpt-5-codex')
      expect(result.providerID).toBe('codex')
      expect(result.language).toBeDefined()
    })

    test("simulates provider not found error", async () => {
      const mockProvider = createMockProvider({ simulateProviderNotFound: true })
      
      await expect(
        mockProvider.Provider.getModel('nonexistent', 'model')
      ).rejects.toThrow(MockModelNotFoundError)
    })

    test("simulates model not found error", async () => {
      const mockProvider = createMockProvider({ simulateModelNotFound: true })
      
      await expect(
        mockProvider.Provider.getModel('codex', 'nonexistent-model')
      ).rejects.toThrow(MockModelNotFoundError)
    })

    test("simulates factory error", async () => {
      const mockProvider = createMockProvider({ simulateFactoryError: true })
      
      await expect(
        mockProvider.Provider.getModel('codex', 'gpt-5-codex')
      ).rejects.toThrow(MockInitError)
    })

    test("provides access to state", async () => {
      const mockProvider = createMockProvider()
      
      const state = await mockProvider.Provider.state()
      
      expect(state).toBeDefined()
      expect(state.models).toBeInstanceOf(Map)
      expect(state.providers).toBeDefined()
      expect(state.sdk).toBeInstanceOf(Map)
    })
  })

  describe("Mock State", () => {
    test("creates valid mock state with default options", () => {
      const state = createMockState()
      
      expect(isValidMockState(state)).toBe(true)
      expect(state.models).toBeInstanceOf(Map)
      expect(state.providers).toBeDefined()
      expect(state.sdk).toBeInstanceOf(Map)
    })

    test("includes codex provider by default", () => {
      const state = createMockState()
      
      expect(state.providers.codex).toBeDefined()
      expect(state.providers.codex.options.providerFactory).toBe('opencode-codex-provider/provider')
      expect(state.providers.codex.info.models['gpt-5-codex']).toBeDefined()
    })

    test("includes test providers when requested", () => {
      const state = createMockState({ includeTestProviders: true })
      
      expect(state.providers.openai).toBeDefined()
      expect(state.providers.anthropic).toBeDefined()
    })

    test("pre-populates cache when requested", () => {
      const state = createMockState({ prePopulateCache: true })
      
      expect(state.models.size).toBeGreaterThan(0)
      expect(state.models.has('codex/gpt-5-codex')).toBe(true)
    })
  })

  describe("Mock Config", () => {
    test("creates valid mock config with default options", () => {
      const config = createMockConfig()
      
      expect(isValidMockConfig(config)).toBe(true)
      expect(config.version).toBeDefined()
      expect(config.providers).toBeDefined()
    })

    test("includes codex provider with factory by default", () => {
      const config = createMockConfig()
      
      expect(config.providers.codex).toBeDefined()
      expect(config.providers.codex.providerFactory).toBe('opencode-codex-provider/provider')
      expect(config.providers.codex.models['gpt-5-codex']).toBeDefined()
    })

    test("includes standard providers when requested", () => {
      const config = createMockConfig({ includeStandardProviders: true })
      
      expect(config.providers.openai).toBeDefined()
      expect(config.providers.anthropic).toBeDefined()
      expect(config.providers.openai.env).toContain('OPENAI_API_KEY')
      expect(config.providers.anthropic.env).toContain('ANTHROPIC_API_KEY')
    })

    test("applies custom factory configurations", () => {
      const customFactories = {
        codex: 'custom-codex-factory',
        openai: 'custom-openai-factory'
      }
      
      const config = createMockConfig({ 
        includeStandardProviders: true,
        customFactories 
      })
      
      expect(config.providers.codex.providerFactory).toBe('custom-codex-factory')
      expect(config.providers.openai.providerFactory).toBe('custom-openai-factory')
    })
  })

  describe("Test Environment", () => {
    test("creates complete test environment", () => {
      const env = createTestEnvironment()
      
      expect(isValidMockProvider(env.provider)).toBe(true)
      expect(isValidMockState(env.state)).toBe(true)
      expect(isValidMockConfig(env.config)).toBe(true)
      expect(env.stateManager).toBeDefined()
      expect(env.configManager).toBeDefined()
    })

    test("configures environment for factory testing", () => {
      const env = createTestEnvironment({
        includeFactoryProviders: true,
        simulateSuccess: true
      })
      
      expect(env.state.providers.codex).toBeDefined()
      expect(env.config.providers.codex.providerFactory).toBeDefined()
    })

    test("configures environment for multi-provider testing", () => {
      const env = createTestEnvironment({
        includeFactoryProviders: true,
        includeStandardProviders: true
      })
      
      expect(env.state.providers.codex).toBeDefined()
      expect(env.state.providers.openai).toBeDefined()
      expect(env.config.providers.codex).toBeDefined()
      expect(env.config.providers.openai).toBeDefined()
    })
  })

  describe("Scenario Fixtures", () => {
    test("creates successful factory loading scenario", () => {
      const fixtures = createScenarioFixtures('successful-factory-loading')
      
      expect(isValidMockProvider(fixtures.provider)).toBe(true)
      expect(isValidMockState(fixtures.state)).toBe(true)
      expect(isValidMockConfig(fixtures.config)).toBe(true)
    })

    test("creates provider not found scenario", () => {
      const fixtures = createScenarioFixtures('provider-not-found')
      
      expect(fixtures.state.providers).toEqual({})
      expect(fixtures.config.providers).toEqual({})
    })

    test("creates cache testing scenario", () => {
      const fixtures = createScenarioFixtures('cache-testing')
      
      expect(fixtures.state.models.size).toBeGreaterThan(0)
    })

    test("creates multi-provider setup scenario", () => {
      const fixtures = createScenarioFixtures('multi-provider-setup')
      
      expect(Object.keys(fixtures.state.providers).length).toBeGreaterThan(1)
      expect(Object.keys(fixtures.config.providers).length).toBeGreaterThan(1)
    })
  })

  describe("Fixture Validation", () => {
    test("validates correct fixtures", () => {
      const env = createTestEnvironment()
      const validation = validateFixtures(env)
      
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test("detects invalid provider structure", () => {
      const validation = validateFixtures({
        provider: { invalid: 'structure' }
      })
      
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Invalid mock provider structure')
    })

    test("detects invalid state structure", () => {
      const validation = validateFixtures({
        state: { invalid: 'structure' }
      })
      
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Invalid mock state structure')
    })

    test("detects invalid config structure", () => {
      const validation = validateFixtures({
        config: { invalid: 'structure' }
      })
      
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Invalid mock config structure')
    })
  })

  describe("Integration with Monkey Patch", () => {
    test("mock provider works with monkey patch interface", async () => {
      const mockProvider = createMockProvider()
      
      // Test that the mock provider has the expected interface
      // that the monkey patch expects
      expect(typeof mockProvider.Provider.getModel).toBe('function')
      expect(typeof mockProvider.Provider.state).toBe('function')
      expect(mockProvider.Provider.ModelNotFoundError).toBeDefined()
      expect(mockProvider.Provider.InitError).toBeDefined()
      
      // Test that we can call the methods
      const state = await mockProvider.Provider.state()
      expect(state).toBeDefined()
      
      const model = await mockProvider.Provider.getModel('codex', 'gpt-5-codex')
      expect(model).toBeDefined()
    })

    test("mock state matches expected Provider.state() structure", async () => {
      const state = createMockState()
      
      // Verify the state has the structure expected by the monkey patch
      expect(state.models).toBeInstanceOf(Map)
      expect(state.providers).toBeDefined()
      expect(state.sdk).toBeInstanceOf(Map)
      
      // Verify provider structure
      const codexProvider = state.providers.codex
      expect(codexProvider.source).toBe('config')
      expect(codexProvider.info.id).toBe('codex')
      expect(codexProvider.info.models).toBeDefined()
      expect(codexProvider.options.providerFactory).toBeDefined()
    })

    test("mock config supports providerFactory configuration", () => {
      const config = createMockConfig()
      
      // Verify the config has providerFactory settings
      expect(config.providers.codex.providerFactory).toBe('opencode-codex-provider/provider')
      
      // Test custom factory configuration
      const customConfig = createMockConfig({
        customFactories: { codex: 'custom/factory/path' }
      })
      expect(customConfig.providers.codex.providerFactory).toBe('custom/factory/path')
    })
  })
})