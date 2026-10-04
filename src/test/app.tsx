import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { expect, vi } from 'vitest'
import { VIEW_SIZE, flushAnimationFrames, listDownloads, type DownloadedFile } from './browserStubs.ts'
import type { CloudFaults, CloudHarness } from './cloudHarness.ts'
import { createEmulatorCloudHarness } from './emulator.ts'
import { getAudioControls, type AudioControls } from './fakeAudio.ts'
import { createCloudFaults, createFakeCloudHarness } from './fakeFirebase.ts'
import { createChartFile, type ChartFileNote, type ChartFileProjectInfo } from './files.ts'
import { failWith } from './failures.ts'
import { createTimelineDriver, type TimelineDriver } from './timeline.ts'
import type { TimelineViewport } from '../components/timeline/timelineLayout.ts'

const SETTLE_ROUNDS = 8
const SIGN_IN_TIMEOUT_MS = 10_000
const SIGN_IN_POLL_MS = 20
const SCROLLBAR_LABEL_PIXELS_OUTSIDE = 40
const SCROLLBAR_GRAB_X = 5
const TRACK_EDGE_INSET_PIXELS = 1
const WHEEL_DELTA_MODE_PIXEL = 0
const DEFAULT_WHEEL_PIXELS = 100
const FAKE_FIREBASE_ENV = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test.example.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
  VITE_FIREBASE_APP_ID: 'test-app-id',
}
const FAKE_TIMER_TARGETS = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'Date',
  'performance',
] as const
const ANIMATION_FRAME_MILLISECONDS = 16
const MODIFIER_KEYS: Readonly<Record<string, string>> = { Ctrl: 'Control', Cmd: 'Meta', Shift: 'Shift', Alt: 'Alt' }
const NAMED_KEYS: Readonly<Record<string, string>> = {
  Enter: '{Enter}',
  Escape: '{Escape}',
  Tab: '{Tab}',
  '↑': '{ArrowUp}',
  '↓': '{ArrowDown}',
  '←': '{ArrowLeft}',
  '→': '{ArrowRight}',
}

const AUDIO_INPUT_LABEL = '音源を読み込む'
const CHART_INPUT_LABEL = '譜面を読み込む'
const MIDI_INPUT_LABEL = 'MIDI を取り込む'

const realSetImmediate = globalThis.setImmediate

/** 画面上部のタブの名前。 */
export type TabName = 'エディタ' | 'プレビュー'

/** アプリを起動するときの前提。 */
export interface StartAppOptions {
  /** クラウドの設定の有無と、ログインの状態。既定は、クラウドの設定がない。 */
  readonly cloud?: { readonly configured: false } | { readonly configured: true; readonly signedInAs?: string }
  /** 起動直後のレーン数。「譜面設定」ダイアログで合わせる。既定は、アプリの初期値。 */
  readonly laneCount?: number
  /** 起動直後の小節数。「プロジェクト情報」ダイアログで合わせる。既定は、アプリの初期値。 */
  readonly barCount?: number
  /** 起動時のアドレスの # 以降 (例: /login、/legal/terms)。 */
  readonly route?: string
}

export interface ProjectInfoDriver {
  open(): Promise<void>
  close(): Promise<void>
  dialog(): HTMLElement | null
  songNameInput(): HTMLElement
  offsetInput(): HTMLElement
  barCountInput(): HTMLElement
  enterSongName(text: string): Promise<void>
  enterOffset(text: string): Promise<void>
  enterBarCount(text: string): Promise<void>
  typeBarCountAndBlur(text: string): Promise<void>
  barCountMessage(): string | null
  songNameMessage(): string | null
}

export interface ChartSettingsDriver {
  open(): Promise<void>
  close(): Promise<void>
  dialog(): HTMLElement | null
  chartNameInput(): HTMLElement
  laneCount(): number
  laneDecreaseButton(): HTMLElement
  laneIncreaseButton(): HTMLElement
  decreaseLaneCount(times?: number): Promise<void>
  increaseLaneCount(times?: number): Promise<void>
  enterChartName(text: string): Promise<void>
  chartNameMessage(): string | null
}

/** 「ファイル」メニューを操作する入口。 */
export interface FileMenuDriver {
  /** 右のパネルの「ファイル」ボタンを押して、メニューを開く。メニューが開かなければ、例外になる。 */
  open(): Promise<void>
  /** メニューが開いているか。 */
  isOpen(): boolean
  /** メニューの見出し (例: インポート)。出ていなければ null。 */
  heading(name: string): HTMLElement | null
  /** メニューの項目。出ていなければ null。 */
  item(name: string): HTMLElement | null
  /** 閉じているメニューを、「ファイル」ボタンを押して開き、項目を押す。メニューが開いているときは、例外になる (ボタンを押すと閉じるため)。 */
  choose(name: string): Promise<void>
  /** 開いているメニューの項目を押す。メニューが閉じているときは、例外になる。 */
  chooseInOpenMenu(name: string): Promise<void>
}

