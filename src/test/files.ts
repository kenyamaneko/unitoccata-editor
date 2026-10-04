import { writeMidi, type MidiEvent } from 'midi-file'
import { failWith } from './failures.ts'

const FORMAT_VERSION = 1
const DEFAULT_BPM = 120
const DEFAULT_LANE_COUNT = 5
const MICROSECONDS_PER_MINUTE = 60_000_000
const MIDI_END_OF_TRACK_DELTA = 0
const NOTE_NAME_PATTERN = /^([A-G])(#|b)?(-?\d+)$/
const SEMITONE_OF_NOTE_LETTER: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SHIFT_OF_ACCIDENTAL: Readonly<Record<string, number>> = { '#': 1, b: -1, '': 0 }
const SEMITONES_PER_OCTAVE = 12
const OCTAVE_OFFSET = 2
const HEADER_DIVISION_OFFSET = 12

export function createFile(fileName: string, content: string | Uint8Array): File {
  return new File([content as BlobPart], fileName)
}

export function createJsonFile(fileName: string, value: unknown): File {
  return createFile(fileName, JSON.stringify(value))
}

export function createUnreadableFile(fileName: string): File {
  const file = createFile(fileName, '')
  const fail = (): Promise<never> => Promise.reject(new DOMException('ファイルを読み出せません', 'NotReadableError'))
  Object.defineProperties(file, {
    text: { value: fail },
    arrayBuffer: { value: fail },
  })
  return file
}

export type ChartFileNote =
  | { readonly type: 'tap'; readonly tick: number; readonly lane: number }
  | { readonly type: 'flick'; readonly tick: number; readonly lane: number; readonly dir: 'up' | 'left' | 'right' }
  | {
      readonly type: 'long'
      readonly tick: number
      readonly lane: number
      readonly path: readonly { readonly tick: number; readonly lane: number }[]
      readonly end: 'release' | { readonly flick: 'up' | 'left' | 'right' }
    }

export interface ChartFileProjectInfo {
  readonly offsetMs?: number
  readonly tempo?: readonly { readonly tick: number; readonly bpm: number }[]
  readonly meter?: readonly { readonly tick: number; readonly num: number; readonly den: number }[]
}

export function buildChartJson(
  notes: readonly ChartFileNote[],
  laneCount: number = DEFAULT_LANE_COUNT,
  projectInfo: ChartFileProjectInfo = {},
): unknown {
  return {
    formatVersion: FORMAT_VERSION,
    offsetMs: projectInfo.offsetMs ?? 0,
    laneCount,
    tempo: projectInfo.tempo ?? [{ tick: 0, bpm: DEFAULT_BPM }],
    meter: projectInfo.meter ?? [{ tick: 0, num: 4, den: 4 }],
    notes,
  }
}

export function createChartFile(
  fileName: string,
  notes: readonly ChartFileNote[],
  laneCount: number = DEFAULT_LANE_COUNT,
  projectInfo: ChartFileProjectInfo = {},
): File {
  return createJsonFile(fileName, buildChartJson(notes, laneCount, projectInfo))
}

export interface MidiNoteSpec {
  readonly tick: number
  readonly pitch: string | number
  readonly velocity: number
  readonly durationTicks: number
  readonly track?: number
  readonly noteOnOnly?: boolean
}

export interface MidiTempoSpec {
  readonly tick: number
  readonly bpm?: number
  readonly microsecondsPerQuarter?: number
}

export interface MidiFileContent {
  readonly ticksPerQuarter: number
  readonly notes?: readonly MidiNoteSpec[]
  readonly tempos?: readonly MidiTempoSpec[]
  readonly timeSignatures?: readonly {
    readonly tick: number
    readonly numerator: number
    readonly denominator: number
  }[]
}

function toNoteNumber(pitch: string | number): number {
  return typeof pitch === 'number' ? pitch : noteNameToNumber(pitch)
}

function noteNameToNumber(noteName: string): number {
  const match = NOTE_NAME_PATTERN.exec(noteName) ?? failWith(new RangeError(`音名として読めません: ${noteName}`))
  const [, letter = '', accidental = '', octave] = match
  return (
    (Number(octave) + OCTAVE_OFFSET) * SEMITONES_PER_OCTAVE +
    (SEMITONE_OF_NOTE_LETTER[letter] ?? 0) +
    (SHIFT_OF_ACCIDENTAL[accidental] ?? 0)
  )
}

type EventWithoutDelta<T> = T extends unknown ? Omit<T, 'deltaTime'> : never
type TimedEvent = { readonly tick: number; readonly event: EventWithoutDelta<MidiEvent> }

function toMicrosecondsPerQuarter(tempo: MidiTempoSpec): number {
  return (
    tempo.microsecondsPerQuarter ??
    Math.round(
      MICROSECONDS_PER_MINUTE /
        (tempo.bpm ?? failWith(new RangeError('テンポは bpm か microsecondsPerQuarter で指定してください'))),
    )
  )
}

function toTrack(timed: readonly TimedEvent[]): MidiEvent[] {
  const ordered = timed.toSorted((a, b) => a.tick - b.tick)
  const track: MidiEvent[] = ordered.map(
    ({ tick, event }, index) => ({ ...event, deltaTime: tick - (ordered[index - 1]?.tick ?? 0) }) as MidiEvent,
  )
  track.push({ type: 'endOfTrack', meta: true, deltaTime: MIDI_END_OF_TRACK_DELTA })
  return track
}

export function createMidiBytes(content: MidiFileContent): Uint8Array {
  const metaEvents: TimedEvent[] = [
    ...(content.tempos ?? []).map((tempo) => ({
      tick: tempo.tick,
      event: { type: 'setTempo', meta: true, microsecondsPerBeat: toMicrosecondsPerQuarter(tempo) } as const,
    })),
    ...(content.timeSignatures ?? []).map(({ tick, numerator, denominator }) => ({
      tick,
      event: {
        type: 'timeSignature',
        meta: true,
        numerator,
        denominator,
        metronome: 24,
        thirtyseconds: 8,
      } as const,
    })),
  ]
  const notes = content.notes ?? []
  const trackCount = Math.max(1, ...notes.map((note) => (note.track ?? 0) + 1))
  const tracks = Array.from({ length: trackCount }, (_, trackIndex) =>
    toTrack([
      ...(trackIndex === 0 ? metaEvents : []),
      ...notes
        .filter((note) => (note.track ?? 0) === trackIndex)
        .flatMap((note): TimedEvent[] => {
          const noteNumber = toNoteNumber(note.pitch)
          const noteOn: TimedEvent = {
            tick: note.tick,
            event: { type: 'noteOn', channel: 0, noteNumber, velocity: note.velocity },
          }
          const noteOff: TimedEvent = {
            tick: note.tick + note.durationTicks,
            event: { type: 'noteOff', channel: 0, noteNumber, velocity: 0 },
          }
          return note.noteOnOnly === true ? [noteOn] : [noteOn, noteOff]
        }),
    ]),
  )
  const bytes = Uint8Array.from(writeMidi({ header: { format: 1, numTracks: trackCount, ticksPerBeat: 1 }, tracks }))
  const timeDivision = content.ticksPerQuarter
  bytes[HEADER_DIVISION_OFFSET] = (timeDivision >> 8) & 0xff
  bytes[HEADER_DIVISION_OFFSET + 1] = timeDivision & 0xff
  return bytes
}

export function createMidiFile(fileName: string, content: MidiFileContent): File {
  return createFile(fileName, createMidiBytes(content))
}
