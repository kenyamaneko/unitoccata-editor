import { createUniqueEmail, signInWithNewAccount } from './googleSignIn.ts'
import { expect, test } from '@playwright/test'

test.describe('[ログインからログイン済みの表示] 通常の動線', () => {
  test.describe('正常系', () => {
    test('ログインしていないとき、「ログイン」から Google でログインすると、右のパネルのボタンが「ログアウト」になる', async ({
      page,
    }) => {
      await page.goto('/')

      await signInWithNewAccount(page, createUniqueEmail())

      await expect(page.getByRole('complementary').getByRole('button', { name: 'ログアウト' })).toBeVisible()
    })
  })
})
