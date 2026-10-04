import { useEffect } from 'react'
import { beginPreview, endPreview } from '../../state/previewController.ts'
import { describeFailure } from '../../utils/describeFailure.ts'
import { logFailure } from '../../utils/logFailure.ts'
import { useEditorStore } from '../../state/editorStore.ts'
import { NoticeToast } from './NoticeToast.tsx'
import { PreviewCanvas } from '../preview/PreviewCanvas.tsx'
import { TimelineCanvas } from '../timeline/TimelineCanvas.tsx'
import { TimelineScrollbar } from '../timeline/TimelineScrollbar.tsx'
import { Toolbar } from './Toolbar.tsx'
import { useEditorShortcuts } from '../../hooks/useEditorShortcuts.ts'

/** エディタ画面。エディタのタブでは譜面を編集する画面を、プレビューのタブではプレビューの画面だけを出す。キーボード操作とプレビューの再生は、この画面が表示されている間だけ働く。 */
export function EditorScreen() {
  useEditorShortcuts()
  const mode = useEditorStore((state) => state.mode)
  const isLoadingAudio = useEditorStore((state) => state.isLoadingAudio)

  useEffect(() => {
    if (mode !== 'preview') {
      return
    }
    let isCurrent = true
    const stopPreviewWithNotice = (message: string): void => {
      const store = useEditorStore.getState()
      store.showNotice(message)
      if (isCurrent) {
        store.setMode('editor')
      }
    }
    beginPreview((error) => {
      logFailure('editorScreen.previewStoppedUnexpectedly', error)
      stopPreviewWithNotice(describeFailure(error))
    }).catch((error: unknown) => {
      logFailure('editorScreen.beginPreviewFailed', error)
      stopPreviewWithNotice(`プレビューを始められませんでした: ${describeFailure(error)}`)
    })
    return () => {
      isCurrent = false
      endPreview()
    }
  }, [mode])

  useEffect(() => () => useEditorStore.getState().setMode('editor'), [])

  return (
    <div className="relative flex h-screen flex-col bg-slate-950 text-slate-100">
      <div className="flex min-h-0 flex-1 flex-col" inert={isLoadingAudio}>
        <Toolbar>
          {mode === 'editor' ? (
            <>
              <main className="min-w-0 flex-1">
                <TimelineCanvas />
              </main>
              <TimelineScrollbar />
            </>
          ) : (
            <main className="min-w-0 flex-1">
              <PreviewCanvas />
            </main>
          )}
        </Toolbar>
      </div>
      <NoticeToast />
      {isLoadingAudio && (
        <div
          role="status"
          className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 text-sm text-slate-200 backdrop-blur-sm"
        >
          音源を読み込み中です
        </div>
      )}
    </div>
  )
}
