import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AppDriver } from '../../test/app.tsx'
import {
  chooseInOpenDialogWhenShown,
  findInOpenDialog,
  findOpenDialogText,
  openCloudDialog,
  openFromCloudWhenShown,
  startSignedIn,
  waitForOpenDialogToClose,
} from '../../test/cloud-storage-1.helpers.ts'
import { createAudioBytes, createAudioFile } from '../../test/fakeAudio.ts'

const SONG = 'テスト曲'
const CHART = '譜面1'
const TAP_NOTES = [{ tick: 480, lane: 2, type: 'tap' }]
const TAP_NOTE_TEXT = 'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'
const MAX_NOTE_COUNT = 3000
const NOTES_PER_STEP = 5

const SIZE_LIMIT_MESSAGE =
  '開けませんでした: 音源の大きさは 50 MB までです (選んだファイルは 50.0 MB)。50 MB 以下のファイルを選んでください'
const UNDECODABLE_AUDIO_MESSAGE =
  '開けませんでした: 音源として読めません。ファイルが壊れていないか確認するか、mp3、ogg のいずれかの別のファイルを選んでください'
const BAR_COUNT_MESSAGE = '開けませんでした: 小節数は 1 以上 1000 以下の整数にしてください'
const PROJECT_NOT_FOUND_MESSAGE = '開けませんでした: プロジェクトが見つかりません。曲の一覧を開き直してください'
const AUDIO_NOT_FOUND_MESSAGE = '開けませんでした: ファイルが見つかりません。曲の一覧を開き直してください'

function createTapNotes(count: number): unknown[] {
  return Array.from({ length: count }, (_, index) => ({
    tick: Math.floor(index / NOTES_PER_STEP) * 480,
    lane: index % NOTES_PER_STEP,
    type: 'tap',
  }))
}

async function startWithSong(): Promise<AppDriver> {
  const app = await startSignedIn()
  await app.cloud.putProject({ title: SONG })
  await app.cloud.putChart(SONG, { name: CHART, notes: TAP_NOTES })
  return app
}

async function openChartList(app: AppDriver): Promise<void> {
  await openCloudDialog(app)
  await chooseInOpenDialogWhenShown(app, SONG)
}

async function readListItemNames(): Promise<string[]> {
  return within(await screen.findByRole('dialog', { name: 'クラウドから開く' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

describe('[クラウドから開く] 曲の一覧', () => {
  describe('「ファイル」メニューの「クラウドから開く」の押下', () => {
    describe('正常系', () => {
      it('保存した曲がないとき、ダイアログに「保存した曲がありません」と表示される', async () => {
        const app = await startSignedIn()

        await openCloudDialog(app)

        expect(await findOpenDialogText('保存した曲がありません')).toBeInTheDocument()
      })

      it('更新時刻が 1000 の曲「古い曲」、3000 の曲「新しい曲」、2000 の曲「中間の曲」があるとき、曲名のボタンは「新しい曲」「中間の曲」「古い曲」の順に並ぶ', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: '古い曲', updatedAt: 1000 })
        await app.cloud.putProject({ title: '新しい曲', updatedAt: 3000 })
        await app.cloud.putProject({ title: '中間の曲', updatedAt: 2000 })

        await openCloudDialog(app)

        await findInOpenDialog('button', '古い曲')
        expect(await readListItemNames()).toEqual(['新しい曲', '中間の曲', '古い曲'])
      })
    })
  })

  describe('曲名のボタン「テスト曲」の選択', () => {
    describe('正常系', () => {
      it('曲「テスト曲」に譜面「譜面B」と「譜面A」があるとき、譜面名のボタンは「譜面A」「譜面B」の順に並ぶ', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG })
        await app.cloud.putChart(SONG, { name: '譜面B' })
        await app.cloud.putChart(SONG, { name: '譜面A' })

        await openChartList(app)

        await findInOpenDialog('button', '譜面B')
        expect(await readListItemNames()).toEqual(['譜面A', '譜面B'])
      })

      it('曲「テスト曲」に譜面がないとき、ダイアログに「この曲には譜面がありません」と表示される', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG })

        await openChartList(app)

        expect(await findOpenDialogText('この曲には譜面がありません')).toBeInTheDocument()
      })

      it('譜面の一覧を表示したあと、「曲の一覧に戻る」を押すと、曲名のボタン「テスト曲」が表示される', async () => {
        const app = await startWithSong()
        await openChartList(app)
        await findInOpenDialog('button', CHART)

        await chooseInOpenDialogWhenShown(app, '曲の一覧に戻る')

        expect(await findInOpenDialog('button', SONG)).toBeInTheDocument()
      })
    })
  })
})

