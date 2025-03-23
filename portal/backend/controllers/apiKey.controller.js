const Organization = require('../models/organization.model');
const User = require('../models/user.model');
const crypto = require('crypto');
const mongoose = require('mongoose');
const csv = require('csv-parser');
const { Readable } = require('stream');

// APIキー暗号化用の設定
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || 'default-secret-key-change-in-production';
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

/**
 * APIキーの暗号化ユーティリティ
 */
const encryptionUtil = {
  // APIキーの暗号化
  encryptApiKey: (apiKey) => {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('APIキー暗号化エラー:', error);
      throw new Error('APIキーの暗号化に失敗しました');
    }
  },

  // APIキーの復号化
  decryptApiKey: (encryptedKey) => {
    try {
      const [ivHex, encryptedText] = encryptedKey.split(':');
      if (!ivHex || !encryptedText) {
        throw new Error('暗号化形式が不正です');
      }
      
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('APIキー復号化エラー:', error);
      throw new Error('APIキーの復号化に失敗しました');
    }
  }
};

/**
 * APIキー管理コントローラー
 * 組織のAPIキープール管理とユーザーへの割り当て機能を提供
 */
const ApiKeyController = {
  /**
   * 組織のAPIキープールに新しいAPIキーを追加
   */
  addApiKeyToPool: async (req, res) => {
    const { id } = req.params;
    const { keyId, apiKey, name, description } = req.body;

    try {
      // スーパー管理者のみ許可
      const user = await User.findById(req.userId);
      if (!user || !user.isSuperAdmin()) {
        return res.status(403).json({ error: 'スーパー管理者のみがキーを追加できます' });
      }

      // 組織を検索
      const organization = await Organization.findById(id);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // 入力検証
      if (!keyId || !apiKey) {
        return res.status(400).json({ error: 'keyIdとapiKeyは必須です' });
      }

      // 重複チェック
      if (organization.availableApiKeys && organization.availableApiKeys.some(k => k.keyId === keyId)) {
        return res.status(400).json({ error: '同じkeyIdのキーが既に存在します' });
      }

      // APIキーの暗号化
      const encryptedApiKey = encryptionUtil.encryptApiKey(apiKey);

      // APIキーをプールに追加
      const newApiKey = {
        keyId,
        apiKey: encryptedApiKey,
        name: name || `Key-${Date.now()}`,
        description: description || ''
      };

      organization.availableApiKeys = organization.availableApiKeys || [];
      organization.availableApiKeys.push(newApiKey);
      await organization.save();

      res.status(201).json({
        message: 'APIキーがプールに追加されました',
        keyId: newApiKey.keyId,
        name: newApiKey.name
      });
    } catch (error) {
      console.error('APIキー追加エラー:', error);
      res.status(500).json({ error: 'APIキーの追加中にエラーが発生しました' });
    }
  },

  /**
   * 組織のAPIキープールを取得
   */
  getApiKeyPool: async (req, res) => {
    const { id } = req.params;

    try {
      // スーパー管理者または組織管理者のみ許可
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }

      const isSuperAdmin = user.isSuperAdmin();
      
      // 組織を検索
      const organization = await Organization.findById(id);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // 一般管理者の場合は組織の管理者かをチェック
      if (!isSuperAdmin && !organization.isAdmin(req.userId)) {
        return res.status(403).json({ error: '組織の管理者のみがキープールを閲覧できます' });
      }

      // APIキー情報をマスク化して返す
      const maskedKeys = (organization.availableApiKeys || []).map(key => ({
        keyId: key.keyId,
        name: key.name,
        description: key.description,
        // 管理者のみがキーの最初の部分を見れる
        maskedKey: isSuperAdmin ? 
          `${key.apiKey.substring(0, 8)}...${key.apiKey.substring(key.apiKey.length - 4)}` : 
          null
      }));

      res.json({
        organizationId: organization._id,
        availableApiKeys: maskedKeys,
        count: maskedKeys.length
      });
    } catch (error) {
      console.error('APIキープール取得エラー:', error);
      res.status(500).json({ error: 'APIキープールの取得中にエラーが発生しました' });
    }
  },

  /**
   * 組織のAPIキープールからキーを削除
   */
  removeApiKeyFromPool: async (req, res) => {
    const { id, keyId } = req.params;

    try {
      // スーパー管理者のみ許可
      const user = await User.findById(req.userId);
      if (!user || !user.isSuperAdmin()) {
        return res.status(403).json({ error: 'スーパー管理者のみがキーを削除できます' });
      }

      // 組織を検索
      const organization = await Organization.findById(id);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // キーが存在するかチェック
      if (!organization.availableApiKeys || !organization.availableApiKeys.some(k => k.keyId === keyId)) {
        return res.status(404).json({ error: '指定されたAPIキーが見つかりません' });
      }

      // キーをプールから削除
      organization.availableApiKeys = organization.availableApiKeys.filter(k => k.keyId !== keyId);
      await organization.save();

      res.json({ message: 'APIキーがプールから削除されました' });
    } catch (error) {
      console.error('APIキー削除エラー:', error);
      res.status(500).json({ error: 'APIキーの削除中にエラーが発生しました' });
    }
  },

  /**
   * ユーザーのAPIキー状態を更新（有効化/無効化）
   */
  updateUserApiKeyStatus: async (req, res) => {
    const { id, userId } = req.params;
    const { status } = req.body;

    if (!['active', 'disabled', 'revoked'].includes(status)) {
      return res.status(400).json({ error: '無効なステータスです。active, disabled, revoked のいずれかを指定してください' });
    }

    try {
      // 組織を検索
      const organization = await Organization.findById(id);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // 呼び出し元が組織の管理者かチェック
      if (!organization.isAdmin(req.userId)) {
        const user = await User.findById(req.userId);
        if (!user || !user.isSuperAdmin()) {
          return res.status(403).json({ error: '組織の管理者のみがユーザーのAPIキー状態を変更できます' });
        }
      }

      // ユーザーが組織のメンバーかチェック
      if (!organization.isMember(userId)) {
        return res.status(400).json({ error: '指定されたユーザーはこの組織のメンバーではありません' });
      }

      // ユーザーを検索
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }

      // APIキー情報が存在するかチェック
      if (!user.apiKeyInfo) {
        return res.status(400).json({ error: 'このユーザーにはAPIキーが割り当てられていません' });
      }

      // 状態を更新
      user.apiKeyInfo.status = status;
      user.apiKeyInfo.lastUsed = user.apiKeyInfo.lastUsed || new Date(); 
      await user.save();

      res.json({
        message: `ユーザーのAPIキー状態が ${status} に更新されました`,
        userId: user._id,
        keyId: user.apiKeyInfo.keyId,
        status: user.apiKeyInfo.status
      });
    } catch (error) {
      console.error('APIキー状態更新エラー:', error);
      res.status(500).json({ error: 'APIキー状態の更新中にエラーが発生しました' });
    }
  },

  /**
   * ユーザーのAPIキーを再割り当て
   */
  reassignUserApiKey: async (req, res) => {
    const { id, userId } = req.params;

    try {
      // 組織を検索
      const organization = await Organization.findById(id);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // 呼び出し元が組織の管理者かチェック
      if (!organization.isAdmin(req.userId)) {
        const user = await User.findById(req.userId);
        if (!user || !user.isSuperAdmin()) {
          return res.status(403).json({ error: '組織の管理者のみがユーザーのAPIキーを再割り当てできます' });
        }
      }

      // ユーザーが組織のメンバーかチェック
      if (!organization.isMember(userId)) {
        return res.status(400).json({ error: '指定されたユーザーはこの組織のメンバーではありません' });
      }

      // ユーザーを検索
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }

      // 利用可能なAPIキーを確認
      if (!organization.availableApiKeys || organization.availableApiKeys.length === 0) {
        return res.status(400).json({ error: '利用可能なAPIキーがありません' });
      }

      // 現在のAPIキーを復旧可能な形で保存（オプション）
      if (user.apiKeyInfo && user.apiKeyInfo.keyId) {
        // 必要に応じて古いキーの履歴を保存する場合はここにロジックを追加
      }

      // 新しいAPIキーを割り当て
      const newApiKey = organization.assignApiKeyFromPool();
      if (!newApiKey) {
        return res.status(400).json({ error: '利用可能なAPIキーがありません' });
      }

      // ユーザーのAPIキー情報を更新
      user.apiKeyInfo = {
        keyId: newApiKey.keyId,
        status: 'active',
        lastUsed: new Date(),
        organizationId: organization._id,
        usageStats: {
          tokenCount: 0,
          lastSynced: new Date()
        }
      };

      await Promise.all([
        user.save(),
        organization.save()
      ]);

      res.json({
        message: 'ユーザーに新しいAPIキーが割り当てられました',
        userId: user._id,
        keyId: newApiKey.keyId,
        status: 'active'
      });
    } catch (error) {
      console.error('APIキー再割り当てエラー:', error);
      res.status(500).json({ error: 'APIキーの再割り当て中にエラーが発生しました' });
    }
  },

  /**
   * 組織メンバーの使用状況を取得
   */
  getUsersApiKeyUsage: async (req, res) => {
    const { id } = req.params;

    try {
      // 組織を検索
      const organization = await Organization.findById(id);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // 呼び出し元が組織のメンバーかチェック
      if (!organization.isMember(req.userId)) {
        const user = await User.findById(req.userId);
        if (!user || !user.isSuperAdmin()) {
          return res.status(403).json({ error: '組織のメンバーのみが使用状況を取得できます' });
        }
      }

      // メンバーのIDを取得
      const memberIds = organization.members.map(member => member.userId);

      // APIキー使用情報を持つメンバーを取得
      const members = await User.find({
        _id: { $in: memberIds },
        'apiKeyInfo.organizationId': organization._id
      }).select('_id name email apiKeyInfo');

      // 使用状況データを整形
      const usageData = members.map(member => {
        const role = organization.getMemberRole(member._id);
        return {
          userId: member._id,
          name: member.name,
          email: member.email,
          role,
          apiKey: member.apiKeyInfo ? {
            keyId: member.apiKeyInfo.keyId,
            status: member.apiKeyInfo.status,
            lastUsed: member.apiKeyInfo.lastUsed,
            usageStats: member.apiKeyInfo.usageStats
          } : null
        };
      });

      res.json({
        organizationId: organization._id,
        members: usageData
      });
    } catch (error) {
      console.error('APIキー使用状況取得エラー:', error);
      res.status(500).json({ error: 'APIキー使用状況の取得中にエラーが発生しました' });
    }
  },

  /**
   * 特定ユーザーのAPIキー詳細使用履歴を取得
   */
  getUserApiKeyDetails: async (req, res) => {
    const { userId } = req.params;

    try {
      // ユーザーを検索
      const user = await User.findById(userId).select('_id name email apiKeyInfo');
      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }

      // APIキー情報が存在するかチェック
      if (!user.apiKeyInfo) {
        return res.status(400).json({ error: 'このユーザーにはAPIキーが割り当てられていません' });
      }

      // 呼び出し元の権限チェック
      const requestingUser = await User.findById(req.userId);
      const isSuperAdmin = requestingUser && requestingUser.isSuperAdmin();
      
      // スーパー管理者でない場合、組織のチェックが必要
      if (!isSuperAdmin) {
        if (req.userId !== userId.toString()) {
          // 組織を取得
          const organization = await Organization.findById(user.apiKeyInfo.organizationId);
          if (!organization || !organization.isAdmin(req.userId)) {
            return res.status(403).json({ error: 'この情報にアクセスする権限がありません' });
          }
        }
      }

      // TODO: 実際の実装ではここでAPI使用履歴を取得し、usageHistory配列に格納する
      // ここではダミーデータを生成
      const usageHistory = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return {
          date: date.toISOString().split('T')[0],
          tokenCount: Math.floor(Math.random() * 5000) + 1000
        };
      });

      res.json({
        userId: user._id,
        name: user.name,
        email: user.email,
        apiKeyDetails: {
          keyId: user.apiKeyInfo.keyId,
          status: user.apiKeyInfo.status,
          lastUsed: user.apiKeyInfo.lastUsed,
          organizationId: user.apiKeyInfo.organizationId,
          usageStats: user.apiKeyInfo.usageStats,
          usageHistory
        }
      });
    } catch (error) {
      console.error('APIキー詳細取得エラー:', error);
      res.status(500).json({ error: 'APIキー詳細の取得中にエラーが発生しました' });
    }
  },

  /**
   * CSVファイルからAPIキーを一括インポート
   */
  importApiKeysFromCSV: async (req, res) => {
    const { id } = req.params;
    
    if (!req.files || !req.files.csvFile) {
      return res.status(400).json({ error: 'CSVファイルが見つかりません' });
    }

    try {
      // スーパー管理者のみ許可
      const user = await User.findById(req.userId);
      if (!user || !user.isSuperAdmin()) {
        return res.status(403).json({ error: 'スーパー管理者のみがAPIキーを一括インポートできます' });
      }

      // 組織を検索
      const organization = await Organization.findById(id);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      const csvFile = req.files.csvFile;
      const results = [];
      const errors = [];
      
      // CSVパーサー設定
      const stream = Readable.from(csvFile.data.toString());
      
      // CSVを解析
      await new Promise((resolve, reject) => {
        stream
          .pipe(csv())
          .on('data', async (data) => {
            try {
              // CSVの想定形式: keyName,keyId,actualKey
              const { keyName, keyId, actualKey } = data;
              
              // 入力検証
              if (!keyId || !actualKey) {
                errors.push({ row: results.length + errors.length + 1, error: 'keyIdまたはactualKeyが不足しています' });
                return;
              }
              
              // 重複チェック
              if (organization.availableApiKeys && organization.availableApiKeys.some(k => k.keyId === keyId)) {
                errors.push({ row: results.length + errors.length + 1, error: `同じkeyId(${keyId})のキーが既に存在します` });
                return;
              }
              
              // APIキーの暗号化
              const encryptedApiKey = encryptionUtil.encryptApiKey(actualKey);
              
              // 結果に追加
              results.push({
                keyId,
                apiKey: encryptedApiKey,
                name: keyName || `Key-${keyId}`,
                description: ''
              });
            } catch (error) {
              errors.push({ row: results.length + errors.length + 1, error: error.message });
            }
          })
          .on('end', () => resolve())
          .on('error', (error) => reject(error));
      });
      
      // 少なくとも1つのキーが解析できた場合はインポート
      if (results.length > 0) {
        organization.availableApiKeys = organization.availableApiKeys || [];
        organization.availableApiKeys.push(...results);
        await organization.save();
      }
      
      res.json({
        message: '処理が完了しました',
        imported: results.length,
        errors: errors.length,
        details: {
          success: results.map(r => ({ keyId: r.keyId, name: r.name })),
          failed: errors
        }
      });
    } catch (error) {
      console.error('CSVインポートエラー:', error);
      res.status(500).json({ error: 'CSVからのAPIキーインポート中にエラーが発生しました' });
    }
  },

  /**
   * ユーザーにAPIキーを一括割り当て
   */
  bulkAssignApiKeys: async (req, res) => {
    const { id } = req.params;
    const { assignments } = req.body;

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: '有効な割り当て情報が必要です' });
    }

    try {
      // 組織管理者または管理者のみ許可
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }

      const isSuperAdmin = user.isSuperAdmin();
      
      // 組織を検索
      const organization = await Organization.findById(id);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // 一般管理者の場合は組織の管理者かをチェック
      if (!isSuperAdmin && !organization.isAdmin(req.userId)) {
        return res.status(403).json({ error: '組織の管理者のみがAPIキーを割り当てられます' });
      }

      // 結果保存用配列
      const results = [];
      const errors = [];
      
      // 各割り当てを処理
      for (const assignment of assignments) {
        const { userId, keyId } = assignment;
        
        try {
          // ユーザーと組織のメンバーシップをチェック
          const targetUser = await User.findById(userId);
          if (!targetUser) {
            errors.push({ userId, error: 'ユーザーが見つかりません' });
            continue;
          }
          
          if (!organization.isMember(userId)) {
            errors.push({ userId, error: 'このユーザーは組織のメンバーではありません' });
            continue;
          }
          
          // 特定のキーIDが指定された場合
          if (keyId) {
            // 指定されたキーを探す
            const keyIndex = organization.availableApiKeys.findIndex(k => k.keyId === keyId);
            if (keyIndex === -1) {
              errors.push({ userId, keyId, error: '指定されたAPIキーが見つかりません' });
              continue;
            }
            
            // キーを取得して削除
            const apiKey = organization.availableApiKeys[keyIndex];
            organization.availableApiKeys.splice(keyIndex, 1);
            
            // ユーザーにAPIキーを割り当て
            targetUser.apiKeyInfo = {
              keyId: apiKey.keyId,
              status: 'active',
              lastUsed: new Date(),
              organizationId: organization._id,
              usageStats: {
                tokenCount: 0,
                lastSynced: new Date()
              }
            };
            
            await targetUser.save();
            results.push({ userId: targetUser._id, name: targetUser.name, keyId: apiKey.keyId });
          } else {
            // 利用可能なキーがあるか確認
            if (!organization.availableApiKeys || organization.availableApiKeys.length === 0) {
              errors.push({ userId, error: '利用可能なAPIキーがありません' });
              continue;
            }
            
            // 自動で次のキーを割り当て
            const apiKey = organization.assignApiKeyFromPool();
            if (!apiKey) {
              errors.push({ userId, error: '利用可能なAPIキーがありません' });
              continue;
            }
            
            // ユーザーにAPIキーを割り当て
            targetUser.apiKeyInfo = {
              keyId: apiKey.keyId,
              status: 'active',
              lastUsed: new Date(),
              organizationId: organization._id,
              usageStats: {
                tokenCount: 0,
                lastSynced: new Date()
              }
            };
            
            await targetUser.save();
            results.push({ userId: targetUser._id, name: targetUser.name, keyId: apiKey.keyId });
          }
        } catch (error) {
          console.error(`ユーザー(${userId})へのAPIキー割り当てエラー:`, error);
          errors.push({ userId, error: error.message });
        }
      }
      
      // 組織の変更を保存
      await organization.save();
      
      res.json({
        message: 'APIキー割り当て処理が完了しました',
        assigned: results.length,
        failed: errors.length,
        details: {
          success: results,
          errors: errors
        }
      });
    } catch (error) {
      console.error('一括APIキー割り当てエラー:', error);
      res.status(500).json({ error: 'APIキーの一括割り当て中にエラーが発生しました' });
    }
  }
};

module.exports = ApiKeyController;