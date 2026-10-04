/** 波形のピークを求める間隔 (秒)。 */
export const PEAK_SECONDS = 0.01

/**
 * 音源から、一定の間隔ごとの振幅のピーク (0 以上 1 以下) を求める。
 * 全チャンネルの絶対値の最大を使い、全体の最大が 1 になるよう正規化する。
 */
export function computePeaks(buffer: AudioBuffer, peakSeconds: number = PEAK_SECONDS): Float32Array {
  const windowSize = Math.max(1, Math.floor(buffer.sampleRate * peakSeconds))
  const peaks = new Float32Array(Math.ceil(buffer.length / windowSize))
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel)
    for (let i = 0; i < peaks.length; i++) {
      const end = Math.min(samples.length, (i + 1) * windowSize)
      let max = peaks[i] as number
      for (let j = i * windowSize; j < end; j++) {
        const value = Math.abs(samples[j] as number)
        if (value > max) {
          max = value
        }
      }
      peaks[i] = max
    }
  }
  const overall = peaks.reduce((max, value) => Math.max(max, value), 0)
  return overall === 0 ? peaks : peaks.map((value) => value / overall)
}
