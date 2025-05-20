/**
 * テスト用認証ヘルパー
 */
import jwt from 'jsonwebtoken';
import { createTestUser, createTestRefreshToken } from './db-test-helper';
import config from '../../src/config';
import { UserRole } from '../../src/types';

/**
 * テスト用アクセストークンの生成
 */
export const generateTestAccessToken = (
  userId: string,
  email = 'test@example.com',
  role = UserRole.USER,
  organizationId = 'testOrgId'
): string => {
  const payload = {
    id: userId,
    email,
    role,
    organizationId,
  };
  
  console.log('JWT秘密鍵:', config.auth.jwt.secret);
  console.log('ペイロード:', JSON.stringify(payload));
  
  try {
    const token = jwt.sign(payload, config.auth.jwt.secret, {
      expiresIn: '15m',
    });
    console.log('トークン生成成功');
    return token;
  } catch (error) {
    console.error('トークン生成エラー:', error);
    throw error;
  }
};

/**
 * ユーザーデータからアクセストークンを生成
 */
export const generateAuthToken = async (user: any): Promise<string> => {
  console.log('ユーザー情報:', {
    id: user.id || user._id.toString(),
    email: user.email,
    role: user.role,
    organizationId: user.organizationId.toString()
  });

  return generateTestAccessToken(
    user.id || user._id.toString(),
    user.email,
    user.role,
    user.organizationId.toString()
  );
};

/**
 * テスト用認証ユーザーの作成（ユーザー + トークン）
 */
export const createTestAuthUser = async (): Promise<{
  user: any;
  accessToken: string;
  refreshToken: string;
}> => {
  // テストユーザーの作成
  const user = await createTestUser();
  
  // アクセストークンの生成
  const accessToken = generateTestAccessToken(
    user._id.toString(),
    user.email,
    user.role,
    user.organizationId.toString()
  );
  
  // リフレッシュトークンの作成
  const refreshTokenValue = 'test-refresh-token';
  await createTestRefreshToken(user._id, refreshTokenValue);
  
  return {
    user,
    accessToken,
    refreshToken: refreshTokenValue,
  };
};

/**
 * 認証ヘッダーの生成
 */
export const getAuthHeader = (accessToken: string): { Authorization: string } => {
  return { Authorization: `Bearer ${accessToken}` };
};