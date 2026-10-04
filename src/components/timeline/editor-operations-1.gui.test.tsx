import { describe, expect, it } from 'vitest'
import { startApp } from '../../test/app.tsx'
import type { ChartFileNote } from '../../test/files.ts'
import {
  expectRejectedWith,
  loadChartWithoutFocus,
  pressKey,
  startWithMaxNotes,
} from '../../test/editor-operations-1.helpers.ts'
import { aboveTimelineTop, at, belowTimelineBottom, tempoColumnAt } from '../../test/timeline.ts'

const SAME_POSITION_NOTICE = '同じ位置にノーツがあります'
const MAX_NOTES_NOTICE = 'ノーツは 3000 個までです'
const LONG_ORDER_NOTICE = 'ロングノーツの点は、前の点より後、次の点より前の時間に置いてください'
const EXTEND_NOTICE =
  'ロングノーツを伸ばせるのは、最後の終端からのドラッグだけです。点を動かすときは、Shift を押しながらドラッグしてください'
const FLICK_END_ONLY_NOTICE = 'フリックを付けられるのは、ロングノーツの最後の終端だけです'
const NO_FLICK_NOTICE = 'この点にはフリックがないため、解除できません'
const POINT_NOT_FOUND_NOTICE = 'ノーツの点が見つかりません。ノーツの上にマウスを置いて、もう一度操作してください'

const tapAt480Lane2: ChartFileNote = { type: 'tap', tick: 480, lane: 2 }
const tapAt480Lane0: ChartFileNote = { type: 'tap', tick: 480, lane: 0 }
const upFlickAt480Lane2: ChartFileNote = { type: 'flick', tick: 480, lane: 2, dir: 'up' }
const longFrom480To1440ReleasedAtLane2: ChartFileNote = {
  type: 'long',
  tick: 480,
  lane: 2,
  path: [{ tick: 1440, lane: 2 }],
  end: 'release',
}
const longFrom480To1440FlickedRightAtLane2: ChartFileNote = {
  type: 'long',
  tick: 480,
  lane: 2,
  path: [{ tick: 1440, lane: 2 }],
  end: { flick: 'right' },
}
const longThroughRelayPoint: ChartFileNote = {
  type: 'long',
  tick: 480,
  lane: 2,
  path: [
    { tick: 1440, lane: 2 },
    { tick: 2400, lane: 2 },
  ],
  end: 'release',
}
const longWithFourPointsAndRightFlick: ChartFileNote = {
  type: 'long',
  tick: 0,
  lane: 1,
  path: [
    { tick: 480, lane: 3 },
    { tick: 960, lane: 0 },
    { tick: 1440, lane: 2 },
  ],
  end: { flick: 'right' },
}
const longFrom0To960ReleasedAtLane1: ChartFileNote = {
  type: 'long',
  tick: 0,
  lane: 1,
  path: [{ tick: 960, lane: 1 }],
  end: 'release',
}
const longForMovingRelayPoint: ChartFileNote = {
  type: 'long',
  tick: 0,
  lane: 1,
  path: [
    { tick: 480, lane: 3 },
    { tick: 960, lane: 0 },
  ],
  end: 'release',
}

const tapAt720Lane3: ChartFileNote = { type: 'tap', tick: 720, lane: 3 }
const tapAt480Lane1: ChartFileNote = { type: 'tap', tick: 480, lane: 1 }
const tapAt720Lane2: ChartFileNote = { type: 'tap', tick: 720, lane: 2 }
const tapAt960Lane1: ChartFileNote = { type: 'tap', tick: 960, lane: 1 }
const longFrom0To1920ReleasedAtLane1: ChartFileNote = {
  type: 'long',
  tick: 0,
  lane: 1,
  path: [{ tick: 1920, lane: 1 }],
  end: 'release',
}
const longFrom1920To2880ReleasedAtLane1: ChartFileNote = {
  type: 'long',
  tick: 1920,
  lane: 1,
  path: [{ tick: 2880, lane: 1 }],
  end: 'release',
}
const longFrom0To1920ReleasedFromLane0ToLane4: ChartFileNote = {
  type: 'long',
  tick: 0,
  lane: 0,
  path: [{ tick: 1920, lane: 4 }],
  end: 'release',
}
const longFrom3840To4800ReleasedAtLane2: ChartFileNote = {
  type: 'long',
  tick: 3840,
  lane: 2,
  path: [{ tick: 4800, lane: 2 }],
  end: 'release',
}
const SHORT_NOTE_ON_LONG_NOTICE = 'ロングノーツの上には、タップノーツとフリックノーツを置けません'
const LONG_ON_LONG_NOTICE = 'ロングノーツは、ほかのロングノーツと重ねられません'
const OUT_OF_LANE_NOTICE =
  'ノーツが、先頭より前か、レーンの範囲外になります。位置をずらすか、レーン数を増やしてください'

