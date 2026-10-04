import { FirebaseError, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage'

const EMULATOR_HOST = '127.0.0.1'
const AUTH_EMULATOR_PORT = 47099
const STORAGE_EMULATOR_PORT = 47199
const FIRESTORE_EMULATOR_PORT = 47299

interface FirebaseServices {
  readonly app: FirebaseApp
  readonly auth: Auth
  readonly storage: FirebaseStorage
  readonly firestore: Firestore
}

let services: FirebaseServices | null = null

/** Firebase の設定が環境変数に揃っているか。 */
export function isCloudConfigured(): boolean {
  const env = import.meta.env
  return [
    env.VITE_FIREBASE_API_KEY,
    env.VITE_FIREBASE_AUTH_DOMAIN,
    env.VITE_FIREBASE_PROJECT_ID,
    env.VITE_FIREBASE_STORAGE_BUCKET,
    env.VITE_FIREBASE_APP_ID,
  ].every((value) => typeof value === 'string' && value !== '')
}

/** Firebase の各サービス。初回の呼び出しで初期化する。クラウドの設定がなければ例外にする。 */
export function getServices(): FirebaseServices {
  if (services !== null) {
    return services
  }
  if (!isCloudConfigured()) {
    throw new Error('クラウドの設定がありません')
  }
  const env = import.meta.env
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: env.VITE_FIREBASE_APP_ID,
  })
  const auth = getAuth(app)
  const storage = getStorage(app)
  const firestore = getFirestore(app)
  if (env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, { disableWarnings: true })
    connectStorageEmulator(storage, EMULATOR_HOST, STORAGE_EMULATOR_PORT)
    connectFirestoreEmulator(firestore, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT)
  }
  services = { app, auth, storage, firestore }
  return services
}

/** ログイン状態の変化を購読する。解除する関数を返す。 */
export function subscribeToUser(listener: (user: User | null) => void): () => void {
  return onAuthStateChanged(getServices().auth, listener)
}

/** ログインの結果。利用者がポップアップを閉じた場合と、別のログインに取って代わられた場合は cancelled。 */
export type SignInResult = 'signedIn' | 'cancelled'

const CANCELLED_SIGN_IN_CODES: readonly string[] = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']

/** Google アカウントでログインする。取り消しはエラーにせず cancelled を返し、それ以外の失敗は例外にする。 */
export async function signInWithGoogle(): Promise<SignInResult> {
  try {
    await signInWithPopup(getServices().auth, new GoogleAuthProvider())
    return 'signedIn'
  } catch (error) {
    if (error instanceof FirebaseError && CANCELLED_SIGN_IN_CODES.includes(error.code)) {
      return 'cancelled'
    }
    throw error
  }
}

/** ログアウトする。 */
export async function signOutUser(): Promise<void> {
  await signOut(getServices().auth)
}
