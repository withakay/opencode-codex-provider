# Test Fixtures for Integration Testing

This directory contains comprehensive test fixtures for integration testing of the opencode-codex-provider. These fixtures provide reusable mock implementations that simulate the behavior of the opencode Provider system.

## Overview

The test fixtures are designed to support Phase 6 integration testing and manual validation. They provide:

- **Mock Provider** - Simulates the opencode Provider module
- **Mock State** - Simulates Provider.state() with configurable data
- **Mock Config** - Simulates opencode configuration with provider settings

## Quick Start

```typescript
import { createTestEnvironment } from '../fixtures'

// Create a complete test environment
const testEnv = createTestEnvironment({
  includeFactoryProviders: true,
  simulateSuccess: true
})

// Use with monkey patch
await applyProviderFactoryPatch(testEnv.provider)
const model = await testEnv.provider.Provider.getModel('codex', 'gpt-5-codex')
```

## Fixture Files

### 1. `mock-provider.ts`

Mock implementation of the Provider module that simulates provider registry and model loading.

**Key Functions:**
- `createMockProvider(options)` - Creates a configurable mock provider
- `createFailingMockProvider(errorType)` - Creates providers that simulate specific errors
- `createCustomMockProvider(providers)` - Creates providers with custom configurations

**Features:**
- Supports both factory and non-factory providers
- Simulates success and error scenarios
- Compatible with existing Provider interface
- Includes mock error classes (`MockModelNotFoundError`, `MockInitError`)

**Example:**
```typescript
import { createMockProvider, createFailingMockProvider } from '../fixtures'

// Create successful provider
const provider = createMockProvider({ simulateSuccess: true })

// Create provider that simulates errors
const failingProvider = createFailingMockProvider('provider-not-found')
```

### 2. `mock-state.ts`

Mock state object that mimics Provider.state() with configurable providers, models cache, and configuration.

**Key Functions:**
- `createMockState(options)` - Creates configurable mock state
- `createMockStateManager(state)` - Creates state manager for manipulation
- `createErrorMockState(errorType)` - Creates states that simulate error conditions

**Features:**
- Includes providers registry with codex, openai, anthropic providers
- Mock models cache with TTL support
- State manipulation helpers for testing scenarios
- Cache management utilities

**Example:**
```typescript
import { createMockState, createMockStateManager } from '../fixtures'

// Create state with multiple providers
const state = createMockState({ 
  includeCodexProvider: true,
  includeTestProviders: true,
  prePopulateCache: true 
})

// Manage state for testing
const stateManager = createMockStateManager(state)
stateManager.addProvider('custom', customProviderConfig)
```

### 3. `mock-config.ts`

Mock opencode configuration with provider configurations and providerFactory options.

**Key Functions:**
- `createMockConfig(options)` - Creates configurable mock config
- `createMockConfigManager(config)` - Creates config manager for manipulation
- `createFactoryMockConfig(factories)` - Creates configs with specific factory setups

**Features:**
- Supports different provider setups (codex, openai, anthropic)
- Configurable providerFactory options for testing
- Environment variable simulation
- Feature flags and cache configuration

**Example:**
```typescript
import { createMockConfig, createMockConfigManager } from '../fixtures'

// Create config with custom factories
const config = createMockConfig({
  includeCodexProvider: true,
  customFactories: { codex: 'custom-factory-module' }
})

// Manage config for testing
const configManager = createMockConfigManager(config)
configManager.setProviderFactory('codex', 'new-factory-module')
```

## Convenience Functions

### `createTestEnvironment(options)`

Creates a complete test environment with all fixtures configured for integration testing.

```typescript
const testEnv = createTestEnvironment({
  includeFactoryProviders: true,    // Include providers with factory configs
  includeStandardProviders: false,  // Include standard SDK providers
  simulateSuccess: true,            // Simulate successful operations
  simulateErrors: false,            // Simulate error conditions
  prePopulateCache: false,          // Pre-populate cache with test data
  enableAllFeatures: true,          // Enable all config features
  customFactories: {}               // Custom factory module paths
})

// Returns: { provider, state, config, stateManager, configManager }
```

### `createScenarioFixtures(scenario)`

Creates fixtures for specific test scenarios:

- `'successful-factory-loading'` - Happy path factory loading
- `'provider-not-found'` - Provider not found errors
- `'model-not-found'` - Model not found errors  
- `'factory-import-error'` - Factory import/loading errors
- `'cache-testing'` - Cache behavior testing
- `'multi-provider-setup'` - Multiple provider configurations

```typescript
const fixtures = createScenarioFixtures('successful-factory-loading')
await applyProviderFactoryPatch(fixtures.provider)
```

## Testing Patterns

### 1. Basic Integration Test

```typescript
import { createTestEnvironment } from '../fixtures'
import { applyProviderFactoryPatch } from '../../src/monkeyPatch'

test('basic integration test', async () => {
  const testEnv = createTestEnvironment()
  await applyProviderFactoryPatch(testEnv.provider)
  
  const model = await testEnv.provider.Provider.getModel('codex', 'gpt-5-codex')
  expect(model.modelID).toBe('gpt-5-codex')
})
```

