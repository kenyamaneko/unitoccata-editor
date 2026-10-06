import { useEffect, useState } from 'react'
import { getAudioContext } from '../../adapter/audio/audioContext.ts'
import { loadAudioFile } from '../../adapter/audio/audioFile.ts'
import type { CloudChartSummary, CloudProjects, CloudProjectSummary } from '../../domain/cloudProjects.ts'
import { MAX_BAR_COUNT, MIN_BAR_COUNT } from '../../domain/constants.ts'
import { parseChartJson } from '../../adapter/format/chartFormat.ts'
import { FormatError } from '../../adapter/format/formatError.ts'
import { FILE_FORMAT_VERSION } from '../../adapter/format/formatVersion.ts'
import { createNoteId, useEditorStore } from '../../state/editorStore.ts'
import { assertNever } from '../../utils/assertNever.ts'
import { describeFailure } from '../../utils/describeFailure.ts'
import { logFailure } from '../../utils/logFailure.ts'
import { Dialog } from '../common/Dialog.tsx'
import { Button } from '../common/ui.tsx'

type Loadable<T> =
  { readonly status: 'loading' } | { readonly status: 'loaded'; readonly value: T } | { readonly status: 'failed' }

function renderProjectItems(
  loadable: Loadable<CloudProjectSummary[]>,
  onRetry: () => void,
  onSelect: (project: CloudProjectSummary) => void,
) {
  switch (loadable.status) {
    case 'loading':
      return <li className="text-sm text-muted">読み込み中です</li>
    case 'failed':
      return (
        <li>
          <Button onClick={onRetry}>もう一度読み込む</Button>
        </li>
      )
    case 'loaded':
      return loadable.value.length === 0 ? (
        <li className="text-sm text-muted">保存した曲がありません</li>
      ) : (
        loadable.value.map((project) => (
          <li key={project.id}>
            <Button className="w-full justify-start" onClick={() => onSelect(project)}>
              {project.title}
            </Button>
          </li>
        ))
      )
    default:
      return assertNever(loadable)
  }
}

function renderChartItems(
  loadable: Loadable<CloudChartSummary[]>,
  isOpening: boolean,
  onOpen: (chart: CloudChartSummary) => void,
) {
  switch (loadable.status) {
    case 'loading':
      return <li className="text-sm text-muted">読み込み中です</li>
    case 'failed':
      return null
    case 'loaded':
      return loadable.value.length === 0 ? (
        <li className="text-sm text-muted">この曲には譜面がありません</li>
      ) : (
        loadable.value.map((chart) => (
          <li key={chart.id}>
            <Button className="w-full justify-start" disabled={isOpening} onClick={() => onOpen(chart)}>
              {chart.name}
            </Button>
          </li>
        ))
      )
    default:
      return assertNever(loadable)
  }
}

