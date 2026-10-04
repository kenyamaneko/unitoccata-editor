import { describe, expect, it } from 'vitest'
import { startApp, type AppDriver } from '../../test/app.tsx'
import { expectRejectedWith } from '../../test/editor-operations-1.helpers.ts'
import { closeProjectInfoAndScrollToTop } from './editor-operations-3.helpers.ts'

const BAR_COUNT_OUT_OF_RANGE_NOTICE =
  '小節数を 1 に減らすと、範囲外になるノーツやテンポ・拍子の変化点があります。2 以上にしてください'
const BAR_COUNT_INPUT_MESSAGE = '小節数は 1 以上 1000 以下の整数で入力してください'

describe('[譜面設定] レーン数', () => {
  describe('レーン数の増減', () => {
    describe('レーン数が 5 のとき', () => {
      describe('正常系', () => {
        describe('レーン数の「−」ボタンの押下', () => {
          it('レーン 2 にノーツがあるとき、レーン数の「−」ボタンを 2 回押すと、「譜面設定」ダイアログのレーン数は、3 になる', async () => {
            const app = await startApp()
            await app.loadChart([{ type: 'tap', tick: 480, lane: 2 }])
            await app.chartSettings.open()

            await app.chartSettings.decreaseLaneCount(2)

            expect(app.chartSettings.laneCount()).toBe(3)
          })

          it('レーン数の「−」ボタンを 3 回押すと、「譜面設定」ダイアログのレーン数の「−」ボタンは、押せる状態で表示される', async () => {
            const app = await startApp()
            await app.chartSettings.open()

            await app.chartSettings.decreaseLaneCount(3)

            expect(app.chartSettings.laneDecreaseButton()).toBeEnabled()
          })

          it('レーン数の「−」ボタンを 4 回押すと、「譜面設定」ダイアログのレーン数は、1 になる', async () => {
            const app = await startApp()
            await app.chartSettings.open()

            await app.chartSettings.decreaseLaneCount(4)

            expect(app.chartSettings.laneCount()).toBe(1)
          })

          it('レーン数の「−」ボタンを 4 回押すと、「譜面設定」ダイアログのレーン数の「−」ボタンは、押せない状態で表示される', async () => {
            const app = await startApp()
            await app.chartSettings.open()

            await app.chartSettings.decreaseLaneCount(4)

            expect(app.chartSettings.laneDecreaseButton()).toBeDisabled()
          })
        })

        describe('レーン数の「＋」ボタンの押下', () => {
          it('レーン数の「＋」ボタンを 10 回押すと、「譜面設定」ダイアログのレーン数の「＋」ボタンは、押せる状態で表示される', async () => {
            const app = await startApp()
            await app.chartSettings.open()

            await app.chartSettings.increaseLaneCount(10)

            expect(app.chartSettings.laneIncreaseButton()).toBeEnabled()
          })

          it.each([
            { presses: 11, count: 16 },
            { presses: 1, count: 6 },
          ])(
            'レーン数の「＋」ボタンを $presses 回押すと、「譜面設定」ダイアログのレーン数は、$count になる',
            async ({ presses, count }) => {
              const app = await startApp()
              await app.chartSettings.open()

              await app.chartSettings.increaseLaneCount(presses)

              expect(app.chartSettings.laneCount()).toBe(count)
            },
          )

          it('レーン数の「＋」ボタンを 11 回押すと、「譜面設定」ダイアログのレーン数の「＋」ボタンは、押せない状態で表示される', async () => {
            const app = await startApp()
            await app.chartSettings.open()

            await app.chartSettings.increaseLaneCount(11)

            expect(app.chartSettings.laneIncreaseButton()).toBeDisabled()
          })
        })
      })

      describe('異常系', () => {
        describe('レーン数の「−」ボタンの押下', () => {
          it('レーン 3 にノーツがあるとき、レーン数の「−」ボタンを 2 回押すと、画面の下のメッセージに「レーン数を 3 に減らすと、範囲外になるノーツが 1 つあります」が表示される', async () => {
            const app = await startApp()
            await app.loadChart([{ type: 'tap', tick: 480, lane: 3 }])
            await app.chartSettings.open()

            await app.chartSettings.decreaseLaneCount(2)

            expect(app.notice('レーン数を 3 に減らすと、範囲外になるノーツが 1 つあります')).toBeInTheDocument()
          })

          it('レーン 3 にノーツがあるとき、レーン数の「−」ボタンを 2 回押しても、2 回目は効かず、「譜面設定」ダイアログのレーン数は、4 のままになる', async () => {
            const app = await startApp()
            await app.loadChart([{ type: 'tap', tick: 480, lane: 3 }])
            await app.chartSettings.open()

            await app.chartSettings.decreaseLaneCount(2)

            expect(app.chartSettings.laneCount()).toBe(4)
          })

          it('レーン 4 にノーツが 2 つあるとき、レーン数の「−」ボタンを 1 回押すと、画面の下のメッセージに「レーン数を 4 に減らすと、範囲外になるノーツが 2 つあります」が表示される', async () => {
            const app = await startApp()
            await app.loadChart([
              { type: 'tap', tick: 480, lane: 4 },
              { type: 'tap', tick: 720, lane: 4 },
            ])
            await app.chartSettings.open()

            await app.chartSettings.decreaseLaneCount(1)

            expect(app.notice('レーン数を 4 に減らすと、範囲外になるノーツが 2 つあります')).toBeInTheDocument()
          })

          it('レーン 4 にノーツが 2 つあるとき、レーン数の「−」ボタンを 1 回押しても、効かず、「譜面設定」ダイアログのレーン数は、5 のままになる', async () => {
            const app = await startApp()
            await app.loadChart([
              { type: 'tap', tick: 480, lane: 4 },
              { type: 'tap', tick: 720, lane: 4 },
            ])
            await app.chartSettings.open()
            await expectRejectedWith(app, 'レーン数を 4 に減らすと、範囲外になるノーツが 2 つあります', () =>
              app.chartSettings.decreaseLaneCount(1),
            )

            expect(app.chartSettings.laneCount()).toBe(5)
          })
        })
      })
    })
  })
})

