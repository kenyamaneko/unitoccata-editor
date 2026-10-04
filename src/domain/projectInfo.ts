import {
  DEFAULT_BPM,
  DEFAULT_METER_DEN,
  DEFAULT_METER_NUM,
  METER_DENOMINATORS,
  MAX_BPM,
  MAX_METER_NUM,
  METER_DENOMINATORS_TEXT,
  MILLISECONDS_PER_SECOND,
  MIN_BPM,
  MIN_METER_NUM,
  SECONDS_PER_MINUTE,
  TICKS_PER_QUARTER,
  TICKS_PER_WHOLE,
} from './constants.ts'
import { getLastTick } from './notes.ts'
import type { Chart, SignatureChange, TempoChange, ProjectInfo } from './types.ts'

/** 拍の位置。barNumber は 1 始まり、beatInBar は小節内で 0 始まり。 */
interface Beat {
  readonly tick: number
  readonly barNumber: number
  readonly beatInBar: number
}

/** 1 tick あたりの秒数。BPM は 4分音符基準。 */
function calculateSecondsPerTick(bpm: number): number {
  return SECONDS_PER_MINUTE / (bpm * TICKS_PER_QUARTER)
}

/**
 * tick を、tick 0 からの経過秒に変換する。オフセットは含まない。
 * 負の tick は先頭のテンポで外挿する。
 */
export function convertTickToSeconds(projectInfo: ProjectInfo, tick: number): number {
  const first = projectInfo.tempo[0]
  if (first === undefined) {
    throw new Error('テンポが空です')
  }
  if (tick < 0) {
    return tick * calculateSecondsPerTick(first.bpm)
  }
  let seconds = 0
  for (let i = 0; i < projectInfo.tempo.length; i++) {
    const current = projectInfo.tempo[i] as TempoChange
    const next = projectInfo.tempo[i + 1]
    const segmentEnd = next === undefined ? Infinity : next.tick
    if (tick <= current.tick) {
      break
    }
    seconds += (Math.min(tick, segmentEnd) - current.tick) * calculateSecondsPerTick(current.bpm)
    if (tick <= segmentEnd) {
      break
    }
  }
  return seconds
}

/**
 * tick 0 からの経過秒を、小数を含む tick に変換する。オフセットは含まない。
 * 負の秒は先頭のテンポで外挿する。
 */
export function convertSecondsToTick(projectInfo: ProjectInfo, seconds: number): number {
  const first = projectInfo.tempo[0]
  if (first === undefined) {
    throw new Error('テンポが空です')
  }
  if (seconds < 0) {
    return seconds / calculateSecondsPerTick(first.bpm)
  }
  let segmentStartSeconds = 0
  for (let i = 0; i < projectInfo.tempo.length; i++) {
    const current = projectInfo.tempo[i] as TempoChange
    const next = projectInfo.tempo[i + 1]
    const secondsPerTick = calculateSecondsPerTick(current.bpm)
    if (next === undefined) {
      return current.tick + (seconds - segmentStartSeconds) / secondsPerTick
    }
    const segmentEndSeconds = segmentStartSeconds + (next.tick - current.tick) * secondsPerTick
    if (seconds < segmentEndSeconds) {
      return current.tick + (seconds - segmentStartSeconds) / secondsPerTick
    }
    segmentStartSeconds = segmentEndSeconds
  }
  throw new Error('到達しない分岐です')
}

/** tick を、音源ファイルの先頭からの経過秒に変換する。 */
export function convertTickToAudioSeconds(projectInfo: ProjectInfo, tick: number): number {
  return projectInfo.offsetMs / MILLISECONDS_PER_SECOND + convertTickToSeconds(projectInfo, tick)
}

/** 音源ファイルの先頭からの経過秒を、小数を含む tick に変換する。 */
export function convertAudioSecondsToTick(projectInfo: ProjectInfo, audioSeconds: number): number {
  return convertSecondsToTick(projectInfo, audioSeconds - projectInfo.offsetMs / MILLISECONDS_PER_SECOND)
}

/** 1 小節の tick 数。 */
function calculateMeasureTicks(signatureChange: SignatureChange): number {
  return (signatureChange.num * TICKS_PER_WHOLE) / signatureChange.den
}

/** 1 拍の tick 数。拍は拍子の分母が表す音符の長さとする。 */
function calculateBeatTicks(signatureChange: SignatureChange): number {
  return TICKS_PER_WHOLE / signatureChange.den
}

/**
 * fromTick 以上 toTick 未満にある拍を、tick 順に返す。
 * 拍子変化点で小節は打ち切られ、変化点から新しい小節が始まる。
 */
