const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const NOTES_PER_OCTAVE = NOTE_NAMES.length
const OCTAVE_OFFSET = 2

/** MIDI のノート番号を音名にする。ノート番号 60 を C3 とする。 */
export function formatPitchName(midiNote: number): string {
  if (!Number.isInteger(midiNote) || midiNote < 0) {
    throw new RangeError(`ノート番号は 0 以上の整数にしてください: ${midiNote}`)
  }
  const name = NOTE_NAMES[midiNote % NOTES_PER_OCTAVE] as string
  return `${name}${Math.floor(midiNote / NOTES_PER_OCTAVE) - OCTAVE_OFFSET}`
}

const NAME_PATTERN = /^([A-G])(#?)(-?\d+)$/
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** 「C3」「C#2」のような音名を、MIDI のノート番号にする。ノート番号 60 を C3 とする。読めなければ null。 */
export function parsePitchName(text: string): number | null {
  const match = NAME_PATTERN.exec(text.trim())
  if (match === null) {
    return null
  }
  const semitone = (SEMITONES[match[1] as string] as number) + (match[2] === '#' ? 1 : 0)
  const midiNote = (Number(match[3]) + OCTAVE_OFFSET) * NOTES_PER_OCTAVE + semitone
  return midiNote >= 0 ? midiNote : null
}
