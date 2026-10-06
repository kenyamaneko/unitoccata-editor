import { getSharedState } from './sharedState.ts'

export const VIEW_SIZE = { width: 800, height: 600 } as const

const DOWNLOADS_KEY = 'downloads'
const ANIMATION_FRAMES_KEY = 'animationFrames'

export interface DownloadedFile {
  readonly fileName: string
  text(): Promise<string>
  json(): Promise<unknown>
}

interface DownloadsState {
  readonly files: DownloadedFile[]
  readonly blobs: Map<string, Blob>
  nextBlobId: number
}

function getDownloadsState(): DownloadsState {
  return getSharedState<DownloadsState>(DOWNLOADS_KEY, () => ({ files: [], blobs: new Map(), nextBlobId: 1 }))
}

export function listDownloads(): readonly DownloadedFile[] {
  return getDownloadsState().files
}

export function clearDownloads(): void {
  const state = getDownloadsState()
  state.files.length = 0
  state.blobs.clear()
}

class FixedSizeResizeObserver implements ResizeObserver {
  readonly #callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback
  }

  observe(target: Element): void {
    const rect = new DOMRect(0, 0, VIEW_SIZE.width, VIEW_SIZE.height)
    this.#callback(
      [{ target, contentRect: rect, borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [] }],
      this,
    )
  }

  unobserve(): void {}

  disconnect(): void {}
}

const INTEGER_TEXT_PATTERN = /^\d+$/
const drawnIntegersByCanvas = new WeakMap<HTMLCanvasElement, number[]>()

function startFrameIfCleared(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number): void {
  const isFullCanvasFill = x === 0 && y === 0 && width === canvas.width && height === canvas.height
  const frameIntegers = drawnIntegersByCanvas.get(canvas) ?? []
  drawnIntegersByCanvas.set(canvas, isFullCanvasFill ? [] : frameIntegers)
}

function recordIntegerText(canvas: HTMLCanvasElement, text: string): void {
  const frameIntegers = drawnIntegersByCanvas.get(canvas) ?? []
  drawnIntegersByCanvas.set(canvas, INTEGER_TEXT_PATTERN.test(text) ? [...frameIntegers, Number(text)] : frameIntegers)
}

/** キャンバスに最後に描かれたフレーム (キャンバス全体を塗りつぶしてから後) の、整数だけの文字列を、描かれた順に返す。 */
export function readLastFrameIntegers(canvas: HTMLCanvasElement): readonly number[] {
  return drawnIntegersByCanvas.get(canvas) ?? []
}

function createCanvasContextStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const fixedValues = new Map<string | symbol, unknown>([
    ['measureText', () => ({ width: 0 })],
    [
      'fillRect',
      (x: number, y: number, width: number, height: number) => startFrameIfCleared(canvas, x, y, width, height),
    ],
    ['fillText', (text: string) => recordIntegerText(canvas, text)],
    ['canvas', undefined],
  ])
  const assignedValues = new Map<string | symbol, unknown>()
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_target, name) {
      const source = [fixedValues, assignedValues].find((values) => values.has(name))
      return source === undefined ? () => ({ addColorStop: () => undefined }) : source.get(name)
    },
    set(_target, name, value) {
      assignedValues.set(name, value)
      return true
    },
  })
}

export function installBrowserStubs(): void {
  Element.prototype.scrollIntoView = () => undefined
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
    return createCanvasContextStub(this)
  } as unknown as HTMLCanvasElement['getContext']
  globalThis.ResizeObserver = FixedSizeResizeObserver

  const state = getDownloadsState()
  URL.createObjectURL = (object) => {
    const url = `blob:test-download-${state.nextBlobId++}`
    ;[object].filter((candidate) => candidate instanceof Blob).forEach((blob) => state.blobs.set(url, blob))
    return url
  }
  URL.revokeObjectURL = () => undefined
  const clickAnchor = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function clickOrRecordDownload(this: HTMLAnchorElement) {
    const blob = state.blobs.get(this.href)
    const recordDownload = (downloadedBlob: Blob): void => {
      state.files.push({
        fileName: this.download,
        text: () => downloadedBlob.text(),
        json: async () => JSON.parse(await downloadedBlob.text()) as unknown,
      })
    }
    return this.download === '' || blob === undefined ? clickAnchor.call(this) : recordDownload(blob)
  }
}

interface AnimationFrameQueue {
  readonly callbacks: Map<number, FrameRequestCallback>
  nextId: number
}

function getAnimationFrameQueue(): AnimationFrameQueue {
  return getSharedState<AnimationFrameQueue>(ANIMATION_FRAMES_KEY, () => ({ callbacks: new Map(), nextId: 1 }))
}

export function installManualAnimationFrames(): void {
  const queue = getAnimationFrameQueue()
  window.requestAnimationFrame = (callback) => {
    const id = queue.nextId++
    queue.callbacks.set(id, callback)
    return id
  }
  window.cancelAnimationFrame = (id) => {
    queue.callbacks.delete(id)
  }
}

export function flushAnimationFrames(): void {
  const queue = getAnimationFrameQueue()
  const pending = [...queue.callbacks.entries()]
  queue.callbacks.clear()
  for (const [, callback] of pending) {
    callback(performance.now())
  }
}
