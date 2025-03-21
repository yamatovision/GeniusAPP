/**
 * トークンリフレッシュサービス
 * 認証トークンのリフレッシュ処理を一元管理します
 * 
 * 改善点:
 * - VSCode拡張のクライアント情報を付与
 * - リトライ回数とバックオフ戦略の強化
 * - トークン有効期限管理の改善
 * - 複数ストレージでの整合性確保
 * - エラーハンドリングの強化
 * - 詳細なログ出力
 */
import axios from 'axios';

// APIのベースURL
const API_URL = process.env.REACT_APP_API_URL || '/api';

// リフレッシュ中かどうかのフラグ（重複防止）
let isRefreshing = false;
// リフレッシュ待ちのリクエスト
let refreshSubscribers = [];
// 最後のリフレッシュ時刻
let lastRefreshTime = 0;
// リフレッシュの最小間隔（秒）
const MIN_REFRESH_INTERVAL = 30;
// リフレッシュ失敗時のリトライカウント
let refreshRetryCount = 0;
// 最大リトライ回数
const MAX_RETRY_COUNT = 5;

// VSCode拡張用のクライアント情報
const CLIENT_INFO = {
  clientId: 'appgenius_vscode_client_29a7fb3e',
  clientSecret: 'appgenius_refresh_token_secret_key_for_production',
  // セッション延長を要求
  extendedSession: true
};

// デバッグモード（開発環境のみ）
const DEBUG = process.env.NODE_ENV === 'development';

/**
 * トークンリフレッシュが完了したときにサブスクライバーを実行
 * @param {string} token - 新しいアクセストークン
 */
const onRefreshed = (token) => {
  if (DEBUG) console.log(`[TokenRefresh] ${refreshSubscribers.length}個の待機リクエストを再開`);
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

/**
 * ローカルストレージ操作のラッパー（エラーハンドリング強化）
 */
const safeStorage = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`[TokenRefresh] ストレージ取得エラー (キー: ${key})`, error);
      
      // セッションストレージをフォールバックとして試す
      try {
        return sessionStorage.getItem(key);
      } catch (sessionError) {
        return null;
      }
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
      
      // 冗長性のためセッションストレージにも保存
      try {
        sessionStorage.setItem(key, value);
      } catch (sessionError) {
        // エラーは無視
      }
    } catch (error) {
      console.error(`[TokenRefresh] ストレージ保存エラー (キー: ${key})`, error);
      
      // ローカルストレージが失敗した場合はセッションストレージを試す
      try {
        sessionStorage.setItem(key, value);
      } catch (sessionError) {
        console.error(`[TokenRefresh] セッションストレージ保存エラー (キー: ${key})`, sessionError);
      }
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      
      // セッションストレージからも削除
      try {
        sessionStorage.removeItem(key);
      } catch (sessionError) {
        // エラーは無視
      }
    } catch (error) {
      console.error(`[TokenRefresh] ストレージ削除エラー (キー: ${key})`, error);
    }
  }
};

/**
 * トークンの健全性チェック
 * 形式が正しいJWTトークンかどうかを確認
 */
const verifyTokenHealth = (token) => {
  if (!token) return false;
  
  // JWTの基本的な形式チェック（3つのセクションがあるかどうか）
  const parts = token.split('.');
  if (parts.length !== 3) {
    if (DEBUG) console.warn('[TokenRefresh] トークンの形式が無効です');
    return false;
  }
  
  // ペイロード部分をデコード
  try {
    const payload = JSON.parse(atob(parts[1]));
    
    // 有効期限の存在チェック
    if (!payload.exp) {
      if (DEBUG) console.warn('[TokenRefresh] トークンペイロードに有効期限情報がありません');
      return false;
    }
    
    // ユーザーIDの存在チェック
    if (!payload.id) {
      if (DEBUG) console.warn('[TokenRefresh] トークンペイロードにユーザーID情報がありません');
      return false;
    }
    
    return true;
  } catch (decodeError) {
    if (DEBUG) console.warn('[TokenRefresh] トークンデコードエラー', decodeError);
    return false;
  }
};

