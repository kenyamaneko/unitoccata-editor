import { describe, expect, it } from 'vitest'
import { actAsAdmin, actAsAnonymous, actAsUser, createCaseUid, type CloudActor } from '../../test/emulator.ts'

const PERMISSION_DENIED = { code: 'permission-denied' }

const OUTSIDERS: readonly { readonly who: string; readonly actor: () => CloudActor }[] = [
  { who: 'bob がログインしているとき', actor: () => actAsUser(createCaseUid('bob')) },
  { who: '誰もログインしていないとき', actor: () => actAsAnonymous() },
]

function validProject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'テスト曲',
    audioFileName: null,
    offsetMs: 0,
    barCount: 50,
    tempo: [{ tick: 0, bpm: 120 }],
    meter: [{ tick: 0, num: 4, den: 4 }],
    updatedAt: 1000,
    ...overrides,
  }
}

function validChart(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: '譜面1',
    laneCount: 5,
    notes: [{ tick: 480, lane: 2, type: 'tap' }],
    updatedAt: 1000,
    ...overrides,
  }
}

function tapNotes(count: number): unknown[] {
  return Array.from({ length: count }, (_, index) => ({ tick: index * 480, lane: index % 5, type: 'tap' }))
}

function without(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key))
}

function projectDocument(uid: string): string {
  return `users/${uid}/projects/project-1`
}

function chartDocument(uid: string): string {
  return `${projectDocument(uid)}/charts/chart-1`
}

describe('[保存先の規則] プロジェクトの読み書き', () => {
  describe('正常系', () => {
    it('alice のプロジェクトがないとき、alice が自分のプロジェクトを書いたあとで読み直すと、書いた内容になる', async () => {
      const aliceUid = createCaseUid('alice')
      const alice = actAsUser(aliceUid)
      await alice.firestore.set(projectDocument(aliceUid), validProject())

      const stored = await alice.firestore.get(projectDocument(aliceUid))

      expect(stored).toEqual(validProject())
    })

    it('alice のプロジェクトがあるとき、alice が自分のプロジェクトを削除したあとで読み直すと、見つからない', async () => {
      const aliceUid = createCaseUid('alice')
      await actAsAdmin().firestore.set(projectDocument(aliceUid), validProject())
      const alice = actAsUser(aliceUid)
      await alice.firestore.delete(projectDocument(aliceUid))

      const stored = await alice.firestore.get(projectDocument(aliceUid))

      expect(stored).toBeUndefined()
    })
  })

  describe('異常系', () => {
    describe.each(OUTSIDERS)('$who', ({ actor }) => {
      it('alice のプロジェクトを読むと、権限エラー (permission-denied) になる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().firestore.set(projectDocument(aliceUid), validProject())

        const reading = actor().firestore.get(projectDocument(aliceUid))

        await expect(reading).rejects.toMatchObject(PERMISSION_DENIED)
      })

      it('alice のプロジェクトがないとき、alice のプロジェクトとして書くと、権限エラー (permission-denied) になる', async () => {
        const aliceUid = createCaseUid('alice')

        const writing = actor().firestore.set(projectDocument(aliceUid), validProject())

        await expect(writing).rejects.toMatchObject(PERMISSION_DENIED)
      })

      it('alice のプロジェクトを削除すると、権限エラー (permission-denied) になる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().firestore.set(projectDocument(aliceUid), validProject())

        const deleting = actor().firestore.delete(projectDocument(aliceUid))

        await expect(deleting).rejects.toMatchObject(PERMISSION_DENIED)
      })

      it('alice のプロジェクトを削除しようとしたあとで alice が読み直すと、alice のプロジェクトは削除前の内容のままになる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().firestore.set(projectDocument(aliceUid), validProject())
        await expect(actor().firestore.delete(projectDocument(aliceUid))).rejects.toMatchObject(PERMISSION_DENIED)

        const stored = await actAsUser(aliceUid).firestore.get(projectDocument(aliceUid))

        expect(stored).toEqual(validProject())
      })
    })

    it('users 以外のパス other に書くと、権限エラー (permission-denied) になる', async () => {
      const aliceUid = createCaseUid('alice')
      const alice = actAsUser(aliceUid)

      const writing = alice.firestore.set(`other/${aliceUid}`, validProject())

      await expect(writing).rejects.toMatchObject(PERMISSION_DENIED)
    })
  })
})