describe('[ノーツの編集] 譜面のノーツ', () => {
  describe('グリッドでのノーツの作成', () => {
    describe('正常系', () => {
      describe('ノーツがないとき', () => {
        it('1 小節目 1 拍目の 1/2 拍後・レーン 2 をクリックすると、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」が出る', async () => {
          const app = await startApp()

          await app.timeline.click(at(480, 2))

          expect(app.timeline.notes()).toContain('タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2')
        })

        it('1 小節目 1 拍目の 1/2 拍後・レーン 2 でマウスを押したまま、ホイールを上へ 100 ピクセル分回し、1 小節目 2 拍目の 1/2 拍後・レーン 2 で離すと、譜面のノーツの代替コンテンツに「ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、終端 離す」が出る', async () => {
          const app = await startApp()

          await app.timeline.press(at(480, 2))
          await app.timeline.wheel('up', { pixels: 100 })
          await app.timeline.moveTo(at(1440, 2))
          await app.timeline.release(at(1440, 2))

          expect(app.timeline.notes()).toContain(
            'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、終端 離す',
          )
        })

        describe('ドラッグ', () => {
          it.each([
            [
              '1 小節目 1 拍目の 1/2 拍後・レーン 1 から 1 小節目 2 拍目の 1/2 拍後・レーン 3 までドラッグして離すと',
              'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 1、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 3、終端 離す',
              at(480, 1),
              at(1440, 3),
            ],
            [
              '1 小節目 1 拍目の 1/2 拍後・レーン 2 から 1 小節目 1 拍目の 3/4 拍後・レーン 2 までドラッグして離すと',
              'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 1 拍目の 3/4 拍後 レーン 2、終端 離す',
              at(480, 2),
              at(720, 2),
            ],
            [
              '1 小節目 2 拍目の 1/2 拍後・レーン 3 から 1 小節目 1 拍目の 1/2 拍後・レーン 1 まで下方向にドラッグして離すと',
              'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 1、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 3、終端 離す',
              at(1440, 3),
              at(480, 1),
            ],
            [
              '1 小節目 1 拍目の 1/2 拍後の 12 ピクセル上・レーン 2 の中央でマウスを押し、上へ 3 ピクセル動かして離すと',
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2',
              at(480, 2, { up: 12 }),
              at(480, 2, { up: 15 }),
            ],
            [
              '1 小節目 1 拍目の 1/2 拍後の 12 ピクセル上・レーン 2 の中央でマウスを押し、上へ 4 ピクセル動かして離すと',
              'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 1 拍目の 3/4 拍後 レーン 2、終端 離す',
              at(480, 2, { up: 12 }),
              at(480, 2, { up: 16 }),
            ],
          ])('%s、譜面のノーツの代替コンテンツに「%s」が出る', async (_operation, expected, from, to) => {
            const app = await startApp()

            await app.timeline.drag(from, to)

            expect(app.timeline.notes()).toContain(expected)
          })

          it('スクロール位置が 1 小節目 1 拍目のとき、1 小節目 2 拍目・レーン 2 でマウスを押し、タイムラインの下端より下で離すと、譜面のノーツの代替コンテンツに「ロングノーツ 始点 1 小節目 1 拍目 レーン 2、続く点 1 小節目 2 拍目 レーン 2、終端 離す」が出る', async () => {
            const app = await startApp()

            await app.timeline.drag(at(960, 2), belowTimelineBottom(2))

            expect(app.timeline.notes()).toContain(
              'ロングノーツ 始点 1 小節目 1 拍目 レーン 2、続く点 1 小節目 2 拍目 レーン 2、終端 離す',
            )
          })

          it('小節数が 1 で、ホイールを上へ 100 ピクセル分 3 回回してスクロール位置が 1 小節目 3 拍目の 29/48 拍後のとき、1 小節目 4 拍目の 3/4 拍後・レーン 2 でマウスを押し、タイムラインの上端より上で離すと、譜面のノーツの代替コンテンツに「ロングノーツ 始点 1 小節目 4 拍目の 3/4 拍後 レーン 2、続く点 2 小節目 1 拍目 レーン 2、終端 離す」が出る', async () => {
            const app = await startApp({ barCount: 1 })
            await app.timeline.wheel('up', { pixels: 100 })
            await app.timeline.wheel('up', { pixels: 100 })
            await app.timeline.wheel('up', { pixels: 100 })
            expect(app.timeline.scrollPosition()).toBe('1 小節目 3 拍目の 29/48 拍後')

            await app.timeline.drag(at(3600, 2), aboveTimelineTop(2))

            expect(app.timeline.notes()).toContain(
              'ロングノーツ 始点 1 小節目 4 拍目の 3/4 拍後 レーン 2、続く点 2 小節目 1 拍目 レーン 2、終端 離す',
            )
          })
        })
      })

      describe('始点 1 小節目 1 拍目・レーン 1、終端 1 小節目 3 拍目・レーン 1 で終端フリックがないロングノーツだけがあるとき', () => {
        it.each([
          ['1 小節目 2 拍目・レーン 2 をクリックすると', 'タップノーツ 1 小節目 2 拍目 レーン 2', at(960, 2)],
          [
            '終端より後の 1 小節目 4 拍目・レーン 1 をクリックすると',
            'タップノーツ 1 小節目 4 拍目 レーン 1',
            at(2880, 1),
          ],
        ])('%s、譜面のノーツの代替コンテンツに「%s」が加わる', async (_operation, expected, position) => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1])

          await app.timeline.click(position)

          expect(app.timeline.notes()).toContain(expected)
        })

        describe('ドラッグ', () => {
          it.each([
            [
              '隣のレーンの 1 小節目 2 拍目・レーン 2 から 1 小節目 4 拍目・レーン 2 までドラッグして離すと',
              'ロングノーツ 始点 1 小節目 2 拍目 レーン 2、続く点 1 小節目 4 拍目 レーン 2、終端 離す',
              at(960, 2),
              at(2880, 2),
            ],
            [
              '終端より後の 1 小節目 4 拍目・レーン 1 から 2 小節目 1 拍目・レーン 1 までドラッグして離すと',
              'ロングノーツ 始点 1 小節目 4 拍目 レーン 1、続く点 2 小節目 1 拍目 レーン 1、終端 離す',
              at(2880, 1),
              at(3840, 1),
            ],
          ])('%s、譜面のノーツの代替コンテンツに「%s」が加わる', async (_operation, expected, from, to) => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1])

            await app.timeline.drag(from, to)

            expect(app.timeline.notes()).toContain(expected)
          })
        })
      })
    })

    describe('異常系', () => {
      describe('1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツだけがあるとき', () => {
        describe('ノーツのある位置のクリック', () => {
          it('1 小節目 1 拍目の 1/2 拍後の 10 ピクセル上・レーン 2 の中央をクリックすると、画面の下のメッセージに「同じ位置にノーツがあります」が表示される', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [tapAt480Lane2])

            await app.timeline.click(at(480, 2, { up: 10 }))

            expect(app.notice(SAME_POSITION_NOTICE)).toBeInTheDocument()
          })

          it('1 小節目 1 拍目の 1/2 拍後の 10 ピクセル上・レーン 2 の中央をクリックしても、新しいノーツは置かれず、譜面のノーツの代替コンテンツは「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」の 1 項目のままになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [tapAt480Lane2])
            await expectRejectedWith(app, SAME_POSITION_NOTICE, () => app.timeline.click(at(480, 2, { up: 10 })))

            expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
          })

          it('1 小節目 1 拍目の 1/2 拍後の 10 ピクセル上・レーン 2 の中央をクリックして「同じ位置にノーツがあります」が表示されたあと、1 小節目 1 拍目の 3/4 拍後・レーン 2 をクリックすると、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」と「タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2」の 2 項目だけになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [tapAt480Lane2])
            await expectRejectedWith(app, SAME_POSITION_NOTICE, () => app.timeline.click(at(480, 2, { up: 10 })))

            await app.timeline.click(at(720, 2))

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
            ])
          })
        })

        describe('ノーツのある位置からのドラッグ', () => {
          it('1 小節目 1 拍目の 1/2 拍後の 10 ピクセル上・レーン 2 の中央から 1 小節目 2 拍目の 1/2 拍後・レーン 2 までドラッグして離すと、画面の下のメッセージに「同じ位置にノーツがあります」が表示される', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [tapAt480Lane2])

            await app.timeline.drag(at(480, 2, { up: 10 }), at(1440, 2))

            expect(app.notice(SAME_POSITION_NOTICE)).toBeInTheDocument()
          })

          it('1 小節目 1 拍目の 1/2 拍後の 10 ピクセル上・レーン 2 の中央から 1 小節目 2 拍目の 1/2 拍後・レーン 2 までドラッグして離しても、ロングノーツは作られず、譜面のノーツの代替コンテンツは「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」の 1 項目のままになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [tapAt480Lane2])
            await expectRejectedWith(app, SAME_POSITION_NOTICE, () =>
              app.timeline.drag(at(480, 2, { up: 10 }), at(1440, 2)),
            )

            expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
          })
        })
      })

      describe('始点 1 小節目 1 拍目・レーン 1、終端 1 小節目 3 拍目・レーン 1 で終端フリックがないロングノーツだけがあるとき', () => {
        describe('ロングノーツの上のクリック', () => {
          it('1 小節目 2 拍目・レーン 1 をクリックすると、画面の下のメッセージに「ロングノーツの上には、タップノーツとフリックノーツを置けません」が表示される', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1])

            await app.timeline.click(at(960, 1))

            expect(app.notice(SHORT_NOTE_ON_LONG_NOTICE)).toBeInTheDocument()
          })

          it('1 小節目 2 拍目・レーン 1 をクリックしても、タップノーツは置かれず、譜面のノーツの代替コンテンツは「ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 3 拍目 レーン 1、終端 離す」の 1 項目のままになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1])
            await expectRejectedWith(app, SHORT_NOTE_ON_LONG_NOTICE, () => app.timeline.click(at(960, 1)))

            expect(app.timeline.notes()).toEqual([
              'ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 3 拍目 レーン 1、終端 離す',
            ])
          })
        })

        describe('同じレーンで時間が重なるドラッグ', () => {
          it('1 小節目 2 拍目・レーン 1 から 1 小節目 4 拍目・レーン 1 までドラッグして離すと、画面の下のメッセージに「ロングノーツは、ほかのロングノーツと重ねられません」が表示される', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1])

            await app.timeline.drag(at(960, 1), at(2880, 1))

            expect(app.notice(LONG_ON_LONG_NOTICE)).toBeInTheDocument()
          })

          it('1 小節目 2 拍目・レーン 1 から 1 小節目 4 拍目・レーン 1 までドラッグして離しても、ロングノーツは作られず、譜面のノーツの代替コンテンツは「ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 3 拍目 レーン 1、終端 離す」の 1 項目のままになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1])
            await expectRejectedWith(app, LONG_ON_LONG_NOTICE, () => app.timeline.drag(at(960, 1), at(2880, 1)))

            expect(app.timeline.notes()).toEqual([
              'ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 3 拍目 レーン 1、終端 離す',
            ])
          })
        })
      })

      describe('始点 1 小節目 1 拍目・レーン 0、終端 1 小節目 3 拍目・レーン 4 で終端フリックがないロングノーツだけがあるとき', () => {
        describe('途中でレーン 2 を横切られるドラッグ', () => {
          it('1 小節目 1 拍目の 1/2 拍後・レーン 2 から 1 小節目 2 拍目の 1/2 拍後・レーン 2 までドラッグして離すと、画面の下のメッセージに「ロングノーツは、ほかのロングノーツと重ねられません」が表示される', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom0To1920ReleasedFromLane0ToLane4])

            await app.timeline.drag(at(480, 2), at(1440, 2))

            expect(app.notice(LONG_ON_LONG_NOTICE)).toBeInTheDocument()
          })

          it('1 小節目 1 拍目の 1/2 拍後・レーン 2 から 1 小節目 2 拍目の 1/2 拍後・レーン 2 までドラッグして離しても、ロングノーツは作られず、譜面のノーツの代替コンテンツは「ロングノーツ 始点 1 小節目 1 拍目 レーン 0、続く点 1 小節目 3 拍目 レーン 4、終端 離す」の 1 項目のままになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom0To1920ReleasedFromLane0ToLane4])
            await expectRejectedWith(app, LONG_ON_LONG_NOTICE, () => app.timeline.drag(at(480, 2), at(1440, 2)))

            expect(app.timeline.notes()).toEqual([
              'ロングノーツ 始点 1 小節目 1 拍目 レーン 0、続く点 1 小節目 3 拍目 レーン 4、終端 離す',
            ])
          })
        })
      })

      describe('1 小節目 2 拍目・レーン 1 のタップノーツだけがあるとき', () => {
        describe('タップノーツの上を通るドラッグ', () => {
          it('1 小節目 1 拍目・レーン 1 から 1 小節目 3 拍目・レーン 1 までドラッグして離すと、画面の下のメッセージに「ロングノーツの上には、タップノーツとフリックノーツを置けません」が表示される', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [tapAt960Lane1])

            await app.timeline.drag(at(0, 1), at(1920, 1))

            expect(app.notice(SHORT_NOTE_ON_LONG_NOTICE)).toBeInTheDocument()
          })

          it('1 小節目 1 拍目・レーン 1 から 1 小節目 3 拍目・レーン 1 までドラッグして離しても、ロングノーツは作られず、譜面のノーツの代替コンテンツは「タップノーツ 1 小節目 2 拍目 レーン 1」の 1 項目のままになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [tapAt960Lane1])
            await expectRejectedWith(app, SHORT_NOTE_ON_LONG_NOTICE, () => app.timeline.drag(at(0, 1), at(1920, 1)))

            expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 2 拍目 レーン 1'])
          })
        })
      })

      describe('ノーツがないとき', () => {
        describe('テンポ列の上までのドラッグ', () => {
          it('1 小節目 1 拍目の 1/2 拍後・レーン 2 から、テンポ列の 1 小節目 2 拍目の 1/2 拍後の位置までドラッグして離しても、ロングノーツは作られず、譜面のノーツの代替コンテンツは空のままになる', async () => {
            const app = await startApp()

            await app.timeline.drag(at(480, 2), tempoColumnAt(1440))

            expect(app.timeline.notes()).toEqual([])
          })

          it('1 小節目 1 拍目の 1/2 拍後・レーン 2 から、テンポ列の 1 小節目 2 拍目の 1/2 拍後の位置までドラッグして離しても、画面の下にメッセージは表示されない', async () => {
            const app = await startApp()

            await app.timeline.drag(at(480, 2), tempoColumnAt(1440))

            expect(app.noticeTexts()).toEqual([])
          })
        })

        describe('始点とレーンだけが違う点までのドラッグ', () => {
          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 から 1 小節目 1 拍目の 1/2 拍後・レーン 3 までドラッグして離すと、画面の下のメッセージに「ロングノーツの点は、前の点より後、次の点より前の時間に置いてください」が表示される', async () => {
            const app = await startApp()

            await app.timeline.drag(at(480, 1), at(480, 3))

            expect(app.notice(LONG_ORDER_NOTICE)).toBeInTheDocument()
          })

          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 から 1 小節目 1 拍目の 1/2 拍後・レーン 3 までドラッグして離しても、ロングノーツは作られず、譜面のノーツの代替コンテンツは空のままになる', async () => {
            const app = await startApp()
            await expectRejectedWith(app, LONG_ORDER_NOTICE, () => app.timeline.drag(at(480, 1), at(480, 3)))

            expect(app.timeline.notes()).toEqual([])
          })
        })
      })
    })
  })

  describe('ノーツの上からのドラッグ', () => {
    describe('正常系', () => {
      describe('始点 1 小節目 1 拍目の 1/2 拍後・レーン 2、終端 1 小節目 2 拍目の 1/2 拍後・レーン 2 で終端フリックがないロングノーツだけがあるとき', () => {
        describe('ロングノーツの終端からのドラッグ', () => {
          it.each([
            [
              '終端から 1 小節目 3 拍目の 1/2 拍後・レーン 4 までドラッグして離すと',
              'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、1 小節目 3 拍目の 1/2 拍後 レーン 4、終端 離す',
              at(2400, 4),
            ],
            [
              '終端から 1 小節目 2 拍目の 3/4 拍後・レーン 2 までドラッグして離すと',
              'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、1 小節目 2 拍目の 3/4 拍後 レーン 2、終端 離す',
              at(1680, 2),
            ],
          ])('%s、譜面のノーツの代替コンテンツは、「%s」の 1 項目だけになる', async (_operation, expected, to) => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom480To1440ReleasedAtLane2])

            await app.timeline.drag(at(1440, 2), to)

            expect(app.timeline.notes()).toEqual([expected])
          })
        })
      })

      it('始点 1 小節目 1 拍目の 1/2 拍後・レーン 2、終端 1 小節目 2 拍目の 1/2 拍後・レーン 2 で右の終端フリックがあるロングノーツだけがあるとき、終端から 1 小節目 3 拍目の 1/2 拍後・レーン 4 までドラッグして離すと、譜面のノーツの代替コンテンツは、「ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、1 小節目 3 拍目の 1/2 拍後 レーン 4、終端 離す」の 1 項目だけになる', async () => {
        const app = await startApp()
        await loadChartWithoutFocus(app, [longFrom480To1440FlickedRightAtLane2])

        await app.timeline.drag(at(1440, 2), at(2400, 4))

        expect(app.timeline.notes()).toEqual([
          'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、1 小節目 3 拍目の 1/2 拍後 レーン 4、終端 離す',
        ])
      })
    })

    describe('異常系', () => {
      describe('始点 1 小節目 1 拍目の 1/2 拍後・レーン 2、終端 1 小節目 2 拍目の 1/2 拍後・レーン 2 で終端フリックがないロングノーツだけがあるとき', () => {
        describe('ロングノーツの終端からのドラッグ', () => {
          it.each([
            ['終端から 1 小節目 2 拍目・レーン 2 までドラッグして離すと', at(960, 2)],
            ['終端から 1 小節目 2 拍目の 1/2 拍後・レーン 4 までドラッグして離すと', at(1440, 4)],
          ])(
            '%s、画面の下のメッセージに「ロングノーツの点は、前の点より後、次の点より前の時間に置いてください」が表示される',
            async (_operation, to) => {
              const app = await startApp()
              await loadChartWithoutFocus(app, [longFrom480To1440ReleasedAtLane2])

              await app.timeline.drag(at(1440, 2), to)

              expect(app.notice(LONG_ORDER_NOTICE)).toBeInTheDocument()
            },
          )

          it('終端から 1 小節目 2 拍目の 1/2 拍後・レーン 4 までドラッグして離しても、終端は動かず、譜面のノーツの代替コンテンツは「ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、終端 離す」の 1 項目のままになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom480To1440ReleasedAtLane2])
            await expectRejectedWith(app, LONG_ORDER_NOTICE, () => app.timeline.drag(at(1440, 2), at(1440, 4)))

            expect(app.timeline.notes()).toEqual([
              'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、終端 離す',
            ])
          })
        })
      })

      describe('始点 1 小節目 1 拍目・レーン 1、終端 1 小節目 2 拍目・レーン 1 のロングノーツと、始点 1 小節目 3 拍目・レーン 1、終端 1 小節目 4 拍目・レーン 1 のロングノーツがあるとき', () => {
        describe('1 つ目のロングノーツの終端からのドラッグ', () => {
          it('終端から 1 小節目 4 拍目の 1/2 拍後・レーン 1 までドラッグして離すと、画面の下のメッセージに「ロングノーツは、ほかのロングノーツと重ねられません」が表示される', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom0To960ReleasedAtLane1, longFrom1920To2880ReleasedAtLane1])

            await app.timeline.drag(at(960, 1), at(3360, 1))

            expect(app.notice(LONG_ON_LONG_NOTICE)).toBeInTheDocument()
          })

          it('終端から 1 小節目 4 拍目の 1/2 拍後・レーン 1 までドラッグして離しても、ロングノーツは伸びず、譜面のノーツの代替コンテンツは、「ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 2 拍目 レーン 1、終端 離す」と「ロングノーツ 始点 1 小節目 3 拍目 レーン 1、続く点 1 小節目 4 拍目 レーン 1、終端 離す」の 2 項目のままになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longFrom0To960ReleasedAtLane1, longFrom1920To2880ReleasedAtLane1])
            await expectRejectedWith(app, LONG_ON_LONG_NOTICE, () => app.timeline.drag(at(960, 1), at(3360, 1)))

            expect(app.timeline.notes()).toEqual([
              'ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 2 拍目 レーン 1、終端 離す',
              'ロングノーツ 始点 1 小節目 3 拍目 レーン 1、続く点 1 小節目 4 拍目 レーン 1、終端 離す',
            ])
          })
        })
      })

      describe('始点 1 小節目 1 拍目の 1/2 拍後・レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後・レーン 2 と 1 小節目 3 拍目の 1/2 拍後・レーン 2 のロングノーツだけがあるとき', () => {
        describe('終端以外の点の上からの、Shift を押さないドラッグ', () => {
          it('始点から 1 小節目 4 拍目の 1/2 拍後・レーン 4 まで Shift を押さずにドラッグして離すと、画面の下のメッセージに「ロングノーツを伸ばせるのは、最後の終端からのドラッグだけです。点を動かすときは、Shift を押しながらドラッグしてください」が表示される', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longThroughRelayPoint])

            await app.timeline.drag(at(480, 2), at(3360, 4))

            expect(app.notice(EXTEND_NOTICE)).toBeInTheDocument()
          })

          it('始点から 1 小節目 4 拍目の 1/2 拍後・レーン 4 まで Shift を押さずにドラッグして離しても、ロングノーツは伸びず、譜面のノーツの代替コンテンツは「ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、1 小節目 3 拍目の 1/2 拍後 レーン 2、終端 離す」の 1 項目のままになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longThroughRelayPoint])
            await expectRejectedWith(app, EXTEND_NOTICE, () => app.timeline.drag(at(480, 2), at(3360, 4)))

            expect(app.timeline.notes()).toEqual([
              'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、1 小節目 3 拍目の 1/2 拍後 レーン 2、終端 離す',
            ])
          })
        })
      })
    })
  })

  describe('ノーツの右クリック', () => {
    describe('正常系', () => {
      it('1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツだけがあるとき、そのタップノーツを右クリックすると、ノーツは削除され、譜面のノーツの代替コンテンツは空になる', async () => {
        const app = await startApp()
        await loadChartWithoutFocus(app, [tapAt480Lane2])

        await app.timeline.rightClick(at(480, 2))

        expect(app.timeline.notes()).toEqual([])
      })

      it('1 小節目 1 拍目の 1/2 拍後・レーン 2 と 1 小節目 1 拍目の 3/4 拍後・レーン 3 のタップノーツがあるとき、1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツを右クリックすると、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 3」の 1 項目だけになる', async () => {
        const app = await startApp()
        await loadChartWithoutFocus(app, [tapAt480Lane2, tapAt720Lane3])

        await app.timeline.rightClick(at(480, 2))

        expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 3'])
      })

      describe('始点 1 小節目 1 拍目・レーン 1、続く点 1 小節目 1 拍目の 1/2 拍後・レーン 3、1 小節目 2 拍目・レーン 0、1 小節目 2 拍目の 1/2 拍後・レーン 2 で右の終端フリックがあるロングノーツだけがあるとき', () => {
        it.each([
          ['始点 (1 小節目 1 拍目・レーン 1) を右クリックすると', at(0, 1)],
          ['1 つ目の続く点 (1 小節目 1 拍目の 1/2 拍後・レーン 3) を右クリックすると', at(480, 3)],
        ])('%s、ノーツは削除され、譜面のノーツの代替コンテンツは空になる', async (_operation, target) => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [longWithFourPointsAndRightFlick])

          await app.timeline.rightClick(target)

          expect(app.timeline.notes()).toEqual([])
        })

        it.each([
          [
            '2 つ目の続く点 (1 小節目 2 拍目・レーン 0) を右クリックすると',
            'ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 1 拍目の 1/2 拍後 レーン 3、終端 離す',
            at(960, 0),
          ],
          [
            '終端 (1 小節目 2 拍目の 1/2 拍後・レーン 2) を右クリックすると',
            'ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 1 拍目の 1/2 拍後 レーン 3、1 小節目 2 拍目 レーン 0、終端 離す',
            at(1440, 2),
          ],
        ])('%s、譜面のノーツの代替コンテンツは、「%s」の 1 項目だけになる', async (_operation, expected, target) => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [longWithFourPointsAndRightFlick])

          await app.timeline.rightClick(target)

          expect(app.timeline.notes()).toEqual([expected])
        })
      })

      describe('ロングノーツの点と点の間の本体を右クリックするとき', () => {
        it.each([
          [
            '始点 1 小節目 1 拍目・レーン 1、終端 1 小節目 2 拍目・レーン 1 で離すロングノーツだけがあり、始点と終端の真ん中 (1 小節目 1 拍目の 1/2 拍後・レーン 1)',
            longFrom0To960ReleasedAtLane1,
            at(480, 1),
          ],
          [
            '始点 1 小節目 1 拍目・レーン 1、続く点 1 小節目 1 拍目の 1/2 拍後・レーン 3 と 1 小節目 2 拍目・レーン 0、1 小節目 2 拍目の 1/2 拍後・レーン 2 で右の終端フリックがあるロングノーツだけがあり、始点と 1 つ目の続く点の真ん中 (1 小節目 1 拍目の 1/4 拍後・レーン 2)',
            longWithFourPointsAndRightFlick,
            at(240, 2),
          ],
        ])(
          '%s の本体を右クリックすると、ノーツは削除され、譜面のノーツの代替コンテンツは空になる',
          async (_given, note, target) => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [note])

            await app.timeline.rightClick(target)

            expect(app.timeline.notes()).toEqual([])
          },
        )
      })
    })
  })

  describe('Shift を押しながらのドラッグ', () => {
    describe('正常系', () => {
      it('1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツだけがあるとき、そのタップノーツの上から Shift を押しながら 1 小節目 2 拍目・レーン 3 までドラッグして離すと、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 2 拍目 レーン 3」の 1 項目だけになる', async () => {
        const app = await startApp()
        await loadChartWithoutFocus(app, [tapAt480Lane2])

        await app.timeline.dragWithShift(at(480, 2), at(960, 3))

        expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 2 拍目 レーン 3'])
      })

      describe('始点 1 小節目 1 拍目・レーン 1、続く点 1 小節目 1 拍目の 1/2 拍後・レーン 3 と 1 小節目 2 拍目・レーン 0 のロングノーツだけがあるとき', () => {
        describe('1 つ目の続く点 (1 小節目 1 拍目の 1/2 拍後・レーン 3) の上から Shift を押しながらドラッグするとき', () => {
          it.each([
            [
              '1 小節目 1 拍目の 3/4 拍後・レーン 2 までドラッグして離すと',
              'ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 1 拍目の 3/4 拍後 レーン 2、1 小節目 2 拍目 レーン 0、終端 離す',
              at(720, 2),
            ],
            [
              '始点 (1 小節目 1 拍目) より後の 1 小節目 1 拍目の 1/4 拍後・レーン 2 までドラッグして離すと',
              'ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 1 拍目の 1/4 拍後 レーン 2、1 小節目 2 拍目 レーン 0、終端 離す',
              at(240, 2),
            ],
          ])('%s、譜面のノーツの代替コンテンツは、「%s」の 1 項目だけになる', async (_operation, expected, to) => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longForMovingRelayPoint])

            await app.timeline.dragWithShift(at(480, 3), to)

            expect(app.timeline.notes()).toEqual([expected])
          })
        })
      })

      describe('始点 1 小節目 1 拍目・レーン 1、終端 1 小節目 3 拍目・レーン 1 で終端フリックがないロングノーツだけがあるとき', () => {
        it('本体の真ん中の 1 小節目 2 拍目・レーン 1 から Shift を押しながら 2 小節目 1 拍目・レーン 2 までドラッグして離すと、ロングノーツ全体が 3 拍後ろ・1 レーン隣へ動き、譜面のノーツの代替コンテンツは「ロングノーツ 始点 1 小節目 4 拍目 レーン 2、続く点 2 小節目 2 拍目 レーン 2、終端 離す」の 1 項目だけになる', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1])

          await app.timeline.dragWithShift(at(960, 1), at(3840, 2))

          expect(app.timeline.notes()).toEqual([
            'ロングノーツ 始点 1 小節目 4 拍目 レーン 2、続く点 2 小節目 2 拍目 レーン 2、終端 離す',
          ])
        })
      })
    })

    describe('異常系', () => {
      describe('始点 1 小節目 1 拍目・レーン 1、続く点 1 小節目 1 拍目の 1/2 拍後・レーン 3 と 1 小節目 2 拍目・レーン 0 のロングノーツだけがあるとき', () => {
        describe('1 つ目の続く点 (1 小節目 1 拍目の 1/2 拍後・レーン 3) の上から Shift を押しながらドラッグするとき', () => {
          it.each([
            ['終端と同じ 1 小節目 2 拍目のレーン 2 までドラッグして離すと', at(960, 2)],
            ['始点と同じ 1 小節目 1 拍目のレーン 2 までドラッグして離すと', at(0, 2)],
          ])(
            '%s、画面の下のメッセージに「ロングノーツの点は、前の点より後、次の点より前の時間に置いてください」が表示される',
            async (_operation, to) => {
              const app = await startApp()
              await loadChartWithoutFocus(app, [longForMovingRelayPoint])

              await app.timeline.dragWithShift(at(480, 3), to)

              expect(app.notice(LONG_ORDER_NOTICE)).toBeInTheDocument()
            },
          )

          it('終端と同じ 1 小節目 2 拍目のレーン 2 までドラッグして離しても、点は動かず、譜面のノーツの代替コンテンツは「ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 1 拍目の 1/2 拍後 レーン 3、1 小節目 2 拍目 レーン 0、終端 離す」の 1 項目のままになる', async () => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [longForMovingRelayPoint])
            await expectRejectedWith(app, LONG_ORDER_NOTICE, () => app.timeline.dragWithShift(at(480, 3), at(960, 2)))

            expect(app.timeline.notes()).toEqual([
              'ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 1 拍目の 1/2 拍後 レーン 3、1 小節目 2 拍目 レーン 0、終端 離す',
            ])
          })
        })
      })

      describe('始点 1 小節目 1 拍目・レーン 1、終端 1 小節目 3 拍目・レーン 1 のロングノーツと、始点 2 小節目 1 拍目・レーン 2、終端 2 小節目 2 拍目・レーン 2 のロングノーツがあるとき', () => {
        it('1 つ目のロングノーツの本体の真ん中の 1 小節目 2 拍目・レーン 1 から Shift を押しながら 2 小節目 1 拍目・レーン 2 までドラッグして離すと、画面の下のメッセージに「ロングノーツは、ほかのロングノーツと重ねられません」が表示される', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1, longFrom3840To4800ReleasedAtLane2])

          await app.timeline.dragWithShift(at(960, 1), at(3840, 2))

          expect(app.notice(LONG_ON_LONG_NOTICE)).toBeInTheDocument()
        })

        it('1 つ目のロングノーツの本体の真ん中の 1 小節目 2 拍目・レーン 1 から Shift を押しながら 2 小節目 1 拍目・レーン 2 までドラッグして離しても、ロングノーツは動かず、譜面のノーツの代替コンテンツは、元の 2 項目のままになる', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1, longFrom3840To4800ReleasedAtLane2])
          await expectRejectedWith(app, LONG_ON_LONG_NOTICE, () => app.timeline.dragWithShift(at(960, 1), at(3840, 2)))

          expect(app.timeline.notes()).toEqual([
            'ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 3 拍目 レーン 1、終端 離す',
            'ロングノーツ 始点 2 小節目 1 拍目 レーン 2、続く点 2 小節目 2 拍目 レーン 2、終端 離す',
          ])
        })
      })

      describe('始点 1 小節目 1 拍目・レーン 1、終端 1 小節目 3 拍目・レーン 1 で終端フリックがないロングノーツだけがあるとき', () => {
        it('本体の真ん中の 1 小節目 2 拍目・レーン 1 から Shift を押しながら 1 小節目 1 拍目・レーン 1 までドラッグして離すと、ロングノーツの始点が 1 小節目 1 拍目より前になり、画面の下のメッセージに「ノーツが、先頭より前か、レーンの範囲外になります。位置をずらすか、レーン数を増やしてください」が表示される', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1])

          await app.timeline.dragWithShift(at(960, 1), at(0, 1))

          expect(app.notice(OUT_OF_LANE_NOTICE)).toBeInTheDocument()
        })

        it('本体の真ん中の 1 小節目 2 拍目・レーン 1 から Shift を押しながら 1 小節目 1 拍目・レーン 1 までドラッグして離しても、ロングノーツは動かず、譜面のノーツの代替コンテンツは「ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 3 拍目 レーン 1、終端 離す」の 1 項目のままになる', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [longFrom0To1920ReleasedAtLane1])
          await expectRejectedWith(app, OUT_OF_LANE_NOTICE, () => app.timeline.dragWithShift(at(960, 1), at(0, 1)))

          expect(app.timeline.notes()).toEqual([
            'ロングノーツ 始点 1 小節目 1 拍目 レーン 1、続く点 1 小節目 3 拍目 レーン 1、終端 離す',
          ])
        })
      })

      describe('1 小節目 1 拍目の 1/2 拍後・レーン 1 と 1 小節目 1 拍目の 3/4 拍後・レーン 2 のタップノーツがあるとき', () => {
        it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツの上から Shift を押しながら 1 小節目 1 拍目の 3/4 拍後・レーン 2 までドラッグして離すと、画面の下のメッセージに「同じ位置にノーツがあります」が表示される', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [tapAt480Lane1, tapAt720Lane2])

          await app.timeline.dragWithShift(at(480, 1), at(720, 2))

          expect(app.notice(SAME_POSITION_NOTICE)).toBeInTheDocument()
        })

        it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツの上から Shift を押しながら 1 小節目 1 拍目の 3/4 拍後・レーン 2 までドラッグして離しても、タップノーツは動かず、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1」と「タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2」の 2 項目のままになる', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [tapAt480Lane1, tapAt720Lane2])
          await expectRejectedWith(app, SAME_POSITION_NOTICE, () => app.timeline.dragWithShift(at(480, 1), at(720, 2)))

          expect(app.timeline.notes()).toEqual([
            'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
            'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
          ])
        })
      })
    })
  })
})

