"use strict";

const contextManager = require('../utils/contextManager');
const systemConfig = require('../config/systemConfig');
const Prompt = require('../models/promptModel');
const UserPrompt = require('../models/userPromptModel'); // 追加
const claudeService = require('../aiService/claudeService');
const ConversationPersistenceService = require('./conversationPersistenceService');
const fileContentStorage = require('../fileUploader/utils/fileContentStorage');

class ChatService {
  constructor() {
  }
  
async getConversation(conversationId) {
  console.log(`[DEBUG] Getting conversation: ${conversationId}`);
  try {
    const conversation = await ConversationPersistenceService.getConversation(conversationId);
    if (!conversation) {
      console.log(`[DEBUG] Conversation not found: ${conversationId}`);
      throw new Error('Conversation not found');
    }
    console.log(`[DEBUG] Conversation found: ${conversationId}`);
    return conversation;
  } catch (error) {
    console.error(`[ERROR] Failed to get conversation ${conversationId}:`, error);
    throw error;
  }
}

  async getConversationMessages(conversationId) {
    const conversation = await ConversationPersistenceService.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    return conversation.messages;
  }

  async initializeConversation(userId, promptId) {
    console.log(`[DEBUG] Initializing conversation for userId: ${userId}, promptId: ${promptId}`);
    
    // プロンプトの検索（UserPromptとPromptの両方を確認）
    let prompt;
    try {
      // まずUserPromptを確認
      prompt = await UserPrompt.findOne({
        _id: promptId,
        createdBy: userId
      });

      // UserPromptで見つからなければ、一般的なPromptを確認
      if (!prompt) {
        console.log('[DEBUG] User prompt not found, checking system prompts');
        prompt = await Prompt.findById(promptId);
      }

      if (!prompt) {
        console.log('[ERROR] No prompt found in either user or system prompts');
        throw new Error('Prompt not found');
      }
    } catch (error) {
      console.error('[ERROR] Failed to find prompt:', error);
      throw new Error('Prompt not found');
    }

    const existingConversation = await ConversationPersistenceService.getActiveConversation(userId, promptId);
    
    if (existingConversation) {
      console.log(`[DEBUG] Existing conversation found: ${existingConversation.conversationId}`);
      console.log(`[DEBUG] Existing conversation messages:`, existingConversation.messages);
      
      if (existingConversation.messages.length === 0 && existingConversation.initialConversation) {
        console.log(`[DEBUG] Adding initial message to existing conversation`);
        await ConversationPersistenceService.addMessage(existingConversation.conversationId, {
          role: 'assistant',
          content: [{ type: 'text', text: existingConversation.initialConversation }]
        });
        
        const updatedConversation = await ConversationPersistenceService.getConversation(existingConversation.conversationId);
        
        return { 
          conversationId: existingConversation.conversationId, 
          initialMessage: existingConversation.initialConversation,
          messages: updatedConversation.messages,
          isNewConversation: false
        };
      }
      
      return { 
        conversationId: existingConversation.conversationId, 
        initialMessage: existingConversation.initialConversation,
        messages: existingConversation.messages,
        isNewConversation: false
      };
    }

    let knowledgeBaseInfo = '';
    // TODO: KnowledgeBase実装時にコメントアウトを解除
    /*
    if (prompt.knowledgeBaseReferences && prompt.knowledgeBaseReferences.length > 0) {
      knowledgeBaseInfo = prompt.knowledgeBaseReferences
        .map(kb => kb.content)
        .join('\n\n');
    }
    */

    const conversationData = {
      userId,
      promptId,
      systemMessage: prompt.systemMessage,
      userFixedContext: prompt.fixedContext + '\n\n' + knowledgeBaseInfo,
      initialConversation: prompt.initialConversation,
      enhancedThinking: prompt.enhancedThinking || false
    };

    const savedConversation = await ConversationPersistenceService.createConversation(conversationData);
    console.log(`[DEBUG] New conversation created: ${savedConversation.conversationId}`);

    await contextManager.addToContext(savedConversation.conversationId, {
      role: 'system',
      content: prompt.systemMessage
    }, true);
    console.log(`[DEBUG] System message added to context: ${prompt.systemMessage}`);

    await contextManager.addToContext(savedConversation.conversationId, {
      role: 'user',
      content: prompt.fixedContext + '\n\n' + knowledgeBaseInfo
    }, true);
    console.log(`[DEBUG] User fixed context added to context: ${prompt.fixedContext + '\n\n' + knowledgeBaseInfo}`);

    let initialMessages = [];
    if (prompt.initialConversation) {
      await ConversationPersistenceService.addMessage(savedConversation.conversationId, {
        role: 'assistant',
        content: [{ type: 'text', text: prompt.initialConversation }]
      });
      console.log(`[DEBUG] Initial message added as assistant message: ${prompt.initialConversation}`);
      
      initialMessages = [{
        role: 'assistant',
        content: [{ type: 'text', text: prompt.initialConversation }]
      }];
    }

    return { 
      conversationId: savedConversation.conversationId, 
      initialMessage: prompt.initialConversation,
      messages: initialMessages,
      isNewConversation: true
    };
  }

