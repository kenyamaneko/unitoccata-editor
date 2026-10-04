import { within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { startApp, type AppDriver } from '../../test/app.tsx'
import {
  addInvalidMeterChange,
  addInvalidTempoChange,
  addMeterChange,
  addTempoChange,
  enterInvalidOffset,
  meterInput,
  openMeterInputAt,
  openMeterInputOnChange,
  openTempoInputAt,
  openTempoInputOnChange,
  pressUndo,
  rewriteMeterChange,
  rewriteTempoChange,
  rightClickRemovingMeterChange,
  rightClickRemovingTempoChange,
  setOffset,
  startWithProjectInfo,
  tempoInput,
  typeIntoTempoInput,
} from './projectInfo-2.helpers.ts'
import { meterColumnAt, tempoColumnAt } from '../../test/timeline.ts'

async function exportOffsetMs(app: AppDriver): Promise<unknown> {
  const file = await app.downloads.exportChartAs('テスト曲', '譜面1')
  const content = (await file.json()) as { offsetMs: unknown }
  return content.offsetMs
}

function startWithTempo150(): Promise<AppDriver> {
  return startWithProjectInfo(
    { tempo: [{ tick: 0, bpm: 150 }] },
    { tempos: ['1 小節目 1 拍目 BPM 150'], meters: ['1 小節目 1 拍目 4/4'] },
  )
}

function startWithTempo150AndMeter34(): Promise<AppDriver> {
  return startWithProjectInfo(
    { tempo: [{ tick: 0, bpm: 150 }], meter: [{ tick: 0, num: 3, den: 4 }] },
    { tempos: ['1 小節目 1 拍目 BPM 150'], meters: ['1 小節目 1 拍目 3/4'] },
  )
}

function startWithTempo150And90At3840(): Promise<AppDriver> {
  return startWithProjectInfo(
    {
      tempo: [
        { tick: 0, bpm: 150 },
        { tick: 3840, bpm: 90 },
      ],
    },
    { tempos: ['1 小節目 1 拍目 BPM 150', '2 小節目 1 拍目 BPM 90'], meters: ['1 小節目 1 拍目 4/4'] },
  )
}

function startWithTempo150And90At3840AndMeter34(): Promise<AppDriver> {
  return startWithProjectInfo(
    {
      tempo: [
        { tick: 0, bpm: 150 },
        { tick: 3840, bpm: 90 },
      ],
      meter: [{ tick: 0, num: 3, den: 4 }],
    },
    { tempos: ['1 小節目 1 拍目 BPM 150', '2 小節目 2 拍目 BPM 90'], meters: ['1 小節目 1 拍目 3/4'] },
  )
}

function startWithTempo150And90At3840And60At7680(): Promise<AppDriver> {
  return startWithProjectInfo(
    {
      tempo: [
        { tick: 0, bpm: 150 },
        { tick: 3840, bpm: 90 },
        { tick: 7680, bpm: 60 },
      ],
    },
    {
      tempos: ['1 小節目 1 拍目 BPM 150', '2 小節目 1 拍目 BPM 90', '3 小節目 1 拍目 BPM 60'],
      meters: ['1 小節目 1 拍目 4/4'],
    },
  )
}

function startWithMeter34(): Promise<AppDriver> {
  return startWithProjectInfo(
    { meter: [{ tick: 0, num: 3, den: 4 }] },
    { tempos: ['1 小節目 1 拍目 BPM 120'], meters: ['1 小節目 1 拍目 3/4'] },
  )
}

function startWithMeter34AndTempo150(): Promise<AppDriver> {
  return startWithProjectInfo(
    { tempo: [{ tick: 0, bpm: 150 }], meter: [{ tick: 0, num: 3, den: 4 }] },
    { tempos: ['1 小節目 1 拍目 BPM 150'], meters: ['1 小節目 1 拍目 3/4'] },
  )
}

function startWithMeter34And68At3840(): Promise<AppDriver> {
  return startWithProjectInfo(
    {
      meter: [
        { tick: 0, num: 3, den: 4 },
        { tick: 3840, num: 6, den: 8 },
      ],
    },
    { tempos: ['1 小節目 1 拍目 BPM 120'], meters: ['1 小節目 1 拍目 3/4', '3 小節目 1 拍目 6/8'] },
  )
}

function startWithMeter34And68At3840AndTempo150(): Promise<AppDriver> {
  return startWithProjectInfo(
    {
      tempo: [{ tick: 0, bpm: 150 }],
      meter: [
        { tick: 0, num: 3, den: 4 },
        { tick: 3840, num: 6, den: 8 },
      ],
    },
    { tempos: ['1 小節目 1 拍目 BPM 150'], meters: ['1 小節目 1 拍目 3/4', '3 小節目 1 拍目 6/8'] },
  )
}

function startWithMeter34And68At3840And24At7680(): Promise<AppDriver> {
  return startWithProjectInfo(
    {
      meter: [
        { tick: 0, num: 3, den: 4 },
        { tick: 3840, num: 6, den: 8 },
        { tick: 7680, num: 2, den: 4 },
      ],
    },
    {
      tempos: ['1 小節目 1 拍目 BPM 120'],
      meters: ['1 小節目 1 拍目 3/4', '3 小節目 1 拍目 6/8', '5 小節目 1 拍目 2/4'],
    },
  )
}

describe('[プロジェクト情報編集] テンポ列', () => {
  describe('正常系', () => {
    it('エディタを開いた直後に、テンポ列の 1 小節目 1 拍目をダブルクリックすると、出てきた入力欄の値は、120 になる', async () => {
      const app = await startApp()

      const input = await openTempoInputOnChange(app, 0)

      expect(input).toHaveDisplayValue('120')
    })
  })

  describe('テンポ変化点の追加', () => {
    describe('正常系', () => {
      describe('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、テンポ列の 2 小節目 1 拍目をクリックして出た入力欄に入力してエンターキーを押す', () => {
        it.each([
          { entry: '90', added: '2 小節目 1 拍目 BPM 90' },
          { entry: '20', added: '2 小節目 1 拍目 BPM 20' },
          { entry: '300', added: '2 小節目 1 拍目 BPM 300' },
        ])(
          '入力が $entry のとき、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」「$added」だけになる',
          async ({ entry, added }) => {
            const app = await startWithTempo150()

            await addTempoChange(app, 3840, entry)

            expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150', added])
          },
        )
      })

      describe('テンポ列をクリックして出た入力欄への入力と、エンターキーの押下', () => {
        it('テンポが 1 小節目 1 拍目の BPM 150、2 小節目 1 拍目の BPM 90 のとき、テンポ列の 1 小節目 3 拍目をクリックして出た入力欄に 100 を入力してエンターキーを押すと、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」「1 小節目 3 拍目 BPM 100」「2 小節目 1 拍目 BPM 90」だけになる', async () => {
          const app = await startWithTempo150And90At3840()

          await addTempoChange(app, 1920, '100')

          expect(app.timeline.tempos()).toEqual([
            '1 小節目 1 拍目 BPM 150',
            '1 小節目 3 拍目 BPM 100',
            '2 小節目 1 拍目 BPM 90',
          ])
        })

        it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、テンポ列の 2 小節目 2 拍目をクリックして出た入力欄に 90 を入力してエンターキーを押しても、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」だけのままになる', async () => {
          const app = await startWithTempo150AndMeter34()

          await addTempoChange(app, 3840, '90')

          expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4'])
        })

        it('オフセットが 120 のとき、テンポ列の 2 小節目 1 拍目をクリックして出た入力欄に 90 を入力してエンターキーを押し、「プロジェクト情報」ボタンを押すと、「プロジェクト情報」ダイアログの「オフセット (ms)」は、120 のままになる', async () => {
          const app = await startApp()
          await app.loadChart([], undefined, { offsetMs: 120 })
          await addTempoChange(app, 3840, '90')

          await app.projectInfo.open()

          expect(app.projectInfo.offsetInput()).toHaveDisplayValue('120')
        })
      })

      it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、テンポ列の 2 小節目 1 拍目に BPM 90、1 小節目 3 拍目に BPM 100 を追加して「元に戻す」ボタンを押すと、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」「2 小節目 1 拍目 BPM 90」だけになる', async () => {
        const app = await startWithTempo150()
        await addTempoChange(app, 3840, '90')
        await addTempoChange(app, 1920, '100')

        await pressUndo(app)

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150', '2 小節目 1 拍目 BPM 90'])
      })

      describe('テンポ列の 2 小節目 1 拍目をクリックして出た入力欄に 90 を入力して、エスケープキーを押す', () => {
        it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、追加が取り消され、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」だけのままになる', async () => {
          const app = await startWithTempo150()
          await typeIntoTempoInput(app, 3840, '90')

          await app.press('Escape')

          expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
        })

        it('出ていた入力欄が閉じる', async () => {
          const app = await startApp()
          const input = await typeIntoTempoInput(app, 3840, '90')

          await app.press('Escape')

          expect(input).not.toBeInTheDocument()
        })
      })

      describe('テンポ列の 2 小節目 1 拍目をクリックして出た入力欄に 90 を入力して、入力欄の外 (「音源が未読み込みです」の表示) をクリックする', () => {
        it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、追加が取り消され、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」だけのままになる', async () => {
          const app = await startWithTempo150()
          await typeIntoTempoInput(app, 3840, '90')

          await app.click(app.text('音源が未読み込みです'))

          expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
        })

        it('出ていた入力欄が閉じる', async () => {
          const app = await startApp()
          const input = await typeIntoTempoInput(app, 3840, '90')

          await app.click(app.text('音源が未読み込みです'))

          expect(input).not.toBeInTheDocument()
        })
      })

      it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、テンポ列の 2 小節目 1 拍目をクリックすると、出てきた入力欄の値は、空になる', async () => {
        const app = await startWithTempo150()

        const input = await openTempoInputAt(app, 3840)

        expect(input).toHaveDisplayValue('')
      })
    })

    describe('異常系', () => {
      it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、テンポ列の 2 小節目 1 拍目をクリックして出た入力欄に 19.99 を入力してエンターキーを押しても、BPM の下限 20 を下回るため追加されず、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」だけのままになる', async () => {
        const app = await startWithTempo150()

        await addInvalidTempoChange(app, 3840, '19.99')

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
      })

      it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、テンポ列の 2 小節目 1 拍目をクリックして出た入力欄に 19.99 を入力してエンターキーを押したあと、入力欄の値を 90 に直してエンターキーを押すと、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」「2 小節目 1 拍目 BPM 90」だけになる', async () => {
        const app = await startWithTempo150()
        await addInvalidTempoChange(app, 3840, '19.99')

        await app.setText(tempoInput(app), '90')
        await app.press('Enter')

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150', '2 小節目 1 拍目 BPM 90'])
      })
    })
  })

  describe('テンポ変化点の書き換え', () => {
    describe('正常系', () => {
      describe('テンポ列のテンポ変化点をダブルクリックして出た入力欄の値を書き換え、エンターキーを押す', () => {
        it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、1 小節目 1 拍目のテンポ変化点の入力欄を 140 に書き換えると、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 140」だけになる', async () => {
          const app = await startWithTempo150()

          await rewriteTempoChange(app, 0, '140')

          expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 140'])
        })

        it('テンポが 1 小節目 1 拍目の BPM 150、2 小節目 1 拍目の BPM 90 のとき、2 小節目 1 拍目のテンポ変化点の入力欄を 100 に書き換えると、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」「2 小節目 1 拍目 BPM 100」だけになる', async () => {
          const app = await startWithTempo150And90At3840()

          await rewriteTempoChange(app, 3840, '100')

          expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150', '2 小節目 1 拍目 BPM 100'])
        })
      })

      it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、1 小節目 1 拍目のテンポ変化点を 140、160 の順に書き換えて「元に戻す」ボタンを押すと、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 140」だけになる', async () => {
        const app = await startWithTempo150()
        await rewriteTempoChange(app, 0, '140')
        await rewriteTempoChange(app, 0, '160')

        await pressUndo(app)

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 140'])
      })

      it('テンポが 1 小節目 1 拍目の BPM 150、2 小節目 1 拍目の BPM 90 のとき、テンポ列の 2 小節目 1 拍目のテンポ変化点をダブルクリックすると、出てきた入力欄の値は、90 になる', async () => {
        const app = await startWithTempo150And90At3840()

        const input = await openTempoInputOnChange(app, 3840)

        expect(input).toHaveDisplayValue('90')
      })
    })
  })

  describe('テンポ変化点の削除', () => {
    describe('正常系', () => {
      describe('テンポ列のテンポ変化点を右クリックする', () => {
        it('テンポが 1 小節目 1 拍目の BPM 150、2 小節目 1 拍目の BPM 90 のとき、2 小節目 1 拍目のテンポ変化点を右クリックすると、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」だけになる', async () => {
          const app = await startWithTempo150And90At3840()

          await app.timeline.rightClick(tempoColumnAt(3840))

          expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
        })

        it('テンポが 1 小節目 1 拍目の BPM 150、2 小節目 2 拍目の BPM 90 で、拍子が 1 小節目 1 拍目の 3/4 だけのとき、2 小節目 2 拍目のテンポ変化点を右クリックしても、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」だけのままになる', async () => {
          const app = await startWithTempo150And90At3840AndMeter34()

          await app.timeline.rightClick(tempoColumnAt(3840))

          expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4'])
        })

        it('オフセットが 120 のとき、2 小節目 1 拍目のテンポ変化点を右クリックして「プロジェクト情報」ボタンを押すと、「プロジェクト情報」ダイアログの「オフセット (ms)」は、120 のままになる', async () => {
          const app = await startApp()
          await app.loadChart([], undefined, {
            offsetMs: 120,
            tempo: [
              { tick: 0, bpm: 150 },
              { tick: 3840, bpm: 90 },
            ],
          })
          await rightClickRemovingTempoChange(app, 3840)

          await app.projectInfo.open()

          expect(app.projectInfo.offsetInput()).toHaveDisplayValue('120')
        })
      })

      it('テンポが 1 小節目 1 拍目の BPM 150、2 小節目 1 拍目の BPM 90、3 小節目 1 拍目の BPM 60 のとき、3 小節目 1 拍目、2 小節目 1 拍目の順にテンポ変化点を右クリックして削除し、「元に戻す」ボタンを押すと、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」「2 小節目 1 拍目 BPM 90」だけになる', async () => {
        const app = await startWithTempo150And90At3840And60At7680()
        await rightClickRemovingTempoChange(app, 7680)
        await rightClickRemovingTempoChange(app, 3840)

        await pressUndo(app)

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150', '2 小節目 1 拍目 BPM 90'])
      })
    })

    describe('異常系', () => {
      it('テンポが 1 小節目 1 拍目の BPM 150、2 小節目 1 拍目の BPM 90 のとき、テンポ列の 1 小節目 3 拍目 (テンポ変化点がない位置) を右クリックしても、何も削除されず、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」「2 小節目 1 拍目 BPM 90」のままになる', async () => {
        const app = await startWithTempo150And90At3840()

        await app.timeline.rightClick(tempoColumnAt(1920))

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150', '2 小節目 1 拍目 BPM 90'])
      })

      it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、1 小節目 1 拍目のテンポ変化点を右クリックしても、削除されず、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」だけのままになる', async () => {
        const app = await startWithTempo150()

        await app.timeline.rightClick(tempoColumnAt(0))

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
      })

      it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、1 小節目 1 拍目のテンポ変化点を右クリックすると、画面の下のメッセージに「先頭のテンポ変化点は削除できません」が出る', async () => {
        const app = await startWithTempo150()

        await app.timeline.rightClick(tempoColumnAt(0))

        expect(app.notice('先頭のテンポ変化点は削除できません')).toBeInTheDocument()
      })
    })
  })
})

