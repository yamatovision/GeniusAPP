/**
 * シンプルな認証コントローラー
 * ログイン、ログアウト、トークンリフレッシュの処理を行います
 */
const SimpleUser = require('../models/simpleUser.model');
const jwt = require('jsonwebtoken');
// 通常の認証設定ではなく、専用の設定ファイルを使用
const simpleAuthConfig = require('../config/simple-auth.config');
// 認証ヘルパーを追加
const authHelper = require('../utils/simpleAuth.helper');
// AnthropicApiKeyモデルを事前に読み込み
const AnthropicApiKey = require('../models/anthropicApiKey.model');
// セッション管理サービスを追加
const SessionService = require('../services/session.service');

/**
 * ユーザーログイン
 * @route POST /api/simple/auth/login
 */
exports.login = async (req, res) => {
  try {
    console.log("=============================================================");
    console.log("シンプル認証コントローラー: ログインリクエスト受信");
    console.log("リクエストボディ:", req.body);
    console.log(`ログイン試行: ユーザー=${req.body.email || '未指定'}`);
    console.log("リクエストヘッダー:", {
      contentType: req.headers['content-type'],
      accept: req.headers['accept'],
      origin: req.headers['origin'],
      referer: req.headers['referer']
    });
    console.log("=============================================================");
    
    const { email, password } = req.body;
    
    // 必須パラメータの検証
    if (!email || !password) {
      console.log("シンプル認証コントローラー: 必須パラメータ欠如");
      return res.status(400).json({
        success: false,
        message: 'メールアドレスとパスワードは必須です'
      });
    }
    
    // ユーザーを検索
    console.log("シンプル認証コントローラー: ユーザー検索", email);
    const user = await SimpleUser.findByEmail(email);
    
    if (!user) {
      console.log("シンプル認証コントローラー: ユーザーが見つかりません");
      return res.status(401).json({
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません'
      });
    }
    
    console.log("シンプル認証コントローラー: ユーザー見つかりました", user.name);
    
    // アカウントが無効化されていないか確認
    if (user.status !== 'active') {
      console.log("シンプル認証コントローラー: アカウント無効", user.status);
      return res.status(401).json({
        success: false,
        message: 'アカウントが無効化されています'
      });
    }
    
    // パスワードを検証
    console.log("シンプル認証コントローラー: パスワード検証開始");
    const isPasswordValid = await user.validatePassword(password);
    
    if (!isPasswordValid) {
      console.log("シンプル認証コントローラー: パスワード不一致");
      return res.status(401).json({
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません'
      });
    }
    
    console.log("シンプル認証コントローラー: パスワード検証に成功");
    
    // アクティブセッションの確認
    console.log("シンプル認証コントローラー: アクティブセッション確認");
    const hasActiveSession = await SessionService.hasActiveSession(user._id);
    
    if (hasActiveSession) {
      // 既存セッションがある場合は、通常のログインをブロック
      console.log("シンプル認証コントローラー: 既存のアクティブセッションを検出");
      const sessionInfo = await SessionService.getUserSession(user._id);
      
      return res.status(409).json({
        success: false,
        code: 'ACTIVE_SESSION_EXISTS',
        message: 'このアカウントは別の場所で使用中です',
        sessionInfo: {
          loginTime: sessionInfo.loginTime,
          lastActivity: sessionInfo.lastActivity,
          ipAddress: sessionInfo.ipAddress
        }
      });
    }
    
    // セッション作成
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const sessionId = await SessionService.createSession(user._id, ipAddress, userAgent);
    console.log("シンプル認証コントローラー: 新規セッション作成", sessionId);
    
    // Simple認証専用のアクセストークンを生成（セッションIDを含む）
    console.log("シンプル認証コントローラー: トークン生成開始");
    console.log("シンプル認証コントローラー: シークレットキー", {
      secret: simpleAuthConfig.jwtSecret.substring(0, 5) + '...',
      issuer: simpleAuthConfig.jwtOptions.issuer,
      audience: simpleAuthConfig.jwtOptions.audience
    });
    
    // ヘルパー関数を使用してトークンを生成（セッションIDを含む）
    const accessToken = authHelper.generateAccessToken(user._id, user.role, user.accountStatus, sessionId);
    
    // ヘルパー関数を使用してリフレッシュトークンを生成
    const refreshToken = authHelper.generateRefreshToken(user._id);
    
    // リフレッシュトークンをユーザーに保存
    user.refreshToken = refreshToken;
    await user.save();
    
    // CORS対応ヘッダー設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    
    // APIキー情報を取得
    let apiKeyInfo = null;
    
    // 新方式：ユーザーに直接保存されているAPIキー値を優先
    if (user.apiKeyValue) {
      apiKeyInfo = {
        id: user.apiKeyId || 'direct_key',
        keyValue: user.apiKeyValue,  // ユーザーモデルに保存されているAPIキー値
        status: 'active'
      };
    } 
    // 旧方式：AnthropicApiKeyテーブルから取得
    else if (user.apiKeyId) {
      try {
        // AnthropicApiKeyはモジュールの先頭で読み込み済み
        const apiKey = await AnthropicApiKey.findOne({ apiKeyId: user.apiKeyId });
        
        if (apiKey && apiKey.apiKeyFull) {
          apiKeyInfo = {
            id: apiKey.apiKeyId,
            keyValue: apiKey.apiKeyFull,
            status: apiKey.status
          };
          
          // 移行処理：APIキー値をユーザーモデルにも保存
          user.apiKeyValue = apiKey.apiKeyFull;
          await user.save();
          console.log(`ログイン時にユーザー ${user.name} (${user._id}) のAPIキー値をAnthropicApiKeyモデルからユーザーモデルに保存しました`);
        }
      } catch (err) {
        console.error('AnthropicApiKeyモデルの読み込みエラー:', err);
        // エラーは無視して続行
      }
    }
    
    // APIキー取得後のログ記録
    console.log("============ シンプル認証コントローラー: ログイン成功 ============");
    console.log(`ログイン成功: ユーザー=${user.name}, メール=${user.email}, ロール=${user.role}, ID=${user._id}`);
    console.log("APIキー情報:", apiKeyInfo ? `ID=${apiKeyInfo.id}, 状態=${apiKeyInfo.status}` : "なし");
    console.log("==================================================================");
    
    // レスポンス
    return res.status(200).json({
      success: true,
      message: 'ログインに成功しました',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          apiKeyId: user.apiKeyId,
          apiKeyValue: user.apiKeyValue  // APIキー値をユーザー情報に含める
        },
        apiKey: apiKeyInfo
      }
    });
  } catch (error) {
    console.error('ログインエラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ログイン処理中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * トークンリフレッシュ
 * @route POST /api/simple/auth/refresh-token
 */
exports.refreshToken = async (req, res) => {
  try {
    console.log('refreshToken: リフレッシュトークン処理開始');
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      console.log('refreshToken: リフレッシュトークンがリクエストに含まれていません');
      return res.status(400).json({
        success: false,
        message: 'リフレッシュトークンは必須です'
      });
    }
    
    try {
      // ヘルパー関数を使用してリフレッシュトークンを検証
      console.log('refreshToken: トークン検証開始');
      const decoded = authHelper.verifyRefreshToken(refreshToken);
      console.log('refreshToken: トークン検証成功', { id: decoded.id });
      
      // ユーザーを検索
      console.log('refreshToken: ユーザー検索開始');
      const user = await SimpleUser.findOne({ 
        _id: decoded.id,
        refreshToken: refreshToken,
        status: 'active'
      });
      
      if (!user) {
        console.log('refreshToken: ユーザーが見つかりません');
        return res.status(401).json({
          success: false,
          message: '無効なリフレッシュトークンです'
        });
      }
      
      console.log('refreshToken: ユーザー見つかりました', { id: user._id, role: user.role });
      
      // ヘルパーを使用して新しいアクセストークンを生成
      console.log('refreshToken: 新しいアクセストークン生成');
      const newAccessToken = authHelper.generateAccessToken(user._id, user.role, user.accountStatus);
      
      // ヘルパーを使用して新しいリフレッシュトークンを生成
      console.log('refreshToken: 新しいリフレッシュトークン生成');
      const newRefreshToken = authHelper.generateRefreshToken(user._id);
      
      // 新しいリフレッシュトークンをユーザーに保存
      console.log('refreshToken: ユーザーにトークン保存');
      user.refreshToken = newRefreshToken;
      await user.save();
      
      // トークンの一部を出力
      console.log('refreshToken: 生成トークン', {
        accessToken: newAccessToken.substring(0, 15) + '...',
        refreshToken: newRefreshToken.substring(0, 15) + '...'
      });
      
      // CORS対応ヘッダー設定
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
      
      // レスポンス
      console.log('refreshToken: 成功レスポンス送信');
      return res.status(200).json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (jwtError) {
      // JWTエラー処理
      console.error('refreshToken: JWT検証エラー', jwtError);
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'リフレッシュトークンの有効期限が切れています'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: '無効なリフレッシュトークンです'
      });
    }
  } catch (error) {
    console.error('トークンリフレッシュエラー:', error);
    return res.status(500).json({
      success: false,
      message: 'トークンリフレッシュ中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * ログアウト
 * @route POST /api/simple/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'リフレッシュトークンは必須です'
      });
    }
    
    // ユーザーを検索してリフレッシュトークンをクリア
    const user = await SimpleUser.findOne({ refreshToken });
    
    if (user) {
      user.refreshToken = null;
      await user.save();
      
      // セッションもクリア
      await SessionService.clearSession(user._id);
      console.log("シンプル認証コントローラー: セッションをクリアしました", user._id);
    }
    
    // CORS対応ヘッダー設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    
    return res.status(200).json({
      success: true,
      message: 'ログアウトしました'
    });
  } catch (error) {
    console.error('ログアウトエラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ログアウト処理中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * ユーザー登録
 * @route POST /api/simple/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // 必須パラメータの検証
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'ユーザー名、メールアドレス、パスワードは必須です'
      });
    }
    
    // パスワード強度の検証
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'パスワードは8文字以上である必要があります'
      });
    }
    
    // メールアドレスの重複チェック
    const existingUser = await SimpleUser.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'このメールアドレスは既に使用されています'
      });
    }
    
    // ユーザー数の確認（最初のユーザーはSuperAdminに設定）
    const userCount = await SimpleUser.countDocuments();
    const role = userCount === 0 ? 'SuperAdmin' : 'User';
    
    // 新しいユーザーを作成
    const newUser = new SimpleUser({
      name,
      email: email.toLowerCase(),
      password,
      role,
      status: 'active'
    });
    
    // 保存
    await newUser.save();
    
    // ヘルパーを使用してアクセストークンを生成
    const accessToken = authHelper.generateAccessToken(newUser._id, newUser.role, newUser.accountStatus);
    
    // ヘルパーを使用してリフレッシュトークンを生成
    const refreshToken = authHelper.generateRefreshToken(newUser._id);
    
    // リフレッシュトークンをユーザーに保存
    newUser.refreshToken = refreshToken;
    await newUser.save();
    
    // レスポンス
    return res.status(201).json({
      success: true,
      message: 'ユーザー登録に成功しました',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        }
      }
    });
  } catch (error) {
    console.error('ユーザー登録エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'ユーザー登録中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 認証チェック
 * @route GET /api/simple/auth/check
 */
exports.checkAuth = async (req, res) => {
  try {
    const userId = req.userId;
    
    // ユーザー情報を取得（シンプル実装）
    const user = await SimpleUser.findById(userId, '-password -refreshToken');
    
    // ユーザーが見つからない場合
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // ユーザーが無効化または削除された場合
    if (user.status !== 'active' || user.deleted === true) {
      return res.status(401).json({
        success: false,
        message: 'アカウントが無効化または削除されました',
        errorCode: 'ACCOUNT_DELETED'
      });
    }
    
    // CORS対応ヘッダー設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    
    // APIキー情報を取得
    let apiKeyInfo = null;
    
    // 新方式：AnthropicApiKeyモデルからAPIキーを取得
    if (user.apiKeyId) {
      try {
        // AnthropicApiKeyはモジュールの先頭で読み込み済み
        
        // APIキーIDと一致するAnthropicApiKeyを検索
        const anthropicApiKey = await AnthropicApiKey.findOne({ apiKeyId: user.apiKeyId });
        
        if (anthropicApiKey && anthropicApiKey.apiKeyFull) {
          apiKeyInfo = {
            id: anthropicApiKey.apiKeyId,
            keyValue: anthropicApiKey.apiKeyFull,
            keyHint: anthropicApiKey.keyHint,
            status: anthropicApiKey.status
          };
          console.log(`認証チェック時にユーザー ${user.name} (${user._id}) のAPIキーをAnthropicApiKeyモデルから取得しました`);
        }
      } catch (apiKeyError) {
        console.error('AnthropicApiKeyモデルからの取得失敗:', apiKeyError);
      }
    }
    
    // フォールバック: ユーザーに直接保存されているAPIキー値を使用
    if (!apiKeyInfo && user.apiKeyValue) {
      apiKeyInfo = {
        id: user.apiKeyId || 'direct_key',
        keyValue: user.apiKeyValue,  // ユーザーモデルに保存されているAPIキー値
        status: 'active'
      };
    } 
    // レガシー対応：他のユーザーからAPIキー値を探す
    else if (!apiKeyInfo && user.apiKeyId) {
      // 同じAPIキーIDを持つ他のユーザーを探す
      const userWithKey = await SimpleUser.findOne({
        apiKeyId: user.apiKeyId,
        apiKeyValue: { $ne: null }
      });
      
      if (userWithKey && userWithKey.apiKeyValue) {
        apiKeyInfo = {
          id: user.apiKeyId,
          keyValue: userWithKey.apiKeyValue,
          status: 'active'
        };
        
        // APIキー値をこのユーザーにも保存（移行処理）
        user.apiKeyValue = userWithKey.apiKeyValue;
        await user.save();
        console.log(`認証チェック時にユーザー ${user.name} (${user._id}) のAPIキー値を他のユーザーからコピーしました`);
      } else {
        // APIキー値が見つからない場合はダミーデータを返す
        apiKeyInfo = {
          id: user.apiKeyId,
          keyValue: user.apiKeyId, // ダミーではなくAPIキーIDをそのまま使用
          status: 'active'
        };
      }
    }
    
    // 成功レスポンス
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          apiKeyId: user.apiKeyId,
          apiKeyValue: user.apiKeyValue  // APIキー値をユーザー情報に含める
        },
        apiKey: apiKeyInfo
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '認証チェック中にエラーが発生しました'
    });
  }
};