describe('[保存先の規則] プロジェクトの内容の検証', () => {
  describe('正常系', () => {
    it.each([
      { condition: '曲名が「あ」の 100 文字のとき', overrides: { title: 'あ'.repeat(100) } },
      { condition: '小節数が 1のとき', overrides: { barCount: 1 } },
      { condition: '小節数が 1000のとき', overrides: { barCount: 1000 } },
      { condition: '音源のファイル名が song.mp3のとき', overrides: { audioFileName: 'song.mp3' } },
    ])(
      '$condition、alice が自分のプロジェクトとして書いたあとで読み直すと、書いた内容になる',
      async ({ overrides }) => {
        const aliceUid = createCaseUid('alice')
        const alice = actAsUser(aliceUid)
        await alice.firestore.set(projectDocument(aliceUid), validProject(overrides))

        const stored = await alice.firestore.get(projectDocument(aliceUid))

        expect(stored).toEqual(validProject(overrides))
      },
    )
  })

  describe('異常系', () => {
    describe('alice が自分のプロジェクトとして書くと', () => {
      it.each([
        { condition: '曲名が空文字のとき', project: validProject({ title: '' }) },
        { condition: '曲名が「あ」の 101 文字のとき', project: validProject({ title: 'あ'.repeat(101) }) },
        { condition: '小節数が 0のとき', project: validProject({ barCount: 0 }) },
        { condition: '小節数が 1001のとき', project: validProject({ barCount: 1001 }) },
        { condition: 'テンポが空の配列のとき', project: validProject({ tempo: [] }) },
        { condition: '拍子が空の配列のとき', project: validProject({ meter: [] }) },
        { condition: '仕様にない項目 extra があるのとき', project: validProject({ extra: 1 }) },
        { condition: 'オフセットの項目がないのとき', project: without(validProject(), 'offsetMs') },
        { condition: '更新時刻が文字列 "1000"のとき', project: validProject({ updatedAt: '1000' }) },
      ])('$condition、権限エラー (permission-denied) になる', async ({ project }) => {
        const aliceUid = createCaseUid('alice')
        const alice = actAsUser(aliceUid)

        const writing = alice.firestore.set(projectDocument(aliceUid), project)

        await expect(writing).rejects.toMatchObject(PERMISSION_DENIED)
      })
    })

    describe('保存済みのプロジェクトの曲名が「テスト曲」で、alice が曲名を空文字にして書いて権限エラー (permission-denied) になったとき', () => {
      it('alice が読み直すと、曲名は「テスト曲」のままになる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().firestore.set(projectDocument(aliceUid), validProject())
        const alice = actAsUser(aliceUid)
        await expect(alice.firestore.set(projectDocument(aliceUid), validProject({ title: '' }))).rejects.toMatchObject(
          PERMISSION_DENIED,
        )

        const stored = await alice.firestore.get(projectDocument(aliceUid))

        expect(stored).toMatchObject({ title: 'テスト曲' })
      })

      it('曲名を「新しい曲」にして書き直したあとで読み直すと、曲名は「新しい曲」になる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().firestore.set(projectDocument(aliceUid), validProject())
        const alice = actAsUser(aliceUid)
        await expect(alice.firestore.set(projectDocument(aliceUid), validProject({ title: '' }))).rejects.toMatchObject(
          PERMISSION_DENIED,
        )
        await alice.firestore.set(projectDocument(aliceUid), validProject({ title: '新しい曲' }))

        const stored = await alice.firestore.get(projectDocument(aliceUid))

        expect(stored).toMatchObject({ title: '新しい曲' })
      })
    })
  })
})

