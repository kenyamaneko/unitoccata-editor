import { create } from 'zustand'
import {
  addNote,
  clearFlick,
  createClipboard,
  deleteNotes,
  deletePoint,
  moveNotes,
  extendLong,
  mirrorNotes,
  movePoint,
  pasteClipboard,
  selectNotesInRect,
  setFlickDirection,
  type ClipboardData,
  type EditFailureReason,
  type EditResult,
  type SelectionRect,
} from '../domain/chartEditing.ts'
import {
  DEFAULT_BAR_COUNT,
  DEFAULT_GRID_DIVISION,
  DEFAULT_LANE_COUNT,
  MAX_BAR_COUNT,
  MAX_NOTE_COUNT,
  type GridDivision,
} from '../domain/constants.ts'
import { listPoints } from '../domain/notes.ts'
import {
  calculateRequiredBarCount,
  createInitialProjectInfo,
  removeSignatureChange,
  removeTempoChange,
  setSignatureChange,
  setOffsetMs,
  setTempoChange,
  type ProjectInfoEditFailureReason,
  type ProjectInfoEditResult,
  locateBeatPosition,
} from '../domain/projectInfo.ts'
import type {
  Chart,
  ChartPoint,
  FlickDirection,
  PointRef,
  ProjectInfo,
  SignatureChange,
  TempoChange,
} from '../domain/types.ts'
import {
  DEFAULT_PIXELS_PER_TICK,
  MAX_PIXELS_PER_TICK,
  MIN_PIXELS_PER_TICK,
  MIN_SCROLL_TICK,
} from '../constants/canvas.ts'
import { calculateScrollLimit } from '../domain/scrollbar.ts'
import { BAR_COUNT_SETTING, LANE_COUNT_SETTING } from '../domain/numberSettings.ts'

/** 読み込んだ音源。波形はピークの並びで持つ。 */
export interface LoadedAudio {
  readonly name: string
  readonly file: File
  readonly buffer: AudioBuffer
  readonly peaks: Float32Array
  readonly peakSeconds: number
}

/** 取り消しとやり直しの対象。 */
interface Snapshot {
  readonly projectInfo: ProjectInfo
  readonly chart: Chart
}

/** エディタのモード。 */
export type EditorMode = 'editor' | 'preview'

/** 利用者に短く伝えるメッセージ。同じ文面でも新しく表示できるよう、連番を持つ。 */
export interface Notice {
  readonly id: number
  readonly message: string
}

const HISTORY_LIMIT = 200

let nextNoteSerial = 1
let nextNoticeSerial = 1

/** ノーツの id を新しく採番する。 */
export function createNoteId(): string {
  return `note-${nextNoteSerial++}`
}

const FAILURE_MESSAGES: Record<EditFailureReason, string> = {
  'duplicate-position': '同じ位置にノーツがあります',
  'too-many-notes': `ノーツは ${MAX_NOTE_COUNT} 個までです`,
  'short-note-on-long': 'ロングノーツの上には、タップノーツとフリックノーツを置けません',
  'long-note-on-long': 'ロングノーツは、ほかのロングノーツと重ねられません',
  'out-of-range': 'ノーツが、先頭より前か、レーンの範囲外になります。位置をずらすか、レーン数を増やしてください',
  'invalid-long-order': 'ロングノーツの点は、前の点より後、次の点より前の時間に置いてください',
  'point-not-found': 'ノーツの点が見つかりません。ノーツの上にマウスを置いて、もう一度操作してください',
  'flick-needs-long-end': 'フリックを付けられるのは、ロングノーツの最後の終端だけです',
  'extend-needs-long-end':
    'ロングノーツを伸ばせるのは、最後の終端からのドラッグだけです。点を動かすときは、Shift を押しながらドラッグしてください',
  'no-flick': 'この点にはフリックがないため、解除できません',
}

const NO_POINT_UNDER_MOUSE: EditResult = { ok: false, reason: 'point-not-found' }

const PROJECT_INFO_FAILURE_MESSAGES: Record<ProjectInfoEditFailureReason, string> = {
  'tempo-change-at-tick-0': '先頭のテンポ変化点は削除できません',
  'signature-change-at-tick-0': '先頭の拍子変化点は削除できません',
}

