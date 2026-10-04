import { Dialog } from '../common/Dialog.tsx'

const LEGAL_LINKS = [
  { label: '利用規約', hash: '#/legal/terms' },
  { label: 'プライバシーポリシー', hash: '#/legal/privacy' },
] as const

/** アプリの名前と、利用規約とプライバシーポリシーへのリンク、デプロイしたアプリのバージョン (Git タグから求めた値) を出すダイアログ。バージョンはビルド時に指定されていないとき (ローカルの開発) は出さない。 */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const version: string | undefined = import.meta.env.VITE_BUILD_VERSION
  return (
    <Dialog title="このアプリについて" widthClassName="w-[24rem]" onClose={onClose}>
      <p className="text-sm text-slate-300">UniToccata Editor</p>
      {version !== undefined && version !== '' && <p className="font-mono text-sm text-muted">バージョン {version}</p>}
      <nav className="flex flex-col gap-1 text-sm">
        {LEGAL_LINKS.map((link) => (
          <a key={link.hash} className="text-sky-400 underline" href={link.hash} onClick={onClose}>
            {link.label}
          </a>
        ))}
      </nav>
    </Dialog>
  )
}
