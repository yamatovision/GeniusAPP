const Invitation = require('../models/invitation.model');
const Organization = require('../models/organization.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.config');

/**
 * 招待管理コントローラー
 * 組織メンバー招待の作成、表示、承諾、キャンセル機能を提供
 */
const InvitationController = {
  /**
   * 新規招待の作成
   * メンバー招待を作成し、APIキーを予約する
   */
  createInvitation: async (req, res) => {
    const { email, role, message } = req.body;
    const organizationId = req.params.id;

    try {
      // 組織の確認
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // 呼び出し元がこの組織の管理者かどうかを確認
      const isAdmin = organization.isAdmin(req.userId);
      if (!isAdmin) {
        return res.status(403).json({ error: '組織の管理者のみがメンバーを招待できます' });
      }

      // すでに組織のメンバーかどうかを確認
      const existingUser = await User.findOne({ email });
      if (existingUser && organization.isMember(existingUser._id)) {
        return res.status(400).json({ error: 'このユーザーはすでに組織のメンバーです' });
      }

      // APIキープールに利用可能なキーがあるか確認 (将来実装)
      /*
      const hasAvailableKeys = organization.availableApiKeys && organization.availableApiKeys.length > 0;
      if (!hasAvailableKeys) {
        return res.status(400).json({ error: '利用可能なAPIキーがありません。管理者にお問い合わせください' });
      }

      // APIキーを予約
      const reservedApiKey = organization.availableApiKeys[0];
      */

      // 既存の未処理招待を確認
      const existingInvitation = await Invitation.findOne({
        email,
        organizationId,
        status: 'pending'
      });

      if (existingInvitation) {
        return res.status(400).json({ error: 'このメールアドレスへの招待が既に存在します' });
      }

      // トークンを生成
      const token = Invitation.generateToken();
      
      // 有効期限を設定（48時間）
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      // 招待を作成
      const invitation = new Invitation({
        email,
        organizationId,
        invitedBy: req.userId,
        role: role || 'member',
        token,
        expiresAt,
        message,
        // reservedApiKeyId: reservedApiKey.keyId
      });

      await invitation.save();

      // TODO: 招待メールを送信

      res.status(201).json({
        message: '招待が作成されました',
        invitation: {
          id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error) {
      console.error('招待作成エラー:', error);
      res.status(500).json({ error: '招待の作成中にエラーが発生しました' });
    }
  },

  /**
   * 組織の招待一覧を取得
   */
  getOrganizationInvitations: async (req, res) => {
    const organizationId = req.params.id;

    try {
      // 組織の確認
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // 呼び出し元がこの組織のメンバーかどうかを確認
      const isMember = organization.isMember(req.userId);
      if (!isMember) {
        return res.status(403).json({ error: '組織のメンバーのみが招待を閲覧できます' });
      }

      // 招待一覧を取得
      const invitations = await Invitation.find({
        organizationId,
        status: 'pending' // 保留中の招待のみ
      }).populate('invitedBy', 'username email');

      res.json(invitations.map(invitation => ({
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt
      })));
    } catch (error) {
      console.error('招待一覧取得エラー:', error);
      res.status(500).json({ error: '招待一覧の取得中にエラーが発生しました' });
    }
  },

  /**
   * 招待をキャンセル
   */
  cancelInvitation: async (req, res) => {
    const { id, invitationId } = req.params;

    try {
      // 組織の確認
      const organization = await Organization.findById(id);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // 呼び出し元がこの組織の管理者かどうかを確認
      const isAdmin = organization.isAdmin(req.userId);
      if (!isAdmin) {
        return res.status(403).json({ error: '組織の管理者のみが招待をキャンセルできます' });
      }

      // 招待を検索
      const invitation = await Invitation.findOne({
        _id: invitationId,
        organizationId: id
      });

      if (!invitation) {
        return res.status(404).json({ error: '招待が見つかりません' });
      }

      // 招待をキャンセル
      invitation.status = 'expired';
      await invitation.save();

      // TODO: APIキーの予約を解除

      res.json({ message: '招待がキャンセルされました' });
    } catch (error) {
      console.error('招待キャンセルエラー:', error);
      res.status(500).json({ error: '招待のキャンセル中にエラーが発生しました' });
    }
  },

  /**
   * 招待を検証（トークンで招待情報を取得）
   */
  verifyInvitation: async (req, res) => {
    const { token } = req.params;

    try {
      // 有効な招待を検索
      const invitation = await Invitation.findValidByToken(token)
        .populate('organizationId', 'name')
        .populate('invitedBy', 'username email');

      if (!invitation) {
        return res.status(404).json({ error: '有効な招待が見つかりません' });
      }

      // 既存のユーザーを確認
      const existingUser = await User.findOne({ email: invitation.email });

      res.json({
        invitation: {
          email: invitation.email,
          organization: invitation.organizationId.name,
          role: invitation.role,
          invitedBy: invitation.invitedBy,
          expiresAt: invitation.expiresAt
        },
        userExists: !!existingUser
      });
    } catch (error) {
      console.error('招待検証エラー:', error);
      res.status(500).json({ error: '招待の検証中にエラーが発生しました' });
    }
  },

  /**
   * 招待を承諾（新規ユーザー登録）
   */
  acceptInvitationNewUser: async (req, res) => {
    const { token } = req.params;
    const { username, password } = req.body;

    try {
      // 有効な招待を検索
      const invitation = await Invitation.findValidByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: '有効な招待が見つかりません' });
      }

      // 既存のユーザーを確認
      const existingUser = await User.findOne({ email: invitation.email });
      if (existingUser) {
        return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
      }

      // 組織を確認
      const organization = await Organization.findById(invitation.organizationId);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // APIキーを割り当て (将来実装)
      // let apiKeyInfo = null;
      /*
      if (invitation.reservedApiKeyId) {
        const keyIndex = organization.availableApiKeys.findIndex(k => k.keyId === invitation.reservedApiKeyId);
        if (keyIndex >= 0) {
          const apiKey = organization.availableApiKeys[keyIndex];
          apiKeyInfo = {
            keyId: apiKey.keyId,
            status: 'active',
            organizationId: organization._id,
            usageStats: {
              tokenCount: 0,
              lastSynced: new Date()
            }
          };
          
          // キーをプールから削除
          organization.availableApiKeys.splice(keyIndex, 1);
          await organization.save();
        }
      }
      */

      // 新規ユーザーを作成
      const user = new User({
        name: username,
        email: invitation.email,
        password,
        role: 'user',
        accountStatus: 'active',
        // apiKeyInfo
      });

      await user.save();

      // 組織にメンバーを追加
      organization.members.push({
        userId: user._id,
        role: invitation.role,
        joinedAt: new Date()
      });

      await organization.save();

      // ユーザーのプライマリ組織を設定
      await user.setPrimaryOrganization(organization._id, invitation.role);

      // 招待を承諾済みにマーク
      invitation.status = 'accepted';
      await invitation.save();

      // 認証トークンを生成
      const accessToken = jwt.sign({ id: user._id }, authConfig.secret, {
        expiresIn: authConfig.tokenSettings.accessToken.expiresIn
      });

      const refreshToken = jwt.sign({ id: user._id }, authConfig.refreshSecret, {
        expiresIn: authConfig.tokenSettings.refreshToken.expiresIn
      });

      // リフレッシュトークンをユーザーに保存
      await user.updateRefreshToken(refreshToken, {
        userAgent: req.headers['user-agent'] || '',
        ipAddress: req.ip || ''
      });

      res.json({
        message: '招待を承諾し、アカウントが作成されました',
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: {
            id: organization._id,
            name: organization.name,
            role: invitation.role
          }
        }
      });
    } catch (error) {
      console.error('招待承諾エラー:', error);
      res.status(500).json({ error: '招待の承諾中にエラーが発生しました' });
    }
  },

  /**
   * 招待を承諾（既存ユーザー）
   */
  acceptInvitationExistingUser: async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
      // 有効な招待を検索
      const invitation = await Invitation.findValidByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: '有効な招待が見つかりません' });
      }

      // 既存のユーザーを確認
      const user = await User.findOne({ email: invitation.email });
      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }

      // パスワードを検証
      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'パスワードが無効です' });
      }

      // 組織を確認
      const organization = await Organization.findById(invitation.organizationId);
      if (!organization) {
        return res.status(404).json({ error: '組織が見つかりません' });
      }

      // すでに組織のメンバーかどうかを確認
      if (organization.isMember(user._id)) {
        return res.status(400).json({ error: 'あなたはすでにこの組織のメンバーです' });
      }

      // APIキーを割り当て (将来実装)
      /*
      if (invitation.reservedApiKeyId && !user.apiKeyInfo) {
        const keyIndex = organization.availableApiKeys.findIndex(k => k.keyId === invitation.reservedApiKeyId);
        if (keyIndex >= 0) {
          const apiKey = organization.availableApiKeys[keyIndex];
          user.apiKeyInfo = {
            keyId: apiKey.keyId,
            status: 'active',
            organizationId: organization._id,
            usageStats: {
              tokenCount: 0,
              lastSynced: new Date()
            }
          };
          
          // キーをプールから削除
          organization.availableApiKeys.splice(keyIndex, 1);
          await organization.save();
        }
      }
      */

      // 組織にメンバーを追加
      organization.members.push({
        userId: user._id,
        role: invitation.role,
        joinedAt: new Date()
      });

      await organization.save();

      // ユーザーにプライマリ組織がなければ設定
      if (!user.organizations?.primary) {
        await user.setPrimaryOrganization(organization._id, invitation.role);
      }

      // ユーザー情報を保存
      await user.save();

      // 招待を承諾済みにマーク
      invitation.status = 'accepted';
      await invitation.save();

      // 認証トークンを生成
      const accessToken = jwt.sign({ id: user._id }, authConfig.secret, {
        expiresIn: authConfig.tokenSettings.accessToken.expiresIn
      });

      const refreshToken = jwt.sign({ id: user._id }, authConfig.refreshSecret, {
        expiresIn: authConfig.tokenSettings.refreshToken.expiresIn
      });

      // リフレッシュトークンをユーザーに保存
      await user.updateRefreshToken(refreshToken, {
        userAgent: req.headers['user-agent'] || '',
        ipAddress: req.ip || ''
      });

      res.json({
        message: '招待を承諾し、組織に参加しました',
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: {
            id: organization._id,
            name: organization.name,
            role: invitation.role
          }
        }
      });
    } catch (error) {
      console.error('招待承諾エラー:', error);
      res.status(500).json({ error: '招待の承諾中にエラーが発生しました' });
    }
  }
};

module.exports = InvitationController;