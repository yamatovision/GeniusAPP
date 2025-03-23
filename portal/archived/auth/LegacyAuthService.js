/**
 * 認証サービス
 * ユーザー認証、トークン生成、検証などのビジネスロジックを提供します
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const authConfig = require('../config/auth.config');

/**
 * JWTアクセストークンを生成
 * @param {Object} user - ユーザーオブジェクト
 * @returns {String} 生成されたJWTトークン
 */
exports.generateAccessToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      role: user.role 
    }, 
    authConfig.jwtSecret, 
    {
      expiresIn: authConfig.jwtExpiry,
      issuer: authConfig.jwtOptions.issuer,
      audience: authConfig.jwtOptions.audience
    }
  );
};

/**
 * リフレッシュトークンを生成
 * @param {Object} user - ユーザーオブジェクト
 * @returns {String} 生成されたリフレッシュトークン
 */
exports.generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id }, 
    authConfig.refreshTokenSecret, 
    { 
      expiresIn: authConfig.refreshTokenExpiry,
      issuer: authConfig.jwtOptions.issuer,
      audience: authConfig.jwtOptions.audience
    }
  );
};

/**
 * ユーザー登録
 * @param {Object} userData - ユーザー登録データ
 * @returns {Object} 作成されたユーザーとトークン
 */
exports.register = async (userData) => {
  try {
    // メールアドレスが既に使用されていないか確認
    const existingUser = await User.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('このメールアドレスは既に使用されています');
    }

    // 新しいユーザーを作成
    const user = new User({
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role || 'user' // ユーザーモデルの enum: ['user', 'admin', 'super_admin'] に合わせる
    });

    // ユーザーを保存（パスワードは自動的にハッシュ化される）
    await user.save();

    // トークン生成
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // リフレッシュトークンをユーザーに保存
    user.refreshToken = refreshToken;
    await user.save();

    // 更新日時を記録
    user.lastLogin = new Date();
    await user.save();

    return {
      user,
      accessToken,
      refreshToken
    };
  } catch (error) {
    throw error;
  }
};

/**
 * ユーザーログイン
 * @param {String} email - メールアドレス
 * @param {String} password - パスワード
 * @returns {Object} ユーザー情報とトークン
 */
