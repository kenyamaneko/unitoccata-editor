import { useRef } from 'react'
import { getAudioContext } from '../../adapter/audio/audioContext.ts'
import { loadAudioFile } from '../../adapter/audio/audioFile.ts'
import { AUDIO_FILE_ACCEPT } from '../../adapter/audio/audioFileName.ts'
import { isCloudConfigured } from '../../adapter/cloud/firebaseClient.ts'
import { findChartNameMessage, findSongNameMessage } from '../../domain/nameProblems.ts'
import type { MidiSong } from '../../domain/midiImport.ts'
import { readChartFile } from '../../adapter/format/chartFile.ts'
import { serializeChart } from '../../adapter/format/chartFormat.ts'
import { createChartFileName, JSON_FILE_ACCEPT } from '../../adapter/format/fileNames.ts'
import { parseMidiFile } from '../../adapter/midi/midiFile.ts'
import { MIDI_FILE_ACCEPT } from '../../adapter/midi/midiFileName.ts'
import { createNoteId, useEditorStore } from '../../state/editorStore.ts'
import { describeFailure } from '../../utils/describeFailure.ts'
import { downloadJson } from '../../utils/downloadJson.ts'
import { logFailure } from '../../utils/logFailure.ts'
import { readFileBytes } from '../../utils/readFile.ts'
import { FileMenu, type FileMenuGroup } from './FileMenu.tsx'

const LOAD_AUDIO_LABEL = '音源を読み込む'
const LOAD_CHART_LABEL = '譜面を読み込む'
const IMPORT_MIDI_LABEL = 'MIDI を取り込む'

function HiddenFileInput({
  inputRef,
  label,
  accept,
  onFile,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  label: string
  accept: string
  onFile: (file: File) => void
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      aria-label={label}
      accept={accept}
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file !== undefined) {
          onFile(file)
        }
        event.target.value = ''
      }}
    />
  )
}

/** 音源・譜面・MIDI の読み込みと、譜面の書き出し、クラウドの保存と読み込みを選ぶファイルのメニュー。 */
export function FileControls({
  onSelectMidiSong,
  onOpenCloudDialog,
}: {
  onSelectMidiSong: (song: MidiSong) => void
  onOpenCloudDialog: (kind: 'save' | 'open') => void
}) {
  const audioInput = useRef<HTMLInputElement>(null)
  const chartInput = useRef<HTMLInputElement>(null)
  const midiInput = useRef<HTMLInputElement>(null)
  const store = useEditorStore()

  const loadAudio = async (file: File): Promise<void> => {
    store.setLoadingAudio(true)
    try {
      store.setAudio(await loadAudioFile(file, getAudioContext()))
    } catch (error) {
      logFailure('toolbar.loadAudioFailed', error, { fileName: file.name })
      store.showNotice(`音源を読み込めませんでした: ${describeFailure(error)}`)
    } finally {
      store.setLoadingAudio(false)
    }
  }

  const loadJson = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action()
    } catch (error) {
      logFailure('toolbar.loadJsonFailed', error)
      store.showNotice(describeFailure(error))
    }
  }

  const loadMidi = async (file: File): Promise<void> => {
    try {
      onSelectMidiSong(parseMidiFile(new Uint8Array(await readFileBytes(file))))
    } catch (error) {
      logFailure('toolbar.loadMidiFailed', error, { fileName: file.name })
      store.showNotice(`${file.name} を取り込めませんでした: ${describeFailure(error)}`)
    }
  }

  const exportChart = (): void => {
    const problem = findSongNameMessage(store.songName) ?? findChartNameMessage(store.chartName)
    if (problem !== null) {
      store.showNotice(`${problem}。「プロジェクト情報」と「譜面設定」で入力してください`)
      return
    }
    downloadJson(
      createChartFileName(store.chartName, store.songName),
      serializeChart(store.chart, store.laneCount, store.barCount, store.projectInfo),
    )
  }

  const isCloudDisabled = !isCloudConfigured()
  const fileMenuGroups: FileMenuGroup[] = [
    {
      heading: 'インポート',
      items: [
        { label: '音源', onSelect: () => audioInput.current?.click() },
        { label: 'MIDI', onSelect: () => midiInput.current?.click() },
        { label: '譜面', onSelect: () => chartInput.current?.click() },
      ],
    },
    {
      items: [
        { label: '譜面書き出し', onSelect: exportChart },
        { label: 'クラウドに保存', disabled: isCloudDisabled, onSelect: () => onOpenCloudDialog('save') },
        { label: 'クラウドから開く', disabled: isCloudDisabled, onSelect: () => onOpenCloudDialog('open') },
      ],
    },
  ]

  return (
    <div>
      <HiddenFileInput
        inputRef={audioInput}
        label={LOAD_AUDIO_LABEL}
        accept={AUDIO_FILE_ACCEPT}
        onFile={(file) => void loadAudio(file)}
      />
      <HiddenFileInput
        inputRef={chartInput}
        label={LOAD_CHART_LABEL}
        accept={JSON_FILE_ACCEPT}
        onFile={(file) =>
          void loadJson(async () => {
            const { chart, laneCount, barCount, projectInfo } = await readChartFile(file, createNoteId)
            store.loadChart(chart, laneCount, barCount, projectInfo)
          })
        }
      />
      <HiddenFileInput
        inputRef={midiInput}
        label={IMPORT_MIDI_LABEL}
        accept={MIDI_FILE_ACCEPT}
        onFile={(file) => void loadMidi(file)}
      />
      <FileMenu groups={fileMenuGroups} />
    </div>
  )
}
