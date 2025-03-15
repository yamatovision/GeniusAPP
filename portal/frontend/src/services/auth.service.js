import axios from 'axios';

// APIのベースURL
const API_URL = `${process.env.REACT_APP_API_URL || '/api'}/auth`;

/**
 * 認証サービス
 * JWT認証に関する処理を提供します
 */
class AuthService {
  /**
   * ユーザーログイン
   * @param {string} email - メールアドレス
   * @param {string} password - パスワード
   * @returns {Promise} ログイン結果
   */
  async login(email, password) {
    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      
      if (response.data.accessToken) {
        // トークンをローカルストレージに保存
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * ユーザーログアウト
   */
  logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    // サーバーにログアウトリクエストを送信
    if (refreshToken) {
      axios.post(`${API_URL}/logout`, { refreshToken })
        .catch(error => console.error('Logout error:', error));
    }
    
    // ローカルストレージからユーザー情報を削除
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  /**
   * 新規ユーザー登録
   * @param {string} name - ユーザー名
   * @param {string} email - メールアドレス
   * @param {string} password - パスワード
   * @returns {Promise} 登録結果
   */
  async register(name, email, password) {
    try {
      const response = await axios.post(`${API_URL}/register`, {
        name,
        email,
        password
      });
      
      if (response.data.accessToken) {
        // 登録成功時はログインと同様に情報を保存
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }

  /**
   * トークンのリフレッシュ
   * @returns {Promise} 新しいアクセストークン
   */
  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('リフレッシュトークンがありません');
      }
      
      const response = await axios.post(`${API_URL}/refresh-token`, { refreshToken });
      
      if (response.data.accessToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
      }
      
      return response.data;
    } catch (error) {
      console.error('Token refresh error:', error);
      
      // リフレッシュトークンが無効な場合はログアウト
      if (error.response?.status === 401) {
        this.logout();
      }
      
      throw error;
    }
  }

  /**
   * 現在のユーザー情報を取得
   * @returns {Promise} ユーザー情報
   */
  async getCurrentUser() {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        throw new Error('認証情報がありません');
      }
      
      const response = await axios.get(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // ユーザー情報を更新
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      return response.data;
    } catch (error) {
      console.error('Get current user error:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度ユーザー情報を取得
          return this.getCurrentUser();
        } catch (refreshError) {
          // リフレッシュに失敗した場合はログアウト
          this.logout();
          throw refreshError;
        }
      }
      
      throw error;
    }
  }

  /**
   * ユーザー情報更新
   * @param {Object} userData - 更新するユーザー情報
   * @returns {Promise} 更新結果
   */
  async updateUser(userData) {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        throw new Error('認証情報がありません');
      }
      
      const response = await axios.put(`${API_URL}/users/me`, userData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // ユーザー情報を更新
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      return response.data;
    } catch (error) {
      console.error('Update user error:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updateUser(userData);
        } catch (refreshError) {
          // リフレッシュに失敗した場合はログアウト
          this.logout();
          throw refreshError;
        }
      }
      
      throw error;
    }
  }

  /**
   * ローカルストレージからユーザー情報を取得
   * @returns {Object|null} ユーザー情報
   */
  getStoredUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        localStorage.removeItem('user');
        return null;
      }
    }
    return null;
  }

  /**
   * ユーザーがログイン済みかどうか確認
   * @returns {boolean} ログイン状態
   */
  isLoggedIn() {
    return !!localStorage.getItem('accessToken');
  }
}

export default new AuthService();