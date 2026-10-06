import { failWith } from './failures.ts'
import { discardSharedState, getSharedState } from './sharedState.ts'

const AUDIO_KEY = 'audio'
const FILE_MARKER = 'FAKE-AUDIO:'
const HEADER_END = '\n'
const SAMPLE_RATE = 8000
const DEFAULT_DURATION_SECONDS = 10
const DECODE_ERROR_NAME = 'EncodingError'
const RESUME_FAILURE_MESSAGE = '音声の再生の再開に失敗しました (テストが起こした故障)'

export interface PendingResume {
  succeed(): void
  fail(): void
}

export interface PendingDecode {
  finish(): void
}

export interface AudioControls {
  failContextCreation(): void
  failResume(): void
  deferResume(): void
  allowResume(): void
  resumeRequests(): readonly PendingResume[]
  deferDecoding(): void
  decodeRequests(): readonly PendingDecode[]
  failAudioPlayback(): void
  failClickSound(options?: { readonly times?: number; readonly afterPlays?: number }): void
  clickSoundTimes(): readonly number[]
}

interface AudioWorld {
  contextCreationFails: boolean
  resumeMode: 'succeed' | 'fail' | 'defer'
  decodeIsDeferred: boolean
  audioPlaybackFails: boolean
  clickFailuresRemaining: number
  clickPlaysBeforeFailure: number
  readonly resumeRequests: PendingResume[]
  readonly decodeRequests: PendingDecode[]
  readonly clickSoundTimes: number[]
}

function createAudioWorld(): AudioWorld {
  return {
    contextCreationFails: false,
    resumeMode: 'succeed',
    decodeIsDeferred: false,
    audioPlaybackFails: false,
    clickFailuresRemaining: 0,
    clickPlaysBeforeFailure: 0,
    resumeRequests: [],
    decodeRequests: [],
    clickSoundTimes: [],
  }
}

function getAudioWorld(): AudioWorld {
  return getSharedState(AUDIO_KEY, createAudioWorld)
}

export function resetAudioWorld(): void {
  discardSharedState(AUDIO_KEY)
}

export function getAudioControls(): AudioControls {
  const world = getAudioWorld()
  return {
    failContextCreation: () => {
      world.contextCreationFails = true
    },
    failResume: () => {
      world.resumeMode = 'fail'
    },
    deferResume: () => {
      world.resumeMode = 'defer'
    },
    allowResume: () => {
      world.resumeMode = 'succeed'
    },
    resumeRequests: () => world.resumeRequests,
    deferDecoding: () => {
      world.decodeIsDeferred = true
    },
    decodeRequests: () => world.decodeRequests,
    failAudioPlayback: () => {
      world.audioPlaybackFails = true
    },
    failClickSound: (options = {}) => {
      world.clickFailuresRemaining = options.times ?? Infinity
      world.clickPlaysBeforeFailure = options.afterPlays ?? 0
    },
    clickSoundTimes: () => world.clickSoundTimes,
  }
}

function createFakeAudioBuffer(durationSeconds: number): AudioBuffer {
  const length = Math.round(durationSeconds * SAMPLE_RATE)
  const samples = Float32Array.from({ length }, (_, index) => Math.sin(index / 10))
  return {
    duration: durationSeconds,
    sampleRate: SAMPLE_RATE,
    length,
    numberOfChannels: 1,
    getChannelData: () => samples,
  } as unknown as AudioBuffer
}

function readFakeAudioDuration(bytes: ArrayBuffer): number | null {
  const head = new TextDecoder().decode(bytes.slice(0, 256))
  const parseHeader = (): { durationSeconds: number } =>
    JSON.parse(head.slice(FILE_MARKER.length, head.indexOf(HEADER_END))) as { durationSeconds: number }
  return head.startsWith(FILE_MARKER) ? parseHeader().durationSeconds : null
}

function createFakeNode(): AudioNode {
  return { connect: <T>(node: T): T => node, disconnect: () => undefined } as unknown as AudioNode
}

