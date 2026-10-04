import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { startApp, type AppDriver, type StartAppOptions } from '../../test/app.tsx'
import { createAudioFile } from '../../test/fakeAudio.ts'
import {
  advanceClock,
  allowAudioFeatures,
  enterPreview,
  expectEditorScreen,
  expectPreviewScreen,
  expectStartFailureNotice,
  failResumeRequest,
  moveFocusToPage,
  pressKey,
  rememberTick1920,
  rememberTick5000,
  restartPreviewAfter,
  scrollEditor,
  scrollPreview,
  turnClickSoundOn,
  wheelPreviewTimes,
  zoomEditor,
} from './preview.helpers.ts'
import { at } from '../../test/timeline.ts'

type Arrangement = (app: AppDriver) => Promise<void>

const NOTICE_WHEN_AUDIO_CONTEXT_FAILS =
  'プレビューを始められませんでした: 音声を再生する機能を作れませんでした。ページを読み込み直してから、もう一度お試しください'
const START_FAILURE_NOTICE_CONTEXT =
  'プレビューを始められませんでした: 音声の再生を再開できませんでした。もう一度プレビューを押してください'
const NOTICE_WHEN_STRETCH_FAILS =
  'プレビューを始められませんでした: 音源をピッチを保ったまま 0.5 倍速で再生する準備ができませんでした。音源を読み込み直してから、もう一度プレビューを押してください'
const NOTICE_WHEN_FIRST_CLICK_SOUND_FAILS =
  'プレビューを始められませんでした: クリック音を鳴らせませんでした。クリック音を OFF にするか、もう一度プレビューを押してください'

type StartFailure = readonly [string, string, Arrangement]

const START_FAILURES: ReadonlyArray<StartFailure> = [
  [
    'ブラウザの音声再生機能の作成が失敗するとき',
    NOTICE_WHEN_AUDIO_CONTEXT_FAILS,
    async (app) => {
      app.audio.failContextCreation()
    },
  ],
  [
    'ブラウザの音声再生の再開が失敗するとき',
    START_FAILURE_NOTICE_CONTEXT,
    async (app) => {
      app.audio.failResume()
    },
  ],
  [
    '音源を読み込んであり、音源を 0.5 倍速で再生する準備が失敗するとき',
    NOTICE_WHEN_STRETCH_FAILS,
    async (app) => {
      await app.files.chooseAudio(createAudioFile('song.mp3'))
      app.audio.failStretchCreation()
    },
  ],
  [
    'クリック音が ON で、再生位置が 1 小節目 1 拍目で、プレビューの開始時の最初のクリック音の発音が失敗するとき',
    NOTICE_WHEN_FIRST_CLICK_SOUND_FAILS,
    async (app) => {
      await turnClickSoundOn(app)
      app.audio.failClickSound({ times: 1 })
    },
  ],
]

const CLICK_SOUND_STOPS_PREVIEW_NOTICE =
  'クリック音を鳴らせなくなったため、プレビューを止めました。クリック音を OFF にするか、もう一度プレビューを押してください'

interface HiddenElement {
  readonly element: string
  readonly options?: StartAppOptions
  readonly locate: () => HTMLElement
}

const HIDDEN_ELEMENTS: ReadonlyArray<HiddenElement> = [
  { element: '右のパネルの「ファイル」ボタン', locate: () => screen.getByRole('button', { name: 'ファイル' }) },
  { element: '右のパネルの「グリッド分割」のラベル', locate: () => screen.getByText('グリッド分割') },
  {
    element: '右のパネルの「グリッド分割」の選択欄',
    locate: () => screen.getByRole('combobox', { name: 'グリッド分割' }),
  },
  { element: '右のパネルの音源の名前「音源が未読み込みです」', locate: () => screen.getByText('音源が未読み込みです') },
  { element: 'タイムラインの右端のスクロールバー', locate: () => screen.getByRole('scrollbar') },
  {
    element: 'タイムラインの代替コンテンツの「スクロール位置 1 小節目 1 拍目」',
    locate: () => screen.getByText('スクロール位置 1 小節目 1 拍目'),
  },
  {
    element: 'クラウドの設定があるときの右のパネルの「ログイン」ボタン',
    options: { cloud: { configured: true } },
    locate: () => screen.getByRole('button', { name: 'ログイン' }),
  },
]