describe('[ノーツの編集] フリックを付けられる点', () => {
  describe('矢印キーの押下', () => {
    describe('正常系', () => {
      describe('1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツだけがあり、そのタップノーツの上にマウスを置いているとき', () => {
        it.each([
          ['上向きの矢印キー', '上フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2', '↑'],
          ['左向きの矢印キー', '左フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2', '←'],
          ['右向きの矢印キー', '右フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2', '→'],
        ])('%sを押すと、譜面のノーツの代替コンテンツに「%s」が出る', async (_keyName, expected, key) => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [tapAt480Lane2])
          await app.timeline.hover(at(480, 2))

          await app.press(key)

          expect(app.timeline.notes()).toContain(expected)
        })
      })

      it('始点 1 小節目 1 拍目の 1/2 拍後・レーン 2、終端 1 小節目 2 拍目の 1/2 拍後・レーン 2 で終端フリックがないロングノーツだけがあり、その終端の上にマウスを置いているとき、右向きの矢印キーを押すと、譜面のノーツの代替コンテンツに「ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、終端 右フリック」が出る', async () => {
        const app = await startApp()
        await loadChartWithoutFocus(app, [longFrom480To1440ReleasedAtLane2])
        await app.timeline.hover(at(1440, 2))

        await app.press('→')

        expect(app.timeline.notes()).toContain(
          'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、終端 右フリック',
        )
      })
    })

    describe('異常系', () => {
      describe('始点 1 小節目 1 拍目の 1/2 拍後・レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後・レーン 2 と 1 小節目 3 拍目の 1/2 拍後・レーン 2 のロングノーツだけがあり、その始点の上にマウスを置いているとき', () => {
        it('上向きの矢印キーを押すと、画面の下のメッセージに「フリックを付けられるのは、ロングノーツの最後の終端だけです」が表示される', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [longThroughRelayPoint])
          await app.timeline.hover(at(480, 2))

          await app.press('↑')

          expect(app.notice(FLICK_END_ONLY_NOTICE)).toBeInTheDocument()
        })

        it('上向きの矢印キーを押しても、フリックは付かず、譜面のノーツの代替コンテンツは「ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、1 小節目 3 拍目の 1/2 拍後 レーン 2、終端 離す」の 1 項目のままになる', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [longThroughRelayPoint])
          await app.timeline.hover(at(480, 2))
          await expectRejectedWith(app, FLICK_END_ONLY_NOTICE, () => app.press('↑'))

          expect(app.timeline.notes()).toEqual([
            'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、1 小節目 3 拍目の 1/2 拍後 レーン 2、終端 離す',
          ])
        })
      })
    })
  })
})

