import { useState } from 'react'
import { assertNever } from '../../utils/assertNever.ts'
import {
  createDefaultVelocityRanges,
  importMidi,
  type ImportedNoteKind,
  type MidiImportResult,
  type MidiSong,
  type VelocityRange,
} from '../../domain/midiImport.ts'
import { formatPitchName, parsePitchName } from '../../domain/pitch.ts'
import { describePosition } from '../../domain/positionText.ts'
import { DIRECTION_LABELS, describeEnd } from '../../domain/noteDescription.ts'
import { describeFailure } from '../../utils/describeFailure.ts'
import { logFailure } from '../../utils/logFailure.ts'
import { createNoteId, useEditorStore } from '../../state/editorStore.ts'
import { Dialog } from '../common/Dialog.tsx'
import { Button, Field } from '../common/ui.tsx'

const DEFAULT_LOWEST_PITCH = 60
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none focus:border-sky-400'

function describeNoteKind(note: ImportedNoteKind): string {
  switch (note.kind) {
    case 'tap':
      return 'タップノーツ'
    case 'flick':
      return `${DIRECTION_LABELS[note.direction]}フリックノーツ`
    case 'long':
      return `ロングノーツ (終端が${describeEnd(note.end)})`
    default:
      return assertNever(note)
  }
}

const WARNING_LABELS: Record<MidiImportResult['warnings'][number]['reason'], string> = {
  'velocity-out-of-range': 'ベロシティが範囲外',
  'zero-length-long': '長さが 0 のロングノーツ',
  'duplicate-position': '位置の重複',
}

interface VelocityRow {
  readonly note: ImportedNoteKind
  readonly min: string
  readonly max: string
}

const VELOCITY_EDGE_LABELS = { min: '最小', max: '最大' } as const

function parseVelocityText(text: string): number | null {
  const velocity = Number(text)
  return text.trim() === '' || !Number.isFinite(velocity) ? null : velocity
}

/** MIDI の音程とレーンの対応、ベロシティの範囲を指定して、譜面に取り込むダイアログ。 */
export function MidiImportDialog({ song, onClose }: { song: MidiSong; onClose: () => void }) {
  const store = useEditorStore()
  const [pitchTexts, setPitchTexts] = useState(() =>
    Array.from({ length: store.laneCount }, (_, lane) => formatPitchName(DEFAULT_LOWEST_PITCH + lane)),
  )
  const [rows, setRows] = useState<VelocityRow[]>(() =>
    createDefaultVelocityRanges().map((range) => ({
      note: range.note,
      min: String(range.min),
      max: String(range.max),
    })),
  )
  const [result, setResult] = useState<MidiImportResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const hasNotes = store.chart.notes.length > 0

  const discardResult = (): void => {
    setMessage(null)
    setResult(null)
  }

  const confirmImport = (): void => {
    discardResult()
    const pitchToLane = new Map<number, number>()
    for (const [lane, text] of pitchTexts.entries()) {
      const pitch = parsePitchName(text)
      if (pitch === null) {
        setMessage(`レーン ${lane} の音程「${text}」を読めません`)
        return
      }
      const assignedLane = pitchToLane.get(pitch)
      if (assignedLane !== undefined) {
        setMessage(
          `音程 ${formatPitchName(pitch)} がレーン ${assignedLane} とレーン ${lane} の両方に指定されています。レーンごとに別の音程にしてください`,
        )
        return
      }
      pitchToLane.set(pitch, lane)
    }
    const velocityRanges: VelocityRange[] = []
    for (const row of rows) {
      for (const edge of ['min', 'max'] as const) {
        if (parseVelocityText(row[edge]) === null) {
          setMessage(`${describeNoteKind(row.note)}の${VELOCITY_EDGE_LABELS[edge]}を数値で入力してください`)
          return
        }
      }
      velocityRanges.push({ min: Number(row.min), max: Number(row.max), note: row.note })
    }
    try {
      setResult(importMidi(song, { pitchToLane, velocityRanges, laneCount: store.laneCount }, createNoteId))
    } catch (error) {
      if (error instanceof RangeError) {
        logFailure('midiImportDialog.importRejected', error)
        setMessage(describeFailure(error))
        return
      }
      throw error
    }
  }

  const apply = (): void => {
    if (result === null) {
      return
    }
    store.applyMidiImport(result.chart, hasNotes ? null : result.projectInfo)
    onClose()
  }

  return (
    <Dialog title="MIDI を取り込む" widthClassName="w-[34rem]" onClose={onClose}>
      <Field label="音程とレーンの対応">
        <div className="grid grid-cols-2 gap-2">
          {pitchTexts.map((text, lane) => (
            <label key={lane} className="flex items-center gap-2 text-sm text-slate-300">
              <span className="w-16 shrink-0">レーン {lane}</span>
              <input
                className={INPUT_CLASS}
                value={text}
                onChange={(event) => {
                  discardResult()
                  setPitchTexts(pitchTexts.map((current, i) => (i === lane ? event.target.value : current)))
                }}
              />
            </label>
          ))}
        </div>
      </Field>
      <Field label="ベロシティの範囲">
        <div className="space-y-1.5">
          {rows.map((row, index) => (
            <div key={describeNoteKind(row.note)} className="flex items-center gap-2 text-sm text-slate-300">
              <span className="w-56 shrink-0">{describeNoteKind(row.note)}</span>
              {(['min', 'max'] as const).map((edge) => (
                <input
                  key={edge}
                  type="number"
                  className={`${INPUT_CLASS} w-20`}
                  value={row[edge]}
                  onChange={(event) => {
                    discardResult()
                    setRows(
                      rows.map((current, i) => (i === index ? { ...current, [edge]: event.target.value } : current)),
                    )
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </Field>
      {hasNotes && (
        <p className="text-xs text-amber-200">譜面にノーツがあるため、MIDI のテンポと拍子は取り込みません。</p>
      )}
      <div className="flex gap-2">
        <Button onClick={confirmImport}>確認する</Button>
        <Button tone="accent" disabled={result === null} onClick={apply}>
          取り込む
        </Button>
      </div>
      {message !== null && (
        <p role="alert" className="text-sm text-amber-200">
          {message}
        </p>
      )}
      {result !== null && (
        <div role="status" className="space-y-1 text-sm text-slate-300">
          <p>{`取り込むノーツ ${result.chart.notes.length} 個、取り込めないノート ${result.warnings.length} 個`}</p>
          <ul className="max-h-32 overflow-y-auto text-xs text-muted">
            {result.warnings.map((warning, index) => (
              <li key={index}>
                {`${describePosition(hasNotes ? store.projectInfo : result.projectInfo, warning.tick)} レーン ${warning.lane}: ${WARNING_LABELS[warning.reason]}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  )
}
