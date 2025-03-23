# 組織ユーザー管理機能スコープ（改訂版）

## 概要

組織管理者がブラウザ上でユーザーを追加・管理できる機能を実装し、サブスクリプションプランに基づくユーザー数上限管理を導入する。各ユーザーには固有のAnthropicのAPIキーを割り当て、正確な使用量追跡と制限を実現する。これにより企業顧客が自社のメンバーを自立的に管理できるようになり、B2B展開における重要な機能要件を満たす。

## 目的

- 企業（組織）管理者がWebインターフェースから自社ユーザーを管理できるようにする
- ユーザーごとに固有のAnthropicのAPIキーを割り当て、正確な使用量制限を実現する
- サブスクリプションプランに連動したユーザー数上限を設定・管理する
- メール招待ベースのユーザー追加フローを完成させる
- ユーザー権限管理の操作性と視認性を向上させる

## 実装内容

### 1. データモデルの拡張

#### Organization モデルの拡張
```javascript
// 追加フィールド
maxUsers: {
  type: Number,
  default: 5,  // デフォルトは5ユーザー
  min: 1,
  max: 10000
},

// APIキープール（割り当て前のキー）
availableApiKeys: [{
  keyId: String,      // Anthropic管理ID
  apiKey: String,     // 暗号化したAPIキー
  name: String,       // キー名（識別用）
  description: String // 説明
}],

pendingInvites: [{
  email: String,
  role: String,
  invitedBy: {
    type: mongoose.Types.ObjectId,
    ref: 'User'
  },
  token: String,
  expiresAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
}]
```

#### ユーザーAPIキーマッピングの拡張
```javascript
// User モデルに追加
// ユーザーのAPIキー情報
apiKeyInfo: {
  keyId: String,         // AnthropicのAPIキーID
  lastUsed: Date,        // 最終使用日時
  status: {
    type: String,
    enum: ['active', 'disabled', 'revoked'],
    default: 'active'
  },
  organizationId: {      // 割り当て元組織
    type: mongoose.Types.ObjectId,
    ref: 'Organization'
  },
  usageStats: {
    tokenCount: Number,  // 累計使用トークン数
    lastSynced: Date     // 最終同期日時
  }
}
```

#### 招待トークンモデルの作成
```javascript
const InvitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['member', 'admin'],
    default: 'member'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});
```

### 2. バックエンドAPI

#### APIキー管理API（SuperAdmin用）
- `POST /api/organizations/:id/api-keys/pool` - 組織のAPIキープールに追加
- `GET /api/organizations/:id/api-keys/pool` - 未割り当てAPIキー一覧の取得
- `DELETE /api/organizations/:id/api-keys/pool/:keyId` - 未割り当てAPIキーの削除
- `POST /api/organizations/:id/api-keys/sync` - Anthropicから組織のAPIキー使用状況を同期

#### 招待関連API
- `POST /api/organizations/:id/invitations` - メンバー招待の作成（APIキー自動割り当て）
- `GET /api/organizations/:id/invitations` - 招待一覧の取得
- `DELETE /api/organizations/:id/invitations/:invitationId` - 招待のキャンセル
- `POST /api/invitations/:token/accept` - 招待の承諾（新規登録）
- `POST /api/invitations/:token/login` - 招待の承諾（既存ユーザー）

#### ユーザー管理API
- `GET /api/organizations/:id/members` - メンバー一覧の取得（APIキー情報含む）
- `PATCH /api/organizations/:id/members/:userId` - メンバーの役割更新
- `DELETE /api/organizations/:id/members/:userId` - メンバーの削除（APIキー回収）
- `POST /api/organizations/:id/members/:userId/disable` - メンバーのAPIキーを一時無効化
- `POST /api/organizations/:id/members/:userId/enable` - メンバーのAPIキーを再有効化
- `POST /api/organizations/:id/members/:userId/reassign-key` - 新しいAPIキーを割り当て

#### 上限・使用量管理API
- `GET /api/organizations/:id/limits` - 上限情報の取得
- `PATCH /api/organizations/:id/limits` - 上限の更新（Super Admin用）
- `GET /api/organizations/:id/usage/by-user` - ユーザー別使用量の取得
- `GET /api/users/:id/usage` - 特定ユーザーの詳細使用履歴

### 3. フロントエンド UI 実装

