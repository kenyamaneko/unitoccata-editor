import type { Page } from '@playwright/test'
import {
  EDITED_CHART_GIVEN,
  SAMPLE_NOTE_DESCRIPTIONS,
  editSampleChart,
  enterSongName,
  exportChart,
  loadChartFile,
  openNewPage,
  readChartJson,
  readNoteDescriptions,
} from './editor.ts'
import { expect, test } from '@playwright/test'

test.describe('[譜面の書き出しから読み込み] 通常の動線', () => {
  test.describe('正常系', () => {
    test.describe(EDITED_CHART_GIVEN, () => {
      test.describe('「譜面書き出し」したファイルを、ログインしていない別のブラウザの「ファイル」メニュー「インポート」の「譜面」で読み込んだとき', () => {
        let exportedPath: string
        let exportedChart: unknown
        let importing: Page

        test.beforeEach(async ({ page, browser }) => {
          await page.goto('/')
          await editSampleChart(page)
          const download = await exportChart(page)
          exportedPath = await download.path()
          exportedChart = await readChartJson(download)
          importing = await openNewPage(browser)
          await loadChartFile(importing, exportedPath)
        })

        test('タイムラインの「譜面のノーツ」に、置いたタップノーツ・フリックノーツ・ロングノーツが同じ内容で一覧に出る', async () => {
          await expect(readNoteDescriptions(importing)).toHaveText(SAMPLE_NOTE_DESCRIPTIONS)
        })

        test('曲名を入力して「譜面書き出し」すると、書き出した譜面ファイルは、読み込んだ譜面ファイルと全項目一致する', async () => {
          await enterSongName(importing, 'テスト曲')

          const reexported = await exportChart(importing)

          expect(await readChartJson(reexported)).toEqual(exportedChart)
        })
      })
    })
  })
})
