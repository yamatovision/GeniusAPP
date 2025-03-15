/**
 * アクセスプラン管理コントローラ
 * APIアクセスレベルとプラン設定の管理を提供
 */
const AccessPlan = require('../models/accessPlan.model');
const User = require('../models/user.model');
const authConfig = require('../config/auth.config');
const { ValidationError } = require('mongoose').Error;

// 全プラン一覧を取得（管理者向け）
exports.getAllPlans = async (req, res) => {
  try {
    // 管理者権限チェック
    if (req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: '管理者権限が必要です'
        }
      });
    }

    // プラン一覧を取得
    const plans = await AccessPlan.find().sort({ monthlyTokenLimit: 1 });
    
    res.status(200).json({ plans });
  } catch (error) {
    console.error('プラン一覧取得エラー:', error);
    res.status(500).json({ 
      error: {
        code: 'SERVER_ERROR', 
        message: 'サーバーエラーが発生しました',
        details: error.message
      }
    });
  }
};

// プラン情報を取得
exports.getPlan = async (req, res) => {
  try {
    const planId = req.params.id;
    
    // IDの妥当性チェック
    if (!planId || planId === 'undefined' || planId === 'null') {
      return res.status(400).json({ 
        message: '有効なプランIDが指定されていません',
        details: 'プランIDは必須です'
      });
    }
    
    // プランの存在確認
    const plan = await AccessPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'プランが見つかりません' });
    }
    
    res.status(200).json(plan);
  } catch (error) {
    console.error('プラン取得エラー:', error);
    
    // MongoDBのCastErrorを特別に処理
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({ 
        message: '不正なプランIDの形式です',
        details: error.message
      });
    }
    
    res.status(500).json({ message: 'プラン情報の取得に失敗しました' });
  }
};

// プランを作成（管理者向け）
exports.createPlan = async (req, res) => {
  try {
    console.log('プラン作成API呼び出し');
    console.log('リクエストボディ:', req.body);
    console.log('ユーザー情報:', { id: req.userId, role: req.userRole });
    
    // 管理者権限チェック
    if (req.userRole !== authConfig.roles.ADMIN) {
      console.log('権限エラー: 管理者権限が必要です');
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: '管理者権限が必要です'
        }
      });
    }

    // リクエストボディを検証
    const { name, accessLevel, monthlyTokenLimit, dailyTokenLimit, concurrentRequestLimit, allowedModels, description } = req.body;
    
    console.log('受信データ検証:', { 
      name, accessLevel, monthlyTokenLimit, 
      dailyTokenLimit, concurrentRequestLimit,
      allowedModels 
    });
    
    if (!name || !accessLevel || !monthlyTokenLimit) {
      const missingFields = [];
      if (!name) missingFields.push('name');
      if (!accessLevel) missingFields.push('accessLevel');
      if (!monthlyTokenLimit) missingFields.push('monthlyTokenLimit');
      
      console.log('必須項目不足エラー:', missingFields);
      return res.status(400).json({ 
        message: '必須項目が不足しています',
        required: ['name', 'accessLevel', 'monthlyTokenLimit'],
        missing: missingFields
      });
    }

    // プラン名の重複チェック
    const existingPlan = await AccessPlan.findOne({ name });
    if (existingPlan) {
      console.log('プラン名重複エラー:', name);
      return res.status(400).json({ 
        message: 'この名前のプランは既に存在します',
        existingPlan: { id: existingPlan._id, name: existingPlan.name }
      });
    }

    // データ型の変換（安全対策）
    const monthlyTokenLimitNum = Number(monthlyTokenLimit);
    const dailyTokenLimitNum = dailyTokenLimit ? Number(dailyTokenLimit) : null;
    const concurrentRequestLimitNum = Number(concurrentRequestLimit) || 5;
    
    console.log('変換後の数値データ:', { 
      monthlyTokenLimitNum, 
      dailyTokenLimitNum, 
      concurrentRequestLimitNum 
    });

    // 新規プランを作成
    const newPlan = new AccessPlan({
      name,
      accessLevel,
      monthlyTokenLimit: monthlyTokenLimitNum,
      dailyTokenLimit: dailyTokenLimitNum,
      concurrentRequestLimit: concurrentRequestLimitNum,
      allowedModels: allowedModels || ['sonnet'],
      description: description || '',
      createdBy: req.userId
    });
    
    console.log('作成するプランデータ:', newPlan);
    
    await newPlan.save();
    console.log('プラン保存成功:', newPlan._id);
    
    res.status(201).json({
      message: 'プランが正常に作成されました',
      plan: newPlan
    });
  } catch (error) {
    console.error('プラン作成エラー詳細:', error);
    
    // バリデーションエラーの場合は詳細を返す
    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).reduce((result, field) => {
        result[field] = error.errors[field].message;
        return result;
      }, {});
      
      console.error('バリデーションエラー詳細:', errors);
      return res.status(400).json({ 
        message: 'バリデーションエラー', 
        errors 
      });
    }
    
    // その他のエラー
    console.error('予期せぬエラー:', error.message, error.stack);
    res.status(500).json({ 
      message: 'プランの作成に失敗しました',
      error: error.message
    });
  }
};

