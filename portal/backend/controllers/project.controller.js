const Project = require('../models/project.model');
const Prompt = require('../models/prompt.model');
const User = require('../models/user.model');

/**
 * プロジェクトコントローラー
 * プロジェクト関連のAPI処理を管理します
 */
const projectController = {
  /**
   * プロジェクト一覧を取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getAllProjects(req, res) {
    try {
      const { page = 1, limit = 10, sort, search, archived } = req.query;
      
      // 検索フィルターの構築
      const filters = {};
      
      // アーカイブフィルター
      if (archived === 'true') {
        filters.isArchived = true;
      } else {
        filters.isArchived = { $ne: true };
      }
      
      // 検索条件がある場合
      if (search) {
        filters.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      
      // ソート条件の構築
      let sortOption = { lastActivity: -1 }; // デフォルトは最終活動日時の降順
      if (sort) {
        const [field, order] = sort.split(':');
        sortOption = { [field]: order === 'asc' ? 1 : -1 };
      }
      
      // プロジェクト検索実行
      const { projects, total } = await Project.findUserProjects(req.userId, filters, {
        page,
        limit,
        sort: sortOption,
        populate: ['owner', 'members']
      });
      
      res.json({
        projects,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total
      });
    } catch (error) {
      console.error('プロジェクト一覧取得エラー:', error);
      res.status(500).json({ message: 'プロジェクト一覧の取得中にエラーが発生しました' });
    }
  },
  
  /**
   * プロジェクト詳細を取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getProjectById(req, res) {
    try {
      const { id } = req.params;
      
      // プロジェクト詳細取得
      const project = await Project.findById(id)
        .populate('ownerId', 'name email')
        .populate('members.userId', 'name email');
      
      if (!project) {
        return res.status(404).json({ message: 'プロジェクトが見つかりません' });
      }
      
      // アクセス権限チェック（所有者またはメンバー）
      const isOwner = project.ownerId._id.toString() === req.userId;
      const isMember = project.members.some(
        member => member.userId._id.toString() === req.userId
      );
      
      if (!isOwner && !isMember) {
        return res.status(403).json({ message: 'このプロジェクトにアクセスする権限がありません' });
      }
      
      // プロジェクト内のプロンプト数を取得
      const promptCount = await Prompt.countDocuments({
        projectId: id,
        isArchived: { $ne: true }
      });
      
      // レスポンス返却
      res.json({
        project,
        promptCount
      });
    } catch (error) {
      console.error('プロジェクト詳細取得エラー:', error);
      res.status(500).json({ message: 'プロジェクト詳細の取得中にエラーが発生しました' });
    }
  },
  
  /**
   * 新規プロジェクト作成
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async createProject(req, res) {
    try {
      const { name, description, icon, color, settings } = req.body;
      
      // プロジェクト作成
      const newProject = new Project({
        name,
        description: description || '',
        ownerId: req.userId,
        icon: icon || 'default_project',
        color: color || '#4A90E2',
        settings: settings || {},
        members: [] // 初期メンバーは所有者のみ
      });
      
      await newProject.save();
      
      res.status(201).json(newProject);
    } catch (error) {
      console.error('プロジェクト作成エラー:', error);
      
      // 重複エラーの場合
      if (error.code === 11000) {
        return res.status(400).json({ message: '同じ名前のプロジェクトが既に存在します' });
      }
      
      // バリデーションエラーの場合
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: errors.join(', ') });
      }
      
      res.status(500).json({ message: 'プロジェクトの作成中にエラーが発生しました' });
    }
  },
  
  /**
   * プロジェクト更新
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async updateProject(req, res) {
    try {
      const { id } = req.params;
      const { name, description, icon, color, settings } = req.body;
      
      // プロジェクト存在チェック
      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ message: 'プロジェクトが見つかりません' });
      }
      
      // 権限チェック（所有者のみ更新可能）
      const isOwner = project.ownerId.toString() === req.userId;
      if (!isOwner) {
        return res.status(403).json({ message: 'このプロジェクトを更新する権限がありません' });
      }
      
      // プロジェクト更新
      const updateData = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (icon) updateData.icon = icon;
      if (color) updateData.color = color;
      if (settings) updateData.settings = settings;
      
      updateData.lastActivity = new Date();
      
      const updatedProject = await Project.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      res.json(updatedProject);
    } catch (error) {
      console.error('プロジェクト更新エラー:', error);
      
      // 重複エラーの場合
      if (error.code === 11000) {
        return res.status(400).json({ message: '同じ名前のプロジェクトが既に存在します' });
      }
      
      // バリデーションエラーの場合
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: errors.join(', ') });
      }
      
      res.status(500).json({ message: 'プロジェクトの更新中にエラーが発生しました' });
    }
  },
  
  /**
   * プロジェクト削除（論理削除）
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async deleteProject(req, res) {
    try {
      const { id } = req.params;
      
      // プロジェクト存在チェック
      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ message: 'プロジェクトが見つかりません' });
      }
      
      // 権限チェック（所有者のみ削除可能）
      const isOwner = project.ownerId.toString() === req.userId;
      if (!isOwner) {
        return res.status(403).json({ message: 'このプロジェクトを削除する権限がありません' });
      }
      
      // 論理削除（アーカイブフラグをセット）
      await Project.findByIdAndUpdate(id, { isArchived: true });
      
      // プロジェクト内のプロンプトもアーカイブする
      await Prompt.updateMany(
        { projectId: id },
        { isArchived: true }
      );
      
      res.json({ message: 'プロジェクトが削除されました' });
    } catch (error) {
      console.error('プロジェクト削除エラー:', error);
      res.status(500).json({ message: 'プロジェクトの削除中にエラーが発生しました' });
    }
  },
  
  /**
   * プロジェクトメンバー一覧取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getProjectMembers(req, res) {
    try {
      const { id } = req.params;
      
      // プロジェクト存在チェック
      const project = await Project.findById(id)
        .populate('ownerId', 'name email')
        .populate('members.userId', 'name email');
      
      if (!project) {
        return res.status(404).json({ message: 'プロジェクトが見つかりません' });
      }
      
      // アクセス権限チェック（所有者またはメンバー）
      const isOwner = project.ownerId._id.toString() === req.userId;
      const isMember = project.members.some(
        member => member.userId._id.toString() === req.userId
      );
      
      if (!isOwner && !isMember) {
        return res.status(403).json({ message: 'このプロジェクトのメンバー一覧を取得する権限がありません' });
      }
      
      // メンバー一覧を構築
      const members = [
        // 所有者
        {
          user: {
            id: project.ownerId._id,
            name: project.ownerId.name,
            email: project.ownerId.email
          },
          role: 'owner',
          joinedAt: project.createdAt
        },
        // その他のメンバー
        ...project.members.map(member => ({
          user: {
            id: member.userId._id,
            name: member.userId.name,
            email: member.userId.email
          },
          role: member.role,
          joinedAt: member.joinedAt
        }))
      ];
      
      res.json(members);
    } catch (error) {
      console.error('プロジェクトメンバー一覧取得エラー:', error);
      res.status(500).json({ message: 'プロジェクトメンバー一覧の取得中にエラーが発生しました' });
    }
  },
  
  /**
   * プロジェクトメンバー追加
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async addProjectMember(req, res) {
    try {
      const { id } = req.params;
      const { email, role } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'メンバーのメールアドレスは必須です' });
      }
      
      // プロジェクト存在チェック
      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ message: 'プロジェクトが見つかりません' });
      }
      
      // 権限チェック（所有者のみメンバー追加可能）
      const isOwner = project.ownerId.toString() === req.userId;
      if (!isOwner) {
        return res.status(403).json({ message: 'このプロジェクトにメンバーを追加する権限がありません' });
      }
      
      // ユーザー存在チェック
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: '指定されたメールアドレスのユーザーが見つかりません' });
      }
      
      // 所有者は追加できない
      if (user._id.toString() === project.ownerId.toString()) {
        return res.status(400).json({ message: 'プロジェクト所有者を追加することはできません' });
      }
      
      // 既にメンバーかチェック
      const isMember = project.members.some(
        member => member.userId.toString() === user._id.toString()
      );
      
      if (isMember) {
        return res.status(400).json({ message: '指定されたユーザーは既にプロジェクトメンバーです' });
      }
      
      // メンバー追加
      const validRole = ['editor', 'viewer'].includes(role) ? role : 'viewer';
      const updatedProject = await Project.addMember(id, user._id, validRole);
      
      res.json({
        message: 'メンバーが追加されました',
        member: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email
          },
          role: validRole,
          joinedAt: new Date()
        }
      });
    } catch (error) {
      console.error('プロジェクトメンバー追加エラー:', error);
      res.status(500).json({ message: 'プロジェクトメンバーの追加中にエラーが発生しました' });
    }
  },
  
  /**
   * プロジェクトメンバーの役割更新
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async updateMemberRole(req, res) {
    try {
      const { id, userId } = req.params;
      const { role } = req.body;
      
      if (!role || !['editor', 'viewer'].includes(role)) {
        return res.status(400).json({ message: '有効な役割（editor/viewer）を指定してください' });
      }
      
      // プロジェクト存在チェック
      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ message: 'プロジェクトが見つかりません' });
      }
      
      // 権限チェック（所有者のみ役割更新可能）
      const isOwner = project.ownerId.toString() === req.userId;
      if (!isOwner) {
        return res.status(403).json({ message: 'プロジェクトメンバーの役割を変更する権限がありません' });
      }
      
      // メンバーチェック
      const memberIndex = project.members.findIndex(
        member => member.userId.toString() === userId
      );
      
      if (memberIndex === -1) {
        return res.status(404).json({ message: '指定されたユーザーはプロジェクトメンバーではありません' });
      }
      
      // 役割更新
      const updatedProject = await Project.updateMemberRole(id, userId, role);
      
      res.json({
        message: 'メンバーの役割が更新されました',
        role
      });
    } catch (error) {
      console.error('プロジェクトメンバー役割更新エラー:', error);
      res.status(500).json({ message: 'メンバーの役割更新中にエラーが発生しました' });
    }
  },
  
  /**
   * プロジェクトメンバー削除
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async removeProjectMember(req, res) {
    try {
      const { id, userId } = req.params;
      
      // プロジェクト存在チェック
      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ message: 'プロジェクトが見つかりません' });
      }
      
      // 権限チェック（所有者または自分自身の退出のみ可能）
      const isOwner = project.ownerId.toString() === req.userId;
      const isSelf = userId === req.userId;
      
      if (!isOwner && !isSelf) {
        return res.status(403).json({ message: 'プロジェクトメンバーを削除する権限がありません' });
      }
      
      // メンバーチェック
      const memberIndex = project.members.findIndex(
        member => member.userId.toString() === userId
      );
      
      if (memberIndex === -1) {
        return res.status(404).json({ message: '指定されたユーザーはプロジェクトメンバーではありません' });
      }
      
      // メンバー削除
      await Project.removeMember(id, userId);
      
      res.json({ message: 'メンバーがプロジェクトから削除されました' });
    } catch (error) {
      console.error('プロジェクトメンバー削除エラー:', error);
      res.status(500).json({ message: 'メンバーの削除中にエラーが発生しました' });
    }
  },
  
  /**
   * プロジェクト内のプロンプト一覧取得
   * @param {Object} req - リクエストオブジェクト
   * @param {Object} res - レスポンスオブジェクト
   */
  async getProjectPrompts(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10, sort, search, category, tags } = req.query;
      
      // プロジェクト存在チェック
      const project = await Project.findById(id);
      if (!project) {
        return res.status(404).json({ message: 'プロジェクトが見つかりません' });
      }
      
      // アクセス権限チェック（所有者またはメンバー）
      const isOwner = project.ownerId.toString() === req.userId;
      const isMember = project.members.some(
        member => member.userId.toString() === req.userId
      );
      
      if (!isOwner && !isMember) {
        return res.status(403).json({ message: 'このプロジェクトのプロンプト一覧を取得する権限がありません' });
      }
      
      // 検索フィルターの構築
      const filters = {
        projectId: id,
        isArchived: { $ne: true }
      };
      
      // 検索条件がある場合
      if (search) {
        filters.$or = [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { tags: { $regex: search, $options: 'i' } }
        ];
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
        populate: ['owner']
      });
      
      res.json({
        prompts,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total
      });
    } catch (error) {
      console.error('プロジェクトプロンプト一覧取得エラー:', error);
      res.status(500).json({ message: 'プロジェクトプロンプト一覧の取得中にエラーが発生しました' });
    }
  }
};

module.exports = projectController;