import { calculateBarsEndTick, calculateRequiredBarCount } from './projectInfo.ts'
import type { Chart, ProjectInfo } from './types.ts'
import { MIN_SCROLL_TICK, SCROLLBAR_MIN_THUMB_HEIGHT } from '../constants/canvas.ts'

/** スクロールバーが表す、スクロール位置 (タイムラインの下端にある tick) の範囲。 */
export interface ScrollRange {
  readonly min: number
  readonly max: number
}

/** スクロールバーのつまみの位置と大きさ。top はトラックの上端からの距離 (px)。 */
export interface ScrollThumb {
  readonly top: number
  readonly height: number
}

/** スクロールの範囲を求めるための、譜面の情報。 */
export interface ScrollLimitInput {
  readonly projectInfo: ProjectInfo
  readonly chart: Chart
  /** 設定した小節数。 */
  readonly barCount: number
}

/**
 * スクロール位置の上限を返す。設定した小節数の終わりの tick。
 * ノーツ、テンポ変化点、拍子変化点がそれより先にあるときは、それらを全て含む最小の小節の終わりまで広げる。
 */
export function calculateScrollLimit(input: ScrollLimitInput): number {
  const { projectInfo, chart, barCount } = input
  return calculateBarsEndTick(projectInfo, Math.max(barCount, calculateRequiredBarCount(projectInfo, chart)))
}

/**
 * スクロールバーの範囲を返す。下限はスクロール位置の下限、上限は calculateScrollLimit の値。
 * スクロール位置が上限を超えているときは、スクロール位置までを範囲にする。
 */
export function calculateScrollRange(input: ScrollLimitInput & { readonly scrollTick: number }): ScrollRange {
  return { min: MIN_SCROLL_TICK, max: Math.max(calculateScrollLimit(input), input.scrollTick) }
}

/**
 * つまみの位置と大きさを求める。下が過去、上が未来で、スクロール位置が下限ならつまみは一番下、上限なら一番上にある。
 * つまみの大きさは、画面に見える範囲 (visibleTicks) の、範囲全体とその見える範囲の合計に対する割合で、下限の高さを持つ。
 */
export function calculateThumb(
  range: ScrollRange,
  scrollTick: number,
  visibleTicks: number,
  trackHeight: number,
): ScrollThumb {
  const ratio = visibleTicks / (range.max - range.min + visibleTicks)
  const height = Math.min(trackHeight, Math.max(SCROLLBAR_MIN_THUMB_HEIGHT, trackHeight * ratio))
  const fraction = (Math.min(range.max, Math.max(range.min, scrollTick)) - range.min) / (range.max - range.min)
  return { top: (trackHeight - height) * (1 - fraction), height }
}

/** つまみの上端の位置 (px) から、スクロール位置を求める。calculateThumb の逆。 */
export function convertThumbTopToTick(
  range: ScrollRange,
  thumbTop: number,
  thumbHeight: number,
  trackHeight: number,
): number {
  const travel = trackHeight - thumbHeight
  const fraction = travel > 0 ? 1 - Math.min(travel, Math.max(0, thumbTop)) / travel : 0
  return range.min + fraction * (range.max - range.min)
}
