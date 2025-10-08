import { codexLog } from "./logger"

let patchApplied = false
let patchPromise: Promise<void> | null = null

// Constants for import paths and error messages
const IMPORT_PATHS = {
  RELATIVE_PROVIDER: "../../../opencode/packages/opencode/src/provider/provider.js",
  INSTALLED_PROVIDER: "opencode/src/provider/provider.js"
} as const

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

// TypeScript interfaces for better type safety
interface ProviderState {
  models: Map<string, any>
  providers: Record<string, ProviderInfo>
}

interface ProviderInfo {
  info: {
    models: Record<string, ModelInfo>
    npm?: string
  }
  options?: {
    providerFactory?: string
  }
}

interface ModelInfo {
  provider?: {
    npm?: string
  }
}

interface ProviderModule {
  Provider: {
    getModel: (providerID: string, modelID: string) => Promise<any>
    state: () => Promise<ProviderState>
    ModelNotFoundError: new (params: { providerID: string; modelID: string }) => Error
    InitError: new (params: { providerID: string }, options?: { cause?: Error }) => Error
  }
}

/**
 * Resolves and imports the Provider module using multiple import strategies
 * @returns Promise<ProviderModule> The imported Provider module
 * @throws Error when all import strategies fail
 */
async function importProviderModule(): Promise<ProviderModule> {
  try {
    // Strategy 1: Relative path from plugin to opencode workspace
    return await import(IMPORT_PATHS.RELATIVE_PROVIDER)
  } catch (e1) {
    try {
      // Strategy 2: Installed opencode package
      return await import(IMPORT_PATHS.INSTALLED_PROVIDER)
    } catch (e2) {
      throw new Error(`${ERROR_MESSAGES.PROVIDER_IMPORT_FAILED}. Tried paths: ${IMPORT_PATHS.RELATIVE_PROVIDER}, ${IMPORT_PATHS.INSTALLED_PROVIDER}`)
    }
  }
}

/**
 * Extract factory function from imported module
 * Supports multiple export patterns to match the patch behavior
 * @param mod - The imported module object
 * @param modulePath - Path to the module for error reporting
 * @returns The factory function that creates a provider
 * @throws Error when no valid factory function is found
 */
export function extractFactory(mod: any, modulePath: string): Function {
  // Handle null/undefined modules gracefully
  if (mod === null || mod === undefined) {
    throw new Error(
      `${ERROR_MESSAGES.FACTORY_NOT_FOUND} in ${modulePath}. Module is ${mod === null ? 'null' : 'undefined'}.`
    )
  }
  
  // Try 1: Named export createCodexProvider
  if (typeof mod.createCodexProvider === "function") {
    return mod.createCodexProvider
  }
  
  // Try 2: Default export as function
  if (typeof mod.default === "function") {
    return mod.default
  }
  
  // Try 3: default.createCodexProvider
  if (mod.default && typeof mod.default.createCodexProvider === "function") {
    return mod.default.createCodexProvider
  }
  
  // No factory found - throw error matching patch behavior with context
  const availableExports = Object.keys(mod || {}).join(", ")
  const errorMessage = `${ERROR_MESSAGES.FACTORY_NOT_FOUND} in ${modulePath}`
  const contextMessage = availableExports ? `. Available exports: ${availableExports}` : ""
  
  throw new Error(errorMessage + contextMessage)
}

/**
 * Apply monkey patch to opencode's Provider.getModel function
 * This replicates the behavior of codex-provider-core.patch
 * 
 * The patch intercepts Provider.getModel calls and checks for a providerFactory
 * option. If found, it dynamically imports and uses the custom factory instead
 * of the default provider SDK.
 * 
 * @param providerModule - Not supported, throws error if provided
 * @returns Promise<void> Resolves when patch is successfully applied
 * @throws Error when dependency injection is attempted or import fails
 */
