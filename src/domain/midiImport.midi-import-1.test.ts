import { describe, expect, it } from 'vitest'
import {
  C2,
  C3,
  CSHARP2,
  LANE_0_AND_1,
  LANE_0_ONLY,
  defaultVelocityRanges,
  flickRange,
  importedLanes,
  importedTicks,
  runImport,
  runImportFromMidiFile,
  tapRange,
} from './midiImport.midi-import-1.helpers.ts'

describe('[MIDI 取り込み] タップノーツの判定', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      describe('MIDI の分解能が 480、音程 C2 がレーン 0 に割り当てられ、tick 480 に音程 C2 のノートが 1 つあるとき', () => {
        it.each([
          {
            condition: 'ベロシティが 71、タップノーツの最小ベロシティが 71・最大ベロシティが 127 (初期値) のとき',
            velocityRanges: defaultVelocityRanges(),
            velocity: 71,
            durationTicks: 0,
          },
          {
            condition: 'ベロシティが 127、タップノーツの最小ベロシティが 71・最大ベロシティが 127 (初期値) のとき',
            velocityRanges: defaultVelocityRanges(),
            velocity: 127,
            durationTicks: 0,
          },
          {
            condition: 'ベロシティが 100、タップノーツの最小ベロシティが 1・最大ベロシティが 100 のとき',
            velocityRanges: [tapRange(1, 100)],
            velocity: 100,
            durationTicks: 0,
          },
          {
            condition: 'ベロシティが 50、タップノーツの最小ベロシティが 50・最大ベロシティが 50 のとき',
            velocityRanges: [tapRange(50, 50)],
            velocity: 50,
            durationTicks: 0,
          },
          {
            condition:
              'ベロシティが 51、上フリックノーツの最小ベロシティが 1・最大ベロシティが 50、タップノーツの最小ベロシティが 51・最大ベロシティが 127 のとき',
            velocityRanges: [flickRange(1, 50, 'up'), tapRange(51, 127)],
            velocity: 51,
            durationTicks: 0,
          },
          {
            condition:
              'ベロシティが 80、長さが 960、タップノーツの最小ベロシティが 71・最大ベロシティが 127 (初期値) のとき',
            velocityRanges: defaultVelocityRanges(),
            velocity: 80,
            durationTicks: 960,
          },
        ])(
          '$condition、譜面のノーツは、tick 960・レーン 0 のタップノーツになる',
          ({ velocityRanges, velocity, durationTicks }) => {
            const result = runImport({
              velocityRanges,
              notes: [{ tick: 480, pitch: C2, velocity, durationTicks }],
            })

            expect(result.chart.notes).toMatchObject([{ type: 'tap', tick: 960, lane: 0 }])
          },
        )
      })
    })
  })
})

describe('[MIDI 取り込み] フリックノーツの判定', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      describe('MIDI の分解能が 480、音程 C2 がレーン 0 に割り当てられ、tick 480 に音程 C2 のノートが 1 つあるとき', () => {
        describe('左フリックノーツは最小ベロシティ 1・最大ベロシティ 10、上フリックノーツは最小ベロシティ 11・最大ベロシティ 20、右フリックノーツは最小ベロシティ 21・最大ベロシティ 30 (すべて初期値) のとき', () => {
          it.each([
            {
              condition: 'ベロシティが 11 のとき',
              result: 'tick 960・レーン 0 の上フリックノーツになる',
              velocity: 11,
              durationTicks: 0,
              direction: 'up',
            },
            {
              condition: 'ベロシティが 20 のとき',
              result: 'tick 960・レーン 0 の上フリックノーツになる',
              velocity: 20,
              durationTicks: 0,
              direction: 'up',
            },
            {
              condition: 'ベロシティが 15、長さが 960 のとき',
              result: 'tick 960・レーン 0 の上フリックノーツになる',
              velocity: 15,
              durationTicks: 960,
              direction: 'up',
            },
            {
              condition: 'ベロシティが 1 のとき',
              result: 'tick 960・レーン 0 の左フリックノーツになる',
              velocity: 1,
              durationTicks: 0,
              direction: 'left',
            },
            {
              condition: 'ベロシティが 10 のとき',
              result: 'tick 960・レーン 0 の左フリックノーツになる',
              velocity: 10,
              durationTicks: 0,
              direction: 'left',
            },
            {
              condition: 'ベロシティが 21 のとき',
              result: 'tick 960・レーン 0 の右フリックノーツになる',
              velocity: 21,
              durationTicks: 0,
              direction: 'right',
            },
            {
              condition: 'ベロシティが 30 のとき',
              result: 'tick 960・レーン 0 の右フリックノーツになる',
              velocity: 30,
              durationTicks: 0,
              direction: 'right',
            },
          ])('$condition、譜面のノーツは、$result', ({ velocity, durationTicks, direction }) => {
            const result = runImport({ notes: [{ tick: 480, pitch: C2, velocity, durationTicks }] })

            expect(result.chart.notes).toMatchObject([{ type: 'flick', tick: 960, lane: 0, direction }])
          })
        })

        it('ベロシティが 50、上フリックノーツの最小ベロシティが 1・最大ベロシティが 50、タップノーツの最小ベロシティが 51・最大ベロシティが 127 のとき、譜面のノーツは、tick 960・レーン 0 の上フリックノーツになる', () => {
          const result = runImport({
            velocityRanges: [flickRange(1, 50, 'up'), tapRange(51, 127)],
            notes: [{ tick: 480, pitch: C2, velocity: 50, durationTicks: 0 }],
          })

          expect(result.chart.notes).toMatchObject([{ type: 'flick', tick: 960, lane: 0, direction: 'up' }])
        })
      })
    })
  })
})

