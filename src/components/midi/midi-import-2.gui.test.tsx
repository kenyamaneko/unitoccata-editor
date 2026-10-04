import { describe, expect, it } from 'vitest'
import { startApp, type AppDriver, type StartAppOptions } from '../../test/app.tsx'
import { createFile, createMidiFile, createUnreadableFile, type MidiNoteSpec } from '../../test/files.ts'

const createNotesMidiFile = (notes: readonly MidiNoteSpec[], fileName = 'notes.mid'): File =>
  createMidiFile(fileName, { ticksPerQuarter: 480, notes })

const createPlainMidiFile = (): File =>
  createNotesMidiFile([{ tick: 480, pitch: 'C3', velocity: 80, durationTicks: 120 }], 'plain.mid')

const createMixedMidiFile = (): File =>
  createNotesMidiFile([
    { tick: 0, pitch: 'C3', velocity: 80, durationTicks: 120 },
    { tick: 480, pitch: 'C#3', velocity: 35, durationTicks: 480 },
    { tick: 960, pitch: 'D3', velocity: 15, durationTicks: 120 },
  ])

const createTempoAndMeterMidiFile = (): File =>
  createMidiFile('tempo-and-meter.mid', {
    ticksPerQuarter: 480,
    tempos: [{ tick: 0, microsecondsPerQuarter: 468750 }],
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
  })

const createSingleTapMidiFile = (tick: number): File =>
  createNotesMidiFile([{ tick, pitch: 'C3', velocity: 80, durationTicks: 120 }])

const createSongWav = (): File => createFile('song.wav', 'RIFF0000WAVEfmt ')
const createZeroResolutionMidi = (): File => createMidiFile('zero.mid', { ticksPerQuarter: 0 })
const createMeterMidiFile = (fileName: string, numerator: number, denominator: number): File =>
  createMidiFile(fileName, {
    ticksPerQuarter: 480,
    timeSignatures: [{ tick: 0, numerator, denominator }],
  })
const createResolutionMidi = (fileName: string, ticksPerQuarter: number): File =>
  createMidiFile(fileName, { ticksPerQuarter })
const createTempoMidi = (fileName: string, microsecondsPerQuarter: number): File =>
  createMidiFile(fileName, { ticksPerQuarter: 480, tempos: [{ tick: 0, microsecondsPerQuarter }] })
const createUnreadableMidi = (): File => createUnreadableFile('unreadable.mid')

const openDialogWith = async (file: File, options: StartAppOptions = {}): Promise<AppDriver> => {
  const app = await startApp(options)
  await app.files.chooseMidi(file)
  return app
}

const openConfirmedDialog = async (file: File = createPlainMidiFile()): Promise<AppDriver> => {
  const app = await openDialogWith(file)
  await app.midiDialog.confirm()
  expect(app.midiDialog.summary(), '「確認する」を押しても、確認の結果が出ていません').not.toBeNull()
  expect(
    app.midiDialog.importButton(),
    '「確認する」を押しても、「取り込む」が押せる状態になっていません',
  ).toBeEnabled()
  return app
}

const importMidi = async (app: AppDriver): Promise<void> => {
  await app.midiDialog.confirm()
  await app.midiDialog.importNotes()
  expect(app.midiDialog.dialog(), '「取り込む」を押しても、ダイアログが閉じていません').toBeNull()
}

const readOffsetAfterImport = async (app: AppDriver): Promise<HTMLElement> => {
  await importMidi(app)
  await app.projectInfo.open()
  return app.projectInfo.offsetInput()
}

const TAP_ROW = 'タップノーツ'
const UP_FLICK_ROW = '上フリックノーツ'
const LEFT_FLICK_ROW = '左フリックノーツ'
const NOTE_PRESENT_NOTICE = '譜面にノーツがあるため、MIDI のテンポと拍子は取り込みません。'
const MIXED_NOTES_GIVEN = 'C3・ベロシティ 80、C#3・ベロシティ 35・長さ 480、D3・ベロシティ 15 のノートがある'
const MIXED_NOTES_AT_TICKS_GIVEN =
  'MIDI の tick 0 の C3・ベロシティ 80、tick 480 の C#3・ベロシティ 35・長さ 480、tick 960 の D3・ベロシティ 15 のノートがある'