/**
 * 「ファイル」メニューの「インポート」の項目で、ファイルを選ぶ操作。閉じているメニューを開いて項目を押し、ファイルを選ぶ。
 * 選んだあと、アプリが反応しなかったとき (譜面、プロジェクト情報、音源、メッセージ、取り込みダイアログのどれも変わらないとき) は、例外になる。
 * 反応は、読み込みの成功にも、失敗のメッセージにも数える。
 */
export interface FilePickerDriver {
  /** 「インポート」の「音源」で、ファイルを選ぶ。 */
  chooseAudio(file: File): Promise<void>
  /** 「インポート」の「譜面」で、ファイルを選ぶ。 */
  chooseChart(file: File): Promise<void>
  /** 「インポート」の「MIDI」で、ファイルを選ぶ。 */
  chooseMidi(file: File): Promise<void>
  /** メニューが既に開いているときの、同じ操作。メニューが閉じているときは、例外になる。 */
  readonly inOpenMenu: Omit<FilePickerDriver, 'inOpenMenu'>
}

/** ダウンロードの操作と観測。 */
export interface DownloadsDriver {
  exportChartAs(songName: string, chartName: string): Promise<DownloadedFile>
  exportChart(): Promise<DownloadedFile>
  all(): readonly DownloadedFile[]
}

/** プレビューの画面を操作する入口。 */
export interface PreviewDriver {
  /** プレビューの Canvas。 */
  canvas(): HTMLCanvasElement
  /** 代替コンテンツの項目の文字を並べて返す (「再生位置 N 小節目 M 拍目」「ノーツ M 個」)。 */
  items(): string[]
  /** 「再生位置 N 小節目 M 拍目」の「N 小節目 M 拍目」を返す。 */
  position(): string
  /** 「ノーツ M 個」の M を返す。 */
  noteCount(): number
  /** プレビューの Canvas の上で、ホイールを上 (未来へ) か下 (過去へ) へ回す。 */
  wheel(direction: 'up' | 'down', pixels?: number): Promise<void>
}

/** タイムラインの右端のスクロールバーを操作する入口。 */
export interface ScrollbarDriver {
  /** スクロールバー。出ていなければ null。 */
  element(): HTMLElement | null
  /** スクロールバーの現在位置を表す値 (aria-valuenow)。 */
  value(): number
  /** つまみを一番上までドラッグして離す。 */
  dragThumbToTop(): Promise<void>
  /** つまみを一番下までドラッグして離す。 */
  dragThumbToBottom(): Promise<void>
  /** つまみの外のトラックの、一番上をクリックする。 */
  clickTrackTop(): Promise<void>
  /** つまみの外のトラックの、一番下をクリックする。 */
  clickTrackBottom(): Promise<void>
}

/** 「MIDI を取り込む」ダイアログを操作する入口。 */
export interface MidiDialogDriver {
  /** 「MIDI を取り込む」ダイアログ。開いていなければ null。 */
  dialog(): HTMLElement | null
  /** 「音程とレーンの対応」の、レーンのラベルの入力欄。 */
  pitchInput(lane: number): HTMLElement
  /** 「音程とレーンの対応」の入力欄の数。 */
  pitchInputCount(): number
  /** 「ベロシティの範囲」の、行の名前 (例: タップノーツ、上フリックノーツ) の行の、左 (最小) か右 (最大) の入力欄。 */
  velocityInput(rowName: string, edge: 'min' | 'max'): HTMLElement
  /** 「音程とレーンの対応」の入力欄を、文字で置き換える。 */
  setPitch(lane: number, text: string): Promise<void>
  /** 「ベロシティの範囲」の入力欄を、文字で置き換える。空文字なら、消す。 */
  setVelocity(rowName: string, edge: 'min' | 'max', text: string): Promise<void>
  /** 「確認する」を押す。確認の結果もメッセージも出ないときは、例外になる。 */
  confirm(): Promise<void>
  /** 「取り込む」を押す。 */
  importNotes(): Promise<void>
  /** ダイアログの「取り込む」ボタン。 */
  importButton(): HTMLElement
  /** ダイアログの中の、文字が一致する要素。出ていなければ null。 */
  text(text: string): HTMLElement | null
  /** 「取り込むノーツ N 個、取り込めないノート M 個」の文字。出ていなければ null。 */
  summary(): string | null
  /** 取り込めないノートの項目 (例: 「1 小節目 2 拍目 レーン 0: 位置の重複」) の文字を並べて返す。 */
  warnings(): string[]
}

