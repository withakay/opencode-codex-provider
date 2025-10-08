#!/usr/bin/env node

import { applyProviderFactoryPatch } from '../src/monkeyPatch'
import { createMockConfig } from '../tests/fixtures'

interface BenchmarkResult {
  name: string
  iterations: number
  totalTime: number
  averageTime: number
  minTime: number
  maxTime: number
  opsPerSecond: number
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = []

  async benchmark(name: string, fn: () => void, iterations: number = 1000): Promise<BenchmarkResult> {
    const times: number[] = []

    // Warm up
    for (let i = 0; i < 10; i++) {
      fn()
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()
      fn()
      const endTime = performance.now()
      times.push(endTime - startTime)
    }

    const totalTime = times.reduce((sum, time) => sum + time, 0)
    const averageTime = totalTime / iterations
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const opsPerSecond = 1000 / averageTime

    const result: BenchmarkResult = {
      name,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      opsPerSecond
    }

    this.results.push(result)
    return result
  }

  measureMemory(label: string): void {
    const memory = process.memoryUsage()
    console.log(`\n${label}:`)
    console.log(`  RSS: ${(memory.rss / 1024 / 1024).toFixed(2)}MB`)
    console.log(`  Heap Used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB`)
    console.log(`  Heap Total: ${(memory.heapTotal / 1024 / 1024).toFixed(2)}MB`)
    console.log(`  External: ${(memory.external / 1024 / 1024).toFixed(2)}MB`)
  }

  printResults(): void {
    console.log('\n=== PERFORMANCE BENCHMARK RESULTS ===')
    console.log()

    for (const result of this.results) {
      console.log(`${result.name}:`)
      console.log(`  Iterations: ${result.iterations}`)
      console.log(`  Total Time: ${result.totalTime.toFixed(2)}ms`)
      console.log(`  Average Time: ${result.averageTime.toFixed(4)}ms`)
      console.log(`  Min Time: ${result.minTime.toFixed(4)}ms`)
      console.log(`  Max Time: ${result.maxTime.toFixed(4)}ms`)
      console.log(`  Ops/Second: ${result.opsPerSecond.toFixed(0)}`)
      console.log()
    }
  }

  async runAllBenchmarks(): Promise<void> {
    console.log('Starting performance benchmarks...\n')

    // Setup
    const mockConfig = createMockConfig()
    const mockState = {
      providerFactories: new Map(),
      providers: new Map(),
      models: new Map()
    }

    this.measureMemory('Initial Memory')

    // Benchmark 1: Patch Application
    await this.benchmark('Patch Application', () => {
      mockState.providerFactories.clear()
      applyProviderFactoryPatch(mockState)
    }, 1000)

    this.measureMemory('After Patch Application Benchmark')

    // Benchmark 2: Factory Lookup
    applyProviderFactoryPatch(mockState)
    await this.benchmark('Factory Lookup', () => {
      mockState.providerFactories.get('codex')
    }, 10000)

    // Benchmark 3: Factory Registration (isolated)
    await this.benchmark('Factory Registration', () => {
      const state = {
        providerFactories: new Map(),
        providers: new Map(),
        models: new Map()
      }
      applyProviderFactoryPatch(state)
    }, 1000)

    // Benchmark 4: Repeated Operations
    await this.benchmark('Repeated Patch + Lookup', () => {
      mockState.providerFactories.clear()
      applyProviderFactoryPatch(mockState)
      mockState.providerFactories.get('codex')
    }, 500)

    this.measureMemory('Final Memory')

    // Print all results
    this.printResults()

    // Performance validation
    console.log('=== PERFORMANCE VALIDATION ===')
    
    const patchResult = this.results.find(r => r.name === 'Patch Application')
    const lookupResult = this.results.find(r => r.name === 'Factory Lookup')
    
    if (patchResult) {
      const patchOk = patchResult.averageTime < 100
      console.log(`Patch Application (< 100ms): ${patchOk ? '✅ PASS' : '❌ FAIL'} (${patchResult.averageTime.toFixed(2)}ms)`)
    }
    
    if (lookupResult) {
      const lookupOk = lookupResult.averageTime < 0.001
      console.log(`Factory Lookup (< 0.001ms): ${lookupOk ? '✅ PASS' : '❌ FAIL'} (${lookupResult.averageTime.toFixed(4)}ms)`)
    }

    // Memory validation
    const finalMemory = process.memoryUsage()
    const memoryOk = finalMemory.heapUsed < 50 * 1024 * 1024 // Less than 50MB
    console.log(`Memory Usage (< 50MB): ${memoryOk ? '✅ PASS' : '❌ FAIL'} (${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB)`)
  }
}

// Run benchmarks if this script is executed directly
if (import.meta.main) {
  const benchmark = new PerformanceBenchmark()
  benchmark.runAllBenchmarks().catch(console.error)
}

export { PerformanceBenchmark }