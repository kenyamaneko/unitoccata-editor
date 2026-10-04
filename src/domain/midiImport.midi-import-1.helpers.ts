import { parseMidiFile } from '../adapter/midi/midiFile.ts'
import { createMidiBytes } from '../test/files.ts'
import type { MidiFileContent } from '../test/files.ts'
import { createDefaultVelocityRanges, importMidi } from './midiImport.ts'
import type { MidiImportResult, VelocityRange } from './midiImport.ts'

export interface NoteInput {
  tick: number
  pitch: number
  velocity: number
  durationTicks?: number
}

export interface ImportInput {
  ticksPerQuarter?: number
  notes?: NoteInput[]
  tempos?: { tick: number; microsecondsPerQuarter: number }[]
  timeSignatures?: { tick: number; num: number; den: number }[]
  pitchToLane?: Map<number, number>
  velocityRanges?: VelocityRange[]
  laneCount?: number
}

export const C2 = 48
export const CSHARP2 = 49
export const C3 = 60

export const LANE_0_ONLY = new Map([[C2, 0]])
export const LANE_0_AND_1 = new Map([
  [C2, 0],
  [CSHARP2, 1],
])

export function tapRange(min: number, max: number): VelocityRange {
  return { min, max, note: { kind: 'tap' } }
}

export function flickRange(min: number, max: number, direction: 'up' | 'left' | 'right'): VelocityRange {
  return { min, max, note: { kind: 'flick', direction } }
}

export function defaultVelocityRanges(): VelocityRange[] {
  return createDefaultVelocityRanges()
}

export function runImport(input: ImportInput = {}): MidiImportResult {
  let nextId = 0
  return importMidi(
    {
      ticksPerQuarter: input.ticksPerQuarter ?? 480,
      tempos: input.tempos ?? [],
      timeSignatures: input.timeSignatures ?? [],
      notes: (input.notes ?? []).map((note) => ({ ...note, durationTicks: note.durationTicks ?? 0 })),
    },
    {
      pitchToLane: input.pitchToLane ?? LANE_0_ONLY,
      velocityRanges: input.velocityRanges ?? defaultVelocityRanges(),
      laneCount: input.laneCount ?? 5,
    },
    () => `id${nextId++}`,
  )
}

export function runImportFromMidiFile(
  content: MidiFileContent,
  input: Pick<ImportInput, 'pitchToLane' | 'velocityRanges' | 'laneCount'> = {},
): MidiImportResult {
  let nextId = 0
  return importMidi(
    parseMidiFile(createMidiBytes(content)),
    {
      pitchToLane: input.pitchToLane ?? LANE_0_ONLY,
      velocityRanges: input.velocityRanges ?? defaultVelocityRanges(),
      laneCount: input.laneCount ?? 5,
    },
    () => `id${nextId++}`,
  )
}

export function importedTicks(result: MidiImportResult): number[] {
  return result.chart.notes.map((note) => note.tick)
}

export function importedLanes(result: MidiImportResult): number[] {
  return result.chart.notes.map((note) => note.lane)
}
