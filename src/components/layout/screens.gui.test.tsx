import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { startApp, type AppDriver } from '../../test/app.tsx'
import { startSignedIn, openSaveDialogWithNames, pressSave } from '../../test/cloud-storage-1.helpers.ts'
import { createAudioFile, createUndecodableAudioFile } from '../../test/fakeAudio.ts'
import { failWith } from '../../test/failures.ts'
import { createFirebaseError } from '../../test/fakeFirebase.ts'
import { createMidiFile, createUnreadableFile } from '../../test/files.ts'
import { enterNames } from '../../test/file-io.helpers.ts'
import { at } from '../../test/timeline.ts'

const TAP_480_LANE_2 = 'タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2'
const LOGIN_FAILURE_PREFIX = 'ログインできませんでした'

function expectGridDivision16(app: AppDriver): void {
  expect(app.timeline.items(), 'グリッド分割が 16 分になっていません').toContainEqual(
    expect.stringMatching(/^グリッド分割 16 分/),
  )
}

function expectEditorScreenShown(app: AppDriver): void {
  expect(app.tabIsSelected('エディタ'), '画面上部の「エディタ」タブが選択されていません').toBe(true)
  expect(
    app.timeline.items(),
    'タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出ていません',
  ).toContain('スクロール位置 1 小節目 1 拍目')
  expect(screen.queryByLabelText('プレビュー'), 'プレビューの代替コンテンツが出ています').not.toBeInTheDocument()
}

function expectPreviewScreenShown(app: AppDriver): void {
  expect(app.tabIsSelected('プレビュー'), '画面上部の「プレビュー」タブが選択されていません').toBe(true)
  expect(app.preview.items(), 'プレビューの代替コンテンツに「再生位置 1 小節目 1 拍目」が出ていません').toContain(
    '再生位置 1 小節目 1 拍目',
  )
  expect(screen.queryByLabelText('タイムライン'), 'タイムラインの代替コンテンツが出ています').not.toBeInTheDocument()
}

function rightPanel(): HTMLElement {
  return screen.getByRole('complementary')
}

async function startWithGrid16(): Promise<AppDriver> {
  const app = await startApp()
  expectGridDivision16(app)
  return app
}

async function startWithGrid16AndTapPlaced(): Promise<AppDriver> {
  const app = await startWithGrid16()
  await app.timeline.click(at(480, 2))
  expect(app.timeline.notes(), 'タップノーツが置かれていません').toEqual([TAP_480_LANE_2])
  return app
}

async function startWithTapAndHover(): Promise<AppDriver> {
  const app = await startWithGrid16AndTapPlaced()
  await app.timeline.hover(at(480, 2, { up: 3 }))
  return app
}

async function startWithGrid16AndTapPlacedAndMidiDialogOpen(): Promise<AppDriver> {
  const app = await startWithGrid16AndTapPlaced()
  await chooseSampleMidi(app)
  return app
}

async function chooseSampleMidi(app: AppDriver): Promise<void> {
  await app.files.chooseMidi(
    createMidiFile('sample.mid', {
      ticksPerQuarter: 480,
      notes: [{ tick: 480, pitch: 'C3', velocity: 100, durationTicks: 240 }],
    }),
  )
  expect(app.midiDialog.dialog(), '「MIDI を取り込む」ダイアログが開いていません').toBeInTheDocument()
}

async function startWithMidiDialogOpen(): Promise<AppDriver> {
  const app = await startApp()
  await chooseSampleMidi(app)
  return app
}

async function startWithProjectInfoOpen(): Promise<AppDriver> {
  const app = await startApp()
  await app.projectInfo.open()
  expect(app.dialog('プロジェクト情報'), '「プロジェクト情報」ダイアログが開いていません').toBeInTheDocument()
  return app
}

async function startWithChartSettingsOpen(): Promise<AppDriver> {
  const app = await startApp()
  await app.chartSettings.open()
  expect(app.dialog('譜面設定'), '「譜面設定」ダイアログが開いていません').toBeInTheDocument()
  return app
}

async function startWithGrid16AndTapPlacedAndLoadingAudio(): Promise<AppDriver> {
  const app = await startWithGrid16AndTapPlaced()
  app.audio.deferDecoding()
  await app.files.chooseAudio(createAudioFile('song.mp3'))
  expect(app.text('音源を読み込み中です'), '音源の読み込み中になっていません').toBeInTheDocument()
  return app
}

async function openAboutDialog(app: AppDriver): Promise<void> {
  await app.click(within(rightPanel()).getByRole('button', { name: 'このアプリについて' }))
  expect(app.dialog('このアプリについて'), '「このアプリについて」ダイアログが開いていません').toBeInTheDocument()
}

async function openLegalDialog(app: AppDriver, linkName: string): Promise<void> {
  await openAboutDialog(app)
  await app.click(within(dialogNamed(app, 'このアプリについて')).getByRole('link', { name: linkName }))
}

async function startWithLegalDialog(linkName: string): Promise<AppDriver> {
  const app = await startApp()
  await openLegalDialog(app, linkName)
  expect(app.dialog(linkName), `「${linkName}」ダイアログが開いていません`).toBeInTheDocument()
  return app
}

async function startWithGrid16AndTapPlacedAndLegalDialogOpen(linkName: string): Promise<AppDriver> {
  const app = await startWithGrid16AndTapPlaced()
  await openLegalDialog(app, linkName)
  expect(app.dialog(linkName), `「${linkName}」ダイアログが開いていません`).toBeInTheDocument()
  return app
}

async function startWithLoginDialog(): Promise<AppDriver> {
  const app = await startApp({ cloud: { configured: true } })
  await app.click(app.button('ログイン'))
  expect(app.dialog('ログイン'), '「ログイン」ダイアログが開いていません').toBeInTheDocument()
  expect(app.button('Google でログイン')).toBeEnabled()
  return app
}

function dialogNamed(app: AppDriver, name: string): HTMLElement {
  return app.dialog(name) ?? failWith(new Error(`「${name}」ダイアログが開いていません`))
}