type Operate = (app: AppDriver) => Promise<void>

const leaveAsIs: Operate = async () => {}
const enterPitch =
  (lane: number, text: string): Operate =>
  (app) =>
    app.midiDialog.setPitch(lane, text)
const enterVelocity =
  (rowName: string, edge: 'min' | 'max', text: string): Operate =>
  (app) =>
    app.midiDialog.setVelocity(rowName, edge, text)

const startWithOffset = async (): Promise<AppDriver> => {
  const app = await startApp()
  await app.loadChart([], undefined, { offsetMs: 120 })
  await app.files.chooseMidi(createTempoAndMeterMidiFile())
  return app
}

const startWithOffsetAndNote = async (): Promise<AppDriver> => {
  const app = await startApp()
  await app.loadChart([{ type: 'tap', tick: 480, lane: 1 }], undefined, { offsetMs: 120 })
  await app.files.chooseMidi(createTempoAndMeterMidiFile())
  return app
}

const startWithNoteAndProjectInfo = async (): Promise<AppDriver> => {
  const app = await startApp()
  await app.loadChart([{ type: 'tap', tick: 480, lane: 1 }], undefined, {
    tempo: [{ tick: 0, bpm: 150 }],
    meter: [{ tick: 0, num: 5, den: 8 }],
  })
  await app.files.chooseMidi(createTempoAndMeterMidiFile())
  return app
}

const createLeftFlickMidiFile = (): File =>
  createNotesMidiFile([{ tick: 480, pitch: 'C3', velocity: 1, durationTicks: 120 }])

const createZeroLengthLongMidiFile = (): File =>
  createNotesMidiFile([{ tick: 480, pitch: 'C3', velocity: 35, durationTicks: 0 }])

const createOverlappingMidiFile = (): File =>
  createNotesMidiFile([
    { tick: 480, pitch: 'C3', velocity: 80, durationTicks: 120, track: 1 },
    { tick: 480, pitch: 'C3', velocity: 15, durationTicks: 120, track: 2 },
  ])

describe('[MIDI 取り込み] 取り込みダイアログの表示', () => {
  describe('「ファイル」メニューの「インポート」の「MIDI」でのファイルの選択', () => {
    describe('正常系', () => {
      it.each([
        ['拍子が MIDI の tick 0 で 1/4 だけの num1.mid のとき', (): File => createMeterMidiFile('num1.mid', 1, 4)],
        ['拍子が MIDI の tick 0 で 99/4 だけの num99.mid のとき', (): File => createMeterMidiFile('num99.mid', 99, 4)],
      ])('%s、「MIDI を取り込む」ダイアログが表示され、「音程とレーンの対応」が出る', async (_label, file) => {
        const app = await openDialogWith(file())

        expect(app.midiDialog.text('音程とレーンの対応')).toBeInTheDocument()
      })

      it('レーン数が 5 のとき、MIDI ファイルを選ぶと、ダイアログの「音程とレーンの対応」に、レーン 0 に対応する音程が C3、レーン 1 が C#3、レーン 2 が D3、レーン 3 が D#3、レーン 4 が E3 で表示される', async () => {
        const app = await openDialogWith(createPlainMidiFile(), { laneCount: 5 })

        expect([0, 1, 2, 3, 4].map((lane) => (app.midiDialog.pitchInput(lane) as HTMLInputElement).value)).toEqual([
          'C3',
          'C#3',
          'D3',
          'D#3',
          'E3',
        ])
      })

      it('レーン数が 16 のとき、MIDI ファイルを選ぶと、ダイアログの「音程とレーンの対応」に、レーン 0 からレーン 15 までに対応する音程の入力欄が 16 個表示される', async () => {
        const app = await openDialogWith(createPlainMidiFile(), { laneCount: 16 })

        expect(app.midiDialog.pitchInputCount()).toBe(16)
      })
    })

    describe('異常系', () => {
      it('拍子が MIDI の tick 0 で 4/32 だけの den32.mid のとき、「インポート」の「MIDI」で選んでも、取り込めないため、「MIDI を取り込む」ダイアログは開かない', async () => {
        const app = await openDialogWith(createMeterMidiFile('den32.mid', 4, 32))

        expect(app.midiDialog.dialog()).toBeNull()
      })
    })
  })
})

