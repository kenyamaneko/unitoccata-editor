import { expect } from 'vitest'
import { startApp, type AppDriver } from '../../test/app.tsx'
import { at } from '../../test/timeline.ts'

export type FlickDragNote = { readonly type: 'tap' } | { readonly type: 'flick'; readonly dir: 'up' | 'left' | 'right' }

const LANE_DISTANCE_TOLERANCE = 2e-9
const GRID_STEP_DISTANCE_TOLERANCE = 1e-9
const TICKS_PER_GRID_STEP = 240

export async function startAppWithNoteAt480Lane2(note: FlickDragNote): Promise<AppDriver> {
  const app = await startApp()
  await app.loadChart([{ ...note, tick: 480, lane: 2 }])
  return app
}

function widen(distance: number, tolerance: number): number {
  return Math.sign(distance) * (Math.abs(distance) + tolerance)
}

export async function dragNoteAt480Lane2(app: AppDriver, deltaLanes: number, deltaGridSteps: number): Promise<void> {
  await app.timeline.drag(
    at(480, 2),
    at(
      480 + widen(deltaGridSteps, GRID_STEP_DISTANCE_TOLERANCE) * TICKS_PER_GRID_STEP,
      2 + widen(deltaLanes, LANE_DISTANCE_TOLERANCE),
    ),
  )
}

export async function releaseNoteAt480Lane2WithoutMoving(app: AppDriver): Promise<void> {
  await app.timeline.press(at(480, 2))
  await app.timeline.release(at(480, 2))
}

export function expectGridDivisionShown(app: AppDriver, division: string): void {
  expect(app.timeline.items(), `グリッド分割が ${division}になっていません`).toContainEqual(
    expect.stringMatching(new RegExp(`^グリッド分割 ${division}`)),
  )
}
