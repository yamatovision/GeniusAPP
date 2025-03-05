

# 更新後のディレクトリ構造の概要

実装されたベストなディレクトリ構造では、以下の主な変更が行われました：

1. CLIの削除：
   - CLI部分は不要となり、代わりにClaudeCodeとの直接連携に変更
   - CLILauncherServiceをClaudeCodeLauncherServiceに変更
   - イベントタイプもClaudeCode関連に修正

2. ディレクトリ構造の最適化：
   - 現在の実装を尊重したまま、理想的な構造との整合性を取った
   - 特にUI部分の構造を整理し、機能ごとにサブディレクトリを設計
   - webview部分を明確に構造化

3. CLAUDE.md中心の連携方式：
   - VSCode拡張とClaudeCodeの連携にCLAUDE.mdを中心とした方式を採用
   - VSCode拡張で設計情報を整理し、ClaudeCodeで実装を行う分業体制
   - 各フェーズで生成されるファイルの保存場所と形式を明確に定義

これによって、非技術者でも理解しやすい開発フローと、ClaudeCodeとの自然な連携が実現されます。
