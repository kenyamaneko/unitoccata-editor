import { describe, expect, it } from 'vitest'
import { calculateScrollLimit, calculateThumb, calculateVisibleTicks } from './scrollbar.ts'
import type { Chart, Note, ProjectInfo } from './types.ts'

const projectInfoIn4Over4: ProjectInfo = {
  offsetMs: 0,
  tempo: [{ tick: 0, bpm: 120 }],
  meter: [{ tick: 0, num: 4, den: 4 }],
}

const chartOf = (notes: readonly Note[]): Chart => ({ notes })

describe('[タイムラインの表示] スクロールの上限', () => {
  describe('拍子が 4/4 のとき', () => {
    describe('正常系', () => {
      it('小節数が 50 で、見える範囲が 1 小節のとき、スクロール位置の上限は、50 小節目 1 拍目になる', () => {
        const limit = calculateScrollLimit({ projectInfo: projectInfoIn4Over4, chart: chartOf([]), barCount: 50 }, 3840)

        expect(limit).toBe(188160)
      })

      it('小節数が 1 で、見える範囲が 1 小節のとき、スクロール位置の上限は、1 小節目 1 拍目になる', () => {
        const limit = calculateScrollLimit({ projectInfo: projectInfoIn4Over4, chart: chartOf([]), barCount: 1 }, 3840)

        expect(limit).toBe(0)
      })

      it('小節数が 50 で、51 小節目 1 拍目にタップノーツがあり、見える範囲が 1 小節のとき、スクロール位置の上限は、51 小節目 1 拍目になる', () => {
        const chart = chartOf([{ id: 'n1', type: 'tap', tick: 192000, lane: 0 }])

        const limit = calculateScrollLimit({ projectInfo: projectInfoIn4Over4, chart, barCount: 50 }, 3840)

        expect(limit).toBe(192000)
      })
    })
  })
})

describe('[タイムラインの表示] タイムラインに見える範囲', () => {
  describe('正常系', () => {
    it('タイムラインの高さが 1024 px (上下の余白 32 px ずつを含む)、1 小節の高さが 960 px のとき、見える範囲は、1 小節になる', () => {
      const visibleTicks = calculateVisibleTicks(1024, 0.25)

      expect(visibleTicks).toBe(3840)
    })
  })
})

describe('[タイムラインの表示] スクロールバーのつまみ', () => {
  describe('スクロール位置の下限と上限が同じとき', () => {
    describe('正常系', () => {
      it('つまみの上端は、スクロールバーの上端になる', () => {
        const thumb = calculateThumb({ min: 0, max: 0 }, 0, 3840, 400)

        expect(thumb.top).toBe(0)
      })
    })
  })
})