describe('[プロジェクト情報編集] テンポの入力値の判定', () => {
  describe('異常系', () => {
    describe('テンポ列の 2 小節目 1 拍目をクリックして出た入力欄に入力して、エンターキーを押す', () => {
      it.each([
        ['BPM の下限 20 を下回る 19.9', '19.9'],
        ['BPM の上限 300 を上回る 300.1', '300.1'],
        ['空文字', ''],
      ])(
        '入力が %s のとき、入力欄に添えて出る理由は、「BPM は 20 以上 300 以下の半角の数で、小数点第一位までにして入力してください」になる',
        async (_given, entry) => {
          const app = await startApp()

          await addTempoChange(app, 3840, entry)

          expect(app.alertTexts()).toEqual([
            'BPM は 20 以上 300 以下の半角の数で、小数点第一位までにして入力してください',
          ])
        },
      )
    })
  })
})

describe('[テンポ変化点の編集] BPM の入力欄', () => {
  describe('テンポ列をクリックして出た、何も入っていない入力欄に', () => {
    describe('正常系', () => {
      it('120 を入力すると、入力欄の値は、120 になる', async () => {
        const app = await startApp()
        const input = await openTempoInputAt(app, 3840)

        await app.type(input, '120')

        expect(input).toHaveDisplayValue('120')
      })

      it('120.5 を入力すると、入力欄の値は、120.5 になる', async () => {
        const app = await startApp()
        const input = await openTempoInputAt(app, 3840)

        await app.type(input, '120.5')

        expect(input).toHaveDisplayValue('120.5')
      })
    })

    describe('異常系', () => {
      it('数字以外の文字 a を入力しようとしても、入力欄の値は、空のままになる', async () => {
        const app = await startApp()
        const input = await openTempoInputAt(app, 3840)

        await app.type(input, 'a')

        expect(input).toHaveDisplayValue('')
      })

      it('12. を入力した後に、さらに小数点を入力しようとしても、入力欄の値は、12. のままになる', async () => {
        const app = await startApp()
        const input = await typeIntoTempoInput(app, 3840, '12.')

        await app.type(input, '.')

        expect(input).toHaveDisplayValue('12.')
      })

      it('120. を入力した後に、さらに 2 つの数字 55 を入力しようとしても、入力欄の値は、120.5 になる', async () => {
        const app = await startApp()
        const input = await typeIntoTempoInput(app, 3840, '120.')

        await app.type(input, '55')

        expect(input).toHaveDisplayValue('120.5')
      })
    })
  })
})

