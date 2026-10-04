import type { Page } from '@playwright/test'
import { editSampleChart, saveToCloud } from './editor.ts'
import { createUniqueEmail, signInWithNewAccount } from './googleSignIn.ts'

/** クラウドに保存する譜面の持ち主のアカウント。 */
export interface SavedAccount {
  readonly email: string
}

/** 最初にログインしてから、譜面を編集する。 */
export async function editAfterSigningInFirst(page: Page): Promise<SavedAccount> {
  const email = createUniqueEmail()
  await signInWithNewAccount(page, email)
  await editSampleChart(page)
  return { email }
}

/** ログインせずに譜面を編集してから、ログインする。 */
export async function editThenSignInBeforeSaving(page: Page): Promise<SavedAccount> {
  const email = createUniqueEmail()
  await editSampleChart(page)
  await signInWithNewAccount(page, email)
  return { email }
}

/** 最初にログインして譜面を編集し、クラウドに保存する。 */
export async function saveAfterSigningInFirst(page: Page): Promise<SavedAccount> {
  const account = await editAfterSigningInFirst(page)
  await saveToCloud(page)
  return account
}
