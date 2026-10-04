import { parseMidi, type MidiEvent } from 'midi-file'
import { MIDI_EXTENSIONS_TEXT } from './midiFileName.ts'
import {
  MAX_BPM,
  MAX_METER_NUM,
  MAX_MICROSECONDS_PER_QUARTER,
  METER_DENOMINATORS_TEXT,
  MIN_BPM,
  MIN_METER_NUM,
  MIN_MICROSECONDS_PER_QUARTER,
  TICKS_PER_QUARTER,
} from '../../domain/constants.ts'
import { isValidMeterDen, isValidMeterPart } from '../../domain/projectInfo.ts'
import type { MidiNote, MidiSong, MidiTempoEvent, MidiTimeSignatureEvent } from '../../domain/midiImport.ts'

interface OpenNote {
  readonly tick: number
  readonly velocity: number
}

function openKey(channel: number, pitch: number): string {
  return `${channel}:${pitch}`
}

function readMidi(bytes: Uint8Array): ReturnType<typeof parseMidi> {
  try {
    return parseMidi(bytes)
  } catch (cause) {
    throw new Error(
      `MIDI ファイルとして読めません。拡張子が ${MIDI_EXTENSIONS_TEXT} の Standard MIDI File を選んでください`,
      { cause },
    )
  }
}

function readTempoEvent(tick: number, microsecondsPerQuarter: number): MidiTempoEvent {
  if (microsecondsPerQuarter < MIN_MICROSECONDS_PER_QUARTER || microsecondsPerQuarter > MAX_MICROSECONDS_PER_QUARTER) {
    throw new Error(
      `MIDI のテンポ (4 分音符 1 つあたりのマイクロ秒) が ${MIN_MICROSECONDS_PER_QUARTER} 以上 ${MAX_MICROSECONDS_PER_QUARTER} 以下ではないため取り込めません: ${microsecondsPerQuarter}。テンポを BPM ${MIN_BPM} 以上 ${MAX_BPM} 以下にしてから、もう一度選んでください`,
    )
  }
  return { tick, microsecondsPerQuarter }
}

function readTimeSignatureEvent(tick: number, num: number, den: number): MidiTimeSignatureEvent {
  if (!isValidMeterPart(num)) {
    throw new Error(
      `MIDI の拍子 ${num}/${den} は取り込めません。拍子の分子を ${MIN_METER_NUM} 以上 ${MAX_METER_NUM} 以下にしてから、もう一度選んでください`,
    )
  }
  if (!isValidMeterDen(den)) {
    throw new Error(
      `MIDI の拍子 ${num}/${den} は取り込めません。拍子の分母を ${METER_DENOMINATORS_TEXT} のいずれかにしてから、もう一度選んでください`,
    )
  }
  return { tick, num, den }
}

/**
 * Standard MIDI File のバイト列を読み、取り込みに使う内容にする。
 * ノート長は、ノートオンからノートオフまでの tick にする。読めない形式、テンポが 0、拍子の分子が 0、拍子の分母が使える値でないときは例外にする。
 */
export function parseMidiFile(bytes: Uint8Array): MidiSong {
  const parsed = readMidi(bytes)
  const ticksPerQuarter = parsed.header.ticksPerBeat
  if (ticksPerQuarter === undefined) {
    throw new Error('SMPTE 形式の時間分解能には対応していません。別の MIDI ファイルを選んでください')
  }
  if (!Number.isInteger(ticksPerQuarter) || ticksPerQuarter <= 0 || TICKS_PER_QUARTER % ticksPerQuarter !== 0) {
    throw new Error(
      `MIDI の時間分解能が ${TICKS_PER_QUARTER} の約数ではないため取り込めません: ${ticksPerQuarter}。分解能を ${TICKS_PER_QUARTER} の約数 (96、192、240、480、${TICKS_PER_QUARTER} など) にしてから、もう一度選んでください`,
    )
  }
  const tempos: MidiTempoEvent[] = []
  const timeSignatures: MidiTimeSignatureEvent[] = []
  const notes: MidiNote[] = []
  for (const track of parsed.tracks) {
    let tick = 0
    const open = new Map<string, OpenNote>()
    for (const event of track as MidiEvent[]) {
      tick += event.deltaTime
      if (event.type === 'setTempo') {
        tempos.push(readTempoEvent(tick, event.microsecondsPerBeat))
      } else if (event.type === 'timeSignature') {
        timeSignatures.push(readTimeSignatureEvent(tick, event.numerator, event.denominator))
      } else if (event.type === 'noteOn') {
        open.set(openKey(event.channel, event.noteNumber), { tick, velocity: event.velocity })
      } else if (event.type === 'noteOff') {
        const key = openKey(event.channel, event.noteNumber)
        const started = open.get(key)
        if (started !== undefined) {
          notes.push({
            tick: started.tick,
            durationTicks: tick - started.tick,
            pitch: event.noteNumber,
            velocity: started.velocity,
          })
          open.delete(key)
        }
      }
    }
  }
  return { ticksPerQuarter, tempos, timeSignatures, notes }
}
