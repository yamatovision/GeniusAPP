# ClaudeCodeトークン使用履歴修正と分離認証モード修正スコープ

## 概要
現在、ClaudeCodeトークン使用履歴機能と分離認証モードに問題があります。トークン使用が正しく記録されていないことに加え、分離認証モード（APPGENIUS_USE_ISOLATED_AUTH=true）が有効でも専用認証ファイルが生成されていません。APIエンドポイントの呼び出し、エラーハンドリング、および認証同期処理を改善して、これらの問題を解決する必要があります。ユーザーのトークン使用を正確に追跡し、分離認証モードを正しく機能させることで、API使用量の効率的な管理と安全性の向上が可能になります。

## 成功基準
- 分離認証モードが正しく機能し、AppGenius専用の認証ファイルが生成・使用される
- ClaudeCodeのトークン使用がすべて正確に記録される
- エラー発生時も適切にリトライされ、データが失われない
- API呼び出しのログが正確かつ有用な情報を提供する
- ダッシュボードでトークン使用量が正しく表示される
- 認証エラーが発生してもグレースフルに処理される

## 対象ファイル

### API連携コード
- `src/api/claudeCodeApiClient.ts`
  - トークン使用履歴APIエンドポイントの修正
  - エラーハンドリングロジックの強化
  - リトライメカニズムの最適化
- `src/services/ClaudeCodeAuthSync.ts`
  - 分離認証モードの処理修正
  - 認証同期処理の改善
  - TokenManagerとの連携強化
- `src/services/ClaudeCodeLauncherService.ts`
  - 分離認証モード連携の強化
  - 環境変数処理の改善

### エラーハンドリング
- `src/utils/ErrorHandler.ts`
  - エラーログ記録の改善
  - 詳細なエラーコンテキストの提供
- `src/utils/logger.ts`
  - ログ出力の改善
  - APIエラーの詳細な記録

### テスト追加
- `test/claudeCodeApiClient.test.js`
  - APIクライアントのテスト追加
  - エラーケースのテスト
  - リトライロジックのテスト
- `test_script/fix_isolated_auth.js`
  - 分離認証モードのトラブルシューティングスクリプト
- `test_script/token_usage_check_guide.md`
  - テスト手順とトラブルシューティングガイド

## 実装計画

### ステップ1: 現状の問題分析（1日）
1. 分離認証モード問題の詳細調査
2. APIエンドポイントの呼び出し問題を詳細に調査
3. 現在のエラーパターンを特定
4. ログからエラー発生状況を分析
5. テスト環境でAPIエンドポイントとファイル作成を検証

### ステップ2: 分離認証モード修正（1日）
1. ClaudeCodeAuthSync.tsの認証同期処理の修正
2. 環境変数チェックと分離認証ファイル生成の強化
3. ディレクトリ存在確認処理の改善
4. 診断とデバッグのための詳細なログ出力追加

### ステップ3: APIクライアント修正（2日）
1. claudeCodeApiClient.tsのトークン記録関数の修正
2. 新旧エンドポイントの適切な扱いの実装
3. 認証エラー処理の改善
4. リトライロジックの強化

### ステップ4: エラーハンドリング強化（1-2日）
1. ErrorHandler.tsのエラーログ記録機能強化
2. エラータイプによる処理分岐の最適化
3. 認証エラーとネットワークエラーの区別
4. 詳細なログ出力の実装

### ステップ5: テスト作成と検証（2日）
1. 単体テストの作成
2. 分離認証モードテストスクリプトの作成
3. エラーケースのモックテスト
4. リトライロジックのテスト
5. 実際のAPIエンドポイントとの結合テスト

## 技術的アプローチ
1. 分離認証モードが正しく機能するよう、環境変数チェックとファイル生成処理を修正します
2. ディレクトリ作成処理を強化し、適切なパーミッションでディレクトリとファイルが作成されるようにします
3. 現在使用中のトークン記録APIエンドポイントが正しく設定されているか確認し、必要に応じて更新します
4. エラーハンドリングを改善し、ネットワークエラーや認証エラーなど、エラータイプに応じた適切な処理を実装します
5. 一時的なネットワーク問題に対するリトライロジックを強化し、指数バックオフやジッター機能を追加します
6. エラーメッセージと状態コードの詳細なログ記録を実装し、デバッグを容易にします
7. 認証ファイル作成と同期のテストスクリプトを提供し、問題診断を容易にします

