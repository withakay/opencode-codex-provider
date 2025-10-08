# Integration Tests - Provider Loading

## Overview

This directory contains integration tests for the provider loading functionality. These tests verify the end-to-end behavior of the provider factory system when integrated with the opencode Provider module.

## Current Status: RED Phase ✗

All integration tests are currently **FAILING** as expected in the RED phase of TDD. This is the correct behavior - we've written tests that define the expected integration behavior before implementing the full integration.

## Test Results

```
✗ loads codex models via providerFactory
✗ caches loaded models in state Map  
✗ uses custom factory instead of getSDK
✗ logging includes custom-factory marker
```

## What These Tests Verify

### 1. Provider Factory Loading
- **Expected**: When a `providerFactory` is configured, the system should use the factory to create providers instead of the default SDK
- **Current**: Provider module import fails, no integration exists

### 2. Model Caching
- **Expected**: Loaded models should be cached in the Provider state Map to avoid redundant factory calls
- **Current**: Cannot access Provider.state() method, no caching mechanism

### 3. SDK Bypass
- **Expected**: When providerFactory exists, the original getModel/getSDK path should be bypassed entirely  
- **Current**: Monkey patch not applied due to import failure

### 4. Factory Logging
- **Expected**: All factory operations should include "source: custom-factory" markers in logs
- **Current**: No factory operations happen without working patch

## Next Steps (GREEN Phase)

To make these tests pass, the following integration work is needed:

1. **Establish Provider Module Integration**: Create a working connection between the monkey patch and the opencode Provider system
2. **Apply Monkey Patch Successfully**: Ensure the patch can import and modify the Provider module
3. **Enable Factory-Based Model Loading**: Implement the complete factory loading mechanism
4. **Implement Provider State Caching**: Ensure models are cached in the Provider state Map
5. **Add Factory-Specific Logging**: Include "source: custom-factory" markers in all factory operations

## Running Tests

```bash
# Run only integration tests
bun test tests/integration

# Run specific test file
bun test tests/integration/provider-loading.test.ts

# Run all tests (unit + integration)
bun test
```

## Test Structure

Each test follows the pattern:
1. **Setup**: Initialize environment and attempt to apply monkey patch
2. **Act**: Try to perform the integration behavior
3. **Assert**: Verify the behavior works (currently fails in RED phase)
4. **Document**: Comments explain what should work when integration is complete

The tests serve as both verification and documentation of the expected integration behavior.