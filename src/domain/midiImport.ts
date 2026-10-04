import { assertNever } from '../utils/assertNever.ts'
import { MAX_NOTE_COUNT, MICROSECONDS_PER_MINUTE, TICKS_PER_QUARTER } from './constants.ts'
import { formatPitchName } from './pitch.ts'
import { setSignatureChange, setTempoChange } from './projectInfo.ts'
import { sortNotes } from './notes.ts'
import type { Chart, FlickDirection, LongEnd, SignatureChange, Note, TempoChange, ProjectInfo } from './types.ts'

/** MIDI ファイルのノート。tick と長さは MIDI ファイルの分解能 (ticksPerQuarter) の単位。 */
export interface MidiNote {
  readonly tick: number
  readonly durationTicks: number
  readonly pitch: number
  readonly velocity: number
}

/** MIDI のテンポ変更。 */
export interface MidiTempoEvent {
  readonly tick: number
  readonly microsecondsPerQuarter: number
}

/** MIDI の拍子記号。den は 2 の冪を展開した分母 (4 なら 4 分音符)。 */
export interface MidiTimeSignatureEvent {
  readonly tick: number
  readonly num: number
  readonly den: number
}

/** 取り込み元の MIDI の内容。 */
export interface MidiSong {
  readonly ticksPerQuarter: number
  readonly tempos: readonly MidiTempoEvent[]
  readonly timeSignatures: readonly MidiTimeSignatureEvent[]
  readonly notes: readonly MidiNote[]
}

/** ベロシティの範囲に割り当てるノーツの種類。 */
export type ImportedNoteKind =
  | { readonly kind: 'tap' }
  | { readonly kind: 'flick'; readonly direction: FlickDirection }
  | { readonly kind: 'long'; readonly end: LongEnd }

/** ベロシティの範囲 (両端を含む) と、その範囲のノーツの種類。 */
export interface VelocityRange {
  readonly min: number
  readonly max: number
  readonly note: ImportedNoteKind
}

/** 取り込みの設定。 */
export interface MidiImportOptions {
  /** 音程 (MIDI ノート番号) からレーンへの割り当て。ここにない音程は無視する。 */
  readonly pitchToLane: ReadonlyMap<number, number>
  readonly velocityRanges: readonly VelocityRange[]
  readonly laneCount: number
}

/** 取り込みで見つかった、ノーツを取り込めなかった事例。 */
export interface MidiImportWarning {
  readonly reason: 'velocity-out-of-range' | 'zero-length-long' | 'duplicate-position'
  readonly tick: number
  readonly lane: number
}

/** 取り込みの結果。 */
export interface MidiImportResult {
  readonly projectInfo: ProjectInfo
  readonly chart: Chart
  readonly warnings: readonly MidiImportWarning[]
}

const MIN_VELOCITY = 1
const MAX_VELOCITY = 127
const VELOCITY_BAND_SIZE = 10
const TAP_VELOCITY_MIN = 71
const DEFAULT_OFFSET_MS = 0
const MIDI_DEFAULT_MICROSECONDS_PER_QUARTER = 500_000
const MIDI_DEFAULT_SIGNATURE_NUM = 4
const MIDI_DEFAULT_SIGNATURE_DEN = 4

/** 仕様のベロシティ表どおりの範囲を返す。 */
export function createDefaultVelocityRanges(): VelocityRange[] {
  const band = (index: number, note: ImportedNoteKind): VelocityRange => ({
    min: MIN_VELOCITY + index * VELOCITY_BAND_SIZE,
    max: (index + 1) * VELOCITY_BAND_SIZE,
    note,
  })
  return [
    band(0, { kind: 'flick', direction: 'left' }),
    band(1, { kind: 'flick', direction: 'up' }),
    band(2, { kind: 'flick', direction: 'right' }),
    band(3, { kind: 'long', end: { kind: 'release' } }),
    band(4, { kind: 'long', end: { kind: 'flick', direction: 'left' } }),
    band(5, { kind: 'long', end: { kind: 'flick', direction: 'up' } }),
    band(6, { kind: 'long', end: { kind: 'flick', direction: 'right' } }),
    { min: TAP_VELOCITY_MIN, max: MAX_VELOCITY, note: { kind: 'tap' } },
  ]
}

function validateOptions(options: MidiImportOptions): void {
  for (const [pitch, lane] of options.pitchToLane) {
    if (!Number.isInteger(lane) || lane < 0 || lane >= options.laneCount) {
      throw new RangeError(
        `音程 ${formatPitchName(pitch)} に割り当てたレーン ${lane} がレーン数 ${options.laneCount} に収まりません`,
      )
    }
  }
  const sorted = [...options.velocityRanges].sort((a, b) => a.min - b.min)
  sorted.forEach((range, i) => {
    if (range.min < MIN_VELOCITY || range.max > MAX_VELOCITY || range.min > range.max) {
      throw new RangeError(
        `ベロシティの範囲 ${range.min}〜${range.max} は ${MIN_VELOCITY}〜${MAX_VELOCITY} の範囲で、最小が最大以下になるようにしてください`,
      )
    }
    const previous = sorted[i - 1]
    if (previous !== undefined && range.min <= previous.max) {
      throw new RangeError(
        `ベロシティの範囲 ${previous.min}〜${previous.max} と ${range.min}〜${range.max} が重なっています`,
      )
    }
  })
}