describe('[MIDI 取り込み] ノーツがある譜面でのテンポと拍子の取り込みの注意', () => {
  describe('「ファイル」メニューの「インポート」の「MIDI」でのファイルの選択', () => {
    describe('正常系', () => {
      it('譜面が空のとき、MIDI ファイルを選ぶと、ダイアログに「譜面にノーツがあるため、MIDI のテンポと拍子は取り込みません。」と表示されない', async () => {
        const app = await openDialogWith(createPlainMidiFile())

        expect(app.midiDialog.text(NOTE_PRESENT_NOTICE)).toBeNull()
      })

      it('譜面にノーツがあるとき、MIDI ファイルを選ぶと、ダイアログに「譜面にノーツがあるため、MIDI のテンポと拍子は取り込みません。」と表示される', async () => {
        const app = await startApp()
        await app.loadChart([{ type: 'tap', tick: 480, lane: 1 }])

        await app.files.chooseMidi(createPlainMidiFile())

        expect(app.midiDialog.text(NOTE_PRESENT_NOTICE)).toBeInTheDocument()
      })
    })
  })
})

describe('[MIDI 取り込み] 取り込めない MIDI ファイルの通知', () => {
  describe('「ファイル」メニューの「インポート」の「MIDI」でのファイルの選択', () => {
    describe('異常系', () => {
      it.each([
        [
          'MIDI ファイルとして読めない song.wav のとき',
          'song.wav を取り込めませんでした: MIDI ファイルとして読めません。拡張子が .mid または .midi の Standard MIDI File を選んでください',
          createSongWav,
        ],
        [
          '時間分解能が 0 の zero.mid のとき',
          'zero.mid を取り込めませんでした: MIDI の時間分解能が 960 の約数ではないため取り込めません: 0。分解能を 960 の約数 (96、192、240、480、960 など) にしてから、もう一度選んでください',
          createZeroResolutionMidi,
        ],
        [
          '時間分解能が 1920 の res1920.mid のとき',
          'res1920.mid を取り込めませんでした: MIDI の時間分解能が 960 の約数ではないため取り込めません: 1920。分解能を 960 の約数 (96、192、240、480、960 など) にしてから、もう一度選んでください',
          (): File => createResolutionMidi('res1920.mid', 1920),
        ],
        [
          '拍子が MIDI の tick 0 で 4/32 だけの den32.mid のとき',
          'den32.mid を取り込めませんでした: MIDI の拍子 4/32 は取り込めません。拍子の分母を 2、4、8、16 のいずれかにしてから、もう一度選んでください',
          (): File => createMeterMidiFile('den32.mid', 4, 32),
        ],
        [
          '拍子 4/1 を含む den1.mid のとき',
          'den1.mid を取り込めませんでした: MIDI の拍子 4/1 は取り込めません。拍子の分母を 2、4、8、16 のいずれかにしてから、もう一度選んでください',
          (): File => createMeterMidiFile('den1.mid', 4, 1),
        ],
        [
          '拍子が MIDI の tick 0 で 0/4 だけの num0.mid のとき',
          'num0.mid を取り込めませんでした: MIDI の拍子 0/4 は取り込めません。拍子の分子を 1 以上 99 以下にしてから、もう一度選んでください',
          (): File => createMeterMidiFile('num0.mid', 0, 4),
        ],
        [
          '拍子が MIDI の tick 0 で 100/4 だけの num100.mid のとき',
          'num100.mid を取り込めませんでした: MIDI の拍子 100/4 は取り込めません。拍子の分子を 1 以上 99 以下にしてから、もう一度選んでください',
          (): File => createMeterMidiFile('num100.mid', 100, 4),
        ],
        [
          'テンポが 199999 マイクロ秒の tempo-fast.mid のとき',
          'tempo-fast.mid を取り込めませんでした: MIDI のテンポ (4 分音符 1 つあたりのマイクロ秒) が 200000 以上 3000000 以下ではないため取り込めません: 199999。テンポを BPM 20 以上 300 以下にしてから、もう一度選んでください',
          (): File => createTempoMidi('tempo-fast.mid', 199999),
        ],
        [
          'テンポが 3000001 マイクロ秒の tempo-slow.mid のとき',
          'tempo-slow.mid を取り込めませんでした: MIDI のテンポ (4 分音符 1 つあたりのマイクロ秒) が 200000 以上 3000000 以下ではないため取り込めません: 3000001。テンポを BPM 20 以上 300 以下にしてから、もう一度選んでください',
          (): File => createTempoMidi('tempo-slow.mid', 3000001),
        ],
        [
          '中身が空の壊れたファイル unreadable.mid のとき',
          'unreadable.mid を取り込めませんでした: 「unreadable.mid」を読み出せませんでした。ファイルが壊れていないか確認して、もう一度選んでください',
          createUnreadableMidi,
        ],
      ])('%s、画面の下のメッセージに「%s」と表示される', async (_condition, message, file) => {
        const app = await openDialogWith(file())

        expect(app.notice(message)).toBeInTheDocument()
      })
    })
  })
})

