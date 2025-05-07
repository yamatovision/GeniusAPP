# CURRENT_STATUS.md から SCOPE_PROGRESS.md への完全移行計画

## 1. 問題の本質

AppGeniusではこれまで開発プロセスの進捗管理に `CURRENT_STATUS.md` というファイル名を使用してきましたが、より適切で構造化された命名である `SCOPE_PROGRESS.md` に完全に移行する必要があります。現在は以下の2段階の移行プロセスにあります：

**フェーズ1（現在）**: 両方のファイル名をサポートするが、`SCOPE_PROGRESS.md` を優先
**フェーズ2（次段階）**: `CURRENT_STATUS.md` への参照を完全に削除し、`SCOPE_PROGRESS.md` のみを使用

### 現状の課題

現在のコードベースでは以下の課題が残っています：

1. ドキュメントやテンプレートの一部でまだ `CURRENT_STATUS.md` への参照が残っている
2. コード内に `CURRENT_STATUS` という名前の変数や参照が残っている
3. イベント名やメソッド名に `STATUS` という単語が使われている
4. UIのラベルやメッセージに「ステータス」という言葉が使われている

これらを一括して更新することで、より一貫性のある命名体系を実現します。

### 完全移行アプローチ

```typescript
// フェーズ2の実装: SCOPE_PROGRESS.mdのみをサポートする関数
function getProgressFilePath(projectPath: string): string {
  return path.join(projectPath, 'docs', 'SCOPE_PROGRESS.md');
}

## 2. 変更が必要なファイルとコード箇所

フェーズ1の移行では以下のファイルを更新しました：

1. `src/ui/scopeManager/services/FileSystemService.ts` - getProgressFilePath実装
2. `src/ui/scopeManager/services/ProjectService.ts` - ファイル参照更新
3. `src/services/AppGeniusEventBus.ts` - SCOPE_PROGRESS_UPDATEDイベントタイプ追加
4. `docs/CLAUDETEMPLATE.md` - 参照パス更新
5. `docs/SCOPE_PROGRESS_TEMPLATE.md` - 新しいテンプレート作成

フェーズ2（完全移行）では更に以下のファイルの変更が必要です：

### バックエンド／サービス層

1. `src/ui/scopeManager/ScopeManagerPanel.ts`
   - タブID、メソッド名、UIラベルの変更
   - メソッド実装の簡略化（互換性コード削除）

2. `src/ui/scopeManager/services/FileSystemService.ts`
   - 旧名称メソッドとフィールドの削除
   - ファイル監視の簡略化

3. `src/ui/scopeManager/services/ProjectService.ts`
   - メソッド名の統一（getStatusFilePath → getProgressFilePath）
   - 旧名称変数の除去

4. `src/services/AppGeniusEventBus.ts`
   - CURRENT_STATUS_UPDATEDイベントタイプの削除

### フロントエンド／UI層

5. `media/state/stateManager.js`
   - ステート変数名の統一
   - イベント識別子の更新

6. `media/scopeManager.js`
   - UI識別子とラベルの更新
   - タブID参照の更新

7. `media/components/projectNavigation/projectNavigation.js`
   - ナビゲーション要素のラベル更新

### ドキュメント／テンプレート

8. `docs/CURRENT_STATUSTEMPLATE.md`の完全削除
9. 残りのドキュメントにおける参照パス更新
   - README.md
   - その他の説明ドキュメント

## 3. 実装計画（フェーズ2・完全移行）

### 3.1 バックエンド層の完全移行

#### FileSystemService.ts の簡略化

フェーズ1では両方のファイル名をサポートする実装をしましたが、フェーズ2では完全に新しいファイル名のみを使用するシンプルな実装に変更します：

```typescript
/**
 * 進捗ファイルパスを取得
 * @param projectPath プロジェクトパス
 * @returns 進捗ファイルパス
 */
public getProgressFilePath(projectPath: string): string {
  return path.join(projectPath, 'docs', 'SCOPE_PROGRESS.md');
}

/**
 * 進捗ファイルを作成
 * @param projectPath プロジェクトパス
 * @param projectName プロジェクト名
 */