export function CloudOpenDialog({ projects, onClose }: { projects: CloudProjects; onClose: () => void }) {
  const store = useEditorStore()
  const [projectList, setProjectList] = useState<Loadable<CloudProjectSummary[]>>({ status: 'loading' })
  const [project, setProject] = useState<CloudProjectSummary | null>(null)
  const [charts, setCharts] = useState<Loadable<CloudChartSummary[]>>({ status: 'loading' })
  const [message, setMessage] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [projectsLoadCount, setProjectsLoadCount] = useState(0)

  useEffect(() => {
    let isCancelled = false
    projects
      .listProjects()
      .then((summaries) => {
        if (!isCancelled) {
          setProjectList({ status: 'loaded', value: summaries })
        }
      })
      .catch((error: unknown) => {
        logFailure('cloudOpenDialog.listProjectsFailed', error)
        if (!isCancelled) {
          setProjectList({ status: 'failed' })
          setMessage(`曲の一覧を読み込めませんでした: ${describeFailure(error)}`)
        }
      })
    return () => {
      isCancelled = true
    }
  }, [projects, projectsLoadCount])

  const retryLoadingProjects = (): void => {
    setProjectList({ status: 'loading' })
    setMessage(null)
    setProjectsLoadCount(projectsLoadCount + 1)
  }

  const selectProject = async (selected: CloudProjectSummary): Promise<void> => {
    setProject(selected)
    setCharts({ status: 'loading' })
    setMessage(null)
    try {
      setCharts({ status: 'loaded', value: await projects.listCharts(selected.id) })
    } catch (error) {
      logFailure('cloudOpenDialog.listChartsFailed', error, { songName: selected.title })
      setCharts({ status: 'failed' })
      setMessage(`譜面の一覧を読み込めませんでした: ${describeFailure(error)}`)
    }
  }

  const backToProjects = (): void => {
    setProject(null)
    retryLoadingProjects()
  }

  const openChart = async (selected: CloudProjectSummary, chartSummary: CloudChartSummary): Promise<void> => {
    setIsOpening(true)
    setMessage(null)
    try {
      const projectData = await projects.readProject(selected.id)
      if (projectData === null) {
        throw new Error('プロジェクトが見つかりません。曲の一覧を開き直してください')
      }
      if (
        !Number.isInteger(projectData.barCount) ||
        projectData.barCount < MIN_BAR_COUNT ||
        projectData.barCount > MAX_BAR_COUNT
      ) {
        throw new FormatError(`小節数は ${MIN_BAR_COUNT} 以上 ${MAX_BAR_COUNT} 以下の整数にしてください`)
      }
      const chartData = await projects.readChart(selected.id, chartSummary.id)
      let loaded
      try {
        loaded = parseChartJson(
          {
            formatVersion: FILE_FORMAT_VERSION,
            offsetMs: projectData.offsetMs,
            laneCount: chartData.laneCount,
            barCount: projectData.barCount,
            tempo: projectData.tempo,
            meter: projectData.meter,
            notes: chartData.notes,
          },
          createNoteId,
        )
      } catch (error) {
        if (error instanceof FormatError) {
          throw new FormatError(`譜面「${chartData.name}」: ${error.message}`)
        }
        throw error
      }
      const audioFileName = projectData.audioFileName
      const audio =
        audioFileName === null
          ? null
          : await loadAudioFile(
              new File([await projects.readAudio(selected.id, audioFileName)], audioFileName),
              getAudioContext(),
            )
      store.openCloudChart({
        projectId: selected.id,
        updatedAt: projectData.updatedAt,
        songName: projectData.title,
        chartName: chartData.name,
        projectInfo: loaded.projectInfo,
        barCount: projectData.barCount,
        laneCount: loaded.laneCount,
        chart: loaded.chart,
      })
      if (audio !== null) {
        store.setAudio(audio)
      }
      onClose()
    } catch (error) {
      logFailure('cloudOpenDialog.openFailed', error, { songName: selected.title, chartName: chartSummary.name })
      setMessage(`開けませんでした: ${describeFailure(error)}`)
    } finally {
      setIsOpening(false)
    }
  }

  return (
    <Dialog title="クラウドから開く" widthClassName="w-[28rem]" canClose={!isOpening} onClose={onClose}>
      {project === null ? (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {renderProjectItems(projectList, retryLoadingProjects, (selected) => void selectProject(selected))}
        </ul>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button disabled={charts.status === 'loading' || isOpening} onClick={backToProjects}>
              曲の一覧に戻る
            </Button>
            <div className="text-sm text-muted">{project.title}</div>
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {renderChartItems(charts, isOpening, (chartSummary) => void openChart(project, chartSummary))}
          </ul>
        </div>
      )}
      {isOpening && (
        <p role="status" className="text-sm text-slate-300">
          読み込み中です
        </p>
      )}
      {message !== null && (
        <p role="alert" className="text-sm text-amber-200">
          {message}
        </p>
      )}
    </Dialog>
  )
}
