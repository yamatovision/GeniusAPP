# AppGenius AI プロンプト統合ガイド

## 概要

このドキュメントは、AppGeniusの各種AIアシスタント（デバッグ探偵、スコープマネージャー、スコープインプリメンターなど）に対して、複数プロンプトを組み合わせる際の標準実装方法について説明します。特にセキュアなファイル管理とプロンプト組み合わせの最適化に焦点を当てています。

## 背景

AppGeniusでは、複数のAIアシスタントが異なる機能を提供しています。これらのアシスタントに対して、機能プロンプトとガイダンスプロンプト（セキュリティ境界など）を組み合わせることで、より高度な機能と制約を実現しています。実装において以下の課題が見つかりました：

1. **ファイルアクセスの問題**: 「セキュリティ」などの特定の用語や文脈が存在すると、AIが一時ファイルへのアクセスを拒否する場合がある
2. **起動時の指示の影響**: 最初の応答メッセージ（`echo "y\n..."`）の内容がAIの動作に大きく影響する
3. **長文プロンプトの切断問題**: ヒアドキュメント方式では長いプロンプトでターミナル接続が切れる場合がある
4. **一時ファイルのセキュリティ**: 生成された一時ファイルの適切な管理と削除が必要

## 標準実装方法

### 1. セキュアな一時ファイル管理

セキュリティを向上させるため、プロジェクト内に隠しディレクトリを作成し、ランダムなファイル名を使用します：

```typescript
// プロジェクト内に隠しディレクトリを作成
const hiddenDir = path.join(projectPath, '.appgenius_temp');
if (!fs.existsSync(hiddenDir)) {
  fs.mkdirSync(hiddenDir, { recursive: true });
}

// ランダムな文字列を生成して隠しファイル名に使用
const randomStr = Math.random().toString(36).substring(2, 15);
const combinedPromptFileName = `.vq${randomStr}`;
const combinedPromptPath = path.join(hiddenDir, combinedPromptFileName);
```

### 2. 複数プロンプトの結合

ガイダンスプロンプトと機能プロンプト、および追加コンテンツを明確に区切って結合します：

```typescript
// ガイダンスプロンプトを先頭に配置して結合
let combinedContent = guidancePrompt;
combinedContent += '\n\n---\n\n';
combinedContent += featurePrompt;

// 追加コンテンツがあれば最後に追加
if (additionalContent) {
  combinedContent += '\n\n---\n\n';
  combinedContent += additionalContent;
}

// 結合したプロンプトをファイルに保存
fs.writeFileSync(combinedPromptPath, combinedContent, 'utf8');
Logger.info(`セキュアな複合プロンプトファイルを作成しました: ${combinedPromptPath}`);
```

### 3. 安全なタイムアウト削除

ファイルが確実に読み込まれた後に削除されるようタイムアウトを設定します：

```typescript
// ClaudeCodeLauncherService.tsのlaunchClaudeCodeWithPromptメソッド内
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
    Logger.warn(`プロンプトファイルの即時削除に失敗しました: ${deleteError}`);
  }
}
```

### 4. 起動コマンドの最適化

Claude CLIを起動する際のecho指示を明確にし、一貫性を持たせます：

```typescript
// 起動コマンド
terminal.sendText(`echo "y\\n日本語で対応してください。指定されたファイルを読み込むところから始めてください。" | claude ${escapedPromptFilePath}`);
```

### 5. 中立的な変数名とログメッセージ

セキュリティに関連する用語を避け、中立的な表現を使用します：

```typescript
// 変数名
public async launchWithSecurityBoundary(
  guidancePromptUrl: string,  // 「セキュリティ」ではなく「ガイダンス」
  featurePromptUrl: string,
  ...
)

// ログメッセージ
Logger.info(`複合プロンプトでClaudeCodeを起動します: プロンプト1=${guidancePromptUrl}, プロンプト2=${featurePromptUrl}`);
```

## 具体的な実装例

### 1. ClaudeCodeIntegrationService.ts内の実装

`src/services/ClaudeCodeIntegrationService.ts`の`launchWithSecurityBoundary`メソッドで標準実装を行います：

