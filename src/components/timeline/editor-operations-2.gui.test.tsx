import { describe, expect, it } from 'vitest'
import { startApp, type AppDriver } from '../../test/app.tsx'
import {
  expectRejectedWith,
  loadChartWithoutFocus,
  pressKey,
  startWithMaxNotes,
} from '../../test/editor-operations-1.helpers.ts'
import {
  choosePastePosition,
  pasteAt,
  pasteWithButtonAt,
  selectBothTaps,
  selectTap480Lane1,
  startWithBothTapsCopied,
  startWithLongNoteEndingInRightFlick,
  startWithLongNoteWithoutEndFlick,
  startWithTapAndLeftFlick,
  startWithTapAt480Lane0,
  startWithTapAt480Lane0AndLane4,
  startWithTapsAt480Lane1AndLane3AndAt720Lane0,
  startWithTapsAt480Lane3AndAt720Lane1,
  startWithTapsAtBeat2Lane0AndBeat4Lane1,
  startWithTwoPlacedTaps,
  startWithTwoTaps,
  startWithUpFlick,
  zoomInWithCtrlWheel,
} from './editor-operations-2.helpers.ts'
import { at, tempoColumnAt } from '../../test/timeline.ts'

const SAME_POSITION_NOTICE = '同じ位置にノーツがあります'
const MAX_NOTES_NOTICE = 'ノーツは 3000 個までです'
const OUT_OF_LANE_NOTICE =
  'ノーツが、先頭より前か、レーンの範囲外になります。位置をずらすか、レーン数を増やしてください'
const NOTHING_SELECTED_NOTICE =
  'コピーするノーツが選択されていません。Shift を押しながらドラッグして、ノーツを選択してください'
const NOTHING_COPIED_NOTICE =
  '貼り付けるノーツがありません。ノーツを選択して、Ctrl+C (Mac は Cmd+C) でコピーしてください'
const PASTE_POSITION_UNKNOWN_NOTICE =
  '貼り付ける位置が決まっていません。マウスをノーツのレーンの上に置いて、もう一度貼り付けてください'
const NO_NOTES_TO_SELECT_NOTICE = '選択できるノーツがありません'
const NO_ROOM_TO_MOVE_NOTICE = '先頭より前には動かせません'

const pressCtrlA = (app: AppDriver): Promise<void> => app.press('Ctrl+A')
const pressCmdA = (app: AppDriver): Promise<void> => app.press('Cmd+A')
const clickSelectAllButton = (app: AppDriver): Promise<void> => app.click(app.button('全選択'))

const TWO_TAPS_WITH_TAP_PLACED_AT_BEAT_3_LANE_0 = [
  'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
  'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
  'タップノーツ 1 小節目 3 拍目 レーン 0',
]

const cancelByEscapeKey = (app: AppDriver): Promise<void> => app.press('Escape')
const cancelByPressingPasteAgain = (app: AppDriver): Promise<void> => app.click(app.button('貼り付け'))
const cancelByVisitingPreview = async (app: AppDriver): Promise<void> => {
  await app.selectTab('プレビュー')
  await app.selectTab('エディタ')
}

