import { describe, expect, it } from 'vitest'
import { convertTickToAudioSeconds, convertTickToSeconds, listBeats } from '../../domain/projectInfo.ts'
import type { LongNote, ProjectInfo } from '../../domain/types.ts'
import { parseChartJson } from './chartFormat.ts'

const parse = (json: unknown) => {
  let count = 0
  return parseChartJson(json, () => `id-${count++}`)
}

const parseLongNote = (json: unknown) => {
  return parse(json).chart.notes[0] as LongNote
}

const expectParseError = (json: unknown, message: string) => {
  expect(() => parse(json)).toThrow(message)
}

const validChart = (): Record<string, unknown> => ({
  formatVersion: 1,
  offsetMs: 0,
  laneCount: 5,
  tempo: [{ tick: 0, bpm: 120 }],
  meter: [{ tick: 0, num: 4, den: 4 }],
  notes: [],
})
const chartWith = (overrides: Record<string, unknown>) => ({ ...validChart(), ...overrides })
const chartWithout = (key: string) => Object.fromEntries(Object.entries(validChart()).filter(([name]) => name !== key))
const chartOf = (notes: unknown, laneCount: unknown = 5) => chartWith({ notes, laneCount })
const tempoWith = (change: Record<string, unknown>) => chartWith({ tempo: [change] })
const meterWith = (change: Record<string, unknown>) => chartWith({ meter: [change] })
const beatTicks = (projectInfo: ProjectInfo, fromTick: number, toTick: number) =>
  listBeats(projectInfo, fromTick, toTick).map((beat) => beat.tick)
const tapsAtTicks0To = (lastTick: number) => Array.from({ length: lastTick + 1 }, (_unused, tick) => tap(tick, 0))
const tap = (tick: number, lane: number) => ({ type: 'tap', tick, lane })
const flick = (tick: number, lane: number, dir: unknown) => ({ type: 'flick', tick, lane, dir })
const long = (
  tick: number,
  lane: number,
  path: readonly { tick: number; lane: number }[],
  end: unknown = 'release',
) => ({ type: 'long', tick, lane, path, end })

const longWithRightFlickEnd = chartOf([
  long(
    2880,
    1,
    [
      { tick: 3360, lane: 3 },
      { tick: 3840, lane: 0 },
    ],
    { flick: 'right' },
  ),
])
const longWithReleaseEnd = chartOf([
  long(
    0,
    0,
    [
      { tick: 480, lane: 2 },
      { tick: 960, lane: 1 },
      { tick: 1440, lane: 0 },
    ],
    'release',
  ),
])
const validLong = long(0, 0, [{ tick: 480, lane: 0 }], 'release')

const BROKEN_FILE_SUFFIX = 'が検出できませんでした。ファイルが破損している可能性があります'
const INVALID_END_MESSAGE = '1 つ目のノーツの終端は "release" または { "flick": 方向 } にしてください'