## リスクと対策
- **リスク**: 分離認証モード環境変数の誤認識や設定不備による問題
  - **対策**: 環境変数チェックを強化し、デバッグログを改善して問題を特定しやすくする
- **リスク**: ファイルシステムのパーミッション問題で認証ファイルが作成できない
  - **対策**: エラーハンドリングを強化し、明確なエラーメッセージを表示する
- **リスク**: APIエンドポイントの仕様変更による互換性の問題
  - **対策**: 新旧両方のエンドポイントに対応したフォールバックメカニズムの実装
- **リスク**: 認証タイミングの問題でトークン記録APIが呼び出せない
  - **対策**: 認証状態の確認と必要に応じた自動リフレッシュの実装
- **リスク**: 過剰なリトライによるサーバー負荷
  - **対策**: 適切なリトライ上限と指数バックオフの設定
- **リスク**: ユーザー設定環境で問題が再現しにくい
  - **対策**: 詳細なトラブルシューティングガイドと診断スクリプトを提供

## 実装詳細

### 分離認証モード修正
```typescript
// ClaudeCodeAuthSync.ts の修正例
private async _syncTokensToClaudeCode(useIsolatedAuth: boolean = false): Promise<void> {
  try {
    // 環境変数で強制的に分離認証モードが設定されている場合は上書き
    if (process.env.APPGENIUS_USE_ISOLATED_AUTH === 'true') {
      useIsolatedAuth = true;
      Logger.info('環境変数設定により分離認証モードを使用します');
    }
    
    // トークンを取得
    const accessToken = await this._tokenManager.getAccessToken();
    const refreshToken = await this._tokenManager.getRefreshToken();
    
    if (!accessToken || !refreshToken) {
      Logger.warn('トークンが取得できないため、ClaudeCode CLIとの同期をスキップします');
      return;
    }
    
    // 認証情報ディレクトリとファイルパスを決定
    let authDir: string;
    let authFileName: string;
    
    if (useIsolatedAuth) {
      // AppGenius専用の認証情報ディレクトリを使用
      authDir = this._getAppGeniusAuthDir();
      authFileName = 'claude-auth.json';
      Logger.info('分離認証モードを使用: AppGenius専用の認証情報を保存します');
    } else {
      // 標準のClaudeCode CLI設定ディレクトリを使用
      authDir = this._getClaudeConfigDir();
      authFileName = 'auth.json';
      Logger.info('標準認証モードを使用: ClaudeCode CLI標準の認証情報を更新します');
    }
    
    // ディレクトリが存在するか確認し、存在しなければ作成
    // エラーハンドリングを強化
    try {
      if (!fs.existsSync(authDir)) {
        Logger.info(`認証情報ディレクトリを作成します: ${authDir}`);
        fs.mkdirSync(authDir, { recursive: true, mode: 0o755 }); // 読み書き実行権限を追加
      }
    } catch (dirError) {
      Logger.error(`認証情報ディレクトリの作成に失敗しました: ${authDir}`, dirError as Error);
      throw dirError; // 再スロー
    }
    
    // トークン情報をJSONに変換
    const authInfo = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + 3600000, // 1時間後
      source: useIsolatedAuth ? 'appgenius-extension' : 'vscode-extension',
      syncedAt: Date.now(),
      isolatedAuth: useIsolatedAuth
    };
    
    // 認証情報をファイルに保存
    const authFilePath = path.join(authDir, authFileName);
    
    try {
      fs.writeFileSync(authFilePath, JSON.stringify(authInfo, null, 2), {
        encoding: 'utf8',
        mode: 0o600 // 所有者のみ読み書き可能
      });
      
      Logger.info(`認証情報ファイルを保存しました: ${authFilePath}`);
    } catch (writeError) {
      Logger.error(`認証情報ファイルの保存に失敗しました: ${authFilePath}`, writeError as Error);
      throw writeError; // 再スロー
    }
    
    // 同期日時を記録
    this._lastTokenRefresh = Date.now();
    
    const modeText = useIsolatedAuth ? 'AppGenius専用認証情報' : 'ClaudeCode CLI標準認証情報';
    Logger.info(`【API連携】${modeText}を同期しました: ${authFilePath}`);
  } catch (error) {
    Logger.error('認証情報の同期中にエラーが発生しました', error as Error);
    throw error; // エラーを再スローしてより詳細な処理を可能に
  }
}
```

