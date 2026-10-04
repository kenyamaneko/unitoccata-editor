import { defineConfig } from '@playwright/test'
import { requireEnvironmentVariable } from './e2e-smoke/smokeEnvironment.ts'

const SMOKE_TIMEOUT_MS = 30_000
const SMOKE_VIEWPORT = { width: 1280, height: 1000 }

const SMOKE_BASE_URL = requireEnvironmentVariable('SMOKE_BASE_URL')
requireEnvironmentVariable('SMOKE_FIREBASE_PROJECT_ID')
requireEnvironmentVariable('SMOKE_FIREBASE_STORAGE_BUCKET')

export default defineConfig({
  testDir: './e2e-smoke',
  timeout: SMOKE_TIMEOUT_MS,
  reporter: [['list'], ['junit', { outputFile: 'test-results/smoke-junit.xml' }]],
  use: {
    baseURL: SMOKE_BASE_URL,
    viewport: SMOKE_VIEWPORT,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
