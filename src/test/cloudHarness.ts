import { createChartId, createProjectId } from '../domain/cloudProjects.ts'

export interface CloudProjectSeed {
  readonly title: string
  readonly audioFileName?: string | null
  readonly offsetMs?: number
  readonly barCount?: number
  readonly tempo?: readonly unknown[]
  readonly meter?: readonly unknown[]
  readonly updatedAt?: number
}

export interface CloudChartSeed {
  readonly name: string
  readonly laneCount?: number
  readonly notes?: readonly unknown[]
  readonly updatedAt?: number
}

export interface CloudProjectRecord {
  readonly title: string
  readonly audioFileName: string | null
  readonly offsetMs: number
  readonly barCount: number
  readonly tempo: readonly unknown[]
  readonly meter: readonly unknown[]
  readonly updatedAt: number
}

export interface CloudChartRecord {
  readonly name: string
  readonly laneCount: number
  readonly notes: readonly unknown[]
  readonly updatedAt: number
}

export function buildProjectRecord({
  title,
  audioFileName = null,
  offsetMs = 0,
  barCount = 50,
  tempo = [{ tick: 0, bpm: 120 }],
  meter = [{ tick: 0, num: 4, den: 4 }],
  updatedAt = 1000,
}: CloudProjectSeed): CloudProjectRecord {
  return { title, audioFileName, offsetMs, barCount, tempo, meter, updatedAt }
}

export function buildChartRecord({
  name,
  laneCount = 5,
  notes = [],
  updatedAt = 1000,
}: CloudChartSeed): CloudChartRecord {
  return { name, laneCount, notes, updatedAt }
}

export function projectPath(uid: string, songName: string): string {
  return `users/${uid}/projects/${createProjectId(songName)}`
}

export function chartPath(uid: string, songName: string, chartName: string): string {
  return `${projectPath(uid, songName)}/charts/${createChartId(chartName)}`
}

export function audioPath(uid: string, songName: string, fileName: string): string {
  return `${projectPath(uid, songName)}/${fileName}`
}

export interface CloudHarness {
  currentUid(): string | null
  signIn(name: string): Promise<void>
  signOut(): Promise<void>
  putProject(seed: CloudProjectSeed): Promise<void>
  putChart(songName: string, seed: CloudChartSeed): Promise<void>
  putAudio(songName: string, fileName: string, content: Uint8Array): Promise<void>
  readProject(songName: string): Promise<CloudProjectRecord | null>
  readChart(songName: string, chartName: string): Promise<CloudChartRecord | null>
  readAudio(songName: string, fileName: string): Promise<Uint8Array>
  listProjects(): Promise<string[]>
  listCharts(songName: string): Promise<string[]>
  listAudioFiles(songName: string): Promise<string[]>
  removeProject(songName: string): Promise<void>
  removeAudio(songName: string, fileName: string): Promise<void>
}

export type CloudOperation =
  | 'firestore-read'
  | 'firestore-list'
  | 'firestore-write'
  | 'storage-read'
  | 'storage-list'
  | 'storage-write'
  | 'storage-delete'

export interface CloudTarget {
  readonly songName?: string
  readonly chartName?: string
  readonly fileName?: string
}

export interface CloudFailure {
  readonly code: string
  readonly message?: string
}

export interface PendingOperation {
  release(): void
}

export interface PendingSignIn {
  succeed(uid?: string): void
  fail(error: Error): void
}

export interface CloudFaults {
  failSignIn(error: Error): void
  pendSignIn(): PendingSignIn[]
  allowSignIn(uid?: string): void
  failSignOut(error: Error): void
  allowSignOut(): void
  denyOperation(operation: CloudOperation, target?: CloudTarget): void
  failOperation(operation: CloudOperation, failure: CloudFailure, target?: CloudTarget): void
  pendOperation(operation: CloudOperation, target?: CloudTarget): PendingOperation[]
  allowOperation(operation: CloudOperation): void
}
