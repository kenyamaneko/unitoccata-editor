import { FirebaseError } from 'firebase/app'
import type { User } from 'firebase/auth'
import { createChartId, createProjectId } from '../domain/cloudProjects.ts'
import {
  audioPath,
  buildChartRecord,
  buildProjectRecord,
  chartPath,
  projectPath,
  type CloudChartRecord,
  type CloudFailure,
  type CloudFaults,
  type CloudHarness,
  type CloudOperation,
  type CloudProjectRecord,
  type CloudTarget,
  type PendingOperation,
  type PendingSignIn,
} from './cloudHarness.ts'
import { failWith } from './failures.ts'
import { discardSharedState, getSharedState } from './sharedState.ts'

const CLOUD_KEY = 'cloud'
const DEFAULT_UID = 'test-user'
const PERMISSION_DENIED_CODES: Readonly<Record<CloudOperation, string>> = {
  'firestore-read': 'permission-denied',
  'firestore-list': 'permission-denied',
  'firestore-write': 'permission-denied',
  'storage-read': 'storage/unauthorized',
  'storage-list': 'storage/unauthorized',
  'storage-write': 'storage/unauthorized',
  'storage-delete': 'storage/unauthorized',
}

type AuthListener = (user: User | null) => void

type FaultBehavior =
  | { readonly kind: 'fail'; readonly failure: CloudFailure }
  | { readonly kind: 'pend'; readonly held: PendingOperation[] }

interface FaultRule {
  readonly operation: CloudOperation
  readonly target: CloudTarget
  readonly behavior: FaultBehavior
}

interface Location {
  readonly projectId: string | null
  readonly chartId: string | null
  readonly fileName: string | null
}

interface CloudWorld {
  uid: string | null
  readonly listeners: Set<AuthListener>
  readonly documents: Map<string, unknown>
  readonly files: Map<string, Uint8Array>
  rules: FaultRule[]
  signInMode: { kind: 'succeed'; uid: string } | { kind: 'fail'; error: Error } | { kind: 'pend' }
  readonly pendingSignIns: PendingSignIn[]
  signOutError: Error | null
}

function createCloudWorld(): CloudWorld {
  return {
    uid: null,
    listeners: new Set(),
    documents: new Map(),
    files: new Map(),
    rules: [],
    signInMode: { kind: 'succeed', uid: DEFAULT_UID },
    pendingSignIns: [],
    signOutError: null,
  }
}

function getCloudWorld(): CloudWorld {
  return getSharedState(CLOUD_KEY, createCloudWorld)
}

export function resetCloudWorld(): void {
  discardSharedState(CLOUD_KEY)
}

export function createFirebaseError(code: string, message = code): FirebaseError {
  return new FirebaseError(code, message)
}

function createUser(uid: string): User {
  return { uid } as User
}

function setSignedInUid(world: CloudWorld, uid: string | null): void {
  world.uid = uid
  const user = uid === null ? null : createUser(uid)
  for (const listener of world.listeners) {
    listener(user)
  }
}

function requireUid(world: CloudWorld): string {
  return world.uid ?? failWith(new Error('ログインしていないため、保存先を指せません'))
}

function toDocumentLocation(path: string): Location {
  const parts = path.split('/')
  return { projectId: parts[3] ?? null, chartId: parts[5] ?? null, fileName: null }
}

function toFileLocation(path: string): Location {
  const parts = path.split('/')
  return { projectId: parts[3] ?? null, chartId: null, fileName: parts[4] ?? null }
}

function matchesTarget(target: CloudTarget, location: Location): boolean {
  return (
    (target.songName === undefined || createProjectId(target.songName) === location.projectId) &&
    (target.chartName === undefined || createChartId(target.chartName) === location.chartId) &&
    (target.fileName === undefined || target.fileName === location.fileName)
  )
}

