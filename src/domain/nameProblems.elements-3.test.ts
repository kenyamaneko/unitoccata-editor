import { describe, expect, it } from 'vitest'
import { findNameMessage } from './nameProblems.ts'

describe('[曲名・譜面名の入力] 入力の検証', () => {
  describe('正常系', () => {
    it.each([
      { given: '100 文字', name: 'あ'.repeat(100) },
      { given: '「テスト曲」', name: 'テスト曲' },
    ])('曲名が $given のとき、メッセージは、null になる', ({ name }) => {
      expect(findNameMessage('曲名', name)).toBeNull()
    })

    it.each([
      { given: '空文字', name: '' },
      { given: '空白だけ', name: '   ' },
    ])('曲名が $given のとき、メッセージは、「曲名を入力してください」になる', ({ name }) => {
      expect(findNameMessage('曲名', name)).toBe('曲名を入力してください')
    })

    it('曲名が 101 文字のとき、メッセージは、「曲名は 100 文字以内にしてください (今は 101 文字です)」になる', () => {
      expect(findNameMessage('曲名', 'あ'.repeat(101))).toBe('曲名は 100 文字以内にしてください (今は 101 文字です)')
    })
  })
})
