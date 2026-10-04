/** JSON ファイルの拡張子。 */
export const JSON_EXTENSION = '.json'

/** ファイル選択で、JSON ファイルを選べるようにする指定 (accept 属性の値)。 */
export const JSON_FILE_ACCEPT = `application/json,${JSON_EXTENSION}`

/** 書き出す譜面ファイルの拡張子。 */
export const CHART_FILE_EXTENSION = '.unitoccata.json'

/** ファイル名に使えない記号。 */
const UNUSABLE_FILE_NAME_SYMBOLS = '\\/:*?"<>|'

/** 制御文字の最大の文字コード。 */
const MAX_CONTROL_CHARACTER_CODE = 31

/** 曲名、譜面名をファイル名の一部にするために、ファイル名に使えない記号と制御文字を取り除く。取り除いて空になるときは、`untitled` にする。 */
function sanitizeFileNamePart(name: string): string {
  const sanitized = Array.from(name)
    .filter(
      (character) =>
        character.charCodeAt(0) > MAX_CONTROL_CHARACTER_CODE && !UNUSABLE_FILE_NAME_SYMBOLS.includes(character),
    )
    .join('')
    .trim()
  return sanitized === '' ? 'untitled' : sanitized
}

/** 書き出す譜面ファイルの名前「譜面名.曲名.unitoccata.json」を作る。 */
export function createChartFileName(chartName: string, songName: string): string {
  return `${sanitizeFileNamePart(chartName)}.${sanitizeFileNamePart(songName)}${CHART_FILE_EXTENSION}`
}
