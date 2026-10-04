import type { ReactNode } from 'react'
import { Dialog } from '../common/Dialog.tsx'

/** エディタのアドレス (hash) に戻して、重ねて出している法務のダイアログを閉じる。 */
function closeLegalDialog(): void {
  window.location.hash = '#/'
}

/** 利用規約、プライバシーポリシー、ログインのダイアログに共通の枠。エディタ画面に重ねて出し、閉じるとエディタ画面に戻る。 */
export function LegalDialog({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Dialog title={title} widthClassName="w-[44rem] max-w-[calc(100vw-2rem)]" onClose={closeLegalDialog}>
      <div className="flex flex-col gap-6 text-sm leading-relaxed text-slate-300">{children}</div>
    </Dialog>
  )
}
