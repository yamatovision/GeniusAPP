/**
 * トークンリフレッシュサービス
 * 認証トークンのリフレッシュ処理を一元管理します
 */
import axios from 'axios';

// APIのベースURL
const API_URL = process.env.REACT_APP_API_URL || '/api';

// リフレッシュ中かどうかのフラグ（重複防止）
let isRefreshing = false;
// リフレッシュ待ちのリクエスト
let refreshSubscribers = [];

/**
 * トークンリフレッシュが完了したときにサブスクライバーを実行
 * @param {string} token - 新しいアクセストークン
 */
const onRefreshed = (token) => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

/**
 * リフレッシュトークンを使って新しいアクセストークンを取得
 * @returns {Promise<string>} 新しいアクセストークン
 */
const refreshTokenFn = async () => {
  // すでにリフレッシュ中であれば、完了を待つ
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshSubscribers.push(token => resolve(token));
    });
  }

  try {
    isRefreshing = true;
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('リフレッシュトークンがありません');
    }
    
    const response = await axios.post(
      `${API_URL}/auth/refresh-token`, 
      { refreshToken }
    );
    
    if (response.data.accessToken) {
      // 新しいアクセストークンを保存
      localStorage.setItem('accessToken', response.data.accessToken);

      // 新しいリフレッシュトークンも含まれている場合は保存
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }

      // 待機中のリクエストに新しいトークンを通知
      onRefreshed(response.data.accessToken);
      return response.data.accessToken;
    } else {
      throw new Error('トークンリフレッシュのレスポンスが無効です');
    }
  } catch (error) {
    // リフレッシュに失敗した場合、認証情報をクリア
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // セッション切れイベントを発行
      window.dispatchEvent(new CustomEvent('auth:logout', {
        detail: { reason: 'session_expired' }
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
  // リクエストインターセプター
  axios.interceptors.request.use(
    config => {
      const token = localStorage.getItem('accessToken');
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
          // トークンをリフレッシュ
          const newToken = await refreshTokenFn();
          
          // リクエストヘッダーを更新
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          
          // 元のリクエストを再試行
          return axios(originalRequest);
        } catch (refreshError) {
          // リフレッシュに失敗した場合はエラーを伝播
          return Promise.reject(refreshError);
        }
      }
      
      return Promise.reject(error);
    }
  );
};

// 初期化時にインターセプターを設定
setupAxiosInterceptors();

// エクスポート
export const refreshTokenService = {
  refreshToken: refreshTokenFn
};