# CLAUDE.md - unitoccata-editor

> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

共通開発ルールは Key and Notes 共通の `keyandnotes-rules` リポ (`../keyandnotes-rules`) を SSoT とし、@import で参照する。unitoccata-editor 固有分は `rules/` の overlay に置く。

@../keyandnotes-rules/rules/principles.md
@rules/principles.md

## ファイル編集前のルール適用手順

ファイル編集 (Edit / Write) の前に、対象ファイルの拡張子から言語を判定し、共通ルール (keyandnotes-rules) と unitoccata-editor 固有 overlay の該当ルールを Read して以降の判断に適用する。共通と固有が衝突する場合は固有を優先する (共通 principles「[base] ルールの階層と優先順位」)。

- `**/*.ts` / `**/*.tsx` → `../keyandnotes-rules/rules/lang/typescript.md`
- テストコードを書くとき → `../keyandnotes-rules/rules/testing.md`
- `**/*.md` → `../keyandnotes-rules/rules/documentation.md`
- ブランチ運用・リリース → `rules/flow.md`

共通 principles (`../keyandnotes-rules/rules/principles.md`) と固有 overlay (`rules/principles.md`) は本ファイルから @import 済みなので常に適用される。`../keyandnotes-rules` が存在しない場合、共通ルールは読み込まれない。
