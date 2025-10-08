/**
 * Mock OpenCode Configuration for Integration Testing
 * 
 * This fixture provides mock opencode configuration objects that simulate
 * different provider setups and configurations. It's designed to test
 * plugin configuration scenarios and provider factory options.
 * 
 * Features:
 * - Mock opencode configuration with provider configurations
 * - Support for different provider setups (codex, openai, anthropic, etc.)
 * - Configurable providerFactory options for testing
 * - Environment variable simulation
 * - API endpoint configuration
 * - Model availability configuration
 */

/**
 * Mock model configuration structure
 */
export interface MockModelConfig {
  id: string
  name: string
  description?: string
  contextWindow?: number
  maxTokens?: number
  pricing?: {
    input: number
    output: number
  }
  capabilities?: {
    reasoning?: boolean
    vision?: boolean
    tools?: boolean
    streaming?: boolean
  }
  experimental?: boolean
}

/**
 * Mock provider configuration structure
 */
export interface MockProviderConfig {
  id: string
  name: string
  description?: string
  npm?: string
  version?: string
  env?: string[]
  api?: {
    baseUrl?: string
    version?: string
    timeout?: number
  }
  models: Record<string, MockModelConfig>
  options?: Record<string, any>
  providerFactory?: string
  enabled?: boolean
}

/**
 * Mock opencode configuration structure
 */
export interface MockOpencodeConfig {
  version: string
  providers: Record<string, MockProviderConfig>
  defaults?: {
    provider?: string
    model?: string
    temperature?: number
    maxTokens?: number
  }
  features?: {
    streaming?: boolean
    reasoning?: boolean
    tools?: boolean
    attachments?: boolean
  }
  cache?: {
    enabled?: boolean
    ttl?: number
    maxSize?: number
  }
  logging?: {
    level?: string
    format?: string
    outputs?: string[]
  }
}

/**
 * Configuration options for mock config creation
 */
export interface MockConfigOptions {
  /** Include codex provider with factory configuration */
  includeCodexProvider?: boolean
  /** Include standard AI providers (OpenAI, Anthropic, etc.) */
  includeStandardProviders?: boolean
  /** Include experimental providers */
  includeExperimentalProviders?: boolean
  /** Enable all features by default */
  enableAllFeatures?: boolean
  /** Custom provider factory modules */
  customFactories?: Record<string, string>
  /** Environment variables to simulate */
  environmentVars?: Record<string, string>
}

/**
 * Default model configurations for different providers
 */
const DEFAULT_MODELS = {
  // Codex models (factory-based)
  codex: {
    'gpt-5-codex': {
      id: 'gpt-5-codex',
      name: 'GPT-5 Codex',
      description: 'Advanced coding model with reasoning capabilities',
      contextWindow: 128000,
      maxTokens: 8192,
      capabilities: {
        reasoning: true,
        vision: false,
        tools: true,
        streaming: true
      },
      experimental: true
    },
    'o3-mini': {
      id: 'o3-mini',
      name: 'O3 Mini',
      description: 'Compact reasoning model',
      contextWindow: 64000,
      maxTokens: 4096,
      capabilities: {
        reasoning: true,
        vision: false,
        tools: true,
        streaming: true
      }
    }
  },
  
  // OpenAI models (standard SDK)
  openai: {
    'gpt-4o': {
      id: 'gpt-4o',
      name: 'GPT-4 Omni',
      description: 'Multimodal model with vision and reasoning',
      contextWindow: 128000,
      maxTokens: 4096,
      pricing: { input: 0.005, output: 0.015 },
      capabilities: {
        reasoning: false,
        vision: true,
        tools: true,
        streaming: true
      }
    },
    'gpt-3.5-turbo': {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and efficient model for general tasks',
      contextWindow: 16384,
      maxTokens: 4096,
      pricing: { input: 0.001, output: 0.002 },
      capabilities: {
        reasoning: false,
        vision: false,
        tools: true,
        streaming: true
      }
    }
  },

  // Anthropic models (standard SDK)
  anthropic: {
    'claude-3-5-sonnet': {
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Advanced reasoning and analysis model',
      contextWindow: 200000,
      maxTokens: 8192,
      pricing: { input: 0.003, output: 0.015 },
      capabilities: {
        reasoning: false,
        vision: true,
        tools: true,
        streaming: true
      }
    },
    'claude-3-haiku': {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      description: 'Fast and efficient model for quick tasks',
      contextWindow: 200000,
      maxTokens: 4096,
      pricing: { input: 0.00025, output: 0.00125 },
      capabilities: {
        reasoning: false,
        vision: false,
        tools: true,
        streaming: true
      }
    }
  }
} as const

