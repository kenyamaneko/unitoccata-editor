import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AppDriver } from '../../test/app.tsx'
import {
  closeSaveDialog,
  findSaveDialogText,
  openFromCloudWhenShown,
  openSaveDialog,
  openSaveDialogWithNames,
  pressSave,
  savedMessage,
  startSignedIn,
  waitForOpenDialogToClose,
} from '../../test/cloud-storage-1.helpers.ts'
import { createAudioBytes, createAudioFile } from '../../test/fakeAudio.ts'
import type { ChartFileNote } from '../../test/files.ts'

const SONG = 'テスト曲'
const CHART = '譜面1'
const SAVED = savedMessage(SONG, CHART)
const SAME_TITLE_CONFLICT =
  '同じ曲名のプロジェクトが、クラウドに既にあります。「クラウドから開く」で開くか、別の曲名にしてください'
const UPDATED_ELSEWHERE_CONFLICT =
  'このプロジェクトは、読み込んだあとに、ほかで更新されました。「クラウドから開く」で開き直してください'

const MAX_NOTE_COUNT = 3000
const NOTES_PER_STEP = 5

const mixedNotes: readonly ChartFileNote[] = [
  { type: 'tap', tick: 480, lane: 2 },
  { type: 'flick', tick: 960, lane: 1, dir: 'left' },
  {
    type: 'long',
    tick: 1920,
    lane: 0,
    path: [
      { tick: 2400, lane: 1 },
      { tick: 2880, lane: 1 },
    ],
    end: { flick: 'up' },
  },
]

const mixedNoteTexts = [
  'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2',
  '左フリックノーツ 1 小節目 2 拍目 レーン 1',
  'ロングノーツ 始点 1 小節目 3 拍目 レーン 0、続く点 1 小節目 3 拍目の 1/2 拍後 レーン 1、2 小節目 1 拍目 レーン 1、終端 上フリック',
]

function createTapNotes(count: number): ChartFileNote[] {
  return Array.from({ length: count }, (_, index) => ({
    type: 'tap',
    tick: Math.floor(index / NOTES_PER_STEP) * 480,
    lane: index % NOTES_PER_STEP,
  }))
}

async function saveAndWait(app: AppDriver, songName: string, chartName: string): Promise<void> {
  await pressSave(app)
  await findSaveDialogText(savedMessage(songName, chartName))
}

async function enterOffset(app: AppDriver, text: string): Promise<void> {
  await app.projectInfo.open()
  await app.projectInfo.enterOffset(text)
  await app.projectInfo.close()
}

async function startWithMixedChart(): Promise<AppDriver> {
  const app = await startSignedIn({ laneCount: 8 })
  await app.loadChart(mixedNotes, 8, {
    offsetMs: 120,
    tempo: [
      { tick: 0, bpm: 150 },
      { tick: 3840, bpm: 90 },
    ],
    meter: [{ tick: 0, num: 3, den: 4 }],
  })
  await app.projectInfo.open()
  await app.projectInfo.enterBarCount('60')
  await app.projectInfo.close()
  await openSaveDialogWithNames(app, SONG, CHART)
  return app
}

describe('[ログイン] ログインとログアウト', () => {
  describe('正常系', () => {
    it('ログインしているとき、ページを開くと、右のパネルに「ログアウト」が表示される', async () => {
      const app = await startSignedIn()

      expect(app.button('ログアウト')).toBeInTheDocument()
    })

    it('ログインしているとき、「ログアウト」を押すと、右のパネルに「ログイン」が表示される', async () => {
      const app = await startSignedIn()

      await app.click(app.button('ログアウト'))

      expect(await screen.findByText('ログイン')).toBeInTheDocument()
    })
  })
})

