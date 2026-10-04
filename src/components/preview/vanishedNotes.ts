import { getLastTick } from '../../domain/notes.ts'
import type { Chart, FlickDirection } from '../../domain/types.ts'

/** 消えるノーツの種類。タップ、フリック (向き付き)、ロングノーツの始点、ロングノーツの終端 (終端のフリックは、フリックとして扱う)。 */
export type VanishedKind =
  | { readonly kind: 'tap' }
  | { readonly kind: 'long' }
  | { readonly kind: 'long-end' }
  | { readonly kind: 'flick'; readonly direction: FlickDirection }

/** 判定ラインを過ぎて消えたノーツ (ロングノーツは始点と終端)。 */
export interface VanishedPoint {
  readonly lane: number
  readonly kind: VanishedKind
}

/** fromTick より後で toTick 以前に、判定ラインを過ぎたノーツを返す。タップ、フリック、ロングノーツの始点と終端が対象。 */
export function listVanishedPoints(chart: Chart, fromTick: number, toTick: number): VanishedPoint[] {
  const isPassed = (tick: number): boolean => tick > fromTick && tick <= toTick
  return chart.notes.flatMap((note): VanishedPoint[] => {
    switch (note.type) {
      case 'tap':
        return isPassed(note.tick) ? [{ lane: note.lane, kind: { kind: 'tap' } }] : []
      case 'flick':
        return isPassed(note.tick) ? [{ lane: note.lane, kind: { kind: 'flick', direction: note.direction } }] : []
      case 'long': {
        const tailLane = note.path[note.path.length - 1]?.lane ?? note.lane
        return [
          ...(isPassed(note.tick) ? [{ lane: note.lane, kind: { kind: 'long' } as const }] : []),
          ...(isPassed(getLastTick(note))
            ? [
                {
                  lane: tailLane,
                  kind:
                    note.end.kind === 'flick'
                      ? { kind: 'flick' as const, direction: note.end.direction }
                      : { kind: 'long-end' as const },
                },
              ]
            : []),
        ]
      }
    }
  })
}