/** 起動したアプリを、仕様の言葉で操作し、観測する入口。 */
export interface AppDriver {
  /** 実際のユーザー操作を行う user-event。 */
  readonly user: UserEvent
  readonly timeline: TimelineDriver
  readonly scrollbar: ScrollbarDriver
  readonly preview: PreviewDriver
  readonly projectInfo: ProjectInfoDriver
  readonly chartSettings: ChartSettingsDriver
  readonly midiDialog: MidiDialogDriver
  readonly fileMenu: FileMenuDriver
  readonly files: FilePickerDriver
  readonly downloads: DownloadsDriver
  /** ブラウザの音声機能の操作。 */
  readonly audio: AudioControls
  /** ログイン中の利用者の保存先を、直接読み書きする入口。 */
  readonly cloud: CloudHarness
  /** ログインと保存先の失敗を起こす入口。画面のテスト専用。 */
  readonly cloudFaults: CloudFaults
  /** 非同期の処理 (ファイルの読み込みなど) が落ち着くのを待つ。操作の関数は、終わりに自分で待つ。 */
  settle(): Promise<void>
  /** 時間を進める (秒)。偽のタイマーと、音声の時計が進む。 */
  advance(seconds: number): Promise<void>
  /** ページを再読み込みする。ブラウザの保存領域と、ログイン状態、クラウドの内容は残る。 */
  reload(): Promise<void>
  /** キーを押す。例: 'Ctrl+Z'、'Ctrl+Shift+Z'、'Cmd+C'、'Enter'、'Escape'、'↑'、'1'。 */
  press(chord: string): Promise<void>
  /** 要素を左クリックする。ダイアログの背後など、操作が届かない要素なら、例外になる (効かないことを確かめるときは clickInBackground)。 */
  click(element: HTMLElement | null): Promise<void>
  /** ダイアログの背後にある (操作が届かない) 要素を、左クリックしようとする。操作が届く要素なら、例外になる。 */
  clickInBackground(element: HTMLElement | null): Promise<void>
  /** 入力欄を空にして、文字を入れる。 */
  setText(element: HTMLElement, text: string): Promise<void>
  /** 入力欄に、文字を打ち足す。 */
  type(element: HTMLElement, text: string): Promise<void>
  /** 要素にフォーカスを当てる。 */
  focus(element: HTMLElement): Promise<void>
  /** 画面上部のタブ。 */
  tab(name: TabName): HTMLElement
  /** 画面上部のタブが選択された状態か。 */
  tabIsSelected(name: TabName): boolean
  /** 画面上部のタブを押す。押しても、タブの選択もメッセージも変わらないときは、例外になる。 */
  selectTab(name: TabName): Promise<void>
  gridDivisionSelect(): HTMLElement | null
  gridDivisionOptions(): string[]
  selectGridDivision(label: string): Promise<void>
  /** 名前のボタン。画面に出ていなければ null。 */
  button(name: string): HTMLElement | null
  /** 名前の入力欄 (ラベルか、見えない名前で探す)。 */
  field(name: string): HTMLElement
  /** 文字がそのままの要素。画面に出ていなければ null。 */
  text(text: string): HTMLElement | null
  /** 名前のダイアログ。開いていなければ null。 */
  dialog(name: string): HTMLElement | null
  dialogBackdrop(name: string): HTMLElement
  dialogSection(dialogName: string, headingName: string): HTMLElement
  /** ページ上部の「UniToccata Editor」。 */
  siteTitle(): HTMLElement
  /** 画面の下のメッセージ。文言が一致するものがなければ null。 */
  notice(text: string): HTMLElement | null
  /** 画面の下のメッセージの文言を、全て並べて返す。 */
  noticeTexts(): string[]
  /** 入力の誤りなどを知らせる文言 (入力欄に添えて出る理由など) を、全て並べて返す。 */
  alertTexts(): string[]
  /** 譜面ファイルを「ファイル」メニューの「インポート」の「譜面」で読み込んで、前提の譜面にする。譜面のノーツの代替コンテンツの項目の数が、渡したノーツの数にならないときは、例外になる。譜面ファイルのレーン数は、省くと今のレーン数 (読み込んでもレーン数が変わらない)。オフセット、テンポ、拍子は、省くと初期の値 (読み込むと、その値になる)。 */
  loadChart(notes: readonly ChartFileNote[], laneCount?: number, projectInfo?: ChartFileProjectInfo): Promise<void>
}

type EditorStore = typeof import('../state/editorStore.ts').useEditorStore

interface Session {
  readonly unmount: () => void
  readonly readViewport: () => TimelineViewport
  readonly store: EditorStore
}

interface ReactionSnapshot {
  readonly chart: unknown
  readonly projectInfo: unknown
  readonly audio: unknown
  readonly isLoadingAudio: boolean
  readonly songName: string
  readonly chartName: string
  readonly notice: unknown
  readonly barCount: number
  readonly laneCount: number
  readonly mode: string
  readonly isMidiDialogOpen: boolean
}

function createUnavailableCloudFaults(): CloudFaults {
  return new Proxy({} as CloudFaults, {
    get: () => {
      throw new Error('cloudFaults は、Firebase を差し替える画面のテスト (*.gui.test.tsx) だけで使えます')
    },
  })
}

function isFakeClock(): boolean {
  return import.meta.env.VITE_TEST_CLOCK === 'fake'
}

function usesEmulators(): boolean {
  return import.meta.env.VITE_USE_EMULATORS === 'true'
}

