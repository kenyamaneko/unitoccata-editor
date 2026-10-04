import { useId } from 'react'
import { Field } from './ui.tsx'

const INPUT_CLASS =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400 disabled:opacity-40'

/** 曲名・譜面名の入力欄。問題があるときは、入力欄の下にその文言を出す。 */
export function NameField({
  label,
  value,
  problem,
  disabled,
  onChange,
}: {
  label: string
  value: string
  problem: string | null
  disabled: boolean
  onChange: (value: string) => void
}) {
  const problemId = useId()
  return (
    <Field label={label}>
      <input
        className={INPUT_CLASS}
        aria-label={label}
        value={value}
        disabled={disabled}
        aria-invalid={problem !== null}
        aria-describedby={problem === null ? undefined : problemId}
        onChange={(event) => onChange(event.target.value)}
      />
      {problem !== null && (
        <p id={problemId} className="text-xs text-amber-200">
          {problem}
        </p>
      )}
    </Field>
  )
}