describe('[プロジェクト情報] 小節数', () => {
  describe('小節数の入力', () => {
    describe('正常系', () => {
      it('1 小節目 4 拍目の 3/4 拍後にノーツがあるとき、「小節数」の入力欄に 1 を入力してエンターキーを押し、タイムラインを一番上までスクロールすると、タイムラインの代替コンテンツに「スクロール位置 2 小節目 1 拍目」が出る', async () => {
        const app = await startApp()
        await app.loadChart([{ type: 'tap', tick: 3600, lane: 2 }])
        await app.projectInfo.open()
        await app.projectInfo.enterBarCount('1')

        await closeProjectInfoAndScrollToTop(app)

        expect(app.timeline.items()).toContain('スクロール位置 2 小節目 1 拍目')
      })

      it.each([
        { label: '1', input: '1', scrollPosition: '2 小節目 1 拍目' },
        { label: '1000', input: '1000', scrollPosition: '1001 小節目 1 拍目' },
      ])(
        '「小節数」の入力欄に $label を入力してエンターキーを押し、タイムラインを一番上までスクロールすると、タイムラインの代替コンテンツに「スクロール位置 $scrollPosition」が出る',
        async ({ input, scrollPosition }) => {
          const app = await startApp()
          await app.projectInfo.open()
          await app.projectInfo.enterBarCount(input)

          await closeProjectInfoAndScrollToTop(app)

          expect(app.timeline.items()).toContain(`スクロール位置 ${scrollPosition}`)
        },
      )

      it('「小節数」の入力欄に 100 を入力してフォーカスを外し、タイムラインを一番上までスクロールすると、タイムラインの代替コンテンツに「スクロール位置 101 小節目 1 拍目」が出る', async () => {
        const app = await startApp()
        await app.projectInfo.open()
        await app.projectInfo.typeBarCountAndBlur('100')

        await closeProjectInfoAndScrollToTop(app)

        expect(app.timeline.items()).toContain('スクロール位置 101 小節目 1 拍目')
      })
    })

    describe('異常系', () => {
      describe('「小節数」の入力欄に 1 を入力してエンターキーを押す', () => {
        it.each<[string, (app: AppDriver) => Promise<void>]>([
          ['2 小節目 1 拍目にノーツがあるとき', (app) => app.loadChart([{ type: 'tap', tick: 3840, lane: 2 }])],
          [
            '2 小節目 1 拍目に BPM 90 のテンポ変化点があるとき',
            (app) =>
              app.loadChart([], undefined, {
                tempo: [
                  { tick: 0, bpm: 120 },
                  { tick: 3840, bpm: 90 },
                ],
              }),
          ],
        ])(
          '%s、画面の下のメッセージに「小節数を 1 に減らすと、範囲外になるノーツやテンポ・拍子の変化点があります。2 以上にしてください」が表示される',
          async (_given, load) => {
            const app = await startApp()
            await load(app)
            await app.projectInfo.open()

            await app.projectInfo.enterBarCount('1')

            expect(app.notice(BAR_COUNT_OUT_OF_RANGE_NOTICE)).toBeInTheDocument()
          },
        )

        it('小節数が 80 で、2 小節目 1 拍目にノーツがあるとき、小節数は変わらず、タイムラインを一番上までスクロールすると、タイムラインの代替コンテンツに「スクロール位置 81 小節目 1 拍目」が出る', async () => {
          const app = await startApp({ barCount: 80 })
          await app.loadChart([{ type: 'tap', tick: 3840, lane: 2 }])
          await app.projectInfo.open()
          await expectRejectedWith(app, BAR_COUNT_OUT_OF_RANGE_NOTICE, () => app.projectInfo.enterBarCount('1'))

          await closeProjectInfoAndScrollToTop(app)

          expect(app.timeline.items()).toContain('スクロール位置 81 小節目 1 拍目')
        })
      })

      it.each([
        { label: '0', input: '0' },
        { label: '1001', input: '1001' },
        { label: '2.5', input: '2.5' },
        { label: '空文字', input: '' },
      ])(
        '「小節数」の入力欄に $label を入力してエンターキーを押すと、入力欄の下に「小節数は 1 以上 1000 以下の整数で入力してください」が表示される',
        async ({ input }) => {
          const app = await startApp()
          await app.projectInfo.open()

          await app.projectInfo.enterBarCount(input)

          expect(app.projectInfo.barCountMessage()).toBe(BAR_COUNT_INPUT_MESSAGE)
        },
      )

      it('「小節数」の入力欄に 0 を入力してフォーカスを外すと、入力欄の下に「小節数は 1 以上 1000 以下の整数で入力してください」が表示される', async () => {
        const app = await startApp()
        await app.projectInfo.open()

        await app.projectInfo.typeBarCountAndBlur('0')

        expect(app.projectInfo.barCountMessage()).toBe(BAR_COUNT_INPUT_MESSAGE)
      })

      it('「小節数」の入力欄に 0 を入力してエンターキーを押し、100 に直してエンターキーを押すと、入力欄の下のメッセージが消える', async () => {
        const app = await startApp()
        await app.projectInfo.open()
        await app.projectInfo.enterBarCount('0')

        await app.projectInfo.enterBarCount('100')

        expect(app.projectInfo.barCountMessage()).toBeNull()
      })

      it('「小節数」の入力欄に 0 を入力してエンターキーを押し、100 に直してエンターキーを押し、タイムラインを一番上までスクロールすると、タイムラインの代替コンテンツに「スクロール位置 101 小節目 1 拍目」が出る', async () => {
        const app = await startApp()
        await app.projectInfo.open()
        await app.projectInfo.enterBarCount('0')
        await app.projectInfo.enterBarCount('100')

        await closeProjectInfoAndScrollToTop(app)

        expect(app.timeline.items()).toContain('スクロール位置 101 小節目 1 拍目')
      })

      it('小節数が 80 のとき、「小節数」の入力欄に 0 を入力してエンターキーを押しても、小節数は変わらず、タイムラインを一番上までスクロールすると、タイムラインの代替コンテンツに「スクロール位置 81 小節目 1 拍目」が出る', async () => {
        const app = await startApp({ barCount: 80 })
        await app.projectInfo.open()
        await app.projectInfo.enterBarCount('0')

        await closeProjectInfoAndScrollToTop(app)

        expect(app.timeline.items()).toContain('スクロール位置 81 小節目 1 拍目')
      })
    })
  })
})