async function settleWork(): Promise<void> {
  await act(async () => {
    for (let round = 0; round < SETTLE_ROUNDS; round++) {
      await new Promise<void>((resolve) => realSetImmediate(resolve))
      if (isFakeClock()) {
        await vi.advanceTimersByTimeAsync(0)
      }
    }
    if (isFakeClock()) {
      flushAnimationFrames()
    }
  })
}

async function waitUntilSignedIn(): Promise<void> {
  const deadline = Date.now() + SIGN_IN_TIMEOUT_MS
  await act(async () => {
    while (screen.queryByRole('button', { name: 'ログアウト' }) === null) {
      if (Date.now() > deadline) {
        throw new Error('ログイン済みの表示になりませんでした (Auth エミュレータへのログインが画面に届いていません)')
      }
      await new Promise<void>((resolve) => setTimeout(resolve, SIGN_IN_POLL_MS))
    }
  })
}

function toKeyboardInput(chord: string): string {
  const parts = chord.split('+')
  const key = parts.at(-1) ?? ''
  const modifiers = parts.slice(0, -1).map((name) => MODIFIER_KEYS[name] ?? name)
  const keyToken = NAMED_KEYS[key] ?? key
  return [
    ...modifiers.map((modifier) => `{${modifier}>}`),
    keyToken,
    ...modifiers.toReversed().map((modifier) => `{/${modifier}}`),
  ].join('')
}

function isInert(element: Element): boolean {
  return element.closest('[inert]') !== null
}

async function mountApp(): Promise<Session> {
  vi.resetModules()
  const [{ App }, { useEditorStore }] = await Promise.all([import('../App.tsx'), import('../state/editorStore.ts')])
  let unmount = (): void => undefined
  await act(async () => {
    unmount = render(<App />).unmount
  })
  return {
    unmount,
    readViewport: () => {
      const { laneCount, scrollTick, pixelsPerTick } = useEditorStore.getState()
      return { width: VIEW_SIZE.width, height: VIEW_SIZE.height, laneCount, scrollTick, pixelsPerTick }
    },
    store: useEditorStore,
  }
}

/**
 * アプリを起動する。起動のたびに、アプリの状態 (譜面、設定、音声、ログイン状態の購読) を作り直す。
 * 画面のテストでは、時間は偽のタイマーで止まっていて、advance で進める。
 */
