const { generateConversationId, isValidConversationId } = require('../utils/conversationUtils');
const ChatService = require('./chatService');
const chatService = new ChatService();
const { processUploadedFile, prepareDataForClaude } = require('../fileUploader/fileUploadService');
const { getUploadedFileData } = require('../fileUploader/fileUploadController');


exports.initializeConversation = async (req, res, next) => {
  try {
    const { promptId } = req.body;
    const userId = req.user.userId; // 正しいユーザーID取得方法

    console.log('Initializing conversation with promptId:', promptId);
    console.log('User ID:', userId);

    const result = await chatService.initializeConversation(userId, promptId);
    console.log('Conversation initialized:', result);
    res.json(result);
  } catch (error) {
    console.error('Error initializing conversation:', error);
    res.status(500).json({ 
      error: 'An error occurred while initializing the conversation.', 
      details: error.message,
      stack: error.stack // エラーのスタックトレースを追加
    });
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;
    console.log(`Received request with conversationId: ${conversationId}, message: ${message}`);
    
    if (!conversationId || !isValidConversationId(conversationId)) {
      console.log(`Invalid conversationId: ${conversationId}`);
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }
    
    let uploadedFileContent = null;
    if (req.file) {
      console.log('File received:', req.file);
      const processedFile = await processUploadedFile(req.file);
      const claudeData = prepareDataForClaude(processedFile);
      uploadedFileContent = claudeData.content;
      console.log('Processed file content:', uploadedFileContent);
    }
    
    console.log(`Controller received valid message. ConversationId: ${conversationId}`);
    const response = await chatService.sendMessage(message, conversationId, uploadedFileContent);
    console.log(`Controller sending response. ConversationId: ${response.conversationId}`);
    res.json(response);
  } catch (error) {
    console.error('Error in sendMessage:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    res.status(500).json({ error: 'An error occurred while processing your request.', details: error.message });
  }
};

exports.downloadConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    console.log('Downloading conversation:', conversationId);
    const conversationText = await chatService.getConversationText(conversationId);
    
    if (!conversationText) {
      console.log('Conversation not found or empty:', conversationId);
      return res.status(404).json({ message: 'Conversation not found or empty' });
    }
    
    console.log('Conversation downloaded successfully:', conversationId);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=conversation-${conversationId}.txt`);
    res.send(conversationText);
  } catch (error) {
    console.error('Error downloading conversation:', error);
    next(error);
  }
};

exports.resetConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.body;
    console.log('Resetting conversation:', conversationId);
    await chatService.clearContext(conversationId);
    console.log('Conversation reset successfully:', conversationId);
    res.json({ message: 'Conversation reset successfully' });
  } catch (error) {
    console.error('Error resetting conversation:', error);
    res.status(500).json({ error: 'An error occurred while resetting the conversation.', details: error.message });
  }
};

exports.deleteConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    console.log(`Deleting conversation: ${conversationId} for user: ${userId}`);

    // 会話の所有者確認
    const conversation = await chatService.getConversation(conversationId);
    if (!conversation) {
      console.log(`Conversation not found: ${conversationId}`);
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.userId.toString() !== userId) {
      console.log(`Unauthorized deletion attempt - User: ${userId}, Conversation: ${conversationId}`);
      return res.status(403).json({ error: 'Unauthorized to delete this conversation' });
    }

    // 元のpromptIdを保存
    const originalPromptId = conversation.promptId;

    // 会話の削除実行
    await chatService.deleteConversation(conversationId);
    
    console.log(`Conversation deleted successfully: ${conversationId}`);
    res.json({ 
      message: 'Conversation deleted successfully',
      conversationId,
      promptId: originalPromptId // promptIdを返す
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ 
      error: 'Failed to delete conversation', 
      details: error.message 
    });
  }
};
exports.sendMessageStreaming = async (req, res, next) => {
  try {
    console.log('Received streaming request:', req.body);
    const { message, conversationId, uploadId } = req.body;
    
    console.log(`Streaming request details - Message: ${message}, ConversationId: ${conversationId}, UploadId: ${uploadId}`);
    
    if (!conversationId || !isValidConversationId(conversationId)) {
      console.log(`Invalid conversationId: ${conversationId}`);
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }
    
    let uploadedFileContent = null;
    if (uploadId) {
      console.log('UploadId received:', uploadId);
      uploadedFileContent = getUploadedFileData(uploadId);
      if (uploadedFileContent) {
        console.log('File content retrieved for uploadId:', uploadId);
      } else {
        console.warn('No file content found for uploadId:', uploadId);
      }
    }
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const sendChunk = (chunk) => {
      console.log('Sending chunk:', chunk);
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    };

    console.log('Calling chatService.sendMessageStreaming');
    await chatService.sendMessageStreaming(message, conversationId, sendChunk, uploadId);

    console.log('Streaming completed');
    res.write('event: end\ndata: {}\n\n');
    res.end();
  } catch (error) {
    console.error('Error in sendMessageStreaming:', error);
    res.write(`data: ${JSON.stringify({ error: 'An error occurred while processing your request.' })}\n\n`);
    res.end();
  }
};