import axios from 'axios';
import authHeader from '../utils/auth-header';
import { tokenRefreshService } from '../utils/token-refresh';

// APIのベースURL
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const ADMIN_API_URL = `${API_BASE_URL}/admin`;

/**
 * 管理者サービス
 * 管理者向けのAPIアクセスを提供します
 */
class AdminService {
  /**
   * 全ての組織情報を取得
   * @param {Object} options - 検索オプション
   * @param {boolean} options.includeArchived - アーカイブされた組織を含めるかどうか
   * @returns {Promise} 組織一覧
   */
  async getAllOrganizations(options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      // baseURLには既に/apiが含まれているため、先頭の/apiを削除
      const response = await axios.get(`${ADMIN_API_URL}/organizations?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('全組織取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getAllOrganizations(options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 全てのワークスペース情報を取得
   * @param {Object} options - 検索オプション
   * @param {boolean} options.includeArchived - アーカイブされたワークスペースを含めるかどうか
   * @returns {Promise} ワークスペース一覧
   */
  async getAllWorkspaces(options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      // baseURLには既に/apiが含まれているため、先頭の/apiを削除
      const response = await axios.get(`${ADMIN_API_URL}/workspaces?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('全ワークスペース取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getAllWorkspaces(options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 全てのAPIキー情報を取得
   * @param {Object} options - 検索オプション
   * @param {string} options.status - ステータスでフィルタリング（active, inactive）
   * @returns {Promise} APIキー一覧
   */
  async getAllApiKeys(options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      // baseURLには既に/apiが含まれているため、先頭の/apiを削除
      // バックエンドでは 'api-keys' (ハイフンあり) と定義されている
      const response = await axios.get(`${ADMIN_API_URL}/api-keys?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('全APIキー取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getAllApiKeys(options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * APIキーの状態を更新
   * @param {string} apiKeyId - APIキーID
   * @param {Object} updateData - 更新データ
   * @param {string} updateData.status - ステータス（active, inactive）
   * @param {string} updateData.name - 新しい名称
   * @returns {Promise} 更新結果
   */
  async updateApiKeyStatus(apiKeyId, updateData) {
    try {
      // baseURLには既に/apiが含まれているため、先頭の/apiを削除
      // バックエンドでは 'api-keys' (ハイフンあり) と定義されている
      const response = await axios.put(`${ADMIN_API_URL}/api-keys/${apiKeyId}`, updateData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('APIキー更新エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updateApiKeyStatus(apiKeyId, updateData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ダッシュボード用の管理者統計情報を取得
   * @returns {Promise} ダッシュボード統計
   */
  async getDashboardStats() {
    try {
      // baseURLには既に/apiが含まれているため、先頭の/apiを削除
      const response = await axios.get(`${ADMIN_API_URL}/dashboard`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('管理者ダッシュボード統計取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getDashboardStats();
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 全システムの使用量統計情報を取得
   * @param {Object} options - 取得オプション
   * @param {string} options.period - 期間（day, week, month）
   * @param {string} options.startDate - 開始日（ISO形式）
   * @param {string} options.endDate - 終了日（ISO形式）
   * @returns {Promise} 使用量統計
   */
  async getAllUsageStats(options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      // baseURLには既に/apiが含まれているため、先頭の/apiを削除
      const response = await axios.get(`${ADMIN_API_URL}/usage?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('全使用量統計取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getAllUsageStats(options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ユーザーの役割を更新
   * @param {string} userId - ユーザーID
   * @param {Object} roleData - 役割情報
   * @param {string} roleData.role - 新しい役割（admin, user, etc）
   * @returns {Promise} 更新結果
   */
  async updateUserRole(userId, roleData) {
    try {
      const response = await axios.put(`${ADMIN_API_URL}/users/${userId}/role`, roleData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ユーザー役割更新エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updateUserRole(userId, roleData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 既存ユーザーを組織構造に移行する
   * @param {boolean} dryRun - 試行モード（実際に変更を加えない）
   * @returns {Promise} 移行結果
   */
  async migrateUsersToOrganizations(dryRun = true) {
    try {
      const response = await axios.post(`${ADMIN_API_URL}/migrate/users-to-organizations?dryRun=${dryRun}`, {}, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ユーザー移行エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度移行を試みる
          return this.migrateUsersToOrganizations(dryRun);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * トークンのリフレッシュ
   * 共通リフレッシュトークンサービスを呼び出す
   * @returns {Promise<string>} 新しいアクセストークン
   */
  async refreshToken() {
    try {
      return await tokenRefreshService.refreshToken();
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }
}

export default new AdminService();