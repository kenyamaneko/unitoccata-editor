import {
  calculateLaneWidth,
  calculateNoteAreaLeft,
  calculateVisibleTickRange,
  convertLaneToCenterX,
  convertTickToY,
  getBarColumnRange,
  getMeterColumnRange,
  getTempoColumnRange,
  type SideColumn,
  type TimelineViewport,
} from './timelineLayout.ts'
import {
  ARROW_SIZE,
  BAR_LABEL_OFFSET_Y,
  BAR_LINE_WIDTH,
  DRAG_LINE_WIDTH,
  DRAG_MARKER_RADIUS,
  EDITING_TARGET_HEIGHT,
  FLICK_COLORS,
  HAIRLINE_OFFSET,
  LINE_WIDTH,
  LONG_END_ARROW_GAP,
  NOTE_CORNER_RADIUS,
  NOTE_HEIGHT,
  NOTE_WIDTH_RATIO,
  POINT_RADIUS,
  SELECTED_LINE_WIDTH,
  SIDE_LABEL_MARGIN_LEFT,
  SIDE_LABEL_OFFSET_Y,
  TEMPO_LABEL_PREFIX,
  THEME,
} from '../../constants/theme.ts'
import { assertNever } from '../../utils/assertNever.ts'
import { formatMeterText } from '../../domain/meterText.ts'
import type { GridDivision } from '../../domain/constants.ts'
import { calculateGridStepTicks } from '../../domain/grid.ts'
import { listPoints } from '../../domain/notes.ts'
import { convertTickToAudioSeconds, listBeats } from '../../domain/projectInfo.ts'
import type { Chart, ChartPoint, FlickDirection, LongNote, Note, ProjectInfo } from '../../domain/types.ts'

/** 描画中に重ねて見せる、ドラッグ操作の途中経過。 */
export type DragOverlay =
  | {
      readonly kind: 'rect'
      readonly left: number
      readonly top: number
      readonly right: number
      readonly bottom: number
    }
  | {
      /** ロングノーツを作るドラッグ。始点と終点は、吸着した譜面上の点。isValid が false のときは、ロングノーツにならない。 */
      readonly kind: 'long'
      readonly start: ChartPoint
      readonly end: ChartPoint
      readonly isValid: boolean
    }
  | {
      readonly kind: 'line'
      readonly fromX: number
      readonly fromY: number
      readonly toX: number
      readonly toY: number
    }

/** 波形のピーク。 */
export interface WaveformPeaks {
  readonly peaks: Float32Array
  readonly peakSeconds: number
}

/** タイムラインの描画内容。 */
export interface TimelineScene {
  readonly viewport: TimelineViewport
  readonly projectInfo: ProjectInfo
  readonly chart: Chart
  readonly selectedNoteIds: readonly string[]
  readonly gridDivision: GridDivision
  readonly waveform: WaveformPeaks | null
  readonly overlay: DragOverlay | null
  /** 貼り付ける位置を選ぶ間に、貼り付け後の位置に半透明で重ねるノーツ。貼り付ける位置を選んでいなければ null。 */
  readonly pastePreview: readonly Note[] | null
  /** BPM または拍子を入力中の位置。入力中でなければ null。 */
  readonly editingTarget: { readonly kind: SideColumn; readonly tick: number } | null
}

const BAR_LABEL_FONT = '700 16px ui-sans-serif, system-ui, sans-serif'
const SIDE_LABEL_FONT = '700 14px ui-sans-serif, system-ui, sans-serif'
const MIN_LINE_SPACING_PX = 4
const WAVEFORM_ROW_PX = 2

/** 貼り付けのプレビューの不透明度。置いてあるノーツと見分けられる薄さにする。 */
const PASTE_PREVIEW_ALPHA = 0.5

