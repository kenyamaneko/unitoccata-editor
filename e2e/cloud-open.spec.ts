import type { Page } from '@playwright/test'
import { saveAfterSigningInFirst, type SavedAccount } from './cloudSaveFlows.ts'
import {
  EDITED_CHART_GIVEN,
  SAMPLE_AUDIO_FILE_NAME,
  SAMPLE_CHART_NAME,
  SAMPLE_NOTE_DESCRIPTIONS,
  SAMPLE_SONG_NAME,
  exportChart,
  openFromCloud,
  openNewPage,
  readChartJson,
  readNoteDescriptions,
} from './editor.ts'
import { signInWithExistingAccount } from './googleSignIn.ts'
import { expect, test } from '@playwright/test'

test.describe('[クラウド保存からクラウドから開く] 通常の動線', () => {
  test.describe('正常系', () => {
    test.describe(EDITED_CHART_GIVEN, () => {
      test.describe('最初にログインして「クラウドに保存」で保存したあと、別のブラウザで同じアカウントでログインし、「クラウドから開く」で保存した曲の譜面を開いたとき', () => {
        let saved: SavedAccount
        let original: unknown
        let reopened: Page

        test.beforeEach(async ({ page, browser }) => {
          await page.goto('/')
          saved = await saveAfterSigningInFirst(page)
          original = await readChartJson(await exportChart(page))
          reopened = await openNewPage(browser)
          await signInWithExistingAccount(reopened, saved.email)
          await openFromCloud(reopened, SAMPLE_SONG_NAME, SAMPLE_CHART_NAME)
        })

        test('タイムラインの「譜面のノーツ」に、置いたタップノーツ・フリックノーツ・ロングノーツが一覧で出る', async () => {
          await expect(readNoteDescriptions(reopened)).toHaveText(SAMPLE_NOTE_DESCRIPTIONS)
        })

        test('「プロジェクト情報」ダイアログの曲名に、入力した曲名が出る', async () => {
          await reopened.getByRole('button', { name: 'プロジェクト情報' }).click()

          await expect(reopened.getByLabel('曲名')).toHaveValue('テスト曲')
        })

        test('「プロジェクト情報」ダイアログのオフセットに、入力したオフセットが出る', async () => {
          await reopened.getByRole('button', { name: 'プロジェクト情報' }).click()

          await expect(reopened.getByLabel('オフセット (ms)')).toHaveValue('250')
        })

        test('「プロジェクト情報」ダイアログの小節数に、入力した小節数が出る', async () => {
          await reopened.getByRole('button', { name: 'プロジェクト情報' }).click()

          await expect(reopened.getByLabel('小節数')).toHaveValue('12')
        })

        test('「譜面設定」ダイアログの譜面名に、入力した譜面名が出る', async () => {
          await reopened.getByRole('button', { name: '譜面設定' }).click()

          await expect(reopened.getByLabel('譜面名')).toHaveValue('譜面1')
        })

        test('「譜面設定」ダイアログのレーン数に、入力したレーン数が出る', async () => {
          await reopened.getByRole('button', { name: '譜面設定' }).click()

          await expect(reopened.getByRole('dialog', { name: '譜面設定' }).getByRole('status')).toHaveText('6')
        })

        test('右のパネルに、読み込んだ音源のファイル名が出る', async () => {
          await expect(reopened.getByRole('complementary').getByText(SAMPLE_AUDIO_FILE_NAME)).toBeVisible()
        })

        test('「譜面書き出し」で出る譜面ファイルは、保存した譜面を書き出した譜面ファイルと全項目一致する', async () => {
          const reexported = await exportChart(reopened)

          expect(await readChartJson(reexported)).toEqual(original)
        })
      })
    })
  })
})
