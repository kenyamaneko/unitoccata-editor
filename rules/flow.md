> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# unitoccata-editor デリバリー運用 (overlay)

ブランチ戦略とデプロイの共通ルールは keyandnotes-rules を SSoT とし、本ファイルは unitoccata-editor 固有の実装詳細のみを記す。pbwrompter と同じ方法を採る。

- ブランチ戦略 (GitHub Flow): `../keyandnotes-rules/rules/flow/github-flow.md`
- デプロイ戦略 (Merge → Dev, Tag → Prod): `../keyandnotes-rules/rules/deploy/merge-dev-tag-prod.md`

## [flow] 環境への反映

`main` push → dev、「Deploy to Prod」の手動実行 → prod へ自動デプロイ。配信先は Firebase Hosting。トリガーは GitHub Actions のデプロイの workflow (`.github/workflows/deploy-dev.yml` / `.github/workflows/deploy-prod.yml`) に書く。

## [flow] バージョニング

タグ形式は `vMAJOR.MINOR.PATCH`。CI/CD パイプライン内で `git describe --tags --always` を実行し、タグ付きコミットなら `v1.0.0`、タグから N コミット後なら `v1.0.0-3-gabc1234`、タグなしなら短縮 SHA を返す。タグは「Deploy to Prod」の実行時に選んだバージョンの種類 (patch / minor / major) から CI が打つ。最初のタグは `v0.1.0`。

## [flow] ブランチ保護 (GitHub Rulesets)

`main` の保護は ruleset `main-protection` で設定する (直 push 禁止 / PR マージのみ / 必須チェック: CI の lint・型チェック・テスト・ビルド)。