// プラン情報の更新（管理者向け）
exports.updatePlan = async (req, res) => {
  try {
    // 管理者権限チェック
    if (req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: '管理者権限が必要です'
        }
      });
    }

    const planId = req.params.id;
    
    // IDの妥当性チェック
    if (!planId || planId === 'undefined' || planId === 'null') {
      return res.status(400).json({ 
        message: '有効なプランIDが指定されていません',
        details: 'プランIDは必須です'
      });
    }
    
    // プランの存在確認
    const plan = await AccessPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'プランが見つかりません' });
    }
    
    // リクエストボディから更新情報を取得
    const { name, accessLevel, monthlyTokenLimit, dailyTokenLimit, concurrentRequestLimit, allowedModels, description, isActive } = req.body;
    
    // 名前変更時の重複チェック
    if (name && name !== plan.name) {
      const existingPlan = await AccessPlan.findOne({ name });
      if (existingPlan) {
        return res.status(400).json({ message: 'この名前のプランは既に存在します' });
      }
      plan.name = name;
    }
    
    // 各フィールドを更新（指定された場合のみ）
    if (accessLevel) plan.accessLevel = accessLevel;
    if (monthlyTokenLimit) plan.monthlyTokenLimit = monthlyTokenLimit;
    if (dailyTokenLimit !== undefined) plan.dailyTokenLimit = dailyTokenLimit;
    if (concurrentRequestLimit) plan.concurrentRequestLimit = concurrentRequestLimit;
    if (allowedModels) plan.allowedModels = allowedModels;
    if (description !== undefined) plan.description = description;
    if (isActive !== undefined) plan.isActive = isActive;
    
    // 更新者情報を設定
    plan.updatedBy = req.userId;
    
    // プラン情報を保存
    await plan.save();
    
    res.status(200).json({
      message: 'プラン情報が正常に更新されました',
      plan
    });
  } catch (error) {
    console.error('プラン更新エラー:', error);
    
    // バリデーションエラーの場合は詳細を返す
    if (error instanceof ValidationError) {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'バリデーションエラー', errors });
    }
    
    // MongoDBのCastErrorを特別に処理
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({ 
        message: '不正なプランIDの形式です',
        details: error.message
      });
    }
    
    res.status(500).json({ message: 'プラン情報の更新に失敗しました' });
  }
};

