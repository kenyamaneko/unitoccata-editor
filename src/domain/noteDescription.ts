import { assertNever } from '../utils/assertNever.ts'
import { describePosition } from './positionText.ts'
import type { ProjectInfo, FlickDirection, LongEnd, Note } from './types.ts'

/** フリックの向きの呼び名。 */
export const DIRECTION_LABELS: Record<FlickDirection, string> = { up: '上', left: '左', right: '右' }

/** ロングノーツの終端の種類の呼び名 (「離す」「左フリック」など)。 */
export function describeEnd(end: LongEnd): string {
  return end.kind === 'release' ? '離す' : `${DIRECTION_LABELS[end.direction]}フリック`
}

/** ノーツの種類と位置を、Canvas の代替コンテンツに入れる文字にする。 */
export function describeNote(note: Note, projectInfo: ProjectInfo): string {
  const at = (tick: number, lane: number): string => `${describePosition(projectInfo, tick)} レーン ${lane}`
  switch (note.type) {
    case 'tap':
      return `タップノーツ ${at(note.tick, note.lane)}`
    case 'flick':
      return `${DIRECTION_LABELS[note.direction]}フリックノーツ ${at(note.tick, note.lane)}`
    case 'long': {
      const points = note.path.map((point) => at(point.tick, point.lane)).join('、')
      return `ロングノーツ 始点 ${at(note.tick, note.lane)}、続く点 ${points}、終端 ${describeEnd(note.end)}`
    }
    default:
      return assertNever(note)
  }
}