describe('[クラウドに保存] 保存した内容の読み直し', () => {
  describe('オフセット 120、テンポ BPM 150 と 2 小節目 2 拍目の BPM 90、拍子 3/4、小節数 60、レーン数 8 で、タップノーツ・左フリックノーツ・ロングノーツのある譜面を、曲名「テスト曲」・譜面名「譜面1」で保存したあと', () => {
    describe('正常系', () => {
      it('ダイアログに「曲「テスト曲」の譜面「譜面1」を保存しました」と表示される', async () => {
        const app = await startWithMixedChart()

        await pressSave(app)

        expect(await findSaveDialogText(SAVED)).toBeInTheDocument()
      })

      it.each([
        { field: '曲名', label: '「テスト曲」', key: 'title', value: SONG },
        { field: '音源のファイル名', label: 'なし', key: 'audioFileName', value: null },
        { field: 'オフセット', label: '120', key: 'offsetMs', value: 120 },
        { field: '小節数', label: '60', key: 'barCount', value: 60 },
        {
          field: 'テンポ',
          label: '1 小節目の BPM 150 と 2 小節目の BPM 90',
          key: 'tempo',
          value: [
            { tick: 0, bpm: 150 },
            { tick: 3840, bpm: 90 },
          ],
        },
        { field: '拍子', label: '1 小節目 1 拍目の 3/4 の 1 つ', key: 'meter', value: [{ tick: 0, num: 3, den: 4 }] },
      ])('クラウドのプロジェクトを読み直すと、「$field」は「$label」になる', async ({ key, value }) => {
        const app = await startWithMixedChart()
        await saveAndWait(app, SONG, CHART)

        expect(await app.cloud.readProject(SONG)).toMatchObject({ [key]: value })
      })

      it.each([
        { field: '譜面名', label: '「譜面1」', key: 'name', value: CHART },
        { field: 'レーン数', label: '8', key: 'laneCount', value: 8 },
        {
          field: 'ノーツ',
          label: 'タップノーツ・左フリックノーツ・ロングノーツの 3 つ',
          key: 'notes',
          value: [
            { tick: 480, lane: 2, type: 'tap' },
            { tick: 960, lane: 1, type: 'flick', dir: 'left' },
            {
              tick: 1920,
              lane: 0,
              type: 'long',
              path: [
                { tick: 2400, lane: 1 },
                { tick: 2880, lane: 1 },
              ],
              end: { flick: 'up' },
            },
          ],
        },
      ])('クラウドの譜面を読み直すと、「$field」は「$label」になる', async ({ key, value }) => {
        const app = await startWithMixedChart()
        await saveAndWait(app, SONG, CHART)

        expect(await app.cloud.readChart(SONG, CHART)).toMatchObject({ [key]: value })
      })

      it('保存したあと、別の譜面を読み込んでから「クラウドから開く」で曲「テスト曲」の譜面「譜面1」を開くと、ノーツの代替コンテンツは保存した 3 つのノーツになる', async () => {
        const app = await startWithMixedChart()
        await saveAndWait(app, SONG, CHART)
        await closeSaveDialog(app)
        await app.loadChart([{ type: 'tap', tick: 0, lane: 1 }], 8)

        await openFromCloudWhenShown(app, SONG, CHART)
        await waitForOpenDialogToClose(app)

        expect(app.timeline.notes()).toEqual(mixedNoteTexts)
      })
    })
  })

  describe('ノーツが 3000 個の譜面を保存したあと', () => {
    describe('正常系', () => {
      it('クラウドの譜面のノーツの数は 3000 個になる', async () => {
        const app = await startSignedIn()
        await app.loadChart(createTapNotes(MAX_NOTE_COUNT))
        await openSaveDialogWithNames(app, SONG, CHART)
        await saveAndWait(app, SONG, CHART)

        const chart = await app.cloud.readChart(SONG, CHART)

        expect(chart?.notes).toHaveLength(MAX_NOTE_COUNT)
      })
    })
  })
})

describe('[クラウドに保存] 続けて保存した譜面とプロジェクト', () => {
  describe('曲名「テスト曲」・譜面名「譜面1」で保存したあと', () => {
    describe('正常系', () => {
      it('オフセットを 200 にして「保存する」を押し直すと、ダイアログに「曲「テスト曲」の譜面「譜面1」を保存しました」と表示される', async () => {
        const app = await startSignedIn()
        await openSaveDialogWithNames(app, SONG, CHART)
        await saveAndWait(app, SONG, CHART)
        await closeSaveDialog(app)
        await enterOffset(app, '200')
        await openSaveDialog(app)

        await pressSave(app)

        expect(await findSaveDialogText(SAVED)).toBeInTheDocument()
      })

      it('オフセットを 200 にして「保存する」を押し直したあとで、クラウドのプロジェクトを読み直すと、オフセットは 200 になる', async () => {
        const app = await startSignedIn()
        await openSaveDialogWithNames(app, SONG, CHART)
        await saveAndWait(app, SONG, CHART)
        await closeSaveDialog(app)
        await enterOffset(app, '200')
        await openSaveDialog(app)
        await saveAndWait(app, SONG, CHART)

        expect(await app.cloud.readProject(SONG)).toMatchObject({ offsetMs: 200 })
      })

      it('譜面名を「譜面2」にして「保存する」を押したあとで、クラウドの曲「テスト曲」の譜面名を読むと、「譜面1」と「譜面2」の 2 つになる', async () => {
        const app = await startSignedIn()
        await openSaveDialogWithNames(app, SONG, CHART)
        await saveAndWait(app, SONG, CHART)
        await closeSaveDialog(app)
        await openSaveDialogWithNames(app, SONG, '譜面2')
        await saveAndWait(app, SONG, '譜面2')

        expect(await app.cloud.listCharts(SONG)).toEqual(['譜面1', '譜面2'])
      })

      it('曲名を「別の曲」にして「保存する」を押したあとで、クラウドの曲の一覧を読むと、「テスト曲」と「別の曲」の 2 つになる', async () => {
        const app = await startSignedIn()
        await openSaveDialogWithNames(app, SONG, CHART)
        await saveAndWait(app, SONG, CHART)
        await closeSaveDialog(app)
        await openSaveDialogWithNames(app, '別の曲', CHART)
        await saveAndWait(app, '別の曲', CHART)

        expect(await app.cloud.listProjects()).toEqual(['テスト曲', '別の曲'])
      })
    })
  })
})

