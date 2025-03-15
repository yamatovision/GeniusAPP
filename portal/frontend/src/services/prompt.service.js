import axios from 'axios';
import authHeader from '../utils/auth-header';

// APIのベースURL
const API_URL = `${process.env.REACT_APP_API_URL || '/api'}/prompts`;

/**
 * プロンプトサービス
 * プロンプト関連のAPI呼び出しを管理します
 */
class PromptService {
  /**
   * プロンプト一覧を取得
   * @param {Object} options - 検索オプション
   * @param {number} options.page - ページ番号
   * @param {number} options.limit - 1ページの表示件数
   * @param {string} options.sort - ソート条件 (例: 'updatedAt:desc')
   * @param {string} options.search - 検索キーワード
   * @param {string} options.category - カテゴリーフィルター
   * @param {string} options.tags - タグフィルター (カンマ区切り)
   * @param {string} options.project - プロジェクトID
   * @returns {Promise} プロンプト一覧
   */
  async getPrompts(options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const response = await axios.get(`${API_URL}?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプト一覧取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getPrompts(options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロンプト詳細を取得
   * @param {string} id - プロンプトID
   * @returns {Promise} プロンプト詳細
   */
  async getPromptById(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプト詳細取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getPromptById(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 新規プロンプト作成
   * @param {Object} promptData - プロンプトデータ
   * @param {string} promptData.title - タイトル
   * @param {string} promptData.content - 内容
   * @param {string} promptData.type - タイプ
   * @param {string} promptData.category - カテゴリー
   * @param {Array} promptData.tags - タグ
   * @param {string} promptData.projectId - プロジェクトID
   * @param {boolean} promptData.isPublic - 公開フラグ
   * @returns {Promise} 作成結果
   */
  async createPrompt(promptData) {
    try {
      const response = await axios.post(API_URL, promptData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプト作成エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度作成を試みる
          return this.createPrompt(promptData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロンプト更新
   * @param {string} id - プロンプトID
   * @param {Object} promptData - 更新データ
   * @returns {Promise} 更新結果
   */
  async updatePrompt(id, promptData) {
    try {
      const response = await axios.put(`${API_URL}/${id}`, promptData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプト更新エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updatePrompt(id, promptData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロンプト削除（論理削除）
   * @param {string} id - プロンプトID
   * @returns {Promise} 削除結果
   */
  async deletePrompt(id) {
    try {
      const response = await axios.delete(`${API_URL}/${id}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプト削除エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度削除を試みる
          return this.deletePrompt(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 新しいプロンプトバージョンを作成
   * @param {string} id - プロンプトID
   * @param {Object} versionData - バージョンデータ
   * @param {string} versionData.content - バージョン内容
   * @param {string} versionData.description - バージョン説明
   * @returns {Promise} 作成結果
   */
  async createPromptVersion(id, versionData) {
    try {
      const response = await axios.post(`${API_URL}/${id}/versions`, versionData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプトバージョン作成エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度作成を試みる
          return this.createPromptVersion(id, versionData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロンプトバージョン一覧取得
   * @param {string} id - プロンプトID
   * @returns {Promise} バージョン一覧
   */
  async getPromptVersions(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}/versions`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプトバージョン一覧取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getPromptVersions(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロンプトバージョン詳細取得
   * @param {string} id - プロンプトID
   * @param {string} versionId - バージョンID
   * @returns {Promise} バージョン詳細
   */
  async getPromptVersionById(id, versionId) {
    try {
      const response = await axios.get(`${API_URL}/${id}/versions/${versionId}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプトバージョン詳細取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getPromptVersionById(id, versionId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロンプト使用を記録
   * @param {string} id - プロンプトID
   * @param {Object} usageData - 使用データ
   * @returns {Promise} 記録結果
   */
  async recordPromptUsage(id, usageData) {
    try {
      const response = await axios.post(`${API_URL}/${id}/usage`, usageData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプト使用記録エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度記録を試みる
          return this.recordPromptUsage(id, usageData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロンプト使用統計の取得
   * @param {string} id - プロンプトID
   * @param {Object} options - オプション
   * @param {string} options.period - 期間（'today', 'week', 'month', 'year', 'all'）
   * @param {string} options.interval - 間隔（'hour', 'day', 'week', 'month'）
   * @returns {Promise} 統計データ
   */
  async getPromptUsageStats(id, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const response = await axios.get(`${API_URL}/${id}/stats?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプト使用統計取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getPromptUsageStats(id, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロンプト利用へのフィードバック登録
   * @param {string} usageId - 使用記録ID
   * @param {Object} feedbackData - フィードバックデータ
   * @returns {Promise} 記録結果
   */
  async recordUserFeedback(usageId, feedbackData) {
    try {
      const response = await axios.post(`${API_URL}/usage/${usageId}/feedback`, feedbackData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ユーザーフィードバック記録エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度記録を試みる
          return this.recordUserFeedback(usageId, feedbackData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * カテゴリーとタグの集計を取得
   * @returns {Promise} カテゴリーとタグの使用頻度
   */
  async getCategoriesAndTags() {
    try {
      const response = await axios.get(`${API_URL}/metadata/categories-tags`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('カテゴリー・タグ取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getCategoriesAndTags();
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * プロンプトのコピーを作成
   * @param {string} id - 元のプロンプトID
   * @param {Object} options - コピーオプション
   * @returns {Promise} 作成されたプロンプト
   */
  async clonePrompt(id, options = {}) {
    try {
      const response = await axios.post(`${API_URL}/${id}/clone`, options, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('プロンプト複製エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度複製を試みる
          return this.clonePrompt(id, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * トークンのリフレッシュ
   * auth.service.jsのリフレッシュトークン機能を呼び出す
   * @returns {Promise} 新しいアクセストークン
   */
  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('リフレッシュトークンがありません');
      }
      
      const response = await axios.post(
        `/api/auth/refresh-token`, 
        { refreshToken }
      );
      
      if (response.data.accessToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
      }
      
      return response.data;
    } catch (error) {
      console.error('Token refresh error:', error);
      
      // リフレッシュトークンが無効な場合はローカルストレージをクリア
      if (error.response?.status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
      
      throw error;
    }
  }
}

export default new PromptService();