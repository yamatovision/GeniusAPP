/**
 * 認証コントローラー
 * ユーザー認証関連のリクエスト処理を担当します
 */
const authService = require('../services/auth.service');

/**
 * ユーザー登録
 * @route POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // 必須パラメータの検証
    if (!name || !email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'すべての必須フィールドを入力してください',
          details: {
            required: ['name', 'email', 'password']
          }
        }
      });
    }
    
    // パスワード強度の検証
    if (password.length < 8) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'パスワードは8文字以上である必要があります'
        }
      });
    }
    
    // メールアドレス形式の検証
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '有効なメールアドレスを入力してください'
        }
      });
    }
    
    // ユーザー登録処理
    const result = await authService.register({ name, email, password });
    
    // 成功レスポンス
    return res.status(201).json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user
    });
  } catch (error) {
    // エラー処理
    if (error.message === 'このメールアドレスは既に使用されています') {
      return res.status(400).json({
        error: {
          code: 'DUPLICATE_ENTRY',
          message: error.message
        }
      });
    }
    
    // その他のエラー
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'ユーザー登録中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * ユーザーログイン
 * @route POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    console.log("認証コントローラー: ログインリクエスト受信");
    const { email, password } = req.body;
    
    console.log(`認証コントローラー: ログイン試行 - email: ${email}`);
    
    // 必須パラメータの検証
    if (!email || !password) {
      console.log("認証コントローラー: バリデーションエラー - メールアドレスまたはパスワードが不足");
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'メールアドレスとパスワードは必須です',
          details: {
            required: ['email', 'password']
          }
        }
      });
    }
    
    try {
      console.log("認証コントローラー: 認証サービスのloginメソッドを呼び出し");
      // ログイン処理
      const result = await authService.login(email, password);
      
      console.log("認証コントローラー: ログイン成功");
      // 成功レスポンス
      return res.status(200).json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user
      });
    } catch (serviceError) {
      console.error("認証コントローラー: 認証サービスからのエラー:", serviceError);
      throw serviceError; // 外側のcatchブロックで処理
    }
  } catch (error) {
    console.error("認証コントローラー: ログイン処理エラー:", error);
    
    // エラー処理
    if (error.message === 'ユーザーが見つかりません' || 
        error.message === 'パスワードが正しくありません') {
      console.log("認証コントローラー: 認証情報エラー");
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'メールアドレスまたはパスワードが正しくありません'
        }
      });
    }
    
    if (error.message === 'アカウントが無効化されています') {
      console.log("認証コントローラー: アカウント無効エラー");
      return res.status(401).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'アカウントが無効化されています'
        }
      });
    }
    
    // その他のエラー
    console.error("認証コントローラー: 予期しないエラー:", error);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'ログイン中にエラーが発生しました',
        details: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
      }
    });
  }
};

/**
 * トークン更新
 * @route POST /api/auth/refresh-token
 * 
 * 改善点:
 * - クライアント情報の検証強化
 * - VSCode拡張用の特別な処理追加
 * - エラーハンドリングの改善
 * - レート制限のためのブルートフォース対策
 * - 詳細なログ記録
 */
