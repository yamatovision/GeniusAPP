/**
 * ユーザー管理APIクライアント
 * バックエンドのユーザー管理APIと通信するサービス
 */
import axios from 'axios';
import authHeader from '../utils/auth-header';

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
   * エラーハンドリング
   */
  _handleError(error) {
    if (error.response) {
      // サーバーからのレスポンスがある場合
      const { status, data } = error.response;
      
      if (status === 401) {
        // 認証エラー
        return new Error('認証エラー：ログインが必要です');
      } else if (status === 403) {
        // 権限エラー
        return new Error('権限エラー：この操作を行う権限がありません');
      } else if (status === 400 && data.errors) {
        // バリデーションエラー（詳細あり）
        return {
          message: data.message || 'バリデーションエラー',
          errors: data.errors
        };
      } else {
        // その他のエラー
        return new Error(data.message || 'リクエスト処理中にエラーが発生しました');
      }
    }
    
    // ネットワークエラーなど
    return error;
  }
}

// サービスインスタンスをエクスポート
export default new UserService();