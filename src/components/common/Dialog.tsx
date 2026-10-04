import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './icons.tsx'
import { Button } from './ui.tsx'

/**
 * 画面全体に重ねて出すダイアログの枠。タイトルと「閉じる」を持つ。
 * 右上の「×」ボタン、エスケープキー、ダイアログの外側のクリックでも閉じられる。タイトルの行は、内容をスクロールしても上に残る。
 * canClose が false の間は、どの方法でも閉じられない。
 */
export function Dialog({
  title,
  widthClassName,
  canClose = true,
  onClose,
  children,
}: {
  title: string
  widthClassName: string
  canClose?: boolean
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!canClose) {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [canClose, onClose])

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (canClose && event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        className={`max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl ${widthClassName}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 px-6 py-3">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            aria-label="ダイアログを閉じる"
            title="閉じる (Esc)"
            disabled={!canClose}
            className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {children}
          <div className="flex justify-end">
            <Button disabled={!canClose} onClick={onClose}>
              閉じる
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