export function listBeats(projectInfo: ProjectInfo, fromTick: number, toTick: number): Beat[] {
  const beats: Beat[] = []
  let barsBeforeSegment = 0
  for (let i = 0; i < projectInfo.meter.length; i++) {
    const signatureChange = projectInfo.meter[i] as SignatureChange
    const next = projectInfo.meter[i + 1]
    const segmentEnd = next === undefined ? Infinity : next.tick
    const beatTicks = calculateBeatTicks(signatureChange)
    const firstBeatIndex = Math.max(0, Math.ceil((fromTick - signatureChange.tick) / beatTicks))
    for (let k = firstBeatIndex; ; k++) {
      const tick = signatureChange.tick + k * beatTicks
      if (tick >= segmentEnd || tick >= toTick) {
        break
      }
      beats.push({
        tick,
        barNumber: barsBeforeSegment + Math.floor(k / signatureChange.num) + 1,
        beatInBar: k % signatureChange.num,
      })
    }
    if (next === undefined || next.tick >= toTick) {
      break
    }
    barsBeforeSegment += Math.ceil((next.tick - signatureChange.tick) / calculateMeasureTicks(signatureChange))
  }
  return beats
}

/**
 * 先頭から barCount 小節目の終わりの tick を返す。拍子変化点で小節は打ち切られるので、
 * 打ち切られた小節の終わりは、次の拍子変化点の tick になる。
 */
export function calculateBarsEndTick(projectInfo: ProjectInfo, barCount: number): number {
  let remaining = barCount
  for (let i = 0; i < projectInfo.meter.length; i++) {
    const signatureChange = projectInfo.meter[i] as SignatureChange
    const next = projectInfo.meter[i + 1]
    const measureTicks = calculateMeasureTicks(signatureChange)
    if (next === undefined) {
      return signatureChange.tick + remaining * measureTicks
    }
    const barsInSegment = Math.ceil((next.tick - signatureChange.tick) / measureTicks)
    if (remaining <= barsInSegment) {
      return Math.min(signatureChange.tick + remaining * measureTicks, next.tick)
    }
    remaining -= barsInSegment
  }
  throw new Error('拍子が空です')
}

/** tick を含む小節までの小節の数を返す。小節の終わりちょうどの tick は、次の小節に含まれる。 */
export function countBarsContainingTick(projectInfo: ProjectInfo, tick: number): number {
  let bars = 0
  for (let i = 0; i < projectInfo.meter.length; i++) {
    const signatureChange = projectInfo.meter[i] as SignatureChange
    const next = projectInfo.meter[i + 1]
    const measureTicks = calculateMeasureTicks(signatureChange)
    if (next === undefined || tick < next.tick) {
      return bars + Math.floor((tick - signatureChange.tick) / measureTicks) + 1
    }
    bars += Math.ceil((next.tick - signatureChange.tick) / measureTicks)
  }
  throw new Error('拍子が空です')
}

/** tick の、小節と拍の中での位置。 */
export interface BeatPosition {
  readonly barNumber: number
  readonly beatNumber: number
  /** 拍の頭から tick までの長さ (tick)。拍の頭ちょうどなら 0。 */
  readonly offsetTicks: number
  /** 1 拍の長さ (tick)。 */
  readonly beatTicks: number
}

/** tick が、何小節目の何拍目の、拍の頭から何 tick 後ろかを返す。小節番号と拍番号は 1 始まり。拍子変化点で小節は打ち切られる。 */
export function locateBeatPosition(projectInfo: ProjectInfo, tick: number): BeatPosition {
  let barsBefore = 0
  for (let i = 0; i < projectInfo.meter.length; i++) {
    const signatureChange = projectInfo.meter[i] as SignatureChange
    const next = projectInfo.meter[i + 1]
    if (next === undefined || tick < next.tick) {
      const beatTicks = calculateBeatTicks(signatureChange)
      const fromChange = tick - signatureChange.tick
      const beatIndex = Math.floor(fromChange / beatTicks)
      return {
        barNumber: barsBefore + Math.floor(beatIndex / signatureChange.num) + 1,
        beatNumber: (beatIndex % signatureChange.num) + 1,
        offsetTicks: fromChange - beatIndex * beatTicks,
        beatTicks,
      }
    }
    barsBefore += Math.ceil((next.tick - signatureChange.tick) / calculateMeasureTicks(signatureChange))
  }
  throw new Error('拍子が空です')
}

/** ノーツ、テンポ変化点、拍子変化点の全てを含む、最小の小節の数を返す。 */
export function calculateRequiredBarCount(projectInfo: ProjectInfo, chart: Chart): number {
  const lastNoteTick = chart.notes.reduce((max, note) => Math.max(max, getLastTick(note)), 0)
  const lastChangeTick = Math.max(projectInfo.tempo.at(-1)?.tick ?? 0, projectInfo.meter.at(-1)?.tick ?? 0)
  return countBarsContainingTick(projectInfo, Math.max(lastNoteTick, lastChangeTick))
}

