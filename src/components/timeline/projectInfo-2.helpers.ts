import { screen } from '@testing-library/react'
import { expect } from 'vitest'
import { startApp, type AppDriver } from '../../test/app.tsx'
import type { ChartFileProjectInfo } from '../../test/files.ts'
import { meterColumnAt, tempoColumnAt } from '../../test/timeline.ts'

const TEMPO_REASON = 'BPM は 20 以上 300 以下の半角の数で、小数点第一位までにして入力してください'
const METER_REASON =
  '拍子は半角で「分子/分母」の形に、分子を 1 以上 99 以下の整数、分母を 2、4、8、16 のいずれかにして入力してください'
const OFFSET_REASON = 'オフセットは数値で入力してください'

function expectEntered(app: AppDriver, placeholder: string): void {
  expect(
    app.alertTexts().length > 0 || screen.queryByPlaceholderText(placeholder) === null,
    'エンターキーを押しても、入力欄が閉じず、入力の誤りも出ません',
  ).toBe(true)
}

export async function startWithProjectInfo(
  content: ChartFileProjectInfo,
  expected: { readonly tempos: readonly string[]; readonly meters: readonly string[] },
): Promise<AppDriver> {
  const app = await startApp()
  await app.loadChart([], undefined, content)
  expect(app.timeline.tempos(), '前提のテンポが、タイムラインの代替コンテンツに出ていません').toEqual(expected.tempos)
  expect(app.timeline.meters(), '前提の拍子が、タイムラインの代替コンテンツに出ていません').toEqual(expected.meters)
  return app
}

export function tempoInput(app: AppDriver): HTMLElement {
  return app.field('BPM')
}

export function meterInput(): HTMLElement {
  return screen.getByPlaceholderText('拍子')
}

export async function openTempoInputAt(app: AppDriver, tick: number): Promise<HTMLElement> {
  await app.timeline.click(tempoColumnAt(tick))
  return tempoInput(app)
}

export async function openMeterInputAt(app: AppDriver, tick: number): Promise<HTMLElement> {
  await app.timeline.click(meterColumnAt(tick))
  return meterInput()
}

export async function openTempoInputOnChange(app: AppDriver, tick: number): Promise<HTMLElement> {
  await app.timeline.doubleClick(tempoColumnAt(tick))
  return tempoInput(app)
}

export async function openMeterInputOnChange(app: AppDriver, tick: number): Promise<HTMLElement> {
  await app.timeline.doubleClick(meterColumnAt(tick))
  return meterInput()
}

export async function typeIntoTempoInput(app: AppDriver, tick: number, text: string): Promise<HTMLElement> {
  const input = await openTempoInputAt(app, tick)
  await app.type(input, text)
  expect(input, '入力欄に、打った文字が入っていません').toHaveDisplayValue(text)
  return input
}

export async function addTempoChange(app: AppDriver, tick: number, text: string): Promise<void> {
  const input = await openTempoInputAt(app, tick)
  await app.setText(input, text)
  await app.press('Enter')
  expectEntered(app, 'BPM')
}

export async function addMeterChange(app: AppDriver, tick: number, text: string): Promise<void> {
  const input = await openMeterInputAt(app, tick)
  await app.setText(input, text)
  await app.press('Enter')
  expectEntered(app, '拍子')
}

export async function addInvalidTempoChange(app: AppDriver, tick: number, text: string): Promise<void> {
  await addTempoChange(app, tick, text)
  expect(app.alertTexts(), '誤った BPM を入力してエンターキーを押しても、入力欄に添えて理由が出ません').toEqual([
    TEMPO_REASON,
  ])
}

export async function addInvalidMeterChange(app: AppDriver, tick: number, text: string): Promise<void> {
  await addMeterChange(app, tick, text)
  expect(app.alertTexts(), '誤った拍子を入力してエンターキーを押しても、入力欄に添えて理由が出ません').toEqual([
    METER_REASON,
  ])
}

export async function rewriteTempoChange(app: AppDriver, tick: number, text: string): Promise<void> {
  const input = await openTempoInputOnChange(app, tick)
  await app.setText(input, text)
  await app.press('Enter')
  expectEntered(app, 'BPM')
}

export async function rewriteMeterChange(app: AppDriver, tick: number, text: string): Promise<void> {
  const input = await openMeterInputOnChange(app, tick)
  await app.setText(input, text)
  await app.press('Enter')
  expectEntered(app, '拍子')
}

export async function rightClickRemovingTempoChange(app: AppDriver, tick: number): Promise<void> {
  const before = app.timeline.tempos().length
  await app.timeline.rightClick(tempoColumnAt(tick))
  expect(app.timeline.tempos(), 'テンポ変化点を右クリックしても、削除されません').toHaveLength(before - 1)
}

export async function rightClickRemovingMeterChange(app: AppDriver, tick: number): Promise<void> {
  const before = app.timeline.meters().length
  await app.timeline.rightClick(meterColumnAt(tick))
  expect(app.timeline.meters(), '拍子変化点を右クリックしても、削除されません').toHaveLength(before - 1)
}

export async function pressUndo(app: AppDriver): Promise<void> {
  await app.click(app.button('元に戻す'))
}

export async function enterInvalidOffset(app: AppDriver, text: string): Promise<void> {
  await app.projectInfo.enterOffset(text)
  expect(app.alertTexts(), '誤ったオフセットを入力してエンターキーを押しても、理由が出ません').toEqual([OFFSET_REASON])
}

export async function setOffset(app: AppDriver, text: string): Promise<void> {
  await app.setText(app.projectInfo.offsetInput(), text)
}
