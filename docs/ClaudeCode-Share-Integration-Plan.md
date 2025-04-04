# ClaudeCode共有機能統合計画書

## 概要

本計画書は、すでに実装されているClaudeCode共有機能をスコープマネージャーパネルに統合するための詳細な計画を示すものです。共有機能を使用することで、テキストや画像データをClaudeCodeと効率的に共有できるようになります。

## 機能概要

現状で実装済みのコンポーネント:

1. `SharingTypes.ts` - 共有ファイル、履歴、設定などの型定義
2. `TempFileManager.ts` - 一時ファイル管理機能
3. `ClaudeCodeSharingService.ts` - 共有サービス本体
4. `sharingPanel.js` - クライアント側の共有パネル実装
5. `scopeManager.css` - 共有パネルのスタイル定義

## 統合計画

### 1. ScopeManagerPanel.tsへの統合

#### 1.1. クラスへのメンバ追加

```typescript
// ScopeManagerPanel.ts に追加
private _sharingService: ClaudeCodeSharingService | undefined;
```

#### 1.2. インポート文の追加

```typescript
import { ClaudeCodeSharingService } from '../../services/ClaudeCodeSharingService';
```

#### 1.3. サービスの初期化

コンストラクタ内に以下を追加:

```typescript
// コンストラクタ内に追加
this._sharingService = new ClaudeCodeSharingService(context);
```

#### 1.4. プロジェクトパス設定時の初期化処理

`setProjectPath` メソッド内に以下を追加:

```typescript
// プロジェクトパス設定時に共有サービスにも設定
if (this._sharingService) {
  this._sharingService.setProjectBasePath(projectPath);
}
```

### 2. メッセージハンドラの追加

`_panel.webview.onDidReceiveMessage` 内のスイッチ文に以下のケースを追加:

```typescript
case 'shareText':
  await this._handleShareText(message.text);
  break;
case 'shareImage':
  await this._handleShareImage(message.imageData, message.fileName);
  break;
case 'getHistory':
  await this._handleGetHistory();
  break;
case 'deleteFromHistory':
  await this._handleDeleteFromHistory(message.fileId);
  break;
case 'copyCommand':
  await this._handleCopyCommand(message.fileId);
  break;
case 'copyToClipboard':
  await this._handleCopyToClipboard(message.text);
  break;
case 'reuseHistoryItem':
  await this._handleReuseHistoryItem(message.fileId);
  break;
```

### 3. 新規メソッドの実装

#### 3.1. 履歴取得メソッド

```typescript
/**
 * 共有履歴を取得してWebViewに送信
 */
private async _handleGetHistory(): Promise<void> {
  if (!this._sharingService) return;
  
  const history = this._sharingService.getHistory();
  
  this._panel.webview.postMessage({
    command: 'updateSharingHistory',
    history: history
  });
}
```

#### 3.2. テキスト共有メソッド

既存の `_handleShareText` メソッドを更新:

```typescript
/**
 * テキストを共有サービスで共有
 */
private async _handleShareText(text: string): Promise<void> {
  try {
    if (!this._sharingService) {
      this._showError('共有サービスが初期化されていません');
      return;
    }
    
    // 共有サービスを使ってテキストを共有
    const file = await this._sharingService.shareText(text);
    
    // コマンドを生成
    const command = this._sharingService.generateCommand(file);
    
    // 成功メッセージを送信
    this._panel.webview.postMessage({
      command: 'showShareResult',
      data: {
        filePath: file.path,
        command: command,
        type: 'text'
      }
    });
    
  } catch (error) {
    this._showError(`テキストの共有に失敗しました: ${(error as Error).message}`);
  }
}
```

#### 3.3. 画像共有メソッド

既存の `_handleShareImage` メソッドを更新:

```typescript
/**
 * 画像を共有サービスで共有
 */
private async _handleShareImage(imageData: string, fileName: string): Promise<void> {
  try {
    if (!this._sharingService) {
      this._showError('共有サービスが初期化されていません');
      return;
    }
    
    // 共有サービスを使って画像を共有
    const file = await this._sharingService.shareBase64Image(imageData, fileName);
    
    // コマンドを生成
    const command = this._sharingService.generateCommand(file);
    
    // 成功メッセージを送信
    this._panel.webview.postMessage({
      command: 'showShareResult',
      data: {
        filePath: file.path,
        command: command,
        type: 'image'
      }
    });
    
  } catch (error) {
    this._showError(`画像の共有に失敗しました: ${(error as Error).message}`);
  }
}
```

