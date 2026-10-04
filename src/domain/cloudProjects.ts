/** クラウドに保存した、曲ごとのプロジェクトと、その下の譜面を読み書きする入口。プロジェクトと譜面は Firestore、音源は Storage に置く。 */

/** プロジェクトの一覧の 1 件。 */
export interface CloudProjectSummary {
  readonly id: string
  readonly title: string
  /** 最後に保存した時刻 (ミリ秒)。 */
  readonly updatedAt: number
}

/** 譜面の一覧の 1 件。 */
export interface CloudChartSummary {
  readonly id: string
  readonly name: string
}

/** プロジェクトに保存する内容。譜面ファイルのオフセット、テンポ、拍子と同じ形で持ち、小節数を足す。 */
export interface CloudProjectData {
  readonly title: string
  /** 音源のファイル名。音源がなければ null。 */
  readonly audioFileName: string | null
  readonly offsetMs: number
  readonly barCount: number
  readonly tempo: readonly unknown[]
  readonly meter: readonly unknown[]
  readonly updatedAt: number
}

/** 譜面に保存する内容。ノーツは、書き出す譜面ファイルの notes と同じ形で持つ。 */
export interface CloudChartData {
  readonly name: string
  readonly laneCount: number
  readonly notes: readonly unknown[]
}

/** 保存の内容。 */
export interface SaveProjectInput {
  readonly projectId: string
  readonly chartId: string
  /** プロジェクトの内容。updatedAt は保存のときに付ける。audioFileName が undefined なら、保存済みの音源のファイル名を変えない。 */
  readonly project: Omit<CloudProjectData, 'updatedAt' | 'audioFileName'> & { readonly audioFileName?: string }
  readonly chart: CloudChartData
  /** 読み込んだ、または保存した時点の更新時刻。クラウドにまだない新しいプロジェクトなら null。 */
  readonly expectedUpdatedAt: number | null
}

/** 他で更新された、または同じ名前のプロジェクトが既にあって、保存できなかったときの例外。 */
export class CloudConflictError extends Error {}

const SAME_TITLE_CONFLICT_MESSAGE =
  '同じ曲名のプロジェクトが、クラウドに既にあります。「クラウドから開く」で開くか、別の曲名にしてください'
const UPDATED_ELSEWHERE_CONFLICT_MESSAGE =
  'このプロジェクトは、読み込んだあとに、ほかで更新されました。「クラウドから開く」で開き直してください'

/**
 * 保存が、ほかのプロジェクトや、ほかでの更新を上書きしてしまわないか調べる。上書きしてしまうなら、その理由の文言を返す。
 * existingUpdatedAt はクラウドにあるプロジェクトの更新時刻 (なければ null)、expectedUpdatedAt は読み込んだ、または保存した時点の更新時刻 (なければ null)。
 */
export function findSaveConflict(existingUpdatedAt: number | null, expectedUpdatedAt: number | null): string | null {
  if (existingUpdatedAt === null) {
    return null
  }
  if (expectedUpdatedAt === null) {
    return SAME_TITLE_CONFLICT_MESSAGE
  }
  return existingUpdatedAt === expectedUpdatedAt ? null : UPDATED_ELSEWHERE_CONFLICT_MESSAGE
}

export interface CloudProjects {
  /** プロジェクトを、更新が新しい順に返す。 */
  listProjects(): Promise<CloudProjectSummary[]>
  /** プロジェクトの下の譜面を、譜面名の順に返す。 */
  listCharts(projectId: string): Promise<CloudChartSummary[]>
  /** プロジェクトを読む。なければ null。 */
  readProject(projectId: string): Promise<CloudProjectData | null>
  /** 譜面を読む。 */
  readChart(projectId: string, chartId: string): Promise<CloudChartData>
  /** プロジェクトと譜面を、まとめて 1 回で保存し、保存した時刻を返す。更新時刻が食い違えば CloudConflictError を投げる。 */
  saveProject(input: SaveProjectInput): Promise<number>
  /** 音源を保存する。同じ名前の音源は置き換える。 */
  saveAudio(projectId: string, fileName: string, data: Blob): Promise<void>
  /** 音源を読む。 */
  readAudio(projectId: string, fileName: string): Promise<ArrayBuffer>
  /** プロジェクトの音源のファイル名を返す。 */
  listAudioFiles(projectId: string): Promise<string[]>
  /** 音源を削除する。 */
  deleteAudio(projectId: string, fileName: string): Promise<void>
}

function toBase64Url(text: string): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(text))
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

/** 曲名から、プロジェクトの識別子を作る。同じ曲名は同じ識別子になる。 */
export function createProjectId(title: string): string {
  return `p${toBase64Url(title)}`
}

/** 譜面名から、譜面の識別子を作る。同じ譜面名は同じ識別子になる。 */
export function createChartId(name: string): string {
  return `c${toBase64Url(name)}`
}
