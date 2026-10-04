import { FLICK_THRESHOLD, TICKS_PER_WHOLE, type GridDivision } from './constants.ts'
import type { FlickDirection } from './types.ts'

/** ドラッグ操作から決まるノーツの変更。tap はフリックの解除を表す。 */
export type FlickDragResult = FlickDirection | 'tap'

/** グリッド 1 マスの tick 数。 */
export function calculateGridStepTicks(division: GridDivision): number {
  return TICKS_PER_WHOLE / division
}

/** tick を最も近いグリッド線に吸着させる。0 未満にはならない。 */
export function snapTickToGrid(tick: number, division: GridDivision): number {
  const step = calculateGridStepTicks(division)
  return Math.max(0, Math.round(tick / step) * step)
}

/**
 * フリックを作るドラッグの移動量から、フリックの方向を決める。
 * deltaLanes は右が正のレーン数、deltaSteps は上 (未来) が正のグリッドマス数。
 * どちらの移動量も、レーン数とグリッドマス数の単位のまま FLICK_THRESHOLD と比べて未満なら、反応しないので null を返す。下方向はフリックの解除を表す。
 */
export function resolveFlickDrag(deltaLanes: number, deltaSteps: number): FlickDragResult | null {
  const horizontal = Math.abs(deltaLanes)
  const vertical = Math.abs(deltaSteps)
  if (Math.max(horizontal, vertical) < FLICK_THRESHOLD) {
    return null
  }
  if (horizontal >= vertical) {
    return deltaLanes < 0 ? 'left' : 'right'
  }
  return deltaSteps > 0 ? 'up' : 'tap'
}