function passGate(operation: CloudOperation, locations: readonly Location[]): Promise<void> {
  const behavior = getCloudWorld().rules.find(
    (rule) => rule.operation === operation && locations.some((location) => matchesTarget(rule.target, location)),
  )?.behavior
  return behavior === undefined
    ? Promise.resolve()
    : behavior.kind === 'fail'
      ? Promise.reject(createFirebaseError(behavior.failure.code, behavior.failure.message ?? behavior.failure.code))
      : new Promise<void>((resolve) => {
          behavior.held.push({ release: resolve })
        })
}

function listChildPaths(paths: Iterable<string>, folder: string): string[] {
  return [...paths].filter((path) => path.startsWith(`${folder}/`) && !path.slice(folder.length + 1).includes('/'))
}

function lastSegment(path: string): string {
  return path.split('/').at(-1) ?? ''
}

function toStoredData(data: unknown): unknown {
  return JSON.parse(
    JSON.stringify(data, (_key, value: unknown) =>
      value === undefined ? failWith(new Error('Unsupported field value: undefined')) : value,
    ),
  ) as unknown
}

function toBytes(content: Uint8Array): Uint8Array {
  return new Uint8Array(content)
}

function readDocument<T>(world: CloudWorld, path: string): T | null {
  return (world.documents.get(path) as T | undefined) ?? null
}

function readSortedNames(world: CloudWorld, folder: string, field: 'title' | 'name'): string[] {
  return listChildPaths(world.documents.keys(), folder)
    .map((path) => (readDocument<Record<string, string>>(world, path) ?? {})[field] ?? '')
    .toSorted((a, b) => a.localeCompare(b))
}

function readSortedFileNames(world: CloudWorld, folder: string): string[] {
  return listChildPaths(world.files.keys(), folder).map(lastSegment).toSorted()
}

export function createFakeCloudHarness(): CloudHarness {
  const world = getCloudWorld()
  const uid = (): string => requireUid(world)
  return {
    currentUid: () => world.uid,
    signIn: async (name) => setSignedInUid(world, name),
    signOut: async () => setSignedInUid(world, null),
    putProject: async (seed) => {
      world.documents.set(projectPath(uid(), seed.title), toStoredData(buildProjectRecord(seed)))
    },
    putChart: async (songName, seed) => {
      world.documents.set(chartPath(uid(), songName, seed.name), toStoredData(buildChartRecord(seed)))
    },
    putAudio: async (songName, fileName, content) => {
      world.files.set(audioPath(uid(), songName, fileName), toBytes(content))
    },
    readProject: async (songName) => readDocument<CloudProjectRecord>(world, projectPath(uid(), songName)),
    readChart: async (songName, chartName) =>
      readDocument<CloudChartRecord>(world, chartPath(uid(), songName, chartName)),
    readAudio: async (songName, fileName) =>
      toBytes(
        world.files.get(audioPath(uid(), songName, fileName)) ??
          failWith(new Error(`保存先に音源がありません: ${songName}/${fileName}`)),
      ),
    listProjects: async () => readSortedNames(world, `users/${uid()}/projects`, 'title'),
    listCharts: async (songName) => readSortedNames(world, `${projectPath(uid(), songName)}/charts`, 'name'),
    listAudioFiles: async (songName) => readSortedFileNames(world, projectPath(uid(), songName)),
    removeProject: async (songName) => {
      world.documents.delete(projectPath(uid(), songName))
    },
    removeAudio: async (songName, fileName) => {
      world.files.delete(audioPath(uid(), songName, fileName))
    },
  }
}

export function createCloudFaults(): CloudFaults {
  const world = getCloudWorld()
  const addRule = (operation: CloudOperation, behavior: FaultBehavior, target: CloudTarget = {}): void => {
    world.rules.push({ operation, target, behavior })
  }
  return {
    failSignIn: (error) => {
      world.signInMode = { kind: 'fail', error }
    },
    pendSignIn: () => {
      world.signInMode = { kind: 'pend' }
      return world.pendingSignIns
    },
    allowSignIn: (uid = DEFAULT_UID) => {
      world.signInMode = { kind: 'succeed', uid }
    },
    failSignOut: (error) => {
      world.signOutError = error
    },
    allowSignOut: () => {
      world.signOutError = null
    },
    denyOperation: (operation, target) =>
      addRule(
        operation,
        {
          kind: 'fail',
          failure: {
            code: PERMISSION_DENIED_CODES[operation],
            message: 'この操作への権限がありません (テストが起こした故障)',
          },
        },
        target,
      ),
    failOperation: (operation, failure, target) => addRule(operation, { kind: 'fail', failure }, target),
    pendOperation: (operation, target) => {
      const held: PendingOperation[] = []
      addRule(operation, { kind: 'pend', held }, target)
      return held
    },
    allowOperation: (operation) => {
      world.rules = world.rules.filter((rule) => rule.operation !== operation)
    },
  }
}

