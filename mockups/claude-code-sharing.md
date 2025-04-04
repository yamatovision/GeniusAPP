# ClaudeCode共有機能 要件定義書

## 1. 機能概要

### 目的
AppGeniusのスコープマネージャーとClaudeCode間でテキストデータや画像を効率的に共有するための機能を提供します。ユーザーがエラーログや長文テキスト、スクリーンショットなどをClaudeCodeと容易に共有できるようにすることで、開発ワークフローを円滑化します。

### 主要機能
- テキストデータの共有（エラーログ、コード、開発メモなど）
- 画像の共有（スクリーンショット、UI参照画像など）
- 共有履歴の管理
- コピー可能なコマンド生成

## 2. ユーザーインターフェース

### 基本UI構成
1. **共有トグルボタン**
   - スクリーン下部に常時表示
   - クリックで共有パネルを展開/折りたたみ

2. **共有パネル**
   - テキスト入力エリア
   - 画像ドロップゾーン
   - 共有履歴リスト
   - アクションボタン（保存、クリア）

3. **結果表示エリア**
   - 共有成功時のフィードバック
   - コピー可能なコマンド表示
   - クリップボードコピーボタン

### インタラクション設計
- ドラッグ＆ドロップによる画像アップロード
- ワンクリックでの共有実行
- コマンドのコピー機能
- 共有履歴からの再利用機能

## 3. データモデル設計

### 共有ファイルのデータモデル
```typescript
interface SharedFile {
  id: string;               // 一意のID
  fileName: string;         // 生成されたファイル名
  originalName?: string;    // 元のファイル名（ユーザーが設定可能）
  title?: string;           // タイトル（ユーザーが設定可能）
  type: 'text' | 'image';   // ファイルタイプ
  size: number;             // ファイルサイズ（バイト）
  format: string;           // ファイル形式（テキストならプレーンテキスト、画像ならPNG/JPG等）
  createdAt: Date;          // 作成日時 
  expiresAt: Date;          // 有効期限
  path: string;             // ファイルパス
  accessCount: number;      // アクセス回数
  isExpired: boolean;       // 有効期限切れフラグ
  metadata: {               // 追加メタデータ（拡張性のため）
    [key: string]: any;
  }
}
```

### 共有履歴のデータモデル
```typescript
interface SharingHistory {
  items: SharedFile[];      // 共有ファイルのリスト
  lastUpdated: Date;        // 最終更新日時
}
```

### ファイル管理サービス
```typescript
interface FileManagementService {
  // ファイル保存
  saveFile(content: string | Buffer, options: {
    type: 'text' | 'image';
    title?: string;
    format?: string;
    expirationHours?: number; // デフォルト24時間
  }): Promise<SharedFile>;
  
  // ファイル取得
  getFile(id: string): Promise<SharedFile | null>;
  
  // 履歴の取得
  getHistory(limit?: number): Promise<SharedFile[]>;
  
  // 期限切れファイルのクリーンアップ
  cleanupExpiredFiles(): Promise<void>;
  
  // ファイルの削除
  deleteFile(id: string): Promise<boolean>;
}
```

### 設定モデル
```typescript
interface SharingSettings {
  // 基本設定
  defaultExpirationHours: number;  // デフォルト有効期限（時間）
  maxHistoryItems: number;         // 履歴に保存する最大アイテム数
  
  // ファイル制限
  maxTextSize: number;             // テキスト最大サイズ（文字数）
  maxImageSize: number;            // 画像最大サイズ（バイト）
  allowedImageFormats: string[];   // 許可される画像形式
  
  // 詳細設定
  preserveHistoryBetweenSessions: boolean;  // セッション間で履歴を保持するか
  baseStoragePath: string;                  // 保存先ベースパス
}
```

### イベントモデル
```typescript
enum SharingEventType {
  FILE_CREATED = 'file_created',
  FILE_ACCESSED = 'file_accessed',
  FILE_EXPIRED = 'file_expired',
  FILE_DELETED = 'file_deleted'
}

interface SharingEvent {
  type: SharingEventType;
  fileId: string;
  timestamp: Date;
  metadata?: any;
}

interface SharingEventBus {
  emit(event: SharingEvent): void;
  subscribe(type: SharingEventType, handler: (event: SharingEvent) => void): void;
  unsubscribe(type: SharingEventType, handler: (event: SharingEvent) => void): void;
}
```

## 4. 技術仕様

