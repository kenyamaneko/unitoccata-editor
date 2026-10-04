import { describe, expect, it } from 'vitest'
import { createChartFileName } from './fileNames.ts'

describe('[譜面ファイル書き出し] 書き出すファイルの名前', () => {
  describe('正常系', () => {
    it('譜面名が「譜面1」、曲名が「テスト曲」のとき、書き出すファイルの名前は、「譜面1.テスト曲.unitoccata.json」になる', () => {
      expect(createChartFileName('譜面1', 'テスト曲')).toBe('譜面1.テスト曲.unitoccata.json')
    })

    it('譜面名に「\\ / : * ? " < > |」の記号が混ざっているとき、書き出すファイルの名前から、その記号が取り除かれる', () => {
      expect(createChartFileName('a\\b/c:d*e?f"g<h>i|j', 'テスト曲')).toBe('abcdefghij.テスト曲.unitoccata.json')
    })

    it('譜面名にタブ文字が混ざっているとき、書き出すファイルの名前から、タブ文字が取り除かれる', () => {
      expect(createChartFileName('ab\tc', 'テスト曲')).toBe('abc.テスト曲.unitoccata.json')
    })

    it('譜面名がファイル名に使えない記号だけのとき、書き出すファイルの名前の譜面名の部分は、untitled になる', () => {
      expect(createChartFileName('*?', 'テスト曲')).toBe('untitled.テスト曲.unitoccata.json')
    })
  })
})
