# TabManager リファクタリングテストガイド

このドキュメントは、ScopeManagerPanelのタブ管理機能リファクタリングのテスト手順を説明します。

## 1. テスト準備

### 1.1 コンソールログの確認

テスト開始前に、ブラウザの開発者ツールでコンソールを開いてください。コンソールでデバッグ情報を確認することが重要です。

```javascript
// コンソールでのデバッグフラグ設定確認
window.debugTabManager.status();  // 現在のモード表示
```

### 1.2 テスト環境の設定

テストモードを有効化するには以下のコマンドを実行します：

```javascript
// シャドウモード（新旧実装の並行実行）を有効化
window.debugTabManager.enableShadowMode();

// デバッグログを有効化
window.stateManager.enableDebug(true);
```

## 2. 自動テスト実行

### 2.1 全タブ切り替えテスト

以下のコマンドで全タブの切り替えテストを実行します：

```javascript
window.debugTabManager.test();
```

このテストは以下を検証します：
- すべてのタブが正常に切り替わるか
- タブUIとコンテンツ表示が正しく更新されるか
- エラーが発生していないか

### 2.2 テスト結果の確認

テスト実行後、コンソールに以下のようなログが表示されます：

```
===== TabManagerリファクタリング検証テスト =====
✅ tabManagerモジュールが正常にロードされました
✅ 期待されるすべてのtabManagerメソッドが存在します
✅ 現在のアクティブタブID: current-status
検出されたタブ: current-status, prompts, tools, sharing
テスト: タブ"current-status"に切り替え中...
✅ タブ"current-status"への切り替えに成功しました
...
✅ すべてのタブ切り替えテストに合格しました
✅ 元のアクティブタブ (current-status) に戻りました
===== TabManagerリファクタリング検証テスト完了 =====
```

エラーがある場合は赤色で表示され、❌アイコンが付きます。

## 3. 手動テスト手順

自動テストに加えて、以下の手動テストを実施してください。

### 3.1 基本的なタブ操作テスト

1. 各タブ（Current Status, Prompts, Tools, Sharing）をクリックして切り替わることを確認
2. コンテンツ領域が正しく切り替わることを確認
3. タブ選択時にコンソールにエラーが表示されないことを確認

### 3.2 状態保持テスト

1. あるタブ（例：Prompts）を選択
2. ScopeManagerパネルを閉じる（右上のXをクリック）
3. ScopeManagerパネルを再度開く
4. 前回選択したタブ（Prompts）が選択された状態で表示されることを確認

### 3.3 プロジェクト切り替えテスト

1. あるプロジェクトで特定のタブを選択
2. 別のプロジェクトに切り替え
3. 元のプロジェクトに戻る
4. 元のプロジェクトで選択していたタブが復元されることを確認

### 3.4 特殊ケーステスト

1. **ツールタブ処理**:
   - 「Tools」タブをクリックし、モックアップギャラリーが別ウィンドウで開くことを確認
   - 現在選択中のタブが変わらないことを確認

2. **無効なタブID**:
   コンソールで以下を実行し、エラー処理を確認：
   ```javascript
   tabManager.selectTab('invalid-tab-id');
   ```
   - エラーなく安全に処理されることを確認

3. **タブ状態復元エッジケース**:
   コンソールで以下を実行し、デフォルト値への復元を確認：
   ```javascript
   // 現在の状態を一時保存
   const currentState = window.vscode.getState();
   
   // 状態を無効な値に変更
   const badState = {...currentState, activeTab: 'non-existent-tab'};
   window.vscode.setState(badState);
   
   // タブマネージャーを再初期化
   tabManager.initialize();
   
   // デフォルトタブが選択されることを確認
   console.log('現在のアクティブタブ:', tabManager.getActiveTabId());
   
   // 状態を元に戻す
   window.vscode.setState(currentState);
   tabManager.initialize();
   ```

## 4. パフォーマンステスト

### 4.1 タブ切り替え速度テスト

1. コンソールで以下を実行：
   ```javascript
   console.time('tab-switch');
   tabManager.selectTab('prompts');
   console.timeEnd('tab-switch');
   ```

2. 元の実装と比較：
   ```javascript
   console.time('old-tab-switch');
   window.originalSelectTab('current-status');
   console.timeEnd('old-tab-switch');
   ```

3. 大きな差がないことを確認（通常は数ミリ秒以内）

## 5. エラー検出と報告

テスト中に問題が発生した場合は、以下の情報を収集してください：

1. エラーメッセージの全文（コンソールのスクリーンショット）
2. 問題が発生した操作の詳細な手順
3. 状態管理のログ出力（stateManager.enableDebug(true) 設定時）

### 5.1 緊急復旧手順

問題が発生した場合、以下の手順で既存の実装に戻すことができます：

```javascript
// 新しいTabManagerを無効化して既存実装に戻す
window.debugTabManager.disable();

// 再読み込みして完全にリセット
window.location.reload();
```

## 6. リファクタリング完了の確認

すべてのテストに合格したら、以下の項目で完了を確認します：

1. すべてのタブが正常に機能している
2. 状態保持と復元が正しく動作している
3. コンソールにエラーが表示されていない
4. パフォーマンスが維持されている
5. エッジケースでも適切に処理される

これらの条件がすべて満たされていれば、リファクタリングは正常に完了しています。