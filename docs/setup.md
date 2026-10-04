# セットアップ

## 開発サーバーの起動

Node.js 24 以上が必要。

```sh
npm install
npm run dev
```

開発サーバーは `http://localhost:47213` で起動する。

## コマンド

| コマンド                   | 内容                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`              | 開発サーバーを起動する                                                                                                                                                             |
| `npm test`                 | 全てのテストを実行する (Auth と Storage のエミュレータを起動するので、Java 21 以上が必要)                                                                                          |
| `npm run test:coverage`    | 全てのテストを実行して、カバレッジを `coverage/` に出力する (Java 21 以上が必要)                                                                                                   |
| `npm run test:logic`       | ロジックのテストを実行する                                                                                                                                                         |
| `npm run test:gui`         | 画面のテストを実行する                                                                                                                                                             |
| `npm run test:integration` | エミュレータに接続する結合テストを実行する (Java 21 以上が必要)                                                                                                                    |
| `npm run test:e2e`         | 実ブラウザ (Chromium) で、Auth・Storage・Firestore のエミュレータに接続する E2E テストを実行する (Java 21 以上が必要。初回は `npx playwright install chromium` でブラウザを入れる) |
| `npm run test:smoke`       | デプロイ済みの環境に対して、スモークテストを実行する (必要な環境変数は「スモークテスト」を見る)                                                                                    |
| `npm run typecheck`        | 型を検査する                                                                                                                                                                       |
| `npm run lint`             | oxlint を実行する                                                                                                                                                                  |
| `npm run build`            | 本番用にビルドする                                                                                                                                                                 |

## クラウド保存の設定

クラウド保存は、Firebase の設定が環境変数に揃っているときだけ画面に出る。変数の名前は `.env.example` を見る。値は `.env.local` に書く (git には入れない)。

## エミュレータで試す

`.env.local` に `VITE_USE_EMULATORS=true` を足し、Java 21 以上で次を実行する。

```sh
firebase emulators:start --only auth,storage,firestore --project demo-unitoccata-editor
```

## スモークテスト

`npm run test:smoke` は、デプロイ済みの環境に対して、本物の Google のログイン画面と Firebase (Firestore・Storage) に実際につながることを確かめる。次の環境変数が全て要る。1 つでも未設定なら、テストを始める前に失敗する。

| 環境変数                           | 内容                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `SMOKE_BASE_URL`                   | デプロイ済みのアプリのアドレス (例: `https://{プロジェクト ID}.web.app`) |
| `SMOKE_FIREBASE_PROJECT_ID`        | デプロイ済みの Firebase プロジェクトの ID                               |
| `SMOKE_FIREBASE_STORAGE_BUCKET`    | デプロイ済みの Firebase プロジェクトの Storage のバケット名             |

ログインそのものは行わない。Firestore と Storage には、未ログインで読み取りの要求を送り、権限がないという応答が返ること (規則が配備されていること) を確かめる。
