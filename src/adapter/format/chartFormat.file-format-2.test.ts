import { describe, expect, it } from 'vitest'
import type { LongNote, Note, ProjectInfo } from '../../domain/types.ts'
import { serializeChart } from './chartFormat.ts'

interface SerializedNote {
  tick: unknown
  lane: unknown
  type: unknown
  dir: unknown
  path: unknown
  end: unknown
}

interface SerializedChart {
  formatVersion: unknown
  offsetMs: unknown
  laneCount: unknown
  tempo: Record<string, unknown>[]
  meter: Record<string, unknown>[]
  notes: SerializedNote[]
}

const defaultProjectInfo: ProjectInfo = {
  offsetMs: 0,
  tempo: [{ tick: 0, bpm: 120 }],
  meter: [{ tick: 0, num: 4, den: 4 }],
}

function writeChart(notes: Note[], laneCount = 5, projectInfo: ProjectInfo = defaultProjectInfo): SerializedChart {
  return serializeChart({ notes }, laneCount, projectInfo) as SerializedChart
}

function writeProjectInfo(projectInfo: ProjectInfo): SerializedChart {
  return writeChart([], 5, projectInfo)
}

function writeFirstNote(note: Note): SerializedNote {
  return writeChart([note]).notes[0] as SerializedNote
}

function sortedKeys(value: unknown): string[] {
  return Object.keys(value as object).toSorted()
}

const tapAtTick0Lane1: Note = { id: 'n1', type: 'tap', tick: 0, lane: 1 }
const upFlickAtTick480Lane2: Note = { id: 'n1', type: 'flick', tick: 480, lane: 2, direction: 'up' }
const releaseLongFrom960To1920: Note = {
  id: 'n1',
  type: 'long',
  tick: 960,
  lane: 1,
  path: [{ tick: 1920, lane: 1 }],
  end: { kind: 'release' },
}

function longWithEnd(end: LongNote['end']): Note {
  return { id: 'n1', type: 'long', tick: 960, lane: 1, path: [{ tick: 1920, lane: 1 }], end }
}

const longWithThreeFollowingPoints: Note = {
  id: 'n1',
  type: 'long',
  tick: 0,
  lane: 0,
  path: [
    { tick: 480, lane: 2 },
    { tick: 960, lane: 1 },
    { tick: 1440, lane: 0 },
  ],
  end: { kind: 'release' },
}

describe('[譜面ファイル書き出し] 譜面ファイル全体の項目', () => {
  describe('譜面の書き出し', () => {
    describe('正常系', () => {
      it('譜面を書き出すと、書き出した JSON のファイルの版は、1 になる', () => {
        const json = writeChart([tapAtTick0Lane1])

        expect(json.formatVersion).toBe(1)
      })

      it('レーン数が 8 のとき、譜面を書き出すと、書き出した JSON のレーン数は、8 になる', () => {
        const json = writeChart([tapAtTick0Lane1], 8)

        expect(json.laneCount).toBe(8)
      })

      it('ノーツが 0 個の譜面のとき、書き出した JSON のノーツは、空の配列になる', () => {
        const json = writeChart([])

        expect(json.notes).toEqual([])
      })

      it('tick 0 のタップノーツ、tick 480 の上フリックノーツの順に並ぶ譜面のとき、書き出した JSON のノーツの tick は、0、480 の順になる', () => {
        const json = writeChart([
          { id: 'n1', type: 'tap', tick: 0, lane: 0 },
          { id: 'n2', type: 'flick', tick: 480, lane: 1, direction: 'up' },
        ])

        expect(json.notes.map((note) => note.tick)).toEqual([0, 480])
      })
    })
  })
})