function expectEditorBehindDialog(app: AppDriver): void {
  expect(app.button('ファイル'), '右のパネルの「ファイル」ボタンが表示されていません').toBeInTheDocument()
  expect(
    app.timeline.items(),
    'タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出ていません',
  ).toContain('スクロール位置 1 小節目 1 拍目')
}

async function startWithSavingInProgress(): Promise<AppDriver> {
  const app = await startSignedIn()
  app.cloudFaults.pendOperation('firestore-write')
  await openSaveDialogWithNames(app, 'テスト曲', '譜面1')
  await pressSave(app)
  expect(app.text('保存中です'), '保存中になっていません').toBeInTheDocument()
  return app
}

const DIALOG_CLOSE_OPERATIONS: readonly (readonly [string, (app: AppDriver, dialogName: string) => Promise<void>])[] = [
  [
    '右上の「ダイアログを閉じる」ボタンを押すと',
    (app, dialogName) =>
      app.click(within(dialogNamed(app, dialogName)).getByRole('button', { name: 'ダイアログを閉じる' })),
  ],
  ['エスケープキーを押すと', (app) => app.press('Escape')],
  ['ダイアログの外側 (暗い背景) をクリックすると', (app, dialogName) => app.click(app.dialogBackdrop(dialogName))],
]

async function pressGoogleSignIn(app: AppDriver): Promise<void> {
  await app.click(app.button('Google でログイン'))
}

async function pressGoogleSignInKeepingPending(
  app: AppDriver,
): Promise<ReturnType<AppDriver['cloudFaults']['pendSignIn']>> {
  const pendingSignIns = app.cloudFaults.pendSignIn()
  await pressGoogleSignIn(app)
  expect(app.button('Google でログイン'), 'ログインが終わっていない状態になっていません').toBeDisabled()
  return pendingSignIns
}

async function pressGoogleSignInFailingWith(app: AppDriver, error: Error): Promise<void> {
  app.cloudFaults.failSignIn(error)
  await pressGoogleSignIn(app)
  expect(app.alertTexts(), 'ログインの失敗が表示されていません').toContainEqual(
    expect.stringContaining(LOGIN_FAILURE_PREFIX),
  )
}

async function startWithFileMenuOpen(): Promise<AppDriver> {
  const app = await startApp()
  await app.fileMenu.open()
  expect(app.fileMenu.heading('インポート'), 'メニューが開いていません').toBeInTheDocument()
  return app
}

async function startInPreview(): Promise<AppDriver> {
  const app = await startApp()
  await app.selectTab('プレビュー')
  expectPreviewScreenShown(app)
  return app
}

async function startWithLoadingAudio(): Promise<AppDriver> {
  const app = await startApp()
  app.audio.deferDecoding()
  await app.files.chooseAudio(createAudioFile('song.mp3'))
  expect(app.text('音源を読み込み中です'), '音源の読み込み中になっていません').toBeInTheDocument()
  return app
}

function createBrokenAudio(): File {
  return createUndecodableAudioFile('broken.mp3')
}

function createBigAudio(): File {
  return createAudioFile('big.mp3', { sizeBytes: 52428801 })
}

function createUnreadableAudio(): File {
  return createUnreadableFile('unreadable.mp3')
}

async function startWithTapHoveredAndMenuOpenedByEnter(): Promise<AppDriver> {
  const app = await startWithTapAndHover()
  await app.focus(screen.getByRole('button', { name: 'ファイル' }))
  await app.press('Enter')
  expect(app.fileMenu.heading('インポート'), 'メニューが開いていません').toBeInTheDocument()
  expect(app.fileMenu.item('音源'), '「音源」に最初からフォーカスがあります').not.toHaveFocus()
  return app
}

async function startWithExportItemFocused(): Promise<AppDriver> {
  const app = await startApp()
  await enterNames(app, 'テスト曲', '譜面1')
  await app.fileMenu.open()
  await app.focus(screen.getByRole('menuitem', { name: '譜面書き出し' }))
  expect(app.downloads.all(), 'ダウンロード済みのファイルがあります').toHaveLength(0)
  return app
}

describe('[モードの切り替え] モードのタブ', () => {
  describe('モードのタブの押下', () => {
    describe('正常系', () => {
      it.each<readonly [string, 'エディタ' | 'プレビュー', string, (app: AppDriver) => void, () => Promise<AppDriver>]>(
        [
          [
            'エディタモードのとき',
            'プレビュー',
            '画面上部の「プレビュー」タブが選択され、プレビューの代替コンテンツに「再生位置 1 小節目 1 拍目」が出て、タイムラインの代替コンテンツは出なくなる',
            expectPreviewScreenShown,
            () => startApp(),
          ],
          [
            'プレビューモードのとき',
            'エディタ',
            '画面上部の「エディタ」タブが選択され、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出て、プレビューの代替コンテンツは出なくなる',
            expectEditorScreenShown,
            startInPreview,
          ],
          [
            '音源 song.mp3 の読み込みが終わったとき',
            'プレビュー',
            '画面上部の「プレビュー」タブが選択され、プレビューの代替コンテンツに「再生位置 1 小節目 1 拍目」が出て、タイムラインの代替コンテンツは出なくなる',
            expectPreviewScreenShown,
            async (): Promise<AppDriver> => {
              const app = await startApp()
              await app.files.chooseAudio(createAudioFile('song.mp3'))
              return app
            },
          ],
        ],
      )('%s、画面上部の「%s」タブを押すと、%s', async (_given, clickedTab, _then, expectScreenShown, start) => {
        const app = await start()

        await app.selectTab(clickedTab)

        expectScreenShown(app)
      })

      describe('画面上部の「プレビュー」タブを押す', () => {
        it.each<[string, () => Promise<AppDriver>]>([
          ['音源 song.mp3 の読み込みが終わっていないとき', startWithLoadingAudio],
          ['「MIDI を取り込む」ダイアログが開いているとき', startWithMidiDialogOpen],
        ])(
          '%s、モードは切り替わらず、画面上部の「エディタ」タブが選択されたまま、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出て、プレビューの代替コンテンツは出ない',
          async (_given, start) => {
            const app = await start()
            expectEditorScreenShown(app)

            await app.clickInBackground(app.tab('プレビュー'))

            expectEditorScreenShown(app)
          },
        )
      })
    })
  })

  describe('正常系', () => {
    it('アプリを起動すると、画面上部の「エディタ」タブが選択され、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出て、プレビューの代替コンテンツは出ない', async () => {
      const app = await startApp()

      expectEditorScreenShown(app)
    })
  })
})

