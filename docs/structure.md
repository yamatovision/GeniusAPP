# AppGenius プロジェクトディレクトリ構造

このファイルはAppGeniusプロジェクトの理想的なディレクトリ構造を定義します。実際の構造と異なる場合は、このファイルをリファクタリングの目標として参照してください。

```
AppGenius/
├── .vscode/                      # VSCode設定
│   ├── launch.json               # デバッグ設定
│   └── tasks.json                # タスク設定
├── docs/                         # ドキュメント
│   ├── requirements.md           # 要件定義
│   ├── structure.md              # ディレクトリ構造
│   ├── scope.md                  # 実装スコープ
│   ├── api.md                    # API設計
│   ├── env.example               # 環境変数例
│   └── CURRENT_STATUS.md         # 現在の開発状況
├── mockups/                      # モックアップ画像
├── src/                          # VSCode拡張ソース
│   ├── extension.ts              # エントリーポイント
│   ├── core/                     # コアロジック
│   │   ├── ClaudeMdService.ts    # CLAUDE.md管理
│   │   ├── AIService.ts          # AI連携
│   │   └── CLIBridgeService.ts   # CLI連携
│   ├── ui/                       # UI関連
│   │   ├── dashboard/            # ダッシュボード
│   │   ├── requirementManager/   # 要件定義マネージャー
│   │   ├── mockupGallery/        # モックアップギャラリー
│   │   ├── scopeManager/         # スコープマネージャー
│   │   ├── developmentAssistant/ # 開発アシスタント
│   │   └── components/           # 共通コンポーネント
│   ├── utils/                    # ユーティリティ
│   └── types/                    # 型定義
├── appgenius-cli/                # CLI機能
│   ├── src/                      # CLIソース
│   │   ├── index.ts              # エントリーポイント
│   │   ├── commands/             # コマンド定義
│   │   ├── services/             # サービス
│   │   └── utils/                # ユーティリティ
│   └── launch-appgenius.sh       # 起動スクリプト
├── media/                        # アセット
│   ├── icons/                    # アイコン
│   └── css/                      # スタイルシート
├── test/                         # テスト
│   ├── extension.test.ts         # 拡張機能テスト
│   └── cli.test.ts               # CLIテスト
├── CLAUDE.md                     # プロジェクト中心ドキュメント
├── package.json                  # パッケージ設定
└── README.md                     # プロジェクト概要
```

## コア構造の説明

### VSCode拡張とCLI連携

VSCode拡張とCLIは`CLAUDE.md`を通じて連携します:
1. VSCodeは設計情報の構造化されたエディタとして機能
2. CLIはClaudeCodeとの連携を担当し実装を支援
3. 両者はファイルシステムを介して状態を同期

### ファイル保存構造

ユーザーのプロジェクト生成物は以下のように保存されます:
1. 要件定義: `docs/requirements.md`
2. ディレクトリ構造: `docs/structure.md`
3. モックアップ: `mockups/` ディレクトリ
4. スコープ定義: `docs/scope.md`
5. API設計: `docs/api.md`

### リファクタリング方針

現在のコードベースをこの構造に近づけていくために:
1. 重複するファイルの統合
2. 明確なモジュール境界の確立
3. サービス間の責任分離
4. UIコンポーネントの整理
