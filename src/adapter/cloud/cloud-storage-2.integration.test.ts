import { describe, expect, it } from 'vitest'
import { actAsAdmin, actAsAnonymous, actAsUser, createCaseUid, type CloudActor } from '../../test/emulator.ts'

const FIFTY_MEGABYTES = 52428800
const OVER_FIFTY_MEGABYTES = 52428801
const UNAUTHORIZED = { code: 'storage/unauthorized' }

const OUTSIDERS: readonly { readonly who: string; readonly actor: () => CloudActor }[] = [
  { who: 'bob がログインしているとき', actor: () => actAsUser(createCaseUid('bob')) },
  { who: '誰もログインしていないとき', actor: () => actAsAnonymous() },
]

function songFolder(uid: string): string {
  return `users/${uid}/projects/project-1`
}

function songFile(uid: string): string {
  return `${songFolder(uid)}/song.mp3`
}

describe('[保存先の規則] 音源の読み書き', () => {
  describe('正常系', () => {
    it('alice の音源 song.mp3 がないとき、alice が自分の song.mp3 に 3 バイト (1、2、3) を書いたあとで読み直すと、同じ 3 バイトになる', async () => {
      const aliceUid = createCaseUid('alice')
      const alice = actAsUser(aliceUid)
      await alice.storage.write(songFile(aliceUid), Uint8Array.of(1, 2, 3))

      const content = await alice.storage.read(songFile(aliceUid))

      expect(content).toEqual(Uint8Array.of(1, 2, 3))
    })

    it('alice のプロジェクトに音源 song.mp3 があるとき、alice が自分のプロジェクトのファイル名の一覧を読むと、「song.mp3」の 1 つになる', async () => {
      const aliceUid = createCaseUid('alice')
      await actAsAdmin().storage.write(songFile(aliceUid), Uint8Array.of(1, 2, 3))

      const fileNames = await actAsUser(aliceUid).storage.listFiles(songFolder(aliceUid))

      expect(fileNames).toEqual(['song.mp3'])
    })

    it('alice の音源 song.mp3 があるとき、alice が自分の song.mp3 を削除したあとで、ファイル名の一覧を読むと、空になる', async () => {
      const aliceUid = createCaseUid('alice')
      await actAsAdmin().storage.write(songFile(aliceUid), Uint8Array.of(1, 2, 3))
      const alice = actAsUser(aliceUid)
      await alice.storage.remove(songFile(aliceUid))

      const fileNames = await alice.storage.listFiles(songFolder(aliceUid))

      expect(fileNames).toEqual([])
    })

    it('alice の音源 song.mp3 がないとき、alice が 52428800 バイト (50 MB) を書いたあとで読み直すと、大きさは書いたとおりになる', async () => {
      const aliceUid = createCaseUid('alice')
      const alice = actAsUser(aliceUid)
      await alice.storage.write(songFile(aliceUid), new Uint8Array(FIFTY_MEGABYTES))

      const content = await alice.storage.read(songFile(aliceUid))

      expect(content.byteLength).toBe(52428800)
    })
  })

  describe('異常系', () => {
    describe.each(OUTSIDERS)('$who', ({ actor }) => {
      it('alice のプロジェクトのファイル名の一覧を読むと、エラーコード storage/unauthorized のエラーになる', async () => {
        const aliceUid = createCaseUid('alice')

        const listing = actor().storage.listFiles(songFolder(aliceUid))

        await expect(listing).rejects.toMatchObject(UNAUTHORIZED)
      })

      it('alice の音源 song.mp3 を読むと、エラーコード storage/unauthorized のエラーになる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().storage.write(songFile(aliceUid), Uint8Array.of(1, 2, 3))

        const reading = actor().storage.read(songFile(aliceUid))

        await expect(reading).rejects.toMatchObject(UNAUTHORIZED)
      })

      it('alice の音源 song.mp3 がないとき、alice の song.mp3 に書くと、エラーコード storage/unauthorized のエラーになる', async () => {
        const aliceUid = createCaseUid('alice')

        const writing = actor().storage.write(songFile(aliceUid), Uint8Array.of(1))

        await expect(writing).rejects.toMatchObject(UNAUTHORIZED)
      })

      it('alice の音源 song.mp3 を削除すると、エラーコード storage/unauthorized のエラーになる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().storage.write(songFile(aliceUid), Uint8Array.of(1, 2, 3))

        const deleting = actor().storage.remove(songFile(aliceUid))

        await expect(deleting).rejects.toMatchObject(UNAUTHORIZED)
      })
    })

    it('users 以外のパス other の song.mp3 に書くと、エラーコード storage/unauthorized のエラーになる', async () => {
      const aliceUid = createCaseUid('alice')
      const alice = actAsUser(aliceUid)

      const writing = alice.storage.write(`other/${aliceUid}/song.mp3`, Uint8Array.of(1))

      await expect(writing).rejects.toMatchObject(UNAUTHORIZED)
    })

    describe('52428801 バイトを書くと', () => {
      it('alice の音源 song.mp3 がないとき、エラーコード storage/unauthorized のエラーになる', async () => {
        const aliceUid = createCaseUid('alice')
        const alice = actAsUser(aliceUid)

        const writing = alice.storage.write(songFile(aliceUid), new Uint8Array(OVER_FIFTY_MEGABYTES))

        await expect(writing).rejects.toMatchObject(UNAUTHORIZED)
      })

      it('3 バイト (1、2、3) の音源 song.mp3 があるとき、エラーコード storage/unauthorized のエラーになり、読み直した内容は元の 3 バイトのままになる', async () => {
        const aliceUid = createCaseUid('alice')
        await actAsAdmin().storage.write(songFile(aliceUid), Uint8Array.of(1, 2, 3))
        const alice = actAsUser(aliceUid)
        await expect(
          alice.storage.write(songFile(aliceUid), new Uint8Array(OVER_FIFTY_MEGABYTES)),
        ).rejects.toMatchObject(UNAUTHORIZED)

        const content = await alice.storage.read(songFile(aliceUid))

        expect(content).toEqual(Uint8Array.of(1, 2, 3))
      })

      it('エラーになったあと、同じ song.mp3 に 52428800 バイトを書き直して読み直すと、大きさは書いたとおりになる', async () => {
        const aliceUid = createCaseUid('alice')
        const alice = actAsUser(aliceUid)
        await expect(
          alice.storage.write(songFile(aliceUid), new Uint8Array(OVER_FIFTY_MEGABYTES)),
        ).rejects.toMatchObject(UNAUTHORIZED)
        await alice.storage.write(songFile(aliceUid), new Uint8Array(FIFTY_MEGABYTES))

        const content = await alice.storage.read(songFile(aliceUid))

        expect(content.byteLength).toBe(52428800)
      })
    })
  })
})