/**
 * Default provider configurations
 */
const DEFAULT_PROVIDERS = {
  codex: {
    id: 'codex',
    name: 'Codex CLI Provider',
    description: 'Provider for OpenAI Codex models via CLI',
    npm: 'opencode-codex-provider',
    version: '0.2.0',
    env: [],
    models: DEFAULT_MODELS.codex,
    providerFactory: 'opencode-codex-provider/provider',
    enabled: true,
    options: {
      binary: 'codex',
      timeout: 60000,
      retries: 3
    }
  },

  openai: {
    id: 'openai',
    name: 'OpenAI Provider',
    description: 'Official OpenAI API provider',
    npm: '@ai-sdk/openai',
    version: '1.0.0',
    env: ['OPENAI_API_KEY'],
    api: {
      baseUrl: 'https://api.openai.com/v1',
      version: 'v1',
      timeout: 30000
    },
    models: DEFAULT_MODELS.openai,
    enabled: true,
    options: {
      organization: process.env.OPENAI_ORG_ID,
      project: process.env.OPENAI_PROJECT_ID
    }
  },

  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Provider',
    description: 'Official Anthropic API provider',
    npm: '@ai-sdk/anthropic',
    version: '1.0.0',
    env: ['ANTHROPIC_API_KEY'],
    api: {
      baseUrl: 'https://api.anthropic.com',
      version: '2023-06-01',
      timeout: 30000
    },
    models: DEFAULT_MODELS.anthropic,
    enabled: true,
    options: {
      defaultHeaders: {
        'anthropic-version': '2023-06-01'
      }
    }
  }
} as const

/**
 * Creates a mock opencode configuration with configurable providers
 * 
 * @param options - Configuration options
 * @returns Mock opencode configuration object
 * 
 * @example
 * ```typescript
 * // Create config with codex provider only
 * const config = createMockConfig({ includeCodexProvider: true })
 * 
 * // Create config with all providers
 * const fullConfig = createMockConfig({ 
 *   includeCodexProvider: true,
 *   includeStandardProviders: true,
 *   enableAllFeatures: true 
 * })
 * 
 * // Use in tests
 * expect(config.providers.codex.providerFactory).toBe('opencode-codex-provider/provider')
 * ```
 */
export function createMockConfig(options: MockConfigOptions = {}): MockOpencodeConfig {
  const {
    includeCodexProvider = true,
    includeStandardProviders = false,
    includeExperimentalProviders = false,
    enableAllFeatures = true,
    customFactories = {},
    environmentVars = {}
  } = options

  const config: MockOpencodeConfig = {
    version: '1.0.0',
    providers: {},
    defaults: {
      provider: 'codex',
      model: 'gpt-5-codex',
      temperature: 0.7,
      maxTokens: 4096
    },
    features: {
      streaming: enableAllFeatures,
      reasoning: enableAllFeatures,
      tools: enableAllFeatures,
      attachments: enableAllFeatures
    },
    cache: {
      enabled: true,
      ttl: 300000, // 5 minutes
      maxSize: 100
    },
    logging: {
      level: 'info',
      format: 'json',
      outputs: ['console']
    }
  }

  // Add codex provider with factory configuration
  if (includeCodexProvider) {
    config.providers.codex = {
      ...DEFAULT_PROVIDERS.codex,
      providerFactory: customFactories.codex || DEFAULT_PROVIDERS.codex.providerFactory
    }
  }

  // Add standard providers
  if (includeStandardProviders) {
    config.providers.openai = {
      ...DEFAULT_PROVIDERS.openai,
      providerFactory: customFactories.openai
    }
    config.providers.anthropic = {
      ...DEFAULT_PROVIDERS.anthropic,
      providerFactory: customFactories.anthropic
    }
  }

  // Add experimental providers
  if (includeExperimentalProviders) {
    config.providers.experimental = {
      id: 'experimental',
      name: 'Experimental Provider',
      description: 'Provider for testing experimental features',
      npm: 'opencode-experimental-provider',
      env: ['EXPERIMENTAL_API_KEY'],
      models: {
        'experimental-model': {
          id: 'experimental-model',
          name: 'Experimental Model',
          experimental: true,
          capabilities: {
            reasoning: true,
            vision: true,
            tools: true,
            streaming: true
          }
        }
      },
      providerFactory: customFactories.experimental || 'opencode-experimental-provider/factory',
      enabled: false // Disabled by default
    }
  }

  // Apply environment variables
  for (const [key, value] of Object.entries(environmentVars)) {
    process.env[key] = value
  }

  return config
}

