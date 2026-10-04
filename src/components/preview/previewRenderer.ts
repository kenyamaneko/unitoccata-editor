import { assertNever } from '../../utils/assertNever.ts'
import { convertSecondsToTick, convertTickToSeconds, listBeats } from '../../domain/projectInfo.ts'
import { getLastTick, interpolateLane } from '../../domain/notes.ts'
import type { Chart, ProjectInfo, FlickDirection, LongNote, Note } from '../../domain/types.ts'
import {
  PREVIEW_CULL_MARGIN,
  PREVIEW_FIELD_WIDTH_RATIO,
  PREVIEW_FLICK_MARK_RATIO,
  PREVIEW_JUDGE_LINE_RATIO,
  PREVIEW_LONG_BODY_STEP_TICKS,
  PREVIEW_NOTE_HEIGHT_RATIO,
  PREVIEW_NOTE_WIDTH_RATIO,
  PREVIEW_VISIBLE_SECONDS,
} from '../../constants/canvas.ts'
import {
  BAR_LINE_WIDTH,
  FLICK_COLORS,
  HAIRLINE_OFFSET,
  LINE_WIDTH,
  PREVIEW_BAR_LABEL_FONT,
  PREVIEW_BAR_LABEL_MARGIN,
  NOTE_CORNER_RADIUS,
  PREVIEW_JUDGE_LINE_WIDTH,
  PREVIEW_THEME,
  THEME,
} from '../../constants/theme.ts'

/** プレビューの描画内容。 */
export interface PreviewScene {
  readonly width: number
  readonly height: number
  readonly laneCount: number
  readonly projectInfo: ProjectInfo
  readonly chart: Chart
  /** 判定ラインにある tick。 */
  readonly tick: number
}

/** 画面に対するレーンと判定ラインの配置。 */
interface PreviewLayout {
  readonly fieldLeft: number
  readonly fieldWidth: number
  readonly laneWidth: number
  readonly judgeY: number
  readonly noteHeight: number
}

/** 描くノーツの種類。タップ、フリック (向き付き)、ロングノーツの始点または終端 (終端に向き付きのフリックがあれば、フリックとして描く)。 */
type BlockKind =
  { readonly kind: 'tap' } | { readonly kind: 'long' } | { readonly kind: 'flick'; readonly direction: FlickDirection }

/** ノーツの流れる位置を求めるための、現在の時刻。 */
interface ScrollClock {
  readonly projectInfo: ProjectInfo
  readonly viewSeconds: number
}

/** 画面に対する、レーンと判定ラインの配置を求める。 */
function calculateLayout(scene: Pick<PreviewScene, 'width' | 'height' | 'laneCount'>): PreviewLayout {
  const fieldWidth = scene.width * PREVIEW_FIELD_WIDTH_RATIO
  const judgeY = scene.height * PREVIEW_JUDGE_LINE_RATIO
  return {
    fieldLeft: (scene.width - fieldWidth) / 2,
    fieldWidth,
    laneWidth: fieldWidth / scene.laneCount,
    judgeY,
    noteHeight: judgeY * PREVIEW_NOTE_HEIGHT_RATIO,
  }
}

/** tick の流れる位置を返す。判定ラインで 0、画面の上端で 1、判定ラインを過ぎると負になる。 */
function calculateScrollPosition(clock: ScrollClock, tick: number): number {
  return (convertTickToSeconds(clock.projectInfo, tick) - clock.viewSeconds) / PREVIEW_VISIBLE_SECONDS
}

function drawLanes(ctx: CanvasRenderingContext2D, scene: PreviewScene, layout: PreviewLayout): void {
  ctx.strokeStyle = PREVIEW_THEME.laneLine
  ctx.lineWidth = LINE_WIDTH
  ctx.beginPath()
  for (let lane = 0; lane <= scene.laneCount; lane++) {
    const x = Math.round(layout.fieldLeft + lane * layout.laneWidth) + HAIRLINE_OFFSET
    ctx.moveTo(x, 0)
    ctx.lineTo(x, scene.height)
  }
  ctx.stroke()
  ctx.strokeStyle = PREVIEW_THEME.judgeLine
  ctx.lineWidth = PREVIEW_JUDGE_LINE_WIDTH
  ctx.beginPath()
  ctx.moveTo(layout.fieldLeft, layout.judgeY)
  ctx.lineTo(layout.fieldLeft + layout.laneWidth * scene.laneCount, layout.judgeY)
  ctx.stroke()
}