describe('[譜面設定] 起動時のレーン数', () => {
  describe('エディタの起動', () => {
    describe('正常系', () => {
      it('エディタを起動して「譜面設定」ダイアログを開くと、レーン数は、5 になる', async () => {
        const app = await startApp()

        await app.chartSettings.open()

        expect(app.chartSettings.laneCount()).toBe(5)
      })
    })
  })
})

describe('[プロジェクト情報] 起動時の小節数', () => {
  describe('エディタの起動', () => {
    describe('正常系', () => {
      it('エディタを起動して、タイムラインを一番上までスクロールすると、タイムラインの代替コンテンツに「スクロール位置 51 小節目 1 拍目」が出る', async () => {
        const app = await startApp()

        await app.scrollbar.dragThumbToTop()

        expect(app.timeline.items()).toContain('スクロール位置 51 小節目 1 拍目')
      })
    })
  })
})

describe('[譜面設定] 譜面名', () => {
  describe('「譜面設定」ダイアログの「譜面名」の入力欄への入力', () => {
    describe('正常系', () => {
      it.each([
        { given: '日本語の「譜面1」を入力すると', entry: '譜面1' },
        { given: '100 文字を入力すると', entry: 'あ'.repeat(100) },
      ])('$given、入力欄の下にメッセージは表示されない', async ({ entry }) => {
        const app = await startApp()
        await app.chartSettings.open()

        await app.chartSettings.enterChartName(entry)

        expect(app.chartSettings.chartNameMessage()).toBeNull()
      })
    })

    describe('異常系', () => {
      it.each([
        { given: '半角の空白だけを入力すると', entry: '   ', message: '譜面名を入力してください' },
        {
          given: '101 文字を入力すると',
          entry: 'あ'.repeat(101),
          message: '譜面名は 100 文字以内にしてください (今は 101 文字です)',
        },
      ])('$given、入力欄の下に「$message」が表示される', async ({ entry, message }) => {
        const app = await startApp()
        await app.chartSettings.open()

        await app.chartSettings.enterChartName(entry)

        expect(app.chartSettings.chartNameMessage()).toBe(message)
      })
    })
  })
})