const LONG_AT_960_TO_1920 = '始点が tick 960・レーン 0、終端が tick 1920・レーン 0 の'

describe('[MIDI 取り込み] ロングノーツの終端フリックの判定', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      describe('MIDI の分解能が 480、音程 C2 がレーン 0 に割り当てられ、tick 480 に長さ 480 の音程 C2 のノートが 1 つあるとき', () => {
        describe('終端フリックがないロングノーツは最小ベロシティ 31・最大ベロシティ 40、左の終端フリックがあるロングノーツは最小ベロシティ 41・最大ベロシティ 50、上の終端フリックがあるロングノーツは最小ベロシティ 51・最大ベロシティ 60、右の終端フリックがあるロングノーツは最小ベロシティ 61・最大ベロシティ 70 (すべて初期値) のとき', () => {
          it.each([
            {
              velocity: 31,
              result: `${LONG_AT_960_TO_1920}終端フリックがないロングノーツになる`,
              end: { kind: 'release' },
            },
            {
              velocity: 40,
              result: `${LONG_AT_960_TO_1920}終端フリックがないロングノーツになる`,
              end: { kind: 'release' },
            },
            {
              velocity: 41,
              result: `${LONG_AT_960_TO_1920}左の終端フリックがあるロングノーツになる`,
              end: { kind: 'flick', direction: 'left' },
            },
            {
              velocity: 50,
              result: `${LONG_AT_960_TO_1920}左の終端フリックがあるロングノーツになる`,
              end: { kind: 'flick', direction: 'left' },
            },
            {
              velocity: 51,
              result: `${LONG_AT_960_TO_1920}上の終端フリックがあるロングノーツになる`,
              end: { kind: 'flick', direction: 'up' },
            },
            {
              velocity: 60,
              result: `${LONG_AT_960_TO_1920}上の終端フリックがあるロングノーツになる`,
              end: { kind: 'flick', direction: 'up' },
            },
            {
              velocity: 61,
              result: `${LONG_AT_960_TO_1920}右の終端フリックがあるロングノーツになる`,
              end: { kind: 'flick', direction: 'right' },
            },
            {
              velocity: 70,
              result: `${LONG_AT_960_TO_1920}右の終端フリックがあるロングノーツになる`,
              end: { kind: 'flick', direction: 'right' },
            },
          ])('ベロシティが $velocity のとき、譜面のノーツは、$result', ({ velocity, end }) => {
            const result = runImport({ notes: [{ tick: 480, pitch: C2, velocity, durationTicks: 480 }] })

            expect(result.chart.notes).toMatchObject([
              { type: 'long', tick: 960, lane: 0, path: [{ tick: 1920, lane: 0 }], end },
            ])
          })
        })
      })
    })
  })
})