const NO_SELECTION_TO_COPY_MESSAGE =
  'コピーするノーツが選択されていません。Shift を押しながらドラッグして、ノーツを選択してください'
const NO_SELECTION_TO_MOVE_MESSAGE =
  '動かすノーツが選択されていません。「全選択」を押すか、Shift を押しながらドラッグして、ノーツを選択してください'
const NO_ROOM_TO_MOVE_MESSAGE = '先頭より前には動かせません'
const NO_NOTES_TO_SELECT_MESSAGE = '選択できるノーツがありません'
const NO_COPIED_NOTES_MESSAGE =
  '貼り付けるノーツがありません。ノーツを選択して、Ctrl+C (Mac は Cmd+C) でコピーしてください'
const NO_PASTE_POSITION_MESSAGE =
  '貼り付ける位置が決まっていません。マウスをノーツのレーンの上に置いて、もう一度貼り付けてください'

/** エディタの状態。 */
export interface EditorState {
  readonly projectInfo: ProjectInfo
  readonly chart: Chart
  /** 曲名。プロジェクトの名前で、書き出す譜面ファイルの名前とクラウドの保存に使う。 */
  readonly songName: string
  /** 譜面名。書き出す譜面ファイルの名前とクラウドの保存に使う。 */
  readonly chartName: string
  /** クラウドから開いた、または保存したプロジェクトの識別子と更新時刻。保存のとき、ほかでの更新を上書きしないために使う。 */
  readonly cloudBaseline: { readonly projectId: string; readonly updatedAt: number } | null
  readonly past: readonly Snapshot[]
  readonly future: readonly Snapshot[]
  readonly selectedNoteIds: readonly string[]
  readonly clipboard: ClipboardData
  readonly gridDivision: GridDivision
  readonly laneCount: number
  /** 小節数。譜面の長さで、スクロールの上限を決める。 */
  readonly barCount: number
  /** タイムラインの下端にある tick。 */
  readonly scrollTick: number
  /** プレビューの再生位置 (tick)。エディタのスクロール位置とは独立で、プレビューを止めたとき、止めた位置になる。 */
  readonly previewTick: number
  readonly pixelsPerTick: number
  readonly mode: EditorMode
  readonly notice: Notice | null
  readonly metronomeEnabled: boolean
  readonly hoverPoint: PointRef | null
  readonly cursorPoint: ChartPoint | null
  /** 「貼り付け」ボタンを押して、貼り付ける位置の選択を待っているか。 */
  readonly isPasteTargeting: boolean
  readonly audio: LoadedAudio | null
  readonly isLoadingAudio: boolean
  readonly isDialogOpen: boolean
}

/** クラウドから開いた譜面と、それが属するプロジェクト。 */
export interface OpenedCloudChart {
  readonly projectId: string
  /** プロジェクトの、クラウドでの更新時刻 (ミリ秒)。 */
  readonly updatedAt: number
  readonly songName: string
  readonly chartName: string
  readonly projectInfo: ProjectInfo
  readonly barCount: number
  readonly laneCount: number
  readonly chart: Chart
}