/**
 * リフレッシュトークンを使って新しいアクセストークンを取得
 * @param {boolean} force - 最小間隔を無視して強制的にリフレッシュするかどうか
 * @param {boolean} silent - エラー時にイベントを発行しないかどうか
 * @returns {Promise<string>} 新しいアクセストークン
 */
const refreshTokenFn = async (force = false, silent = false) => {
  // リフレッシュの最小間隔チェック（throttling）
  const now = Math.floor(Date.now() / 1000);
  if (!force && now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    if (DEBUG) console.log(`[TokenRefresh] 最小間隔(${MIN_REFRESH_INTERVAL}秒)内の連続リフレッシュをスキップ`);
    
    // 既存のトークンを返す
    const currentToken = safeStorage.get('accessToken');
    if (currentToken && verifyTokenHealth(currentToken)) {
      return currentToken;
    }
  }
  
  // すでにリフレッシュ中であれば、完了を待つ
  if (isRefreshing) {
    if (DEBUG) console.log('[TokenRefresh] 既存のリフレッシュ処理の完了を待機');
    return new Promise((resolve) => {
      refreshSubscribers.push(token => resolve(token));
    });
  }

  try {
    isRefreshing = true;
    if (DEBUG) console.log('[TokenRefresh] トークンリフレッシュ開始');
    
    const refreshToken = safeStorage.get('refreshToken');
    
    if (!refreshToken) {
      throw new Error('リフレッシュトークンがありません');
    }
    
    // VSCode拡張用のクライアント情報を追加
    const requestData = { 
      refreshToken,
      ...CLIENT_INFO,
      // ユーザーエージェント情報（任意）
      userAgent: navigator.userAgent
    };
    
    // リフレッシュAPIを呼び出し（タイムアウト設定を追加）
    const response = await axios.post(
      `${API_URL}/auth/refresh-token`, 
      requestData,
      { 
        timeout: 30000 // 30秒タイムアウト
      }
    );
    
    if (response.data.accessToken) {
      // リフレッシュ成功時刻を記録
      lastRefreshTime = Math.floor(Date.now() / 1000);
      // リトライカウントをリセット
      refreshRetryCount = 0;
      
      if (DEBUG) console.log('[TokenRefresh] トークンリフレッシュ成功');
      
      // 新しいアクセストークンを保存
      safeStorage.set('accessToken', response.data.accessToken);

      // 新しいリフレッシュトークンも含まれている場合は保存
      if (response.data.refreshToken) {
        safeStorage.set('refreshToken', response.data.refreshToken);
        if (DEBUG) console.log('[TokenRefresh] 新しいリフレッシュトークンを保存');
      }
      
      // 有効期限情報がある場合は保存（タイムスタンプ形式で保存）
      if (response.data.expiresIn) {
        const expiryTimestamp = Math.floor(Date.now() / 1000) + response.data.expiresIn;
        safeStorage.set('tokenExpiry', expiryTimestamp.toString());
        
        // セッション延長情報があれば記録
        if (response.data.sessionExtended) {
          safeStorage.set('sessionExtended', 'true');
          if (DEBUG) console.log(`[TokenRefresh] セッション延長あり (有効期限: ${new Date(expiryTimestamp * 1000).toLocaleString()})`);
        } else {
          if (DEBUG) console.log(`[TokenRefresh] 標準セッション (有効期限: ${new Date(expiryTimestamp * 1000).toLocaleString()})`);
        }
      }
      
      // リフレッシュ成功イベントを発行
      window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
        detail: { 
          timestamp: new Date().toISOString(),
          tokenLength: response.data.accessToken.length,
          expiresIn: response.data.expiresIn
        }
      }));

      // 待機中のリクエストに新しいトークンを通知
      onRefreshed(response.data.accessToken);
      return response.data.accessToken;
    } else {
      if (DEBUG) console.error('[TokenRefresh] リフレッシュのレスポンスに新しいトークンがありません');
      throw new Error('トークンリフレッシュのレスポンスが無効です');
    }
  } catch (error) {
    console.error('[TokenRefresh] リフレッシュエラー:', error);
    
    // リフレッシュに失敗した場合の処理
    if (error.response) {
      // サーバーからレスポンスがあった場合
      if (error.response.status === 401) {
        if (!silent) {
          // 認証情報をクリア
          safeStorage.remove('accessToken');
          safeStorage.remove('refreshToken');
          safeStorage.remove('user');
          safeStorage.remove('tokenExpiry');
          safeStorage.remove('sessionExtended');
          
          // セッション切れイベントを発行
          window.dispatchEvent(new CustomEvent('auth:logout', {
            detail: { 
              reason: 'session_expired',
              // エラーの詳細情報があれば追加
              message: error.response.data?.error?.message || '認証セッションの有効期限が切れました',
              requireRelogin: error.response.data?.error?.requireRelogin || true
            }
          }));
        }
      } else if (error.response.status === 500) {
        // サーバーエラーの場合はしばらく待ってリトライを検討
        if (refreshRetryCount < MAX_RETRY_COUNT) {
          refreshRetryCount++;
          if (DEBUG) console.log(`[TokenRefresh] サーバーエラー、後でリトライします (${refreshRetryCount}/${MAX_RETRY_COUNT})`);
          
          // リトライのスケジュール設定（指数バックオフ）
          setTimeout(() => {
            isRefreshing = false; // リフレッシュフラグをリセット
            refreshTokenFn(true, silent); // 強制リフレッシュを実行
          }, Math.min(1000 * Math.pow(2, refreshRetryCount), 30000)); // 最大30秒まで
        }
      }
    } else if (error.request) {
      // リクエストは送信されたが、レスポンスがない場合（ネットワークエラー）
      if (refreshRetryCount < MAX_RETRY_COUNT) {
        refreshRetryCount++;
        if (DEBUG) console.log(`[TokenRefresh] ネットワークエラー、後でリトライします (${refreshRetryCount}/${MAX_RETRY_COUNT})`);
        
        // リトライのスケジュール設定（指数バックオフ）
        setTimeout(() => {
          isRefreshing = false; // リフレッシュフラグをリセット
          refreshTokenFn(true, silent); // 強制リフレッシュを実行
        }, Math.min(1000 * Math.pow(2, refreshRetryCount), 30000)); // 最大30秒まで
      }
    }
    
    throw error;
  } finally {
    isRefreshing = false;
  }
};

