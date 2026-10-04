import { getLastTick, interpolateLane } from '../../domain/notes.ts'
import type { Chart } from '../../domain/types.ts'

/** 判定ラインに当たっている (始点は過ぎ、終端はまだ過ぎていない) ロングノーツと、そのいまの横位置。 */
export interface HeldLong {
  readonly id: string
  readonly lane: number
}

/** tick の時点で、判定ラインに当たっているロングノーツを返す。横位置は、点と点の間を補間した値。 */
export function listHeldLongs(chart: Chart, tick: number): HeldLong[] {
  return chart.notes.flatMap((note): HeldLong[] =>
    note.type === 'long' && note.tick <= tick && tick < getLastTick(note)
      ? [{ id: note.id, lane: interpolateLane(note, tick) }]
      : [],
  )
}
