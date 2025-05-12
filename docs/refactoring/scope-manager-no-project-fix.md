# スコープマネージャーのプロジェクト未選択時エラー修正

## 問題概要

スコープマネージャーを開いた際、プロジェクトが選択されていない状態では以下のようなエラーが発生していました：

```
[2025-05-12T05:09:57.093Z] [DEBUG] MessageDispatchServiceImpl: 受信: getMarkdownContent
[2025-05-12T05:09:57.094Z] [INFO] MessageDispatchServiceImpl: マークダウンコンテンツを取得します: undefined/docs/SCOPE_PROGRESS.md
[2025-05-12T05:09:57.094Z] [ERROR] ファイル読み込みエラー: ファイルが存在しません: undefined/docs/SCOPE_PROGRESS.md
[2025-05-12T05:09:57.094Z] [WARN] FileSystemService: ファイルが見つかりません（空文字を返します）: undefined/docs/SCOPE_PROGRESS.md
```

このエラーはプロジェクトパスが`undefined`のため、`undefined/docs/SCOPE_PROGRESS.md`というファイルパスが作成され、存在しないファイルにアクセスしようとするために発生します。ユーザーにはエラーメッセージが表示され、ユーザーエクスペリエンスが低下していました。

## 修正内容

### 1. `MessageDispatchServiceImpl`の改善

`MessageDispatchServiceImpl.ts`に`getMarkdownContent`ハンドラーを拡張し、プロジェクト未選択時の処理を改善しました。

- `undefined/docs/SCOPE_PROGRESS.md`などのパスを検出し、特別処理
- プロジェクト未選択時には`noProjectView.html`の内容を表示またはプロジェクト選択メッセージを表示
- エラーハンドリングもプロジェクト未選択時には専用のメッセージを表示するよう改善

```typescript
// プロジェクトが選択されていない場合（undefined/docs/SCOPE_PROGRESS.mdなど）は特別な処理
if (message.filePath.startsWith('undefined/') || message.filePath === 'undefined') {
  Logger.warn(`MessageDispatchServiceImpl: 無効なファイルパスを検出: ${message.filePath} - noProjectViewを表示します`);

  // 拡張機能のパスを取得
  const extensionPath = vscode.extensions.getExtension('mikoto.appgenius-ai')?.extensionPath || '';
  const noProjectViewPath = path.join(extensionPath, 'media', 'noProjectView.html');

  if (fs.existsSync(noProjectViewPath)) {
    // noProjectView.htmlの内容を読み込む
    const noProjectContent = fs.readFileSync(noProjectViewPath, 'utf8');

    // プロジェクト選択画面をコンテンツとして返す
    this.sendMessage(panel, {
      command: 'showNoProject',
      content: noProjectContent
    });

    Logger.info('MessageDispatchServiceImpl: noProjectViewを表示しました');
    return;
  }
  // ...
}
```

### 2. `scopeManager.js`の拡張

フロントエンド側にプロジェクト未選択時の表示を処理するための新しいメッセージハンドラーを追加しました。

1. `showNoProject`ハンドラー
   - `noProjectView.html`の内容を表示
   - 新規プロジェクト作成と既存プロジェクト選択のボタンにイベントリスナーを追加

2. `showProjectSelection`ハンドラー
   - シンプルなプロジェクト選択メッセージを表示
   - ボタンに適切なイベントリスナーを設定

```javascript
case 'showNoProject':
  // プロジェクトが選択されていない場合の特別な表示
  console.log('プロジェクトが選択されていない状態を検出: noProjectViewを表示します');
  
  // アクティブなタブのコンテンツ領域に挿入
  const activeTabId = stateManager.getState().activeTab;
  const contentContainer = document.querySelector(`#${activeTabId}-tab .markdown-content`);
  
  if (contentContainer) {
    // 現在のタブにnoProjectViewの内容を挿入
    contentContainer.innerHTML = message.content;
    
    // ボタンにイベントリスナーを追加
    setTimeout(() => {
      const createProjectBtn = document.getElementById('create-new-project');
      const loadProjectBtn = document.getElementById('load-existing-project');
      
      // イベントリスナー設定...
    }, 100);
    
    console.log('プロジェクト選択画面を表示しました');
  }
  break;
```

## 改善効果

- プロジェクト未選択時にエラーではなく、ユーザーフレンドリーなプロジェクト選択画面を表示
- 新規プロジェクト作成や既存プロジェクト選択の操作が直感的に行えるUIを提供
- エラーログの削減とエラーハンドリングの改善によるデバッグのしやすさ

## 今後の改善点

1. プロジェクト選択時の状態管理のさらなる強化
2. 別のタブやパネルでも同様のエラーハンドリングを実装
3. エラーメッセージの統一と多言語対応