#### 組織管理者向け画面
- 組織メンバー一覧ビュー
  - メンバーのリスト表示（名前、メール、役割、最終ログイン）
  - APIキー状態（アクティブ/無効）とトークン使用量表示
  - ページネーション対応
  - 検索・フィルター機能
- 招待管理ビュー
  - 未処理招待のリスト表示
  - 招待状態（保留中、期限切れ）の表示
  - 招待の取り消し機能
  - 残りの招待可能数表示（APIキー在庫状況連動）
- メンバー招待フォーム
  - メールアドレス入力（複数可）
  - 役割選択（メンバー/管理者）
  - カスタムメッセージ入力
  - 一括招待機能（使用可能APIキー数による制限表示）
- メンバー詳細ビュー
  - ユーザー情報の表示
  - 権限管理インターフェース
  - 使用量グラフ（トークン使用統計）
  - APIキー状態管理（無効化/再有効化/再割り当て）
  - 詳細使用履歴表示

#### Super Admin向け画面
- 組織詳細ページに上限設定セクション追加
  - ユーザー数上限設定
  - APIキー管理インターフェース
  - APIキープール管理（追加/削除/状態確認）
  - 割り当て済みAPIキー一覧と状態表示
- APIキー管理ダッシュボード
  - 組織別APIキー割り当て状況
  - 新規APIキー追加フォーム（複数キー一括登録可）
  - APIキー使用状況グラフ
  - 異常使用パターン検出

#### ユーザー向け画面
- 招待承諾フロー
  - 招待確認ページ
  - アカウント作成フォーム（新規ユーザー）
  - ログインフォーム（既存ユーザー）
  - 組織スイッチャー（複数組織所属ユーザー用）

### 4. メール通知システム

- 招待メールテンプレート
  - 組織名、招待者名の表示
  - 招待承諾リンク
  - 有効期限の表示
  - カスタムメッセージの表示
- リマインダーメールテンプレート
  - 未処理招待の通知
  - 期限切れ前の通知
- ユーザーアクション通知
  - 招待承諾通知
  - メンバー追加/削除通知
  - 役割変更通知

### 5. APIキー管理と検証メカニズム

- APIキープール管理
  - Anthropicコンソールで作成したAPIキーの一括登録機能
  - キー名の自動生成（組織名_連番など）
  - APIキーの暗号化保存と復号化メカニズム
  - キーの定期的な有効性確認

- 招待作成時の検証
  - 現在のメンバー数 + 保留中招待数 < 上限
  - 同一メールへの重複招待防止
  - ドメイン制限(オプション)
  - **未割り当てAPIキーの在庫確認**（不足時は招待を制限）

- メンバー追加時の検証
  - 現在のメンバー数 < 上限
  - 同一メールの重複登録防止
  - APIキーの自動割り当て処理

- ユーザー認証ファイル生成
  - ユーザー固有のAPIキーを含む認証ファイル生成
  - ClaudeCode CLI用設定の自動更新
  - 認証ファイルの安全な配布

- 使用量監視メカニズム
  - Admin APIを使用した定期的なAPIキー使用量同期
  - ユーザー別使用量の記録と集計
  - アラートしきい値の設定と通知
  - 上限超過時の自動制限メカニズム

## 開発ステップ

1. APIキー管理基盤の構築
   - Organizationモデルと User モデルの拡張（APIキー関連フィールド追加）
   - APIキーの安全な暗号化・復号化メカニズムの実装
   - APIキープール管理機能の実装（SuperAdmin用）

2. データモデル拡張と基本API実装
   - Invitation モデルの作成
   - APIキー割り当て自動化処理の実装
   - 招待・ユーザー管理の基本APIエンドポイント実装

3. SuperAdmin用APIキー管理機能
   - APIキー一括登録インターフェース実装
   - 組織へのAPIキー割り当て機能
   - APIキー使用状況モニタリング機能

4. 招待・ユーザー管理システム
   - メンバー招待フロー（APIキー自動割り当て機能付き）
   - メンバー管理画面実装
   - APIキー状態管理（有効化/無効化）機能

5. 認証ファイル生成と配布
   - ユーザー固有APIキーを含む認証ファイル生成機能
   - ClaudeCode CLI連携機能の実装
   - 安全な配布メカニズムの構築

6. メール通知システム
   - メールテンプレート作成
   - 送信処理実装
   - APIキー関連通知の追加