/** 判定ラインから画面の上端までに入る拍の補助線と小節線を描き、小節線の左に小節番号を描く。判定ラインを過ぎた線は消える。小節線は、拍の補助線より濃く、太く描く。 */
function drawBarLines(
  ctx: CanvasRenderingContext2D,
  scene: PreviewScene,
  layout: PreviewLayout,
  clock: ScrollClock,
): void {
  const topTick = convertSecondsToTick(
    scene.projectInfo,
    clock.viewSeconds + PREVIEW_VISIBLE_SECONDS * (1 + PREVIEW_CULL_MARGIN),
  )
  const fieldRight = layout.fieldLeft + layout.laneWidth * scene.laneCount
  ctx.font = PREVIEW_BAR_LABEL_FONT
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const beat of listBeats(scene.projectInfo, Math.max(0, Math.ceil(scene.tick)), topTick)) {
    const isBarStart = beat.beatInBar === 0
    const y = Math.round(layout.judgeY - calculateScrollPosition(clock, beat.tick) * layout.judgeY) + HAIRLINE_OFFSET
    ctx.strokeStyle = isBarStart ? PREVIEW_THEME.barLine : PREVIEW_THEME.beatLine
    ctx.lineWidth = isBarStart ? BAR_LINE_WIDTH : LINE_WIDTH
    ctx.beginPath()
    ctx.moveTo(layout.fieldLeft, y)
    ctx.lineTo(fieldRight, y)
    ctx.stroke()
    if (isBarStart) {
      ctx.fillStyle = PREVIEW_THEME.barLabel
      ctx.fillText(String(beat.barNumber), layout.fieldLeft - PREVIEW_BAR_LABEL_MARGIN, y)
    }
  }
}

function drawFlickMark(
  ctx: CanvasRenderingContext2D,
  direction: FlickDirection,
  x: number,
  y: number,
  noteHeight: number,
) {
  const half = noteHeight * PREVIEW_FLICK_MARK_RATIO
  ctx.fillStyle = THEME.arrow
  ctx.beginPath()
  switch (direction) {
    case 'up':
      ctx.moveTo(x, y - half)
      ctx.lineTo(x + half, y + half)
      ctx.lineTo(x - half, y + half)
      break
    case 'left':
      ctx.moveTo(x - half, y)
      ctx.lineTo(x + half, y - half)
      ctx.lineTo(x + half, y + half)
      break
    case 'right':
      ctx.moveTo(x + half, y)
      ctx.lineTo(x - half, y - half)
      ctx.lineTo(x - half, y + half)
      break
    default:
      return assertNever(direction)
  }
  ctx.closePath()
  ctx.fill()
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  layout: PreviewLayout,
  lane: number,
  position: number,
  kind: BlockKind,
): void {
  const x = layout.fieldLeft + (lane + 0.5) * layout.laneWidth
  const y = layout.judgeY - position * layout.judgeY
  const width = layout.laneWidth * PREVIEW_NOTE_WIDTH_RATIO
  ctx.fillStyle =
    kind.kind === 'flick' ? FLICK_COLORS[kind.direction] : kind.kind === 'long' ? THEME.longPoint : THEME.tap
  ctx.strokeStyle = THEME.shortNoteBorder
  ctx.lineWidth = LINE_WIDTH
  ctx.beginPath()
  ctx.roundRect(x - width / 2, y - layout.noteHeight / 2, width, layout.noteHeight, NOTE_CORNER_RADIUS)
  ctx.fill()
  ctx.stroke()
  if (kind.kind === 'flick') {
    drawFlickMark(ctx, kind.direction, x, y, layout.noteHeight)
  }
}

