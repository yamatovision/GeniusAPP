import axios from 'axios';
import authHeader from '../utils/auth-header';
import { refreshTokenService } from '../utils/token-refresh';
import { withRetry } from '../utils/api-retry';
import WebSocketManager, { EventTypes } from '../utils/websocket-manager';

// APIのベースURL
const API_URL = `${process.env.REACT_APP_API_URL || '/api'}/workspaces`;
const ORGANIZATIONS_API_URL = `${process.env.REACT_APP_API_URL || '/api'}/organizations`;

/**
 * ワークスペース管理サービス
 * ワークスペースの作成、取得、更新、削除およびメンバー管理などの機能を提供します
 */
class WorkspaceService {
  constructor() {
    // WebSocketリスナーの登録
    this._setupWebSocketListeners();
    
    // イベントコールバック
    this.onWorkspaceUpdated = null;
    this.onWorkspaceCreated = null;
    this.onWorkspaceDeleted = null;
    this.onMemberAdded = null;
    this.onMemberRemoved = null;
  }
  
  /**
   * WebSocketリスナーをセットアップ
   */
  _setupWebSocketListeners() {
    // ワークスペース更新イベント
    WebSocketManager.on(EventTypes.WORKSPACE_UPDATED, (data) => {
      if (this.onWorkspaceUpdated) {
        this.onWorkspaceUpdated(data);
      }
    });
    
    // ワークスペース作成イベント
    WebSocketManager.on(EventTypes.WORKSPACE_CREATED, (data) => {
      if (this.onWorkspaceCreated) {
        this.onWorkspaceCreated(data);
      }
    });
    
    // ワークスペース削除イベント
    WebSocketManager.on(EventTypes.WORKSPACE_DELETED, (data) => {
      if (this.onWorkspaceDeleted) {
        this.onWorkspaceDeleted(data);
      }
    });
    
    // メンバー追加イベント
    WebSocketManager.on(EventTypes.WORKSPACE_MEMBER_ADDED, (data) => {
      if (this.onMemberAdded) {
        this.onMemberAdded(data);
      }
    });
    
    // メンバー削除イベント
    WebSocketManager.on(EventTypes.WORKSPACE_MEMBER_REMOVED, (data) => {
      if (this.onMemberRemoved) {
        this.onMemberRemoved(data);
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
   * 組織のワークスペース一覧を取得
   * @param {string} organizationId - 組織ID
   * @param {Object} options - 検索オプション
   * @param {boolean} options.includeArchived - アーカイブされたワークスペースを含めるかどうか
   * @returns {Promise} ワークスペース一覧
   */
  async getWorkspaces(organizationId, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const response = await axios.get(`${ORGANIZATIONS_API_URL}/${organizationId}/workspaces?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペース一覧取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getWorkspaces(organizationId, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ワークスペース詳細を取得
   * @param {string} id - ワークスペースID
   * @returns {Promise} ワークスペース詳細
   */
  async getWorkspaceById(id) {
    // IDが無効の場合はエラーを返す
    if (!id) {
      return Promise.reject(new Error('無効なワークスペースIDです'));
    }
    
    try {
      const response = await axios.get(`${API_URL}/${id}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペース詳細取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getWorkspaceById(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 新規ワークスペース作成
   * @param {string} organizationId - 組織ID
   * @param {Object} workspaceData - ワークスペースデータ
   * @param {string} workspaceData.name - ワークスペース名
   * @param {string} workspaceData.description - 説明
   * @param {number} workspaceData.monthlyBudget - 月間予算（トークン数）
   * @param {boolean} workspaceData.syncWithAnthropic - Anthropicとも同期するか
   * @returns {Promise} 作成結果
   */
  async createWorkspace(organizationId, workspaceData) {
    try {
      const response = await axios.post(`${ORGANIZATIONS_API_URL}/${organizationId}/workspaces`, workspaceData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペース作成エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度作成を試みる
          return this.createWorkspace(organizationId, workspaceData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ワークスペース情報を更新
   * @param {string} id - ワークスペースID
   * @param {Object} workspaceData - 更新データ
   * @returns {Promise} 更新結果
   */
  async updateWorkspace(id, workspaceData) {
    try {
      const response = await axios.put(`${API_URL}/${id}`, workspaceData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペース更新エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updateWorkspace(id, workspaceData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ワークスペースをアーカイブ（論理削除）
   * @param {string} id - ワークスペースID
   * @returns {Promise} アーカイブ結果
   */
  async archiveWorkspace(id) {
    try {
      const response = await axios.post(`${API_URL}/${id}/archive`, {}, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペースアーカイブエラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度アーカイブを試みる
          return this.archiveWorkspace(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ワークスペースメンバー一覧を取得
   * @param {string} id - ワークスペースID
   * @returns {Promise} メンバー一覧
   */
  async getWorkspaceMembers(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}/members`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペースメンバー一覧取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getWorkspaceMembers(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ワークスペースにメンバーを追加
   * @param {string} id - ワークスペースID
   * @param {Object} memberData - メンバーデータ
   * @param {string} memberData.userId - ユーザーID
   * @param {string} memberData.role - 役割（workspace_admin, workspace_developer, workspace_user）
   * @returns {Promise} 追加結果
   */
  async addWorkspaceMember(id, memberData) {
    try {
      const response = await axios.post(`${API_URL}/${id}/members`, memberData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペースメンバー追加エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度追加を試みる
          return this.addWorkspaceMember(id, memberData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ワークスペースメンバーの役割を更新
   * @param {string} id - ワークスペースID
   * @param {string} memberId - メンバーのユーザーID
   * @param {Object} roleData - 役割情報
   * @param {string} roleData.role - 新しい役割（workspace_admin, workspace_developer, workspace_user）
   * @returns {Promise} 更新結果
   */
  async updateWorkspaceMemberRole(id, memberId, roleData) {
    try {
      const response = await axios.put(`${API_URL}/${id}/members/${memberId}`, roleData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペースメンバー役割更新エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updateWorkspaceMemberRole(id, memberId, roleData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ワークスペースからメンバーを削除
   * @param {string} id - ワークスペースID
   * @param {string} memberId - メンバーのユーザーID
   * @returns {Promise} 削除結果
   */
  async removeWorkspaceMember(id, memberId) {
    try {
      const response = await axios.delete(`${API_URL}/${id}/members/${memberId}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペースメンバー削除エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度削除を試みる
          return this.removeWorkspaceMember(id, memberId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ワークスペースの使用量情報を取得
   * @param {string} id - ワークスペースID
   * @param {Object} options - 取得オプション
   * @param {string} options.period - 期間（day, week, month）
   * @param {string} options.startDate - 開始日（ISO形式）
   * @param {string} options.endDate - 終了日（ISO形式）
   * @returns {Promise} 使用量情報
   */
  async getWorkspaceUsage(id, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const response = await axios.get(`${API_URL}/${id}/usage?${queryParams.toString()}`, {
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
          return this.getWorkspaceUsage(id, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * ワークスペースのAPIキー情報を取得
   * @param {string} id - ワークスペースID
   * @returns {Promise} APIキー情報
   */
  async getWorkspaceApiKey(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}/apikey`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('ワークスペースAPIキー情報取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getWorkspaceApiKey(id);
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
      return await refreshTokenService.refreshToken();
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }
}

export default new WorkspaceService();