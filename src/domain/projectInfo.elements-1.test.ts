import { describe, expect, it } from 'vitest'
import {
  convertAudioSecondsToTick,
  convertSecondsToTick,
  convertTickToAudioSeconds,
  convertTickToSeconds,
  listBeats,
} from './projectInfo.ts'
import type { ProjectInfo, SignatureChange, TempoChange } from './types.ts'

const PRECISION = 9

function createProjectInfo(options: {
  offsetMs?: number
  tempo?: TempoChange[]
  meter?: SignatureChange[]
}): ProjectInfo {
  return {
    offsetMs: options.offsetMs ?? 0,
    tempo: options.tempo ?? [{ tick: 0, bpm: 120 }],
    meter: options.meter ?? [{ tick: 0, num: 4, den: 4 }],
  }
}

const bpm120Only = createProjectInfo({})
const bpm120Then60 = createProjectInfo({
  tempo: [
    { tick: 0, bpm: 120 },
    { tick: 3840, bpm: 60 },
  ],
})
const bpm120Then60Then240 = createProjectInfo({
  tempo: [
    { tick: 0, bpm: 120 },
    { tick: 3840, bpm: 60 },
    { tick: 7680, bpm: 240 },
  ],
})
const bpm120OffsetPlus120 = createProjectInfo({ offsetMs: 120 })
const bpm120OffsetMinus100 = createProjectInfo({ offsetMs: -100 })

const meter44Only = createProjectInfo({})
const meter68Only = createProjectInfo({ meter: [{ tick: 0, num: 6, den: 8 }] })
const meter44Then68 = createProjectInfo({
  meter: [
    { tick: 0, num: 4, den: 4 },
    { tick: 3840, num: 6, den: 8 },
  ],
})
const meter44Then34At1920 = createProjectInfo({
  meter: [
    { tick: 0, num: 4, den: 4 },
    { tick: 1920, num: 3, den: 4 },
  ],
})
const meter44Then34Then68 = createProjectInfo({
  meter: [
    { tick: 0, num: 4, den: 4 },
    { tick: 3840, num: 3, den: 4 },
    { tick: 6720, num: 6, den: 8 },
  ],
})

function beatTicks(projectInfo: ProjectInfo, fromTick: number, toTick: number) {
  return listBeats(projectInfo, fromTick, toTick).map((beat) => beat.tick)
}

function beatBarNumbers(projectInfo: ProjectInfo, fromTick: number, toTick: number) {
  return listBeats(projectInfo, fromTick, toTick).map((beat) => beat.barNumber)
}

function beatsInBar(projectInfo: ProjectInfo, fromTick: number, toTick: number) {
  return listBeats(projectInfo, fromTick, toTick).map((beat) => beat.beatInBar)
}

describe('[tick と秒の変換] tick と秒の対応', () => {
  describe('tick 0 からの経過秒への変換', () => {
    describe('正常系', () => {
      describe('テンポが BPM 120 だけのとき', () => {
        it.each([
          { tick: -960, seconds: -0.5 },
          { tick: 0, seconds: 0 },
          { tick: 960, seconds: 0.5 },
        ])('tick $tick は、$seconds 秒になる', ({ tick, seconds }) => {
          expect(convertTickToSeconds(bpm120Only, tick)).toBeCloseTo(seconds, PRECISION)
        })
      })

      describe('テンポが tick 0 で BPM 120、tick 3840 で BPM 60 のとき', () => {
        it.each([
          { tick: 3840, seconds: 2 },
          { tick: 4800, seconds: 3 },
        ])('tick $tick は、$seconds 秒になる', ({ tick, seconds }) => {
          expect(convertTickToSeconds(bpm120Then60, tick)).toBeCloseTo(seconds, PRECISION)
        })
      })

      it('テンポが tick 0 で BPM 120、tick 3840 で BPM 60、tick 7680 で BPM 240 のとき、tick 8640 は、6.25 秒になる', () => {
        expect(convertTickToSeconds(bpm120Then60Then240, 8640)).toBeCloseTo(6.25, PRECISION)
      })
    })
  })

  describe('tick 0 からの経過秒から tick への変換', () => {
    describe('正常系', () => {
      describe('テンポが BPM 120 だけのとき', () => {
        it.each([
          { seconds: -0.5, tick: -960 },
          { seconds: 0, tick: 0 },
          { seconds: 0.5, tick: 960 },
        ])('tick 0 から $seconds 秒の位置は、tick $tick になる', ({ seconds, tick }) => {
          expect(convertSecondsToTick(bpm120Only, seconds)).toBeCloseTo(tick, PRECISION)
        })
      })

      describe('テンポが tick 0 で BPM 120、tick 3840 で BPM 60 のとき', () => {
        it.each([
          { seconds: 2, tick: 3840 },
          { seconds: 6, tick: 7680 },
        ])('tick 0 から $seconds 秒の位置は、tick $tick になる', ({ seconds, tick }) => {
          expect(convertSecondsToTick(bpm120Then60, seconds)).toBeCloseTo(tick, PRECISION)
        })
      })

      it('テンポが tick 0 で BPM 120、tick 3840 で BPM 60、tick 7680 で BPM 240 のとき、tick 0 から 6.25 秒の位置は、tick 8640 になる', () => {
        expect(convertSecondsToTick(bpm120Then60Then240, 6.25)).toBeCloseTo(8640, PRECISION)
      })
    })
  })

  describe('音源の先頭からの経過秒への変換', () => {
    describe('正常系', () => {
      it.each([
        [0, 120, 0.12, bpm120OffsetPlus120],
        [0, -100, -0.1, bpm120OffsetMinus100],
      ])(
        'tick %s は、オフセットが %s ミリ秒でテンポが BPM 120 だけのとき、%s 秒になる',
        (tick, _offsetMs, seconds, projectInfo) => {
          expect(convertTickToAudioSeconds(projectInfo, tick)).toBeCloseTo(seconds, PRECISION)
        },
      )
    })
  })

  describe('音源の先頭からの経過秒から tick への変換', () => {
    describe('正常系', () => {
      it.each([
        [0.62, 120, 960, bpm120OffsetPlus120],
        [0.4, -100, 960, bpm120OffsetMinus100],
      ])(
        '音源の先頭から %s 秒の位置は、オフセットが %s ミリ秒でテンポが BPM 120 だけのとき、tick %s になる',
        (audioSeconds, _offsetMs, tick, projectInfo) => {
          expect(convertAudioSecondsToTick(projectInfo, audioSeconds)).toBeCloseTo(tick, PRECISION)
        },
      )
    })
  })
})

