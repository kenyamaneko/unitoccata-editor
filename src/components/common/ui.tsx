import type { ComponentProps, ReactNode } from 'react'

type ButtonTone = 'neutral' | 'accent' | 'active'

const TONE_CLASSES: Record<ButtonTone, string> = {
  neutral: 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80',
  accent: 'border-sky-500/60 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30',
  active: 'border-sky-400 bg-sky-400 text-slate-950 hover:bg-sky-300',
}

/** 画面共通のボタン。 */
export function Button({
  tone = 'neutral',
  className = '',
  ...props
}: ComponentProps<'button'> & { tone?: ButtonTone }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-40 ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  )
}

/** 設定ダイアログの 1 項目。入力欄を持つ項目は、入力欄の id を controlId に渡すと、ラベルが入力欄の名前になる。 */
export function Field({ label, controlId, children }: { label: string; controlId?: string; children: ReactNode }) {
  const labelClassName = 'text-xs font-medium tracking-wide text-muted'
  return (
    <div className="space-y-1.5">
      {controlId === undefined ? (
        <div className={labelClassName}>{label}</div>
      ) : (
        <label htmlFor={controlId} className={`block ${labelClassName}`}>
          {label}
        </label>
      )}
      {children}
    </div>
  )
}