describe('[保存先の規則] 譜面の読み書き', () => {
  describe('正常系', () => {
    it('alice の譜面がないとき、alice が自分の譜面を書いたあとで読み直すと、書いた内容になる', async () => {
      const aliceUid = createCaseUid('alice')
      const alice = actAsUser(aliceUid)
      await alice.firestore.set(chartDocument(aliceUid), validChart())

      const stored = await alice.firestore.get(chartDocument(aliceUid))

      expect(stored).toEqual(validChart())
    })

    it('alice の譜面があるとき、alice が自分の譜面を削除したあとで読み直すと、見つからない', async () => {
      const aliceUid = createCaseUid('alice')
      await actAsAdmin().firestore.set(chartDocument(aliceUid), validChart())
      const alice = actAsUser(aliceUid)
      await alice.firestore.delete(chartDocument(aliceUid))

      const stored = await alice.firestore.get(chartDocument(aliceUid))

      expect(stored).toBeUndefined()
    })
  })

  describe('異常系', () => {
    describe.each(OUTSIDERS)('$who', ({ actor }) => {
      it('alice の譜面を読むと、権限エラー (permission-denied) になる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().firestore.set(chartDocument(aliceUid), validChart())

        const reading = actor().firestore.get(chartDocument(aliceUid))

        await expect(reading).rejects.toMatchObject(PERMISSION_DENIED)
      })

      it('alice の譜面がないとき、alice の譜面として書くと、権限エラー (permission-denied) になる', async () => {
        const aliceUid = createCaseUid('alice')

        const writing = actor().firestore.set(chartDocument(aliceUid), validChart())

        await expect(writing).rejects.toMatchObject(PERMISSION_DENIED)
      })

      it('alice の譜面を削除すると、権限エラー (permission-denied) になる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().firestore.set(chartDocument(aliceUid), validChart())

        const deleting = actor().firestore.delete(chartDocument(aliceUid))

        await expect(deleting).rejects.toMatchObject(PERMISSION_DENIED)
      })

      it('alice の譜面を削除しようとしたあとで alice が読み直すと、alice の譜面は削除前の内容のままになる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().firestore.set(chartDocument(aliceUid), validChart())
        await expect(actor().firestore.delete(chartDocument(aliceUid))).rejects.toMatchObject(PERMISSION_DENIED)

        const stored = await actAsUser(aliceUid).firestore.get(chartDocument(aliceUid))

        expect(stored).toEqual(validChart())
      })
    })
  })
})

describe('[保存先の規則] 譜面の内容の検証', () => {
  describe('正常系', () => {
    it.each([
      { condition: '譜面名が「あ」の 100 文字のとき', overrides: { name: 'あ'.repeat(100) } },
      { condition: 'レーン数が 1のとき', overrides: { laneCount: 1 } },
      { condition: 'レーン数が 16のとき', overrides: { laneCount: 16 } },
      { condition: 'ノーツが 3000 個のとき', overrides: { notes: tapNotes(3000) } },
    ])('$condition、alice が自分の譜面として書いたあとで読み直すと、書いた内容になる', async ({ overrides }) => {
      const aliceUid = createCaseUid('alice')
      const alice = actAsUser(aliceUid)
      await alice.firestore.set(chartDocument(aliceUid), validChart(overrides))

      const stored = await alice.firestore.get(chartDocument(aliceUid))

      expect(stored).toEqual(validChart(overrides))
    })
  })

  describe('異常系', () => {
    describe('alice が自分の譜面として書くと', () => {
      it.each([
        { condition: '譜面名が空文字のとき', chart: validChart({ name: '' }) },
        { condition: '譜面名が「あ」の 101 文字のとき', chart: validChart({ name: 'あ'.repeat(101) }) },
        { condition: 'レーン数が 0のとき', chart: validChart({ laneCount: 0 }) },
        { condition: 'レーン数が 17のとき', chart: validChart({ laneCount: 17 }) },
        { condition: 'ノーツが 3001 個のとき', chart: validChart({ notes: tapNotes(3001) }) },
        { condition: '仕様にない項目 extra があるのとき', chart: validChart({ extra: 1 }) },
      ])('$condition、権限エラー (permission-denied) になる', async ({ chart }) => {
        const aliceUid = createCaseUid('alice')
        const alice = actAsUser(aliceUid)

        const writing = alice.firestore.set(chartDocument(aliceUid), chart)

        await expect(writing).rejects.toMatchObject(PERMISSION_DENIED)
      })
    })
  })
})
