import axios from 'axios';
import { tokenRefreshService } from '../utils/token-refresh';
import { withRetry, withLoading } from '../utils/api-retry';
// 使用統計フォーマッター関連のimportは削除されました
import WebSocketManager, { EventTypes } from '../utils/websocket-manager';

// APIのベースURL - 標準のプロンプトAPIを使用
// axios.defaults.baseURLで既に基本URLが設定されているため、/apiプレフィックスは必要
const API_URL = '/api/prompts';

/**
 * プロンプトサービス
 * プロンプト関連のAPI呼び出しを管理します
 */
class PromptService {
  constructor() {
    // WebSocketリスナーの登録
    this._setupWebSocketListeners();
    
    // プロンプト更新コールバック
    this.onPromptUpdated = null;
    this.onPromptCreated = null;
    this.onPromptDeleted = null;
  }
  
  /**
   * WebSocketリスナーをセットアップ
   */
  _setupWebSocketListeners() {
    // プロンプト更新イベント
    WebSocketManager.on(EventTypes.PROMPT_UPDATED, (data) => {
      if (this.onPromptUpdated) {
        this.onPromptUpdated(data);
      }
    });
    
    // プロンプト作成イベント
    WebSocketManager.on(EventTypes.PROMPT_CREATED, (data) => {
      if (this.onPromptCreated) {
        this.onPromptCreated(data);
      }
    });
    
    // プロンプト削除イベント
    WebSocketManager.on(EventTypes.PROMPT_DELETED, (data) => {
      if (this.onPromptDeleted) {
        this.onPromptDeleted(data);
      }
    });
  }
  
  /**
   * WebSocketリスナーを登録
   * @param {string} event - イベントタイプ
   * @param {Function} callback - コールバック関数
   * @returns {Function} リスナー登録解除用の関数
   */
  subscribe(event, callback) {
    return WebSocketManager.on(event, callback);
  }
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
      
      const response = await axios.get(`${API_URL}?${queryParams.toString()}`);
      
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
    // IDが無効の場合はエラーを返す
    if (!id) {
      return Promise.reject(new Error('無効なプロンプトIDです'));
    }
    
    try {
      const response = await axios.get(`${API_URL}/${id}`);
      
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
      const response = await axios.post(API_URL, promptData);
      
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
      const response = await axios.put(`${API_URL}/${id}`, promptData);
      
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
      console.log(`プロンプト削除API呼び出し: ${API_URL}/${id}`);
      
      if (!id) {
        throw new Error('プロンプトIDが指定されていません');
      }
      
      const response = await axios.delete(`${API_URL}/${id}`);
      
      console.log('プロンプト削除API応答:', response.data);
      return response.data;
    } catch (error) {
      console.error('プロンプト削除エラー:', error);
      console.error('エラー詳細:', error.response?.data || 'レスポンスなし');
      console.error('リクエストURL:', `${API_URL}/${id}`);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          console.log('トークンリフレッシュを試みます');
          await this.refreshToken();
          console.log('トークンリフレッシュ成功、再度削除を試みます');
          // リフレッシュ成功後に再度削除を試みる
          return this.deletePrompt(id);
        } catch (refreshError) {
          console.error('トークンリフレッシュ失敗:', refreshError);
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
      const response = await axios.post(`${API_URL}/${id}/versions`, versionData);
      
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
      const response = await axios.get(`${API_URL}/${id}/versions`);
      
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
      const response = await axios.get(`${API_URL}/${id}/versions/${versionId}`);
      
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
   * プロンプト使用を記録（非推奨 - 統計機能削除済み）
   * @param {string} id - プロンプトID
   * @param {Object} usageData - 使用データ
   * @returns {Promise} 記録結果
   * @deprecated 使用統計機能は削除されました
   */
  async recordPromptUsage(id, usageData) {
    try {
      console.warn('recordPromptUsageは非推奨になりました - 統計機能は削除されました');
      
      // 後方互換性のために、APIを呼び出す
      const response = await axios.post(`${API_URL}/${id}/usage`, {});
      
      return response.data;
    } catch (error) {
      console.error('プロンプト使用記録エラー:', error);
      // エラーは無視して正常応答を返す
      return { success: true, message: 'プロンプト使用記録は削除されました' };
    }
  }
  
  /**
   * カテゴリーとタグの集計を取得
   * @returns {Promise} カテゴリーとタグの使用頻度
   */
  async getCategoriesAndTags() {
    try {
      const response = await axios.get(`${API_URL}/metadata/categories-tags`);
      
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
      console.log(`プロンプト複製API呼び出し: ${API_URL}/${id}/clone`, options);
      
      const response = await axios.post(`${API_URL}/${id}/clone`, options);
      
      console.log('プロンプト複製API応答:', response.data);
      return response.data;
    } catch (error) {
      console.error('プロンプト複製エラー:', error);
      console.error('エラー詳細:', error.response?.data || 'レスポンスなし');
      console.error('リクエストURL:', `${API_URL}/${id}/clone`);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          console.log('トークンリフレッシュを試みます');
          await this.refreshToken();
          console.log('トークンリフレッシュ成功、再度複製を試みます');
          // リフレッシュ成功後に再度複製を試みる
          return this.clonePrompt(id, options);
        } catch (refreshError) {
          console.error('トークンリフレッシュ失敗:', refreshError);
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
  
  /**
   * プロンプトの共有リンクを生成
   * @param {string} id - プロンプトID
   * @returns {Promise} - 共有リンク情報
   */
  async createShareLink(id) {
    try {
      console.log(`共有リンク生成API呼び出し: ${API_URL}/${id}/share`);
      
      if (!id) {
        throw new Error('プロンプトIDが指定されていません');
      }
      
      const response = await axios.post(`${API_URL}/${id}/share`, {});
      
      console.log('共有リンク生成API応答:', response.data);
      return response.data;
    } catch (error) {
      console.error('共有リンク生成エラー:', error);
      console.error('エラー詳細:', error.response?.data || 'レスポンスなし');
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度生成を試みる
          return this.createShareLink(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
}

export default new PromptService();