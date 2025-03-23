/**
 * adminConfigController
 * システム全体の管理設定を扱うコントローラー
 * Super Admin専用の設定管理API
 */
const SystemConfig = require('../models/systemConfig.model');
const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const ApiUsage = require('../models/apiUsage.model');
const authConfig = require('../config/auth.config');
const logger = require('../utils/logger');
const anthropicAdminService = require('../services/anthropicAdminService');
const csv = require('csv-parser');
const { Readable } = require('stream');

/**
 * システム設定を取得
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.getSystemConfig = async (req, res) => {
  try {
    // スーパー管理者権限チェック
    if (req.userRole !== authConfig.roles.SUPER_ADMIN) {
      return res.status(403).json({ error: 'システム設定の取得にはスーパー管理者権限が必要です' });
    }

    // システム設定を取得（ない場合は作成）
    let systemConfig = await SystemConfig.findOne();
    if (!systemConfig) {
      // 初期設定を作成
      const encryptionSecret = SystemConfig.generateEncryptionSecret();
      systemConfig = new SystemConfig({
        description: 'システム全体の設定',
        encryptionSecret,
        metadata: {
          createdBy: req.userId
        }
      });
      await systemConfig.save();
    }

    // レスポンスデータを整形（機密情報は除外/マスク）
    const configData = {
      id: systemConfig._id,
      description: systemConfig.description,
      hasAdminApiKey: !!systemConfig.adminApiKey,
      adminApiKeyHint: systemConfig.adminApiKey 
        ? `${systemConfig.adminApiKey.substring(0, 10)}...` 
        : null,
      anthropicConsoleUrl: systemConfig.anthropicConsoleUrl,
      createdAt: systemConfig.createdAt,
      updatedAt: systemConfig.updatedAt
    };

    return res.status(200).json(configData);
  } catch (error) {
    logger.error('システム設定取得エラー:', error);
    return res.status(500).json({ error: 'システム設定の取得に失敗しました' });
  }
};

/**
 * Admin APIキーを設定/更新
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.updateAdminApiKey = async (req, res) => {
  try {
    // スーパー管理者権限チェック
    if (req.userRole !== authConfig.roles.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Admin APIキーの更新にはスーパー管理者権限が必要です' });
    }

    const { adminApiKey } = req.body;
    
    // APIキーのバリデーション
    if (!adminApiKey || !adminApiKey.startsWith('sk-ant-admin')) {
      return res.status(400).json({ 
        error: '有効なAdmin APIキーを入力してください。Admin APIキーは「sk-ant-admin」で始まります。' 
      });
    }

    // システム設定を取得（ない場合は作成）
    let systemConfig = await SystemConfig.findOne();
    if (!systemConfig) {
      const encryptionSecret = SystemConfig.generateEncryptionSecret();
      systemConfig = new SystemConfig({
        encryptionSecret,
        metadata: {
          createdBy: req.userId
        }
      });
    }

    // Admin APIキーを暗号化して保存
    const encryptedApiKey = systemConfig.encryptApiKey(
      adminApiKey, 
      systemConfig.encryptionSecret || process.env.API_KEY_ENCRYPTION_SECRET
    );
    systemConfig.adminApiKey = encryptedApiKey;
    systemConfig.updatedAt = new Date();
    
    // メタデータに更新情報を追加
    if (!systemConfig.metadata) {
      systemConfig.metadata = new Map();
    }
    systemConfig.metadata.set('lastUpdatedBy', req.userId);
    systemConfig.metadata.set('lastUpdatedAt', new Date());

    await systemConfig.save();

    // APIキーのバリデーションを実行（実際にAnthropicAPIを呼び出してテスト）
    try {
      // Admin APIキーを復号化
      const decryptedApiKey = systemConfig.decryptApiKey(
        systemConfig.adminApiKey,
        systemConfig.encryptionSecret || process.env.API_KEY_ENCRYPTION_SECRET
      );
      
      // Anthropicの組織情報を取得してテスト
      await anthropicAdminService.listWorkspaces(decryptedApiKey, false, 1);

      return res.status(200).json({
        message: 'Admin APIキーが正常に更新されました',
        status: 'success',
        verified: true
      });
    } catch (apiError) {
      // APIキーは保存されたが検証に失敗
      logger.error('Admin APIキー検証エラー:', apiError);
      return res.status(200).json({
        message: 'Admin APIキーは保存されましたが、検証に失敗しました。キーが有効か確認してください。',
        status: 'warning',
        verified: false,
        error: apiError.message
      });
    }
  } catch (error) {
    logger.error('Admin APIキー更新エラー:', error);
    return res.status(500).json({ error: 'Admin APIキーの更新に失敗しました' });
  }
};

/**
 * システム設定の説明を更新
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.updateSystemDescription = async (req, res) => {
  try {
    // スーパー管理者権限チェック
    if (req.userRole !== authConfig.roles.SUPER_ADMIN) {
      return res.status(403).json({ error: 'システム設定の更新にはスーパー管理者権限が必要です' });
    }

    const { description } = req.body;
    
    // 説明のバリデーション
    if (!description) {
      return res.status(400).json({ error: '説明は必須です' });
    }

    // システム設定を取得（ない場合は作成）
    let systemConfig = await SystemConfig.findOne();
    if (!systemConfig) {
      const encryptionSecret = SystemConfig.generateEncryptionSecret();
      systemConfig = new SystemConfig({
        encryptionSecret,
        metadata: {
          createdBy: req.userId
        }
      });
    }

    // 説明を更新
    systemConfig.description = description;
    systemConfig.updatedAt = new Date();
    
    await systemConfig.save();

    return res.status(200).json({
      message: 'システム設定の説明が更新されました',
      description: systemConfig.description
    });
  } catch (error) {
    logger.error('システム設定更新エラー:', error);
    return res.status(500).json({ error: 'システム設定の更新に失敗しました' });
  }
};

/**
 * Anthropicコンソールの設定を更新
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.updateAnthropicConsoleUrl = async (req, res) => {
  try {
    // スーパー管理者権限チェック
    if (req.userRole !== authConfig.roles.SUPER_ADMIN) {
      return res.status(403).json({ error: 'システム設定の更新にはスーパー管理者権限が必要です' });
    }

    const { anthropicConsoleUrl } = req.body;
    
    // URLのバリデーション
    if (!anthropicConsoleUrl || !anthropicConsoleUrl.startsWith('http')) {
      return res.status(400).json({ error: '有効なURLを入力してください' });
    }

    // システム設定を取得（ない場合は作成）
    let systemConfig = await SystemConfig.findOne();
    if (!systemConfig) {
      const encryptionSecret = SystemConfig.generateEncryptionSecret();
      systemConfig = new SystemConfig({
        encryptionSecret,
        metadata: {
          createdBy: req.userId
        }
      });
    }

    // URLを更新
    systemConfig.anthropicConsoleUrl = anthropicConsoleUrl;
    systemConfig.updatedAt = new Date();
    
    await systemConfig.save();

    return res.status(200).json({
      message: 'AnthropicコンソールURLが更新されました',
      anthropicConsoleUrl: systemConfig.anthropicConsoleUrl
    });
  } catch (error) {
    logger.error('システム設定更新エラー:', error);
    return res.status(500).json({ error: 'システム設定の更新に失敗しました' });
  }
};

/**
 * システム管理用のAPIキーをチェック
 * Anthropic APIの検証と使用可能性を確認
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.checkAdminApiKey = async (req, res) => {
  try {
    // スーパー管理者権限チェック
    if (req.userRole !== authConfig.roles.SUPER_ADMIN) {
      return res.status(403).json({ error: 'APIキーの検証にはスーパー管理者権限が必要です' });
    }

    // システム設定を取得
    const systemConfig = await SystemConfig.findOne();
    if (!systemConfig || !systemConfig.adminApiKey) {
      return res.status(404).json({ 
        error: 'Admin APIキーが設定されていません',
        hasApiKey: false
      });
    }

    try {
      // Admin APIキーを復号化
      const decryptedApiKey = systemConfig.decryptApiKey(
        systemConfig.adminApiKey,
        systemConfig.encryptionSecret || process.env.API_KEY_ENCRYPTION_SECRET
      );
      
      // Anthropicの組織情報を取得してテスト
      const result = await anthropicAdminService.listWorkspaces(decryptedApiKey, false, 1);
      
      return res.status(200).json({
        status: 'success',
        message: 'Admin APIキーは有効です',
        hasApiKey: true,
        isValid: true,
        workspaceCount: result.data?.length || 0
      });
    } catch (apiError) {
      logger.error('Admin APIキー検証エラー:', apiError);
      return res.status(200).json({
        status: 'error',
        message: 'Admin APIキーは無効または期限切れです',
        hasApiKey: true,
        isValid: false,
        error: apiError.message
      });
    }
  } catch (error) {
    logger.error('Admin APIキー検証エラー:', error);
    return res.status(500).json({ error: 'Admin APIキーの検証に失敗しました' });
  }
};

/**
 * CSVファイルからトークン使用量データをインポート
 * Anthropicコンソールからダウンロードしたデータを処理
 * @param {Request} req - リクエスト
 * @param {Response} res - レスポンス
 */
