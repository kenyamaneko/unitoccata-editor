import { MAX_NAME_LENGTH } from './constants.ts'

/** 曲名または譜面名の入力の問題を、画面に出す文言にする。問題がなければ null。空 (空白だけを含む) と、長すぎる名前は使えない。 */
export function findNameMessage(label: string, name: string): string | null {
  if (name.trim().length === 0) {
    return `${label}を入力してください`
  }
  return name.length > MAX_NAME_LENGTH
    ? `${label}は ${MAX_NAME_LENGTH} 文字以内にしてください (今は ${name.length} 文字です)`
    : null
}

/** 曲名の入力の問題を、画面に出す文言にする。問題がなければ null。 */
export function findSongNameMessage(songName: string): string | null {
  return findNameMessage('曲名', songName)
}

/** 譜面名の入力の問題を、画面に出す文言にする。問題がなければ null。 */
export function findChartNameMessage(chartName: string): string | null {
  return findNameMessage('譜面名', chartName)
}