describe('[譜面ファイル読み込み] ノーツの種類', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      it.each([
        {
          given: 'tick 0・レーン 1 のタップノーツだけのとき',
          result: 'tick 0・レーン 1 のタップノーツだけになる',
          json: chartOf([tap(0, 1)]),
          expected: [{ type: 'tap', tick: 0, lane: 1 }],
        },
        {
          given: 'tick 480・レーン 2 の向き "up" のフリックノーツだけのとき',
          result: 'tick 480・レーン 2 の上フリックノーツだけになる',
          json: chartOf([flick(480, 2, 'up')]),
          expected: [{ type: 'flick', tick: 480, lane: 2, direction: 'up' }],
        },
        {
          given: '始点が tick 960・レーン 1、終端が tick 1920・レーン 1 で "release" のロングノーツだけのとき',
          result: '始点が tick 960・レーン 1、終端が tick 1920・レーン 1 のロングノーツだけになる',
          json: chartOf([long(960, 1, [{ tick: 1920, lane: 1 }], 'release')]),
          expected: [{ type: 'long', tick: 960, lane: 1, path: [{ tick: 1920, lane: 1 }] }],
        },
      ])('$given、得られる譜面のノーツは、$result', ({ json, expected }) => {
        const { chart } = parse(json)

        expect(chart.notes).toMatchObject(expected)
      })
    })

    describe('異常系', () => {
      it.each([
        [
          'ノーツの種類が "hold" のとき',
          '1 つ目のノーツの種類は tap / flick / long のいずれかにしてください: hold',
          chartOf([{ type: 'hold', tick: 0, lane: 0 }]),
        ],
        ['ノーツの種類がないとき', `1 つ目のノーツの種類${BROKEN_FILE_SUFFIX}`, chartOf([{ tick: 0, lane: 0 }])],
        ['ノーツの 1 つ目の要素が数値 1 のとき', `1 つ目のノーツ${BROKEN_FILE_SUFFIX}`, chartOf([1])],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] フリックノーツの向き', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      it.each([
        { direction: 'left', result: '左フリックノーツになる' },
        { direction: 'right', result: '右フリックノーツになる' },
      ])('フリックノーツの向きが "$direction" のとき、得られるフリックノーツは、$result', ({ direction }) => {
        const { chart } = parse(chartOf([flick(480, 2, direction)]))

        expect(chart.notes).toMatchObject([{ type: 'flick', direction }])
      })
    })

    describe('異常系', () => {
      it.each([
        [
          'フリックノーツの向きがないとき',
          `1 つ目のノーツの向き${BROKEN_FILE_SUFFIX}`,
          chartOf([{ type: 'flick', tick: 0, lane: 0 }]),
        ],
        [
          'フリックノーツの向きが "down" のとき',
          '1 つ目のノーツの向きは up / left / right のいずれかにしてください',
          chartOf([flick(0, 0, 'down')]),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] ロングノーツの終端', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      it.each([
        [
          '終端が "release" のとき',
          '得られるロングノーツは、終端フリックがないロングノーツになる',
          'release',
          { kind: 'release' },
        ],
        [
          '終端が { "flick": "right" } のとき',
          '得られるロングノーツの終端フリックは、右になる',
          { flick: 'right' },
          { kind: 'flick', direction: 'right' },
        ],
      ])('%s、%s', (_when, _result, end, expected) => {
        const note = parseLongNote(chartOf([long(960, 1, [{ tick: 1920, lane: 1 }], end)]))

        expect(note.end).toEqual(expected)
      })
    })

    describe('異常系', () => {
      it.each([
        ['ロングノーツの終端が "hold" のとき', INVALID_END_MESSAGE, chartOf([{ ...validLong, end: 'hold' }])],
        ['ロングノーツの終端が null のとき', INVALID_END_MESSAGE, chartOf([{ ...validLong, end: null }])],
        ['ロングノーツの終端が空の配列のとき', INVALID_END_MESSAGE, chartOf([{ ...validLong, end: [] }])],
        [
          'ロングノーツの終端が { "flick": "down" } のとき',
          '1 つ目のノーツの終端フリックの向きは up / left / right のいずれかにしてください',
          chartOf([{ ...validLong, end: { flick: 'down' } }]),
        ],
        [
          'ロングノーツの終端が { } のとき',
          `1 つ目のノーツの終端フリックの向き${BROKEN_FILE_SUFFIX}`,
          chartOf([{ ...validLong, end: {} }]),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] ロングノーツの始点・続く点・終端', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      describe('続く点が tick 3360・レーン 3、tick 3840・レーン 0 の順のロングノーツのとき', () => {
        it('得られるチェックポイントは、tick 3360・レーン 3 の 1 つだけになる', () => {
          const note = parseLongNote(longWithRightFlickEnd)

          expect(note.path.slice(0, -1)).toMatchObject([{ tick: 3360, lane: 3 }])
        })

        it('得られる終端は、tick 3840・レーン 0 になる', () => {
          const note = parseLongNote(longWithRightFlickEnd)

          expect(note.path.at(-1)).toMatchObject({ tick: 3840, lane: 0 })
        })
      })

      describe('始点が tick 0・レーン 0 で、続く点が tick 480・レーン 2、tick 960・レーン 1、tick 1440・レーン 0 の順のロングノーツのとき', () => {
        it('得られる始点は、tick 0・レーン 0 になる', () => {
          const note = parseLongNote(longWithReleaseEnd)

          expect(note).toMatchObject({ tick: 0, lane: 0 })
        })

        it('得られるチェックポイントは、tick 480・レーン 2、tick 960・レーン 1 の順になる', () => {
          const note = parseLongNote(longWithReleaseEnd)

          expect(note.path.slice(0, -1)).toMatchObject([
            { tick: 480, lane: 2 },
            { tick: 960, lane: 1 },
          ])
        })
      })
    })

    describe('異常系', () => {
      it.each([
        [
          'ロングノーツの続く点がないとき',
          `1 つ目のノーツの続く点${BROKEN_FILE_SUFFIX}`,
          chartOf([{ type: 'long', tick: 0, lane: 0, end: 'release' }]),
        ],
        [
          'ロングノーツの続く点が空の配列のとき',
          '1 つ目のノーツの続く点は 1 点以上にしてください',
          chartOf([long(0, 0, [], 'release')]),
        ],
        [
          'ロングノーツの続く点の 1 つ目の要素が数値 1 のとき',
          `1 つ目のノーツの 1 つ目の続く点${BROKEN_FILE_SUFFIX}`,
          chartOf([{ type: 'long', tick: 0, lane: 0, path: [1], end: 'release' }]),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] ロングノーツの点の tick の順序', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      describe('始点が tick 960・レーン 1 のロングノーツのとき', () => {
        it.each([
          {
            given: '続く点が tick 1440・tick 1920 の順のとき',
            json: chartOf([
              long(
                960,
                1,
                [
                  { tick: 1440, lane: 2 },
                  { tick: 1920, lane: 3 },
                ],
                'release',
              ),
            ]),
          },
          {
            given: '続く点の先頭の tick が 961 のとき',
            json: chartOf([long(960, 1, [{ tick: 961, lane: 2 }], 'release')]),
          },
        ])('$given、得られる譜面のノーツは、ロングノーツ 1 つだけになる', ({ json }) => {
          const { chart } = parse(json)

          expect(chart.notes).toMatchObject([{ type: 'long' }])
        })
      })
    })

    describe('異常系', () => {
      describe('始点が tick 960・レーン 1 のロングノーツのとき', () => {
        it.each([
          {
            given: '続く点が tick 1920・tick 1920 の順のとき',
            message: '1 つ目のノーツの点は、前の点より後の位置にしてください',
            json: chartOf([
              long(
                960,
                1,
                [
                  { tick: 1920, lane: 2 },
                  { tick: 1920, lane: 3 },
                ],
                'release',
              ),
            ]),
          },
          {
            given: '続く点の先頭の tick が 960 のとき',
            message: '1 つ目のノーツの点は、前の点より後の位置にしてください',
            json: chartOf([long(960, 1, [{ tick: 960, lane: 2 }], 'release')]),
          },
          {
            given: 'tick 0・レーン 0 のタップノーツの次にあり、続く点が tick 1920・tick 1440 の順のとき',
            message: '2 つ目のノーツの点は、前の点より後の位置にしてください',
            json: chartOf([
              tap(0, 0),
              long(
                960,
                1,
                [
                  { tick: 1920, lane: 1 },
                  { tick: 1440, lane: 1 },
                ],
                'release',
              ),
            ]),
          },
          {
            given:
              'tick 960 のタップノーツの次に、始点が tick 0 で続く点が tick 1920・tick 1440 の順のロングノーツがあるとき',
            message: '2 つ目のノーツの点は、前の点より後の位置にしてください',
            json: chartOf([
              tap(960, 0),
              long(
                0,
                1,
                [
                  { tick: 1920, lane: 1 },
                  { tick: 1440, lane: 1 },
                ],
                'release',
              ),
            ]),
          },
        ])('$given、エラーメッセージに「$message」を含む', ({ json, message }) => {
          expectParseError(json, message)
        })
      })
    })
  })
})

