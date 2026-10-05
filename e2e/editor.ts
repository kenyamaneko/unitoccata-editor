import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, type Browser, type Download, type Locator, type Page } from '@playwright/test'
import { DEFAULT_PIXELS_PER_TICK } from '../src/constants/canvas.ts'
import {
  convertLaneToCenterX,
  convertTickToY,
  getTempoColumnRange,
  type TimelineViewport,
} from '../src/components/timeline/timelineLayout.ts'

/** テストで読み込む音源ファイルのパス。 */
export const SAMPLE_AUDIO_PATH = join(import.meta.dirname, 'fixtures', 'silence.mp3')
/** テストで読み込む音源ファイルの名前。 */
export const SAMPLE_AUDIO_FILE_NAME = 'silence.mp3'
/** テストで入力する曲名。 */
export const SAMPLE_SONG_NAME = 'テスト曲'
/** テストで入力する譜面名。 */
export const SAMPLE_CHART_NAME = '譜面1'
/** テストで入力するオフセット (ミリ秒)。 */
export const SAMPLE_OFFSET_MS = 250
/** テストで入力する小節数。 */
export const SAMPLE_BAR_COUNT = 12
/** テストで入力するテンポ (BPM)。 */
export const SAMPLE_BPM = 150
/** テストで設定するレーン数。 */
export const SAMPLE_LANE_COUNT = 6
/** テストの曲名と譜面名で保存したときに出る、保存完了のメッセージ。 */
export const SAVED_MESSAGE = '曲「テスト曲」の譜面「譜面1」を保存しました'
/** ログインしていないままクラウドを使おうとしたときに出る通知。 */
export const SIGN_IN_REQUIRED_NOTICE = 'クラウドを使うには、ログインしてください'
/** ケース名に書く、テストが入力する値と置くノーツの前提。 */
export const EDITED_CHART_GIVEN =
  '曲名「テスト曲」・オフセット 250 ミリ秒・小節数 12・テンポ 150 BPM・譜面名「譜面1」・レーン数 6 を入力し、タップノーツ・フリックノーツ・ロングノーツを 1 つずつ置いて、音源を読み込んだとき'
/** テストが置くノーツが、タイムラインの「譜面のノーツ」に一覧で出るときの文言。 */
export const SAMPLE_NOTE_DESCRIPTIONS = [
  'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
  '右フリックノーツ 1 小節目 2 拍目 レーン 5',
  'ロングノーツ 始点 1 小節目 2 拍目の 1/2 拍後 レーン 0、続く点 1 小節目 3 拍目 レーン 0、1 小節目 3 拍目の 1/2 拍後 レーン 2、終端 上フリック',
]

const INITIAL_LANE_COUNT = 5
const INITIAL_SCROLL_TICK = 0
const DRAG_STEPS = 5
const HOVER_APPROACH_PIXELS = 20

type FlickDirection = 'up' | 'left' | 'right'

interface ChartPoint {
  readonly tick: number
  readonly lane: number
}

const ARROW_KEY_OF_DIRECTION: Readonly<Record<FlickDirection, string>> = {
  up: 'ArrowUp',
  left: 'ArrowLeft',
  right: 'ArrowRight',
}

const TAP_POINT: ChartPoint = { tick: 480, lane: 1 }
const FLICK_POINT: ChartPoint = { tick: 960, lane: 5 }
const LONG_START: ChartPoint = { tick: 1440, lane: 0 }
const LONG_CHECKPOINT: ChartPoint = { tick: 1920, lane: 0 }
const LONG_END: ChartPoint = { tick: 2400, lane: 2 }

/** エディタを開いて、右のパネルの「ファイル」ボタンが出るまで待つ。 */
export async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'ファイル' })).toBeVisible()
}

/** ログイン状態や保存データを共有しない別のブラウザでエディタを開く。 */
export async function openNewPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await openEditor(page)
  return page
}

/** 「ファイル」メニューを開いて、名前の項目を押す。 */
export async function chooseFileMenuItem(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'ファイル' }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}

/** 「ファイル」メニューの項目を押して開くファイル選択に、ファイルを渡す。 */
async function importFile(page: Page, menuItem: string, path: string): Promise<void> {
  const choosing = page.waitForEvent('filechooser')
  await chooseFileMenuItem(page, menuItem)
  await (await choosing).setFiles(path)
}

