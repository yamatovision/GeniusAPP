/**
 * AnthropicAdminService
 * Anthropic Admin APIとの連携を行うサービス
 */
const axios = require('axios');
const crypto = require('crypto');
const Organization = require('../models/organization.model');
const Workspace = require('../models/workspace.model');
const logger = require('../utils/logger');

class AnthropicAdminService {
  constructor() {
    this.baseUrl = 'https://api.anthropic.com/v1';
    this.version = '2023-06-01';
  }

  /**
   * API呼び出し用ヘッダーを取得
   * @param {string} adminApiKey - Admin API Key
   * @returns {Object} - リクエストヘッダー
   */
  _getHeaders(adminApiKey) {
    return {
      'anthropic-version': this.version,
      'x-api-key': adminApiKey
    };
  }

  /**
   * APIレスポンスをログに記録（機密情報は削除）
   * @param {string} operation - 操作名
   * @param {Object} response - レスポンス
   * @param {Error} error - エラー（存在する場合）
   */
  _logResponse(operation, response, error) {
    if (error) {
      logger.error(`Anthropic Admin API ${operation} エラー:`, {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data
      });
      return;
    }
    
    // 成功レスポンスのログ（APIキー情報はマスク）
    const sanitizedData = JSON.parse(JSON.stringify(response.data));
    if (sanitizedData.data && Array.isArray(sanitizedData.data)) {
      sanitizedData.data.forEach(item => {
        if (item.key) {
          item.key = '********';
        }
      });
    }
    
    logger.debug(`Anthropic Admin API ${operation} 成功:`, {
      status: response.status,
      data: sanitizedData
    });
  }

