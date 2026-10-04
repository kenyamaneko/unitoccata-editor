import { useId, useState } from 'react'
import { seekPreview } from '../../state/previewController.ts'
import { calculateBarsEndTick } from '../../domain/projectInfo.ts'
import { useEditorStore } from '../../state/editorStore.ts'
import { PlayIcon } from '../common/icons.tsx'
import { Button, Field } from '../common/ui.tsx'

/** プレビューを、指定の tick から再生し直す。 */
function playPreviewFrom(tick: number): void {
  const store = useEditorStore.getState()
  store.setPreviewTick(tick)
  seekPreview(useEditorStore.getState().previewTick)
}

/** プレビューのコントロール。初めから再生するボタンと、小節番号を指定して、その小節の頭から再生する入力欄、クリック音のボタン。 */
export function PreviewControls() {
  const store = useEditorStore()
  const [barText, setBarText] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()

  const playFromBar = (): void => {
    const barNumber = Number(barText)
    if (barText.trim() === '' || !Number.isInteger(barNumber) || barNumber < 1 || barNumber > store.barCount) {
      setError(`小節番号は 1 以上 ${store.barCount} 以下の整数で入力してください`)
      return
    }
    setError(null)
    playPreviewFrom(calculateBarsEndTick(store.projectInfo, barNumber - 1))
  }

  return (
    <>
      <Button onClick={() => playPreviewFrom(0)}>
        <PlayIcon />
        初めから再生
      </Button>
      <div className="h-px bg-slate-700" />
      <Field label="小節番号" controlId={inputId}>
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            type="number"
            min={1}
            max={store.barCount}
            value={barText}
            aria-invalid={error !== null}
            aria-describedby={error === null ? undefined : errorId}
            className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400 aria-invalid:border-rose-400"
            onChange={(event) => {
              setBarText(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                playFromBar()
              }
            }}
          />
          <Button onClick={playFromBar}>
            <PlayIcon />
            再生
          </Button>
        </div>
        {error !== null && (
          <p id={errorId} role="alert" className="text-xs text-rose-300">
            {error}
          </p>
        )}
      </Field>
      <div className="h-px bg-slate-700" />
      <Button
        tone={store.metronomeEnabled ? 'active' : 'neutral'}
        aria-pressed={store.metronomeEnabled}
        onClick={() => store.setMetronomeEnabled(!store.metronomeEnabled)}
      >
        クリック音
      </Button>
    </>
  )
}
