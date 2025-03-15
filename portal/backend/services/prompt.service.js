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
    const session = await Prompt.startSession();
    
    try {
      session.startTransaction();
      
      // プロンプト本体作成
      const prompt = new Prompt({
        title: promptData.title,
        content: promptData.content,
        type: promptData.type || 'system',
        category: promptData.category || 'その他',
        tags: promptData.tags || [],
        ownerId: promptData.ownerId,
        projectId: promptData.projectId || null,
        isPublic: promptData.isPublic || false
      });
      
      await prompt.save({ session });
      
      // 初期バージョン作成
      const version = new PromptVersion({
        promptId: prompt._id,
        content: promptData.content,
        description: '初期バージョン',
        versionNumber: 1,
        createdBy: promptData.ownerId
      });
      
      await version.save({ session });
      
      // プロンプトの現在バージョンを更新
      prompt.currentVersionId = version._id;
      await prompt.save({ session });
      
      // プロジェクトに所属している場合はプロンプト数を更新
      if (promptData.projectId) {
        await Project.updatePromptCount(promptData.projectId, 1);
      }
      
      await session.commitTransaction();
      
      // プロンプト完全データを取得して返却
      const completePrompt = await Prompt.findById(prompt._id)
        .populate('ownerId', 'name email')
        .populate('projectId', 'name');
      
      return completePrompt;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
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
    const session = await PromptVersion.startSession();
    
    try {
      session.startTransaction();
      
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
      
      await version.save({ session });
      
      // プロンプトの本文と現在バージョンを更新
      prompt.content = content;
      prompt.currentVersionId = version._id;
      await prompt.save({ session });
      
      await session.commitTransaction();
      
      // バージョン完全データを取得して返却
      const completeVersion = await PromptVersion.findById(version._id)
        .populate('createdBy', 'name email');
      
      return completeVersion;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
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
    const session = await Prompt.startSession();
    
    try {
      session.startTransaction();
      
      // 複製元プロンプト取得
      const sourcePrompt = await Prompt.findById(promptId);
      if (!sourcePrompt) {
        throw new Error('元のプロンプトが存在しません');
      }
      
      // 複製元バージョン取得
      const sourceVersion = await PromptVersion.findOne({ 
        _id: sourcePrompt.currentVersionId || null,
        promptId
      });
      
      // タイトル重複を避けるための接尾辞
      const titleSuffix = options.titleSuffix || ' (コピー)';
      
      // 新しいプロンプト作成
      const newPrompt = new Prompt({
        title: `${sourcePrompt.title}${titleSuffix}`,
        content: sourcePrompt.content,
        type: sourcePrompt.type,
        category: sourcePrompt.category,
        tags: [...sourcePrompt.tags],
        ownerId: userId,
        projectId: projectId || null,
        isPublic: options.isPublic || false
      });
      
      await newPrompt.save({ session });
      
      // 初期バージョン作成
      const newVersion = new PromptVersion({
        promptId: newPrompt._id,
        content: sourcePrompt.content,
        description: `${sourcePrompt.title} からコピー作成`,
        versionNumber: 1,
        createdBy: userId
      });
      
      await newVersion.save({ session });
      
      // プロンプトの現在バージョンを更新
      newPrompt.currentVersionId = newVersion._id;
      await newPrompt.save({ session });
      
      // プロジェクトに所属している場合はプロンプト数を更新
      if (projectId) {
        await Project.updatePromptCount(projectId, 1);
      }
      
      await session.commitTransaction();
      
      // プロンプト完全データを取得して返却
      const completePrompt = await Prompt.findById(newPrompt._id)
        .populate('ownerId', 'name email')
        .populate('projectId', 'name');
      
      return completePrompt;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },
  
  /**
   * プロンプトを別のプロジェクトに移動する
   * @param {String} promptId - プロンプトID
   * @param {String} newProjectId - 移動先プロジェクトID
   * @returns {Promise<Object>} - 更新されたプロンプト
   */
  async movePromptToProject(promptId, newProjectId) {
    const session = await Prompt.startSession();
    
    try {
      session.startTransaction();
      
      // プロンプト存在確認
      const prompt = await Prompt.findById(promptId);
      if (!prompt) {
        throw new Error('プロンプトが存在しません');
      }
      
      // 現在のプロジェクトID
      const currentProjectId = prompt.projectId;
      
      // 移動先プロジェクト存在確認
      if (newProjectId) {
        const targetProject = await Project.findById(newProjectId);
        if (!targetProject) {
          throw new Error('移動先プロジェクトが存在しません');
        }
      }
      
      // プロンプトのプロジェクトID更新
      prompt.projectId = newProjectId || null;
      await prompt.save({ session });
      
      // 元のプロジェクトのプロンプト数を減らす
      if (currentProjectId) {
        await Project.updatePromptCount(currentProjectId, -1);
      }
      
      // 新しいプロジェクトのプロンプト数を増やす
      if (newProjectId) {
        await Project.updatePromptCount(newProjectId, 1);
      }
      
      await session.commitTransaction();
      
      // プロンプト完全データを取得して返却
      const completePrompt = await Prompt.findById(promptId)
        .populate('ownerId', 'name email')
        .populate('projectId', 'name');
      
      return completePrompt;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
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