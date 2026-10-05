import { convertTickToAudioSeconds } from '../../domain/projectInfo.ts'
import type { ProjectInfo } from '../../domain/types.ts'
import { logFailure } from '../../utils/logFailure.ts'
import { buildClickSchedule } from '../../domain/previewSchedule.ts'

/** 再生を始めるまでの猶予 (秒)。音の準備に使う。 */
const START_LEAD_SECONDS = 0.25

/** 先読みして再生指示を入れる範囲 (秒)。 */
const LOOKAHEAD_SECONDS = 1.0

/** 再生指示を入れ直す間隔 (ミリ秒)。 */
const SCHEDULER_INTERVAL_MS = 100

const CLICK_SECONDS = 0.04
const CLICK_HZ = 1500
const CLICK_GAIN = 0.35
const MINIMUM_ENVELOPE_GAIN = 0.0001

/** 再生中のプレビュー。 */
export interface PreviewSession {
  /** 再生を始めてからの経過秒を返す。 */
  getElapsedSeconds(): number
  /** 再生を止め、止めた時点の経過秒を返す。 */
  stop(): number
  /** 再生を続けたまま、指定の tick から再生し直す。経過秒は 0 に戻る。 */
  seek(startTick: number): void
}

/** プレビューの再生に必要な情報。 */
export interface PreviewRequest {
  readonly context: AudioContext
  readonly audio: AudioBuffer | null
  readonly projectInfo: ProjectInfo
  readonly startTick: number
  readonly metronomeEnabled: boolean
  readonly endTick: number
  /** 開始後に再生を続けられなくなったとき、原因を渡して呼ばれる。再生は止まっていないので、呼び出し側が session.stop() で止める。 */
  readonly onFailure: (error: Error) => void
}

const RESUME_FAILED_MESSAGE = '音声の再生を再開できませんでした。もう一度プレビューを押してください'
const AUDIO_FAILED_MESSAGE = '音源を再生できませんでした。音源を読み込み直してから、もう一度プレビューを押してください'
const CLICK_FAILED_MESSAGE =
  'クリック音を鳴らせませんでした。クリック音を OFF にするか、もう一度プレビューを押してください'
const CLICK_STOPPED_MESSAGE =
  'クリック音を鳴らせなくなったため、プレビューを止めました。クリック音を OFF にするか、もう一度プレビューを押してください'

function playClick(context: AudioContext, destination: AudioNode, when: number): AudioScheduledSourceNode {
  const oscillator = context.createOscillator()
  oscillator.frequency.value = CLICK_HZ
  const gain = context.createGain()
  gain.gain.setValueAtTime(CLICK_GAIN, when)
  gain.gain.exponentialRampToValueAtTime(MINIMUM_ENVELOPE_GAIN, when + CLICK_SECONDS)
  oscillator.connect(gain).connect(destination)
  oscillator.start(when)
  oscillator.stop(when + CLICK_SECONDS)
  return oscillator
}

/** 後始末の失敗は、元の失敗を隠さないよう、ログに残して先へ進む。 */
function releaseQuietly(release: () => void): void {
  try {
    release()
  } catch (error) {
    logFailure('previewEngine.releaseFailed', error)
  }
}

async function resumeContext(context: AudioContext): Promise<void> {
  try {
    await context.resume()
  } catch (cause) {
    throw new Error(RESUME_FAILED_MESSAGE, { cause })
  }
}

/**
 * 音源の再生を、音源の startAudioSeconds 秒の位置から、baseTime (AudioContext の時刻) に始めるように予約する。
 * startAudioSeconds が負のときは、その分だけ遅らせて、音源の先頭から始める。
 */
function playAudio(
  context: AudioContext,
  audio: AudioBuffer,
  baseTime: number,
  startAudioSeconds: number,
): AudioBufferSourceNode {
  const source = context.createBufferSource()
  try {
    source.buffer = audio
    source.connect(context.destination)
    if (startAudioSeconds >= 0) {
      source.start(baseTime, startAudioSeconds)
    } else {
      source.start(baseTime - startAudioSeconds)
    }
  } catch (cause) {
    releaseQuietly(() => source.disconnect())
    throw new Error(AUDIO_FAILED_MESSAGE, { cause })
  }
  return source
}

/**
 * プレビューの再生を始める。音源は等倍で流し、
 * メトロノームのクリック音は、再生の経過時間に合わせて正確に鳴らす。
 * 始められなければ、鳴らし始めた音を止めてから、原因ごとの文言を付けた例外にする。
 */
export async function startPreview(request: PreviewRequest): Promise<PreviewSession> {
  const { context, audio, projectInfo, startTick } = request
  await resumeContext(context)
  let baseTime = context.currentTime + START_LEAD_SECONDS
  let audioSource =
    audio === null ? null : playAudio(context, audio, baseTime, convertTickToAudioSeconds(projectInfo, startTick))

  const planClicks = (fromTick: number): number[] =>
    request.metronomeEnabled ? buildClickSchedule(projectInfo, fromTick, request.endTick) : []
  let clickSeconds = planClicks(startTick)
  const liveSources = new Set<AudioScheduledSourceNode>()
  let nextIndex = 0

  const pump = (): void => {
    const horizon = context.currentTime + LOOKAHEAD_SECONDS - baseTime
    for (
      let seconds = clickSeconds[nextIndex];
      seconds !== undefined && seconds <= horizon;
      seconds = clickSeconds[nextIndex]
    ) {
      const source = playClick(context, context.destination, baseTime + seconds)
      liveSources.add(source)
      source.onended = () => liveSources.delete(source)
      nextIndex++
    }
  }
  const stopClicks = (): void => {
    for (const source of liveSources) {
      releaseQuietly(() => source.stop())
    }
    liveSources.clear()
  }
  const stopAudio = (): void => {
    if (audioSource !== null) {
      const source = audioSource
      releaseQuietly(() => source.stop())
      releaseQuietly(() => source.disconnect())
      audioSource = null
    }
  }
  const stopSounds = (): void => {
    stopAudio()
    stopClicks()
  }

  try {
    pump()
  } catch (cause) {
    stopSounds()
    throw new Error(CLICK_FAILED_MESSAGE, { cause })
  }
  const timer = window.setInterval(() => {
    try {
      pump()
    } catch (cause) {
      window.clearInterval(timer)
      request.onFailure(new Error(CLICK_STOPPED_MESSAGE, { cause }))
    }
  }, SCHEDULER_INTERVAL_MS)

  return {
    getElapsedSeconds: () => Math.max(0, context.currentTime - baseTime),
    stop: () => {
      const elapsedSeconds = Math.max(0, context.currentTime - baseTime)
      window.clearInterval(timer)
      stopSounds()
      return elapsedSeconds
    },
    seek: (seekTick) => {
      stopClicks()
      baseTime = context.currentTime + START_LEAD_SECONDS
      clickSeconds = planClicks(seekTick)
      nextIndex = 0
      try {
        if (audio !== null) {
          stopAudio()
          audioSource = playAudio(context, audio, baseTime, convertTickToAudioSeconds(projectInfo, seekTick))
        }
      } catch (cause) {
        window.clearInterval(timer)
        request.onFailure(cause instanceof Error ? cause : new Error(AUDIO_FAILED_MESSAGE, { cause }))
        return
      }
      try {
        pump()
      } catch (cause) {
        window.clearInterval(timer)
        request.onFailure(new Error(CLICK_STOPPED_MESSAGE, { cause }))
      }
    },
  }
}