describe('[譜面ファイル書き出し] プロジェクト情報', () => {
  describe('譜面の書き出し', () => {
    describe('正常系', () => {
      it('オフセットが 120 ミリ秒のとき、譜面を書き出すと、書き出した JSON のオフセットは、120 になる', () => {
        const json = writeProjectInfo({ ...defaultProjectInfo, offsetMs: 120 })

        expect(json.offsetMs).toBe(120)
      })

      describe('テンポ変化点が tick 0・BPM 128 の 1 点だけのとき', () => {
        it('書き出した JSON のテンポ変化点は、tick 0・BPM 128 の 1 点だけになる', () => {
          const json = writeProjectInfo({ ...defaultProjectInfo, tempo: [{ tick: 0, bpm: 128 }] })

          expect(json.tempo).toMatchObject([{ tick: 0, bpm: 128 }])
        })

        it('書き出した JSON のテンポ変化点の項目は、tick・BPM だけになる', () => {
          const json = writeProjectInfo({ ...defaultProjectInfo, tempo: [{ tick: 0, bpm: 128 }] })

          expect(sortedKeys(json.tempo[0])).toEqual(['bpm', 'tick'])
        })
      })

      describe('拍子変化点が tick 0・分子 3・分母 4 の 1 点だけのとき', () => {
        it('書き出した JSON の拍子変化点は、tick 0・分子 3・分母 4 の 1 点だけになる', () => {
          const json = writeProjectInfo({ ...defaultProjectInfo, meter: [{ tick: 0, num: 3, den: 4 }] })

          expect(json.meter).toMatchObject([{ tick: 0, num: 3, den: 4 }])
        })

        it('書き出した JSON の拍子変化点の項目は、tick・分子・分母だけになる', () => {
          const json = writeProjectInfo({ ...defaultProjectInfo, meter: [{ tick: 0, num: 3, den: 4 }] })

          expect(sortedKeys(json.meter[0])).toEqual(['den', 'num', 'tick'])
        })
      })

      describe('テンポ変化点が tick 0・BPM 120 と tick 3840・BPM 90 のとき', () => {
        it('書き出した JSON のテンポ変化点の tick は、0、3840 の順になる', () => {
          const json = writeProjectInfo({
            ...defaultProjectInfo,
            tempo: [
              { tick: 0, bpm: 120 },
              { tick: 3840, bpm: 90 },
            ],
          })

          expect(json.tempo.map((change) => change.tick)).toEqual([0, 3840])
        })

        it('書き出した JSON のテンポ変化点の BPM は、120、90 の順になる', () => {
          const json = writeProjectInfo({
            ...defaultProjectInfo,
            tempo: [
              { tick: 0, bpm: 120 },
              { tick: 3840, bpm: 90 },
            ],
          })

          expect(json.tempo.map((change) => change.bpm)).toEqual([120, 90])
        })
      })

      describe('拍子変化点が tick 0・4/4 と tick 3840・6/8 のとき', () => {
        const meterChange: ProjectInfo = {
          ...defaultProjectInfo,
          meter: [
            { tick: 0, num: 4, den: 4 },
            { tick: 3840, num: 6, den: 8 },
          ],
        }

        it('書き出した JSON の拍子変化点の tick は、0、3840 の順になる', () => {
          const json = writeProjectInfo(meterChange)

          expect(json.meter.map((change) => change.tick)).toEqual([0, 3840])
        })

        it('書き出した JSON の拍子変化点の分子は、4、6 の順になる', () => {
          const json = writeProjectInfo(meterChange)

          expect(json.meter.map((change) => change.num)).toEqual([4, 6])
        })

        it('書き出した JSON の拍子変化点の分母は、4、8 の順になる', () => {
          const json = writeProjectInfo(meterChange)

          expect(json.meter.map((change) => change.den)).toEqual([4, 8])
        })
      })
    })
  })
})

describe('[譜面ファイル書き出し] ノーツの tick', () => {
  describe('譜面の書き出し', () => {
    describe('正常系', () => {
      it.each([
        ['tick 0 のタップノーツ 1 つだけのとき', 0, tapAtTick0Lane1],
        ['tick 480 の上フリックノーツ 1 つだけのとき', 480, upFlickAtTick480Lane2],
        ['始点が tick 960 のロングノーツ 1 つだけのとき', 960, releaseLongFrom960To1920],
      ])('%s、書き出した JSON の 1 つ目のノーツの tick は、%s になる', (_when, tick, note) => {
        const written = writeFirstNote(note)

        expect(written.tick).toBe(tick)
      })
    })
  })
})

describe('[譜面ファイル書き出し] ノーツのレーン', () => {
  describe('譜面の書き出し', () => {
    describe('正常系', () => {
      it.each([
        ['レーン 1 のタップノーツ 1 つだけのとき', 1, tapAtTick0Lane1],
        ['レーン 2 の上フリックノーツ 1 つだけのとき', 2, upFlickAtTick480Lane2],
        ['始点がレーン 1 のロングノーツ 1 つだけのとき', 1, releaseLongFrom960To1920],
      ])('%s、書き出した JSON の 1 つ目のノーツのレーンは、%s になる', (_when, lane, note) => {
        const written = writeFirstNote(note)

        expect(written.lane).toBe(lane)
      })
    })
  })
})

describe('[譜面ファイル書き出し] ノーツの種類', () => {
  describe('譜面の書き出し', () => {
    describe('正常系', () => {
      it.each([
        ['タップノーツ 1 つだけのとき', 'tap', tapAtTick0Lane1],
        ['フリックノーツ 1 つだけのとき', 'flick', upFlickAtTick480Lane2],
        ['ロングノーツ 1 つだけのとき', 'long', releaseLongFrom960To1920],
      ])('%s、書き出した JSON の 1 つ目のノーツの種類は、"%s" になる', (_when, type, note) => {
        const written = writeFirstNote(note)

        expect(written.type).toBe(type)
      })
    })
  })
})

