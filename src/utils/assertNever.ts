/**
 * 網羅したはずの分岐に想定外の値が来たことを、コンパイル時と実行時の両方で検出する。
 */
export function assertNever(value: never): never {
  throw new Error(`想定外の値です: ${JSON.stringify(value)}`)
}
