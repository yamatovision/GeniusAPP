/**
 * ユーザー管理APIクライアント
 * バックエンドのユーザー管理APIと通信するサービス
 */
import axios from 'axios';
import authHeader from '../utils/auth-header';
import { refreshTokenService } from '../utils/token-refresh';

// APIのベースURL
const API_URL = process.env.REACT_APP_API_URL || '/api';

/**
 * ユーザー管理サービスクラス
 */
class UserService {
  /**
   * 現在のユーザー情報を取得
   */
  async getCurrentUser() {
    try {
      const response = await axios.get(`${API_URL}/users/profile`, { headers: authHeader() });
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * プロフィール設定を更新
   */
  async updateProfile(profileData) {
    try {
      const response = await axios.put(
        `${API_URL}/users/profile`, 
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
        `${API_URL}/users`, 
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
        `${API_URL}/users/${userId}`,
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
        `${API_URL}/users`,
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
        `${API_URL}/users/${userId}`,
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
        `${API_URL}/users/${userId}/api-access`,
        { enabled },
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
        `${API_URL}/users/${userId}`,
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
        `${API_URL}/users/stats`,
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * 現在のユーザーのトークン使用量を取得
   * @param {string} period - 期間（today, yesterday, week, month, year, all, custom）
   * @param {string} interval - 間隔（hour, day, week, month）
   * @param {string} startDate - 開始日（periodがcustomの場合）
   * @param {string} endDate - 終了日（periodがcustomの場合）
   * @returns {Promise} - 使用量データ
   */
  async getTokenUsage(period = 'month', interval = 'day', startDate = null, endDate = null) {
    try {
      const params = { period, interval };
      if (period === 'custom') {
        if (startDate) params.start = startDate;
        if (endDate) params.end = endDate;
      }
      
      const response = await axios.get(
        `${API_URL}/users/token-usage`,
        { 
          params,
          headers: authHeader() 
        }
      );
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  }
  
  /**
   * 特定ユーザーのトークン使用量を取得（管理者用）
   * @param {string} userId - ユーザーID
   * @param {string} period - 期間（today, yesterday, week, month, year, all, custom）
   * @param {string} interval - 間隔（hour, day, week, month）
   * @returns {Promise} - 使用量データ
   */
  async getUserTokenUsage(userId, period = 'month', interval = 'day') {
    try {
      const response = await axios.get(
        `${API_URL}/users/${userId}/token-usage`,
        { 
          params: { period, interval },
          headers: authHeader() 
        }
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
          await refreshTokenService.refreshToken();
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