  /**
   * API呼び出しの実行
   * @param {string} method - HTTPメソッド
   * @param {string} endpoint - APIエンドポイント
   * @param {string} adminApiKey - Admin API Key
   * @param {Object} data - リクエストボディ
   * @returns {Promise<Object>} - API呼び出し結果
   */
  async _executeRequest(method, endpoint, adminApiKey, data = null) {
    try {
      const headers = this._getHeaders(adminApiKey);
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers,
        data: method !== 'GET' ? data : undefined
      };
      
      const response = await axios(config);
      this._logResponse(`${method} ${endpoint}`, response);
      return response.data;
    } catch (error) {
      this._logResponse(`${method} ${endpoint}`, null, error);
      throw this._formatError(error);
    }
  }

  /**
   * エラーオブジェクトのフォーマット
   * @param {Error} error - 元のエラーオブジェクト
   * @returns {Error} - フォーマットされたエラー
   */
  _formatError(error) {
    // APIからのエラーレスポンスがある場合
    if (error.response && error.response.data) {
      const apiError = new Error(error.response.data.error?.message || 'Anthropic API エラー');
      apiError.status = error.response.status;
      apiError.code = error.response.data.error?.type || 'api_error';
      apiError.details = error.response.data;
      return apiError;
    }
    
    // 接続エラーなどの場合
    const networkError = new Error(error.message || 'Anthropicとの通信エラー');
    networkError.code = error.code || 'network_error';
    return networkError;
  }

  /**
   * 組織メンバー一覧取得
   * @param {string} adminApiKey - Admin API Key
   * @param {number} limit - 取得件数制限
   * @returns {Promise<Object>} - 組織メンバーリスト
   */
  async listOrganizationMembers(adminApiKey, limit = 100) {
    return this._executeRequest('GET', `/organizations/users?limit=${limit}`, adminApiKey);
  }

  /**
   * メンバーの役割更新
   * @param {string} adminApiKey - Admin API Key
   * @param {string} userId - ユーザーID
   * @param {string} role - 新しい役割
   * @returns {Promise<Object>} - 更新結果
   */
  async updateMemberRole(adminApiKey, userId, role) {
    return this._executeRequest('POST', `/organizations/users/${userId}`, adminApiKey, { role });
  }

  /**
   * メンバー削除
   * @param {string} adminApiKey - Admin API Key
   * @param {string} userId - ユーザーID
   * @returns {Promise<Object>} - 削除結果
   */
  async removeMember(adminApiKey, userId) {
    return this._executeRequest('DELETE', `/organizations/users/${userId}`, adminApiKey);
  }

  /**
   * 組織への招待作成
   * @param {string} adminApiKey - Admin API Key
   * @param {string} email - 招待するメールアドレス
   * @param {string} role - 招待する役割
   * @returns {Promise<Object>} - 招待結果
   */
  async createInvite(adminApiKey, email, role) {
    return this._executeRequest('POST', '/organizations/invites', adminApiKey, { email, role });
  }

  /**
   * 招待一覧取得
   * @param {string} adminApiKey - Admin API Key
   * @param {number} limit - 取得件数制限
   * @returns {Promise<Object>} - 招待リスト
   */
  async listInvites(adminApiKey, limit = 100) {
    return this._executeRequest('GET', `/organizations/invites?limit=${limit}`, adminApiKey);
  }

  /**
   * 招待削除
   * @param {string} adminApiKey - Admin API Key
   * @param {string} inviteId - 招待ID
   * @returns {Promise<Object>} - 削除結果
   */
  async deleteInvite(adminApiKey, inviteId) {
    return this._executeRequest('DELETE', `/organizations/invites/${inviteId}`, adminApiKey);
  }

  /**
   * ワークスペース作成
   * @param {string} adminApiKey - Admin API Key
   * @param {string} name - ワークスペース名
   * @returns {Promise<Object>} - 作成結果
   */
  async createWorkspace(adminApiKey, name) {
    return this._executeRequest('POST', '/organizations/workspaces', adminApiKey, { name });
  }

  /**
   * ワークスペース一覧取得
   * @param {string} adminApiKey - Admin API Key
   * @param {boolean} includeArchived - アーカイブされたワークスペースも含めるか
   * @param {number} limit - 取得件数制限
   * @returns {Promise<Object>} - ワークスペースリスト
   */
  async listWorkspaces(adminApiKey, includeArchived = false, limit = 100) {
    return this._executeRequest('GET', `/organizations/workspaces?limit=${limit}&include_archived=${includeArchived}`, adminApiKey);
  }

  /**
   * ワークスペースをアーカイブ
   * @param {string} adminApiKey - Admin API Key
   * @param {string} workspaceId - ワークスペースID
   * @returns {Promise<Object>} - アーカイブ結果
   */
  async archiveWorkspace(adminApiKey, workspaceId) {
    return this._executeRequest('POST', `/organizations/workspaces/${workspaceId}/archive`, adminApiKey);
  }

  /**
   * ワークスペースにメンバー追加
   * @param {string} adminApiKey - Admin API Key
   * @param {string} workspaceId - ワークスペースID
   * @param {string} userId - ユーザーID
   * @param {string} role - 役割
   * @returns {Promise<Object>} - 追加結果
   */
  async addWorkspaceMember(adminApiKey, workspaceId, userId, role) {
    return this._executeRequest('POST', `/organizations/workspaces/${workspaceId}/members`, adminApiKey, {
      user_id: userId,
      workspace_role: role
    });
  }

  /**
   * ワークスペースメンバー一覧取得
   * @param {string} adminApiKey - Admin API Key
   * @param {string} workspaceId - ワークスペースID
   * @param {number} limit - 取得件数制限
   * @returns {Promise<Object>} - メンバーリスト
   */
  async listWorkspaceMembers(adminApiKey, workspaceId, limit = 100) {
    return this._executeRequest('GET', `/organizations/workspaces/${workspaceId}/members?limit=${limit}`, adminApiKey);
  }

  /**
   * ワークスペースメンバーの役割更新
   * @param {string} adminApiKey - Admin API Key
   * @param {string} workspaceId - ワークスペースID
   * @param {string} userId - ユーザーID
   * @param {string} role - 新しい役割
   * @returns {Promise<Object>} - 更新結果
   */
  async updateWorkspaceMemberRole(adminApiKey, workspaceId, userId, role) {
    return this._executeRequest('POST', `/organizations/workspaces/${workspaceId}/members/${userId}`, adminApiKey, {
      workspace_role: role
    });
  }

  /**
   * ワークスペースからメンバー削除
   * @param {string} adminApiKey - Admin API Key
   * @param {string} workspaceId - ワークスペースID
   * @param {string} userId - ユーザーID
   * @returns {Promise<Object>} - 削除結果
   */
  async removeWorkspaceMember(adminApiKey, workspaceId, userId) {
    return this._executeRequest('DELETE', `/organizations/workspaces/${workspaceId}/members/${userId}`, adminApiKey);
  }

  /**
   * APIキー一覧取得
   * @param {string} adminApiKey - Admin API Key
   * @param {string} workspaceId - ワークスペースID (オプション)
   * @param {string} status - ステータス ('active' or 'inactive')
   * @param {number} limit - 取得件数制限
   * @returns {Promise<Object>} - APIキーリスト
   */
  async listApiKeys(adminApiKey, workspaceId = null, status = 'active', limit = 100) {
    let url = `/organizations/api_keys?limit=${limit}&status=${status}`;
    if (workspaceId) {
      url += `&workspace_id=${workspaceId}`;
    }
    return this._executeRequest('GET', url, adminApiKey);
  }

  /**
   * APIキー更新
   * @param {string} adminApiKey - Admin API Key
   * @param {string} apiKeyId - APIキーID
   * @param {Object} updateData - 更新データ（status, nameなど）
   * @returns {Promise<Object>} - 更新結果
   */
  async updateApiKey(adminApiKey, apiKeyId, updateData) {
    return this._executeRequest('POST', `/organizations/api_keys/${apiKeyId}`, adminApiKey, updateData);
  }

  /**
   * Admin API Key暗号化
   * @param {string} adminApiKey - 暗号化するAdmin API Key
   * @param {string} secret - 暗号化に使用する秘密鍵
   * @returns {string} - 暗号化されたAPIキー
   */
  encryptAdminApiKey(adminApiKey, secret) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
      let encrypted = cipher.update(adminApiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return iv.toString('hex') + ':' + authTag + ':' + encrypted;
    } catch (error) {
      logger.error('Admin API Key暗号化エラー:', error);
      throw new Error('APIキーの暗号化に失敗しました');
    }
  }

  /**
   * Admin API Key復号化
   * @param {string} encryptedAdminApiKey - 暗号化されたAdmin API Key
   * @param {string} secret - 復号化に使用する秘密鍵
   * @returns {string} - 復号化されたAPIキー
   */
  decryptAdminApiKey(encryptedAdminApiKey, secret) {
    try {
      const parts = encryptedAdminApiKey.split(':');
      if (parts.length !== 3) {
        throw new Error('暗号化されたAPIキーの形式が無効です');
      }
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      logger.error('Admin API Key復号化エラー:', error);
      throw new Error('APIキーの復号化に失敗しました');
    }
  }

  /**
   * 組織のワークスペースを同期
   * @param {mongoose.Types.ObjectId} organizationId - 組織ID
   * @param {string} adminApiKey - Admin API Key
   * @returns {Promise<Array>} - 同期結果
   */
  async syncOrganizationWorkspaces(organizationId, adminApiKey) {
    try {
      // 組織情報を取得
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('組織情報が見つかりません');
      }

      // Admin APIキーのチェック
      if (!adminApiKey) {
        throw new Error('Admin APIキーが指定されていません');
      }

      // Anthropicからワークスペース一覧を取得
      const workspaces = await this.listWorkspaces(adminApiKey);
      if (!workspaces.data) {
        return [];
      }

      // データベースとAnthropicのワークスペースを同期
      const syncResults = [];
      for (const anthropicWorkspace of workspaces.data) {
        // 既存のワークスペースを検索
        let workspace = await Workspace.findOne({
          organizationId,
          anthropicWorkspaceId: anthropicWorkspace.id
        });

        if (workspace) {
          // 既存ワークスペースの更新
          workspace.name = anthropicWorkspace.name;
          workspace.isArchived = anthropicWorkspace.is_archived || false;
          await workspace.save();
          syncResults.push({
            id: workspace._id,
            anthropicId: anthropicWorkspace.id,
            name: workspace.name,
            action: 'updated'
          });
        } else {
          // 新規ワークスペースの作成
          workspace = new Workspace({
            name: anthropicWorkspace.name,
            organizationId,
            anthropicWorkspaceId: anthropicWorkspace.id,
            isArchived: anthropicWorkspace.is_archived || false,
            monthlyBudget: organization.monthlyBudget / 2, // デフォルトは組織予算の半分
            members: []
          });
          await workspace.save();
          syncResults.push({
            id: workspace._id,
            anthropicId: anthropicWorkspace.id,
            name: workspace.name,
            action: 'created'
          });
        }
      }

      return syncResults;
    } catch (error) {
      logger.error('ワークスペース同期エラー:', error);
      throw error;
    }
  }

  /**
   * 組織のAPIキーを同期
   * @param {mongoose.Types.ObjectId} organizationId - 組織ID
   * @param {string} adminApiKey - Admin API Key
   * @returns {Promise<Array>} - 同期結果
   */
  async syncOrganizationApiKeys(organizationId, adminApiKey) {
    try {
      // 組織情報を取得
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error('組織情報が見つかりません');
      }

      // Admin APIキーのチェック
      if (!adminApiKey) {
        throw new Error('Admin APIキーが指定されていません');
      }

      // AnthropicからワークスペースとそれぞれのワークスペースのAPIキーを取得
      const workspaces = await Workspace.find({ organizationId });
      const syncResults = [];

      // デフォルトワークスペースのAPIキーを同期
      const defaultApiKeys = await this.listApiKeys(adminApiKey, null);
      if (defaultApiKeys.data && defaultApiKeys.data.length > 0) {
        // 組織のデフォルトAPIキーを更新
        if (!organization.apiKey && defaultApiKeys.data[0].status === 'active') {
          organization.apiKey = defaultApiKeys.data[0].id;
          await organization.save();
          syncResults.push({
            workspace: 'default',
            apiKeyId: defaultApiKeys.data[0].id,
            name: defaultApiKeys.data[0].name,
            action: 'updated_organization'
          });
        }
      }

      // ワークスペースごとのAPIキーを同期
      for (const workspace of workspaces) {
        if (!workspace.anthropicWorkspaceId) continue;
        
        const apiKeys = await this.listApiKeys(adminApiKey, workspace.anthropicWorkspaceId);
        if (!apiKeys.data || apiKeys.data.length === 0) continue;

        // 最初のアクティブなAPIキーを使用
        const activeKey = apiKeys.data.find(k => k.status === 'active');
        if (!activeKey) continue;

        // ワークスペースのAPIキー情報を更新
        if (!workspace.apiKey || !workspace.apiKey.keyId || workspace.apiKey.keyId !== activeKey.id) {
          workspace.apiKey = {
            keyId: activeKey.id,
            name: activeKey.name,
            status: activeKey.status,
            createdAt: new Date(activeKey.created_at)
          };
          await workspace.save();
          syncResults.push({
            workspace: workspace.name,
            workspaceId: workspace._id,
            apiKeyId: activeKey.id,
            name: activeKey.name,
            action: 'updated_workspace'
          });
        }
      }

      return syncResults;
    } catch (error) {
      logger.error('APIキー同期エラー:', error);
      throw error;
    }
  }
}

module.exports = new AnthropicAdminService();