exports.login = async (email, password) => {
  try {
    console.log("認証サービス: ログイン処理開始");
    
    // メールアドレスでユーザーを検索
    console.log(`認証サービス: メールアドレスでユーザー検索 - ${email}`);
    let user;
    try {
      user = await User.findByEmail(email);
      console.log("認証サービス: ユーザー検索結果:", user ? "ユーザー見つかりました" : "ユーザー見つかりません");
    } catch (dbError) {
      console.error("認証サービス: ユーザー検索中のDBエラー:", dbError);
      throw new Error(`データベース検索エラー: ${dbError.message}`);
    }
    
    if (!user) {
      console.log("認証サービス: ユーザーが見つかりません");
      throw new Error('ユーザーが見つかりません');
    }

    // アカウント状態チェック（新方式：accountStatusフィールド）
    if (user.accountStatus) {
      console.log("認証サービス: 新方式でのアカウント状態チェック - 状態:", user.accountStatus);
      
      if (user.accountStatus === authConfig.accountStatus.DEACTIVATED) {
        console.log("認証サービス: アカウントが削除されています");
        throw new Error('アカウントが削除または無効化されています。再登録が必要です。');
      }
      
      if (user.accountStatus === authConfig.accountStatus.SUSPENDED) {
        console.log("認証サービス: アカウントが一時停止されています");
        throw new Error('アカウントが一時停止されています。管理者にお問い合わせください。');
      }
      
      // アカウント状態が有効であってもisAccountActive()メソッドを使って二重チェック
      if (!user.isAccountActive()) {
        console.log("認証サービス: isAccountActiveによる追加チェックで無効と判定");
        throw new Error('アカウントが無効状態です。管理者にお問い合わせください。');
      }
    } 
    // 旧方式のチェック（後方互換性のため）
    else {
      console.log("認証サービス: 旧方式でのアカウント状態チェック - ロール:", user.role);
      
      // 退会済みユーザーはログイン不可
      if (user.role === authConfig.roles.INACTIVE || user.role === 'unsubscribed') {
        console.log("認証サービス: アカウントが無効化されています");
        throw new Error('アカウントが無効化されています。再登録が必要です。');
      }
    }
    
    // 未払いユーザーはログイン自体は可能
    if (user.role === authConfig.roles.UNPAID || user.role === 'unpaid') {
      console.log("認証サービス: 未払いアカウントです。ログインは許可しますが、APIアクセスは制限されます。");
    }

    // パスワードを検証
    console.log("認証サービス: パスワード検証開始");
    let isValidPassword;
    try {
      isValidPassword = await user.validatePassword(password);
      console.log("認証サービス: パスワード検証結果:", isValidPassword ? "成功" : "失敗");
    } catch (pwError) {
      console.error("認証サービス: パスワード検証エラー:", pwError);
      throw new Error(`パスワード検証エラー: ${pwError.message}`);
    }
    
    if (!isValidPassword) {
      console.log("認証サービス: パスワードが一致しません");
      throw new Error('パスワードが正しくありません');
    }

    // 組織情報の取得
    console.log("認証サービス: 組織情報の取得");
    let organizationInfo = {};
    
    // インポート組織やワークスペースモデル（遅延ロードしてシングルトンを避ける）
    const Organization = require('../models/organization.model');
    const Workspace = require('../models/workspace.model');
    
    try {
      // プライマリ組織情報の確認
      if (user.organizations && user.organizations.primary) {
        const organization = await Organization.findById(user.organizations.primary)
          .select('-adminApiKey'); // 機密情報は除外
          
        if (organization) {
          organizationInfo.primary = {
            id: organization._id,
            name: organization.name,
            role: organization.getMemberRole(user._id) || 'member'
          };
          
          // ワークスペース情報の取得
          let workspaces = await Workspace.find({
            organizationId: organization._id,
            isArchived: { $ne: true },
            'members.userId': user._id
          }).select('name description');
          
          // プライマリワークスペースの確認
          let primaryWorkspace = null;
          if (user.organizations.primaryWorkspace) {
            primaryWorkspace = workspaces.find(w => 
              w._id.toString() === user.organizations.primaryWorkspace.toString()
            );
          }
          
          // プライマリワークスペースがない場合は最初のワークスペースを使用
          if (!primaryWorkspace && workspaces.length > 0) {
            primaryWorkspace = workspaces[0];
            // ユーザー情報を更新
            user.organizations.primaryWorkspace = primaryWorkspace._id;
            await user.save();
          }
          
          organizationInfo.workspaces = workspaces.map(w => ({
            id: w._id,
            name: w.name,
            description: w.description,
            isPrimary: primaryWorkspace && w._id.toString() === primaryWorkspace._id.toString()
          }));
          
          if (primaryWorkspace) {
            organizationInfo.primaryWorkspace = {
              id: primaryWorkspace._id,
              name: primaryWorkspace.name
            };
          }
        }
      }
      
      // プライマリ組織が設定されていない場合、所属組織を検索
      if (!organizationInfo.primary) {
        const organizations = await Organization.find({
          'members.userId': user._id,
          isArchived: { $ne: true }
        }).select('-adminApiKey'); // 機密情報は除外
        
        if (organizations.length > 0) {
          // 最初の組織をプライマリとして設定
          const primaryOrg = organizations[0];
          user.organizations = user.organizations || {};
          user.organizations.primary = primaryOrg._id;
          
          // この組織のワークスペースも検索
          const workspaces = await Workspace.find({
            organizationId: primaryOrg._id,
            isArchived: { $ne: true },
            'members.userId': user._id
          }).select('name description');
          
          if (workspaces.length > 0) {
            user.organizations.primaryWorkspace = workspaces[0]._id;
          }
          
          await user.save();
          
          // 応答用の組織情報を設定
          organizationInfo.primary = {
            id: primaryOrg._id,
            name: primaryOrg.name,
            role: primaryOrg.getMemberRole(user._id) || 'member'
          };
          
          if (workspaces.length > 0) {
            organizationInfo.workspaces = workspaces.map(w => ({
              id: w._id,
              name: w.name,
              description: w.description,
              isPrimary: w._id.toString() === workspaces[0]._id.toString()
            }));
            
            organizationInfo.primaryWorkspace = {
              id: workspaces[0]._id,
              name: workspaces[0].name
            };
          }
        }
      }
    } catch (orgError) {
      console.error("認証サービス: 組織情報取得エラー:", orgError);
      // 組織情報取得エラーはログインを妨げないようにする
      organizationInfo = { error: "組織情報の取得中にエラーが発生しました" };
    }

    // トークン生成
    console.log("認証サービス: トークン生成開始");
    try {
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);
      console.log("認証サービス: トークン生成成功");

      // リフレッシュトークンをユーザーに保存
      console.log("認証サービス: ユーザー情報更新");
      user.refreshToken = refreshToken;
      
      // 最終ログイン日時を更新
      user.lastLogin = new Date();
      
      // ユーザー情報を保存（super_adminの場合の特別処理を廃止）
      try {
        console.log("認証サービス: ユーザー情報を保存します");
        await user.save();
        console.log("認証サービス: ユーザー情報更新成功");
      } catch (saveError) {
        console.error("認証サービス: ユーザー情報更新エラー:", saveError);
        throw new Error(`ユーザー保存エラー: ${saveError.message}`);
      }

      console.log("認証サービス: ログイン処理完了");
      return {
        user,
        accessToken,
        refreshToken,
        organizations: organizationInfo
      };
    } catch (tokenError) {
      console.error("認証サービス: トークン生成/保存エラー:", tokenError);
      throw tokenError;
    }
  } catch (error) {
    console.error("認証サービス: ログイン処理失敗:", error);
    throw error;
  }
};

