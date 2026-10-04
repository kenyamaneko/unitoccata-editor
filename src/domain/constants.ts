/** 4分音符 1 つ分の tick 数。 */
export const TICKS_PER_QUARTER = 960

/** 全音符 1 つ分の tick 数。 */
export const TICKS_PER_WHOLE = TICKS_PER_QUARTER * 4

/** 1 分あたりの秒数。BPM から秒への変換に使う。 */
export const SECONDS_PER_MINUTE = 60

/** 1 分あたりのマイクロ秒数。MIDI のテンポ (4分音符あたりのマイクロ秒) から BPM への変換に使う。 */
export const MICROSECONDS_PER_MINUTE = 60_000_000

/** 1 秒あたりのミリ秒数。 */
export const MILLISECONDS_PER_SECOND = 1000

/** グリッド分割として選べる値 (何分音符か)。 */
export const GRID_DIVISIONS = [4, 8, 12, 16, 24, 32] as const

/** グリッド分割の型。 */
export type GridDivision = (typeof GRID_DIVISIONS)[number]

/** グリッド分割の初期値。 */
export const DEFAULT_GRID_DIVISION: GridDivision = 16

/** レーン数の初期値。 */
export const DEFAULT_LANE_COUNT = 5

/** ノーツの中心どうしが、この値 (レーン数) より近いと、ノーツが重なって見える。ノーツの幅 (レーン幅の 0.8 倍) に合わせる。 */
export const NOTE_OVERLAP_LANE_DISTANCE = 0.8

/** 1 つの譜面に置けるノーツの数の上限。ロングノーツは 1 個と数える。 */
export const MAX_NOTE_COUNT = 3000

/** 曲名と譜面名の長さの上限 (文字数)。 */
export const MAX_NAME_LENGTH = 100

/** レーン数として設定できる最小値。 */
export const MIN_LANE_COUNT = 1

/** 小節数 (譜面の長さ) の初期値。 */
export const DEFAULT_BAR_COUNT = 50

/** 小節数として設定できる最小値。 */
export const MIN_BAR_COUNT = 1

/** 小節数として設定できる最大値。 */
export const MAX_BAR_COUNT = 1000

/** レーン数として設定できる最大値。譜面ファイルのレーン番号 (lane) は、この値未満でなければならない。 */
export const MAX_LANE_COUNT = 16

/** ロングの閾値 (px)。押してから離すまでの移動がこの値未満ならクリック、以上ならドラッグとする。 */
export const LONG_THRESHOLD = 4

/** フリックの閾値。ドラッグの移動量が、左右はレーン幅、上下はグリッド 1 マスの高さに対するこの割合以上のとき、フリックの向きを決める。 */
export const FLICK_THRESHOLD = 0.5

/** 新しいプロジェクト情報の BPM の初期値。 */
export const DEFAULT_BPM = 120

/** BPM として使える最小値。 */
export const MIN_BPM = 20

/** BPM として使える最大値。 */
export const MAX_BPM = 300

/** MIDI のテンポ (4分音符あたりのマイクロ秒) として使える最小値。BPM の最大値に対応する。 */
export const MIN_MICROSECONDS_PER_QUARTER = MICROSECONDS_PER_MINUTE / MAX_BPM

/** MIDI のテンポ (4分音符あたりのマイクロ秒) として使える最大値。BPM の最小値に対応する。 */
export const MAX_MICROSECONDS_PER_QUARTER = MICROSECONDS_PER_MINUTE / MIN_BPM

/** 拍子の分子として使える最小値。 */
export const MIN_METER_NUM = 1

/** 拍子の分子として使える最大値。 */
export const MAX_METER_NUM = 99

/** 新しいプロジェクト情報の拍子の分子の初期値。 */
export const DEFAULT_METER_NUM = 4

/** 拍子の分母として使える値 (何分音符を 1 拍とするか)。 */
export const METER_DENOMINATORS = [2, 4, 8, 16] as const

/** 拍子の分母の型。 */
export type MeterDenominator = (typeof METER_DENOMINATORS)[number]

/** 拍子の分母として使える値を、「2、4、8、16」のように読み上げる形で並べた文字列。メッセージに使う。 */
export const METER_DENOMINATORS_TEXT = METER_DENOMINATORS.join('、')

/** 新しいプロジェクト情報の拍子の分母の初期値。 */
export const DEFAULT_METER_DEN: MeterDenominator = 4

/** 1 MB のバイト数。 */
export const BYTES_PER_MEGABYTE = 1024 * 1024

/**
 * 音源 1 ファイルの大きさの上限 (バイト)。
 * Storage のセキュリティルール (storage.rules の request.resource.size) の上限と同じ値でなければならない。
 * ルールはコードから値を共有できず、食い違うと、読み込みの検査を通った音源が保存時にサーバーに拒否されるか、保存できる音源を読み込みで拒否してしまうため。
 */
export const MAX_AUDIO_FILE_BYTES = 50 * BYTES_PER_MEGABYTE
