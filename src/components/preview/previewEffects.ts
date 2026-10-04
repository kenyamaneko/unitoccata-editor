import { FLICK_COLORS, THEME } from '../../constants/theme.ts'
import type { HeldLong } from './heldNotes.ts'
import type { VanishedKind } from './vanishedNotes.ts'

const PARTICLE_COUNT = 8
const PARTICLE_DISTANCE_MIN_PX = 28
const PARTICLE_DISTANCE_RANGE_PX = 28
const PARTICLE_SIZE_PX = 6
const POP_DURATION_MS = 120
const PARTICLE_DURATION_MS = 420
const MAX_EFFECT_ELEMENTS = 400

const BIG_POP_DURATION_MS = 170
const BIG_RING_DURATION_MS = 320
const BIG_RING_SIZE_RATIO = 1.1
const BIG_DOT_COUNT = 14
const BIG_DOT_DISTANCE_MIN_PX = 40
const BIG_DOT_DISTANCE_RANGE_PX = 70
const BIG_DOT_SIZE_MIN_PX = 4
const BIG_DOT_SIZE_RANGE_PX = 5
const BIG_DOT_DURATION_MIN_MS = 380
const BIG_DOT_DURATION_RANGE_MS = 220
const BIG_STREAK_COUNT = 8
const BIG_STREAK_DISTANCE_MIN_PX = 50
const BIG_STREAK_DISTANCE_RANGE_PX = 70
const FLICK_STREAK_COUNT = 6
const FLICK_STREAK_FAN_DEGREES = 40
const FLICK_STREAK_DISTANCE_MIN_PX = 80
const FLICK_STREAK_DISTANCE_RANGE_PX = 80
const FLICK_DIRECTION_DEGREES = { up: -90, left: 180, right: 0 } as const
const STREAK_LENGTH_PX = 18
const STREAK_THICKNESS_PX = 3
const STREAK_DURATION_MIN_MS = 300
const STREAK_DURATION_RANGE_MS = 220

function pickColor(kind: VanishedKind): string {
  switch (kind.kind) {
    case 'flick':
      return FLICK_COLORS[kind.direction]
    case 'long':
    case 'long-end':
      return THEME.longPoint
    case 'tap':
      return THEME.tap
  }
}

function addEffectElement(container: HTMLElement, className: string, style: Partial<CSSStyleDeclaration>): HTMLElement {
  const element = document.createElement('div')
  element.className = className
  Object.assign(element.style, style)
  element.addEventListener('animationend', () => element.remove(), { once: true })
  container.append(element)
  return element
}

type JudgePoint = { readonly x: number; readonly y: number; readonly noteWidth: number; readonly noteHeight: number }

function addStreak(
  container: HTMLElement,
  point: JudgePoint,
  angleDegrees: number,
  distance: number,
  color: string,
): void {
  const streak = addEffectElement(container, 'preview-spark', {
    left: `${point.x}px`,
    top: `${point.y}px`,
    width: `${STREAK_LENGTH_PX}px`,
    height: `${STREAK_THICKNESS_PX}px`,
    backgroundColor: THEME.longEdge,
    boxShadow: `0 0 10px 2px ${color}`,
    animationDuration: `${STREAK_DURATION_MIN_MS + Math.random() * STREAK_DURATION_RANGE_MS}ms`,
  })
  streak.style.setProperty('--angle', `${angleDegrees}deg`)
  streak.style.setProperty('--distance', `${distance}px`)
}

