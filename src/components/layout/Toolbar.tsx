import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createUserCloudProjects } from '../../adapter/cloud/userCloudProjects.ts'
import type { MidiSong } from '../../domain/midiImport.ts'
import { useCloudUser } from '../../hooks/useCloudUser.ts'
import { useHashRoute } from '../../hooks/useHashRoute.ts'
import { useEditorStore } from '../../state/editorStore.ts'
import { LoginDialog } from '../auth/LoginDialog.tsx'
import { CloudOpenDialog } from '../cloud/CloudOpenDialog.tsx'
import { CloudSaveDialog } from '../cloud/CloudSaveDialog.tsx'
import { AboutIcon, BookIcon, InfoIcon, SettingsIcon } from '../common/icons.tsx'
import { Button } from '../common/ui.tsx'
import { PrivacyDialog } from '../legal/PrivacyDialog.tsx'
import { TermsDialog } from '../legal/TermsDialog.tsx'
import { MidiImportDialog } from '../midi/MidiImportDialog.tsx'
import { PreviewControls } from '../preview/PreviewControls.tsx'
import { ChartSettingsDialog } from '../settings/ChartSettingsDialog.tsx'
import { ProjectInfoDialog } from '../settings/ProjectInfoDialog.tsx'
import { AboutDialog } from './AboutDialog.tsx'
import { AccountButton } from './AccountButton.tsx'
import { EditingControls } from './EditingControls.tsx'
import { FileControls } from './FileControls.tsx'
import { HelpDialog } from './HelpDialog.tsx'
import { ModeTabs } from './ModeTabs.tsx'

const PROJECT_INFO_LABEL = 'プロジェクト情報'
const CHART_SETTINGS_LABEL = '譜面設定'
const LOGIN_REQUIRED_MESSAGE = 'クラウドを使うには、ログインしてください'

/** 画面上部のタイトルとタブ、タイムラインの右のコントロール。children は、コントロールの左に並べる本体の画面。 */
export function Toolbar({ children }: { children: ReactNode }) {
  const [midiSong, setMidiSong] = useState<MidiSong | null>(null)
  const store = useEditorStore()
  const user = useCloudUser()
  const [dialog, setDialog] = useState<'save' | 'open' | null>(null)
  const [isProjectInfoOpen, setProjectInfoOpen] = useState(false)
  const [isChartSettingsOpen, setChartSettingsOpen] = useState(false)
  const [isHelpOpen, setHelpOpen] = useState(false)
  const [isAboutOpen, setAboutOpen] = useState(false)
  const route = useHashRoute()
  const isLegalDialogOpen = route === '/login' || route === '/legal/terms' || route === '/legal/privacy'
  const cloudProjects = useMemo(() => (user === null ? null : createUserCloudProjects(user.uid)), [user])
  const isDialogOpen =
    (cloudProjects !== null && dialog !== null) ||
    midiSong !== null ||
    isProjectInfoOpen ||
    isChartSettingsOpen ||
    isHelpOpen ||
    isAboutOpen ||
    isLegalDialogOpen
  const setDialogOpen = useEditorStore((state) => state.setDialogOpen)

  useEffect(() => {
    setDialogOpen(isDialogOpen)
    return () => setDialogOpen(false)
  }, [isDialogOpen, setDialogOpen])

  const openCloudDialog = (kind: 'save' | 'open'): void => {
    if (cloudProjects === null) {
      store.showNotice(LOGIN_REQUIRED_MESSAGE)
      return
    }
    setDialog(kind)
  }

  const editorControls = (
    <>
      <span className="truncate text-sm text-muted">{store.audio?.name ?? '音源が未読み込みです'}</span>
      <div className="flex flex-col gap-3">
        <FileControls onSelectMidiSong={setMidiSong} onOpenCloudDialog={openCloudDialog} />
        <Button onClick={() => setProjectInfoOpen(true)}>
          <InfoIcon />
          {PROJECT_INFO_LABEL}
        </Button>
        <Button onClick={() => setChartSettingsOpen(true)}>
          <SettingsIcon />
          {CHART_SETTINGS_LABEL}
        </Button>
        <AccountButton isSignedIn={cloudProjects !== null} />
      </div>
      <div className="h-px bg-slate-700" />
      <EditingControls />
      <div className="h-px bg-slate-700" />
      <Button onClick={() => setHelpOpen(true)}>
        <BookIcon />
        操作説明
      </Button>
    </>
  )

  return (
    <>
      <header
        inert={isDialogOpen}
        className="relative z-30 flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-2.5 backdrop-blur"
      >
        <h1 className="mr-2 text-base font-semibold tracking-tight text-slate-100">UniToccata Editor</h1>
        <ModeTabs />
      </header>
      <div className="relative flex min-h-0 flex-1" inert={isDialogOpen}>
        {children}
        <aside className="relative z-20 flex min-h-0 w-56 shrink-0 flex-col overflow-y-auto gap-3 [&>*]:shrink-0 border-l border-slate-800 bg-slate-900/80 p-3">
          {store.mode === 'editor' ? editorControls : <PreviewControls />}
          <Button onClick={() => setAboutOpen(true)}>
            <AboutIcon />
            このアプリについて
          </Button>
        </aside>
      </div>
      {cloudProjects !== null && dialog === 'save' && (
        <CloudSaveDialog projects={cloudProjects} onClose={() => setDialog(null)} />
      )}
      {cloudProjects !== null && dialog === 'open' && (
        <CloudOpenDialog projects={cloudProjects} onClose={() => setDialog(null)} />
      )}
      {isProjectInfoOpen && <ProjectInfoDialog onClose={() => setProjectInfoOpen(false)} />}
      {isChartSettingsOpen && <ChartSettingsDialog onClose={() => setChartSettingsOpen(false)} />}
      {isHelpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {isAboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {route === '/login' && <LoginDialog />}
      {route === '/legal/terms' && <TermsDialog />}
      {route === '/legal/privacy' && <PrivacyDialog />}
      {midiSong !== null && <MidiImportDialog song={midiSong} onClose={() => setMidiSong(null)} />}
    </>
  )
}