/**
 * ユーザーのAnthropicAPIキーを取得
 * @route GET /api/simple/user/anthropic-api-key
 */
exports.getUserAnthropicApiKey = async (req, res) => {
  try {
    const userId = req.userId;
    
    // ユーザー情報を取得
    const user = await SimpleUser.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }
    
    // APIキー情報を取得
    let apiKeyData = null;
    
    // 新方式：AnthropicApiKeyモデルからAPIキーを取得
    if (user.apiKeyId) {
      try {
        // AnthropicApiKeyはモジュールの先頭で読み込み済み
        
        // APIキーIDと一致するAnthropicApiKeyを検索
        const anthropicApiKey = await AnthropicApiKey.findOne({ apiKeyId: user.apiKeyId });
        
        if (anthropicApiKey && anthropicApiKey.apiKeyFull) {
          apiKeyData = {
            id: anthropicApiKey.apiKeyId,
            apiKeyFull: anthropicApiKey.apiKeyFull,
            keyHint: anthropicApiKey.keyHint,
            status: anthropicApiKey.status
          };
          console.log(`anthropic-api-key エンドポイントがユーザー ${user.name} (${user._id}) のAPIキーをAnthropicApiKeyモデルから取得しました`);
        }
      } catch (apiKeyError) {
        console.error('AnthropicApiKeyモデルからの取得失敗:', apiKeyError);
      }
    }
    
    // フォールバック: ユーザーに直接保存されているAPIキー値を使用
    if (!apiKeyData && user.apiKeyValue) {
      apiKeyData = {
        id: user.apiKeyId || 'direct_key',
        apiKeyFull: user.apiKeyValue,
        keyHint: user.apiKeyValue ? user.apiKeyValue.substring(0, 5) + '...' : '',
        status: 'active'
      };
      console.log(`anthropic-api-key エンドポイントがユーザー ${user.name} (${user._id}) のAPIキーをユーザーモデルから取得しました`);
    }
    
    // APIキーが見つからない場合
    if (!apiKeyData) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーにAPIキーが設定されていません'
      });
    }
    
    // CORS対応ヘッダー設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    
    // 成功レスポンス
    return res.status(200).json({
      success: true,
      data: apiKeyData
    });
  } catch (error) {
    console.error('Anthropic APIキー取得エラー:', error);
    return res.status(500).json({
      success: false,
      message: 'APIキーの取得中にエラーが発生しました',
      error: error.message
    });
  }
};

