import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { editAfterSigningInFirst, editThenSignInBeforeSaving, type SavedAccount } from './cloudSaveFlows.ts'
import {
  EDITED_CHART_GIVEN,
  SAMPLE_AUDIO_FILE_NAME,
  SAMPLE_AUDIO_PATH,
  SAMPLE_CHART_NAME,
  SAMPLE_SONG_NAME,
  SIGN_IN_REQUIRED_NOTICE,
  SAVED_MESSAGE,
  pressSave,
  saveToCloud,
  editSampleChart,
  readExpectedChart,
  requestCloudSaveWhileSignedOut,
} from './editor.ts'
import { findCloudChart, findCloudProject, lookUpUid, readCloudAudio } from './emulatorCloud.ts'
import { createUniqueEmail, signInWithNewAccount } from './googleSignIn.ts'
import { expect, test } from '@playwright/test'

async function findSavedProject(saved: SavedAccount) {
  return findCloudProject(await lookUpUid(saved.email), SAMPLE_SONG_NAME)
}

async function findSavedChart(saved: SavedAccount) {
  return findCloudChart(await findSavedProject(saved), SAMPLE_CHART_NAME)
}

function describeSavedCloudContents(given: string, prepare: (page: Page) => Promise<SavedAccount>): void {
  test.describe(given, () => {
    let saved: SavedAccount

    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      saved = await prepare(page)
      await saveToCloud(page)
    })

    test('クラウドのプロジェクト情報の曲名は、入力した曲名になる', async () => {
      expect((await findSavedProject(saved)).data.title).toBe('テスト曲')
    })

    test('クラウドのプロジェクト情報のオフセットは、入力したオフセット 250 ミリ秒になる', async () => {
      expect((await findSavedProject(saved)).data.offsetMs).toBe(250)
    })

    test('クラウドのプロジェクト情報の小節数は、入力した小節数になる', async () => {
      expect((await findSavedProject(saved)).data.barCount).toBe(12)
    })

    test('クラウドのプロジェクト情報のテンポは、入力したテンポの 1 点 (tick 0・150 BPM) だけになる', async () => {
      expect((await findSavedProject(saved)).data.tempo).toEqual([{ tick: 0, bpm: 150 }])
    })

    test('クラウドのプロジェクト情報の拍子は、拍子を入力していないので、初期の 4/4 の 1 点 (tick 0) だけになる', async () => {
      expect((await findSavedProject(saved)).data.meter).toEqual([{ tick: 0, num: 4, den: 4 }])
    })

    test('クラウドの譜面の譜面名は、入力した譜面名になる', async () => {
      expect((await findSavedChart(saved)).data.name).toBe('譜面1')
    })

    test('クラウドの譜面のレーン数は、入力したレーン数になる', async () => {
      expect((await findSavedChart(saved)).data.laneCount).toBe(6)
    })

    test('クラウドの譜面のノーツは、置いたタップノーツ・フリックノーツ・ロングノーツの 3 つだけになる', async () => {
      const expected = (await readExpectedChart()) as { notes: unknown }

      expect((await findSavedChart(saved)).data.notes).toEqual(expected.notes)
    })

    test('クラウドの音源は、読み込んだ音源ファイルと同じバイト列になる', async () => {
      const audio = await readCloudAudio(await findSavedProject(saved), SAMPLE_AUDIO_FILE_NAME)

      expect(audio.equals(await readFile(SAMPLE_AUDIO_PATH))).toBe(true)
    })
  })
}

function describeSavingFlow(given: string, prepare: (page: Page) => Promise<SavedAccount>): void {
  test.describe(given, () => {
    test('「クラウドに保存」の「保存する」を押すと、「クラウドに保存」ダイアログに、保存完了のメッセージ「曲「入力した曲名」の譜面「入力した譜面名」を保存しました」が出る', async ({
      page,
    }) => {
      await page.goto('/')
      await prepare(page)

      const status = await pressSave(page)

      await expect(status).toHaveText(SAVED_MESSAGE)
    })

    describeSavedCloudContents('「クラウドに保存」の「保存する」を押して保存が終わると', prepare)
  })
}

test.describe('[ログインからクラウド保存] 通常の動線', () => {
  test.describe('正常系', () => {
    test.describe(EDITED_CHART_GIVEN, () => {
      describeSavingFlow('最初にログインしてから編集していたとき', editAfterSigningInFirst)
    })
  })
})

test.describe('[ログインからクラウド保存] ログインを後回しにする動線', () => {
  test.describe('正常系', () => {
    test.describe(EDITED_CHART_GIVEN, () => {
      describeSavingFlow(
        'ログインせずに編集し、「クラウドに保存」を押す前にログインしたとき',
        editThenSignInBeforeSaving,
      )
    })
  })
})

test.describe('[ログインからクラウド保存] ログインしていないまま保存を押して通知が出てから回復する動線', () => {
  test.describe('正常系', () => {
    test.describe(EDITED_CHART_GIVEN, () => {
      test.describe('ログインしていないまま「クラウドに保存」を押して通知が出たあと、ログインしたとき', () => {
        test.beforeEach(async ({ page }) => {
          await page.goto('/')
          await editSampleChart(page)
          await requestCloudSaveWhileSignedOut(page)
          await page.getByText(SIGN_IN_REQUIRED_NOTICE).waitFor()
          await signInWithNewAccount(page, createUniqueEmail())
        })

        test('ログインを促す通知「クラウドを使うには、ログインしてください」は、画面の下に出ていない', async ({
          page,
        }) => {
          expect(await page.getByText(SIGN_IN_REQUIRED_NOTICE).count()).toBe(0)
        })

        test('「クラウドに保存」の「保存する」を押すと、「クラウドに保存」ダイアログに、保存完了のメッセージ「曲「入力した曲名」の譜面「入力した譜面名」を保存しました」が出る', async ({
          page,
        }) => {
          const status = await pressSave(page)

          await expect(status).toHaveText(SAVED_MESSAGE)
        })
      })
    })
  })
})