describe('[キー操作] キーボードの操作', () => {
  describe('Ctrl+Z の押下', () => {
    describe('正常系', () => {
      it('タップノーツを 1 小節目 1 拍目の 1/2 拍後・レーン 2 に置いたあと、「利用規約」ダイアログが開いている間に Ctrl+Z を押しても、元に戻す操作が効かず、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」が出たままになる', async () => {
        const app = await startWithGrid16AndTapPlacedAndLegalDialogOpen('利用規約')

        await app.press('Ctrl+Z')

        expect(app.timeline.notes()).toEqual([TAP_480_LANE_2])
      })

      it('タップノーツを 1 小節目 1 拍目の 1/2 拍後・レーン 2 に置いてあり、音源の読み込みが終わっていないとき、Ctrl+Z を押しても、読み込み中は元に戻す操作が効かず、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」が出たままになる', async () => {
        const app = await startWithGrid16AndTapPlacedAndLoadingAudio()

        await app.press('Ctrl+Z')

        expect(app.timeline.notes()).toEqual([TAP_480_LANE_2])
      })
    })
  })

  describe('エンターキーの押下', () => {
    describe('正常系', () => {
      it('曲名が「テスト曲」、譜面名が「譜面1」で、ファイルメニューの「譜面書き出し」にフォーカスがあるとき、エンターキーを押すと、ダウンロードされたファイルの名前は、譜面1.テスト曲.unitoccata.json になる', async () => {
        const app = await startWithExportItemFocused()

        await app.press('Enter')

        expect(app.downloads.all().map((file) => file.fileName)).toEqual(['譜面1.テスト曲.unitoccata.json'])
      })

      it('エディタモードで、ファイルメニューの「譜面書き出し」にフォーカスがあるとき、エンターキーを押しても、モードは切り替わらず、画面上部の「エディタ」タブが選択されたまま、タイムラインの代替コンテンツに「スクロール位置 1 小節目 1 拍目」が出て、プレビューの代替コンテンツは出ない', async () => {
        const app = await startWithExportItemFocused()

        await app.press('Enter')

        expectEditorScreenShown(app)
      })
    })
  })
})

describe('[プロジェクト情報] プロジェクト情報ダイアログ', () => {
  describe('「プロジェクト情報」ボタンの押下', () => {
    describe('正常系', () => {
      it.each<readonly [string, (dialog: ReturnType<typeof within>) => HTMLElement | null]>([
        ['「曲名」', (dialog) => dialog.queryByText('曲名')],
        ['「オフセット (ms)」', (dialog) => dialog.queryByText('オフセット (ms)')],
        ['「小節数」', (dialog) => dialog.queryByText('小節数')],
        ['「閉じる」', (dialog) => dialog.queryByRole('button', { name: '閉じる' })],
      ])(
        '右のパネルの「プロジェクト情報」ボタンを押すと、「プロジェクト情報」ダイアログに%sが表示される',
        async (_label, locate) => {
          await startWithProjectInfoOpen()

          expect(locate(within(screen.getByRole('dialog', { name: 'プロジェクト情報' })))).toBeInTheDocument()
        },
      )
    })
  })

  describe('正常系', () => {
    it('「プロジェクト情報」ダイアログが開いているとき、「閉じる」を押すと、画面に「プロジェクト情報」ダイアログが表示されなくなる', async () => {
      const app = await startWithProjectInfoOpen()

      await app.projectInfo.close()

      expect(app.dialog('プロジェクト情報')).not.toBeInTheDocument()
    })
  })
})

describe('[譜面設定] 譜面設定ダイアログ', () => {
  describe('「譜面設定」ボタンの押下', () => {
    describe('正常系', () => {
      it.each<readonly [string, (dialog: ReturnType<typeof within>) => HTMLElement | null]>([
        ['「譜面名」', (dialog) => dialog.queryByText('譜面名')],
        ['「レーン数」', (dialog) => dialog.queryByText('レーン数')],
        ['「閉じる」', (dialog) => dialog.queryByRole('button', { name: '閉じる' })],
      ])('右のパネルの「譜面設定」ボタンを押すと、「譜面設定」ダイアログに%sが表示される', async (_label, locate) => {
        await startWithChartSettingsOpen()

        expect(locate(within(screen.getByRole('dialog', { name: '譜面設定' })))).toBeInTheDocument()
      })
    })
  })

  describe('正常系', () => {
    it('「譜面設定」ダイアログが開いているとき、「閉じる」を押すと、画面に「譜面設定」ダイアログが表示されなくなる', async () => {
      const app = await startWithChartSettingsOpen()

      await app.chartSettings.close()

      expect(app.dialog('譜面設定')).not.toBeInTheDocument()
    })
  })
})