/** 音源を読み込んで、音源の名前が出るまで待つ。 */
export async function loadAudio(page: Page, path: string): Promise<void> {
  await importFile(page, '音源', path)
  await expect(page.getByText(SAMPLE_AUDIO_FILE_NAME)).toBeVisible()
}

/** 「ファイル」メニュー「インポート」の「譜面」で、譜面ファイルを読み込む。 */
export async function loadChartFile(page: Page, path: string): Promise<void> {
  await importFile(page, '譜面', path)
}

async function closeDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: '閉じる', exact: true }).click()
}

/** 「プロジェクト情報」に曲名・オフセット・小節数を入力して閉じる。 */
export async function enterProjectInfo(
  page: Page,
  info: { readonly songName: string; readonly offsetMs: number; readonly barCount: number },
): Promise<void> {
  await page.getByRole('button', { name: 'プロジェクト情報' }).click()
  await page.getByLabel('曲名').fill(info.songName)
  await page.getByLabel('オフセット (ms)').fill(String(info.offsetMs))
  await page.keyboard.press('Enter')
  await page.getByLabel('小節数').fill(String(info.barCount))
  await page.keyboard.press('Enter')
  await closeDialog(page)
}

/** 「プロジェクト情報」に曲名だけを入力して閉じる。 */
export async function enterSongName(page: Page, songName: string): Promise<void> {
  await page.getByRole('button', { name: 'プロジェクト情報' }).click()
  await page.getByLabel('曲名').fill(songName)
  await closeDialog(page)
}

/** 「譜面設定」に譜面名だけを入力して閉じる。 */
export async function enterChartName(page: Page, chartName: string): Promise<void> {
  await page.getByRole('button', { name: '譜面設定' }).click()
  await page.getByLabel('譜面名').fill(chartName)
  await closeDialog(page)
}

/** 「譜面設定」に譜面名とレーン数を設定して閉じる。 */
export async function enterChartSettings(
  page: Page,
  settings: { readonly chartName: string; readonly laneCount: number },
): Promise<void> {
  await page.getByRole('button', { name: '譜面設定' }).click()
  await page.getByLabel('譜面名').fill(settings.chartName)
  const dialog = page.getByRole('dialog', { name: '譜面設定' })
  for (let laneCount = INITIAL_LANE_COUNT; laneCount < settings.laneCount; laneCount++) {
    await dialog.getByRole('button', { name: '＋' }).click()
  }
  await expect(dialog.getByRole('status')).toHaveText(String(settings.laneCount))
  await closeDialog(page)
}

interface TimelineGeometry {
  readonly left: number
  readonly top: number
  readonly viewport: TimelineViewport
}

async function readTimelineGeometry(page: Page): Promise<TimelineGeometry> {
  const { x, y, width, height } = await page.getByLabel('タイムライン').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  return {
    left: x,
    top: y,
    viewport: {
      width,
      height,
      laneCount: SAMPLE_LANE_COUNT,
      scrollTick: INITIAL_SCROLL_TICK,
      pixelsPerTick: DEFAULT_PIXELS_PER_TICK,
    },
  }
}

async function locate(page: Page, point: ChartPoint): Promise<{ readonly x: number; readonly y: number }> {
  const { left, top, viewport } = await readTimelineGeometry(page)
  return {
    x: left + convertLaneToCenterX(viewport, point.lane),
    y: top + convertTickToY(viewport, point.tick),
  }
}

async function dragOnTimeline(page: Page, from: ChartPoint, to: ChartPoint): Promise<void> {
  const start = await locate(page, from)
  const end = await locate(page, to)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: DRAG_STEPS })
  await page.mouse.up()
}

async function clickOnTimeline(page: Page, point: ChartPoint): Promise<void> {
  const { x, y } = await locate(page, point)
  await page.mouse.click(x, y)
}

async function pressArrowOver(page: Page, point: ChartPoint, direction: FlickDirection): Promise<void> {
  const { x, y } = await locate(page, point)
  await page.mouse.move(x + HOVER_APPROACH_PIXELS, y)
  await page.mouse.move(x, y)
  await page.keyboard.press(ARROW_KEY_OF_DIRECTION[direction])
}

/** tick 0 のテンポ (BPM) をタイムラインのテンポ列で入力する。 */
export async function enterTempo(page: Page, bpm: number): Promise<void> {
  const { left, top, viewport } = await readTimelineGeometry(page)
  const tempoColumn = getTempoColumnRange()
  await page.mouse.dblclick(left + (tempoColumn.left + tempoColumn.right) / 2, top + convertTickToY(viewport, 0))
  await page.getByPlaceholder('BPM').fill(String(bpm))
  await page.keyboard.press('Enter')
  await expect(page.getByPlaceholder('BPM')).toHaveCount(0)
}

