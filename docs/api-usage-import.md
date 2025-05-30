# API使用量データCSVインポート機能

## 概要

API使用量データCSVインポート機能は、Anthropicのコンソールからダウンロードしたトークン使用量データをAppGeniusシステムにインポートし、組織・ユーザー別の使用量管理と可視化を行うための機能です。この機能により、Claude Code CLIが直接Anthropic APIを呼び出す場合でも、トークン使用量を正確に追跡し、課金や予算管理に活用することができます。

## 主要機能

1. **CSVデータのインポート**
   - Anthropicコンソールからダウンロードした使用量CSVファイルのアップロード
   - APIキーIDをベースにしたユーザーとの関連付け
   - 重複データの検出と除外

2. **データ処理と集計**
   - 使用量データの解析とデータベースへの保存
   - 組織・ワークスペース・ユーザー別の使用量集計
   - APIキー単位の使用統計更新

3. **使用量可視化**
   - ダッシュボードでの使用量グラフ表示
   - 期間別（日次・月次）使用量集計
   - 予算使用率の監視

## 技術仕様

### バックエンド実装

#### CSVデータ処理コントローラー
- `adminConfig.controller.js` に `importCsvUsageData` メソッドを実装
- CSVファイルの解析と検証
- データベースへの使用量データ保存
- ユーザー統計の更新

#### APIエンドポイント
- POST `/api/admin/organizations/:organizationId/import-usage-csv`

#### 使用ライブラリ
- csv-parser: CSVファイルの解析
- multer: ファイルアップロード処理
- mongoose: データベース操作

### フロントエンド実装

#### コンポーネント
- UsageImporter: CSVアップロードとインポートUI
- OrganizationUsage: 組織別使用量表示とインポート機能統合

#### 機能
- ドラッグ&ドロップCSVアップロード
- インポート結果表示
- 使用量グラフ自動更新

### データモデル連携

#### ApiUsage Model
- リクエスト、トークン使用量、時間情報の保存
- 組織・ワークスペース・ユーザーとの関連付け

#### User Model
- APIキー情報と使用統計の更新
- 累積トークン使用量の管理

## ユーザーフロー

1. 管理者がAnthropicコンソールからCSVデータをエクスポート
2. AppGeniusの組織使用量画面でCSVインポート機能を実行
3. アップロードしたCSVファイルが解析され、ユーザーとの関連付けが行われる
4. インポート結果とユーザー別集計が表示される
5. 使用量ダッシュボードが更新され、最新データが反映される

## セキュリティ考慮事項

- スーパー管理者またはOrg管理者のみがCSVインポート可能
- ファイルサイズ制限と型チェックを実施
- 組織間のデータ分離を徹底
- 処理エラーの詳細ログ記録

## 制限事項

- APIキーIDがシステムに登録されていないユーザーのデータは組織管理者に関連付け
- 過去のデータのみインポート可能（リアルタイムデータではない）
- 重複データは自動的にスキップ

## 運用ガイドライン

1. 月次レポート作成時などの定期的なタイミングでCSVをインポート
2. 大量データの場合は時間をおいて分割インポート
3. インポート後は必ず使用量ダッシュボードで正確に反映されているか確認
4. 異常データがある場合はログを確認して原因を特定

## 展望と拡張予定

- 自動インポートスケジューリング
- Anthropic APIとの直接連携（APIが提供された場合）
- 予算アラート機能の強化
- 高度なレポート機能の追加