describe('[プロジェクト情報編集] 拍子列', () => {
  describe('正常系', () => {
    it('エディタを開いた直後に、拍子列の 1 小節目 1 拍目をダブルクリックすると、出てきた入力欄の値は、4/4 になる', async () => {
      const app = await startApp()

      const input = await openMeterInputOnChange(app, 0)

      expect(input).toHaveDisplayValue('4/4')
    })
  })

  describe('拍子変化点の追加', () => {
    describe('正常系', () => {
      it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、拍子列の 2 小節目 2 拍目をクリックすると、出てきた入力欄の値は、4/4 になる', async () => {
        const app = await startWithMeter34()

        const input = await openMeterInputAt(app, 3840)

        expect(input).toHaveDisplayValue('4/4')
      })

      describe('拍子が 1 小節目 1 拍目の 3/4 だけのとき、拍子列の 2 小節目 2 拍目をクリックして出た入力欄の値を書き換えてエンターキーを押す', () => {
        it.each([
          { entry: '6/8', added: '3 小節目 1 拍目 6/8' },
          { entry: '1/2', added: '3 小節目 1 拍目 1/2' },
          { entry: '4/16', added: '3 小節目 1 拍目 4/16' },
          { entry: '99/4', added: '3 小節目 1 拍目 99/4' },
        ])(
          '入力が $entry のとき、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」「$added」だけになる',
          async ({ entry, added }) => {
            const app = await startWithMeter34()

            await addMeterChange(app, 3840, entry)

            expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4', added])
          },
        )
      })

      describe('拍子列をクリックして出た入力欄の値を書き換え、エンターキーを押す', () => {
        it('拍子が 1 小節目 1 拍目の 3/4、3 小節目 1 拍目の 6/8 のとき、拍子列の 1 小節目 3 拍目をクリックして出た入力欄の値を 4/4 に書き換えてエンターキーを押すと、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」「2 小節目 1 拍目 4/4」「3 小節目 1 拍目 6/8」だけになる', async () => {
          const app = await startWithMeter34And68At3840()

          await addMeterChange(app, 1920, '4/4')

          expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4', '2 小節目 1 拍目 4/4', '3 小節目 1 拍目 6/8'])
        })

        it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、拍子列の 2 小節目 1 拍目をクリックして出た入力欄の値を 6/8 に書き換えてエンターキーを押しても、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」だけのままになる', async () => {
          const app = await startWithMeter34AndTempo150()

          await addMeterChange(app, 3840, '6/8')

          expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
        })

        it('オフセットが 120 のとき、拍子列の 2 小節目 1 拍目をクリックして出た入力欄の値を 3/4 に書き換えてエンターキーを押し、「プロジェクト情報」ボタンを押すと、「プロジェクト情報」ダイアログの「オフセット (ms)」は、120 のままになる', async () => {
          const app = await startApp()
          await app.loadChart([], undefined, { offsetMs: 120 })
          await addMeterChange(app, 3840, '3/4')

          await app.projectInfo.open()

          expect(app.projectInfo.offsetInput()).toHaveDisplayValue('120')
        })
      })

      it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、拍子列の 2 小節目 2 拍目に 6/8 を追加したあと、4 小節目 3 拍目に 2/4 を追加して「元に戻す」ボタンを押すと、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」「3 小節目 1 拍目 6/8」だけになる', async () => {
        const app = await startWithMeter34()
        await addMeterChange(app, 3840, '6/8')
        await addMeterChange(app, 7680, '2/4')

        await pressUndo(app)

        expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4', '3 小節目 1 拍目 6/8'])
      })
    })

    describe('異常系', () => {
      it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、拍子列の 2 小節目 2 拍目をクリックして出た入力欄の値を 3 に書き換えてエンターキーを押しても、拍子として読めないため追加されず、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」だけのままになる', async () => {
        const app = await startWithMeter34()

        await addInvalidMeterChange(app, 3840, '3')

        expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4'])
      })

      it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、拍子列の 2 小節目 2 拍目をクリックして出た入力欄の値を 3 に書き換えてエンターキーを押したあと、入力欄の値を 6/8 に直してエンターキーを押すと、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」「3 小節目 1 拍目 6/8」だけになる', async () => {
        const app = await startWithMeter34()
        await addInvalidMeterChange(app, 3840, '3')

        await app.setText(meterInput(), '6/8')
        await app.press('Enter')

        expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4', '3 小節目 1 拍目 6/8'])
      })
    })
  })

  describe('拍子変化点の書き換え', () => {
    describe('正常系', () => {
      it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、拍子列の 1 小節目 1 拍目の拍子変化点をダブルクリックすると、出てきた入力欄の値は、3/4 になる', async () => {
        const app = await startWithMeter34()

        const input = await openMeterInputOnChange(app, 0)

        expect(input).toHaveDisplayValue('3/4')
      })

      describe('拍子列の拍子変化点をダブルクリックして出た入力欄の値を書き換え、エンターキーを押す', () => {
        it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、1 小節目 1 拍目の拍子変化点の入力欄を 6/8 に書き換えると、拍子の代替コンテンツは、「1 小節目 1 拍目 6/8」だけになる', async () => {
          const app = await startWithMeter34()

          await rewriteMeterChange(app, 0, '6/8')

          expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 6/8'])
        })

        it('拍子が 1 小節目 1 拍目の 3/4、3 小節目 1 拍目の 6/8 のとき、3 小節目 1 拍目の拍子変化点の入力欄を 2/4 に書き換えると、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」「3 小節目 1 拍目 2/4」だけになる', async () => {
          const app = await startWithMeter34And68At3840()

          await rewriteMeterChange(app, 3840, '2/4')

          expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4', '3 小節目 1 拍目 2/4'])
        })
      })

      it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、1 小節目 1 拍目の拍子変化点を 6/8、2/4 の順に書き換えて「元に戻す」ボタンを押すと、拍子の代替コンテンツは、「1 小節目 1 拍目 6/8」だけになる', async () => {
        const app = await startWithMeter34()
        await rewriteMeterChange(app, 0, '6/8')
        await rewriteMeterChange(app, 0, '2/4')

        await pressUndo(app)

        expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 6/8'])
      })
    })
  })

  describe('拍子変化点の削除', () => {
    describe('正常系', () => {
      describe('拍子列の拍子変化点を右クリックする', () => {
        it('拍子が 1 小節目 1 拍目の 3/4、3 小節目 1 拍目の 6/8 のとき、3 小節目 1 拍目の拍子変化点を右クリックすると、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」だけになる', async () => {
          const app = await startWithMeter34And68At3840()

          await app.timeline.rightClick(meterColumnAt(3840))

          expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4'])
        })

        it('テンポが 1 小節目 1 拍目の BPM 150 で、拍子が 1 小節目 1 拍目の 3/4、3 小節目 1 拍目の 6/8 のとき、3 小節目 1 拍目の拍子変化点を右クリックしても、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」だけのままになる', async () => {
          const app = await startWithMeter34And68At3840AndTempo150()

          await app.timeline.rightClick(meterColumnAt(3840))

          expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
        })

        it('オフセットが 120 のとき、3 小節目 1 拍目の拍子変化点を右クリックして「プロジェクト情報」ボタンを押すと、「プロジェクト情報」ダイアログの「オフセット (ms)」は、120 のままになる', async () => {
          const app = await startApp()
          await app.loadChart([], undefined, {
            offsetMs: 120,
            meter: [
              { tick: 0, num: 3, den: 4 },
              { tick: 3840, num: 6, den: 8 },
            ],
          })
          await rightClickRemovingMeterChange(app, 3840)

          await app.projectInfo.open()

          expect(app.projectInfo.offsetInput()).toHaveDisplayValue('120')
        })
      })

      it('拍子が 1 小節目 1 拍目の 3/4、3 小節目 1 拍目の 6/8、5 小節目 1 拍目の 2/4 のとき、5 小節目 1 拍目、3 小節目 1 拍目の順に拍子変化点を右クリックして削除し、「元に戻す」ボタンを押すと、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」「3 小節目 1 拍目 6/8」だけになる', async () => {
        const app = await startWithMeter34And68At3840And24At7680()
        await rightClickRemovingMeterChange(app, 7680)
        await rightClickRemovingMeterChange(app, 3840)

        await pressUndo(app)

        expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4', '3 小節目 1 拍目 6/8'])
      })
    })

    describe('異常系', () => {
      it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、1 小節目 1 拍目の拍子変化点を右クリックしても、削除されず、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」だけのままになる', async () => {
        const app = await startWithMeter34()

        await app.timeline.rightClick(meterColumnAt(0))

        expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4'])
      })

      it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、1 小節目 1 拍目の拍子変化点を右クリックすると、画面の下のメッセージに「先頭の拍子変化点は削除できません」が出る', async () => {
        const app = await startWithMeter34()

        await app.timeline.rightClick(meterColumnAt(0))

        expect(app.notice('先頭の拍子変化点は削除できません')).toBeInTheDocument()
      })
    })
  })
})

