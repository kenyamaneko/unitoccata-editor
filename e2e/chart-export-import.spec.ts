import type { Download, Page } from '@playwright/test'
import {
  EDITED_CHART_GIVEN,
  SAMPLE_NOTE_DESCRIPTIONS,
  SAMPLE_CHART_NAME,
  SAMPLE_SONG_NAME,
  editSampleChart,
  enterChartName,
  enterSongName,
  exportChart,
  loadChartFile,
  openEditor,
  readChartJson,
  readMeterDescriptions,
  readNoteDescriptions,
  readTempoDescriptions,
} from './editor.ts'
import { createUniqueEmail, signInWithNewAccount } from './googleSignIn.ts'
import { expect, test } from '@playwright/test'

test.describe('[ログインから譜面の書き出しと読み込み] 通常の動線', () => {
  test.describe('正常系', () => {
    test.describe(EDITED_CHART_GIVEN, () => {
      test.describe('ログインして編集し、「譜面書き出し」でダウンロードしたあと、エディタを開き直して、「ファイル」メニュー「インポート」の「譜面」でそのファイルを読み込んだとき', () => {
        let page: Page
        let exported: Download

        test.beforeEach(async ({ page: openedPage }) => {
          page = openedPage
          await openEditor(page)
          await signInWithNewAccount(page, createUniqueEmail())
          await editSampleChart(page)
          exported = await exportChart(page)
          await page.reload()
          await loadChartFile(page, await exported.path())
        })

        test('タイムラインの「譜面のノーツ」に、置いたタップノーツ・フリックノーツ・ロングノーツが一覧で出る', async () => {
          await expect(readNoteDescriptions(page)).toHaveText(SAMPLE_NOTE_DESCRIPTIONS)
        })

        test('「譜面設定」ダイアログのレーン数に、入力したレーン数 6 が出る', async () => {
          await page.getByRole('button', { name: '譜面設定' }).click()

          await expect(page.getByRole('dialog', { name: '譜面設定' }).getByRole('status')).toHaveText('6')
        })

        test('「プロジェクト情報」ダイアログのオフセットに、入力したオフセット 250 ミリ秒が出る', async () => {
          await page.getByRole('button', { name: 'プロジェクト情報' }).click()

          await expect(page.getByLabel('オフセット (ms)')).toHaveValue('250')
        })

        test('タイムラインの「テンポ」に、入力したテンポ (BPM 150) が 1 小節目 1 拍目に出る', async () => {
          await expect(readTempoDescriptions(page)).toHaveText(['1 小節目 1 拍目 BPM 150'])
        })

        test('タイムラインの「拍子」に、拍子を入力していないので、初期の 4/4 が 1 小節目 1 拍目に出る', async () => {
          await expect(readMeterDescriptions(page)).toHaveText(['1 小節目 1 拍目 4/4'])
        })

        test('曲名と譜面名を入力し直して「譜面書き出し」すると、最初にダウンロードした譜面ファイルと全項目一致するファイルが出る', async () => {
          await enterSongName(page, SAMPLE_SONG_NAME)
          await enterChartName(page, SAMPLE_CHART_NAME)

          const reexported = await exportChart(page)

          expect(await readChartJson(reexported)).toEqual(await readChartJson(exported))
        })
      })
    })
  })
})
