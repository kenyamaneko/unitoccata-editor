import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { isCloudConfigured, subscribeToUser } from '../adapter/cloud/firebaseClient.ts'

/** ログイン中の利用者を返す。クラウドが未設定のときと、ログインしていないときは null。 */
export function useCloudUser(): User | null {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => (isCloudConfigured() ? subscribeToUser(setUser) : undefined), [])
  return user
}