/** エディタの操作。 */
export interface EditorActions {
  placeTap(at: ChartPoint): void
  createLong(start: ChartPoint, end: ChartPoint): void
  extendLong(ref: PointRef, to: ChartPoint): void
  setFlick(ref: PointRef, direction: FlickDirection): void
  clearFlick(ref: PointRef): void
  setFlickAtHover(direction: FlickDirection): void
  clearFlickAtHover(): void
  deletePoint(ref: PointRef): void
  movePoint(ref: PointRef, to: ChartPoint): void
  moveNote(noteId: string, deltaTick: number, deltaLane: number): void
  /** 選択中のノーツ全体を、拍の数だけ後ろ (正) または前 (負) へ動かす。1 拍の長さは、選択中の最初のノーツがある場所の拍子で決める。 */
  moveSelection(beats: number): void
  /** 全てのノーツを選択する。全てのノーツがすでに選択されているときは、選択を解除する。 */
  selectAll(): void
  selectRect(rect: SelectionRect): void
  mirrorSelection(): void
  copySelection(): void
  cutSelection(): void
  paste(): void
  /** 貼り付ける位置の選択を始める。選択の最中に呼ぶと、貼り付けずに選択を終える。コピーしたノーツがないときは、通知を出して始めない。 */
  togglePasteTargeting(): void
  /** 貼り付ける位置の選択を、貼り付けずに終える。 */
  cancelPasteTargeting(): void
  /** 指定の位置を原点にコピーしたノーツを貼り付けて、位置の選択を終える。貼り付けられなかったときは、通知を出して、位置の選択を続ける。 */
  pasteAt(point: ChartPoint): void
  undo(): void
  redo(): void
  setGridDivision(division: GridDivision): void
  requestLaneCount(laneCount: number): void
  requestBarCount(barCount: number): void
  scrollBy(deltaTick: number): void
  zoomBy(factor: number): void
  setScrollTick(tick: number): void
  setPreviewTick(tick: number): void
  setMode(mode: EditorMode): void
  setMetronomeEnabled(enabled: boolean): void
  setHoverPoint(ref: PointRef | null): void
  setCursorPoint(point: ChartPoint | null): void
  setTempoAt(tick: number, bpm: number): void
  removeTempoAt(tick: number): void
  setSignatureChangeAt(tick: number, num: number, den: number): void
  removeSignatureChangeAt(tick: number): void
  setOffset(offsetMs: number): void
  setAudio(audio: LoadedAudio | null): void
  setSongName(songName: string): void
  setChartName(chartName: string): void
  setCloudBaseline(baseline: { readonly projectId: string; readonly updatedAt: number }): void
  setLoadingAudio(isLoading: boolean): void
  setDialogOpen(isOpen: boolean): void
  loadChart(chart: Chart, laneCount: number, projectInfo: ProjectInfo): void
  openCloudChart(opened: OpenedCloudChart): void
  /** MIDI から取り込んだ譜面を反映する。imported のテンポ・拍子は、取り込む場合だけ値を渡し (null なら、いまの値のまま)、オフセットは変えない。 */
  applyMidiImport(chart: Chart, imported: MidiImportedProjectInfo): void
  showNotice(message: string): void
  dismissNotice(): void
}

/** MIDI から取り込むプロジェクト情報。取り込まないものは null。 */
export interface MidiImportedProjectInfo {
  readonly tempo: readonly TempoChange[] | null
  readonly meter: readonly SignatureChange[] | null
}

function createNotice(message: string): Notice {
  return { id: nextNoticeSerial++, message }
}

/** 譜面とプロジェクト情報を全て含むように、小節数を必要なだけ広げた値を返す。小節数の上限は超えない。 */
function expandBarCount(barCount: number, projectInfo: ProjectInfo, chart: Chart): number {
  return Math.min(MAX_BAR_COUNT, Math.max(barCount, calculateRequiredBarCount(projectInfo, chart)))
}

function clampScroll(tick: number, limit: number): number {
  return Math.min(limit, Math.max(MIN_SCROLL_TICK, tick))
}

function countOutOfRangeNotes(chart: Chart, laneCount: number): number {
  return chart.notes.filter((note) => listPoints(note).some((point) => point.lane >= laneCount)).length
}

const DEFAULT_CHART_NAME = 'easy'

function removeExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