const FAKE_AUTH = { currentUser: null }
const FAKE_STORAGE = {}
const FAKE_FIRESTORE = {}

export function createFakeAuthModule(): Record<string, unknown> {
  return {
    getAuth: () => FAKE_AUTH,
    connectAuthEmulator: () => undefined,
    GoogleAuthProvider: class GoogleAuthProvider {},
    onAuthStateChanged: (_auth: unknown, listener: AuthListener) => {
      const { uid } = getCloudWorld()
      getCloudWorld().listeners.add(listener)
      listener(uid === null ? null : createUser(uid))
      return () => {
        getCloudWorld().listeners.delete(listener)
      }
    },
    signInWithPopup: () => {
      const mode = getCloudWorld().signInMode
      return mode.kind === 'succeed'
        ? Promise.resolve(setSignedInUid(getCloudWorld(), mode.uid)).then(() => ({ user: createUser(mode.uid) }))
        : mode.kind === 'fail'
          ? Promise.reject(mode.error)
          : new Promise<string>((resolve, reject) => {
              getCloudWorld().pendingSignIns.push({
                succeed: (uid = DEFAULT_UID) => resolve(uid),
                fail: (error) => reject(error),
              })
            }).then((uid) => {
              setSignedInUid(getCloudWorld(), uid)
              return { user: createUser(uid) }
            })
    },
    signOut: () => {
      const { signOutError } = getCloudWorld()
      return signOutError === null
        ? Promise.resolve(setSignedInUid(getCloudWorld(), null))
        : Promise.reject(signOutError)
    },
  }
}

interface FakeStorageReference {
  readonly fullPath: string
  readonly name: string
}

export function createFakeStorageModule(): Record<string, unknown> {
  return {
    getStorage: () => FAKE_STORAGE,
    connectStorageEmulator: () => undefined,
    ref: (_storage: unknown, path: string): FakeStorageReference => ({ fullPath: path, name: lastSegment(path) }),
    listAll: async (reference: FakeStorageReference) => {
      await passGate('storage-list', [toFileLocation(reference.fullPath)])
      return {
        prefixes: [],
        items: listChildPaths(getCloudWorld().files.keys(), reference.fullPath).map((path) => ({
          name: lastSegment(path),
        })),
      }
    },
    uploadBytes: async (reference: FakeStorageReference, data: Blob | Uint8Array) => {
      await passGate('storage-write', [toFileLocation(reference.fullPath)])
      const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data
      getCloudWorld().files.set(reference.fullPath, toBytes(bytes))
      return { ref: reference }
    },
    deleteObject: async (reference: FakeStorageReference) => {
      await passGate('storage-delete', [toFileLocation(reference.fullPath)])
      getCloudWorld().files.delete(reference.fullPath)
    },
    getBytes: async (reference: FakeStorageReference) => {
      await passGate('storage-read', [toFileLocation(reference.fullPath)])
      const bytes =
        getCloudWorld().files.get(reference.fullPath) ??
        failWith(
          createFirebaseError(
            'storage/object-not-found',
            `Firebase Storage: Object '${reference.fullPath}' does not exist. (storage/object-not-found)`,
          ),
        )
      return toBytes(bytes).buffer
    },
  }
}

interface FakeCollectionReference {
  readonly kind: 'collection'
  readonly path: string
}

interface FakeDocumentReference {
  readonly kind: 'document'
  readonly path: string
  readonly id: string
}

