/**
 * Integration Test Example Using Test Fixtures
 * 
 * This test demonstrates how to use the comprehensive test fixtures
 * for integration testing scenarios. It shows practical examples of
 * using the fixtures with the monkey patch system.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { applyProviderFactoryPatch, resetPatchState } from "../../src/monkeyPatch"
import {
  createTestEnvironment,
  createScenarioFixtures,
  validateFixtures,
  resetFixtures
} from "../fixtures"

describe("Integration Testing with Fixtures", () => {
  beforeEach(() => {
    resetPatchState()
    resetFixtures()
  })

  afterEach(() => {
    resetPatchState()
    resetFixtures()
  })

  test("successful factory loading scenario", async () => {
    // Create a complete test environment for successful factory loading
    const testEnv = createTestEnvironment({
      includeFactoryProviders: true,
      simulateSuccess: true,
      prePopulateCache: false
    })

    // Validate that all fixtures are properly structured
    const validation = validateFixtures(testEnv)
    expect(validation.valid).toBe(true)
    expect(validation.errors).toHaveLength(0)

    // Apply the monkey patch using our mock provider
    await applyProviderFactoryPatch(testEnv.provider)

    // Test that the mock provider works with the monkey patch
    const model = await testEnv.provider.Provider.getModel('codex', 'gpt-5-codex')
    
    expect(model).toBeDefined()
    expect(model.modelID).toBe('gpt-5-codex')
    expect(model.providerID).toBe('codex')
    expect(model.language).toBeDefined()

    // Verify that the model was cached in state
    const state = await testEnv.provider.Provider.state()
    expect(state.models.has('codex/gpt-5-codex')).toBe(true)
  })

  test("provider not found error scenario", async () => {
    // Create fixtures for provider not found scenario
    const fixtures = createScenarioFixtures('provider-not-found')

    // Validate fixtures
    const validation = validateFixtures(fixtures)
    expect(validation.valid).toBe(true)

    // Apply patch with empty provider configuration
    await applyProviderFactoryPatch(fixtures.provider)

    // Test that provider not found error is thrown
    await expect(
      fixtures.provider.Provider.getModel('nonexistent', 'model')
    ).rejects.toThrow('Model model not found for provider nonexistent')
  })

  test("model not found error scenario", async () => {
    // Create fixtures for model not found scenario
    const fixtures = createScenarioFixtures('model-not-found')

    // Apply patch
    await applyProviderFactoryPatch(fixtures.provider)

    // Test that model not found error is thrown
    await expect(
      fixtures.provider.Provider.getModel('codex', 'nonexistent-model')
    ).rejects.toThrow('Model nonexistent-model not found for provider codex')
  })

  test("factory import error scenario (mock provider simulation)", async () => {
    // This test demonstrates the mock provider's ability to simulate factory errors
    // without the monkey patch interfering
    
    const { createFailingMockProvider } = require('../fixtures/mock-provider')
    const failingProvider = createFailingMockProvider('factory-error', 'Simulated factory import error')

    // Test the mock provider's factory error simulation directly
    await expect(
      failingProvider.Provider.getModel('codex', 'gpt-5-codex')
    ).rejects.toThrow(/Init error for provider codex.*Simulated factory import error/)
    
    // Also test that the error has the correct structure
    try {
      await failingProvider.Provider.getModel('codex', 'gpt-5-codex')
    } catch (error) {
      expect(error.name).toBe('ProviderInitError')
      expect(error.cause).toBeDefined()
      expect(error.cause.message).toBe('Simulated factory import error')
    }
  })

  test("cache testing scenario", async () => {
    // Create fixtures with pre-populated cache
    const fixtures = createScenarioFixtures('cache-testing')

    // Apply patch
    await applyProviderFactoryPatch(fixtures.provider)

    // First, load a model to populate cache
    const model1 = await fixtures.provider.Provider.getModel('codex', 'gpt-5-codex')
    
    // Verify cache now has the model
    const state = await fixtures.provider.Provider.state()
    expect(state.models.size).toBeGreaterThan(0)

    // Test cache hit - should return cached result
    const model2 = await fixtures.provider.Provider.getModel('codex', 'gpt-5-codex')

    // Both calls should return equivalent results (same structure)
    expect(model1.modelID).toBe(model2.modelID)
    expect(model1.providerID).toBe(model2.providerID)
  })

  test("multi-provider setup scenario", async () => {
    // Create fixtures with multiple providers
    const fixtures = createScenarioFixtures('multi-provider-setup')

    // Apply patch
    await applyProviderFactoryPatch(fixtures.provider)

    // Verify multiple providers are available
    const state = await fixtures.provider.Provider.state()
    const providerIds = Object.keys(state.providers)
    
    expect(providerIds).toContain('codex')
    expect(providerIds.length).toBeGreaterThanOrEqual(1)

    // Test that codex provider uses factory
    expect(state.providers.codex.options.providerFactory).toBeDefined()
    
    // If openai provider exists, test that it may or may not have factory
    if (state.providers.openai) {
      expect(providerIds).toContain('openai')
      expect(providerIds.length).toBeGreaterThan(1)
    }
  })

  test("state manager functionality", async () => {
    // Create test environment
    const testEnv = createTestEnvironment()

    // Test state manager operations
    const stateManager = testEnv.stateManager

    // Add a custom provider
    stateManager.addProvider('custom', {
      source: 'config',
      info: {
        id: 'custom',
        name: 'Custom Provider',
        env: [],
        models: {
          'custom-model': {
            id: 'custom-model',
            name: 'Custom Model',
            attachment: false,
            reasoning: true,
            temperature: true,
            tool_call: true,
            cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
            options: {},
            limit: { context: 4096, output: 2048 }
          }
        }
      },
      options: {
        providerFactory: 'custom-provider/factory'
      }
    })

    // Verify provider was added
    const providers = stateManager.getProviders()
    expect(providers).toContain('custom')

    // Test model operations
    const models = stateManager.getModelsForProvider('custom')
    expect(models).toContain('custom-model')

    // Test cache operations
    stateManager.cacheModel('custom', 'custom-model', { 
      modelID: 'custom-model', 
      providerID: 'custom' 
    })

    const cacheStats = stateManager.getCacheStats()
    expect(cacheStats.keys).toContain('custom/custom-model')
  })

  test("config manager functionality", async () => {
    // Create test environment
    const testEnv = createTestEnvironment()

    // Test config manager operations
    const configManager = testEnv.configManager

    // Add a custom provider to config
    configManager.addProvider('custom', {
      id: 'custom',
      name: 'Custom Provider',
      npm: 'custom-provider',
      env: ['CUSTOM_API_KEY'],
      models: {
        'custom-model': {
          id: 'custom-model',
          name: 'Custom Model',
          capabilities: {
            reasoning: true,
            tools: true,
            streaming: true
          }
        }
      },
      providerFactory: 'custom-provider/factory',
      enabled: true
    })

    // Verify provider was added to config
    const providers = configManager.getProviders()
    expect(providers).toContain('custom')

    // Test factory provider detection
    const factoryProviders = configManager.getFactoryProviders()
    expect(factoryProviders).toContain('custom')
    expect(factoryProviders).toContain('codex')

    // Test configuration validation
    const validation = configManager.validateConfig()
    expect(validation.valid).toBe(true)
  })

  test("fixture validation catches invalid structures", () => {
    // Test with invalid provider
    const invalidProviderValidation = validateFixtures({
      provider: { invalid: 'structure' }
    })
    expect(invalidProviderValidation.valid).toBe(false)
    expect(invalidProviderValidation.errors).toContain('Invalid mock provider structure')

    // Test with invalid state
    const invalidStateValidation = validateFixtures({
      state: { invalid: 'structure' }
    })
    expect(invalidStateValidation.valid).toBe(false)
    expect(invalidStateValidation.errors).toContain('Invalid mock state structure')

    // Test with invalid config
    const invalidConfigValidation = validateFixtures({
      config: { invalid: 'structure' }
    })
    expect(invalidConfigValidation.valid).toBe(false)
    expect(invalidConfigValidation.errors).toContain('Invalid mock config structure')
  })

  test("custom test environment configuration", async () => {
    // Create custom test environment
    const customEnv = createTestEnvironment({
      includeFactoryProviders: true,
      includeStandardProviders: true,
      simulateSuccess: true,
      prePopulateCache: true,
      enableAllFeatures: true,
      customFactories: {
        codex: 'custom-codex-factory',
        openai: 'custom-openai-factory'
      }
    })

    // Verify custom factory configurations
    expect(customEnv.config.providers.codex.providerFactory).toBe('custom-codex-factory')
    expect(customEnv.config.providers.openai.providerFactory).toBe('custom-openai-factory')

    // Verify all features are enabled
    expect(customEnv.config.features?.streaming).toBe(true)
    expect(customEnv.config.features?.reasoning).toBe(true)
    expect(customEnv.config.features?.tools).toBe(true)
    expect(customEnv.config.features?.attachments).toBe(true)

    // Verify cache is pre-populated
    expect(customEnv.state.models.size).toBeGreaterThan(0)

    // Apply patch and test functionality
    await applyProviderFactoryPatch(customEnv.provider)

    const model = await customEnv.provider.Provider.getModel('codex', 'gpt-5-codex')
    expect(model).toBeDefined()
    expect(model.modelID).toBe('gpt-5-codex')
  })
})