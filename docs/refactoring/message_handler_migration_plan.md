# メッセージハンドラ分離計画 (フェーズ5)

## 1. 概要

本計画は、`scopeManager.js`からメッセージハンドリング機能を分離し、専用の`messageHandler.js`モジュールに移行するプロセスを詳細に定義します。これにより、コードの保守性と拡張性が向上し、単一責任の原則に準拠したモジュール構造が実現されます。

## 2. 現状分析

### 2.1 現在の状態

- `scopeManager.js`内に直接実装されたメッセージハンドリング機能
- `window.addEventListener('message', ...)`による直接的なメッセージ受信処理
- switch-caseによる各コマンド処理の分岐
- 対応する処理関数の直接呼び出し

### 2.2 既存のメッセージハンドラ構造

- `messageHandler.js`の基本構造は既に実装されている
- 必要なコンポーネント（tabManager, markdownViewer等）は既に存在
- メッセージタイプに対応するハンドラメソッドが一部定義済み

## 3. 移行計画

段階的な移行を行い、各ステップで動作を検証するアプローチを採用します。「骨を残して肉を入れ替える」原則に従います。

### フェーズ5.1: 初期準備とベーシックなハンドラの移行 (推定時間: 1時間)

1. **メッセージタイプの洗い出し**
   - `scopeManager.js`内のswitch-case文を分析し、全メッセージタイプを特定
   - 複雑度と依存関係でメッセージタイプを分類
   - 移行優先順位を決定

2. **既存のハンドラメソッドの補完**
   - すでに`messageHandler.js`に実装されているメソッドを確認
   - 不足しているハンドラメソッドを追加
   - 各ハンドラの基本的な構造を実装

3. **簡易なメッセージから移行開始**
   - `showError`と`showSuccess`などの単純なコマンドから着手
   - 元のコードをコメントアウトし、新しいハンドラ呼び出しに置き換え
   - 動作確認を行う

### フェーズ5.2: 中間複雑度のハンドラ移行 (推定時間: 1時間)

1. **状態更新系ハンドラの移行**
   - `updateProjectPath`、`updateProjectName`などの関数の移行
   - 状態管理との依存関係に注意しながら実装
   - データフローを維持した実装に注力

2. **表示更新系ハンドラの移行**
   - `updateMarkdownContent`、`updateToolsTab`などの関数の移行
   - DOM操作部分をモジュールに移行
   - 表示の一貫性を確保

3. **統合テスト**
   - 複数メッセージタイプの連続処理を確認
   - エラー処理の整合性を検証
   - UI表示が正しく更新されるか確認

### フェーズ5.3: 複雑なハンドラの移行 (推定時間: 1時間)

1. **プロジェクト状態同期ハンドラの移行**
   - `syncProjectState`関数の移行
   - 状態管理との複雑な依存関係を整理
   - タイミング制御コードの適切な移行

2. **スコープ関連ハンドラの移行**
   - スコープ選択やリスト更新など複雑な処理の移行
   - UI更新とデータ処理の分離を確保
   - 非同期処理の適切な取り扱い

3. **メッセージリスナー統合**
   - `window.addEventListener('message')`を`messageHandler.js`に一元化
   - 例外処理とロギングの強化
   - sharingPanel.jsのハンドリングとの適切な連携

## 4. 実装戦略

### 4.1 段階的移行アプローチ

各メッセージタイプごとに以下のステップで移行を行います:

1. **移行準備**
   - メッセージハンドラの実装をmessageHandler.jsに追加
   - 必要なインポートやヘルパー関数を整備
   - 処理のための依存関係を解決

2. **並行運用期**
   - 元のスコープマネージャーのコードはコメントアウトするが削除はしない
   - 両方のコードパスを維持し、messageHandler.jsの呼び出しを追加
   - コンソールログを追加して挙動を検証

3. **切り替え**
   - 動作確認後、元のハンドラ呼び出しをmessageHandler.jsに完全に移行
   - 重複コードを削除し、scopeManager.jsからインポートに置き換え
   - エラー処理とフォールバックを確保

4. **検証**
   - 機能が正しく動作するか確認
   - パフォーマンスや副作用がないことを確認
   - コンソールエラーがないことを確認

