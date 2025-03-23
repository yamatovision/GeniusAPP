/**
 * シンプル認証ヘルパー
 * JWTトークン生成と検証のユーティリティ関数
 */
const jwt = require('jsonwebtoken');
const config = require('../config/simple-auth.config');

/**
 * シンプル認証用のアクセストークンを生成する
 * @param {string} userId - ユーザーID
 * @param {string} userRole - ユーザーロール
 * @returns {string} 生成されたJWTトークン
 */
exports.generateAccessToken = (userId, userRole) => {
  return jwt.sign(
    { id: userId, role: userRole },
    config.jwtSecret,
    { 
      expiresIn: config.jwtExpiration,
      issuer: config.jwtOptions.issuer,
      audience: config.jwtOptions.audience
    }
  );
};

/**
 * シンプル認証用のリフレッシュトークンを生成する
 * @param {string} userId - ユーザーID
 * @returns {string} 生成されたJWTトークン
 */
exports.generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    config.refreshTokenSecret,
    { 
      expiresIn: config.refreshTokenExpiration,
      issuer: config.jwtOptions.issuer,
      audience: config.jwtOptions.audience
    }
  );
};

/**
 * トークン検証オプションを取得
 * @returns {Object} 検証オプション
 */
exports.getVerifyOptions = () => {
  return {
    clockTolerance: config.tokenSettings.validation.jwtClockTolerance,
    issuer: config.jwtOptions.issuer,
    audience: config.jwtOptions.audience
  };
};

/**
 * アクセストークンを検証する
 * @param {string} token - 検証するトークン
 * @returns {Object} デコードされたトークン
 * @throws {Error} 検証に失敗した場合
 */
exports.verifyAccessToken = (token) => {
  return jwt.verify(
    token, 
    config.jwtSecret, 
    {
      clockTolerance: config.tokenSettings.validation.jwtClockTolerance,
      issuer: config.jwtOptions.issuer,
      audience: config.jwtOptions.audience
    }
  );
};

/**
 * リフレッシュトークンを検証する
 * @param {string} token - 検証するトークン
 * @returns {Object} デコードされたトークン
 * @throws {Error} 検証に失敗した場合
 */
exports.verifyRefreshToken = (token) => {
  return jwt.verify(
    token, 
    config.refreshTokenSecret, 
    {
      clockTolerance: config.tokenSettings.validation.jwtClockTolerance,
      issuer: config.jwtOptions.issuer,
      audience: config.jwtOptions.audience
    }
  );
};