function drawLanes(ctx: CanvasRenderingContext2D, viewport: TimelineViewport): void {
  const left = calculateNoteAreaLeft()
  const laneWidth = calculateLaneWidth(viewport)
  for (let lane = 0; lane < viewport.laneCount; lane++) {
    ctx.fillStyle = lane % 2 === 0 ? THEME.laneEven : THEME.laneOdd
    ctx.fillRect(left + lane * laneWidth, 0, laneWidth, viewport.height)
  }
  ctx.strokeStyle = THEME.laneBorder
  ctx.lineWidth = LINE_WIDTH
  ctx.beginPath()
  for (let lane = 0; lane <= viewport.laneCount; lane++) {
    const x = Math.round(left + lane * laneWidth) + HAIRLINE_OFFSET
    ctx.moveTo(x, 0)
    ctx.lineTo(x, viewport.height)
  }
  ctx.stroke()
}

function drawWaveform(ctx: CanvasRenderingContext2D, scene: TimelineScene): void {
  const { viewport, projectInfo, waveform } = scene
  if (waveform === null) {
    return
  }
  const areaWidth = calculateLaneWidth(viewport) * viewport.laneCount
  const center = calculateNoteAreaLeft() + areaWidth / 2
  const range = calculateVisibleTickRange(viewport)
  ctx.fillStyle = THEME.waveform
  for (let y = 0; y < viewport.height; y += WAVEFORM_ROW_PX) {
    const tick = (range.to * (viewport.height - y) + range.from * y) / viewport.height
    const index = Math.floor(convertTickToAudioSeconds(projectInfo, tick) / waveform.peakSeconds)
    const peak = waveform.peaks[index]
    if (index < 0 || peak === undefined) {
      continue
    }
    const half = peak * (areaWidth / 2)
    ctx.fillRect(center - half, y, half * 2, WAVEFORM_ROW_PX)
  }
}

function drawGridLines(ctx: CanvasRenderingContext2D, scene: TimelineScene): void {
  const { viewport, gridDivision } = scene
  const step = calculateGridStepTicks(gridDivision)
  if (step * viewport.pixelsPerTick < MIN_LINE_SPACING_PX) {
    return
  }
  const range = calculateVisibleTickRange(viewport)
  const left = calculateNoteAreaLeft()
  const right = left + calculateLaneWidth(viewport) * viewport.laneCount
  ctx.strokeStyle = THEME.gridLine
  ctx.lineWidth = LINE_WIDTH
  ctx.beginPath()
  for (let tick = Math.max(0, Math.ceil(range.from / step) * step); tick <= range.to; tick += step) {
    const y = Math.round(convertTickToY(viewport, tick)) + HAIRLINE_OFFSET
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
  }
  ctx.stroke()
}

function drawBeatLines(ctx: CanvasRenderingContext2D, scene: TimelineScene): void {
  const { viewport, projectInfo } = scene
  const range = calculateVisibleTickRange(viewport)
  const left = calculateNoteAreaLeft()
  const right = left + calculateLaneWidth(viewport) * viewport.laneCount
  for (const beat of listBeats(projectInfo, Math.max(0, range.from), range.to + 1)) {
    const isBarStart = beat.beatInBar === 0
    const y = Math.round(convertTickToY(viewport, beat.tick)) + (isBarStart ? 0 : HAIRLINE_OFFSET)
    ctx.strokeStyle = isBarStart ? THEME.barLine : THEME.beatLine
    ctx.lineWidth = isBarStart ? BAR_LINE_WIDTH : LINE_WIDTH
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }
}

/** 小節番号の列に、各小節の頭の位置の線の少し上に、小節番号を描く。 */
function drawBarNumbers(ctx: CanvasRenderingContext2D, scene: TimelineScene): void {
  const { viewport, projectInfo } = scene
  const bar = getBarColumnRange()
  const range = calculateVisibleTickRange(viewport)
  ctx.font = BAR_LABEL_FONT
  ctx.fillStyle = THEME.barLabel
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const beat of listBeats(projectInfo, Math.max(0, range.from), range.to + 1)) {
    if (beat.beatInBar === 0) {
      ctx.fillText(
        String(beat.barNumber),
        (bar.left + bar.right) / 2,
        Math.round(convertTickToY(viewport, beat.tick)) - BAR_LABEL_OFFSET_Y,
      )
    }
  }
}