### APIクライアント修正
```typescript
// APIエンドポイントの修正例
public async recordTokenUsage(tokenCount: number, modelId?: string, context?: string): Promise<boolean> {
  try {
    // アクセストークンを取得
    const accessToken = await this._getAccessToken();
    if (!accessToken) {
      Logger.warn('アクセストークンが取得できないため、トークン使用量を記録できません');
      return false;
    }
    
    // 認証ヘッダーを設定
    const config = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15秒タイムアウト
    };
    
    // すべてのエンドポイントで試行
    const endpoints = [
      '/api/proxy/usage/record',
      '/api/proxy/usage/me/record',
      '/api/proxy/claude/usage'
    ];
    
    // 最初に成功したエンドポイントで終了
    for (const endpoint of endpoints) {
      try {
        Logger.debug(`トークン使用量APIを呼び出し中: ${endpoint}`);
        const response = await axios.post(
          `${this._baseUrl}${endpoint}`, 
          {
            tokenCount,
            modelId: modelId || 'unknown',
            context: context || 'vscode-extension'
          }, 
          config
        );
        
        if (response.status >= 200 && response.status < 300) {
          Logger.info(`トークン使用量を記録しました: ${tokenCount}トークン, モデル=${modelId || 'unknown'}`);
          return true;
        }
      } catch (endpointError) {
        Logger.warn(`エンドポイント ${endpoint} でのトークン使用量記録に失敗しました: ${endpointError.message}`);
        // 401エラーの場合はトークンリフレッシュを試みる
        if (axios.isAxiosError(endpointError) && endpointError.response?.status === 401) {
          Logger.info('認証エラー発生のため、トークンリフレッシュを試みます');
          await this._refreshTokenIfNeeded(true);
          
          // リフレッシュ後に再試行（再帰呼び出しではなく外に出す）
          return await this.recordTokenUsage(tokenCount, modelId, context);
        }
        // その他のエラーは次のエンドポイントへ
      }
    }
    
    // すべてのエンドポイントが失敗
    Logger.error('すべてのトークン使用量記録エンドポイントが失敗しました');
    return false;
  } catch (error) {
    Logger.error('トークン使用量記録中にエラーが発生しました', error as Error);
    return false;
  }
}
```

### リトライロジック強化
```typescript
// リトライロジック改善例
private async _retryWithBackoff(fn: () => Promise<any>, maxRetries = 3): Promise<any> {
  let retryCount = 0;
  const baseDelay = 1000; // 1秒
  
  while (retryCount <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      retryCount++;
      
      if (retryCount > maxRetries) throw error;
      
      // 指数バックオフ + ジッター
      const delay = baseDelay * Math.pow(2, retryCount - 1) * (0.5 + Math.random() * 0.5);
      Logger.warn(`操作に失敗しました。${delay}ms後にリトライします (${retryCount}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## テスト計画
- 分離認証モードのテストスクリプト実行
  ```bash
  node test_script/fix_isolated_auth.js # 分離認証ファイル作成を検証
  node test_script/check_token_usage.js # トークン使用量記録APIをテスト
  ```
- 異なるプラットフォームでのディレクトリパスが正しく生成されるか確認
- APIエンドポイント呼び出しをモックしたユニットテスト
- 様々なエラー状態（401、404、500、ネットワークエラーなど）のシミュレーション
- リトライロジックのタイミングテスト
- 実際のAPIエンドポイントを使用した結合テスト（開発環境で）
- 認証同期エラーに対する適切なフォールバック処理の検証

## 関連ドキュメント
- `test_script/token_usage_check_guide.md` - トークン使用量チェックガイド
- `docs/scopes/claudecode-token-usage-fix-scope.md` - このスコープ文書

## 依存関係
- Axios HTTPクライアント
- VSCode拡張のAuthenticationService
- fs & path Node.jsモジュール（ファイル操作）
- バックエンドのトークン使用記録API
- 環境変数 APPGENIUS_USE_ISOLATED_AUTH