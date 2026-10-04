let sharedContext: AudioContext | null = null

/** 画面全体で共有する AudioContext を返す。最初の呼び出しで作る。作れなければ、利用者に見せる文言を付けた例外にする。 */
export function getAudioContext(): AudioContext {
  if (sharedContext === null) {
    try {
      sharedContext = new AudioContext()
    } catch (cause) {
      throw new Error('音声を再生する機能を作れませんでした。ページを読み込み直してから、もう一度お試しください', {
        cause,
      })
    }
  }
  return sharedContext
}
