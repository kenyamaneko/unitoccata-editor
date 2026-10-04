/** 譜面ファイルまたは elements.json の内容が仕様に反していることを表す。 */
export class FormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormatError'
  }
}
