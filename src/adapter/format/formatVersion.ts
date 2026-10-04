import { FormatError } from './formatError.ts'
import { readInteger } from './readers.ts'

/** 譜面ファイルと elements.json の、JSON の中の formatVersion が取る値。 */
export const FILE_FORMAT_VERSION = 1

/** JSON の formatVersion が、対応している版でなければ FormatError を投げる。 */
export function assertSupportedFormatVersion(object: Record<string, unknown>): void {
  const version = readInteger(object.formatVersion, 'ファイルの版')
  if (version !== FILE_FORMAT_VERSION) {
    throw new FormatError(`ファイルの版 ${version} には対応していません`)
  }
}
