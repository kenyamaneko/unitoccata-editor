import type { FirebaseError } from 'firebase/app'
import { logWarning } from '../../utils/logWarning.ts'

const CLOUD_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'storage/unauthorized': 'このファイルを読み書きする権限がありません。ログインし直してから、もう一度お試しください',
  'storage/unauthenticated': 'ログインが切れています。ログインし直してから、もう一度お試しください',
  'storage/retry-limit-exceeded': '通信がつながりませんでした。ネットワークの接続を確認して、もう一度お試しください',
  'storage/quota-exceeded': 'クラウドの保存容量の上限に達しています。しばらくしてから、もう一度お試しください',
  'storage/canceled': '操作が取り消されました。もう一度お試しください',
  'storage/object-not-found': 'ファイルが見つかりません。曲の一覧を開き直してください',
  'permission-denied': 'このデータを読み書きする権限がありません。ログインし直してから、もう一度お試しください',
  unauthenticated: 'ログインが切れています。ログインし直してから、もう一度お試しください',
  unavailable: '通信がつながりませんでした。ネットワークの接続を確認して、もう一度お試しください',
  'deadline-exceeded': '通信に時間がかかりすぎました。ネットワークの接続を確認して、もう一度お試しください',
  'resource-exhausted': 'クラウドの利用量の上限に達しています。しばらくしてから、もう一度お試しください',
  aborted: '保存が、ほかの保存と重なりました。しばらくしてから、もう一度お試しください',
  'not-found': 'データが見つかりません。曲の一覧を開き直してください',
  'invalid-argument': '保存するデータがクラウドの制限を超えています。ノーツの数を減らしてから、もう一度お試しください',
  'auth/popup-blocked':
    'ブラウザがログインのポップアップをブロックしました。このサイトのポップアップを許可してから、もう一度お試しください',
  'auth/network-request-failed': '通信に失敗しました。ネットワークの接続を確認して、もう一度お試しください',
  'auth/too-many-requests': 'ログインの試行が多すぎます。しばらくしてから、もう一度お試しください',
  'auth/user-disabled': 'このアカウントは使えません。別の Google アカウントでログインしてください',
  'auth/unauthorized-domain': 'このサイトのアドレスではログインが許可されていません。運営者にお問い合わせください',
}

/** クラウド (Firebase) のエラーを、原因と次の行動が分かる日本語にする。分類できないコードは、コードを添えてそのまま伝え、ログに残す。 */
export function describeCloudError(error: FirebaseError): string {
  const message = CLOUD_ERROR_MESSAGES[error.code]
  if (message !== undefined) {
    return message
  }
  logWarning('cloud.unexpectedErrorCode', { code: error.code, message: error.message })
  return `クラウドとの通信で想定外のエラーが起きました (${error.code}): ${error.message}`
}
