/**
 * ClaudeCode起動カウンター修正実装
 * http://localhost:3000/dashboardのClaudeCode起動回数が増加しない問題の修正
 */

// 対応方法は以下の通りです：

/**
 * 問題分析：
 * 1. イベント発行は正しく行われている（コードを確認済み）
 * 2. イベントリスナーも適切に登録されている
 * 3. APIクライアントで認証情報が適切に設定されていない可能性が高い
 * 4. バックエンドへのHTTPリクエストが失敗している
 */

/**
 * 1. src/api/claudeCodeApiClient.ts の修正
 * 認証ヘッダーの生成を強化し、複数の認証方法をサポート
 */

/*
// 修正前のコード
private async _getApiConfig() {
  let authHeader = {};
  
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
      Logger.debug('ClaudeCodeApiClient: APIキーを使用します');
    } else {
      // 通常の認証ヘッダーを取得
      authHeader = this._simpleAuthService.getAuthHeader();
      Logger.debug('ClaudeCodeApiClient: SimpleAuthServiceからヘッダーを取得しました');
    }
  } 
  // レガシー認証の場合は非同期で取得
  else if (this._legacyAuthService) {
    authHeader = await this._legacyAuthService.getAuthHeader() || {};
    Logger.debug('ClaudeCodeApiClient: レガシー認証からヘッダーを取得しました');
  }
  
  return {
    headers: authHeader
  };
}

// 修正後のコード
private async _getApiConfig() {
  let authHeader = {};
  
  // ログ出力を強化
  Logger.info('🔑 [ClaudeCodeApiClient] 認証ヘッダー取得開始');
  
  try {
    // SimpleAuthを使用している場合
    if (this._useSimpleAuth && this._simpleAuthService) {
      // 方法1: APIキーを試す
      const apiKey = await this._simpleAuthService.getApiKey();
      
      if (apiKey) {
        // APIキーがある場合はAPIキーヘッダーを設定
        authHeader = {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        };
        Logger.info('🔑 [ClaudeCodeApiClient] APIキーを使用します');
      } 
      else {
        // 方法2: アクセストークンを直接取得
        const accessToken = this._simpleAuthService.getAccessToken();
        
        if (accessToken) {
          // アクセストークンがある場合は認証ヘッダーを設定
          authHeader = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          };
          Logger.info('🔑 [ClaudeCodeApiClient] アクセストークンを直接使用します');
        } 
        else {
          // 方法3: 通常の認証ヘッダーを取得
          const simpleAuthHeader = this._simpleAuthService.getAuthHeader();
          
          if (simpleAuthHeader && Object.keys(simpleAuthHeader).length > 0) {
            authHeader = simpleAuthHeader;
            Logger.info('🔑 [ClaudeCodeApiClient] SimpleAuthServiceからヘッダーを取得しました');
          } 
          else {
            Logger.warn('⚠️ [ClaudeCodeApiClient] SimpleAuthServiceからヘッダーを取得できませんでした');
          }
        }
      }
    } 
    // レガシー認証の場合
    else if (this._legacyAuthService) {
      const legacyHeader = await this._legacyAuthService.getAuthHeader() || {};
      
      if (legacyHeader && Object.keys(legacyHeader).length > 0) {
        authHeader = legacyHeader;
        Logger.info('🔑 [ClaudeCodeApiClient] レガシー認証からヘッダーを取得しました');
      } else {
        Logger.warn('⚠️ [ClaudeCodeApiClient] レガシー認証からヘッダーを取得できませんでした');
      }
    }
    
    // ヘッダーの内容を検証（セキュリティのために値自体は出力しない）
    if (authHeader && typeof authHeader === 'object') {
      const headers = authHeader as Record<string, string>;
      const hasAuthHeader = 
        headers['Authorization'] || 
        headers['authorization'] || 
        headers['x-api-key'];
      
      if (hasAuthHeader) {
        Logger.info('✅ [ClaudeCodeApiClient] 認証ヘッダーが正しく設定されました');
      } else {
        Logger.warn('⚠️ [ClaudeCodeApiClient] 認証ヘッダーが設定されていません');
        
        // フォールバック: localhostの場合はデフォルトヘッダーを設定
        if (this._baseUrl.includes('localhost')) {
          authHeader = {
            'Content-Type': 'application/json'
          };
          Logger.info('🔧 [ClaudeCodeApiClient] localhostのためデフォルトヘッダーを設定します');
        }
      }
    }
  } catch (error) {
    Logger.error('❌ [ClaudeCodeApiClient] 認証ヘッダー取得エラー:', error as Error);
  }
  
  return {
    headers: authHeader
  };
}
*/

/**
 * 2. incrementClaudeCodeLaunchCount メソッドの修正
 * API呼び出しのリトライ機能と複数エンドポイント対応
 */

