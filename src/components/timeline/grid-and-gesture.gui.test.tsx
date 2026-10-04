import { describe, expect, it } from 'vitest'
import { startApp } from '../../test/app.tsx'
import {
  dragNoteAt480Lane2,
  expectGridDivisionShown,
  releaseNoteAt480Lane2WithoutMoving,
  startAppWithNoteAt480Lane2,
  type FlickDragNote,
} from './grid-and-gesture.helpers.ts'
import { at } from '../../test/timeline.ts'

const tapNote: FlickDragNote = { type: 'tap' }
const upFlickNote: FlickDragNote = { type: 'flick', dir: 'up' }
const leftFlickNote: FlickDragNote = { type: 'flick', dir: 'left' }

describe('[フリックノーツ] 右フリックへの変更', () => {
  describe('ノーツのドラッグ', () => {
    describe('正常系', () => {
      describe('1 小節目 1 拍目の 1/2 拍後・レーン 2 のノーツをドラッグするとき', () => {
        it.each<[string, FlickDragNote, number, number]>([
          ['タップノーツを右へ 0.5 レーン、縦へ 0 マス動かして離すと', tapNote, 0.5, 0],
          ['タップノーツを右へ 0.6 レーン、上へ 0.6 マス動かして離すと', tapNote, 0.6, 0.6],
          ['上フリックノーツを右へ 0.6 レーン、上へ 0.3 マス動かして離すと', upFlickNote, 0.6, 0.3],
        ])(
          '%s、譜面のノーツの代替コンテンツに「右フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」が出る',
          async (_title, note, lanes, steps) => {
            const app = await startAppWithNoteAt480Lane2(note)

            await dragNoteAt480Lane2(app, lanes, steps)

            expect(app.timeline.notes()).toEqual(['右フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
          },
        )
      })
    })
  })
})

describe('[フリックノーツ] 左フリックへの変更', () => {
  describe('ノーツのドラッグ', () => {
    describe('正常系', () => {
      describe('1 小節目 1 拍目の 1/2 拍後・レーン 2 のノーツをドラッグするとき', () => {
        it.each<[string, FlickDragNote, number, number]>([
          ['タップノーツを左へ 0.5 レーン、縦へ 0 マス動かして離すと', tapNote, -0.5, 0],
          ['タップノーツを左へ 0.6 レーン、上へ 0.6 マス動かして離すと', tapNote, -0.6, 0.6],
          ['上フリックノーツを左へ 0.6 レーン、縦へ 0 マス動かして離すと', upFlickNote, -0.6, 0],
        ])(
          '%s、譜面のノーツの代替コンテンツに「左フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」が出る',
          async (_title, note, lanes, steps) => {
            const app = await startAppWithNoteAt480Lane2(note)

            await dragNoteAt480Lane2(app, lanes, steps)

            expect(app.timeline.notes()).toEqual(['左フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
          },
        )
      })
    })
  })
})

describe('[フリックノーツ] 上フリックへの変更', () => {
  describe('ノーツのドラッグ', () => {
    describe('正常系', () => {
      describe('1 小節目 1 拍目の 1/2 拍後・レーン 2 のノーツをドラッグするとき', () => {
        it.each<[string, FlickDragNote, number, number]>([
          ['タップノーツを右へ 0.3 レーン、上へ 0.6 マス動かして離すと', tapNote, 0.3, 0.6],
          ['タップノーツを横へ 0 レーン、上へ 0.5 マス動かして離すと', tapNote, 0, 0.5],
          ['左フリックノーツを横へ 0 レーン、上へ 0.5 マス動かして離すと', leftFlickNote, 0, 0.5],
        ])(
          '%s、譜面のノーツの代替コンテンツに「上フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」が出る',
          async (_title, note, lanes, steps) => {
            const app = await startAppWithNoteAt480Lane2(note)

            await dragNoteAt480Lane2(app, lanes, steps)

            expect(app.timeline.notes()).toEqual(['上フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
          },
        )
      })
    })
  })
})

describe('[フリックノーツ] 種類の変更', () => {
  describe('ノーツのドラッグ', () => {
    describe('正常系', () => {
      describe('1 小節目 1 拍目の 1/2 拍後・レーン 2 のノーツをドラッグするとき', () => {
        it.each<[string, FlickDragNote, number, number, string]>([
          [
            'タップノーツを右へ 0.49 レーン、上へ 0.49 マス動かして離すと',
            tapNote,
            0.49,
            0.49,
            'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2',
          ],
          [
            '上フリックノーツを右へ 0.4 レーン、上へ 0.4 マス動かして離すと',
            upFlickNote,
            0.4,
            0.4,
            '上フリックノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2',
          ],
        ])(
          '%s、ノーツの種類は変わらず、譜面のノーツの代替コンテンツに「%s」が出る',
          async (_title, note, lanes, steps, shown) => {
            const app = await startAppWithNoteAt480Lane2(note)

            await dragNoteAt480Lane2(app, lanes, steps)

            expect(app.timeline.notes()).toEqual([shown])
          },
        )

        it('タップノーツを押して動かさずに離すと、フリックにならず、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」が出る', async () => {
          const app = await startAppWithNoteAt480Lane2(tapNote)

          await releaseNoteAt480Lane2WithoutMoving(app)

          expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
        })
      })
    })
  })
})

describe('[フリックノーツ] フリックの解除', () => {
  describe('ノーツのドラッグ', () => {
    describe('正常系', () => {
      it('1 小節目 1 拍目の 1/2 拍後・レーン 2 の上フリックノーツを横へ 0 レーン、下へ 0.5 マス動かして離すと、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」が出る', async () => {
        const app = await startAppWithNoteAt480Lane2(upFlickNote)

        await dragNoteAt480Lane2(app, 0, -0.5)

        expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
      })
    })

    describe('異常系', () => {
      describe('1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツだけがあるとき', () => {
        it('そのタップノーツを横へ 0 レーン、下へ 0.5 マス動かして離すと、画面の下のメッセージに「この点にはフリックがないため、解除できません」が表示される', async () => {
          const app = await startAppWithNoteAt480Lane2(tapNote)

          await dragNoteAt480Lane2(app, 0, -0.5)

          expect(app.notice('この点にはフリックがないため、解除できません')).toBeInTheDocument()
        })

        it('そのタップノーツを横へ 0 レーン、下へ 0.5 マス動かして離しても、フリックは解除できず、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」が出たままになる', async () => {
          const app = await startAppWithNoteAt480Lane2(tapNote)

          await dragNoteAt480Lane2(app, 0, -0.5)

          expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
        })
      })
    })
  })
})

describe('[グリッド分割] 選択欄', () => {
  describe('正常系', () => {
    it('エディタを起動したとき、右のパネルの「グリッド分割」の選択欄は、16 分になる', async () => {
      const app = await startApp()

      expect(app.gridDivisionSelect()).toHaveDisplayValue('16 分')
    })

    it('右のパネルの「グリッド分割」の選択欄の選択肢は、4 分、8 分、12 分、16 分、24 分、32 分の順に並ぶ', async () => {
      const app = await startApp()

      expect(app.gridDivisionOptions()).toEqual(['4 分', '8 分', '12 分', '16 分', '24 分', '32 分'])
    })

    it('グリッド分割が 16 分のとき、選択欄で 8 分を選ぶと、タイムラインの代替コンテンツに「グリッド分割 8 分」で始まる項目が出る', async () => {
      const app = await startApp()
      expectGridDivisionShown(app, '16 分')

      await app.selectGridDivision('8 分')

      expect(app.timeline.items()).toContainEqual(expect.stringMatching(/^グリッド分割 8 分/))
    })
  })

  describe('グリッド分割を選んだあと、1 小節目 1 拍目の 35/48 拍後・レーン 2 の位置をクリックするとき', () => {
    describe('正常系', () => {
      it.each<{ division: string; shownPosition: string }>([
        { division: '4 分', shownPosition: '1 小節目 2 拍目' },
        { division: '8 分', shownPosition: '1 小節目 1 拍目の 1/2 拍後' },
        { division: '12 分', shownPosition: '1 小節目 1 拍目の 2/3 拍後' },
        { division: '16 分', shownPosition: '1 小節目 1 拍目の 3/4 拍後' },
        { division: '24 分', shownPosition: '1 小節目 1 拍目の 2/3 拍後' },
        { division: '32 分', shownPosition: '1 小節目 1 拍目の 3/4 拍後' },
      ])(
        'グリッド分割が $division のとき、譜面のノーツの代替コンテンツに「タップノーツ $shownPosition レーン 2」が出る',
        async ({ division, shownPosition }) => {
          const app = await startApp()
          await app.selectGridDivision(division)
          expectGridDivisionShown(app, division)

          await app.timeline.click(at(700, 2))

          expect(app.timeline.notes()).toEqual([`タップノーツ ${shownPosition} レーン 2`])
        },
      )
    })
  })
})

describe('[グリッド分割] 24 分の位置の表示', () => {
  describe('正常系', () => {
    it('グリッド分割が 24 分のとき、先頭から 1 マス目の位置のレーン 2 をクリックすると、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目の 1/6 拍後 レーン 2」が出る', async () => {
      const app = await startApp()
      await app.selectGridDivision('24 分')
      expectGridDivisionShown(app, '24 分')

      await app.timeline.click(at(160, 2))

      expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/6 拍後 レーン 2'])
    })
  })
})
