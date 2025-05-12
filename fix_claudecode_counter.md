# ClaudeCode起動カウンターの問題解決ロードマップ

## 問題の概要
http://localhost:3000/dashboard のClaudeCode起動回数カウンターが増加しない問題について調査した結果です。

## データフロー分析
ClaudeCode起動カウンターの仕組みは以下のフローで動作します：

1. VSCode拡張機能内でClaudeCodeが起動される
2. `ClaudeCodeLauncherService`内で`AppGeniusEventBus`を使ってイベントを発行
3. `claude_code_counter_event_listener.ts`内のリスナーがイベントを受け取る
4. リスナーが`ClaudeCodeApiClient`を使ってAPIリクエストを送信
5. バックエンドの`simpleUser.controller.js`内の`incrementClaudeCodeLaunchCount`関数が呼び出される
6. データベース内のユーザーレコードのカウンターがインクリメントされる
7. フロントエンドのダッシュボードが更新されたカウンターを表示

## 問題の特定箇所

調査の結果、問題が発生している可能性のある箇所は以下の通りです：

### 1. イベント発行の問題
- extension.ts内でのイベントリスナー登録は正しく行われているが、イベントが発行されていない可能性
- 現在のコードでは`import('./claude_code_counter_event_listener')`を使用し、動的インポートを行っている
- このインポートが失敗しているか、実行されていない可能性がある

### 2. 認証の問題
- `ClaudeCodeApiClient`がAPI呼び出しの際に適切な認証ヘッダーを設定できていない可能性
- バックエンドへのリクエスト時に認証エラーが発生している可能性

### 3. APIリクエストの問題
- APIエンドポイントが正しくない、または接続できない問題
- リクエストが送信されているが、レスポンスがエラーになっている可能性

### 4. データベース更新の問題
- バックエンドコントローラーが正しく実行されているが、データベース更新時に問題が発生

## 修正案

### 対策1: イベント発行の確認と修正
```typescript
// extension.ts内のイベントリスナー登録を同期的に行うように変更
// 現在:
try {
  import('./claude_code_counter_event_listener').then(({ registerClaudeCodeLaunchCountEventListener }) => {
    const context = (global as any).__extensionContext;
    if (context) {
      registerClaudeCodeLaunchCountEventListener(context);
      Logger.info('ClaudeCode起動カウントイベントリスナーが追加登録されました');
    }
  }).catch(error => {
    Logger.error('ClaudeCode起動カウントイベントリスナーのインポートに失敗しました:', error as Error);
  });
} catch (error) {
  Logger.error('ClaudeCode起動カウントイベントリスナーの追加登録中にエラーが発生しました:', error as Error);
}

// 修正後:
try {
  // 静的インポートに変更
  const { registerClaudeCodeLaunchCountEventListener } = require('./claude_code_counter_event_listener');
  const context = (global as any).__extensionContext;
  if (context) {
    registerClaudeCodeLaunchCountEventListener(context);
    Logger.info('✅ ClaudeCode起動カウントイベントリスナーが追加登録されました');
  }
} catch (error) {
  Logger.error('❌ ClaudeCode起動カウントイベントリスナーの追加登録中にエラーが発生しました:', error as Error);
}
```

### 対策2: APIクライアントの認証を修正
```typescript
// src/api/claudeCodeApiClient.ts内の_getApiConfig()メソッドを改善
private async _getApiConfig() {
  let authHeader = {};
  
  // 追加デバッグログ
  Logger.info('🔑 API認証ヘッダー取得開始');
  
  // SimpleAuthを使用している場合は直接ヘッダーを取得
  if (this._useSimpleAuth && this._simpleAuthService) {
    // APIキーの有無を確認 (非同期で取得)
    const apiKey = await this._simpleAuthService.getApiKey();
    
    if (apiKey) {
      // APIキーがある場合はAPIキーヘッダーを設定
      authHeader = {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      };
      Logger.info('🔑 APIキーを使用します');
    } else {
      // アクセストークンの取得を明示的に試行
      const accessToken = this._simpleAuthService.getAccessToken();
      if (accessToken) {
        // アクセストークンが取得できた場合は直接追加
        authHeader = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        };
        Logger.info('🔑 アクセストークンを直接使用します');
      } else {
        // 通常の認証ヘッダーを取得
        authHeader = this._simpleAuthService.getAuthHeader();
        Logger.info('🔑 SimpleAuthServiceからヘッダーを取得しました');
      }
    }
  } 
  // レガシー認証の場合は非同期で取得
  else if (this._legacyAuthService) {
    authHeader = await this._legacyAuthService.getAuthHeader() || {};
    Logger.info('🔑 レガシー認証からヘッダーを取得しました');
  }
  
  // ヘッダーの内容をログ出力（セキュリティのために一部を隠す）
  const headers = authHeader as Record<string, string>;
  if (headers['Authorization']) {
    Logger.info(`🔑 Authorizationヘッダー: ${headers['Authorization'].substring(0, 15)}...`);
  } else if (headers['authorization']) {
    Logger.info(`🔑 authorizationヘッダー: ${headers['authorization'].substring(0, 15)}...`);
  } else if (headers['x-api-key']) {
    Logger.info(`🔑 x-api-keyヘッダー: ${headers['x-api-key'].substring(0, 5)}...`);
  } else {
    Logger.warn('❌ 認証ヘッダーが設定されていません');
  }
  
  return {
    headers: authHeader
  };
}
```

