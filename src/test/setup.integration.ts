import { setLogLevel } from 'firebase/firestore'
import { afterEach, beforeEach } from 'vitest'
import { disposeEmulatorApps, removeCaseData } from './emulator.ts'

setLogLevel('silent')

beforeEach(disposeEmulatorApps)

afterEach(async () => {
  await removeCaseData()
  await disposeEmulatorApps()
})
