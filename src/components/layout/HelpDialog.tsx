import type { ReactNode } from 'react'
import { Dialog } from '../common/Dialog.tsx'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold tracking-wide text-slate-100">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-300">{children}</ul>
    </section>
  )
}

/** エディタの操作の説明を出すダイアログ。ノーツの入力方法、削除、テンポと拍子、キーボードとホイールの操作を書く。 */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="操作説明" widthClassName="w-[36rem]" onClose={onClose}>
      <Section title="ノーツを入力する">
        <li>タップノーツ: 何もないマスをクリックする。</li>
        <li>ロングノーツ: 何もないマスを押して、そのまま別のマスまでドラッグして離す。離したマスが終端になる。</li>
        <li>ロングノーツを伸ばす: 終端の点を押して、先のマスまでドラッグして離す。</li>
        <li>
          フリックノーツ:
          タップノーツを置いてから、そのノーツを押して、上・左・右のどれかへドラッグして離す。下へドラッグすると、フリックが外れる。
        </li>
        <li>ロングノーツの終端フリック: 終端の点にマウスを置いて、矢印キーの ↑ ← → を押す。↓ を押すと外れる。</li>
      </Section>
      <Section title="ノーツを選ぶ、動かす">
        <li>範囲選択: Shift を押しながら、何もないマスからドラッグする。</li>
        <li>
          全選択: Ctrl+A (Mac は Cmd+A)、またはパネルの「全選択」ボタン。全選択のあとにもう一度押すと、選択を解除する。
        </li>
        <li>
          選択したノーツを 1 拍ずつ動かす: パネルの「1 拍 後ろへ」「1 拍
          前へ」ボタン。全てのノーツを動かすときは、先に全選択する。
        </li>
        <li>点を動かす: Shift を押しながら、点をドラッグする。</li>
        <li>ロングノーツ全体を動かす: Shift を押しながら、ロングノーツの本体 (点と点の間) をドラッグする。</li>
      </Section>
      <Section title="ノーツを削除する">
        <li>
          右クリックで削除する。タップノーツ、フリックノーツ、ロングノーツの始点と本体は、ノーツ全体が削除される。
        </li>
        <li>ロングノーツの続く点と終端を右クリックすると、その点から先が削除される。</li>
      </Section>
      <Section title="テンポと拍子">
        <li>テンポ列、拍子列のマスをクリックして、BPM、拍子を入力する。エンターキーで確定する。</li>
        <li>変化点をダブルクリックすると、値を直せる。右クリックすると削除される (先頭の変化点は削除できない)。</li>
      </Section>
      <Section title="キーボードとホイール">
        <li>Ctrl+Z: 元に戻す / Ctrl+Shift+Z: やり直す (Mac は Cmd)。</li>
        <li>
          Ctrl+X: 切り取り / Ctrl+C: コピー / Ctrl+V: 貼り付け (Mac は
          Cmd)。貼り付けは、コピーしたノーツのうち時間が一番早い位置が、最後にマウスを置いたマスに入る。
        </li>
        <li>
          パネルの「貼り付け」ボタン:
          押したあと、タイムラインの貼り付けたいマスをクリックする。マウスのマスに貼り付け後のノーツが半透明で見える。エスケープキー、またはもう一度「貼り付け」を押すと、貼り付けずに戻る。
        </li>
        <li>ホイール: スクロール / Ctrl+ホイール: ズーム</li>
      </Section>
    </Dialog>
  )
}
