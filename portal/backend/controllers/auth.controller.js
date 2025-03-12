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
    const { email, password } = req.body;
    
    // 必須パラメータの検証
    if (!email || !password) {
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
    
    // ログイン処理
    const result = await authService.login(email, password);
    
    // 成功レスポンス
    return res.status(200).json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user
    });
  } catch (error) {
    // エラー処理
    if (error.message === 'ユーザーが見つかりません' || 
        error.message === 'パスワードが正しくありません') {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'メールアドレスまたはパスワードが正しくありません'
        }
      });
    }
    
    if (error.message === 'アカウントが無効化されています') {
      return res.status(401).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'アカウントが無効化されています'
        }
      });
    }
    
    // その他のエラー
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'ログイン中にエラーが発生しました',
        details: error.message
      }
    });
  }
};

/**
 * トークン更新
 * @route POST /api/auth/refresh-token
 */
exports.refreshToken = async (req, res) => {
  // すでにミドルウェアでリフレッシュトークンが検証されているため、ここでは新しいアクセストークンを生成するだけです
  try {
    // 新しいアクセストークンを生成
    const result = await authService.refreshToken(req.body.refreshToken);
    
    // 成功レスポンス
    return res.status(200).json({
      accessToken: result.accessToken
    });
  } catch (error) {
    // その他のエラー
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'トークン更新中にエラーが発生しました',
        details: error.message
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