public async createProgressFile(
  projectPath: string, 
  projectName?: string
): Promise<void> {
  // docsディレクトリの確認
  const docsDir = path.join(projectPath, 'docs');
  await this.ensureDirectoryExists(docsDir);
  
  // ファイルパスの生成
  const filePath = path.join(docsDir, 'SCOPE_PROGRESS.md');
  
  // テンプレートの読み込み
  const templatePath = path.join(this._extensionPath, 'docs', 'SCOPE_PROGRESS_TEMPLATE.md');
  
  // テンプレート読み込みと内容生成
  try {
    let templateContent = '';
    if (fs.existsSync(templatePath)) {
      templateContent = fs.readFileSync(templatePath, 'utf8');
      // プロジェクト名と日付を置換
      templateContent = templateContent
        .replace(/\[プロジェクト名\]/g, projectName || path.basename(projectPath))
        .replace(/YYYY-MM-DD/g, new Date().toISOString().split('T')[0]);
        
      Logger.info(`FileSystemService: SCOPE_PROGRESS_TEMPLATEを読み込みました: ${templatePath}`);
    } else {
      // テンプレートが見つからない場合はデフォルトテンプレートを使用
      templateContent = this._getDefaultProgressTemplate(projectName || path.basename(projectPath));
      Logger.warn(`FileSystemService: テンプレートが見つかりませんでした。デフォルトテンプレートを使用します。`);
    }
    
    // ファイルに書き込み
    await fs.promises.writeFile(filePath, templateContent, 'utf8');
    
    // ファイルが作成されたことをイベントとして通知
    this._onProgressFileChanged.fire(filePath);
    
    Logger.info(`FileSystemService: 進捗ファイルを作成しました: ${filePath}`);
  } catch (error) {
    Logger.error(`FileSystemService: 進捗ファイルの作成に失敗しました: ${filePath}`, error as Error);
    throw error;
  }
}

以下のメソッドは削除します：
- `createDefaultStatusFile`（旧名称メソッド）

また、イベント名も更新します：
- `_onStatusFileChanged` → `_onProgressFileChanged`

#### ProjectService.ts の更新

`ProjectService.ts`のメソッド名とコメントを完全に更新します：

```typescript
/**
 * プロジェクトパスを設定
 */
public async setProjectPath(projectPath: string): Promise<void> {
  this._projectPath = projectPath;
  
  // 進捗ファイルパスを取得
  this._progressFilePath = this._fileSystemService.getProgressFilePath(projectPath);
  
  Logger.info(`ProjectService: プロジェクトパスを設定しました: ${projectPath}`);
  Logger.info(`ProjectService: 進捗ファイルパス: ${this._progressFilePath}, ファイル存在: ${fs.existsSync(this._progressFilePath) ? 'はい' : 'いいえ'}`);
  
  // 進捗ファイルを作成（必要な場合）
  if (!fs.existsSync(this._progressFilePath)) {
    await this._fileSystemService.createProgressFile(projectPath);
  }
}

/**
 * 進捗ファイルパスを取得
 */
public getProgressFilePath(): string {
  return this._progressFilePath;
}

変数名も更新します：
- `_statusFilePath` → `_progressFilePath`

以下のメソッドは削除します：
- `getStatusFilePath`（代わりに`getProgressFilePath`を使用）

#### AppGeniusEventBus.ts の更新

`AppGeniusEventBus.ts`で、古いイベントタイプを削除し、新しいイベントタイプのみを使用します：

```typescript
export enum AppGeniusEventType {
  // 既存のイベント...
  
  // CURRENT_STATUS_UPDATEDを削除し、SCOPE_PROGRESS_UPDATEDのみを使用
  SCOPE_PROGRESS_UPDATED = 'scope-progress-updated',
  
  // ...その他のイベント
}

### 3.2 フロントエンド／UI層の更新

#### ScopeManagerPanel.ts の更新

`ScopeManagerPanel.ts`でタブIDとメソッド名を更新します：

```typescript
// タブIDの更新
private readonly PROGRESS_TAB_ID = 'scope-progress';  // 'current-status'から変更

// メソッド名の更新
private async loadProgressFile(): Promise<void> {
  try {
    // プロジェクトサービスから進捗ファイルパスを取得
    const progressFilePath = this._projectService.getProgressFilePath();
    ...
  }
}

#### stateManager.js の更新

ステート変数とイベント名を更新します：

```javascript
// ステート変数名を更新
const scopeProgressContent = '';  // currentStatusContentから変更