/**
 * アクセストークンをリフレッシュ
 * 
 * 改善点:
 * - VSCode拡張用の特別な処理を追加
 * - リフレッシュトークンの再利用期間を設定（グレースピリオド）
 * - 有効期限切れトークンの猶予期間を設定
 * - トークン検証エラーの詳細ログを追加
 * - トークン更新履歴の記録
 * 
 * @param {String} refreshToken - リフレッシュトークン
 * @param {Object} options - 追加オプション
 * @param {Boolean} options.isVSCodeClient - VSCode拡張からのリクエストかどうか
 * @param {Boolean} options.extendedSession - セッション延長を行うかどうか
 * @param {String} options.userAgent - ユーザーエージェント情報
 * @param {String} options.ipAddress - クライアントIPアドレス
 * @returns {Object} 新しいトークン情報
 */
exports.refreshToken = async (refreshToken, options = {}) => {
  try {
    const {
      isVSCodeClient = false,
      extendedSession = false,
      userAgent = 'unknown',
      ipAddress = 'unknown'
    } = options;
    
    console.log(`認証サービス: トークンリフレッシュ開始 (VSCode: ${isVSCodeClient}, 延長: ${extendedSession})`);
    
    // トークン検証オプション
    const verifyOptions = {
      clockTolerance: authConfig.tokenSettings?.validation?.jwtClockTolerance || 30, // 時刻ズレの許容値（秒）
      issuer: authConfig.jwtOptions.issuer,
      audience: authConfig.jwtOptions.audience
    };
    
    let decoded;
    try {
      // リフレッシュトークンを検証
      decoded = jwt.verify(refreshToken, authConfig.refreshTokenSecret, verifyOptions);
      console.log(`認証サービス: リフレッシュトークン検証成功 (ユーザーID: ${decoded.id})`);
    } catch (tokenError) {
      // 期限切れエラーの場合、猶予期間内かどうかを確認
      if (tokenError.name === 'TokenExpiredError') {
        console.log('認証サービス: リフレッシュトークンの期限切れを検出。猶予期間を確認します');
        
        try {
          // 期限切れトークンをデコード（検証なし）
          const expiredToken = jwt.decode(refreshToken);
          if (!expiredToken || !expiredToken.exp) {
            throw new Error('無効なトークン形式');
          }
          
          // 猶予期間の設定（デフォルト1日 = 86400秒）
          const gracePeriod = authConfig.tokenSettings?.validation?.refreshGracePeriod || 86400;
          const currentTime = Math.floor(Date.now() / 1000);
          const expiredAt = expiredToken.exp;
          const isWithinGracePeriod = (currentTime - expiredAt) <= gracePeriod;
          
          if (!isWithinGracePeriod) {
            console.log(`認証サービス: トークン期限切れから${currentTime - expiredAt}秒経過。猶予期間(${gracePeriod}秒)超過`);
            throw tokenError; // 猶予期間を超過
          }
          
          console.log(`認証サービス: トークン期限切れですが猶予期間内です (${currentTime - expiredAt}秒経過)`);
          // ユーザーIDをデコードされたトークンから取得
          decoded = { id: expiredToken.id };
        } catch (decodeError) {
          console.error('認証サービス: 期限切れトークンの解析に失敗', decodeError);
          throw tokenError; // 元のエラーをスロー
        }
      } else {
        // その他のトークン検証エラー
        console.error(`認証サービス: トークン検証エラー: ${tokenError.name}`, tokenError);
        throw tokenError;
      }
    }
    
    // トークンに関連付けられたユーザーを検索
    const user = await User.findById(decoded.id);
    if (!user) {
      console.log(`認証サービス: ユーザーが見つかりません (ID: ${decoded.id})`);
      throw new Error('ユーザーが見つかりません');
    }
    
    // リフレッシュトークンの検証（ユーザーのトークンと一致するか）
    // ただし、VSCode拡張の場合はトークンローテーション後の短い再利用期間を許可
    if (user.refreshToken !== refreshToken) {
      // ローテーション設定を確認
      const tokenRotation = authConfig.tokenSettings?.rotation?.enabled || false;
      const reuseWindow = authConfig.tokenSettings?.rotation?.reuseWindow || 60; // デフォルト60秒
      
      // VSCodeクライアントでトークンローテーションが有効な場合
      if (isVSCodeClient && tokenRotation && user.previousRefreshTokens && user.previousRefreshTokens.length > 0) {
        console.log('認証サービス: VSCode拡張用の古いトークン再利用チェックを実行');
        
        // 最近のトークンと一致するか確認
        const recentToken = user.previousRefreshTokens.find(t => 
          t.token === refreshToken && 
          (Math.floor(Date.now() / 1000) - t.rotatedAt) <= reuseWindow
        );
        
        if (!recentToken) {
          console.log('認証サービス: 提供されたリフレッシュトークンが最近のトークンと一致しません');
          throw new Error('リフレッシュトークンが一致しません');
        }
        
        console.log('認証サービス: 古いリフレッシュトークンの再利用を許可（グレースピリオド内）');
      } else {
        console.log('認証サービス: 提供されたリフレッシュトークンがユーザーのトークンと一致しません');
        throw new Error('無効なリフレッシュトークンです');
      }
    }
    
    // アカウントが有効か確認（新方式）
    if (user.accountStatus) {
      if (user.accountStatus !== authConfig.accountStatus.ACTIVE) {
        console.log(`認証サービス: アカウントが無効です (ユーザー: ${user.name}, 状態: ${user.accountStatus})`);
        throw new Error('アカウントが無効化されています');
      }
    } 
    // 旧方式との互換性のため（isActiveプロパティが存在する場合）
    else if (user.isActive === false) {
      console.log(`認証サービス: 旧方式で - アカウントが無効です (ユーザー: ${user.name})`);
      throw new Error('アカウントが無効化されています');
    }

    // アクセストークンの有効期限を設定
    let accessTokenExpiry = authConfig.jwtExpiry;
    let sessionExtended = false;
    
    // VSCode拡張の場合はセッション延長を考慮
    if (isVSCodeClient && extendedSession) {
      // より長い有効期限を設定（例: 通常の2倍）
      const match = authConfig.jwtExpiry.match(/(\d+)h/);
      if (match) {
        const hours = parseInt(match[1], 10);
        accessTokenExpiry = `${hours * 2}h`;
        sessionExtended = true;
        console.log(`認証サービス: VSCode拡張用にセッション延長 (${accessTokenExpiry})`);
      }
    }

    // 新しいアクセストークンを生成（必要に応じて延長された有効期限で）
    const accessToken = jwt.sign(
      { 
        id: user._id,
        role: user.role 
      }, 
      authConfig.jwtSecret, 
      {
        expiresIn: accessTokenExpiry,
        issuer: authConfig.jwtOptions.issuer,
        audience: authConfig.jwtOptions.audience
      }
    );
    
    // リフレッシュトークンのローテーション（セキュリティ向上）
    const newRefreshToken = this.generateRefreshToken(user);
    
    // トークンローテーション履歴を更新
    if (authConfig.tokenSettings?.rotation?.enabled) {
      // 古いトークンのリストがなければ初期化
      if (!user.previousRefreshTokens) {
        user.previousRefreshTokens = [];
      }
      
      // 古いトークンを履歴に追加（最大5個まで）
      user.previousRefreshTokens.unshift({
        token: user.refreshToken,
        rotatedAt: Math.floor(Date.now() / 1000),
        userAgent: userAgent.substring(0, 255), // 長すぎる場合は切り詰め
        ipAddress: ipAddress.substring(0, 45)   // 長すぎる場合は切り詰め
      });
      
      // 最大5個に制限
      if (user.previousRefreshTokens.length > 5) {
        user.previousRefreshTokens = user.previousRefreshTokens.slice(0, 5);
      }
    }
    
    // 新しいリフレッシュトークンをユーザーに保存
    user.refreshToken = newRefreshToken;
    
    // 最終トークンリフレッシュ日時を更新
    user.lastTokenRefresh = new Date();
    
    // ユーザー情報を保存（super_adminの場合の特別処理を廃止）
    try {
      console.log("認証サービス: ユーザー情報を保存します");
      await user.save();
      console.log("認証サービス: ユーザー情報更新成功");
    } catch (saveError) {
      console.error("認証サービス: ユーザー情報更新エラー:", saveError);
      throw new Error(`ユーザー保存エラー: ${saveError.message}`);
    }
    
    console.log(`認証サービス: トークンリフレッシュ完了 (ユーザー: ${user.name})`);

    // トークン有効期限の計算（秒単位）
    const expiryMatch = accessTokenExpiry.match(/(\d+)h/);
    const expiresIn = expiryMatch ? parseInt(expiryMatch[1], 10) * 3600 : 86400; // デフォルト24時間
    
    // アクセストークンと新しいリフレッシュトークンを返す
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: expiresIn,
      sessionExtended
    };
  } catch (error) {
    console.error('認証サービス: トークンリフレッシュエラー', error);
    throw error;
  }
};