describe('[拍と小節] 拍の tick', () => {
  describe('拍の列挙', () => {
    describe('正常系', () => {
      describe('拍子が 4/4 だけのとき', () => {
        it.each([
          { fromTick: 0, toTick: 3840, result: '0・960・1920・2880 の順になる', ticks: [0, 960, 1920, 2880] },
          { fromTick: 1000, toTick: 3000, result: '1920・2880 の順になる', ticks: [1920, 2880] },
          { fromTick: 0, toTick: 960, result: '0 だけになる', ticks: [0] },
        ])('tick $fromTick 以上 $toTick 未満の拍の tick は、$result', ({ fromTick, toTick, ticks }) => {
          expect(beatTicks(meter44Only, fromTick, toTick)).toEqual(ticks)
        })
      })

      it.each([
        [
          0,
          2880,
          '拍子が 6/8 だけ',
          '0・480・960・1440・1920・2400 の順',
          meter68Only,
          [0, 480, 960, 1440, 1920, 2400],
        ],
        [
          3840,
          5280,
          '拍子が tick 0 で 4/4、tick 3840 で 6/8',
          '3840・4320・4800 の順',
          meter44Then68,
          [3840, 4320, 4800],
        ],
        [
          0,
          5760,
          '拍子が tick 0 で 4/4、tick 1920 で 3/4',
          '0・960・1920・2880・3840・4800 の順',
          meter44Then34At1920,
          [0, 960, 1920, 2880, 3840, 4800],
        ],
      ])(
        'tick %s 以上 %s 未満の拍の tick は、%s のとき、%sになる',
        (fromTick, toTick, _meter, _ticksText, projectInfo, ticks) => {
          expect(beatTicks(projectInfo, fromTick, toTick)).toEqual(ticks)
        },
      )
    })

    describe('異常系', () => {
      it('tick 960 以上 960 未満の拍の数は、拍子が 4/4 だけのとき、0 になる', () => {
        expect(listBeats(meter44Only, 960, 960)).toHaveLength(0)
      })
    })
  })
})

describe('[拍と小節] 拍の小節番号', () => {
  describe('拍の列挙', () => {
    describe('正常系', () => {
      it('tick 0 以上 3840 未満の拍の小節番号は、拍子が 4/4 だけのとき、すべて 1 になる', () => {
        expect(new Set(beatBarNumbers(meter44Only, 0, 3840))).toEqual(new Set([1]))
      })

      it.each([
        [4800, 4900, '拍子が tick 0 で 4/4、tick 1920 で 3/4', 3, meter44Then34At1920],
        [6720, 6820, '拍子が tick 0 で 4/4、tick 3840 で 3/4、tick 6720 で 6/8', 3, meter44Then34Then68],
        [3840, 3940, '拍子が 4/4 だけ', 2, meter44Only],
        [2880, 2980, '拍子が 6/8 だけ', 2, meter68Only],
        [3840, 3940, '拍子が tick 0 で 4/4、tick 3840 で 6/8', 2, meter44Then68],
        [1920, 2020, '拍子が tick 0 で 4/4、tick 1920 で 3/4', 2, meter44Then34At1920],
      ])(
        'tick %s 以上 %s 未満の拍の小節番号は、%s のとき、%s になる',
        (fromTick, toTick, _meter, barNumber, projectInfo) => {
          expect(beatBarNumbers(projectInfo, fromTick, toTick)).toEqual([barNumber])
        },
      )
    })
  })
})

describe('[拍と小節] 拍の小節内の拍番号', () => {
  describe('拍の列挙', () => {
    describe('正常系', () => {
      it.each([
        [0, 3840, '拍子が 4/4 だけ', '0・1・2・3 の順', meter44Only, [0, 1, 2, 3]],
        [3840, 3940, '拍子が 4/4 だけ', '0 だけ', meter44Only, [0]],
        [2880, 2980, '拍子が 6/8 だけ', '0 だけ', meter68Only, [0]],
        [3840, 3940, '拍子が tick 0 で 4/4、tick 3840 で 6/8', '0 だけ', meter44Then68, [0]],
        [1920, 2020, '拍子が tick 0 で 4/4、tick 1920 で 3/4', '0 だけ', meter44Then34At1920, [0]],
        [4800, 4900, '拍子が tick 0 で 4/4、tick 1920 で 3/4', '0 だけ', meter44Then34At1920, [0]],
      ])(
        'tick %s 以上 %s 未満の拍の小節内の拍番号は、%s のとき、%sになる',
        (fromTick, toTick, _meter, _beatsText, projectInfo, beats) => {
          expect(beatsInBar(projectInfo, fromTick, toTick)).toEqual(beats)
        },
      )
    })
  })
})
