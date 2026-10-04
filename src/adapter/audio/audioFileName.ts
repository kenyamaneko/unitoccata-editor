const AUDIO_EXTENSIONS = ['mp3', 'ogg'] as const

/** 音源として読み込めるファイルの拡張子を、「mp3、ogg」のように読み上げる形で並べた文字列。 */
export const AUDIO_EXTENSIONS_TEXT = AUDIO_EXTENSIONS.join('、')

/** ファイル選択で、音源として選べるファイルを絞り込む指定 (accept 属性の値)。 */
export const AUDIO_FILE_ACCEPT = AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(',')

/** ファイル名が音源のものか。拡張子の大文字小文字は区別しない。 */
export function isAudioFileName(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return (AUDIO_EXTENSIONS as readonly string[]).includes(extension)
}
