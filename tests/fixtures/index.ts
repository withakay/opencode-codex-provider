/**
 * Test Fixtures Index
 * 
 * This file exports all test fixtures for easy importing in test files.
 * It provides a centralized location for accessing mock implementations
 * and test utilities for integration testing.
 * 
 * Usage:
 * ```typescript
 * import { 
 *   createMockProvider, 
 *   createMockState, 
 *   createMockConfig 
 * } from '../fixtures'
 * ```
 */

// Mock Provider exports
export {
  createMockProvider,
  createFailingMockProvider,
  createCustomMockProvider,
  createTimedMockProvider,
  isValidMockProvider,
  simulateFactoryImport,
  MockModelNotFoundError,
  MockInitError,
  MockLanguageModel,
  createMockFactory
} from './mock-provider'

export type {
  MockModelResult,
  MockModelInfo,
  MockProviderConfig,
  MockProviderOptions
} from './mock-provider'

// Mock State exports
export {
  createMockState,
  createCustomMockState,
  createErrorMockState,
  createCacheMockState,
  createMockStateManager,
  isValidMockState,
  MockStateManager
} from './mock-state'

export type {
  MockState,
  MockCacheEntry,
  MockProviderInfo,
  MockStateOptions
} from './mock-state'

// Mock Config exports
export {
  createMockConfig,
  createFactoryMockConfig,
  createErrorMockConfig,
  createEnvironmentMockConfig,
  createMockConfigManager,
  isValidMockConfig,
  MockConfigManager
} from './mock-config'

export type {
  MockOpencodeConfig,
  MockProviderConfig as MockConfigProviderConfig,
  MockModelConfig,
  MockConfigOptions
} from './mock-config'

/**
 * Convenience function to create a complete test environment
 * with all fixtures configured for integration testing
 * 
 * @param options - Configuration options for the test environment
 * @returns Complete test environment with provider, state, and config
 * 
 * @example
 * ```typescript
 * const testEnv = createTestEnvironment({
 *   includeFactoryProviders: true,
 *   simulateSuccess: true,
 *   prePopulateCache: true
 * })
 * 
 * // Use in integration tests
 * await applyProviderFactoryPatch(testEnv.provider)
 * const model = await testEnv.provider.Provider.getModel('codex', 'gpt-5-codex')
 * ```
 */
export function createTestEnvironment(options: {
  includeFactoryProviders?: boolean
  includeStandardProviders?: boolean
  simulateSuccess?: boolean
  simulateErrors?: boolean
  prePopulateCache?: boolean
  enableAllFeatures?: boolean
  customFactories?: Record<string, string>
} = {}) {
  const {
    includeFactoryProviders = true,
    includeStandardProviders = false,
    simulateSuccess = true,
    simulateErrors = false,
    prePopulateCache = false,
    enableAllFeatures = true,
    customFactories = {}
  } = options

  // Import functions to avoid circular dependencies
  const { createMockState, createMockStateManager } = require('./mock-state')
  const { createMockConfig, createMockConfigManager } = require('./mock-config')
  const { createMockProvider, createFailingMockProvider } = require('./mock-provider')

  // Create mock state
  const state = createMockState({
    includeCodexProvider: includeFactoryProviders,
    includeTestProviders: includeStandardProviders,
    prePopulateCache
  })

  // Create mock config
  const config = createMockConfig({
    includeCodexProvider: includeFactoryProviders,
    includeStandardProviders,
    enableAllFeatures,
    customFactories
  })

  // Create mock provider with appropriate behavior
  const provider = simulateErrors 
    ? createFailingMockProvider('factory-error')
    : createMockProvider({
        simulateSuccess,
        customState: state
      })

  return {
    provider,
    state,
    config,
    stateManager: createMockStateManager(state),
    configManager: createMockConfigManager(config)
  }
}

/**
 * Convenience function to create fixtures for specific test scenarios
 * 
 * @param scenario - Test scenario type
 * @returns Fixtures configured for the specific scenario
 */