/** タップとフリックが消える、派手な演出。拡大して消える四角、広がる輪、四方に散る粒、四方に飛ぶ火花を置く。フリックには、向きへ飛ぶ火花を足す。 */
function spawnBigVanishEffect(container: HTMLElement, point: JudgePoint, kind: VanishedKind, color: string): void {
  addEffectElement(container, 'preview-pop preview-pop-big', {
    left: `${point.x}px`,
    top: `${point.y}px`,
    width: `${point.noteWidth}px`,
    height: `${point.noteHeight}px`,
    backgroundColor: color,
    boxShadow: `0 0 16px 4px ${color}`,
    animationDuration: `${BIG_POP_DURATION_MS}ms`,
  })
  const ringSize = point.noteWidth * BIG_RING_SIZE_RATIO
  addEffectElement(container, 'preview-ring', {
    left: `${point.x}px`,
    top: `${point.y}px`,
    width: `${ringSize}px`,
    height: `${ringSize}px`,
    borderColor: color,
    animationDuration: `${BIG_RING_DURATION_MS}ms`,
  })
  for (let i = 0; i < BIG_DOT_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const distance = BIG_DOT_DISTANCE_MIN_PX + Math.random() * BIG_DOT_DISTANCE_RANGE_PX
    const size = BIG_DOT_SIZE_MIN_PX + Math.random() * BIG_DOT_SIZE_RANGE_PX
    const dot = addEffectElement(container, 'preview-particle', {
      left: `${point.x}px`,
      top: `${point.y}px`,
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: color,
      animationDuration: `${BIG_DOT_DURATION_MIN_MS + Math.random() * BIG_DOT_DURATION_RANGE_MS}ms`,
    })
    dot.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
    dot.style.setProperty('--dy', `${Math.sin(angle) * distance}px`)
  }
  for (let i = 0; i < BIG_STREAK_COUNT; i++) {
    addStreak(
      container,
      point,
      (360 * i) / BIG_STREAK_COUNT + (Math.random() - 0.5) * 30,
      BIG_STREAK_DISTANCE_MIN_PX + Math.random() * BIG_STREAK_DISTANCE_RANGE_PX,
      color,
    )
  }
  if (kind.kind === 'flick') {
    for (let i = 0; i < FLICK_STREAK_COUNT; i++) {
      addStreak(
        container,
        point,
        FLICK_DIRECTION_DEGREES[kind.direction] + (Math.random() - 0.5) * FLICK_STREAK_FAN_DEGREES,
        FLICK_STREAK_DISTANCE_MIN_PX + Math.random() * FLICK_STREAK_DISTANCE_RANGE_PX,
        color,
      )
    }
  }
}

/**
 * ノーツが判定ラインで消える位置に、消える演出を置く。ノーツと同じ色と大きさの四角が、ごく短い時間で少し大きくなりながら消え、
 * 小さな粒が周りに散る。タップとフリックは、輪と火花も加わった派手な演出になる。演出は CSS のアニメーションで、終わると取り除かれる。
 * 一度に置く演出の数には上限がある。
 */
export function spawnVanishEffect(container: HTMLElement, point: JudgePoint, kind: VanishedKind): void {
  const color = pickColor(kind)
  if (kind.kind !== 'long') {
    if (
      container.childElementCount + BIG_DOT_COUNT + BIG_STREAK_COUNT + FLICK_STREAK_COUNT + 2 <=
      MAX_EFFECT_ELEMENTS
    ) {
      spawnBigVanishEffect(container, point, kind, color)
    }
    return
  }
  if (container.childElementCount + PARTICLE_COUNT + 1 > MAX_EFFECT_ELEMENTS) {
    return
  }
  addEffectElement(container, 'preview-pop', {
    left: `${point.x}px`,
    top: `${point.y}px`,
    width: `${point.noteWidth}px`,
    height: `${point.noteHeight}px`,
    backgroundColor: color,
    animationDuration: `${POP_DURATION_MS}ms`,
  })
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.4
    const distance = PARTICLE_DISTANCE_MIN_PX + Math.random() * PARTICLE_DISTANCE_RANGE_PX
    const element = addEffectElement(container, 'preview-particle', {
      left: `${point.x}px`,
      top: `${point.y}px`,
      width: `${PARTICLE_SIZE_PX}px`,
      height: `${PARTICLE_SIZE_PX}px`,
      backgroundColor: color,
      animationDuration: `${PARTICLE_DURATION_MS}ms`,
    })
    element.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
    element.style.setProperty('--dy', `${Math.sin(angle) * distance}px`)
  }
}

