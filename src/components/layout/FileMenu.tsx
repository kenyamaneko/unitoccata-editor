import { useEffect, useId, useRef, useState } from 'react'
import { FileIcon } from '../common/icons.tsx'
import { Button } from '../common/ui.tsx'

/** メニューの項目。選ぶと onSelect を呼び、メニューを閉じる。 */
export interface FileMenuItem {
  readonly label: string
  readonly onSelect: () => void
  /** true のとき、項目は薄く表示され、選べない。 */
  readonly disabled?: boolean
}

/** メニューの見出しと、その下にまとめる項目。 */
export interface FileMenuGroup {
  /** 見出し。省略すると、見出しなしで項目だけを並べる。 */
  readonly heading?: string
  readonly items: readonly FileMenuItem[]
}

/** 「ファイル」ボタンと、押すと開く、見出しで分けたメニュー。外をクリックする、Escape を押す、項目を選ぶと閉じる。 */
export function FileMenu({ groups }: { groups: readonly FileMenuGroup[] }) {
  const [isOpen, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const idPrefix = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && containerRef.current?.contains(event.target) !== true) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return
    }
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    if (items.length === 0) {
      return
    }
    const isMovingDown = event.key === 'ArrowDown'
    const index = items.indexOf(document.activeElement as HTMLElement)
    const startIndex = index === -1 && !isMovingDown ? 0 : index
    const next = (startIndex + (isMovingDown ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
    event.preventDefault()
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={moveFocus}>
      <Button
        ref={buttonRef}
        className="w-full"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
      >
        <FileIcon />
        ファイル
      </Button>
      {isOpen && (
        <div
          role="menu"
          className="absolute inset-x-0 top-full z-30 mt-1 space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl"
        >
          {groups.map((group, groupIndex) => (
            <div
              key={group.heading ?? groupIndex}
              role="group"
              aria-labelledby={group.heading === undefined ? undefined : `${idPrefix}-${group.heading}`}
              className="space-y-0.5"
            >
              {group.heading !== undefined && (
                <div id={`${idPrefix}-${group.heading}`} className="px-2 pt-1 text-xs font-medium text-slate-300">
                  {group.heading}
                </div>
              )}
              {group.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled === true}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-100 hover:bg-slate-800 focus-visible:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
