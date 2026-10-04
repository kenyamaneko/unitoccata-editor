import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AppDriver } from '../../test/app.tsx'
import {
  FIRESTORE_DENIED_REASON,
  STORAGE_DENIED_REASON,
  closeSaveDialog,
  enterNames,
  openFromCloud,
  openSaveDialog,
  openSaveDialogWithNames,
  pressSave,
  saveDialog,
  savedMessage,
  startSignedIn,
} from '../../test/cloud-storage-1.helpers.ts'
import { createFirebaseError } from '../../test/fakeFirebase.ts'
import { createAudioBytes, createAudioFile } from '../../test/fakeAudio.ts'

const SONG = 'テスト曲'
const CHART = '譜面1'
const TWO_TAP_NOTES = [
  { type: 'tap', tick: 480, lane: 2 },
  { type: 'tap', tick: 960, lane: 1 },
] as const
const NAME_GUIDANCE = '。「プロジェクト情報」と「譜面設定」で入力してください'
const LOGOUT_NETWORK_FAILURE =
  'ログアウトできませんでした: 通信に失敗しました。ネットワークの接続を確認して、もう一度お試しください'
const CHECK_FAILED = `保存先を確かめられませんでした: ${FIRESTORE_DENIED_REASON}`
const AUDIO_SAVE_FAILED = `音源「song.ogg」を保存できませんでした: ${STORAGE_DENIED_REASON}`
const PROJECT_SAVE_FAILED = `プロジェクトと譜面を保存できませんでした: ${FIRESTORE_DENIED_REASON}`
const AUDIO_UNEXPECTED_FAILED =
  '音源「song.ogg」を保存できませんでした: クラウドとの通信で想定外のエラーが起きました (storage/unknown): テスト用の失敗'
const PROJECT_UNEXPECTED_FAILED =
  'プロジェクトと譜面を保存できませんでした: クラウドとの通信で想定外のエラーが起きました (internal): テスト用の失敗'
const AUDIO_LIST_FAILED = `古い音源を確かめられませんでした: ${STORAGE_DENIED_REASON}`
const AUDIO_DELETE_FAILED = `古い音源「song.mp3」を削除できませんでした: ${STORAGE_DENIED_REASON}`

async function startWithAudioSavedOverOldAudio(): Promise<AppDriver> {
  const app = await startSignedIn()
  await app.cloud.putProject({ title: SONG, audioFileName: 'song.mp3' })
  await app.cloud.putChart(SONG, { name: CHART })
  await app.cloud.putAudio(SONG, 'song.mp3', createAudioBytes())
  await openFromCloud(app, SONG, CHART)
  await app.files.chooseAudio(createAudioFile('song.ogg'))
  await openSaveDialog(app)
  return app
}

async function startWithAudioLoaded(): Promise<AppDriver> {
  const app = await startSignedIn()
  await app.files.chooseAudio(createAudioFile('song.ogg'))
  await openSaveDialogWithNames(app, SONG, CHART)
  return app
}

describe('[ログイン] ログアウトの失敗', () => {
  describe('「ログアウト」の押下', () => {
    describe('異常系', () => {
      it(`ネットワークの接続が切れていてログアウトできないとき、「ログアウト」を押すと、画面の下のメッセージに「${LOGOUT_NETWORK_FAILURE}」と表示される`, async () => {
        const app = await startSignedIn()
        app.cloudFaults.failSignOut(createFirebaseError('auth/network-request-failed'))

        await app.click(app.button('ログアウト'))

        expect(app.notice(LOGOUT_NETWORK_FAILURE)).toBeInTheDocument()
      })

      it('ネットワークの接続が切れていてログアウトできないとき、「ログアウト」を押しても、ログアウトされず、右のパネルに「ログアウト」が表示されたままになる', async () => {
        const app = await startSignedIn()
        app.cloudFaults.failSignOut(createFirebaseError('auth/network-request-failed'))

        await app.click(app.button('ログアウト'))
        screen.getByText(LOGOUT_NETWORK_FAILURE)

        expect(app.button('ログアウト')).toBeInTheDocument()
      })

      it('ネットワークの接続が切れていてログアウトに失敗したあと、ログアウトできるようになったとき、「ログアウト」を押し直すと、右のパネルに「ログイン」が表示される', async () => {
        const app = await startSignedIn()
        app.cloudFaults.failSignOut(createFirebaseError('auth/network-request-failed'))
        await app.click(app.button('ログアウト'))
        screen.getByText(LOGOUT_NETWORK_FAILURE)
        app.cloudFaults.allowSignOut()

        await app.click(app.button('ログアウト'))

        expect(app.text('ログイン')).toBeInTheDocument()
      })
    })
  })
})

