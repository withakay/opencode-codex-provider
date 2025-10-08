/**
 * Mock State Object for Integration Testing
 * 
 * This fixture provides a mock implementation of the Provider state that simulates
 * the internal state management of the opencode Provider system. It includes
 * providers registry, models cache, and configuration data.
 * 
 * Features:
 * - Mock providers registry with configurable providers
 * - Mock models cache with TTL support
 * - Mock SDK cache for provider instances
 * - State manipulation helpers for testing different scenarios
 * - Compatible with existing monkey patch implementation
 */

/**
 * Cache entry interface for TTL management
 */
export interface MockCacheEntry {
  value: any
  timestamp: number
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
 * Mock provider information structure
 */
export interface MockProviderInfo {
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
 * Mock provider state structure that matches opencode's Provider.state()
 */
export interface MockState {
  models: Map<string, MockCacheEntry>
  providers: Record<string, MockProviderInfo>
  sdk: Map<number, any>
}

/**
 * Configuration options for mock state creation
 */
export interface MockStateOptions {
  /** Include default codex provider configuration */
  includeCodexProvider?: boolean
  /** Include additional test providers */
  includeTestProviders?: boolean
  /** Custom TTL for cache entries (in milliseconds) */
  cacheTTL?: number
  /** Maximum cache size */
  maxCacheSize?: number
  /** Pre-populate cache with test data */
  prePopulateCache?: boolean
}

/**
 * Default model configurations for testing
 */
const DEFAULT_MODELS = {
  'gpt-5-codex': {
    id: 'gpt-5-codex',
    name: 'GPT-5 Codex',
    release_date: '2024-01-01',
    attachment: false,
    reasoning: true,
    temperature: true,
    tool_call: true,
    cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
    options: {},
    limit: { context: 128000, output: 8192 }
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4 Omni',
    attachment: true,
    reasoning: false,
    temperature: true,
    tool_call: true,
    cost: { input: 0.005, output: 0.015, cache_read: 0.0025, cache_write: 0.0125 },
    options: {},
    limit: { context: 128000, output: 4096 }
  },
  'claude-3-5-sonnet': {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    attachment: true,
    reasoning: false,
    temperature: true,
    tool_call: true,
    cost: { input: 0.003, output: 0.015, cache_read: 0.0015, cache_write: 0.0075 },
    options: {},
    limit: { context: 200000, output: 8192 }
  }
} as const

/**
 * Default provider configurations for testing
 */
const DEFAULT_PROVIDERS = {
  codex: {
    source: 'config' as const,
    info: {
      id: 'codex',
      npm: 'opencode-codex-provider',
      name: 'Codex CLI',
      env: [],
      models: {
        'gpt-5-codex': DEFAULT_MODELS['gpt-5-codex']
      }
    },
    options: {
      providerFactory: 'opencode-codex-provider/provider'
    }
  },
  openai: {
    source: 'config' as const,
    info: {
      id: 'openai',
      npm: '@ai-sdk/openai',
      name: 'OpenAI',
      env: ['OPENAI_API_KEY'],
      api: 'https://api.openai.com/v1',
      models: {
        'gpt-4o': DEFAULT_MODELS['gpt-4o']
      }
    },
    options: {}
  },
  anthropic: {
    source: 'config' as const,
    info: {
      id: 'anthropic',
      npm: '@ai-sdk/anthropic',
      name: 'Anthropic',
      env: ['ANTHROPIC_API_KEY'],
      api: 'https://api.anthropic.com',
      models: {
        'claude-3-5-sonnet': DEFAULT_MODELS['claude-3-5-sonnet']
      }
    },
    options: {}
  }
} as const

/**
 * Creates a mock state object with configurable providers and models
 * 
 * @param options - Configuration options for state creation
 * @returns Mock state object that can be used in tests
 * 
 * @example
 * ```typescript
 * // Create default state with codex provider
 * const state = createMockState()
 * 
 * // Create state with additional test providers
 * const stateWithProviders = createMockState({ 
 *   includeTestProviders: true,
 *   prePopulateCache: true 
 * })
 * 
 * // Use in tests
 * const provider = state.providers['codex']
 * expect(provider.options.providerFactory).toBe('opencode-codex-provider/provider')
 * ```
 */
export function createMockState(options: MockStateOptions = {}): MockState {
  const {
    includeCodexProvider = true,
    includeTestProviders = false,
    prePopulateCache = false
  } = options

  const state: MockState = {
    models: new Map(),
    providers: {},
    sdk: new Map()
  }

  // Add codex provider by default
  if (includeCodexProvider) {
    state.providers.codex = DEFAULT_PROVIDERS.codex
  }

  // Add additional test providers if requested
  if (includeTestProviders) {
    state.providers.openai = DEFAULT_PROVIDERS.openai
    state.providers.anthropic = DEFAULT_PROVIDERS.anthropic
  }

  // Pre-populate cache with test data if requested
  if (prePopulateCache) {
    populateTestCache(state)
  }

  return state
}

/**
 * Populates the state cache with test data for testing cache behavior
 * 
 * @param state - Mock state to populate
 */
function populateTestCache(state: MockState): void {
  const now = Date.now()
  
  // Add some cached models
  state.models.set('codex/gpt-5-codex', {
    value: {
      modelID: 'gpt-5-codex',
      providerID: 'codex',
      info: DEFAULT_MODELS['gpt-5-codex'],
      language: { modelId: 'gpt-5-codex' },
      npm: 'opencode-codex-provider'
    },
    timestamp: now
  })

  state.models.set('openai/gpt-4o', {
    value: {
      modelID: 'gpt-4o',
      providerID: 'openai',
      info: DEFAULT_MODELS['gpt-4o'],
      language: { modelId: 'gpt-4o' },
      npm: '@ai-sdk/openai'
    },
    timestamp: now - 60000 // 1 minute old
  })

  // Add some SDK instances
  state.sdk.set(1, { type: 'openai-sdk', initialized: true })
  state.sdk.set(2, { type: 'anthropic-sdk', initialized: true })
}

/**
 * Creates a mock state with custom provider configurations
 * 
 * @param providers - Custom provider configurations
 * @param options - Additional state options
 * @returns Mock state with custom providers
 */
export function createCustomMockState(
  providers: Record<string, MockProviderInfo>,
  options: MockStateOptions = {}
): MockState {
  const state = createMockState({ ...options, includeCodexProvider: false, includeTestProviders: false })
  state.providers = providers
  return state
}

/**
 * Creates a mock state that simulates various error conditions
 * 
 * @param errorType - Type of error condition to simulate
 * @returns Mock state configured for error testing
 */
export function createErrorMockState(errorType: 'empty' | 'missing-codex' | 'invalid-factory' | 'corrupted'): MockState {
  switch (errorType) {
    case 'empty':
      return {
        models: new Map(),
        providers: {},
        sdk: new Map()
      }

    case 'missing-codex':
      return createMockState({ includeCodexProvider: false, includeTestProviders: true })

    case 'invalid-factory':
      const state = createMockState()
      // Set invalid factory module path
      state.providers.codex.options.providerFactory = 'invalid/module/path'
      return state

    case 'corrupted':
      const corruptedState = createMockState()
      // Corrupt the provider structure
      ;(corruptedState.providers.codex as any).info = null
      return corruptedState

    default:
      throw new Error(`Unknown error type: ${errorType}`)
  }
}

/**
 * State manipulation helpers for testing different scenarios
 */
export class MockStateManager {
  constructor(private state: MockState) {}

