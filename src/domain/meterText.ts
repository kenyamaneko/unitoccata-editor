import { isValidMeterDen, isValidMeterPart } from './projectInfo.ts'

const METER_PATTERN = /^\s*(\d+)\s*\/\s*(\d+)\s*$/

/** 「3/4」のような文字列を、拍子の分子と分母にする。読み取れなければ null。 */
export function parseMeterText(text: string): { readonly num: number; readonly den: number } | null {
  const match = METER_PATTERN.exec(text)
  if (match === null) {
    return null
  }
  const num = Number(match[1])
  const den = Number(match[2])
  return isValidMeterPart(num) && isValidMeterDen(den) ? { num, den } : null
}

/** 拍子の分子と分母を「3/4」のような文字列にする。parseMeterText の逆。 */
export function formatMeterText(meter: { readonly num: number; readonly den: number }): string {
  return `${meter.num}/${meter.den}`
}
