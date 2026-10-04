import { screen } from '@testing-library/react'
import { expect } from 'vitest'
import type { AppDriver } from '../../test/app.tsx'
import { getSharedState } from '../../test/sharedState.ts'

const AUDIO_STATE_KEY = 'audio'
const SECONDS_UNTIL_TICK_1920 = 2.25
const PIXELS_FOR_TICK_5000 = 600

interface AudioFailureFlags {
  contextCreationFails: boolean
  resumeMode: 'succeed' | 'fail' | 'defer'
  stretchCreationFails: boolean
  stretchBufferTransferFails: boolean
  stretchScheduleFails: boolean
  clickFailuresRemaining: number
}

export async function advanceClock(app: AppDriver, seconds: number): Promise<void> {
  const before = Date.now()
  await app.advance(seconds)
  expect(Date.now() - before, '時間が進んでいません (時間を進める操作が空振りしています)').toBeGreaterThanOrEqual(
    seconds * 1000,
  )
}

export async function startPreviewAndReturnToEditorAfter(app: AppDriver, seconds: number): Promise<void> {
  await app.selectTab('プレビュー')
  await advanceClock(app, seconds)
  await app.selectTab('エディタ')
}

export async function enterPreview(app: AppDriver): Promise<void> {
  await app.selectTab('プレビュー')
  expect(app.tabIsSelected('プレビュー'), '「プレビュー」タブが選択された状態になっていません').toBe(true)
  expect(app.preview.canvas(), 'プレビューの Canvas が表示されていません').toBeVisible()
}

export async function scrollPreview(app: AppDriver, direction: 'up' | 'down', pixels: number): Promise<void> {
  let deliveredCount = 0
  const count = (): void => {
    deliveredCount += 1
  }
  const canvas = app.preview.canvas()
  canvas.addEventListener('wheel', count, true)
  await app.preview.wheel(direction, pixels)
  canvas.removeEventListener('wheel', count, true)
  expect(
    deliveredCount,
    'プレビューの Canvas に、ホイールの操作が届いていません (操作が空振りしています)',
  ).toBeGreaterThan(0)
}

export async function scrollEditor(app: AppDriver, direction: 'up' | 'down', pixels: number): Promise<void> {
  const before = app.timeline.scrollPosition()
  await app.timeline.wheel(direction, { pixels })
  expect(app.timeline.scrollPosition(), 'エディタのホイールで、スクロール位置が動いていません').not.toBe(before)
}

export async function zoomEditor(app: AppDriver, direction: 'in' | 'out'): Promise<void> {
  const before = app.timeline.gridStepHeight()
  await app.timeline.wheel(direction === 'in' ? 'up' : 'down', { ctrl: true })
  expect(app.timeline.gridStepHeight(), 'エディタのズームで、1 マスの高さが変わっていません').not.toBe(before)
}

export async function pressKey(app: AppDriver, chord: string): Promise<void> {
  let deliveredCount = 0
  const count = (): void => {
    deliveredCount += 1
  }
  document.addEventListener('keydown', count, true)
  await app.press(chord)
  document.removeEventListener('keydown', count, true)
  expect(deliveredCount, `「${chord}」のキーが、画面に届いていません (操作が空振りしています)`).toBeGreaterThan(0)
}

export async function moveFocusToPage(app: AppDriver): Promise<void> {
  await app.user.click(document.body)
  expect(document.activeElement, 'フォーカスがページに移っていません').toBe(document.body)
}

export function expectStartFailureNotice(app: AppDriver): void {
  expect(app.noticeTexts(), 'プレビューの開始の失敗のメッセージが表示されていません').toContainEqual(
    expect.stringMatching(/^プレビューを始められませんでした: /),
  )
}

export async function restartPreviewAfter(app: AppDriver, seconds: number): Promise<void> {
  await startPreviewAndReturnToEditorAfter(app, seconds)
  await app.selectTab('プレビュー')
}

export async function rememberTick1920(app: AppDriver): Promise<void> {
  await startPreviewAndReturnToEditorAfter(app, SECONDS_UNTIL_TICK_1920)
  await app.selectTab('プレビュー')
  expect(app.preview.position(), '再生位置が 1 小節目 3 拍目になっていません').toBe('1 小節目 3 拍目')
  await app.selectTab('エディタ')
}

export async function rememberTick5000(app: AppDriver): Promise<void> {
  await app.selectTab('プレビュー')
  await scrollPreview(app, 'up', PIXELS_FOR_TICK_5000)
  expect(app.preview.position(), '再生位置が 2 小節目 2 拍目の 5/24 拍後になっていません').toBe(
    '2 小節目 2 拍目の 5/24 拍後',
  )
  await app.selectTab('エディタ')
}

export async function turnClickSoundOn(app: AppDriver): Promise<void> {
  await app.selectTab('プレビュー')
  await app.click(app.button('クリック音'))
  expect(app.button('クリック音'), '「クリック音」が押された状態になっていません').toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await app.selectTab('エディタ')
}

export async function wheelPreviewTimes(
  app: AppDriver,
  direction: 'up' | 'down',
  pixels: number,
  times: number,
): Promise<void> {
  for (let count = 0; count < times; count++) {
    await scrollPreview(app, direction, pixels)
  }
}

export async function failResumeRequest(app: AppDriver, index: number): Promise<void> {
  const request = app.audio.resumeRequests()[index]
  expect(request, `${index + 1} 番目の音声再生の再開の要求がありません`).toBeDefined()
  request?.fail()
  await app.settle()
  expectStartFailureNotice(app)
}

export function allowAudioFeatures(): void {
  const flags = getSharedState<AudioFailureFlags>(AUDIO_STATE_KEY, () => {
    throw new Error('音声の偽物の状態がありません。startApp を呼んでから使ってください')
  })
  flags.contextCreationFails = false
  flags.resumeMode = 'succeed'
  flags.stretchCreationFails = false
  flags.stretchBufferTransferFails = false
  flags.stretchScheduleFails = false
  flags.clickFailuresRemaining = 0
}

export function expectEditorScreen(app: AppDriver, scrollPosition: string): void {
  expect(app.tabIsSelected('エディタ'), '画面上部の「エディタ」タブが選択された状態になっていません').toBe(true)
  expect(app.timeline.items(), 'タイムラインの代替コンテンツに、スクロール位置が出ていません').toContain(
    `スクロール位置 ${scrollPosition}`,
  )
  expect(screen.queryByLabelText('プレビュー'), 'プレビューの画面が残っています').toBeNull()
}

export function expectPreviewScreen(app: AppDriver, previewPosition: string): void {
  expect(app.tabIsSelected('プレビュー'), '画面上部の「プレビュー」タブが選択された状態になっていません').toBe(true)
  expect(app.preview.items(), 'プレビューの代替コンテンツに、再生位置が出ていません').toContain(
    `再生位置 ${previewPosition}`,
  )
  expect(screen.queryByLabelText('タイムライン'), 'エディタの画面が残っています').toBeNull()
}
