import { within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  FIRESTORE_DENIED_REASON,
  STORAGE_DENIED_REASON,
  chooseInOpenDialog,
  openCloudDialog,
  openDialog,
  startSignedIn,
} from '../../test/cloud-storage-1.helpers.ts'
import type { AppDriver } from '../../test/app.tsx'
import { createAudioBytes } from '../../test/fakeAudio.ts'

const SONG = 'テスト曲'
const CHART = '譜面1'
const TAP_NOTES = [{ tick: 480, lane: 2, type: 'tap' }]
const TAP_NOTE_TEXT = 'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'
const OPEN_FAILED_BY_FIRESTORE = `開けませんでした: ${FIRESTORE_DENIED_REASON}`
const OPEN_FAILED_BY_STORAGE = `開けませんでした: ${STORAGE_DENIED_REASON}`

async function startWithSavedSong(): Promise<AppDriver> {
  const app = await startSignedIn()
  await app.cloud.putProject({ title: SONG })
  await app.cloud.putChart(SONG, { name: CHART, notes: TAP_NOTES })
  return app
}

async function startWithSavedSongWithAudio(): Promise<AppDriver> {
  const app = await startSignedIn()
  await app.cloud.putProject({ title: SONG, audioFileName: 'song.mp3' })
  await app.cloud.putChart(SONG, { name: CHART, notes: TAP_NOTES })
  await app.cloud.putAudio(SONG, 'song.mp3', createAudioBytes())
  return app
}

async function openSongChartList(app: AppDriver): Promise<void> {
  await openCloudDialog(app)
  await chooseInOpenDialog(app, SONG)
}

describe('[クラウドから開く] 曲の一覧の読み込みの失敗', () => {
  describe('保存した曲「テスト曲」があり、プロジェクトの一覧の読み取りが許可されていないとき、「クラウドから開く」を押すと', () => {
    describe('異常系', () => {
      it(`ダイアログに「曲の一覧を読み込めませんでした: ${FIRESTORE_DENIED_REASON}」と表示される`, async () => {
        const app = await startWithSavedSong()
        app.cloudFaults.denyOperation('firestore-list')

        await openCloudDialog(app)

        expect(
          within(openDialog()).getByText(`曲の一覧を読み込めませんでした: ${FIRESTORE_DENIED_REASON}`),
        ).toBeInTheDocument()
      })

      it('ダイアログに「もう一度読み込む」が表示される', async () => {
        const app = await startWithSavedSong()
        app.cloudFaults.denyOperation('firestore-list')

        await openCloudDialog(app)

        expect(within(openDialog()).getByRole('button', { name: 'もう一度読み込む' })).toBeInTheDocument()
      })
    })
  })

  describe('読み取りが許可されず曲の一覧を読み込めなかったあと、読み取りが許可されたとき、「もう一度読み込む」を押すと', () => {
    describe('異常系', () => {
      it('ダイアログの曲名のボタンに「テスト曲」が表示される', async () => {
        const app = await startWithSavedSong()
        app.cloudFaults.denyOperation('firestore-list')
        await openCloudDialog(app)
        app.cloudFaults.allowOperation('firestore-list')

        await app.click(within(openDialog()).getByRole('button', { name: 'もう一度読み込む' }))

        expect(within(openDialog()).getByRole('button', { name: SONG })).toBeInTheDocument()
      })

      it('ダイアログから、曲の一覧を読み込めなかったときのメッセージが消える', async () => {
        const app = await startWithSavedSong()
        app.cloudFaults.denyOperation('firestore-list')
        await openCloudDialog(app)
        app.cloudFaults.allowOperation('firestore-list')

        await app.click(within(openDialog()).getByRole('button', { name: 'もう一度読み込む' }))

        expect(
          within(openDialog()).queryByText(`曲の一覧を読み込めませんでした: ${FIRESTORE_DENIED_REASON}`),
        ).toBeNull()
      })
    })
  })
})