describe('[クラウドに保存] 「クラウドに保存」ダイアログの表示', () => {
  describe('「ファイル」メニューの「クラウドに保存」の押下', () => {
    describe('正常系', () => {
      it.each([
        { label: '曲名', value: SONG },
        { label: '譜面名', value: CHART },
      ])(
        '「プロジェクト情報」の曲名が「テスト曲」、「譜面設定」の譜面名が「譜面1」のとき、「クラウドに保存」を押すと、ダイアログに「$label」の値「$value」が表示される',
        async ({ label, value }) => {
          const app = await startSignedIn()
          await enterNames(app, SONG, CHART)

          await openSaveDialog(app)

          expect(saveDialog()).toHaveTextContent(`${label}${value}`)
        },
      )

      it('「クラウドに保存」を押すと、ダイアログに曲名・譜面名の入力欄は表示されない', async () => {
        const app = await startSignedIn()
        await enterNames(app, SONG, CHART)

        await openSaveDialog(app)

        expect(within(saveDialog()).queryByRole('textbox')).toBeNull()
      })

      it.each([
        { condition: '曲名が「a」の 100 文字のとき', songName: 'a'.repeat(100), chartName: CHART },
        { condition: '譜面名が「a」の 100 文字のとき', songName: SONG, chartName: 'a'.repeat(100) },
      ])(
        '$condition、「クラウドに保存」を押すと、ダイアログの「保存する」は押せる状態になる',
        async ({ songName, chartName }) => {
          const app = await startSignedIn()
          await enterNames(app, songName, chartName)

          await openSaveDialog(app)

          expect(app.button('保存する')).toBeEnabled()
        },
      )

      it.each([
        { condition: '曲名が空のとき', songName: '', chartName: CHART, message: '曲名を入力してください' },
        { condition: '譜面名が空のとき', songName: SONG, chartName: '', message: '譜面名を入力してください' },
      ])(
        '$condition、「クラウドに保存」を押すと、ダイアログに「$message。「プロジェクト情報」と「譜面設定」で入力してください」と表示される',
        async ({ songName, chartName, message }) => {
          const app = await startSignedIn()
          await enterNames(app, songName, chartName)

          await openSaveDialog(app)

          expect(within(saveDialog()).getByText(`${message}${NAME_GUIDANCE}`)).toBeInTheDocument()
        },
      )

      it.each([
        { condition: '曲名が「a」の 101 文字のとき', songName: 'a'.repeat(101), chartName: CHART, subject: '曲名' },
        { condition: '譜面名が「a」の 101 文字のとき', songName: SONG, chartName: 'a'.repeat(101), subject: '譜面名' },
      ])(
        '$condition、「クラウドに保存」を押すと、ダイアログに「$subject」の問題と「。「プロジェクト情報」と「譜面設定」で入力してください」を続けた文言が表示される',
        async ({ songName, chartName, subject }) => {
          const app = await startSignedIn()
          await enterNames(app, songName, chartName)

          await openSaveDialog(app)

          expect(within(saveDialog()).getByText(new RegExp(`^${subject}.+${NAME_GUIDANCE}$`))).toBeInTheDocument()
        },
      )

      it.each([
        { condition: '曲名が空のとき', songName: '', chartName: CHART },
        { condition: '曲名が「a」の 101 文字のとき', songName: 'a'.repeat(101), chartName: CHART },
        { condition: '譜面名が空のとき', songName: SONG, chartName: '' },
        { condition: '譜面名が「a」の 101 文字のとき', songName: SONG, chartName: 'a'.repeat(101) },
      ])(
        '$condition、「クラウドに保存」を押すと、ダイアログの「保存する」は押せない状態になる',
        async ({ songName, chartName }) => {
          const app = await startSignedIn()
          await enterNames(app, songName, chartName)

          await openSaveDialog(app)

          expect(app.button('保存する')).toBeDisabled()
        },
      )

      it('曲名が空のためにダイアログの「保存する」が押せなかったあと、ダイアログを閉じて「プロジェクト情報」で曲名を「テスト曲」にして開き直すと、「保存する」は押せる状態になる', async () => {
        const app = await startSignedIn()
        await enterNames(app, '', CHART)
        await openSaveDialog(app)
        expect(app.button('保存する')).toBeDisabled()
        await closeSaveDialog(app)
        await enterNames(app, SONG, CHART)

        await openSaveDialog(app)

        expect(app.button('保存する')).toBeEnabled()
      })
    })
  })
})

