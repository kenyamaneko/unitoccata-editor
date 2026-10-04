import { act } from '@testing-library/react'
import { expect } from 'vitest'
import { startApp } from './app.tsx'
import type { ChartFileNote } from './files.ts'
import { createMaxTapNotes } from './file-io.helpers.ts'

type App = Awaited<ReturnType<typeof startApp>>

export async function startWithMaxNotes(): Promise<App> {
  const app = await startApp()
  await loadChartWithoutFocus(app, createMaxTapNotes())
  return app
}

export async function loadChartWithoutFocus(app: App, notes: readonly ChartFileNote[]): Promise<void> {
  await app.loadChart(notes)
  await act(async () => {
    ;(document.activeElement as HTMLElement | null)?.blur()
  })
}

export async function pressKey(app: App, chord: string): Promise<void> {
  let deliveredCount = 0
  const count = (): void => {
    deliveredCount += 1
  }
  window.addEventListener('keydown', count, true)
  await app.press(chord)
  window.removeEventListener('keydown', count, true)
  expect(deliveredCount, `キー ${chord} が、アプリに届いていません (操作が空振りしています)`).toBeGreaterThan(0)
}

export async function expectRejectedWith(app: App, notice: string, operation: () => Promise<void>): Promise<void> {
  await operation()
  expect(app.notice(notice), `操作が「${notice}」で拒否されていません (操作が空振りしています)`).toBeInTheDocument()
}