/**
 * ユーザーログアウト
 * @param {String} refreshToken - リフレッシュトークン
 * @returns {Boolean} ログアウト成功フラグ
 */
exports.logout = async (refreshToken) => {
  try {
    // リフレッシュトークンでユーザーを検索
    const user = await User.findByRefreshToken(refreshToken);
    if (!user) {
      return false;
    }

    // リフレッシュトークンをクリア
    user.refreshToken = null;
    await user.save();

    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * ユーザー情報更新
 * @param {String} userId - ユーザーID
 * @param {Object} updateData - 更新データ
 * @returns {Object} 更新されたユーザー
 */
exports.updateUser = async (userId, updateData) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // 更新可能なフィールド
    if (updateData.name) user.name = updateData.name;
    if (updateData.email) user.email = updateData.email;
    if (updateData.password) user.password = updateData.password;

    // 管理者のみがロールを更新可能
    if (updateData.role && updateData.isAdmin) {
      user.role = updateData.role;
    }

    await user.save();
    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * パスワードリセット
 * @param {String} email - メールアドレス
 * @returns {Boolean} パスワードリセット成功フラグ
 */
exports.resetPassword = async (email) => {
  try {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    // パスワードリセットロジックを実装
    // 例: ランダムなパスワードを生成してメール送信

    return true;
  } catch (error) {
    throw error;
  }
};