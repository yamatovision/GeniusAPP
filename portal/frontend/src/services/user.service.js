/**
 * ユーザー管理APIクライアント
 * バックエンドのユーザー管理APIと通信するサービス
 */
import axios from 'axios';
import authHeader from '../utils/auth-header';
import * as simpleAuthService from './simple/simpleAuth.service';

// APIのベースURL - index.jsでbaseURL='/api'が設定済みなので、ここでは相対パスのみ使用
const USERS_API_URL = '/users';

/**
 * ユーザー管理サービスクラス
 */
class UserService {
  /**
   * 現在のユーザー情報を取得
   */
  async getCurrentUser() {
    try {
      // 正しいエンドポイント：/users/me または /auth/users/me（index.jsで既にbaseURL='/api'が設定済み）
      const response = await axios.get('/auth/users/me', { headers: authHeader() });
      return response.data;
    } catch (error) {
      // エラーをコンソールに出力して詳細を確認
      console.error('getCurrentUser error details:', error);
      
      // プロファイルエンドポイントがない場合は代替エンドポイントを試す
      try {
        const response = await axios.get(`${USERS_API_URL}/me`, { headers: authHeader() });
        return response.data;
      } catch (fallbackError) {
        console.error('Fallback getCurrentUser error:', fallbackError);
        throw this._handleError(error);
      }
    }
  }
  
  /**
   * プロフィール設定を更新
   */
  async updateProfile(profileData) {
    try {
      const response = await axios.put(
        `${USERS_API_URL}/profile`, 
        profileData,
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * すべてのユーザー一覧を取得（管理者用）
   */
  async getUsers(params = {}) {
    try {
      const { page = 1, limit = 10, search = '', role = '' } = params;
      
      const response = await axios.get(
        `${USERS_API_URL}`, 
        { 
          params: { page, limit, search, role },
          headers: authHeader() 
        }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * 特定のユーザー詳細を取得
   */
  async getUserById(userId) {
    try {
      const response = await axios.get(
        `${USERS_API_URL}/${userId}`,
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * 新規ユーザーを作成（管理者用）
   */
  async createUser(userData) {
    try {
      const response = await axios.post(
        `${USERS_API_URL}`,
        userData,
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * ユーザー情報を更新
   */
  async updateUser(userId, userData) {
    try {
      const response = await axios.put(
        `${USERS_API_URL}/${userId}`,
        userData,
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * ユーザーのAPIアクセス設定を切り替え
   * @param {string} userId - ユーザーID
   * @param {boolean} enabled - 有効/無効状態
   * @returns {Promise} 更新結果
   */
  async toggleApiAccess(userId, enabled) {
    try {
      const response = await axios.put(
        `${USERS_API_URL}/${userId}/api-access`,
        { enabled },
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * ユーザーを一時停止/復旧（管理者用）
   * @param {string} userId - ユーザーID
   * @param {boolean} suspend - true: 一時停止, false: 復旧
   * @returns {Promise} 更新結果
   */
  async suspendUser(userId, suspend) {
    try {
      const response = await axios.put(
        `${USERS_API_URL}/${userId}/suspend`,
        { suspend },
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * ユーザーを削除（管理者用）
   */
  async deleteUser(userId) {
    try {
      const response = await axios.delete(
        `${USERS_API_URL}/${userId}`,
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * ユーザー統計情報を取得（管理者用）
   */
  async getUserStats() {
    try {
      const response = await axios.get(
        `${USERS_API_URL}/stats`,
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  
  /**
   * エラーハンドリング
   */
  async _handleError(error) {
    if (error.response) {
      // サーバーからのレスポンスがある場合
      const { status, data } = error.response;
      
      // 認証エラーの場合はトークンリフレッシュを試みる
      if (status === 401) {
        try {
          // 共通リフレッシュトークンサービスを使用
          await simpleAuthService.refreshToken();
          // トークンリフレッシュに成功した場合はtrue（再試行可能）を返す
          return { retryable: true };
        } catch (refreshError) {
          // リフレッシュに失敗した場合は401エラーとして処理
          return new Error('認証セッションの有効期限が切れました。再ログインしてください。');
        }
      } else if (status === 403) {
        // 権限エラー
        return new Error('権限エラー：この操作を行う権限がありません');
      } else if (status === 400 && data.errors) {
        // バリデーションエラー（詳細あり）
        return {
          message: data.message || 'バリデーションエラー',
          errors: data.errors
        };
      } else if (status === 429) {
        // レート制限エラー
        return {
          message: 'リクエスト回数が多すぎます。しばらく待ってから再試行してください。',
          retryable: true,
          retryAfter: parseInt(error.response.headers['retry-after'] || '5', 10)
        };
      } else if (status >= 500) {
        // サーバーエラー（再試行可能）
        return {
          message: 'サーバーエラーが発生しました。しばらくしてから再試行してください。',
          retryable: true
        };
      } else {
        // その他のエラー
        return new Error(data.message || 'リクエスト処理中にエラーが発生しました');
      }
    } else if (error.request) {
      // リクエストは送信されたがレスポンスが受信されなかった
      // ネットワークエラーと見なして再試行可能
      return {
        message: 'ネットワーク接続エラー。インターネット接続を確認してください。',
        retryable: true
      };
    }
    
    // その他のエラー
    return error;
  }
}

// サービスインスタンスをエクスポート
export default new UserService();