describe('[譜面ファイル読み込み] ノーツの並び順', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      it('ノーツが tick 2880・tick 0・tick 960 の順のとき、得られる譜面のノーツは、tick 0・tick 960・tick 2880 の順になる', () => {
        const { chart } = parse(chartOf([tap(2880, 0), tap(0, 0), tap(960, 0)]))

        expect(chart.notes.map((note) => note.tick)).toEqual([0, 960, 2880])
      })

      it('tick 0 のノーツがレーン 3・レーン 1 の順に並ぶとき、得られる譜面のノーツは、レーン 1・レーン 3 の順になる', () => {
        const { chart } = parse(chartOf([tap(0, 3), tap(0, 1)]))

        expect(chart.notes.map((note) => note.lane)).toEqual([1, 3])
      })
    })
  })
})

describe('[譜面ファイル読み込み] ノーツの数', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      it.each([
        ['ノーツが空の配列のとき', 0, chartOf([])],
        ['tick 0 のタップノーツがレーン 0 と 1 に 1 つずつあるとき', 2, chartOf([tap(0, 0), tap(0, 1)])],
        ['レーン 0 のタップノーツが tick 0 と 480 に 1 つずつあるとき', 2, chartOf([tap(0, 0), tap(480, 0)])],
        [
          'tick 480・レーン 1 のタップノーツと、終端が同じ tick 480・レーン 1 のロングノーツがあるとき',
          2,
          chartOf([tap(480, 1), long(0, 0, [{ tick: 480, lane: 1 }], 'release')]),
        ],
      ])('%s、得られる譜面のノーツの数は、%s になる', (_when, count, json) => {
        const { chart } = parse(json)

        expect(chart.notes).toHaveLength(count)
      })
    })
  })
})

