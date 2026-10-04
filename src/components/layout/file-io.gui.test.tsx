import { describe, expect, it } from 'vitest'
import { startApp } from '../../test/app.tsx'
import { createAudioFile } from '../../test/fakeAudio.ts'
import { createChartFile, type ChartFileNote, type ChartFileProjectInfo } from '../../test/files.ts'
import {
  chooseRejectedChart,
  createChartNotReadableAsJson,
  createChartWithFractionalTick,
  createChartWithLaneCountZero,
  createChartWithLaneEqualToLaneCount,
  createChartWithMeterDenominatorThree,
  createChartWithMeterNumeratorZero,
  createChartWithNegativeLane,
  createChartWithTempoNotStartingAtTickZero,
  createMaxTapNotes,
  createTapNotes,
  createUnreadableChart,
  enterNames,
  startWithoutAudio,
} from '../../test/file-io.helpers.ts'
import { at } from '../../test/timeline.ts'

const EXPORT_SONG_NAME_NOTICE = '曲名を入力してください。「プロジェクト情報」と「譜面設定」で入力してください'
const EXPORT_CHART_NAME_NOTICE = '譜面名を入力してください。「プロジェクト情報」と「譜面設定」で入力してください'
const FILE_NAME_SYMBOLS = '\\/:*?"<>|'

describe('[音源の読み込み] 音源ファイル', () => {
  describe('「ファイル」メニューの「インポート」の「音源」でのファイル選択', () => {
    describe('正常系', () => {
      it.each([{ fileName: 'song.mp3' }, { fileName: 'SONG.MP3' }])(
        '音源ファイル $fileName のとき、右のパネルの音源の名前は「$fileName」になる',
        async ({ fileName }) => {
          const app = await startWithoutAudio()

          await app.files.chooseAudio(createAudioFile(fileName))

          expect(app.text(fileName)).toBeInTheDocument()
        },
      )
    })
  })
})

const CHART_REJECTIONS: ReadonlyArray<readonly [string, string, () => File]> = [
  [
    '譜面ファイルの 1 つ目のノーツの位置が 1.5 tick のとき',
    'chart.json: 1 つ目のノーツの位置は整数にしてください',
    createChartWithFractionalTick,
  ],
  ['JSON として読めない内容の譜面ファイルのとき', 'chart.json は JSON として読めません', createChartNotReadableAsJson],
  [
    '1 小節目 1 拍目の 1/2 拍後・レーン -1 のタップノーツがある譜面ファイルのとき',
    'chart.json: 1 つ目のノーツに、先頭より前の位置か 0 未満のレーンの点があります',
    createChartWithNegativeLane,
  ],
  [
    'レーン数が 3 で、レーン 3 のタップノーツがある譜面ファイルのとき',
    'chart.json: 1 つ目のノーツのレーンは 2 以下にしてください: 3',
    createChartWithLaneEqualToLaneCount,
  ],
  [
    'レーン数が 0 の譜面ファイルのとき',
    'chart.json: レーン数は 1 以上 16 以下にしてください',
    createChartWithLaneCountZero,
  ],
  [
    '最初のテンポ変化点が 1 小節目 1 拍目の 1/96 拍後にある譜面ファイルのとき',
    'chart.json: 最初のテンポ変化点は先頭の位置にしてください',
    createChartWithTempoNotStartingAtTickZero,
  ],
  [
    '拍子変化点の分母が 3 の譜面ファイルのとき',
    'chart.json: 1 つ目の拍子変化点の分母は 2、4、8、16 のいずれかにしてください',
    createChartWithMeterDenominatorThree,
  ],
  [
    '拍子変化点の分子が 0 の譜面ファイルのとき',
    'chart.json: 1 つ目の拍子変化点の分子は 1 以上 99 以下の整数にしてください',
    createChartWithMeterNumeratorZero,
  ],
  [
    '譜面ファイルの読み出しに失敗するとき',
    '「chart.json」を読み出せませんでした。ファイルが壊れていないか確認して、もう一度選んでください',
    createUnreadableChart,
  ],
]