describe('[ノーツの編集] フリックの解除', () => {
  describe('矢印キーの押下', () => {
    describe('正常系', () => {
      it.each([
        [
          '1 小節目 1 拍目の 1/2 拍後・レーン 2 の上フリックノーツだけがあり、その上フリックノーツの上にマウスを置いているとき',
          'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2',
          upFlickAt480Lane2,
          at(480, 2),
        ],
        [
          '始点 1 小節目 1 拍目の 1/2 拍後・レーン 2、終端 1 小節目 2 拍目の 1/2 拍後・レーン 2 で右の終端フリックがあるロングノーツだけがあり、その終端の上にマウスを置いているとき',
          'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、終端 離す',
          longFrom480To1440FlickedRightAtLane2,
          at(1440, 2),
        ],
      ])(
        '%s、下向きの矢印キーを押すと、譜面のノーツの代替コンテンツに「%s」が出る',
        async (_condition, expected, note, hover) => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [note])
          await app.timeline.hover(hover)

          await app.press('↓')

          expect(app.timeline.notes()).toContain(expected)
        },
      )
    })

    describe('異常系', () => {
      describe('1 小節目 1 拍目の 1/2 拍後・レーン 0 のタップノーツと、始点 1 小節目 1 拍目の 1/2 拍後・レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後・レーン 2 と 1 小節目 3 拍目の 1/2 拍後・レーン 2 のロングノーツがあるとき', () => {
        it.each([
          {
            condition: 'フリックがないタップノーツ (1 小節目 1 拍目の 1/2 拍後・レーン 0) の上にマウスを置いて',
            tick: 480,
            lane: 0,
          },
          {
            condition: 'フリックがないロングノーツの始点 (1 小節目 1 拍目の 1/2 拍後・レーン 2) の上にマウスを置いて',
            tick: 480,
            lane: 2,
          },
          {
            condition: 'フリックがないロングノーツの終端 (1 小節目 3 拍目の 1/2 拍後・レーン 2) の上にマウスを置いて',
            tick: 2400,
            lane: 2,
          },
        ])(
          '$condition、下向きの矢印キーを押すと、画面の下のメッセージに「この点にはフリックがないため、解除できません」が表示される',
          async ({ tick, lane }) => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [tapAt480Lane0, longThroughRelayPoint])
            await app.timeline.hover(at(tick, lane))

            await app.press('↓')

            expect(app.notice(NO_FLICK_NOTICE)).toBeInTheDocument()
          },
        )

        it('フリックがないタップノーツ (1 小節目 1 拍目の 1/2 拍後・レーン 0) の上にマウスを置いて下向きの矢印キーを押しても、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 0」と「ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、1 小節目 3 拍目の 1/2 拍後 レーン 2、終端 離す」の 2 項目のままになる', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [tapAt480Lane0, longThroughRelayPoint])
          await app.timeline.hover(at(480, 0))
          await expectRejectedWith(app, NO_FLICK_NOTICE, () => app.press('↓'))

          expect(app.timeline.notes()).toEqual([
            'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 0',
            'ロングノーツ 始点 1 小節目 1 拍目の 1/2 拍後 レーン 2、続く点 1 小節目 2 拍目の 1/2 拍後 レーン 2、1 小節目 3 拍目の 1/2 拍後 レーン 2、終端 離す',
          ])
        })
      })
    })
  })
})

