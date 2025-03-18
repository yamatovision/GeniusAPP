/**
 * UsageIndicator修正テストスクリプト
 * 
 * このスクリプトは、実際のUsageIndicator.tsのコードを検証・修正し、
 * 安定したAPIリクエストを行えるようにします。
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ログイン情報
const email = 'lisence@mikoto.co.jp';
const password = 'Mikoto@123';

// API設定
const CONFIG = {
  // デフォルトのエンドポイント
  DEFAULT_API_URL: 'https://geniemon-portal-backend-production.up.railway.app/api',
  // バックアップエンドポイント
  BACKUP_API_URL: 'https://geniemon-portal-backend-staging.up.railway.app/api',
  // ローカルエンドポイント
  LOCAL_API_URL: 'http://localhost:3000/api',
  // クライアント認証情報
  CLIENT_ID: 'appgenius_vscode_client_29a7fb3e',
  CLIENT_SECRET: 'appgenius_refresh_token_secret_key_for_production',
  // リクエスト設定
  REQUEST_TIMEOUT: 15000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000
};

// ログファイルパス
const LOG_FILE = path.join(__dirname, 'fix_usage_indicator.log');

// ログ出力関数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// エラーログ出力関数
function logError(message, error) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] ERROR: ${message}`;
  
  if (error) {
    logMessage += `\n  Message: ${error.message}`;
    
    if (axios.isAxiosError(error)) {
      // Axiosエラーの詳細情報
      if (error.response) {
        logMessage += `\n  Status: ${error.response.status}`;
        logMessage += `\n  Status Text: ${error.response.statusText}`;
        
        if (error.response.data) {
          try {
            logMessage += `\n  Response Data: ${JSON.stringify(error.response.data)}`;
          } catch (e) {
            logMessage += `\n  Response Data: [Cannot stringify]`;
          }
        }
      } else {
        logMessage += `\n  No Response`;
      }
      
      logMessage += `\n  URL: ${error.config?.url || 'N/A'}`;
      logMessage += `\n  Method: ${error.config?.method?.toUpperCase() || 'N/A'}`;
    }
  }
  
  console.error(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// アクセストークンを取得
async function getAccessToken() {
  try {
    log('認証APIにログインリクエストを送信しています...');
    
    // 認証APIを呼び出し
    const response = await axios.post(`${CONFIG.DEFAULT_API_URL}/auth/login`, {
      email,
      password,
      clientId: CONFIG.CLIENT_ID,
      clientSecret: CONFIG.CLIENT_SECRET
    }, {
      timeout: CONFIG.REQUEST_TIMEOUT
    });
    
    if (response.status === 200 && response.data.accessToken) {
      log('ログイン成功！');
      return {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        expiresIn: response.data.expiresIn || 86400,
        user: response.data.user
      };
    } else {
      logError('レスポンスが無効です', { message: JSON.stringify(response.data) });
      return null;
    }
  } catch (error) {
    logError('ログインエラー', error);
    return null;
  }
}

// 修正されたfetchUsageData実装（リトライロジック、フォールバック、タイムアウト設定）
async function fetchUsageDataImproved(token) {
  if (!token) {
    logError('アクセストークンがありません');
    return null;
  }
  
  const authHeader = {
    'Authorization': `Bearer ${token}`
  };
  
  // APIエンドポイントリスト（優先順位順）
  const apiUrls = [
    process.env.PORTAL_API_URL, // 環境変数から取得（もし設定されていれば）
    CONFIG.DEFAULT_API_URL,     // デフォルトの本番環境URL
    CONFIG.BACKUP_API_URL,      // バックアップURL
    CONFIG.LOCAL_API_URL        // ローカル開発URL（最後の手段）
  ].filter(Boolean); // undefined/nullを除外
  
  log(`使用量データを取得します（${apiUrls.length}個のエンドポイントで試行）`);
  
  // 各APIエンドポイントを試す
  for (const apiUrl of apiUrls) {
    log(`APIエンドポイント試行: ${apiUrl}`);
    
    // このエンドポイントで最大リトライ回数まで試行
    let retryCount = 0;
    
    while (retryCount <= CONFIG.MAX_RETRIES) {
      try {
        if (retryCount > 0) {
          log(`リトライ ${retryCount}/${CONFIG.MAX_RETRIES}...`);
        }
        
        // リクエスト送信
        const response = await axios.get(`${apiUrl}/proxy/usage/me`, {
          headers: authHeader,
          timeout: CONFIG.REQUEST_TIMEOUT
        });
        
        // 成功レスポンスの検証
        if (response.status === 200 && response.data) {
          log(`使用量データを取得しました${retryCount > 0 ? ` (${retryCount}回のリトライ後)` : ''} [${apiUrl}]`);
          return response.data;
        } else {
          log(`無効なレスポンス: ${response.status}`);
          break; // 次のエンドポイントに進む
        }
      } catch (error) {
        retryCount++;
        
        // エラー種別に基づくハンドリング
        if (axios.isAxiosError(error)) {
          const isServerError = error.response?.status === 500;
          const isTimeout = error.code === 'ECONNABORTED';
          const isNetworkError = !error.response && error.code !== 'ECONNABORTED';
          
          // サーバーエラー(500)の場合はリトライ
          if (isServerError && retryCount <= CONFIG.MAX_RETRIES) {
            const waitTime = CONFIG.RETRY_DELAY * Math.pow(2, retryCount - 1);
            log(`サーバーエラー(500)。${waitTime}ms後にリトライします...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          // タイムアウトの場合はリトライ
          else if (isTimeout && retryCount <= CONFIG.MAX_RETRIES) {
            const waitTime = CONFIG.RETRY_DELAY * Math.pow(2, retryCount - 1);
            log(`リクエストタイムアウト。${waitTime}ms後にリトライします...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          // ネットワークエラーの場合は次のエンドポイントに進む
          else if (isNetworkError) {
            logError(`ネットワークエラー: ${apiUrl}`, error);
            break; // 次のエンドポイントに進む
          }
          // その他のエラーも記録
          else {
            logError(`APIリクエストエラー: ${apiUrl}`, error);
            
            // 認証エラー(401/403)の場合はさらなる試行を中止
            if (error.response?.status === 401 || error.response?.status === 403) {
              log('認証エラーが発生しました。アクセストークンが無効である可能性があります。');
              return null;
            }
            
            // 最大リトライ回数に達した場合は次のエンドポイントに進む
            if (retryCount > CONFIG.MAX_RETRIES) {
              break;
            }
          }
        } else {
          // 不明なエラーの場合
          logError(`不明なエラー: ${apiUrl}`, error);
          
          // 最大リトライ回数に達した場合は次のエンドポイントに進む
          if (retryCount > CONFIG.MAX_RETRIES) {
            break;
          }
        }
      }
    }
  }
  
  // すべてのエンドポイントが失敗した場合
  log('すべてのAPIエンドポイントが失敗しました');
  return null;
}

// UsageIndicatorの元の実装（比較用）
async function fetchUsageDataOriginal(token) {
  if (!token) {
    logError('アクセストークンがありません');
    return null;
  }
  
  const authHeader = {
    'Authorization': `Bearer ${token}`
  };
  
  // 元の実装では環境変数からAPIURLを取得、またはlocalhost:3000をデフォルトとして使用
  const apiUrl = process.env.PORTAL_API_URL || 'http://localhost:3000/api';
  
  log(`[元の実装] 使用量データを取得しています... (API URL: ${apiUrl})`);
  
  try {
    const response = await axios.get(`${apiUrl}/proxy/usage/me`, {
      headers: authHeader
    });
    
    if (response.status === 200 && response.data) {
      log('[元の実装] 使用量データを取得しました');
      return response.data;
    } else {
      logError('[元の実装] 使用量データのレスポンスが無効です', { message: JSON.stringify(response.data) });
      return null;
    }
  } catch (error) {
    logError('[元の実装] 使用量データ取得中にエラーが発生しました', error);
    return null;
  }
}

// 実装の違いをテスト
async function compareImplementations() {
  // ログファイルの初期化
  fs.writeFileSync(LOG_FILE, `=== UsageIndicator修正テスト (${new Date().toISOString()}) ===\n\n`);
  
  log('テストを開始します...');
  
  // アクセストークンを取得
  const authInfo = await getAccessToken();
  if (!authInfo) {
    logError('アクセストークンの取得に失敗しました。テストを中止します。');
    return;
  }
  
  const { accessToken } = authInfo;
  
  // テスト実行回数
  const testIterations = 5;
  
  log(`\n各実装を${testIterations}回ずつテストします...`);
  
  // 結果統計
  const stats = {
    original: { success: 0, failure: 0, times: [] },
    improved: { success: 0, failure: 0, times: [] }
  };
  
  // テストを実行
  for (let i = 0; i < testIterations; i++) {
    log(`\n==== テスト実行 ${i+1}/${testIterations} ====`);
    
    // 元の実装のテスト
    log('\n- 元の実装:');
    const origStartTime = Date.now();
    const origResult = await fetchUsageDataOriginal(accessToken);
    const origEndTime = Date.now();
    const origDuration = origEndTime - origStartTime;
    
    if (origResult) {
      stats.original.success++;
      stats.original.times.push(origDuration);
      log(`  成功 (${origDuration}ms)`);
    } else {
      stats.original.failure++;
      log(`  失敗 (${origDuration}ms)`);
    }
    
    // 修正実装のテスト
    log('\n- 修正実装:');
    const improvedStartTime = Date.now();
    const improvedResult = await fetchUsageDataImproved(accessToken);
    const improvedEndTime = Date.now();
    const improvedDuration = improvedEndTime - improvedStartTime;
    
    if (improvedResult) {
      stats.improved.success++;
      stats.improved.times.push(improvedDuration);
      log(`  成功 (${improvedDuration}ms)`);
    } else {
      stats.improved.failure++;
      log(`  失敗 (${improvedDuration}ms)`);
    }
    
    // テスト間隔（サーバーへの負荷を減らすため）
    if (i < testIterations - 1) {
      const waitTime = 1000; // 1秒待機
      log(`\n${waitTime}ms待機中...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // 統計結果
  log('\n==== テスト結果 ====');
  
  // 元の実装の統計
  log('\n元の実装:');
  log(`- 成功率: ${stats.original.success}/${testIterations} (${(stats.original.success/testIterations*100).toFixed(1)}%)`);
  if (stats.original.times.length > 0) {
    const avgTime = stats.original.times.reduce((a, b) => a + b, 0) / stats.original.times.length;
    log(`- 平均応答時間: ${avgTime.toFixed(1)}ms`);
  }
  
  // 修正実装の統計
  log('\n修正実装:');
  log(`- 成功率: ${stats.improved.success}/${testIterations} (${(stats.improved.success/testIterations*100).toFixed(1)}%)`);
  if (stats.improved.times.length > 0) {
    const avgTime = stats.improved.times.reduce((a, b) => a + b, 0) / stats.improved.times.length;
    log(`- 平均応答時間: ${avgTime.toFixed(1)}ms`);
  }
  
  // 結論
  log('\n==== 結論 ====');
  if (stats.improved.success > stats.original.success) {
    log('✅ 修正実装は元の実装よりも信頼性が高いです');
  } else if (stats.improved.success === stats.original.success && stats.improved.success === testIterations) {
    log('✅ 両方の実装が同様に信頼性が高いです');
  } else if (stats.improved.success === stats.original.success) {
    log('⚠️ 両方の実装は同様の信頼性ですが、改善の余地があります');
  } else {
    log('❌ 修正実装に問題があり、元の実装よりも信頼性が低いです');
  }
  
  // 解決策のコード提示
  log('\n==== 推奨される修正コード ====');
  log(`
/**
 * 使用量データを取得
 */