describe('[譜面ファイル読み込み] 同じ位置のノーツ', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('異常系', () => {
      it.each([
        [
          'tick 0・レーン 0 のタップノーツと、tick 0・レーン 0 から始まるロングノーツがあるとき',
          '1 つ目のノーツと同じ位置にノーツがあります',
          chartOf([tap(0, 0), long(0, 0, [{ tick: 480, lane: 0 }], 'release')]),
        ],
        [
          'tick 0・レーン 0 のタップノーツの次に、tick 480・レーン 1 のタップノーツが 2 つあるとき',
          '2 つ目のノーツと同じ位置にノーツがあります',
          chartOf([tap(0, 0), tap(480, 1), tap(480, 1)]),
        ],
        [
          'tick 960・レーン 0 のタップノーツの次に、tick 480・レーン 1 のタップノーツが 2 つあるとき',
          '2 つ目のノーツと同じ位置にノーツがあります',
          chartOf([tap(960, 0), tap(480, 1), tap(480, 1)]),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] ノーツの tick', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('異常系', () => {
      it.each([
        ['タップノーツの tick が 1.5 のとき', '1 つ目のノーツの位置は整数にしてください', chartOf([tap(1.5, 0)])],
        [
          'ロングノーツの続く点の tick が 1.5 のとき',
          '1 つ目のノーツの 1 つ目の続く点の位置は整数にしてください',
          chartOf([long(0, 0, [{ tick: 1.5, lane: 0 }], 'release')]),
        ],
        ['タップノーツの tick が -1 のとき', '1 つ目のノーツの位置は先頭以降にしてください', chartOf([tap(-1, 0)])],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] ノーツのレーン', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      it('レーンが 0 のタップノーツのとき、得られる譜面のノーツは、レーン 0 のタップノーツだけになる', () => {
        const { chart } = parse(chartOf([tap(0, 0)]))

        expect(chart.notes).toMatchObject([{ type: 'tap', lane: 0 }])
      })

      describe('レーン数が 3 のとき', () => {
        it('レーンが 2 のタップノーツのとき、得られる譜面のノーツは、レーン 2 のタップノーツだけになる', () => {
          const { chart } = parse(chartOf([tap(0, 2)], 3))

          expect(chart.notes).toMatchObject([{ type: 'tap', lane: 2 }])
        })

        it('ロングノーツの続く点のレーンが 2 のとき、得られる終端は、レーン 2 になる', () => {
          const note = parseLongNote(chartOf([long(0, 0, [{ tick: 480, lane: 2 }], 'release')], 3))

          expect(note.path.at(-1)).toMatchObject({ lane: 2 })
        })
      })
    })

    describe('異常系', () => {
      it.each([
        ['タップノーツのレーンが 1.5 のとき', '1 つ目のノーツのレーンは整数にしてください', chartOf([tap(0, 1.5)])],
        [
          'ロングノーツの続く点のレーンが 1.5 のとき',
          '1 つ目のノーツの 1 つ目の続く点のレーンは整数にしてください',
          chartOf([long(0, 0, [{ tick: 480, lane: 1.5 }], 'release')]),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })

      describe('レーン数が 3 のとき', () => {
        it.each([
          [
            'ロングノーツの続く点のレーンが 3 のとき',
            '1 つ目のノーツの 1 つ目の続く点のレーンは 2 以下にしてください: 3',
            chartOf([long(0, 0, [{ tick: 480, lane: 3 }], 'release')], 3),
          ],
          [
            'タップノーツのレーンが 3 のとき',
            '1 つ目のノーツのレーンは 2 以下にしてください: 3',
            chartOf([tap(0, 3)], 3),
          ],
        ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
          expectParseError(json, message)
        })
      })
    })
  })
})

