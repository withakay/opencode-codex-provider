/**
 * Mock Provider Implementation for Integration Testing
 * 
 * This fixture provides a mock implementation of the Provider module that simulates
 * the behavior of the actual opencode Provider system. It's designed to be used in
 * integration tests to verify the monkey patch functionality without requiring
 * the full opencode environment.
 * 
 * Features:
 * - Mock provider registry and model loading
 * - Supports both factory and non-factory providers
 * - Includes error scenarios for testing
 * - Compatible with existing Provider interface
 * - Configurable for different test scenarios
 */

import type { MockState } from "./mock-state"
import { createMockState } from "./mock-state"

/**
 * Mock model result structure that matches opencode's expected format
 */
export interface MockModelResult {
  modelID: string
  providerID: string
  info: MockModelInfo
  language: any
  npm?: string
}

/**
 * Mock model information structure
 */
export interface MockModelInfo {
  id: string
  name: string
  release_date?: string
  attachment: boolean
  reasoning: boolean
  temperature: boolean
  tool_call: boolean
  cost: {
    input: number
    output: number
    cache_read: number
    cache_write: number
  }
  options: Record<string, any>
  limit: {
    context: number
    output: number
  }
  provider?: {
    npm?: string
  }
  experimental?: boolean
}

/**
 * Mock provider configuration
 */
export interface MockProviderConfig {
  source: string
  info: {
    id: string
    npm?: string
    name: string
    env: string[]
    api?: string
    models: Record<string, MockModelInfo>
  }
  options: Record<string, any>
  getModel?: (sdk: any, modelID: string) => Promise<any>
}

/**
 * Configuration options for the mock provider
 */
export interface MockProviderOptions {
  /** Whether to simulate successful model loading */
  simulateSuccess?: boolean
  /** Whether to simulate provider not found errors */
  simulateProviderNotFound?: boolean
  /** Whether to simulate model not found errors */
  simulateModelNotFound?: boolean
  /** Whether to simulate factory import errors */
  simulateFactoryError?: boolean
  /** Custom state to use instead of default */
  customState?: MockState
  /** Custom error messages for testing */
  customErrors?: {
    providerNotFound?: string
    modelNotFound?: string
    factoryError?: string
  }
}

/**
 * Mock error classes that match the expected Provider error interface
 */
export class MockModelNotFoundError extends Error {
  constructor(params: { providerID: string; modelID: string }) {
    super(`Model ${params.modelID} not found for provider ${params.providerID}`)
    this.name = 'ProviderModelNotFoundError'
  }
}

export class MockInitError extends Error {
  public cause?: Error
  
  constructor(params: { providerID: string }, options?: { cause?: Error }) {
    let message = `Init error for provider ${params.providerID}`
    if (options?.cause) {
      message += `: ${options.cause.message}`
    }
    super(message)
    this.name = 'ProviderInitError'
    if (options?.cause) {
      this.cause = options.cause
    }
  }
}

/**
 * Mock language model that simulates the AI SDK interface
 */
export class MockLanguageModel {
  constructor(public readonly modelId: string) {}

  async doStream(options: any) {
    // Simulate streaming response
    return {
      stream: new ReadableStream({
        start(controller) {
          // Simulate text delta
          controller.enqueue({
            type: 'text-delta',
            delta: 'Hello from mock model!'
          })
          
          // Simulate finish
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: {
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15
            }
          })
          
          controller.close()
        }
      })
    }
  }

  async doGenerate(options: any) {
    return {
      content: [{ type: 'text', text: 'Hello from mock model!' }],
      finishReason: 'stop' as const,
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15
      },
      warnings: []
    }
  }
}

/**
 * Mock factory function that creates a provider
 */
export function createMockFactory() {
  return {
    languageModel: (modelId: string) => new MockLanguageModel(modelId)
  }
}

/**
 * Creates a mock Provider module with configurable behavior
 * 
 * @param options - Configuration options for mock behavior
 * @returns Mock Provider module that can be used in tests
 * 
 * @example
 * ```typescript
 * // Create a mock provider that simulates success
 * const mockProvider = createMockProvider({ simulateSuccess: true })
 * 
 * // Use in monkey patch testing
 * await applyProviderFactoryPatch(mockProvider)
 * 
 * // Test model loading
 * const model = await mockProvider.Provider.getModel('codex', 'gpt-5-codex')
 * ```
 */
