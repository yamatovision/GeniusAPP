/**
 * トークンリフレッシュサービス - シンプル版
 * 既存の複雑なリフレッシュロジックを置き換える単純なトークンリフレッシュ処理
 */
import axios from 'axios';

// API基本URL
// package.jsonのproxyとaxios.defaults.baseURLによって/apiは自動的に追加されるため、
// ここでは明示的に追加しない
const SIMPLE_API_URL = '/simple';

// リフレッシュ中かどうかのフラグ（重複防止）
let isRefreshing = false;
// リフレッシュ待ちのリクエスト
let refreshSubscribers = [];
// 最後のリフレッシュ時刻
let lastRefreshTime = 0;
// リフレッシュの最小間隔（秒）
const MIN_REFRESH_INTERVAL = 10;

/**
 * トークンリフレッシュが完了したときにサブスクライバーを実行
 * @param {string} token - 新しいアクセストークン
 */
const onRefreshed = (token) => {
  console.log(`[TokenRefresh] ${refreshSubscribers.length}個の待機リクエストを再開`);
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

/**
 * ローカルストレージからシンプルユーザー情報を取得
 * @returns {Object|null} ユーザー情報
 */
const getSimpleUser = () => {
  try {
    const data = localStorage.getItem('simpleUser');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[TokenRefresh] ユーザー情報の取得に失敗しました', error);
    return null;
  }
};

/**
 * リフレッシュトークンを使って新しいアクセストークンを取得
 * @returns {Promise<string>} 新しいアクセストークン
 */
const refreshToken = async () => {
  // 連続リフレッシュ防止
  const now = Math.floor(Date.now() / 1000);
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    console.log(`[TokenRefresh] 最小間隔(${MIN_REFRESH_INTERVAL}秒)内の連続リフレッシュをスキップ`);
    return null;
  }
  
  // 既にリフレッシュ中なら待機
  if (isRefreshing) {
    console.log('[TokenRefresh] 既存のリフレッシュ処理の完了を待機');
    return new Promise(resolve => {
      refreshSubscribers.push(token => resolve(token));
    });
  }
  
  try {
    isRefreshing = true;
    console.log('[TokenRefresh] トークンリフレッシュ開始');
    
    // ユーザー情報取得
    const user = getSimpleUser();
    if (!user || !user.refreshToken) {
      throw new Error('リフレッシュトークンがありません');
    }
    
    // リフレッシュAPIを呼び出し
    const response = await axios.post(
      `${SIMPLE_API_URL}/auth/refresh-token`, 
      { refreshToken: user.refreshToken }
    );
    
    if (response.data.success && response.data.data.accessToken) {
      // リフレッシュ成功時刻を記録
      lastRefreshTime = Math.floor(Date.now() / 1000);
      
      console.log('[TokenRefresh] トークンリフレッシュ成功');
      
      // 新しいトークンでユーザー情報を更新
      const updatedUser = {
        ...user,
        accessToken: response.data.data.accessToken,
        refreshToken: response.data.data.refreshToken
      };
      
      // 更新した情報を保存
      localStorage.setItem('simpleUser', JSON.stringify(updatedUser));
      
      // 待機中のリクエストに新しいトークンを通知
      onRefreshed(response.data.data.accessToken);
      return response.data.data.accessToken;
    } else {
      throw new Error('トークンリフレッシュのレスポンスが無効です');
    }
  } catch (error) {
    console.error('[TokenRefresh] リフレッシュエラー:', error);
    
    // 認証エラーの場合はログアウト
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('simpleUser');
      
      // セッション切れイベントを発行
      window.dispatchEvent(new CustomEvent('auth:logout', {
        detail: { 
          reason: 'session_expired',
          message: '認証セッションの有効期限が切れました',
          requireRelogin: true
        }
      }));
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
  // リクエストインターセプター - すべてのAPIリクエスト対応に拡張 (2025/3/23)
  axios.interceptors.request.use(
    config => {
      // すべてのAPIリクエストに対応（simple認証に統一）
      const user = getSimpleUser();
      if (user && user.accessToken) {
        config.headers['Authorization'] = `Bearer ${user.accessToken}`;
      }
      return config;
    },
    error => Promise.reject(error)
  );
  
  // レスポンスインターセプター - すべてのAPIリクエスト対応に拡張 (2025/3/23)
  axios.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config;
      
      // 全APIリクエストに対応するように変更
      if (
        originalRequest && 
        error.response && 
        error.response.status === 401 && 
        !originalRequest._retry
      ) {
        originalRequest._retry = true;
        
        try {
          console.log('[TokenRefresh] 401エラー検出、トークンリフレッシュを実行');
          
          // トークンをリフレッシュ
          const newToken = await refreshToken();
          
          if (newToken) {
            // リクエストヘッダーを更新
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            
            // 元のリクエストを再試行
            return axios(originalRequest);
          }
        } catch (refreshError) {
          console.error('[TokenRefresh] トークンリフレッシュに失敗', refreshError);
        }
      }
      
      return Promise.reject(error);
    }
  );
};

// インターセプターを設定
setupAxiosInterceptors();

// エクスポート
export const tokenRefreshService = {
  refreshToken,
  getSimpleUser
};