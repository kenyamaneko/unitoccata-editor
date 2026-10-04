# セットアップ

## 開発サーバーの起動

Node.js 24 以上が必要。

```sh
npm install
npm run dev
```

開発サーバーは `http://localhost:47213` で起動する。

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバーを起動する |
| `npm test` | 全てのテストを実行する (Auth と Storage のエミュレータを起動するので、Java 21 以上が必要) |
| `npm run test:coverage` | 全てのテストを実行して、カバレッジを `coverage/` に出力する (Java 21 以上が必要) |
| `npm run test:logic` | ロジックのテストを実行する |
| `npm run test:gui` | 画面のテストを実行する |
| `npm run test:integration` | エミュレータに接続する結合テストを実行する (Java 21 以上が必要) |
| `npm run typecheck` | 型を検査する |
| `npm run lint` | oxlint を実行する |
| `npm run build` | 本番用にビルドする |

## クラウド保存の設定

クラウド保存は、Firebase の設定が環境変数に揃っているときだけ画面に出る。変数の名前は `.env.example` を見る。値は `.env.local` に書く (git には入れない)。

## エミュレータで試す

`.env.local` に `VITE_USE_EMULATORS=true` を足し、Java 21 以上で次を実行する。

```sh
firebase emulators:start --only auth,storage,firestore --project demo-unitoccata-editor
```
