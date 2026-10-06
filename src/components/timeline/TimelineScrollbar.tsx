import { useMemo, useRef, useState } from 'react'
import { SCROLLBAR_WIDTH } from '../../constants/canvas.ts'
import {
  calculateScrollRange,
  calculateThumb,
  calculateVisibleTicks,
  convertThumbTopToTick,
  type ScrollRange,
} from '../../domain/scrollbar.ts'
import { useEditorStore } from '../../state/editorStore.ts'
import { useElementSize } from '../../hooks/useCanvasSize.ts'

/** ドラッグの間、固定しておく情報。範囲が途中で変わって、つまみがポインタから外れるのを防ぐ。 */
interface ScrollDrag {
  readonly range: ScrollRange
  /** つまみの上端から、ポインタを押した位置までの距離 (px)。 */
  readonly grabOffset: number
  readonly thumbHeight: number
}

/** タイムラインの右に置く縦のスクロールバー。つまみの位置が、スクロール位置 (タイムラインの下端にある tick) を表す。 */
export function TimelineScrollbar() {
  const trackRef = useRef<HTMLDivElement>(null)
  const trackHeight = useElementSize(trackRef).height
  const [drag, setDrag] = useState<ScrollDrag | null>(null)
  const scrollTick = useEditorStore((state) => state.scrollTick)
  const pixelsPerTick = useEditorStore((state) => state.pixelsPerTick)
  const timelineHeight = useEditorStore((state) => state.timelineHeight)
  const projectInfo = useEditorStore((state) => state.projectInfo)
  const chart = useEditorStore((state) => state.chart)
  const barCount = useEditorStore((state) => state.barCount)
  const visibleTicks = calculateVisibleTicks(timelineHeight, pixelsPerTick)
  const liveRange = useMemo(
    () => calculateScrollRange({ projectInfo, chart, barCount, scrollTick, visibleTicks }),
    [projectInfo, chart, barCount, scrollTick, visibleTicks],
  )
  const range = drag?.range ?? liveRange
  const thumb = calculateThumb(range, scrollTick, visibleTicks, trackHeight)

  const readTrackY = (event: React.PointerEvent<HTMLDivElement>): number =>
    event.clientY - event.currentTarget.getBoundingClientRect().top

  const moveThumbTo = (current: ScrollDrag, trackY: number): void => {
    const top = trackY - current.grabOffset
    useEditorStore.getState().setScrollTick(convertThumbTopToTick(current.range, top, current.thumbHeight, trackHeight))
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      return
    }
    const trackY = readTrackY(event)
    const isOnThumb = trackY >= thumb.top && trackY <= thumb.top + thumb.height
    const started: ScrollDrag = {
      range,
      grabOffset: isOnThumb ? trackY - thumb.top : thumb.height / 2,
      thumbHeight: thumb.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag(started)
    moveThumbTo(started, trackY)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (drag !== null) {
      moveThumbTo(drag, readTrackY(event))
    }
  }

  return (
    <div
      ref={trackRef}
      role="scrollbar"
      aria-orientation="vertical"
      aria-valuemin={Math.round(range.min)}
      aria-valuemax={Math.round(range.max)}
      aria-valuenow={Math.round(scrollTick)}
      className="relative shrink-0 touch-none border-l border-slate-700 bg-slate-800"
      style={{ width: SCROLLBAR_WIDTH }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      <div
        className={`absolute inset-x-1 rounded-full ${drag === null ? 'bg-slate-400 hover:bg-sky-300' : 'bg-sky-400'}`}
        style={{ top: thumb.top, height: thumb.height }}
      />
    </div>
  )
}