export function applyProviderFactoryPatch(providerModule?: any) {
  // Reject dependency injection to maintain test expectations (synchronous check)
  if (arguments.length > 0) {
    throw new Error(ERROR_MESSAGES.DEPENDENCY_INJECTION_NOT_SUPPORTED)
  }
  
  // Race condition protection: if patch is already being applied, return the existing promise
  if (patchPromise) {
    return patchPromise
  }
  
  // Create and store the patch promise to prevent concurrent applications
  patchPromise = applyProviderFactoryPatchInternal().finally(() => {
    // Clear the promise when done (success or failure) to allow future applications
    patchPromise = null
  })
  
  return patchPromise
}

/**
 * Builds the model result object with the expected structure
 * @param modelID - The model identifier
 * @param providerID - The provider identifier  
 * @param info - Model information from provider config
 * @param language - The language model instance from factory
 * @param provider - Provider configuration object
 * @returns Formatted model result object
 */
function buildModelResult(
  modelID: string, 
  providerID: string, 
  info: ModelInfo, 
  language: any, 
  provider: ProviderInfo
) {
  return {
    modelID,
    providerID,
    info,
    language,
    npm: info.provider?.npm ?? provider.info.npm
  }
}

/**
 * Internal implementation of the provider factory patch
 * Handles the actual patching logic with proper error handling and logging
 * 
 * @returns Promise<void> Resolves when patch is applied or already applied
 * @throws Error when Provider module import fails or patching encounters errors
 */
async function applyProviderFactoryPatchInternal() {
  // Check if patch has already been applied to prevent duplicate patching
  if (patchApplied) {
    codexLog(ERROR_MESSAGES.PATCH_ALREADY_APPLIED, {})
    return
  }
  
  try {
    // Import Provider module using multiple strategies
    const ProviderModule = await importProviderModule()
    
    // Store reference to original getModel function for delegation
    const originalGetModel = ProviderModule.Provider.getModel
    
    // Replace Provider.getModel with our patched version that supports providerFactory
    ProviderModule.Provider.getModel = async function patchedGetModel(
      providerID: string,
      modelID: string
    ) {
      // Create cache key for this provider/model combination
      const key = `${providerID}/${modelID}`
      
      // Access provider state (internal state object containing models cache and providers)
      const s = await ProviderModule.Provider.state()
      
      // Check cache first - return cached model if available (performance optimization)
      if (s.models.has(key)) return s.models.get(key)!
      
      // Get provider configuration from state
      const provider = s.providers[providerID]
      if (!provider) {
        throw new ProviderModule.Provider.ModelNotFoundError({ 
          providerID, 
          modelID 
        })
      }
      
      const info = provider.info.models[modelID]
      if (!info) {
        throw new ProviderModule.Provider.ModelNotFoundError({ 
          providerID, 
          modelID 
        })
      }
      
      // PATCH LOGIC: Check if provider has a custom factory configured
      // This is the core of our patch - detecting and using custom provider factories
      const factoryModule =
        provider.options && typeof provider.options.providerFactory === "string"
          ? provider.options.providerFactory
          : undefined
      
      if (factoryModule) {
        codexLog(ERROR_MESSAGES.FACTORY_DETECTED, { providerID, factoryModule })
        
        // Dynamically import the custom factory module
        const mod = await import(factoryModule)
        
        // Extract factory function using our multi-pattern extraction logic
        let factory: Function
        try {
          factory = extractFactory(mod, factoryModule)
        } catch (error) {
          // Convert extraction errors to InitError to match original patch behavior
          throw new ProviderModule.Provider.InitError(
            { providerID },
            { cause: error }
          )
        }
        
        // Call the factory to create provider instance, then get the language model
        const language = factory().languageModel(modelID)
        
        codexLog(ERROR_MESSAGES.MODEL_LOADED, { 
          providerID, 
          modelID, 
          source: "custom-factory" 
        })
        
        // Build result object matching the structure expected by opencode
        const result = buildModelResult(modelID, providerID, info, language, provider)
        
        // Cache the result in state Map for future requests (critical for performance)
        s.models.set(key, result)
        
        return result
      }
      
      // No providerFactory configured - delegate to original getModel implementation
      return originalGetModel.call(ProviderModule.Provider, providerID, modelID)
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
 */
export function resetPatchState() {
  patchApplied = false
  patchPromise = null
}