function drawSideLanes(ctx: CanvasRenderingContext2D, scene: TimelineScene): void {
  const { viewport, projectInfo } = scene
  const tempo = getTempoColumnRange()
  const meter = getMeterColumnRange()
  const bar = getBarColumnRange()
  ctx.fillStyle = THEME.sideLane
  ctx.fillRect(tempo.left, 0, bar.right, viewport.height)
  ctx.strokeStyle = THEME.laneBorder
  ctx.lineWidth = LINE_WIDTH
  ctx.beginPath()
  ctx.moveTo(tempo.right + HAIRLINE_OFFSET, 0)
  ctx.lineTo(tempo.right + HAIRLINE_OFFSET, viewport.height)
  ctx.moveTo(meter.right + HAIRLINE_OFFSET, 0)
  ctx.lineTo(meter.right + HAIRLINE_OFFSET, viewport.height)
  ctx.moveTo(bar.right + HAIRLINE_OFFSET, 0)
  ctx.lineTo(bar.right + HAIRLINE_OFFSET, viewport.height)
  ctx.stroke()
  ctx.font = SIDE_LABEL_FONT
  ctx.fillStyle = THEME.sideText
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (const change of projectInfo.tempo) {
    ctx.fillText(
      `${TEMPO_LABEL_PREFIX}${change.bpm}`,
      tempo.left + SIDE_LABEL_MARGIN_LEFT,
      convertTickToY(viewport, change.tick) - SIDE_LABEL_OFFSET_Y,
    )
  }
  for (const change of projectInfo.meter) {
    ctx.fillText(
      formatMeterText(change),
      meter.left + SIDE_LABEL_MARGIN_LEFT,
      convertTickToY(viewport, change.tick) - SIDE_LABEL_OFFSET_Y,
    )
  }
  drawBarNumbers(ctx, scene)
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, direction: FlickDirection): void {
  ctx.fillStyle = THEME.arrow
  ctx.beginPath()
  switch (direction) {
    case 'up':
      ctx.moveTo(x, y - ARROW_SIZE)
      ctx.lineTo(x - ARROW_SIZE, y + ARROW_SIZE / 2)
      ctx.lineTo(x + ARROW_SIZE, y + ARROW_SIZE / 2)
      break
    case 'left':
      ctx.moveTo(x - ARROW_SIZE, y)
      ctx.lineTo(x + ARROW_SIZE / 2, y - ARROW_SIZE)
      ctx.lineTo(x + ARROW_SIZE / 2, y + ARROW_SIZE)
      break
    case 'right':
      ctx.moveTo(x + ARROW_SIZE, y)
      ctx.lineTo(x - ARROW_SIZE / 2, y - ARROW_SIZE)
      ctx.lineTo(x - ARROW_SIZE / 2, y + ARROW_SIZE)
      break
    default:
      return assertNever(direction)
  }
  ctx.closePath()
  ctx.fill()
}

/** 多角形の角を丸めて、パスに加える。辺の中点から中点へ、頂点を通る円弧でつなぐ。 */
function traceRoundedPolygon(
  ctx: CanvasRenderingContext2D,
  vertices: readonly { readonly x: number; readonly y: number }[],
  radius: number,
): void {
  const middle = (a: { readonly x: number; readonly y: number }, b: { readonly x: number; readonly y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  })
  const last = vertices[vertices.length - 1]
  const first = vertices[0]
  if (last === undefined || first === undefined) {
    return
  }
  const start = middle(last, first)
  ctx.moveTo(start.x, start.y)
  vertices.forEach((vertex, i) => {
    const next = middle(vertex, vertices[(i + 1) % vertices.length] ?? first)
    ctx.arcTo(vertex.x, vertex.y, next.x, next.y, radius)
  })
  ctx.closePath()
}