/** タップノーツ・フリックノーツ・ロングノーツ (チェックポイントと終端フリックを含む) を 1 つずつ置く。 */
export async function placeSampleNotes(page: Page): Promise<void> {
  await clickOnTimeline(page, TAP_POINT)
  await clickOnTimeline(page, FLICK_POINT)
  await pressArrowOver(page, FLICK_POINT, 'right')
  await dragOnTimeline(page, LONG_START, LONG_CHECKPOINT)
  await dragOnTimeline(page, LONG_CHECKPOINT, LONG_END)
  await pressArrowOver(page, LONG_END, 'up')
  await expect(readNoteDescriptions(page)).toHaveText(SAMPLE_NOTE_DESCRIPTIONS)
}

/** タイムラインの「譜面のノーツ」の一覧の項目を返す。一覧は canvas の代替内容で、role では取れないため li で探す。 */
export function readNoteDescriptions(page: Page) {
  return page.getByLabel('譜面のノーツ').locator('li')
}

/** タイムラインの「テンポ」の一覧の項目を返す。 */
export function readTempoDescriptions(page: Page) {
  return page.getByLabel('テンポ').locator('li')
}

/** タイムラインの「拍子」の一覧の項目を返す。 */
export function readMeterDescriptions(page: Page) {
  return page.getByLabel('拍子').locator('li')
}

/** プロジェクト情報・譜面設定・テンポを入力し、ノーツを置き、音源を読み込む。 */
export async function editSampleChart(page: Page): Promise<void> {
  await enterProjectInfo(page, {
    songName: SAMPLE_SONG_NAME,
    offsetMs: SAMPLE_OFFSET_MS,
    barCount: SAMPLE_BAR_COUNT,
  })
  await enterChartSettings(page, { chartName: SAMPLE_CHART_NAME, laneCount: SAMPLE_LANE_COUNT })
  await enterTempo(page, SAMPLE_BPM)
  await placeSampleNotes(page)
  await loadAudio(page, SAMPLE_AUDIO_PATH)
}

/** 「譜面書き出し」を押して、ダウンロードされたファイルを返す。 */
export async function exportChart(page: Page): Promise<Download> {
  const downloading = page.waitForEvent('download')
  await chooseFileMenuItem(page, '譜面書き出し')
  return downloading
}

/** ダウンロードした譜面ファイルを JSON として読む。 */
export async function readChartJson(download: Download): Promise<unknown> {
  return JSON.parse(await readFile(await download.path(), 'utf8'))
}

/** 期待の譜面ファイルを JSON として読む。 */
export async function readExpectedChart(): Promise<unknown> {
  return JSON.parse(await readFile(join(import.meta.dirname, 'fixtures', 'expected-chart.unitoccata.json'), 'utf8'))
}

/** 「クラウドに保存」ダイアログを開いて「保存する」を押し、ダイアログの保存の状態表示を返す。 */
export async function pressSave(page: Page): Promise<Locator> {
  await chooseFileMenuItem(page, 'クラウドに保存')
  const dialog = page.getByRole('dialog', { name: 'クラウドに保存' })
  await dialog.getByRole('button', { name: '保存する' }).click()
  return dialog.getByRole('status')
}

/** 「クラウドに保存」で保存を押して、保存が終わるまで待ち、ダイアログを閉じる。 */
export async function saveToCloud(page: Page): Promise<void> {
  const status = await pressSave(page)
  await status.filter({ hasText: '保存しました' }).waitFor()
  await page
    .getByRole('dialog', { name: 'クラウドに保存' })
    .getByRole('button', { name: '閉じる', exact: true })
    .click()
}

/** ログインしていないまま「クラウドに保存」を押す。 */
export async function requestCloudSaveWhileSignedOut(page: Page): Promise<void> {
  await chooseFileMenuItem(page, 'クラウドに保存')
}

/** 「クラウドから開く」で曲と譜面を選んで開く。 */
export async function openFromCloud(page: Page, songName: string, chartName: string): Promise<void> {
  await chooseFileMenuItem(page, 'クラウドから開く')
  const dialog = page.getByRole('dialog', { name: 'クラウドから開く' })
  await dialog.getByRole('button', { name: songName }).click()
  await dialog.getByRole('button', { name: chartName }).click()
  await expect(dialog).toBeHidden()
}