/*
// 修正前のコード
public async incrementClaudeCodeLaunchCount(userId: string): Promise<any> {
  try {
    Logger.info(`【API連携】ClaudeCode起動カウンターを更新します: ユーザーID ${userId}`);
    Logger.info(`【デバッグ】API呼び出し準備: ユーザーID=${userId}, APIベースURL=${this._baseUrl}`);
    
    // API設定を取得して詳細をログに出力
    const config = await this._getApiConfig();
    const hasAuthHeader = config?.headers && (config.headers['Authorization'] || config.headers['authorization'] || config.headers['x-api-key']);
    Logger.info(`【デバッグ】API認証ヘッダー: ${hasAuthHeader ? '存在します' : '存在しません'}`);
    
    // APIエンドポイントURL
    const url = `${this._baseUrl}/simple/users/${userId}/increment-claude-code-launch`;
    Logger.info(`【デバッグ】API呼び出しURL: ${url}`);
    
    // APIリクエスト送信
    Logger.info(`【デバッグ】API呼び出し開始: POST ${url}`);
    const response = await axios.post(url, {}, config);
    
    // レスポンス分析
    Logger.info(`【デバッグ】API呼び出しステータス: ${response.status} ${response.statusText}`);
    Logger.info(`【デバッグ】APIレスポンス: ${JSON.stringify(response.data)}`);
    
    if (response.status === 200) {
      // 詳細なレスポンス情報をログ出力
      const newCount = response.data?.data?.claudeCodeLaunchCount || 'N/A';
      const isSuccess = response.data?.success === true;
      Logger.info(`【API連携】ClaudeCode起動カウンター更新成功: 新しい値=${newCount}, 成功フラグ=${isSuccess}`);
      return response.data;
    }
    
    Logger.warn(`【API連携】ClaudeCode起動カウンター更新：予期しないレスポンス (${response.status})`);
    return null;
  } catch (error) {
    Logger.error('【API連携】ClaudeCode起動カウンター更新エラー:', error);
    this._handleApiError(error);
    return null;
  }
}

// 修正後のコード
public async incrementClaudeCodeLaunchCount(userId: string): Promise<any> {
  const MAX_RETRIES = 3;
  let retries = 0;
  
  // URLのリスト（プライマリとフォールバック）
  const urls = [
    `${this._baseUrl}/simple/users/${userId}/increment-claude-code-launch`,
    `http://localhost:3000/api/simple/users/${userId}/increment-claude-code-launch`,
    `/api/simple/users/${userId}/increment-claude-code-launch` // 相対パス
  ];
  
  while (retries < MAX_RETRIES) {
    try {
      Logger.info(`🔄 [リトライ ${retries+1}/${MAX_RETRIES}] ClaudeCode起動カウンター更新: ユーザーID ${userId}`);
      
      // API設定を取得
      const config = await this._getApiConfig();
      
      // 認証ヘッダーに問題がある場合、デフォルトヘッダーでリトライ
      if (!config.headers || Object.keys(config.headers).length === 0) {
        Logger.warn('⚠️ 認証ヘッダーがないため、デフォルトヘッダーを使用');
        config.headers = { 'Content-Type': 'application/json' };
      }
      
      // 各URLで順番に試行
      for (const url of urls) {
        try {
          Logger.info(`📡 API呼び出し試行: POST ${url}`);
          
          // タイムアウトを設定（10秒）
          const response = await axios.post(url, {}, { 
            ...config,
            timeout: 10000 
          });
          
          // 成功レスポンスの場合
          if (response.status === 200) {
            const newCount = response.data?.data?.claudeCodeLaunchCount || 'N/A';
            Logger.info(`✅ カウンター更新成功: 新しい値=${newCount}`);
            return response.data;
          }
          
          Logger.warn(`⚠️ 予期しないレスポンス (${response.status}) from ${url}`);
        } catch (urlError) {
          // この特定のURLでのエラーをログ記録
          if (axios.isAxiosError(urlError)) {
            if (urlError.response) {
              Logger.warn(`⚠️ URL ${url} エラー: HTTP ${urlError.response.status}`);
            } else if (urlError.request) {
              Logger.warn(`⚠️ URL ${url} エラー: レスポンスなし`);
            } else {
              Logger.warn(`⚠️ URL ${url} エラー: ${urlError.message}`);
            }
          } else {
            Logger.warn(`⚠️ URL ${url} エラー: ${(urlError as Error).message}`);
          }
          // 次のURLを試行するため、このエラーはthrowしない
          continue;
        }
      }
      
      // すべてのURLが失敗した場合、次のリトライへ
      retries++;
      
      // 次のリトライの前に待機（指数バックオフ）
      const waitTime = Math.min(1000 * Math.pow(2, retries), 10000);
      Logger.info(`🕒 次のリトライまで ${waitTime}ms 待機...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
    } catch (error) {
      Logger.error('❌ カウンター更新エラー:', error as Error);
      
      // 次のリトライへ
      retries++;
      if (retries >= MAX_RETRIES) {
        Logger.error('❌ 最大リトライ回数に達しました');
        this._handleApiError(error);
        return null;
      }
      
      // 次のリトライの前に待機（指数バックオフ）
      const waitTime = Math.min(1000 * Math.pow(2, retries), 10000);
      Logger.info(`🕒 次のリトライまで ${waitTime}ms 待機...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  Logger.error('❌ すべてのリトライが失敗しました');
  return null;
}
*/