export async function startApp(options: StartAppOptions = {}): Promise<AppDriver> {
  const { cloud = { configured: false }, laneCount, barCount, route = '/' } = options
  cleanup()
  for (const [name, value] of Object.entries(FAKE_FIREBASE_ENV)) {
    if (!cloud.configured) {
      vi.stubEnv(name, '')
    } else if (!usesEmulators()) {
      vi.stubEnv(name, value)
    }
  }
  window.history.replaceState(null, '', `#${route}`)
  if (isFakeClock()) {
    vi.useFakeTimers({ toFake: [...FAKE_TIMER_TARGETS] })
  }
  const user = userEvent.setup({
    applyAccept: false,
    delay: null,
    advanceTimers: (milliseconds) => (isFakeClock() ? vi.advanceTimersByTime(milliseconds) : undefined),
  })
  const baseCloudHarness = usesEmulators() ? createEmulatorCloudHarness() : createFakeCloudHarness()
  const cloudHarness: CloudHarness = {
    ...baseCloudHarness,
    signIn: (uid) => act(() => baseCloudHarness.signIn(uid)),
    signOut: () => act(() => baseCloudHarness.signOut()),
  }
  if (cloud.configured && cloud.signedInAs !== undefined) {
    await cloudHarness.signIn(cloud.signedInAs)
  }
  let session = await mountApp()
  await settleWork()
  if (usesEmulators() && cloud.configured && cloud.signedInAs !== undefined) {
    await waitUntilSignedIn()
  }

  const findByLabel = (label: string): HTMLElement => screen.getByLabelText(label)
  const click = async (element: HTMLElement | null): Promise<void> => {
    if (element === null) {
      throw new Error('押そうとした要素が画面にありません')
    }
    if (isInert(element)) {
      throw new Error(
        '押そうとした要素は、ダイアログの背後にあり、操作が届きません。効かないことを確かめるときは clickInBackground を使います',
      )
    }
    let isDelivered = false
    const markDelivered = (): void => {
      isDelivered = true
    }
    document.addEventListener('pointerdown', markDelivered, true)
    await user.click(element)
    document.removeEventListener('pointerdown', markDelivered, true)
    expect(isDelivered, '要素を押そうとしましたが、操作が届いていません (操作が空振りしています)').toBe(true)
    await settleWork()
  }
  const clickInBackground = async (element: HTMLElement | null): Promise<void> => {
    if (element === null) {
      throw new Error('押そうとした要素が画面にありません')
    }
    if (!isInert(element)) {
      throw new Error(
        '押そうとした要素は、ダイアログの背後にありません。clickInBackground は、背後にあるときだけ使えます',
      )
    }
    await settleWork()
  }
  const takeSnapshot = (): ReactionSnapshot => {
    const state = session.store.getState()
    return {
      chart: state.chart,
      projectInfo: state.projectInfo,
      audio: state.audio,
      isLoadingAudio: state.isLoadingAudio,
      songName: state.songName,
      chartName: state.chartName,
      notice: state.notice,
      barCount: state.barCount,
      laneCount: state.laneCount,
      mode: state.mode,
      isMidiDialogOpen: screen.queryByRole('dialog', { name: 'MIDI を取り込む' }) !== null,
    }
  }
  const hasReacted = (before: ReactionSnapshot): boolean => {
    const after = takeSnapshot()
    return (Object.keys(before) as (keyof ReactionSnapshot)[]).some((key) => before[key] !== after[key])
  }
  const assertReacted = (before: ReactionSnapshot, operation: string): void => {
    if (!hasReacted(before)) {
      throw new Error(`${operation}をしても、アプリに何も起きませんでした (操作が空振りしています)`)
    }
  }
  const assertSettingEntered = (before: ReactionSnapshot, isAlreadyApplied: boolean, operation: string): void => {
    expect(
      isAlreadyApplied || hasReacted(before) || screen.queryAllByRole('alert').length > 0,
      `${operation}をしても、アプリに何も起きませんでした (操作が空振りしています)`,
    ).toBe(true)
  }
  const timeline = createTimelineDriver({
    user,
    settle: settleWork,
    readViewport: () => session.readViewport(),
    findByLabel,
  })
  const tab = (name: TabName): HTMLElement => screen.getByRole('tab', { name })
  const button = (name: string): HTMLElement | null => screen.queryByRole('button', { name })
  const dialog = (name: string): HTMLElement | null => screen.queryByRole('dialog', { name })
  const requireDialog = (name: string): HTMLElement =>
    dialog(name) ?? failWith(new Error(`「${name}」ダイアログが開いていません`))
  const projectInfoDialog = (): HTMLElement => requireDialog('プロジェクト情報')
  const chartSettingsDialog = (): HTMLElement => requireDialog('譜面設定')
  const fieldIn = (container: HTMLElement, label: string): HTMLElement => within(container).getByLabelText(label)
  const settleAfter = async (action: () => Promise<void>): Promise<void> => {
    await action()
    await settleWork()
  }
  const setText = (element: HTMLElement, text: string): Promise<void> =>
    settleAfter(async () => {
      await user.clear(element)
      if (text !== '') {
        await user.paste(text)
      }
    })
  const readLaneCount = (): number => {
    const label = within(chartSettingsDialog()).getByText('レーン数')
    return Number(label.parentElement?.querySelector('output')?.textContent)
  }
  const pressLaneButton = async (label: '−' | '＋', times: number): Promise<void> => {
    for (let count = 0; count < times; count++) {
      const target = within(chartSettingsDialog()).getByRole('button', { name: label })
      expect(target, `「${label}」が押せない状態です`).toBeEnabled()
      const before = takeSnapshot()
      await click(target)
      assertReacted(before, `「${label}」を押すこと`)
    }
  }
  const fileMenu: FileMenuDriver = {
    open: async () => {
      await click(button('ファイル'))
      expect(screen.queryByRole('menu'), '「ファイル」ボタンを押しても、メニューが開きません').not.toBeNull()
    },
    isOpen: () => screen.queryByRole('menu') !== null,
    heading: (name) => {
      const menu = screen.queryByRole('menu')
      return menu === null ? null : within(menu).queryByText(name)
    },
    item: (name) => screen.queryByRole('menuitem', { name }),
    choose: async (name) => {
      await fileMenu.open()
      await fileMenu.chooseInOpenMenu(name)
    },
    chooseInOpenMenu: (name) => click(fileMenu.item(name)),
  }
  const uploadInOpenMenu = async (menuItem: string, inputLabel: string, file: File): Promise<void> => {
    const before = takeSnapshot()
    await fileMenu.chooseInOpenMenu(menuItem)
    const input = screen.getByLabelText(inputLabel, { selector: 'input[type="file"]' })
    await settleAfter(() => user.upload(input, file))
    assertReacted(before, `「インポート」の「${menuItem}」でファイル「${file.name}」を選ぶこと`)
  }
  const uploadFromClosedMenu = async (menuItem: string, inputLabel: string, file: File): Promise<void> => {
    await fileMenu.open()
    await uploadInOpenMenu(menuItem, inputLabel, file)
  }
  const captureDownload = async (operation: string, action: () => Promise<void>): Promise<DownloadedFile> => {
    const before = listDownloads().length
    await action()
    return listDownloads().at(before) ?? failWith(new Error(`${operation}をしても、ダウンロードされませんでした`))
  }
  const exportChart = async (): Promise<DownloadedFile> => {
    await fileMenu.open()
    return captureDownload('「譜面書き出し」を押すこと', () => fileMenu.chooseInOpenMenu('譜面書き出し'))
  }
  const exportChartAs = async (songName: string, chartName: string): Promise<DownloadedFile> => {
    await projectInfoDriver.open()
    await projectInfoDriver.enterSongName(songName)
    await projectInfoDriver.close()
    await chartSettingsDriver.open()
    await chartSettingsDriver.enterChartName(chartName)
    await chartSettingsDriver.close()
    return exportChart()
  }
  const gridDivisionSelect = (): HTMLElement | null => screen.queryByRole('combobox', { name: 'グリッド分割' })
  const midiDialogElement = (): HTMLElement => {
    const found = dialog('MIDI を取り込む')
    if (found === null) {
      throw new Error('「MIDI を取り込む」ダイアログが開いていません')
    }
    return found
  }
  const velocityInput = (rowName: string, edge: 'min' | 'max'): HTMLElement => {
    const row = within(midiDialogElement()).getByText(rowName).parentElement
    const input = row?.querySelectorAll('input')[edge === 'min' ? 0 : 1]
    if (input === undefined) {
      throw new Error(`「ベロシティの範囲」に「${rowName}」の行の入力欄がありません`)
    }
    return input
  }
  const midiDialog: MidiDialogDriver = {
    dialog: () => dialog('MIDI を取り込む'),
    pitchInput: (lane) => within(midiDialogElement()).getByLabelText(`レーン ${lane}`),
    pitchInputCount: () => within(midiDialogElement()).queryAllByLabelText(/^レーン \d+$/).length,
    velocityInput,
    setPitch: (lane, text) => setText(within(midiDialogElement()).getByLabelText(`レーン ${lane}`), text),
    setVelocity: (rowName, edge, text) => setText(velocityInput(rowName, edge), text),
    confirm: async () => {
      await click(within(midiDialogElement()).getByRole('button', { name: '確認する' }))
      const dialogElement = midiDialogElement()
      const hasResult = within(dialogElement).queryByText(/^取り込むノーツ \d+ 個、取り込めないノート \d+ 個$/) !== null
      expect(
        hasResult || within(dialogElement).queryAllByRole('alert').length > 0,
        '「確認する」を押しても、確認の結果もメッセージも出ません',
      ).toBe(true)
    },
    importNotes: () => click(within(midiDialogElement()).getByRole('button', { name: '取り込む' })),
    importButton: () => within(midiDialogElement()).getByRole('button', { name: '取り込む' }),
    text: (text) => within(midiDialogElement()).queryByText(text),
    summary: () =>
      within(midiDialogElement()).queryByText(/^取り込むノーツ \d+ 個、取り込めないノート \d+ 個$/)?.textContent ??
      null,
    warnings: () => [...midiDialogElement().querySelectorAll('[role="status"] li')].map((item) => item.textContent),
  }
  const findPreviewCanvas = (): HTMLCanvasElement => screen.getByLabelText('プレビュー') as HTMLCanvasElement
  const readPreviewItems = (): string[] =>
    [...findPreviewCanvas().querySelectorAll(':scope > p')].map((paragraph) => paragraph.textContent)
  const findPreviewItem = (pattern: RegExp): string => {
    const matched = readPreviewItems()
      .map((item) => pattern.exec(item)?.[1])
      .find((value) => value !== undefined)
    if (matched === undefined) {
      throw new Error('プレビューの代替コンテンツに、探した項目がありません')
    }
    return matched
  }
  const findScrollbar = (): HTMLElement | null => screen.queryByRole('scrollbar')
  const requireScrollbar = (): HTMLElement => {
    const found = findScrollbar()
    if (found === null) {
      throw new Error('スクロールバーが画面にありません')
    }
    return found
  }
  const dragScrollbarThumb = async (direction: 'top' | 'bottom'): Promise<void> => {
    const track = requireScrollbar()
    const thumb = track.firstElementChild as HTMLElement
    const grabY = Number.parseFloat(thumb.style.top) + Number.parseFloat(thumb.style.height) / 2
    const targetY =
      direction === 'top' ? -SCROLLBAR_LABEL_PIXELS_OUTSIDE : VIEW_SIZE.height + SCROLLBAR_LABEL_PIXELS_OUTSIDE
    await settleAfter(async () => {
      await user.pointer({ keys: '[MouseLeft>]', target: track, coords: { clientX: SCROLLBAR_GRAB_X, clientY: grabY } })
      await user.pointer({ target: track, coords: { clientX: SCROLLBAR_GRAB_X, clientY: targetY } })
      await user.pointer({
        keys: '[/MouseLeft]',
        target: track,
        coords: { clientX: SCROLLBAR_GRAB_X, clientY: targetY },
      })
    })
  }
  const clickScrollbarTrack = (edge: 'top' | 'bottom'): Promise<void> =>
    settleAfter(() =>
      user.pointer({
        keys: '[MouseLeft]',
        target: requireScrollbar(),
        coords: {
          clientX: SCROLLBAR_GRAB_X,
          clientY: edge === 'top' ? TRACK_EDGE_INSET_PIXELS : VIEW_SIZE.height - TRACK_EDGE_INSET_PIXELS,
        },
      }),
    )

  const messageBelow = (input: HTMLElement): string | null => {
    const messageId = input.getAttribute('aria-describedby')
    return messageId === null ? null : (document.getElementById(messageId)?.textContent ?? null)
  }
  const projectInfoDriver: ProjectInfoDriver = {
    open: async () => {
      await click(button('プロジェクト情報'))
      expect(
        dialog('プロジェクト情報'),
        '「プロジェクト情報」ボタンを押しても、「プロジェクト情報」ダイアログが開きません',
      ).not.toBeNull()
    },
    close: async () => {
      await click(within(projectInfoDialog()).getByRole('button', { name: '閉じる' }))
      expect(dialog('プロジェクト情報'), '「閉じる」を押しても、「プロジェクト情報」ダイアログが閉じません').toBeNull()
    },
    dialog: () => dialog('プロジェクト情報'),
    songNameInput: () => fieldIn(projectInfoDialog(), '曲名'),
    offsetInput: () => fieldIn(projectInfoDialog(), 'オフセット (ms)'),
    barCountInput: () => fieldIn(projectInfoDialog(), '小節数'),
    enterSongName: (text) => setText(fieldIn(projectInfoDialog(), '曲名'), text),
    enterOffset: async (text) => {
      const before = takeSnapshot()
      await setText(fieldIn(projectInfoDialog(), 'オフセット (ms)'), text)
      await settleAfter(() => user.keyboard('{Enter}'))
      assertSettingEntered(
        before,
        session.store.getState().projectInfo.offsetMs === Number(text),
        `オフセットに「${text}」を入力して Enter を押すこと`,
      )
    },
    enterBarCount: async (text) => {
      const before = takeSnapshot()
      await setText(fieldIn(projectInfoDialog(), '小節数'), text)
      await settleAfter(() => user.keyboard('{Enter}'))
      assertSettingEntered(
        before,
        session.store.getState().barCount === Number(text),
        `小節数に「${text}」を入力して Enter を押すこと`,
      )
    },
    typeBarCountAndBlur: async (text) => {
      const before = takeSnapshot()
      await setText(fieldIn(projectInfoDialog(), '小節数'), text)
      await settleAfter(() => user.tab())
      assertSettingEntered(
        before,
        session.store.getState().barCount === Number(text),
        `小節数に「${text}」を入力してフォーカスを外すこと`,
      )
    },
    barCountMessage: () => messageBelow(fieldIn(projectInfoDialog(), '小節数')),
    songNameMessage: () => messageBelow(fieldIn(projectInfoDialog(), '曲名')),
  }
  const chartSettingsDriver: ChartSettingsDriver = {
    open: async () => {
      await click(button('譜面設定'))
      expect(dialog('譜面設定'), '「譜面設定」ボタンを押しても、「譜面設定」ダイアログが開きません').not.toBeNull()
    },
    close: async () => {
      await click(within(chartSettingsDialog()).getByRole('button', { name: '閉じる' }))
      expect(dialog('譜面設定'), '「閉じる」を押しても、「譜面設定」ダイアログが閉じません').toBeNull()
    },
    dialog: () => dialog('譜面設定'),
    chartNameInput: () => fieldIn(chartSettingsDialog(), '譜面名'),
    laneCount: readLaneCount,
    laneDecreaseButton: () => within(chartSettingsDialog()).getByRole('button', { name: '−' }),
    laneIncreaseButton: () => within(chartSettingsDialog()).getByRole('button', { name: '＋' }),
    decreaseLaneCount: (times = 1) => pressLaneButton('−', times),
    increaseLaneCount: (times = 1) => pressLaneButton('＋', times),
    enterChartName: (text) => setText(fieldIn(chartSettingsDialog(), '譜面名'), text),
    chartNameMessage: () => messageBelow(fieldIn(chartSettingsDialog(), '譜面名')),
  }

  const driver: AppDriver = {
    user,
    timeline,
    scrollbar: {
      element: findScrollbar,
      value: () => Number(requireScrollbar().getAttribute('aria-valuenow')),
      dragThumbToTop: () => dragScrollbarThumb('top'),
      dragThumbToBottom: () => dragScrollbarThumb('bottom'),
      clickTrackTop: () => clickScrollbarTrack('top'),
      clickTrackBottom: () => clickScrollbarTrack('bottom'),
    },
    preview: {
      canvas: findPreviewCanvas,
      items: readPreviewItems,
      position: () => findPreviewItem(/^再生位置 (.+)$/),
      noteCount: () => Number(findPreviewItem(/^ノーツ (\d+) 個$/)),
      wheel: async (direction, pixels = DEFAULT_WHEEL_PIXELS) => {
        fireEvent.wheel(findPreviewCanvas(), {
          deltaY: (direction === 'up' ? -1 : 1) * pixels,
          deltaMode: WHEEL_DELTA_MODE_PIXEL,
        })
        await settleWork()
      },
    },
    projectInfo: projectInfoDriver,
    chartSettings: chartSettingsDriver,
    midiDialog,
    fileMenu,
    files: {
      chooseAudio: (file) => uploadFromClosedMenu('音源', AUDIO_INPUT_LABEL, file),
      chooseChart: (file) => uploadFromClosedMenu('譜面', CHART_INPUT_LABEL, file),
      chooseMidi: (file) => uploadFromClosedMenu('MIDI', MIDI_INPUT_LABEL, file),
      inOpenMenu: {
        chooseAudio: (file) => uploadInOpenMenu('音源', AUDIO_INPUT_LABEL, file),
        chooseChart: (file) => uploadInOpenMenu('譜面', CHART_INPUT_LABEL, file),
        chooseMidi: (file) => uploadInOpenMenu('MIDI', MIDI_INPUT_LABEL, file),
      },
    },
    downloads: {
      exportChartAs,
      exportChart,
      all: listDownloads,
    },
    audio: getAudioControls(),
    cloud: cloudHarness,
    cloudFaults: usesEmulators() ? createUnavailableCloudFaults() : createCloudFaults(),
    settle: settleWork,
    advance: async (seconds) => {
      if (isFakeClock()) {
        await act(async () => {
          let remaining = seconds * 1000
          while (remaining > 0) {
            const step = Math.min(ANIMATION_FRAME_MILLISECONDS, remaining)
            await vi.advanceTimersByTimeAsync(step)
            flushAnimationFrames()
            remaining -= step
          }
        })
        await settleWork()
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, seconds * 1000))
      }
    },
    reload: async () => {
      session.unmount()
      session = await mountApp()
      await settleWork()
    },
    press: (chord) => settleAfter(() => user.keyboard(toKeyboardInput(chord))),
    click,
    clickInBackground,
    setText,
    type: (element, text) => settleAfter(() => user.type(element, text)),
    focus: (element) =>
      settleAfter(async () => {
        await act(async () => element.focus())
      }),
    tab,
    tabIsSelected: (name) => tab(name).getAttribute('aria-selected') === 'true',
    selectTab: async (name) => {
      const before = takeSnapshot()
      await click(tab(name))
      assertReacted(before, `「${name}」タブを押すこと`)
    },
    gridDivisionSelect,
    gridDivisionOptions: () =>
      within(screen.getByRole('combobox', { name: 'グリッド分割' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    selectGridDivision: (label) =>
      settleAfter(() => user.selectOptions(screen.getByRole('combobox', { name: 'グリッド分割' }), label)),
    button,
    field: (name) => screen.queryByLabelText(name) ?? screen.getByPlaceholderText(name),
    text: (text) => screen.queryByText(text),
    dialog,
    dialogBackdrop: (name) =>
      requireDialog(name).parentElement ?? failWith(new Error(`「${name}」ダイアログの外側がありません`)),
    dialogSection: (dialogName, headingName) =>
      within(requireDialog(dialogName)).getByRole('heading', { name: headingName }).closest('section') ??
      failWith(new Error(`「${dialogName}」ダイアログに、見出し「${headingName}」の節がありません`)),
    siteTitle: () =>
      screen.queryByRole('link', { name: 'UniToccata Editor' }) ??
      screen.getByRole('heading', { name: 'UniToccata Editor' }),
    notice: (text) => collectNotices().find((element) => element.textContent === text) ?? null,
    noticeTexts: () => collectNotices().map((element) => element.textContent),
    alertTexts: () => screen.queryAllByRole('alert').map((element) => element.textContent),
    loadChart: async (notes, chartLaneCount = session.store.getState().laneCount, projectInfo) => {
      await uploadFromClosedMenu(
        '譜面',
        CHART_INPUT_LABEL,
        createChartFile('chart.json', notes, chartLaneCount, projectInfo),
      )
      expect(
        timeline.notes(),
        '譜面を読み込んでも、譜面のノーツの代替コンテンツに、読み込んだノーツが出ません',
      ).toHaveLength(notes.length)
    },
  }
  const arrangeLaneCount = async (target: number): Promise<void> => {
    await driver.chartSettings.open()
    const current = driver.chartSettings.laneCount()
    await (target > current
      ? driver.chartSettings.increaseLaneCount(target - current)
      : driver.chartSettings.decreaseLaneCount(current - target))
    await driver.chartSettings.close()
  }
  const arrangeBarCount = async (target: number): Promise<void> => {
    await driver.projectInfo.open()
    await driver.projectInfo.enterBarCount(String(target))
    await driver.projectInfo.close()
  }
  await (laneCount === undefined ? undefined : arrangeLaneCount(laneCount))
  await (barCount === undefined ? undefined : arrangeBarCount(barCount))
  return driver
}

const LOADING_TEXT = '音源を読み込み中です'

function collectNotices(): HTMLElement[] {
  return screen
    .queryAllByRole('status')
    .filter((element) => element.closest('[role="dialog"]') === null && element.textContent !== LOADING_TEXT)
}