describe('[譜面ファイル読み込み] 譜面ファイルのノーツ', () => {
  describe('正常系', () => {
    it('「ファイル」メニューの「インポート」の「譜面」で 1 小節目 1 拍目・レーン 1 のタップノーツだけの譜面ファイルを選ぶと、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目 レーン 1」が出る', async () => {
      const app = await startApp()

      await app.files.chooseChart(createChartFile('chart.json', [{ type: 'tap', tick: 0, lane: 1 }]))

      expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目 レーン 1'])
    })
  })
})

describe('[譜面ファイル読み込み] 読み込んだノーツの位置の表示', () => {
  describe('正常系', () => {
    describe('「ファイル」メニューの「インポート」の「譜面」で譜面ファイルを選ぶ', () => {
      it('tick 1 のタップノーツだけの譜面ファイルのとき、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目の 1/960 拍後 レーン 0」が出る', async () => {
        const app = await startApp()

        await app.files.chooseChart(createChartFile('chart.json', [{ type: 'tap', tick: 1, lane: 0 }]))

        expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/960 拍後 レーン 0'])
      })

      describe('拍子が 6/8 だけの譜面ファイルのとき', () => {
        it.each<{ readonly tick: number; readonly shownNote: string }>([
          { tick: 2880, shownNote: 'タップノーツ 2 小節目 1 拍目 レーン 0' },
          { tick: 3120, shownNote: 'タップノーツ 2 小節目 1 拍目の 1/2 拍後 レーン 0' },
        ])(
          'tick $tick のタップノーツがあると、譜面のノーツの代替コンテンツに「$shownNote」が出る',
          async ({ tick, shownNote }) => {
            const app = await startApp()

            await app.files.chooseChart(
              createChartFile('chart.json', [{ type: 'tap', tick, lane: 0 }], 5, {
                meter: [{ tick: 0, num: 6, den: 8 }],
              }),
            )

            expect(app.timeline.notes()).toEqual([shownNote])
          },
        )
      })

      describe('拍子が tick 0 の 4/4 と tick 3840 の 3/4 の譜面ファイルのとき', () => {
        it.each<{ readonly tick: number; readonly shownNote: string }>([
          { tick: 3840, shownNote: 'タップノーツ 2 小節目 1 拍目 レーン 0' },
          { tick: 5760, shownNote: 'タップノーツ 2 小節目 3 拍目 レーン 0' },
          { tick: 6720, shownNote: 'タップノーツ 3 小節目 1 拍目 レーン 0' },
        ])(
          'tick $tick のタップノーツがあると、譜面のノーツの代替コンテンツに「$shownNote」が出る',
          async ({ tick, shownNote }) => {
            const app = await startApp()

            await app.files.chooseChart(
              createChartFile('chart.json', [{ type: 'tap', tick, lane: 0 }], 5, {
                meter: [
                  { tick: 0, num: 4, den: 4 },
                  { tick: 3840, num: 3, den: 4 },
                ],
              }),
            )

            expect(app.timeline.notes()).toEqual([shownNote])
          },
        )
      })
    })
  })
})

describe('[譜面ファイル読み込み] 譜面ファイルのレーン数', () => {
  describe('正常系', () => {
    describe('レーン数が 5 のとき', () => {
      describe('「ファイル」メニューの「インポート」の「譜面」で譜面ファイルを選んで、「譜面設定」ダイアログを開く', () => {
        it.each([{ fileLaneCount: 8 }, { fileLaneCount: 3 }, { fileLaneCount: 16 }, { fileLaneCount: 1 }])(
          'レーン数が $fileLaneCount の譜面ファイルを選ぶと、レーン数は $fileLaneCount になる',
          async ({ fileLaneCount }) => {
            const app = await startApp()

            await app.files.chooseChart(createChartFile('chart.json', [], fileLaneCount))
            await app.chartSettings.open()

            expect(app.chartSettings.laneCount()).toBe(fileLaneCount)
          },
        )
      })
    })
  })
})