```typescript
public async launchWithSecurityBoundary(
  guidancePromptUrl: string,
  featurePromptUrl: string,
  projectPath: string,
  additionalContent?: string
): Promise<boolean> {
  try {
    Logger.info(`複合プロンプトでClaudeCodeを起動: プロンプト1=${guidancePromptUrl}, プロンプト2=${featurePromptUrl}`);
    
    // 両方のプロンプトの内容を取得
    const guidancePrompt = await this.fetchPromptContent(guidancePromptUrl);
    if (!guidancePrompt) {
      throw new Error(`ガイダンスプロンプトの取得に失敗しました: ${guidancePromptUrl}`);
    }
    
    const featurePrompt = await this.fetchPromptContent(featurePromptUrl);
    if (!featurePrompt) {
      throw new Error(`機能プロンプトの取得に失敗しました: ${featurePromptUrl}`);
    }
    
    // プロジェクト内に隠しディレクトリを作成（既に存在する場合は作成しない）
    const hiddenDir = path.join(projectPath, '.appgenius_temp');
    if (!fs.existsSync(hiddenDir)) {
      fs.mkdirSync(hiddenDir, { recursive: true });
    }
    
    // ランダムな文字列を生成して隠しファイル名に使用
    const randomStr = Math.random().toString(36).substring(2, 15);
    const combinedPromptFileName = `.vq${randomStr}`;
    const combinedPromptPath = path.join(hiddenDir, combinedPromptFileName);
    
    // ガイダンスプロンプトを先頭に配置して結合
    let combinedContent = guidancePrompt;
    combinedContent += '\n\n---\n\n';
    combinedContent += featurePrompt;
    
    // 追加コンテンツがあれば最後に追加
    if (additionalContent) {
      combinedContent += '\n\n---\n\n';
      combinedContent += additionalContent;
    }
    
    // 結合したプロンプトをファイルに保存
    fs.writeFileSync(combinedPromptPath, combinedContent, 'utf8');
    Logger.info(`セキュアな複合プロンプトファイルを作成しました: ${combinedPromptPath}`);
    
    // ClaudeCodeを起動（プロンプトファイル削除オプション付き）
    return await this._launcher.launchClaudeCodeWithPrompt(
      projectPath,
      combinedPromptPath,
      {
        title: 'AIアシスタント',
        deletePromptFile: true // ClaudeCodeLauncherServiceでファイルが読み込まれた後にタイマーベースで削除
      }
    );
  } catch (error) {
    Logger.error('複合プロンプトでのClaudeCode起動に失敗しました', error as Error);
    vscode.window.showErrorMessage(`AIアシスタントの起動に失敗しました: ${(error as Error).message}`);
    return false;
  }
}
```

### 2. 各AIアシスタントパネルでの使用方法

デバッグ探偵、スコープマネージャーなど、各AIアシスタントパネルで以下のパターンを使用します：

```typescript
// guidancePromptUrlとfeaturePromptUrlを定義
const guidancePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/6640b55f692b15f4f4e3d6f5b1a5da6c';
const featurePromptUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/あなたの機能プロンプトID';

// ClaudeCodeIntegrationServiceのインスタンスを取得
const integrationService = await import('../../services/ClaudeCodeIntegrationService').then(
  module => module.ClaudeCodeIntegrationService.getInstance()
);

// 複合プロンプトでClaudeCodeを起動
Logger.info(`複合プロンプトでClaudeCodeを起動します: プロンプト1=${guidancePromptUrl}, プロンプト2=${featurePromptUrl}`);

// セキュリティ境界方式でClaudeCodeを起動
await integrationService.launchWithSecurityBoundary(
  guidancePromptUrl,
  featurePromptUrl, 
  this._projectPath,
  additionalContent // オプション：追加コンテンツがある場合
);
```

## .gitignoreの設定

一時ファイルをGitから除外するため、`.gitignore`に以下を追加します：

```
.appgenius_temp/
```

## 注意点

1. **ファイルの読み込み時間**: 30秒のタイムアウトは、通常のネットワーク環境でファイルが確実に読み込まれるための値です。ネットワーク状況によって調整が必要な場合があります。

2. **セキュリティと安全性**: この実装はファイルの安全な管理を目的としていますが、プロンプト内容の機密性を完全に保証するものではありません。機密性の高い情報は含めないようにしてください。

3. **プラットフォーム互換性**: この実装はmacOS、Linux、Windowsで動作しますが、ファイル削除の動作はプラットフォームによって異なります。テストを行い、必要に応じて調整してください。

4. **一時ディレクトリのクリーンアップ**: ターミナルの予期せぬ終了などでファイルが削除されない場合があります。定期的な一時ディレクトリのクリーンアップを検討してください。

