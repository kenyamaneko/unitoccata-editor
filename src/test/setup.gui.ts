import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { clearDownloads, installBrowserStubs, installManualAnimationFrames } from './browserStubs.ts'
import { FakeAudioContext, resetAudioWorld } from './fakeAudio.ts'
import { resetCloudWorld } from './fakeFirebase.ts'

vi.mock('firebase/auth', async () => (await import('./fakeFirebase.ts')).createFakeAuthModule())
vi.mock('firebase/firestore', async () => (await import('./fakeFirebase.ts')).createFakeFirestoreModule())
vi.mock('firebase/storage', async () => (await import('./fakeFirebase.ts')).createFakeStorageModule())

function resetWorld(): void {
  resetAudioWorld()
  resetCloudWorld()
  clearDownloads()
  window.history.replaceState(null, '', '#/')
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
}

installBrowserStubs()
installManualAnimationFrames()

Object.assign(globalThis, {
  jest: { advanceTimersByTime: (milliseconds: number) => vi.advanceTimersByTime(milliseconds) },
})
globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext

beforeEach(resetWorld)
afterEach(resetWorld)
