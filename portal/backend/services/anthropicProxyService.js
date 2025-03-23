/**
 * Anthropic APIプロキシサービス
 * 
 * 組織/ワークスペース単位でのAPI呼び出しをサポートします。
 * テスト用モードでは実際のAPIコールではなく、モックレスポンスを返します。
 */
const apiUsageService = require('./apiUsageService');
const axios = require('axios');
const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const Workspace = require('../models/workspace.model');
const anthropicAdminService = require('./anthropicAdminService');
const logger = require('../utils/logger');

// テスト用に簡略化したトークン計算
function getTokenCount(text) {
  if (!text) return 0;
  // 簡易推定（文字数の1/4程度がトークン数）
  return Math.ceil((text?.length || 0) / 4);
}

/**
 * ユーザーの組織とワークスペース情報を取得
 * @param {String} userId - ユーザーID
 * @returns {Promise<Object>} 組織とワークスペース情報
 */
async function getUserContext(userId) {
  try {
    // ユーザー情報を取得
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }
    
    // ユーザーの所属組織情報
    let organization = null;
    let workspace = null;
    
    // プライマリ組織ID
    const primaryOrgId = user.organizations?.primary;
    if (primaryOrgId) {
      organization = await Organization.findById(primaryOrgId);
      
      // プライマリワークスペース
      const primaryWsId = user.organizations?.primaryWorkspace;
      if (primaryWsId) {
        workspace = await Workspace.findById(primaryWsId);
      } else {
        // デフォルトワークスペース（組織の最初のワークスペース）を探す
        workspace = await Workspace.findOne({ 
          organizationId: primaryOrgId, 
          isArchived: { $ne: true } 
        });
      }
    } else {
      // 組織の所属がない場合は所属していない組織の中から探す
      const orgs = await Organization.find({ 'members.userId': userId });
      if (orgs.length > 0) {
        organization = orgs[0];
        
        // ワークスペースを探す
        workspace = await Workspace.findOne({ 
          organizationId: organization._id,
          isArchived: { $ne: true }
        });
      }
    }
    
    return { user, organization, workspace };
  } catch (error) {
    logger.error('ユーザーコンテキスト取得エラー:', error);
    throw error;
  }
}

/**
 * API呼び出し用の適切なAPIキーを取得
 * @param {Object} context - ユーザーコンテキスト
 * @returns {Promise<String>} APIキー
 */
async function getApiKey(context) {
  const { organization, workspace } = context;
  
  // テストモードの場合は環境変数のAPIキーを使用
  if (process.env.USE_MOCK_RESPONSES === 'true') {
    return process.env.ANTHROPIC_API_KEY || 'sk-ant-mock-key';
  }
  
  try {
    // 1. ワークスペースのAPIキーを優先
    if (workspace && workspace.apiKey && workspace.apiKey.keyId && workspace.apiKey.status === 'active') {
      // ワークスペースの実際のAPIキーを取得（通常はAnthropicから取得する必要があるが、
      // Admin APIキーからワークスペースキーの取得が可能なケースを想定）
      // 本実装では、キーIDしか持っていないため、組織のAPIキーにフォールバック
    }
    
    // 2. 組織のAPIキーを使用
    if (organization && organization.apiKey) {
      return organization.apiKey;
    }
    
    // 3. デフォルトのAPIキーを使用
    return process.env.ANTHROPIC_API_KEY;
  } catch (error) {
    logger.error('APIキー取得エラー:', error);
    // デフォルトのAPIキーにフォールバック
    return process.env.ANTHROPIC_API_KEY;
  }
}

/**
 * ClaudeのChat APIをプロキシ
 * @param {String} userId - ユーザーID
 * @param {Object} requestData - リクエストデータ
 * @param {Object} options - オプション
 * @returns {Promise<Object>} APIレスポンス
 */
exports.proxyClaudeChat = async (userId, requestData, options = {}) => {
  const endpoint = '/v1/messages';
  let organizationId = null;
  let workspaceId = null;
  
  try {
    // ユーザーの組織とワークスペース情報を取得
    const context = await getUserContext(userId);
    organizationId = context.organization?._id;
    workspaceId = context.workspace?._id;
    
    // プロジェクトIDの抽出
    const projectId = options.projectId || null;
    
    // 入力トークン数を推定
    const inputTokens = Math.ceil((JSON.stringify(requestData).length || 0) / 4);
    
    // テストモードかどうかチェック
    const isTestMode = process.env.USE_MOCK_RESPONSES === 'true';
    
    if (isTestMode) {
      console.log(`[TEST] Anthropicプロキシ: Chat APIリクエスト - ユーザーID: ${userId}`);
      
      // モックレスポンス
      const mockResponse = {
        id: 'msg_' + Math.random().toString(36).substring(2, 15),
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'これはテスト応答です。実際のAPI呼び出しは行われていません。'
          }
        ],
        model: requestData.model || 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: inputTokens,
          output_tokens: 25
        }
      };
      
      // 出力トークン数
      const outputTokens = 25;
      
      // API使用量を記録
      await apiUsageService.recordUsage(userId, {
        apiType: 'chat',
        endpoint,
        inputTokens,
        outputTokens,
        success: true,
        requestData: {
          model: requestData.model,
          promptPreview: 'テストプロンプト'
        },
        projectId,
        organizationId,
        workspaceId,
        metadata: {
          responseTime: 100,
          model: requestData.model,
          ...options.metadata
        }
      });
      
      console.log(`[TEST] Anthropicプロキシ: Chat APIレスポンス成功 - トークン使用: 入力=${inputTokens}, 出力=${outputTokens}`);
      
      // レスポンスにトークン使用量を追加
      return {
        ...mockResponse,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens
        }
      };
    } else {
      // 実際のAPI呼び出し
      const apiKey = await getApiKey(context);
      
      if (!apiKey) {
        throw new Error('有効なAPIキーが見つかりません');
      }
      
      const response = await axios({
        method: 'POST',
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey
        },
        data: requestData
      });
      
      // API使用量を記録
      const responseData = response.data;
      const outputTokens = responseData.usage?.output_tokens || 0;
      
      await apiUsageService.recordUsage(userId, {
        apiType: 'chat',
        endpoint,
        inputTokens,
        outputTokens,
        success: true,
        requestData: {
          model: requestData.model,
          promptPreview: requestData.messages && requestData.messages.length > 0 
            ? requestData.messages[0].content.substring(0, 50) + '...' 
            : 'No preview'
        },
        projectId,
        organizationId,
        workspaceId,
        metadata: {
          responseTime: Date.now() - options.startTime || 0,
          model: requestData.model,
          ...options.metadata
        }
      });
      
      return responseData;
    }
  } catch (error) {
    logger.error('[Anthropicプロキシエラー (Chat API)]:', error);
    
    // API使用量を記録（エラー時）
    await apiUsageService.recordUsage(userId, {
      apiType: 'chat',
      endpoint,
      inputTokens: Math.ceil((JSON.stringify(requestData).length || 0) / 4),
      outputTokens: 0,
      success: false,
      errorCode: error.response?.status || '500',
      errorMessage: error.message,
      projectId: options.projectId || null,
      organizationId,
      workspaceId,
      metadata: options.metadata
    });
    
    // エラーを再スロー
    throw {
      statusCode: error.response?.status || 500,
      message: error.response?.data?.error?.message || error.message,
      error: error.response?.data || error
    };
  }
};

