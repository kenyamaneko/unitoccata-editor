import { assertNever } from '../utils/assertNever.ts'
import { MAX_NOTE_COUNT } from './constants.ts'
import {
  findNoteProblem,
  hasNewLongNoteOnLong,
  hasNewShortNoteOnLong,
  listPoints,
  mapPoints,
  mirrorDirection,
  sortNotes,
  type NoteProblem,
} from './notes.ts'
import type { Chart, ChartPoint, FlickDirection, FlickNote, LongNote, Note, NoteBody, PointRef } from './types.ts'

/**
 * 編集が成立しなかった理由。
 * point-not-found は指した点が譜面にない、flick-needs-long-end はロングの最後の終端でない点にフリックを付けようとした、
 * extend-needs-long-end はロングの最後の終端でない点から連結しようとした、no-flick は解除できるフリックがない、
 * short-note-on-long はタップまたはフリックがロングの上に重なる、long-note-on-long はロングどうしが重なる、too-many-notes はノーツが上限を超える。
 */
export type EditFailureReason =
  | NoteProblem
  | 'too-many-notes'
  | 'short-note-on-long'
  | 'long-note-on-long'
  | 'point-not-found'
  | 'flick-needs-long-end'
  | 'extend-needs-long-end'
  | 'no-flick'

/** 編集の結果。成立すれば新しい譜面、しなければ理由を返す。 */
export type EditResult =
  { readonly ok: true; readonly chart: Chart } | { readonly ok: false; readonly reason: EditFailureReason }

/** コピーしたノーツ。位置は、コピーした全ての点の最小 tick と最小 lane を原点とした相対値。 */
export interface ClipboardData {
  readonly notes: readonly NoteBody[]
}

/** 範囲選択の矩形。端を含む。 */
export interface SelectionRect {
  readonly minTick: number
  readonly maxTick: number
  readonly minLane: number
  readonly maxLane: number
}

function succeed(chart: Chart): EditResult {
  return { ok: true, chart }
}

function fail(reason: EditFailureReason): EditResult {
  return { ok: false, reason }
}

function validateAndBuild(notes: readonly Note[], laneCount: number, before: Chart): EditResult {
  const sorted = sortNotes(notes)
  const problem = findNoteProblem(sorted, laneCount)
  if (problem !== null) {
    return fail(problem)
  }
  if (sorted.length > MAX_NOTE_COUNT && sorted.length > before.notes.length) {
    return fail('too-many-notes')
  }
  if (hasNewShortNoteOnLong(before.notes, sorted)) {
    return fail('short-note-on-long')
  }
  return hasNewLongNoteOnLong(before.notes, sorted) ? fail('long-note-on-long') : succeed({ notes: sorted })
}

function findNote(chart: Chart, noteId: string): Note | undefined {
  return chart.notes.find((note) => note.id === noteId)
}

function findNoteWithPoint(chart: Chart, ref: PointRef): Note | undefined {
  const note = findNote(chart, ref.noteId)
  return note !== undefined && ref.index >= 0 && ref.index < listPoints(note).length ? note : undefined
}

function replaceNote(chart: Chart, replacement: Note): Note[] {
  return chart.notes.map((note) => (note.id === replacement.id ? replacement : note))
}

/** ノーツを 1 つ追加する。 */
export function addNote(chart: Chart, note: Note, laneCount: number): EditResult {
  return validateAndBuild([...chart.notes, note], laneCount, chart)
}

/** ロングの終端から点を 1 つ伸ばす (連結)。元の終端が中継点になり、終端フリックは解除する。ref はロングの最後の終端を指す。 */
export function extendLong(chart: Chart, ref: PointRef, point: ChartPoint, laneCount: number): EditResult {
  const note = findNoteWithPoint(chart, ref)
  if (note === undefined) {
    return fail('point-not-found')
  }
  if (note.type !== 'long' || !isEndPoint(note, ref.index)) {
    return fail('extend-needs-long-end')
  }
  const extended: LongNote = { ...note, path: [...note.path, point], end: { kind: 'release' } }
  return validateAndBuild(replaceNote(chart, extended), laneCount, chart)
}

