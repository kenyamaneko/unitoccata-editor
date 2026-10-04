import { assertNever } from '../../utils/assertNever.ts'
import { MAX_LANE_COUNT, MAX_NOTE_COUNT, MIN_LANE_COUNT } from '../../domain/constants.ts'
import { locateNoteProblem, sortNotes } from '../../domain/notes.ts'
import type { Chart, ChartPoint, FlickDirection, LongEnd, Note, ProjectInfo } from '../../domain/types.ts'
import { FormatError } from './formatError.ts'
import { assertSupportedFormatVersion, FILE_FORMAT_VERSION } from './formatVersion.ts'
import { readProjectInfoFields, serializeProjectInfoFields } from './projectInfoFormat.ts'
import { readArray, readInteger, readNumber, readObject, readString } from './readers.ts'

const FLICK_DIRECTIONS: readonly string[] = ['up', 'left', 'right']

function readDirection(value: unknown, label: string): FlickDirection {
  const text = readString(value, label)
  if (!FLICK_DIRECTIONS.includes(text)) {
    throw new FormatError(`${label}は up / left / right のいずれかにしてください`)
  }
  return text as FlickDirection
}

/** 譜面ファイルを読んだ結果。 */
export interface LoadedChart {
  readonly chart: Chart
  readonly laneCount: number
  readonly projectInfo: ProjectInfo
}

function readLaneCount(value: unknown): number {
  const laneCount = readInteger(readNumber(value, 'レーン数'), 'レーン数')
  if (laneCount < MIN_LANE_COUNT || laneCount > MAX_LANE_COUNT) {
    throw new FormatError(`レーン数は ${MIN_LANE_COUNT} 以上 ${MAX_LANE_COUNT} 以下にしてください`)
  }
  return laneCount
}

function readLane(value: unknown, label: string, laneCount: number): number {
  const lane = readInteger(value, label)
  if (lane >= laneCount) {
    throw new FormatError(`${label}は ${laneCount - 1} 以下にしてください: ${lane}`)
  }
  return lane
}

function readPoint(value: unknown, label: string, laneCount: number): ChartPoint {
  const object = readObject(value, label)
  return {
    tick: readInteger(object.tick, `${label}の位置`),
    lane: readLane(object.lane, `${label}のレーン`, laneCount),
  }
}

function readEnd(value: unknown, label: string): LongEnd {
  if (value === 'release') {
    return { kind: 'release' }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return {
      kind: 'flick',
      direction: readDirection((value as Record<string, unknown>).flick, `${label}フリックの向き`),
    }
  }
  throw new FormatError(`${label}は "release" または { "flick": 方向 } にしてください`)
}

function readNote(value: unknown, noteLabel: string, id: string, laneCount: number): Note {
  const object = readObject(value, noteLabel)
  const tick = readInteger(object.tick, `${noteLabel}の位置`)
  const lane = readLane(object.lane, `${noteLabel}のレーン`, laneCount)
  if (tick < 0) {
    throw new FormatError(`${noteLabel}の位置は先頭以降にしてください`)
  }
  const type = readString(object.type, `${noteLabel}の種類`)
  switch (type) {
    case 'tap':
      return { id, type, tick, lane }
    case 'flick':
      return { id, type, tick, lane, direction: readDirection(object.dir, `${noteLabel}の向き`) }
    case 'long': {
      const points = readArray(object.path, `${noteLabel}の続く点`).map((point, i) =>
        readPoint(point, `${noteLabel}の ${i + 1} つ目の続く点`, laneCount),
      )
      if (points.length === 0) {
        throw new FormatError(`${noteLabel}の続く点は 1 点以上にしてください`)
      }
      return { id, type, tick, lane, path: points, end: readEnd(object.end, `${noteLabel}の終端`) }
    }
    default:
      throw new FormatError(`${noteLabel}の種類は tap / flick / long のいずれかにしてください: ${type}`)
  }
}

/**
 * 譜面ファイルを読み、仕様どおりか検証して Chart とレーン数にする。ノーツは位置の順、同じ位置ならレーンの順に並べ替える。
 * 仕様に反していれば FormatError を投げる。id は createId で採番する。
 */
export function parseChartJson(json: unknown, createId: () => string): LoadedChart {
  const object = readObject(json, 'ファイルの内容')
  assertSupportedFormatVersion(object)
  const laneCount = readLaneCount(object.laneCount)
  const projectInfo = readProjectInfoFields(object)
  const noteValues = readArray(object.notes, 'ノーツ')
  if (noteValues.length > MAX_NOTE_COUNT) {
    throw new FormatError(`ノーツは ${MAX_NOTE_COUNT} 個までです (このファイルは ${noteValues.length} 個です)`)
  }
  const notesInFileOrder = noteValues.map((note, i) => readNote(note, `${i + 1} つ目のノーツ`, createId(), laneCount))
  const notes = sortNotes(notesInFileOrder)
  const found = locateNoteProblem(notes, null)
  if (found === null) {
    return { chart: { notes }, laneCount, projectInfo }
  }
  const order = notesInFileOrder.findIndex((note) => note.tick === found.tick && note.lane === found.lane) + 1
  switch (found.problem) {
    case 'out-of-range':
      throw new FormatError(`${order} つ目のノーツに、先頭より前の位置か 0 未満のレーンの点があります`)
    case 'invalid-long-order':
      throw new FormatError(`${order} つ目のノーツの点は、前の点より後の位置にしてください`)
    case 'duplicate-position':
      throw new FormatError(`${order} つ目のノーツと同じ位置にノーツがあります`)
    default:
      return assertNever(found.problem)
  }
}

function serializeNote(note: Note): unknown {
  switch (note.type) {
    case 'tap':
      return { tick: note.tick, lane: note.lane, type: 'tap' }
    case 'flick':
      return { tick: note.tick, lane: note.lane, type: 'flick', dir: note.direction }
    case 'long':
      return {
        tick: note.tick,
        lane: note.lane,
        type: 'long',
        path: note.path.map((point) => ({ tick: point.tick, lane: point.lane })),
        end: note.end.kind === 'release' ? 'release' : { flick: note.end.direction },
      }
    default:
      return assertNever(note)
  }
}

/** 譜面のノーツを、譜面ファイルの notes の形にする。 */
export function serializeNotes(chart: Chart): unknown[] {
  return chart.notes.map(serializeNote)
}

/** Chart、レーン数、プロジェクト情報を、書き出す譜面ファイルの内容にする。小節数は含めない。 */
export function serializeChart(chart: Chart, laneCount: number, projectInfo: ProjectInfo): unknown {
  const { offsetMs, tempo, meter } = serializeProjectInfoFields(projectInfo)
  return {
    formatVersion: FILE_FORMAT_VERSION,
    offsetMs,
    laneCount,
    tempo,
    meter,
    notes: serializeNotes(chart),
  }
}