exports.importCsvUsageData = async (req, res) => {
  try {
    // スーパー管理者権限チェック
    if (req.userRole !== authConfig.roles.SUPER_ADMIN) {
      return res.status(403).json({ error: 'データインポートにはスーパー管理者権限が必要です' });
    }

    // ファイルのチェック
    if (!req.file) {
      return res.status(400).json({ error: 'CSVファイルが提供されていません' });
    }

    // 組織IDを取得
    const { organizationId } = req.params;
    if (!organizationId) {
      return res.status(400).json({ error: '組織IDが指定されていません' });
    }

    // 組織の存在確認
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: '指定された組織が見つかりません' });
    }

    // CSVデータ処理の結果を保持する変数
    let recordsProcessed = 0;
    let recordsFailed = 0;
    let recordsSkipped = 0;
    let totalTokens = 0;
    const errors = [];
    const apiKeyUsage = new Map(); // APIキー別の使用量を集計
    
    // CSVデータの処理
    const results = [];
    
    // CSVパースストリームを作成
    const stream = Readable.from([req.file.buffer])
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_')
      }));
    
    // ストリーム処理
    for await (const data of stream) {
      try {
        // CSVデータのキーは小文字に変換して処理
        // AnthropicのCSVフォーマットに合わせてフィールドをマッピング
        
        // 必須フィールドのチェック
        const requiredFields = ['request_id', 'timestamp', 'api_key_id', 'input_tokens', 'output_tokens'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
          recordsSkipped++;
          errors.push(`行のデータに必須フィールドがありません: ${missingFields.join(', ')}`);
          continue;
        }
        
        // データの抽出とフォーマット
        const requestId = data.request_id;
        const timestamp = new Date(data.timestamp);
        const apiKeyId = data.api_key_id;
        const model = data.model || 'unknown';
        const inputTokens = parseInt(data.input_tokens, 10) || 0;
        const outputTokens = parseInt(data.output_tokens, 10) || 0;
        const totalRowTokens = inputTokens + outputTokens;
        
        // タイムスタンプの妥当性チェック
        if (isNaN(timestamp.getTime())) {
          recordsSkipped++;
          errors.push(`無効なタイムスタンプ: ${data.timestamp}`);
          continue;
        }
        
        // 同一リクエストIDの重複チェック
        const existingRequest = await ApiUsage.findOne({ 
          'request.requestId': requestId 
        });
        
        if (existingRequest) {
          recordsSkipped++;
          continue; // 重複はスキップ
        }
        
        // APIキーとユーザーのマッピングをチェック
        let userId = null;
        let workspaceId = null;
        
        // APIキーIDからユーザーを検索
        const user = await User.findOne({ 'apiKeyInfo.keyId': apiKeyId });
        if (user) {
          userId = user._id;
          
          // 組織のプライマリワークスペースを使用
          if (user.organizations && user.organizations.primaryWorkspace) {
            workspaceId = user.organizations.primaryWorkspace;
          }
          
          // APIキー別の使用量を集計
          if (!apiKeyUsage.has(apiKeyId)) {
            apiKeyUsage.set(apiKeyId, {
              userId: user._id,
              userName: user.name,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              requests: 0
            });
          }
          
          const keyStats = apiKeyUsage.get(apiKeyId);
          keyStats.inputTokens += inputTokens;
          keyStats.outputTokens += outputTokens;
          keyStats.totalTokens += totalRowTokens;
          keyStats.requests += 1;
        } else {
          // ユーザーが見つからない場合、組織の共有キーとして処理
          // 組織関連付けがあれば、それを使用
        }
        
        // 新しい使用履歴レコードを作成
        const apiUsage = new ApiUsage({
          userId: userId || organization.adminId, // ユーザーがなければ組織管理者に割り当て
          organizationId: organization._id,
          workspaceId: workspaceId || organization.defaultWorkspaceId,
          timestamp: timestamp,
          apiType: 'chat', // デフォルト値
          endpoint: data.endpoint || '/v1/messages',
          inputTokens: inputTokens,
          outputTokens: outputTokens,
          totalTokens: totalRowTokens,
          success: true, // CSVデータには成功したリクエストのみ含まれる想定
          request: {
            model: model,
            requestId: requestId,
            promptPreview: data.prompt_sample ? data.prompt_sample.substring(0, 50) : ''
          },
          metadata: {
            importSource: 'csv',
            importedAt: new Date(),
            apiKeyId: apiKeyId
          }
        });
        
        await apiUsage.save();
        
        recordsProcessed++;
        totalTokens += totalRowTokens;
      } catch (rowError) {
        recordsFailed++;
        errors.push(`行の処理中にエラーが発生しました: ${rowError.message}`);
        logger.error('CSVデータの行処理エラー:', rowError);
      }
    }
    
    // ユーザーのAPIキー使用統計を更新
    for (const [apiKeyId, stats] of apiKeyUsage.entries()) {
      try {
        const user = await User.findById(stats.userId);
        if (user && user.apiKeyInfo) {
          // 使用統計を更新
          if (!user.apiKeyInfo.usageStats) {
            user.apiKeyInfo.usageStats = {
              tokenCount: 0,
              lastSynced: new Date()
            };
          }
          
          // トークン数を累積
          user.apiKeyInfo.usageStats.tokenCount += stats.totalTokens;
          user.apiKeyInfo.usageStats.lastSynced = new Date();
          user.apiKeyInfo.lastUsed = new Date(); // 最終使用日時も更新
          
          await user.save();
        }
      } catch (userError) {
        logger.error(`ユーザー ${stats.userId} (${stats.userName}) の使用統計更新エラー:`, userError);
        errors.push(`ユーザー ${stats.userName} の統計更新に失敗しました`);
      }
    }
    
    return res.status(200).json({
      message: 'CSVデータのインポートが完了しました',
      stats: {
        recordsProcessed,
        recordsFailed,
        recordsSkipped,
        totalTokens,
        organizationId: organization._id,
        organizationName: organization.name,
        userStats: Array.from(apiKeyUsage.entries()).map(([keyId, stats]) => ({
          apiKeyId: keyId,
          userId: stats.userId,
          userName: stats.userName,
          totalTokens: stats.totalTokens,
          requests: stats.requests
        }))
      },
      errors: errors.length > 5 ? errors.slice(0, 5).concat([`他 ${errors.length - 5} 件のエラーがあります`]) : errors
    });
  } catch (error) {
    logger.error('CSV使用量データのインポートエラー:', error);
    return res.status(500).json({ error: 'CSVデータのインポートに失敗しました' });
  }
};