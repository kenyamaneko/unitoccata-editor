import { screen, waitFor, within } from '@testing-library/react'
import { expect } from 'vitest'
import { startApp, type AppDriver, type StartAppOptions } from './app.tsx'

export const SIGNED_IN_USER = 'alice'

export const WAIT = { timeout: 20_000 }

export const FIRESTORE_DENIED_REASON =
  'このデータを読み書きする権限がありません。ログインし直してから、もう一度お試しください'

export const STORAGE_DENIED_REASON =
  'このファイルを読み書きする権限がありません。ログインし直してから、もう一度お試しください'

export function startSignedIn(options: Pick<StartAppOptions, 'laneCount' | 'barCount'> = {}): Promise<AppDriver> {
  return startApp({ ...options, cloud: { configured: true, signedInAs: SIGNED_IN_USER } })
}

export function saveDialog(): HTMLElement {
  return screen.getByRole('dialog', { name: 'クラウドに保存' })
}

export function openDialog(): HTMLElement {
  return screen.getByRole('dialog', { name: 'クラウドから開く' })
}

export function savedMessage(songName: string, chartName: string): string {
  return `曲「${songName}」の譜面「${chartName}」を保存しました`
}

export async function enterNames(app: AppDriver, songName: string, chartName: string): Promise<void> {
  await app.projectInfo.open()
  await app.projectInfo.enterSongName(songName)
  await app.projectInfo.close()
  await app.chartSettings.open()
  await app.chartSettings.enterChartName(chartName)
  await app.chartSettings.close()
}

export async function openSaveDialog(app: AppDriver): Promise<void> {
  await app.fileMenu.choose('クラウドに保存')
}

export async function openSaveDialogWithNames(app: AppDriver, songName: string, chartName: string): Promise<void> {
  await enterNames(app, songName, chartName)
  await openSaveDialog(app)
}

export async function pressSave(app: AppDriver): Promise<void> {
  await app.click(app.button('保存する'))
}

export async function closeSaveDialog(app: AppDriver): Promise<void> {
  await app.click(within(saveDialog()).getByRole('button', { name: '閉じる' }))
}

export async function openCloudDialog(app: AppDriver): Promise<void> {
  await app.fileMenu.choose('クラウドから開く')
}

export async function chooseInOpenDialog(app: AppDriver, name: string): Promise<void> {
  await app.click(within(openDialog()).getByRole('button', { name }))
}

export async function openFromCloud(app: AppDriver, songName: string, chartName: string): Promise<void> {
  await openCloudDialog(app)
  await chooseInOpenDialog(app, songName)
  await chooseInOpenDialog(app, chartName)
  expect(app.dialog('クラウドから開く'), '譜面を選んでも、「クラウドから開く」ダイアログが閉じません').toBeNull()
}

export async function findSaveDialogText(text: string | RegExp): Promise<HTMLElement> {
  return within(await screen.findByRole('dialog', { name: 'クラウドに保存' })).findByText(text, undefined, WAIT)
}

export async function findOpenDialogText(text: string | RegExp): Promise<HTMLElement> {
  return within(await screen.findByRole('dialog', { name: 'クラウドから開く' })).findByText(text, undefined, WAIT)
}

export async function findInOpenDialog(role: 'button', name: string | RegExp): Promise<HTMLElement> {
  return within(await screen.findByRole('dialog', { name: 'クラウドから開く' })).findByRole(role, { name }, WAIT)
}

export async function chooseInOpenDialogWhenShown(app: AppDriver, name: string): Promise<void> {
  await app.click(await findInOpenDialog('button', name))
}

export async function openFromCloudWhenShown(app: AppDriver, songName: string, chartName: string): Promise<void> {
  await openCloudDialog(app)
  await chooseInOpenDialogWhenShown(app, songName)
  await chooseInOpenDialogWhenShown(app, chartName)
}

export async function waitForOpenDialogToClose(app: AppDriver): Promise<void> {
  await waitFor(() => expect(app.dialog('クラウドから開く')).toBeNull(), WAIT)
}