async function startPreviewAndReturnToEditorBeforeResume(): Promise<AppDriver> {
  const app = await startApp()
  app.audio.deferResume()
  await app.selectTab('プレビュー')
  await app.selectTab('エディタ')
  return app
}

async function startPreviewTwiceWithEditorBetween(): Promise<AppDriver> {
  const app = await startApp()
  app.audio.deferResume()
  await app.selectTab('プレビュー')
  await app.selectTab('エディタ')
  await app.selectTab('プレビュー')
  return app
}

async function arrangeClickSoundFailure(): Promise<AppDriver> {
  const app = await startApp()
  await app.loadChart([{ type: 'tap', tick: 5760, lane: 2 }])
  await rememberTick5000(app)
  await turnClickSoundOn(app)
  app.audio.failClickSound({ times: 1 })
  await app.selectTab('プレビュー')
  await advanceClock(app, 0.1)
  expect(app.notice(CLICK_SOUND_STOPS_PREVIEW_NOTICE), 'クリック音の発音の失敗が起きていません').toBeInTheDocument()
  return app
}

const leaveAsIs: Arrangement = async () => {}

describe('[プレビュー] プレビューの再生', () => {
  describe('「プレビュー」タブの選択', () => {
    describe('正常系', () => {
      it('再生位置が 1 小節目 1 拍目のとき、「プレビュー」タブを選ぶと、「プレビュー」タブが選択され、プレビューの代替コンテンツに「再生位置 1 小節目 1 拍目」が出て、エディタの画面は出ない', async () => {
        const app = await startApp()

        await app.selectTab('プレビュー')

        expectPreviewScreen(app, '1 小節目 1 拍目')
      })

      it.each<{
        readonly given: string
        readonly seconds: number
        readonly expectedPosition: string
        readonly arrange: Arrangement
      }>([
        {
          given: '再生位置が 1 小節目 1 拍目のとき',
          seconds: 0.1,
          expectedPosition: '1 小節目 1 拍目',
          arrange: leaveAsIs,
        },
        {
          given: '再生位置が 1 小節目 1 拍目のとき',
          seconds: 2.25,
          expectedPosition: '1 小節目 3 拍目',
          arrange: leaveAsIs,
        },
        {
          given: '再生位置が 2 小節目 2 拍目の 5/24 拍後のとき',
          seconds: 2.25,
          expectedPosition: '2 小節目 4 拍目の 5/24 拍後',
          arrange: rememberTick5000,
        },
      ])(
        '$given、「プレビュー」タブを選んで BPM 120・0.5 倍速で開始 $seconds 秒後に、プレビューの代替コンテンツに「再生位置 $expectedPosition」が出る',
        async ({ seconds, expectedPosition, arrange }) => {
          const app = await startApp()
          await arrange(app)

          await app.selectTab('プレビュー')
          await advanceClock(app, seconds)

          expect(app.preview.items()).toContain(`再生位置 ${expectedPosition}`)
        },
      )

      it('再生位置が 1 小節目 3 拍目のとき、エディタを上へ 100 ピクセルスクロールしてから「プレビュー」タブを選ぶと、エディタのスクロールは再生位置に影響せず、プレビューの代替コンテンツに「再生位置 1 小節目 3 拍目」が出る', async () => {
        const app = await startApp()
        await rememberTick1920(app)

        await scrollEditor(app, 'up', 100)
        await app.selectTab('プレビュー')

        expect(app.preview.items()).toContain('再生位置 1 小節目 3 拍目')
      })
    })
  })

  describe('プレビューのやり直し', () => {
    describe('正常系', () => {
      it.each<{
        readonly given: string
        readonly options: StartAppOptions
        readonly seconds: number
        readonly expectedPosition: string
        readonly arrange: Arrangement
      }>([
        {
          given: '再生位置が 1 小節目 1 拍目のとき',
          options: {},
          seconds: 0.1,
          expectedPosition: '1 小節目 1 拍目',
          arrange: leaveAsIs,
        },
        {
          given: '再生位置が 1 小節目 1 拍目のとき',
          options: {},
          seconds: 2.25,
          expectedPosition: '1 小節目 3 拍目',
          arrange: leaveAsIs,
        },
        {
          given: '小節数が 1 で、再生位置が 1 小節目 1 拍目のとき',
          options: { barCount: 1 },
          seconds: 6.25,
          expectedPosition: '2 小節目 1 拍目',
          arrange: leaveAsIs,
        },
        {
          given: '再生位置が 1 小節目 3 拍目のとき',
          options: {},
          seconds: 2.25,
          expectedPosition: '2 小節目 1 拍目',
          arrange: rememberTick1920,
        },
      ])(
        '$given、「プレビュー」タブを選んで BPM 120・0.5 倍速で $seconds 秒後に「エディタ」タブへ戻り、もう一度「プレビュー」タブを選ぶと、プレビューの代替コンテンツに「再生位置 $expectedPosition」が出る',
        async ({ options, seconds, expectedPosition, arrange }) => {
          const app = await startApp(options)
          await arrange(app)

          await restartPreviewAfter(app, seconds)

          expect(app.preview.items()).toContain(`再生位置 ${expectedPosition}`)
        },
      )
    })

    describe('異常系', () => {
      it('前回のプレビューが音声再生の再開に失敗したあと、音声が使えるようになったとき、「プレビュー」タブを選んで BPM 120・0.5 倍速で 2.25 秒後に「エディタ」タブへ戻り、もう一度「プレビュー」タブを選ぶと、プレビューの代替コンテンツに「再生位置 1 小節目 3 拍目」が出る', async () => {
        const app = await startApp()
        app.audio.failResume()
        await app.selectTab('プレビュー')
        expectStartFailureNotice(app)
        allowAudioFeatures()

        await restartPreviewAfter(app, 2.25)

        expect(app.preview.items()).toContain('再生位置 1 小節目 3 拍目')
      })
    })
  })

  describe('プレビューの上でのホイール操作', () => {
    describe('正常系', () => {
      it.each<readonly [string, Arrangement]>([
        ['エディタをズームしていないとき', leaveAsIs],
        ['エディタで Ctrl を押しながらホイールを上へ回してズームインしたとき', (app) => zoomEditor(app, 'in')],
      ])(
        '%s、「プレビュー」タブを選び、開始が終わる前にホイールを上へ 100 ピクセル回すと、プレビューの代替コンテンツに「再生位置 1 小節目 1 拍目の 833/960 拍後」が出る',
        async (_given, arrange) => {
          const app = await startApp()
          await arrange(app)
          app.audio.deferResume()

          await app.selectTab('プレビュー')
          await scrollPreview(app, 'up', 100)

          expect(app.preview.items()).toContain('再生位置 1 小節目 1 拍目の 833/960 拍後')
        },
      )

      it('「プレビュー」タブを選んで BPM 120・0.5 倍速で開始 2.25 秒後に、ホイールを上へ 100 ピクセル回すと、プレビューの代替コンテンツに「再生位置 1 小節目 3 拍目の 833/960 拍後」が出る', async () => {
        const app = await startApp()

        await app.selectTab('プレビュー')
        await advanceClock(app, 2.25)
        await scrollPreview(app, 'up', 100)

        expect(app.preview.items()).toContain('再生位置 1 小節目 3 拍目の 833/960 拍後')
      })

      it('「プレビュー」タブを選んで BPM 120・0.5 倍速で開始 2.25 秒後に、ホイールを下へ 100 ピクセル回すと、プレビューの代替コンテンツに「再生位置 1 小節目 2 拍目の 127/960 拍後」が出る', async () => {
        const app = await startApp()

        await app.selectTab('プレビュー')
        await advanceClock(app, 2.25)
        await scrollPreview(app, 'down', 100)

        expect(app.preview.items()).toContain('再生位置 1 小節目 2 拍目の 127/960 拍後')
      })

      it('「プレビュー」タブを選んで BPM 120・0.5 倍速で 2.25 秒後にホイールを上へ 100 ピクセル回し、さらに 2.25 秒後に、プレビューの代替コンテンツに「再生位置 2 小節目 1 拍目の 833/960 拍後」が出る', async () => {
        const app = await startApp()

        await app.selectTab('プレビュー')
        await advanceClock(app, 2.25)
        await scrollPreview(app, 'up', 100)
        await advanceClock(app, 2.25)

        expect(app.preview.items()).toContain('再生位置 2 小節目 1 拍目の 833/960 拍後')
      })

      it('エディタを上へ 100 ピクセルスクロールしてスクロール位置が 1 小節目 1 拍目の 833/960 拍後のとき、「プレビュー」タブを選んで開始 0.1 秒後にホイールを上へ 100 ピクセル回し、「エディタ」タブへ戻っても、プレビューのホイール操作はエディタのスクロール位置に影響せず、タイムラインの代替コンテンツは「スクロール位置 1 小節目 1 拍目の 833/960 拍後」のままになる', async () => {
        const app = await startApp()
        await scrollEditor(app, 'up', 100)

        await app.selectTab('プレビュー')
        await advanceClock(app, 0.1)
        await scrollPreview(app, 'up', 100)
        await app.selectTab('エディタ')

        expectEditorScreen(app, '1 小節目 1 拍目の 833/960 拍後')
      })

      it('小節数が 1 のとき、「プレビュー」タブを選んで開始 0.1 秒後にホイールを上へ 100 ピクセルずつ 4 回回すと、プレビューの代替コンテンツに「再生位置 1 小節目 4 拍目の 151/320 拍後」が出る', async () => {
        const app = await startApp({ barCount: 1 })

        await app.selectTab('プレビュー')
        await advanceClock(app, 0.1)
        await wheelPreviewTimes(app, 'up', 100, 4)

        expect(app.preview.items()).toContain('再生位置 1 小節目 4 拍目の 151/320 拍後')
      })
    })

    describe('異常系', () => {
      it('「プレビュー」タブを選んで開始 0.1 秒後に、ホイールを下へ 100 ピクセル回しても、1 小節目 1 拍目より前へは戻れず、プレビューの代替コンテンツは「再生位置 1 小節目 1 拍目」のままになる', async () => {
        const app = await startApp()

        await app.selectTab('プレビュー')
        await advanceClock(app, 0.1)
        await scrollPreview(app, 'down', 100)

        expect(app.preview.items()).toContain('再生位置 1 小節目 1 拍目')
      })

      it('小節数が 1 のとき、「プレビュー」タブを選んで開始 0.1 秒後にホイールを上へ 100 ピクセルずつ 5 回回しても、譜面の終わりの 2 小節目 1 拍目より先へは進まず、プレビューの代替コンテンツは「再生位置 2 小節目 1 拍目」で止まる', async () => {
        const app = await startApp({ barCount: 1 })

        await app.selectTab('プレビュー')
        await advanceClock(app, 0.1)
        await wheelPreviewTimes(app, 'up', 100, 5)

        expect(app.preview.items()).toContain('再生位置 2 小節目 1 拍目')
      })
    })
  })
})