describe('[クラウドに保存] 保存の途中', () => {
  describe('音源を読み込まず、曲名が「テスト曲」・譜面名が「譜面1」で、プロジェクトと譜面の書き込みが終わらないとき、「保存する」を押すと', () => {
    describe('正常系', () => {
      it('ダイアログに「保存中です」と表示される', async () => {
        const app = await startSignedIn()
        app.cloudFaults.pendOperation('firestore-write')
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)

        expect(within(saveDialog()).getByText('保存中です')).toBeInTheDocument()
      })

      it('ダイアログの「保存する」は押せない状態になる', async () => {
        const app = await startSignedIn()
        app.cloudFaults.pendOperation('firestore-write')
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)

        expect(app.button('保存する')).toBeDisabled()
      })

      it('書き込みが終わると、ダイアログに「曲「テスト曲」の譜面「譜面1」を保存しました」と表示される', async () => {
        const app = await startSignedIn()
        const pending = app.cloudFaults.pendOperation('firestore-write')
        await openSaveDialogWithNames(app, SONG, CHART)
        await pressSave(app)
        pending.forEach((operation) => operation.release())
        await app.settle()

        expect(within(saveDialog()).getByText(savedMessage(SONG, CHART))).toBeInTheDocument()
      })
    })
  })
})

describe('[クラウドに保存] 「保存する」の連続押下', () => {
  describe('タップノーツ 2 個を置いた譜面を、曲名「テスト曲」・譜面名「譜面1」で保存するとき、「保存する」を続けて 2 回押すと', () => {
    describe('正常系', () => {
      it('クラウドに保存されるプロジェクトは「テスト曲」の 1 件だけになる', async () => {
        const app = await startSignedIn()
        await app.loadChart(TWO_TAP_NOTES)
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)
        await pressSave(app)

        expect(await app.cloud.listProjects()).toEqual([SONG])
      })

      it('クラウドの曲「テスト曲」に保存される譜面は「譜面1」の 1 件だけになる', async () => {
        const app = await startSignedIn()
        await app.loadChart(TWO_TAP_NOTES)
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)
        await pressSave(app)

        expect(await app.cloud.listCharts(SONG)).toEqual([CHART])
      })

      it('クラウドに保存された譜面「譜面1」のノーツは 2 個になる', async () => {
        const app = await startSignedIn()
        await app.loadChart(TWO_TAP_NOTES)
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)
        await pressSave(app)

        expect((await app.cloud.readChart(SONG, CHART))?.notes).toHaveLength(2)
      })
    })
  })
})

describe('[クラウドに保存] 保存先の確認の失敗', () => {
  describe('曲名が「テスト曲」・譜面名が「譜面1」で、プロジェクトの読み取りが許可されていないとき、「保存する」を押すと', () => {
    describe('異常系', () => {
      it(`ダイアログに「${CHECK_FAILED}」と表示される`, async () => {
        const app = await startSignedIn()
        app.cloudFaults.denyOperation('firestore-read')
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)

        expect(within(saveDialog()).getByText(CHECK_FAILED)).toBeInTheDocument()
      })

      it('音源 song.ogg を読み込んでいても、クラウドの曲「テスト曲」に音源は保存されない', async () => {
        const app = await startSignedIn()
        app.cloudFaults.denyOperation('firestore-read')
        await app.files.chooseAudio(createAudioFile('song.ogg'))
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)

        expect(await app.cloud.listAudioFiles(SONG)).toEqual([])
      })
    })
  })
})

