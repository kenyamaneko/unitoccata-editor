import { MAX_LANE_COUNT, MIN_LANE_COUNT } from '../../domain/constants.ts'
import { useEditorStore } from '../../state/editorStore.ts'
import { Dialog } from '../common/Dialog.tsx'
import { NameField } from '../common/NameField.tsx'
import { findChartNameMessage } from '../../domain/nameProblems.ts'
import { Button, Field } from '../common/ui.tsx'

/** 譜面名とレーン数を設定する、譜面設定のダイアログ。 */
export function ChartSettingsDialog({ onClose }: { onClose: () => void }) {
  const store = useEditorStore()

  return (
    <Dialog title="譜面設定" widthClassName="w-[30rem]" onClose={onClose}>
      <NameField
        label="譜面名"
        value={store.chartName}
        problem={findChartNameMessage(store.chartName)}
        disabled={false}
        onChange={store.setChartName}
      />
      <Field label="レーン数">
        <div className="flex items-center gap-2">
          <Button
            disabled={store.laneCount <= MIN_LANE_COUNT}
            onClick={() => store.requestLaneCount(store.laneCount - 1)}
          >
            −
          </Button>
          <output className="w-8 text-center text-sm tabular-nums text-slate-100">{store.laneCount}</output>
          <Button
            disabled={store.laneCount >= MAX_LANE_COUNT}
            onClick={() => store.requestLaneCount(store.laneCount + 1)}
          >
            ＋
          </Button>
        </div>
      </Field>
    </Dialog>
  )
}