5. **変数名のガイドライン**: 「セキュリティ」「制約」「保護」などの用語は引き続き避け、「ガイダンス」「複合」「統合」などの中立的な用語を使用してください。

## 今後の改善案

1. **デフォルトディレクトリのクリーンアップ機能**: 起動時に古い一時ファイルを自動的に削除する機能
2. **プロンプト分割アルゴリズム**: 非常に長いプロンプトを複数の部分に分割して処理する機能
3. **暗号化オプション**: 一時ファイルを暗号化して保存する機能（高セキュリティ用途向け）

これらの標準実装方法に従うことで、安定したAIアシスタントの動作とセキュアなプロンプト管理を実現できます。

## 参考リンク






スコープマネージャー
http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704
vscode://mikoto.app-genius/launch-claude-code?url=http%3A%2F%2Fgeniemon-portal-backend-production.up.railway.app%2Fapi%2Fprompts%2Fpublic%2Fb168dcd63cc12e15c2e57bce02caf704


スコープインプリメンター

http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a
vscode://mikoto.app-genius/launch-claude-code?url=http%3A%2F%2Fgeniemon-portal-backend-production.up.railway.app%2Fapi%2Fprompts%2Fpublic%2F868ba99fc6e40d643a02e0e02c5e980a

要件定義アドバイザー
http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39
vscode://mikoto.app-genius/launch-claude-code?url=http%3A%2F%2Fgeniemon-portal-backend-production.up.railway.app%2Fapi%2Fprompts%2Fpublic%2Fcdc2b284c05ebaae2bc9eb1f3047aa39


モックアップアナライザー
http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb
vscode://mikoto.app-genius/launch-claude-code?url=http%3A%2F%2Fgeniemon-portal-backend-production.up.railway.app%2Fapi%2Fprompts%2Fpublic%2F8cdfe9875a5ab58ea5cdef0ba52ed8eb


環境変数設定アシスタント
http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/50eb4d1e924c9139ef685c2f39766589
vscode://mikoto.app-genius/launch-claude-code?url=http%3A%2F%2Fgeniemon-portal-backend-production.up.railway.app%2Fapi%2Fprompts%2Fpublic%2F50eb4d1e924c9139ef685c2f39766589


デバック探偵シャーロックホームズ
http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09
vscode://mikoto.app-genius/launch-claude-code?url=http%3A%2F%2Fgeniemon-portal-backend-production.up.railway.app%2Fapi%2Fprompts%2Fpublic%2F942ec5f5b316b3fb11e2fd2b597bfb09

セキュリティプロンプト
http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/6640b55f692b15f4f4e3d6f5b1a5da6c
vscode://mikoto.app-genius/launch-claude-code?url=http%3A%2F%2Fgeniemon-portal-backend-production.up.railway.app%2Fapi%2Fprompts%2Fpublic%2F6640b55f692b15f4f4e3d6f5b1a5da6c





プロジェクト分析アシスタント
http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/8c09f971e4a3d020497eec099a53e0a6

vscode://mikoto.app-genius/launch-claude-code?url=http%3A%2F%2Fgeniemon-portal-backend-production.up.railway.app%2Fapi%2Fprompts%2Fpublic%2F8c09f971e4a3d020497eec099a53e0a6



 1. 先ほど初期メッセージを統一しました：「y\n日本語で対応してください。指定されたファイルを読み込むところか
  ら始めてください。」
  2. 次に、記載されている各AIアシスタント（スコープマネージャー、スコープインプリメンター、要件定義アドバイ
  ザー、モックアップアナライザー、環境変数設定アシスタント）の起動方法を、デバッグ探偵と同様に修正します。
  3. 具体的には、今まで単一プロンプトで起動していたものを、セキュリティガイドライン（6640b55f692b15f4f4e3d6f
  5b1a5da6c）と各機能プロンプトを組み合わせた形で起動するように変更します。
  4. それぞれのアシスタントが受け渡す情報自体は変更せず、プロンプトの受け渡し方法のみを変更します。
  5. 実装方法としては、launchClaudeCodeWithPromptの代わりにClaudeCodeIntegrationServiceのlaunchWithSecurityB
  oundaryメソッドを使用して、ガイダンスプロンプトと機能プロンプトを組み合わせます。

  この理解で正しいでしょうか？修正を進めてよろしければ、記載された各アシスタントの修正を1つずつ行っていきま
  す。