### データフロー
1. ユーザーがテキスト入力または画像アップロード
2. 「一時ファイルに保存」ボタンをクリック
3. データを一時ディレクトリに保存（ファイル）とメタデータを管理（VSCode拡張のglobalState）
4. ファイルへのアクセスコマンドを生成
5. ユーザーがコマンドをコピーしてClaudeCodeで実行

### ファイル保存仕様
- **保存場所**: `/tmp/claude-share/` ディレクトリ
  - テキスト: `/tmp/claude-share/shared_[日時]_[ランダム文字列].txt`
  - 画像: `/tmp/claude-share/images/image_[日時]_[ランダム文字列].png`

- **ファイル名生成規則**:
  - 日時フォーマット: `YYYYMMDD_HHMMSS`
  - ランダム文字列: 6文字の英数字

### 共有履歴管理
- 最新の共有を先頭に表示
- 各履歴項目に対して再利用・削除操作を提供
- セッション間で履歴を保持（設定により変更可能）
- 最大履歴保存件数を設定可能（デフォルト20件）

## 5. セキュリティ要件

### データ保護
- 一時ファイルは24時間後に自動削除
- 機密情報を含む可能性のあるデータを適切に保護
- ファイル名にランダム性を持たせてアクセス予測を困難に
- 拡張起動時に期限切れファイルの自動クリーンアップ

### バリデーション
- テキスト入力とファイルアップロード時に以下を検証:
  - ファイルサイズ上限（画像: 10MB）
  - テキスト長の制限（100,000文字まで）
  - 許可される画像フォーマット（PNG, JPG, JPEG, GIF）
- エラーメッセージを表示しユーザーに通知

### 制限事項
- 画像ファイルサイズ上限: 10MB
- テキスト長の制限: 100,000文字まで
- サポートする画像フォーマット: PNG, JPG, JPEG, GIF
- 最大同時保存ファイル数: 100ファイル（自動クリーンアップ対象）

## 6. 実装予定ファイル

### VSCode拡張側
- `src/ui/scopeManager/ScopeManagerPanel.ts`: 共有パネルの基本UIを追加
- `src/services/ClaudeCodeSharingService.ts`: 共有サービスの実装
- `src/utils/TempFileManager.ts`: 一時ファイル管理機能
- `src/types/SharingTypes.ts`: 共有機能に関する型定義

### フロントエンド（Webview）
- `media/scopeManager.js`: 共有パネルの動作制御
- `media/scopeManager.css`: 共有パネルのスタイル定義
- `media/components/sharingPanel.js`: 共有パネルコンポーネント

## 7. 階層的クラス構造

```typescript
// 基本共有サービス
class BaseSharingService implements FileManagementService {
  // 共通機能の実装
  // ファイル管理、履歴管理、イベント処理など
}

// テキスト共有サービス
class TextSharingService extends BaseSharingService {
  // テキスト特有の機能
  // テキスト検証、フォーマット調整など
}

// 画像共有サービス
class ImageSharingService extends BaseSharingService {
  // 画像特有の機能
  // 画像検証、リサイズ、変換処理など
}

// 履歴管理
class SharingHistoryManager {
  // 共有履歴の保存、復元、削除機能
  // セッション間の状態保持
}
```

## 8. 今後の拡張可能性

### 短期的拡張
- 特定のClaudeCodeセッションを指定して送信
- 複数ファイルの一括共有
- ファイル形式のプレビュー表示

### 長期的拡張
- WebSocketを利用したリアルタイム共有
- ClaudeCodeからの直接レスポンス連携
- VSCode拡張設定からの共有設定カスタマイズ

## 9. 実装方針

この機能はファイルシステムを介したデータ共有を基本とし、ClaudeCodeとの直接的な連携を実現します。一時ファイルを介した共有は、現状のVSCode拡張の制限を回避しながら、効率的なデータ交換を可能にします。

具体的な実装アプローチ:

1. **一時ファイルとメタデータの分離**:
   - ファイル自体は一時ディレクトリに保存
   - メタデータはJSON形式で別途管理（VSCode拡張のglobalState）

2. **フロントエンドとバックエンドの分離**:
   - UIコンポーネント: メタデータの表示と操作
   - サービス層: ファイル操作とメタデータ管理
   - イベント層: 状態変更の通知と反映

3. **有効期限の管理**:
   - 共有時に有効期限を設定
   - 拡張起動時に期限切れファイルをチェックしクリーンアップ
   - バックグラウンドでの定期的なクリーンアップ

最終的には、VSCodeとClaudeCodeセッション間でのよりシームレスな通信を実現するために、拡張される可能性があります。