import { assertNever } from '../utils/assertNever.ts'
import { NOTE_OVERLAP_LANE_DISTANCE } from './constants.ts'
import type { ChartPoint, FlickDirection, LongNote, Note, NoteBody } from './types.ts'

/** ノーツの検証で見つかる問題の種類。 */
export type NoteProblem = 'out-of-range' | 'invalid-long-order' | 'duplicate-position'

/** ノーツの始点と、ロングなら path の点を、時刻順に返す。 */
export function listPoints(note: NoteBody): ChartPoint[] {
  const start = { tick: note.tick, lane: note.lane }
  return note.type === 'long' ? [start, ...note.path] : [start]
}

/** ノーツの最後の点の tick を返す。ロング以外は始点の tick。 */
export function getLastTick(note: NoteBody): number {
  const points = listPoints(note)
  return (points[points.length - 1] as ChartPoint).tick
}

/** tick 順、同じ tick なら lane 順に並べ替えた新しい配列を返す。 */
export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => a.tick - b.tick || a.lane - b.lane)
}

/** ノーツの全ての点に変換を適用した、同じ種類のノーツを返す。 */
export function mapPoints<T extends NoteBody>(note: T, transform: (point: ChartPoint) => ChartPoint): T {
  const start = transform({ tick: note.tick, lane: note.lane })
  if (note.type === 'long') {
    return { ...note, tick: start.tick, lane: start.lane, path: note.path.map(transform) } as T
  }
  return { ...note, tick: start.tick, lane: start.lane } as T
}

/** フリックの方向を左右反転する。上はそのまま。 */
export function mirrorDirection(direction: FlickDirection): FlickDirection {
  switch (direction) {
    case 'left':
      return 'right'
    case 'right':
      return 'left'
    case 'up':
      return 'up'
    default:
      return assertNever(direction)
  }
}

/**
 * ロングの指定 tick での横位置 (レーン) を、点と点の間を tick で線形補間して返す。
 * ロングの範囲外の tick は、始点より前なら始点のレーン、終端より後なら終端のレーンになる。
 */
export function interpolateLane(note: LongNote, tick: number): number {
  const points = listPoints(note)
  const first = points[0] as ChartPoint
  const last = points[points.length - 1] as ChartPoint
  if (tick <= first.tick) {
    return first.lane
  }
  if (tick >= last.tick) {
    return last.lane
  }
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1] as ChartPoint
    const to = points[i] as ChartPoint
    if (tick <= to.tick) {
      return from.lane + ((to.lane - from.lane) * (tick - from.tick)) / (to.tick - from.tick)
    }
  }
  return last.lane
}

function isValidPosition(point: ChartPoint, laneCount: number | null): boolean {
  return (
    Number.isInteger(point.tick) &&
    point.tick >= 0 &&
    Number.isInteger(point.lane) &&
    point.lane >= 0 &&
    (laneCount === null || point.lane < laneCount)
  )
}

function isLongOrderValid(note: LongNote): boolean {
  const points = listPoints(note)
  if (points.length < 2) {
    return false
  }
  return points.every((point, i) => i === 0 || point.tick > (points[i - 1] as ChartPoint).tick)
}

/** ノーツの並びの問題と、問題のあるノーツの始点の位置。 */
export interface NoteProblemLocation {
  readonly problem: NoteProblem
  readonly tick: number
  readonly lane: number
}

/**
 * ノーツの並びの問題を最初の 1 件だけ、問題のあるノーツの始点の位置とともに返す。問題がなければ null。
 * 位置が範囲外、ロングの tick が狭義単調増加でない、同じ tick と lane に始点が重なる、の 3 種類を調べる。
 * @param laneCount レーン数。null のときは、レーンの上限を検査しない (0 以上の整数であることだけを調べる)。
 */
