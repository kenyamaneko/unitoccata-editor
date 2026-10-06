import { FormatError } from './formatError.ts'
import { readInteger } from './readers.ts'

/** 譜面ファイルと elements.json の、JSON の中の formatVersion が取る値。 */
export const FILE_FORMAT_VERSION = 1

/** JSON の formatVersion が、対応しているバージョンでなければ FormatError を投げる。 */
export function assertSupportedFormatVersion(object: Record<string, unknown>): void {
  const version = readInteger(object.formatVersion, 'ファイルのバージョン')
  if (version !== FILE_FORMAT_VERSION) {
    throw new FormatError(`ファイルのバージョン ${version} には対応していません`)
  }
}