describe('[MIDI 取り込み] ロングノーツの長さ', () => {
  describe('MIDI の取り込み', () => {
    describe('MIDI の分解能が 480、終端フリックがないロングノーツの最小ベロシティが 31・最大ベロシティが 40、タップノーツの最小ベロシティが 71・最大ベロシティが 127 (どちらも初期値) のとき', () => {
      describe('正常系', () => {
        it('ベロシティが 35 で、MIDI の tick が 480、長さが 960 のとき、MIDI を取り込むと、譜面のロングノーツの終端の tick は 2880 になる', () => {
          const result = runImport({ notes: [{ tick: 480, pitch: C2, velocity: 35, durationTicks: 960 }] })

          expect(result.chart.notes).toMatchObject([{ type: 'long', path: [{ tick: 2880 }] }])
        })
      })

      describe('異常系', () => {
        it('ベロシティが 35・長さが 0 のとき、MIDI を取り込むと、譜面のノーツは 0 個になり、取り込めないノートは、tick 960・レーン 0 の「長さが 0 のロングノーツ」の 1 件だけになる', () => {
          const result = runImport({ notes: [{ tick: 480, pitch: C2, velocity: 35, durationTicks: 0 }] })

          expect(result.chart.notes).toHaveLength(0)
          expect(result.warnings).toEqual([{ reason: 'zero-length-long', tick: 960, lane: 0 }])
        })

        it('音程 C#2 をレーン 1 に割り当て、同じ tick に、長さ 0 でベロシティ 35 の音程 C2 のノートと、ベロシティ 80 の音程 C#2 のノートがあるとき、MIDI を取り込むと、譜面のノーツは、レーン 1 のタップノーツだけになる', () => {
          const result = runImport({
            pitchToLane: LANE_0_AND_1,
            ticksPerQuarter: 480,
            notes: [
              { tick: 480, pitch: C2, velocity: 35, durationTicks: 0 },
              { tick: 480, pitch: CSHARP2, velocity: 80 },
            ],
          })

          expect(result.chart.notes).toMatchObject([{ type: 'tap', tick: 960, lane: 1 }])
        })
      })
    })
  })
})

describe('[MIDI 取り込み] ノーツの種類の判定', () => {
  describe('MIDI の取り込み', () => {
    describe('異常系', () => {
      describe('ベロシティが、どの最小ベロシティ・最大ベロシティにも入らないとき', () => {
        it.each([
          {
            condition: 'ベロシティが 1、タップノーツの最小ベロシティが 2・最大ベロシティが 127 のとき',
            velocityRanges: [tapRange(2, 127)],
            velocity: 1,
          },
          {
            condition: 'ベロシティが 101、タップノーツの最小ベロシティが 1・最大ベロシティが 100 のとき',
            velocityRanges: [tapRange(1, 100)],
            velocity: 101,
          },
        ])(
          '$condition、譜面のノーツは 0 個になり、取り込めないノートは、tick 960・レーン 0 の「ベロシティが範囲外」の 1 件だけになる',
          ({ velocityRanges, velocity }) => {
            const result = runImport({ velocityRanges, notes: [{ tick: 480, pitch: C2, velocity }] })

            expect(result.chart.notes).toHaveLength(0)
            expect(result.warnings).toEqual([{ reason: 'velocity-out-of-range', tick: 960, lane: 0 }])
          },
        )

        describe('タップノーツの最小ベロシティが 1・最大ベロシティが 50 と、タップノーツの最小ベロシティが 60・最大ベロシティが 127 のとき', () => {
          it.each([{ velocity: 51 }, { velocity: 59 }])(
            'ベロシティが $velocity のとき、譜面のノーツは 0 個になり、取り込めないノートは、tick 960・レーン 0 の「ベロシティが範囲外」の 1 件だけになる',
            ({ velocity }) => {
              const result = runImport({
                velocityRanges: [tapRange(1, 50), tapRange(60, 127)],
                notes: [{ tick: 480, pitch: C2, velocity }],
              })

              expect(result.chart.notes).toHaveLength(0)
              expect(result.warnings).toEqual([{ reason: 'velocity-out-of-range', tick: 960, lane: 0 }])
            },
          )
        })
      })

      it('MIDI の分解能が 480、タップノーツの最小ベロシティが 2・最大ベロシティが 127 で、MIDI の tick 0 のベロシティ 1 と tick 480 のベロシティ 80 のノートがあるとき、MIDI を取り込むと、譜面のノーツは、tick 960 のタップノーツだけになる', () => {
        const result = runImport({
          velocityRanges: [tapRange(2, 127)],
          notes: [
            { tick: 0, pitch: C2, velocity: 1 },
            { tick: 480, pitch: C2, velocity: 80 },
          ],
        })

        expect(result.chart.notes).toMatchObject([{ type: 'tap', tick: 960, lane: 0 }])
      })
    })
  })
})

