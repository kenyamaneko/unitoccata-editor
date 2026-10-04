/** JSON の内容を、指定したファイル名でブラウザからダウンロードさせる。 */
export function downloadJson(fileName: string, content: unknown): void {
  const blob = new Blob([`${JSON.stringify(content, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
