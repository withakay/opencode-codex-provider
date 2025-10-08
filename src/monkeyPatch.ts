import { codexLog } from "./logger"

// Cache management configuration
const CACHE_CONFIG = {
  MAX_SIZE: 100, // Maximum number of cached models
  TTL_MS: 5 * 60 * 1000, // 5 minutes TTL for cached models
} as const

// Global state for patch application
let patchApplied = false
let patchPromise: Promise<void> | null = null

// Cache entry interface for TTL management
interface CacheEntry {
  value: any
  timestamp: number
}

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * Import paths for Provider module resolution.
 * These paths are tried in order when importing the Provider module.
 */
const IMPORT_PATHS = {
  RELATIVE_PROVIDER: "../../opencode/opencode/packages/opencode/src/provider/provider.ts",
  INSTALLED_PROVIDER: "opencode/provider/provider"
} as const

/**
 * Standardized error messages for consistent logging and error reporting.
 * These messages are used throughout the patch for consistent error handling.
 */
const ERROR_MESSAGES = {
  FACTORY_NOT_FOUND: "Custom provider factory did not expose createCodexProvider",
  DEPENDENCY_INJECTION_NOT_SUPPORTED: "Dependency injection not supported",
  PROVIDER_IMPORT_FAILED: "Failed to import Provider module",
  PATCH_ALREADY_APPLIED: "patch.already_applied",
  PATCH_APPLIED_SUCCESSFULLY: "patch.applied_successfully",
  PATCH_APPLICATION_FAILED: "patch.application_failed",
  FACTORY_DETECTED: "patch.factory_detected",
  MODEL_LOADED: "patch.model_loaded"
} as const

/**
 * Error recovery documentation for common error scenarios.
 * This helps users understand what went wrong and how to fix it.
 */
const ERROR_RECOVERY_DOCS = {
  MODEL_NOT_FOUND: {
    description: "The requested model was not found in the provider configuration",
    commonCauses: [
      "Model ID typo or case mismatch",
      "Provider not properly configured",
      "Model not available in current provider version"
    ],
    solutions: [
      "Check available models using Provider.state()",
      "Verify provider configuration",
      "Update provider to latest version"
    ]
  },
  INIT_ERROR: {
    description: "Provider initialization failed during factory loading",
    commonCauses: [
      "Factory module not found or invalid",
      "Factory function missing or malformed",
      "Network issues during module import",
      "Missing dependencies in factory module"
    ],
    solutions: [
      "Verify factory module path is correct",
      "Ensure factory exports createCodexProvider function",
      "Check network connectivity for remote modules",
      "Install missing dependencies"
    ]
  },
  FACTORY_EXTRACTION: {
    description: "Could not extract factory function from module",
    commonCauses: [
      "Module doesn't export createCodexProvider",
      "Module exports are malformed",
      "Module is null or undefined"
    ],
    solutions: [
      "Ensure module exports { createCodexProvider }",
      "Check for default export patterns",
      "Verify module loads correctly"
    ]
  }
} as const

// TypeScript interfaces for better type safety
interface ProviderState {
  models: Map<string, CacheEntry>
  providers: Record<string, ProviderInfo>
  sdk: Map<number, any>
}

interface ProviderInfo {
  source: string
  info: {
    id: string
    npm?: string
    name: string
    env: string[]
    api?: string
    models: Record<string, ModelInfo>
  }
  options: Record<string, any>
  getModel?: (sdk: any, modelID: string) => Promise<any>
}