/**
 * トークンリフレッシュのレスポンスインターセプターを設定
 */
const setupAxiosInterceptors = () => {
  // リクエストインターセプター
  axios.interceptors.request.use(
    config => {
      const token = safeStorage.get('accessToken');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    error => Promise.reject(error)
  );

  // レスポンスインターセプター
  axios.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config;
      
      // トークンが無効で、リトライしていない場合
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        
        try {
          if (DEBUG) console.log('[TokenRefresh] 401エラー検出、トークンリフレッシュを実行');
          
          // トークンをリフレッシュ
          const newToken = await refreshTokenFn();
          
          // リクエストヘッダーを更新
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          
          if (DEBUG) console.log('[TokenRefresh] 元のリクエストを再試行');
          
          // 元のリクエストを再試行
          return axios(originalRequest);
        } catch (refreshError) {
          // リフレッシュに失敗した場合
          if (DEBUG) console.error('[TokenRefresh] リフレッシュに失敗、元のエラーを返す', refreshError);
          
          // 認証エラーの詳細情報を追加
          if (error.response && error.response.data) {
            error.response.data.authRefreshFailed = true;
          }
          
          return Promise.reject(error);
        }
      }
      
      return Promise.reject(error);
    }
  );
};

/**
 * トークンの状態を確認し、必要に応じて自動的にリフレッシュを開始
 * @param {boolean} force - 強制的にチェックするかどうか
 * @returns {Promise<boolean>} リフレッシュが成功したかどうか
 */
