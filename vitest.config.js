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
    // Memory optimization settings
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        maxForks: 2,
        minForks: 1,
      }
    },
    maxConcurrency: 2,
    isolate: true,
  },
})