/**
 * Creates a mock config with specific factory configurations
 * 
 * @param factoryConfigs - Factory module configurations
 * @returns Mock config with custom factory setups
 */
export function createFactoryMockConfig(factoryConfigs: Record<string, {
  module: string
  options?: Record<string, any>
  enabled?: boolean
}>): MockOpencodeConfig {
  const config = createMockConfig({ includeCodexProvider: false })

  for (const [providerId, factoryConfig] of Object.entries(factoryConfigs)) {
    config.providers[providerId] = {
      id: providerId,
      name: `${providerId} Provider`,
      description: `Factory-based provider for ${providerId}`,
      npm: factoryConfig.module,
      env: [],
      models: {
        [`${providerId}-model`]: {
          id: `${providerId}-model`,
          name: `${providerId} Model`,
          capabilities: {
            reasoning: true,
            tools: true,
            streaming: true
          }
        }
      },
      providerFactory: factoryConfig.module,
      enabled: factoryConfig.enabled ?? true,
      options: factoryConfig.options || {}
    }
  }

  return config
}

/**
 * Creates a mock config that simulates error conditions
 * 
 * @param errorType - Type of error to simulate
 * @returns Mock config configured for error testing
 */
export function createErrorMockConfig(errorType: 'no-providers' | 'invalid-factory' | 'missing-env' | 'corrupted'): MockOpencodeConfig {
  switch (errorType) {
    case 'no-providers':
      return {
        version: '1.0.0',
        providers: {},
        defaults: {}
      }

    case 'invalid-factory':
      const invalidConfig = createMockConfig({ includeCodexProvider: true })
      invalidConfig.providers.codex.providerFactory = 'invalid/factory/module'
      return invalidConfig

    case 'missing-env':
      const envConfig = createMockConfig({ includeStandardProviders: true })
      // Remove environment variables that providers need
      delete process.env.OPENAI_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      return envConfig

    case 'corrupted':
      const corruptedConfig = createMockConfig({ includeCodexProvider: true })
      // Corrupt the configuration structure
      ;(corruptedConfig.providers.codex as any).models = null
      return corruptedConfig

    default:
      throw new Error(`Unknown error type: ${errorType}`)
  }
}

/**
 * Configuration manager for easier config manipulation in tests
 */
export class MockConfigManager {
  constructor(private config: MockOpencodeConfig) {}

  /**
   * Adds a provider to the configuration
   */
  addProvider(id: string, provider: MockProviderConfig): void {
    this.config.providers[id] = provider
  }

  /**
   * Removes a provider from the configuration
   */
  removeProvider(id: string): void {
    delete this.config.providers[id]
  }

  /**
   * Sets provider factory for a provider
   */
  setProviderFactory(providerId: string, factoryModule: string): void {
    if (this.config.providers[providerId]) {
      this.config.providers[providerId].providerFactory = factoryModule
    }
  }

  /**
   * Removes provider factory from a provider
   */
  removeProviderFactory(providerId: string): void {
    if (this.config.providers[providerId]) {
      delete this.config.providers[providerId].providerFactory
    }
  }

  /**
   * Enables or disables a provider
   */
  setProviderEnabled(providerId: string, enabled: boolean): void {
    if (this.config.providers[providerId]) {
      this.config.providers[providerId].enabled = enabled
    }
  }

  /**
   * Adds a model to a provider
   */
  addModel(providerId: string, modelId: string, model: MockModelConfig): void {
    if (this.config.providers[providerId]) {
      this.config.providers[providerId].models[modelId] = model
    }
  }

