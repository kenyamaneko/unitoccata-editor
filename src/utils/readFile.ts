function describeReadFailure(file: File): string {
  return `「${file.name}」を読み出せませんでした。ファイルが壊れていないか確認して、もう一度選んでください`
}

/** 選ばれたファイルを文字列として読み出す。読み出せなければ、ファイル名を付けた文言の例外にする。 */
export async function readFileText(file: File): Promise<string> {
  try {
    return await file.text()
  } catch (cause) {
    throw new Error(describeReadFailure(file), { cause })
  }
}

/** 選ばれたファイルをバイト列として読み出す。読み出せなければ、ファイル名を付けた文言の例外にする。 */
export async function readFileBytes(file: File): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer()
  } catch (cause) {
    throw new Error(describeReadFailure(file), { cause })
  }
}
