/**
 * シンプル認証デバッグコントローラー
 * 認証処理のデバッグと診断情報を提供します
 */
const SimpleUser = require('../models/simpleUser.model');
const jwt = require('jsonwebtoken');
// 通常の認証設定ではなく、専用の設定ファイルを使用
const simpleAuthConfig = require('../config/simple-auth.config');

/**
 * 認証デバッグ
 * トークンやユーザー情報などの認証状態を診断します
 * @route GET /api/simple/auth/debug
 */
exports.debugAuth = async (req, res) => {
  console.log('===== 認証デバッグ =====');
  console.log('認証ヘッダー:', req.headers.authorization || 'なし');
  
  try {
    // 認証ヘッダーを確認
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('認証ヘッダーなし:', authHeader);
      return res.status(401).json({
        success: false,
        message: '認証ヘッダーが必要です',
        debug: { authHeader }
      });
    }
    
    // トークン取得
    const token = authHeader.split(' ')[1];
    console.log('トークン:', token.substring(0, 20) + '...');
    
    try {
      // トークン検証
      console.log('トークン検証中...');
      console.log('検証シークレット:', simpleAuthConfig.jwtSecret.substring(0, 5) + '...');
      
      // Simple認証専用のシークレットとオプションでトークンを検証
      const decoded = jwt.verify(token, simpleAuthConfig.jwtSecret, {
        issuer: simpleAuthConfig.jwtOptions.issuer,
        audience: simpleAuthConfig.jwtOptions.audience
      });
      console.log('検証結果:', decoded);
      
      // ユーザーIDをリクエストに設定
      req.userId = decoded.id;
      console.log('ユーザーID:', req.userId);
      
      // ユーザー情報を取得
      const user = await SimpleUser.findById(req.userId, '-password -refreshToken');
      console.log('ユーザー:', user ? 'ユーザーが見つかりました' : 'ユーザーが見つかりません');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'ユーザーが見つかりません',
          debug: { userId: req.userId }
        });
      }
      
      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'アカウントが無効化されています',
          debug: { status: user.status }
        });
      }
      
      // 結果返却
      return res.status(200).json({
        success: true,
        message: '認証成功',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
            apiKeyId: user.apiKeyId
          }
        },
        debug: {
          tokenDecoded: decoded,
          timestamp: new Date().toISOString()
        }
      });
    } catch (jwtError) {
      // JWTエラー処理
      console.log('JWTエラー:', jwtError);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'トークンの有効期限が切れています',
          debug: {
            error: jwtError.message,
            expiredAt: jwtError.expiredAt
          }
        });
      }
      
      return res.status(401).json({
        success: false,
        message: '無効なトークンです',
        debug: {
          error: jwtError.message
        }
      });
    }
  } catch (error) {
    console.error('認証デバッグエラー:', error);
    return res.status(500).json({
      success: false,
      message: '認証デバッグ中にエラーが発生しました',
      error: error.message,
      debug: {
        stack: error.stack
      }
    });
  }
};