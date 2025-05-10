# ファイルブラウザ機能削除計画

## 概要

AppGeniusのScopeManagerパネルに実装されている「ファイル」タブおよびファイルブラウザ機能を完全に削除するための計画書です。この機能はより専門的なVSCode機能で代替可能であり、メンテナンスコストと複雑性を低減するため削除します。

## 1. フロントエンド側の削除計画

### 1.1 削除対象ファイル

- `media/components/fileBrowser/fileBrowser.js`
- `media/components/fileBrowser/fileBrowser.css`

### 1.2 タブマネージャーの修正 (`media/components/tabManager/tabManager.js`)

以下の機能を削除します：

- `file-browser`タブ関連のコード（具体的には93-124行目付近）
  ```javascript
  else if (tabId === 'file-browser') {
    // ファイルブラウザタブが選択された場合、ファイルリストのリフレッシュをリクエスト
    const projectPath = stateManager.getState().activeProjectPath;
    console.log(`ファイルブラウザタブが選択されました。ファイルリストをリフレッシュします: ${projectPath}`);
    
    // fileBrowserコンポーネントが存在していれば初期化
    if (window.fileBrowser) {
      // まずUIを準備
      if (typeof window.fileBrowser.prepareUI === 'function') {
        window.fileBrowser.prepareUI();
      } else if (typeof window.fileBrowser.initialize === 'function') {
        window.fileBrowser.initialize();
      }
      
      // プレースホルダ表示中にファイルリストをリクエスト（遅延実行）
      setTimeout(() => {
        stateManager.sendMessage('refreshFileBrowser', {
          projectPath: projectPath
        });
        
        // 読み込み中表示のクリア
        const fileList = document.getElementById('file-list');
        if (fileList && fileList.innerHTML.includes('読み込み中')) {
          fileList.innerHTML = '<div class="loading-indicator">ファイルリストを取得中...</div>';
        }
      }, 100);
    }
  }
  ```

- ファイルタブ追加関連のメソッド (`_addFileTab`)
- ファイルパスからファイルタブIDを取得するメソッド (`_getFilePathFromTabId`)
- カスタムイベント `add-file-tab` リスナー設定

### 1.3 ScopeManager.jsの修正

- fileBrowserコンポーネントのインポート削除
  ```javascript
  import fileBrowser from './components/fileBrowser/fileBrowser.js';
  ```

- fileBrowser初期化関連コードの削除
  ```javascript
  // 5. クライアント側のファイルブラウザUIの準備
  // 注：実際の初期化とファイル読み込みはサーバーサイド(VSCode拡張)で処理
  if (typeof fileBrowser.prepareUI === 'function') {
    fileBrowser.prepareUI(); 
  } else if (typeof fileBrowser.initialize === 'function') {
    // 後方互換性のため
    fileBrowser.initialize();
  }
  ```

- fileBrowser関連メッセージハンドラーの削除
  ```javascript
  case 'updateFileList':
    // ファイルブラウザコンポーネントに委譲
    if (fileBrowser && typeof fileBrowser.updateFileList === 'function') {
      fileBrowser.updateFileList(message.files);
    }
    break;
  case 'updateFileBrowser':
    // ファイルブラウザコンポーネントに委譲
    if (fileBrowser) {
      console.log('scopeManager: updateFileBrowserメッセージを受信しました');
      
      if (typeof fileBrowser.updateFileList === 'function' && message.files) {
        // ファイルリストがある場合はそのまま渡す
        console.log('scopeManager: ファイルリストを更新します');
        fileBrowser.updateFileList(message.files);
      }
    }
    break;
  ```

### 1.4 HTMLの修正

- ScopeManagerPanel内の「ファイル」タブのHTMLコード削除
- `file-browser-tab`要素および関連するDOM要素の削除

## 2. バックエンド側の削除計画

### 2.1 IFileSystemServiceインターフェース修正 (`src/ui/scopeManager/services/interfaces/IFileSystemService.ts`)

以下のメソッドを削除：

