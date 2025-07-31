import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/src.old/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'src.old/',
        '**/*.test.js',
        '**/*.config.js',
        '**/test-utils/**',
      ],
    },
    // Re-enable single-threaded testing for CI stability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        maxForks: 1,
        minForks: 1,
      }
    },
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    isolate: true,
    // fileParallelism: false,
    // Force exit after tests complete
    teardownTimeout: 5000,
    // Add test timeout to identify slow tests
    testTimeout: 10000, // 10 seconds per test
    // Clear module cache between tests
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
  },
})