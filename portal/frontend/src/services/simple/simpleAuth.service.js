/**
 * シンプルな認証関連サービス
 * ログイン、ログアウト、ユーザー情報取得などの機能を提供します
 */
import axios from 'axios';
import simpleAuthHeader from '../../utils/simple-auth-header';

// API基本URL
// '/api'のプレフィックスは自動的にプロキシされるため、ここでは追加しない
const SIMPLE_API_URL = '/simple';

/**
 * ログイン処理
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
    
    // ログイン実行
    const response = await axios.post(`${SIMPLE_API_URL}/auth/login`, {
      email,
      password
    }, config);
    
    console.log('simpleAuth.login: レスポンス受信', response.status);
    
    // 成功時の処理
    if (response.data.success && response.data.data.accessToken) {
      // ローカルストレージに保存
      localStorage.setItem('simpleUser', JSON.stringify(response.data.data));
      console.log('simpleAuth.login: ストレージ保存完了');
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
 * トークンリフレッシュ
 * @returns {Promise<Object>} レスポンスデータ
 */
export const refreshToken = async () => {
  console.log('simpleAuth.refreshToken: トークンリフレッシュ開始');
  
  try {
    // ユーザー情報を取得
    const user = JSON.parse(localStorage.getItem('simpleUser') || '{}');
    
    if (!user.refreshToken) {
      throw new Error('リフレッシュトークンがありません');
    }
    
    // リフレッシュAPIを呼び出し
    const response = await axios.post(`${SIMPLE_API_URL}/auth/refresh-token`, {
      refreshToken: user.refreshToken
    });
    
    console.log('simpleAuth.refreshToken: レスポンス受信', response.status);
    
    // 成功時の処理
    if (response.data.success && response.data.data.accessToken) {
      // 新しいトークンでユーザー情報を更新
      const updatedUser = {
        ...user,
        accessToken: response.data.data.accessToken,
        refreshToken: response.data.data.refreshToken
      };
      
      // 更新した情報を保存
      localStorage.setItem('simpleUser', JSON.stringify(updatedUser));
      console.log('simpleAuth.refreshToken: ストレージ更新完了');
      
      return response.data;
    }
    
    return response.data;
  } catch (error) {
    console.error('simpleAuth.refreshToken: エラー発生', error);
    
    // 認証エラーの場合
    if (error.response && error.response.status === 401) {
      // ストレージクリア
      localStorage.removeItem('simpleUser');
      
      throw { 
        success: false, 
        message: '認証セッションの有効期限が切れました。再ログインしてください。',
        requireRelogin: true 
      };
    }
    
    if (error.response) {
      throw error.response.data;
    }
    
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

/**
 * 現在のユーザー情報をサーバーから取得
 * @returns {Promise<Object>} レスポンスデータ
 */
export const getCurrentUser = async () => {
  console.log('simpleAuth.getCurrentUser: ユーザー情報取得開始');
  
  try {
    // 認証ヘッダーを取得
    const headers = simpleAuthHeader();
    console.log('simpleAuth.getCurrentUser: 認証ヘッダー', headers);
    
    // ローカルストレージから基本情報を取得
    const localUser = getCurrentUserFromStorage();
    if (!localUser || !localUser.accessToken) {
      throw { success: false, message: '認証情報がありません' };
    }
    
    // サーバーAPIを呼び出し
    const response = await axios.get(`${SIMPLE_API_URL}/auth/check`, { 
      headers 
    });
    
    console.log('simpleAuth.getCurrentUser: レスポンス受信', response.status);
    return response.data;
  } catch (error) {
    console.error('simpleAuth.getCurrentUser: エラー発生', error);
    
    // 認証エラーの場合
    if (error.response && error.response.status === 401) {
      // ストレージクリア
      localStorage.removeItem('simpleUser');
      
      throw { 
        success: false, 
        message: '認証セッションの有効期限が切れました。再ログインしてください。',
        requireRelogin: true 
      };
    }
    
    throw error;
  }
};

/**
 * ローカルストレージからユーザー情報を取得
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