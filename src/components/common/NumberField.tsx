import { useId, useState } from 'react'
import { Field } from './ui.tsx'

function readNumberInput(input: HTMLInputElement): number | null {
  return Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null
}

/**
 * 数値の設定の入力欄。入力を確定 (フォーカスを外す、または Enter) したとき、isValid を満たす数なら onCommit に渡す。
 * 満たさない入力は保存せず、理由を出す。入力し直すと理由は消える。
 */
export function NumberField({
  label,
  value,
  invalidMessage,
  isValid,
  onCommit,
}: {
  label: string
  value: number
  invalidMessage: string
  isValid: (value: number) => boolean
  onCommit: (value: number) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()

  const readValidValue = (input: HTMLInputElement): number | null => {
    const entered = readNumberInput(input)
    return entered !== null && isValid(entered) ? entered : null
  }

  return (
    <Field label={label} controlId={inputId}>
      <input
        id={inputId}
        type="number"
        step="any"
        defaultValue={value}
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : errorId}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400 aria-invalid:border-rose-400"
        onChange={() => setError(null)}
        onBlur={(event) => {
          const entered = readValidValue(event.currentTarget)
          if (entered === null) {
            setError(invalidMessage)
            return
          }
          if (entered !== value) {
            onCommit(entered)
            // 入力した値が採用されなかったときに備えて、入力欄をいまの値に戻す。採用されたときは、新しい値で入力欄が作り直される。
            event.currentTarget.value = String(value)
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') {
            return
          }
          if (readValidValue(event.currentTarget) === null) {
            setError(invalidMessage)
          } else {
            event.currentTarget.blur()
          }
        }}
      />
      {error !== null && (
        <p id={errorId} role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      )}
    </Field>
  )
}
