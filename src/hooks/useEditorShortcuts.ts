import { useEffect } from 'react'
import { useEditorStore } from '../state/editorStore.ts'

type KeyAction = (event: KeyboardEvent) => void

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || TYPING_TAGS.includes(target.tagName))
}

const MENU_ARROW_KEYS = ['ArrowUp', 'ArrowDown']
const MENU_TARGET_SELECTOR = '[aria-haspopup="menu"], [role="menu"] *'

/** メニューのボタンと項目は、↑ ↓ を項目の移動に使う。 */
function isMenuArrowKey(event: KeyboardEvent): boolean {
  return (
    MENU_ARROW_KEYS.includes(event.key) &&
    event.target instanceof HTMLElement &&
    event.target.matches(MENU_TARGET_SELECTOR)
  )
}

function shouldLeaveKeyToTarget(event: KeyboardEvent): boolean {
  return isTypingTarget(event.target) || isMenuArrowKey(event)
}

const MODIFIED_KEY_ACTIONS: ReadonlyMap<string, KeyAction> = new Map<string, KeyAction>([
  [
    'z',
    (event) => {
      const { redo, undo } = useEditorStore.getState()
      if (event.shiftKey) {
        redo()
      } else {
        undo()
      }
    },
  ],
  ['a', () => useEditorStore.getState().selectAll()],
  ['x', () => useEditorStore.getState().cutSelection()],
  ['c', () => useEditorStore.getState().copySelection()],
  ['v', () => useEditorStore.getState().paste()],
])

/** エディタのタブで効く、修飾キーなしのキー。 */
const PLAIN_KEY_ACTIONS: ReadonlyMap<string, KeyAction> = new Map<string, KeyAction>([
  ['ArrowUp', () => useEditorStore.getState().setFlickAtHover('up')],
  ['ArrowLeft', () => useEditorStore.getState().setFlickAtHover('left')],
  ['ArrowRight', () => useEditorStore.getState().setFlickAtHover('right')],
  ['ArrowDown', () => useEditorStore.getState().clearFlickAtHover()],
])

function runKeyAction(actions: ReadonlyMap<string, KeyAction>, key: string, event: KeyboardEvent): boolean {
  const action = actions.get(key)
  if (action === undefined) {
    return false
  }
  action(event)
  return true
}

/** エディタのキーボード操作を登録する。プレビューのタブでは、キーは何も効かない。入力欄にフォーカスがあるとき、ダイアログが開いているとき、音源を読み込み中のときは何もしない。メニューのボタンと項目にフォーカスがあるときは、↑ ↓ を使わない。 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const { isLoadingAudio, isDialogOpen, mode } = useEditorStore.getState()
      if (mode !== 'editor' || shouldLeaveKeyToTarget(event) || isLoadingAudio || isDialogOpen) {
        return
      }
      const isModified = event.ctrlKey || event.metaKey
      const handled = runKeyAction(
        isModified ? MODIFIED_KEY_ACTIONS : PLAIN_KEY_ACTIONS,
        isModified ? event.key.toLowerCase() : event.key,
        event,
      )
      if (handled) {
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}