  async sendMessageStreaming(message, conversationId, sendChunk, uploadId = null) {
    try {
      const conversation = await ConversationPersistenceService.getConversation(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
  
      let fullContent = [];
      let hasFileContent = false;
  
      // ファイル処理部分（このままでOK）
      if (uploadId) {
        const normalizedUploadIds = Array.isArray(uploadId) ? uploadId : [uploadId];
        for (const id of normalizedUploadIds) {
          try {
            if (!id) continue;
            const uploadedFileData = await fileContentStorage.getFileContent(id);
            if (uploadedFileData) {
              hasFileContent = true;
              const content = this.processFileContent(uploadedFileData);
              if (content) {
                fullContent.push(content);
              }
            }
          } catch (error) {
            console.error(`[ERROR] Failed to process uploadId ${id}:`, error);
          }
        }
      }
  
      if (!hasFileContent && (!message || message.trim().length === 0)) {
        throw new Error('メッセージを入力してください。');
      }
  
      if (message?.trim()) {
        fullContent.push({
          type: 'text',
          text: message
        });
      }
  
      const userMessage = {
        role: 'user',
        content: fullContent
      };
  
      const baseMessages = await contextManager.getMessagesForAI(conversationId);
      const messagesForAI = [...baseMessages, userMessage];
  
      await ConversationPersistenceService.addMessage(conversationId, userMessage);
      contextManager.addMessage(conversationId, userMessage);
  
      let accumulatedResponse = '';
  
      console.log('[DEBUG] 拡張思考設定:', conversation.enhancedThinking ? '有効' : '無効');
      
      await claudeService.streamResponse({
        messages: messagesForAI,
        userId: conversation.userId,
        enhancedThinking: conversation.enhancedThinking || false
      }, (chunk) => {
        if (chunk?.trim()) {
          accumulatedResponse += chunk;
          // 整形処理を削除し、生のチャンクを送信
          sendChunk(chunk);
          console.log('[DEBUG] チャンク送信:', chunk.substring(0, 50) + (chunk.length > 50 ? '...' : ''));
        }
      });
  
      if (accumulatedResponse) {
        const assistantMessage = {
          role: 'assistant',
          content: [{ 
            type: 'text', 
            text: accumulatedResponse, // 整形せずに生のテキストを保存
            isFinal: true
          }]
        };
  
        await ConversationPersistenceService.addMessage(conversationId, assistantMessage);
        contextManager.addMessage(conversationId, assistantMessage);
  
        // finalResponseも整形せずに送信
        sendChunk({
          type: 'finalResponse',
          content: accumulatedResponse,
          metadata: {
            messageId: assistantMessage.id,
            timestamp: new Date().toISOString()
          }
        });
      }
  
    } catch (error) {
      console.error('[ERROR] Failed to process AI response:', error);
      this.handleStreamingError(conversationId, sendChunk);
    }
  }
  

async handleStreamingError(conversationId, sendChunk) {
    console.log('[DEBUG] Handling streaming error for conversation:', conversationId);
    
    const errorMessage = "申し訳ありません。エラーが発生しました。もう一度お試しください。";
    
    try {
        // エラーメッセージをユーザーに送信
        sendChunk(errorMessage);
        
        // エラーメッセージを会話履歴に保存
        const errorAssistantMessage = {
            role: 'assistant',
            content: [{ type: 'text', text: errorMessage }]
        };
        await ConversationPersistenceService.addMessage(conversationId, errorAssistantMessage);
        contextManager.addMessage(conversationId, errorAssistantMessage);
        
        console.log('[DEBUG] Error message handled and saved for conversation:', conversationId);
    } catch (error) {
        console.error('[ERROR] Failed to handle streaming error:', error);
        //最低限のエラーメッセージは必ず送信
        sendChunk("システムエラーが発生しました。");
    }
}

processFileContent(uploadedFileData) {
  if (!uploadedFileData || !uploadedFileData.fileType) {
    console.warn('[WARN] Invalid file data received in processFileContent');
    return null;
  }

  try {
    const metadata = uploadedFileData.metadata || {};
    const filename = metadata.filename || metadata.originalFilename || 'Unknown file';

    switch (uploadedFileData.fileType.toLowerCase()) {
      case 'pdf': {
        if (!uploadedFileData.content) {
          console.warn('[WARN] PDF content is missing');
          return null;
        }

        console.log('Processing PDF content:', {
          filename,
          hasContent: !!uploadedFileData.content,
          metadataKeys: Object.keys(metadata)
        });

        // Claude APIの仕様に従ったPDFデータの形式
        return {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: uploadedFileData.content
          },
          metadata: {
            ...metadata,
            filename: filename,
            fileType: 'pdf',
            pageCount: metadata.pageCount || 1,
            processedAt: new Date().toISOString()
          }
        };
      }

      case 'image': {
        if (uploadedFileData.content) {
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: metadata.mimeType || 'image/webp',
              data: uploadedFileData.content
            },
            metadata: metadata
          };
        }
        return null;
      }

      case 'json': 
      case 'code': 
      case 'text': 
      case 'markdown':
      case 'default': {
        if (!uploadedFileData.content) {
          return null;
        }

        let processedContent = uploadedFileData.content;
        let fileTypeLabel = uploadedFileData.fileType.toUpperCase();
        
        // 各タイプに応じたコンテンツ処理
        if (uploadedFileData.fileType === 'text') {
          processedContent = processedContent.replace(/<text>([\s\S]*?)<\/text>/g, '$1').trim();
        } else if (uploadedFileData.fileType === 'code') {
          const language = (metadata.language || 'plaintext').toLowerCase();
          processedContent = processedContent.replace(/<code.*?>([\s\S]*?)<\/code>/g, '$1').trim();
          processedContent = `\`\`\`${language}\n${processedContent}\n\`\`\``;
        } else if (uploadedFileData.fileType === 'json') {
          try {
            processedContent = processedContent.replace(/<json>([\s\S]*?)<\/json>/g, '$1').trim();
            const parsedJson = JSON.parse(processedContent);
            processedContent = `\`\`\`json\n${JSON.stringify(parsedJson, null, 2)}\n\`\`\``;
          } catch {
            processedContent = `\`\`\`json\n${processedContent}\n\`\`\``;
          }
        }
        
        console.log('Processing text content:', {
          fileType: uploadedFileData.fileType,
          filename,
          contentLength: processedContent.length
        });

        return {
          type: 'text',
          text: `File: ${filename}\n${fileTypeLabel} Content:\n${processedContent}`,
          metadata: {
            ...metadata,
            xmlContent: uploadedFileData.content,
            parsed: true,
            parseDate: Date.now()
          }
        };
      }
    }
  } catch (error) {
    console.error('[ERROR] Error in processFileContent:', error, {
      fileType: uploadedFileData.fileType,
      filename: metadata?.filename
    });
    return {
      type: 'text',
      text: `Error processing file: ${metadata?.filename || 'Unknown file'}\nError: ${error.message}`
    };
  }
}