describe('[クラウドから開く] 譜面を開いたあとの画面', () => {
  describe('曲「テスト曲」の音源 song.mp3、オフセット 120、小節数 60、テンポ BPM 150、拍子 3/4 と、譜面「譜面1」のレーン数 8、タップノーツ 1 つを保存してあるとき、譜面名のボタン「譜面1」を選ぶと', () => {
    async function openSavedChart(): Promise<AppDriver> {
      const app = await startSignedIn()
      await app.cloud.putProject({
        title: SONG,
        audioFileName: 'song.mp3',
        offsetMs: 120,
        barCount: 60,
        tempo: [{ tick: 0, bpm: 150 }],
        meter: [{ tick: 0, num: 3, den: 4 }],
      })
      await app.cloud.putChart(SONG, { name: CHART, laneCount: 8, notes: TAP_NOTES })
      await app.cloud.putAudio(SONG, 'song.mp3', createAudioBytes())
      await openFromCloudWhenShown(app, SONG, CHART)
      await waitForOpenDialogToClose(app)
      return app
    }

    describe('正常系', () => {
      it(`タイムラインのノーツの代替コンテンツは「${TAP_NOTE_TEXT}」の 1 つになる`, async () => {
        const app = await openSavedChart()

        expect(app.timeline.notes()).toEqual([TAP_NOTE_TEXT])
      })

      it('タイムラインのテンポの代替コンテンツは「1 小節目 1 拍目 BPM 150」の 1 つになる', async () => {
        const app = await openSavedChart()

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
      })

      it('タイムラインの拍子の代替コンテンツは「1 小節目 1 拍目 3/4」の 1 つになる', async () => {
        const app = await openSavedChart()

        expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4'])
      })

      it('右のパネルの音源の名前は「song.mp3」になる', async () => {
        const app = await openSavedChart()

        expect(app.text('song.mp3')).toBeInTheDocument()
      })

      it('「プロジェクト情報」ダイアログの曲名は「テスト曲」になる', async () => {
        const app = await openSavedChart()
        await app.projectInfo.open()

        expect(app.projectInfo.songNameInput()).toHaveValue(SONG)
      })

      it('「プロジェクト情報」ダイアログのオフセットは 120 になる', async () => {
        const app = await openSavedChart()
        await app.projectInfo.open()

        expect(app.projectInfo.offsetInput()).toHaveValue(120)
      })

      it('「プロジェクト情報」ダイアログの小節数は 60 になる', async () => {
        const app = await openSavedChart()
        await app.projectInfo.open()

        expect(app.projectInfo.barCountInput()).toHaveValue(60)
      })

      it('「譜面設定」ダイアログの譜面名は「譜面1」になる', async () => {
        const app = await openSavedChart()
        await app.chartSettings.open()

        expect(app.chartSettings.chartNameInput()).toHaveValue(CHART)
      })

      it('「譜面設定」ダイアログのレーン数は 8 になる', async () => {
        const app = await openSavedChart()
        await app.chartSettings.open()

        expect(app.chartSettings.laneCount()).toBe(8)
      })
    })
  })

  describe('音源 song.ogg を読み込んであり、音源のファイル名がないプロジェクト「テスト曲」の譜面「譜面1」を開くと', () => {
    describe('正常系', () => {
      it('右のパネルの音源の名前は「song.ogg」のままになる', async () => {
        const app = await startWithSong()
        await app.files.chooseAudio(createAudioFile('song.ogg'))

        await openFromCloudWhenShown(app, SONG, CHART)
        await waitForOpenDialogToClose(app)

        expect(app.text('song.ogg')).toBeInTheDocument()
      })
    })
  })

  describe('ノーツが 3000 個の譜面「譜面1」を開くと', () => {
    describe('正常系', () => {
      it('タイムラインのノーツの代替コンテンツは 3000 個の項目になる', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG })
        await app.cloud.putChart(SONG, { name: CHART, notes: createTapNotes(MAX_NOTE_COUNT) })

        await openFromCloudWhenShown(app, SONG, CHART)
        await waitForOpenDialogToClose(app)

        expect(app.timeline.notes()).toHaveLength(MAX_NOTE_COUNT)
      })
    })
  })
})

