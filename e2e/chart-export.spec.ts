import {
  EDITED_CHART_GIVEN,
  editSampleChart,
  enterChartName,
  enterSongName,
  exportChart,
  readChartJson,
  readExpectedChart,
} from './editor.ts'
import { expect, test } from '@playwright/test'

test.describe('[譜面の編集から書き出し] 通常の動線', () => {
  test.describe('正常系', () => {
    test.describe('曲名「テスト曲」・譜面名「譜面1」を入力したとき', () => {
      test('「譜面書き出し」を押すと、ダウンロードされるファイル名は「入力した譜面名.入力した曲名.unitoccata.json」になる', async ({
        page,
      }) => {
        await page.goto('/')
        await enterSongName(page, 'テスト曲')
        await enterChartName(page, '譜面1')

        const download = await exportChart(page)

        expect(download.suggestedFilename()).toBe('譜面1.テスト曲.unitoccata.json')
      })
    })

    test.describe(EDITED_CHART_GIVEN, () => {
      test('「譜面書き出し」を押すと、ダウンロードした譜面ファイルの中身は、入力した値と置いたノーツを過不足なく含む', async ({
        page,
      }) => {
        await page.goto('/')
        await editSampleChart(page)

        const download = await exportChart(page)

        expect(await readChartJson(download)).toEqual(await readExpectedChart())
      })
    })
  })
})
