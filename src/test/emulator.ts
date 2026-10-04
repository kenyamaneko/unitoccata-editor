import { randomUUID } from 'node:crypto'
import { deleteApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  type Firestore,
} from 'firebase/firestore'
import {
  connectStorageEmulator,
  deleteObject,
  getBytes,
  getStorage,
  listAll,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage'
import {
  audioPath,
  buildChartRecord,
  buildProjectRecord,
  chartPath,
  projectPath,
  type CloudChartRecord,
  type CloudHarness,
  type CloudProjectRecord,
} from './cloudHarness.ts'
import { failWith } from './failures.ts'
import { getSharedState } from './sharedState.ts'

const EMULATOR_HOST = '127.0.0.1'
const ADMIN_TOKEN = 'owner'
const TEST_PASSWORD = 'test-password'
const UNIQUE_SUFFIX_LENGTH = 12

interface TestAccount {
  readonly email: string
  readonly uid: string
}

interface CaseRecords {
  readonly uids: Set<string>
  readonly writtenDocumentPaths: Set<string>
  readonly accounts: Map<string, TestAccount>
}

const RECORDS_KEY = 'emulator.caseRecords'

function getCaseRecords(): CaseRecords {
  return getSharedState<CaseRecords>(RECORDS_KEY, () => ({
    uids: new Set(),
    writtenDocumentPaths: new Set(),
    accounts: new Map(),
  }))
}

function createUniqueSuffix(): string {
  return randomUUID().replaceAll('-', '').slice(0, UNIQUE_SUFFIX_LENGTH)
}

export function createCaseUid(name: string): string {
  const uid = `${name}-${createUniqueSuffix()}`
  getCaseRecords().uids.add(uid)
  return uid
}

function readEmulatorHost(variable: string): { readonly host: string; readonly port: number } {
  const value =
    process.env[variable] ||
    failWith(new Error(`環境変数 ${variable} がありません。結合テストは npm run test:integration で実行してください`))
  const [host = EMULATOR_HOST, port = ''] = value.split(':')
  return { host, port: Number(port) }
}

function readProjectId(): string {
  return process.env.TEST_EMULATOR_PROJECT_ID || failWith(new Error('環境変数 TEST_EMULATOR_PROJECT_ID がありません'))
}

export function getAuthEmulator(): { readonly host: string; readonly port: number } {
  return readEmulatorHost('FIREBASE_AUTH_EMULATOR_HOST')
}

function getStorageEmulator(): { readonly host: string; readonly port: number } {
  return readEmulatorHost('FIREBASE_STORAGE_EMULATOR_HOST')
}

function getFirestoreEmulator(): { readonly host: string; readonly port: number } {
  return readEmulatorHost('FIRESTORE_EMULATOR_HOST')
}

let nextAppSerial = 1

type MockUserToken = string | { readonly sub: string } | null

function createEmulatorApp(kind: string): FirebaseApp {
  return initializeApp(
    { apiKey: 'demo-api-key', projectId: readProjectId(), storageBucket: `${readProjectId()}.appspot.com` },
    `emulator-${kind}-${nextAppSerial++}`,
  )
}

function createStorage(mockUserToken: MockUserToken): FirebaseStorage {
  const storage = getStorage(createEmulatorApp('storage'))
  const { host, port } = getStorageEmulator()
  connectStorageEmulator(storage, host, port, mockUserToken === null ? undefined : { mockUserToken })
  return storage
}

function createFirestore(mockUserToken: MockUserToken): Firestore {
  const firestore = getFirestore(createEmulatorApp('firestore'))
  const { host, port } = getFirestoreEmulator()
  connectFirestoreEmulator(firestore, host, port, mockUserToken === null ? undefined : { mockUserToken })
  return firestore
}

export interface StorageActor {
  listFiles(path: string): Promise<string[]>
  read(path: string): Promise<Uint8Array>
  write(path: string, content: Uint8Array): Promise<void>
  remove(path: string): Promise<void>
}

export interface FirestoreActor {
  get(path: string): Promise<Record<string, unknown> | undefined>
  set(path: string, data: Record<string, unknown>): Promise<void>
  delete(path: string): Promise<void>
}

function createStorageActor(storage: FirebaseStorage): StorageActor {
  return {
    listFiles: async (path) => (await listAll(ref(storage, path))).items.map((item) => item.name),
    read: async (path) => new Uint8Array(await getBytes(ref(storage, path))),
    write: async (path, content) => {
      await uploadBytes(ref(storage, path), new Uint8Array(content))
    },
    remove: (path) => deleteObject(ref(storage, path)),
  }
}

function createFirestoreActor(firestore: Firestore): FirestoreActor {
  return {
    get: async (path) => (await getDoc(doc(firestore, path))).data(),
    set: async (path, data) => {
      getCaseRecords().writtenDocumentPaths.add(path)
      await setDoc(doc(firestore, path), data)
    },
    delete: (path) => deleteDoc(doc(firestore, path)),
  }
}

export interface CloudActor {
  readonly storage: StorageActor
  readonly firestore: FirestoreActor
}

export function actAsUser(uid: string): CloudActor {
  return {
    storage: createStorageActor(createStorage({ sub: uid })),
    firestore: createFirestoreActor(createFirestore({ sub: uid })),
  }
}

export function actAsAnonymous(): CloudActor {
  return {
    storage: createStorageActor(createStorage(null)),
    firestore: createFirestoreActor(createFirestore(null)),
  }
}

export function actAsAdmin(): CloudActor {
  return {
    storage: createStorageActor(createStorage(ADMIN_TOKEN)),
    firestore: createFirestoreActor(createFirestore(ADMIN_TOKEN)),
  }
}

async function deleteFolder(storage: FirebaseStorage, path: string): Promise<void> {
  const { items, prefixes } = await listAll(ref(storage, path))
  await Promise.all([
    ...items.map((item) => deleteObject(item)),
    ...prefixes.map((prefix) => deleteFolder(storage, prefix.fullPath)),
  ])
}

async function deleteUserDocuments(firestore: Firestore, uid: string): Promise<void> {
  const projects = await getDocs(collection(firestore, `users/${uid}/projects`))
  await Promise.all(
    projects.docs.map(async (project) => {
      const charts = await getDocs(collection(firestore, `${project.ref.path}/charts`))
      await Promise.all(charts.docs.map((chart) => deleteDoc(chart.ref)))
      await deleteDoc(project.ref)
    }),
  )
}

async function deleteAuthAccount(uid: string): Promise<void> {
  const auth = getAuthEmulator()
  const response = await fetch(
    `http://${auth.host}:${auth.port}/identitytoolkit.googleapis.com/v1/projects/${readProjectId()}/accounts:delete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ localId: uid }),
    },
  )
  return response.ok
    ? undefined
    : failWith(new Error(`Auth エミュレータの利用者 ${uid} を消せませんでした: ${response.status}`))
}

export async function removeCaseData(): Promise<void> {
  const records = getCaseRecords()
  const accounts = [...records.accounts.values()]
  const uids = new Set([...records.uids, ...accounts.map(({ uid }) => uid)])
  const documentPaths = [...records.writtenDocumentPaths]
  records.uids.clear()
  records.writtenDocumentPaths.clear()
  records.accounts.clear()
  const storage = createStorage(ADMIN_TOKEN)
  const firestore = createFirestore(ADMIN_TOKEN)
  await Promise.all([
    ...documentPaths.map((path) => deleteDoc(doc(firestore, path))),
    ...[...uids].map(async (uid) => {
      await deleteFolder(storage, `users/${uid}`)
      await deleteUserDocuments(firestore, uid)
    }),
    ...accounts.map(({ uid }) => deleteAuthAccount(uid)),
  ])
}

export async function disposeEmulatorApps(): Promise<void> {
  await Promise.all(getApps().map((app) => deleteApp(app)))
}

const DEFAULT_APP_NAME = '[DEFAULT]'

function getAppConfig(): FirebaseOptions {
  const env = import.meta.env
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: env.VITE_FIREBASE_APP_ID,
  }
}

function findDefaultApp(): FirebaseApp | undefined {
  return getApps().find((app) => app.name === DEFAULT_APP_NAME)
}

function sortedLocale(names: string[]): string[] {
  return names.toSorted((a, b) => a.localeCompare(b))
}

export function createEmulatorCloudHarness(): CloudHarness {
  const storage = createStorage(ADMIN_TOKEN)
  const firestore = createFirestore(ADMIN_TOKEN)
  const admin = { storage: createStorageActor(storage), firestore: createFirestoreActor(firestore) }
  const currentUid = (): string | null => {
    const app = findDefaultApp()
    return app === undefined ? null : (getAuth(app).currentUser?.uid ?? null)
  }
  const uid = (): string => currentUid() ?? failWith(new Error('ログインしていないため、保存先を指せません'))
  const readRecord = async <T>(path: string): Promise<T | null> =>
    ((await admin.firestore.get(path)) as T | undefined) ?? null
  const listNames = async (path: string, field: string): Promise<string[]> =>
    sortedLocale(
      (await getDocs(collection(firestore, path))).docs.map((document) => String(document.data()[field] ?? '')),
    )
  return {
    currentUid,
    signIn: async (name) => {
      const auth = getAuth(initializeApp(getAppConfig()))
      const { host, port } = getAuthEmulator()
      connectAuthEmulator(auth, `http://${host}:${port}`, { disableWarnings: true })
      const { accounts } = getCaseRecords()
      const known = accounts.get(name)
      const email = known?.email ?? `${name}-${createUniqueSuffix()}@example.com`
      await (known === undefined
        ? createUserWithEmailAndPassword(auth, email, TEST_PASSWORD).then(({ user }) => {
            accounts.set(name, { email, uid: user.uid })
          })
        : signInWithEmailAndPassword(auth, email, TEST_PASSWORD))
    },
    signOut: async () => {
      const app = findDefaultApp()
      await (app === undefined ? undefined : getAuth(app).signOut())
    },
    putProject: (seed) => admin.firestore.set(projectPath(uid(), seed.title), { ...buildProjectRecord(seed) }),
    putChart: (songName, seed) =>
      admin.firestore.set(chartPath(uid(), songName, seed.name), { ...buildChartRecord(seed) }),
    putAudio: (songName, fileName, content) => admin.storage.write(audioPath(uid(), songName, fileName), content),
    readProject: (songName) => readRecord<CloudProjectRecord>(projectPath(uid(), songName)),
    readChart: (songName, chartName) => readRecord<CloudChartRecord>(chartPath(uid(), songName, chartName)),
    readAudio: (songName, fileName) => admin.storage.read(audioPath(uid(), songName, fileName)),
    listProjects: () => listNames(`users/${uid()}/projects`, 'title'),
    listCharts: (songName) => listNames(`${projectPath(uid(), songName)}/charts`, 'name'),
    listAudioFiles: async (songName) => (await admin.storage.listFiles(projectPath(uid(), songName))).toSorted(),
    removeProject: (songName) => admin.firestore.delete(projectPath(uid(), songName)),
    removeAudio: (songName, fileName) => admin.storage.remove(audioPath(uid(), songName, fileName)),
  }
}
