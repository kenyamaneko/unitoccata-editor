import { locateBeatPosition } from './projectInfo.ts'
import type { ProjectInfo } from './types.ts'

function findGreatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : findGreatestCommonDivisor(b, a % b)
}

/** tick の位置を、「2 小節目 2 拍目」「2 小節目 2 拍目の 1/4 拍後」のように、小節と拍で書き表す。 */
export function describePosition(projectInfo: ProjectInfo, tick: number): string {
  const { barNumber, beatNumber, offsetTicks, beatTicks } = locateBeatPosition(projectInfo, tick)
  const bar = `${barNumber} 小節目 ${beatNumber} 拍目`
  if (offsetTicks === 0) {
    return bar
  }
  const divisor = findGreatestCommonDivisor(offsetTicks, beatTicks)
  return `${bar}の ${offsetTicks / divisor}/${beatTicks / divisor} 拍後`
}