// イベント名を更新
window.addEventListener('scope-progress-updated', (event) => {
  // 処理内容
});

#### scopeManager.js の更新

UIのラベルとID参照を更新します：

```javascript
// タブ名とUIラベルを更新
const tabs = {
  'scope-progress': '進捗状況',  // 'current-status'から変更
  'claude-code': 'ClaudeCode連携',
  'dev-tools': '開発ツール'
};

// タブ切り替え処理の更新
function switchTab(tabId) {
  if (tabId === 'scope-progress') {
    // 進捗状況タブの処理
  } else if ...
}

#### projectNavigation.js の更新

プロジェクト情報表示時のラベルを更新します：

```javascript
// ファイル存在チェックの更新
function checkProjectFiles(projectInfo) {
  const progressFileExists = projectInfo.progressFileExists;  // statusFileExistsから変更
  
  // 表示を更新
  if (progressFileExists) {
    // 進捗ファイルが存在する場合の処理
  } else {
    // 進捗ファイルが存在しない場合の処理
  }
}

### 3.3 ドキュメント／テンプレートの更新

1. `docs/CURRENT_STATUSTEMPLATE.md`を削除
2. すべてのドキュメント内の参照パスを更新（READMEなど）
3. UIのテキストとヘルプメッセージを更新

## 4. フェーズ2実装ロードマップ

### 4.1 実装順序

フェーズ2（完全移行）で行う作業の順序を以下に示します：

1. **バックエンド層の更新**
   - FileSystemService.ts の簡略化
   - ProjectService.ts の完全更新
   - AppGeniusEventBus.ts のイベント整理

2. **フロントエンド層の更新**
   - ScopeManagerPanel.ts のタブID・メソッド更新
   - JavaScript側の変数名・イベント名の更新
   - UI表示テキストの更新

3. **ドキュメント更新**
   - 古いテンプレートの削除
   - すべての参照パスの更新
   - ヘルプドキュメントの更新

4. **テストと検証**
   - 既存プロジェクト読み込みテスト
   - 新規プロジェクト作成テスト
   - ナビゲーションフローのテスト

### 4.2 注意点と対策

1. **既存プロジェクトへの対応**
   - 既存プロジェクトにSCOPE_PROGRESS.mdが存在しない場合、初回起動時にCURRENT_STATUS.mdからの変換ユーティリティを提供
   - 変換ユーティリティのPRを別途作成して対応

2. **UIラベルの統一性**
   - 「プロジェクト状況」→「進捗状況」など、表示テキストの一貫性を確保
   - 「ステータス」という単語を「進捗」に置き換える

3. **イベント名の統一**
   - すべての関連イベントで「progress」という単語を使用する一貫性を持たせる
   - イベントリスナーの登録解除と再登録を適切に行う

### 4.3 コンポーネント間の依存関係

実装の際は、以下の依存関係を考慮します：

1. **FileSystemService → AppGeniusEventBus**
   - イベント発行・リスニングメカニズム

2. **ProjectService → FileSystemService**
   - ファイル操作の委譲パターン

3. **ScopeManagerPanel → ProjectService**
   - 進捗ファイルパスと内容の取得

4. **WebviewコンポーネントとIPC通信**
   - メッセージの型と識別子の更新

## 5. 最終目標

完全移行が完了すると、以下の状態になります：

1. **単純化されたコードベース**
   - 互換性コードが削除され、メンテナンス性が向上
   - 一貫した命名規則によるコードの可読性向上

2. **統一された用語**
   - 「ステータス」→「進捗」の統一
   - UIとコード内の用語の一貫性確保

3. **シンプルな設計**
   - 単一の真実源としてのSCOPE_PROGRESS.md
   - 重複コードの排除

4. **ユーザーエクスペリエンスの向上**
   - より理解しやすいUIラベル
   - 全体的な一貫性

## 6. テスト計画

新実装のテストには以下を含めます：

1. **ユニットテスト**
   - FileSystemService.getProgressFilePathの動作確認
   - ProjectService.getProgressFilePathの動作確認
   - イベント発行・サブスクリプションの確認

2. **統合テスト**
   - 新規プロジェクト作成フロー
   - 既存プロジェクト読み込みフロー
   - タブ切り替え動作

3. **UI/UXテスト**
   - ラベルとボタンの一貫性
   - エラーメッセージの適切な表示
   - ユーザーフローの検証
```