describe('[譜面ファイル読み込み] 譜面ファイルに合わせた小節数の拡張', () => {
  describe('正常系', () => {
    describe('小節数が 60 のとき', () => {
      describe('「ファイル」メニューの「インポート」の「譜面」で譜面ファイルを選んで、「プロジェクト情報」ダイアログを開く', () => {
        it.each<readonly [string, number, ChartFileNote[], ChartFileProjectInfo]>([
          [
            '60 小節目 4 拍目の 959/960 拍後のタップノーツだけの譜面ファイル',
            60,
            [{ type: 'tap', tick: 230399, lane: 0 }],
            {},
          ],
          ['61 小節目 1 拍目のタップノーツだけの譜面ファイル', 61, [{ type: 'tap', tick: 230400, lane: 0 }], {}],
          [
            '続く点が 61 小節目 1 拍目のロングノーツだけの譜面ファイル',
            61,
            [{ type: 'long', tick: 0, lane: 0, path: [{ tick: 230400, lane: 0 }], end: 'release' }],
            {},
          ],
          [
            'テンポ変化点が 1 小節目 1 拍目の BPM 120 と 61 小節目 1 拍目の BPM 150 の譜面ファイル',
            61,
            [],
            {
              tempo: [
                { tick: 0, bpm: 120 },
                { tick: 230400, bpm: 150 },
              ],
            },
          ],
          [
            '拍子変化点が 1 小節目 1 拍目の 4/4 と 61 小節目 1 拍目の 3/4 の譜面ファイル',
            61,
            [],
            {
              meter: [
                { tick: 0, num: 4, den: 4 },
                { tick: 230400, num: 3, den: 4 },
              ],
            },
          ],
        ])('%sのとき、小節数は %d になる', async (_condition, expectedBarCount, notes, projectInfo) => {
          const app = await startApp({ barCount: 60 })

          await app.files.chooseChart(createChartFile('chart.json', notes, 5, projectInfo))
          await app.projectInfo.open()

          expect(app.projectInfo.barCountInput()).toHaveDisplayValue(String(expectedBarCount))
        })

        it('1001 小節目 1 拍目のタップノーツだけの譜面ファイルのとき、小節数は上限の 1000 になる', async () => {
          const app = await startApp({ barCount: 60 })

          await app.files.chooseChart(createChartFile('chart.json', [{ type: 'tap', tick: 3840000, lane: 0 }]))
          await app.projectInfo.open()

          expect(app.projectInfo.barCountInput()).toHaveDisplayValue('1000')
        })
      })
    })

    describe('小節数が 2 で、拍子変化点が 1 小節目 1 拍目の 4/4 と 3 小節目 1 拍目の 3/4 の譜面ファイルのとき', () => {
      describe('「ファイル」メニューの「インポート」の「譜面」で譜面ファイルを選んで、「プロジェクト情報」ダイアログを開く', () => {
        it.each<{ readonly tick: number; readonly given: string; readonly expectedBarCount: number }>([
          {
            tick: 7879,
            given: '3 小節目 3 拍目の 959/960 拍後のタップノーツがある',
            expectedBarCount: 3,
          },
          { tick: 7880, given: '4 小節目 1 拍目のタップノーツがある', expectedBarCount: 4 },
        ])('$given、小節数は $expectedBarCount になる', async ({ tick, expectedBarCount }) => {
          const app = await startApp({ barCount: 2 })

          await app.files.chooseChart(
            createChartFile('chart.json', [{ tick, type: 'tap', lane: 0 }], 5, {
              meter: [
                { tick: 0, num: 4, den: 4 },
                { tick: 5000, num: 3, den: 4 },
              ],
            }),
          )
          await app.projectInfo.open()

          expect(app.projectInfo.barCountInput()).toHaveDisplayValue(String(expectedBarCount))
        })
      })
    })
  })
})

describe('[譜面ファイル読み込み] 不正なファイルのエラー表示', () => {
  describe('異常系', () => {
    describe('「ファイル」メニューの「インポート」の「譜面」でのファイル選択', () => {
      it.each(CHART_REJECTIONS)(
        '%s、画面の下のメッセージに「%s」と表示される',
        async (_condition, message, createInvalidChart) => {
          const app = await startApp()

          await app.files.chooseChart(createInvalidChart())

          expect(app.notice(message)).toBeInTheDocument()
        },
      )
    })
  })
})

