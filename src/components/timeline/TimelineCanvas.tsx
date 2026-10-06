import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ZOOM_STEP_FACTOR } from '../../constants/canvas.ts'
import {
  decideIntent,
  orderLongPoints,
  resolveGridPoint,
  type EditorIntent,
  type PointerPosition,
  type PointerTarget,
} from './gestures.ts'
import { findLongBodyAt, findPointAt } from './hitTest.ts'
import {
  classifyColumn,
  convertTickToY,
  convertYToTick,
  isSideColumn,
  type SideColumn,
  type TimelineColumn,
  type TimelineViewport,
} from './timelineLayout.ts'
import { calculateAutoScrollVelocity } from './autoScroll.ts'
import { calculateWheelDeltaTicks } from '../common/wheel.ts'
import { drawTimeline, type DragOverlay } from './timelineRenderer.ts'
import { assertNever } from '../../utils/assertNever.ts'
import {
  DEFAULT_METER_DEN,
  DEFAULT_METER_NUM,
  LONG_THRESHOLD,
  MAX_BPM,
  MAX_METER_NUM,
  METER_DENOMINATORS_TEXT,
  MILLISECONDS_PER_SECOND,
  MIN_BPM,
  MIN_METER_NUM,
} from '../../domain/constants.ts'
import { placeClipboardNotes } from '../../domain/chartEditing.ts'
import { calculateGridStepTicks, snapTickToGrid } from '../../domain/grid.ts'
import type { ChartPoint } from '../../domain/types.ts'
import { calculateChartEndTick } from '../../domain/scrollbar.ts'
import { parseBpmText, sanitizeBpmInput } from '../../domain/bpmText.ts'
import { formatMeterText, parseMeterText } from '../../domain/meterText.ts'
import { describePosition } from '../../domain/positionText.ts'
import { describeNote } from '../../domain/noteDescription.ts'
import { useEditorStore } from '../../state/editorStore.ts'
import { useCanvasSize } from '../../hooks/useCanvasSize.ts'

const LANE_MARKER_HIT_PX = 10

/** 貼り付けのプレビューのノーツに付ける id。プレビューは置いたノーツではないので、固定の値にする。 */
const PREVIEW_NOTE_ID = 'paste-preview'

function createPreviewNoteId(): string {
  return PREVIEW_NOTE_ID
}

/** テンポと拍子の入力欄の幅 (px)。 */
const VALUE_EDITOR_INPUT_WIDTH_PX = 112

/** 入力欄と、入力が不正なときの理由を並べた領域の幅 (px)。 */
const VALUE_EDITOR_WIDTH_PX = 288

/** 入力欄を開いた位置がタイムラインの高さのこの割合より下のとき、理由が下端で切れないよう、入力欄の上に理由を出す。 */
const VALUE_EDITOR_FLIP_RATIO = 0.5

const TEMPO_EDITOR_LABEL = 'BPM'
/** 新しい拍子変化点の入力欄の初期値。入力の例にも使う。 */
const NEW_METER_TEXT = formatMeterText({ num: DEFAULT_METER_NUM, den: DEFAULT_METER_DEN })
const METER_EDITOR_LABEL = '拍子'

const INVALID_BPM_MESSAGE = `BPM は ${MIN_BPM} 以上 ${MAX_BPM} 以下の半角の数で、小数点第一位までにして入力してください`
const INVALID_METER_MESSAGE = `拍子は半角で「分子/分母」の形に、分子を ${MIN_METER_NUM} 以上 ${MAX_METER_NUM} 以下の整数、分母を ${METER_DENOMINATORS_TEXT} のいずれかにして入力してください`

interface DragState {
  readonly down: PointerPosition
  readonly target: PointerTarget
  readonly shiftKey: boolean
  /** 押した時点の譜面上の点。空いた位置を押したときだけ持つ。 */
  readonly startPoint: ChartPoint | null
}

interface ValueEditor {
  readonly kind: SideColumn
  readonly tick: number
  readonly left: number
  readonly top: number
  readonly initial: string
  readonly error: string | null
}

