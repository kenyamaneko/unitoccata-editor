import { expect, test } from '@playwright/test'

const GOOGLE_ACCOUNTS_URL = /^https:\/\/accounts\.google\.com\//

test.describe('[Google ログイン] 本物の Google のログイン画面への接続', () => {
  test.describe('正常系', () => {
    test('デプロイ済みのアプリで「ログイン」から「Google でログイン」を押すと、ウィンドウが開き、アドレスが accounts.google.com になる', async ({
      page,
    }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'ログイン', exact: true }).click()
      const popupOpening = page.waitForEvent('popup')

      await page.getByRole('button', { name: 'Google でログイン' }).click()

      await expect(await popupOpening).toHaveURL(GOOGLE_ACCOUNTS_URL)
    })
  })
})
