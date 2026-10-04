import { isCloudConfigured, signOutUser } from '../../adapter/cloud/firebaseClient.ts'
import { useEditorStore } from '../../state/editorStore.ts'
import { describeFailure } from '../../utils/describeFailure.ts'
import { logFailure } from '../../utils/logFailure.ts'
import { UserIcon } from '../common/icons.tsx'
import { Button } from '../common/ui.tsx'

/** ログインしていないときはログインのボタン、ログイン中はログアウトのボタン。 */
export function AccountButton({ isSignedIn }: { isSignedIn: boolean }) {
  const store = useEditorStore()

  const signOut = async (): Promise<void> => {
    try {
      await signOutUser()
    } catch (error) {
      logFailure('toolbar.signOutFailed', error)
      store.showNotice(`ログアウトできませんでした: ${describeFailure(error)}`)
    }
  }

  return isSignedIn ? (
    <Button onClick={() => void signOut()}>
      <UserIcon />
      ログアウト
    </Button>
  ) : (
    <Button
      disabled={!isCloudConfigured()}
      title={isCloudConfigured() ? undefined : 'Firebase の設定がないため使えません'}
      onClick={() => (window.location.hash = '#/login')}
    >
      <UserIcon />
      ログイン
    </Button>
  )
}