describe('[範囲選択] 選択したノーツ', () => {
  describe('正常系', () => {
    it('1 小節目 1 拍目の 1/2 拍後・レーン 0 のタップノーツだけがあり、選択していない (右のパネルの「左右反転」ボタンが押せない) とき、そのタップノーツを Shift を押しながらドラッグして囲むと、右のパネルの「左右反転」ボタンが押せる状態になる', async () => {
      const app = await startWithTapAt480Lane0()
      expect(app.button('左右反転')).toBeDisabled()

      await app.timeline.selectEnclosing([{ tick: 480, lane: 0 }])

      expect(app.button('左右反転')).toBeEnabled()
    })
  })

  describe('コピーと貼り付け', () => {
    describe('1 小節目 1 拍目の 1/2 拍後・レーン 1 と 1 小節目 1 拍目の 3/4 拍後・レーン 2 のタップノーツがあるとき', () => {
      describe('正常系', () => {
        describe('Ctrl+V の押下', () => {
          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツだけを選択して Ctrl+C でコピーし、1 小節目 3 拍目・レーン 0 にマウスを置いて Ctrl+V を押すと、譜面のノーツの代替コンテンツは、元の 2 項目と貼り付けた「タップノーツ 1 小節目 3 拍目 レーン 0」の 3 項目になる', async () => {
            const app = await startWithTwoTaps()
            await selectTap480Lane1(app)
            await app.press('Ctrl+C')

            await pasteAt(app, 'Ctrl+V', 1920, 0)

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
              'タップノーツ 1 小節目 3 拍目 レーン 0',
            ])
          })

          it('ノーツを Ctrl+C でコピーしたあと、Ctrl+V を押しても、「貼り付け」ボタンは押された状態にならない', async () => {
            const app = await startWithTwoTaps()
            await selectBothTaps(app)
            await app.press('Ctrl+C')

            await pasteAt(app, 'Ctrl+V', 1920, 0)

            expect(app.button('貼り付け')).toHaveAttribute('aria-pressed', 'false')
          })

          it('レーン数が 5 のとき、2 つのタップノーツを選択して Ctrl+C でコピーし、1 小節目 3 拍目・レーン 3 にマウスを置いて Ctrl+V を押すと、最後のレーン 4 に収まり、譜面のノーツの代替コンテンツは、元の 2 項目と貼り付けた「タップノーツ 1 小節目 3 拍目 レーン 3」「タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 4」の 4 項目になる', async () => {
            const app = await startWithTwoTaps()
            await selectBothTaps(app)
            await app.press('Ctrl+C')

            await pasteAt(app, 'Ctrl+V', 1920, 3)

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
              'タップノーツ 1 小節目 3 拍目 レーン 3',
              'タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 4',
            ])
          })

          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツだけを選択して Ctrl+C でコピーし、ノーツのある 1 小節目 1 拍目の 3/4 拍後・レーン 2 にマウスを置いて Ctrl+V を押すと、画面の下のメッセージに「同じ位置にノーツがあります」が表示される', async () => {
            const app = await startWithTwoTaps()
            await selectTap480Lane1(app)
            await app.press('Ctrl+C')

            await pasteAt(app, 'Ctrl+V', 720, 2)

            expect(app.notice(SAME_POSITION_NOTICE)).toBeInTheDocument()
          })

          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツだけを選択して Ctrl+C でコピーし、ノーツのある 1 小節目 1 拍目の 3/4 拍後・レーン 2 にマウスを置いて Ctrl+V を押しても、貼り付けは効かず、譜面のノーツの代替コンテンツは元の 2 項目のままになる', async () => {
            const app = await startWithTwoTaps()
            await selectTap480Lane1(app)
            await app.press('Ctrl+C')
            await expectRejectedWith(app, SAME_POSITION_NOTICE, () => pasteAt(app, 'Ctrl+V', 720, 2))

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
            ])
          })

          it('レーン数が 5 のとき、2 つのタップノーツを選択して Ctrl+C でコピーし、1 小節目 3 拍目・レーン 4 にマウスを置いて Ctrl+V を押すと、画面の下のメッセージに「ノーツが、先頭より前か、レーンの範囲外になります。位置をずらすか、レーン数を増やしてください」が表示される', async () => {
            const app = await startWithTwoTaps()
            await selectBothTaps(app)
            await app.press('Ctrl+C')

            await pasteAt(app, 'Ctrl+V', 1920, 4)

            expect(app.notice(OUT_OF_LANE_NOTICE)).toBeInTheDocument()
          })

          it('レーン数が 5 のとき、2 つのタップノーツを選択して Ctrl+C でコピーし、1 小節目 3 拍目・レーン 4 にマウスを置いて Ctrl+V を押しても、貼り付けは効かず、譜面のノーツの代替コンテンツは元の 2 項目のままになる', async () => {
            const app = await startWithTwoTaps()
            await selectBothTaps(app)
            await app.press('Ctrl+C')
            await expectRejectedWith(app, OUT_OF_LANE_NOTICE, () => pasteAt(app, 'Ctrl+V', 1920, 4))

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
            ])
          })

          it('ノーツをコピーしていないとき、Ctrl+V を押すと、画面の下のメッセージに「貼り付けるノーツがありません。ノーツを選択して、Ctrl+C (Mac は Cmd+C) でコピーしてください」が表示される', async () => {
            const app = await startWithTwoTaps()

            await pasteAt(app, 'Ctrl+V', 1920, 0)

            expect(app.notice(NOTHING_COPIED_NOTICE)).toBeInTheDocument()
          })

          it('ノーツをコピーしていないとき、Ctrl+V を押しても、貼り付けは効かず、譜面のノーツの代替コンテンツは元の 2 項目のままになる', async () => {
            const app = await startWithTwoTaps()
            await expectRejectedWith(app, NOTHING_COPIED_NOTICE, () => pasteAt(app, 'Ctrl+V', 1920, 0))

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
            ])
          })

          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツだけを選択して Ctrl+C でコピーし、マウスをテンポ列の 1 小節目 3 拍目の位置に置いて Ctrl+V を押すと、画面の下のメッセージに「貼り付ける位置が決まっていません。マウスをノーツのレーンの上に置いて、もう一度貼り付けてください」が表示される', async () => {
            const app = await startWithTwoTaps()
            await selectTap480Lane1(app)
            await app.press('Ctrl+C')

            await app.timeline.hover(tempoColumnAt(1920))
            await app.press('Ctrl+V')

            expect(app.notice(PASTE_POSITION_UNKNOWN_NOTICE)).toBeInTheDocument()
          })

          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツだけを選択して Ctrl+C でコピーし、マウスをテンポ列の 1 小節目 3 拍目の位置に置いて Ctrl+V を押しても、貼り付けは効かず、譜面のノーツの代替コンテンツは元の 2 項目のままになる', async () => {
            const app = await startWithTwoTaps()
            await selectTap480Lane1(app)
            await app.press('Ctrl+C')
            await app.timeline.hover(tempoColumnAt(1920))
            await expectRejectedWith(app, PASTE_POSITION_UNKNOWN_NOTICE, () => app.press('Ctrl+V'))

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
            ])
          })
        })

        describe('右のパネルの「コピー」「切り取り」「貼り付け」ボタンの押下', () => {
          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツだけを選択して「コピー」ボタンを押し、「貼り付け」ボタンを押してから 1 小節目 3 拍目・レーン 0 をクリックすると、譜面のノーツの代替コンテンツは、元の 2 項目と貼り付けた「タップノーツ 1 小節目 3 拍目 レーン 0」の 3 項目になる', async () => {
            const app = await startWithTwoTaps()
            await selectTap480Lane1(app)
            await app.click(app.button('コピー'))

            await pasteWithButtonAt(app, 1920, 0)

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
              'タップノーツ 1 小節目 3 拍目 レーン 0',
            ])
          })

          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツだけを選択して「切り取り」ボタンを押すと、譜面のノーツの代替コンテンツから「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1」が消えて 1 項目になり、続けて「貼り付け」ボタンを押してから 1 小節目 3 拍目・レーン 0 をクリックすると、「タップノーツ 1 小節目 3 拍目 レーン 0」が加わって 2 項目になる', async () => {
            const app = await startWithTwoTaps()
            await selectTap480Lane1(app)

            await app.click(app.button('切り取り'))

            expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2'])

            await pasteWithButtonAt(app, 1920, 0)

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
              'タップノーツ 1 小節目 3 拍目 レーン 0',
            ])
          })
        })

        describe('右のパネルの「貼り付け」ボタンの押下', () => {
          it('ノーツをコピーしたあと、「貼り付け」ボタンを押すと、「貼り付け」ボタンは押された状態になる', async () => {
            const app = await startWithBothTapsCopied()

            await app.click(app.button('貼り付け'))

            expect(app.button('貼り付け')).toHaveAttribute('aria-pressed', 'true')
          })

          it('2 つのタップノーツをコピーしたあと、「貼り付け」ボタンを押してから 1 小節目 3 拍目・レーン 0 をクリックすると、譜面のノーツの代替コンテンツは、元の 2 項目と貼り付けた「タップノーツ 1 小節目 3 拍目 レーン 0」「タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 1」の 4 項目になる', async () => {
            const app = await startWithBothTapsCopied()

            await pasteWithButtonAt(app, 1920, 0)

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
              'タップノーツ 1 小節目 3 拍目 レーン 0',
              'タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 1',
            ])
          })

          it('ノーツをコピーしたあと、「貼り付け」ボタンを押してからタイムラインのマスをクリックすると、「貼り付け」ボタンは押された状態でなくなる', async () => {
            const app = await startWithBothTapsCopied()

            await pasteWithButtonAt(app, 1920, 0)

            expect(app.button('貼り付け')).toHaveAttribute('aria-pressed', 'false')
          })
        })

        describe('「貼り付け」ボタンで貼り付けたあとの左右反転', () => {
          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツをコピーし、1 小節目 3 拍目・レーン 0 に貼り付けたあと、右のパネルの「左右反転」ボタンを押すと、譜面のノーツの代替コンテンツは、元の 2 項目と「タップノーツ 1 小節目 3 拍目 レーン 4」の 3 項目になる', async () => {
            const app = await startWithTwoTaps()
            await selectTap480Lane1(app)
            await app.click(app.button('コピー'))
            await pasteWithButtonAt(app, 1920, 0)

            await app.click(app.button('左右反転'))

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
              'タップノーツ 1 小節目 3 拍目 レーン 4',
            ])
          })
        })

        describe('ノーツをコピーして「貼り付け」ボタンを押したあと', () => {
          it('エスケープキーを押すと、「貼り付け」ボタンは押された状態でなくなる', async () => {
            const app = await startWithBothTapsCopied()
            await choosePastePosition(app)

            await cancelByEscapeKey(app)

            expect(app.button('貼り付け')).toHaveAttribute('aria-pressed', 'false')
          })

          it('「貼り付け」ボタンをもう一度押すと、「貼り付け」ボタンは押された状態でなくなる', async () => {
            const app = await startWithBothTapsCopied()
            await choosePastePosition(app)

            await cancelByPressingPasteAgain(app)

            expect(app.button('貼り付け')).toHaveAttribute('aria-pressed', 'false')
          })

          it('「プレビュー」タブを選んでから「エディタ」タブを選ぶと、「貼り付け」ボタンは押された状態でなくなる', async () => {
            const app = await startWithBothTapsCopied()
            await choosePastePosition(app)

            await cancelByVisitingPreview(app)

            expect(app.button('貼り付け')).toHaveAttribute('aria-pressed', 'false')
          })

          it('2 つのタップノーツをコピーしているとき、エスケープキーを押してから 1 小節目 3 拍目・レーン 0 をクリックすると、貼り付けは行われず、譜面のノーツの代替コンテンツは、元の 2 項目と置いた「タップノーツ 1 小節目 3 拍目 レーン 0」の 3 項目になる', async () => {
            const app = await startWithBothTapsCopied()
            await choosePastePosition(app)
            await cancelByEscapeKey(app)

            await app.timeline.click(at(1920, 0))

            expect(app.timeline.notes()).toEqual(TWO_TAPS_WITH_TAP_PLACED_AT_BEAT_3_LANE_0)
          })

          it('2 つのタップノーツをコピーしているとき、「貼り付け」ボタンをもう一度押してから 1 小節目 3 拍目・レーン 0 をクリックすると、貼り付けは行われず、譜面のノーツの代替コンテンツは、元の 2 項目と置いた「タップノーツ 1 小節目 3 拍目 レーン 0」の 3 項目になる', async () => {
            const app = await startWithBothTapsCopied()
            await choosePastePosition(app)
            await cancelByPressingPasteAgain(app)

            await app.timeline.click(at(1920, 0))

            expect(app.timeline.notes()).toEqual(TWO_TAPS_WITH_TAP_PLACED_AT_BEAT_3_LANE_0)
          })

          it('2 つのタップノーツをコピーしているとき、「プレビュー」タブを選んでから「エディタ」タブを選び、1 小節目 3 拍目・レーン 0 をクリックすると、貼り付けは行われず、譜面のノーツの代替コンテンツは、元の 2 項目と置いた「タップノーツ 1 小節目 3 拍目 レーン 0」の 3 項目になる', async () => {
            const app = await startWithBothTapsCopied()
            await choosePastePosition(app)
            await cancelByVisitingPreview(app)

            await app.timeline.click(at(1920, 0))

            expect(app.timeline.notes()).toEqual(TWO_TAPS_WITH_TAP_PLACED_AT_BEAT_3_LANE_0)
          })

          it('レーン数が 5 のとき、2 つのタップノーツをコピーしていて、1 小節目 3 拍目・レーン 4 をクリックすると、画面の下のメッセージに「ノーツが、先頭より前か、レーンの範囲外になります。位置をずらすか、レーン数を増やしてください」が表示される', async () => {
            const app = await startWithBothTapsCopied()

            await pasteWithButtonAt(app, 1920, 4)

            expect(app.notice(OUT_OF_LANE_NOTICE)).toBeInTheDocument()
          })

          it('レーン数が 5 のとき、2 つのタップノーツをコピーしていて、1 小節目 3 拍目・レーン 4 をクリックしても、「貼り付け」ボタンは押された状態のままになる', async () => {
            const app = await startWithBothTapsCopied()

            await pasteWithButtonAt(app, 1920, 4)

            expect(app.button('貼り付け')).toHaveAttribute('aria-pressed', 'true')
          })

          it('レーン数が 5 のとき、2 つのタップノーツをコピーしていて、1 小節目 3 拍目・レーン 4 をクリックして貼り付けに失敗したあと、1 小節目 3 拍目・レーン 0 をクリックすると、譜面のノーツの代替コンテンツは、元の 2 項目と貼り付けた「タップノーツ 1 小節目 3 拍目 レーン 0」「タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 1」の 4 項目になる', async () => {
            const app = await startWithBothTapsCopied()
            await pasteWithButtonAt(app, 1920, 4)
            expect(app.notice(OUT_OF_LANE_NOTICE), '貼り付けの失敗が表示されていません').toBeInTheDocument()

            await app.timeline.click(at(1920, 0))

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
              'タップノーツ 1 小節目 3 拍目 レーン 0',
              'タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 1',
            ])
          })

          it('レーン数が 5 のとき、2 つのタップノーツをコピーしていて、1 小節目 3 拍目・レーン 4 をクリックして貼り付けに失敗したあと、1 小節目 3 拍目・レーン 0 をクリックすると、「貼り付け」ボタンは押された状態でなくなる', async () => {
            const app = await startWithBothTapsCopied()
            await pasteWithButtonAt(app, 1920, 4)
            expect(app.notice(OUT_OF_LANE_NOTICE), '貼り付けの失敗が表示されていません').toBeInTheDocument()

            await app.timeline.click(at(1920, 0))

            expect(app.button('貼り付け')).toHaveAttribute('aria-pressed', 'false')
          })
        })

        describe('Ctrl+X の押下', () => {
          it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツだけを選択して Ctrl+X を押すと、譜面のノーツの代替コンテンツから「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1」が消えて 1 項目になり、続けて 1 小節目 3 拍目・レーン 0 にマウスを置いて Ctrl+V を押すと、「タップノーツ 1 小節目 3 拍目 レーン 0」が加わって 2 項目になる', async () => {
            const app = await startWithTwoTaps()
            await selectTap480Lane1(app)

            await app.press('Ctrl+X')

            expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2'])

            await pasteAt(app, 'Ctrl+V', 1920, 0)

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
              'タップノーツ 1 小節目 3 拍目 レーン 0',
            ])
          })
        })

        it.each([
          { copy: 'Ctrl+C', paste: 'Ctrl+V' },
          { copy: 'Cmd+C', paste: 'Cmd+V' },
        ] as const)(
          '2 つのタップノーツを選択して $copy でコピーし、1 小節目 3 拍目・レーン 0 にマウスを置いて $paste を押すと、譜面のノーツの代替コンテンツは、元の 2 項目と貼り付けた「タップノーツ 1 小節目 3 拍目 レーン 0」「タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 1」の 4 項目になる',
          async ({ copy, paste }) => {
            const app = await startWithTwoTaps()
            await selectBothTaps(app)
            await app.press(copy)

            await pasteAt(app, paste, 1920, 0)

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
              'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
              'タップノーツ 1 小節目 3 拍目 レーン 0',
              'タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 1',
            ])
          },
        )

        it('ノーツを選択していないとき、Ctrl+C を押すと、画面の下のメッセージに「コピーするノーツが選択されていません。Shift を押しながらドラッグして、ノーツを選択してください」が表示される', async () => {
          const app = await startWithTwoTaps()

          await app.press('Ctrl+C')

          expect(app.notice(NOTHING_SELECTED_NOTICE)).toBeInTheDocument()
        })

        it.each(['コピー', '切り取り', '貼り付け'])(
          'ノーツを選択もコピーもしていないとき、右のパネルの「%s」ボタンは押せない状態になる',
          async (name) => {
            const app = await startWithTwoTaps()

            expect(app.button(name)).toBeDisabled()
          },
        )
      })
    })

    describe('正常系', () => {
      it('タップノーツが 1 小節目 1 拍目の 1/2 拍後・レーン 3 (時間が一番早い位置) と 1 小節目 1 拍目の 3/4 拍後・レーン 1 にあるとき、2 つを選択して Ctrl+C でコピーし、1 小節目 3 拍目・レーン 2 にマウスを置いて Ctrl+V を押すと、譜面のノーツの代替コンテンツは、元の 2 項目と貼り付けた「タップノーツ 1 小節目 3 拍目 レーン 2」「タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 0」の 4 項目になる', async () => {
        const app = await startWithTapsAt480Lane3AndAt720Lane1()
        await app.timeline.selectEnclosing([
          { tick: 480, lane: 3 },
          { tick: 720, lane: 1 },
        ])
        await app.press('Ctrl+C')

        await pasteAt(app, 'Ctrl+V', 1920, 2)

        expect(app.timeline.notes()).toEqual([
          'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 3',
          'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 1',
          'タップノーツ 1 小節目 3 拍目 レーン 2',
          'タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 0',
        ])
      })

      it('タップノーツが 1 小節目 1 拍目の 1/2 拍後・レーン 1、1 小節目 1 拍目の 1/2 拍後・レーン 3、1 小節目 1 拍目の 3/4 拍後・レーン 0 にあり、時間が一番早い位置にレーン 1 とレーン 3 の 2 つがあるとき、3 つを選択して Ctrl+C でコピーし、1 小節目 3 拍目・レーン 2 にマウスを置いて Ctrl+V を押すと、譜面のノーツの代替コンテンツは、元の 3 項目と貼り付けた「タップノーツ 1 小節目 3 拍目 レーン 2」「タップノーツ 1 小節目 3 拍目 レーン 4」「タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 1」の 6 項目になる', async () => {
        const app = await startWithTapsAt480Lane1AndLane3AndAt720Lane0()
        await app.timeline.selectEnclosing([
          { tick: 480, lane: 1 },
          { tick: 480, lane: 3 },
          { tick: 720, lane: 0 },
        ])
        await app.press('Ctrl+C')

        await pasteAt(app, 'Ctrl+V', 1920, 2)

        expect(app.timeline.notes()).toEqual([
          'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 1',
          'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 3',
          'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 0',
          'タップノーツ 1 小節目 3 拍目 レーン 2',
          'タップノーツ 1 小節目 3 拍目 レーン 4',
          'タップノーツ 1 小節目 3 拍目の 1/4 拍後 レーン 1',
        ])
      })

      it('始点 1 小節目 1 拍目の 1/2 拍後・レーン 1、続く点 1 小節目 2 拍目・レーン 2 と 1 小節目 2 拍目の 1/2 拍後・レーン 3 のロングノーツだけがあるとき、1 つ目の続く点 (1 小節目 2 拍目・レーン 2) だけを選択して Ctrl+C でコピーし、2 小節目 1 拍目・レーン 0 にマウスを置いて Ctrl+V を押すと、ロングノーツ全体が貼り付けられ、譜面のノーツの代替コンテンツに「ロングノーツ 始点 2 小節目 1 拍目 レーン 0、続く点 2 小節目 1 拍目の 1/2 拍後 レーン 1、2 小節目 2 拍目 レーン 2、終端 離す」が出る', async () => {
        const app = await startWithLongNoteWithoutEndFlick()
        await app.timeline.selectEnclosing([{ tick: 960, lane: 2 }])
        await app.press('Ctrl+C')

        await pasteAt(app, 'Ctrl+V', 3840, 0)

        expect(app.timeline.notes()).toContain(
          'ロングノーツ 始点 2 小節目 1 拍目 レーン 0、続く点 2 小節目 1 拍目の 1/2 拍後 レーン 1、2 小節目 2 拍目 レーン 2、終端 離す',
        )
      })
    })
  })

  describe('全選択', () => {
    describe('1 小節目 2 拍目・レーン 0 と 1 小節目 4 拍目・レーン 1 のタップノーツがあるとき', () => {
      describe('正常系', () => {
        it.each([
          { operation: 'Ctrl+A を押す', selectAll: pressCtrlA },
          { operation: 'Cmd+A を押す', selectAll: pressCmdA },
          { operation: '右のパネルの「全選択」ボタンを押す', selectAll: clickSelectAllButton },
        ])(
          'ノーツを選択していないとき、$operation と、右のパネルの「左右反転」ボタンが押せる状態になり、押すと、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 2 拍目 レーン 4」「タップノーツ 1 小節目 4 拍目 レーン 3」の 2 項目になる',
          async ({ selectAll }) => {
            const app = await startWithTapsAtBeat2Lane0AndBeat4Lane1()
            expect(app.button('左右反転')).toBeDisabled()

            await selectAll(app)
            expect(app.button('左右反転')).toBeEnabled()
            await app.click(app.button('左右反転'))

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 2 拍目 レーン 4',
              'タップノーツ 1 小節目 4 拍目 レーン 3',
            ])
          },
        )

        it.each([
          {
            operation: 'Ctrl+A を押して全選択したあと、もう一度 Ctrl+A を押す',
            selectAll: pressCtrlA,
          },
          {
            operation: '右のパネルの「全選択」ボタンを押して全選択したあと、もう一度「全選択」ボタンを押す',
            selectAll: clickSelectAllButton,
          },
        ])(
          'ノーツを選択していないとき、$operation と、右のパネルの「左右反転」ボタンが押せない状態に戻る',
          async ({ selectAll }) => {
            const app = await startWithTapsAtBeat2Lane0AndBeat4Lane1()
            await selectAll(app)
            expect(app.button('左右反転')).toBeEnabled()

            await selectAll(app)

            expect(app.button('左右反転')).toBeDisabled()
          },
        )
      })
    })

    describe('ノーツがないとき', () => {
      describe('正常系', () => {
        it('Ctrl+A を押すと、画面の下のメッセージに「選択できるノーツがありません」が表示される', async () => {
          const app = await startApp()

          await app.press('Ctrl+A')

          expect(app.notice(NO_NOTES_TO_SELECT_NOTICE)).toBeInTheDocument()
        })

        it('右のパネルの「全選択」ボタンは押せない状態になる', async () => {
          const app = await startApp()

          expect(app.button('全選択')).toBeDisabled()
        })
      })
    })
  })

  describe('選択したノーツの 1 拍ずつの移動', () => {
    describe('1 小節目 2 拍目・レーン 0 と 1 小節目 4 拍目・レーン 1 のタップノーツがあるとき', () => {
      describe('正常系', () => {
        it('全選択して、右のパネルの「1 拍 後ろへ」ボタンを押すと、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 3 拍目 レーン 0」「タップノーツ 2 小節目 1 拍目 レーン 1」の 2 項目になる', async () => {
          const app = await startWithTapsAtBeat2Lane0AndBeat4Lane1()
          await app.press('Ctrl+A')

          await app.click(app.button('1 拍 後ろへ'))

          expect(app.timeline.notes()).toEqual([
            'タップノーツ 1 小節目 3 拍目 レーン 0',
            'タップノーツ 2 小節目 1 拍目 レーン 1',
          ])
        })

        it('全選択して、右のパネルの「1 拍 前へ」ボタンを押すと、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 1 拍目 レーン 0」「タップノーツ 1 小節目 3 拍目 レーン 1」の 2 項目になる', async () => {
          const app = await startWithTapsAtBeat2Lane0AndBeat4Lane1()
          await app.press('Ctrl+A')

          await app.click(app.button('1 拍 前へ'))

          expect(app.timeline.notes()).toEqual([
            'タップノーツ 1 小節目 1 拍目 レーン 0',
            'タップノーツ 1 小節目 3 拍目 レーン 1',
          ])
        })

        it('全選択して「1 拍 後ろへ」ボタンを押したあと、右のパネルの「元に戻す」ボタンを 1 回押すと、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 2 拍目 レーン 0」「タップノーツ 1 小節目 4 拍目 レーン 1」の 2 項目に戻る', async () => {
          const app = await startWithTapsAtBeat2Lane0AndBeat4Lane1()
          await app.press('Ctrl+A')
          await app.click(app.button('1 拍 後ろへ'))

          await app.click(app.button('元に戻す'))

          expect(app.timeline.notes()).toEqual([
            'タップノーツ 1 小節目 2 拍目 レーン 0',
            'タップノーツ 1 小節目 4 拍目 レーン 1',
          ])
        })

        it.each(['1 拍 後ろへ', '1 拍 前へ'])(
          'ノーツを選択していないとき、右のパネルの「%s」ボタンは押せない状態になる',
          async (name) => {
            const app = await startWithTapsAtBeat2Lane0AndBeat4Lane1()

            expect(app.button(name)).toBeDisabled()
          },
        )
      })
    })

    describe('正常系', () => {
      describe('1 小節目 1 拍目・レーン 0 のタップノーツだけがあるとき', () => {
        it('全選択して、右のパネルの「1 拍 前へ」ボタンを押すと、画面の下のメッセージに「先頭より前には動かせません」が表示される', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [{ type: 'tap', tick: 0, lane: 0 }])
          await app.press('Ctrl+A')

          await app.click(app.button('1 拍 前へ'))

          expect(app.notice(NO_ROOM_TO_MOVE_NOTICE)).toBeInTheDocument()
        })

        it('全選択して、右のパネルの「1 拍 前へ」ボタンを押しても、タップノーツは動かず、譜面のノーツの代替コンテンツは「タップノーツ 1 小節目 1 拍目 レーン 0」の 1 項目のままになる', async () => {
          const app = await startApp()
          await loadChartWithoutFocus(app, [{ type: 'tap', tick: 0, lane: 0 }])
          await app.press('Ctrl+A')
          await expectRejectedWith(app, NO_ROOM_TO_MOVE_NOTICE, () => app.click(app.button('1 拍 前へ')))

          expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目 レーン 0'])
        })
      })
    })

    describe('小節数が 1 で、1 小節目 4 拍目・レーン 0 のタップノーツだけがあるとき', () => {
      describe('正常系', () => {
        it('全選択して、右のパネルの「1 拍 後ろへ」ボタンを押すと、譜面のノーツの代替コンテンツは「タップノーツ 2 小節目 1 拍目 レーン 0」の 1 項目になり、「プロジェクト情報」ダイアログの「小節数」の入力欄は 2 になる', async () => {
          const app = await startApp({ barCount: 1 })
          await loadChartWithoutFocus(app, [{ type: 'tap', tick: 2880, lane: 0 }])
          await app.press('Ctrl+A')

          await app.click(app.button('1 拍 後ろへ'))
          await app.projectInfo.open()

          expect(app.timeline.notes()).toEqual(['タップノーツ 2 小節目 1 拍目 レーン 0'])
          expect(app.projectInfo.barCountInput()).toHaveDisplayValue('2')
        })
      })
    })
  })

  describe('ノーツの左右反転', () => {
    describe('レーン数が 5 のとき', () => {
      describe('正常系', () => {
        it('1 小節目 1 拍目の 1/2 拍後・レーン 0 のタップノーツと 1 小節目 1 拍目の 3/4 拍後・レーン 1 の左フリックノーツがあるとき、2 つのノーツを選択して、右のパネルの「左右反転」ボタンを押すと、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 4」「右フリックノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 3」の 2 項目になる', async () => {
          const app = await startWithTapAndLeftFlick()
          await app.timeline.selectEnclosing([
            { tick: 480, lane: 0 },
            { tick: 720, lane: 1 },
          ])

          await app.click(app.button('左右反転'))

          expect(app.timeline.notes()).toEqual([
            'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 4',
            '右フリックノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 3',
          ])
        })

        it('1 小節目 1 拍目の 1/2 拍後・レーン 1 の上フリックノーツだけがあるとき、それを選択して、右のパネルの「左右反転」ボタンを押すと、譜面のノーツの代替コンテンツに「上フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 3」が出る', async () => {
          const app = await startWithUpFlick()
          await app.timeline.selectEnclosing([{ tick: 480, lane: 1 }])

          await app.click(app.button('左右反転'))

          expect(app.timeline.notes()).toContain('上フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 3')
        })

        it('始点 1 小節目 1 拍目・レーン 1、終端 1 小節目 1 拍目の 1/2 拍後・レーン 3 で終端が右フリックのロングノーツだけがあるとき、それを選択して、右のパネルの「左右反転」ボタンを押すと、譜面のノーツの代替コンテンツに「ロングノーツ 始点 1 小節目 1 拍目 レーン 3、続く点 1 小節目 1 拍目の 1/2 拍後 レーン 1、終端 左フリック」が出る', async () => {
          const app = await startWithLongNoteEndingInRightFlick()
          await app.timeline.selectEnclosing([{ tick: 0, lane: 1 }])

          await app.click(app.button('左右反転'))

          expect(app.timeline.notes()).toContain(
            'ロングノーツ 始点 1 小節目 1 拍目 レーン 3、続く点 1 小節目 1 拍目の 1/2 拍後 レーン 1、終端 左フリック',
          )
        })

        describe('1 小節目 1 拍目の 1/2 拍後・レーン 0 と 1 小節目 1 拍目の 1/2 拍後・レーン 4 にタップノーツがあるとき', () => {
          it('1 小節目 1 拍目の 1/2 拍後・レーン 0 のタップノーツを選択して、右のパネルの「左右反転」ボタンを押すと、画面の下のメッセージに「同じ位置にノーツがあります」が表示される', async () => {
            const app = await startWithTapAt480Lane0AndLane4()
            await app.timeline.selectEnclosing([{ tick: 480, lane: 0 }])

            await app.click(app.button('左右反転'))

            expect(app.notice(SAME_POSITION_NOTICE)).toBeInTheDocument()
          })

          it('1 小節目 1 拍目の 1/2 拍後・レーン 0 のタップノーツを選択して、右のパネルの「左右反転」ボタンを押しても、反転は効かず、譜面のノーツの代替コンテンツは元の 2 項目のままになる', async () => {
            const app = await startWithTapAt480Lane0AndLane4()
            await app.timeline.selectEnclosing([{ tick: 480, lane: 0 }])
            await expectRejectedWith(app, SAME_POSITION_NOTICE, () => app.click(app.button('左右反転')))

            expect(app.timeline.notes()).toEqual([
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 0',
              'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 4',
            ])
          })

          it('1 小節目 1 拍目の 1/2 拍後・レーン 0 のタップノーツを選択して「左右反転」ボタンを押し、「同じ位置にノーツがあります」が表示されたあと、1 小節目 1 拍目の 1/2 拍後・レーン 4 のタップノーツを右クリックで削除してもう一度「左右反転」ボタンを押すと、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 4」の 1 項目だけになる', async () => {
            const app = await startWithTapAt480Lane0AndLane4()
            await app.timeline.selectEnclosing([{ tick: 480, lane: 0 }])
            await expectRejectedWith(app, SAME_POSITION_NOTICE, () => app.click(app.button('左右反転')))

            await app.timeline.rightClick(at(480, 4))
            await app.click(app.button('左右反転'))

            expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 4'])
          })
        })
      })
    })
  })
})