describe('[プロジェクト情報編集] 拍子の入力値の判定', () => {
  describe('異常系', () => {
    describe('拍子列の 2 小節目 1 拍目をクリックして出た入力欄の値を書き換えて、エンターキーを押す', () => {
      it.each([
        ['分母のない 3', '3'],
        ['分子が下限 1 を下回る 0/4', '0/4'],
        ['分子が上限 99 を上回る 100/4', '100/4'],
        ['分母が 2 未満の 4/1', '4/1'],
        ['分母が 2、4、8、16 以外の 4/3', '4/3'],
        ['分母が 16 を上回る 4/32', '4/32'],
        ['全角の「３/４」', '３/４'],
        ['空文字', ''],
      ])(
        '入力が %s のとき、入力欄に添えて出る理由は、「拍子は半角で「分子/分母」の形に、分子を 1 以上 99 以下の整数、分母を 2、4、8、16 のいずれかにして入力してください」になる',
        async (_given, entry) => {
          const app = await startApp()

          await addMeterChange(app, 3840, entry)

          expect(app.alertTexts()).toEqual([
            '拍子は半角で「分子/分母」の形に、分子を 1 以上 99 以下の整数、分母を 2、4、8、16 のいずれかにして入力してください',
          ])
        },
      )
    })
  })
})

