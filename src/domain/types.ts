/** フリックの方向。 */
export type FlickDirection = 'up' | 'left' | 'right'

/** ロングの終端の種類。離すか、指定方向へのフリックか。 */
export type LongEnd = { readonly kind: 'release' } | { readonly kind: 'flick'; readonly direction: FlickDirection }

/** tick とレーンで表す譜面上の点。 */
export interface ChartPoint {
  readonly tick: number
  readonly lane: number
}

/** タップ。 */
export interface TapNote {
  readonly id: string
  readonly type: 'tap'
  readonly tick: number
  readonly lane: number
}

/** フリック。 */
export interface FlickNote {
  readonly id: string
  readonly type: 'flick'
  readonly tick: number
  readonly lane: number
  readonly direction: FlickDirection
}

/** ロング。始点に続く点の並び (path) を持ち、最後の点が終端になる。 */
export interface LongNote {
  readonly id: string
  readonly type: 'long'
  readonly tick: number
  readonly lane: number
  readonly path: readonly ChartPoint[]
  readonly end: LongEnd
}

/** 譜面のノーツ。 */
export type Note = TapNote | FlickNote | LongNote

/** 1 難易度分の譜面。ノーツは tick 順、同じ tick なら lane 順に並ぶ。 */
export interface Chart {
  readonly notes: readonly Note[]
}

/** テンポ変化点。BPM は 4分音符基準。 */
export interface TempoChange {
  readonly tick: number
  readonly bpm: number
}

/** 拍子変化点。 */
export interface SignatureChange {
  readonly tick: number
  readonly num: number
  readonly den: number
}

/** 全難易度で共有するプロジェクト情報。 */
export interface ProjectInfo {
  readonly offsetMs: number
  readonly tempo: readonly TempoChange[]
  readonly meter: readonly SignatureChange[]
}

/** ノーツ上の点の指定。index 0 が始点、index n (n ≥ 1) が path の n 番目の点。 */
export interface PointRef {
  readonly noteId: string
  readonly index: number
}

type TapBody = Omit<TapNote, 'id'>
type FlickBody = Omit<FlickNote, 'id'>
type LongBody = Omit<LongNote, 'id'>

/** id を持たないノーツ。クリップボードや読み込み直後の値に使う。 */
export type NoteBody = TapBody | FlickBody | LongBody