describe('[MIDI 取り込み] 取り込めない MIDI ファイルを選んだときの譜面のノーツ', () => {
  describe('「ファイル」メニューの「インポート」の「MIDI」でのファイルの選択', () => {
    describe('異常系', () => {
      it('譜面にノーツがあり、拍子が MIDI の tick 0 で 4/32 だけの den32.mid のとき、「インポート」の「MIDI」で選んでも、取り込めないため、譜面のノーツの代替コンテンツは「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1」だけのままになる', async () => {
        const app = await startApp()
        await app.loadChart([{ type: 'tap', tick: 480, lane: 1 }])

        await app.files.chooseMidi(createMeterMidiFile('den32.mid', 4, 32))

        expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1'])
      })
    })
  })
})

describe('[MIDI 取り込み] 確認結果の件数の表示', () => {
  describe('「確認する」の押下', () => {
    describe('正常系', () => {
      it.each([
        [
          'MIDI の tick 480 に C3 と C#3 のベロシティ 80 のノートがあるとき',
          '取り込むノーツ 2 個、取り込めないノート 0 個',
          (): File =>
            createNotesMidiFile([
              { tick: 480, pitch: 'C3', velocity: 80, durationTicks: 120 },
              { tick: 480, pitch: 'C#3', velocity: 80, durationTicks: 120 },
            ]),
        ],
        [`${MIXED_NOTES_GIVEN}とき`, '取り込むノーツ 3 個、取り込めないノート 0 個', createMixedMidiFile],
      ])('%s、ダイアログに「%s」と表示される', async (_condition, summary, file) => {
        const app = await openDialogWith(file())

        await app.midiDialog.confirm()

        expect(app.midiDialog.summary()).toBe(summary)
      })
    })

    describe('異常系', () => {
      it.each([
        [
          'ベロシティ 1 のノートがある状態で、「ベロシティの範囲」の「左フリックノーツ」の行の最小の入力欄を 1 から 2 にしたとき',
          '取り込むノーツ 0 個、取り込めないノート 1 個',
          createLeftFlickMidiFile,
          enterVelocity(LEFT_FLICK_ROW, 'min', '2'),
        ],
        [
          'ベロシティ 35・長さ 0 のノートがあるとき',
          '取り込むノーツ 0 個、取り込めないノート 1 個',
          createZeroLengthLongMidiFile,
          leaveAsIs,
        ],
        [
          'トラック 1 のベロシティ 80 と、トラック 2 のベロシティ 15 の、同じ位置のノートがあるとき',
          '取り込むノーツ 1 個、取り込めないノート 1 個',
          createOverlappingMidiFile,
          leaveAsIs,
        ],
        [
          'ベロシティ 0 のノートオンだけがあるとき',
          '取り込むノーツ 0 個、取り込めないノート 0 個',
          (): File =>
            createNotesMidiFile([{ tick: 480, pitch: 'C3', velocity: 0, durationTicks: 0, noteOnOnly: true }]),
          leaveAsIs,
        ],
        [
          'ノートの音程 C2 が、音程とレーンの対応の C3〜E3 にないとき',
          '取り込むノーツ 0 個、取り込めないノート 0 個',
          (): File => createNotesMidiFile([{ tick: 480, pitch: 'C2', velocity: 80, durationTicks: 120 }]),
          leaveAsIs,
        ],
      ])('%s、ダイアログに「%s」と表示される', async (_condition, summary, file, operate) => {
        const app = await openDialogWith(file())
        await operate(app)

        await app.midiDialog.confirm()

        expect(app.midiDialog.summary()).toBe(summary)
      })
    })
  })

  describe('入力欄の変更', () => {
    describe('正常系', () => {
      describe('「確認する」を押した後に入力欄を変える', () => {
        it.each([
          ['レーン 0 に対応する音程として C4 を入力したとき', enterPitch(0, 'C4')],
          [
            '「ベロシティの範囲」の「上フリックノーツ」の行の最小の入力欄を 11 から 16 にしたとき',
            enterVelocity(UP_FLICK_ROW, 'min', '16'),
          ],
        ])(
          '%s、ダイアログから「取り込むノーツ 3 個、取り込めないノート 0 個」の表示が消える',
          async (_edit, operate) => {
            const app = await openConfirmedDialog(createMixedMidiFile())
            expect(app.midiDialog.text('取り込むノーツ 3 個、取り込めないノート 0 個')).toBeInTheDocument()

            await operate(app)

            expect(app.midiDialog.text('取り込むノーツ 3 個、取り込めないノート 0 個')).toBeNull()
          },
        )
      })
    })
  })
})