function drawLongSegment(
  ctx: CanvasRenderingContext2D,
  half: number,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): void {
  const bottom = from.y + NOTE_HEIGHT / 2
  const top = to.y - NOTE_HEIGHT / 2
  ctx.beginPath()
  traceRoundedPolygon(
    ctx,
    [
      { x: from.x - half, y: bottom },
      { x: from.x + half, y: bottom },
      { x: to.x + half, y: top },
      { x: to.x - half, y: top },
    ],
    NOTE_CORNER_RADIUS,
  )
  ctx.fill()
  ctx.stroke()
}

function drawLong(ctx: CanvasRenderingContext2D, scene: TimelineScene, note: LongNote, selected: boolean): void {
  const { viewport } = scene
  const half = (calculateLaneWidth(viewport) * NOTE_WIDTH_RATIO) / 2
  const points = listPoints(note).map((point) => ({
    x: convertLaneToCenterX(viewport, point.lane),
    y: convertTickToY(viewport, point.tick),
  }))
  ctx.fillStyle = THEME.long
  ctx.strokeStyle = selected ? THEME.selected : THEME.shortNoteBorder
  ctx.lineWidth = selected ? SELECTED_LINE_WIDTH : LINE_WIDTH
  ctx.lineJoin = 'round'
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]
    const to = points[i]
    if (from === undefined || to === undefined) {
      throw new Error(`ロングノーツの点が足りません: ${i} 番目の点`)
    }
    drawLongSegment(ctx, half, from, to)
  }
  ctx.lineJoin = 'miter'
  points.forEach((point, index) => {
    const isEnd = index === points.length - 1
    ctx.fillStyle = isEnd && note.end.kind === 'flick' ? FLICK_COLORS[note.end.direction] : THEME.longPoint
    ctx.strokeStyle = selected ? THEME.selected : THEME.longEdge
    ctx.lineWidth = selected ? SELECTED_LINE_WIDTH : LINE_WIDTH
    ctx.beginPath()
    ctx.arc(point.x, point.y, POINT_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    if (isEnd && note.end.kind === 'flick') {
      drawArrow(ctx, point.x, point.y - POINT_RADIUS - ARROW_SIZE - LONG_END_ARROW_GAP, note.end.direction)
    }
  })
}

function drawShortNote(ctx: CanvasRenderingContext2D, scene: TimelineScene, note: Note, selected: boolean): void {
  const { viewport } = scene
  const width = calculateLaneWidth(viewport) * NOTE_WIDTH_RATIO
  const x = convertLaneToCenterX(viewport, note.lane)
  const y = convertTickToY(viewport, note.tick)
  ctx.fillStyle = note.type === 'flick' ? FLICK_COLORS[note.direction] : THEME.tap
  ctx.strokeStyle = selected ? THEME.selected : THEME.shortNoteBorder
  ctx.lineWidth = selected ? SELECTED_LINE_WIDTH : LINE_WIDTH
  ctx.beginPath()
  ctx.roundRect(x - width / 2, y - NOTE_HEIGHT / 2, width, NOTE_HEIGHT, NOTE_CORNER_RADIUS)
  ctx.fill()
  ctx.stroke()
  if (note.type === 'flick') {
    drawArrow(ctx, x, y, note.direction)
  }
}

function drawEditingTarget(ctx: CanvasRenderingContext2D, scene: TimelineScene): void {
  const { viewport, editingTarget } = scene
  if (editingTarget === null) {
    return
  }
  const column = editingTarget.kind === 'tempo' ? getTempoColumnRange() : getMeterColumnRange()
  const y = Math.round(convertTickToY(viewport, editingTarget.tick)) + HAIRLINE_OFFSET
  ctx.fillStyle = THEME.editingTargetFill
  ctx.fillRect(column.left, y - EDITING_TARGET_HEIGHT, column.right - column.left, EDITING_TARGET_HEIGHT)
  ctx.strokeStyle = THEME.editingTarget
  ctx.lineWidth = BAR_LINE_WIDTH
  ctx.strokeRect(column.left + 1, y - EDITING_TARGET_HEIGHT, column.right - column.left - 2, EDITING_TARGET_HEIGHT)
  ctx.beginPath()
  ctx.moveTo(column.left, y)
  ctx.lineTo(calculateNoteAreaLeft() + calculateLaneWidth(viewport) * viewport.laneCount, y)
  ctx.stroke()
}