describe('[プレビュー] プレビューの失敗時の画面の下のメッセージ', () => {
  describe('「プレビュー」タブの選択', () => {
    describe('異常系', () => {
      it.each(START_FAILURES)(
        '%s、「プレビュー」タブを選ぶと、画面の下のメッセージに「%s」が表示される',
        async (_given, notice, arrange) => {
          const app = await startApp()
          await arrange(app)

          await app.selectTab('プレビュー')

          expect(app.notice(notice)).toBeInTheDocument()
        },
      )

      it('クリック音が ON で、再生位置が 2 小節目 2 拍目の 5/24 拍後のとき、「プレビュー」タブを選んで開始 0.1 秒後に最初のクリック音の発音が失敗すると、画面の下のメッセージに「クリック音を鳴らせなくなったため、プレビューを止めました。クリック音を OFF にするか、もう一度プレビューを押してください」が表示される', async () => {
        const app = await arrangeClickSoundFailure()

        expect(app.notice(CLICK_SOUND_STOPS_PREVIEW_NOTICE)).toBeInTheDocument()
      })
    })
  })
})

describe('[プレビュー] プレビューの失敗時に表示される画面', () => {
  describe('「プレビュー」タブの選択', () => {
    describe('異常系', () => {
      it('ブラウザの音声再生機能の作成が失敗するとき、「プレビュー」タブを選ぶと、「エディタ」タブが選択されたまま、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出て、プレビューの画面は出ない', async () => {
        const app = await startApp()
        app.audio.failContextCreation()

        await app.selectTab('プレビュー')

        expectEditorScreen(app, '1 小節目 1 拍目')
      })

      it('「プレビュー」タブを選んだ音声再生の再開が終わる前に、「エディタ」タブを選んで戻したあと、その再開が失敗するとき、「エディタ」タブが選択されたまま、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出て、プレビューの画面は出ない', async () => {
        const app = await startPreviewAndReturnToEditorBeforeResume()

        await failResumeRequest(app, 0)

        expectEditorScreen(app, '1 小節目 1 拍目')
      })

      it('「プレビュー」タブを選んだ音声再生の再開が終わる前に、「エディタ」タブを選んで戻して、もう一度「プレビュー」タブを選んだあと、1 回目の再開が失敗するとき、「プレビュー」タブが選択されたまま、プレビューの代替コンテンツに「再生位置 1 小節目 1 拍目」が出て、エディタの画面は出ない', async () => {
        const app = await startPreviewTwiceWithEditorBetween()

        await failResumeRequest(app, 0)

        expectPreviewScreen(app, '1 小節目 1 拍目')
      })

      it('クリック音が ON で、再生位置が 2 小節目 2 拍目の 5/24 拍後のとき、「プレビュー」タブを選んで開始 0.1 秒後に最初のクリック音の発音が失敗すると、「エディタ」タブが選択され、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出て、プレビューの画面は出ない', async () => {
        const app = await arrangeClickSoundFailure()

        expectEditorScreen(app, '1 小節目 1 拍目')
      })
    })
  })
})

