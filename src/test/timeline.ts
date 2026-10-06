import { fireEvent } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { expect } from 'vitest'
import { readLastFrameIntegers } from './browserStubs.ts'
import { failWith } from './failures.ts'
import {
  convertLaneToCenterX,
  convertTickToY,
  getMeterColumnRange,
  getTempoColumnRange,
  type TimelineViewport,
} from '../components/timeline/timelineLayout.ts'

const TIMELINE_LABEL = 'タイムライン'
const PIXELS_OUTSIDE_TIMELINE = 40
const ENCLOSING_TICK_MARGIN = 120
const ENCLOSING_LANE_MARGIN = 0.4
const SIDE_COLUMN_CENTER_RATIO = 0.5
const WHEEL_DELTA_MODE_PIXEL = 0

export interface TimelinePosition {
  resolve(viewport: TimelineViewport): { readonly x: number; readonly y: number }
}

export interface PixelOffset {
  readonly up?: number
  readonly down?: number
  readonly left?: number
  readonly right?: number
}

export function at(tick: number, lane: number, offset: PixelOffset = {}): TimelinePosition {
  return {
    resolve: (viewport) => ({
      x: convertLaneToCenterX(viewport, lane) + (offset.right ?? 0) - (offset.left ?? 0),
      y: convertTickToY(viewport, tick) + (offset.down ?? 0) - (offset.up ?? 0),
    }),
  }
}

export function tempoColumnAt(tick: number): TimelinePosition {
  const { left, right } = getTempoColumnRange()
  return {
    resolve: (viewport) => ({
      x: left + (right - left) * SIDE_COLUMN_CENTER_RATIO,
      y: convertTickToY(viewport, tick),
    }),
  }
}

export function meterColumnAt(tick: number): TimelinePosition {
  const { left, right } = getMeterColumnRange()
  return {
    resolve: (viewport) => ({
      x: left + (right - left) * SIDE_COLUMN_CENTER_RATIO,
      y: convertTickToY(viewport, tick),
    }),
  }
}

export function belowTimelineBottom(lane: number): TimelinePosition {
  return {
    resolve: (viewport) => ({ x: convertLaneToCenterX(viewport, lane), y: viewport.height + PIXELS_OUTSIDE_TIMELINE }),
  }
}

export function aboveTimelineTop(lane: number): TimelinePosition {
  return { resolve: (viewport) => ({ x: convertLaneToCenterX(viewport, lane), y: -PIXELS_OUTSIDE_TIMELINE }) }
}

export function enclosing(points: readonly { readonly tick: number; readonly lane: number }[]): {
  readonly from: TimelinePosition
  readonly to: TimelinePosition
} {
  const ticks = points.map((point) => point.tick)
  const lanes = points.map((point) => point.lane)
  return {
    from: at(Math.min(...ticks) - ENCLOSING_TICK_MARGIN, Math.max(...lanes) + ENCLOSING_LANE_MARGIN),
    to: at(Math.max(...ticks) + ENCLOSING_TICK_MARGIN, Math.min(...lanes) - ENCLOSING_LANE_MARGIN),
  }
}

export interface WheelOptions {
  readonly pixels?: number
  readonly ctrl?: boolean
  readonly meta?: boolean
}

const DEFAULT_WHEEL_PIXELS = 100

export interface TimelineOperations {
  click(position: TimelinePosition): Promise<void>
  rightClick(position: TimelinePosition): Promise<void>
  doubleClick(position: TimelinePosition): Promise<void>
  hover(position: TimelinePosition): Promise<void>
  drag(from: TimelinePosition, to: TimelinePosition): Promise<void>
  dragWithShift(from: TimelinePosition, to: TimelinePosition): Promise<void>
  press(position: TimelinePosition): Promise<void>
  pressWithShift(position: TimelinePosition): Promise<void>
  moveTo(position: TimelinePosition): Promise<void>
  release(position: TimelinePosition): Promise<void>
  releaseWithShift(position: TimelinePosition): Promise<void>
  wheel(direction: 'up' | 'down', options?: WheelOptions): Promise<void>
}

export interface TimelineDriver extends TimelineOperations {
  canvas(): HTMLCanvasElement
  readonly inBackground: TimelineOperations
  selectEnclosing(points: readonly { readonly tick: number; readonly lane: number }[]): Promise<void>
  selectRange(from: TimelinePosition, to: TimelinePosition): Promise<void>
  notes(): string[]
  tempos(): string[]
  meters(): string[]
  items(): string[]
  scrollPosition(): string
  gridStepHeight(): number
  /** タイムラインの最後に描かれたフレームに、小節番号として描かれた整数を、描かれた順に返す。 */
  drawnBarNumbers(): number[]
  /** タイムラインに描かれた小節番号の最大。何も描かれていないときは、例外になる。 */
  maxDrawnBarNumber(): number
}

export interface TimelineContext {
  readonly user: UserEvent
  readonly settle: () => Promise<void>
  readonly readViewport: () => TimelineViewport
  readonly findByLabel: (label: string) => HTMLElement
}

function isInert(element: Element): boolean {
  return element.closest('[inert]') !== null
}

const DELIVERED_EVENT_TYPES = ['pointerdown', 'pointermove', 'pointerup', 'wheel'] as const