describe('[プロジェクト情報編集] オフセット', () => {
  describe('正常系', () => {
    it('エディタを開いた直後に「プロジェクト情報」ボタンを押すと、「プロジェクト情報」ダイアログの「オフセット (ms)」は、0 になる', async () => {
      const app = await startApp()

      await app.projectInfo.open()

      expect(app.projectInfo.offsetInput()).toHaveDisplayValue('0')
    })
  })

  describe('オフセットの書き換え', () => {
    describe('正常系', () => {
      it('オフセットが 0 のとき、「プロジェクト情報」ダイアログの「オフセット (ms)」を 120、200 の順に書き換えて閉じ、「元に戻す」ボタンを 1 回押したあと「プロジェクト情報」ボタンを押すと、「プロジェクト情報」ダイアログの「オフセット (ms)」は、120 になる', async () => {
        const app = await startApp()
        await app.projectInfo.open()
        await setOffset(app, '120')
        await app.projectInfo.close()
        await app.projectInfo.open()
        await setOffset(app, '200')
        await app.projectInfo.close()
        await pressUndo(app)

        await app.projectInfo.open()

        expect(app.projectInfo.offsetInput()).toHaveDisplayValue('120')
      })

      it('エディタを開いた直後に、「プロジェクト情報」ダイアログの「オフセット (ms)」を -50.5 に書き換えて閉じ、「譜面書き出し」で書き出すと、書き出した譜面ファイルのオフセットは、-50.5 になる', async () => {
        const app = await startApp()
        await app.projectInfo.open()
        await setOffset(app, '-50.5')
        await app.projectInfo.close()

        const offsetMs = await exportOffsetMs(app)

        expect(offsetMs).toBe(-50.5)
      })

      it('テンポが 1 小節目 1 拍目の BPM 150 だけのとき、「プロジェクト情報」ダイアログの「オフセット (ms)」を 120 に書き換えて閉じても、テンポの代替コンテンツは、「1 小節目 1 拍目 BPM 150」だけのままになる', async () => {
        const app = await startWithTempo150()
        await app.projectInfo.open()
        await setOffset(app, '120')
        await app.projectInfo.close()

        expect(app.timeline.tempos()).toEqual(['1 小節目 1 拍目 BPM 150'])
      })

      it('拍子が 1 小節目 1 拍目の 3/4 だけのとき、「プロジェクト情報」ダイアログの「オフセット (ms)」を 120 に書き換えて閉じても、拍子の代替コンテンツは、「1 小節目 1 拍目 3/4」だけのままになる', async () => {
        const app = await startWithMeter34()
        await app.projectInfo.open()
        await setOffset(app, '120')
        await app.projectInfo.close()

        expect(app.timeline.meters()).toEqual(['1 小節目 1 拍目 3/4'])
      })
    })

    describe('異常系', () => {
      it('オフセットが 120 のとき、「プロジェクト情報」ダイアログの「オフセット (ms)」を - に書き換えてエンターキーを押して閉じ、「譜面書き出し」で書き出すと、誤った入力は反映されず、書き出した譜面ファイルのオフセットは、120 のままになる', async () => {
        const app = await startApp()
        await app.loadChart([], undefined, { offsetMs: 120 })
        await app.projectInfo.open()
        await enterInvalidOffset(app, '-')
        await app.projectInfo.close()

        const offsetMs = await exportOffsetMs(app)

        expect(offsetMs).toBe(120)
      })

      it('「プロジェクト情報」ダイアログの「オフセット (ms)」を - に書き換えてエンターキーを押すと、入力欄が閉じず、「オフセット (ms)」にフォーカスが残る', async () => {
        const app = await startApp()
        await app.projectInfo.open()
        await enterInvalidOffset(app, '-')

        expect(app.projectInfo.offsetInput()).toHaveFocus()
      })

      it('「プロジェクト情報」ダイアログの「オフセット (ms)」を - に書き換えてエンターキーを押したあと、150 に直して閉じ、「譜面書き出し」で書き出すと、書き出した譜面ファイルのオフセットは、150 になる', async () => {
        const app = await startApp()
        await app.projectInfo.open()
        await enterInvalidOffset(app, '-')
        await setOffset(app, '150')
        await app.projectInfo.close()

        const offsetMs = await exportOffsetMs(app)

        expect(offsetMs).toBe(150)
      })

      describe('「プロジェクト情報」ダイアログの「オフセット (ms)」を書き換えて、エンターキーを押す', () => {
        it.each([
          ['-', '-'],
          ['空文字', ''],
        ])('入力が %s のとき、入力欄の下に「オフセットは数値で入力してください」が出る', async (_given, entry) => {
          const app = await startApp()
          await app.projectInfo.open()

          await app.projectInfo.enterOffset(entry)

          expect(within(app.projectInfo.dialog()!).getByText('オフセットは数値で入力してください')).toBeInTheDocument()
        })
      })
    })
  })
})

describe('[プロジェクト情報編集] 曲名', () => {
  describe('「プロジェクト情報」ダイアログの「曲名」の入力欄への入力', () => {
    describe('正常系', () => {
      it.each([
        { given: '日本語の「テスト曲」を入力すると', entry: 'テスト曲' },
        { given: '100 文字を入力すると', entry: 'あ'.repeat(100) },
      ])('$given、入力欄の下にメッセージは表示されない', async ({ entry }) => {
        const app = await startApp()
        await app.projectInfo.open()

        await app.projectInfo.enterSongName(entry)

        expect(app.projectInfo.songNameMessage()).toBeNull()
      })
    })

    describe('異常系', () => {
      it.each([
        { given: '半角の空白だけを入力すると', entry: '   ', message: '曲名を入力してください' },
        {
          given: '101 文字を入力すると',
          entry: 'あ'.repeat(101),
          message: '曲名は 100 文字以内にしてください (今は 101 文字です)',
        },
      ])('$given、入力欄の下に「$message」が表示される', async ({ entry, message }) => {
        const app = await startApp()
        await app.projectInfo.open()

        await app.projectInfo.enterSongName(entry)

        expect(app.projectInfo.songNameMessage()).toBe(message)
      })
    })
  })
})