describe('[プレビュー] プレビューの画面のノーツ数', () => {
  describe('「プレビュー」タブの選択', () => {
    describe('正常系', () => {
      it.each<readonly [string, number, Arrangement]>([
        ['空の譜面のとき', 0, leaveAsIs],
        [
          '1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツ 1 つのとき',
          1,
          (app) => app.loadChart([{ type: 'tap', tick: 480, lane: 2 }]),
        ],
        [
          'タップノーツ 1 つと、1 小節目 2 拍目から 1 小節目 3 拍目のロングノーツ 1 つのとき',
          2,
          (app) =>
            app.loadChart([
              { type: 'tap', tick: 480, lane: 2 },
              { type: 'long', tick: 960, lane: 1, path: [{ tick: 1920, lane: 1 }], end: 'release' },
            ]),
        ],
      ])(
        '%s、「プレビュー」タブを選ぶと、プレビューの代替コンテンツに「ノーツ %d 個」が出る',
        async (_given, count, arrange) => {
          const app = await startApp()
          await arrange(app)

          await app.selectTab('プレビュー')

          expect(app.preview.items()).toContain(`ノーツ ${count} 個`)
        },
      )
    })
  })
})

describe('[プレビュー] 「プレビュー」タブを選んだ画面で非表示になる要素', () => {
  describe('「プレビュー」タブの選択', () => {
    describe('正常系', () => {
      it.each(HIDDEN_ELEMENTS)(
        'エディタの画面で表示されている $element は、「プレビュー」タブを選ぶと画面に表示されなくなる',
        async ({ options, locate }) => {
          const app = await startApp(options)
          const element = locate()
          expect(element).toBeVisible()

          await app.selectTab('プレビュー')

          expect(element).not.toBeVisible()
        },
      )
    })
  })
})

