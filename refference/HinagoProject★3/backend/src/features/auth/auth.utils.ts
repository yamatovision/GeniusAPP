/**
 * 認証関連のユーティリティ関数
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config';
import { UserDocument } from '../../db/models';
import { AuthToken } from '../../types';

/**
 * アクセストークン生成関数
 * @param user ユーザードキュメント
 * @returns 生成されたアクセストークン
 */
export const generateAccessToken = (user: UserDocument): string => {
  const payload = {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  };

  return jwt.sign(payload, config.auth.jwt.secret, {
    expiresIn: config.auth.jwt.accessTokenExpiry,
  });
};

/**
 * リフレッシュトークン生成関数
 * @returns 生成されたリフレッシュトークン
 */
export const generateRefreshToken = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * リフレッシュトークンの有効期限を計算する関数
 * @param rememberMe 「ログイン状態を保持する」が選択されているか
 * @returns リフレッシュトークンの有効期限日時
 */
export const calculateRefreshTokenExpiry = (rememberMe: boolean = false): Date => {
  const expirySeconds = rememberMe
    ? config.auth.jwt.refreshTokenExpiryRemember
    : config.auth.jwt.refreshTokenExpiry;

  return new Date(Date.now() + expirySeconds * 1000);
};

/**
 * トークンオブジェクトを生成する関数
 * @param accessToken アクセストークン
 * @param refreshToken リフレッシュトークン
 * @param expiresIn アクセストークンの有効期限（秒）
 * @returns トークンオブジェクト
 */
export const createTokenResponse = (
  accessToken: string,
  refreshToken: string,
  expiresIn: number = config.auth.jwt.accessTokenExpiry
): AuthToken => {
  return {
    token: accessToken,
    refreshToken: refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
};

/**
 * パスワードリセットトークンを生成する関数
 * @returns 生成されたパスワードリセットトークン
 */
export const generatePasswordResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};