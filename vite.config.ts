import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

const EMULATOR_PROJECT_ID = 'demo-unitoccata-editor'

/** 結合テストでアプリが接続する Firebase の設定。エミュレータにしか向かないので、値はテスト用のダミーにする。 */
const EMULATOR_APP_ENV = {
  VITE_FIREBASE_API_KEY: 'demo-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
  VITE_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: `${EMULATOR_PROJECT_ID}.appspot.com`,
  VITE_FIREBASE_APP_ID: 'demo-app-id',
  VITE_USE_EMULATORS: 'true',
}

const TEST_TIMEOUT_MS = 30_000

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 47213, strictPort: true },
  preview: { port: 47214, strictPort: true },
  test: {
    globals: true,
    css: false,
    reporters: ['default', ['junit', { outputFile: 'test-results/vitest-junit.xml' }]],
    projects: [
      {
        extends: true,
        test: {
          name: 'logic',
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [
            ...configDefaults.exclude,
            'src/**/*.gui.test.{ts,tsx}',
            'src/**/*.integration.test.{ts,tsx}',
            'src/**/*.integration-gui.test.{ts,tsx}',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'gui',
          environment: 'jsdom',
          include: ['src/**/*.gui.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.gui.ts'],
          env: { VITE_TEST_CLOCK: 'fake' },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.test.ts'],
          setupFiles: ['./src/test/setup.integration.ts'],
          globalSetup: ['./src/test/globalSetup.emulators.ts'],
          fileParallelism: false,
          testTimeout: TEST_TIMEOUT_MS,
          hookTimeout: TEST_TIMEOUT_MS,
          env: { TEST_EMULATOR_PROJECT_ID: EMULATOR_PROJECT_ID },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration-gui',
          environment: 'jsdom',
          include: ['src/**/*.integration-gui.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.integrationGui.ts'],
          globalSetup: ['./src/test/globalSetup.emulators.ts'],
          fileParallelism: false,
          testTimeout: TEST_TIMEOUT_MS,
          hookTimeout: TEST_TIMEOUT_MS,
          env: { ...EMULATOR_APP_ENV, TEST_EMULATOR_PROJECT_ID: EMULATOR_PROJECT_ID, VITE_TEST_CLOCK: 'real' },
        },
      },
    ],
  },
})