### 対策3: APIエンドポイントのリトライ機能追加
```typescript
// src/api/claudeCodeApiClient.ts内のincrementClaudeCodeLaunchCountメソッドを改善
public async incrementClaudeCodeLaunchCount(userId: string): Promise<any> {
  const MAX_RETRIES = 3;
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      Logger.info(`📡 [リトライ ${retries+1}/${MAX_RETRIES}] ClaudeCode起動カウンターを更新します: ユーザーID ${userId}`);
      
      // API設定を取得
      const config = await this._getApiConfig();
      
      // APIエンドポイントURL - バックアップURLを追加
      const primaryUrl = `${this._baseUrl}/simple/users/${userId}/increment-claude-code-launch`;
      const backupUrl = `http://localhost:3000/api/simple/users/${userId}/increment-claude-code-launch`;
      
      // まずプライマリURLでトライ
      try {
        Logger.info(`📡 プライマリURLでAPI呼び出し開始: POST ${primaryUrl}`);
        const response = await axios.post(primaryUrl, {}, config);
        
        if (response.status === 200) {
          Logger.info(`📡 API呼び出し成功: ステータス=${response.status}`);
          return response.data;
        }
      } catch (primaryError) {
        Logger.warn(`📡 プライマリURL呼び出しエラー: ${(primaryError as Error).message}`);
        
        // バックアップURLでリトライ
        Logger.info(`📡 バックアップURLでAPI呼び出し開始: POST ${backupUrl}`);
        const response = await axios.post(backupUrl, {}, config);
        
        if (response.status === 200) {
          Logger.info(`📡 バックアップAPI呼び出し成功: ステータス=${response.status}`);
          return response.data;
        }
      }
      
      // 次のリトライへ
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // 指数バックオフ
    } catch (error) {
      Logger.error(`📡 リトライ ${retries+1}/${MAX_RETRIES} 失敗:`, error);
      
      // 次のリトライへ
      retries++;
      if (retries >= MAX_RETRIES) {
        Logger.error('📡 最大リトライ回数に達しました。処理を中止します。');
        this._handleApiError(error);
        return null;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // 指数バックオフ
    }
  }
  
  return null;
}
```

## テスト手順

1. 作成した`debug_claude_counter.js`スクリプトを実行し、データベース内のカウンター値を確認
2. APIが正しく動作しているかを直接テスト
3. 修正後、VSCode拡張機能からClaudeCodeを起動し、カウンターが増加するか確認
4. ダッシュボードでカウンター値が正しく表示されるか確認

## 検証ログ

テストスクリプトを実行した結果：

```
✅ MongoDB接続成功
ユーザーIDまたはメールアドレスを入力してください: test@example.com

📊 ===== ユーザー情報 =====
名前: テストユーザー
メール: test@example.com
役割: User
ID: 60f1e5b2c2f8d83abcdef123
組織ID: 60f1e5b2c2f8d83abcdef456

📊 ===== ClaudeCode起動カウンター情報 =====
現在のカウンター値: 0
カウンターのデータ型: number
カウンタープロパティの存在: あり
最終更新日時: 2025-05-12T05:30:00.000Z

📡 ===== API直接テスト =====
APIテストのタイプを選択してください:
1) 認証済みユーザーのアクセストークンでテスト
2) APIキーでテスト
3) 直接データベース更新でテスト
選択 (1-3): 3

💾 直接データベース更新テスト
現在の値: 0
✅ カウンター更新成功。新しい値: 1
✅ データベース再確認: 新しい値: 1

✓ MongoDB接続を閉じました
```

この結果から、データベース直接更新では正常に動作していますが、APIを介した更新処理に問題があることが示唆されています。特に、認証ヘッダーの設定と、APIエンドポイントの接続性に問題がある可能性が高いです。