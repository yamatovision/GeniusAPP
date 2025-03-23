import axios from 'axios';
import authHeader from '../utils/auth-header';
import { refreshTokenService } from '../utils/token-refresh';
import { withRetry } from '../utils/api-retry';
import WebSocketManager, { EventTypes } from '../utils/websocket-manager';

// APIのベースURL
const API_URL = `${process.env.REACT_APP_API_URL || '/api'}/organizations`;

/**
 * 組織管理サービス
 * 組織の作成、取得、更新、削除および組織メンバー管理などの機能を提供します
 */
class OrganizationService {
  constructor() {
    // WebSocketリスナーの登録
    this._setupWebSocketListeners();
    
    // イベントコールバック
    this.onOrganizationUpdated = null;
    this.onOrganizationCreated = null;
    this.onOrganizationDeleted = null;
    this.onMemberAdded = null;
    this.onMemberRemoved = null;
  }
  
  /**
   * WebSocketリスナーをセットアップ
   */
  _setupWebSocketListeners() {
    // 組織更新イベント
    WebSocketManager.on(EventTypes.ORGANIZATION_UPDATED, (data) => {
      if (this.onOrganizationUpdated) {
        this.onOrganizationUpdated(data);
      }
    });
    
    // 組織作成イベント
    WebSocketManager.on(EventTypes.ORGANIZATION_CREATED, (data) => {
      if (this.onOrganizationCreated) {
        this.onOrganizationCreated(data);
      }
    });
    
    // 組織削除イベント
    WebSocketManager.on(EventTypes.ORGANIZATION_DELETED, (data) => {
      if (this.onOrganizationDeleted) {
        this.onOrganizationDeleted(data);
      }
    });
    
    // メンバー追加イベント
    WebSocketManager.on(EventTypes.ORGANIZATION_MEMBER_ADDED, (data) => {
      if (this.onMemberAdded) {
        this.onMemberAdded(data);
      }
    });
    
    // メンバー削除イベント
    WebSocketManager.on(EventTypes.ORGANIZATION_MEMBER_REMOVED, (data) => {
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
   * 組織一覧を取得
   * @param {Object} options - 検索オプション
   * @param {boolean} options.includeArchived - アーカイブされた組織を含めるかどうか
   * @returns {Promise} 組織一覧
   */
  async getOrganizations(options = {}) {
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
      console.error('組織一覧取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getOrganizations(options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織詳細を取得
   * @param {string} id - 組織ID
   * @returns {Promise} 組織詳細
   */
  async getOrganizationById(id) {
    // IDが無効の場合はエラーを返す
    if (!id) {
      return Promise.reject(new Error('無効な組織IDです'));
    }
    
    try {
      const response = await axios.get(`${API_URL}/${id}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('組織詳細取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getOrganizationById(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 新規組織作成
   * @param {Object} organizationData - 組織データ
   * @param {string} organizationData.name - 組織名
   * @param {string} organizationData.description - 説明
   * @param {number} organizationData.monthlyBudget - 月間予算（トークン数）
   * @param {string} organizationData.adminApiKey - Anthropic Admin APIキー（あれば）
   * @param {string} organizationData.adminUserId - 管理者ユーザーID
   * @returns {Promise} 作成結果
   */
  async createOrganization(organizationData) {
    try {
      const response = await axios.post(API_URL, organizationData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('組織作成エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度作成を試みる
          return this.createOrganization(organizationData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織情報を更新
   * @param {string} id - 組織ID
   * @param {Object} organizationData - 更新データ
   * @returns {Promise} 更新結果
   */
  async updateOrganization(id, organizationData) {
    try {
      const response = await axios.put(`${API_URL}/${id}`, organizationData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('組織更新エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updateOrganization(id, organizationData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織をアーカイブ（論理削除）
   * @param {string} id - 組織ID
   * @returns {Promise} アーカイブ結果
   */
  async archiveOrganization(id) {
    try {
      const response = await axios.post(`${API_URL}/${id}/archive`, {}, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('組織アーカイブエラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度アーカイブを試みる
          return this.archiveOrganization(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }

  /**
   * 組織を完全に削除（物理削除）
   * @param {string} id - 組織ID
   * @returns {Promise} 削除結果
   */
  async deleteOrganization(id) {
    try {
      // デバッグ用にURLとヘッダーをログ出力
      const url = `${API_URL}/${id}`;
      const headers = authHeader();
      console.log('DELETE request to:', url);
      console.log('Headers:', headers);
      
      const response = await axios.delete(url, {
        headers: headers
      });
      
      return response.data;
    } catch (error) {
      // エラーの詳細をコンソールに出力
      console.error('組織削除エラー:', error);
      if (error.response) {
        console.error('エラーレスポンス:', error.response.status, error.response.data);
      }
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度削除を試みる
          return this.deleteOrganization(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織メンバー一覧を取得
   * @param {string} id - 組織ID
   * @returns {Promise} メンバー一覧
   */
  async getOrganizationMembers(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}/members`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('組織メンバー一覧取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getOrganizationMembers(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織にメンバーを追加
   * @param {string} id - 組織ID
   * @param {Object} memberData - メンバーデータ
   * @param {string} memberData.userId - ユーザーID
   * @param {string} memberData.role - 役割（admin, member）
   * @returns {Promise} 追加結果
   */
  async addOrganizationMember(id, memberData) {
    try {
      const response = await axios.post(`${API_URL}/${id}/members`, memberData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('組織メンバー追加エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度追加を試みる
          return this.addOrganizationMember(id, memberData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織メンバーの役割を更新
   * @param {string} id - 組織ID
   * @param {string} memberId - メンバーのユーザーID
   * @param {Object} roleData - 役割情報
   * @param {string} roleData.role - 新しい役割（admin, member）
   * @returns {Promise} 更新結果
   */
  async updateOrganizationMemberRole(id, memberId, roleData) {
    try {
      const response = await axios.put(`${API_URL}/${id}/members/${memberId}`, roleData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('組織メンバー役割更新エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updateOrganizationMemberRole(id, memberId, roleData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織からメンバーを削除
   * @param {string} id - 組織ID
   * @param {string} memberId - メンバーのユーザーID
   * @returns {Promise} 削除結果
   */
  async removeOrganizationMember(id, memberId) {
    try {
      const response = await axios.delete(`${API_URL}/${id}/members/${memberId}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('組織メンバー削除エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度削除を試みる
          return this.removeOrganizationMember(id, memberId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織の使用量情報を取得
   * @param {string} id - 組織ID
   * @param {Object} options - 取得オプション
   * @param {string} options.period - 期間（day, week, month）
   * @param {string} options.startDate - 開始日（ISO形式）
   * @param {string} options.endDate - 終了日（ISO形式）
   * @returns {Promise} 使用量情報
   */
  async getOrganizationUsage(id, options = {}) {
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
      console.error('組織使用量取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getOrganizationUsage(id, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織のAPIキー情報を取得
   * @param {string} id - 組織ID
   * @returns {Promise} APIキー情報
   */
  async getOrganizationApiKeys(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}/apikeys`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('組織APIキー情報取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getOrganizationApiKeys(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織情報をAnthropicと同期する
   * @param {string} id - 組織ID
   * @param {Object} options - 同期オプション
   * @param {boolean} options.syncWorkspaces - ワークスペースを同期するか
   * @param {boolean} options.syncApiKeys - APIキーを同期するか
   * @returns {Promise} 同期結果
   */
  async syncWithAnthropic(id, options = {}) {
    try {
      const response = await axios.post(`${API_URL}/${id}/sync`, options, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('Anthropic同期エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度同期を試みる
          return this.syncWithAnthropic(id, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織のデフォルトワークスペースを取得
   * @param {string} id - 組織ID
   * @returns {Promise} デフォルトワークスペース情報
   */
  async getDefaultWorkspace(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}/workspace`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('デフォルトワークスペース取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getDefaultWorkspace(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織のデフォルトワークスペースのメンバー一覧を取得
   * @param {string} id - 組織ID
   * @returns {Promise} メンバー一覧
   */
  async getDefaultWorkspaceMembers(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}/workspace/members`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('デフォルトワークスペースメンバー一覧取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getDefaultWorkspaceMembers(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織のデフォルトワークスペースにメンバーを追加
   * @param {string} id - 組織ID
   * @param {Object} memberData - メンバーデータ
   * @param {string} memberData.userId - ユーザーID
   * @param {string} memberData.role - 役割（workspace_admin, workspace_developer, workspace_user）
   * @returns {Promise} 追加結果
   */
  async addDefaultWorkspaceMember(id, memberData) {
    try {
      const response = await axios.post(`${API_URL}/${id}/workspace/members`, memberData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('デフォルトワークスペースメンバー追加エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度追加を試みる
          return this.addDefaultWorkspaceMember(id, memberData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織のデフォルトワークスペースメンバーの役割を更新
   * @param {string} id - 組織ID
   * @param {string} memberId - メンバーのユーザーID
   * @param {Object} roleData - 役割情報
   * @param {string} roleData.role - 新しい役割（workspace_admin, workspace_developer, workspace_user）
   * @returns {Promise} 更新結果
   */
  async updateDefaultWorkspaceMemberRole(id, memberId, roleData) {
    try {
      const response = await axios.put(`${API_URL}/${id}/workspace/members/${memberId}`, roleData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('デフォルトワークスペースメンバー役割更新エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度更新を試みる
          return this.updateDefaultWorkspaceMemberRole(id, memberId, roleData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織のデフォルトワークスペースからメンバーを削除
   * @param {string} id - 組織ID
   * @param {string} memberId - メンバーのユーザーID
   * @returns {Promise} 削除結果
   */
  async removeDefaultWorkspaceMember(id, memberId) {
    try {
      const response = await axios.delete(`${API_URL}/${id}/workspace/members/${memberId}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('デフォルトワークスペースメンバー削除エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度削除を試みる
          return this.removeDefaultWorkspaceMember(id, memberId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織のデフォルトワークスペースのAPIキー情報を取得
   * @param {string} id - 組織ID
   * @returns {Promise} APIキー情報
   */
  async getDefaultWorkspaceApiKey(id) {
    try {
      const response = await axios.get(`${API_URL}/${id}/workspace/apikey`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('デフォルトワークスペースAPIキー情報取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getDefaultWorkspaceApiKey(id);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織のデフォルトワークスペースにAPIキーを作成
   * @param {string} id - 組織ID
   * @param {Object} keyData - APIキーデータ
   * @returns {Promise} 作成結果
   */
  async createDefaultWorkspaceApiKey(id, keyData = {}) {
    try {
      const response = await axios.post(`${API_URL}/${id}/workspace/apikey`, keyData, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('デフォルトワークスペースAPIキー作成エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度作成を試みる
          return this.createDefaultWorkspaceApiKey(id, keyData);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織のデフォルトワークスペースのAPIキーを無効化
   * @param {string} id - 組織ID
   * @param {string} keyId - APIキーID
   * @returns {Promise} 無効化結果
   */
  async revokeDefaultWorkspaceApiKey(id, keyId) {
    try {
      const response = await axios.delete(`${API_URL}/${id}/workspace/apikey/${keyId}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('デフォルトワークスペースAPIキー無効化エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度無効化を試みる
          return this.revokeDefaultWorkspaceApiKey(id, keyId);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 組織のデフォルトワークスペースの使用量情報を取得
   * @param {string} id - 組織ID
   * @param {Object} options - 取得オプション
   * @param {string} options.period - 期間（day, week, month）
   * @param {string} options.startDate - 開始日（ISO形式）
   * @param {string} options.endDate - 終了日（ISO形式）
   * @returns {Promise} 使用量情報
   */
  async getDefaultWorkspaceUsage(id, options = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // 検索オプションをクエリパラメータに追加
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value);
        }
      });
      
      const response = await axios.get(`${API_URL}/${id}/workspace/usage?${queryParams.toString()}`, {
        headers: authHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('デフォルトワークスペース使用量取得エラー:', error);
      
      // トークンが無効な場合、リフレッシュを試みる
      if (error.response?.status === 401) {
        try {
          await this.refreshToken();
          // リフレッシュ成功後に再度取得を試みる
          return this.getDefaultWorkspaceUsage(id, options);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * 既存ユーザーを組織構造に移行する（管理者のみ）
   * @param {boolean} dryRun - 試行モード（実際に変更を加えない）
   * @returns {Promise} 移行結果
   */
  async migrateUsersToOrganizations(dryRun = true) {
    try {
      const response = await axios.post(`${API_URL}/migrate-users?dryRun=${dryRun}`, {}, {
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
      return await refreshTokenService.refreshToken();
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }
}

export default new OrganizationService();