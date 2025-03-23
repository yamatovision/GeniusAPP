import axios from 'axios';
import authHeader from '../utils/auth-header';
import { refreshTokenService } from '../utils/token-refresh';
import { withRetry } from '../utils/api-retry';

// APIのベースURL
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const ORGANIZATIONS_API_URL = `${API_BASE_URL}/organizations`;
const USERS_API_URL = `${API_BASE_URL}/users`;

/**
 * APIキー管理サービス
 * 組織のAPIキープール管理とユーザーへの割り当て機能を提供
 */
class ApiKeyService {
  /**
   * トークンのリフレッシュ
   */
  async refreshToken() {
    try {
      return await refreshTokenService.refreshToken();
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * 組織のAPIキープールに新しいAPIキーを追加
   * @param {string} organizationId - 組織ID
   * @param {Object} apiKeyData - APIキーデータ
   * @returns {Promise} 追加結果
   */
  async addApiKeyToPool(organizationId, apiKeyData) {
    try {
      const response = await axios.post(`${ORGANIZATIONS_API_URL}/${organizationId}/api-keys/pool`, apiKeyData, {
        headers: authHeader()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.addApiKeyToPool(organizationId, apiKeyData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * 組織のAPIキープールを取得
   * @param {string} organizationId - 組織ID
   * @returns {Promise} APIキープール一覧
   */
  async getApiKeyPool(organizationId) {
    try {
      const response = await axios.get(`${ORGANIZATIONS_API_URL}/${organizationId}/api-keys/pool`, {
        headers: authHeader()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.getApiKeyPool(organizationId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * 組織のAPIキープールからキーを削除
   * @param {string} organizationId - 組織ID
   * @param {string} keyId - 削除するAPIキーID
   * @returns {Promise} 削除結果
   */
  async removeApiKeyFromPool(organizationId, keyId) {
    try {
      const response = await axios.delete(`${ORGANIZATIONS_API_URL}/${organizationId}/api-keys/pool/${keyId}`, {
        headers: authHeader()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.removeApiKeyFromPool(organizationId, keyId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * CSVファイルからAPIキーを一括インポート
   * @param {string} organizationId - 組織ID
   * @param {File} csvFile - CSVファイル
   * @returns {Promise} インポート結果
   */
  async importApiKeysFromCSV(organizationId, csvFile) {
    try {
      const formData = new FormData();
      formData.append('csvFile', csvFile);
      
      const response = await axios.post(`${ORGANIZATIONS_API_URL}/${organizationId}/api-keys/import`, formData, {
        headers: {
          ...authHeader(),
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.importApiKeysFromCSV(organizationId, csvFile);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * ユーザーにAPIキーを一括割り当て
   * @param {string} organizationId - 組織ID
   * @param {Array} assignments - 割り当て情報の配列。例: [{userId: "123", keyId: "abc"}]
   * @returns {Promise} 割り当て結果
   */
  async bulkAssignApiKeys(organizationId, assignments) {
    try {
      const response = await axios.post(`${ORGANIZATIONS_API_URL}/${organizationId}/api-keys/assign-bulk`, 
        { assignments }, 
        { headers: authHeader() }
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.bulkAssignApiKeys(organizationId, assignments);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * 組織メンバーのAPIキー使用状況を取得
   * @param {string} organizationId - 組織ID
   * @returns {Promise} メンバーのAPIキー使用状況
   */
  async getUsersApiKeyUsage(organizationId) {
    try {
      const response = await axios.get(`${ORGANIZATIONS_API_URL}/${organizationId}/api-keys/usage`, {
        headers: authHeader()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.getUsersApiKeyUsage(organizationId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * ユーザーのAPIキー状態を更新（有効化/無効化）
   * @param {string} organizationId - 組織ID
   * @param {string} userId - ユーザーID
   * @param {Object} statusData - 状態データ
   * @returns {Promise} 更新結果
   */
  async updateUserApiKeyStatus(organizationId, userId, statusData) {
    try {
      const response = await axios.patch(`${ORGANIZATIONS_API_URL}/${organizationId}/users/${userId}/api-key`, statusData, {
        headers: authHeader()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.updateUserApiKeyStatus(organizationId, userId, statusData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * ユーザーのAPIキーを再割り当て
   * @param {string} organizationId - 組織ID
   * @param {string} userId - ユーザーID
   * @returns {Promise} 再割り当て結果
   */
  async reassignUserApiKey(organizationId, userId) {
    try {
      const response = await axios.post(`${ORGANIZATIONS_API_URL}/${organizationId}/users/${userId}/reassign-key`, {}, {
        headers: authHeader()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.reassignUserApiKey(organizationId, userId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * 特定ユーザーのAPIキー詳細使用履歴を取得
   * @param {string} userId - ユーザーID
   * @returns {Promise} APIキー詳細情報
   */
  async getUserApiKeyDetails(userId) {
    try {
      const response = await axios.get(`${USERS_API_URL}/${userId}/api-key/details`, {
        headers: authHeader()
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          return this.getUserApiKeyDetails(userId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }
}

export default new ApiKeyService();