function createFakeOscillator(world: AudioWorld): OscillatorNode {
  const playClick = (when: number): void => {
    world.clickSoundTimes.push(when)
  }
  const failClick = (): never => {
    world.clickFailuresRemaining--
    return failWith(new Error('クリック音の発音に失敗しました (テストが起こした故障)'))
  }
  const playOrFail = (when: number): void => {
    if (world.clickPlaysBeforeFailure > 0) {
      world.clickPlaysBeforeFailure--
      playClick(when)
    } else if (world.clickFailuresRemaining > 0) {
      failClick()
    } else {
      playClick(when)
    }
  }
  return {
    ...createFakeNode(),
    frequency: { value: 0 },
    start: playOrFail,
    stop: () => undefined,
    onended: null,
  } as unknown as OscillatorNode
}

function createFakeBufferSource(world: AudioWorld): AudioBufferSourceNode {
  return {
    ...createFakeNode(),
    buffer: null,
    start: () =>
      world.audioPlaybackFails ? failWith(new Error('音源の再生を始められません (テストが起こした故障)')) : undefined,
    stop: () => undefined,
    onended: null,
  } as unknown as AudioBufferSourceNode
}

function createFakeGain(): GainNode {
  return {
    ...createFakeNode(),
    gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
  } as unknown as GainNode
}

export class FakeAudioContext {
  readonly sampleRate = SAMPLE_RATE
  readonly destination = createFakeNode()
  state: AudioContextState = 'suspended'
  readonly #world = getAudioWorld()
  readonly #createdAt = this.#world.contextCreationFails
    ? failWith(new Error('AudioContext の作成に失敗しました (テストが起こした故障)'))
    : performance.now()

  get currentTime(): number {
    return (performance.now() - this.#createdAt) / 1000
  }

  resume(): Promise<void> {
    const world = this.#world
    const behaviors: Record<AudioWorld['resumeMode'], () => Promise<void>> = {
      fail: () => Promise.reject(new Error(RESUME_FAILURE_MESSAGE)),
      succeed: () => {
        this.state = 'running'
        return Promise.resolve()
      },
      defer: () =>
        new Promise<void>((resolve, reject) => {
          world.resumeRequests.push({
            succeed: () => {
              this.state = 'running'
              resolve()
            },
            fail: () => reject(new Error(RESUME_FAILURE_MESSAGE)),
          })
        }),
    }
    return behaviors[world.resumeMode]()
  }

  createOscillator(): OscillatorNode {
    return createFakeOscillator(this.#world)
  }

  createBufferSource(): AudioBufferSourceNode {
    return createFakeBufferSource(this.#world)
  }

  createGain(): GainNode {
    return createFakeGain()
  }

  decodeAudioData(bytes: ArrayBuffer): Promise<AudioBuffer> {
    const decode = (): Promise<AudioBuffer> => {
      const duration = readFakeAudioDuration(bytes)
      return duration === null
        ? Promise.reject(new DOMException('音源をデコードできません', DECODE_ERROR_NAME))
        : Promise.resolve(createFakeAudioBuffer(duration))
    }
    const world = this.#world
    return world.decodeIsDeferred
      ? new Promise<AudioBuffer>((resolve, reject) => {
          world.decodeRequests.push({ finish: () => decode().then(resolve, reject) })
        })
      : decode()
  }
}

export function createAudioBytes(
  options: { readonly durationSeconds?: number; readonly sizeBytes?: number } = {},
): Uint8Array {
  const { durationSeconds = DEFAULT_DURATION_SECONDS, sizeBytes } = options
  const header = new Uint8Array(
    new TextEncoder().encode(`${FILE_MARKER}${JSON.stringify({ durationSeconds })}${HEADER_END}`),
  )
  const padToSize = (size: number): Uint8Array => {
    const bytes = new Uint8Array(
      size < header.length
        ? failWith(new RangeError(`音源の大きさは ${header.length} バイト以上にしてください: ${size}`))
        : size,
    )
    bytes.set(header)
    return bytes
  }
  return sizeBytes === undefined ? header : padToSize(sizeBytes)
}

export function createAudioFile(
  fileName: string,
  options: { readonly durationSeconds?: number; readonly sizeBytes?: number } = {},
): File {
  return new File([createAudioBytes(options) as BlobPart], fileName)
}

export function createUndecodableAudioFile(fileName: string): File {
  return new File([new Uint8Array([1, 2, 3])], fileName)
}