function isEndPoint(note: Note, index: number): boolean {
  return index === listPoints(note).length - 1
}

/** タップ、フリック、ロングの終端のフリック方向を指定する。 */
export function setFlickDirection(
  chart: Chart,
  ref: PointRef,
  direction: FlickDirection,
  laneCount: number,
): EditResult {
  const note = findNoteWithPoint(chart, ref)
  if (note === undefined) {
    return fail('point-not-found')
  }
  switch (note.type) {
    case 'tap':
    case 'flick': {
      const flick: FlickNote = { id: note.id, type: 'flick', tick: note.tick, lane: note.lane, direction }
      return validateAndBuild(replaceNote(chart, flick), laneCount, chart)
    }
    case 'long': {
      if (!isEndPoint(note, ref.index)) {
        return fail('flick-needs-long-end')
      }
      return validateAndBuild(replaceNote(chart, { ...note, end: { kind: 'flick', direction } }), laneCount, chart)
    }
    default:
      return assertNever(note)
  }
}

/** フリックをタップに戻す。ロングの終端フリックは離す終端に戻す。 */
export function clearFlick(chart: Chart, ref: PointRef, laneCount: number): EditResult {
  const note = findNoteWithPoint(chart, ref)
  if (note === undefined) {
    return fail('point-not-found')
  }
  switch (note.type) {
    case 'tap':
      return fail('no-flick')
    case 'flick': {
      return validateAndBuild(
        replaceNote(chart, { id: note.id, type: 'tap', tick: note.tick, lane: note.lane }),
        laneCount,
        chart,
      )
    }
    case 'long': {
      if (!isEndPoint(note, ref.index) || note.end.kind !== 'flick') {
        return fail('no-flick')
      }
      return validateAndBuild(replaceNote(chart, { ...note, end: { kind: 'release' } }), laneCount, chart)
    }
    default:
      return assertNever(note)
  }
}

/**
 * 点を削除する。タップとフリックは削除する。ロングの始点はロング全体を削除する。
 * ロングの中継点と終端は、その点以降を削除し、1 つ前の点を新しい終端にする。
 * 1 つ前の点が始点になる (path が空になる) 場合は、ロング全体を削除する。
 */
export function deletePoint(chart: Chart, ref: PointRef, laneCount: number): EditResult {
  const note = findNoteWithPoint(chart, ref)
  if (note === undefined) {
    return fail('point-not-found')
  }
  const others = chart.notes.filter((candidate) => candidate.id !== note.id)
  if (note.type !== 'long' || ref.index <= 1) {
    return validateAndBuild(others, laneCount, chart)
  }
  const truncated: LongNote = { ...note, path: note.path.slice(0, ref.index - 1), end: { kind: 'release' } }
  return validateAndBuild([...others, truncated], laneCount, chart)
}

/** 点を指定の位置へ動かす。ロングの点は前後の点を越えて動かせない。 */
export function movePoint(chart: Chart, ref: PointRef, to: ChartPoint, laneCount: number): EditResult {
  const note = findNoteWithPoint(chart, ref)
  if (note === undefined) {
    return fail('point-not-found')
  }
  const points = listPoints(note)
  const previous = points[ref.index - 1]
  const next = points[ref.index + 1]
  if ((previous !== undefined && to.tick <= previous.tick) || (next !== undefined && to.tick >= next.tick)) {
    return fail('invalid-long-order')
  }
  let moved: Note
  if (ref.index === 0) {
    moved = { ...note, tick: to.tick, lane: to.lane }
  } else {
    const path = (note as LongNote).path.map((point, i) => (i === ref.index - 1 ? to : point))
    moved = { ...(note as LongNote), path }
  }
  return validateAndBuild(replaceNote(chart, moved), laneCount, chart)
}

