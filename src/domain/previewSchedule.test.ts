import { describe, expect, it } from 'vitest'
import { buildClickSchedule, calculateStopTick } from './previewSchedule.ts'
import type { ProjectInfo } from './types.ts'

const PRECISION = 9

function createProjectInfoAt(bpm: number): ProjectInfo {
  return {
    offsetMs: 0,
    tempo: [{ tick: 0, bpm }],
    meter: [{ tick: 0, num: 4, den: 4 }],
  }
}

describe('[プレビューの再生位置の計算] 再生を止めたときの位置', () => {
  describe('正常系', () => {
    it.each<{
      readonly bpm: number
      readonly seconds: number
      readonly expectedTick: number
    }>([
      { bpm: 120, seconds: 1, expectedTick: 1920 },
      { bpm: 120, seconds: 2, expectedTick: 3840 },
      { bpm: 180, seconds: 1, expectedTick: 2880 },
      { bpm: 180, seconds: 2, expectedTick: 5760 },
    ])(
      'BPM $bpm で、拍子が 4/4、オフセットが 0 のとき、1 小節目 1 拍目から再生を始めて経過 $seconds 秒で止めると、再生位置は $expectedTick tick になる',
      ({ bpm, seconds, expectedTick }) => {
        const result = calculateStopTick(createProjectInfoAt(bpm), 0, seconds)

        expect(result).toBeCloseTo(expectedTick, PRECISION)
      },
    )
  })
})

describe('[クリック音を鳴らす時刻の計算] 拍ごとのクリック音の時刻', () => {
  describe('正常系', () => {
    it.each<{
      readonly bpm: number
      readonly expectedSeconds: readonly number[]
      readonly label: string
    }>([
      { bpm: 120, expectedSeconds: [0, 0.5, 1, 1.5], label: '0, 0.5, 1, 1.5' },
      { bpm: 180, expectedSeconds: [0, 1 / 3, 2 / 3, 1], label: '0, 1/3, 2/3, 1' },
    ])(
      'BPM $bpm で、拍子が 4/4、オフセットが 0 のとき、1 小節目 1 拍目から 2 小節目 1 拍目 (3840 tick) まで再生すると、クリック音の時刻は、再生開始から $label 秒の 4 つになる',
      ({ bpm, expectedSeconds }) => {
        const result = buildClickSchedule(createProjectInfoAt(bpm), 0, 3840)

        expect(result).toEqual(expectedSeconds.map((seconds) => expect.closeTo(seconds, PRECISION)))
      },
    )
  })
})
