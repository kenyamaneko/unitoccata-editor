import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction } from 'firebase/firestore'
import { deleteObject, getBytes, listAll, ref, uploadBytes } from 'firebase/storage'
import { getServices } from './firebaseClient.ts'
import {
  CloudConflictError,
  findSaveConflict,
  type CloudChartData,
  type CloudChartSummary,
  type CloudProjectData,
  type CloudProjects,
  type CloudProjectSummary,
} from '../../domain/cloudProjects.ts'

function readNumberField(data: Record<string, unknown>, key: string): number {
  const value = data[key]
  if (typeof value !== 'number') {
    throw new Error(`クラウドのデータの「${key}」が数値ではありません`)
  }
  return value
}

function readStringField(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  if (typeof value !== 'string') {
    throw new Error(`クラウドのデータの「${key}」が文字列ではありません`)
  }
  return value
}

function readListField(data: Record<string, unknown>, key: string): unknown[] {
  const value = data[key]
  if (!Array.isArray(value)) {
    throw new Error(`クラウドのデータの「${key}」が一覧ではありません`)
  }
  return value
}

/** ログイン中の利用者のプロジェクト (users/{uid}/projects) を扱う CloudProjects を作る。 */
export function createUserCloudProjects(uid: string): CloudProjects {
  const { storage, firestore } = getServices()
  const projectsPath = `users/${uid}/projects`
  const audioRef = (projectId: string, fileName: string) => ref(storage, `${projectsPath}/${projectId}/${fileName}`)
  return {
    async listProjects() {
      const snapshot = await getDocs(query(collection(firestore, projectsPath), orderBy('updatedAt', 'desc')))
      return snapshot.docs.map((document): CloudProjectSummary => ({
        id: document.id,
        title: readStringField(document.data(), 'title'),
        updatedAt: readNumberField(document.data(), 'updatedAt'),
      }))
    },
    async listCharts(projectId) {
      const snapshot = await getDocs(collection(firestore, `${projectsPath}/${projectId}/charts`))
      return snapshot.docs
        .map((document): CloudChartSummary => ({ id: document.id, name: readStringField(document.data(), 'name') }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    async readProject(projectId) {
      const snapshot = await getDoc(doc(firestore, projectsPath, projectId))
      const data = snapshot.data()
      if (data === undefined) {
        return null
      }
      const audioFileName = data.audioFileName
      return {
        title: readStringField(data, 'title'),
        audioFileName: typeof audioFileName === 'string' ? audioFileName : null,
        offsetMs: readNumberField(data, 'offsetMs'),
        barCount: readNumberField(data, 'barCount'),
        tempo: readListField(data, 'tempo'),
        meter: readListField(data, 'meter'),
        updatedAt: readNumberField(data, 'updatedAt'),
      } satisfies CloudProjectData
    },
    async readChart(projectId, chartId) {
      const snapshot = await getDoc(doc(firestore, `${projectsPath}/${projectId}/charts`, chartId))
      const data = snapshot.data()
      if (data === undefined) {
        throw new Error('譜面が見つかりません。曲の一覧を開き直してください')
      }
      return {
        name: readStringField(data, 'name'),
        laneCount: readNumberField(data, 'laneCount'),
        notes: readListField(data, 'notes'),
      } satisfies CloudChartData
    },
    async saveProject(input) {
      const projectRef = doc(firestore, projectsPath, input.projectId)
      const chartRef = doc(firestore, `${projectsPath}/${input.projectId}/charts`, input.chartId)
      return runTransaction(firestore, async (transaction) => {
        const existing = (await transaction.get(projectRef)).data()
        const conflict = findSaveConflict(
          typeof existing?.updatedAt === 'number' ? existing.updatedAt : existing === undefined ? null : NaN,
          input.expectedUpdatedAt,
        )
        if (conflict !== null) {
          throw new CloudConflictError(conflict)
        }
        const previousAudio = existing?.audioFileName
        const updatedAt = Math.max(Date.now(), (typeof existing?.updatedAt === 'number' ? existing.updatedAt : 0) + 1)
        transaction.set(projectRef, {
          title: input.project.title,
          audioFileName: input.project.audioFileName ?? (typeof previousAudio === 'string' ? previousAudio : null),
          offsetMs: input.project.offsetMs,
          barCount: input.project.barCount,
          tempo: input.project.tempo,
          meter: input.project.meter,
          updatedAt,
        })
        transaction.set(chartRef, {
          name: input.chart.name,
          laneCount: input.chart.laneCount,
          notes: input.chart.notes,
          updatedAt,
        })
        return updatedAt
      })
    },
    async saveAudio(projectId, fileName, data) {
      await uploadBytes(audioRef(projectId, fileName), data)
    },
    async readAudio(projectId, fileName) {
      return getBytes(audioRef(projectId, fileName))
    },
    async listAudioFiles(projectId) {
      return (await listAll(ref(storage, `${projectsPath}/${projectId}`))).items.map((item) => item.name)
    },
    async deleteAudio(projectId, fileName) {
      await deleteObject(audioRef(projectId, fileName))
    },
  }
}