/** エディタの状態を持つストア。 */
export const useEditorStore = create<EditorState & EditorActions>()((set, get) => {
  const commit = (next: Partial<Pick<Snapshot, 'projectInfo' | 'chart'>>, extra: Partial<EditorState> = {}): void => {
    const { projectInfo, chart, past } = get()
    set({
      past: [...past, { projectInfo, chart }].slice(-HISTORY_LIMIT),
      future: [],
      projectInfo: next.projectInfo ?? projectInfo,
      chart: next.chart ?? chart,
      ...extra,
    })
  }

  const applyEdit = (result: EditResult, extra: (chart: Chart) => Partial<EditorState> = () => ({})): void => {
    if (result.ok) {
      commit({ chart: result.chart }, extra(result.chart))
      return
    }
    set({ notice: createNotice(FAILURE_MESSAGES[result.reason]) })
  }

  const applyProjectInfoRemoval = (result: ProjectInfoEditResult): void => {
    if (result.ok) {
      commit({ projectInfo: result.projectInfo })
      return
    }
    set({ notice: createNotice(PROJECT_INFO_FAILURE_MESSAGES[result.reason]) })
  }

  /** 指定の位置を原点に、コピーしたノーツを貼り付ける。貼り付けられなかったときは、通知を出して false を返す。 */
  const pasteAtPoint = (origin: ChartPoint): boolean => {
    const { chart, clipboard, laneCount } = get()
    const before = new Set(chart.notes.map((note) => note.id))
    const result = pasteClipboard(chart, clipboard, origin, createNoteId, laneCount)
    applyEdit(result, (next) => ({
      selectedNoteIds: next.notes.filter((note) => !before.has(note.id)).map((note) => note.id),
    }))
    return result.ok
  }

  /** 読み込む譜面とプロジェクト情報が、いまの小節数に収まらないとき、収まるように小節数を広げる状態の更新を返す。 */
  const expandBarCountFor = (projectInfo: ProjectInfo, chart: Chart): Partial<EditorState> => {
    const current = get().barCount
    const expanded = expandBarCount(current, projectInfo, chart)
    return expanded === current ? {} : { barCount: expanded }
  }

  return {
    projectInfo: createInitialProjectInfo(),
    chart: { notes: [] },
    songName: '',
    chartName: DEFAULT_CHART_NAME,
    cloudBaseline: null,
    past: [],
    future: [],
    selectedNoteIds: [],
    clipboard: { notes: [] },
    gridDivision: DEFAULT_GRID_DIVISION,
    laneCount: DEFAULT_LANE_COUNT,
    barCount: DEFAULT_BAR_COUNT,
    scrollTick: MIN_SCROLL_TICK,
    previewTick: 0,
    pixelsPerTick: DEFAULT_PIXELS_PER_TICK,
    mode: 'editor',
    notice: null,
    metronomeEnabled: false,
    hoverPoint: null,
    cursorPoint: null,
    isPasteTargeting: false,
    audio: null,
    isLoadingAudio: false,
    isDialogOpen: false,

    placeTap(at) {
      const { chart, laneCount } = get()
      applyEdit(addNote(chart, { id: createNoteId(), type: 'tap', tick: at.tick, lane: at.lane }, laneCount))
    },
    createLong(start, end) {
      const { chart, laneCount } = get()
      applyEdit(
        addNote(
          chart,
          {
            id: createNoteId(),
            type: 'long',
            tick: start.tick,
            lane: start.lane,
            path: [end],
            end: { kind: 'release' },
          },
          laneCount,
        ),
      )
    },
    extendLong(ref, to) {
      const { chart, laneCount } = get()
      applyEdit(extendLong(chart, ref, to, laneCount))
    },
    setFlick(ref, direction) {
      const { chart, laneCount } = get()
      applyEdit(setFlickDirection(chart, ref, direction, laneCount))
    },
    clearFlick(ref) {
      const { chart, laneCount } = get()
      applyEdit(clearFlick(chart, ref, laneCount))
    },
    setFlickAtHover(direction) {
      const { chart, laneCount, hoverPoint } = get()
      applyEdit(hoverPoint === null ? NO_POINT_UNDER_MOUSE : setFlickDirection(chart, hoverPoint, direction, laneCount))
    },
    clearFlickAtHover() {
      const { chart, laneCount, hoverPoint } = get()
      applyEdit(hoverPoint === null ? NO_POINT_UNDER_MOUSE : clearFlick(chart, hoverPoint, laneCount))
    },
    deletePoint(ref) {
      const { chart, laneCount, selectedNoteIds } = get()
      applyEdit(deletePoint(chart, ref, laneCount), (next) => ({
        selectedNoteIds: selectedNoteIds.filter((id) => next.notes.some((note) => note.id === id)),
      }))
    },
    moveNote(noteId, deltaTick, deltaLane) {
      const { chart, laneCount } = get()
      applyEdit(moveNotes(chart, [noteId], deltaTick, deltaLane, laneCount))
    },
    moveSelection(beats) {
      const { chart, laneCount, selectedNoteIds, projectInfo } = get()
      const selected = chart.notes.filter((note) => selectedNoteIds.includes(note.id))
      if (selected.length === 0) {
        set({ notice: createNotice(NO_SELECTION_TO_MOVE_MESSAGE) })
        return
      }
      const firstTick = Math.min(...selected.map((note) => note.tick))
      const deltaTick = beats * locateBeatPosition(projectInfo, firstTick).beatTicks
      if (firstTick + deltaTick < 0) {
        set({ notice: createNotice(NO_ROOM_TO_MOVE_MESSAGE) })
        return
      }
      applyEdit(moveNotes(chart, selectedNoteIds, deltaTick, 0, laneCount), (next) =>
        expandBarCountFor(projectInfo, next),
      )
    },
    selectAll() {
      const { chart, selectedNoteIds } = get()
      if (chart.notes.length === 0) {
        set({ notice: createNotice(NO_NOTES_TO_SELECT_MESSAGE) })
        return
      }
      const isAllSelected = chart.notes.every((note) => selectedNoteIds.includes(note.id))
      set({ selectedNoteIds: isAllSelected ? [] : chart.notes.map((note) => note.id) })
    },
    movePoint(ref, to) {
      const { chart, laneCount } = get()
      applyEdit(movePoint(chart, ref, to, laneCount))
    },
    selectRect(rect) {
      set({ selectedNoteIds: selectNotesInRect(get().chart, rect) })
    },
    mirrorSelection() {
      const { chart, laneCount, selectedNoteIds } = get()
      applyEdit(mirrorNotes(chart, selectedNoteIds, laneCount))
    },
    copySelection() {
      const { chart, selectedNoteIds } = get()
      const clipboard = createClipboard(chart, selectedNoteIds)
      if (clipboard.notes.length === 0) {
        set({ notice: createNotice(NO_SELECTION_TO_COPY_MESSAGE) })
        return
      }
      set({ clipboard })
    },
    cutSelection() {
      const { chart, laneCount, selectedNoteIds } = get()
      const clipboard = createClipboard(chart, selectedNoteIds)
      if (clipboard.notes.length === 0) {
        set({ notice: createNotice(NO_SELECTION_TO_COPY_MESSAGE) })
        return
      }
      set({ clipboard })
      applyEdit(deleteNotes(chart, selectedNoteIds, laneCount), () => ({ selectedNoteIds: [] }))
    },
    paste() {
      const { clipboard, cursorPoint } = get()
      if (clipboard.notes.length === 0) {
        set({ notice: createNotice(NO_COPIED_NOTES_MESSAGE) })
        return
      }
      if (cursorPoint === null) {
        set({ notice: createNotice(NO_PASTE_POSITION_MESSAGE) })
        return
      }
      pasteAtPoint(cursorPoint)
    },
    togglePasteTargeting() {
      const { clipboard, isPasteTargeting } = get()
      if (isPasteTargeting) {
        set({ isPasteTargeting: false })
        return
      }
      if (clipboard.notes.length === 0) {
        set({ notice: createNotice(NO_COPIED_NOTES_MESSAGE) })
        return
      }
      set({ isPasteTargeting: true })
    },
    cancelPasteTargeting() {
      set({ isPasteTargeting: false })
    },
    pasteAt(point) {
      if (pasteAtPoint(point)) {
        set({ isPasteTargeting: false })
      }
    },
    undo() {
      const { past, future, projectInfo, chart } = get()
      const previous = past[past.length - 1]
      if (previous === undefined) {
        return
      }
      set({
        past: past.slice(0, -1),
        future: [{ projectInfo, chart }, ...future],
        projectInfo: previous.projectInfo,
        chart: previous.chart,
        selectedNoteIds: get().selectedNoteIds.filter((id) => previous.chart.notes.some((note) => note.id === id)),
      })
    },
    redo() {
      const { past, future, projectInfo, chart } = get()
      const next = future[0]
      if (next === undefined) {
        return
      }
      set({
        past: [...past, { projectInfo, chart }],
        future: future.slice(1),
        projectInfo: next.projectInfo,
        chart: next.chart,
        selectedNoteIds: get().selectedNoteIds.filter((id) => next.chart.notes.some((note) => note.id === id)),
      })
    },
    setGridDivision(division) {
      set({ gridDivision: division })
    },
    requestLaneCount(laneCount) {
      if (!LANE_COUNT_SETTING.isValid(laneCount)) {
        throw new RangeError(
          `${LANE_COUNT_SETTING.name}は ${LANE_COUNT_SETTING.requirementText}にしてください: ${laneCount}`,
        )
      }
      const outOfRange = countOutOfRangeNotes(get().chart, laneCount)
      if (outOfRange > 0) {
        set({
          notice: createNotice(`レーン数を ${laneCount} に減らすと、範囲外になるノーツが ${outOfRange} つあります`),
        })
        return
      }
      set({ laneCount })
    },
    requestBarCount(barCount) {
      if (!BAR_COUNT_SETTING.isValid(barCount)) {
        throw new RangeError(
          `${BAR_COUNT_SETTING.name}は ${BAR_COUNT_SETTING.requirementText}にしてください: ${barCount}`,
        )
      }
      const { projectInfo, chart } = get()
      const required = calculateRequiredBarCount(projectInfo, chart)
      if (barCount < required) {
        set({
          notice: createNotice(
            `小節数を ${barCount} に減らすと、範囲外になるノーツやテンポ・拍子の変化点があります。${required} 以上にしてください`,
          ),
        })
        return
      }
      set({ barCount })
    },
    scrollBy(deltaTick) {
      const { scrollTick } = get()
      set({ scrollTick: clampScroll(scrollTick + deltaTick, Math.max(calculateScrollLimit(get()), scrollTick)) })
    },
    zoomBy(factor) {
      set({ pixelsPerTick: Math.min(MAX_PIXELS_PER_TICK, Math.max(MIN_PIXELS_PER_TICK, get().pixelsPerTick * factor)) })
    },
    setScrollTick(tick) {
      set({ scrollTick: clampScroll(tick, calculateScrollLimit(get())) })
    },
    setPreviewTick(tick) {
      set({ previewTick: clampScroll(tick, calculateScrollLimit(get())) })
    },
    setMode(mode) {
      set({ mode, isPasteTargeting: false })
    },
    setMetronomeEnabled(enabled) {
      set({ metronomeEnabled: enabled })
    },
    setHoverPoint(ref) {
      set({ hoverPoint: ref })
    },
    setCursorPoint(point) {
      set({ cursorPoint: point })
    },
    setTempoAt(tick, bpm) {
      commit({ projectInfo: setTempoChange(get().projectInfo, { tick, bpm }) })
    },
    removeTempoAt(tick) {
      applyProjectInfoRemoval(removeTempoChange(get().projectInfo, tick))
    },
    setSignatureChangeAt(tick, num, den) {
      commit({ projectInfo: setSignatureChange(get().projectInfo, { tick, num, den }) })
    },
    removeSignatureChangeAt(tick) {
      applyProjectInfoRemoval(removeSignatureChange(get().projectInfo, tick))
    },
    setOffset(offsetMs) {
      commit({ projectInfo: setOffsetMs(get().projectInfo, offsetMs) })
    },
    setAudio(audio) {
      set({ audio, ...(audio !== null && get().songName === '' ? { songName: removeExtension(audio.name) } : {}) })
    },
    setSongName(songName) {
      set({ songName })
    },
    setChartName(chartName) {
      set({ chartName })
    },
    setCloudBaseline(baseline) {
      set({ cloudBaseline: baseline })
    },
    setLoadingAudio(isLoading) {
      set({ isLoadingAudio: isLoading })
    },
    setDialogOpen(isOpen) {
      set({ isDialogOpen: isOpen })
    },
    loadChart(chart, laneCount, projectInfo) {
      commit({ chart, projectInfo }, { selectedNoteIds: [], laneCount, ...expandBarCountFor(projectInfo, chart) })
    },
    openCloudChart(opened) {
      commit(
        { chart: opened.chart, projectInfo: opened.projectInfo },
        {
          selectedNoteIds: [],
          songName: opened.songName,
          cloudBaseline: { projectId: opened.projectId, updatedAt: opened.updatedAt },
          chartName: opened.chartName,
          laneCount: opened.laneCount,
          barCount: expandBarCount(opened.barCount, opened.projectInfo, opened.chart),
        },
      )
    },
    applyMidiImport(chart, imported) {
      const { projectInfo } = get()
      const merged: ProjectInfo = {
        ...projectInfo,
        tempo: imported.tempo ?? projectInfo.tempo,
        meter: imported.meter ?? projectInfo.meter,
      }
      commit(
        { chart, projectInfo: merged },
        {
          selectedNoteIds: [],
          ...expandBarCountFor(merged, chart),
        },
      )
    },
    showNotice(message) {
      set({ notice: createNotice(message) })
    },
    dismissNotice() {
      set({ notice: null })
    },
  }
})