describe('[ノーツの編集] マウスを置いたノーツの点', () => {
  describe('矢印キーの押下', () => {
    describe('異常系', () => {
      describe('1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツだけがあるとき', () => {
        it('そのタップノーツの上にマウスを置いて右クリックで削除したあと、マウスを動かさずに上向きの矢印キーを押すと、画面の下のメッセージに「ノーツの点が見つかりません。ノーツの上にマウスを置いて、もう一度操作してください」が表示される', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [tapAt480Lane2])
          await app.timeline.hover(at(480, 2))
          await app.timeline.rightClick(at(480, 2))

          await app.press('↑')

          expect(app.notice(POINT_NOT_FOUND_NOTICE)).toBeInTheDocument()
        })

        it('そのタップノーツの上にマウスを置いて右クリックで削除したあと、マウスを動かさずに上向きの矢印キーを押しても、削除したタップノーツは戻らず、譜面のノーツの代替コンテンツは空のままになる', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [tapAt480Lane2])
          await app.timeline.hover(at(480, 2))
          await app.timeline.rightClick(at(480, 2))
          expect(app.timeline.notes()).toEqual([])

          await pressKey(app, '↑')

          expect(app.timeline.notes()).toEqual([])
        })

        it.each([
          ['上向きの矢印キー', '↑'],
          ['下向きの矢印キー', '↓'],
        ])(
          'マウスをノーツの上に置いていないとき、%sを押すと、画面の下のメッセージに「ノーツの点が見つかりません。ノーツの上にマウスを置いて、もう一度操作してください」が表示される',
          async (_keyName, key) => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [tapAt480Lane2])

            await app.press(key)

            expect(app.notice(POINT_NOT_FOUND_NOTICE)).toBeInTheDocument()
          },
        )

        it.each([
          ['上向きの矢印キー', '↑'],
          ['下向きの矢印キー', '↓'],
        ])(
          'マウスをノーツの上に置いていないとき、%sを押しても、タップノーツは変わらず、譜面のノーツの代替コンテンツは「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」の 1 項目のままになる',
          async (_keyName, key) => {
            const app = await startApp()
            await loadChartWithoutFocus(app, [tapAt480Lane2])
            await expectRejectedWith(app, POINT_NOT_FOUND_NOTICE, () => app.press(key))

            expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
          },
        )
      })
    })
  })
})

