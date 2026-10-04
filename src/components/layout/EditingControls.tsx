import { GRID_DIVISIONS, type GridDivision } from '../../domain/constants.ts'
import { useEditorStore } from '../../state/editorStore.ts'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  CutIcon,
  MirrorIcon,
  PasteIcon,
  RedoIcon,
  SelectAllIcon,
  UndoIcon,
} from '../common/icons.tsx'
import { Button } from '../common/ui.tsx'

const GRID_DIVISION_LABEL = 'グリッド分割'

/** グリッド分割の選択と、元に戻す・やり直す、切り取り・コピー・貼り付け、左右反転、全選択、選択の移動のボタン。 */
export function EditingControls() {
  const store = useEditorStore()
  const isAllSelected =
    store.chart.notes.length > 0 && store.chart.notes.every((note) => store.selectedNoteIds.includes(note.id))

  return (
    <>
      <label className="flex items-center justify-between gap-2 text-sm text-muted">
        {GRID_DIVISION_LABEL}
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400"
          value={store.gridDivision}
          onChange={(event) => store.setGridDivision(Number(event.target.value) as GridDivision)}
        >
          {GRID_DIVISIONS.map((division) => (
            <option key={division} value={division}>
              {division} 分
            </option>
          ))}
        </select>
      </label>
      <div className="h-px bg-slate-700" />
      <Button onClick={() => store.undo()} disabled={store.past.length === 0} title="Ctrl+Z">
        <UndoIcon />
        元に戻す
      </Button>
      <Button onClick={() => store.redo()} disabled={store.future.length === 0} title="Ctrl+Shift+Z">
        <RedoIcon />
        やり直す
      </Button>
      <div className="h-px bg-slate-700" />
      <Button onClick={() => store.cutSelection()} disabled={store.selectedNoteIds.length === 0} title="Ctrl+X">
        <CutIcon />
        切り取り
      </Button>
      <Button onClick={() => store.copySelection()} disabled={store.selectedNoteIds.length === 0} title="Ctrl+C">
        <CopyIcon />
        コピー
      </Button>
      <Button
        tone={store.isPasteTargeting ? 'active' : 'neutral'}
        aria-pressed={store.isPasteTargeting}
        onClick={() => store.togglePasteTargeting()}
        disabled={store.clipboard.notes.length === 0}
        title="Ctrl+V"
      >
        <PasteIcon />
        貼り付け
      </Button>
      <div className="h-px bg-slate-700" />
      <Button onClick={() => store.mirrorSelection()} disabled={store.selectedNoteIds.length === 0}>
        <MirrorIcon />
        左右反転
      </Button>
      <div className="h-px bg-slate-700" />
      <Button
        tone={isAllSelected ? 'active' : 'neutral'}
        aria-pressed={isAllSelected}
        onClick={() => store.selectAll()}
        disabled={store.chart.notes.length === 0}
        title="Ctrl+A"
      >
        <SelectAllIcon />
        全選択
      </Button>
      <Button onClick={() => store.moveSelection(1)} disabled={store.selectedNoteIds.length === 0}>
        <ArrowUpIcon />1 拍 後ろへ
      </Button>
      <Button onClick={() => store.moveSelection(-1)} disabled={store.selectedNoteIds.length === 0}>
        <ArrowDownIcon />1 拍 前へ
      </Button>
    </>
  )
}
