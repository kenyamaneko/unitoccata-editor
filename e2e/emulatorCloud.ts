import { EMULATOR_PROJECT_ID } from './environment.ts'

const AUTH_EMULATOR_ORIGIN = 'http://127.0.0.1:47099'
const FIRESTORE_EMULATOR_ORIGIN = 'http://127.0.0.1:47299'
const STORAGE_EMULATOR_ORIGIN = 'http://127.0.0.1:47199'
const ADMIN_HEADERS = { Authorization: 'Bearer owner' }
const FIRESTORE_DOCUMENTS_ROOT = `projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`

type FirestoreFields = Readonly<Record<string, Readonly<Record<string, unknown>>>>

interface FirestoreDocument {
  readonly name: string
  readonly fields?: FirestoreFields
}

/** Firestore エミュレータのドキュメント。パスと、読み取った値を持つ。 */
export interface CloudDocument {
  readonly path: string
  readonly data: Readonly<Record<string, unknown>>
}

function fail(message: string): never {
  throw new Error(message)
}

const FIRESTORE_VALUE_DECODERS: Readonly<Record<string, (raw: never) => unknown>> = {
  stringValue: (raw: string) => raw,
  integerValue: (raw: string) => Number(raw),
  doubleValue: (raw: number) => raw,
  booleanValue: (raw: boolean) => raw,
  nullValue: () => null,
  mapValue: (raw: { fields?: FirestoreFields }) => decodeFields(raw.fields ?? {}),
  arrayValue: (raw: { values?: readonly Readonly<Record<string, unknown>>[] }) => (raw.values ?? []).map(decodeValue),
}

function decodeValue(value: Readonly<Record<string, unknown>>): unknown {
  const [kind, raw] = Object.entries(value).at(0) ?? fail('Firestore の値が空です')
  const decode = FIRESTORE_VALUE_DECODERS[kind] ?? fail(`未対応の Firestore の値の種類です: ${kind}`)
  return decode(raw as never)
}

function decodeFields(fields: FirestoreFields): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, decodeValue(value)]))
}

async function fetchAsAdmin(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, { ...init, headers: { ...ADMIN_HEADERS, ...init.headers } })
  return response.ok ? response : fail(`エミュレータへの要求が失敗しました: ${response.status} ${url}`)
}

/** Auth エミュレータで、メールアドレスの利用者の uid を調べる。 */
export async function lookUpUid(email: string): Promise<string> {
  const response = await fetchAsAdmin(
    `${AUTH_EMULATOR_ORIGIN}/identitytoolkit.googleapis.com/v1/projects/${EMULATOR_PROJECT_ID}/accounts:lookup`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: [email] }) },
  )
  const { users } = (await response.json()) as { users: readonly { localId: string }[] }
  return (users.at(0) ?? fail(`Auth エミュレータに ${email} の利用者がありません`)).localId
}

async function listDocuments(collectionPath: string): Promise<readonly CloudDocument[]> {
  const response = await fetchAsAdmin(`${FIRESTORE_EMULATOR_ORIGIN}/v1/${FIRESTORE_DOCUMENTS_ROOT}/${collectionPath}`)
  const { documents = [] } = (await response.json()) as { documents?: readonly FirestoreDocument[] }
  return documents.map((document) => ({
    path: document.name.slice(`${FIRESTORE_DOCUMENTS_ROOT}/`.length),
    data: decodeFields(document.fields ?? {}),
  }))
}

async function findDocumentNamed(collectionPath: string, field: string, name: string): Promise<CloudDocument> {
  const documents = await listDocuments(collectionPath)
  return (
    documents.find((document) => document.data[field] === name) ??
    fail(`${collectionPath} に ${field} が「${name}」のドキュメントがありません`)
  )
}

/** 利用者のプロジェクトのうち、曲名が一致するものを返す。 */
export function findCloudProject(uid: string, songName: string): Promise<CloudDocument> {
  return findDocumentNamed(`users/${uid}/projects`, 'title', songName)
}

/** プロジェクトの譜面のうち、譜面名が一致するものを返す。 */
export function findCloudChart(project: CloudDocument, chartName: string): Promise<CloudDocument> {
  return findDocumentNamed(`${project.path}/charts`, 'name', chartName)
}

/** Storage エミュレータから、プロジェクトの音源ファイルを読む。 */
export async function readCloudAudio(project: CloudDocument, fileName: string): Promise<Buffer> {
  const objectPath = encodeURIComponent(`${project.path}/${fileName}`)
  const response = await fetchAsAdmin(
    `${STORAGE_EMULATOR_ORIGIN}/v0/b/${EMULATOR_PROJECT_ID}.appspot.com/o/${objectPath}?alt=media`,
  )
  return Buffer.from(await response.arrayBuffer())
}
