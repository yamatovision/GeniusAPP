# AppGenius AI プロンプト管理ガイド

## 概要

このドキュメントは、AppGeniusの各種AIアシスタント（デバッグ探偵、要件定義ビジュアライザー、スコープマネージャーなど）のプロンプト管理と安全な受け渡し方法について説明します。特に、単一プロンプトを安全に扱うための実装パターンと、一時ファイルの適切な管理に焦点を当てています。

## 背景

AppGeniusでは、複数のAIアシスタントがそれぞれ異なる機能を提供しています。これらのアシスタントは、専用のプロンプトを使用し、Claude CLIにファイル経由で受け渡します。安全なプロンプト管理において以下の課題が見つかりました：

1. **ファイルの安全性の確保**: 一時ファイルがOSの標準一時ディレクトリに保存されると追跡しにくい
2. **プロンプトファイルの自動削除**: 使用後のプロンプトファイルの適切な削除が必要
3. **プラットフォーム互換性**: Windows, macOS, Linuxでの一貫した動作が求められる
4. **起動時の初期指示の最適化**: `echo "y\n..."` による最初の指示がAIの動作に大きく影響する

## 標準実装方法

### 1. セキュアな一時ファイル管理

プロジェクト内に隠しディレクトリを作成し、ランダムな名前の隠しファイルを使用します：

```typescript
// プロジェクト内に隠しディレクトリを作成
const hiddenDir = path.join(projectPath, '.appgenius_temp');
if (!fs.existsSync(hiddenDir)) {
  fs.mkdirSync(hiddenDir, { recursive: true });
}

// ランダムな文字列を生成して隠しファイル名に使用
const randomStr = Math.random().toString(36).substring(2, 15);
const promptFileName = `.vq${randomStr}`;
const promptFilePath = path.join(hiddenDir, promptFileName);
```

### 2. プロンプト内容の構成

プロンプト内容とオプションの追加コンテンツを構成します：

```typescript
// マークダウン形式でプロンプト内容を生成
let content = `# ${prompt.title}\n\n`;
if (prompt.description) content += `${prompt.description}\n\n`;
if (prompt.tags && prompt.tags.length > 0) content += `タグ: ${prompt.tags.join(', ')}\n`;
content += `\n---\n\n${prompt.content}`;

// 追加コンテンツがあれば追加（デバッグ探偵からのエラー情報など）
if (additionalContent) {
  content += `\n\n${additionalContent}`;
  Logger.info('追加コンテンツをプロンプトに追加しました');
}