function convertEventTicks<T extends { readonly tick: number }>(
  events: readonly T[],
  scale: (tick: number) => number,
): T[] {
  const byTick = new Map<number, T>()
  for (const event of [...events].sort((a, b) => a.tick - b.tick)) {
    byTick.set(scale(event.tick), { ...event, tick: scale(event.tick) })
  }
  return [...byTick.values()]
}

function convertProjectInfo(song: MidiSong, scale: (tick: number) => number): ProjectInfo {
  const tempos = convertEventTicks(song.tempos, scale)
  const timeSignatures = convertEventTicks(song.timeSignatures, scale)
  let projectInfo: ProjectInfo = {
    offsetMs: DEFAULT_OFFSET_MS,
    tempo: [{ tick: 0, bpm: MICROSECONDS_PER_MINUTE / MIDI_DEFAULT_MICROSECONDS_PER_QUARTER }],
    meter: [{ tick: 0, num: MIDI_DEFAULT_SIGNATURE_NUM, den: MIDI_DEFAULT_SIGNATURE_DEN }],
  }
  for (const tempo of tempos) {
    const change: TempoChange = { tick: tempo.tick, bpm: MICROSECONDS_PER_MINUTE / tempo.microsecondsPerQuarter }
    projectInfo = setTempoChange(projectInfo, change)
  }
  for (const timeSignature of timeSignatures) {
    const change: SignatureChange = { tick: timeSignature.tick, num: timeSignature.num, den: timeSignature.den }
    projectInfo = setSignatureChange(projectInfo, change)
  }
  return projectInfo
}

function findVelocityRange(ranges: readonly VelocityRange[], velocity: number): VelocityRange | undefined {
  return ranges.find((range) => velocity >= range.min && velocity <= range.max)
}

/**
 * MIDI の内容から、新しい譜面とプロジェクト情報を作る。
 * テンポと拍子は MIDI のものをそのまま使い、MIDI にテンポや拍子がなければ MIDI の既定値 (120 BPM、4/4) を tick 0 に置く。
 * ノーツの種類はベロシティの範囲で決め、ロングの長さは MIDI ノートの長さにする。
 * 取り込めなかったノーツは warnings に載せる。
 */
export function importMidi(song: MidiSong, options: MidiImportOptions, createId: () => string): MidiImportResult {
  validateOptions(options)
  const scale = (tick: number): number => Math.round((tick * TICKS_PER_QUARTER) / song.ticksPerQuarter)
  const warnings: MidiImportWarning[] = []
  const notes: Note[] = []
  const occupied = new Set<string>()

  for (const midiNote of [...song.notes].sort((a, b) => a.tick - b.tick)) {
    const lane = options.pitchToLane.get(midiNote.pitch)
    if (lane === undefined) {
      continue
    }
    const tick = scale(midiNote.tick)
    const range = findVelocityRange(options.velocityRanges, midiNote.velocity)
    if (range === undefined) {
      warnings.push({ reason: 'velocity-out-of-range', tick, lane })
      continue
    }
    const key = `${tick}:${lane}`
    if (occupied.has(key)) {
      warnings.push({ reason: 'duplicate-position', tick, lane })
      continue
    }
    const kind = range.note
    switch (kind.kind) {
      case 'long': {
        const endTick = scale(midiNote.tick + midiNote.durationTicks)
        if (endTick <= tick) {
          warnings.push({ reason: 'zero-length-long', tick, lane })
          continue
        }
        notes.push({ id: createId(), type: 'long', tick, lane, path: [{ tick: endTick, lane }], end: kind.end })
        break
      }
      case 'flick':
        notes.push({ id: createId(), type: 'flick', tick, lane, direction: kind.direction })
        break
      case 'tap':
        notes.push({ id: createId(), type: 'tap', tick, lane })
        break
      default:
        return assertNever(kind)
    }
    occupied.add(key)
  }

  if (notes.length > MAX_NOTE_COUNT) {
    throw new RangeError(
      `取り込むノーツが ${notes.length} 個あり、上限の ${MAX_NOTE_COUNT} 個を超えます。ベロシティの範囲や音程の割り当てを見直して、ノーツを減らしてから、もう一度確認してください`,
    )
  }
  return { projectInfo: convertProjectInfo(song, scale), chart: { notes: sortNotes(notes) }, warnings }
}