function drawNotes(ctx: CanvasRenderingContext2D, scene: TimelineScene): void {
  const selected = new Set(scene.selectedNoteIds)
  for (const note of scene.chart.notes) {
    if (note.type === 'long') {
      drawLong(ctx, scene, note, selected.has(note.id))
    }
  }
  for (const note of scene.chart.notes) {
    if (note.type !== 'long') {
      drawShortNote(ctx, scene, note, selected.has(note.id))
    }
  }
}

function drawPastePreview(ctx: CanvasRenderingContext2D, scene: TimelineScene): void {
  if (scene.pastePreview === null) {
    return
  }
  ctx.save()
  ctx.globalAlpha = PASTE_PREVIEW_ALPHA
  for (const note of scene.pastePreview) {
    if (note.type === 'long') {
      drawLong(ctx, scene, note, false)
    } else {
      drawShortNote(ctx, scene, note, false)
    }
  }
  ctx.restore()
}

function drawOverlay(ctx: CanvasRenderingContext2D, viewport: TimelineViewport, overlay: DragOverlay | null): void {
  if (overlay === null) {
    return
  }
  if (overlay.kind === 'rect') {
    ctx.fillStyle = THEME.rubberBand
    ctx.strokeStyle = THEME.rubberBandBorder
    ctx.lineWidth = LINE_WIDTH
    ctx.fillRect(overlay.left, overlay.top, overlay.right - overlay.left, overlay.bottom - overlay.top)
    ctx.strokeRect(
      overlay.left + HAIRLINE_OFFSET,
      overlay.top + HAIRLINE_OFFSET,
      overlay.right - overlay.left,
      overlay.bottom - overlay.top,
    )
    return
  }
  if (overlay.kind === 'long') {
    const color = overlay.isValid ? THEME.dragMarker : THEME.dragInvalid
    const from = {
      x: convertLaneToCenterX(viewport, overlay.start.lane),
      y: convertTickToY(viewport, overlay.start.tick),
    }
    const to = { x: convertLaneToCenterX(viewport, overlay.end.lane), y: convertTickToY(viewport, overlay.end.tick) }
    ctx.strokeStyle = color
    ctx.lineWidth = DRAG_LINE_WIDTH
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.fillStyle = color
    for (const point of [from, to]) {
      ctx.beginPath()
      ctx.arc(point.x, point.y, DRAG_MARKER_RADIUS, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  ctx.strokeStyle = THEME.ghost
  ctx.lineWidth = DRAG_LINE_WIDTH
  ctx.beginPath()
  ctx.moveTo(overlay.fromX, overlay.fromY)
  ctx.lineTo(overlay.toX, overlay.toY)
  ctx.stroke()
}

/** タイムライン全体を描く。下が過去、上が未来になる。 */
export function drawTimeline(ctx: CanvasRenderingContext2D, scene: TimelineScene): void {
  const { viewport } = scene
  ctx.fillStyle = THEME.background
  ctx.fillRect(0, 0, viewport.width, viewport.height)
  drawLanes(ctx, viewport)
  drawWaveform(ctx, scene)
  drawGridLines(ctx, scene)
  drawBeatLines(ctx, scene)
  drawSideLanes(ctx, scene)
  drawEditingTarget(ctx, scene)
  drawNotes(ctx, scene)
  drawPastePreview(ctx, scene)
  drawOverlay(ctx, viewport, scene.overlay)
}