/** 指定したノーツ全体 (ロングノーツは全ての点) を、tick とレーンの差だけ、まとめて動かす。 */
export function moveNotes(
  chart: Chart,
  noteIds: readonly string[],
  deltaTick: number,
  deltaLane: number,
  laneCount: number,
): EditResult {
  const targets = new Set(noteIds)
  if (!chart.notes.some((note) => targets.has(note.id))) {
    return fail('point-not-found')
  }
  const moved = chart.notes.map((note) =>
    targets.has(note.id)
      ? mapPoints(note, (point) => ({ tick: point.tick + deltaTick, lane: point.lane + deltaLane }))
      : note,
  )
  return validateAndBuild(moved, laneCount, chart)
}

/** 指定したノーツのレーンを左右反転し、フリックの方向も入れ替える。 */
export function mirrorNotes(chart: Chart, noteIds: readonly string[], laneCount: number): EditResult {
  const targets = new Set(noteIds)
  const lastLane = laneCount - 1
  const mirrored = chart.notes.map((note) => {
    if (!targets.has(note.id)) {
      return note
    }
    const flipped = mapPoints(note, (point) => ({ tick: point.tick, lane: lastLane - point.lane }))
    switch (flipped.type) {
      case 'tap':
        return flipped
      case 'flick':
        return { ...flipped, direction: mirrorDirection(flipped.direction) }
      case 'long':
        return flipped.end.kind === 'flick'
          ? { ...flipped, end: { kind: 'flick' as const, direction: mirrorDirection(flipped.end.direction) } }
          : flipped
      default:
        return assertNever(flipped)
    }
  })
  return validateAndBuild(mirrored, laneCount, chart)
}

/** 矩形の中に 1 点でも入るノーツの id を返す。 */
export function selectNotesInRect(chart: Chart, rect: SelectionRect): string[] {
  return chart.notes
    .filter((note) =>
      listPoints(note).some(
        (point) =>
          point.tick >= rect.minTick &&
          point.tick <= rect.maxTick &&
          point.lane >= rect.minLane &&
          point.lane <= rect.maxLane,
      ),
    )
    .map((note) => note.id)
}

function stripId(note: Note): NoteBody {
  const { id: _id, ...body } = note
  return body
}

/** 指定したノーツをクリップボード用のデータにする。 */
export function createClipboard(chart: Chart, noteIds: readonly string[]): ClipboardData {
  const targets = new Set(noteIds)
  const selected = chart.notes.filter((note) => targets.has(note.id))
  const points = selected.flatMap((note) => listPoints(note))
  if (points.length === 0) {
    return { notes: [] }
  }
  const originTick = Math.min(...points.map((point) => point.tick))
  const originLane = Math.min(...points.map((point) => point.lane))
  return {
    notes: selected.map((note) =>
      mapPoints(stripId(note), (point) => ({ tick: point.tick - originTick, lane: point.lane - originLane })),
    ),
  }
}

/** 指定したノーツを、まとめて削除する。 */
export function deleteNotes(chart: Chart, noteIds: readonly string[], laneCount: number): EditResult {
  const targets = new Set(noteIds)
  return validateAndBuild(
    chart.notes.filter((note) => !targets.has(note.id)),
    laneCount,
    chart,
  )
}

/** クリップボードのノーツを、原点を指定の位置に合わせて貼り付ける。id は createId で採番する。 */
export function pasteClipboard(
  chart: Chart,
  clipboard: ClipboardData,
  origin: ChartPoint,
  createId: () => string,
  laneCount: number,
): EditResult {
  const pasted = clipboard.notes.map(
    (body) =>
      ({
        ...mapPoints(body, (point) => ({ tick: point.tick + origin.tick, lane: point.lane + origin.lane })),
        id: createId(),
      }) as Note,
  )
  return validateAndBuild([...chart.notes, ...pasted], laneCount, chart)
}
