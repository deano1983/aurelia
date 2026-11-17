import { defineConfig } from 'vitest/config'
export default defineConfig({
  // React 17+ JSX transform for .tsx sources pulled in by tests (matches the apps' tsconfig).
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/tests/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    environment: 'node',
  },
})
