import { AUTO_SCROLL_EDGE_PX, AUTO_SCROLL_MAX_PX_PER_SECOND } from '../../constants/canvas.ts'

/**
 * ドラッグ中の自動スクロールの速さ (px/秒) を返す。上端に近いと正 (未来へ)、下端に近いと負 (過去へ)、端から離れていれば 0。
 * タイムラインの外にあるときは、近い端の最大の速さになる。
 */
export function calculateAutoScrollVelocity(pointerY: number, timelineHeight: number): number {
  if (pointerY < AUTO_SCROLL_EDGE_PX) {
    return AUTO_SCROLL_MAX_PX_PER_SECOND * Math.min(1, (AUTO_SCROLL_EDGE_PX - pointerY) / AUTO_SCROLL_EDGE_PX)
  }
  if (pointerY > timelineHeight - AUTO_SCROLL_EDGE_PX) {
    return (
      -AUTO_SCROLL_MAX_PX_PER_SECOND *
      Math.min(1, (pointerY - (timelineHeight - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX)
    )
  }
  return 0
}