describe('[譜面ファイル読み込み] 不正なファイルを選んだあとの譜面', () => {
  describe('異常系', () => {
    it('レーン数が 5 のとき、「インポート」の「譜面」でレーン数が 0 の譜面ファイルを選んで失敗しても、「譜面設定」ダイアログのレーン数は、読み込み前の 5 のままになる', async () => {
      const app = await startApp()

      await chooseRejectedChart(app, createChartWithLaneCountZero())
      await app.chartSettings.open()

      expect(app.chartSettings.laneCount()).toBe(5)
    })

    it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツを読み込み済みで、譜面ファイルの 1 つ目のノーツの位置が 1.5 tick のとき、「インポート」の「譜面」でそのファイルを選ぶと、読み込みは失敗し、譜面のノーツの代替コンテンツは「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1」だけのままになる', async () => {
      const app = await startApp()
      await app.loadChart([{ type: 'tap', tick: 480, lane: 1 }])

      await chooseRejectedChart(app, createChartWithFractionalTick())

      expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1'])
    })

    it('オフセットを 120 にしてあるとき、「インポート」の「譜面」でオフセットが 200 で最初のテンポ変化点が 1 小節目 1 拍目の 1/96 拍後にある譜面ファイルを選んで失敗しても、「プロジェクト情報」ダイアログのオフセットは、読み込み前の 120 のままになる', async () => {
      const app = await startApp()
      await app.projectInfo.open()
      await app.projectInfo.enterOffset('120')
      await app.projectInfo.close()

      await chooseRejectedChart(app, createChartWithTempoNotStartingAtTickZero({ offsetMs: 200 }))
      await app.projectInfo.open()

      expect(app.projectInfo.offsetInput()).toHaveDisplayValue('120')
    })

    it('不正な譜面ファイルを選んだあと、「インポート」の「譜面」で 1 小節目 1 拍目・レーン 1 のタップノーツだけの正しい譜面ファイルを選ぶと、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目 レーン 1」が出る', async () => {
      const app = await startApp()
      await chooseRejectedChart(app, createChartWithFractionalTick())

      await app.files.chooseChart(createChartFile('valid-chart.json', [{ type: 'tap', tick: 0, lane: 1 }]))

      expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目 レーン 1'])
    })
  })
})

describe('[譜面ファイル読み込み] 譜面ファイルのオフセット・テンポ・拍子', () => {
  describe('「ファイル」メニューの「インポート」の「譜面」でのファイル選択', () => {
    describe('正常系', () => {
      it('オフセットが 120 の譜面ファイルを選んで、「プロジェクト情報」ダイアログを開くと、オフセットは 120 になる', async () => {
        const app = await startApp()

        await app.files.chooseChart(createChartFile('chart.json', [], 5, { offsetMs: 120 }))
        await app.projectInfo.open()

        expect(app.projectInfo.offsetInput()).toHaveDisplayValue('120')
      })

      it('テンポ変化点が 1 小節目 1 拍目・BPM 150 だけの譜面ファイルを選ぶと、テンポの代替コンテンツに「1 小節目 1 拍目 BPM 150」が出る', async () => {
        const app = await startApp()

        await app.files.chooseChart(createChartFile('chart.json', [], 5, { tempo: [{ tick: 0, bpm: 150 }] }))

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
      })

      it('拍子変化点が tick 0 の 4/4 と tick 3840 の 3/4 の譜面ファイルを選ぶと、拍子の代替コンテンツに「1 小節目 1 拍目 4/4」「2 小節目 1 拍目 3/4」が出る', async () => {
        const app = await startApp()

        await app.files.chooseChart(
          createChartFile('chart.json', [], 5, {
            meter: [
              { tick: 0, num: 4, den: 4 },
              { tick: 3840, num: 3, den: 4 },
            ],
          }),
        )

        expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 4/4', '2 小節目 1 拍目 3/4'])
      })

      describe('オフセットが 120、テンポが 1 小節目 1 拍目・BPM 150、拍子が 1 小節目 1 拍目の 3/4 の譜面ファイルを読み込み済みのとき、オフセットが 0、テンポが BPM 120、拍子が 4/4 の譜面ファイルを選ぶ', () => {
        const startWithImportedProjectInfo = async (): Promise<Awaited<ReturnType<typeof startApp>>> => {
          const app = await startApp()
          await app.loadChart([], undefined, {
            offsetMs: 120,
            tempo: [{ tick: 0, bpm: 150 }],
            meter: [{ tick: 0, num: 3, den: 4 }],
          })
          await app.files.chooseChart(createChartFile('default.json', []))
          return app
        }

        it('「プロジェクト情報」ダイアログのオフセットは、0 になる', async () => {
          const app = await startWithImportedProjectInfo()

          await app.projectInfo.open()

          expect(app.projectInfo.offsetInput()).toHaveDisplayValue('0')
        })

        it('テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 120」だけになる', async () => {
          const app = await startWithImportedProjectInfo()

          expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 120'])
        })

        it('拍子の代替コンテンツは、「1 小節目 1 拍目 4/4」だけになる', async () => {
          const app = await startWithImportedProjectInfo()

          expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 4/4'])
        })
      })
    })
  })
})

