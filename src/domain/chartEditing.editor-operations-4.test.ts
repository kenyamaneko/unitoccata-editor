import { describe, expect, it } from 'vitest'
import { addNote, deleteNotes } from './chartEditing.ts'
import type { Chart, Note } from './types.ts'

const LANE_COUNT = 5

function chartWithTapCount(count: number): Chart {
  return {
    notes: Array.from({ length: count }, (_unused, index): Note => ({
      id: `n${index}`,
      type: 'tap',
      tick: index,
      lane: 0,
    })),
  }
}

describe('[譜面の編集] ノーツの個数の上限', () => {
  describe('ノーツの追加', () => {
    describe('正常系', () => {
      it('ノーツが 2999 個の譜面のとき、タップノーツを 1 つ追加すると、譜面のノーツの数は、3000 になる', () => {
        const result = addNote(chartWithTapCount(2999), { id: 'added', type: 'tap', tick: 2999, lane: 0 }, LANE_COUNT)

        expect(result).toHaveProperty('chart.notes.length', 3000)
      })
    })

    describe('異常系', () => {
      it('ノーツが 3000 個の譜面のとき、タップノーツを 1 つ追加すると、編集は成立せず、理由は too-many-notes になる', () => {
        const result = addNote(chartWithTapCount(3000), { id: 'added', type: 'tap', tick: 3000, lane: 0 }, LANE_COUNT)

        expect(result).toEqual({ ok: false, reason: 'too-many-notes' })
      })
    })
  })

  describe('ノーツの削除', () => {
    describe('異常系', () => {
      it('ノーツが 3001 個の譜面のとき、ノーツを 1 つ削除すると、譜面のノーツの数は、3000 になる', () => {
        const result = deleteNotes(chartWithTapCount(3001), ['n0'], LANE_COUNT)

        expect(result).toHaveProperty('chart.notes.length', 3000)
      })
    })
  })
})