interface FakeOrdering {
  readonly kind: 'orderBy'
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

interface FakeQuery {
  readonly kind: 'query'
  readonly collection: FakeCollectionReference
  readonly orderings: readonly FakeOrdering[]
}

function joinPath(path: string, segments: readonly string[]): string {
  return [path, ...segments].join('/')
}

function snapshotOf(path: string) {
  const stored = getCloudWorld().documents.get(path)
  return {
    id: lastSegment(path),
    exists: () => stored !== undefined,
    data: () => (stored === undefined ? undefined : (structuredClone(stored) as Record<string, unknown>)),
  }
}

function compareValues(a: unknown, b: unknown): number {
  return a === b ? 0 : (a as number | string) < (b as number | string) ? -1 : 1
}

function compareByOrderings(orderings: readonly FakeOrdering[], a: string, b: string): number {
  const world = getCloudWorld()
  const dataOf = (path: string) => (world.documents.get(path) ?? {}) as Record<string, unknown>
  return orderings.reduce(
    (result, { field, direction }) =>
      result !== 0 ? result : compareValues(dataOf(a)[field], dataOf(b)[field]) * (direction === 'desc' ? -1 : 1),
    0,
  )
}

export function createFakeFirestoreModule(): Record<string, unknown> {
  return {
    getFirestore: () => FAKE_FIRESTORE,
    connectFirestoreEmulator: () => undefined,
    collection: (_firestore: unknown, path: string, ...segments: string[]): FakeCollectionReference => ({
      kind: 'collection',
      path: joinPath(path, segments),
    }),
    doc: (_firestore: unknown, path: string, ...segments: string[]): FakeDocumentReference => {
      const fullPath = joinPath(path, segments)
      return { kind: 'document', path: fullPath, id: lastSegment(fullPath) }
    },
    orderBy: (field: string, direction: 'asc' | 'desc' = 'asc'): FakeOrdering => ({
      kind: 'orderBy',
      field,
      direction,
    }),
    query: (collection: FakeCollectionReference, ...orderings: FakeOrdering[]): FakeQuery => ({
      kind: 'query',
      collection,
      orderings,
    }),
    getDoc: async (reference: FakeDocumentReference) => {
      await passGate('firestore-read', [toDocumentLocation(reference.path)])
      return snapshotOf(reference.path)
    },
    getDocs: async (source: FakeCollectionReference | FakeQuery) => {
      const collection = source.kind === 'query' ? source.collection : source
      const orderings = source.kind === 'query' ? source.orderings : []
      await passGate('firestore-list', [toDocumentLocation(collection.path)])
      const documents = listChildPaths(getCloudWorld().documents.keys(), collection.path)
        .filter((path) =>
          orderings.every(({ field }) => field in ((getCloudWorld().documents.get(path) ?? {}) as object)),
        )
        .toSorted((a, b) => compareByOrderings(orderings, a, b) || compareValues(lastSegment(a), lastSegment(b)))
        .map(snapshotOf)
      return { docs: documents, size: documents.length, empty: documents.length === 0 }
    },
    runTransaction: async <T>(
      _firestore: unknown,
      update: (transaction: {
        get: (reference: FakeDocumentReference) => Promise<ReturnType<typeof snapshotOf>>
        set: (reference: FakeDocumentReference, data: unknown) => unknown
      }) => Promise<T>,
    ): Promise<T> => {
      const staged = new Map<string, unknown>()
      const transaction = {
        get: async (reference: FakeDocumentReference) => {
          await passGate('firestore-read', [toDocumentLocation(reference.path)])
          return snapshotOf(reference.path)
        },
        set: (reference: FakeDocumentReference, data: unknown) => {
          staged.set(reference.path, toStoredData(data))
          return transaction
        },
      }
      const result = await update(transaction)
      await passGate(
        'firestore-write',
        [...staged.keys()].map((path) => toDocumentLocation(path)),
      )
      for (const [path, data] of staged) {
        getCloudWorld().documents.set(path, data)
      }
      return result
    },
  }
}
