import { expect } from 'vitest'
import { startApp, type AppDriver } from './app.tsx'
import { createChartFile, createFile, createUnreadableFile, type ChartFileNote } from './files.ts'

export const CHART_FILE_NAME = 'chart.json'

const MAX_NOTE_COUNT = 3000
const LANES_PER_TICK = 5
const FIRST_NOTE_TICK = 960
const TICKS_BETWEEN_NOTES = 240

export function createChartWithFractionalTick(): File {
  return createChartFile(CHART_FILE_NAME, [{ type: 'tap', tick: 1.5, lane: 1 }])
}

export function createChartNotReadableAsJson(): File {
  return createFile(CHART_FILE_NAME, '{ notes: ')
}

export function createChartWithNegativeLane(): File {
  return createChartFile(CHART_FILE_NAME, [{ type: 'tap', tick: 480, lane: -1 }])
}

export function createChartWithLaneEqualToLaneCount(): File {
  return createChartFile(CHART_FILE_NAME, [{ type: 'tap', tick: 480, lane: 3 }], 3)
}

export function createChartWithLaneCountZero(): File {
  return createChartFile(CHART_FILE_NAME, [], 0)
}

export function createUnreadableChart(): File {
  return createUnreadableFile(CHART_FILE_NAME)
}

interface ChartOffset {
  readonly offsetMs?: number
}

export function createChartWithTempoNotStartingAtTickZero({ offsetMs }: ChartOffset = {}): File {
  return createChartFile(CHART_FILE_NAME, [], 5, { offsetMs, tempo: [{ tick: 10, bpm: 120 }] })
}

export function createChartWithMeterDenominatorThree(): File {
  return createChartFile(CHART_FILE_NAME, [], 5, { meter: [{ tick: 0, num: 4, den: 3 }] })
}

export function createChartWithMeterNumeratorZero(): File {
  return createChartFile(CHART_FILE_NAME, [], 5, { meter: [{ tick: 0, num: 0, den: 4 }] })
}

export function createTapNotes(count: number): ChartFileNote[] {
  return Array.from({ length: count }, (_, index) => ({
    type: 'tap',
    tick: FIRST_NOTE_TICK + TICKS_BETWEEN_NOTES * Math.floor(index / LANES_PER_TICK),
    lane: index % LANES_PER_TICK,
  }))
}

export function createMaxTapNotes(): ChartFileNote[] {
  return createTapNotes(MAX_NOTE_COUNT)
}

export async function startWithoutAudio(): Promise<AppDriver> {
  const app = await startApp()
  expect(
    app.text('音源が未読み込みです'),
    '前提の「音源が未読み込みです」が、右のパネルに出ていません',
  ).toBeInTheDocument()
  return app
}

export async function chooseRejectedChart(app: AppDriver, file: File): Promise<void> {
  await app.files.chooseChart(file)
  expect(app.noticeTexts(), '読み込めない譜面を選んでも、失敗のメッセージが出ません').not.toEqual([])
}

export async function enterNames(app: AppDriver, songName: string, chartName: string): Promise<void> {
  await app.projectInfo.open()
  await app.projectInfo.enterSongName(songName)
  await app.projectInfo.close()
  await app.chartSettings.open()
  await app.chartSettings.enterChartName(chartName)
  await app.chartSettings.close()
}
