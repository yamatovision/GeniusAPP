const Prompt = require('../models/prompt.model');
const PromptVersion = require('../models/promptVersion.model');
const PromptUsage = require('../models/promptUsage.model');
const Project = require('../models/project.model');
const promptService = require('../services/prompt.service');
const crypto = require('crypto');
const projectController = require('./project.controller');

/**
 * プロンプトコントローラー
 * プロンプト関連のAPI処理を管理します
 */
const promptController = {
  /**
   * カテゴリーとタグの集計を取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getCategoriesAndTags(req, res) {
    try {
      const metadata = await promptService.getCategoriesAndTags();
      res.json(metadata);
    } catch (error) {
      console.error('カテゴリーとタグの集計取得エラー:', error);
      res.status(500).json({ message: 'カテゴリーとタグの集計取得中にエラーが発生しました' });
    }
  },
  
  /**
   * VSCode拡張用のプロンプト内容を取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getPromptContent(req, res) {
    try {
      const { id } = req.params;
      
      // プロンプト存在チェック
      const prompt = await Prompt.findById(id)
        .select('title content type tags');
      
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // プロンプト使用カウントを増加
      await Prompt.incrementUsage(id);
      
      // シンプルな形式で返却（VSCode拡張用）
      res.json({
        title: prompt.title,
        content: prompt.content,
        type: prompt.type,
        tags: prompt.tags
      });
    } catch (error) {
      console.error('プロンプト内容取得エラー:', error);
      res.status(500).json({ message: 'プロンプト内容の取得中にエラーが発生しました' });
    }
  },

  /**
   * プロンプト一覧を取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getAllPrompts(req, res) {
    try {
      const { page = 1, limit = 10, sort, search, category, tags, project } = req.query;
      
      // 検索フィルターの構築
      const filters = {};
      
      // ユーザーが所有者または閲覧権限があるかプロンプトが公開されているものを表示
      filters.$or = [
        // { ownerId: req.userId }, // MongoDBのObjectIdとして解釈されるため問題が発生
        { isPublic: true }
      ];
      
      // プロジェクトがある場合はプロジェクトメンバーかどうかもチェック
      if (project) {
        filters.projectId = project;
        
        // プロジェクトフィルターが指定されている場合、$orにプロジェクトメンバー条件を追加
        const projectData = await Project.findById(project);
        if (projectData) {
          const isProjectMember = projectData.members.some(
            member => member.userId.toString() === req.userId.toString()
          );
          
          if (isProjectMember) {
            filters.$or.push({ projectId: project });
          }
        }
      }
      
      // アーカイブされていないものだけ表示
      filters.isArchived = { $ne: true };
      
      // 検索条件がある場合
      if (search) {
        filters.$or = filters.$or || [];
        filters.$or.push(
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { tags: { $regex: search, $options: 'i' } }
        );
      }
      
      // カテゴリーフィルター
      if (category) {
        filters.category = category;
      }
      
      // タグフィルター
      if (tags) {
        const tagList = tags.split(',').map(tag => tag.trim());
        filters.tags = { $in: tagList };
      }
      
      // ソート条件の構築
      let sortOption = { updatedAt: -1 }; // デフォルトは更新日時の降順
      if (sort) {
        const [field, order] = sort.split(':');
        sortOption = { [field]: order === 'asc' ? 1 : -1 };
      }
      
      // プロンプト検索実行
      const { prompts, total } = await Prompt.findPrompts(filters, {
        page,
        limit,
        sort: sortOption,
        populate: ['ownerId'] // projectはスキーマに存在しないのでポピュレートしない
      });
      
      res.json({
        prompts,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total
      });
    } catch (error) {
      console.error('プロンプト一覧取得エラー:', error);
      res.status(500).json({ message: 'プロンプト一覧の取得中にエラーが発生しました' });
    }
  },
  
  /**
   * プロンプト詳細を取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getPromptById(req, res) {
    try {
      const { id } = req.params;
      
      // IDの検証
      if (!id || id === 'undefined' || id === 'null') {
        console.error('無効なプロンプトID:', id);
        return res.status(400).json({ message: '有効なプロンプトIDが指定されていません' });
      }
      
      // プロンプト詳細取得
      const prompt = await Prompt.findById(id)
        .populate('ownerId', 'name email');
      
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // アクセス権限チェック（所有者または公開プロンプト）
      const isOwner = prompt.ownerId && prompt.ownerId._id && prompt.ownerId._id.toString() === req.userId;
      const isPublic = prompt.isPublic;
      
      let isProjectMember = false;
      // プロジェクト関連の機能は一時的に無効化
      // projectIdフィールドがスキーマにないためエラーになる
      
      if (!isOwner && !isPublic && !isProjectMember) {
        return res.status(403).json({ message: 'このプロンプトにアクセスする権限がありません' });
      }
      
      // シンプル化のためバージョン情報と詳細な使用統計は省略
      const usageStats = {
        totalUsage: prompt.usageCount || 0
      };
      
      // レスポンス返却 - シンプル化されたレスポンス形式
      res.json(prompt);
    } catch (error) {
      console.error('プロンプト詳細取得エラー:', error);
      res.status(500).json({ message: 'プロンプト詳細の取得中にエラーが発生しました' });
    }
  },
  
  /**
   * 新規プロンプト作成
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async createPrompt(req, res) {
    try {
      const { title, content, type, category, tags, projectId, isPublic } = req.body;
      
      // プロジェクトへのアクセス権限チェック
      if (projectId) {
        const project = await Project.findById(projectId);
        if (!project) {
          return res.status(404).json({ message: '指定されたプロジェクトが見つかりません' });
        }
        
        const isOwner = project.ownerId.toString() === req.userId;
        const isEditor = project.members.some(
          member => member.userId.toString() === req.userId && ['owner', 'editor'].includes(member.role)
        );
        
        if (!isOwner && !isEditor) {
          return res.status(403).json({ message: 'このプロジェクトにプロンプトを追加する権限がありません' });
        }
      }
      
      // シンプル化したプロンプト作成
      const newPrompt = new Prompt({
        title,
        content,
        description: req.body.description || '',
        tags: tags || [],
        ownerId: req.userId,
        isPublic: isPublic || false
      });
      
      await newPrompt.save();
      
      res.status(201).json(newPrompt);
    } catch (error) {
      console.error('プロンプト作成エラー:', error);
      
      // 重複エラーの場合
      if (error.code === 11000) {
        return res.status(400).json({ message: '同じタイトルのプロンプトが既に存在します' });
      }
      
      // バリデーションエラーの場合
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: errors.join(', ') });
      }
      
      res.status(500).json({ message: 'プロンプトの作成中にエラーが発生しました' });
    }
  },
  
  /**
   * プロンプト更新
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async updatePrompt(req, res) {
    try {
      const { id } = req.params;
      const { title, content, type, category, tags, projectId, isPublic } = req.body;
      
      // プロンプト存在チェック
      const prompt = await Prompt.findById(id);
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // 権限チェック（所有者またはプロジェクト編集者のみ更新可能）
      const isOwner = prompt.ownerId.toString() === req.userId;
      
      let isProjectEditor = false;
      if (prompt.projectId) {
        const project = await Project.findById(prompt.projectId);
        isProjectEditor = project && project.members.some(
          member => member.userId.toString() === req.userId && ['owner', 'editor'].includes(member.role)
        );
      }
      
      if (!isOwner && !isProjectEditor) {
        return res.status(403).json({ message: 'このプロンプトを更新する権限がありません' });
      }
      
      // シンプル化したプロンプト更新
      const updateData = {};
      if (title) updateData.title = title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (content) updateData.content = content;
      if (tags) updateData.tags = tags;
      if (isPublic !== undefined) updateData.isPublic = isPublic;
      
      // プロンプト更新
      const updatedPrompt = await Prompt.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      res.json(updatedPrompt);
    } catch (error) {
      console.error('プロンプト更新エラー:', error);
      
      // 重複エラーの場合
      if (error.code === 11000) {
        return res.status(400).json({ message: '同じタイトルのプロンプトが既に存在します' });
      }
      
      // バリデーションエラーの場合
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: errors.join(', ') });
      }
      
      res.status(500).json({ message: 'プロンプトの更新中にエラーが発生しました' });
    }
  },
  
  /**
   * プロンプト削除（論理削除）
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async deletePrompt(req, res) {
    try {
      const { id } = req.params;
      
      // IDバリデーション
      if (!id || id === 'undefined' || id === 'null') {
        console.error('無効なプロンプトID:', id);
        return res.status(400).json({ message: '有効なプロンプトIDが指定されていません' });
      }
      
      // プロンプト存在チェック
      let prompt;
      try {
        prompt = await Prompt.findById(id);
      } catch (findError) {
        console.error('プロンプト検索エラー:', findError);
        return res.status(400).json({ message: 'プロンプトIDの形式が無効です' });
      }
      
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // 権限チェック（所有者のみ削除可能）
      const isOwner = prompt.ownerId.toString() === req.userId;
      if (!isOwner) {
        return res.status(403).json({ message: 'このプロンプトを削除する権限がありません' });
      }
      
      // 論理削除（アーカイブフラグをセット）
      await Prompt.findByIdAndUpdate(id, { isArchived: true });
      
      console.log(`プロンプト削除成功: ID=${id}`);
      res.json({ message: 'プロンプトが削除されました' });
    } catch (error) {
      console.error('プロンプト削除エラー:', error);
      res.status(500).json({ message: 'プロンプトの削除中にエラーが発生しました' });
    }
  },
  
  /**
   * 新しいプロンプトバージョンを作成
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async createPromptVersion(req, res) {
    try {
      const { id } = req.params;
      const { content, description } = req.body;
      
      // プロンプト存在チェック
      const prompt = await Prompt.findById(id);
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // 権限チェック（所有者またはプロジェクト編集者のみバージョン作成可能）
      const isOwner = prompt.ownerId.toString() === req.userId;
      
      let isProjectEditor = false;
      if (prompt.projectId) {
        const project = await Project.findById(prompt.projectId);
        isProjectEditor = project && project.members.some(
          member => member.userId.toString() === req.userId && ['owner', 'editor'].includes(member.role)
        );
      }
      
      if (!isOwner && !isProjectEditor) {
        return res.status(403).json({ message: 'このプロンプトの新バージョンを作成する権限がありません' });
      }
      
      // 新バージョン作成
      const newVersion = await promptService.createNewVersion(
        id, 
        content,
        description || '手動バージョン作成',
        req.userId
      );
      
      res.status(201).json(newVersion);
    } catch (error) {
      console.error('プロンプトバージョン作成エラー:', error);
      
      // バリデーションエラーの場合
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: errors.join(', ') });
      }
      
      res.status(500).json({ message: 'プロンプトバージョンの作成中にエラーが発生しました' });
    }
  },
  
  /**
   * プロンプトバージョン一覧取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getPromptVersions(req, res) {
    try {
      const { id } = req.params;
      
      // プロンプト存在チェック
      const prompt = await Prompt.findById(id);
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // アクセス権限チェック（所有者、公開プロンプト、またはプロジェクトメンバー）
      const isOwner = prompt.ownerId.toString() === req.userId;
      const isPublic = prompt.isPublic;
      
      let isProjectMember = false;
      if (prompt.projectId) {
        const project = await Project.findById(prompt.projectId);
        isProjectMember = project && project.members.some(
          member => member.userId.toString() === req.userId
        );
      }
      
      if (!isOwner && !isPublic && !isProjectMember) {
        return res.status(403).json({ message: 'このプロンプトのバージョン履歴にアクセスする権限がありません' });
      }
      
      // バージョン一覧取得
      const versions = await PromptVersion.find({ promptId: id })
        .sort({ versionNumber: -1 })
        .populate('createdBy', 'name email');
      
      res.json(versions);
    } catch (error) {
      console.error('プロンプトバージョン一覧取得エラー:', error);
      res.status(500).json({ message: 'プロンプトバージョン一覧の取得中にエラーが発生しました' });
    }
  },
  
  /**
   * プロンプトバージョン詳細取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getPromptVersionById(req, res) {
    try {
      const { id, versionId } = req.params;
      
      // プロンプト存在チェック
      const prompt = await Prompt.findById(id);
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // アクセス権限チェック（所有者、公開プロンプト、またはプロジェクトメンバー）
      const isOwner = prompt.ownerId.toString() === req.userId;
      const isPublic = prompt.isPublic;
      
      let isProjectMember = false;
      if (prompt.projectId) {
        const project = await Project.findById(prompt.projectId);
        isProjectMember = project && project.members.some(
          member => member.userId.toString() === req.userId
        );
      }
      
      if (!isOwner && !isPublic && !isProjectMember) {
        return res.status(403).json({ message: 'このプロンプトバージョンにアクセスする権限がありません' });
      }
      
      // バージョン詳細取得
      const version = await PromptVersion.findOne({
        _id: versionId,
        promptId: id
      }).populate('createdBy', 'name email');
      
      if (!version) {
        return res.status(404).json({ message: '指定されたバージョンが見つかりません' });
      }
      
      // バージョン使用統計取得
      const stats = await PromptUsage.find({ versionId }).countDocuments();
      
      res.json({
        version,
        usageCount: stats
      });
    } catch (error) {
      console.error('プロンプトバージョン詳細取得エラー:', error);
      res.status(500).json({ message: 'プロンプトバージョン詳細の取得中にエラーが発生しました' });
    }
  },
  
  /**
   * プロンプト使用を記録
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async recordPromptUsage(req, res) {
    try {
      const { id } = req.params;
      const { 
        versionId, 
        projectId, 
        context,
        inputTokens,
        outputTokens,
        responseTime,
        isSuccess,
        errorType,
        metadata
      } = req.body;
      
      // プロンプト存在チェック
      const prompt = await Prompt.findById(id);
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // 指定されたバージョンが存在するかチェック
      const version = await PromptVersion.findOne({
        _id: versionId,
        promptId: id
      });
      
      if (!version) {
        return res.status(404).json({ message: '指定されたプロンプトバージョンが見つかりません' });
      }
      
      // アクセス権限チェック（所有者、公開プロンプト、またはプロジェクトメンバー）
      const isOwner = prompt.ownerId.toString() === req.userId;
      const isPublic = prompt.isPublic;
      
      let isProjectMember = false;
      if (prompt.projectId) {
        const project = await Project.findById(prompt.projectId);
        isProjectMember = project && project.members.some(
          member => member.userId.toString() === req.userId
        );
      }
      
      if (!isOwner && !isPublic && !isProjectMember) {
        return res.status(403).json({ message: 'このプロンプトを使用する権限がありません' });
      }
      
      // 使用記録作成
      const usage = new PromptUsage({
        promptId: id,
        versionId,
        userId: req.userId,
        projectId: projectId || prompt.projectId,
        context: context || '',
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
        responseTime: responseTime || 0,
        isSuccess: isSuccess !== undefined ? isSuccess : true,
        errorType: errorType || 'なし',
        metadata: metadata || {},
        usedAt: new Date()
      });
      
      await usage.save();
      
      // プロンプトの使用回数更新
      await Prompt.incrementUsage(id);
      
      // バージョンのパフォーマンス統計更新
      await PromptVersion.updatePerformance(versionId, {
        success: isSuccess,
        responseTime
      });
      
      res.status(201).json({ message: 'プロンプト使用が記録されました', usageId: usage._id });
    } catch (error) {
      console.error('プロンプト使用記録エラー:', error);
      
      // バリデーションエラーの場合
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: errors.join(', ') });
      }
      
      res.status(500).json({ message: 'プロンプト使用の記録中にエラーが発生しました' });
    }
  },
  
  /**
   * プロンプト使用統計の取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getPromptUsageStats(req, res) {
    try {
      const { id } = req.params;
      const { period, interval } = req.query;
      
      // プロンプト存在チェック
      const prompt = await Prompt.findById(id);
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // アクセス権限チェック（所有者またはプロジェクト管理者のみ詳細統計閲覧可能）
      const isOwner = prompt.ownerId.toString() === req.userId;
      
      let isProjectAdmin = false;
      if (prompt.projectId) {
        const project = await Project.findById(prompt.projectId);
        isProjectAdmin = project && project.members.some(
          member => member.userId.toString() === req.userId && member.role === 'owner'
        );
      }
      
      if (!isOwner && !isProjectAdmin) {
        return res.status(403).json({ message: 'このプロンプトの使用統計を閲覧する権限がありません' });
      }
      
      // 期間指定
      let timeRange = {};
      const now = new Date();
      
      switch (period) {
        case 'today':
          timeRange.start = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          timeRange.start = yesterday;
          timeRange.end = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          const lastWeek = new Date(now);
          lastWeek.setDate(lastWeek.getDate() - 7);
          timeRange.start = lastWeek;
          break;
        case 'month':
          const lastMonth = new Date(now);
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          timeRange.start = lastMonth;
          break;
        case 'year':
          const lastYear = new Date(now);
          lastYear.setFullYear(lastYear.getFullYear() - 1);
          timeRange.start = lastYear;
          break;
        case 'custom':
          if (req.query.start) timeRange.start = new Date(req.query.start);
          if (req.query.end) timeRange.end = new Date(req.query.end);
          break;
        default: // 'all' またはデフォルト
          // 期間指定なし（全期間）
          break;
      }
      
      // 統計データ取得
      const [overallStats, versionStats, timeSeriesData] = await Promise.all([
        // 全体統計
        PromptUsage.getUsageStats(id, timeRange),
        // バージョン別統計
        PromptUsage.getVersionStats(id),
        // 時系列データ
        PromptUsage.getTimeSeriesStats(id, interval || 'day')
      ]);
      
      res.json({
        overall: overallStats,
        versions: versionStats,
        timeSeries: timeSeriesData
      });
    } catch (error) {
      console.error('プロンプト使用統計取得エラー:', error);
      res.status(500).json({ message: 'プロンプト使用統計の取得中にエラーが発生しました' });
    }
  },
  
  /**
   * ユーザーフィードバック登録
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async recordUserFeedback(req, res) {
    try {
      const { usageId } = req.params;
      const { rating, comment, tags } = req.body;
      
      // 使用記録の存在確認
      const usage = await PromptUsage.findById(usageId);
      if (!usage) {
        return res.status(404).json({ message: '指定された使用記録が見つかりません' });
      }
      
      // 権限チェック（自分の使用記録のみフィードバック可能）
      if (usage.userId.toString() !== req.userId) {
        return res.status(403).json({ message: 'この使用記録にフィードバックする権限がありません' });
      }
      
      // フィードバック更新
      usage.userFeedback = {
        rating: rating,
        comment: comment || '',
        tags: tags || []
      };
      
      await usage.save();
      
      res.json({ message: 'フィードバックが記録されました' });
    } catch (error) {
      console.error('ユーザーフィードバック記録エラー:', error);
      res.status(500).json({ message: 'フィードバックの記録中にエラーが発生しました' });
    }
  },

  /**
   * プロンプト複製
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async clonePrompt(req, res) {
    try {
      const { id } = req.params;
      const { titleSuffix, isPublic } = req.body;
      
      // IDバリデーション
      if (!id || id === 'undefined' || id === 'null') {
        console.error('無効なプロンプトID:', id);
        return res.status(400).json({ message: '有効なプロンプトIDが指定されていません' });
      }
      
      // プロンプト存在チェック
      let originalPrompt;
      try {
        originalPrompt = await Prompt.findById(id);
      } catch (findError) {
        console.error('プロンプト検索エラー:', findError);
        return res.status(400).json({ message: 'プロンプトIDの形式が無効です' });
      }
      
      if (!originalPrompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // 新しいプロンプトを作成
      const newPrompt = new Prompt({
        title: `${originalPrompt.title}${titleSuffix || ' (コピー)'}`,
        content: originalPrompt.content,
        type: originalPrompt.type || 'system',
        tags: originalPrompt.tags || [],
        ownerId: req.userId,
        isPublic: isPublic !== undefined ? isPublic : false
      });
      
      await newPrompt.save();
      
      // 初期バージョン作成
      const version = new PromptVersion({
        promptId: newPrompt._id,
        content: originalPrompt.content,
        description: `${originalPrompt.title}からコピー作成`,
        versionNumber: 1,
        createdBy: req.userId
      });
      
      await version.save();
      
      // プロンプトの現在バージョンを更新
      newPrompt.currentVersionId = version._id;
      await newPrompt.save();
      
      // 新しいプロンプトを返却
      res.status(201).json({
        message: 'プロンプトを複製しました',
        prompt: newPrompt
      });
    } catch (error) {
      console.error('プロンプト複製エラー:', error);
      
      // バリデーションエラーの場合
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: errors.join(', ') });
      }
      
      res.status(500).json({ message: 'プロンプトの複製中にエラーが発生しました' });
    }
  },
  
  /**
   * 公開プロンプト共有リンク生成
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async createShareLink(req, res) {
    try {
      const { id } = req.params;
      
      // IDの検証
      if (!id || id === 'undefined' || id === 'null') {
        console.error('無効なプロンプトID:', id);
        return res.status(400).json({ message: '有効なプロンプトIDが指定されていません' });
      }
      
      // プロンプト存在チェック
      const prompt = await Prompt.findById(id);
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // 権限チェック（所有者のみ共有リンク生成可能）
      const isOwner = prompt.ownerId.toString() === req.userId;
      if (!isOwner) {
        return res.status(403).json({ message: '共有リンクを生成する権限がありません' });
      }
      
      // トークン生成（既にあれば再利用）
      if (!prompt.publicToken) {
        prompt.publicToken = crypto.randomBytes(16).toString('hex');
        await prompt.save();
      }
      
      // 共有URL生成
      const shareUrl = `${req.protocol}://${req.get('host')}/api/prompts/public/${prompt.publicToken}`;
      
      res.json({ 
        shareUrl, 
        token: prompt.publicToken,
        claudeCodeUrl: `vscode://mikoto.app-genius/launch-claude-code?url=${encodeURIComponent(shareUrl)}` 
      });
    } catch (error) {
      console.error('共有リンク生成エラー:', error);
      res.status(500).json({ message: '共有リンクの生成中にエラーが発生しました' });
    }
  },
  
  /**
   * 公開プロンプト取得（認証不要）
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getPublicPrompt(req, res) {
    try {
      const { token } = req.params;
      
      // トークンでプロンプト検索
      const prompt = await Prompt.findOne({ publicToken: token });
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // 使用回数を増やす
      await Prompt.findByIdAndUpdate(
        prompt._id,
        { $inc: { usageCount: 1 } }
      );
      
      // シンプルな形式で返却
      res.json({
        id: prompt._id,
        title: prompt.title,
        description: prompt.description,
        tags: prompt.tags,
        content: prompt.content
      });
    } catch (error) {
      console.error('公開プロンプト取得エラー:', error);
      res.status(500).json({ message: 'プロンプトの取得中にエラーが発生しました' });
    }
  }
};

module.exports = promptController;