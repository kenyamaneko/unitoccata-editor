import { parseChartJson, type LoadedChart } from './chartFormat.ts'
import { FormatError } from './formatError.ts'
import { readFileText } from '../../utils/readFile.ts'

class JsonSyntaxError extends Error {}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new JsonSyntaxError('JSON として読めません', { cause })
  }
}

function withFileName<T>(fileName: string, read: () => T): T {
  try {
    return read()
  } catch (error) {
    if (error instanceof JsonSyntaxError) {
      throw new FormatError(`${fileName} は ${error.message}`)
    }
    if (error instanceof FormatError) {
      throw new FormatError(`${fileName}: ${error.message}`)
    }
    throw error
  }
}

/** 譜面ファイルの内容を読む。内容が仕様に反していれば、ファイル名を付けた FormatError を投げる。 */
export function parseChartText(text: string, fileName: string, createId: () => string): LoadedChart {
  return withFileName(fileName, () => parseChartJson(parseJson(text), createId))
}

/** 選ばれた譜面ファイルを読み込む。 */
export async function readChartFile(file: File, createId: () => string): Promise<LoadedChart> {
  return parseChartText(await readFileText(file), file.name, createId)
}
