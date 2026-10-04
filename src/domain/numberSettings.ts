import {
  DEFAULT_BAR_COUNT,
  DEFAULT_LANE_COUNT,
  MAX_BAR_COUNT,
  MAX_LANE_COUNT,
  MIN_BAR_COUNT,
  MIN_LANE_COUNT,
} from './constants.ts'

/** 数値の設定。 */
export interface NumberSetting {
  /** 画面とメッセージで使う名前。 */
  readonly name: string
  readonly defaultValue: number
  /** 既定値を、単位を付けてメッセージに出す形にした文字列。 */
  readonly defaultText: string
  /** 使える値の条件を、メッセージに出す形にした文字列。 */
  readonly requirementText: string
  readonly isValid: (value: number) => boolean
}

/** レーン数の設定。 */
export const LANE_COUNT_SETTING: NumberSetting = {
  name: 'レーン数',
  defaultValue: DEFAULT_LANE_COUNT,
  defaultText: String(DEFAULT_LANE_COUNT),
  requirementText: `${MIN_LANE_COUNT} 以上 ${MAX_LANE_COUNT} 以下の整数`,
  isValid: (value) => Number.isInteger(value) && value >= MIN_LANE_COUNT && value <= MAX_LANE_COUNT,
}

/** 小節数 (譜面の長さ) の設定。 */
export const BAR_COUNT_SETTING: NumberSetting = {
  name: '小節数',
  defaultValue: DEFAULT_BAR_COUNT,
  defaultText: String(DEFAULT_BAR_COUNT),
  requirementText: `${MIN_BAR_COUNT} 以上 ${MAX_BAR_COUNT} 以下の整数`,
  isValid: (value) => Number.isInteger(value) && value >= MIN_BAR_COUNT && value <= MAX_BAR_COUNT,
}