function applyIntent(intent: EditorIntent): void {
  const store = useEditorStore.getState()
  switch (intent.kind) {
    case 'placeTap':
      store.placeTap(intent.at)
      return
    case 'createLong':
      store.createLong(intent.start, intent.end)
      return
    case 'extendLong':
      store.extendLong(intent.ref, intent.to)
      return
    case 'setFlick':
      store.setFlick(intent.ref, intent.direction)
      return
    case 'clearFlick':
      store.clearFlick(intent.ref)
      return
    case 'movePoint':
      store.movePoint(intent.ref, intent.to)
      return
    case 'moveNote':
      store.moveNote(intent.noteId, intent.deltaTick, intent.deltaLane)
      return
    case 'selectRect':
      store.selectRect(intent.rect)
      return
    default:
      return assertNever(intent)
  }
}

/** タイムラインを描き、マウスの操作を受け付ける Canvas。 */
export function TimelineCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)
  /** 最後にポインタを押した位置の列。押した列と離した列が違うドラッグの click で、入力欄を開かないために使う。 */
  const pressedColumnRef = useRef<TimelineColumn | null>(null)
  const overlayRef = useRef<DragOverlay | null>(null)
  const editingTargetRef = useRef<{ readonly kind: SideColumn; readonly tick: number } | null>(null)
  const frameRef = useRef<number | null>(null)
  const size = useCanvasSize(containerRef, canvasRef)
  const sizeRef = useRef(size)

  useEffect(() => {
    sizeRef.current = size
    useEditorStore.getState().setTimelineHeight(size.height)
  }, [size])
  const [editor, setEditor] = useState<ValueEditor | null>(null)

  const readViewport = useCallback((): TimelineViewport => {
    const { laneCount, scrollTick, pixelsPerTick } = useEditorStore.getState()
    return {
      width: size.width,
      height: size.height,
      laneCount,
      scrollTick,
      pixelsPerTick,
    }
  }, [size])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas === null) {
      return
    }
    const context = canvas.getContext('2d')
    if (context === null) {
      throw new Error('タイムラインを描くための Canvas の 2D コンテキストを取得できません')
    }
    const state = useEditorStore.getState()
    const ratio = window.devicePixelRatio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    drawTimeline(context, {
      viewport: readViewport(),
      endTick: calculateChartEndTick(state),
      projectInfo: state.projectInfo,
      chart: state.chart,
      selectedNoteIds: state.selectedNoteIds,
      gridDivision: state.gridDivision,
      waveform: state.audio === null ? null : { peaks: state.audio.peaks, peakSeconds: state.audio.peakSeconds },
      overlay: overlayRef.current,
      pastePreview:
        state.isPasteTargeting && state.cursorPoint !== null
          ? placeClipboardNotes(state.clipboard, state.cursorPoint, createPreviewNoteId)
          : null,
      editingTarget: editingTargetRef.current,
    })
  }, [readViewport])

  const scheduleDraw = useCallback(() => {
    if (frameRef.current !== null) {
      return
    }
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      draw()
    })
  }, [draw])

  useEffect(() => {
    scheduleDraw()
  }, [size, scheduleDraw])

  const editingKind = editor?.kind ?? null
  const editingTick = editor?.tick ?? null
  useEffect(() => {
    editingTargetRef.current =
      editingKind === null || editingTick === null ? null : { kind: editingKind, tick: editingTick }
    scheduleDraw()
  }, [editingKind, editingTick, scheduleDraw])

  useEffect(() => useEditorStore.subscribe(scheduleDraw), [scheduleDraw])

  const notes = useEditorStore((state) => state.chart.notes)
  const projectInfo = useEditorStore((state) => state.projectInfo)
  const gridDivision = useEditorStore((state) => state.gridDivision)
  const scrollTick = useEditorStore((state) => state.scrollTick)
  const pixelsPerTick = useEditorStore((state) => state.pixelsPerTick)
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) {
      return
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const store = useEditorStore.getState()
      if (event.ctrlKey || event.metaKey) {
        store.zoomBy(event.deltaY < 0 ? ZOOM_STEP_FACTOR : 1 / ZOOM_STEP_FACTOR)
        return
      }
      store.scrollBy(calculateWheelDeltaTicks(event, sizeRef.current.height, store.pixelsPerTick))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const toPosition = useCallback((event: { clientX: number; clientY: number }): PointerPosition => {
    const canvas = canvasRef.current
    if (canvas === null) {
      throw new Error('タイムラインの Canvas がありません')
    }
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }, [])

  const findLaneMarker = useCallback(
    (kind: SideColumn, position: PointerPosition): number | null => {
      const viewport = readViewport()
      const changes =
        kind === 'tempo' ? useEditorStore.getState().projectInfo.tempo : useEditorStore.getState().projectInfo.meter
      const hit = changes.find(
        (change) => Math.abs(convertTickToY(viewport, change.tick) - position.y) <= LANE_MARKER_HIT_PX,
      )
      return hit === undefined ? null : hit.tick
    },
    [readViewport],
  )

  const openValueEditor = useCallback((kind: SideColumn, tick: number, position: PointerPosition): void => {
    const { projectInfo } = useEditorStore.getState()
    const initial =
      kind === 'tempo'
        ? (projectInfo.tempo.find((change) => change.tick === tick)?.bpm.toString() ?? '')
        : (() => {
            const change = projectInfo.meter.find((candidate) => candidate.tick === tick)
            return change === undefined ? NEW_METER_TEXT : formatMeterText(change)
          })()
    setEditor({ kind, tick, left: position.x, top: position.y, initial, error: null })
  }, [])

  const autoScrollRef = useRef<number | null>(null)
  /** ドラッグ中の、ポインタの最新の位置。自動スクロールで画面が動いても、ポインタの位置から終点を求め直すために持つ。 */
  const pointerRef = useRef<PointerPosition | null>(null)

  const clampToTimeline = (position: PointerPosition): PointerPosition => ({
    x: position.x,
    y: Math.min(sizeRef.current.height, Math.max(0, position.y)),
  })

  const refreshOverlay = (): void => {
    const drag = dragRef.current
    const pointer = pointerRef.current
    if (drag === null || pointer === null) {
      return
    }
    if (drag.shiftKey) {
      overlayRef.current =
        drag.target.kind === 'empty'
          ? {
              kind: 'rect',
              left: Math.min(drag.down.x, pointer.x),
              top: Math.min(drag.down.y, pointer.y),
              right: Math.max(drag.down.x, pointer.x),
              bottom: Math.max(drag.down.y, pointer.y),
            }
          : null
    } else if (drag.startPoint === null) {
      overlayRef.current = { kind: 'line', fromX: drag.down.x, fromY: drag.down.y, toX: pointer.x, toY: pointer.y }
    } else if (Math.hypot(pointer.x - drag.down.x, pointer.y - drag.down.y) < LONG_THRESHOLD) {
      overlayRef.current = null
    } else {
      const state = useEditorStore.getState()
      const end = resolveGridPoint(
        readViewport(),
        state.gridDivision,
        clampToTimeline(pointer),
        calculateChartEndTick(state),
      )
      overlayRef.current =
        end === null
          ? null
          : { kind: 'long', ...orderLongPoints(drag.startPoint, end), isValid: drag.startPoint.tick !== end.tick }
    }
    scheduleDraw()
  }

  const stopAutoScroll = (): void => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }
  }

  const startAutoScroll = (): void => {
    stopAutoScroll()
    let previous = performance.now()
    const step = (now: number): void => {
      const pointer = pointerRef.current
      if (dragRef.current === null || pointer === null) {
        autoScrollRef.current = null
        return
      }
      const velocity = calculateAutoScrollVelocity(pointer.y, sizeRef.current.height)
      if (velocity !== 0) {
        const store = useEditorStore.getState()
        store.scrollBy((velocity * (now - previous)) / MILLISECONDS_PER_SECOND / store.pixelsPerTick)
        refreshOverlay()
      }
      previous = now
      autoScrollRef.current = requestAnimationFrame(step)
    }
    autoScrollRef.current = requestAnimationFrame(step)
  }

  useEffect(() => stopAutoScroll, [])

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (event.button !== 0 || useEditorStore.getState().isLoadingAudio) {
      return
    }
    const position = toPosition(event)
    const viewport = readViewport()
    const column = classifyColumn(viewport, position.x)
    pressedColumnRef.current = column
    if (isSideColumn(column)) {
      return
    }
    const state = useEditorStore.getState()
    if (state.isPasteTargeting) {
      const target = resolveGridPoint(viewport, state.gridDivision, position, calculateChartEndTick(state))
      if (target !== null) {
        state.pasteAt(target)
      }
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    const hit = findPointAt(state.chart, viewport, position.x, position.y)
    const longBody = hit === null ? findLongBodyAt(state.chart, viewport, position.x, position.y) : null
    dragRef.current = {
      down: position,
      target:
        hit !== null
          ? { kind: 'point', hit }
          : event.shiftKey && longBody !== null
            ? { kind: 'longBody', noteId: longBody.id }
            : { kind: 'empty' },
      shiftKey: event.shiftKey,
      startPoint:
        hit === null ? resolveGridPoint(viewport, state.gridDivision, position, calculateChartEndTick(state)) : null,
    }
    pointerRef.current = position
    if (!event.shiftKey) {
      startAutoScroll()
    }
  }

  const updateHover = (position: PointerPosition): void => {
    const state = useEditorStore.getState()
    const viewport = readViewport()
    const hit = findPointAt(state.chart, viewport, position.x, position.y)
    const next = hit === null ? null : hit.ref
    const current = state.hoverPoint
    if (next?.noteId !== current?.noteId || next?.index !== current?.index) {
      state.setHoverPoint(next)
    }
    state.setCursorPoint(resolveGridPoint(viewport, state.gridDivision, position))
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const position = toPosition(event)
    updateHover(position)
    if (dragRef.current === null) {
      return
    }
    pointerRef.current = position
    refreshOverlay()
  }

  const endDrag = (): DragState | null => {
    const drag = dragRef.current
    dragRef.current = null
    pointerRef.current = null
    overlayRef.current = null
    stopAutoScroll()
    scheduleDraw()
    return drag
  }

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const drag = endDrag()
    if (drag === null) {
      return
    }
    const state = useEditorStore.getState()
    const intent = decideIntent({
      down: drag.down,
      up: clampToTimeline(toPosition(event)),
      shiftKey: drag.shiftKey,
      target: drag.target,
      viewport: readViewport(),
      gridDivision: state.gridDivision,
      startPoint: drag.startPoint,
      maxTick: calculateChartEndTick(state),
    })
    if (intent !== null) {
      applyIntent(intent)
    }
  }

  const onClick = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const position = toPosition(event)
    const viewport = readViewport()
    const column = classifyColumn(viewport, position.x)
    if (isSideColumn(column) && pressedColumnRef.current === column && findLaneMarker(column, position) === null) {
      const { gridDivision } = useEditorStore.getState()
      openValueEditor(column, snapTickToGrid(convertYToTick(viewport, position.y), gridDivision), position)
    }
  }

  const onContextMenu = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    event.preventDefault()
    const position = toPosition(event)
    const viewport = readViewport()
    const column = classifyColumn(viewport, position.x)
    const store = useEditorStore.getState()
    if (isSideColumn(column)) {
      const tick = findLaneMarker(column, position)
      if (tick !== null) {
        if (column === 'tempo') {
          store.removeTempoAt(tick)
        } else {
          store.removeSignatureChangeAt(tick)
        }
      }
      return
    }
    const hit = findPointAt(store.chart, viewport, position.x, position.y)
    if (hit !== null) {
      store.deletePoint(hit.ref)
      return
    }
    const longBody = findLongBodyAt(store.chart, viewport, position.x, position.y)
    if (longBody !== null) {
      store.deletePoint({ noteId: longBody.id, index: 0 })
    }
  }

  const onDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const position = toPosition(event)
    const column = classifyColumn(readViewport(), position.x)
    if (!isSideColumn(column) || pressedColumnRef.current !== column) {
      return
    }
    const tick = findLaneMarker(column, position)
    if (tick !== null) {
      openValueEditor(column, tick, position)
    }
  }

  const commitValue = (text: string): void => {
    const current = editor
    if (current === null) {
      return
    }
    const store = useEditorStore.getState()
    if (current.kind === 'tempo') {
      const bpm = parseBpmText(text)
      if (bpm === null) {
        setEditor({ ...current, error: INVALID_BPM_MESSAGE })
        return
      }
      store.setTempoAt(current.tick, bpm)
    } else {
      const meter = parseMeterText(text)
      if (meter === null) {
        setEditor({ ...current, error: INVALID_METER_MESSAGE })
        return
      }
      store.setSignatureChangeAt(current.tick, meter.num, meter.den)
    }
    setEditor(null)
  }

  const editorPlaceholder = useMemo(
    () => (editor?.kind === 'tempo' ? TEMPO_EDITOR_LABEL : METER_EDITOR_LABEL),
    [editor],
  )

  const isEditorFlipped = editor !== null && editor.top > size.height * VALUE_EDITOR_FLIP_RATIO

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ width: size.width, height: size.height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => void endDrag()}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
        aria-label="タイムライン"
      >
        <p>{`スクロール位置 ${describePosition(projectInfo, Math.round(scrollTick))}`}</p>
        <p>{`グリッド分割 ${gridDivision} 分 1 マスの高さ ${(calculateGridStepTicks(gridDivision) * pixelsPerTick).toFixed(1)} px`}</p>
        <ul aria-label="テンポ">
          {projectInfo.tempo.map((change) => (
            <li key={change.tick}>{`${describePosition(projectInfo, change.tick)} BPM ${change.bpm}`}</li>
          ))}
        </ul>
        <ul aria-label="拍子">
          {projectInfo.meter.map((change) => (
            <li key={change.tick}>{`${describePosition(projectInfo, change.tick)} ${formatMeterText(change)}`}</li>
          ))}
        </ul>
        <ul aria-label="譜面のノーツ">
          {notes.map((note) => (
            <li key={note.id}>{describeNote(note, projectInfo)}</li>
          ))}
        </ul>
      </canvas>
      {editor !== null && (
        <div
          className={`pointer-events-none absolute z-10 flex gap-1 ${isEditorFlipped ? 'flex-col-reverse' : 'flex-col'}`}
          style={{
            left: Math.max(0, Math.min(editor.left, size.width - VALUE_EDITOR_WIDTH_PX)),
            ...(isEditorFlipped ? { bottom: size.height - editor.top } : { top: editor.top }),
            width: VALUE_EDITOR_WIDTH_PX,
          }}
        >
          <input
            autoFocus
            defaultValue={editor.initial}
            placeholder={editorPlaceholder}
            aria-invalid={editor.error !== null}
            className="pointer-events-auto rounded-md border border-sky-400 bg-slate-900 px-2 py-1 text-sm text-slate-100 shadow-lg outline-none aria-invalid:border-rose-400"
            style={{ width: VALUE_EDITOR_INPUT_WIDTH_PX }}
            onChange={(event) => {
              if (editor.kind === 'tempo') {
                event.currentTarget.value = sanitizeBpmInput(event.currentTarget.value)
              }
              if (editor.error !== null) {
                setEditor({ ...editor, error: null })
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitValue(event.currentTarget.value)
              } else if (event.key === 'Escape') {
                setEditor(null)
              }
            }}
            onBlur={() => setEditor(null)}
          />
          {editor.error !== null && (
            <p
              role="alert"
              className="pointer-events-auto rounded-md border border-rose-400/50 bg-slate-900 px-2 py-1 text-xs text-rose-200 shadow-lg"
            >
              {editor.error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