describe('[MIDI 取り込み] 取り込むノーツの個数の上限', () => {
  describe('「確認する」の押下', () => {
    describe('異常系', () => {
      it('レーン 0 からレーン 4 に対応する音程 C3、C#3、D3、D#3、E3 のベロシティ 80 のノートが合わせて 3001 個ある MIDI のとき、ダイアログに「取り込むノーツが 3001 個あり、上限の 3000 個を超えます。ベロシティの範囲や音程の割り当てを見直して、ノーツを減らしてから、もう一度確認してください」と表示される', async () => {
        const pitches = ['C3', 'C#3', 'D3', 'D#3', 'E3']
        const app = await openDialogWith(
          createNotesMidiFile(
            Array.from({ length: 3001 }, (_, index) => ({
              tick: 120 * Math.floor(index / pitches.length),
              pitch: pitches[index % pitches.length]!,
              velocity: 80,
              durationTicks: 60,
            })),
          ),
        )

        await app.midiDialog.confirm()

        expect(
          app.midiDialog.text(
            '取り込むノーツが 3001 個あり、上限の 3000 個を超えます。ベロシティの範囲や音程の割り当てを見直して、ノーツを減らしてから、もう一度確認してください',
          ),
        ).toBeInTheDocument()
      })
    })
  })
})

describe('[MIDI 取り込み] 取り込めないノートの項目の表示', () => {
  describe('「確認する」の押下', () => {
    describe('異常系', () => {
      describe('4 分音符 1 つあたり 480 tick の MIDI のとき', () => {
        it.each([
          [
            'MIDI の tick 480 に、ベロシティ 35・長さ 0 のノートがあるとき',
            '1 小節目 2 拍目 レーン 0: 長さが 0 のロングノーツ',
            createZeroLengthLongMidiFile,
            leaveAsIs,
          ],
          [
            'MIDI の tick 480 に、トラック 1 のベロシティ 80 と、トラック 2 のベロシティ 15 の、同じ位置のノートがあるとき',
            '1 小節目 2 拍目 レーン 0: 位置の重複',
            createOverlappingMidiFile,
            leaveAsIs,
          ],
          [
            `${MIXED_NOTES_AT_TICKS_GIVEN}状態で、「ベロシティの範囲」の「上フリックノーツ」の行の最小の入力欄を 11 から 16 にしたとき`,
            '1 小節目 3 拍目 レーン 2: ベロシティが範囲外',
            createMixedMidiFile,
            enterVelocity(UP_FLICK_ROW, 'min', '16'),
          ],
        ])('%s、項目「%s」が出る', async (_condition, item, file, operate) => {
          const app = await openDialogWith(file())
          await operate(app)

          await app.midiDialog.confirm()

          expect(app.midiDialog.warnings()).toContain(item)
        })
      })
    })
  })
})