describe('[プレビュー] 「プレビュー」タブを選んだ画面で表示される要素', () => {
  describe('「プレビュー」タブの選択', () => {
    describe('正常系', () => {
      it.each<readonly [string, (app: AppDriver) => HTMLElement | null]>([
        ['右のパネルの「クリック音」ボタン', (app) => app.button('クリック音')],
        ['画面上部の「エディタ」タブ', (app) => app.tab('エディタ')],
        ['ページ上部の「UniToccata Editor」', (app) => app.siteTitle()],
      ])('「プレビュー」タブを選ぶと、%sがプレビュー中も画面に表示される', async (_visible, locate) => {
        const app = await startApp()
        await enterPreview(app)

        expect(locate(app)).toBeVisible()
      })
    })
  })
})

describe('[プレビュー] クリック音ボタン', () => {
  describe('「クリック音」ボタンの押下', () => {
    describe('正常系', () => {
      it('プレビューの画面で「クリック音」ボタンが押されていないとき、「クリック音」ボタンを押すと、右のパネルの「クリック音」ボタンは押された状態で表示される', async () => {
        const app = await startApp()
        await app.selectTab('プレビュー')
        expect(app.button('クリック音')).toHaveAttribute('aria-pressed', 'false')

        await app.click(app.button('クリック音'))

        expect(app.button('クリック音')).toHaveAttribute('aria-pressed', 'true')
      })

      it('「クリック音」ボタンを押したあと、「エディタ」タブへ戻り、もう一度「プレビュー」タブを選ぶと、右のパネルの「クリック音」ボタンは押された状態で表示される', async () => {
        const app = await startApp()
        await app.selectTab('プレビュー')
        expect(app.button('クリック音')).toHaveAttribute('aria-pressed', 'false')

        await app.click(app.button('クリック音'))
        await app.selectTab('エディタ')
        await app.selectTab('プレビュー')

        expect(app.button('クリック音')).toHaveAttribute('aria-pressed', 'true')
      })
    })
  })

  describe('正常系', () => {
    it('プレビューの画面で右のパネルに「クリック音」ボタンが表示されているとき、「エディタ」タブを選ぶと、「クリック音」ボタンは表示されなくなり、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出る', async () => {
      const app = await startApp()
      await app.selectTab('プレビュー')
      expect(app.button('クリック音')).toBeInTheDocument()

      await app.selectTab('エディタ')

      expect(app.button('クリック音')).toBeNull()
      expectEditorScreen(app, '1 小節目 1 拍目')
    })
  })
})

