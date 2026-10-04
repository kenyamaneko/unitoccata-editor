import { failWith } from './failures.ts'

const EMULATORS = [
  { name: 'Auth エミュレータ', hostVariable: 'FIREBASE_AUTH_EMULATOR_HOST' },
  { name: 'Firestore エミュレータ', hostVariable: 'FIRESTORE_EMULATOR_HOST' },
  { name: 'Storage エミュレータ', hostVariable: 'FIREBASE_STORAGE_EMULATOR_HOST' },
] as const

const REACHABILITY_TIMEOUT_MS = 5000

async function assertReachable(name: string, hostVariable: string): Promise<void> {
  const host =
    process.env[hostVariable] ||
    failWith(
      new Error(
        `${name}の接続先 (環境変数 ${hostVariable}) がありません。結合テストは、firebase emulators:exec の中で実行してください (npm run test:integration)`,
      ),
    )
  await fetch(`http://${host}/`, { signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS) }).catch((cause: unknown) =>
    failWith(new Error(`${name} (${host}) に接続できません。エミュレータを起動してください`, { cause })),
  )
}

export default async function assertEmulatorsRunning(): Promise<void> {
  for (const { name, hostVariable } of EMULATORS) {
    await assertReachable(name, hostVariable)
  }
}