async getConversationText(conversationId) {
  const conversation = await ConversationPersistenceService.getConversation(conversationId);
  
  if (!conversation || conversation.messages.length === 0) {
    console.log('Conversation not found or empty');
    return null;
  }
  
  // formatAIResponseを使用せず、シンプルな文字列結合に
  const formattedConversation = conversation.messages.map(msg => {
    const content = Array.isArray(msg.content) 
      ? msg.content.map(item => item.text || '').join('\n')
      : typeof msg.content === 'string' 
        ? msg.content 
        : msg.content?.text || '';
    
    return `${msg.role}:\n${content}\n`;
  }).join('\n');

  console.log(`Conversation text retrieved. ConversationId: ${conversationId}`);
  return formattedConversation;
}

  async deleteConversation(conversationId) {
    console.log(`[DEBUG] Deleting conversation: ${conversationId}`);
    
    contextManager.clearContext(conversationId);
    console.log(`[DEBUG] Context cleared for conversation: ${conversationId}`);
    
    const result = await ConversationPersistenceService.deleteConversation(conversationId);
    console.log(`[DEBUG] Conversation deleted from database: ${conversationId}`);
    
    return result;
  }

  async clearContext(conversationId) {
    await ConversationPersistenceService.updateConversationStatus(conversationId, 'archived');
    contextManager.clearContext(conversationId);
    console.log(`Conversation context cleared and archived. ConversationId: ${conversationId}`);
    return { message: 'Conversation context cleared and archived successfully' };
  }

  async waitForAnalysisCompletion(uploadId, maxAttempts = 30, interval = 1000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const fileData = fileContentStorage.getFileContent(uploadId);
      if (fileData && fileData.status === 'completed') {
        return {
          type: fileData.fileType,
          content: fileData.content,
          metadata: fileData.metadata,
          status: 'completed'
        };
      } else if (fileData && fileData.status === 'error') {
        console.error(`File processing failed for uploadId: ${uploadId}`);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    console.warn(`File processing did not complete in time for uploadId: ${uploadId}`);
    return null;
  }
}

module.exports = ChatService;