describe('[ノーツの編集] 取り消しとやり直し', () => {
  describe('元に戻すとやり直し', () => {
    describe('1 小節目 1 拍目の 1/2 拍後・レーン 2 と 1 小節目 1 拍目の 3/4 拍後・レーン 2 をクリックしてタップノーツを 2 つ置いたあと', () => {
      describe('正常系', () => {
        describe('キーボードショートカットの押下', () => {
          it('Ctrl+Z を 1 回押すと、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」だけになる', async () => {
            const app = await startWithTwoPlacedTaps()

            await app.press('Ctrl+Z')

            expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
          })

          it('Ctrl+Z を 2 回押すと、譜面のノーツの代替コンテンツは空になる', async () => {
            const app = await startWithTwoPlacedTaps()

            await app.press('Ctrl+Z')
            await app.press('Ctrl+Z')

            expect(app.timeline.notes()).toEqual([])
          })

          it.each([
            { undo: 'Ctrl+Z', redo: 'Ctrl+Shift+Z' },
            { undo: 'Cmd+Z', redo: 'Cmd+Shift+Z' },
          ])(
            '$undo を 1 回押したあと $redo を押すと、譜面のノーツの代替コンテンツは、置いた 2 項目に戻る',
            async ({ undo, redo }) => {
              const app = await startWithTwoPlacedTaps()
              await app.press(undo)
              expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])

              await app.press(redo)

              expect(app.timeline.notes()).toEqual([
                'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2',
                'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
              ])
            },
          )

          it('Ctrl+Z を 2 回押したあと Ctrl+Shift+Z を 1 回押すと、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」だけになる', async () => {
            const app = await startWithTwoPlacedTaps()
            await app.press('Ctrl+Z')
            await app.press('Ctrl+Z')
            expect(app.timeline.notes()).toEqual([])

            await app.press('Ctrl+Shift+Z')

            expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
          })
        })

        it('右のパネルの「元に戻す」ボタンを 1 回押すと、譜面のノーツの代替コンテンツは、「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」だけになる', async () => {
          const app = await startWithTwoPlacedTaps()

          await app.click(app.button('元に戻す'))

          expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
        })

        it('右のパネルの「元に戻す」ボタン、「やり直す」ボタンを順に押すと、譜面のノーツの代替コンテンツは、置いた 2 項目に戻る', async () => {
          const app = await startWithTwoPlacedTaps()
          await app.click(app.button('元に戻す'))
          expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])

          await app.click(app.button('やり直す'))

          expect(app.timeline.notes()).toEqual([
            'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2',
            'タップノーツ 1 小節目 1 拍目の 3/4 拍後 レーン 2',
          ])
        })
      })
    })

    describe('正常系', () => {
      it('ノーツがない譜面で Ctrl+Z を押しても、戻す操作がなく、譜面のノーツの代替コンテンツは空のままになる', async () => {
        const app = await startApp()

        await pressKey(app, 'Ctrl+Z')

        expect(app.timeline.notes()).toEqual([])
      })
    })
  })
})