describe('[クラウドに保存] 音源の保存と置き換え', () => {
  describe('音源 song.ogg を読み込み、曲名「テスト曲」・譜面名「譜面1」で「保存する」を押すと', () => {
    describe('正常系', () => {
      it('クラウドの曲「テスト曲」の音源は、song.ogg の 1 つになる', async () => {
        const app = await startSignedIn()
        await app.files.chooseAudio(createAudioFile('song.ogg'))
        await openSaveDialogWithNames(app, SONG, CHART)

        await saveAndWait(app, SONG, CHART)

        expect(await app.cloud.listAudioFiles(SONG)).toEqual(['song.ogg'])
      })

      it('クラウドの song.ogg を読み直すと、読み込んだ song.ogg と同じ内容になる', async () => {
        const app = await startSignedIn()
        const songFile = createAudioFile('song.ogg')
        const songBytes = new Uint8Array(await songFile.arrayBuffer())
        await app.files.chooseAudio(songFile)
        await openSaveDialogWithNames(app, SONG, CHART)

        await saveAndWait(app, SONG, CHART)

        expect(await app.cloud.readAudio(SONG, 'song.ogg')).toEqual(songBytes)
      })

      it('クラウドのプロジェクトを読み直すと、音源のファイル名は song.ogg になる', async () => {
        const app = await startSignedIn()
        await app.files.chooseAudio(createAudioFile('song.ogg'))
        await openSaveDialogWithNames(app, SONG, CHART)

        await saveAndWait(app, SONG, CHART)

        expect(await app.cloud.readProject(SONG)).toMatchObject({ audioFileName: 'song.ogg' })
      })
    })
  })

  describe('クラウドから曲「テスト曲」の譜面「譜面1」を開いたあと、音源 song.ogg を読み込んで「保存する」を押すと', () => {
    describe('正常系', () => {
      it.each([
        { condition: '保存済みの音源が song.mp3 だけのとき', savedFiles: ['song.mp3'] },
        { condition: '保存済みの音源が song.mp3 と song2.wav のとき', savedFiles: ['song.mp3', 'song2.wav'] },
      ])('$condition、クラウドの曲「テスト曲」の音源は、song.ogg の 1 つだけになる', async ({ savedFiles }) => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, audioFileName: 'song.mp3' })
        await app.cloud.putChart(SONG, { name: CHART })
        await Promise.all(savedFiles.map((fileName) => app.cloud.putAudio(SONG, fileName, createAudioBytes())))
        await openFromCloudWhenShown(app, SONG, CHART)
        await waitForOpenDialogToClose(app)
        await app.files.chooseAudio(createAudioFile('song.ogg'))
        await openSaveDialog(app)

        await saveAndWait(app, SONG, CHART)

        expect(await app.cloud.listAudioFiles(SONG)).toEqual(['song.ogg'])
      })

      it('保存済みの song.mp3 と内容が異なる song.mp3 を読み込んだとき、クラウドの song.mp3 を読み直すと、読み込んだ song.mp3 と同じ内容になる', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, audioFileName: 'song.mp3' })
        await app.cloud.putChart(SONG, { name: CHART })
        await app.cloud.putAudio(SONG, 'song.mp3', createAudioBytes({ durationSeconds: 5 }))
        await openFromCloudWhenShown(app, SONG, CHART)
        await waitForOpenDialogToClose(app)
        const songFile = createAudioFile('song.mp3', { durationSeconds: 20 })
        const songBytes = new Uint8Array(await songFile.arrayBuffer())
        await app.files.chooseAudio(songFile)
        await openSaveDialog(app)

        await saveAndWait(app, SONG, CHART)

        expect(await app.cloud.readAudio(SONG, 'song.mp3')).toEqual(songBytes)
      })
    })
  })

  describe('音源のファイル名がないプロジェクト「テスト曲」と、クラウドの音源 old.mp3 があり、プロジェクトを開いて「保存する」を押すと', () => {
    describe('正常系', () => {
      it('クラウドの曲「テスト曲」の音源は、old.mp3 のままになる', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, audioFileName: null })
        await app.cloud.putChart(SONG, { name: CHART })
        await app.cloud.putAudio(SONG, 'old.mp3', createAudioBytes())
        await openFromCloudWhenShown(app, SONG, CHART)
        await waitForOpenDialogToClose(app)
        await openSaveDialog(app)

        await saveAndWait(app, SONG, CHART)

        expect(await app.cloud.listAudioFiles(SONG)).toEqual(['old.mp3'])
      })
    })
  })
})

