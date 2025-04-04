/**
 * シンプルな認証関連サービス
 * ログイン、ログアウト、ユーザー情報取得、トークンリフレッシュなどの機能を提供します
 */
import axios from 'axios';
import simpleAuthHeader from '../../utils/simple-auth-header';

// 新しいバックエンドURL（テスト環境）- 直接指定
const TEST_API_URL = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api';

// API基本URL 
// テスト環境用の完全なURLを使用
const SIMPLE_API_URL = TEST_API_URL + '/simple';

// リフレッシュ中かどうかのフラグ（重複防止）
let isRefreshing = false;
// リフレッシュ待ちのリクエスト
let refreshSubscribers = [];
// 最後のリフレッシュ時刻
let lastRefreshTime = 0;
// リフレッシュの最小間隔（秒）- 適切な間隔に設定
const MIN_REFRESH_INTERVAL = 60; // 1分に短縮

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
export const getCurrentUserFromStorage = () => {
  try {
    return JSON.parse(localStorage.getItem('simpleUser'));
  } catch (error) {
    console.error('simpleAuth.getCurrentUserFromStorage: エラー発生', error);
    return null;
  }
};

/**
 * ログイン状態チェック
 * @returns {boolean} ログイン中かどうか
 */
export const isLoggedIn = () => {
  try {
    const user = getCurrentUserFromStorage();
    return !!user && !!user.accessToken;
  } catch (error) {
    console.error('simpleAuth.isLoggedIn: エラー発生', error);
    return false;
  }
};

/**
 * ログイン処理（安定性向上版）
 * @param {string} email - メールアドレス
 * @param {string} password - パスワード
 * @returns {Promise<Object>} レスポンスデータ
 */
