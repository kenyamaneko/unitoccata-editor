import { WHEEL_LINE_PIXELS, WHEEL_PIXEL_UNIT_PIXELS } from '../../constants/canvas.ts'

/** ホイールの量の単位 (deltaMode) 1 つ分の大きさを、px で返す。 */
export function calculateWheelUnitPixels(deltaMode: number, pageHeight: number): number {
  switch (deltaMode) {
    case WheelEvent.DOM_DELTA_PIXEL:
      return WHEEL_PIXEL_UNIT_PIXELS
    case WheelEvent.DOM_DELTA_LINE:
      return WHEEL_LINE_PIXELS
    case WheelEvent.DOM_DELTA_PAGE:
      return pageHeight
    default:
      throw new RangeError(`想定外の deltaMode です: ${deltaMode}`)
  }
}

/** ホイールの回転を、スクロールする tick 数に変える。上へ回すと未来 (正の向き) へ進む。 */
export function calculateWheelDeltaTicks(event: WheelEvent, pageHeight: number, pixelsPerTick: number): number {
  return (-event.deltaY * calculateWheelUnitPixels(event.deltaMode, pageHeight)) / pixelsPerTick
}
