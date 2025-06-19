# 機能拡張計画: BlueLamp CLI - Claude Code SDK統合 [2025-06-19]

## 1. 拡張概要

BlueLamp CLIにClaude Code SDKを統合し、プロンプト保護を維持しながら高度な機能を利用可能にする。現在の独自実装の約70%を削除し、SDKの標準機能に置き換えることで、メンテナンス性を大幅に向上させる。

## 2. 詳細仕様

### 2.1 現状と課題

**現在の実装**:
- 独自のツールシステム（Read, Write, Edit等）を実装
- Anthropic SDKを直接利用してAPI通信
- 手動でのメッセージ管理とセッション管理
- REPLループの独自実装

**課題**:
- メンテナンスコストが高い
- Claude Code SDKの新機能（MCP、ストリーミング等）が利用できない
- セッション管理が限定的
- エラーハンドリングが基本的

### 2.2 拡張内容

**統合方針**:
1. プロンプト保護機能は維持（URLベースの取得）
2. Claude Code SDKを子プロセスとして利用
3. 独自ツール実装を削除し、SDKの標準ツールを使用
4. MCP統合、ストリーミング、高度なセッション管理を活用

**新機能**:
- MCP（Model Context Protocol）によるカスタムツール統合
- リアルタイムストリーミング出力
- セッションの永続化と再開機能
- 柔軟なツール許可/禁止設定
- 高度なエラーハンドリングとリトライ機能

## 3. ディレクトリ構造

```
bluelamp-cli/
├── src/
│   ├── index.ts                    # 変更なし
│   ├── config/
│   │   └── agents.ts              # 保持
│   ├── core/
│   │   ├── cli.ts                 # 大幅に簡素化
│   │   └── sdk-wrapper.ts         # 新規：SDK統合層
│   ├── tools/                     # 削除（ディレクトリごと）
│   │   ├── base.ts               # 削除
│   │   ├── read.ts               # 削除
│   │   ├── write.ts              # 削除
│   │   ├── edit.ts               # 削除
│   │   ├── bash.ts               # 削除
│   │   ├── glob.ts               # 削除
│   │   ├── grep.ts               # 削除
│   │   └── ls.ts                 # 削除
│   └── tool-manager.ts            # 削除
├── package.json                    # 依存関係を更新
└── README.md                      # 使用方法を更新
```

## 4. 技術的影響分析

### 4.1 影響範囲

- **フロントエンド**: 変更なし（PromptCardsは現状維持）
- **バックエンド**: BlueLamp CLIのコア実装が大幅に変更
- **データモデル**: AgentConfig型定義は維持
- **その他**: package.jsonに@anthropic-ai/claude-codeを追加

### 4.2 変更が必要なファイル

```
- bluelamp-cli/src/core/cli.ts: UnifiedCLIクラスを簡素化
- bluelamp-cli/src/core/sdk-wrapper.ts: 新規作成（SDK統合層）
- bluelamp-cli/src/tool-manager.ts: 削除
- bluelamp-cli/src/tools/: ディレクトリごと削除
- bluelamp-cli/package.json: 依存関係を更新
- bluelamp-cli/README.md: 使用方法とMCP設定を追加
```

## 5. タスクリスト

```
- [ ] **T1**: Claude Code SDKのインストールと設定
- [ ] **T2**: sdk-wrapper.tsの作成（SDK統合層の実装）
- [ ] **T3**: UnifiedCLIクラスの簡素化（SDK利用版に書き換え）
- [ ] **T4**: 独自ツールシステムの削除（tools/ディレクトリとtool-manager.ts）
- [ ] **T5**: プロンプト保護機能の統合（URLベース取得の維持）
- [ ] **T6**: MCP設定サンプルの作成
- [ ] **T7**: エージェント別の動作テスト（16個すべて）
- [ ] **T8**: READMEとドキュメントの更新
```

## 6. テスト計画

### 6.1 機能テスト
1. **プロンプト保護**: URLからのプロンプト取得が正常に動作
2. **エージェント起動**: 16個のエージェントがすべて起動可能
3. **ツール実行**: SDKのツール（Read, Write等）が正常動作
4. **セッション管理**: 会話の継続・再開が可能

### 6.2 統合テスト
1. **MCP統合**: カスタムMCPサーバーとの連携
2. **ストリーミング**: リアルタイム出力の確認
3. **エラーハンドリング**: 異常系の適切な処理

### 6.3 セキュリティテスト
1. **プロンプト流出**: プロンプトがローカルに保存されないことを確認
2. **プロセス監視**: コマンドライン引数にプロンプトが含まれないことを確認

## 7. SCOPE_PROGRESSへの統合

SCOPE_PROGRESS.mdに以下のタスクとして追加：

```markdown
- [ ] **BLUELAMP-SDK-01**: BlueLamp CLI - Claude Code SDK統合
  - 目標: 2025-06-26
  - 参照: [/docs/plans/planning/ext-bluelamp-claude-sdk-20250619.md]
  - 内容: BlueLamp CLIにClaude Code SDKを統合し、プロンプト保護を維持しながら高度な機能を実現
```

## 8. 備考

### 移行時の注意点
1. 既存のBlueLamp CLIユーザーへの影響を最小限に
2. プロンプトURLは変更せず、取得方法も維持
3. エージェントIDやエイリアスは完全互換を保つ

### 将来的な拡張可能性
1. GitHub Actions統合
2. カスタムMCPツールの追加
3. Web UIからのSDK機能利用