export function createScenarioFixtures(scenario: 
  | 'successful-factory-loading'
  | 'provider-not-found'
  | 'model-not-found'
  | 'factory-import-error'
  | 'cache-testing'
  | 'multi-provider-setup'
) {
  // Import functions to avoid circular dependencies
  const { createMockState, createErrorMockState } = require('./mock-state')
  const { createMockConfig, createErrorMockConfig } = require('./mock-config')
  const { createFailingMockProvider } = require('./mock-provider')

  switch (scenario) {
    case 'successful-factory-loading':
      return createTestEnvironment({
        includeFactoryProviders: true,
        simulateSuccess: true,
        prePopulateCache: false
      })

    case 'provider-not-found':
      return {
        provider: createFailingMockProvider('provider-not-found'),
        state: createErrorMockState('empty'),
        config: createErrorMockConfig('no-providers')
      }

    case 'model-not-found':
      return {
        provider: createFailingMockProvider('model-not-found'),
        state: createMockState({ includeCodexProvider: true }),
        config: createMockConfig({ includeCodexProvider: true })
      }

    case 'factory-import-error':
      const errorState = createErrorMockState('invalid-factory')
      return {
        provider: createFailingMockProvider('factory-error'),
        state: errorState,
        config: createErrorMockConfig('invalid-factory')
      }

    case 'cache-testing':
      return createTestEnvironment({
        includeFactoryProviders: true,
        simulateSuccess: true,
        prePopulateCache: true
      })

    case 'multi-provider-setup':
      return createTestEnvironment({
        includeFactoryProviders: true,
        includeStandardProviders: true,
        simulateSuccess: true,
        enableAllFeatures: true
      })

    default:
      throw new Error(`Unknown scenario: ${scenario}`)
  }
}

/**
 * Test helper to reset all fixtures to clean state
 * Useful for test cleanup and ensuring test isolation
 */
export function resetFixtures() {
  // Clear any environment variables that might have been set
  const envVarsToClean = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'EXPERIMENTAL_API_KEY',
    'OPENCODE_CODEX_PROVIDER_DEBUG'
  ]

  for (const envVar of envVarsToClean) {
    delete process.env[envVar]
  }
}

/**
 * Test helper to validate that all fixtures are properly structured
 * Useful for ensuring fixture integrity in tests
 * 
 * @param fixtures - Fixtures object to validate
 * @returns Validation result with any errors found
 */
export function validateFixtures(fixtures: {
  provider?: any
  state?: any
  config?: any
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Import validation functions to avoid circular dependencies
  const { isValidMockProvider } = require('./mock-provider')
  const { isValidMockState } = require('./mock-state')
  const { isValidMockConfig } = require('./mock-config')

  if (fixtures.provider && !isValidMockProvider(fixtures.provider)) {
    errors.push('Invalid mock provider structure')
  }

  if (fixtures.state && !isValidMockState(fixtures.state)) {
    errors.push('Invalid mock state structure')
  }

  if (fixtures.config && !isValidMockConfig(fixtures.config)) {
    errors.push('Invalid mock config structure')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Test helper to create fixtures with specific timing behavior
 * Useful for testing race conditions and timeout scenarios
 * 
 * @param timingOptions - Timing configuration options
 * @returns Fixtures with timing simulation
 */
export function createTimedFixtures(timingOptions: {
  providerDelay?: number
  stateDelay?: number
  configDelay?: number
  timeoutAfter?: number
}) {
  const { createMockState } = require('./mock-state')
  const { createMockConfig } = require('./mock-config')
  const { createTimedMockProvider } = require('./mock-provider')

  const provider = createTimedMockProvider(timingOptions)
  const state = createMockState()
  const config = createMockConfig()

  return { provider, state, config }
}

/**
 * Test helper to create fixtures for performance testing
 * 
 * @param performanceOptions - Performance testing options
 * @returns Fixtures optimized for performance testing
 */
export function createPerformanceFixtures(performanceOptions: {
  cacheSize?: number
  providerCount?: number
  modelCount?: number
  enableCaching?: boolean
}) {
  const {
    cacheSize = 1000,
    providerCount = 10,
    modelCount = 100,
    enableCaching = true
  } = performanceOptions

  const { createCacheMockState, createMockStateManager } = require('./mock-state')
  const { createMockConfig, createMockConfigManager } = require('./mock-config')
  const { createMockProvider } = require('./mock-provider')

  // Create state with large cache for performance testing
  const state = createCacheMockState({
    maxSize: cacheSize,
    fillToCapacity: true
  })

  // Create config with many providers and models
  const config = createMockConfig({ includeStandardProviders: true })
  const configManager = createMockConfigManager(config)

  // Add many test providers and models
  for (let i = 0; i < providerCount; i++) {
    const providerId = `test-provider-${i}`
    configManager.addProvider(providerId, {
      id: providerId,
      name: `Test Provider ${i}`,
      npm: `test-provider-${i}`,
      env: [],
      models: {},
      enabled: true
    })

    // Add models to each provider
    for (let j = 0; j < modelCount; j++) {
      const modelId = `test-model-${j}`
      configManager.addModel(providerId, modelId, {
        id: modelId,
        name: `Test Model ${j}`,
        capabilities: {
          reasoning: true,
          tools: true,
          streaming: true
        }
      })
    }
  }

  const provider = createMockProvider({
    simulateSuccess: true,
    customState: state
  })

  return {
    provider,
    state,
    config,
    stateManager: createMockStateManager(state),
    configManager
  }
}