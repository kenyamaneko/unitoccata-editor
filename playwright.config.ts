import { defineConfig } from '@playwright/test'
import { E2E_BASE_URL, E2E_SERVER_PORT, EMULATOR_PROJECT_ID } from './e2e/environment.ts'

const E2E_TIMEOUT_MS = 60_000
const E2E_VIEWPORT = { width: 1280, height: 1000 }

export default defineConfig({
  testDir: './e2e',
  timeout: E2E_TIMEOUT_MS,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['junit', { outputFile: 'test-results/e2e-junit.xml' }]],
  use: {
    baseURL: E2E_BASE_URL,
    viewport: E2E_VIEWPORT,
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  // 標準のヘッドレス専用ブラウザでは、起動直後のエミュレータでの最初の Google ログインが完了しない (ポップアップが閉じても元のページに結果が届かない)。フル版の Chromium では完了するため、フル版を使う。
  projects: [{ name: 'chromium', use: { browserName: 'chromium', channel: 'chromium' } }],
  webServer: {
    command: `npx vite --port ${E2E_SERVER_PORT} --strictPort`,
    port: E2E_SERVER_PORT,
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
      VITE_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
      VITE_FIREBASE_STORAGE_BUCKET: `${EMULATOR_PROJECT_ID}.appspot.com`,
      VITE_FIREBASE_APP_ID: 'demo-app-id',
      VITE_USE_EMULATORS: 'true',
    },
  },
})
