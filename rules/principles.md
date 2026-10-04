> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# unitoccata-editor 固有ルール (overlay)

## [unitoccata-editor] 譜面ファイルと変換

- tick と秒の変換、long の横位置の補間は、Unity 側 (Hoge Fugue) と同じ結果になる実装にする

## [unitoccata-editor] ドメイン用語

- 譜面のドメイン用語は用語集 (glossary.md) に従う

## [unitoccata-editor] 描画とUIの分担

- タイムラインとプレビューは Canvas に描く。React はメニューと設定ダイアログを担当し、ノーツを DOM 要素にしない
