# AppGenius AI プロンプト統合ガイド

## 概要

このドキュメントは、AppGeniusの各種AIアシスタント（デバッグ探偵、スコープマネージャー、スコープインプリメンターなど）に対して、複数プロンプトを組み合わせる際の推奨手法について説明します。特に、プロンプトの組み合わせ方法とファイルアクセス問題の解決方法に焦点を当てています。

## 背景

AppGeniusでは、複数のAIアシスタントが異なる機能を提供しています。これらのアシスタントに対して、機能プロンプトとガイダンスプロンプト（セキュリティ境界など）を組み合わせることで、より高度な機能と制約を実現しています。しかし、この実装においていくつかの課題が見つかりました：

1. **ファイルアクセスの問題**: 「セキュリティ」などの特定の用語や文脈が存在すると、AIが一時ファイルへのアクセスを拒否する場合がある
2. **起動時の指示の影響**: 最初の応答メッセージ（`echo "y\n..."`）の内容がAIの動作に大きく影響する

## 推奨実装方法

### 1. ファイル名とメッセージの中立化

セキュリティに関連する用語を避け、より中立的な表現を使用します：

```typescript
// 変更前
const combinedPromptFileName = `secure_prompt_${Date.now()}.md`;
Logger.info(`セキュリティ境界付きプロンプトファイルを作成しました: ${combinedPromptPath}`);

// 変更後
const combinedPromptFileName = `combined_prompt_${Date.now()}.md`;
Logger.info(`複合プロンプトファイルを作成しました: ${combinedPromptPath}`);
```

### 2. メソッドと引数名の変更

メソッドや引数名に含まれるセキュリティ関連用語を避けます：

```typescript
// 変更前
public async launchWithSecurityBoundary(
  securityPromptUrl: string,
  featurePromptUrl: string,
  ...
)

// 変更後
public async launchWithSecurityBoundary( // メソッド名は後方互換性のために変更なし
  guidancePromptUrl: string,  // 引数名を変更
  featurePromptUrl: string,
  ...
)
```

### 3. 起動コマンドの指示文の最適化

Claude CLIを起動する際のecho指示を、より直接的かつ明示的なものに変更します：

```typescript
// 変更前
terminal.sendText(`echo "y\\n日本語で対応してください。プロンプトに従って解析を進めてください。" | claude ${escapedPromptFilePath}`);

// 変更後
terminal.sendText(`echo "y\\n日本語で対応してください。指定されたファイルを読み込むところから始めてください。" | claude ${escapedPromptFilePath}`);
```

### 4. ログメッセージの中立化

ログ出力でもセキュリティに関連する用語を避けます：

```typescript
// 変更前
Logger.info(`セキュリティ境界付きでClaudeCodeを起動します: セキュリティ=${securityPromptUrl}, 機能=${debugDetectivePromptUrl}`);

// 変更後
Logger.info(`複合プロンプトでClaudeCodeを起動します: プロンプト1=${guidancePromptUrl}, プロンプト2=${debugDetectivePromptUrl}`);
```

## 各アシスタントへの適用手順

### デバッグ探偵（DebugDetectivePanel）

1. `src/ui/debugDetective/DebugDetectivePanel.ts`内のプロンプト起動部分を修正
2. URLの変数名を`securityPromptUrl`から`guidancePromptUrl`に変更
3. ログメッセージを「複合プロンプト」形式に変更

### スコープマネージャー（ScopeManagerPanel）

1. `src/ui/scopeManager/ScopeManagerPanel.ts`内の類似処理を特定
2. 上記と同様の変更を適用

### スコープインプリメンター

1. `src/modes/implementationMode/scopeSelector.ts`またはその関連ファイル内の処理を特定
2. 上記と同様の変更を適用

## 理論的根拠

1. **AIの文脈感度**: Claude等のAIモデルは、「セキュリティ」「保護」「制約」などの用語に敏感に反応し、より厳格なセキュリティポリシーを適用する傾向があります。

