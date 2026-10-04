import { useEditorStore } from '../../state/editorStore.ts'
import { Button } from '../common/ui.tsx'

const MODE_TABS = [
  { mode: 'editor', label: 'エディタ' },
  { mode: 'preview', label: 'プレビュー' },
] as const

/** エディタとプレビューを切り替えるタブ。 */
export function ModeTabs() {
  const store = useEditorStore()
  return (
    <div role="tablist" className="flex items-center gap-1">
      {MODE_TABS.map((tab) => (
        <Button
          key={tab.mode}
          role="tab"
          aria-selected={store.mode === tab.mode}
          tone={store.mode === tab.mode ? 'active' : 'neutral'}
          onClick={() => store.setMode(tab.mode)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  )
}
