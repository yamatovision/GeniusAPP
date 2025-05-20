/**
 * 認証サービス
 */
import { AppError } from '../../common/middlewares';
import { ErrorCodes } from '../../common/utils';
import { User, Organization, RefreshToken } from '../../db/models';
import config from '../../config';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  calculateRefreshTokenExpiry,
  createTokenResponse 
} from './auth.utils';
import { 
  AuthResponse, 
  LoginData, 
  RegisterData, 
  PasswordResetRequest, 
  PasswordResetConfirm,
  SubscriptionType 
} from '../../types';
import logger from '../../common/utils/logger';

/**
 * ユーザー登録
 * @param registerData 登録データ
 * @returns 認証レスポンス（ユーザー情報とトークン）
 */
export const register = async (registerData: RegisterData): Promise<AuthResponse> => {
  const { email, password, name, organizationName } = registerData;

  // メールアドレスの重複チェック
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError(
      'このメールアドレスは既に使用されています',
      409,
      ErrorCodes.RESOURCE_ALREADY_EXISTS
    );
  }

  // 組織の作成
  const organization = await Organization.create({
    name: organizationName,
    subscription: SubscriptionType.FREE,
  });

  // ユーザーの作成
  const user = await User.create({
    email,
    password,
    name,
    organizationId: organization._id,
  });

  // トークンの生成
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const expiresAt = calculateRefreshTokenExpiry();

  // リフレッシュトークンの保存
  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt,
  });

  // レスポンスの作成
  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId.toString(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token: createTokenResponse(accessToken, refreshToken),
  };
};

/**
 * ログイン
 * @param loginData ログインデータ
 * @returns 認証レスポンス（ユーザー情報とトークン）
 */
export const login = async (loginData: LoginData): Promise<AuthResponse> => {
  const { email, password, rememberMe = false } = loginData;

  // メールアドレスでユーザーを検索（パスワードも含めて取得）
  const user = await User.findByEmail(email);
  if (!user) {
    throw new AppError(
      'メールアドレスまたはパスワードが正しくありません',
      401,
      ErrorCodes.INVALID_CREDENTIALS
    );
  }

  // パスワードの検証
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError(
      'メールアドレスまたはパスワードが正しくありません',
      401,
      ErrorCodes.INVALID_CREDENTIALS
    );
  }

  // トークンの生成
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const expiresAt = calculateRefreshTokenExpiry(rememberMe);

  // リフレッシュトークンの保存
  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt,
  });

  // レスポンスの作成
  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId.toString(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    token: createTokenResponse(accessToken, refreshToken),
  };
};

/**
 * ログアウト
 * @param refreshToken リフレッシュトークン
 * @returns 成功した場合はtrue
 */
export const logout = async (refreshToken: string): Promise<boolean> => {
  if (!refreshToken) {
    return false;
  }

  // リフレッシュトークンを無効化
  return await RefreshToken.revokeToken(refreshToken);
};

/**
 * トークン更新
 * @param oldRefreshToken 古いリフレッシュトークン
 * @returns 新しいトークン情報
 */
export const refreshToken = async (oldRefreshToken: string): Promise<AuthResponse['token']> => {
  if (!oldRefreshToken) {
    throw new AppError(
      'リフレッシュトークンが提供されていません',
      400,
      ErrorCodes.INVALID_REFRESH_TOKEN
    );
  }

  // リフレッシュトークンの検証
  const refreshTokenDoc = await RefreshToken.findValidToken(oldRefreshToken);
  if (!refreshTokenDoc) {
    throw new AppError(
      'リフレッシュトークンが無効です',
      401,
      ErrorCodes.INVALID_REFRESH_TOKEN
    );
  }

  // 関連ユーザーの取得
  const user = await User.findById(refreshTokenDoc.userId);
  if (!user) {
    throw new AppError(
      'ユーザーが見つかりません',
      404,
      ErrorCodes.RESOURCE_NOT_FOUND
    );
  }

  // 古いリフレッシュトークンの無効化
  await RefreshToken.revokeToken(oldRefreshToken);

  // 新しいトークンの生成
  const accessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken();
  
  // 「ログイン状態を保持」の設定を維持
  const isLongExpiry = refreshTokenDoc.expiresAt.getTime() - refreshTokenDoc.createdAt.getTime() > 
                       config.auth.jwt.refreshTokenExpiry * 1000;
  
  const expiresAt = calculateRefreshTokenExpiry(isLongExpiry);

  // 新しいリフレッシュトークンの保存
  await RefreshToken.create({
    userId: user._id,
    token: newRefreshToken,
    expiresAt,
  });

  // レスポンスの作成
  return createTokenResponse(accessToken, newRefreshToken);
};

/**
 * パスワードリセット要求
 * @param data パスワードリセット要求データ
 * @returns パスワードリセットが要求されたかどうか（セキュリティのため常にtrue）
 */
export const requestPasswordReset = async (data: PasswordResetRequest): Promise<boolean> => {
  const { email } = data;

  // メールアドレスでユーザーを検索
  const user = await User.findOne({ email });
  if (!user) {
    // セキュリティのためにユーザーが存在しない場合でも成功を返す
    logger.info(`パスワードリセット要求: 存在しないメールアドレス ${email}`);
    return true;
  }

  // TODO: パスワードリセットトークンを生成して保存
  // TODO: パスワードリセットメールを送信

  return true;
};

/**
 * パスワードリセット確認
 * @param data パスワードリセット確認データ
 * @returns 成功した場合はtrue
 */
export const confirmPasswordReset = async (data: PasswordResetConfirm): Promise<boolean> => {
  const { token, password } = data;

  // TODO: パスワードリセットトークンの検証
  // TODO: パスワードの更新
  // TODO: ユーザーの全トークンを無効化

  return true;
};

/**
 * 現在のユーザー情報を取得
 * @param userId ユーザーID
 * @returns ユーザー情報
 */
export const getCurrentUser = async (userId: string): Promise<Omit<AuthResponse['user'], 'createdAt' | 'updatedAt'> & { organization: { name: string, subscription: string } }> => {
  // ユーザーの取得
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(
      'ユーザーが見つかりません',
      404,
      ErrorCodes.RESOURCE_NOT_FOUND
    );
  }

  // 組織情報の取得
  const organization = await Organization.findById(user.organizationId);
  if (!organization) {
    throw new AppError(
      '組織が見つかりません',
      404,
      ErrorCodes.RESOURCE_NOT_FOUND
    );
  }

  // レスポンスの作成
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId.toString(),
    organization: {
      name: organization.name,
      subscription: organization.subscription,
    },
  };
};