async function expectDelivered(target: HTMLElement, action: () => Promise<void>): Promise<void> {
  let deliveredCount = 0
  const count = (): void => {
    deliveredCount += 1
  }
  for (const type of DELIVERED_EVENT_TYPES) {
    target.addEventListener(type, count, true)
  }
  await action()
  for (const type of DELIVERED_EVENT_TYPES) {
    target.removeEventListener(type, count, true)
  }
  expect(deliveredCount, 'タイムラインの Canvas に、操作が届いていません (操作が空振りしています)').toBeGreaterThan(0)
}

function readListItems(canvas: HTMLElement, label: string): string[] {
  const list = canvas.querySelector(`ul[aria-label="${label}"]`)
  return [...(list?.querySelectorAll('li') ?? [])].map((item) => item.textContent)
}

type Gate = (action: () => Promise<void>) => Promise<void>

export function createTimelineDriver(context: TimelineContext): TimelineDriver {
  const { user, settle, readViewport, findByLabel } = context
  const canvas = (): HTMLCanvasElement => findByLabel(TIMELINE_LABEL) as HTMLCanvasElement
  const coordsOf = (position: TimelinePosition): { clientX: number; clientY: number } => {
    const { x, y } = position.resolve(readViewport())
    return { clientX: x, clientY: y }
  }
  const reachable: Gate = async (action) => {
    const target = isInert(canvas())
      ? failWith(
          new Error(
            'タイムラインがダイアログの背後にあり、操作が届きません。効かないことを確かめるときは inBackground を使います',
          ),
        )
      : canvas()
    await expectDelivered(target, action)
    await settle()
  }
  const unreachable: Gate = async () => {
    await (isInert(canvas())
      ? settle()
      : failWith(new Error('タイムラインがダイアログの背後にありません。inBackground は、背後にあるときだけ使えます')))
  }
  const withShift = async (action: () => Promise<void>): Promise<void> => {
    await user.keyboard('{Shift>}')
    await action()
    await user.keyboard('{/Shift}')
  }
  const press = (position: TimelinePosition): Promise<void> =>
    user.pointer({ keys: '[MouseLeft>]', target: canvas(), coords: coordsOf(position) })
  const moveTo = (position: TimelinePosition): Promise<void> =>
    user.pointer({ target: canvas(), coords: coordsOf(position) })
  const release = (position: TimelinePosition): Promise<void> =>
    user.pointer({ keys: '[/MouseLeft]', target: canvas(), coords: coordsOf(position) })
  const dragSteps = async (from: TimelinePosition, to: TimelinePosition): Promise<void> => {
    await press(from)
    await moveTo(to)
    await release(to)
  }
  const findAlternativeText = (prefix: string): string => {
    const found =
      [...canvas().querySelectorAll('p')].find((paragraph) => paragraph.textContent.startsWith(prefix)) ??
      failWith(new Error(`タイムラインの代替コンテンツに「${prefix}」で始まる項目がありません`))
    return found.textContent
  }
  const drawnBarNumbers = (): number[] => [...readLastFrameIntegers(canvas())]
  const createOperations = (gate: Gate): TimelineOperations => ({
    click: (position) =>
      gate(() => user.pointer({ keys: '[MouseLeft]', target: canvas(), coords: coordsOf(position) })),
    rightClick: (position) =>
      gate(() => user.pointer({ keys: '[MouseRight]', target: canvas(), coords: coordsOf(position) })),
    doubleClick: (position) =>
      gate(() => user.pointer({ keys: '[MouseLeft][MouseLeft]', target: canvas(), coords: coordsOf(position) })),
    hover: (position) => gate(() => moveTo(position)),
    drag: (from, to) => gate(() => dragSteps(from, to)),
    dragWithShift: (from, to) => gate(() => withShift(() => dragSteps(from, to))),
    press: (position) => gate(() => press(position)),
    pressWithShift: (position) => gate(() => withShift(() => press(position))),
    moveTo: (position) => gate(() => moveTo(position)),
    release: (position) => gate(() => release(position)),
    releaseWithShift: (position) => gate(() => withShift(() => release(position))),
    wheel: (direction, options = {}) =>
      gate(async () => {
        fireEvent.wheel(canvas(), {
          deltaY: (direction === 'up' ? -1 : 1) * (options.pixels ?? DEFAULT_WHEEL_PIXELS),
          deltaMode: WHEEL_DELTA_MODE_PIXEL,
          ctrlKey: options.ctrl === true,
          metaKey: options.meta === true,
        })
      }),
  })
  const operations = createOperations(reachable)

  return {
    ...operations,
    canvas,
    inBackground: createOperations(unreachable),
    selectEnclosing: (points) => {
      const { from, to } = enclosing(points)
      return operations.dragWithShift(from, to)
    },
    selectRange: (from, to) => operations.dragWithShift(from, to),
    notes: () => readListItems(canvas(), '譜面のノーツ'),
    tempos: () => readListItems(canvas(), 'テンポ'),
    meters: () => readListItems(canvas(), '拍子'),
    items: () => [...canvas().querySelectorAll(':scope > p')].map((paragraph) => paragraph.textContent),
    scrollPosition: () => findAlternativeText('スクロール位置').replace(/^スクロール位置 /, ''),
    gridStepHeight: () => Number(/1 マスの高さ ([\d.]+) px$/.exec(findAlternativeText('グリッド分割'))?.[1]),
    drawnBarNumbers,
    maxDrawnBarNumber: () =>
      drawnBarNumbers().toSorted((a, b) => b - a)[0] ??
      failWith(new Error('タイムラインに、小節番号が描かれていません')),
  }
}