7. 使用量モニタリングと制限機能
   - Admin API連携による使用量同期機能
   - ユーザー別使用量レポート機能
   - 上限到達時の自動制限メカニズム

8. 検証とテスト
   - 単体テスト作成
   - 統合テスト作成
   - E2Eテスト実装
   - APIキー管理の安全性検証

## 技術的考慮事項

- APIキーのセキュリティ
  - 暗号化保存（AES-256など）とキー管理
  - トランスポート時の保護（TLS）
  - きめ細かなアクセス制御
  - ログイン後のみ復号化アクセス可能に

- 認証システムとの連携
  - ユーザー固有APIキーを認証ファイルに安全に統合
  - VSCode拡張とClaudeCode CLIへの連携
  - ログイン/ログアウト時のAPIキー情報管理

- 使用量監視と制限
  - Anthropic Admin APIとの定期的同期
  - 実時間での使用量モニタリング方法
  - 制限到達時の優雅な対応（警告→遅延→ブロック）

- 招待・ユーザー管理
  - ユーザー招待トークンの安全な生成と検証
  - メール送信の信頼性確保（リトライ、配信確認など）
  - 複数組織所属ユーザーの権限管理
  - 同時編集による競合の回避

- スケーラビリティとパフォーマンス
  - 大量APIキー管理のパフォーマンス対策
  - 使用量データの効率的な集計方法
  - Admin API呼び出しの最適化（レート制限考慮）

## 期待される成果

- **正確なユーザー単位の使用量管理**
  - ユーザーごとに固有APIキーを割り当てることによる正確な使用量追跡
  - 企業契約における明確な課金根拠の提供
  - 不正使用の防止と異常検知

- **企業向け自己管理機能**
  - 組織管理者による自立的なユーザー管理
  - サブスクリプションプランに応じたユーザー数の適切な管理
  - メール招待を通じた新規ユーザーの円滑な導入
  - APIキーの状態（有効/無効）のきめ細かな管理

- **セキュリティと費用対効果の向上**
  - APIキーの粒度を高めることによるセキュリティ強化
  - 未使用APIキーの迅速な発見と回収
  - 使用状況の可視化による適切なリソースアロケーション

- **スケーラブルな企業導入**
  - ユーザー数拡張時の明確なプロセス提供
  - 一括招待とキー割り当ての効率化
  - 企業規模に応じた段階的な導入支援

## リスクと緩和策

| リスク | 緩和策 |
|-------|-------|
| **APIキーの漏洩** | 暗号化保存、認証要件、アクセスログ、定期的なローテーション |
| **認証ファイル改ざん** | チェックサム検証、署名、アクセス制限、改ざん検知 |
| **APIキー在庫不足** | 事前アラート、自動注文提案、予備プール、緊急割り当て手順 |
| **使用量同期の遅延** | バッファリング、定期キャッシュ更新、概算値表示、非同期更新 |
| **メール配信の失敗** | 送信リトライ、配信失敗通知、代替招待方法、SMS代替通知 |
| **招待トークンの漏洩** | 短い有効期限、ワンタイム使用、IP制限、二要素認証オプション |
| **データ整合性の問題** | トランザクション処理、定期的な整合性チェック、監査ログ |
| **アクセス権限の偶発的変更** | 変更確認ステップ、権限変更通知、復元機能、変更履歴 |
| **Anthropic API制限変更** | 定期的なAPI仕様確認、互換性監視、グレースフルデグラデーション |

## 優先順位と実装順序

1. **APIキー管理基盤の構築**
   - APIキーの暗号化保存と管理機能
   - SuperAdmin向けAPIキープール管理機能
   - 初期ユーザー-APIキーマッピング構造

2. **基本的なユーザー管理UI**
   - 組織メンバー一覧と役割管理
   - APIキー状態表示と基本管理
   - 使用量の基本可視化

3. **招待とアカウント作成フロー**
   - APIキー自動割り当て機能
   - メール招待送信と承諾フロー
   - 認証ファイル自動生成と配布

4. **使用量管理と同期機能**
   - Admin API連携による使用量同期
   - ユーザー別使用量レポート
   - 使用制限の設定と適用

5. **高度な管理機能**
   - 大量ユーザー一括招待
   - APIキー使用異常検知
   - 詳細レポートとダッシュボード

6. **セキュリティ強化と最適化**
   - APIキー管理の監査とセキュリティレビュー
   - パフォーマンス最適化
   - バックアップと回復手順