export function locateNoteProblem(notes: readonly Note[], laneCount: number | null): NoteProblemLocation | null {
  const startKeys = new Set<string>()
  for (const note of notes) {
    const at = { tick: note.tick, lane: note.lane }
    if (!listPoints(note).every((point) => isValidPosition(point, laneCount))) {
      return { problem: 'out-of-range', ...at }
    }
    if (note.type === 'long' && !isLongOrderValid(note)) {
      return { problem: 'invalid-long-order', ...at }
    }
    const key = `${note.tick}:${note.lane}`
    if (startKeys.has(key)) {
      return { problem: 'duplicate-position', ...at }
    }
    startKeys.add(key)
  }
  return null
}

/**
 * ノーツの並びの問題を最初の 1 件だけ返す。問題がなければ null。
 * 位置が範囲外、ロングの tick が狭義単調増加でない、同じ tick と lane に始点が重なる、の 3 種類を調べる。
 */
export function findNoteProblem(notes: readonly Note[], laneCount: number): NoteProblem | null {
  return locateNoteProblem(notes, laneCount)?.problem ?? null
}

function isShortNoteOnLong(short: Note, long: LongNote): boolean {
  const last = getLastTick(long)
  return (
    short.tick >= long.tick &&
    short.tick <= last &&
    Math.abs(interpolateLane(long, short.tick) - short.lane) < NOTE_OVERLAP_LANE_DISTANCE
  )
}

function listShortNoteOnLongPairs(notes: readonly Note[]): Set<string> {
  const pairs = new Set<string>()
  for (const long of notes) {
    if (long.type !== 'long') {
      continue
    }
    for (const note of notes) {
      if (note.type !== 'long' && isShortNoteOnLong(note, long)) {
        pairs.add(`${note.id}:${long.id}`)
      }
    }
  }
  return pairs
}

/** 編集の前にはなかった、タップノーツまたはフリックノーツがロングノーツの上に重なる組があるか。もともとあった重なりは数えない。 */
export function hasNewShortNoteOnLong(before: readonly Note[], after: readonly Note[]): boolean {
  const existing = listShortNoteOnLongPairs(before)
  return [...listShortNoteOnLongPairs(after)].some((pair) => !existing.has(pair))
}

/** 2 つのロングノーツが、同じ時間にある範囲で、横位置がノーツの幅より近づく (重なって見える) か。 */
function isLongNoteOnLong(a: LongNote, b: LongNote): boolean {
  const start = Math.max(a.tick, b.tick)
  const end = Math.min(getLastTick(a), getLastTick(b))
  if (start > end) {
    return false
  }
  const ticks = [
    ...new Set([start, end, ...listPoints(a).map((point) => point.tick), ...listPoints(b).map((point) => point.tick)]),
  ]
    .filter((tick) => tick >= start && tick <= end)
    .sort((x, y) => x - y)
  const gaps = ticks.map((tick) => interpolateLane(a, tick) - interpolateLane(b, tick))
  return gaps.some(
    (gap, i) =>
      Math.abs(gap) < NOTE_OVERLAP_LANE_DISTANCE || (i > 0 && Math.sign(gap) !== Math.sign(gaps[i - 1] as number)),
  )
}

function listLongNoteOnLongPairs(notes: readonly Note[]): Set<string> {
  const longs = notes.filter((note): note is LongNote => note.type === 'long')
  const pairs = new Set<string>()
  longs.forEach((a, i) => {
    for (const b of longs.slice(i + 1)) {
      if (isLongNoteOnLong(a, b)) {
        pairs.add([a.id, b.id].sort().join(':'))
      }
    }
  })
  return pairs
}

/** 編集の前にはなかった、ロングノーツどうしが重なる組があるか。もともとあった重なりは数えない。 */
export function hasNewLongNoteOnLong(before: readonly Note[], after: readonly Note[]): boolean {
  const existing = listLongNoteOnLongPairs(before)
  return [...listLongNoteOnLongPairs(after)].some((pair) => !existing.has(pair))
}
