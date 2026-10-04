import { expect } from 'vitest'
import { startApp, type AppDriver } from '../../test/app.tsx'
import { loadChartWithoutFocus as loadChartAndReleaseFocus } from '../../test/editor-operations-1.helpers.ts'
import { at } from '../../test/timeline.ts'

const TWO_TAPS = [
  { type: 'tap', tick: 480, lane: 1 },
  { type: 'tap', tick: 720, lane: 2 },
] as const

export async function startWithTwoTaps(): Promise<AppDriver> {
  const app = await startApp()
  await loadChartAndReleaseFocus(app, TWO_TAPS)
  return app
}

export async function startWithTapsAtBeat2Lane0AndBeat4Lane1(): Promise<AppDriver> {
  const app = await startApp()
  await loadChartAndReleaseFocus(app, [
    { type: 'tap', tick: 960, lane: 0 },
    { type: 'tap', tick: 2880, lane: 1 },
  ])
  return app
}

export async function startWithTapAt480Lane0AndLane4(): Promise<AppDriver> {
  const app = await startApp()
  await loadChartAndReleaseFocus(app, [
    { type: 'tap', tick: 480, lane: 0 },
    { type: 'tap', tick: 480, lane: 4 },
  ])
  return app
}

export async function startWithTapAndLeftFlick(): Promise<AppDriver> {
  const app = await startApp()
  await loadChartAndReleaseFocus(app, [
    { type: 'tap', tick: 480, lane: 0 },
    { type: 'flick', tick: 720, lane: 1, dir: 'left' },
  ])
  return app
}

export async function startWithUpFlick(): Promise<AppDriver> {
  const app = await startApp()
  await loadChartAndReleaseFocus(app, [{ type: 'flick', tick: 480, lane: 1, dir: 'up' }])
  return app
}

export async function startWithLongNoteEndingInRightFlick(): Promise<AppDriver> {
  const app = await startApp()
  await loadChartAndReleaseFocus(app, [
    { type: 'long', tick: 0, lane: 1, path: [{ tick: 480, lane: 3 }], end: { flick: 'right' } },
  ])
  return app
}

export async function startWithLongNoteWithoutEndFlick(): Promise<AppDriver> {
  const app = await startApp()
  await loadChartAndReleaseFocus(app, [
    {
      type: 'long',
      tick: 480,
      lane: 1,
      path: [
        { tick: 960, lane: 2 },
        { tick: 1440, lane: 3 },
      ],
      end: 'release',
    },
  ])
  return app
}

export async function startWithTapAt480Lane0(): Promise<AppDriver> {
  const app = await startApp()
  await loadChartAndReleaseFocus(app, [{ type: 'tap', tick: 480, lane: 0 }])
  return app
}

export async function selectTap480Lane1(app: AppDriver): Promise<void> {
  await app.timeline.selectEnclosing([{ tick: 480, lane: 1 }])
  expect(app.button('左右反転'), 'ノーツが選択されていません').toBeEnabled()
}

export async function selectBothTaps(app: AppDriver): Promise<void> {
  await app.timeline.selectEnclosing([
    { tick: 480, lane: 1 },
    { tick: 720, lane: 2 },
  ])
  expect(app.button('左右反転'), 'ノーツが選択されていません').toBeEnabled()
}

export async function pasteAt(app: AppDriver, key: 'Ctrl+V' | 'Cmd+V', tick: number, lane: number): Promise<void> {
  await app.timeline.hover(at(tick, lane))
  await app.press(key)
}

export async function pasteWithButtonAt(app: AppDriver, tick: number, lane: number): Promise<void> {
  await app.timeline.hover(at(tick, lane))
  await app.click(app.button('貼り付け'))
}

export async function startWithTwoPlacedTaps(): Promise<AppDriver> {
  const app = await startApp()
  await app.timeline.click(at(480, 2))
  await app.timeline.click(at(720, 2))
  expect(app.timeline.notes(), 'タップノーツを 2 つ置けていません').toEqual([
    'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2',
    'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
  ])
  return app
}

export async function zoomInWithCtrlWheel(app: AppDriver): Promise<void> {
  const heightBefore = app.timeline.gridStepHeight()
  await app.timeline.wheel('up', { ctrl: true })
  expect(app.timeline.gridStepHeight(), 'Ctrl を押しながらホイールを回しても、拡大されていません').toBeGreaterThan(
    heightBefore,
  )
}
