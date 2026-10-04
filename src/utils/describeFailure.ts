import { FirebaseError } from 'firebase/app'
import { describeCloudError } from '../adapter/cloud/cloudErrorMessages.ts'

/** 失敗の原因を、利用者に見せる文言にする。 */
export function describeFailure(error: unknown): string {
  if (error instanceof FirebaseError) {
    return describeCloudError(error)
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