describe('[クラウドに保存] 同じ曲名のプロジェクトとの衝突', () => {
  describe('クラウドに曲「テスト曲」のオフセット 0 のプロジェクトが既にあり、このエディタで読み込んだことも保存したこともないとき、オフセットを 90 にして「保存する」を押すと', () => {
    describe('正常系', () => {
      it(`ダイアログに「${SAME_TITLE_CONFLICT}」と表示される`, async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, offsetMs: 0 })
        await enterOffset(app, '90')
        await openSaveDialogWithNames(app, SONG, CHART)

        await pressSave(app)

        expect(await findSaveDialogText(SAME_TITLE_CONFLICT)).toBeInTheDocument()
      })

      it('クラウドの曲「テスト曲」のオフセットは 0 のままになる', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, offsetMs: 0 })
        await enterOffset(app, '90')
        await openSaveDialogWithNames(app, SONG, CHART)
        await pressSave(app)
        await findSaveDialogText(SAME_TITLE_CONFLICT)

        expect(await app.cloud.readProject(SONG)).toMatchObject({ offsetMs: 0 })
      })

      it('音源 song.ogg を読み込んでいても、クラウドの曲「テスト曲」に音源は保存されない', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, offsetMs: 0 })
        await app.files.chooseAudio(createAudioFile('song.ogg'))
        await openSaveDialogWithNames(app, SONG, CHART)
        await pressSave(app)
        await findSaveDialogText(SAME_TITLE_CONFLICT)

        expect(await app.cloud.listAudioFiles(SONG)).toEqual([])
      })
    })
  })

  describe('クラウドから開いた曲「テスト曲」が、開いたあとにほかでオフセット 90 に更新されたとき、「譜面設定」でレーン数を 6 にして「保存する」を押すと', () => {
    describe('正常系', () => {
      it(`ダイアログに「${UPDATED_ELSEWHERE_CONFLICT}」と表示される`, async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, offsetMs: 0, updatedAt: 1000 })
        await app.cloud.putChart(SONG, { name: CHART })
        await openFromCloudWhenShown(app, SONG, CHART)
        await waitForOpenDialogToClose(app)
        await app.cloud.putProject({ title: SONG, offsetMs: 90, updatedAt: 2000 })
        await app.chartSettings.open()
        await app.chartSettings.increaseLaneCount()
        await app.chartSettings.close()
        await openSaveDialog(app)

        await pressSave(app)

        expect(await findSaveDialogText(UPDATED_ELSEWHERE_CONFLICT)).toBeInTheDocument()
      })

      it('クラウドの曲「テスト曲」の譜面「譜面1」のレーン数は 5 のままになる', async () => {
        const app = await startSignedIn()
        await app.cloud.putProject({ title: SONG, offsetMs: 0, updatedAt: 1000 })
        await app.cloud.putChart(SONG, { name: CHART })
        await openFromCloudWhenShown(app, SONG, CHART)
        await waitForOpenDialogToClose(app)
        await app.cloud.putProject({ title: SONG, offsetMs: 90, updatedAt: 2000 })
        await app.chartSettings.open()
        await app.chartSettings.increaseLaneCount()
        await app.chartSettings.close()
        await openSaveDialog(app)
        await pressSave(app)
        await findSaveDialogText(UPDATED_ELSEWHERE_CONFLICT)

        expect(await app.cloud.readChart(SONG, CHART)).toMatchObject({ laneCount: 5 })
      })
    })
  })
})
