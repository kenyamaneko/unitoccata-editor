/** スモークテストに必要な環境変数の値を返す。未設定か空なら、例外にする。 */
export function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]
  return value === undefined || value === '' ? failWithMissingVariable(name) : value
}

function failWithMissingVariable(name: string): never {
  throw new Error(`環境変数 ${name} がありません。スモークテストの前提として指定してください`)
}