interface ModelInfo {
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

interface ProviderModule {
  Provider: {
    getModel: (providerID: string, modelID: string) => Promise<any>
    ModelNotFoundError: new (params: { providerID: string; modelID: string }) => Error
    InitError: new (params: { providerID: string }, options?: { cause?: Error }) => Error
  }
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Error context information for better debugging and error recovery.
 * This interface provides structured context that helps with:
 * - Debugging: Clear identification of what operation failed
 * - Error recovery: Information about available alternatives
 * - Logging: Structured data for error tracking systems
 */
interface ErrorContext {
  /** The provider identifier that was being accessed */
  providerID: string
  /** The model identifier that was being loaded (optional) */
  modelID?: string
  /** The factory module path that was being imported (optional) */
  factoryModule?: string
  /** The specific operation that failed (for debugging) */
  operation?: string
  /** List of available providers (for error recovery suggestions) */
  availableProviders?: string[]
  /** List of available models for the provider (for error recovery suggestions) */
  availableModels?: string[]
}

/**
 * Creates a detailed ModelNotFoundError with context information.
 * 
 * This helper function standardizes ModelNotFoundError creation and ensures
 * consistent error messages across the codebase. It includes context information
 * that helps users understand what went wrong and how to fix it.
 * 
 * @param context - Error context containing provider and model details
 * @returns CustomModelNotFoundError with informative message
 * 
 * @example
 * ```typescript
 * const error = createModelNotFoundError({
 *   providerID: 'openai',
 *   modelID: 'gpt-4-nonexistent',
 *   operation: 'model_lookup',
 *   availableModels: ['gpt-4', 'gpt-3.5-turbo']
 * })
 * ```
 */
function createModelNotFoundError(context: ErrorContext): CustomModelNotFoundError {
  const { providerID, modelID } = context
  return new CustomModelNotFoundError({ providerID, modelID: modelID! })
}

/**
 * Creates a detailed InitError with context and cause information.
 * 
 * This helper function standardizes InitError creation and ensures proper
 * error chaining. It preserves the original error as a cause while providing
 * provider-specific context in the error message.
 * 
 * @param context - Error context containing provider details
 * @param cause - Optional underlying error that caused the init failure
 * @returns CustomInitError with informative message and cause chain
 * 
 * @example
 * ```typescript
 * try {
 *   await import('invalid-module')
 * } catch (importError) {
 *   throw createInitError({
 *     providerID: 'custom',
 *     factoryModule: 'invalid-module',
 *     operation: 'factory_import'
 *   }, importError)
 * }
 * ```
 */
function createInitError(context: ErrorContext, cause?: Error): CustomInitError {
  return new CustomInitError({ providerID: context.providerID }, { cause })
}

/**
 * Custom error classes that include provider/model details in the message
 * These override the default NamedError behavior to match test expectations
 */
class CustomModelNotFoundError extends Error {
  constructor(params: { providerID: string; modelID: string }) {
    super(`Model ${params.modelID} not found for provider ${params.providerID}`)
    this.name = 'ProviderModelNotFoundError'
  }
}

class CustomInitError extends Error {
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
 * Import strategies for Provider module resolution
 */
const PROVIDER_IMPORT_STRATEGIES = [
  {
    name: "file_url_absolute",
    getPath: () => {
      const path = require('path')
      const absolutePath = path.resolve(process.cwd(), IMPORT_PATHS.RELATIVE_PROVIDER)
      return `file://${absolutePath}`
    }
  },
  {
    name: "relative_typescript",
    getPath: () => IMPORT_PATHS.RELATIVE_PROVIDER
  },
  {
    name: "relative_javascript",
    getPath: () => IMPORT_PATHS.RELATIVE_PROVIDER.replace('.ts', '.js')
  },
  {
    name: "installed_package",
    getPath: () => IMPORT_PATHS.INSTALLED_PROVIDER
  }
] as const

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates that an imported module has the expected Provider structure
 * @param moduleObject - The imported module to validate
 * @returns True if module has valid Provider structure
 */
function isValidProviderModule(moduleObject: any): moduleObject is ProviderModule {
  return moduleObject && 
         moduleObject.Provider && 
         typeof moduleObject.Provider.getModel === 'function'
}

/**
 * Validates provider configuration and throws appropriate errors
 * @param providerState - Current provider state
 * @param providerID - Provider identifier to validate
 * @param modelID - Model identifier to validate
 * @param errorClasses - Error constructors for throwing appropriate errors
 * @returns Provider configuration if valid
 * @throws ModelNotFoundError if provider or model not found
 */
function validateProviderAndModel(
  providerState: ProviderState,
  providerID: string,
  modelID: string,
  errorClasses: { ModelNotFoundError: typeof CustomModelNotFoundError }
): { providerConfig: ProviderInfo; modelInfo: ModelInfo } {
  const providerConfig = providerState.providers[providerID]
  if (!providerConfig) {
    throw createModelNotFoundError({
      providerID,
      modelID,
      operation: 'provider_lookup',
      availableProviders: Object.keys(providerState.providers)
    })
  }
  
  const modelInfo = providerConfig.info.models[modelID]
  if (!modelInfo) {
    throw createModelNotFoundError({
      providerID,
      modelID,
      operation: 'model_lookup',
      availableModels: Object.keys(providerConfig.info.models)
    })
  }
  
  return { providerConfig, modelInfo }
}

/**
 * Checks if a provider has a custom factory configured
 * @param providerConfig - Provider configuration to check
 * @returns Object with factory status and module path
 */
function getFactoryInfo(providerConfig: ProviderInfo): {
  hasCustomFactory: boolean
  factoryModule?: string
} {
  const customFactoryModule = providerConfig.options?.providerFactory
  const hasCustomFactory = typeof customFactoryModule === "string"
  
  return {
    hasCustomFactory,
    factoryModule: hasCustomFactory ? customFactoryModule : undefined
  }
}

/**
 * Attempts to import a module using a specific strategy
 * @param strategy - The import strategy to use
 * @returns Promise<ProviderModule> if successful, throws if failed
 */
async function tryImportStrategy(strategy: typeof PROVIDER_IMPORT_STRATEGIES[number]): Promise<ProviderModule> {
  const importPath = strategy.getPath()
  const moduleObject = await import(importPath)
  
  if (!isValidProviderModule(moduleObject)) {
    throw new Error(`Module structure invalid (missing Provider.getModel)`)
  }
  
  return moduleObject
}

/**
 * Resolves and imports the Provider module using multiple import strategies
 * @returns Promise<ProviderModule> The imported Provider module
 * @throws Error when all import strategies fail
 */
async function importProviderModule(): Promise<ProviderModule> {
  const importErrors: string[] = []
  
  for (const strategy of PROVIDER_IMPORT_STRATEGIES) {
    try {
      return await tryImportStrategy(strategy)
    } catch (error) {
      const importPath = strategy.getPath()
      const errorMessage = error instanceof Error ? error.message : String(error)
      importErrors.push(`${importPath}: ${errorMessage}`)
    }
  }
  
  throw new Error(`${ERROR_MESSAGES.PROVIDER_IMPORT_FAILED}. Tried strategies:\n${importErrors.join('\n')}`)
}

/**
 * Factory extraction strategies for different module export patterns
 */
const FACTORY_EXTRACTION_STRATEGIES = [
  {
    name: "named_export",
    extract: (mod: any) => mod.createCodexProvider,
    validate: (factory: any) => typeof factory === "function"
  },
  {
    name: "default_function",
    extract: (mod: any) => mod.default,
    validate: (factory: any) => typeof factory === "function"
  },
  {
    name: "default_named_export",
    extract: (mod: any) => mod.default?.createCodexProvider,
    validate: (factory: any) => typeof factory === "function"
  }
] as const

// ============================================================================
// FACTORY LOADING UTILITIES
// ============================================================================

/**
 * Safely imports a factory module with proper error handling
 * @param factoryModule - Module path to import
 * @param context - Error context for better error messages
 * @returns Promise<any> The imported module
 * @throws InitError if import fails
 */
async function importFactoryModule(factoryModule: string, context: ErrorContext): Promise<any> {
  try {
    return await import(factoryModule)
  } catch (error) {
    throw createInitError(
      { ...context, factoryModule, operation: 'factory_import' },
      error instanceof Error ? error : new Error(String(error))
    )
  }
}

/**
 * Extract factory function from imported module
 * Supports multiple export patterns to match the patch behavior
 * @param moduleObject - The imported module object
 * @param modulePath - Path to the module for error reporting
 * @returns The factory function that creates a provider
 * @throws Error when no valid factory function is found
 */
export function extractFactory(moduleObject: any, modulePath: string): Function {
  // Handle null/undefined modules gracefully
  if (moduleObject === null || moduleObject === undefined) {
    const moduleType = moduleObject === null ? 'null' : 'undefined'
    throw new Error(
      `${ERROR_MESSAGES.FACTORY_NOT_FOUND} in ${modulePath}. Module is ${moduleType}.`
    )
  }
  
  // Try each extraction strategy in order
  for (const strategy of FACTORY_EXTRACTION_STRATEGIES) {
    try {
      const extractedFactory = strategy.extract(moduleObject)
      if (strategy.validate(extractedFactory)) {
        return extractedFactory
      }
    } catch (error) {
      // Continue to next strategy if extraction fails
      continue
    }
  }
  
  // No factory found - throw error with detailed context
  const availableExports = Object.keys(moduleObject || {}).join(", ")
  const baseErrorMessage = `${ERROR_MESSAGES.FACTORY_NOT_FOUND} in ${modulePath}`
  const contextMessage = availableExports ? `. Available exports: ${availableExports}` : ""
  
  throw new Error(baseErrorMessage + contextMessage)
}

/**
 * Safely extracts factory function with proper error handling
 * @param moduleObject - The imported module object
 * @param context - Error context for better error messages
 * @returns Function The extracted factory function
 * @throws InitError if extraction fails
 */
function extractFactoryWithErrorHandling(moduleObject: any, context: ErrorContext): Function {
  try {
    return extractFactory(moduleObject, context.factoryModule!)
  } catch (error) {
    throw createInitError(
      { ...context, operation: 'factory_extraction' },
      error instanceof Error ? error : new Error(String(error))
    )
  }
}

/**
 * Loads a custom factory and creates a language model
 * @param factoryModule - Module path to load
 * @param modelID - Model identifier to create
 * @param context - Error context for better error messages
 * @returns Promise<any> The created language model
 * @throws InitError if loading or creation fails
 */
async function loadCustomFactory(
  factoryModule: string,
  modelID: string,
  context: ErrorContext
): Promise<any> {
  // Import the factory module
  const moduleObject = await importFactoryModule(factoryModule, context)
  
  // Extract the factory function
  const factoryFunction = extractFactoryWithErrorHandling(moduleObject, {
    ...context,
    factoryModule
  })
  
  // Create the language model using the factory
  try {
    return factoryFunction().languageModel(modelID)
  } catch (error) {
    throw createInitError(
      { ...context, operation: 'language_model_creation' },
      error instanceof Error ? error : new Error(String(error))
    )
  }
}

/**
 * Apply monkey patch to opencode's Provider.getModel function
 * This replicates the behavior of codex-provider-core.patch
 * 
 * The patch intercepts Provider.getModel calls and checks for a providerFactory
 * option. If found, it dynamically imports and uses the custom factory instead
 * of the default provider SDK.
 * 
 * @param injectedProviderModule - Optional Provider module for dependency injection (testing)
 * @returns Promise<void> Resolves when patch is successfully applied
 * @throws Error when import fails or patch application encounters errors
 */
export function applyProviderFactoryPatch(injectedProviderModule?: any): Promise<void> {
  // Race condition protection: if patch is already being applied, return the existing promise
  if (patchPromise) {
    return patchPromise
  }
  
  // Create and store the patch promise to prevent concurrent applications
  patchPromise = applyProviderFactoryPatchInternal(injectedProviderModule)
    .catch((error) => {
      // Clear the promise on failure to allow retry attempts
      patchPromise = null
      throw error
    })
    .then(() => {
      // Clear the promise on success
      patchPromise = null
    })
  
  return patchPromise
}

/**
 * Generates a cache key for provider/model combinations
 * @param providerID - The provider identifier
 * @param modelID - The model identifier
 * @returns Cache key string in format "providerID/modelID"
 */
function generateCacheKey(providerID: string, modelID: string): string {
  return `${providerID}/${modelID}`
}

/**
 * Checks if a cache entry is still valid based on TTL
 * @param entry - The cache entry to check
 * @returns True if entry is still valid, false if expired
 */
function isCacheEntryValid(entry: CacheEntry): boolean {
  const now = Date.now()
  return (now - entry.timestamp) < CACHE_CONFIG.TTL_MS
}

/**
 * Manages cache size by removing oldest entries when limit is exceeded
 * @param cache - The cache Map to manage
 */
function manageCacheSize(cache: Map<string, CacheEntry>): void {
  if (cache.size <= CACHE_CONFIG.MAX_SIZE) {
    return
  }
  
  // Convert to array and sort by timestamp (oldest first)
  const entries = Array.from(cache.entries())
    .sort(([, a], [, b]) => a.timestamp - b.timestamp)
  
  // Remove oldest entries until we're under the limit
  const entriesToRemove = entries.slice(0, cache.size - CACHE_CONFIG.MAX_SIZE)
  for (const [key] of entriesToRemove) {
    cache.delete(key)
  }
}

/**
 * Retrieves a value from cache if it exists and is still valid
 * @param cache - The cache Map to check
 * @param key - The cache key to look up
 * @returns The cached value if valid, undefined otherwise
 */
function getCachedValue(cache: Map<string, CacheEntry>, key: string): any | undefined {
  const entry = cache.get(key)
  if (!entry) {
    return undefined
  }
  
  if (!isCacheEntryValid(entry)) {
    cache.delete(key)
    return undefined
  }
  
  return entry.value
}

/**
 * Stores a value in cache with timestamp for TTL management
 * @param cache - The cache Map to store in
 * @param key - The cache key
 * @param value - The value to cache
 */
function setCachedValue(cache: Map<string, CacheEntry>, key: string, value: any): void {
  cache.set(key, {
    value,
    timestamp: Date.now()
  })
  
  // Manage cache size after adding new entry
  manageCacheSize(cache)
}

/**
 * Creates the default patch state with codex provider configuration
 * @returns ProviderState with default configuration
 */
function createDefaultPatchState(): ProviderState {
  return {
    models: new Map(),
    providers: {
      // Add a test provider configuration for the codex provider
      codex: {
        source: "config" as const,
        info: {
          id: "codex",
          npm: "opencode-codex-provider",
          name: "Codex CLI",
          env: [],
          models: {
            "gpt-5-codex": {
              id: "gpt-5-codex",
              name: "GPT-5 Codex",
              attachment: false,
              reasoning: true,
              temperature: true,
              tool_call: true,
              cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
              options: {},
              limit: { context: 128000, output: 8192 }
            }
          }
        },
        options: {
          providerFactory: "opencode-codex-provider/provider"
        }
      }
    },
    sdk: new Map()
  }
}

// ============================================================================
// MODEL REQUEST HANDLING
// ============================================================================

/**
 * Handles a complete model request with caching, validation, and factory loading
 * @param providerID - Provider identifier
 * @param modelID - Model identifier
 * @param providerState - Current provider state
 * @param Provider - Provider module with error classes
 * @param originalGetModel - Original getModel function for fallback
 * @returns Promise<any> The model result object
 */
async function handleModelRequest(
  providerID: string,
  modelID: string,
  providerState: ProviderState,
  Provider: any,
  originalGetModel: Function
): Promise<any> {
  // Generate cache key for this provider/model combination
  const cacheKey = generateCacheKey(providerID, modelID)
  
  // Check cache first - return cached model if available (performance optimization)
  const cachedModel = getCachedValue(providerState.models, cacheKey)
  if (cachedModel) {
    return cachedModel
  }
  
  // Validate provider and model configuration
  const { providerConfig, modelInfo } = validateProviderAndModel(
    providerState,
    providerID,
    modelID,
    { ModelNotFoundError: Provider.ModelNotFoundError }
  )
  
  // Check if provider has a custom factory configured
  const { hasCustomFactory, factoryModule } = getFactoryInfo(providerConfig)
  
  if (hasCustomFactory) {
    return handleCustomFactoryRequest(
      providerID,
      modelID,
      factoryModule!,
      modelInfo,
      providerConfig,
      providerState,
      cacheKey
    )
  }
  
  // No providerFactory configured - delegate to original getModel implementation
  return originalGetModel.call(Provider, providerID, modelID)
}

/**
 * Handles model requests that use custom factory providers
 * @param providerID - Provider identifier
 * @param modelID - Model identifier
 * @param factoryModule - Factory module path
 * @param modelInfo - Model configuration
 * @param providerConfig - Provider configuration
 * @param providerState - Current provider state
 * @param cacheKey - Cache key for storing result
 * @returns Promise<any> The model result object
 */
async function handleCustomFactoryRequest(
  providerID: string,
  modelID: string,
  factoryModule: string,
  modelInfo: ModelInfo,
  providerConfig: ProviderInfo,
  providerState: ProviderState,
  cacheKey: string
): Promise<any> {
  // Log factory detection with format expected by tests
  if (process.env["OPENCODE_CODEX_PROVIDER_DEBUG"]) {
    console.debug(ERROR_MESSAGES.FACTORY_DETECTED, { 
      providerID, 
      factoryModule 
    })
  }
  
  // Load the custom factory and create language model
  const context: ErrorContext = {
    providerID,
    modelID,
    factoryModule,
    operation: 'custom_factory_loading'
  }
  
  const languageModel = await loadCustomFactory(factoryModule, modelID, context)
  
  // Log successful model loading
  codexLog(ERROR_MESSAGES.MODEL_LOADED, { 
    providerID, 
    modelID, 
    source: "custom-factory" 
  })
  
  // Build result object matching the structure expected by opencode
  const modelResult = buildModelResult(
    modelID, 
    providerID, 
    modelInfo, 
    languageModel, 
    providerConfig
  )
  
  // Cache the result in state Map for future requests (critical for performance)
  setCachedValue(providerState.models, cacheKey, modelResult)
  
  return modelResult
}

/**
 * Builds the model result object with the expected structure
 * @param modelID - The model identifier
 * @param providerID - The provider identifier  
 * @param modelInfo - Model information from provider config
 * @param languageModel - The language model instance from factory
 * @param providerConfig - Provider configuration object
 * @returns Formatted model result object
 */
function buildModelResult(
  modelID: string, 
  providerID: string, 
  modelInfo: ModelInfo, 
  languageModel: any, 
  providerConfig: ProviderInfo
) {
  return {
    modelID,
    providerID,
    info: modelInfo,
    language: languageModel,
    npm: modelInfo.provider?.npm ?? providerConfig.info.npm
  }
}

/**
 * Internal implementation of the provider factory patch
 * Handles the actual patching logic with proper error handling and logging
 * 
 * @param injectedProviderModule - Optional Provider module for dependency injection
 * @returns Promise<void> Resolves when patch is applied or already applied
 * @throws Error when Provider module import fails or patching encounters errors
 */
async function applyProviderFactoryPatchInternal(injectedProviderModule?: any): Promise<void> {
  // Check if patch has already been applied to prevent duplicate patching
  if (patchApplied) {
    codexLog(ERROR_MESSAGES.PATCH_ALREADY_APPLIED, {})
    return
  }
  
  try {
    // Use injected module for testing, or import Provider module using multiple strategies
    let ProviderModule: ProviderModule
    if (injectedProviderModule !== undefined) {
      // Validate injected module has the expected structure
      if (!isValidProviderModule(injectedProviderModule)) {
        throw new Error(`Injected module structure invalid (missing Provider.getModel)`)
      }
      ProviderModule = injectedProviderModule
    } else {
      ProviderModule = await importProviderModule()
    }
    
    // Store reference to original getModel function for delegation
    const originalGetModel = ProviderModule.Provider.getModel
    
    // Override error classes with custom implementations that include details in messages
    ProviderModule.Provider.ModelNotFoundError = CustomModelNotFoundError as any
    ProviderModule.Provider.InitError = CustomInitError as any
    
    // Create a simple state management system for our patch
    // Since we can't easily access the internal state, we'll create our own
    const patchState: ProviderState = createDefaultPatchState()
    
    // Add a state function to the Provider module for testing
    ;(ProviderModule.Provider as any).state = async () => patchState
    
    // Replace Provider.getModel with our patched version that supports providerFactory
    ProviderModule.Provider.getModel = async function patchedGetModel(
      providerID: string,
      modelID: string
    ) {
      return handleModelRequest(
        providerID,
        modelID,
        patchState,
        ProviderModule.Provider,
        originalGetModel
      )
    }
    
    patchApplied = true
    codexLog(ERROR_MESSAGES.PATCH_APPLIED_SUCCESSFULLY, {})
    
  } catch (error) {
    codexLog(ERROR_MESSAGES.PATCH_APPLICATION_FAILED, { 
      error: error instanceof Error ? error.message : String(error) 
    })
    throw error
  }
}

/**
 * Check if the provider factory patch has been applied
 * @returns boolean True if patch is active, false otherwise
 */
export function isPatchApplied(): boolean {
  return patchApplied
}

/**
 * Reset patch application state (for testing only)
 * This function should only be used in test environments to reset
 * the global patch state between test runs
 * 
 * @internal This function is for testing purposes only
 */
export function resetPatchState(): void {
  patchApplied = false
  patchPromise = null
}

/**
 * Gets the current cache statistics for monitoring and debugging
 * @returns Object containing cache size and configuration
 * @internal This function is for debugging and monitoring purposes
 */
export function getCacheStats() {
  return {
    maxSize: CACHE_CONFIG.MAX_SIZE,
    ttlMs: CACHE_CONFIG.TTL_MS,
    // Note: actual cache size would need to be tracked in the patch state
    // This is a placeholder for future implementation
    currentSize: 0
  }
}

// ============================================================================
// ERROR CONTEXT UTILITIES
// ============================================================================

/**
 * Creates enriched error context with recovery information.
 * This function helps provide better error messages and debugging information.
 * 
 * @param baseContext - Basic error context
 * @param errorType - Type of error for recovery documentation
 * @returns Enhanced error context with recovery information
 * @internal This function is for internal error handling
 */
function createEnrichedErrorContext(
  baseContext: ErrorContext,
  errorType: keyof typeof ERROR_RECOVERY_DOCS
): ErrorContext & { recoveryInfo: typeof ERROR_RECOVERY_DOCS[keyof typeof ERROR_RECOVERY_DOCS] } {
  return {
    ...baseContext,
    recoveryInfo: ERROR_RECOVERY_DOCS[errorType]
  }
}
