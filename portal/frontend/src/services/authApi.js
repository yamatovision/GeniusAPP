import axios from 'axios';

/**
 * シンプル化された認証API
 * 認証関連のすべてのAPI操作を集約したクライアント
 */

// 新しいバックエンドURL（テスト環境）
const TEST_API_URL = 'https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api';

// API基本URL - フォールバックパスは/simple
const API_BASE_URL = TEST_API_URL + '/simple';

// APIクライアントインスタンス
export const authApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// リクエストインターセプター - 認証トークンを自動的に付加
authApi.interceptors.request.use(config => {
  // ローカルストレージからユーザー情報を取得
  try {
    const user = JSON.parse(localStorage.getItem('simpleUser') || 'null');
    
    // トークンが存在すれば付加
    if (user && user.accessToken) {
      config.headers.Authorization = `Bearer ${user.accessToken}`;
    }
  } catch (error) {
    console.error('認証トークン処理エラー:', error);
  }
  
  return config;
}, error => Promise.reject(error));

/**
 * ログイン
 * @param {string} email - メールアドレス
 * @param {string} password - パスワード
 * @returns {Promise} ログイン結果
 */
export const loginApi = (email, password) => 
  authApi.post('/auth/login', { email, password });

/**
 * ログアウト
 * @param {string} refreshToken - リフレッシュトークン
 * @returns {Promise} ログアウト結果
 */
export const logoutApi = (refreshToken) => 
  authApi.post('/auth/logout', { refreshToken });

/**
 * ユーザー登録
 * @param {string} name - 名前
 * @param {string} email - メールアドレス
 * @param {string} password - パスワード
 * @returns {Promise} 登録結果
 */
export const registerApi = (name, email, password) => 
  authApi.post('/auth/register', { name, email, password });

/**
 * リフレッシュトークンで新しいアクセストークンを取得
 * @param {string} refreshToken - リフレッシュトークン
 * @returns {Promise} トークンリフレッシュ結果
 */
export const refreshTokenApi = (refreshToken) => 
  authApi.post('/auth/refresh-token', { refreshToken });

/**
 * 現在のユーザー情報を取得
 * @returns {Promise} ユーザー情報
 */
export const getCurrentUserApi = () => 
  authApi.get('/auth/check');

/**
 * APIキー一覧を取得
 * @param {string} organizationId - 組織ID
 * @returns {Promise} APIキー一覧
 */
export const getApiKeysApi = (organizationId) => 
  authApi.get(`/organizations/${organizationId}/api-keys`);

// デフォルトエクスポート（インポートの簡略化用）
export default {
  login: loginApi,
  logout: logoutApi,
  register: registerApi,
  refreshToken: refreshTokenApi,
  getCurrentUser: getCurrentUserApi,
  getApiKeys: getApiKeysApi
};