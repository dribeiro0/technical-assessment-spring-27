/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // The tested code in src/domain is plain TypeScript, so no browser environment is needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