describe('[ノーツの個数の上限] 譜面ファイルのインポート', () => {
  describe('「ファイル」メニューの「インポート」の「譜面」でのファイル選択', () => {
    describe('正常系', () => {
      it('ノーツが 3000 個ある譜面ファイルを選ぶと、譜面のノーツの代替コンテンツは 3000 項目になる', async () => {
        const app = await startApp()

        await app.files.chooseChart(createChartFile('chart.json', createMaxTapNotes()))

        expect(app.timeline.notes()).toHaveLength(3000)
      })
    })

    describe('異常系', () => {
      it('ノーツが 3001 個ある譜面ファイル chart.json を選ぶと、画面の下のメッセージに「chart.json: ノーツは 3000 個までです (このファイルは 3001 個です)」が表示される', async () => {
        const app = await startApp()

        await app.files.chooseChart(createChartFile('chart.json', createTapNotes(3001)))

        expect(app.notice('chart.json: ノーツは 3000 個までです (このファイルは 3001 個です)')).toBeInTheDocument()
      })
    })
  })
})

describe('[譜面書き出し] 書き出されるファイルの名前', () => {
  describe('「ファイル」メニューの「譜面書き出し」の押下', () => {
    describe('正常系', () => {
      it('曲名が「テスト曲」、譜面名が「譜面1」のとき、ダウンロードされたファイルの名前は、譜面1.テスト曲.unitoccata.json になる', async () => {
        const app = await startApp()

        const file = await app.downloads.exportChartAs('テスト曲', '譜面1')

        expect(file.fileName).toBe('譜面1.テスト曲.unitoccata.json')
      })

      it.each([
        {
          given: '曲名に \\ / : * ? " < > | が含まれているとき',
          songName: `テ${FILE_NAME_SYMBOLS}スト曲`,
          chartName: '譜面1',
        },
        {
          given: '譜面名に \\ / : * ? " < > | が含まれているとき',
          songName: 'テスト曲',
          chartName: `譜${FILE_NAME_SYMBOLS}面1`,
        },
      ])(
        '$given、その記号は取り除かれ、ダウンロードされたファイルの名前は、譜面1.テスト曲.unitoccata.json になる',
        async ({ songName, chartName }) => {
          const app = await startApp()

          const file = await app.downloads.exportChartAs(songName, chartName)

          expect(file.fileName).toBe('譜面1.テスト曲.unitoccata.json')
        },
      )

      it('音源 song.mp3 を読み込み、譜面名が初期値のままのとき、ダウンロードされたファイルの名前は、easy.song.unitoccata.json になる', async () => {
        const app = await startApp()
        await app.files.chooseAudio(createAudioFile('song.mp3'))

        const file = await app.downloads.exportChart()

        expect(file.fileName).toBe('easy.song.unitoccata.json')
      })
    })
  })
})