```typescript
// ファイルブラウザ関連の新規メソッド
listDirectory(directoryPath: string, recursive?: boolean): Promise<IProjectDocument[]>;
getFileType(filePath: string): string;

// ScopeManagerPanelから移行するファイル操作メソッド
openFileInEditor(filePath: string): Promise<void>;
navigateDirectory(dirPath: string, panel: vscode.WebviewPanel): Promise<void>;
openFile(filePath: string, panel: vscode.WebviewPanel): Promise<void>;
refreshFileBrowser(projectPath: string, panel: vscode.WebviewPanel): Promise<void>;
initializeFileBrowser(projectPath: string, panel: vscode.WebviewPanel): Promise<void>;

// イベント
onFileBrowserUpdated: vscode.Event<IProjectDocument[]>;
```

### 2.2 FileSystemService実装クラスの修正

- `src/ui/scopeManager/services/FileSystemService.ts`
- `src/ui/scopeManager/services/implementations/FileSystemServiceImpl.ts`

以下の要素を削除：

1. ファイルブラウザ関連メソッド実装
   - `listDirectory`
   - `getFileType`
   - `openFileInEditor`
   - `navigateDirectory`
   - `openFile`
   - `refreshFileBrowser`
   - `initializeFileBrowser`

2. プロパティの削除
   - `_onFileBrowserUpdated` EventEmitter
   - `_currentFileList` プロパティ

3. メソッド実装内のファイルブラウザ関連コード

### 2.3 IProjectDocument型定義の削除

`src/ui/scopeManager/types/ScopeManagerTypes.ts`または関連ファイルから`IProjectDocument`インターフェースを削除：

```typescript
export interface IProjectDocument {
  path: string;
  name: string;
  type: string;
  lastModified: Date;
  parentFolder: string;
  isDirectory: boolean;
  size: number;
  children?: IProjectDocument[]; // サブディレクトリの場合
}
```

### 2.4 ScopeManagerPanelクラスの修正

- ファイルブラウザ関連のWebViewメッセージハンドラを削除
  - `listDirectory` ハンドラ
  - `refreshFileBrowser` ハンドラ
  - `openFileInEditor` ハンドラ
  - `openFileAsTab` ハンドラ
  - `openMarkdownInTab` ハンドラ

- ファイルブラウザ初期化コードの削除
- ファイルブラウザタブ定義の削除

### 2.5 MessageDispatchServiceの修正

ファイルブラウザ関連のメッセージハンドラ登録コードを削除：

```typescript
// ディレクトリ内容一覧取得ハンドラー
messageDispatchService.registerHandler('listDirectory', async (message: Message, panel: vscode.WebviewPanel) => {
  // ... 削除対象 ...
});

// ファイルブラウザ更新ハンドラー
messageDispatchService.registerHandler('refreshFileBrowser', async (message: Message, panel: vscode.WebviewPanel) => {
  // ... 削除対象 ...
});

// エディタでファイルを開くハンドラー
messageDispatchService.registerHandler('openFileInEditor', async (message: Message, panel: vscode.WebviewPanel) => {
  // ... 削除対象 ...
});

// ファイルをタブで開くハンドラー
messageDispatchService.registerHandler('openFileAsTab', async (message: Message, panel: vscode.WebviewPanel) => {
  // ... 削除対象 ...
});
```

## 3. TabManagerからファイルタブ設定の削除

以下の修正を行います：

1. ファイルタブ関連の処理を削除
   - ファイル一覧表示機能
   - ファイルタブを追加するメソッドと処理
   - ファイルコンテンツをプレビュー表示する機能

2. ファイルタブのスタイル定義の削除
   - CSSクラスの削除
   - タブの見た目に関するスタイル定義の削除

## 4. 検証計画

機能削除後、以下の観点で動作検証を行います：

1. アプリケーション起動時にエラーが発生しないこと
2. ScopeManagerパネルが正常に表示され、「ファイル」タブが表示されていないこと
3. プロジェクト切り替えが正常に機能すること
4. 「進捗状況」タブや「要件定義」タブなど、他の機能に影響が出ていないこと
5. VSCodeの標準ファイル操作で問題なく操作できること

## 5. 実装スケジュール

1. フロントエンド側のコード削除
2. バックエンド側のコード削除
3. TabManagerからのファイルタブ設定削除
4. 動作確認テスト
5. 問題箇所の修正

## 特記事項

- この削除により、エンドユーザーにはVSCodeの標準ファイル操作を利用するよう案内が必要です
- この変更は機能の削減となりますが、メンテナンスコストの低減と将来的な拡張性の向上につながります
- 削除作業はブランチを分けて実施し、十分なテスト後にマージすることを推奨します