describe('[MIDI 取り込み] 最小ベロシティと最大ベロシティの指定', () => {
  describe('MIDI の取り込み', () => {
    describe('異常系', () => {
      it('最小ベロシティ 1・最大ベロシティ 50 の指定と、最小ベロシティ 50・最大ベロシティ 127 の指定があるとき、エラーになり、メッセージに「ベロシティの範囲 1〜50 と 50〜127 が重なっています」を含む', () => {
        expect(() =>
          runImport({
            velocityRanges: [tapRange(1, 50), flickRange(50, 127, 'up')],
            pitchToLane: LANE_0_ONLY,
            notes: [{ tick: 480, pitch: C2, velocity: 80 }],
          }),
        ).toThrow('ベロシティの範囲 1〜50 と 50〜127 が重なっています')
      })

      it.each([
        {
          min: 51,
          max: 50,
          message: 'ベロシティの範囲 51〜50 は 1〜127 の範囲で、最小が最大以下になるようにしてください',
        },
        {
          min: 0,
          max: 127,
          message: 'ベロシティの範囲 0〜127 は 1〜127 の範囲で、最小が最大以下になるようにしてください',
        },
        {
          min: 1,
          max: 128,
          message: 'ベロシティの範囲 1〜128 は 1〜127 の範囲で、最小が最大以下になるようにしてください',
        },
      ])(
        '最小ベロシティが $min、最大ベロシティが $max のとき、エラーになり、メッセージに「ベロシティの範囲 $min〜$max は 1〜127 の範囲で、最小が最大以下になるようにしてください」を含む',
        ({ min, max, message }) => {
          expect(() =>
            runImport({
              velocityRanges: [tapRange(min, max)],
              notes: [{ tick: 480, pitch: C2, velocity: 80 }],
            }),
          ).toThrow(message)
        },
      )
    })
  })
})

describe('[MIDI 取り込み] 分解能による tick の換算', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      it.each([
        { ticksPerQuarter: 480, tick: 480, expected: 960 },
        { ticksPerQuarter: 960, tick: 480, expected: 480 },
      ])(
        '分解能が $ticksPerQuarter で、MIDI の tick が $tick のとき、譜面のタップノーツの tick は $expected になる',
        ({ ticksPerQuarter, tick, expected }) => {
          const result = runImport({ ticksPerQuarter, notes: [{ tick, pitch: C2, velocity: 80 }] })

          expect(importedTicks(result)).toEqual([expected])
        },
      )
    })
  })
})

describe('[MIDI 取り込み] ノーツの並び順', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      it('MIDI の分解能が 480 で、MIDI の tick が 960・480・0 の順に並ぶとき、MIDI を取り込むと、譜面のノーツは、tick 0・tick 960・tick 1920 の順になる', () => {
        const result = runImport({
          ticksPerQuarter: 480,
          notes: [
            { tick: 960, pitch: C2, velocity: 80 },
            { tick: 480, pitch: C2, velocity: 80 },
            { tick: 0, pitch: C2, velocity: 80 },
          ],
        })

        expect(importedTicks(result)).toEqual([0, 960, 1920])
      })

      it('音程 C#2 をレーン 1 に割り当て、同じ tick に音程 C#2 と C2 の順に並ぶノートがあるとき、MIDI を取り込むと、譜面のノーツは、レーン 0・レーン 1 の順になる', () => {
        const result = runImport({
          pitchToLane: LANE_0_AND_1,
          notes: [
            { tick: 0, pitch: CSHARP2, velocity: 80 },
            { tick: 0, pitch: C2, velocity: 80 },
          ],
        })

        expect(importedLanes(result)).toEqual([0, 1])
      })
    })
  })
})