  /**
   * Adds a provider to the state
   */
  addProvider(id: string, provider: MockProviderInfo): void {
    this.state.providers[id] = provider
  }

  /**
   * Removes a provider from the state
   */
  removeProvider(id: string): void {
    delete this.state.providers[id]
  }

  /**
   * Adds a model to a provider
   */
  addModel(providerId: string, modelId: string, model: MockModelInfo): void {
    if (this.state.providers[providerId]) {
      this.state.providers[providerId].info.models[modelId] = model
    }
  }

  /**
   * Removes a model from a provider
   */
  removeModel(providerId: string, modelId: string): void {
    if (this.state.providers[providerId]) {
      delete this.state.providers[providerId].info.models[modelId]
    }
  }

  /**
   * Sets provider factory option
   */
  setProviderFactory(providerId: string, factoryModule: string): void {
    if (this.state.providers[providerId]) {
      this.state.providers[providerId].options.providerFactory = factoryModule
    }
  }

  /**
   * Removes provider factory option
   */
  removeProviderFactory(providerId: string): void {
    if (this.state.providers[providerId]) {
      delete this.state.providers[providerId].options.providerFactory
    }
  }

  /**
   * Adds a cached model result
   */
  cacheModel(providerId: string, modelId: string, result: any): void {
    const cacheKey = `${providerId}/${modelId}`
    this.state.models.set(cacheKey, {
      value: result,
      timestamp: Date.now()
    })
  }

