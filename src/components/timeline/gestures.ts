import {
  calculateLaneWidth,
  convertXToLanePosition,
  convertYToTick,
  classifyColumn,
  type TimelineViewport,
} from './timelineLayout.ts'
import { LONG_THRESHOLD, type GridDivision } from '../../domain/constants.ts'
import type { SelectionRect } from '../../domain/chartEditing.ts'
import { calculateGridStepTicks, resolveFlickDrag, snapTickToGrid } from '../../domain/grid.ts'
import type { ChartPoint, FlickDirection, PointRef } from '../../domain/types.ts'
import type { PointHit } from './hitTest.ts'

/** ポインタの位置 (px)。 */
export interface PointerPosition {
  readonly x: number
  readonly y: number
}

/** 押し始めた場所にあったもの。 */
export type PointerTarget =
  | { readonly kind: 'empty' }
  | { readonly kind: 'point'; readonly hit: PointHit }
  | { readonly kind: 'longBody'; readonly noteId: string }

/** ポインタを離したときに決まる編集の意図。 */
export type EditorIntent =
  | { readonly kind: 'placeTap'; readonly at: ChartPoint }
  | { readonly kind: 'createLong'; readonly start: ChartPoint; readonly end: ChartPoint }
  | { readonly kind: 'extendLong'; readonly ref: PointRef; readonly to: ChartPoint }
  | { readonly kind: 'setFlick'; readonly ref: PointRef; readonly direction: FlickDirection }
  | { readonly kind: 'clearFlick'; readonly ref: PointRef }
  | { readonly kind: 'movePoint'; readonly ref: PointRef; readonly to: ChartPoint }
  | { readonly kind: 'moveNote'; readonly noteId: string; readonly deltaTick: number; readonly deltaLane: number }
  | { readonly kind: 'selectRect'; readonly rect: SelectionRect }

/** ドラッグの入力。 */
export interface DragInput {
  readonly down: PointerPosition
  readonly up: PointerPosition
  readonly shiftKey: boolean
  readonly target: PointerTarget
  readonly viewport: TimelineViewport
  readonly gridDivision: GridDivision
  /** 押した時点の譜面上の点。空いた位置を押したときだけ持つ。押したあとにスクロールしても、始点がずれないように使う。 */
  readonly startPoint: ChartPoint | null
  /** 点の tick の上限。スクロールの上限。 */
  readonly maxTick: number
}

/** ロングノーツの 2 点を、tick の小さいほうを始点として並べる。 */
export function orderLongPoints(
  a: ChartPoint,
  b: ChartPoint,
): { readonly start: ChartPoint; readonly end: ChartPoint } {
  return a.tick <= b.tick ? { start: a, end: b } : { start: b, end: a }
}

/** 位置 (px) を、グリッド線とレーンに合わせた譜面上の点にする。tick は maxTick までに丸める。ノーツレーンの外ならば null。 */
export function resolveGridPoint(
  viewport: TimelineViewport,
  gridDivision: GridDivision,
  position: PointerPosition,
  maxTick = Infinity,
): ChartPoint | null {
  if (classifyColumn(viewport, position.x) !== 'notes') {
    return null
  }
  const lane = Math.min(viewport.laneCount - 1, Math.max(0, Math.floor(convertXToLanePosition(viewport, position.x))))
  return { tick: Math.min(maxTick, snapTickToGrid(convertYToTick(viewport, position.y), gridDivision)), lane }
}

function isClick(down: PointerPosition, up: PointerPosition): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) < LONG_THRESHOLD
}

function resolveSelectionRect(viewport: TimelineViewport, a: PointerPosition, b: PointerPosition): SelectionRect {
  const tickA = convertYToTick(viewport, a.y)
  const tickB = convertYToTick(viewport, b.y)
  const laneA = convertXToLanePosition(viewport, a.x) - 0.5
  const laneB = convertXToLanePosition(viewport, b.x) - 0.5
  return {
    minTick: Math.min(tickA, tickB),
    maxTick: Math.max(tickA, tickB),
    minLane: Math.ceil(Math.min(laneA, laneB)),
    maxLane: Math.floor(Math.max(laneA, laneB)),
  }
}

function decideFromPoint(input: DragInput, hit: PointHit): EditorIntent | null {
  const { down, up, viewport, gridDivision, maxTick } = input
  if (input.shiftKey) {
    const to = resolveGridPoint(viewport, gridDivision, up, maxTick)
    if (to === null) {
      return null
    }
    return { kind: 'movePoint', ref: hit.ref, to }
  }
  if (isClick(down, up)) {
    return null
  }
  if (hit.note.type === 'long') {
    const to = resolveGridPoint(viewport, gridDivision, up, maxTick)
    return to === null ? null : { kind: 'extendLong', ref: hit.ref, to }
  }
  const laneWidth = calculateLaneWidth(viewport)
  const stepHeight = calculateGridStepTicks(gridDivision) * viewport.pixelsPerTick
  const result = resolveFlickDrag((up.x - down.x) / laneWidth, (down.y - up.y) / stepHeight)
  if (result === null) {
    return null
  }
  return result === 'tap' ? { kind: 'clearFlick', ref: hit.ref } : { kind: 'setFlick', ref: hit.ref, direction: result }
}

function decideFromLongBody(input: DragInput, noteId: string): EditorIntent | null {
  const { down, up, viewport, gridDivision, maxTick } = input
  const from = resolveGridPoint(viewport, gridDivision, down, maxTick)
  const to = resolveGridPoint(viewport, gridDivision, up, maxTick)
  if (from === null || to === null || isClick(down, up)) {
    return null
  }
  const deltaTick = to.tick - from.tick
  const deltaLane = to.lane - from.lane
  return deltaTick === 0 && deltaLane === 0 ? null : { kind: 'moveNote', noteId, deltaTick, deltaLane }
}

function decideFromEmpty(input: DragInput): EditorIntent | null {
  const { down, up, viewport, gridDivision, startPoint, maxTick } = input
  if (input.shiftKey && input.target.kind === 'longBody') {
    return decideFromLongBody(input, input.target.noteId)
  }
  if (input.shiftKey) {
    return isClick(down, up) ? null : { kind: 'selectRect', rect: resolveSelectionRect(viewport, down, up) }
  }
  if (startPoint === null) {
    return null
  }
  if (isClick(down, up)) {
    return { kind: 'placeTap', at: startPoint }
  }
  const end = resolveGridPoint(viewport, gridDivision, up, maxTick)
  return end === null ? null : { kind: 'createLong', ...orderLongPoints(startPoint, end) }
}

/** ポインタを押してから離すまでの操作を、編集の意図にする。意図がなければ null。 */
export function decideIntent(input: DragInput): EditorIntent | null {
  return input.target.kind === 'point' ? decideFromPoint(input, input.target.hit) : decideFromEmpty(input)
}
