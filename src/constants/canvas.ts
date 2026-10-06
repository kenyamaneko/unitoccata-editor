/** テンポレーンの幅 (px)。 */
export const TEMPO_LANE_WIDTH = 64

/** 拍子レーンの幅 (px)。 */
export const METER_LANE_WIDTH = 64

/** 小節番号のレーンの幅 (px)。 */
export const BAR_LANE_WIDTH = 48

/** ノーツレーンの右の余白 (px)。 */
export const NOTE_AREA_RIGHT_MARGIN = 16

/** タイムラインの下端の余白 (px)。先頭の位置をブラウザの下端から離して、操作しやすくする。 */
export const TIMELINE_BOTTOM_MARGIN = 32

/** タイムラインの上端の余白 (px)。譜面の終わりまでスクロールしたとき、終わりをブラウザの上端から離して、操作しやすくする。 */
export const TIMELINE_TOP_MARGIN = 32

/** 1 tick あたりの高さ (px) の初期値。 */
export const DEFAULT_PIXELS_PER_TICK = 0.12

/** ズームで縮められる 1 tick あたりの高さ (px) の下限。 */
export const MIN_PIXELS_PER_TICK = 0.02

/** ズームで広げられる 1 tick あたりの高さ (px) の上限。 */
export const MAX_PIXELS_PER_TICK = 0.6

/** ホイールを 1 目盛り回したときのズームの倍率。 */
export const ZOOM_STEP_FACTOR = 1.15

/** ホイールの量が行単位 (Firefox など) のときの、1 行に相当する量 (px)。 */
export const WHEEL_LINE_PIXELS = 40

/** ホイールの量が px 単位のときの、1 単位に相当する量 (px)。 */
export const WHEEL_PIXEL_UNIT_PIXELS = 1

/** ノーツの点を掴める半径 (px)。 */
export const POINT_HIT_RADIUS = 12

/** スクロール位置 (タイムラインの下端にある tick) の下限。 */
export const MIN_SCROLL_TICK = 0

/**
 * プレビューで、ノーツが画面の上端から判定ラインまで流れる曲内の時間 (秒)。
 * UniToccata のサンプルゲーム (hoge-fugue) の、ノーツの速さの初期値 5 (6 秒 ÷ 5 = 1.2 秒) より速い、ノーツの速さ 7.5 (6 秒 ÷ 7.5 = 0.8 秒) にする。
 */
export const PREVIEW_VISIBLE_SECONDS = 0.8

/** プレビューで、レーン全体の幅が画面の幅に占める割合。レーンは画面の中央に置く。 */
export const PREVIEW_FIELD_WIDTH_RATIO = 0.5

/** プレビューで、判定ラインの位置が画面の高さに占める割合 (上端が 0)。 */
export const PREVIEW_JUDGE_LINE_RATIO = 0.82

/** プレビューで、タップノーツとフリックノーツの高さが、判定ラインの y 座標に占める割合。 */
export const PREVIEW_NOTE_HEIGHT_RATIO = 0.06

/** プレビューで、ノーツの幅がレーン幅に占める割合。 */
export const PREVIEW_NOTE_WIDTH_RATIO = 0.9

/** プレビューで、ロングノーツの本体を折れ線で描くときの、点の間隔 (tick)。 */
export const PREVIEW_LONG_BODY_STEP_TICKS = 120

/** プレビューで、フリックの矢印の大きさが、ノーツの高さに占める割合。 */
export const PREVIEW_FLICK_MARK_RATIO = 0.4

/** プレビューで、画面の上端より先にあるノーツを描き始める余裕 (流れる位置の単位。上端が 1)。 */
export const PREVIEW_CULL_MARGIN = 0.1

/** スクロールバーの幅 (px)。 */
export const SCROLLBAR_WIDTH = 24

/** スクロールバーのつまみの高さの下限 (px)。範囲が長くても、つまみがつかめる大きさを保つ。 */
export const SCROLLBAR_MIN_THUMB_HEIGHT = 40

/** ドラッグ中に、ポインタがタイムラインの上端または下端からこの距離 (px) 以内に入ると、自動でスクロールする。 */
export const AUTO_SCROLL_EDGE_PX = 48

/** ドラッグ中の自動スクロールの最大の速さ (px/秒)。ポインタが端に近いほど速く、端から外に出ているときは最大になる。 */
export const AUTO_SCROLL_MAX_PX_PER_SECOND = 900