  /**
   * Removes a cached model result
   */
  uncacheModel(providerId: string, modelId: string): void {
    const cacheKey = `${providerId}/${modelId}`
    this.state.models.delete(cacheKey)
  }

  /**
   * Clears all cached models
   */
  clearCache(): void {
    this.state.models.clear()
  }

  /**
   * Simulates cache expiry by setting old timestamps
   */
  expireCache(olderThanMs: number = 300000): void {
    const expiredTime = Date.now() - olderThanMs
    for (const [key, entry] of this.state.models.entries()) {
      entry.timestamp = expiredTime
    }
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.state.models.size,
      keys: Array.from(this.state.models.keys())
    }
  }

  /**
   * Gets provider list
   */
  getProviders(): string[] {
    return Object.keys(this.state.providers)
  }

  /**
   * Gets models for a provider
   */
  getModelsForProvider(providerId: string): string[] {
    const provider = this.state.providers[providerId]
    return provider ? Object.keys(provider.info.models) : []
  }

  /**
   * Validates state structure
   */
  validateState(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!(this.state.models instanceof Map)) {
      errors.push('models is not a Map')
    }

    if (typeof this.state.providers !== 'object' || this.state.providers === null) {
      errors.push('providers is not an object')
    }

    if (!(this.state.sdk instanceof Map)) {
      errors.push('sdk is not a Map')
    }

    // Validate provider structures
    for (const [id, provider] of Object.entries(this.state.providers)) {
      if (!provider.info || !provider.info.models) {
        errors.push(`Provider ${id} has invalid structure`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Creates a snapshot of the current state for restoration
   */
  createSnapshot(): MockState {
    return {
      models: new Map(this.state.models),
      providers: JSON.parse(JSON.stringify(this.state.providers)),
      sdk: new Map(this.state.sdk)
    }
  }

  /**
   * Restores state from a snapshot
   */
  restoreSnapshot(snapshot: MockState): void {
    this.state.models = new Map(snapshot.models)
    this.state.providers = JSON.parse(JSON.stringify(snapshot.providers))
    this.state.sdk = new Map(snapshot.sdk)
  }
}

/**
 * Utility function to create a state manager for easier state manipulation
 * 
 * @param state - Mock state to manage (optional, creates default if not provided)
 * @returns State manager instance
 */
export function createMockStateManager(state?: MockState): MockStateManager {
  return new MockStateManager(state || createMockState())
}

/**
 * Test helper to verify state structure
 * 
 * @param state - State to validate
 * @returns True if state structure is valid
 */
export function isValidMockState(state: any): state is MockState {
  return (
    state &&
    state.models instanceof Map &&
    typeof state.providers === 'object' &&
    state.providers !== null &&
    state.sdk instanceof Map
  )
}

/**
 * Test helper to create state with specific cache behavior
 * 
 * @param cacheConfig - Cache configuration options
 * @returns Mock state with configured cache behavior
 */
export function createCacheMockState(cacheConfig: {
  maxSize?: number
  ttlMs?: number
  preExpired?: boolean
  fillToCapacity?: boolean
}): MockState {
  const state = createMockState({ prePopulateCache: true })
  
  if (cacheConfig.fillToCapacity && cacheConfig.maxSize) {
    // Fill cache to capacity for testing cache eviction
    for (let i = 0; i < cacheConfig.maxSize; i++) {
      state.models.set(`test-provider/test-model-${i}`, {
        value: { modelID: `test-model-${i}`, providerID: 'test-provider' },
        timestamp: Date.now()
      })
    }
  }

  if (cacheConfig.preExpired && cacheConfig.ttlMs) {
    // Set all cache entries to expired timestamps
    const expiredTime = Date.now() - cacheConfig.ttlMs - 1000
    for (const [key, entry] of state.models.entries()) {
      entry.timestamp = expiredTime
    }
  }

  return state
}