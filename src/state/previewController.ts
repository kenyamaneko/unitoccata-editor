import { getLastTick } from '../domain/notes.ts'
import { convertAudioSecondsToTick } from '../domain/projectInfo.ts'
import { useEditorStore } from './editorStore.ts'
import { getAudioContext } from '../adapter/audio/audioContext.ts'
import { startPreview, type PreviewSession } from '../adapter/audio/previewEngine.ts'
import { calculateStopTick } from '../domain/previewSchedule.ts'

interface ActivePreview {
  readonly session: PreviewSession
  /** 再生を始め直した (開始、または位置の変更の) tick。経過秒はここから数える。 */
  startTick: number
}

let active: ActivePreview | null = null
let generation = 0

/**
 * プレビューを、覚えている再生位置から始める。
 * 始めたあとに再生を続けられなくなったときは、原因を onFailure に渡す。
 */
export async function beginPreview(onFailure: (error: Error) => void): Promise<void> {
  const token = ++generation
  const state = useEditorStore.getState()
  const startTick = state.previewTick
  const lastChartTick = state.chart.notes.reduce((max, note) => Math.max(max, getLastTick(note)), 0)
  const audioEndTick =
    state.audio === null ? 0 : convertAudioSecondsToTick(state.projectInfo, state.audio.buffer.duration)
  const session = await startPreview({
    context: getAudioContext(),
    audio: state.audio === null ? null : state.audio.buffer,
    projectInfo: state.projectInfo,
    startTick,
    metronomeEnabled: state.metronomeEnabled,
    endTick: Math.max(lastChartTick, audioEndTick) + 1,
    onFailure,
  })
  if (token !== generation) {
    session.stop()
    return
  }
  active = { session, startTick }
  const { previewTick } = useEditorStore.getState()
  if (previewTick !== startTick) {
    seekPreview(previewTick)
  }
}

/** プレビューを止め、止めた位置を、覚えている再生位置にする。 */
export function endPreview(): void {
  generation++
  if (active === null) {
    return
  }
  const { session, startTick } = active
  active = null
  const elapsedSeconds = session.stop()
  const state = useEditorStore.getState()
  state.setPreviewTick(calculateStopTick(state.projectInfo, startTick, elapsedSeconds))
}

/** 再生中のプレビューを、指定の tick から再生し直す。再生中でなければ何もしない。 */
export function seekPreview(tick: number): void {
  if (active === null) {
    return
  }
  active.startTick = tick
  active.session.seek(tick)
}

/** 再生中のプレビューの現在位置 (tick) を返す。再生中でなければ null。 */
export function getPreviewTick(): number | null {
  if (active === null) {
    return null
  }
  const { projectInfo } = useEditorStore.getState()
  return calculateStopTick(projectInfo, active.startTick, active.session.getElapsedSeconds())
}
