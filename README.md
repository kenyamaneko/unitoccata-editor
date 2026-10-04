# UniToccata Editor

UniToccata の譜面 (タップ・フリック・ロング) を編集する Web アプリ。Unity を触らない譜面師も使える。

## 技術スタック

| レイヤー           | 技術                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| フロントエンド     | React, TypeScript, Vite, Tailwind CSS, zustand                         |
| 描画               | Canvas                                                                 |
| 音声               | Web Audio API, signalsmith-stretch                                     |
| MIDI               | midi-file                                                              |
| クラウド保存・認証 | Firebase Authentication, Cloud Storage                                 |
| ホスティング       | Firebase Hosting                                                       |
| CI/CD              | GitHub Actions                                                         |
| テスト             | Vitest, Testing Library, msw, @firebase/rules-unit-testing, Playwright |

## ドキュメント

| ドキュメント                                                                  | 内容                                                                   |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [セットアップ](docs/setup.md)                                                 | 開発サーバーの起動、コマンド、クラウド保存の設定、エミュレータの使い方 |
| [用語集](docs/glossary.md)                                                    | 譜面のドメイン用語と、コードで使う語                                   |
| [デリバリー運用](rules/flow.md)                                               | ブランチ戦略、dev と prod への反映、バージョニング                     |
| [テストカバレッジ](https://kenyamaneko.github.io/unitoccata-editor/coverage/) | テストのカバレッジレポート (main の CI が更新)                         |

## ディレクトリ構成

```
├── src/
│   ├── adapter/      # 外部との接続と変換: 音源 (Web Audio)、クラウド (Firebase)、MIDI ファイル、譜面ファイル
│   ├── components/   # React コンポーネントと、Canvas の描画・操作 (タイムライン、プレビュー) を機能ごとのフォルダに置く
│   ├── constants/    # Canvas の寸法と色
│   ├── domain/       # ノーツ、グリッド、プロジェクト情報、MIDI の取り込み、入力検証のロジックと定数
│   ├── hooks/        # React のカスタムフック
│   ├── state/        # 編集の状態とプレビューの再生状態 (zustand)
│   ├── test/         # 複数の機能のテストが共有する部品 (画面の起動、Firebase と音声の代用、テストデータ)
│   └── utils/        # 失敗の説明文、ログ出力、ファイルの読み書き、網羅性の検査
├── e2e/              # E2E テスト (Playwright。エミュレータに接続して、ログイン・書き出し・クラウド保存などを確かめる)
├── e2e-smoke/        # デプロイ後のスモークテスト (デプロイ済みの URL を開いて、エディタ画面とバージョンを確かめる)
├── docs/             # 用語集
├── rules/            # リポ固有のルール
├── scripts/          # テスト名からテスト観点カタログを生成するスクリプト
├── terraform/        # Google Cloud、Firebase、GitHub の環境変数の定義
├── firebase.json     # Firebase Hosting、エミュレータの設定
└── storage.rules     # Cloud Storage の規則 (Terraform が各環境へ反映する)
```
