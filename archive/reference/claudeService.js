const Anthropic = require('@anthropic-ai/sdk');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TokenUsageService = require('../tokenManagement/services/tokenUsageService'); 
const axios = require('axios');  // ファイルの先頭に追加
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
class ClaudeService {
  async streamResponse(payload, onChunk) {
    const maxRetries = 2;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {

       
        const { systemMessage, messages } = this.formatMessages(payload.messages);
        try {
          if (payload.userId) {
            console.log('[DEBUG] Token count request:', {
              userId: payload.userId,
              messages: messages,
              systemMessage: systemMessage
            });
        
            const response = await axios.post('https://api.anthropic.com/v1/messages/count_tokens', 
              {
                model: "claude-3-7-sonnet-20250219",
                messages: messages,
                system: systemMessage
              },
              {
                headers: {
                  'x-api-key': ANTHROPIC_API_KEY,
                  'anthropic-version': '2023-06-01',
                  'anthropic-beta': 'token-counting-2024-11-01',
                  'content-type': 'application/json'
                }
              }
            );
        
            console.log('[DEBUG] Token count response:', {
              statusCode: response.status,
              data: response.data
            });
        
            await TokenUsageService.updateTokenUsage(payload.userId, response.data.input_tokens);
          }
        } catch (error) {
          console.error('Failed to count or update tokens:', error);
          console.error('Error details:', {
            message: error.message,
            response: error.response?.data
          });
        }

    // APIリクエストパラメータを準備
    const requestParams = {
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 40000,  // max_tokensはthinking.budget_tokensより大きくする必要がある
      stream: true,
      system: systemMessage,
      messages: messages,
      tools: payload.tools,
      tool_choice: payload.tool_choice
    };

    // 拡張思考機能が有効な場合はパラメータを追加
    if (payload.enhancedThinking) {
      // 公式ドキュメントに基づく正しい形式
      requestParams.thinking = {
        type: "enabled",
        budget_tokens: 32000  // トークン予算を増やす
      };
      
      console.log('[DEBUG] 拡張思考モードが有効です。パラメータ:', JSON.stringify(requestParams, null, 2));
    } else {
      console.log('[DEBUG] 通常モードで実行します。パラメータ:', JSON.stringify(requestParams, null, 2));
    }

    console.log('[DEBUG] Claude API リクエスト開始...');
    const stream = await anthropic.messages.stream(requestParams);
    console.log('[DEBUG] Claude API ストリーム接続成功');

    let currentBlock = null;

    for await (const chunk of stream) {
          switch (chunk.type) {
            case 'message_start':
              break;
            
            case 'content_block_start':
              console.log('[DEBUG] ブロック開始:', chunk.content_block.type);
              currentBlock = {
                type: chunk.content_block.type,
                content: chunk.content_block.type === 'text' ? '' : {}
              };
              // 思考ブロックが開始された場合
              if (chunk.content_block.type === 'thinking') {
                console.log('[DEBUG] 思考ブロック開始');
                // 思考ブロックの開始を表示する
                onChunk('\n----- 思考プロセス開始 -----\n');
              }
              break;
            
            case 'content_block_delta':
              try {
                console.log('[DEBUG] チャンク全体:', JSON.stringify(chunk, null, 2));
                // deltaプロパティがあるか確認
                if (!chunk.delta) {
                  console.log('[DEBUG] deltaプロパティがありません');
                  break;
                }
                
                console.log('[DEBUG] チャンクタイプ:', chunk.delta.type);
                
                if (chunk.delta.type === 'text_delta') {
                  onChunk(chunk.delta.text || '');
                  console.log('[DEBUG] テキストチャンク:', chunk.delta.text);
                } else if (chunk.delta.type === 'input_json_delta') {
                  Object.assign(currentBlock.content, JSON.parse(chunk.delta.partial_json || '{}'));
                  console.log('[DEBUG] JSONチャンク:', chunk.delta.partial_json);
                } else if (chunk.delta.type === 'thinking_delta') {
                  console.log('[DEBUG] 思考チャンク:', chunk.delta.thinking);
                  // 思考チャンクを表示する (絵文字なし)
                  onChunk(chunk.delta.thinking || '');
                } else {
                  console.log('[DEBUG] 未知のチャンクタイプ:', chunk.delta.type);
                }
              } catch (error) {
                console.error('[ERROR] チャンク処理エラー:', error);
                console.log('[DEBUG] エラーチャンク:', JSON.stringify(chunk, null, 2));
              }
              break;
            
            case 'content_block_stop':
              console.log('[DEBUG] ブロック終了:', currentBlock?.type);
              // 思考ブロックが終了した場合
              if (currentBlock?.type === 'thinking') {
                console.log('[DEBUG] 思考ブロック終了');
                // 思考ブロックの終了を表示する
                onChunk('\n----- 思考プロセス終了 -----\n\n');
              }
              currentBlock = null;
              break;
            
            case 'error':
              if (chunk.error?.type === 'error') {
                console.error('Stream error:', chunk.error.error);
                throw new Error(chunk.error.error.message);
              }
              throw new Error('Unknown stream error');
              
            case 'ping':
              break;
          }
        }
        
        break;

      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);
        
        if (retryCount === maxRetries) {
          console.error('All retry attempts failed');
          throw error;
        }
        
        retryCount++;
        console.log(`Retrying in ${retryCount} seconds...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  async getResponse(payload) {
    try {
      const { systemMessage, messages } = this.formatMessages(payload.messages);
      
      // APIリクエストパラメータを準備
      const requestParams = {
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 40000,  // max_tokensはthinking.budget_tokensより大きくする必要がある
        system: systemMessage,
        messages: messages,
        tools: payload.tools,
        tool_choice: payload.tool_choice
      };

      // 拡張思考機能が有効な場合はパラメータを追加
      if (payload.enhancedThinking) {
        // 公式ドキュメントに基づく正しい形式
        requestParams.thinking = {
          type: "enabled",
          budget_tokens: 32000  // トークン予算を増やす
        };
        
        console.log('[DEBUG] getResponse: 拡張思考モードが有効です。パラメータ:', JSON.stringify(requestParams, null, 2));
      }
      
      const response = await anthropic.messages.create(requestParams);
      return response;
    } catch (error) {
      console.error('Error in getResponse:', error);
      throw error;
    }
  }

  formatMessages(messages) {
    let systemMessage = '';
    const formattedMessages = messages.filter(msg => {
      if (msg.role === 'system') {
        systemMessage = Array.isArray(msg.content) 
          ? msg.content.map(item => item?.text || '').join('\n')
          : msg.content;
        return false;
      }
      return true;
    }).map(msg => {
      if (Array.isArray(msg.content)) {
        const formattedContent = msg.content.map(item => {
          if (!item) return null;
  
          switch (item.type) {
            case 'text':
              // テキストが空白のみの場合はnullを返す
              return item.text?.trim() ? { type: 'text', text: item.text } : null;
            case 'image':
              if (!item.source?.data) {
                console.warn('Image data is missing, skipping image content');
                return null;
              }
              return {
                type: 'image',
                source: {
                  type: item.source.type || 'base64',
                  media_type: item.source.media_type || 'image/jpeg',
                  data: item.source.data
                }
              };
            case 'tool_use':
              return {
                type: 'tool_use',
                tool_call: {
                  name: item.tool_call?.name || '',
                  input: item.tool_call?.input || {}
                }
              };
            default:
              return { type: 'text', text: String(item) };
          }
        }).filter(Boolean); // 空のコンテンツを除去
  
        // コンテンツが完全に空の場合はスキップ
        if (formattedContent.length === 0) {
          return null;
        }
  
        return {
          role: msg.role,
          content: formattedContent
        };
      } else {
        // テキストが空白のみの場合はnullを返す
        if (!msg.content?.trim()) {
          return null;
        }
  
        return {
          role: msg.role,
          content: [{ type: 'text', text: msg.content }]
        };
      }
    }).filter(Boolean); // nullのメッセージを除去
  
    const result = { systemMessage, messages: formattedMessages };
    console.log('[DEBUG] Actual messages to Claude:', JSON.stringify({
      system: systemMessage,
      messages: formattedMessages
    }, null, 2));
    return result;
  }




}

module.exports = new ClaudeService();