describe('[MIDI 取り込み] 音程とレーンの対応の入力の確認', () => {
  describe('「確認する」の押下', () => {
    describe('異常系', () => {
      it.each([
        ['レーン 0 に対応する音程として X9 を入力したとき', 'レーン 0 の音程「X9」を読めません', enterPitch(0, 'X9')],
        [
          'レーン 0 に対応する音程として C-3 を入力したとき',
          'レーン 0 の音程「C-3」を読めません',
          enterPitch(0, 'C-3'),
        ],
        [
          'レーン 1 に対応する音程として、レーン 0 と同じ C3 を入力したとき',
          '音程 C3 がレーン 0 とレーン 1 の両方に指定されています。レーンごとに別の音程にしてください',
          enterPitch(1, 'C3'),
        ],
      ])('%s、ダイアログに「%s」と表示される', async (_condition, message, operate) => {
        const app = await openDialogWith(createPlainMidiFile())
        await operate(app)

        await app.midiDialog.confirm()

        expect(app.midiDialog.text(message)).toBeInTheDocument()
      })
    })
  })
})

describe('[MIDI 取り込み] ベロシティの入力の確認', () => {
  describe('「確認する」の押下', () => {
    describe('異常系', () => {
      it.each([
        [
          '「ベロシティの範囲」の「タップノーツ」の行の最小の入力欄の 71 を消したとき',
          'タップノーツの最小を数値で入力してください',
          enterVelocity(TAP_ROW, 'min', ''),
        ],
        [
          '「ベロシティの範囲」の「タップノーツ」の行の最大の入力欄の 127 を消したとき',
          'タップノーツの最大を数値で入力してください',
          enterVelocity(TAP_ROW, 'max', ''),
        ],
        [
          '「ベロシティの範囲」の「タップノーツ」の行の最小の入力欄を 71 から 70 にしたとき',
          'ベロシティの範囲 61〜70 と 70〜127 が重なっています',
          enterVelocity(TAP_ROW, 'min', '70'),
        ],
        [
          '「ベロシティの範囲」の「タップノーツ」の行の最大の入力欄を 127 から 70 にしたとき',
          'ベロシティの範囲 71〜70 は 1〜127 の範囲で、最小が最大以下になるようにしてください',
          enterVelocity(TAP_ROW, 'max', '70'),
        ],
      ])('%s、ダイアログに「%s」と表示される', async (_condition, message, operate) => {
        const app = await openDialogWith(createPlainMidiFile())
        await operate(app)

        await app.midiDialog.confirm()

        expect(app.midiDialog.text(message)).toBeInTheDocument()
      })
    })
  })
})