describe('[右のパネル] ボタンの並び', () => {
  describe('正常系', () => {
    it.each<readonly [string, () => Promise<AppDriver>, string, readonly string[]]>([
      [
        'ログインしていないとき',
        () => startApp({ cloud: { configured: true } }),
        '「ファイル」「プロジェクト情報」「譜面設定」「ログイン」',
        ['ファイル', 'プロジェクト情報', '譜面設定', 'ログイン'],
      ],
      [
        'ログインしているとき',
        () => startApp({ cloud: { configured: true, signedInAs: 'alice' } }),
        '「ファイル」「プロジェクト情報」「譜面設定」「ログアウト」',
        ['ファイル', 'プロジェクト情報', '譜面設定', 'ログアウト'],
      ],
    ])('%s、右のパネルの上から 4 つのボタンは、%sの順に並ぶ', async (_given, start, _label, buttons) => {
      await start()

      expect(
        within(rightPanel())
          .getAllByRole('button')
          .slice(0, 4)
          .map((panelButton) => panelButton.textContent),
      ).toEqual(buttons)
    })

    it('右のパネルの「このアプリについて」ボタンは、「操作説明」ボタンより下にある', async () => {
      await startApp()

      expect(
        within(rightPanel())
          .getByRole('button', { name: '操作説明' })
          .compareDocumentPosition(within(rightPanel()).getByRole('button', { name: 'このアプリについて' })) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })
  })
})

describe('[右のパネル] 表示されるボタン', () => {
  describe('正常系', () => {
    it('「プレビュー」タブを選んだ画面でも、右のパネルに「このアプリについて」ボタンがある', async () => {
      await startInPreview()

      expect(within(rightPanel()).getByRole('button', { name: 'このアプリについて' })).toBeInTheDocument()
    })
  })
})

describe('[操作説明] 操作説明ダイアログ', () => {
  describe('「操作説明」ボタンの押下', () => {
    describe('正常系', () => {
      it('「操作説明」ボタンを押すと、「操作説明」ダイアログに「ホイール: スクロール / Ctrl+ホイール: ズーム」が表示される', async () => {
        const app = await startApp()

        await app.click(app.button('操作説明'))

        expect(app.dialog('操作説明')).toHaveTextContent('ホイール: スクロール / Ctrl+ホイール: ズーム')
      })
    })
  })
})

describe('[このアプリについて] このアプリについてダイアログ', () => {
  describe('「このアプリについて」ボタンの押下', () => {
    describe('正常系', () => {
      it('右のパネルの「このアプリについて」ボタンを押すと、「このアプリについて」ダイアログが表示される', async () => {
        const app = await startApp()

        await openAboutDialog(app)

        expect(app.dialog('このアプリについて')).toBeInTheDocument()
      })
    })
  })

  describe('ダイアログのバージョンの表示', () => {
    describe('正常系', () => {
      it('ビルド時にバージョンが v1.2.3 と指定されているとき、「このアプリについて」ダイアログに「バージョン v1.2.3」が表示される', async () => {
        vi.stubEnv('VITE_BUILD_VERSION', 'v1.2.3')
        const app = await startApp()

        await openAboutDialog(app)

        expect(within(dialogNamed(app, 'このアプリについて')).getByText('バージョン v1.2.3')).toBeInTheDocument()
      })

      it('ビルド時にバージョンが指定されていないとき、「このアプリについて」ダイアログに「バージョン」の表示は出ない', async () => {
        vi.stubEnv('VITE_BUILD_VERSION', undefined)
        const app = await startApp()

        await openAboutDialog(app)

        expect(within(dialogNamed(app, 'このアプリについて')).queryByText(/バージョン/)).not.toBeInTheDocument()
      })
    })
  })
})

describe('[ファイルメニュー] ファイルメニューの項目', () => {
  describe('「ファイル」ボタンの押下', () => {
    describe('正常系', () => {
      it('右のパネルの「ファイル」ボタンを押すと、メニューの見出し「インポート」の下に「音源」「MIDI」「譜面」が表示される', async () => {
        const app = await startApp()

        await app.fileMenu.open()

        expect(
          within(screen.getByRole('group', { name: 'インポート' }))
            .getAllByRole('menuitem')
            .map((item) => item.textContent),
        ).toEqual(['音源', 'MIDI', '譜面'])
      })

      it('右のパネルの「ファイル」ボタンを押すと、メニューの項目は、上から「音源」「MIDI」「譜面」「譜面書き出し」「クラウドに保存」「クラウドから開く」の順に表示される', async () => {
        const app = await startApp()

        await app.fileMenu.open()

        expect(
          within(screen.getByRole('menu'))
            .getAllByRole('menuitem')
            .map((item) => item.textContent),
        ).toEqual(['音源', 'MIDI', '譜面', '譜面書き出し', 'クラウドに保存', 'クラウドから開く'])
      })
    })
  })
})

describe('[ファイルメニュー] クラウドの項目', () => {
  describe('正常系', () => {
    describe('クラウドの設定があり、ログインしていないとき', () => {
      it.each(['クラウドに保存', 'クラウドから開く'])(
        'ファイルメニューの「%s」を押すと、画面の下のメッセージに「クラウドを使うには、ログインしてください」が表示される',
        async (itemName) => {
          const app = await startApp({ cloud: { configured: true } })

          await app.fileMenu.choose(itemName)

          expect(app.notice('クラウドを使うには、ログインしてください')).toBeInTheDocument()
        },
      )
    })

    describe('クラウドの設定がないとき', () => {
      it.each(['クラウドに保存', 'クラウドから開く'])(
        '右のパネルの「ファイル」ボタンを押してメニューを開くと、「%s」は押せない状態で表示される',
        async (itemName) => {
          const app = await startApp()

          await app.fileMenu.open()

          expect(app.fileMenu.item(itemName)).toBeDisabled()
        },
      )
    })
  })
})

describe('[ファイルメニュー] ファイルメニューの閉じ方', () => {
  describe('正常系', () => {
    it('ファイルメニューが開いているとき、右のパネルの「ファイル」ボタンを押すと、メニューの「インポート」が表示されなくなる', async () => {
      const app = await startWithFileMenuOpen()

      await app.click(app.button('ファイル'))

      expect(app.fileMenu.heading('インポート')).not.toBeInTheDocument()
    })

    it('ファイルメニューが開いているとき、メニューの外 (右のパネルの「音源が未読み込みです」の表示) をクリックすると、メニューの「インポート」が表示されなくなる', async () => {
      const app = await startWithFileMenuOpen()

      await app.click(app.text('音源が未読み込みです'))

      expect(app.fileMenu.heading('インポート')).not.toBeInTheDocument()
    })

    it('ファイルメニューが開いているとき、エスケープキーを押すと、メニューの「インポート」が表示されなくなる', async () => {
      const app = await startWithFileMenuOpen()

      await app.press('Escape')

      expect(app.fileMenu.heading('インポート')).not.toBeInTheDocument()
    })

    it('ファイルメニューが開いているとき、メニューの「譜面書き出し」を押すと、メニューの「インポート」が表示されなくなる', async () => {
      const app = await startWithFileMenuOpen()

      await app.click(app.fileMenu.item('譜面書き出し'))

      expect(app.fileMenu.heading('インポート')).not.toBeInTheDocument()
    })
  })
})

describe('[ファイルメニュー] ファイルメニューのキー操作', () => {
  describe('正常系', () => {
    it('タップノーツ (1 小節目 1 拍目の 1/2 拍後・レーン 2) にマウスを置き、「ファイル」ボタンにフォーカスを当ててエンターキーでメニューを開いたあと、下向きの矢印キーを押すと、メニューの「音源」がフォーカスされた状態になる', async () => {
      const app = await startWithTapHoveredAndMenuOpenedByEnter()

      await app.press('↓')

      expect(app.fileMenu.item('音源')).toHaveFocus()
    })

    it('タップノーツ (1 小節目 1 拍目の 1/2 拍後・レーン 2) にマウスを置き、「ファイル」ボタンにフォーカスを当ててエンターキーでメニューを開いたあと、上向きの矢印キーを押しても、メニューの操作に使われ、ノーツは上フリックノーツに変わらず、譜面のノーツの代替コンテンツは「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」のままになる', async () => {
      const app = await startWithTapHoveredAndMenuOpenedByEnter()

      await app.press('↑')

      expect(app.timeline.notes()).toEqual([TAP_480_LANE_2])
    })
  })
})

describe('[音源の読み込み] 音源の読み込み', () => {
  describe('「ファイル」メニューの「インポート」の「音源」でのファイル選択', () => {
    describe('正常系', () => {
      it('「インポート」の「音源」で音源 song.mp3 を選び、読み込みが終わっていないとき、画面に「音源を読み込み中です」が表示される', async () => {
        const app = await startWithLoadingAudio()

        expect(app.text('音源を読み込み中です')).toBeInTheDocument()
      })

      it('「インポート」の「音源」で音源 song.mp3 を選び、読み込みが終わったとき、画面に「音源を読み込み中です」が表示されなくなる', async () => {
        const app = await startWithLoadingAudio()

        app.audio.decodeRequests()[0]!.finish()
        await app.settle()

        expect(app.text('音源を読み込み中です')).not.toBeInTheDocument()
      })

      it('「インポート」の「音源」で大きさが 52428800 バイトの音源 song.mp3 を選ぶと、右のパネルに「song.mp3」が表示される', async () => {
        const app = await startApp()

        await app.files.chooseAudio(createAudioFile('song.mp3', { sizeBytes: 52428800 }))

        expect(app.text('song.mp3')).toBeInTheDocument()
      })
    })
  })
})

describe('[音源の読み込み] 失敗時の画面の下のメッセージ', () => {
  describe('「ファイル」メニューの「インポート」の「音源」でのファイル選択', () => {
    describe('異常系', () => {
      it.each<readonly [string, string, () => File]>([
        [
          '音源として読めないファイル broken.mp3 のとき',
          '音源を読み込めませんでした: 音源として読めません。ファイルが壊れていないか確認するか、mp3、ogg のいずれかの別のファイルを選んでください',
          createBrokenAudio,
        ],
        [
          '対応していない形式のファイル song.wav のとき',
          '音源を読み込めませんでした: 「song.wav」は対応していない音源の形式です。mp3、ogg のいずれかのファイルを選んでください',
          () => createAudioFile('song.wav'),
        ],
        [
          '大きさが 52428801 バイトのファイル big.mp3 のとき',
          '音源を読み込めませんでした: 音源の大きさは 50 MB までです (選んだファイルは 50.0 MB)。50 MB 以下のファイルを選んでください',
          createBigAudio,
        ],
        [
          '中身が空の壊れたファイル unreadable.mp3 のとき',
          '音源を読み込めませんでした: 「unreadable.mp3」を読み出せませんでした。ファイルが壊れていないか確認して、もう一度選んでください',
          createUnreadableAudio,
        ],
      ])('%s、画面の下のメッセージに「%s」が表示される', async (_given, notice, createAudio) => {
        const app = await startApp()

        await app.files.chooseAudio(createAudio())

        expect(app.notice(notice)).toBeInTheDocument()
      })
    })
  })
})

describe('[音源の読み込み] 失敗時の読み込み中の表示', () => {
  describe('「ファイル」メニューの「インポート」の「音源」でのファイル選択', () => {
    describe('異常系', () => {
      it('「インポート」の「音源」で音源として読めないファイル broken.mp3 を選び、読み込み中に失敗すると、画面に「音源を読み込み中です」が表示されなくなる', async () => {
        const app = await startApp()
        app.audio.deferDecoding()
        await app.files.chooseAudio(createBrokenAudio())
        expect(app.text('音源を読み込み中です'), '音源の読み込み中になっていません').toBeInTheDocument()

        app.audio.decodeRequests()[0]!.finish()
        await app.settle()

        expect(app.text('音源を読み込み中です')).not.toBeInTheDocument()
      })
    })
  })
})

describe('[音源の読み込み] 失敗後の音源の名前', () => {
  describe('「ファイル」メニューの「インポート」の「音源」でのファイル選択', () => {
    describe('異常系', () => {
      it('「インポート」の「音源」で音源として読めないファイル broken.mp3 を選ぶと、右のパネルに「音源が未読み込みです」が表示される', async () => {
        const app = await startApp()

        await app.files.chooseAudio(createBrokenAudio())

        expect(app.text('音源が未読み込みです')).toBeInTheDocument()
      })

      it('音源として読めないファイル broken.mp3 の読み込みが失敗したあと、「インポート」の「音源」で音源 song.mp3 を選ぶと、右のパネルに「song.mp3」が表示される', async () => {
        const app = await startApp()
        await app.files.chooseAudio(createBrokenAudio())
        expect(app.text('音源が未読み込みです'), '読み込みが失敗した状態になっていません').toBeInTheDocument()
        expect(app.text('song.mp3')).not.toBeInTheDocument()

        await app.files.chooseAudio(createAudioFile('song.mp3'))

        expect(app.text('song.mp3')).toBeInTheDocument()
      })
    })
  })
})

describe('[法務のダイアログ] 利用規約・プライバシーポリシー・ログインのダイアログの表示と操作', () => {
  describe('「このアプリについて」ダイアログのリンクの押下', () => {
    describe('正常系', () => {
      it.each<readonly [string, string]>([
        ['利用規約', '利用規約'],
        ['プライバシーポリシー', 'プライバシーポリシー'],
      ])(
        '「このアプリについて」ダイアログの「%s」を押すと、エディタ画面の上に「%s」ダイアログが表示される',
        async (linkName, dialogName) => {
          const app = await startApp()

          await openLegalDialog(app, linkName)

          expect(app.dialog(dialogName)).toBeInTheDocument()
        },
      )

      it.each<readonly [string, string]>([
        ['利用規約', '#/legal/terms'],
        ['プライバシーポリシー', '#/legal/privacy'],
      ])(
        '「このアプリについて」ダイアログの「%s」を押すと、アドレスの # 以降が「%s」になる',
        async (linkName, hash) => {
          const app = await startApp()

          await openLegalDialog(app, linkName)

          expect(window.location.hash).toBe(hash)
        },
      )

      it('「このアプリについて」ダイアログの「利用規約」を押すと、「このアプリについて」ダイアログは表示されなくなる', async () => {
        const app = await startApp()

        await openLegalDialog(app, '利用規約')

        expect(app.dialog('このアプリについて')).not.toBeInTheDocument()
      })

      it('「このアプリについて」ダイアログの「利用規約」を押すと、エディタ画面は消えず、右のパネルの「ファイル」ボタンと、タイムラインの代替コンテンツの「スクロール位置 1 小節目 1 拍目」がダイアログの下に表示されたままになる', async () => {
        const app = await startWithLegalDialog('利用規約')

        expectEditorBehindDialog(app)
      })

      it('「利用規約」ダイアログが開いているとき、ダイアログの下の右のパネルの「ファイル」ボタンを押しても、操作は届かず、メニューは開かない', async () => {
        const app = await startWithLegalDialog('利用規約')

        await app.clickInBackground(app.button('ファイル'))

        expect(app.fileMenu.isOpen()).toBe(false)
      })
    })
  })

  describe('URL の # 以降を直接入力しての起動', () => {
    describe('正常系', () => {
      it.each<readonly [string, string]>([
        ['/legal/terms', '利用規約'],
        ['/legal/privacy', 'プライバシーポリシー'],
      ])(
        'URL の # 以降に %s を入力して起動すると、エディタ画面の上に「%s」ダイアログが表示される',
        async (route, dialogName) => {
          const app = await startApp({ route })

          expect(app.dialog(dialogName)).toBeInTheDocument()
        },
      )

      it('URL の # 以降に /legal/terms を入力して起動すると、右のパネルの「ファイル」ボタンと、タイムラインの代替コンテンツの「スクロール位置 1 小節目 1 拍目」がダイアログの下に表示される', async () => {
        const app = await startApp({ route: '/legal/terms' })

        expectEditorBehindDialog(app)
      })
    })
  })

  describe('「利用規約」ダイアログを閉じる', () => {
    describe('正常系', () => {
      it.each(['閉じる', 'ダイアログを閉じる'])(
        'タップノーツを置いたあと、「利用規約」ダイアログが開いているとき、「%s」を押すと、右のパネルの「ファイル」ボタンを押せる状態に戻り、押すとメニューが開く',
        async (buttonName) => {
          const app = await startWithGrid16AndTapPlacedAndLegalDialogOpen('利用規約')

          await app.click(within(dialogNamed(app, '利用規約')).getByRole('button', { name: buttonName }))

          await app.fileMenu.open()
          expect(app.fileMenu.heading('インポート')).toBeInTheDocument()
        },
      )

      it.each(['閉じる', 'ダイアログを閉じる'])(
        'タップノーツを 1 小節目 1 拍目の 1/2 拍後・レーン 2 に置いたあと、「利用規約」ダイアログが開いているとき、「%s」を押すと、譜面のノーツの代替コンテンツに「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」が出たままになる',
        async (buttonName) => {
          const app = await startWithGrid16AndTapPlacedAndLegalDialogOpen('利用規約')

          await app.click(within(dialogNamed(app, '利用規約')).getByRole('button', { name: buttonName }))

          expect(app.timeline.notes()).toEqual([TAP_480_LANE_2])
        },
      )

      it('「利用規約」ダイアログが開いているとき、「ダイアログを閉じる」を押すと、アドレスの # 以降が「/」に戻る', async () => {
        const app = await startWithLegalDialog('利用規約')

        await app.click(within(dialogNamed(app, '利用規約')).getByRole('button', { name: 'ダイアログを閉じる' }))

        expect(window.location.hash).toBe('#/')
      })
    })
  })

  describe('「利用規約」ダイアログの内容', () => {
    describe('正常系', () => {
      it('「第7条 (権利侵害のご連絡と削除)」に、連絡先のメールアドレス support@keyandnotes.com が表示される', async () => {
        const app = await startWithLegalDialog('利用規約')

        expect(
          within(app.dialogSection('利用規約', '第7条 (権利侵害のご連絡と削除)')).getByRole('link', {
            name: 'support@keyandnotes.com',
          }),
        ).toBeInTheDocument()
      })
    })
  })

  describe('右のパネルの「ログイン」の押下', () => {
    describe('正常系', () => {
      it.each<readonly [string, (app: AppDriver) => HTMLElement | null]>([
        ['エディタ画面の上に「ログイン」ダイアログが表示される', (app) => app.dialog('ログイン')],
        ['ダイアログに「Google でログイン」が表示される', (app) => app.button('Google でログイン')],
        [
          'ダイアログに「ログインしなくても、エディタは使えます」を含む案内が表示される',
          () => screen.queryByText(/ログインしなくても、エディタは使えます/),
        ],
      ])('クラウドの設定があるとき、右のパネルの「ログイン」を押すと、%s', async (_then, locate) => {
        const app = await startWithLoginDialog()

        expect(locate(app)).toBeInTheDocument()
      })

      it('クラウドの設定があるとき、右のパネルの「ログイン」を押すと、アドレスの # 以降が「/login」になる', async () => {
        await startWithLoginDialog()

        expect(window.location.hash).toBe('#/login')
      })
    })
  })

  describe('「ログイン」ダイアログのリンクの押下', () => {
    describe('正常系', () => {
      it.each<readonly [string, string]>([
        ['利用規約', '利用規約'],
        ['プライバシーポリシー', 'プライバシーポリシー'],
      ])(
        'クラウドの設定があり、「ログイン」ダイアログが開いているとき、ダイアログの中の「%s」を押すと、「%s」ダイアログが表示される',
        async (linkName, dialogName) => {
          const app = await startWithLoginDialog()

          await app.click(within(dialogNamed(app, 'ログイン')).getByRole('link', { name: linkName }))

          expect(app.dialog(dialogName)).toBeInTheDocument()
        },
      )

      it.each(['利用規約', 'プライバシーポリシー'])(
        'クラウドの設定があり、「ログイン」ダイアログが開いているとき、ダイアログの中の「%s」を押すと、「ログイン」ダイアログは表示されなくなる',
        async (linkName) => {
          const app = await startWithLoginDialog()

          await app.click(within(dialogNamed(app, 'ログイン')).getByRole('link', { name: linkName }))

          expect(app.dialog('ログイン')).not.toBeInTheDocument()
        },
      )
    })
  })

  describe('「Google でログイン」の押下', () => {
    describe('正常系', () => {
      it('「ログイン」ダイアログで「Google でログイン」を押して、ログインが成功すると、「ログイン」ダイアログが表示されなくなる', async () => {
        const app = await startWithLoginDialog()

        await pressGoogleSignIn(app)

        expect(app.dialog('ログイン')).not.toBeInTheDocument()
      })

      it('「ログイン」ダイアログで「Google でログイン」を押して、ログインが成功すると、右のパネルに「ログアウト」が表示される', async () => {
        const app = await startWithLoginDialog()

        await pressGoogleSignIn(app)

        expect(app.button('ログアウト')).toBeInTheDocument()
      })

      it('クラウドの設定があり、ログインしていないとき、「ファイル」メニューの「クラウドに保存」を押して画面の下のメッセージに「クラウドを使うには、ログインしてください」が表示されたあと、「ログイン」ダイアログで「Google でログイン」を押して、ログインが成功すると、画面の下のメッセージに「クラウドを使うには、ログインしてください」が表示されなくなる', async () => {
        const app = await startApp({ cloud: { configured: true } })
        await app.fileMenu.choose('クラウドに保存')
        expect(app.notice('クラウドを使うには、ログインしてください')).toBeInTheDocument()
        await app.click(app.button('ログイン'))

        await pressGoogleSignIn(app)

        expect(app.notice('クラウドを使うには、ログインしてください')).not.toBeInTheDocument()
      })

      it('クラウドの設定があり、Google のログインが終わっていないとき、「ログイン」ダイアログの「Google でログイン」を続けて 2 回押しても、Google のログインのウィンドウは 1 回だけ開く', async () => {
        const app = await startWithLoginDialog()
        const openedSignInWindows = app.cloudFaults.pendSignIn()

        await pressGoogleSignIn(app)
        await pressGoogleSignIn(app)

        expect(openedSignInWindows).toHaveLength(1)
      })

      it('「ログイン」ダイアログで「Google でログイン」を押して、Google のログインが終わっていないとき、ダイアログの「Google でログイン」が押せなくなる', async () => {
        const app = await startWithLoginDialog()
        expect(app.text('ログイン中です。開いた Google のウィンドウで操作してください。')).not.toBeInTheDocument()
        app.cloudFaults.pendSignIn()

        await pressGoogleSignIn(app)

        expect(app.button('Google でログイン')).toBeDisabled()
      })

      it('「ログイン」ダイアログで「Google でログイン」を押して、Google のログインが終わっていないとき、ダイアログに「ログイン中です。開いた Google のウィンドウで操作してください。」が表示される', async () => {
        const app = await startWithLoginDialog()
        expect(app.text('ログイン中です。開いた Google のウィンドウで操作してください。')).not.toBeInTheDocument()
        app.cloudFaults.pendSignIn()

        await pressGoogleSignIn(app)

        expect(app.text('ログイン中です。開いた Google のウィンドウで操作してください。')).toBeInTheDocument()
      })

      it('「ログイン」ダイアログで「Google でログイン」を押したあと、利用者が Google のウィンドウを閉じてログインが終わらなかったとき、ダイアログの「Google でログイン」がもう一度押せる状態に戻る', async () => {
        const app = await startWithLoginDialog()
        const pendingSignIns = await pressGoogleSignInKeepingPending(app)

        pendingSignIns[0]!.fail(createFirebaseError('auth/popup-closed-by-user'))
        await app.settle()

        expect(app.button('Google でログイン')).toBeEnabled()
      })

      it('「ログイン」ダイアログで「Google でログイン」を押したあと、利用者が Google のウィンドウを閉じてログインが終わらなかったとき、ダイアログに「ログインできませんでした」を含む文言は表示されない', async () => {
        const app = await startWithLoginDialog()
        const pendingSignIns = await pressGoogleSignInKeepingPending(app)

        pendingSignIns[0]!.fail(createFirebaseError('auth/popup-closed-by-user'))
        await app.settle()

        expect(app.alertTexts()).not.toContainEqual(expect.stringContaining(LOGIN_FAILURE_PREFIX))
      })
    })

    describe('異常系', () => {
      it('「ログイン」ダイアログで「Google でログイン」を押して、想定外の原因でログインが失敗し、エラーの文言が「テスト用の失敗」のとき、ダイアログに「ログインできませんでした: テスト用の失敗」が表示される', async () => {
        const app = await startWithLoginDialog()
        app.cloudFaults.failSignIn(new Error('テスト用の失敗'))

        await pressGoogleSignIn(app)

        expect(app.alertTexts()).toContain('ログインできませんでした: テスト用の失敗')
      })

      it('ログインのポップアップがブロックされたあと、許可してもう一度「Google でログイン」を押すと、右のパネルに「ログアウト」が表示される', async () => {
        const app = await startWithLoginDialog()
        await pressGoogleSignInFailingWith(app, createFirebaseError('auth/popup-blocked'))
        expect(app.button('ログアウト')).not.toBeInTheDocument()
        app.cloudFaults.allowSignIn('alice')

        await pressGoogleSignIn(app)

        expect(app.button('ログアウト')).toBeInTheDocument()
      })
    })
  })

  describe('URL の # 以降に /login を直接入力しての起動', () => {
    describe('正常系', () => {
      it('クラウドの設定がないとき、URL の # 以降に /login を入力して起動すると、エディタ画面の上に「ログイン」ダイアログが開き、ダイアログに「クラウド保存は設定されていないため、ログインできません。」が表示される', async () => {
        const app = await startApp({ route: '/login' })

        expect(
          within(dialogNamed(app, 'ログイン')).getByText('クラウド保存は設定されていないため、ログインできません。'),
        ).toBeInTheDocument()
      })

      it('クラウドの設定がないとき、URL の # 以降に /login を入力して起動すると、「ログイン」ダイアログの「Google でログイン」ボタンは押せない状態になる', async () => {
        const app = await startApp({ route: '/login' })
        expect(app.dialog('ログイン'), '「ログイン」ダイアログが開いていません').toBeInTheDocument()

        expect(app.button('Google でログイン')).toBeDisabled()
      })
    })
  })
})

describe('[クラウドのエラーの文言] ログインの失敗の原因別の文言', () => {
  describe('「ログイン」ダイアログでの「Google でログイン」の押下', () => {
    describe('異常系', () => {
      it.each<readonly [string, string, () => Error]>([
        [
          'ブラウザがログインのポップアップをブロックしたとき',
          'ログインできませんでした: ブラウザがログインのポップアップをブロックしました。このサイトのポップアップを許可してから、もう一度お試しください',
          () => createFirebaseError('auth/popup-blocked'),
        ],
        [
          '通信に失敗したとき',
          'ログインできませんでした: 通信に失敗しました。ネットワークの接続を確認して、もう一度お試しください',
          () => createFirebaseError('auth/network-request-failed'),
        ],
        [
          'ログインの試行が多すぎるとされたとき',
          'ログインできませんでした: ログインの試行が多すぎます。しばらくしてから、もう一度お試しください',
          () => createFirebaseError('auth/too-many-requests'),
        ],
        [
          'そのアカウントが使えないとされたとき',
          'ログインできませんでした: このアカウントは使えません。別の Google アカウントでログインしてください',
          () => createFirebaseError('auth/user-disabled'),
        ],
        [
          'このサイトのアドレスではログインが許可されていないとされたとき',
          'ログインできませんでした: このサイトのアドレスではログインが許可されていません。運営者にお問い合わせください',
          () => createFirebaseError('auth/unauthorized-domain'),
        ],
        [
          'コード「auth/internal-error」、文言「テスト用の失敗」のエラーになったとき',
          'ログインできませんでした: クラウドとの通信で想定外のエラーが起きました (auth/internal-error): テスト用の失敗',
          () => createFirebaseError('auth/internal-error', 'テスト用の失敗'),
        ],
      ])('%s、ダイアログに「%s」が表示される', async (_given, message, createError) => {
        const app = await startWithLoginDialog()

        await pressGoogleSignInFailingWith(app, createError())

        expect(app.alertTexts()).toContain(message)
      })
    })
  })
})

describe('[ダイアログ] ダイアログの背後の画面', () => {
  describe('正常系', () => {
    it('タップノーツを 1 小節目 1 拍目の 1/2 拍後・レーン 2 に置いてあり、「MIDI を取り込む」ダイアログが開いているとき、タイムラインの 1 小節目 2 拍目・レーン 3 をクリックしても、背後のタイムラインは効かず、ノーツは「タップノーツ 1 小節目 1 拍目の 1/2 拍後 レーン 2」の 1 つのままになる', async () => {
      const app = await startWithGrid16AndTapPlacedAndMidiDialogOpen()

      await app.timeline.inBackground.click(at(960, 3))

      expect(app.timeline.notes()).toEqual([TAP_480_LANE_2])
    })
  })
})

describe('[ダイアログ] ダイアログの閉じ方', () => {
  describe('正常系', () => {
    it.each(DIALOG_CLOSE_OPERATIONS)(
      '「プロジェクト情報」ダイアログが開いているとき、%s、画面に「プロジェクト情報」ダイアログが表示されなくなる',
      async (_operation, close) => {
        const app = await startWithProjectInfoOpen()

        await close(app, 'プロジェクト情報')

        expect(app.dialog('プロジェクト情報')).not.toBeInTheDocument()
      },
    )

    it('「プロジェクト情報」ダイアログが開いているとき、ダイアログの内側の「曲名」の表示をクリックしても、「プロジェクト情報」ダイアログは表示されたままになる', async () => {
      const app = await startWithProjectInfoOpen()

      await app.click(within(dialogNamed(app, 'プロジェクト情報')).getByText('曲名'))

      expect(app.dialog('プロジェクト情報')).toBeInTheDocument()
    })

    it.each(DIALOG_CLOSE_OPERATIONS)(
      'プロジェクトと譜面の書き込みが終わらず「保存中です」と表示されているとき、「クラウドに保存」ダイアログで%s、「クラウドに保存」ダイアログは表示されたままになる',
      async (_operation, close) => {
        const app = await startWithSavingInProgress()

        await close(app, 'クラウドに保存')

        expect(app.dialog('クラウドに保存')).toBeInTheDocument()
      },
    )
  })
})