/**
 * ClaudeのCompletions APIをプロキシ
 * @param {String} userId - ユーザーID
 * @param {Object} requestData - リクエストデータ
 * @param {Object} options - オプション
 * @returns {Promise<Object>} APIレスポンス
 */
exports.proxyClaudeCompletions = async (userId, requestData, options = {}) => {
  const endpoint = '/v1/complete';
  let organizationId = null;
  let workspaceId = null;
  
  try {
    // ユーザーの組織とワークスペース情報を取得
    const context = await getUserContext(userId);
    organizationId = context.organization?._id;
    workspaceId = context.workspace?._id;
    
    // 入力トークン数を推定
    const inputTokens = Math.ceil((JSON.stringify(requestData).length || 0) / 4);
    
    // プロジェクトIDの抽出
    const projectId = options.projectId || null;
    
    // テストモードかどうかチェック
    const isTestMode = process.env.USE_MOCK_RESPONSES === 'true';
    
    if (isTestMode) {
      console.log(`[TEST] Anthropicプロキシ: Completions APIリクエスト - ユーザーID: ${userId}`);
      
      // モックレスポンス
      const mockResponse = {
        id: 'compl_' + Math.random().toString(36).substring(2, 15),
        type: 'completion',
        completion: 'これはテスト補完です。実際のAPI呼び出しは行われていません。',
        model: requestData.model || 'claude-3-haiku-20240307',
        stop_reason: 'stop_sequence',
        usage: {
          input_tokens: inputTokens,
          output_tokens: 20
        }
      };
      
      // 出力トークン数
      const outputTokens = 20;
      
      // API使用量を記録
      await apiUsageService.recordUsage(userId, {
        apiType: 'completions',
        endpoint,
        inputTokens,
        outputTokens,
        success: true,
        requestData: {
          model: requestData.model,
          promptPreview: 'テストプロンプト'
        },
        projectId,
        organizationId,
        workspaceId,
        metadata: {
          responseTime: 100,
          model: requestData.model,
          ...options.metadata
        }
      });
      
      console.log(`[TEST] Anthropicプロキシ: Completions APIレスポンス成功 - トークン使用: 入力=${inputTokens}, 出力=${outputTokens}`);
      
      // レスポンスにトークン使用量を追加
      return {
        ...mockResponse,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens
        }
      };
    } else {
      // 実際のAPI呼び出し
      const apiKey = await getApiKey(context);
      
      if (!apiKey) {
        throw new Error('有効なAPIキーが見つかりません');
      }
      
      const response = await axios({
        method: 'POST',
        url: 'https://api.anthropic.com/v1/complete',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': apiKey
        },
        data: requestData
      });
      
      // API使用量を記録
      const responseData = response.data;
      const outputTokens = responseData.usage?.output_tokens || 0;
      
      await apiUsageService.recordUsage(userId, {
        apiType: 'completions',
        endpoint,
        inputTokens,
        outputTokens,
        success: true,
        requestData: {
          model: requestData.model,
          promptPreview: requestData.prompt ? requestData.prompt.substring(0, 50) + '...' : 'No preview'
        },
        projectId,
        organizationId,
        workspaceId,
        metadata: {
          responseTime: Date.now() - options.startTime || 0,
          model: requestData.model,
          ...options.metadata
        }
      });
      
      return responseData;
    }
  } catch (error) {
    logger.error('[Anthropicプロキシエラー (Completions API)]:', error);
    
    // API使用量を記録（エラー時）
    await apiUsageService.recordUsage(userId, {
      apiType: 'completions',
      endpoint,
      inputTokens: Math.ceil((JSON.stringify(requestData).length || 0) / 4),
      outputTokens: 0,
      success: false,
      errorCode: error.response?.status || '500',
      errorMessage: error.message,
      projectId: options.projectId || null,
      organizationId,
      workspaceId,
      metadata: options.metadata
    });
    
    // エラーを再スロー
    throw {
      statusCode: error.response?.status || 500,
      message: error.response?.data?.error?.message || error.message,
      error: error.response?.data || error
    };
  }
};