import { expect, test } from '@playwright/test'

const TAGGED_VERSION = /^バージョン v\d+\.\d+\.\d+(-\d+-g[0-9a-f]{7,})?$/
const SHORT_COMMIT_ID_VERSION = /^バージョン [0-9a-f]{7,}$/

test.describe('[タイムライン] デプロイ済みのエディタの表示', () => {
  test.describe('正常系', () => {
    test('デプロイ済みの URL を開くと、タイムラインが表示される', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByLabel('タイムライン')).toBeVisible()
    })
  })
})

test.describe('[ファイルメニュー] デプロイ済みのエディタの表示', () => {
  test.describe('正常系', () => {
    test('デプロイ済みの URL を開くと、右のパネルに「ファイル」ボタンが表示される', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByRole('complementary').getByRole('button', { name: 'ファイル' })).toBeVisible()
    })
  })
})

test.describe('[このアプリについて] デプロイ済みのエディタのバージョン表示', () => {
  test.describe('正常系', () => {
    test('右のパネルの「このアプリについて」を押すと、ダイアログにバージョンが v で始まるタグの形式か短縮コミット ID で表示される', async ({
      page,
    }) => {
      await page.goto('/')

      await page.getByRole('complementary').getByRole('button', { name: 'このアプリについて' }).click()

      const version = page.getByRole('dialog', { name: 'このアプリについて' }).getByText(/^バージョン /)
      await expect(version).toHaveText(new RegExp(`${TAGGED_VERSION.source}|${SHORT_COMMIT_ID_VERSION.source}`))
    })
  })
})