export const login = async (email, password) => {
  console.log('simpleAuth.login: ログイン開始');
  
  try {
    // リクエスト設定
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    // ログイン前にローカルストレージをクリア（古い情報を消去）
    localStorage.removeItem('simpleUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // クリアしたことをログ
    console.log('simpleAuth.login: 古い認証情報をクリア');
    
    // キャッシュもクリア
    lastAuthCheckTime = 0;
    cachedAuthResponse = null;
    
    // ログイン実行
    const response = await axios.post(`${SIMPLE_API_URL}/auth/login`, {
      email,
      password
    }, config);
    
    console.log('simpleAuth.login: レスポンス受信', response.status);
    
    // 成功時の処理
    if (response.data.success && response.data.data.accessToken) {
      // 信頼性を高めるために同期的に処理
      try {
        // ローカルストレージに保存
        localStorage.setItem('simpleUser', JSON.stringify(response.data.data));
        
        // 冗長性のため主要な認証情報のみ別途保存（リカバリー用）
        if (response.data.data.accessToken) {
          localStorage.setItem('accessToken', response.data.data.accessToken);
        }
        if (response.data.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.data.refreshToken);
        }
        if (response.data.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
        }
        
        console.log('simpleAuth.login: ストレージ保存完了（バックアップも含む）');
      } catch (storageError) {
        console.error('simpleAuth.login: ストレージ保存エラー', storageError);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('simpleAuth.login: エラー発生', error);
    
    // APIエラーレスポンスを返す
    if (error.response) {
      throw error.response.data;
    }
    
    // ネットワークエラーなど
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

/**
 * ログアウト処理
 * @returns {Promise<Object>} レスポンスデータ
 */
export const logout = async () => {
  console.log('simpleAuth.logout: ログアウト開始');
  
  try {
    // ユーザー情報を取得
    const user = JSON.parse(localStorage.getItem('simpleUser') || '{}');
    
    // リフレッシュトークンがあればサーバーに送信
    if (user.refreshToken) {
      await axios.post(`${SIMPLE_API_URL}/auth/logout`, {
        refreshToken: user.refreshToken
      });
      console.log('simpleAuth.logout: サーバーログアウト完了');
    }
    
    // ローカルストレージをクリア
    localStorage.removeItem('simpleUser');
    console.log('simpleAuth.logout: ローカルストレージクリア完了');
    
    return { success: true, message: 'ログアウトしました' };
  } catch (error) {
    console.error('simpleAuth.logout: エラー発生', error);
    
    // エラーが発生してもローカルストレージはクリア
    localStorage.removeItem('simpleUser');
    
    return { success: false, message: 'サーバーとの通信中にエラーが発生しましたが、ログアウト処理は完了しました' };
  }
};

/**
 * 新規ユーザー登録
 * @param {string} name - 氏名
 * @param {string} email - メールアドレス
 * @param {string} password - パスワード
 * @returns {Promise<Object>} レスポンスデータ
 */
export const register = async (name, email, password) => {
  console.log('simpleAuth.register: 登録開始');
  
  try {
    const response = await axios.post(`${SIMPLE_API_URL}/auth/register`, {
      name,
      email,
      password
    });
    
    // 登録成功時の処理
    if (response.data.success && response.data.data.accessToken) {
      // ローカルストレージに保存
      localStorage.setItem('simpleUser', JSON.stringify(response.data.data));
      console.log('simpleAuth.register: ストレージ保存完了');
    }
    
    return response.data;
  } catch (error) {
    console.error('simpleAuth.register: エラー発生', error);
    
    if (error.response) {
      throw error.response.data;
    }
    
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

/**
 * リフレッシュトークンを使って新しいアクセストークンを取得
 * @returns {Promise<string>} 新しいアクセストークン
 */
export const refreshToken = async () => {
  console.log('simpleAuth.refreshToken: トークンリフレッシュ開始');
  
  // 連続リフレッシュ防止
  const now = Math.floor(Date.now() / 1000);
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    console.log(`simpleAuth.refreshToken: 最小間隔(${MIN_REFRESH_INTERVAL}秒)内の連続リフレッシュをスキップ`);
    return null;
  }
  
  // 既にリフレッシュ中なら待機
  if (isRefreshing) {
    console.log('simpleAuth.refreshToken: 既存のリフレッシュ処理の完了を待機');
    return new Promise(resolve => {
      refreshSubscribers.push(token => resolve(token));
    });
  }
  
  try {
    isRefreshing = true;
    console.log('simpleAuth.refreshToken: トークンリフレッシュ開始');
    
    // ユーザー情報取得
    const user = getCurrentUserFromStorage();
    if (!user || !user.refreshToken) {
      throw new Error('リフレッシュトークンがありません');
    }
    
    // リフレッシュAPIを呼び出し
    console.log('simpleAuth.refreshToken: トークンリフレッシュAPIを呼び出し');
    const response = await axios.post(
      `${SIMPLE_API_URL}/auth/refresh-token`, 
      { refreshToken: user.refreshToken }
    );
    
    // 応答ステータスをログに記録
    console.log(`simpleAuth.refreshToken: リフレッシュAPIレスポンス: ${response.status}`);
    
    if (response.data.success && response.data.data.accessToken) {
      // リフレッシュ成功時刻を記録
      lastRefreshTime = Math.floor(Date.now() / 1000);
      
      console.log('simpleAuth.refreshToken: トークンリフレッシュ成功');
      
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
    console.error('simpleAuth.refreshToken: リフレッシュエラー:', error);
    
    // APIレスポンスの詳細をログに記録
    if (error.response) {
      console.error('simpleAuth.refreshToken: APIエラー詳細:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.response.config.url
      });
    } else if (error.request) {
      console.error('simpleAuth.refreshToken: リクエスト送信エラー:', {
        method: error.request.method,
        url: error.request.url
      });
    }
    
    // 認証エラーの場合はログアウト
    if (error.response && error.response.status === 401) {
      console.log('simpleAuth.refreshToken: 401エラーによりログアウト処理を実行');
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

// 認証チェックの最小間隔（ミリ秒）
const MIN_AUTH_CHECK_INTERVAL = 300000; // 5分間に設定（レート制限問題解決のため）

// 最後のチェック時間とキャッシュされたレスポンス
let lastAuthCheckTime = 0;
let cachedAuthResponse = null;

/**
 * 現在のユーザー情報をサーバーから取得（レート制限対応と自動リカバリー機能強化版）
 * @param {boolean} forceRefresh 強制的に再取得するかどうか
 * @returns {Promise<Object>} レスポンスデータ
 */
export const getCurrentUser = async (forceRefresh = false) => {
  const now = Date.now();
  
  // キャッシュされた認証情報があり、最小間隔内であれば、キャッシュを返す（ログイン直後を除く）
  const isRecent = now - lastAuthCheckTime < MIN_AUTH_CHECK_INTERVAL;
  if (!forceRefresh && cachedAuthResponse && isRecent) {
    console.log('simpleAuth.getCurrentUser: キャッシュから認証情報を使用', {
      cacheAge: Math.round((now - lastAuthCheckTime) / 1000) + '秒'
    });
    return cachedAuthResponse;
  }
  
  console.log('simpleAuth.getCurrentUser: ユーザー情報取得開始');
  
  // 最初にローカルストレージからの認証情報を確認
  const localUser = getCurrentUserFromStorage();
  const directToken = localStorage.getItem('accessToken');
  
  try {
    // アクセストークンが存在しない場合はエラー
    if ((!localUser || !localUser.accessToken) && !directToken) {
      throw { success: false, message: '認証情報がありません' };
    }
    
    // サーバーAPIを呼び出し
    const response = await axios.get(`${SIMPLE_API_URL}/auth/check`);
    console.log('simpleAuth.getCurrentUser: レスポンス受信', response.status);
    
    // レスポンスに認証情報が含まれていれば、simpleUserにも保存する
    if (response.data?.success && response.data?.data?.user) {
      const user = response.data.data.user;
      const apiKey = response.data.data.apiKey;
      
      // 認証トークンを追加（現在のトークンを継続利用）
      const authData = {
        ...user,
        accessToken: (localUser && localUser.accessToken) || directToken,
        refreshToken: (localUser && localUser.refreshToken) || localStorage.getItem('refreshToken'),
        apiKeyId: user.apiKeyId || (apiKey && apiKey.id) || null,
        apiKeyValue: user.apiKeyValue || (apiKey && apiKey.value) || null
      };
      
      // simpleUserとして保存
      localStorage.setItem('simpleUser', JSON.stringify(authData));
      console.log('simpleAuth.getCurrentUser: 認証情報を更新しました');
    }
    
    // レスポンスをキャッシュして時間を記録
    lastAuthCheckTime = now;
    cachedAuthResponse = response.data;
    
    return response.data;
  } catch (error) {
    console.error('simpleAuth.getCurrentUser: エラー発生', error);
    
    // ネットワークエラーの場合にキャッシュを返す（オフライン対応）
    if (error.code === 'ERR_NETWORK' && cachedAuthResponse) {
      console.warn('simpleAuth.getCurrentUser: ネットワークエラー、キャッシュを使用');
      return cachedAuthResponse;
    }
    
    // 認証エラーの場合、トークンリフレッシュを試みる
    if (error.response && error.response.status === 401) {
      console.log('simpleAuth.getCurrentUser: 401エラー発生、トークンリフレッシュを試行');
      
      try {
        // トークンリフレッシュを試行
        const newToken = await refreshToken();
        
        if (newToken) {
          console.log('simpleAuth.getCurrentUser: トークンリフレッシュ成功、認証チェックを再試行');
          
          // リフレッシュ成功後に再度認証チェック
          const retryResponse = await axios.get(`${SIMPLE_API_URL}/auth/check`);
          console.log('simpleAuth.getCurrentUser: 再試行成功', retryResponse.status);
          
          // 成功したレスポンスをキャッシュして時間を記録
          lastAuthCheckTime = Date.now();
          cachedAuthResponse = retryResponse.data;
          
          return retryResponse.data;
        }
      } catch (refreshError) {
        console.error('simpleAuth.getCurrentUser: トークンリフレッシュに失敗:', refreshError);
      }
      
      // リフレッシュに失敗した場合はストレージをクリア
      localStorage.removeItem('simpleUser');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      throw { 
        success: false, 
        message: '認証セッションの有効期限が切れました。再ログインしてください。',
        requireRelogin: true 
      };
    }
    
    throw error;
  }
};

// トークンリフレッシュのレスポンスインターセプターを設定
const setupAxiosInterceptors = () => {
  // リクエストインターセプター - すべてのAPIリクエストに認証ヘッダーを付与
  axios.interceptors.request.use(
    config => {
      // リフレッシュトークンAPIへのリクエストは処理を変える（無限ループ防止）
      if (config.url && config.url.includes('/auth/refresh-token')) {
        console.debug('simpleAuth: リフレッシュトークンAPIリクエストは特殊処理');
        return config;
      }
      
      let token = null;
      
      // simpleUser からのみトークンを取得
      const simpleUser = getCurrentUserFromStorage();
      if (simpleUser && simpleUser.accessToken) {
        token = simpleUser.accessToken;
        console.debug('simpleAuth: simpleUserからトークンを取得しました');
      }
      
      // トークンがあれば認証ヘッダーを追加
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        console.debug(`simpleAuth: 認証ヘッダーを追加: Bearer ${token.substring(0, 10)}...`);
      } else {
        console.debug('simpleAuth: 認証トークンが見つからないためヘッダーを追加しません');
      }
      
      // コンテンツタイプを設定（APIリクエストのデフォルト）
      if (!config.headers['Content-Type'] && !config.headers.get('Content-Type')) {
        config.headers['Content-Type'] = 'application/json';
      }
      
      return config;
    },
    error => Promise.reject(error)
  );
  
  // レスポンスインターセプター - すべてのAPIリクエスト対応に拡張
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
          console.log('simpleAuth: 401エラー検出、トークンリフレッシュを実行');
          
          // トークンをリフレッシュ
          const newToken = await refreshToken();
          
          if (newToken) {
            // リクエストヘッダーを更新
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            
            // 元のリクエストを再試行
            return axios(originalRequest);
          }
        } catch (refreshError) {
          console.error('simpleAuth: トークンリフレッシュに失敗', refreshError);
        }
      }
      
      return Promise.reject(error);
    }
  );
};

// インターセプターを設定
setupAxiosInterceptors();