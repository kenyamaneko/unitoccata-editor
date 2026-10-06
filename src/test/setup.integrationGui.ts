import '@testing-library/jest-dom/vitest'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { deleteApp, getApps } from 'firebase/app'
import { setLogLevel } from 'firebase/firestore'
import { afterEach, beforeEach, vi } from 'vitest'
import { clearDownloads, installBrowserStubs } from './browserStubs.ts'
import { removeCaseData } from './emulator.ts'
import { FakeAudioContext, resetAudioWorld } from './fakeAudio.ts'

async function resetWorld(): Promise<void> {
  resetAudioWorld()
  clearDownloads()
  await Promise.all(getApps().map((app) => deleteApp(app)))
  window.history.replaceState(null, '', '#/')
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
}

installBrowserStubs()

globalThis.Blob = NodeBlob as unknown as typeof Blob
globalThis.File = NodeFile as unknown as typeof File
globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext

setLogLevel('silent')

beforeEach(resetWorld)
afterEach(async () => {
  await removeCaseData()
  await resetWorld()
})