describe('[クラウドに保存] 音源の保存の失敗', () => {
  describe('音源 song.ogg を読み込み、曲名が「テスト曲」・譜面名が「譜面1」で、音源の書き込みが許可されていないとき、「保存する」を押すと', () => {
    describe('異常系', () => {
      it(`ダイアログに「${AUDIO_SAVE_FAILED}」と表示される`, async () => {
        const app = await startWithAudioLoaded()
        app.cloudFaults.denyOperation('storage-write')

        await pressSave(app)

        expect(within(saveDialog()).getByText(AUDIO_SAVE_FAILED)).toBeInTheDocument()
      })

      it(`音源の書き込みが想定外のエラー (storage/unknown、文言「テスト用の失敗」) で失敗するとき、ダイアログに「${AUDIO_UNEXPECTED_FAILED}」と表示される`, async () => {
        const app = await startWithAudioLoaded()
        app.cloudFaults.failOperation('storage-write', { code: 'storage/unknown', message: 'テスト用の失敗' })

        await pressSave(app)

        expect(within(saveDialog()).getByText(AUDIO_UNEXPECTED_FAILED)).toBeInTheDocument()
      })

      it('クラウドに曲「テスト曲」のプロジェクトは保存されない', async () => {
        const app = await startWithAudioLoaded()
        app.cloudFaults.denyOperation('storage-write')

        await pressSave(app)

        expect(await app.cloud.readProject(SONG)).toBeNull()
      })

      it.each([
        {
          cause: 'ログインが切れているとき',
          failure: { code: 'storage/unauthenticated' },
          reason: 'ログインが切れています。ログインし直してから、もう一度お試しください',
        },
        {
          cause: '通信がつながらないとき',
          failure: { code: 'storage/retry-limit-exceeded' },
          reason: '通信がつながりませんでした。ネットワークの接続を確認して、もう一度お試しください',
        },
        {
          cause: 'クラウドの保存容量が上限に達しているとき',
          failure: { code: 'storage/quota-exceeded' },
          reason: 'クラウドの保存容量の上限に達しています。しばらくしてから、もう一度お試しください',
        },
      ])(
        '$cause、ダイアログに、音源を保存できなかった理由として「$reason」が表示される',
        async ({ failure, reason }) => {
          const app = await startWithAudioLoaded()
          app.cloudFaults.failOperation('storage-write', failure)

          await pressSave(app)

          expect(
            within(saveDialog()).getByText(`音源「song.ogg」を保存できませんでした: ${reason}`),
          ).toBeInTheDocument()
        },
      )
    })
  })
})

