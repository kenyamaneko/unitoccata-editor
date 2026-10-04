#!/usr/bin/env bash
# git commit 直前に、機械検出できる unitoccata-editor ルール違反を検出する。
#
# 対象は grep で偽陽性なく判定できるルールに限る。意味解釈が要るルール
# (What コメント / マジックナンバー / 一関数一責務 等) は pre-commit-claude-audit.sh が担当する。
#
# 違反の分類と exit コントラクト (Claude Code hook 規約):
# - HARD 違反あり  → exit 2。stderr を worker に返して commit をブロックする
# - SOFT 違反のみ  → permissionDecision=ask を stdout に返し、user に許否を委ねる
# - 違反なし / 対象外 → exit 0
# - 監査不能 (入力欠落 / JSON parse 失敗) → exit 2 で フェイルクローズ
#
# 呼び出し: .claude/settings.json の PreToolUse hook (Bash matcher) から stdin 経由で JSON を受け取る。

set -uo pipefail

input=$(cat)
if [ -z "$input" ]; then
  printf '⚠️  pre-commit-machine-audit: 空入力で起動。監査不能のため fail-safe で commit ブロック。\n' >&2
  exit 2
fi
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)
jq_rc=$?
if [ "$jq_rc" -ne 0 ]; then
  printf '⚠️  pre-commit-machine-audit: JSON parse 失敗 (jq exit %d)。監査不能のため fail-safe で commit ブロック。\n' "$jq_rc" >&2
  exit 2
fi

# 文字列リテラル / HEREDOC 内の偶発マッチを避けるため、コマンドの「実行可能部分」だけを抽出。
exec_cmd=$(printf '%s' "$cmd" | sed -E '/<</q' | sed -E 's/"[^"]*"//g; s/'\''[^'\'']*'\''//g')

if ! printf '%s' "$exec_cmd" | grep -qE '(^|[[:space:]&|;`(])git[[:space:]]+commit'; then
  exit 0
fi
if printf '%s' "$exec_cmd" | grep -qE 'git[[:space:]]+commit[[:space:]]+(--help|-h)([[:space:]]|$)'; then
  exit 0
fi

# commit コマンドの書き方 (git -C / cd 先) で監査がスキップされないようにするため、複数手段で解決する。
target_cwd=$(printf '%s' "$cmd" | grep -oE 'git[[:space:]]+-C[[:space:]]+"?[^"&|;[:space:]]+' | head -1 | sed -E 's|^git[[:space:]]+-C[[:space:]]+"?||')
if [ -z "$target_cwd" ]; then
  before_commit=$(printf '%s' "$cmd" | sed -E 's/git[[:space:]]+commit.*//')
  target_cwd=$(printf '%s' "$before_commit" | grep -oE '(^|[&|;[:space:]])cd[[:space:]]+"?[^"&|;[:space:]]+' | tail -1 | sed -E 's|.*cd[[:space:]]+"?||')
fi
if [ -z "$target_cwd" ]; then
  target_cwd=$(printf '%s' "$input" | jq -r '.cwd // ""' 2>/dev/null)
fi
if [ -z "$target_cwd" ]; then
  target_cwd=$(pwd)
fi
if ! cd "$target_cwd" 2>/dev/null; then
  printf '⚠️  pre-commit-machine-audit: cd "%s" 失敗、監査をスキップ\n' "$target_cwd" >&2
  exit 0
fi
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# commit 先が unitoccata-editor 本体でなければ (別リポ / 無関係な worktree) unitoccata-editor ルールを当てないため監査しない。
repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
repo_top=$(git rev-parse --show-toplevel 2>/dev/null)
if [ "$(cd "$repo_top" 2>/dev/null && pwd -P)" != "$repo_dir" ]; then
  exit 0
fi

staged=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null)
if [ -z "$staged" ]; then
  exit 0
fi

hard_violations=()
soft_violations=()

# --- (1/SOFT) CLAUDE.md 編集 (principles.md: 人間が運用、例外的に許可があった場合のみ Claude 可) ---
# user 自身が更新して commit を Claude に依頼するケースがあるため SOFT。
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    CLAUDE.md|*/CLAUDE.md)
      soft_violations+=("$f  [CLAUDE.md は原則 Claude が書き換えない (principles.md)]")
      ;;
  esac
done <<< "$staged"

# --- (2/SOFT) rules/ 配下 編集 (principles.md 禁止事項: Claude が書き換えない、提案までに留める) ---
# 明示許可があった場合のみ Claude 可のため SOFT。
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    rules/*|*/rules/*)
      soft_violations+=("$f  [rules/ 配下は Claude が書き換えない (principles.md 禁止事項)]")
      ;;
  esac
done <<< "$staged"

# --- (3/HARD) 新規 workflow に timeout-minutes / concurrency 必須 (cicd.md CI方針) ---
# 各ステップへの name 付与は step 配列の構造解析が要り grep では偽陽性が出るため、意味解釈側 (claude-audit) に委ねる。
# paths-ignore の要否は required status check に使う workflow かどうかで分かれ grep では判定できないため、意味解釈側に委ねる。
added_workflows=$(git diff --cached --name-only --diff-filter=A 2>/dev/null | grep -E '\.github/workflows/.+\.ya?ml$' || true)
while IFS= read -r f; do
  [ -z "$f" ] && continue
  content=$(git show ":$f" 2>/dev/null || cat "$f" 2>/dev/null || true)
  if [ -n "$content" ]; then
    if ! printf '%s' "$content" | grep -qE '^[[:space:]]*timeout-minutes[[:space:]]*:'; then
      hard_violations+=("$f  [新規 workflow に timeout-minutes が必要 (cicd.md CI方針)]")
    fi
    if ! printf '%s' "$content" | grep -qE '^[[:space:]]*concurrency[[:space:]]*:'; then
      hard_violations+=("$f  [新規 workflow に concurrency が必要 (cicd.md CI方針)]")
    fi
  fi
done <<< "$added_workflows"

hard_n=${#hard_violations[@]}
soft_n=${#soft_violations[@]}

if [ "$hard_n" -eq 0 ] && [ "$soft_n" -eq 0 ]; then
  exit 0
fi

if [ "$hard_n" -gt 0 ]; then
  {
    printf '\n❌ pre-commit-machine-audit: HARD 違反 %d 件 / SOFT 違反 %d 件を検出 (target: %s)\n\n' "$hard_n" "$soft_n" "$target_cwd"
    printf '[HARD] commit ブロック対象:\n'
    for v in "${hard_violations[@]}"; do
      printf '  - %s\n' "$v"
    done
    if [ "$soft_n" -gt 0 ]; then
      printf '\n[SOFT] (HARD があるので合わせてブロック):\n'
      for v in "${soft_violations[@]}"; do
        printf '  - %s\n' "$v"
      done
    fi
    printf '\n意味解釈が必要なルールは本 hook 対象外。pre-commit-claude-audit.sh で別途確認される。\n'
  } >&2
  exit 2
fi

reason=$(
  printf '機械検出した SOFT 違反 %d 件:\n' "$soft_n"
  for v in "${soft_violations[@]}"; do
    printf '  - %s\n' "$v"
  done
  printf '\n意図的な編集 (user による手動修正等) なら許可、想定外なら拒否してください。'
)
jq -nc --arg r "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason: $r
  }
}'
exit 0
