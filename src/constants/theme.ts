import type { FlickDirection } from '../domain/types.ts'

/** タイムラインの描画に使う色。 */
export const THEME = {
  background: '#0b1020',
  laneEven: '#15203d',
  laneOdd: '#0a0f1f',
  laneBorder: '#1e2a4a',
  gridLine: '#2b3a66',
  beatLine: '#3e528f',
  barLine: '#6b83c9',
  barLabel: '#a9b8e6',
  sideLane: '#0a0f1e',
  sideText: '#a9b8e6',
  editingTarget: '#38bdf8',
  editingTargetFill: 'rgba(56, 189, 248, 0.28)',
  waveform: 'rgba(56, 189, 248, 0.22)',
  tap: '#38bdf8',
  long: '#059669',
  longPoint: '#6ee7b7',
  longEdge: '#ecfdf5',
  arrow: '#ffffff',
  selected: '#fbbf24',
  rubberBand: 'rgba(251, 191, 36, 0.18)',
  rubberBandBorder: '#fbbf24',
  ghost: 'rgba(255, 255, 255, 0.35)',
  dragMarker: 'rgba(255, 255, 255, 0.9)',
  dragInvalid: '#f87171',
  shortNoteBorder: 'rgba(255,255,255,0.5)',
} as const

/**
 * フリックの向きごとの色。エディタとプレビューで共通。
 * タップノーツ (水色)、ロングノーツ (緑)、選択の枠 (黄) と見分けがつくように選んだ。
 */
export const FLICK_COLORS: Readonly<Record<FlickDirection, string>> = {
  up: '#f472b6',
  left: '#a78bfa',
  right: '#fb923c',
}

/** タップノーツとフリックノーツの高さ (px)。 */
export const NOTE_HEIGHT = 14

/** ノーツの幅がレーン幅に占める割合。 */
export const NOTE_WIDTH_RATIO = 0.8

/** ロングノーツを作るドラッグ中に、始点と終点に描く丸の半径 (px)。 */
export const DRAG_MARKER_RADIUS = 6

/** 点の半径 (px)。 */
export const POINT_RADIUS = 7

/** 矢印の大きさ (px)。 */
export const ARROW_SIZE = 6

/** 線の太さ (px)。 */
export const LINE_WIDTH = 1

/** 小節線の太さ (px)。グリッド線と拍の線 (LINE_WIDTH) より太くして、見分けやすくする。 */
export const BAR_LINE_WIDTH = 2

/** 選択中のノーツの線の太さ (px)。 */
export const SELECTED_LINE_WIDTH = 2

/** ドラッグ中の線の太さ (px)。 */
export const DRAG_LINE_WIDTH = 3

/** 1 px の線を、ぼやけずに描くためのずらし量 (px)。 */
export const HAIRLINE_OFFSET = 0.5

/** BPM と拍子の入力先を示す帯の高さ (px)。変化点の線から上へ伸ばす。 */
export const EDITING_TARGET_HEIGHT = 24

/** 小節番号を、拍の線から上へずらす量 (px)。 */
export const BAR_LABEL_OFFSET_Y = 11

/** テンポと拍子の表示を、列の左端から内側へ寄せる量 (px)。 */
export const SIDE_LABEL_MARGIN_LEFT = 6

/** テンポと拍子の表示を、変化点の線から上へずらす量 (px)。 */
export const SIDE_LABEL_OFFSET_Y = 10

/** テンポの表示の頭に付ける記号。 */
export const TEMPO_LABEL_PREFIX = '♩='

/** ロングノーツの終端フリックの矢印を、点から上へ離す量 (px)。 */
export const LONG_END_ARROW_GAP = 2

/** タップノーツとフリックノーツの角の丸み (px)。 */
export const NOTE_CORNER_RADIUS = 4

/** プレビューの描画に使う色。UniToccata のサンプルゲーム (hoge-fugue) のプレイ画面に合わせる。 */
export const PREVIEW_THEME = {
  background: '#0a0e26',
  laneLine: 'rgba(242, 235, 217, 0.35)',
  judgeLine: '#f2ebd9',
  barLine: 'rgba(242, 235, 217, 0.7)',
  beatLine: 'rgba(242, 235, 217, 0.22)',
  barLabel: 'rgba(242, 235, 217, 0.9)',
} as const

/** プレビューの小節番号の字体。 */
export const PREVIEW_BAR_LABEL_FONT = '700 14px ui-sans-serif, system-ui, sans-serif'

/** プレビューの小節番号を、レーンの左端から外側へ離す量 (px)。 */
export const PREVIEW_BAR_LABEL_MARGIN = 8

/** プレビューの判定ラインの線の太さ (px)。 */
export const PREVIEW_JUDGE_LINE_WIDTH = 3
