import { describe, it, expect, beforeEach } from 'bun:test'
import { applyProviderFactoryPatch } from '../../src/monkeyPatch'
import { createMockState, createMockProvider } from '../fixtures'

const INTEGRATION_TESTS_ENABLED = process.env.INTEGRATION_TESTS === "true"
const describeOrSkip = INTEGRATION_TESTS_ENABLED ? describe : describe.skip

describeOrSkip('Performance Benchmarks', () => {
  let mockState: any
  let mockProvider: any

  beforeEach(() => {
    // Create proper mock state and provider for performance testing
    mockProvider = createMockProvider({ simulateSuccess: true })
    mockState = createMockState({ includeCodexProvider: true })
  })

  describe('Patch Application Performance', () => {
    it('should apply patch in under 100ms', async () => {
      const iterations = 100
      const times: number[] = []

      for (let i = 0; i < iterations; i++) {
        // Reset state for each iteration
        const freshState = createMockState({ includeCodexProvider: true })
        
        const startTime = performance.now()
        applyProviderFactoryPatch(freshState, mockProvider)
        const endTime = performance.now()
        
        times.push(endTime - startTime)
      }

      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length
      const maxTime = Math.max(...times)
      
      console.log(`Patch application performance:`)
      console.log(`  Average: ${averageTime.toFixed(2)}ms`)
      console.log(`  Max: ${maxTime.toFixed(2)}ms`)
      console.log(`  Min: ${Math.min(...times).toFixed(2)}ms`)

      expect(averageTime).toBeLessThan(100) // Average under 100ms
      expect(maxTime).toBeLessThan(200) // Max under 200ms
    })

    it('should handle multiple rapid patches efficiently', async () => {
      const startTime = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        const freshState = createMockState({ includeCodexProvider: true })
        applyProviderFactoryPatch(freshState, mockProvider)
      }
      
      const endTime = performance.now()
      const totalTime = endTime - startTime
      const averagePerPatch = totalTime / 1000

      console.log(`1000 patches in ${totalTime.toFixed(2)}ms`)
      console.log(`Average per patch: ${averagePerPatch.toFixed(2)}ms`)

      expect(averagePerPatch).toBeLessThan(10) // Should be very fast for repeated patches
    })
  })

  describe('Memory Usage', () => {
    it('should use minimal memory overhead', async () => {
      // Measure baseline memory
      const baselineMemory = process.memoryUsage()
      
      // Apply patch
      applyProviderFactoryPatch(mockState, mockProvider)
      
      // Measure after patch
      const afterPatchMemory = process.memoryUsage()
      
      const heapUsedDiff = afterPatchMemory.heapUsed - baselineMemory.heapUsed
      const heapTotalDiff = afterPatchMemory.heapTotal - baselineMemory.heapTotal

      console.log(`Memory usage:`)
      console.log(`  Heap used diff: ${(heapUsedDiff / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Heap total diff: ${(heapTotalDiff / 1024 / 1024).toFixed(2)}MB`)

      // Should use less than 1MB additional memory
      expect(heapUsedDiff).toBeLessThan(1024 * 1024)
    })

    it('should not leak memory on repeated patches', async () => {
      const initialMemory = process.memoryUsage()
      
      // Apply many patches
      for (let i = 0; i < 100; i++) {
        const freshState = createMockState({ includeCodexProvider: true })
        applyProviderFactoryPatch(freshState, mockProvider)
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }
      
      const finalMemory = process.memoryUsage()
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed

      console.log(`Memory growth after 100 patches: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`)

      // Should not grow more than 5MB after 100 patches
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024)
    })
  })

  describe('Factory Registration Performance', () => {
    it('should register factories quickly', async () => {
      const iterations = 1000
      const times: number[] = []

      for (let i = 0; i < iterations; i++) {
        const freshState = createMockState({ includeCodexProvider: true })
        
        const startTime = performance.now()
        applyProviderFactoryPatch(freshState, mockProvider)
        const endTime = performance.now()
        
        times.push(endTime - startTime)
      }

      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length

      console.log(`Factory registration average time: ${averageTime.toFixed(2)}ms`)

      expect(averageTime).toBeLessThan(5) // Should be very fast
    })

    it('should handle factory lookup efficiently', async () => {
      applyProviderFactoryPatch(mockState, mockProvider)
      
      const iterations = 10000
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        const factory = mockState.providerFactories.get('codex')
        expect(factory).toBeDefined()
      }
      
      const endTime = performance.now()
      const averageLookupTime = (endTime - startTime) / iterations

      console.log(`Factory lookup average time: ${averageLookupTime.toFixed(4)}ms`)

      expect(averageLookupTime).toBeLessThan(0.001) // Should be extremely fast
    })
  })

  describe('Cache Performance', () => {
    it('should cache factory lookups effectively', async () => {
      applyProviderFactoryPatch(mockState, mockProvider)
      
      // First lookup (cache miss)
      const startTime1 = performance.now()
      const factory1 = mockState.providerFactories.get('codex')
      const endTime1 = performance.now()
      const firstLookupTime = endTime1 - startTime1
      
      // Subsequent lookups (cache hits)
      const iterations = 1000
      const startTime2 = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        const factory = mockState.providerFactories.get('codex')
        expect(factory).toBe(factory1) // Same reference
      }
      
      const endTime2 = performance.now()
      const averageCachedLookupTime = (endTime2 - startTime2) / iterations

      console.log(`First lookup time: ${firstLookupTime.toFixed(2)}ms`)
      console.log(`Average cached lookup time: ${averageCachedLookupTime.toFixed(4)}ms`)

      expect(factory1).toBeDefined()
      expect(averageCachedLookupTime).toBeLessThan(0.0001) // Should be extremely fast
    })
  })
})