/** プロジェクト情報の編集が成立しなかった理由。tick 0 のテンポ変化点と拍子変化点は削除できない。 */
export type ProjectInfoEditFailureReason = 'tempo-change-at-tick-0' | 'signature-change-at-tick-0'

/** プロジェクト情報の編集の結果。成立すれば新しいプロジェクト情報、しなければ理由を返す。 */
export type ProjectInfoEditResult =
  | { readonly ok: true; readonly projectInfo: ProjectInfo }
  | { readonly ok: false; readonly reason: ProjectInfoEditFailureReason }

/** BPM として使える値か。MIN_BPM 以上 MAX_BPM 以下のとき使える。 */
export function isValidBpm(bpm: number): boolean {
  return Number.isFinite(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM
}

/** 拍子の分子として使える値か。MIN_METER_NUM 以上 MAX_METER_NUM 以下の整数のとき使える。 */
export function isValidMeterPart(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_METER_NUM && value <= MAX_METER_NUM
}

/** 拍子の分母として使える値か。METER_DENOMINATORS のいずれか。 */
export function isValidMeterDen(value: number): boolean {
  return (METER_DENOMINATORS as readonly number[]).includes(value)
}

function assertValidTick(tick: number): void {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new RangeError(`tick は 0 以上の整数にしてください: ${tick}`)
  }
}

function upsertByTick<T extends { readonly tick: number }>(items: readonly T[], change: T): T[] {
  const others = items.filter((item) => item.tick !== change.tick)
  return [...others, change].sort((a, b) => a.tick - b.tick)
}

/** テンポ変化点を追加する。同じ tick の変化点があれば置き換える。 */
export function setTempoChange(projectInfo: ProjectInfo, change: TempoChange): ProjectInfo {
  assertValidTick(change.tick)
  if (!isValidBpm(change.bpm)) {
    throw new RangeError(`BPM は ${MIN_BPM} 以上 ${MAX_BPM} 以下にしてください: ${change.bpm}`)
  }
  return { ...projectInfo, tempo: upsertByTick(projectInfo.tempo, change) }
}

/** テンポ変化点を削除する。tick 0 の変化点は削除できず、理由を返す。 */
export function removeTempoChange(projectInfo: ProjectInfo, tick: number): ProjectInfoEditResult {
  if (tick === 0) {
    return { ok: false, reason: 'tempo-change-at-tick-0' }
  }
  return {
    ok: true,
    projectInfo: { ...projectInfo, tempo: projectInfo.tempo.filter((change) => change.tick !== tick) },
  }
}

/** 拍子変化点を追加する。同じ tick の変化点があれば置き換える。 */
export function setSignatureChange(projectInfo: ProjectInfo, change: SignatureChange): ProjectInfo {
  assertValidTick(change.tick)
  if (!isValidMeterPart(change.num) || !isValidMeterDen(change.den)) {
    throw new RangeError(
      `拍子の分子は ${MIN_METER_NUM} 以上 ${MAX_METER_NUM} 以下の整数、分母は ${METER_DENOMINATORS_TEXT} のいずれかにしてください: ${change.num}/${change.den}`,
    )
  }
  return { ...projectInfo, meter: upsertByTick(projectInfo.meter, change) }
}

/** 拍子変化点を削除する。tick 0 の変化点は削除できず、理由を返す。 */
export function removeSignatureChange(projectInfo: ProjectInfo, tick: number): ProjectInfoEditResult {
  if (tick === 0) {
    return { ok: false, reason: 'signature-change-at-tick-0' }
  }
  return {
    ok: true,
    projectInfo: { ...projectInfo, meter: projectInfo.meter.filter((change) => change.tick !== tick) },
  }
}

/** オフセット (ミリ秒) を設定する。 */
export function setOffsetMs(projectInfo: ProjectInfo, offsetMs: number): ProjectInfo {
  if (!Number.isFinite(offsetMs)) {
    throw new RangeError(`オフセットは数値にしてください: ${offsetMs}`)
  }
  return { ...projectInfo, offsetMs }
}

/** 初期のプロジェクト情報。オフセット 0、BPM と拍子は初期値。 */
export function createInitialProjectInfo(): ProjectInfo {
  return {
    offsetMs: 0,
    tempo: [{ tick: 0, bpm: DEFAULT_BPM }],
    meter: [{ tick: 0, num: DEFAULT_METER_NUM, den: DEFAULT_METER_DEN }],
  }
}
