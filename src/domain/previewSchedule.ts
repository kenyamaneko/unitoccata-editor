import { convertSecondsToTick, convertTickToSeconds, listBeats } from './projectInfo.ts'
import type { ProjectInfo } from './types.ts'

function toElapsedSeconds(projectInfo: ProjectInfo, startTick: number, tick: number): number {
  return convertTickToSeconds(projectInfo, tick) - convertTickToSeconds(projectInfo, startTick)
}

/**
 * メトロノームのクリック音を鳴らす時刻を、鳴らす順に返す。時刻は、再生を始めてからの実際の経過秒。
 * 開始位置以降の拍ごとに 1 つで、endTick より後の拍は含めない。
 */
export function buildClickSchedule(projectInfo: ProjectInfo, startTick: number, endTick: number): number[] {
  return listBeats(projectInfo, Math.max(0, startTick), endTick)
    .filter((beat) => beat.tick >= startTick)
    .map((beat) => toElapsedSeconds(projectInfo, startTick, beat.tick))
}

/** 再生を始めてからの経過秒に対応する、プレビューの停止位置の tick を返す。 */
export function calculateStopTick(projectInfo: ProjectInfo, startTick: number, elapsedSeconds: number): number {
  return convertSecondsToTick(projectInfo, convertTickToSeconds(projectInfo, startTick) + elapsedSeconds)
}