describe('[MIDI 取り込み] 「取り込む」の押せる状態', () => {
  describe('「確認する」の押下', () => {
    describe('正常系', () => {
      it('MIDI の tick 480 に C-2 のノートがあり、レーン 0 に対応する音程として C-2 を入力したとき、「確認する」を押すと、ダイアログの「取り込む」が押せる', async () => {
        const app = await openDialogWith(
          createNotesMidiFile([{ tick: 480, pitch: 'C-2', velocity: 80, durationTicks: 120 }]),
        )
        await app.midiDialog.setPitch(0, 'C-2')

        await app.midiDialog.confirm()

        expect(app.midiDialog.summary(), 'C-2 のノートが取り込む対象になっていません').toBe(
          '取り込むノーツ 1 個、取り込めないノート 0 個',
        )
        expect(app.midiDialog.importButton()).toBeEnabled()
      })
    })

    describe('異常系', () => {
      it('レーン 0 に対応する音程として X9 を入力したとき、「確認する」を押すと、ダイアログの「取り込む」が押せない', async () => {
        const app = await openDialogWith(createPlainMidiFile())
        await app.midiDialog.setPitch(0, 'X9')

        await app.midiDialog.confirm()

        expect(app.midiDialog.importButton()).toBeDisabled()
      })
    })
  })

  describe('入力欄の変更', () => {
    describe('正常系', () => {
      describe('「確認する」を押した後に入力欄を変える', () => {
        it.each([
          ['レーン 0 に対応する音程として C4 を入力したとき', enterPitch(0, 'C4')],
          [
            '「ベロシティの範囲」の「上フリックノーツ」の行の最小の入力欄を 11 から 16 にしたとき',
            enterVelocity(UP_FLICK_ROW, 'min', '16'),
          ],
        ])('%s、ダイアログの「取り込む」が押せなくなる', async (_edit, operate) => {
          const app = await openConfirmedDialog()

          await operate(app)

          expect(app.midiDialog.importButton()).toBeDisabled()
        })
      })

      describe('「確認する」を押した後に入力欄を変え、もう一度「確認する」を押す', () => {
        it.each([
          ['レーン 0 に対応する音程として C4 を入力したとき', enterPitch(0, 'C4')],
          [
            '「ベロシティの範囲」の「上フリックノーツ」の行の最小の入力欄を 11 から 16 にしたとき',
            enterVelocity(UP_FLICK_ROW, 'min', '16'),
          ],
        ])('%s、ダイアログの「取り込む」が押せる', async (_edit, operate) => {
          const app = await openConfirmedDialog()
          await operate(app)
          expect(
            app.midiDialog.importButton(),
            '入力欄を変えても、「取り込む」が押せないままになっていません',
          ).toBeDisabled()

          await app.midiDialog.confirm()

          expect(app.midiDialog.importButton()).toBeEnabled()
        })
      })
    })

    describe('異常系', () => {
      it('レーン 0 に対応する音程として X9 を入力して「確認する」を押した後に、C3 を入力し直して、もう一度「確認する」を押すと、ダイアログの「取り込む」が押せる', async () => {
        const app = await openDialogWith(createPlainMidiFile())
        await app.midiDialog.setPitch(0, 'X9')
        await app.midiDialog.confirm()
        expect(app.midiDialog.importButton(), '直す前に、「取り込む」が押せる状態になっています').toBeDisabled()
        await app.midiDialog.setPitch(0, 'C3')

        await app.midiDialog.confirm()

        expect(app.midiDialog.importButton()).toBeEnabled()
      })
    })
  })
})

describe('[MIDI 取り込み] 取り込んだノーツの表示', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      describe('4 分音符 1 つあたり 480 tick の MIDI のとき、ダイアログで「確認する」と「取り込む」を押す', () => {
        it.each([
          ['MIDI の tick 0 の C3・ベロシティ 80', 'タップノーツ 1 小節目 1 拍目 レーン 0'],
          [
            'MIDI の tick 480 の C#3・ベロシティ 35・長さ 480',
            'ロングノーツ 始点 1 小節目 2 拍目 レーン 1、続く点 1 小節目 3 拍目 レーン 1、終端 離す',
          ],
          ['MIDI の tick 960 の D3・ベロシティ 15', '上フリックノーツ 1 小節目 3 拍目 レーン 2'],
        ])(
          '%s のノートを含む MIDI ファイルのとき、譜面のノーツの代替コンテンツに「%s」が出る',
          async (_given, note) => {
            const app = await openDialogWith(createMixedMidiFile())

            await importMidi(app)

            expect(app.timeline.notes()).toContain(note)
          },
        )
      })

      it('レーン 0 に対応する音程として C4 を入力したとき、tick 0 に C4 のノートがある MIDI について、「確認する」と「取り込む」を押すと、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目 レーン 0」が出る', async () => {
        const app = await openDialogWith(
          createNotesMidiFile([{ tick: 0, pitch: 'C4', velocity: 80, durationTicks: 120 }]),
        )
        await app.midiDialog.setPitch(0, 'C4')

        await importMidi(app)

        expect(app.timeline.notes()).toContain('タップノーツ 1 小節目 1 拍目 レーン 0')
      })
    })
  })
})

