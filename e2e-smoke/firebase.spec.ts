import { expect, test } from '@playwright/test'
import { requireEnvironmentVariable } from './smokeEnvironment.ts'

const FIRESTORE_ORIGIN = 'https://firestore.googleapis.com'
const STORAGE_ORIGIN = 'https://firebasestorage.googleapis.com'
const HTTP_FORBIDDEN = 403
const HTTP_UNAUTHORIZED = 401

function firestoreProjectsUrl(): string {
  const projectId = requireEnvironmentVariable('SMOKE_FIREBASE_PROJECT_ID')
  return `${FIRESTORE_ORIGIN}/v1/projects/${projectId}/databases/(default)/documents/users/smoke/projects`
}

function storageObjectsUrl(): string {
  const bucket = requireEnvironmentVariable('SMOKE_FIREBASE_STORAGE_BUCKET')
  return `${STORAGE_ORIGIN}/v0/b/${bucket}/o?prefix=users%2Fsmoke%2F`
}

test.describe('[Firestore の読み取り権限] 本物の Firebase への接続', () => {
  test.describe('正常系', () => {
    test.describe('未ログインで、利用者のプロジェクトの一覧を読む要求を送ったとき', () => {
      test('Firestore の応答の HTTP ステータスは、403 になる', async ({ request }) => {
        const response = await request.get(firestoreProjectsUrl())

        expect(response.status()).toBe(HTTP_FORBIDDEN)
      })

      test('Firestore の応答の本文の error.status は、PERMISSION_DENIED になる', async ({ request }) => {
        const response = await request.get(firestoreProjectsUrl())

        expect((await response.json()).error.status).toBe('PERMISSION_DENIED')
      })
    })
  })
})

test.describe('[Storage の読み取り権限] 本物の Firebase への接続', () => {
  test.describe('正常系', () => {
    test.describe('未ログインで、利用者のファイルの一覧を読む要求を送ったとき', () => {
      test('Storage の応答の HTTP ステータスは、401 か 403 になる', async ({ request }) => {
        const response = await request.get(storageObjectsUrl())

        expect([HTTP_UNAUTHORIZED, HTTP_FORBIDDEN]).toContain(response.status())
      })
    })
  })
})