describe('[クラウドに保存] プロジェクトと譜面の保存の失敗', () => {
  describe('曲名が「テスト曲」・譜面名が「譜面1」で、プロジェクトと譜面の書き込みが許可されていないとき、「保存する」を押すと', () => {
    describe('異常系', () => {
      it(`ダイアログに「${PROJECT_SAVE_FAILED}」と表示される`, async () => {
        const app = await startSignedIn()
        app.cloudFaults.denyOperation('firestore-write')
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)

        expect(within(saveDialog()).getByText(PROJECT_SAVE_FAILED)).toBeInTheDocument()
      })

      it(`プロジェクトと譜面の書き込みが想定外のエラー (internal、文言「テスト用の失敗」) で失敗するとき、ダイアログに「${PROJECT_UNEXPECTED_FAILED}」と表示される`, async () => {
        const app = await startSignedIn()
        app.cloudFaults.failOperation('firestore-write', { code: 'internal', message: 'テスト用の失敗' })
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)

        expect(within(saveDialog()).getByText(PROJECT_UNEXPECTED_FAILED)).toBeInTheDocument()
      })

      it('クラウドにプロジェクトは保存されない', async () => {
        const app = await startSignedIn()
        app.cloudFaults.denyOperation('firestore-write')
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)

        expect(await app.cloud.readProject(SONG)).toBeNull()
      })

      it('クラウドに譜面は保存されない', async () => {
        const app = await startSignedIn()
        app.cloudFaults.denyOperation('firestore-write')
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)

        expect(await app.cloud.readChart(SONG, CHART)).toBeNull()
      })

      it('クラウドに音源 song.mp3 が保存済みで、音源 song.ogg を読み込んでいるとき、クラウドの曲「テスト曲」の音源は、song.mp3 と song.ogg の 2 つになる', async () => {
        const app = await startWithAudioSavedOverOldAudio()
        app.cloudFaults.denyOperation('firestore-write')

        await pressSave(app)

        expect(await app.cloud.listAudioFiles(SONG)).toEqual(['song.mp3', 'song.ogg'])
      })

      it.each([
        {
          cause: '通信がつながらないとき',
          failure: { code: 'unavailable' },
          reason: '通信がつながりませんでした。ネットワークの接続を確認して、もう一度お試しください',
        },
        {
          cause: 'ほかの保存と重なったとき',
          failure: { code: 'aborted' },
          reason: '保存が、ほかの保存と重なりました。しばらくしてから、もう一度お試しください',
        },
      ])('$cause、ダイアログに、保存できなかった理由として「$reason」が表示される', async ({ failure, reason }) => {
        const app = await startSignedIn()
        app.cloudFaults.failOperation('firestore-write', failure)
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)

        expect(
          within(saveDialog()).getByText(`プロジェクトと譜面を保存できませんでした: ${reason}`),
        ).toBeInTheDocument()
      })
    })
  })

  describe('書き込みが許可されておらず保存に失敗したあと、書き込みが許可されたとき、「保存する」を押し直すと', () => {
    describe('異常系', () => {
      it(`ダイアログに「曲「テスト曲」の譜面「譜面1」を保存しました」と表示される`, async () => {
        const app = await startSignedIn()
        app.cloudFaults.denyOperation('firestore-write')
        await openSaveDialogWithNames(app, SONG, CHART)
        await pressSave(app)
        within(saveDialog()).getByText(PROJECT_SAVE_FAILED)
        app.cloudFaults.allowOperation('firestore-write')

        await pressSave(app)

        expect(within(saveDialog()).getByText(savedMessage(SONG, CHART))).toBeInTheDocument()
      })

      it('保存に失敗したときのメッセージは、ダイアログから消える', async () => {
        const app = await startSignedIn()
        app.cloudFaults.denyOperation('firestore-write')
        await openSaveDialogWithNames(app, SONG, CHART)
        await pressSave(app)
        within(saveDialog()).getByText(PROJECT_SAVE_FAILED)
        app.cloudFaults.allowOperation('firestore-write')

        await pressSave(app)

        expect(within(saveDialog()).queryByText(PROJECT_SAVE_FAILED)).toBeNull()
      })
    })
  })
})

describe('[クラウドに保存] 古い音源の確認・削除の失敗', () => {
  describe('クラウドに音源 song.mp3 が保存済みで、音源 song.ogg を読み込み、曲名と譜面名はクラウドから開いた値のとき', () => {
    describe('正常系', () => {
      it(`クラウドの音源の一覧の読み取りが許可されていないとき、「保存する」を押すと、ダイアログに「${AUDIO_LIST_FAILED}」と表示される`, async () => {
        const app = await startWithAudioSavedOverOldAudio()
        app.cloudFaults.denyOperation('storage-list')

        await pressSave(app)

        expect(within(saveDialog()).getByText(AUDIO_LIST_FAILED)).toBeInTheDocument()
      })

      it('クラウドの音源の一覧の読み取りが許可されていないとき、「保存する」を押すと、クラウドの曲「テスト曲」のプロジェクトの音源のファイル名は song.ogg になる', async () => {
        const app = await startWithAudioSavedOverOldAudio()
        app.cloudFaults.denyOperation('storage-list')

        await pressSave(app)

        expect(await app.cloud.readProject(SONG)).toMatchObject({ audioFileName: 'song.ogg' })
      })

      it(`song.mp3 の削除が許可されていないとき、「保存する」を押すと、ダイアログに「${AUDIO_DELETE_FAILED}」と表示される`, async () => {
        const app = await startWithAudioSavedOverOldAudio()
        app.cloudFaults.denyOperation('storage-delete', { fileName: 'song.mp3' })

        await pressSave(app)

        expect(within(saveDialog()).getByText(AUDIO_DELETE_FAILED)).toBeInTheDocument()
      })
    })
  })
})