describe('[MIDI 取り込み] テンポの取り込み', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      it('MIDI のテンポが 468750 マイクロ秒で、譜面が空のとき、ダイアログで「確認する」と「取り込む」を押すと、タイムラインのテンポの代替コンテンツが「1 小節目 1 拍目 BPM 128」だけになる', async () => {
        const app = await openDialogWith(createTempoAndMeterMidiFile())

        await importMidi(app)

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 128'])
      })

      it('MIDI のテンポが 468750 マイクロ秒で、譜面にノーツがあり、テンポが 1 小節目 1 拍目・BPM 150 のとき、ダイアログで「確認する」と「取り込む」を押しても、MIDI のテンポは取り込まれず、タイムラインのテンポの代替コンテンツは「1 小節目 1 拍目 BPM 150」だけのままになる', async () => {
        const app = await startWithNoteAndProjectInfo()

        await importMidi(app)

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
      })
    })
  })
})

describe('[MIDI 取り込み] 拍子の取り込み', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      describe('ダイアログで「確認する」と「取り込む」を押す', () => {
        it.each([
          [
            'MIDI の拍子が tick 0 で 3/16 だけで、譜面が空のとき',
            '1 小節目 1 拍目 3/16',
            (): Promise<AppDriver> => openDialogWith(createMeterMidiFile('meter.mid', 3, 16)),
          ],
          [
            'MIDI の拍子が tick 0 で 4/2 だけで、譜面が空のとき',
            '1 小節目 1 拍目 4/2',
            (): Promise<AppDriver> => openDialogWith(createMeterMidiFile('meter.mid', 4, 2)),
          ],
        ])('%s、タイムラインの拍子の代替コンテンツが「%s」だけになる', async (_condition, meter, start) => {
          const app = await start()

          await importMidi(app)

          expect(app.timeline.meters()).toEqual([meter])
        })
      })

      it('MIDI の拍子が 3/4 で、譜面にノーツがあり、拍子が 1 小節目 1 拍目・5/8 のとき、ダイアログで「確認する」と「取り込む」を押しても、MIDI の拍子は取り込まれず、タイムラインの拍子の代替コンテンツは「1 小節目 1 拍目 5/8」だけのままになる', async () => {
        const app = await startWithNoteAndProjectInfo()

        await importMidi(app)

        expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 5/8'])
      })
    })
  })
})

describe('[MIDI 取り込み] 取り込み後のオフセット', () => {
  describe('MIDI の取り込み', () => {
    describe('ダイアログで「確認する」と「取り込む」を押して、右のパネルの「プロジェクト情報」ボタンを押す', () => {
      describe('正常系', () => {
        it.each([
          ['譜面が空で、オフセットが 120 ミリ秒のとき', startWithOffset],
          ['譜面にノーツがあり、オフセットが 120 ミリ秒のとき', startWithOffsetAndNote],
        ])(
          '%s、「プロジェクト情報」ダイアログの「オフセット (ms)」の入力欄が 120 のままになる',
          async (_condition, start) => {
            const app = await start()

            const offsetInput = await readOffsetAfterImport(app)

            expect(offsetInput).toHaveDisplayValue('120')
          },
        )
      })
    })
  })
})

describe('[MIDI 取り込み] 小節数の取り込み', () => {
  describe('MIDI の取り込み', () => {
    describe('ダイアログで「確認する」と「取り込む」を押してから、つまみを一番上までドラッグする', () => {
      describe('正常系', () => {
        it.each([
          {
            given: 'MIDI の tick 96000 にノートがあり',
            barCount: 50,
            tick: 96000,
            scrollPosition: '52 小節目 1 拍目',
          },
          {
            given: 'MIDI の tick 115199 にノートがあり',
            barCount: 60,
            tick: 115199,
            scrollPosition: '61 小節目 1 拍目',
          },
        ])(
          '$given、小節数が $barCount のとき、タイムラインの代替コンテンツに「スクロール位置 $scrollPosition」が出る',
          async ({ barCount, tick, scrollPosition }) => {
            const app = await openDialogWith(createSingleTapMidiFile(tick), { barCount })
            await importMidi(app)

            await app.scrollbar.dragThumbToTop()

            expect(app.timeline.items()).toContain(`スクロール位置 ${scrollPosition}`)
          },
        )
      })
    })
  })
})
