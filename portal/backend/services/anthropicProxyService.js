/**
 * Anthropic APIプロキシサービス (テスト用簡略版)
 * 
 * このファイルはテスト目的のためのモックです。
 * 実際のAPIコールではなく、単純にモックレスポンスを返します。
 */
const apiUsageService = require('./apiUsageService');

// テスト用に簡略化したトークン計算
function getTokenCount(text) {
  if (!text) return 0;
  // 簡易推定（文字数の1/4程度がトークン数）
  return Math.ceil((text?.length || 0) / 4);
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
  
  try {
    // 入力トークン数を推定
    const inputTokens = Math.ceil((JSON.stringify(requestData).length || 0) / 4);
    
    // プロジェクトIDの抽出
    const projectId = options.projectId || null;
    
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
  } catch (error) {
    console.error('[TEST] Anthropicプロキシエラー (Chat API):', error);
    
    // API使用量を記録（エラー時）
    await apiUsageService.recordUsage(userId, {
      apiType: 'chat',
      endpoint,
      inputTokens: Math.ceil((JSON.stringify(requestData).length || 0) / 4),
      outputTokens: 0,
      success: false,
      errorCode: '500',
      errorMessage: error.message,
      projectId: options.projectId || null,
      metadata: options.metadata
    });
    
    // エラーを再スロー
    throw {
      statusCode: 500,
      message: error.message,
      error: error
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
  
  try {
    // 入力トークン数を推定
    const inputTokens = Math.ceil((JSON.stringify(requestData).length || 0) / 4);
    
    // プロジェクトIDの抽出
    const projectId = options.projectId || null;
    
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
  } catch (error) {
    console.error('[TEST] Anthropicプロキシエラー (Completions API):', error);
    
    // API使用量を記録（エラー時）
    await apiUsageService.recordUsage(userId, {
      apiType: 'completions',
      endpoint,
      inputTokens: Math.ceil((JSON.stringify(requestData).length || 0) / 4),
      outputTokens: 0,
      success: false,
      errorCode: '500',
      errorMessage: error.message,
      projectId: options.projectId || null,
      metadata: options.metadata
    });
    
    // エラーを再スロー
    throw {
      statusCode: 500,
      message: error.message,
      error: error
    };
  }
};