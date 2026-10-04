import type { Page } from '@playwright/test'
import { SAMPLE_AUDIO_PATH, loadAudio, openEditor } from './editor.ts'
import { expect, test } from '@playwright/test'

test.describe('[音源の読み込みからプレビュー再生] 通常の動線', () => {
  test.describe('正常系', () => {
    test.describe('音源を読み込んで「プレビュー」タブを選び、再生位置が 2 小節目まで進んでいるとき', () => {
      let page: Page

      test.beforeEach(async ({ page: openedPage }) => {
        page = openedPage
        await openEditor(page)
        await loadAudio(page, SAMPLE_AUDIO_PATH)
        await page.getByRole('tab', { name: 'プレビュー' }).click()
        await expect(page.getByLabel('プレビュー', { exact: true })).toContainText('再生位置 2 小節目')
      })

      test('「初めから再生」を押すと、プレビューの再生位置が 1 小節目 2 拍目まで進む', async () => {
        await page.getByRole('button', { name: '初めから再生' }).click()

        await expect(page.getByLabel('プレビュー', { exact: true })).toContainText('再生位置 1 小節目 2 拍目')
      })
    })
  })
})
