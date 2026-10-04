import type { ReactNode } from 'react'

/** ボタンの文字の前に添えるアイコン。文字と同じ色、同じ高さで、読み上げの対象にしない。 */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="1.1em"
      height="1.1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

/** ファイルのアイコン (フォルダ)。 */
export function FileIcon() {
  return (
    <Icon>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Icon>
  )
}

/** 設定のアイコン (歯車)。 */
export function SettingsIcon() {
  return (
    <Icon>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

/** 元に戻すのアイコン (左に曲がる矢印)。 */
export function UndoIcon() {
  return (
    <Icon>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Icon>
  )
}

/** やり直すのアイコン (右に曲がる矢印)。 */
export function RedoIcon() {
  return (
    <Icon>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </Icon>
  )
}

/** ログインとログアウトのアイコン (人)。 */
export function UserIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  )
}

/** 左右反転のアイコン (左右を向いた矢印)。 */
export function MirrorIcon() {
  return (
    <Icon>
      <path d="M3 12h18" />
      <path d="m7 8-4 4 4 4" />
      <path d="m17 8 4 4-4 4" />
    </Icon>
  )
}

/** 切り取りのアイコン (はさみ)。 */
export function CutIcon() {
  return (
    <Icon>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88" />
      <path d="M14.47 14.48 20 20" />
      <path d="M8.12 8.12 12 12" />
    </Icon>
  )
}

/** コピーのアイコン (重なった 2 枚)。 */
export function CopyIcon() {
  return (
    <Icon>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </Icon>
  )
}

/** 貼り付けのアイコン (クリップボード)。 */
export function PasteIcon() {
  return (
    <Icon>
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </Icon>
  )
}

/** 操作説明のアイコン (本)。 */
export function BookIcon() {
  return (
    <Icon>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </Icon>
  )
}

/** プロジェクト情報のアイコン (丸の中に i)。 */
export function InfoIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  )
}

/** 再生のアイコン (右向きの三角)。 */
export function PlayIcon() {
  return (
    <Icon>
      <polygon points="6 4 20 12 6 20 6 4" />
    </Icon>
  )
}

/** 閉じるのアイコン (×)。 */
export function CloseIcon() {
  return (
    <Icon>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  )
}

/** 全選択のアイコン (点線の四角)。 */
export function SelectAllIcon() {
  return (
    <Icon>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" />
    </Icon>
  )
}

/** 後ろへ動かすのアイコン (上向きの矢印)。 */
export function ArrowUpIcon() {
  return (
    <Icon>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </Icon>
  )
}

/** 前へ動かすのアイコン (下向きの矢印)。 */
export function ArrowDownIcon() {
  return (
    <Icon>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </Icon>
  )
}