describe('[ノーツの個数の上限] ノーツの作成', () => {
  describe('ノーツが 3000 個あるとき', () => {
    describe('異常系', () => {
      it('ノーツのない 1 小節目 1 拍目の 1/4 拍後・レーン 2 をクリックすると、画面の下のメッセージに「ノーツは 3000 個までです」が表示され、新しいノーツは置かれず、譜面のノーツの代替コンテンツは 3000 項目のままになる', async () => {
        const app = await startWithMaxNotes()

        await expectRejectedWith(app, MAX_NOTES_NOTICE, () => app.timeline.click(at(240, 2)))

        expect(app.timeline.notes()).toHaveLength(3000)
      })

      it('1 小節目 1 拍目の 1/4 拍後・レーン 2 から 1 小節目 1 拍目の 3/4 拍後・レーン 2 までドラッグして離すと、画面の下のメッセージに「ノーツは 3000 個までです」が表示され、ロングノーツは作られず、譜面のノーツの代替コンテンツは 3000 項目のままになる', async () => {
        const app = await startWithMaxNotes()

        await expectRejectedWith(app, MAX_NOTES_NOTICE, () => app.timeline.drag(at(240, 2), at(720, 2)))

        expect(app.timeline.notes()).toHaveLength(3000)
      })
    })
  })
})