const checkTokenStatus = async (force = false) => {
  const accessToken = safeStorage.get('accessToken');
  const expiryStr = safeStorage.get('tokenExpiry');
  
  if (!accessToken) {
    if (DEBUG) console.log('[TokenRefresh] アクセストークンがないため、チェックをスキップ');
    return false; // トークンがなければリフレッシュ不要
  }
  
  // トークンの健全性確認
  if (!verifyTokenHealth(accessToken)) {
    if (DEBUG) console.warn('[TokenRefresh] トークンの形式が無効、リフレッシュを試行');
    try {
      await refreshTokenFn(true, true);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  if (expiryStr) {
    const expiry = parseInt(expiryStr, 10);
    const now = Math.floor(Date.now() / 1000);
    
    // 標準バッファ時間（2時間前）とセッション延長時の調整
    const sessionExtended = safeStorage.get('sessionExtended') === 'true';
    const bufferTime = sessionExtended ? 4 * 60 * 60 : 2 * 60 * 60; // 延長時は4時間前、通常は2時間前
    
    if (DEBUG) {
      const remainingTime = expiry - now;
      console.log(`[TokenRefresh] トークン有効期限まで残り ${Math.floor(remainingTime / 3600)}時間${Math.floor((remainingTime % 3600) / 60)}分`);
    }
    
    // 有効期限が近づいているか確認
    if (force || expiry - now < bufferTime) {
      if (DEBUG) console.log(`[TokenRefresh] トークン有効期限が近いため (または強制的に) リフレッシュを実行`);
      
      try {
        await refreshTokenFn(force, true);
        return true; // リフレッシュ成功
      } catch (error) {
        if (DEBUG) console.error('[TokenRefresh] 自動リフレッシュに失敗:', error);
        return false;
      }
    } else {
      if (DEBUG) console.log('[TokenRefresh] トークンはまだ有効です、リフレッシュ不要');
    }
  } else if (force) {
    if (DEBUG) console.log('[TokenRefresh] 有効期限情報がありませんが、強制的にリフレッシュを実行');
    
    try {
      await refreshTokenFn(true, true);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  return true; // トークンは有効
};

/**
 * 定期的なトークンチェックを開始
 */
const startTokenRefreshInterval = () => {
  // バックグラウンドチェックの頻度（時間）
  const checkIntervalMinutes = 30;
  
  if (DEBUG) console.log(`[TokenRefresh] ${checkIntervalMinutes}分ごとのトークンチェックを開始`);
  
  // 定期的にトークンをチェック
  const interval = setInterval(async () => {
    await checkTokenStatus();
  }, checkIntervalMinutes * 60 * 1000);
  
  // グローバルオブジェクトに保存してページリロード時にクリア
  window.tokenRefreshInterval = interval;
  
  // 前回のインターバルがあればクリア
  if (window.previousTokenRefreshInterval) {
    clearInterval(window.previousTokenRefreshInterval);
  }
  
  // ページアンロード時にインターバルをクリア
  window.addEventListener('beforeunload', () => {
    clearInterval(interval);
  });
  
  // ページがフォーカスを取得したときにもチェック（ブラウザタブが再アクティブ化されたとき）
  window.addEventListener('focus', () => {
    if (DEBUG) console.log('[TokenRefresh] ウィンドウフォーカス、トークンチェックを実行');
    checkTokenStatus();
  });
  
  // オンライン状態に戻ったときにもチェック
  window.addEventListener('online', () => {
    if (DEBUG) console.log('[TokenRefresh] オンライン状態に戻りました、トークンチェックを実行');
    // オンラインに戻った時は少し待ってから実行
    setTimeout(() => checkTokenStatus(true), 2000);
  });
};

// 初期化処理
const initialize = () => {
  // インターセプターを設定
  setupAxiosInterceptors();
  
  // アプリ起動時に一度トークン状態を確認
  setTimeout(async () => {
    await checkTokenStatus(true);
    startTokenRefreshInterval();
  }, 1000);
  
  if (DEBUG) console.log('[TokenRefresh] トークンリフレッシュサービスが初期化されました');
};

// 初期化を実行
initialize();

// エクスポート
export const refreshTokenService = {
  refreshToken: refreshTokenFn,
  checkTokenStatus,
  verifyTokenHealth
};