// ファイルに書き込み
fs.writeFileSync(promptFilePath, content, 'utf8');
Logger.info('セキュアな隠しプロンプトファイルに内容を書き込みました');
```

### 3. 安全なタイムアウト削除

ファイルが確実に読み込まれた後に削除されるようタイムアウトを設定します：

```typescript
// プロンプトファイルを即時削除（セキュリティ対策）
if (options?.deletePromptFile) {
  try {
    // Windowsでは使用中のファイルは削除できないため、Linuxとmacのみ遅延削除
    if (process.platform !== 'win32') {
      setTimeout(() => {
        if (fs.existsSync(promptFilePath)) {
          fs.unlinkSync(promptFilePath);
          Logger.info(`プロンプトファイルを削除しました: ${promptFilePath}`);
        }
      }, 30000); // ファイルが読み込まれる時間を考慮して30秒後に削除
    }
    
    // ターミナル終了時のイベントリスナーを設定（全プラットフォーム対応）
    const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
      if (closedTerminal === terminal) {
        setTimeout(() => {
          try {
            if (fs.existsSync(promptFilePath)) {
              fs.unlinkSync(promptFilePath);
              Logger.info(`プロンプトファイルを削除しました（ターミナル終了時）: ${promptFilePath}`);
            }
          } catch (unlinkError) {
            Logger.error(`ファイル削除エラー（ターミナル終了時）: ${unlinkError}`);
          }
        }, 500);
        disposable.dispose(); // リスナーの破棄
      }
    });
  } catch (deleteError) {
    Logger.warn(`プロンプトファイルの削除設定に失敗しました: ${deleteError}`);
  }
}
```

### 4. 起動コマンドの最適化

Claude CLIを起動する際のecho指示を明確にし、一貫性を持たせます：

```typescript
// 起動コマンド
terminal.sendText(`echo "y\\n日本語で対応してください。指定されたファイルを読み込むところから始めてください。" | claude ${escapedPromptFilePath}`);
```

## 具体的な実装例: 単一プロンプトの利用

単一プロンプトでClaudeCodeを起動する実装例（`ClaudeCodeIntegrationService.ts`の`launchWithPublicUrl`メソッド）：

```typescript
public async launchWithPublicUrl(
  promptUrl: string,
  projectPath: string,
  additionalContent?: string
): Promise<boolean> {
  try {
    // URLからプロンプト情報を取得
    const prompt = await this._apiClient.getPromptFromPublicUrl(promptUrl);
    if (!prompt) {
      throw new Error(`URLからプロンプトを取得できませんでした: ${promptUrl}`);
    }

    // プロジェクト内に隠しディレクトリを作成（既に存在する場合は作成しない）
    const hiddenDir = path.join(projectPath, '.appgenius_temp');
    if (!fs.existsSync(hiddenDir)) {
      fs.mkdirSync(hiddenDir, { recursive: true });
    }
    
    // ランダムな文字列を生成して隠しファイル名に使用
    const randomStr = Math.random().toString(36).substring(2, 15);
    const promptFileName = `.vq${randomStr}`;
    const promptFilePath = path.join(hiddenDir, promptFileName);
    
    // マークダウン形式でプロンプト内容を生成
    let content = `# ${prompt.title}\n\n`;
    if (prompt.description) content += `${prompt.description}\n\n`;
    if (prompt.tags && prompt.tags.length > 0) content += `タグ: ${prompt.tags.join(', ')}\n`;
    content += `\n---\n\n${prompt.content}`;
    
    // 追加コンテンツがあれば追加
    if (additionalContent) {
      content += `\n\n${additionalContent}`;
    }

    // ファイルに書き込み
    fs.writeFileSync(promptFilePath, content, 'utf8');

    // ClaudeCodeを起動（プロンプトファイル削除オプション付き）
    return await this._launcher.launchClaudeCodeWithPrompt(
      projectPath,
      promptFilePath,
      { 
        title: `ClaudeCode - ${prompt.title}`,
        deletePromptFile: true // 自動削除オプション
      }
    );
  } catch (error) {
    Logger.error('単一プロンプトでのClaudeCode起動に失敗しました', error as Error);
    vscode.window.showErrorMessage(`AIアシスタントの起動に失敗しました: ${(error as Error).message}`);
    return false;
  }
}
```

### 各AIアシスタントパネルでの使用方法

デバッグ探偵、要件定義ビジュアライザーなどの各AIアシスタントパネルで単一プロンプトを使用する場合の実装例：

```typescript
// プロンプトURL
const featurePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09';

// 追加情報を準備（例：エラー情報や要件定義）
let analysisContent = '# エラー情報\n\n```\n';
analysisContent += errorLog;
analysisContent += '\n```\n\n';

// ClaudeCodeIntegrationServiceのインスタンスを取得
const integrationService = await import('../../services/ClaudeCodeIntegrationService').then(
  module => module.ClaudeCodeIntegrationService.getInstance()
);

// 単一プロンプトで起動
Logger.info(`デバッグ探偵プロンプトを直接使用してClaudeCodeを起動: ${featurePromptUrl}`);

// 単一プロンプトでClaudeCodeを起動
await integrationService.launchWithPublicUrl(
  featurePromptUrl, 
  this._projectPath,
  analysisContent // 追加コンテンツを渡す
);
```

## .gitignoreの設定

一時ファイルをGitから除外するため、`.gitignore`に以下を追加します：

```
.appgenius_temp/
```

## 注意点

1. **ファイルの読み込み時間**: 30秒のタイムアウトは、通常のネットワーク環境でファイルが確実に読み込まれるための値です。

2. **Windowsでの動作**: Windowsでは、ファイルが使用中の場合は削除できないため、ターミナル終了時に削除する仕組みに依存します。

3. **プラットフォーム互換性**: この実装はmacOS、Linux、Windowsで動作しますが、Windowsではファイル削除のタイミングが異なります。

4. **一時ディレクトリのクリーンアップ**: VSCode起動時に古い一時ファイルを自動的に削除する機能を導入することが推奨されます。

## 各AIアシスタントのプロンプトURL

### 単一プロンプトとして使用するもの

- **デバッグ探偵（シャーロックホームズ）** 
  - URL: `http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09`

- **要件定義アドバイザー**
  - URL: `http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39`

- **プロジェクト分析アシスタント**
  - URL: `http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/8c09f971e4a3d020497eec099a53e0a6`

- **モックアップアナライザー**
  - URL: `http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb`

- **環境変数設定アシスタント**
  - URL: `http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/50eb4d1e924c9139ef685c2f39766589`

- **スコープマネージャー**
  - URL: `http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704`

- **スコープインプリメンター**
  - URL: `http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a`

- **個別モックアップ作成用プロンプトー**
  http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/247df2890160a2fa8f6cc0f895413aed