describe('[クラウドから開く] 開けない譜面', () => {
  describe('譜面名のボタン「譜面1」の選択', () => {
    describe('異常系', () => {
      it.each([
        { condition: 'プロジェクトの小節数が 0のとき', barCount: 0 },
        { condition: 'プロジェクトの小節数が 1001のとき', barCount: 1001 },
      ])(
        '$condition、ダイアログに「開けませんでした: 小節数は 1 以上 1000 以下の整数にしてください」と表示される',
        async ({ barCount }) => {
          const app = await startSignedIn()
          await app.cloud.putProject({ title: SONG, barCount })
          await app.cloud.putChart(SONG, { name: CHART })
          await openChartList(app)

          await chooseInOpenDialogWhenShown(app, CHART)

          expect(await findOpenDialogText(BAR_COUNT_MESSAGE)).toBeInTheDocument()
        },
      )

      it('プロジェクトの最初のテンポが BPM 500 のとき、ダイアログに「開けませんでした: 譜面「譜面1」: 1 つ目のテンポ変化点の BPM は 20 以上 300 以下にしてください」と表示される', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, tempo: [{ tick: 0, bpm: 500 }] })
        await app.cloud.putChart(SONG, { name: CHART })
        await openChartList(app)

        await chooseInOpenDialogWhenShown(app, CHART)

        expect(
          await findOpenDialogText(
            '開けませんでした: 譜面「譜面1」: 1 つ目のテンポ変化点の BPM は 20 以上 300 以下にしてください',
          ),
        ).toBeInTheDocument()
      })

      it('譜面のノーツが 3001 個のとき、ダイアログに「開けませんでした: 譜面「譜面1」: ノーツは 3000 個までです (このファイルは 3001 個です)」と表示される', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG })
        await app.cloud.putChart(SONG, { name: CHART, notes: createTapNotes(MAX_NOTE_COUNT + 1) })
        await openChartList(app)

        await chooseInOpenDialogWhenShown(app, CHART)

        expect(
          await findOpenDialogText(
            '開けませんでした: 譜面「譜面1」: ノーツは 3000 個までです (このファイルは 3001 個です)',
          ),
        ).toBeInTheDocument()
      })

      it('一覧に表示したプロジェクトが削除されたとき、ダイアログに「開けませんでした: プロジェクトが見つかりません。曲の一覧を開き直してください」と表示される', async () => {
        const app = await startWithSong()
        await openChartList(app)
        await findInOpenDialog('button', CHART)
        await app.cloud.removeProject(SONG)

        await chooseInOpenDialogWhenShown(app, CHART)

        expect(await findOpenDialogText(PROJECT_NOT_FOUND_MESSAGE)).toBeInTheDocument()
      })

      it('音源のファイル名が song.mp3 でクラウドに song.mp3 がないとき、ダイアログに「開けませんでした: ファイルが見つかりません。曲の一覧を開き直してください」と表示される', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, audioFileName: 'song.mp3' })
        await app.cloud.putChart(SONG, { name: CHART })
        await openChartList(app)

        await chooseInOpenDialogWhenShown(app, CHART)

        expect(await findOpenDialogText(AUDIO_NOT_FOUND_MESSAGE)).toBeInTheDocument()
      })

      it(`音源 song.mp3 の内容が 3 バイト (1、2、3) のとき、ダイアログに「${UNDECODABLE_AUDIO_MESSAGE}」と表示される`, async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, audioFileName: 'song.mp3' })
        await app.cloud.putChart(SONG, { name: CHART })
        await app.cloud.putAudio(SONG, 'song.mp3', Uint8Array.of(1, 2, 3))
        await openChartList(app)

        await chooseInOpenDialogWhenShown(app, CHART)

        expect(await findOpenDialogText(UNDECODABLE_AUDIO_MESSAGE)).toBeInTheDocument()
      })

      it(`音源 big.ogg の大きさが 52428801 バイトのとき、ダイアログに「${SIZE_LIMIT_MESSAGE}」と表示される`, async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, audioFileName: 'big.ogg' })
        await app.cloud.putChart(SONG, { name: CHART })
        await app.cloud.putAudio(SONG, 'big.ogg', new Uint8Array(52428801))
        await openChartList(app)

        await chooseInOpenDialogWhenShown(app, CHART)

        expect(await findOpenDialogText(SIZE_LIMIT_MESSAGE)).toBeInTheDocument()
      })
    })
  })
})