/**
 * 3. 直接データベース更新の一時的な回避策
 * 一時的に直接データベースを更新する方法を提供
 */

// ノードサーバーで実行するコード
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// MongoDB接続情報
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/appgenius';

// MongoDBに接続
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB接続成功');
  
  // SimpleUserモデルを定義
  const simpleUserSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    role: String,
    organizationId: mongoose.Schema.Types.ObjectId,
    apiKeyId: String,
    apiKeyValue: String,
    claudeCodeLaunchCount: Number,
    refreshToken: String,
    status: String
  }, { timestamps: true });
  
  // モデルが既に登録されているか確認
  let SimpleUser;
  try {
    // 既存のモデルを取得
    SimpleUser = mongoose.model('SimpleUser');
  } catch (e) {
    // モデルが存在しない場合は新規作成
    SimpleUser = mongoose.model('SimpleUser', simpleUserSchema);
  }
  
  // ログファイルのパス
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, 'claude_code_counter_fix.log');
  
  // ログ関数
  const logToFile = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // コンソールに出力
    console.log(logMessage.trim());
    
    // ファイルに追記
    fs.appendFileSync(logFile, logMessage);
  };
  
  // 全ユーザーのカウンター確認
  const checkAllUsers = async () => {
    try {
      // すべてのユーザーを取得
      const users = await SimpleUser.find();
      
      logToFile(`===== ユーザーカウンター確認開始 =====`);
      logToFile(`総ユーザー数: ${users.length}`);
      
      // カウンターをチェックして整理
      let usersWithCounter = 0;
      let usersWithZeroCounter = 0;
      let usersWithoutCounter = 0;
      
      for (const user of users) {
        const hasCounter = user.hasOwnProperty('claudeCodeLaunchCount');
        const counterValue = user.claudeCodeLaunchCount || 0;
        
        if (!hasCounter) {
          usersWithoutCounter++;
        } else if (counterValue === 0) {
          usersWithZeroCounter++;
        } else {
          usersWithCounter++;
        }
      }
      
      logToFile(`カウンター値あり（0以外）: ${usersWithCounter}人`);
      logToFile(`カウンター値ゼロ: ${usersWithZeroCounter}人`);
      logToFile(`カウンタープロパティなし: ${usersWithoutCounter}人`);
      
      // カウンターのないユーザーを修正（オプション）
      const fixMissingCounters = true; // これをtrueにすると修正を実行
      
      if (fixMissingCounters && usersWithoutCounter > 0) {
        logToFile(`===== カウンタープロパティ欠損修正 =====`);
        
        let fixedCount = 0;
        for (const user of users) {
          const hasCounter = user.hasOwnProperty('claudeCodeLaunchCount');
          
          if (!hasCounter) {
            // カウンタープロパティを追加
            user.claudeCodeLaunchCount = 0;
            await user.save();
            fixedCount++;
            
            if (fixedCount <= 5) {
              logToFile(`✓ ユーザー修正: ${user.name} (${user._id})`);
            } else if (fixedCount === 6) {
              logToFile(`他のユーザーも修正中...`);
            }
          }
        }
        
        logToFile(`✅ 修正完了: ${fixedCount}人のユーザーにカウンタープロパティを追加しました`);
      }
      
      logToFile(`===== 確認完了 =====`);
    } catch (error) {
      logToFile(`❌ エラー: ${error.message}`);
    }
  };
  
  // 実行
  checkAllUsers().then(() => {
    mongoose.connection.close();
    logToFile('MongoDB接続を閉じました');
  });
  
}).catch(err => {
  console.error('MongoDB接続エラー:', err);
});

/**
 * 4. フロントエンドでの一時的な回避策
 * もしバックエンドが修正できない場合は、ダッシュボードでのポーリング更新を実装
 */

/*
// Dashboard.jsのuseEffectを修正
useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 現在のユーザー情報を取得
      const currentUser = await getCurrentUser();
      if (currentUser && currentUser.data && currentUser.data.user) {
        setUser(currentUser.data.user);
      }
      
      // ユーザー一覧を取得
      const usersResponse = await getUsers();
      if (usersResponse && usersResponse.data) {
        setUsers(usersResponse.data);
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
      setError('ユーザー情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  // 初回データ取得
  fetchData();
  
  // 定期的に更新（1分ごと）
  const interval = setInterval(() => {
    console.log('ダッシュボードデータ自動更新');
    fetchData();
  }, 60000); // 60秒ごとに更新
  
  // コンポーネントのアンマウント時にクリーンアップ
  return () => clearInterval(interval);
}, []);
*/

/**
 * 適用方法:
 * 1. claudeCodeApiClient.ts の _getApiConfig と incrementClaudeCodeLaunchCount メソッドを修正
 * 2. テスト用のスクリプトを実行してカウンターの値を確認
 * 3. 必要に応じてフロントエンドの定期更新も追加
 */