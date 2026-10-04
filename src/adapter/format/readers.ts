import { FormatError } from './formatError.ts'

/** 値の呼び名の末尾が半角の英数字のとき、助詞の前に空白を入れる。 */
function attachParticle(label: string, rest: string): string {
  return /[A-Za-z0-9]$/.test(label) ? `${label} ${rest}` : `${label}${rest}`
}

function createUndetectedMessage(label: string): string {
  return attachParticle(label, 'が検出できませんでした。ファイルが破損している可能性があります')
}

/** JSON の値を、キーで引けるオブジェクトとして読む。label は、エラーメッセージに出す値の呼び名。 */
export function readObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FormatError(createUndetectedMessage(label))
  }
  return value as Record<string, unknown>
}

/** JSON の値を配列として読む。 */
export function readArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new FormatError(createUndetectedMessage(label))
  }
  return value
}

/** JSON の値を整数として読む。 */
export function readInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new FormatError(attachParticle(label, 'は整数にしてください'))
  }
  return value
}

/** JSON の値を有限の数として読む。 */
export function readNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FormatError(createUndetectedMessage(label))
  }
  return value
}

/** JSON の値を文字列として読む。 */
export function readString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new FormatError(createUndetectedMessage(label))
  }
  return value
}