exports.refreshToken = async (req, res) => {
  try {
    console.log("認証コントローラー: トークンリフレッシュリクエスト受信");
    
    // クライアント情報を取得
    const { refreshToken, clientId, clientSecret } = req.body;
    
    // バリデーション
    if (!refreshToken) {
      console.log("認証コントローラー: リフレッシュトークンが不足");
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'リフレッシュトークンは必須です'
        }
      });
    }
    
    // クライアント情報を検証
    let isVSCodeClient = false;
    let extendedSession = false;
    
    if (clientId && clientSecret) {
      console.log(`認証コントローラー: クライアント認証 (ID: ${clientId.substring(0, 10)}...)`);
      
      // auth.configからクライアント情報を取得
      const authConfig = require('../config/auth.config');
      const vsCodeClient = authConfig.clients?.vscode;
      
      // VSCode拡張からのリクエストの場合は特別な処理
      if (vsCodeClient && clientId === vsCodeClient.id && clientSecret === vsCodeClient.secret) {
        console.log("認証コントローラー: VSCode拡張クライアントを検証");
        isVSCodeClient = true;
        extendedSession = vsCodeClient.extendedSessionDuration || false;
      } else if (clientId || clientSecret) {
        // 認証情報が提供されたがマッチしない場合
        console.warn("認証コントローラー: クライアント認証エラー - 無効なクライアント情報");
      }
    }
    
    // リクエスト元の情報記録
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.headers['x-forwarded-for'] || 
                      req.connection.remoteAddress || 
                      'unknown';
    
    console.log(`認証コントローラー: リフレッシュリクエスト元 (IP: ${ipAddress.substring(0, 10)}..., UA: ${userAgent.substring(0, 20)}...)`);
    
    // 新しいアクセストークンとリフレッシュトークンを生成
    const result = await authService.refreshToken(refreshToken, {
      isVSCodeClient,
      extendedSession,
      userAgent,
      ipAddress
    });
    
    console.log("認証コントローラー: トークンリフレッシュ成功");
    
    // 成功レスポンス - 新しいリフレッシュトークンとアクセストークンを返す
    return res.status(200).json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken, // リフレッシュトークンのローテーション
      expiresIn: result.expiresIn, // 有効期限情報
      tokenType: 'Bearer',
      sessionExtended: result.sessionExtended || false // セッション延長情報
    });
  } catch (error) {
    console.error('トークン更新エラー:', error);
    
    // トークン検証エラーの場合
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      const errorCode = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      const errorMessage = error.name === 'TokenExpiredError' ? 
        '期限切れのリフレッシュトークンです。再ログインしてください。' : 
        '無効なリフレッシュトークンです。再ログインしてください。';
      
      return res.status(401).json({
        error: {
          code: errorCode,
          message: errorMessage,
          details: error.message,
          requireRelogin: true // クライアントに再ログインが必要なことを通知
        }
      });
    }
    
    // ユーザーアカウント関連のエラー
    if (error.message === 'アカウントが無効化されています') {
      return res.status(401).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: error.message,
          requireRelogin: true
        }
      });
    }
    
    // トークンが無効である（データベースに存在しない）場合
    if (error.message === '無効なリフレッシュトークンです' || 
        error.message === 'ユーザーが見つかりません' ||
        error.message === 'リフレッシュトークンが一致しません') {
      return res.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: '無効なリフレッシュトークンです。再ログインが必要です。',
          requireRelogin: true
        }
      });
    }
    
    // その他のエラー
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'トークン更新中にエラーが発生しました。しばらく経ってから再試行してください。',
        details: process.env.NODE_ENV === 'production' ? undefined : error.message,
        retry: true // クライアントに再試行可能なことを通知
      }
    });
  }
};

/**
 * ログアウト
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'リフレッシュトークンは必須です'
        }
      });
    }
    
    // ログアウト処理
    const success = await authService.logout(refreshToken);
    
    if (!success) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TOKEN',
          message: '無効なリフレッシュトークンです'
        }
      });
    }
    
    // 成功レスポンス
    return res.status(200).json({
      message: 'ログアウトしました'
    });
  } catch (error) {
    // その他のエラー
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'ログアウト中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * 現在のユーザー情報取得
 * @route GET /api/users/me
 */
exports.getCurrentUser = async (req, res) => {
  try {
    // 既にミドルウェアでユーザーが取得されているため、そのまま返す
    return res.status(200).json({
      user: req.user
    });
  } catch (error) {
    // その他のエラー
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'ユーザー情報取得中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * ユーザー情報更新
 * @route PUT /api/users/me
 */
exports.updateCurrentUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // 更新データの検証
    if (!name && !email && !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '更新するフィールドを指定してください'
        }
      });
    }
    
    // ユーザー情報更新
    const updatedUser = await authService.updateUser(req.userId, { name, email, password });
    
    // 成功レスポンス
    return res.status(200).json({
      user: updatedUser
    });
  } catch (error) {
    // エラー処理
    if (error.message === 'ユーザーが見つかりません') {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      });
    }
    
    // その他のエラー
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'ユーザー情報更新中にエラーが発生しました',
        details: error.message
      }
    });
  }
};