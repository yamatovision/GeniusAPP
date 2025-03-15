const Prompt = require('../models/prompt.model');
const PromptVersion = require('../models/promptVersion.model');
const Project = require('../models/project.model');

/**
 * プロンプトサービス
 * プロンプト関連の業務ロジックを集約します
 */
const promptService = {
  /**
   * 新規プロンプトとそのバージョンを作成する
   * @param {Object} promptData - プロンプトデータ
   * @returns {Promise<Object>} - 作成されたプロンプト
   */
  async createPrompt(promptData) {
    try {
      // プロンプト本体作成
      const prompt = new Prompt({
        title: promptData.title,
        content: promptData.content,
        type: promptData.type || 'system',
        tags: promptData.tags || [],
        ownerId: promptData.ownerId,
        isPublic: promptData.isPublic || false
      });
      
      await prompt.save();
      
      // 初期バージョン作成
      const version = new PromptVersion({
        promptId: prompt._id,
        content: promptData.content,
        description: '初期バージョン',
        versionNumber: 1,
        createdBy: promptData.ownerId
      });
      
      await version.save();
      
      // プロンプトの現在バージョンを更新
      prompt.currentVersionId = version._id;
      await prompt.save();
      
      // プロンプト完全データを取得して返却
      const completePrompt = await Prompt.findById(prompt._id)
        .populate('ownerId', 'name email');
      
      return completePrompt;
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * 既存プロンプトの新バージョンを作成する
   * @param {String} promptId - プロンプトID
   * @param {String} content - 新バージョンの内容
   * @param {String} description - バージョン説明
   * @param {String} userId - 作成者ID
   * @returns {Promise<Object>} - 作成されたバージョン
   */
  async createNewVersion(promptId, content, description, userId) {
    try {
      // プロンプト存在確認
      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        throw new Error('プロンプトが存在しません');
      }
      
      // 次のバージョン番号を取得
      const nextVersionNumber = await PromptVersion.getNextVersionNumber(promptId);
      
      // 新バージョン作成
      const version = new PromptVersion({
        promptId,
        content,
        description: description || `バージョン ${nextVersionNumber}`,
        versionNumber: nextVersionNumber,
        createdBy: userId
      });
      
      await version.save();
      
      // プロンプトの本文と現在バージョンを更新
      prompt.content = content;
      prompt.currentVersionId = version._id;
      await prompt.save();
      
      // バージョン完全データを取得して返却
      const completeVersion = await PromptVersion.findById(version._id)
        .populate('createdBy', 'name email');
      
      return completeVersion;
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * プロンプトを複製する
   * @param {String} promptId - プロンプトID
   * @param {String} userId - 複製先ユーザーID
   * @param {String} projectId - 複製先プロジェクトID
   * @param {Object} options - 複製オプション
   * @returns {Promise<Object>} - 複製されたプロンプト
   */
  async clonePrompt(promptId, userId, projectId = null, options = {}) {
    try {
      // 複製元プロンプト取得
      const sourcePrompt = await Prompt.findById(promptId);
      if (!sourcePrompt) {
        throw new Error('元のプロンプトが存在しません');
      }
      
      // タイトル重複を避けるための接尾辞
      const titleSuffix = options.titleSuffix || ' (コピー)';
      
      // 新しいプロンプト作成
      const newPrompt = new Prompt({
        title: `${sourcePrompt.title}${titleSuffix}`,
        content: sourcePrompt.content,
        type: sourcePrompt.type,
        tags: [...sourcePrompt.tags],
        ownerId: userId,
        isPublic: options.isPublic || false
      });
      
      await newPrompt.save();
      
      // 初期バージョン作成
      const newVersion = new PromptVersion({
        promptId: newPrompt._id,
        content: sourcePrompt.content,
        description: `${sourcePrompt.title} からコピー作成`,
        versionNumber: 1,
        createdBy: userId
      });
      
      await newVersion.save();
      
      // プロンプトの現在バージョンを更新
      newPrompt.currentVersionId = newVersion._id;
      await newPrompt.save();
      
      // プロンプト完全データを取得して返却
      const completePrompt = await Prompt.findById(newPrompt._id)
        .populate('ownerId', 'name email');
      
      return completePrompt;
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * プロンプトを別のプロジェクトに移動する
   * @param {String} promptId - プロンプトID
   * @param {String} newProjectId - 移動先プロジェクトID
   * @returns {Promise<Object>} - 更新されたプロンプト
   */
  async movePromptToProject(promptId, newProjectId) {
    try {
      // プロンプト存在確認
      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        throw new Error('プロンプトが存在しません');
      }
      
      // プロンプト完全データを取得して返却
      const completePrompt = await Prompt.findById(promptId)
        .populate('ownerId', 'name email');
      
      return completePrompt;
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * プロンプトの検索と並べ替え
   * @param {Object} filters - 検索フィルター
   * @param {Object} options - 検索オプション
   * @returns {Promise<Object>} - 検索結果と総件数
   */
  async searchPrompts(filters, options) {
    return Prompt.findPrompts(filters, options);
  },
  
  /**
   * カテゴリーとタグの集計
   * @returns {Promise<Object>} - カテゴリーとタグの使用頻度
   */
  async getCategoriesAndTags() {
    // カテゴリー集計
    const categories = await Prompt.aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // タグ集計
    const tags = await Prompt.aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 } // 上位30件のみ
    ]);
    
    return {
      categories: categories.map(c => ({ name: c._id, count: c.count })),
      tags: tags.map(t => ({ name: t._id, count: t.count }))
    };
  }
};

module.exports = promptService;