### 2. Error Scenario Testing

```typescript
import { createScenarioFixtures } from '../fixtures'

test('provider not found error', async () => {
  const fixtures = createScenarioFixtures('provider-not-found')
  
  await expect(
    fixtures.provider.Provider.getModel('nonexistent', 'model')
  ).rejects.toThrow('Model model not found for provider nonexistent')
})
```

### 3. Cache Testing

```typescript
import { createTestEnvironment } from '../fixtures'

test('cache behavior', async () => {
  const testEnv = createTestEnvironment({ prePopulateCache: true })
  await applyProviderFactoryPatch(testEnv.provider)
  
  // Test cache hit
  const model1 = await testEnv.provider.Provider.getModel('codex', 'gpt-5-codex')
  const model2 = await testEnv.provider.Provider.getModel('codex', 'gpt-5-codex')
  
  expect(model1.modelID).toBe(model2.modelID)
})
```

### 4. State Manipulation

```typescript
import { createTestEnvironment } from '../fixtures'

test('state manipulation', async () => {
  const testEnv = createTestEnvironment()
  
  // Add custom provider
  testEnv.stateManager.addProvider('custom', {
    source: 'config',
    info: { id: 'custom', name: 'Custom', env: [], models: {} },
    options: { providerFactory: 'custom-factory' }
  })
  
  expect(testEnv.stateManager.getProviders()).toContain('custom')
})
```

### 5. Configuration Testing

```typescript
import { createMockConfig } from '../fixtures'

test('configuration validation', () => {
  const config = createMockConfig({
    customFactories: { codex: 'custom-codex-factory' }
  })
  
  expect(config.providers.codex.providerFactory).toBe('custom-codex-factory')
})
```

## Validation and Debugging

### Fixture Validation

```typescript
import { validateFixtures } from '../fixtures'

const testEnv = createTestEnvironment()
const validation = validateFixtures(testEnv)

expect(validation.valid).toBe(true)
expect(validation.errors).toHaveLength(0)
```

### Reset Between Tests

```typescript
import { resetFixtures } from '../fixtures'
import { resetPatchState } from '../../src/monkeyPatch'

beforeEach(() => {
  resetPatchState()
  resetFixtures()
})
```

## Advanced Usage

### Performance Testing

```typescript
import { createPerformanceFixtures } from '../fixtures'

const perfFixtures = createPerformanceFixtures({
  cacheSize: 1000,
  providerCount: 10,
  modelCount: 100
})
```

### Timing Simulation

```typescript
import { createTimedFixtures } from '../fixtures'

const timedFixtures = createTimedFixtures({
  providerDelay: 100,
  timeoutAfter: 5000
})
```

### Custom Providers

```typescript
import { createCustomMockProvider } from '../fixtures'

const customProvider = createCustomMockProvider({
  'my-provider': {
    source: 'config',
    info: { id: 'my-provider', name: 'My Provider', env: [], models: {} },
    options: { providerFactory: 'my-factory' }
  }
})
```

## Integration with Monkey Patch

The fixtures are designed to work seamlessly with the monkey patch system:

1. **Mock Provider** - Can be injected into `applyProviderFactoryPatch()` for dependency injection
2. **Mock State** - Provides the state structure expected by the monkey patch
3. **Mock Config** - Supports providerFactory configuration that the monkey patch uses

```typescript
// Inject mock provider into monkey patch
await applyProviderFactoryPatch(testEnv.provider)

// The monkey patch will use the mock provider's state and configuration
const model = await testEnv.provider.Provider.getModel('codex', 'gpt-5-codex')
```

## Best Practices

1. **Use `createTestEnvironment()`** for most integration tests
2. **Use `createScenarioFixtures()`** for specific error scenarios
3. **Always validate fixtures** with `validateFixtures()` in complex tests
4. **Reset state** between tests to ensure isolation
5. **Use state/config managers** for dynamic test scenarios
6. **Prefer mock provider simulation** over monkey patch for unit testing specific behaviors

## Test Coverage

The fixtures support testing of:

- ✅ Provider factory loading (success and failure)
- ✅ Model caching and cache management
- ✅ Provider and model not found errors
- ✅ Factory import and initialization errors
- ✅ Multi-provider configurations
- ✅ State manipulation and validation
- ✅ Configuration management
- ✅ Integration with monkey patch system
- ✅ Performance and timing scenarios

## Files Structure

```
tests/fixtures/
├── mock-provider.ts     # Mock Provider module implementation
├── mock-state.ts        # Mock state object and management
├── mock-config.ts       # Mock opencode configuration
├── index.ts            # Exports and convenience functions
├── fixtures.test.ts    # Fixture validation tests
└── README.md           # This documentation
```

## Contributing

When adding new fixtures or modifying existing ones:

1. Ensure backward compatibility with existing tests
2. Add comprehensive JSDoc documentation
3. Include validation functions for new fixture types
4. Add tests to `fixtures.test.ts` to verify fixture behavior
5. Update this README with new usage patterns

## Related Files

- `../../src/monkeyPatch.ts` - Monkey patch implementation that uses these fixtures
- `../integration/` - Integration tests that use these fixtures
- `../unit/` - Unit tests for individual components