describe('[MIDI 取り込み] 音程とレーンの対応', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      it.each([
        {
          condition: 'ノートの音程が C2 で、音程 C2 をレーン 0、音程 C#2 をレーン 1 に割り当てているとき',
          lane: 0,
          pitchToLane: LANE_0_AND_1,
          laneCount: 5,
          pitch: C2,
        },
        {
          condition: 'ノートの音程が C3 で、音程 C3 をレーン 4 に割り当て、レーン数が 5 のとき',
          lane: 4,
          pitchToLane: new Map([[C3, 4]]),
          laneCount: 5,
          pitch: C3,
        },
      ])('$condition、譜面のノーツのレーンは $lane になる', ({ lane, pitchToLane, laneCount, pitch }) => {
        const result = runImport({ pitchToLane, laneCount, notes: [{ tick: 480, pitch, velocity: 80 }] })

        expect(importedLanes(result)).toEqual([lane])
      })
    })

    describe('異常系', () => {
      it('ノートの音程 C3 が、レーンに割り当てた音程 C2・C#2 にないとき、MIDI を取り込むと、譜面のノーツは 0 個になる', () => {
        const result = runImport({
          pitchToLane: LANE_0_AND_1,
          notes: [{ tick: 480, pitch: C3, velocity: 80 }],
        })

        expect(result.chart.notes).toHaveLength(0)
      })
    })
  })
})

describe('[MIDI 取り込み] 重複したノート', () => {
  describe('異常系', () => {
    it('MIDI の分解能が 480 で、MIDI の tick 480 に、トラック 1 のベロシティ 80 と、トラック 2 のベロシティ 15 の、音程 C2 のノートがあるとき、MIDI を取り込むと、譜面のノーツは、tick 960・レーン 0 のタップノーツだけになり、取り込めないノートは、tick 960・レーン 0 の「位置の重複」の 1 件だけになる', () => {
      const result = runImportFromMidiFile({
        ticksPerQuarter: 480,
        notes: [
          { tick: 480, pitch: 'C2', velocity: 80, durationTicks: 0, track: 0 },
          { tick: 480, pitch: 'C2', velocity: 15, durationTicks: 0, track: 1 },
        ],
      })

      expect(result.chart.notes).toMatchObject([{ type: 'tap', tick: 960, lane: 0 }])
      expect(result.warnings).toEqual([{ reason: 'duplicate-position', tick: 960, lane: 0 }])
    })
  })
})

describe('[MIDI 取り込み] 取り込んだ譜面のノーツの数', () => {
  describe('正常系', () => {
    it('ノートが 1 つもない MIDI のとき、MIDI を取り込むと、譜面のノーツは 0 個になる', () => {
      const result = runImport({ notes: [] })

      expect(result.chart.notes).toHaveLength(0)
    })
  })
})

describe('[MIDI 取り込み] テンポの取り込み', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      describe('MIDI の分解能が 480 のとき', () => {
        it.each([
          {
            given: 'テンポが 1 つもないとき',
            result: 'tick 0 で BPM 120 だけになる',
            tempos: [],
            expected: [{ tick: 0, bpm: 120 }],
          },
          {
            given:
              'テンポが MIDI の tick 1920 で 4 分音符 1 つあたり 1000000 マイクロ秒、tick 0 で 4 分音符 1 つあたり 500000 マイクロ秒の順に並ぶとき',
            result: 'tick 0 の BPM 120、tick 3840 の BPM 60 の順になる',
            tempos: [
              { tick: 1920, microsecondsPerQuarter: 1000000 },
              { tick: 0, microsecondsPerQuarter: 500000 },
            ],
            expected: [
              { tick: 0, bpm: 120 },
              { tick: 3840, bpm: 60 },
            ],
          },
          {
            given: 'テンポが MIDI の tick 0 で 4 分音符 1 つあたり 3000000 マイクロ秒だけのとき',
            result: 'tick 0 で BPM 20 だけになる',
            tempos: [{ tick: 0, microsecondsPerQuarter: 3000000 }],
            expected: [{ tick: 0, bpm: 20 }],
          },
          {
            given: 'テンポが MIDI の tick 0 で 4 分音符 1 つあたり 200000 マイクロ秒だけのとき',
            result: 'tick 0 で BPM 300 だけになる',
            tempos: [{ tick: 0, microsecondsPerQuarter: 200000 }],
            expected: [{ tick: 0, bpm: 300 }],
          },
          {
            given: 'テンポが MIDI の tick 480 で 4 分音符 1 つあたり 1000000 マイクロ秒だけのとき',
            result: 'tick 0 の BPM 120、tick 960 の BPM 60 の順になる',
            tempos: [{ tick: 480, microsecondsPerQuarter: 1000000 }],
            expected: [
              { tick: 0, bpm: 120 },
              { tick: 960, bpm: 60 },
            ],
          },
        ])('$given、テンポは $result', ({ tempos, expected }) => {
          const result = runImport({ ticksPerQuarter: 480, tempos })

          expect(result.projectInfo.tempo).toEqual(expected)
        })
      })
    })

    describe('異常系', () => {
      it('MIDI の tick 0 に 4 分音符 1 つあたり 500000 マイクロ秒と 1000000 マイクロ秒のテンポがこの順に並ぶとき、MIDI を取り込むと、テンポは tick 0 で BPM 60 だけになる', () => {
        const result = runImport({
          tempos: [
            { tick: 0, microsecondsPerQuarter: 500000 },
            { tick: 0, microsecondsPerQuarter: 1000000 },
          ],
        })

        expect(result.projectInfo.tempo).toEqual([{ tick: 0, bpm: 60 }])
      })
    })
  })
})