describe('[タイムラインの表示] タイムライン', () => {
  describe('正常系', () => {
    it('アプリを起動すると、エディタの画面のタイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出る', async () => {
      const app = await startApp()

      expect(app.timeline.items()).toContain('スクロール位置 1 小節目 1 拍目')
    })
  })

  describe('スクロール位置の変更', () => {
    describe('正常系', () => {
      describe('タイムラインの上でのホイール回転', () => {
        it('スクロール位置が 1 小節目 1 拍目のとき、ホイールを上へ 100 ピクセル分回すと、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目の 833/960 拍後」が出る', async () => {
          const app = await startApp()

          await app.timeline.wheel('up', { pixels: 100 })

          expect(app.timeline.items()).toContain('スクロール位置 1 小節目 1 拍目の 833/960 拍後')
        })

        it('スクロール位置が 1 小節目 1 拍目のとき、ホイールを上へ 100 ピクセル分回し、続けて下へ 100 ピクセル分回すと、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出る', async () => {
          const app = await startApp()
          await app.timeline.wheel('up', { pixels: 100 })
          expect(app.timeline.items()).toContain('スクロール位置 1 小節目 1 拍目の 833/960 拍後')

          await app.timeline.wheel('down', { pixels: 100 })

          expect(app.timeline.items()).toContain('スクロール位置 1 小節目 1 拍目')
        })

        it('小節数が 1 で、スクロール位置が 1 小節目 1 拍目のとき、ホイールを上へ 100 ピクセル分 4 回回すと、タイムラインの代替コンテンツに「スクロール位置 1 小節目 4 拍目の 151/320 拍後」が出る', async () => {
          const app = await startApp({ barCount: 1 })

          await app.timeline.wheel('up', { pixels: 100 })
          await app.timeline.wheel('up', { pixels: 100 })
          await app.timeline.wheel('up', { pixels: 100 })
          await app.timeline.wheel('up', { pixels: 100 })

          expect(app.timeline.items()).toContain('スクロール位置 1 小節目 4 拍目の 151/320 拍後')
        })
      })

      describe('タイムラインの右端のスクロールバーのつまみのドラッグ', () => {
        it('小節数が 50 のとき、つまみを一番上までドラッグすると、タイムラインの代替コンテンツに「スクロール位置 51 小節目 1 拍目」が出る', async () => {
          const app = await startApp({ barCount: 50 })

          await app.scrollbar.dragThumbToTop()

          expect(app.timeline.items()).toContain('スクロール位置 51 小節目 1 拍目')
        })

        it('ホイールを上へ 100 ピクセル分回したあと、つまみを一番下までドラッグすると、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出る', async () => {
          const app = await startApp()
          await app.timeline.wheel('up', { pixels: 100 })
          expect(app.timeline.items()).toContain('スクロール位置 1 小節目 1 拍目の 833/960 拍後')

          await app.scrollbar.dragThumbToBottom()

          expect(app.timeline.items()).toContain('スクロール位置 1 小節目 1 拍目')
        })

        it.each([
          { tapTick: 191760, tapAt: '50 小節目 4 拍目の 3/4 拍後・レーン 2', scrollPosition: '51 小節目 1 拍目' },
          { tapTick: 192000, tapAt: '51 小節目 1 拍目・レーン 2', scrollPosition: '52 小節目 1 拍目' },
        ])(
          '小節数が 50 で、$tapAt にタップノーツがあるとき、つまみを一番上までドラッグすると、タイムラインの代替コンテンツに「スクロール位置 $scrollPosition」が出る',
          async ({ tapTick, scrollPosition }) => {
            const app = await startApp({ barCount: 50 })
            await app.loadChart([{ type: 'tap', tick: tapTick, lane: 2 }])

            await app.scrollbar.dragThumbToTop()

            expect(app.timeline.items()).toContain(`スクロール位置 ${scrollPosition}`)
          },
        )
      })

      it('小節数が 50 のとき、スクロールバーの帯の一番上をクリックすると、タイムラインの代替コンテンツに「スクロール位置 51 小節目 1 拍目」が出る', async () => {
        const app = await startApp({ barCount: 50 })

        await app.scrollbar.clickTrackTop()

        expect(app.timeline.items()).toContain('スクロール位置 51 小節目 1 拍目')
      })

      it('スクロール位置が 1 小節目 1 拍目のとき、ホイールを下へ 100 ピクセル分回しても、1 小節目 1 拍目より先へは進まず、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出たままになる', async () => {
        const app = await startApp()

        await app.timeline.wheel('down', { pixels: 100 })

        expect(app.timeline.items()).toContain('スクロール位置 1 小節目 1 拍目')
      })

      it('小節数が 1 で、スクロール位置が 1 小節目 1 拍目のとき、ホイールを上へ 100 ピクセル分 5 回回しても、小節数 1 の末尾の 2 小節目 1 拍目より先へは進まず、タイムラインの代替コンテンツに「スクロール位置 2 小節目 1 拍目」が出る', async () => {
        const app = await startApp({ barCount: 1 })

        await app.timeline.wheel('up', { pixels: 100 })
        await app.timeline.wheel('up', { pixels: 100 })
        await app.timeline.wheel('up', { pixels: 100 })
        await app.timeline.wheel('up', { pixels: 100 })
        await app.timeline.wheel('up', { pixels: 100 })

        expect(app.timeline.items()).toContain('スクロール位置 2 小節目 1 拍目')
      })
    })
  })

  describe('ズーム', () => {
    describe('正常系', () => {
      it.each([
        { key: 'Ctrl', options: { ctrl: true } },
        { key: 'Cmd', options: { meta: true } },
      ])(
        '$key を押しながらホイールを上へ 1 目盛り回すと、タイムラインの代替コンテンツの「1 マスの高さ」の値は、回す前より大きくなる',
        async ({ options }) => {
          const app = await startApp()
          const heightBefore = app.timeline.gridStepHeight()

          await app.timeline.wheel('up', options)

          expect(app.timeline.gridStepHeight()).toBeGreaterThan(heightBefore)
        },
      )

      it('スクロール位置が 1 小節目 1 拍目の 833/960 拍後のとき、Ctrl を押しながらホイールを上へ 1 目盛り回して拡大しても、スクロール位置は変わらず、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目の 833/960 拍後」が出たままになる', async () => {
        const app = await startApp()
        await app.timeline.wheel('up', { pixels: 100 })
        expect(app.timeline.items()).toContain('スクロール位置 1 小節目 1 拍目の 833/960 拍後')

        await zoomInWithCtrlWheel(app)

        expect(app.timeline.items()).toContain('スクロール位置 1 小節目 1 拍目の 833/960 拍後')
      })
    })
  })
})

describe('[ノーツの個数の上限] ノーツの貼り付け', () => {
  describe('ノーツが 3000 個あり、1 小節目 2 拍目・レーン 0 のタップノーツを選択して Ctrl+C でコピーしたとき', () => {
    describe('正常系', () => {
      it('ノーツのない 1 小節目 1 拍目の 1/4 拍後・レーン 0 にマウスを置いて Ctrl+V を押すと、画面の下のメッセージに「ノーツは 3000 個までです」が表示され、貼り付けは効かず、譜面のノーツの代替コンテンツは 3000 項目のままになる', async () => {
        const app = await startWithMaxNotes()
        await app.timeline.selectEnclosing([{ tick: 960, lane: 0 }])
        await app.press('Ctrl+C')

        await expectRejectedWith(app, MAX_NOTES_NOTICE, () => pasteAt(app, 'Ctrl+V', 240, 0))

        expect(app.timeline.notes()).toHaveLength(3000)
      })
    })
  })
})
