import { describe, expect, it } from 'vitest'
import { interpolateLane } from './notes.ts'
import type { LongNote } from './types.ts'

function createLongNote(start: { tick: number; lane: number }, path: { tick: number; lane: number }[]): LongNote {
  return { id: 'id', type: 'long', tick: start.tick, lane: start.lane, path, end: { kind: 'release' } }
}

const noteFrom0Lane0To960Lane4 = createLongNote({ tick: 0, lane: 0 }, [{ tick: 960, lane: 4 }])
const noteFrom0Lane1Via480Lane3To960Lane0 = createLongNote({ tick: 0, lane: 1 }, [
  { tick: 480, lane: 3 },
  { tick: 960, lane: 0 },
])
const noteFrom0Lane0Via240Lane2And480Lane1To960Lane4 = createLongNote({ tick: 0, lane: 0 }, [
  { tick: 240, lane: 2 },
  { tick: 480, lane: 1 },
  { tick: 960, lane: 4 },
])
const noteHoldAtLane1 = createLongNote({ tick: 0, lane: 1 }, [{ tick: 960, lane: 1 }])
const noteFrom0Lane0To960Lane1 = createLongNote({ tick: 0, lane: 0 }, [{ tick: 960, lane: 1 }])

describe('[ロングノーツ] 横位置の算出', () => {
  describe('正常系', () => {
    describe('続く点が終端だけのとき', () => {
      describe('始点が tick 0・レーン 0、終端が tick 960・レーン 4 のロングノーツのとき', () => {
        it.each([
          { tick: 0, lane: 0 },
          { tick: 480, lane: 2 },
          { tick: 960, lane: 4 },
        ])('tick $tick の横位置は、$lane になる', ({ tick, lane }) => {
          expect(interpolateLane(noteFrom0Lane0To960Lane4, tick)).toBe(lane)
        })
      })

      it('始点が tick 0・レーン 1、終端が tick 960・レーン 1 のロングノーツのとき、tick 300 の横位置は、1 になる', () => {
        expect(interpolateLane(noteHoldAtLane1, 300)).toBe(1)
      })

      it('始点が tick 0・レーン 0、終端が tick 960・レーン 1 のロングノーツのとき、tick 320 の横位置は、約 0.3333 になる', () => {
        expect(interpolateLane(noteFrom0Lane0To960Lane1, 320)).toBeCloseTo(0.3333, 4)
      })
    })

    describe('続く点が複数あるとき', () => {
      describe('始点が tick 0・レーン 1、続く点が tick 480・レーン 3 と tick 960・レーン 0 のロングノーツのとき', () => {
        it.each([
          { tick: 240, lane: 2 },
          { tick: 480, lane: 3 },
          { tick: 720, lane: 1.5 },
        ])('tick $tick の横位置は、$lane になる', ({ tick, lane }) => {
          expect(interpolateLane(noteFrom0Lane1Via480Lane3To960Lane0, tick)).toBe(lane)
        })
      })

      it('始点が tick 0・レーン 0、続く点が tick 240・レーン 2、tick 480・レーン 1、tick 960・レーン 4 のロングノーツのとき、tick 720 の横位置は、2.5 になる', () => {
        expect(interpolateLane(noteFrom0Lane0Via240Lane2And480Lane1To960Lane4, 720)).toBe(2.5)
      })
    })
  })
})
