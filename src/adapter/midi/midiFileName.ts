const MIDI_EXTENSIONS = ['.mid', '.midi'] as const
const MIDI_MEDIA_TYPE = 'audio/midi'

/** MIDI ファイルの拡張子を、「.mid または .midi」のように読み上げる形で並べた文字列。 */
export const MIDI_EXTENSIONS_TEXT = MIDI_EXTENSIONS.join(' または ')

/** ファイル選択で、MIDI ファイルを選べるようにする指定 (accept 属性の値)。 */
export const MIDI_FILE_ACCEPT = [...MIDI_EXTENSIONS, MIDI_MEDIA_TYPE].join(',')
