import { BYTES_PER_MEGABYTE, MAX_AUDIO_FILE_BYTES } from '../../domain/constants.ts'
import type { LoadedAudio } from '../../state/editorStore.ts'
import { readFileBytes } from '../../utils/readFile.ts'
import { AUDIO_EXTENSIONS_TEXT, isAudioFileName } from './audioFileName.ts'
import { computePeaks, PEAK_SECONDS } from './waveform.ts'

const SIZE_DECIMALS = 1

async function decodeAudio(bytes: ArrayBuffer, context: AudioContext): Promise<AudioBuffer> {
  try {
    return await context.decodeAudioData(bytes)
  } catch (cause) {
    throw new Error(
      `音源として読めません。ファイルが壊れていないか確認するか、${AUDIO_EXTENSIONS_TEXT} のいずれかの別のファイルを選んでください`,
      { cause },
    )
  }
}

/**
 * 音源ファイルを読み込み、デコードして波形を求める。
 * 対応していない拡張子の場合、上限を超える大きさの場合、読み出せない場合、デコードできない場合は、利用者に見せる文言を付けた例外にする。
 */
export async function loadAudioFile(file: File, context: AudioContext): Promise<LoadedAudio> {
  if (!isAudioFileName(file.name)) {
    throw new Error(
      `「${file.name}」は対応していない音源の形式です。${AUDIO_EXTENSIONS_TEXT} のいずれかのファイルを選んでください`,
    )
  }
  if (file.size > MAX_AUDIO_FILE_BYTES) {
    const sizeMegabytes = (file.size / BYTES_PER_MEGABYTE).toFixed(SIZE_DECIMALS)
    const limitMegabytes = MAX_AUDIO_FILE_BYTES / BYTES_PER_MEGABYTE
    throw new Error(
      `音源の大きさは ${limitMegabytes} MB までです (選んだファイルは ${sizeMegabytes} MB)。${limitMegabytes} MB 以下のファイルを選んでください`,
    )
  }
  const buffer = await decodeAudio(await readFileBytes(file), context)
  return { name: file.name, file, buffer, peaks: computePeaks(buffer), peakSeconds: PEAK_SECONDS }
}
