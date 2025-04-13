const Prompt = require('../models/prompt.model');
const PromptVersion = require('../models/promptVersion.model');
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
   * 
   * 注意: このメソッドは現在使用されていません。
   * 権限チェックミドルウェアを使用したルート定義に移行しています：
   * router.get('/:id', checkViewAccess, (req, res) => res.json(req.resource));
   */
  async getPromptById(req, res) {
    try {
      // このメソッドは権限チェックミドルウェアを使用したルートに置き換えられました
      // 後方互換性のために残していますが、実際には呼び出されないはずです
      console.warn('非推奨: getPromptByIdメソッドが直接呼び出されました');
      
      const { id } = req.params;
      if (!id) return res.status(400).json({ message: '有効なプロンプトIDが指定されていません' });
      
      const prompt = await Prompt.findById(id).populate('ownerId', 'name email');
      if (!prompt) return res.status(404).json({ message: 'プロンプトが見つかりません' });
      
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
      
      // 権限チェック（所有者、管理者、またはプロジェクト編集者のみ更新可能）
      const isOwner = prompt.ownerId.toString() === req.userId;
      const isAdmin = req.userRole === 'admin' || req.userRole === 'Admin' || req.userRole === 'SuperAdmin';
      
      let isProjectEditor = false;
      if (prompt.projectId) {
        const project = await Project.findById(prompt.projectId);
        isProjectEditor = project && project.members.some(
          member => member.userId.toString() === req.userId && ['owner', 'editor'].includes(member.role)
        );
      }
      
      if (!isOwner && !isAdmin && !isProjectEditor) {
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
      
      // 権限チェック（所有者または管理者が削除可能）
      const isOwner = prompt.ownerId.toString() === req.userId;
      const isAdmin = req.userRole === 'admin' || req.userRole === 'Admin' || req.userRole === 'SuperAdmin';
      
      if (!isOwner && !isAdmin) {
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
      
      // 権限チェック（所有者、管理者、またはプロジェクト編集者のみバージョン作成可能）
      const isOwner = prompt.ownerId.toString() === req.userId;
      const isAdmin = req.userRole === 'admin' || req.userRole === 'Admin' || req.userRole === 'SuperAdmin';
      
      let isProjectEditor = false;
      if (prompt.projectId) {
        const project = await Project.findById(prompt.projectId);
        isProjectEditor = project && project.members.some(
          member => member.userId.toString() === req.userId && ['owner', 'editor'].includes(member.role)
        );
      }
      
      if (!isOwner && !isAdmin && !isProjectEditor) {
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
      
      // アクセス権限チェック（所有者、管理者、公開プロンプト、またはプロジェクトメンバー）
      const isOwner = prompt.ownerId.toString() === req.userId;
      const isPublic = prompt.isPublic;
      const isAdmin = req.userRole === 'admin' || req.userRole === 'Admin' || req.userRole === 'SuperAdmin';
      
      let isProjectMember = false;
      if (prompt.projectId) {
        const project = await Project.findById(prompt.projectId);
        isProjectMember = project && project.members.some(
          member => member.userId.toString() === req.userId
        );
      }
      
      if (!isOwner && !isAdmin && !isPublic && !isProjectMember) {
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
      
      // アクセス権限チェック（所有者、管理者、公開プロンプト、またはプロジェクトメンバー）
      const isOwner = prompt.ownerId.toString() === req.userId;
      const isPublic = prompt.isPublic;
      const isAdmin = req.userRole === 'admin' || req.userRole === 'Admin' || req.userRole === 'SuperAdmin';
      
      let isProjectMember = false;
      if (prompt.projectId) {
        const project = await Project.findById(prompt.projectId);
        isProjectMember = project && project.members.some(
          member => member.userId.toString() === req.userId
        );
      }
      
      if (!isOwner && !isAdmin && !isPublic && !isProjectMember) {
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
      
      res.json({
        version,
        usageCount: 0 // 使用統計機能は削除されたため、常に0を返す
      });
    } catch (error) {
      console.error('プロンプトバージョン詳細取得エラー:', error);
      res.status(500).json({ message: 'プロンプトバージョン詳細の取得中にエラーが発生しました' });
    }
  },
  
  /**
   * プロンプト使用を記録（非推奨 - 統計機能削除済み）
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async recordPromptUsage(req, res) {
    try {
      const { id } = req.params;
      
      // プロンプト存在チェック
      const prompt = await Prompt.findById(id);
      if (!prompt) {
        return res.status(404).json({ message: 'プロンプトが見つかりません' });
      }
      
      // プロンプトの使用回数更新のみ実行
      await Prompt.incrementUsage(id);
      
      res.status(201).json({ message: 'プロンプト使用記録は非推奨になりました', success: true });
    } catch (error) {
      console.error('プロンプト使用記録エラー:', error);
      res.status(500).json({ message: 'プロンプト使用の記録中にエラーが発生しました' });
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
      
      // 権限チェック（所有者または管理者が共有リンク生成可能）
      const isOwner = prompt.ownerId.toString() === req.userId;
      const isAdmin = req.userRole === 'admin' || req.userRole === 'Admin' || req.userRole === 'SuperAdmin';
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: '共有リンクを生成する権限がありません' });
      }
      
      // トークン生成（既にあれば再利用）
      if (!prompt.publicToken) {
        prompt.publicToken = crypto.randomBytes(16).toString('hex');
        await prompt.save();
      }
      
      // 共有URL生成 (常に本番用のホスト名を使用)
      const host = process.env.NODE_ENV === 'production' 
        ? (process.env.API_HOST || 'appgenius-portal-test-235426778039.asia-northeast1.run.app')
        : req.get('host');
      const shareUrl = `${req.protocol}://${host}/api/prompts/public/${prompt.publicToken}`;
      
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