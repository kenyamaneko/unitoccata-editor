import { useEffect, useRef } from 'react'
import { getPreviewTick, seekPreview } from '../../state/previewController.ts'
import { describePosition } from '../../domain/positionText.ts'
import type { ProjectInfo } from '../../domain/types.ts'
import { calculateJudgePoint, drawPreview } from './previewRenderer.ts'
import { listHeldLongs } from './heldNotes.ts'
import { listVanishedPoints } from './vanishedNotes.ts'
import { convertTickToSeconds } from '../../domain/projectInfo.ts'
import { createHoldEffectState, spawnVanishEffect, updateHoldEffects } from './previewEffects.ts'
import { DEFAULT_PIXELS_PER_TICK } from '../../constants/canvas.ts'
import { calculateWheelDeltaTicks } from '../common/wheel.ts'
import { useEditorStore } from '../../state/editorStore.ts'
import { useCanvasSize } from '../../hooks/useCanvasSize.ts'

/** 前のフレームから、この秒数以内の進みなら、連続した再生とみなす。これより大きく進んだ (位置を飛ばした) ときは、消えるノーツの演出を出さない。 */
const MAX_CONTINUOUS_FRAME_SECONDS = 0.25

/** プレビューの再生位置を、Canvas の代替コンテンツに入れる文字にする。 */
function describePreviewTick(projectInfo: ProjectInfo, tick: number): string {
  return `再生位置 ${describePosition(projectInfo, Math.round(tick))}`
}

/** プレビューの画面を描く Canvas。ノーツが上から判定ラインへ流れる。ホイールで再生位置を変えられる。編集の操作は受け付けない。 */
export function PreviewCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const positionRef = useRef<HTMLParagraphElement>(null)
  const effectsRef = useRef<HTMLDivElement>(null)
  const previousTickRef = useRef<number | null>(null)
  const holdEffectStateRef = useRef(createHoldEffectState())
  const size = useCanvasSize(containerRef, canvasRef)
  const noteCount = useEditorStore((state) => state.chart.notes.length)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) {
      return
    }
    const context = canvas.getContext('2d')
    if (context === null) {
      throw new Error('プレビューを描くための Canvas の 2D コンテキストを取得できません')
    }
    const frame = (): void => {
      const { projectInfo, chart, laneCount, previewTick } = useEditorStore.getState()
      const tick = getPreviewTick() ?? previewTick
      const ratio = window.devicePixelRatio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      drawPreview(context, { width: size.width, height: size.height, laneCount, projectInfo, chart, tick })
      const previousTick = previousTickRef.current
      previousTickRef.current = tick
      const effects = effectsRef.current
      if (effects !== null) {
        updateHoldEffects(
          effects,
          holdEffectStateRef.current,
          listHeldLongs(chart, tick),
          (lane) => calculateJudgePoint({ width: size.width, height: size.height, laneCount }, lane),
          performance.now(),
        )
      }
      if (
        effects !== null &&
        previousTick !== null &&
        tick > previousTick &&
        convertTickToSeconds(projectInfo, tick) - convertTickToSeconds(projectInfo, previousTick) <=
          MAX_CONTINUOUS_FRAME_SECONDS
      ) {
        for (const vanished of listVanishedPoints(chart, previousTick, tick)) {
          spawnVanishEffect(
            effects,
            calculateJudgePoint({ width: size.width, height: size.height, laneCount }, vanished.lane),
            vanished.kind,
          )
        }
      }
      if (positionRef.current !== null) {
        positionRef.current.textContent = describePreviewTick(projectInfo, tick)
      }
    }
    frame()
    let handle = requestAnimationFrame(function next() {
      frame()
      handle = requestAnimationFrame(next)
    })
    return () => cancelAnimationFrame(handle)
  }, [size])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) {
      return
    }
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const store = useEditorStore.getState()
      const current = getPreviewTick() ?? store.previewTick
      store.setPreviewTick(current + calculateWheelDeltaTicks(event, canvas.clientHeight, DEFAULT_PIXELS_PER_TICK))
      seekPreview(useEditorStore.getState().previewTick)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: size.width, height: size.height }}
        aria-label="プレビュー"
      >
        <p ref={positionRef} />
        <p>{`ノーツ ${noteCount} 個`}</p>
      </canvas>
      <div ref={effectsRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  )
}