### 4.2 安全策

1. **リスク軽減措置**
   - 各ステップで段階的なコミットを行う
   - 問題発生時に前の段階に戻せるようにする
   - 移行中は動作確認を頻繁に行う

2. **フォールバックメカニズム**
   - エラーハンドリングを強化
   - 処理失敗時に元の実装にフォールバックするロジックを組み込む
   - ロギングを強化して問題の早期発見を可能に

## 5. 具体的な実装ステップ

### ステップ1: メッセージハンドラの強化

```javascript
// messageHandler.js に追加するハンドラメソッド

// 1. updateMarkdownContent のハンドラ
handleUpdateMarkdownContent(message) {
  if (!message.content) return;
  markdownViewer.updateContent(message.content);
}

// 2. updateProjectPath のハンドラ
handleUpdateProjectPath(message) {
  if (!message.projectPath) return;
  projectNavigation.updateProjectPath(message);
}

// 3. updateProjectName のハンドラ
handleUpdateProjectName(message) {
  if (!message.projectName) return;
  projectNavigation.updateProjectName(message.projectName);
}

// 他の必要なハンドラも同様に実装
```

### ステップ2: スコープマネージャーの修正

```javascript
// scopeManager.js の修正例

// 外部モジュールのインポート
import { convertMarkdownToHtml, enhanceSpecialElements, setupCheckboxes } from './utils/markdownConverter.js';
import { showError, showSuccess, getStatusClass, getStatusText, getTimeAgo } from './utils/uiHelpers.js';
import messageHandler from './utils/messageHandler.js';

// メッセージハンドラーの設定 (段階的移行中)
window.addEventListener('message', event => {
  const message = event.data;
  
  // シェアリングパネル関連のメッセージは無視（sharingPanel.jsが処理）
  if (['showShareResult', 'updateSharingHistory', 'commandCopied', 'resetDropZone'].includes(message.command)) {
    return; // sharingPanel.jsに処理を任せる
  }
  
  console.log('メッセージ受信:', message.command);
  
  // 新しいメッセージハンドラで処理
  messageHandler.handleMessage(message);
  
  // レガシーコードはコメントアウト（検証中は維持）
  /*
  switch (message.command) {
    case 'updateState':
      handleUpdateState(message);
      break;
    // ...その他のケース
  }
  */
});
```

### ステップ3: 各コンポーネントの調整

必要に応じて、tabManager.js、markdownViewer.js、projectNavigation.js、dialogManager.jsなどの各コンポーネントのインターフェースを調整し、messageHandlerからの呼び出しに対応させます。

### ステップ4: 最終統合

すべてのメッセージタイプの処理が正常に動作することを確認した後、scopeManager.jsから重複コードを削除し、messageHandler.jsへの依存に完全に移行します。

## 6. 検証計画

### 6.1 機能検証

各メッセージタイプに対して以下の検証を行います:

1. **基本機能検証**
   - 各メッセージタイプの送受信が正常に行われるか
   - 処理結果がUIに正しく反映されるか
   - エラー処理が適切に機能するか

2. **エッジケース検証**
   - 無効なデータ形式への対応
   - 高頻度メッセージの処理
   - 並行処理時の競合状態の回避

3. **統合検証**
   - 複数のメッセージタイプが連続する場合の挙動
   - 大量データ処理時のパフォーマンス
   - 状態管理との整合性

### 6.2 検証方法

1. VSCodeデバッグ実行による動作確認
2. コンソールログの監視
3. UI表示の目視確認
4. エラーシナリオのシミュレーション

## 7. タイムライン

総所要時間: 約3時間

- フェーズ5.1 (初期準備): 1時間
- フェーズ5.2 (中間複雑度ハンドラ): 1時間
- フェーズ5.3 (複雑なハンドラ): 1時間

## 8. 結論

このメッセージハンドラ分離計画により、ScopeManagerPanelの保守性と拡張性が大幅に向上します。段階的なアプローチにより、リスクを最小限に抑えつつ、コードの品質向上を実現します。また、この分離により、将来的な機能追加や変更が容易になります。