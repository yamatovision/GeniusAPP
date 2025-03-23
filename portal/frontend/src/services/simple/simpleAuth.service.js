import axios from 'axios';
import authHeader from '../../utils/auth-header';

// APIのベースURL
const API_URL = process.env.REACT_APP_API_URL || '/api';

const API_SIMPLE_URL = `${API_URL}/simple`;

/**
 * シンプル版の認証関連サービス
 */

// ログイン
export const login = async (email, password) => {
  try {
    const response = await axios.post(`${API_SIMPLE_URL}/auth/login`, {
      email,
      password
    });
    
    if (response.data.success && response.data.data.accessToken) {
      // トークンをローカルストレージに保存
      localStorage.setItem('simpleUser', JSON.stringify(response.data.data));
    }
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// ログアウト
export const logout = async () => {
  try {
    // ローカルストレージからユーザー情報を取得
    const user = JSON.parse(localStorage.getItem('simpleUser'));
    
    if (user && user.refreshToken) {
      await axios.post(`${API_SIMPLE_URL}/auth/logout`, {
        refreshToken: user.refreshToken
      });
    }
    
    // ローカルストレージからユーザー情報を削除
    localStorage.removeItem('simpleUser');
    
    return { success: true };
  } catch (error) {
    // エラーが発生しても、ローカルストレージはクリアする
    localStorage.removeItem('simpleUser');
    
    if (error.response) {
      return error.response.data;
    }
    return { success: false, message: '接続エラーが発生しました' };
  }
};

// 新規ユーザー登録
export const register = async (name, email, password) => {
  try {
    const response = await axios.post(`${API_SIMPLE_URL}/auth/register`, {
      name,
      email,
      password
    });
    
    if (response.data.success && response.data.data.accessToken) {
      // トークンをローカルストレージに保存
      localStorage.setItem('simpleUser', JSON.stringify(response.data.data));
    }
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// トークンのリフレッシュ
export const refreshToken = async () => {
  try {
    // ローカルストレージからユーザー情報を取得
    const user = JSON.parse(localStorage.getItem('simpleUser'));
    
    if (!user || !user.refreshToken) {
      return { success: false, message: 'リフレッシュトークンがありません' };
    }
    
    const response = await axios.post(`${API_SIMPLE_URL}/auth/refresh-token`, {
      refreshToken: user.refreshToken
    });
    
    if (response.data.success && response.data.data.accessToken) {
      // 新しいトークンでユーザー情報を更新
      const updatedUser = {
        ...user,
        accessToken: response.data.data.accessToken,
        refreshToken: response.data.data.refreshToken
      };
      
      localStorage.setItem('simpleUser', JSON.stringify(updatedUser));
      
      return response.data;
    }
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// 現在のユーザー情報を取得
export const getCurrentUser = async () => {
  try {
    const response = await axios.get(`${API_SIMPLE_URL}/auth/check`, { headers: authHeader() });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw { success: false, message: '接続エラーが発生しました' };
  }
};

// 現在ログイン中のユーザー情報を取得（ローカルストレージから）
export const getCurrentUserFromStorage = () => {
  return JSON.parse(localStorage.getItem('simpleUser'));
};

// ログイン中かどうかをチェック
export const isLoggedIn = () => {
  const user = getCurrentUserFromStorage();
  return !!user && !!user.accessToken;
};