const SPARK_INTERVAL_MS = 70
const SPARKS_PER_INTERVAL = 4
const SPARK_LENGTH_PX = 20
const SPARK_THICKNESS_PX = 3
const SPARK_DISTANCE_MIN_PX = 30
const SPARK_DISTANCE_RANGE_PX = 50
const SPARK_DURATION_MIN_MS = 320
const SPARK_DURATION_RANGE_MS = 240
const SPARK_UPWARD_ANGLE_DEGREES = -90
const SPARK_FAN_DEGREES = 150
const GLOW_SIZE_RATIO = 0.9

/** 判定ラインに当たっているロングノーツの演出の状態。ロングノーツごとの光る円と、最後に火花を出した時刻を持つ。 */
export interface HoldEffectState {
  readonly glows: Map<string, HTMLElement>
  lastSparkAt: number
}

/** 判定ラインに当たっているロングノーツの演出の状態を作る。 */
export function createHoldEffectState(): HoldEffectState {
  return { glows: new Map(), lastSparkAt: Number.NEGATIVE_INFINITY }
}

/**
 * 判定ラインに当たっているロングノーツの演出を更新する。当たっている間、ロングノーツの横位置に、脈打つように光る円を置き、
 * 一定の間隔で、小さな火花を上へ飛ばす。当たらなくなったロングノーツの円は取り除く。
 */
export function updateHoldEffects(
  container: HTMLElement,
  state: HoldEffectState,
  heldLongs: readonly HeldLong[],
  toPoint: (lane: number) => { readonly x: number; readonly y: number; readonly noteWidth: number },
  now: number,
): void {
  const heldIds = new Set(heldLongs.map((held) => held.id))
  for (const [id, glow] of state.glows) {
    if (!heldIds.has(id)) {
      glow.remove()
      state.glows.delete(id)
    }
  }
  const isSparkTime = now - state.lastSparkAt >= SPARK_INTERVAL_MS
  if (isSparkTime) {
    state.lastSparkAt = now
  }
  for (const held of heldLongs) {
    const point = toPoint(held.lane)
    const size = point.noteWidth * GLOW_SIZE_RATIO
    const glow =
      state.glows.get(held.id) ?? addEffectElement(container, 'preview-hold', { backgroundColor: THEME.longPoint })
    state.glows.set(held.id, glow)
    Object.assign(glow.style, {
      left: `${point.x}px`,
      top: `${point.y}px`,
      width: `${size}px`,
      height: `${size}px`,
    })
    if (isSparkTime && container.childElementCount + SPARKS_PER_INTERVAL <= MAX_EFFECT_ELEMENTS) {
      for (let i = 0; i < SPARKS_PER_INTERVAL; i++) {
        const spark = addEffectElement(container, 'preview-spark', {
          left: `${point.x + (Math.random() - 0.5) * point.noteWidth * 0.8}px`,
          top: `${point.y}px`,
          width: `${SPARK_LENGTH_PX}px`,
          height: `${SPARK_THICKNESS_PX}px`,
          backgroundColor: THEME.longEdge,
          boxShadow: `0 0 10px 2px ${THEME.longPoint}`,
          animationDuration: `${SPARK_DURATION_MIN_MS + Math.random() * SPARK_DURATION_RANGE_MS}ms`,
        })
        spark.style.setProperty(
          '--angle',
          `${SPARK_UPWARD_ANGLE_DEGREES + (Math.random() - 0.5) * SPARK_FAN_DEGREES}deg`,
        )
        spark.style.setProperty('--distance', `${SPARK_DISTANCE_MIN_PX + Math.random() * SPARK_DISTANCE_RANGE_PX}px`)
      }
    }
  }
}