describe('[クラウドから開く] 譜面の一覧の読み込みの失敗', () => {
  describe('保存した曲「テスト曲」があり、その譜面の一覧の読み取りが許可されていないとき、曲名のボタン「テスト曲」を選ぶと', () => {
    describe('異常系', () => {
      it(`ダイアログに「譜面の一覧を読み込めませんでした: ${FIRESTORE_DENIED_REASON}」と表示される`, async () => {
        const app = await startWithSavedSong()
        app.cloudFaults.denyOperation('firestore-list', { songName: SONG })

        await openSongChartList(app)

        expect(
          within(openDialog()).getByText(`譜面の一覧を読み込めませんでした: ${FIRESTORE_DENIED_REASON}`),
        ).toBeInTheDocument()
      })
    })
  })
})

describe('[クラウドから開く] 譜面の読み込みの失敗', () => {
  describe('曲「テスト曲」の譜面「譜面1」の一覧を表示したとき、譜面名のボタン「譜面1」を選ぶと', () => {
    describe('異常系', () => {
      it(`プロジェクトの読み取りが許可されていなければ、ダイアログに「${OPEN_FAILED_BY_FIRESTORE}」と表示される`, async () => {
        const app = await startWithSavedSong()
        await openSongChartList(app)
        app.cloudFaults.denyOperation('firestore-read', { songName: SONG })

        await chooseInOpenDialog(app, CHART)

        expect(within(openDialog()).getByText(OPEN_FAILED_BY_FIRESTORE)).toBeInTheDocument()
      })

      it(`譜面の読み取りが許可されていなければ、ダイアログに「${OPEN_FAILED_BY_FIRESTORE}」と表示される`, async () => {
        const app = await startWithSavedSong()
        await openSongChartList(app)
        app.cloudFaults.denyOperation('firestore-read', { songName: SONG, chartName: CHART })

        await chooseInOpenDialog(app, CHART)

        expect(within(openDialog()).getByText(OPEN_FAILED_BY_FIRESTORE)).toBeInTheDocument()
      })

      it(`音源の読み取りが許可されていなければ、ダイアログに「${OPEN_FAILED_BY_STORAGE}」と表示される`, async () => {
        const app = await startWithSavedSongWithAudio()
        await openSongChartList(app)
        app.cloudFaults.denyOperation('storage-read', { songName: SONG, fileName: 'song.mp3' })

        await chooseInOpenDialog(app, CHART)

        expect(within(openDialog()).getByText(OPEN_FAILED_BY_STORAGE)).toBeInTheDocument()
      })

      it('「タップノーツ 1 小節目 1 拍目 レーン 1」の譜面を読み込み済みで、音源の読み取りが許可されていないとき、譜面名のボタン「譜面1」を選んで開けなくても、ノーツの代替コンテンツは「タップノーツ 1 小節目 1 拍目 レーン 1」のままになる', async () => {
        const app = await startWithSavedSongWithAudio()
        await app.loadChart([{ type: 'tap', tick: 0, lane: 1 }])
        await openSongChartList(app)
        app.cloudFaults.denyOperation('storage-read', { songName: SONG, fileName: 'song.mp3' })

        await chooseInOpenDialog(app, CHART)

        expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目 レーン 1'])
      })
    })
  })

  describe('音源の読み取りが許可されず開けなかったあと、読み取りが許可されたとき、譜面名のボタン「譜面1」を選び直すと', () => {
    describe('異常系', () => {
      it(`ダイアログが閉じて、タイムラインのノーツの代替コンテンツに「${TAP_NOTE_TEXT}」が出る`, async () => {
        const app = await startWithSavedSongWithAudio()
        await openSongChartList(app)
        app.cloudFaults.denyOperation('storage-read', { songName: SONG, fileName: 'song.mp3' })
        await chooseInOpenDialog(app, CHART)
        within(openDialog()).getByText(OPEN_FAILED_BY_STORAGE)
        app.cloudFaults.allowOperation('storage-read')

        await chooseInOpenDialog(app, CHART)

        expect(app.dialog('クラウドから開く')).toBeNull()
        expect(app.timeline.notes()).toEqual([TAP_NOTE_TEXT])
      })
    })
  })
})
