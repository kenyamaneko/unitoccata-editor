declare module 'signalsmith-stretch' {
  /** 時間を伸縮するオーディオノード。 */
  export interface StretchNode extends AudioNode {
    addBuffers(buffers: Float32Array[]): Promise<number>
    schedule(change: { output?: number; input?: number; rate?: number; active?: boolean; semitones?: number }): void
    stop(when?: number): void
  }

  /** 時間伸縮ノードを作る。 */
  export default function SignalsmithStretch(context: BaseAudioContext): Promise<StretchNode>
}
