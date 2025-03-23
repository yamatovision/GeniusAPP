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
      console.log('認証サービス: ログインリクエスト送信');
      const response = await axios.post(`${API_URL}/login`, { email, password });
      console.log('認証サービス: ログインレスポンス受信', response.status);
      
      if (response.data && response.data.accessToken) {
        console.log('認証サービス: トークン保存');
        // トークンをローカルストレージに保存
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        
        // ユーザー情報を保存
        if (response.data.user) {
          console.log('認証サービス: ユーザー情報保存');
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        
        // 確実に保存されたことを確認
        const savedToken = localStorage.getItem('accessToken');
        if (!savedToken) {
          console.error('認証サービス: トークン保存に失敗');
        }
      } else {
        console.error('認証サービス: レスポンスにトークンがありません', response.data);
      }
      
      // 少し待機してストレージの更新を確実にする
      await new Promise(resolve => setTimeout(resolve, 50));
      
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
   * @param {Object} options - リフレッシュオプション
   * @param {boolean} options.silent - エラー時に静かに失敗するか
   * @param {number} options.retryCount - リトライ回数
   * @returns {Promise} 新しいアクセストークン
   */
  async refreshToken(options = {}) {
    try {
      const { silent = false, retryCount = 0 } = options;
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('リフレッシュトークンがありません');
      }
      
      // VSCode拡張用のクライアント情報を追加
      const clientId = 'appgenius_vscode_client_29a7fb3e';
      const clientSecret = 'appgenius_refresh_token_secret_key_for_production';
      
      const response = await axios.post(`${API_URL}/refresh-token`, { 
        refreshToken,
        clientId,
        clientSecret
      }, {
        // タイムアウト設定を追加（20秒）
        timeout: 20000
      });
      
      if (response.data.accessToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
        
        // 新しいリフレッシュトークンが含まれる場合は保存
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Token refresh error:', error);
      
      // ネットワークエラーの場合、リトライを試みる（最大3回まで）
      if ((!error.response || error.code === 'ECONNABORTED') && options.retryCount < 3) {
        console.log(`リフレッシュトークンリトライ (${options.retryCount + 1}/3)`);
        // 指数バックオフでリトライ（1秒、2秒、4秒）
        const delay = 1000 * Math.pow(2, options.retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.refreshToken({ ...options, retryCount: options.retryCount + 1 });
      }
      
      // リフレッシュトークンが無効な場合はログアウト
      if (error.response?.status === 401) {
        // サイレントモードでない場合のみログアウト処理
        if (!options.silent) {
          // ローカルストレージから直接クリア (循環参照を避けるため)
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            // 直接APIを呼び出し、this.logoutは使わない
            try {
              axios.post(`${API_URL}/logout`, { refreshToken })
                .catch(e => console.error('Logout error:', e));
            } catch (e) {
              console.error('Logout request error:', e);
            }
          }
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
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
          // リフレッシュに失敗した場合は直接ログアウト処理（循環参照を避けるため）
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              axios.post(`${API_URL}/logout`, { refreshToken })
                .catch(e => console.error('Logout error:', e));
            } catch (e) {
              console.error('Logout request error:', e);
            }
          }
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
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
          // リフレッシュに失敗した場合は直接ログアウト処理（循環参照を避けるため）
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              axios.post(`${API_URL}/logout`, { refreshToken })
                .catch(e => console.error('Logout error:', e));
            } catch (e) {
              console.error('Logout request error:', e);
            }
          }
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
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