#### 3.4. 履歴からの削除メソッド

```typescript
/**
 * 履歴からアイテムを削除
 */
private async _handleDeleteFromHistory(fileId: string): Promise<void> {
  if (!this._sharingService) return;
  
  const success = this._sharingService.deleteFromHistory(fileId);
  
  if (success) {
    // 履歴を更新して送信
    await this._handleGetHistory();
  }
}
```

#### 3.5. コマンドのコピーメソッド

```typescript
/**
 * ファイルのコマンドをクリップボードにコピー
 */
private async _handleCopyCommand(fileId: string): Promise<void> {
  if (!this._sharingService) return;
  
  // ファイルを履歴から検索
  const history = this._sharingService.getHistory();
  const file = history.find(item => item.id === fileId);
  
  if (file) {
    // コマンドを生成
    const command = this._sharingService.generateCommand(file);
    
    // VSCodeのクリップボード機能を使用
    vscode.env.clipboard.writeText(command);
    
    // アクセスカウントを増やす
    this._sharingService.recordAccess(fileId);
    
    // 成功メッセージを送信
    this._panel.webview.postMessage({
      command: 'commandCopied',
      fileId: fileId
    });
  }
}
```

#### 3.6. テキストのコピーメソッド

```typescript
/**
 * テキストをクリップボードにコピー
 */
private async _handleCopyToClipboard(text: string): Promise<void> {
  // VSCodeのクリップボード機能を使用
  vscode.env.clipboard.writeText(text);
}
```

#### 3.7. 履歴アイテムの再利用メソッド

```typescript
/**
 * 履歴アイテムを再利用
 */
private async _handleReuseHistoryItem(fileId: string): Promise<void> {
  if (!this._sharingService) return;
  
  // ファイルを履歴から検索
  const history = this._sharingService.getHistory();
  const file = history.find(item => item.id === fileId);
  
  if (file) {
    // コマンドを生成
    const command = this._sharingService.generateCommand(file);
    
    // アクセスカウントを増やす
    this._sharingService.recordAccess(fileId);
    
    // 結果を表示
    this._panel.webview.postMessage({
      command: 'showShareResult',
      data: {
        filePath: file.path,
        command: command,
        type: file.type
      }
    });
  }
}
```

### 4. sharingPanel.jsのメッセージハンドラの整合性確認

以下のメッセージに対応することを確認します:

- `updateSharingHistory` - 履歴リストの更新
- `showShareResult` - 共有結果の表示
- `showError` - エラーメッセージの表示
- `commandCopied` - コマンドのコピー成功通知

### 5. スタイルとUIの統合が完了していることを確認

既に実装済みの項目:
- `scopeManager.css` - 共有パネルのスタイル定義
- HTMLテンプレート内の共有パネル構造

### 6. テスト計画

以下の機能に対するテストを実施します:

1. テキスト共有機能:
   - 短いテキスト
   - 長いテキスト/コードブロック
   - 特殊文字を含むテキスト

2. 画像共有機能:
   - PNG画像
   - JPG画像
   - GIF画像
   - サイズの大きい画像（エラー処理）

3. 履歴管理:
   - 履歴の表示
   - 履歴からの削除
   - 履歴アイテムの再利用

4. クリップボード連携:
   - コマンドのコピー
   - テキストのコピー

5. エラー処理:
   - 無効なファイル形式
   - サイズ制限超過
   - サービス未初期化

## 実装スケジュール

1. ScopeManagerPanel.tsへのサービス統合 - 1時間
2. メッセージハンドラの追加と実装 - 2時間
3. テストと不具合修正 - 2時間
4. 調整とドキュメント作成 - 1時間

合計見積もり時間: 6時間

## 今後の拡張計画

1. リアルタイム共有機能
2. ClaudeCodeとの直接連携（コマンドを使わない直接送信）
3. 複数ファイルの一括共有
4. クラウドストレージとの連携オプション

以上、ClaudeCode共有機能の統合計画を提示しました。