function drawLong(
  ctx: CanvasRenderingContext2D,
  layout: PreviewLayout,
  clock: ScrollClock,
  note: LongNote,
  headPosition: number,
  tailPosition: number,
): void {
  const endTick = getLastTick(note)
  ctx.save()
  ctx.beginPath()
  ctx.rect(layout.fieldLeft, 0, layout.fieldWidth, layout.judgeY)
  ctx.clip()
  ctx.strokeStyle = THEME.long
  ctx.lineWidth = layout.laneWidth * PREVIEW_NOTE_WIDTH_RATIO
  ctx.lineJoin = 'round'
  ctx.beginPath()
  for (let tick = note.tick; ; tick = Math.min(tick + PREVIEW_LONG_BODY_STEP_TICKS, endTick)) {
    const position = calculateScrollPosition(clock, tick)
    const x = layout.fieldLeft + (interpolateLane(note, tick) + 0.5) * layout.laneWidth
    const y = layout.judgeY - position * layout.judgeY
    if (tick === note.tick) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    if (tick === endTick) {
      break
    }
  }
  ctx.stroke()
  ctx.restore()
  const tailLane = note.path[note.path.length - 1]?.lane ?? note.lane
  if (headPosition >= 0) {
    drawBlock(ctx, layout, note.lane, headPosition, { kind: 'long' })
  }
  drawBlock(
    ctx,
    layout,
    tailLane,
    tailPosition,
    note.end.kind === 'flick' ? { kind: 'flick', direction: note.end.direction } : { kind: 'long' },
  )
}

function drawNote(
  ctx: CanvasRenderingContext2D,
  layout: PreviewLayout,
  clock: ScrollClock,
  note: Note,
  headPosition: number,
): void {
  switch (note.type) {
    case 'tap':
      drawBlock(ctx, layout, note.lane, headPosition, { kind: 'tap' })
      return
    case 'flick':
      drawBlock(ctx, layout, note.lane, headPosition, { kind: 'flick', direction: note.direction })
      return
    case 'long':
      drawLong(ctx, layout, clock, note, headPosition, calculateScrollPosition(clock, getLastTick(note)))
      return
    default:
      return assertNever(note)
  }
}

/**
 * プレビューの画面を描く。レーンは縦に並び、ノーツは上から判定ラインへ流れる。
 * 判定ラインを過ぎたノーツは消える。ロングノーツは、始点が判定ラインを過ぎたあとも、終端が過ぎるまで本体を描く。
 */
export function drawPreview(ctx: CanvasRenderingContext2D, scene: PreviewScene): void {
  ctx.fillStyle = PREVIEW_THEME.background
  ctx.fillRect(0, 0, scene.width, scene.height)
  const layout = calculateLayout(scene)
  drawLanes(ctx, scene, layout)
  const clock: ScrollClock = {
    projectInfo: scene.projectInfo,
    viewSeconds: convertTickToSeconds(scene.projectInfo, scene.tick),
  }
  drawBarLines(ctx, scene, layout, clock)
  for (const note of scene.chart.notes) {
    const headPosition = calculateScrollPosition(clock, note.tick)
    if (headPosition > 1 + PREVIEW_CULL_MARGIN) {
      break
    }
    if (calculateScrollPosition(clock, getLastTick(note)) >= 0) {
      drawNote(ctx, layout, clock, note, headPosition)
    }
  }
}

/** 判定ラインの上の、レーンの中心の位置 (x、y) と、ノーツの幅、高さ (px)。ノーツが消えるときの演出を置く位置に使う。 */
export function calculateJudgePoint(
  scene: Pick<PreviewScene, 'width' | 'height' | 'laneCount'>,
  lane: number,
): { readonly x: number; readonly y: number; readonly noteWidth: number; readonly noteHeight: number } {
  const layout = calculateLayout(scene)
  return {
    x: layout.fieldLeft + (lane + 0.5) * layout.laneWidth,
    y: layout.judgeY,
    noteWidth: layout.laneWidth * PREVIEW_NOTE_WIDTH_RATIO,
    noteHeight: layout.noteHeight,
  }
}