describe('[譜面ファイル読み込み] レーン数', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      it.each([{ laneCount: 1 }, { laneCount: 16 }])(
        'レーン数が $laneCount のとき、得られるレーン数は、$laneCount になる',
        ({ laneCount }) => {
          const loaded = parse(chartOf([], laneCount))

          expect(loaded.laneCount).toBe(laneCount)
        },
      )
    })

    describe('異常系', () => {
      it.each([
        ['レーン数がないとき', `レーン数${BROKEN_FILE_SUFFIX}`, chartWithout('laneCount')],
        ['レーン数が文字列 "5" のとき', `レーン数${BROKEN_FILE_SUFFIX}`, chartOf([], '5')],
        ['レーン数が 2.5 のとき', 'レーン数は整数にしてください', chartOf([], 2.5)],
        ['レーン数が 0 のとき', 'レーン数は 1 以上 16 以下にしてください', chartOf([], 0)],
        ['レーン数が 17 のとき', 'レーン数は 1 以上 16 以下にしてください', chartOf([], 17)],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] 0 未満の tick・レーンを持つ点', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('異常系', () => {
      it.each([
        [
          'ロングノーツの続く点の tick が -1 のとき',
          '1 つ目のノーツに、先頭より前の位置か 0 未満のレーンの点があります',
          chartOf([long(0, 0, [{ tick: -1, lane: 1 }], 'release')]),
        ],
        [
          '2 つ目のタップノーツが tick 480・レーン -1 のとき',
          '2 つ目のノーツに、先頭より前の位置か 0 未満のレーンの点があります',
          chartOf([tap(0, 0), tap(480, -1)]),
        ],
        [
          'tick 960・レーン 0 のタップノーツの次に、tick 480・レーン -1 のタップノーツがあるとき',
          '2 つ目のノーツに、先頭より前の位置か 0 未満のレーンの点があります',
          chartOf([tap(960, 0), tap(480, -1)]),
        ],
        [
          'tick 0・レーン 0 のタップノーツの次に、始点が tick 960・レーン 1 で続く点のレーンが -1 のロングノーツがあるとき',
          '2 つ目のノーツに、先頭より前の位置か 0 未満のレーンの点があります',
          chartOf([tap(0, 0), long(960, 1, [{ tick: 1440, lane: -1 }], 'release')]),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] ファイルの版', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('異常系', () => {
      it.each([
        ['ファイルの版がないとき', 'ファイルの版は整数にしてください', chartWithout('formatVersion')],
        ['ファイルの版が 0 のとき', 'ファイルの版 0 には対応していません', chartWith({ formatVersion: 0 })],
        ['ファイルの版が 2 のとき', 'ファイルの版 2 には対応していません', chartWith({ formatVersion: 2 })],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] ファイル全体の形式', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('異常系', () => {
      it.each([
        ['ファイル全体が配列のとき', `ファイルの内容${BROKEN_FILE_SUFFIX}`, []],
        ['ノーツがないとき', `ノーツ${BROKEN_FILE_SUFFIX}`, chartWithout('notes')],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] ノーツの個数の上限', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      it('ノーツが 3000 個のとき、得られる譜面のノーツの数は、3000 になる', () => {
        const { chart } = parse(chartOf(tapsAtTicks0To(2999)))

        expect(chart.notes).toHaveLength(3000)
      })
    })

    describe('異常系', () => {
      it('ノーツが 3001 個のとき、エラーメッセージに「ノーツは 3000 個までです (このファイルは 3001 個です)」を含む', () => {
        expectParseError(chartOf(tapsAtTicks0To(3000)), 'ノーツは 3000 個までです (このファイルは 3001 個です)')
      })
    })
  })
})