// プランの削除（管理者向け）
exports.deletePlan = async (req, res) => {
  try {
    // 管理者権限チェック
    if (req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: '管理者権限が必要です'
        }
      });
    }

    const planId = req.params.id;
    
    // IDの妥当性チェック
    if (!planId || planId === 'undefined' || planId === 'null') {
      return res.status(400).json({ 
        message: '有効なプランIDが指定されていません',
        details: 'プランIDは必須です'
      });
    }
    
    // プランの存在確認
    const plan = await AccessPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'プランが見つかりません' });
    }
    
    // 利用中のユーザーがいるか確認
    const usersUsingPlan = await User.countDocuments({ 'apiAccess.accessLevel': plan.accessLevel });
    if (usersUsingPlan > 0) {
      return res.status(400).json({ 
        message: '利用中のユーザーが存在するため削除できません',
        usersCount: usersUsingPlan
      });
    }
    
    // プランを削除
    await AccessPlan.findByIdAndDelete(planId);
    
    res.status(200).json({ message: 'プランが正常に削除されました' });
  } catch (error) {
    console.error('プラン削除エラー:', error);
    
    // MongoDBのCastErrorを特別に処理
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({ 
        message: '不正なプランIDの形式です',
        details: error.message
      });
    }
    
    res.status(500).json({ message: 'プランの削除に失敗しました' });
  }
};

// デフォルトプランの初期化（管理者向け）
exports.initializeDefaultPlans = async (req, res) => {
  try {
    // 管理者権限チェック
    if (req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: '管理者権限が必要です'
        }
      });
    }

    // 既存のプランをカウント
    const plansCount = await AccessPlan.countDocuments();
    if (plansCount > 0 && !req.query.force) {
      return res.status(400).json({ 
        message: 'プランが既に存在します。強制的に初期化する場合は?force=trueを指定してください',
        existingPlans: plansCount
      });
    }
    
    // force=trueの場合は既存のプランを削除
    if (req.query.force === 'true') {
      await AccessPlan.deleteMany({});
    }
    
    // デフォルトプランを取得
    const defaultPlans = AccessPlan.getDefaultPlans();
    
    // デフォルトプランを作成
    const createdPlans = await AccessPlan.insertMany(
      defaultPlans.map(plan => ({
        ...plan,
        createdBy: req.userId
      }))
    );
    
    res.status(201).json({
      message: 'デフォルトプランが正常に初期化されました',
      plans: createdPlans
    });
  } catch (error) {
    console.error('デフォルトプラン初期化エラー:', error);
    res.status(500).json({ message: 'デフォルトプランの初期化に失敗しました' });
  }
};

// ユーザープランの設定（管理者向け）
exports.setUserPlan = async (req, res) => {
  try {
    // 管理者権限チェック
    if (req.userRole !== authConfig.roles.ADMIN) {
      return res.status(403).json({
        error: {
          code: 'PERMISSION_DENIED',
          message: '管理者権限が必要です'
        }
      });
    }

    const { userId } = req.params;
    const { accessLevel } = req.body;
    
    if (!accessLevel) {
      return res.status(400).json({ message: 'アクセスレベルは必須です' });
    }
    
    // アクセスレベルの存在チェック
    const plan = await AccessPlan.findOne({ accessLevel, isActive: true });
    if (!plan) {
      return res.status(404).json({ message: '指定されたアクセスレベルのプランが見つかりません' });
    }
    
    // ユーザーの存在チェック
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりません' });
    }
    
    // APIアクセス設定を初期化（存在しない場合）
    if (!user.apiAccess) {
      user.apiAccess = {
        enabled: true,
        accessLevel: 'basic',
        lastAccessAt: null
      };
    }
    
    // ユーザーのプラン設定を更新
    user.apiAccess.accessLevel = accessLevel;
    
    // プランに合わせてトークン制限を更新
    user.plan = {
      type: accessLevel,
      tokenLimit: plan.monthlyTokenLimit,
      lastResetDate: new Date(),
      nextResetDate: (() => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        return date;
      })()
    };
    
    // 日次トークン制限を設定
    if (!user.usageLimits) {
      user.usageLimits = {};
    }
    user.usageLimits.tokensPerDay = plan.dailyTokenLimit;
    
    // ステータス変更日時を更新
    user.statusChangedAt = new Date();
    
    // ユーザー情報を保存
    await user.save();
    
    res.status(200).json({
      message: 'ユーザープランが正常に更新されました',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        apiAccess: user.apiAccess,
        usageLimits: user.usageLimits
      }
    });
  } catch (error) {
    console.error('ユーザープラン設定エラー:', error);
    res.status(500).json({ message: 'ユーザープランの設定に失敗しました' });
  }
};