describe('[MIDI 取り込み] 拍子の取り込み', () => {
  describe('MIDI の取り込み', () => {
    describe('正常系', () => {
      describe('MIDI の分解能が 480 のとき', () => {
        it.each([
          {
            given: '拍子が MIDI の tick 1920 で 3/4、tick 0 で 4/4 の順に並ぶとき',
            result: 'tick 0 の 4/4、tick 3840 の 3/4 の順になる',
            timeSignatures: [
              { tick: 1920, num: 3, den: 4 },
              { tick: 0, num: 4, den: 4 },
            ],
            expected: [
              { tick: 0, num: 4, den: 4 },
              { tick: 3840, num: 3, den: 4 },
            ],
          },
          {
            given: '拍子が 1 つもないとき',
            result: 'tick 0 で 4/4 だけになる',
            timeSignatures: [],
            expected: [{ tick: 0, num: 4, den: 4 }],
          },
          {
            given: '拍子が MIDI の tick 480 で 3/4 だけのとき',
            result: 'tick 0 の 4/4、tick 960 の 3/4 の順になる',
            timeSignatures: [{ tick: 480, num: 3, den: 4 }],
            expected: [
              { tick: 0, num: 4, den: 4 },
              { tick: 960, num: 3, den: 4 },
            ],
          },
        ])('$given、拍子は $result', ({ timeSignatures, expected }) => {
          const result = runImport({ ticksPerQuarter: 480, timeSignatures })

          expect(result.projectInfo.meter).toEqual(expected)
        })
      })
    })

    describe('異常系', () => {
      it('MIDI の tick 0 に 3/4 と 6/8 の拍子がこの順に並ぶとき、MIDI を取り込むと、拍子は tick 0 で 6/8 だけになる', () => {
        const result = runImport({
          timeSignatures: [
            { tick: 0, num: 3, den: 4 },
            { tick: 0, num: 6, den: 8 },
          ],
        })

        expect(result.projectInfo.meter).toEqual([{ tick: 0, num: 6, den: 8 }])
      })
    })
  })
})

describe('[MIDI 取り込み] 取り込むノーツの個数の上限', () => {
  const notesAtDistinctTicks = (count: number) =>
    Array.from({ length: count }, (_unused, index) => ({ tick: index, pitch: C2, velocity: 100 }))

  describe('正常系', () => {
    it('取り込めるノートが 3000 個の MIDI のとき、MIDI を取り込むと、譜面のノーツは 3000 個になる', () => {
      const result = runImport({ notes: notesAtDistinctTicks(3000) })

      expect(result.chart.notes).toHaveLength(3000)
    })
  })

  describe('異常系', () => {
    it('取り込めるノートが 3001 個の MIDI のとき、MIDI を取り込むと、エラーになり、メッセージに「取り込むノーツが 3001 個あり、上限の 3000 個を超えます。ベロシティの範囲や音程の割り当てを見直して、ノーツを減らしてから、もう一度確認してください」を含む', () => {
      expect(() => runImport({ notes: notesAtDistinctTicks(3001) })).toThrow(
        '取り込むノーツが 3001 個あり、上限の 3000 個を超えます。ベロシティの範囲や音程の割り当てを見直して、ノーツを減らしてから、もう一度確認してください',
      )
    })
  })
})
