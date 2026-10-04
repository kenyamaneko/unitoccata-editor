import { randomUUID } from 'node:crypto'
import { expect, type Page } from '@playwright/test'

/** ほかのテストと重ならないメールアドレスを作る。 */
export function createUniqueEmail(): string {
  return `${randomUUID()}@example.com`
}

async function openEmulatorSignInPopup(page: Page): Promise<Page> {
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  const popupOpening = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Google でログイン' }).click()
  const popup = await popupOpening
  await popup.waitForLoadState('networkidle')
  return popup
}

/** Auth エミュレータの Google ログインで、メールアドレスの新しいアカウントを作ってログインする。 */
export async function signInWithNewAccount(page: Page, email: string): Promise<void> {
  const popup = await openEmulatorSignInPopup(page)
  await popup.locator('#add-account-button button').click()
  await popup.getByLabel('Email').fill(email)
  await popup.locator('#sign-in').click()
  await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
}

/** Auth エミュレータの Google ログインで、既にあるアカウントを選んでログインする。 */
export async function signInWithExistingAccount(page: Page, email: string): Promise<void> {
  const popup = await openEmulatorSignInPopup(page)
  await popup.locator('.js-reuse-account', { hasText: email }).click()
  await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
}