describe('[譜面ファイル書き出し] フリックノーツの方向', () => {
  describe('正常系', () => {
    it('tick 480・レーン 2 の上フリックノーツ 1 つだけのとき、書き出した JSON の 1 つ目のノーツの向きは、"up" になる', () => {
      const written = writeFirstNote(upFlickAtTick480Lane2)

      expect(written.dir).toBe('up')
    })
  })
})

describe('[譜面ファイル書き出し] ロングノーツの始点に続く点', () => {
  describe('譜面の書き出し', () => {
    describe('正常系', () => {
      it.each([
        {
          given: '続く点が tick 1920・レーン 1 だけのロングノーツのとき',
          result: 'tick 1920・レーン 1 の 1 点だけになる',
          note: releaseLongFrom960To1920,
          expected: [{ tick: 1920, lane: 1 }],
        },
        {
          given: '続く点が tick 480・レーン 2、tick 960・レーン 1、tick 1440・レーン 0 の順のロングノーツのとき',
          result: 'その 3 点の順になる',
          note: longWithThreeFollowingPoints,
          expected: [
            { tick: 480, lane: 2 },
            { tick: 960, lane: 1 },
            { tick: 1440, lane: 0 },
          ],
        },
      ])('$given、書き出した JSON の 1 つ目のノーツの続く点は、$result', ({ note, expected }) => {
        const written = writeFirstNote(note)

        expect(written.path).toMatchObject(expected)
      })
    })
  })
})

describe('[譜面ファイル書き出し] ロングノーツの終端', () => {
  describe('譜面の書き出し', () => {
    describe('正常系', () => {
      it('終端フリックがないロングノーツ 1 つだけのとき、書き出した JSON の 1 つ目のノーツの終端は、"release" になる', () => {
        const note = writeFirstNote(releaseLongFrom960To1920)

        expect(note.end).toBe('release')
      })

      it('右の終端フリックがあるロングノーツ 1 つだけのとき、書き出した JSON の 1 つ目のノーツの終端は、{ "flick": "right" } になる', () => {
        const note = writeFirstNote(longWithEnd({ kind: 'flick', direction: 'right' }))

        expect(note.end).toMatchObject({ flick: 'right' })
      })
    })
  })
})

describe('[譜面ファイル書き出し] 書き出す JSON の項目', () => {
  describe('譜面の書き出し', () => {
    describe('正常系', () => {
      it('譜面を書き出すと、書き出した JSON の項目は、ファイルの版・オフセット・レーン数・テンポ・拍子・ノーツの順の 6 つだけになる', () => {
        const json = writeChart([tapAtTick0Lane1])

        expect(Object.keys(json)).toEqual(['formatVersion', 'offsetMs', 'laneCount', 'tempo', 'meter', 'notes'])
      })

      it.each([
        [
          'タップノーツがある譜面のとき',
          '書き出した JSON のタップノーツの項目は、tick・レーン・種類だけになる',
          tapAtTick0Lane1,
          ['lane', 'tick', 'type'],
        ],
        [
          'フリックノーツがある譜面のとき',
          '書き出した JSON のフリックノーツの項目は、tick・レーン・種類・向きだけになる',
          upFlickAtTick480Lane2,
          ['dir', 'lane', 'tick', 'type'],
        ],
        [
          'ロングノーツがある譜面のとき',
          '書き出した JSON のロングノーツの項目は、tick・レーン・種類・続く点・終端だけになる',
          releaseLongFrom960To1920,
          ['end', 'lane', 'path', 'tick', 'type'],
        ],
      ])('%s、%s', (_when, _result, note, keys) => {
        const written = writeFirstNote(note)

        expect(sortedKeys(written)).toEqual(keys)
      })

      it('ロングノーツがある譜面のとき、書き出した JSON のロングノーツの続く点の項目は、tick・レーンだけになる', () => {
        const note = writeFirstNote(releaseLongFrom960To1920)

        expect(sortedKeys((note.path as unknown[])[0])).toEqual(['lane', 'tick'])
      })

      it('右の終端フリックがあるロングノーツがある譜面のとき、書き出した JSON のロングノーツの終端の項目は、"flick" だけになる', () => {
        const note = writeFirstNote(longWithEnd({ kind: 'flick', direction: 'right' }))

        expect(sortedKeys(note.end)).toEqual(['flick'])
      })
    })
  })
})
