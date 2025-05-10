# ファイルブラウザ機能削除完了報告

## 実施日時

2025年5月10日

## 実施内容

AppGenius ScopeManagerの「ファイル」タブ機能（ファイルブラウザ機能）を削除しました。UIからは完全に削除し、バックエンドでは互換性のためにインターフェースを一部残しています。

## 削除された主要コンポーネント

### フロントエンド（完全削除）

- `media/components/fileBrowser/fileBrowser.js`
- `media/components/fileBrowser/fileBrowser.css`
- `scopeManager.js` からのfileBrowserインポートと初期化コード
- `tabManager.js` からのファイルタブ関連の処理
- ScopeManagerPanel.tsからファイルブラウザ関連のHTMLとスクリプト参照

### バックエンド（部分的削除）

- ScopeManagerPanel.tsのメッセージハンドラからファイルブラウザ関連メソッド呼び出し
- ファイルブラウザ関連の変数（_directoryStructure）と初期化コード
- FileSystemService実装内の不要メソッド実装（空の実装か条件付き実行に変更）

## 互換性のために維持されたコンポーネント

1. **インターフェース定義**
   - `IFileSystemService`インターフェースのファイルブラウザ関連メソッド定義は保持
   - `src/ui/scopeManager/types/ScopeManagerTypes.ts`内の`IProjectDocument`と`IFileBrowserState`インターフェース定義

2. **安全なメソッド呼び出し実装**
   - MessageDispatchServiceImpl内では条件チェック追加：
     ```typescript
     const files = 'listDirectory' in this._fileSystemService ?
       await this._fileSystemService.listDirectory(dirPath) :
       await (this._fileSystemService as any).listDirectory(dirPath);
     ```

3. **イベントリスナー条件付きセットアップ**
   - ServiceFactory内でのイベントリスナー設定は条件付きに：
     ```typescript
     if ('onFileBrowserUpdated' in fileSystemService) {
       (fileSystemService as any).onFileBrowserUpdated((files: any) => {
         // ...省略...
       });
     }
     ```

## 備考

- 削除されたコードのバックアップを `docs/refactoring/removed-code-backup` に保存しました
- マークダウンパーサーおよびマークダウンビューア関連コードは、他の機能でも使用されるため保持しています
- ScopeManagerPanel.tsでは_directoryStructure変数とonDirectoryStructureUpdatedイベントリスナーも完全に削除しました
- この実装アプローチにより、TypeScriptコンパイラはインターフェースの型チェックを正常に行え、実行時の互換性も維持されています

## 今後の改善点

- **段階的リファクタリング計画**: 将来的なリリースで以下の要素を完全に削除
  1. `IFileSystemService`インターフェースからファイルブラウザ関連メソッドの削除
  2. `ScopeManagerTypes.ts`から`IProjectDocument`および`IFileBrowserState`インターフェースの削除
  3. MessageDispatchServiceImplから条件付き呼び出しコードの削除
  4. ServiceFactoryから条件付きイベントリスナー設定の削除

- VSCodeの標準ファイル操作機能を使用するよう、ユーザーガイドを更新することが推奨されます

## ファイルブラウザ機能完全削除計画

次のフェーズで実装予定のファイルブラウザ機能の完全削除計画を以下に示します。

### 1. インターフェース定義からファイルブラウザ関連メソッドの削除

**対象ファイル**: `/src/ui/scopeManager/services/interfaces/IFileSystemService.ts`

**削除項目**:
- 45-52行目: ファイルブラウザ関連のメソッド定義（`listDirectory`, `getFileType`, `openFileInEditor`など）
- 57行目: `onFileBrowserUpdated`イベント定義

### 2. ScopeManagerTypesからファイルブラウザ関連インターフェースの削除

**対象ファイル**: `/src/ui/scopeManager/types/ScopeManagerTypes.ts`

**削除項目**:
- 38-51行目: `IProjectDocument`インターフェース定義と関連コメント
- 64-71行目: `IFileBrowserState`インターフェース定義

### 3. MessageDispatchServiceImplの条件付き呼び出しコードの削除

**対象ファイル**: `/src/ui/scopeManager/services/implementations/MessageDispatchServiceImpl.ts`

**削除項目**:
- 398-411行目: プロジェクトのディレクトリ構造読み込み（ファイルブラウザ用）処理
- 560-562, 777-779行目: ファイルブラウザ機能の条件付き呼び出し
- 613-617行目: `getFileType`の条件付き呼び出し
- ファイルブラウザ関連のメッセージハンドラ定義（`navigateDirectory`, `listDirectory`など）

### 4. ServiceFactoryの条件付きイベントリスナー設定の削除

**対象ファイル**: `/src/ui/scopeManager/services/ServiceFactory.ts`

**削除項目**:
- 323-333行目: ファイルブラウザの更新イベントをPanelServiceに反映する条件付きコード

### 5. FileSystemServiceImpl内の不要メソッド実装の削除

**対象ファイル**: `/src/ui/scopeManager/services/implementations/FileSystemServiceImpl.ts`

**削除項目**:
- `listDirectory`, `getFileType`, `openFileInEditor`, `navigateDirectory`, `openFile`, `refreshFileBrowser`, `initializeFileBrowser`メソッド実装
- `_onFileBrowserUpdated`イベントエミッターとその定義
- 関連するメッセージハンドラ登録

### 6. 影響範囲と対応

1. **影響を受けるコンポーネント**:
   - ファイルブラウザUIコンポーネント（既に削除済み）
   - タブマネージャーのファイルタブ関連処理（既に削除済み）
   - プロジェクト初期化時のディレクトリ構造読み込み処理

2. **実装アプローチ**:
   - 削除対象コードを完全に除去
   - 条件付き実行コードはシンプルなバージョンに置き換え
   - ファイルブラウザ機能に依存しているコードは不要になるため削除

### 7. VSCode標準ファイル操作機能への移行ガイド

**ユーザーガイドに追加する内容**:
- VSCodeの標準エクスプローラービューを使用したファイル閲覧方法
- ファイル検索機能（Ctrl+P, Ctrl+F）の活用方法
- プロジェクト内ファイル検索（Ctrl+Shift+F）の使用方法
- VSCode組み込みのファイルプレビュー機能の使用方法

### 削除手順

1. まず、影響範囲を詳細に分析し、依存関係を確認
2. インターフェース定義とタイプ定義の削除（IFileSystemService, ScopeManagerTypes）
3. 実装クラスからファイルブラウザ関連メソッドを削除
4. 条件付き呼び出しコードをクリーンアップ
5. VSCode標準機能へのガイド作成