describe('[譜面書き出し] 書き出されるファイルの内容', () => {
  describe('「ファイル」メニューの「譜面書き出し」の押下', () => {
    describe('正常系', () => {
      it('1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツがあるとき、ダウンロードされた譜面ファイルのノーツは、1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツの 1 つになる', async () => {
        const app = await startApp()
        await app.timeline.click(at(480, 2))

        const file = await app.downloads.exportChartAs('テスト曲', '譜面1')

        expect(await file.json()).toMatchObject({ notes: [{ tick: 480, lane: 2, type: 'tap' }] })
      })

      it('レーン数が 8 のとき、ダウンロードされた譜面ファイルのレーン数は、8 になる', async () => {
        const app = await startApp({ laneCount: 8 })

        const file = await app.downloads.exportChartAs('テスト曲', '譜面1')

        expect(await file.json()).toMatchObject({ laneCount: 8 })
      })

      it('テンポ変化点が 1 小節目 1 拍目・BPM 150 だけの譜面ファイルを読み込んだとき、ダウンロードされた譜面ファイルのテンポ変化点は、tick 0・BPM 150 の 1 つになる', async () => {
        const app = await startApp()
        await app.loadChart([], undefined, { tempo: [{ tick: 0, bpm: 150 }] })

        const file = await app.downloads.exportChartAs('テスト曲', '譜面1')

        expect(await file.json()).toMatchObject({ tempo: [{ tick: 0, bpm: 150 }] })
      })

      it('拍子変化点が 1 小節目 1 拍目の 3/4 だけの譜面ファイルを読み込んだとき、ダウンロードされた譜面ファイルの拍子変化点は、tick 0・分子 3・分母 4 の 1 つになる', async () => {
        const app = await startApp()
        await app.loadChart([], undefined, { meter: [{ tick: 0, num: 3, den: 4 }] })

        const file = await app.downloads.exportChartAs('テスト曲', '譜面1')

        expect(await file.json()).toMatchObject({ meter: [{ tick: 0, num: 3, den: 4 }] })
      })

      it('小節数が 60 のとき、ダウンロードされた譜面ファイルの項目は、formatVersion、offsetMs、laneCount、tempo、meter、notes だけになる', async () => {
        const app = await startApp({ barCount: 60 })

        const file = await app.downloads.exportChartAs('テスト曲', '譜面1')

        expect(Object.keys((await file.json()) as object).toSorted()).toEqual([
          'formatVersion',
          'laneCount',
          'meter',
          'notes',
          'offsetMs',
          'tempo',
        ])
      })
    })
  })
})

describe('[譜面書き出し] 曲名と譜面名の検証', () => {
  describe('「ファイル」メニューの「譜面書き出し」の押下', () => {
    describe('正常系', () => {
      it('音源を読み込んでおらず、曲名が空のとき、画面の下のメッセージに「曲名を入力してください。「プロジェクト情報」と「譜面設定」で入力してください」が表示される', async () => {
        const app = await startApp()

        await app.fileMenu.choose('譜面書き出し')

        expect(app.notice(EXPORT_SONG_NAME_NOTICE)).toBeInTheDocument()
      })

      it('音源を読み込んでおらず、曲名が空のとき、ダウンロードされたファイルは 0 件のままになる', async () => {
        const app = await startApp()

        await app.fileMenu.choose('譜面書き出し')

        expect(app.downloads.all()).toHaveLength(0)
      })

      it('曲名が「テスト曲」で、譜面名が空のとき、画面の下のメッセージに「譜面名を入力してください。「プロジェクト情報」と「譜面設定」で入力してください」が表示される', async () => {
        const app = await startApp()
        await enterNames(app, 'テスト曲', '')

        await app.fileMenu.choose('譜面書き出し')

        expect(app.notice(EXPORT_CHART_NAME_NOTICE)).toBeInTheDocument()
      })

      it('曲名が空で「譜面書き出し」を押したあと、曲名に「テスト曲」を入力してからもう一度「譜面書き出し」を押すと、ダウンロードされたファイルの名前は、easy.テスト曲.unitoccata.json になる', async () => {
        const app = await startApp()
        await app.fileMenu.choose('譜面書き出し')
        expect(app.notice(EXPORT_SONG_NAME_NOTICE), '曲名が空のときのメッセージが出ていません').toBeInTheDocument()
        await app.projectInfo.open()
        await app.projectInfo.enterSongName('テスト曲')
        await app.projectInfo.close()

        const file = await app.downloads.exportChart()

        expect(file.fileName).toBe('easy.テスト曲.unitoccata.json')
      })
    })
  })
})
