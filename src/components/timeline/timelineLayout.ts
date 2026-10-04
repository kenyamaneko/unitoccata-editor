import {
  BAR_LANE_WIDTH,
  METER_LANE_WIDTH,
  NOTE_AREA_RIGHT_MARGIN,
  TEMPO_LANE_WIDTH,
  TIMELINE_BOTTOM_MARGIN,
} from '../../constants/canvas.ts'

/** タイムラインを描く領域と、表示している範囲。 */
export interface TimelineViewport {
  readonly width: number
  readonly height: number
  readonly laneCount: number
  /** タイムラインの下端の余白の上にある tick。 */
  readonly scrollTick: number
  readonly pixelsPerTick: number
}

/** タイムラインの左にある、テンポと拍子の列の種類。 */
export type SideColumn = 'tempo' | 'meter'

/** タイムラインの縦の列の種類。 */
export type TimelineColumn = SideColumn | 'bar' | 'notes' | 'outside'

/** 列がテンポ列か拍子列かを判定する。 */
export function isSideColumn(column: TimelineColumn): column is SideColumn {
  return column === 'tempo' || column === 'meter'
}

/** ノーツレーンの左端の x 座標を返す。 */
export function calculateNoteAreaLeft(): number {
  return TEMPO_LANE_WIDTH + METER_LANE_WIDTH + BAR_LANE_WIDTH
}

/** ノーツレーン 1 本の幅 (px) を返す。 */
export function calculateLaneWidth(viewport: TimelineViewport): number {
  return (viewport.width - calculateNoteAreaLeft() - NOTE_AREA_RIGHT_MARGIN) / viewport.laneCount
}

/** tick の y 座標を返す。下が過去、上が未来になる。 */
export function convertTickToY(viewport: TimelineViewport, tick: number): number {
  return viewport.height - TIMELINE_BOTTOM_MARGIN - (tick - viewport.scrollTick) * viewport.pixelsPerTick
}

/** y 座標の tick を、小数を含めて返す。 */
export function convertYToTick(viewport: TimelineViewport, y: number): number {
  return viewport.scrollTick + (viewport.height - TIMELINE_BOTTOM_MARGIN - y) / viewport.pixelsPerTick
}

/** レーンの中心の x 座標を返す。 */
export function convertLaneToCenterX(viewport: TimelineViewport, lane: number): number {
  return calculateNoteAreaLeft() + (lane + 0.5) * calculateLaneWidth(viewport)
}

/** x 座標を、レーン i が [i, i+1) を占めるレーン座標に変換する。 */
export function convertXToLanePosition(viewport: TimelineViewport, x: number): number {
  return (x - calculateNoteAreaLeft()) / calculateLaneWidth(viewport)
}

/** x 座標がどの列にあるかを返す。 */
export function classifyColumn(viewport: TimelineViewport, x: number): TimelineColumn {
  if (x < 0 || x >= viewport.width) {
    return 'outside'
  }
  if (x < TEMPO_LANE_WIDTH) {
    return 'tempo'
  }
  if (x < TEMPO_LANE_WIDTH + METER_LANE_WIDTH) {
    return 'meter'
  }
  if (x < calculateNoteAreaLeft()) {
    return 'bar'
  }
  return x < viewport.width - NOTE_AREA_RIGHT_MARGIN ? 'notes' : 'outside'
}

/** 画面に見える tick の範囲を返す。 */
export function calculateVisibleTickRange(viewport: TimelineViewport): { readonly from: number; readonly to: number } {
  return { from: convertYToTick(viewport, viewport.height), to: convertYToTick(viewport, 0) }
}

/** テンポ列の x 座標の範囲を返す。 */
export function getTempoColumnRange(): { readonly left: number; readonly right: number } {
  return { left: 0, right: TEMPO_LANE_WIDTH }
}

/** 拍子列の x 座標の範囲を返す。 */
export function getMeterColumnRange(): { readonly left: number; readonly right: number } {
  return { left: TEMPO_LANE_WIDTH, right: TEMPO_LANE_WIDTH + METER_LANE_WIDTH }
}

/** 小節番号の列の x 座標の範囲を返す。 */
export function getBarColumnRange(): { readonly left: number; readonly right: number } {
  return { left: TEMPO_LANE_WIDTH + METER_LANE_WIDTH, right: TEMPO_LANE_WIDTH + METER_LANE_WIDTH + BAR_LANE_WIDTH }
}
