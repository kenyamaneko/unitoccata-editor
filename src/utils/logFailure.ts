import { logWarning } from './logWarning.ts'

function serializeError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return String(error)
  }
  return {
    name: error.name,
    message: error.message,
    code: 'code' in error && typeof error.code === 'string' ? error.code : undefined,
    cause: error.cause === undefined ? undefined : serializeError(error.cause),
  }
}

/** 画面に失敗を伝えたうえで、原因 (cause の連なりを含む) を、構造化したログに警告として残す。 */
export function logFailure(event: string, error: unknown, fields: Readonly<Record<string, unknown>> = {}): void {
  logWarning(event, { ...fields, error: serializeError(error) })
}