describe('[譜面ファイル読み込み] オフセット', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      describe('tick 0 を音源の先頭からの経過秒に変換する', () => {
        it.each([
          { offsetMs: 120, seconds: 0.12 },
          { offsetMs: -50.5, seconds: -0.0505 },
        ])('オフセットが $offsetMs ミリ秒のとき、$seconds 秒になる', ({ offsetMs, seconds }) => {
          const { projectInfo } = parse(chartWith({ offsetMs }))

          expect(convertTickToAudioSeconds(projectInfo, 0)).toBeCloseTo(seconds, 9)
        })
      })
    })

    describe('異常系', () => {
      it(`オフセットがないとき、エラーメッセージに「オフセット${BROKEN_FILE_SUFFIX}」を含む`, () => {
        expectParseError(chartWithout('offsetMs'), `オフセット${BROKEN_FILE_SUFFIX}`)
      })
    })
  })
})

describe('[譜面ファイル読み込み] テンポ変化点', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      describe('tick を tick 0 からの経過秒に変換する', () => {
        it.each([
          {
            given: 'テンポ変化点が tick 0・BPM 128 だけのとき',
            tick: 960,
            seconds: 0.46875,
            tempo: [{ tick: 0, bpm: 128 }],
          },
          {
            given: 'テンポ変化点が tick 0・BPM 128.5 だけのとき',
            tick: 2056,
            seconds: 1,
            tempo: [{ tick: 0, bpm: 128.5 }],
          },
          { given: 'テンポ変化点が tick 0・BPM 20 だけのとき', tick: 960, seconds: 3, tempo: [{ tick: 0, bpm: 20 }] },
          {
            given: 'テンポ変化点が tick 0・BPM 300 だけのとき',
            tick: 960,
            seconds: 0.2,
            tempo: [{ tick: 0, bpm: 300 }],
          },
          {
            given: 'テンポ変化点が tick 0・BPM 120 と tick 3840・BPM 90のとき',
            tick: 6720,
            seconds: 4,
            tempo: [
              { tick: 0, bpm: 120 },
              { tick: 3840, bpm: 90 },
            ],
          },
          {
            given: 'テンポ変化点が tick 0・BPM 125 と tick 1・BPM 250のとき',
            tick: 961,
            seconds: 0.2405,
            tempo: [
              { tick: 0, bpm: 125 },
              { tick: 1, bpm: 250 },
            ],
          },
        ])('$given、tick $tick は、$seconds 秒になる', ({ tick, seconds, tempo }) => {
          const { projectInfo } = parse(chartWith({ tempo }))

          expect(convertTickToSeconds(projectInfo, tick)).toBeCloseTo(seconds, 9)
        })
      })
    })

    describe('異常系', () => {
      it.each([
        ['テンポがないとき', `テンポ${BROKEN_FILE_SUFFIX}`, chartWithout('tempo')],
        [
          'テンポの 1 つ目の要素が数値 1 のとき',
          `1 つ目のテンポ変化点${BROKEN_FILE_SUFFIX}`,
          chartWith({ tempo: [1] }),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] テンポ変化点の tick', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('異常系', () => {
      it.each([
        [
          'テンポ変化点の tick が 0・0 の順に並ぶとき',
          '2 つ目のテンポ変化点の位置は前のテンポ変化点より後にしてください',
          chartWith({
            tempo: [
              { tick: 0, bpm: 120 },
              { tick: 0, bpm: 120 },
            ],
          }),
        ],
        [
          'テンポ変化点の tick が 0・3840・1920 の順に並ぶとき',
          '3 つ目のテンポ変化点の位置は前のテンポ変化点より後にしてください',
          chartWith({
            tempo: [
              { tick: 0, bpm: 120 },
              { tick: 3840, bpm: 120 },
              { tick: 1920, bpm: 120 },
            ],
          }),
        ],
        [
          'テンポ変化点の先頭の tick が -1 のとき',
          '1 つ目のテンポ変化点の位置は先頭以降にしてください',
          tempoWith({ tick: -1, bpm: 120 }),
        ],
        [
          'テンポ変化点の先頭の tick が 1.5 のとき',
          '1 つ目のテンポ変化点の位置は整数にしてください',
          tempoWith({ tick: 1.5, bpm: 120 }),
        ],
        ['テンポが空の配列のとき', '最初のテンポ変化点は先頭の位置にしてください', chartWith({ tempo: [] })],
        [
          'テンポ変化点の先頭の tick が 1 のとき',
          '最初のテンポ変化点は先頭の位置にしてください',
          tempoWith({ tick: 1, bpm: 120 }),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] テンポ変化点の BPM', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('異常系', () => {
      it.each([
        ['テンポ変化点の BPM がないとき', `1 つ目のテンポ変化点の BPM ${BROKEN_FILE_SUFFIX}`, tempoWith({ tick: 0 })],
        [
          'テンポ変化点の BPM が 19.99 のとき',
          '1 つ目のテンポ変化点の BPM は 20 以上 300 以下にしてください',
          tempoWith({ tick: 0, bpm: 19.99 }),
        ],
        [
          'テンポ変化点の BPM が 300.01 のとき',
          '1 つ目のテンポ変化点の BPM は 20 以上 300 以下にしてください',
          tempoWith({ tick: 0, bpm: 300.01 }),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] 拍子変化点', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('正常系', () => {
      it('拍子変化点が tick 0・分子 3・分母 4 だけのとき、tick 2880 以上 2980 未満の拍の小節番号は、2 になる', () => {
        const { projectInfo } = parse(chartWith({ meter: [{ tick: 0, num: 3, den: 4 }] }))

        expect(listBeats(projectInfo, 2880, 2980).map((beat) => beat.barNumber)).toEqual([2])
      })

      it.each([
        [
          '拍子変化点が tick 0 で 4/4 と tick 3840 で 6/8 のとき',
          5280,
          '0・960・1920・2880・3840・4320・4800',
          [
            { tick: 0, num: 4, den: 4 },
            { tick: 3840, num: 6, den: 8 },
          ],
          [0, 960, 1920, 2880, 3840, 4320, 4800],
        ],
        [
          '拍子変化点が tick 0・分子 1・分母 2 だけのとき',
          7680,
          '0・1920・3840・5760',
          [{ tick: 0, num: 1, den: 2 }],
          [0, 1920, 3840, 5760],
        ],
        ['拍子変化点が tick 0・分子 99・分母 4 だけのとき', 1000, '0・960', [{ tick: 0, num: 99, den: 4 }], [0, 960]],
        [
          '拍子変化点が tick 0・分子 4・分母 16 だけのとき',
          540,
          '0・240・480',
          [{ tick: 0, num: 4, den: 16 }],
          [0, 240, 480],
        ],
        [
          '拍子変化点が tick 0 で 4/4、tick 1 で 3/4 のとき',
          961,
          '0・1',
          [
            { tick: 0, num: 4, den: 4 },
            { tick: 1, num: 3, den: 4 },
          ],
          [0, 1],
        ],
      ])('%s、tick 0 以上 %s 未満の拍の tick は、%s の順になる', (_when, toTick, _ticksText, meter, ticks) => {
        const { projectInfo } = parse(chartWith({ meter }))

        expect(beatTicks(projectInfo, 0, toTick)).toEqual(ticks)
      })
    })

    describe('異常系', () => {
      it(`拍子がないとき、エラーメッセージに「拍子${BROKEN_FILE_SUFFIX}」を含む`, () => {
        expectParseError(chartWithout('meter'), `拍子${BROKEN_FILE_SUFFIX}`)
      })
    })
  })
})

describe('[譜面ファイル読み込み] 拍子変化点の tick', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('異常系', () => {
      it.each([
        [
          '拍子変化点の tick が 0・0 の順に並ぶとき',
          '2 つ目の拍子変化点の位置は前の拍子変化点より後にしてください',
          chartWith({
            meter: [
              { tick: 0, num: 4, den: 4 },
              { tick: 0, num: 4, den: 4 },
            ],
          }),
        ],
        [
          '拍子変化点の先頭の tick が -1 のとき',
          '1 つ目の拍子変化点の位置は先頭以降にしてください',
          meterWith({ tick: -1, num: 4, den: 4 }),
        ],
        [
          '拍子変化点の先頭の tick が 1.5 のとき',
          '1 つ目の拍子変化点の位置は整数にしてください',
          meterWith({ tick: 1.5, num: 4, den: 4 }),
        ],
        [
          '拍子変化点の先頭の tick が 1 のとき',
          '最初の拍子変化点は先頭の位置にしてください',
          meterWith({ tick: 1, num: 4, den: 4 }),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] 拍子変化点の分子', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('異常系', () => {
      it.each([
        [
          '拍子変化点の分子が 2.5 のとき',
          '1 つ目の拍子変化点の分子は整数にしてください',
          meterWith({ tick: 0, num: 2.5, den: 4 }),
        ],
        [
          '拍子変化点の分子が 0 のとき',
          '1 つ目の拍子変化点の分子は 1 以上 99 以下の整数にしてください',
          meterWith({ tick: 0, num: 0, den: 4 }),
        ],
        [
          '拍子変化点の分子が 100 のとき',
          '1 つ目の拍子変化点の分子は 1 以上 99 以下の整数にしてください',
          meterWith({ tick: 0, num: 100, den: 4 }),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})

describe('[譜面ファイル読み込み] 拍子変化点の分母', () => {
  describe('譜面ファイルの読み込み', () => {
    describe('異常系', () => {
      it.each([
        [
          '拍子変化点の分母が 2.5 のとき',
          '1 つ目の拍子変化点の分母は整数にしてください',
          meterWith({ tick: 0, num: 4, den: 2.5 }),
        ],
        [
          '拍子変化点の分母が 1 のとき',
          '1 つ目の拍子変化点の分母は 2、4、8、16 のいずれかにしてください',
          meterWith({ tick: 0, num: 4, den: 1 }),
        ],
        [
          '拍子変化点の分母が 3 のとき',
          '1 つ目の拍子変化点の分母は 2、4、8、16 のいずれかにしてください',
          meterWith({ tick: 0, num: 4, den: 3 }),
        ],
        [
          '拍子変化点の分母が 32 のとき',
          '1 つ目の拍子変化点の分母は 2、4、8、16 のいずれかにしてください',
          meterWith({ tick: 0, num: 4, den: 32 }),
        ],
      ])('%s、エラーメッセージに「%s」を含む', (_when, message, json) => {
        expectParseError(json, message)
      })
    })
  })
})