describe('[プレビュー] プレビュー中のキー操作', () => {
  describe('プレビュー中のキーの押下', () => {
    describe('異常系', () => {
      it('1 小節目 1 拍目の 1/2 拍後・レーン 2 のタップノーツにマウスを置いてから「プレビュー」タブを選んで上向きの矢印キーを押し、「エディタ」タブを選んで戻っても、プレビュー中は上向きの矢印キーが効かず、譜面のノーツの代替コンテンツは「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」だけのままになる', async () => {
        const app = await startApp()
        await app.loadChart([{ type: 'tap', tick: 480, lane: 2 }])
        await moveFocusToPage(app)
        await app.timeline.hover(at(480, 2))
        await app.selectTab('プレビュー')
        await pressKey(app, '↑')

        await app.selectTab('エディタ')

        expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
      })

      it('タイムラインの 1 小節目 1 拍目の 1/2 拍後・レーン 2 をクリックしてタップノーツを置いてあるとき、「プレビュー」タブを選んで Ctrl+Z を押し、「エディタ」タブを選んで戻っても、プレビュー中は Ctrl+Z が効かず、譜面のノーツの代替コンテンツは「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」だけのままになる', async () => {
        const app = await startApp()
        await app.timeline.click(at(480, 2))
        await app.selectTab('プレビュー')

        await pressKey(app, 'Ctrl+Z')
        await app.selectTab('エディタ')

        expect(app.timeline.notes()).toEqual(['タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'])
      })

      it('1 小節目 1 拍目の 1/2 拍後・レーン 1 のタップノーツを範囲選択してあるとき、「プレビュー」タブを選んで Ctrl+C を押し、「エディタ」タブを選んで戻って 1 小節目 3 拍目・レーン 0 にマウスを置き Ctrl+V を押しても、プレビュー中の Ctrl+C ではコピーされず、画面の下のメッセージに「貼り付けるノーツがありません。ノーツを選択して、Ctrl+C (Mac は Cmd+C) でコピーしてください」が表示される', async () => {
        const app = await startApp()
        await app.loadChart([{ type: 'tap', tick: 480, lane: 1 }])
        await app.timeline.selectEnclosing([{ tick: 480, lane: 1 }])
        await app.selectTab('プレビュー')

        await pressKey(app, 'Ctrl+C')
        await app.selectTab('エディタ')
        await app.timeline.hover(at(1920, 0))
        await pressKey(app, 'Ctrl+V')

        expect(
          app.notice('貼り付けるノーツがありません。ノーツを選択して、Ctrl+C (Mac は Cmd+C) でコピーしてください'),
        ).toBeInTheDocument()
      })
    })
  })
})
