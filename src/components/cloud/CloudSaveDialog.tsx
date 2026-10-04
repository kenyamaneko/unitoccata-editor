import { useState } from 'react'
import { createChartId, createProjectId, findSaveConflict, type CloudProjects } from '../../domain/cloudProjects.ts'
import { findChartNameMessage, findSongNameMessage } from '../../domain/nameProblems.ts'
import { serializeNotes } from '../../adapter/format/chartFormat.ts'
import { serializeProjectInfoFields } from '../../adapter/format/projectInfoFormat.ts'
import { useEditorStore } from '../../state/editorStore.ts'
import { describeFailure } from '../../utils/describeFailure.ts'
import { logFailure } from '../../utils/logFailure.ts'
import { Dialog } from '../common/Dialog.tsx'
import { Button } from '../common/ui.tsx'

interface DialogMessage {
  readonly kind: 'progress' | 'success' | 'failure'
  readonly text: string
}

const MESSAGE_CLASSES: Record<DialogMessage['kind'], string> = {
  progress: 'text-slate-300',
  success: 'text-emerald-300',
  failure: 'text-amber-200',
}

export function CloudSaveDialog({ projects, onClose }: { projects: CloudProjects; onClose: () => void }) {
  const store = useEditorStore()
  const [message, setMessage] = useState<DialogMessage | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const songNameProblem = findSongNameMessage(store.songName)
  const chartNameProblem = findChartNameMessage(store.chartName)
  const problem = songNameProblem ?? chartNameProblem

  const save = async (): Promise<void> => {
    const { songName, chartName, audio, projectInfo, barCount, laneCount, chart, cloudBaseline } =
      useEditorStore.getState()
    const projectId = createProjectId(songName)
    const expectedUpdatedAt = cloudBaseline?.projectId === projectId ? cloudBaseline.updatedAt : null
    setIsSaving(true)
    setMessage({ kind: 'progress', text: '保存中です' })
    try {
      try {
        const conflict = findSaveConflict((await projects.readProject(projectId))?.updatedAt ?? null, expectedUpdatedAt)
        if (conflict !== null) {
          setMessage({ kind: 'failure', text: conflict })
          return
        }
      } catch (error) {
        logFailure('cloudSaveDialog.checkFailed', error, { songName })
        setMessage({ kind: 'failure', text: `保存先を確かめられませんでした: ${describeFailure(error)}` })
        return
      }
      if (audio !== null) {
        try {
          await projects.saveAudio(projectId, audio.name, audio.file)
        } catch (error) {
          logFailure('cloudSaveDialog.saveAudioFailed', error, { songName, fileName: audio.name })
          setMessage({
            kind: 'failure',
            text: `音源「${audio.name}」を保存できませんでした: ${describeFailure(error)}`,
          })
          return
        }
      }
      let updatedAt: number
      try {
        updatedAt = await projects.saveProject({
          projectId,
          chartId: createChartId(chartName),
          project: {
            title: songName,
            ...(audio === null ? {} : { audioFileName: audio.name }),
            ...serializeProjectInfoFields(projectInfo),
            barCount,
          },
          chart: { name: chartName, laneCount, notes: serializeNotes(chart) },
          expectedUpdatedAt,
        })
      } catch (error) {
        logFailure('cloudSaveDialog.saveFailed', error, { songName, chartName })
        setMessage({ kind: 'failure', text: `プロジェクトと譜面を保存できませんでした: ${describeFailure(error)}` })
        return
      }
      useEditorStore.getState().setCloudBaseline({ projectId, updatedAt })
      if (audio !== null) {
        let replacedNames: string[]
        try {
          replacedNames = (await projects.listAudioFiles(projectId)).filter((name) => name !== audio.name)
        } catch (error) {
          logFailure('cloudSaveDialog.listAudioFailed', error, { songName })
          setMessage({ kind: 'failure', text: `古い音源を確かめられませんでした: ${describeFailure(error)}` })
          return
        }
        for (const name of replacedNames) {
          try {
            await projects.deleteAudio(projectId, name)
          } catch (error) {
            logFailure('cloudSaveDialog.deleteAudioFailed', error, { songName, fileName: name })
            setMessage({
              kind: 'failure',
              text: `古い音源「${name}」を削除できませんでした: ${describeFailure(error)}`,
            })
            return
          }
        }
      }
      setMessage({ kind: 'success', text: `曲「${songName}」の譜面「${chartName}」を保存しました` })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog title="クラウドに保存" widthClassName="w-[28rem]" canClose={!isSaving} onClose={onClose}>
      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-12 text-muted">曲名</dt>
          <dd className="text-slate-100">{store.songName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 text-muted">譜面名</dt>
          <dd className="text-slate-100">{store.chartName}</dd>
        </div>
      </dl>
      {problem !== null && (
        <p className="text-xs text-amber-200">{problem}。「プロジェクト情報」と「譜面設定」で入力してください</p>
      )}
      <Button tone="accent" disabled={isSaving || problem !== null} onClick={() => void save()}>
        保存する
      </Button>
      {message !== null && (
        <p
          role={message.kind === 'failure' ? 'alert' : 'status'}
          className={`text-sm ${MESSAGE_CLASSES[message.kind]}`}
        >
          {message.text}
        </p>
      )}
    </Dialog>
  )
}