private async _fetchUsageData(): Promise<void> {
  if (!this._authService.isAuthenticated()) {
    return;
  }
  
  try {
    const authHeader = await this._authService.getAuthHeader();
    if (!authHeader) {
      return;
    }
    
    // APIエンドポイントの決定（環境変数または本番URLをデフォルトとして使用）
    const apiUrl = process.env.PORTAL_API_URL || 'https://geniemon-portal-backend-production.up.railway.app/api';
    
    // リトライロジックの実装
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1秒
    
    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          console.log(\`使用量データ取得リトライ (\${retryCount}/\${maxRetries})...\`);
        }
        
        // タイムアウト設定付きリクエスト
        const response = await axios.get(\`\${apiUrl}/proxy/usage/me\`, {
          headers: authHeader,
          timeout: 15000 // 15秒タイムアウト
        });
        
        if (response.status === 200 && response.data) {
          // レスポンス構造に合わせてデータマッピングを修正
          const usage = response.data.usage?.monthly || {};
          this._currentUsage = usage.totalTokens || 0;
          this._usageLimit = response.data.limits?.monthly || 0;
          
          // ステータスバーの表示を更新
          this._updateStatusBarDisplay();
          return; // 成功したら終了
        }
        break; // 200以外のレスポンスの場合はリトライしない
      } catch (error) {
        retryCount++;
        
        // エラーの種類を特定
        if (axios.isAxiosError(error)) {
          const isServerError = error.response?.status === 500;
          const isTimeout = error.code === 'ECONNABORTED';
          
          // サーバーエラー(500)またはタイムアウトの場合のみリトライ
          if ((isServerError || isTimeout) && retryCount <= maxRetries) {
            // 指数バックオフ（リトライ回数に応じて待ち時間を増やす）
            const waitTime = retryDelay * Math.pow(2, retryCount - 1);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // 最大リトライ回数に達した場合、またはリトライ対象外のエラーの場合
        if (retryCount > maxRetries) {
          // エラーをより詳細にログ出力
          if (axios.isAxiosError(error)) {
            console.error(\`使用量データ取得中にエラーが発生しました (Status: \${error.response?.status || 'N/A'}):\`, 
              error.message, error.response?.data);
          } else {
            console.error('使用量データ取得中にエラーが発生しました:', error);
          }
          break;
        }
      }
    }
    
    // エラー発生時でもUIが機能するようにデフォルト表示を設定
    this._updateStatusBarDisplay();
  } catch (error) {
    // 予期しないエラーも捕捉
    console.error('使用量データ取得処理中に予期しないエラーが発生しました:', error);
    this._updateStatusBarDisplay();
  }
}
  `);
  
  log('\nテストが完了しました。詳細はログファイルを確認してください。');
}

// メイン処理
compareImplementations().catch(error => {
  logError('テスト実行中に予期しないエラーが発生しました', error);
});