import { useState } from 'react'
import { isCloudConfigured, signInWithGoogle } from '../../adapter/cloud/firebaseClient.ts'
import { describeFailure } from '../../utils/describeFailure.ts'
import { logFailure } from '../../utils/logFailure.ts'
import { LegalDialog } from '../legal/LegalDialog.tsx'

/** ログインのダイアログ。エディタの右のパネルから開き、ログインできたらエディタ画面に戻る。 */
export function LoginDialog() {
  const [message, setMessage] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const login = async (): Promise<void> => {
    setIsSigningIn(true)
    setMessage(null)
    try {
      if ((await signInWithGoogle()) === 'signedIn') {
        window.location.hash = '#/'
      }
    } catch (error) {
      logFailure('loginPage.signInFailed', error)
      setMessage(`ログインできませんでした: ${describeFailure(error)}`)
    } finally {
      setIsSigningIn(false)
    }
  }

  return (
    <LegalDialog title="ログイン">
      <p>
        ログインすると、音源・プロジェクト情報・譜面を、クラウドに曲ごとに保存し、別の端末から開けます。ログインしなくても、エディタは使えます。
      </p>
      <div className="flex flex-col items-start gap-3">
        <button
          type="button"
          disabled={isSigningIn || !isCloudConfigured()}
          className="rounded-lg border border-sky-500/60 bg-sky-500/20 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => void login()}
        >
          Google でログイン
        </button>
        {!isCloudConfigured() && <p role="status">クラウド保存は設定されていないため、ログインできません。</p>}
        {isSigningIn && <p role="status">ログイン中です。開いた Google のウィンドウで操作してください。</p>}
        {message !== null && (
          <p role="alert" className="text-amber-200">
            {message}
          </p>
        )}
      </div>
      <p>
        ログインすると、
        <a className="text-sky-400 underline" href="#/legal/terms">
          利用規約
        </a>
        と
        <a className="text-sky-400 underline" href="#/legal/privacy">
          プライバシーポリシー
        </a>
        に同意したものとみなします。
      </p>
    </LegalDialog>
  )
}