  /**
   * Removes a model from a provider
   */
  removeModel(providerId: string, modelId: string): void {
    if (this.config.providers[providerId]) {
      delete this.config.providers[providerId].models[modelId]
    }
  }

  /**
   * Sets default provider and model
   */
  setDefaults(provider?: string, model?: string): void {
    if (!this.config.defaults) {
      this.config.defaults = {}
    }
    if (provider) this.config.defaults.provider = provider
    if (model) this.config.defaults.model = model
  }

  /**
   * Enables or disables a feature
   */
  setFeature(feature: keyof NonNullable<MockOpencodeConfig['features']>, enabled: boolean): void {
    if (!this.config.features) {
      this.config.features = {}
    }
    this.config.features[feature] = enabled
  }

  /**
   * Sets cache configuration
   */
  setCacheConfig(cacheConfig: Partial<NonNullable<MockOpencodeConfig['cache']>>): void {
    if (!this.config.cache) {
      this.config.cache = {}
    }
    Object.assign(this.config.cache, cacheConfig)
  }

  /**
   * Gets list of providers
   */
  getProviders(): string[] {
    return Object.keys(this.config.providers)
  }

  /**
   * Gets list of models for a provider
   */
  getModelsForProvider(providerId: string): string[] {
    const provider = this.config.providers[providerId]
    return provider ? Object.keys(provider.models) : []
  }

  /**
   * Gets providers with factory configuration
   */
  getFactoryProviders(): string[] {
    return Object.entries(this.config.providers)
      .filter(([, provider]) => provider.providerFactory)
      .map(([id]) => id)
  }

  /**
   * Validates configuration structure
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!this.config.version) {
      errors.push('Missing version')
    }

    if (!this.config.providers || typeof this.config.providers !== 'object') {
      errors.push('Invalid providers configuration')
    }

    // Validate each provider
    for (const [id, provider] of Object.entries(this.config.providers)) {
      if (!provider.id || !provider.name) {
        errors.push(`Provider ${id} missing required fields`)
      }
      if (!provider.models || typeof provider.models !== 'object') {
        errors.push(`Provider ${id} has invalid models configuration`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Creates a snapshot of the current configuration
   */
  createSnapshot(): MockOpencodeConfig {
    return JSON.parse(JSON.stringify(this.config))
  }

  /**
   * Restores configuration from a snapshot
   */
  restoreSnapshot(snapshot: MockOpencodeConfig): void {
    Object.assign(this.config, JSON.parse(JSON.stringify(snapshot)))
  }
}

/**
 * Utility function to create a config manager
 * 
 * @param config - Config to manage (optional, creates default if not provided)
 * @returns Config manager instance
 */
export function createMockConfigManager(config?: MockOpencodeConfig): MockConfigManager {
  return new MockConfigManager(config || createMockConfig())
}

/**
 * Test helper to verify config structure
 * 
 * @param config - Config to validate
 * @returns True if config structure is valid
 */
export function isValidMockConfig(config: any): config is MockOpencodeConfig {
  return (
    config &&
    typeof config.version === 'string' &&
    config.providers &&
    typeof config.providers === 'object'
  )
}

/**
 * Test helper to create environment-specific configs
 * 
 * @param environment - Environment type
 * @returns Config optimized for specific environment
 */
export function createEnvironmentMockConfig(environment: 'development' | 'testing' | 'production'): MockOpencodeConfig {
  const baseConfig = createMockConfig({
    includeCodexProvider: true,
    includeStandardProviders: true
  })

  switch (environment) {
    case 'development':
      baseConfig.logging = {
        level: 'debug',
        format: 'pretty',
        outputs: ['console', 'file']
      }
      baseConfig.cache = {
        enabled: false // Disable cache for development
      }
      break

    case 'testing':
      baseConfig.logging = {
        level: 'error',
        format: 'json',
        outputs: ['memory'] // In-memory logging for tests
      }
      baseConfig.cache = {
        enabled: true,
        ttl: 1000, // Short TTL for tests
        maxSize: 10
      }
      break

    case 'production':
      baseConfig.logging = {
        level: 'info',
        format: 'json',
        outputs: ['file', 'remote']
      }
      baseConfig.cache = {
        enabled: true,
        ttl: 3600000, // 1 hour TTL
        maxSize: 1000
      }
      break
  }

  return baseConfig
}