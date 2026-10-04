import { useEditorStore } from '../../state/editorStore.ts'
import { BAR_COUNT_SETTING } from '../../domain/numberSettings.ts'
import { Dialog } from '../common/Dialog.tsx'
import { NameField } from '../common/NameField.tsx'
import { findSongNameMessage } from '../../domain/nameProblems.ts'
import { NumberField } from '../common/NumberField.tsx'

const OFFSET_INVALID_MESSAGE = 'オフセットは数値で入力してください'
const BAR_COUNT_INVALID_MESSAGE = `小節数は ${BAR_COUNT_SETTING.requirementText}で入力してください`

/** 曲名、オフセット、小節数を設定する、プロジェクト情報のダイアログ。テンポと拍子は、タイムラインで編集する。 */
export function ProjectInfoDialog({ onClose }: { onClose: () => void }) {
  const store = useEditorStore()

  return (
    <Dialog title="プロジェクト情報" widthClassName="w-[30rem]" onClose={onClose}>
      <NameField
        label="曲名"
        value={store.songName}
        problem={findSongNameMessage(store.songName)}
        disabled={false}
        onChange={store.setSongName}
      />
      <NumberField
        key={store.projectInfo.offsetMs}
        label="オフセット (ms)"
        value={store.projectInfo.offsetMs}
        invalidMessage={OFFSET_INVALID_MESSAGE}
        isValid={Number.isFinite}
        onCommit={(offsetMs) => store.setOffset(offsetMs)}
      />
      <NumberField
        key={`bars-${store.barCount}`}
        label="小節数"
        value={store.barCount}
        invalidMessage={BAR_COUNT_INVALID_MESSAGE}
        isValid={BAR_COUNT_SETTING.isValid}
        onCommit={(barCount) => store.requestBarCount(barCount)}
      />
    </Dialog>
  )
}
