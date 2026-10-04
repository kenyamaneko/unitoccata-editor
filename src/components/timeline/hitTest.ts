import { NOTE_HEIGHT, NOTE_WIDTH_RATIO } from '../../constants/theme.ts'
import { POINT_HIT_RADIUS } from '../../constants/canvas.ts'
import { calculateLaneWidth, convertLaneToCenterX, convertTickToY, type TimelineViewport } from './timelineLayout.ts'
import { listPoints } from '../../domain/notes.ts'
import type { Chart, Note, PointRef } from '../../domain/types.ts'

/** マウスの下にあるノーツの点。 */
export interface PointHit {
  readonly ref: PointRef
  readonly note: Note
}

function isOnShortNote(viewport: TimelineViewport, note: Note, x: number, y: number): boolean {
  const halfWidth = (calculateLaneWidth(viewport) * NOTE_WIDTH_RATIO) / 2
  return (
    Math.abs(convertLaneToCenterX(viewport, note.lane) - x) <= halfWidth &&
    Math.abs(convertTickToY(viewport, note.tick) - y) <= NOTE_HEIGHT / 2
  )
}

/**
 * 指定した位置 (px) にあるノーツの点を返す。なければ null。
 * タップノーツとフリックノーツは描いた矩形の中、ロングノーツの点は点の近くにあるものを掴める。重なるときは中心に近いものを選ぶ。
 */
export function findPointAt(chart: Chart, viewport: TimelineViewport, x: number, y: number): PointHit | null {
  let best: PointHit | null = null
  let bestDistance = Infinity
  for (const note of chart.notes) {
    const points = listPoints(note)
    points.forEach((point, index) => {
      const distance = Math.hypot(
        convertLaneToCenterX(viewport, point.lane) - x,
        convertTickToY(viewport, point.tick) - y,
      )
      const isGrabbed = note.type === 'long' ? distance <= POINT_HIT_RADIUS : isOnShortNote(viewport, note, x, y)
      if (isGrabbed && distance < bestDistance) {
        bestDistance = distance
        best = { ref: { noteId: note.id, index }, note }
      }
    })
  }
  return best
}

/**
 * 指定した位置 (px) にあるロングノーツの本体 (点と点の間の長方形) を返す。なければ null。
 * 点そのものは findPointAt が先に見つけるので、点の間にある部分を調べる。重なるときは最後に描いたものを選ぶ。
 */
export function findLongBodyAt(chart: Chart, viewport: TimelineViewport, x: number, y: number): Note | null {
  const halfWidth = (calculateLaneWidth(viewport) * NOTE_WIDTH_RATIO) / 2
  let found: Note | null = null
  for (const note of chart.notes) {
    if (note.type !== 'long') {
      continue
    }
    const points = listPoints(note).map((point) => ({
      x: convertLaneToCenterX(viewport, point.lane),
      y: convertTickToY(viewport, point.tick),
    }))
    const isInBody = points.some((to, i) => {
      const from = points[i - 1]
      if (from === undefined) {
        return false
      }
      const top = to.y - NOTE_HEIGHT / 2
      const bottom = from.y + NOTE_HEIGHT / 2
      const ratio = to.y === from.y ? 0 : (y - from.y) / (to.y - from.y)
      const centerX = from.x + (to.x - from.x) * Math.min(1, Math.max(0, ratio))
      return y >= top && y <= bottom && Math.abs(x - centerX) <= halfWidth
    })
    if (isInBody) {
      found = note
    }
  }
  return found
}