/**
 * 強制ログイン（既存セッションを終了して新規ログイン）
 * @route POST /api/simple/auth/force-login
 */
exports.forceLogin = async (req, res) => {
  try {
    console.log("=============================================================");
    console.log("シンプル認証コントローラー: 強制ログインリクエスト受信");
    console.log("リクエストボディ:", req.body);
    console.log(`強制ログイン試行: ユーザー=${req.body.email || '未指定'}`);
    console.log("=============================================================");
    
    const { email, password, forceLogin } = req.body;
    
    // 必須パラメータの検証
    if (!email || !password) {
      console.log("シンプル認証コントローラー: 必須パラメータ欠如");
      return res.status(400).json({
        success: false,
        message: 'メールアドレスとパスワードは必須です'
      });
    }
    
    // forceLoginフラグの確認
    if (!forceLogin) {
      console.log("シンプル認証コントローラー: 強制ログインフラグが無効");
      return res.status(400).json({
        success: false,
        message: '強制ログインフラグが設定されていません'
      });
    }
    
    // ユーザーを検索
    console.log("シンプル認証コントローラー: ユーザー検索", email);
    const user = await SimpleUser.findByEmail(email);
    
    if (!user) {
      console.log("シンプル認証コントローラー: ユーザーが見つかりません");
      return res.status(401).json({
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません'
      });
    }
    
    console.log("シンプル認証コントローラー: ユーザー見つかりました", user.name);
    
    // アカウントが無効化されていないか確認
    if (user.status !== 'active') {
      console.log("シンプル認証コントローラー: アカウント無効", user.status);
      return res.status(401).json({
        success: false,
        message: 'アカウントが無効化されています'
      });
    }
    
    // パスワードを検証
    console.log("シンプル認証コントローラー: パスワード検証開始");
    const isPasswordValid = await user.validatePassword(password);
    
    if (!isPasswordValid) {
      console.log("シンプル認証コントローラー: パスワード不一致");
      return res.status(401).json({
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません'
      });
    }
    
    console.log("シンプル認証コントローラー: パスワード検証に成功");
    
    // 既存セッションを強制終了して新しいセッションを作成
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const { newSessionId, previousSession } = await SessionService.forceCreateSession(user._id, ipAddress, userAgent);
    console.log("シンプル認証コントローラー: 強制的に新規セッション作成", newSessionId);
    
    // Simple認証専用のアクセストークンを生成（セッションIDを含む）
    const accessToken = authHelper.generateAccessToken(user._id, user.role, user.accountStatus, newSessionId);
    
    // ヘルパー関数を使用してリフレッシュトークンを生成
    const refreshToken = authHelper.generateRefreshToken(user._id);
    
    // リフレッシュトークンをユーザーに保存
    user.refreshToken = refreshToken;
    await user.save();
    
    // CORS対応ヘッダー設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    
    // APIキー情報を取得（通常のログインと同じロジック）
    let apiKeyInfo = null;
    
    // 新方式：ユーザーに直接保存されているAPIキー値を優先
    if (user.apiKeyValue) {
      apiKeyInfo = {
        id: user.apiKeyId || 'direct_key',
        keyValue: user.apiKeyValue,
        status: 'active'
      };
    } 
    // 旧方式：AnthropicApiKeyテーブルから取得
    else if (user.apiKeyId) {
      try {
        const apiKey = await AnthropicApiKey.findOne({ apiKeyId: user.apiKeyId });
        
        if (apiKey && apiKey.apiKeyFull) {
          apiKeyInfo = {
            id: apiKey.apiKeyId,
            keyValue: apiKey.apiKeyFull,
            status: apiKey.status
          };
          
          // 移行処理：APIキー値をユーザーモデルにも保存
          user.apiKeyValue = apiKey.apiKeyFull;
          await user.save();
          console.log(`強制ログイン時にユーザー ${user.name} (${user._id}) のAPIキー値をAnthropicApiKeyモデルからユーザーモデルに保存しました`);
        }
      } catch (err) {
        console.error('AnthropicApiKeyモデルの読み込みエラー:', err);
      }
    }
    
    console.log("============ シンプル認証コントローラー: 強制ログイン成功 ============");
    console.log(`強制ログイン成功: ユーザー=${user.name}, メール=${user.email}, ロール=${user.role}, ID=${user._id}`);
    console.log("前のセッション情報:", previousSession ? `セッションID=${previousSession.sessionId}` : "なし");
    console.log("==================================================================");
    
    // レスポンス
    return res.status(200).json({
      success: true,
      message: '強制ログインに成功しました',
      previousSessionTerminated: !!previousSession,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          apiKeyId: user.apiKeyId,
          apiKeyValue: user.apiKeyValue
        },
        apiKey: apiKeyInfo
      }
    });
  } catch (error) {
    console.error('強制ログインエラー:', error);
    return res.status(500).json({
      success: false,
      message: '強制ログイン処理中にエラーが発生しました',
      error: error.message
    });
  }
};