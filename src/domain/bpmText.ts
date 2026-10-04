import { isValidBpm } from './projectInfo.ts'

const BPM_PATTERN = /^\s*(\d+(?:\.\d)?)\s*$/

/** 「120」「128.5」のような、小数点第一位までの 10 進の数の文字列を、BPM にする。BPM として読み取れなければ null。 */
export function parseBpmText(text: string): number | null {
  const match = BPM_PATTERN.exec(text)
  if (match === null) {
    return null
  }
  const bpm = Number(match[1])
  return isValidBpm(bpm) ? bpm : null
}

/** BPM の入力欄に入力された文字列から、数字と小数点 1 つ以外と、小数点第二位以降を取り除く。 */
export function sanitizeBpmInput(text: string): string {
  const digitsAndPoints = text.replace(/[^0-9.]/g, '')
  const firstPoint = digitsAndPoints.indexOf('.')
  return firstPoint === -1
    ? digitsAndPoints
    : `${digitsAndPoints.slice(0, firstPoint + 1)}${digitsAndPoints
        .slice(firstPoint + 1)
        .replaceAll('.', '')
        .slice(0, 1)}`
}
