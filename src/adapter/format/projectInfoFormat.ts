import { MAX_BPM, MAX_METER_NUM, METER_DENOMINATORS_TEXT, MIN_BPM, MIN_METER_NUM } from '../../domain/constants.ts'
import { isValidBpm, isValidMeterDen, isValidMeterPart } from '../../domain/projectInfo.ts'
import type { SignatureChange, TempoChange, ProjectInfo } from '../../domain/types.ts'
import { FormatError } from './formatError.ts'
import { readArray, readInteger, readNumber, readObject } from './readers.ts'

function readChangeList<T extends { readonly tick: number }>(
  value: unknown,
  listLabel: string,
  changeLabel: string,
  readItem: (item: Record<string, unknown>, itemLabel: string) => T,
): T[] {
  const items = readArray(value, listLabel).map((item, i) => {
    const itemLabel = `${i + 1} つ目の${changeLabel}`
    const object = readObject(item, itemLabel)
    const tick = readInteger(object.tick, `${itemLabel}の位置`)
    if (tick < 0) {
      throw new FormatError(`${itemLabel}の位置は先頭以降にしてください`)
    }
    return readItem(object, itemLabel)
  })
  const first = items[0]
  if (first === undefined || first.tick !== 0) {
    throw new FormatError(`最初の${changeLabel}は先頭の位置にしてください`)
  }
  items.forEach((item, i) => {
    const previous = items[i - 1]
    if (previous !== undefined && item.tick <= previous.tick) {
      throw new FormatError(`${i + 1} つ目の${changeLabel}の位置は前の${changeLabel}より後にしてください`)
    }
  })
  return items
}

function readTempoChange(item: Record<string, unknown>, label: string): TempoChange {
  const bpm = readNumber(item.bpm, `${label}の BPM`)
  if (!isValidBpm(bpm)) {
    throw new FormatError(`${label}の BPM は ${MIN_BPM} 以上 ${MAX_BPM} 以下にしてください`)
  }
  return { tick: item.tick as number, bpm }
}

function readSignatureChange(item: Record<string, unknown>, label: string): SignatureChange {
  const num = readInteger(item.num, `${label}の分子`)
  const den = readInteger(item.den, `${label}の分母`)
  if (!isValidMeterPart(num)) {
    throw new FormatError(`${label}の分子は ${MIN_METER_NUM} 以上 ${MAX_METER_NUM} 以下の整数にしてください`)
  }
  if (!isValidMeterDen(den)) {
    throw new FormatError(`${label}の分母は ${METER_DENOMINATORS_TEXT} のいずれかにしてください`)
  }
  return { tick: item.tick as number, num, den }
}

/** 譜面ファイルのオフセット、テンポ、拍子を読み、仕様どおりか検証して ProjectInfo にする。仕様に反していれば FormatError を投げる。 */
export function readProjectInfoFields(object: Record<string, unknown>): ProjectInfo {
  return {
    offsetMs: readNumber(object.offsetMs, 'オフセット'),
    tempo: readChangeList(object.tempo, 'テンポ', 'テンポ変化点', readTempoChange),
    meter: readChangeList(object.meter, '拍子', '拍子変化点', readSignatureChange),
  }
}

/** ProjectInfo を、譜面ファイルのオフセット、テンポ、拍子の項目にする。 */
export function serializeProjectInfoFields(projectInfo: ProjectInfo): {
  readonly offsetMs: number
  readonly tempo: readonly { readonly tick: number; readonly bpm: number }[]
  readonly meter: readonly { readonly tick: number; readonly num: number; readonly den: number }[]
} {
  return {
    offsetMs: projectInfo.offsetMs,
    tempo: projectInfo.tempo.map((change) => ({ tick: change.tick, bpm: change.bpm })),
    meter: projectInfo.meter.map((change) => ({ tick: change.tick, num: change.num, den: change.den })),
  }
}