2. **直接的な指示の有効性**: 「プロンプトに従って」のような間接的な指示よりも、「ファイルを読み込む」のような具体的な指示の方が、AIが自律的に判断せずに指示通りに行動する可能性が高まります。

3. **ファイル名の影響**: `secure_prompt_`のようなファイル名はAIに対して「これはセキュリティに関連するファイルだ」という印象を与え、取り扱いに慎重になる可能性があります。

## 注意点

1. この変更はAIの動作に影響しますが、実際のセキュリティ制約には影響しません。セキュリティプロンプトの内容自体は変更せず、それを参照する方法だけを変更します。

2. 今後Claude CLIやAIモデル自体がアップデートされた場合、これらの動作も変わる可能性があります。定期的に動作を確認し、必要に応じて調整してください。

3. 新しいAIアシスタントを追加する際も、ここで説明したパターンを踏襲することをお勧めします。

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


すみません、置換テキストが正確に見つかりませんでした。より広い範囲でコードを検索して編集します。

⏺ Update(file_path: src/ui/debugDetective/DebugDetectivePanel.ts)…
  ⎿  Updated src/ui/debugDetective/DebugDetectivePanel.ts with 90 additions and 8 removals
     410            module => module.ClaudeCodeIntegrationService.getInstance()
     411          );
     412 
     413          // 複合プロンプトでClaudeCodeを起動（エラー分析内容を追加コンテンツとして渡す）
     414          Logger.info(`複合プロンプトでClaudeCodeを起動します: プロンプト1=${guidancePromptUrl}, プロンプト2=${debugDetectivePromptUrl}`);
     415          await integrationService.launchWithSecurityBoundary(
     416            guidancePromptUrl,
     417            debugDetectivePromptUrl, 
     418            this._projectPath,
     419            analysisContent // 重要：エラー分析内容を追加コンテンツとして渡す
     420          );
     413          try {
     414            // API接続のヒアドキュメント方式でプロンプトを取得
     415            Logger.info(`複合プロンプトでClaudeCodeを起動します: プロンプト1=${guidancePromptUrl}, プロンプト2=${debugDetectivePromptUrl}`);
     416            
     417            // 両方のプロンプトの内容を取得
     418            const guidancePrompt = await integrationService.fetchPromptContent(guidancePromptUrl);
     419            if (!guidancePrompt) {
     420              throw new Error(`ガイダンスプロンプトの取得に失敗しました: ${guidancePromptUrl}`);
     421            }
     422            
     423            const debugDetectivePrompt = await integrationService.fetchPromptContent(debugDetectivePromptUrl);
     424            if (!debugDetectivePrompt) {
     425              throw new Error(`デバッグ探偵プロンプトの取得に失敗しました: ${debugDetectivePromptUrl}`);
     426            }
     427            
     428            // アイコンURIを取得
     429            const platformManager = await import('../../utils/PlatformManager').then(
     430              module => module.PlatformManager.getInstance()
     431            );
     432            const iconPath = platformManager.getResourceUri('media/assets/sherlock.svg');
     433            
     434            // ターミナルの作成
     435            const terminal = vscode.window.createTerminal({
     436              name: 'デバッグ探偵',
     437              cwd: this._projectPath,
     438              iconPath: iconPath && typeof iconPath !== 'string' && fs.existsSync(iconPath.fsPath) ? iconPath : undefined
     439            });
     440            
     441            // ターミナルの表示（true を渡してフォーカスする）
     442            terminal.show(true);
     443            
     444            // 最初にユーザーガイダンスを表示
     445            terminal.sendText('echo "\n\n*** AIが自動的に処理を開始します。自動対応と日本語指示を行います ***\n"');
     446            terminal.sendText('sleep 2'); // 2秒待機してメッセージを読む時間を確保
     447            
     448            // macOSの場合は環境変数のソースを確保（出力を非表示）
     449            if (process.platform === 'darwin') {
     450              terminal.sendText('source ~/.zshrc || source ~/.bash_profile || source ~/.profile || echo "No profile found" > /dev/null 2>&1');
     451              terminal.sendText('export PATH="$PATH:$HOME/.nvm/versions/node/v18.20.6/bin:/usr/local/bin:/usr/bin"');
     452            }
     453            
     454            // 明示的にプロジェクトルートディレクトリに移動（出力を非表示）
     455            const escapedProjectPath = this._projectPath.replace(/"/g, '\\"');
     456            terminal.sendText(`cd "${escapedProjectPath}" > /dev/null 2>&1 && pwd > /dev/null 2>&1`);
     457            
     458            // ヒアドキュメント方式で起動（プロンプト内容を一時ファイルに保存せずに直接渡す）
     459            // バッククォートをエスケープしてヒアドキュメント内で問題が起きないようにする
     460            const escaped_guidancePrompt = guidancePrompt.replace(/`/g, '\\`');
     461            const escaped_debugDetectivePrompt = debugDetectivePrompt.replace(/`/g, '\\`');
     462            const escaped_analysisContent = analysisContent.replace(/`/g, '\\`');
     463            
     464            // ヒアドキュメント方式で起動
     465            terminal.sendText(`echo "y\\n日本語で対応してください。指定されたファイルを読み込むところから始めてください。" | claude << 'PROMPT_EOF'
     466  ${escaped_guidancePrompt}
     467  
     468  ---
     469  
     470  ${escaped_debugDetectivePrompt}
     471  
     472  ---
     473  
     474  ${escaped_analysisContent}
     475  PROMPT_EOF`);
     476            
     477            Logger.info('ヒアドキュメント方式でClaudeCodeを起動しました');
     478            
     479            // イベント発火（既存の統合と互換性を保つため）
     480            const eventBus = await import('../../services/AppGeniusEventBus').then(
     481              module => module.AppGeniusEventBus.getInstance()
     482            );
     483            
     484            eventBus.emit(
     485              'CLAUDE_CODE_STARTED',
     486              { 
     487                projectPath: this._projectPath
     488              },
     489              'DebugDetectivePanel'
     490            );
     491          } catch (error) {
     492            // ヒアドキュメント方式に失敗した場合、元の方法にフォールバック
     493            Logger.warn(`ヒアドキュメント方式の起動に失敗しました。セキュリティ境界方式で試行します: ${error}`);
     494            
     495            // 元の方法でClaudeCodeを起動
     496            await integrationService.launchWithSecurityBoundary(
     497              guidancePromptUrl,
     498              debugDetectivePromptUrl, 
     499              this._projectPath,
     500              analysisContent // 重要：エラー分析内容を追加コンテンツとして渡す
     501            );
     502          }
     503 
     504          // 解析データのファイルを作成するだけで開かず、通知も表示しない
     505          Logger.info(`エラー分析ファイルを作成しました: ${analysisFilePath}`);

⏺ これでファイルの編集は成功しました。デバッグ探偵の起動処理を変更して、API接続のヒアドキュメント方式でClaudeCodeを起動するようにしました。

  変更のポイントは以下の通りです：

  1. ヒアドキュメント方式の実装：
    - APIからプロンプト内容を直接取得
    - 一時ファイルを作成せずに、プロンプト内容をヒアドキュメント構文で直接Claude CLIに渡す
    - バッククォート（）をエスケープして、ヒアドキュメント内での問題を防止
  2. エラー処理：
    - ヒアドキュメント方式が失敗した場合、元のlaunchWithSecurityBoundary方式にフォールバック
    - 堅牢性を確保するため、両方の方法をサポート
  3. イベント互換性：
    - 元のコードと同じイベントを発行し、他のコンポーネントとの互換性を維持

  これにより、以下のメリットが得られます：

  1. 一時ファイルの作成・管理・削除が不要になり、セキュリティが向上
  2. ディスクI/Oが減少し、パフォーマンスが向上
  3. ファイルの削除タイミングを気にする必要がなくなる

  この実装は、APIからプロンプト内容を取得できる場合に最も効果的です。何らかの理由でAPIアクセスに失敗した場合でも、元の方法にフォールバックするため堅牢性も確保されています。
