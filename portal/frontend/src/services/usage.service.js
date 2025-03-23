import axios from 'axios';
import authHeader from '../utils/auth-header';
import { tokenRefreshService } from '../utils/token-refresh';

// APIのベースURL
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const ORGANIZATIONS_API_URL = `${API_BASE_URL}/organizations`;
const WORKSPACES_API_URL = `${API_BASE_URL}/workspaces`;
const USERS_API_URL = `${API_BASE_URL}/users`;
const ADMIN_API_URL = `${API_BASE_URL}/admin`;

/**
 * 使用量管理サービス
 * トークン使用量の取得と集計に関する機能を提供します
 */
class UsageService {
  /**
   * 組織の使用量情報を取得
   * @param {string} organizationId - 組織ID
   * @param {Object} options - 取得オプション
   * @param {string} options.period - 期間（day, week, month）
   * @param {string} options.startDate - 開始日（ISO形式）
   * @param {string} options.endDate - 終了日（ISO形式）
   * @returns {Promise} 使用量情報
   */
  async getOrganizationUsage(organizationId, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      // baseURLには既に/apiが含まれているため、先頭の/apiを削除
      const response = await axios.get(`${ORGANIZATIONS_API_URL}/${organizationId}/usage?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('組織使用量取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getOrganizationUsage(organizationId, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ワークスペースの使用量情報を取得
   * @param {string} workspaceId - ワークスペースID
   * @param {Object} options - 取得オプション
   * @param {string} options.period - 期間（day, week, month）
   * @param {string} options.startDate - 開始日（ISO形式）
   * @param {string} options.endDate - 終了日（ISO形式）
   * @returns {Promise} 使用量情報
   */
  async getWorkspaceUsage(workspaceId, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      // baseURLには既に/apiが含まれているため、先頭の/apiを削除
      const response = await axios.get(`${WORKSPACES_API_URL}/${workspaceId}/usage?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペース使用量取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getWorkspaceUsage(workspaceId, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 全システムの使用量情報を取得（管理者のみ）
   * @param {Object} options - 取得オプション
   * @param {string} options.period - 期間（day, week, month）
   * @param {string} options.startDate - 開始日（ISO形式）
   * @param {string} options.endDate - 終了日（ISO形式）
   * @returns {Promise} 使用量情報
   */
  async getSystemUsage(options = {}) {
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
      console.error('システム使用量取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getSystemUsage(options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ユーザーの使用量情報を取得
   * @param {string} userId - ユーザーID (省略時は現在のユーザー)
   * @param {Object} options - 取得オプション
   * @param {string} options.period - 期間（day, week, month）
   * @param {string} options.startDate - 開始日（ISO形式）
   * @param {string} options.endDate - 終了日（ISO形式）
   * @returns {Promise} 使用量情報
   */
  async getUserUsage(userId = 'me', options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      // baseURLには既に/apiが含まれているため、先頭の/apiを削除
      const response = await axios.get(`${USERS_API_URL}/${userId}/usage?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ユーザー使用量取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getUserUsage(userId, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ダッシュボード用の概要統計情報を取得（管理者のみ）
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
      console.error('ダッシュボード統計取得エラー:', error);
      
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
   * CSV形式の使用量データをインポート（管理者のみ）
   * @param {string} organizationId - 組織ID
   * @param {FormData} formData - ファイルを含むフォームデータ
   * @returns {Promise} インポート結果
   */
  async importUsageData(organizationId, formData) {
    try {
      // baseURLには既に/apiが含まれているため、先頭の/apiを削除
      const response = await axios.post(
        `${ADMIN_API_URL}/organizations/${organizationId}/import-usage-csv`,
        formData,
        {
          headers: {
            ...authHeader(),
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('使用量データインポートエラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.importUsageData(organizationId, formData);
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

export default new UsageService();