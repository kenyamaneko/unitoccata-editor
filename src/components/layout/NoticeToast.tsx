import { useEffect } from 'react'
import { useEditorStore } from '../../state/editorStore.ts'

const NOTICE_MILLISECONDS = 4000

/** 利用者に短いメッセージを表示する。 */
export function NoticeToast() {
  const notice = useEditorStore((state) => state.notice)
  const dismiss = useEditorStore((state) => state.dismissNotice)

  useEffect(() => {
    if (notice === null) {
      return
    }
    const timer = window.setTimeout(dismiss, NOTICE_MILLISECONDS)
    return () => window.clearTimeout(timer)
  }, [notice, dismiss])

  if (notice === null) {
    return null
  }
  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-amber-400/40 bg-slate-900/95 px-4 py-2.5 text-sm text-amber-100 shadow-xl"
    >
      {notice.message}
    </div>
  )
}