export function createMockProvider(options: MockProviderOptions = {}) {
  const {
    simulateSuccess = true,
    simulateProviderNotFound = false,
    simulateModelNotFound = false,
    simulateFactoryError = false,
    customState,
    customErrors = {}
  } = options

  // Create or use provided state
  const state = customState || createMockState()

  // Track original getModel for delegation
  let originalGetModel: Function | null = null

  const mockProvider = {
    Provider: {
      /**
       * Mock getModel function that simulates provider behavior
       */
      getModel: async function(providerID: string, modelID: string): Promise<MockModelResult> {
        // Simulate provider not found error
        if (simulateProviderNotFound) {
          throw new MockModelNotFoundError({ providerID, modelID })
        }

        // Check if provider exists in state
        const providerConfig = state.providers[providerID]
        if (!providerConfig) {
          throw new MockModelNotFoundError({ providerID, modelID })
        }

        // Simulate model not found error
        if (simulateModelNotFound) {
          throw new MockModelNotFoundError({ providerID, modelID })
        }

        // Check if model exists in provider
        const modelInfo = providerConfig.info.models[modelID]
        if (!modelInfo) {
          throw new MockModelNotFoundError({ providerID, modelID })
        }

        // Check for custom factory
        const factoryModule = providerConfig.options?.providerFactory
        if (factoryModule) {
          // Simulate factory error
          if (simulateFactoryError) {
            throw new MockInitError(
              { providerID },
              { cause: new Error(customErrors.factoryError || 'Mock factory error') }
            )
          }

          // Simulate factory loading
          const factory = createMockFactory()
          const languageModel = factory.languageModel(modelID)

          // Build result object
          const result: MockModelResult = {
            modelID,
            providerID,
            info: modelInfo,
            language: languageModel,
            npm: modelInfo.provider?.npm ?? providerConfig.info.npm
          }

          // Cache in state
          const cacheKey = `${providerID}/${modelID}`
          state.models.set(cacheKey, {
            value: result,
            timestamp: Date.now()
          })

          return result
        }

        // No factory - delegate to original or simulate default behavior
        if (originalGetModel) {
          return originalGetModel.call(this, providerID, modelID)
        }

        // Default simulation
        const languageModel = new MockLanguageModel(modelID)
        return {
          modelID,
          providerID,
          info: modelInfo,
          language: languageModel,
          npm: modelInfo.provider?.npm ?? providerConfig.info.npm
        }
      },

      /**
       * Mock state function that returns the current provider state
       */
      state: async function(): Promise<MockState> {
        return state
      },

      /**
       * Mock error classes
       */
      ModelNotFoundError: MockModelNotFoundError,
      InitError: MockInitError
    }
  }

  // Store reference to original getModel for potential delegation
  originalGetModel = mockProvider.Provider.getModel

  return mockProvider
}

/**
 * Creates a mock Provider module that always fails with specific errors
 * Useful for testing error handling scenarios
 * 
 * @param errorType - Type of error to simulate
 * @param customMessage - Custom error message
 * @returns Mock Provider module that throws specified errors
 */
export function createFailingMockProvider(
  errorType: 'provider-not-found' | 'model-not-found' | 'factory-error' | 'import-error',
  customMessage?: string
) {
  switch (errorType) {
    case 'provider-not-found':
      return createMockProvider({
        simulateProviderNotFound: true,
        customErrors: { providerNotFound: customMessage }
      })
    
    case 'model-not-found':
      return createMockProvider({
        simulateModelNotFound: true,
        customErrors: { modelNotFound: customMessage }
      })
    
    case 'factory-error':
      return createMockProvider({
        simulateFactoryError: true,
        customErrors: { factoryError: customMessage }
      })
    
    case 'import-error':
      // Return invalid module structure to simulate import errors
      return {
        // Missing Provider property to trigger validation errors
        InvalidProvider: {}
      }
    
    default:
      throw new Error(`Unknown error type: ${errorType}`)
  }
}

/**
 * Helper function to create a mock Provider with custom providers and models
 * 
 * @param providers - Custom provider configurations
 * @returns Mock Provider module with custom configuration
 */
export function createCustomMockProvider(providers: Record<string, MockProviderConfig>) {
  const customState = createMockState()
  customState.providers = providers

  return createMockProvider({ customState })
}

/**
 * Utility function to verify mock provider structure
 * Useful for testing that mocks conform to expected interface
 * 
 * @param mockProvider - Mock provider to validate
 * @returns True if structure is valid, false otherwise
 */
export function isValidMockProvider(mockProvider: any): boolean {
  return (
    mockProvider &&
    mockProvider.Provider &&
    typeof mockProvider.Provider.getModel === 'function' &&
    typeof mockProvider.Provider.state === 'function' &&
    typeof mockProvider.Provider.ModelNotFoundError === 'function' &&
    typeof mockProvider.Provider.InitError === 'function'
  )
}

/**
 * Test helper to simulate async factory import
 * Useful for testing dynamic import scenarios
 * 
 * @param delay - Delay in milliseconds to simulate network latency
 * @returns Promise that resolves to mock factory
 */
export async function simulateFactoryImport(delay: number = 100): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, delay))
  return {
    createCodexProvider: createMockFactory,
    default: createMockFactory
  }
}

/**
 * Test helper to create a mock provider with specific timing behavior
 * Useful for testing race conditions and timeout scenarios
 * 
 * @param options - Timing and behavior options
 * @returns Mock Provider with timing simulation
 */
export function createTimedMockProvider(options: {
  getModelDelay?: number
  stateDelay?: number
  factoryDelay?: number
  timeoutAfter?: number
} = {}) {
  const baseProvider = createMockProvider()
  const originalGetModel = baseProvider.Provider.getModel
  const originalState = baseProvider.Provider.state

  baseProvider.Provider.getModel = async function(providerID: string, modelID: string) {
    if (options.getModelDelay) {
      await new Promise(resolve => setTimeout(resolve, options.getModelDelay))
    }
    
    if (options.timeoutAfter) {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), options.timeoutAfter)
      )
      return Promise.race([
        originalGetModel.call(this, providerID, modelID),
        timeoutPromise
      ]) as Promise<MockModelResult>
    }
    
    return originalGetModel.call(this, providerID, modelID)
  }

  baseProvider.Provider.state = async function() {
    if (options.stateDelay) {
      await new Promise(resolve => setTimeout(resolve, options.stateDelay))
    }
    return originalState.call(this)
  }

  return baseProvider
}