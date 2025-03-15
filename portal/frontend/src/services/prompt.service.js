import axios from 'axios';
import authHeader from '../utils/auth-header';
import { refreshTokenService } from '../utils/token-refresh';
import { withRetry, withLoading } from '../utils/api-retry';
import { formatTimeSeriesForChart, formatVersionStatsForPieChart, formatOverallStats } from '../utils/stats-formatter';
import WebSocketManager, { EventTypes } from '../utils/websocket-manager';

// APIのベースURL
const API_URL = `${process.env.REACT_APP_API_URL || '/api'}/prompts`;

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
    this.onUsageRecorded = null;
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
    
    // プロンプト使用記録イベント
    WebSocketManager.on(EventTypes.PROMPT_USAGE_RECORDED, (data) => {
      if (this.onUsageRecorded) {
        this.onUsageRecorded(data);
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
    // IDが無効の場合はエラーを返す
    if (!id) {
      return Promise.reject(new Error('無効なプロンプトIDです'));
    }
    
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
      console.log(`プロンプト削除API呼び出し: ${API_URL}/${id}`);
      
      if (!id) {
        throw new Error('プロンプトIDが指定されていません');
      }
      
      const response = await axios.delete(`${API_URL}/${id}`, {
        headers: authHeader()
      });
      
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
   * @param {Object} loadingOptions - ローディング状態管理オプション
   * @returns {Promise} 統計データ（フォーマット済み）
   */
  async getPromptUsageStats(id, options = {}, loadingOptions = {}) {
    const fetchStats = async () => {
      const queryParams = new URLSearchParams();
      
      // オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      // 再試行ロジックを適用してAPIを呼び出し
      const response = await withRetry(
        () => axios.get(`${API_URL}/${id}/stats?${queryParams.toString()}`, {
          headers: authHeader()
        }),
        {
          maxRetries: 3,
          onRetry: ({ attempt, waitTime }) => {
            console.log(`統計取得リトライ中 (${attempt}/3) - ${waitTime}ms後に再試行`);
          }
        }
      );
      
      // 生の統計データ
      const rawStats = response.data;
      
      // UIで使いやすい形式にフォーマット
      return {
        raw: rawStats,
        formatted: {
          overall: formatOverallStats(rawStats.overall),
          versionChart: formatVersionStatsForPieChart(rawStats.versions),
          timeSeriesChart: formatTimeSeriesForChart(rawStats.timeSeries, options.interval || 'day')
        }
      };
    };
    
    // ローディング状態管理
    return withLoading(fetchStats, loadingOptions);
  }
  
  /**
   * プロンプト使用統計の詳細取得（バージョン別比較など）
   * @param {string} id - プロンプトID
   * @param {Array<string>} versionIds - 比較するバージョンID配列
   * @param {Object} options - オプション
   * @returns {Promise} 詳細統計データ
   */
  async getPromptUsageComparison(id, versionIds = [], options = {}) {
    try {
      // バージョンIDをカンマ区切りの文字列に変換
      const versionParam = versionIds.join(',');
      const queryParams = new URLSearchParams({
        versions: versionParam,
        ...options
      });
      
      // 再試行ロジックを適用してAPIを呼び出し
      const response = await withRetry(
        () => axios.get(`${API_URL}/${id}/stats/comparison?${queryParams.toString()}`, {
          headers: authHeader()
        })
      );
      
      return response.data;
    } catch (error) {
      console.error('プロンプト使用比較データ取得エラー:', error);
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
      console.log(`プロンプト複製API呼び出し: ${API_URL}/${id}/clone`, options);
      
      const response = await axios.post(`${API_URL}/${id}/clone`, options, {
        headers: authHeader()
      });
      
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
      return await refreshTokenService.refreshToken();
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
      
      const response = await axios.post(`${API_URL}/${id}/share`, {}, {
        headers: authHeader()
      });
      
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