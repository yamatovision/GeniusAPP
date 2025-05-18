# 認証関連API仕様書

**バージョン**: 1.0.0  
**最終更新日**: 2025-05-15  
**ステータス**: ドラフト  

## 1. 概要

このドキュメントでは、HinagoProject（ボリュームチェックシステム）の認証関連APIの詳細仕様を定義します。ユーザー登録、ログイン、トークン更新、パスワードリカバリなどの認証に関連する操作を安全に実行するためのインターフェースを提供します。

本APIは認証システム設計書（`/docs/architecture/auth-system-design.md`）および、アクセス制御マトリックス（`/docs/architecture/access-control.md`）に基づいて設計されています。

## 2. 認証フロー概要

### 2.1 基本認証フロー

HinagoProjectでは、JWT（JSON Web Token）ベースの認証を採用しています：

1. ユーザーがログインまたは登録を行う
2. サーバーがアクセストークン（短期）とリフレッシュトークン（長期）を発行
3. クライアントはアクセストークンをリクエストヘッダーに含めてAPI呼び出し
4. アクセストークンの有効期限が切れた場合、リフレッシュトークンを使用して新しいアクセストークンを取得
5. ログアウト時にトークンを無効化

### 2.2 トークン仕様

| トークン種別 | 有効期限 | 保管場所 | 用途 |
|------------|---------|---------|------|
| アクセストークン | 15分 | HttpOnly, Secure Cookie | API認証 |
| リフレッシュトークン | 7日（標準）, 30日（Remember Me） | HttpOnly, Secure Cookie | アクセストークン更新 |

## 3. 認証エンドポイント一覧

| エンドポイント | メソッド | 認証 | 説明 |
|--------------|--------|------|------|
| `/api/auth/register` | POST | 不要 | ユーザー新規登録 |
| `/api/auth/login` | POST | 不要 | ユーザーログイン |
| `/api/auth/logout` | POST | 必須 | ユーザーログアウト |
| `/api/auth/refresh` | POST | 不要 | アクセストークン更新 |
| `/api/auth/password-reset/request` | POST | 不要 | パスワードリセット要求 |
| `/api/auth/password-reset/confirm` | POST | 不要 | パスワードリセット確認 |
| `/api/auth/me` | GET | 必須 | 現在のユーザー情報取得 |

## 4. エンドポイント詳細

### 4.1 ユーザー登録 - POST /api/auth/register

新規ユーザーを登録し、組織を作成します。

#### リクエスト

```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "name": "山田太郎",
  "organizationName": "山田不動産開発"
}
```

#### バリデーションルール

- `email`: 必須、有効なメールアドレス形式、一意制約
- `password`: 必須、8文字以上
- `name`: 必須、1文字以上50文字以下
- `organizationName`: 必須、1文字以上100文字以下

#### レスポンス

**成功**: 201 Created
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123456",
      "email": "user@example.com",
      "name": "山田太郎",
      "role": "user",
      "organizationId": "org_123456",
      "createdAt": "2025-05-15T09:30:00Z"
    },
    "token": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": "2025-05-15T09:45:00Z"
    }
  }
}
```

**エラー**: メールアドレス重複 - 409 Conflict
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_EMAIL",
    "message": "このメールアドレスは既に使用されています"
  }
}
```

**エラー**: バリデーションエラー - 422 Unprocessable Entity
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力データが不正です",
    "details": {
      "password": "パスワードは8文字以上である必要があります"
    }
  }
}
```

#### 実装ノート

- ユーザー登録時に自動的に組織も作成される
- パスワードはbcryptで安全にハッシュ化して保存
- 登録成功時は自動的にログイン状態となる
- レート制限を適用（同一IPから5回/時間の制限）

---

### 4.2 ユーザーログイン - POST /api/auth/login

登録済みユーザーのログイン認証を行います。

#### リクエスト

```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "rememberMe": true
}
```

#### バリデーションルール

- `email`: 必須、有効なメールアドレス形式
- `password`: 必須
- `rememberMe`: オプション（ブール値）

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123456",
      "email": "user@example.com",
      "name": "山田太郎",
      "role": "user",
      "organizationId": "org_123456"
    },
    "token": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": "2025-05-15T09:45:00Z"
    }
  }
}
```

**エラー**: 認証失敗 - 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "メールアドレスまたはパスワードが正しくありません"
  }
}
```

**エラー**: アカウントロック - 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "ログイン試行回数が多すぎます。15分後に再試行してください",
    "details": {
      "lockedUntil": "2025-05-15T09:45:00Z"
    }
  }
}
```

#### 実装ノート

- 認証失敗時は詳細なエラー理由を開示しない（セキュリティ対策）
- 連続5回の認証失敗でアカウントを一時的にロック（15分間）
- `rememberMe`が`true`の場合、リフレッシュトークンの有効期限を30日に延長
- レート制限を適用（同一IPから10回/分の制限）

---

### 4.3 ユーザーログアウト - POST /api/auth/logout

ユーザーのログアウト処理を行います。

#### リクエスト

リクエストボディは不要です。認証ヘッダーにアクセストークンを含める必要があります。

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "message": "ログアウトしました"
  }
}
```

**エラー**: 認証エラー - 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "認証が必要です"
  }
}
```

#### 実装ノート

- サーバー側でリフレッシュトークンを無効化（ブラックリスト登録）
- クライアント側のクッキーをクリアするようレスポンスヘッダーを設定
- 同一ユーザーの他デバイスのセッションには影響しない
- リクエスト制限を適用（同一ユーザーから10回/分の制限）

---

### 4.4 トークン更新 - POST /api/auth/refresh

リフレッシュトークンを使用して新しいアクセストークンを取得します。

#### リクエスト

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### バリデーションルール

- `refreshToken`: 必須、有効なJWTトークン形式

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "token": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": "2025-05-15T10:00:00Z"
    }
  }
}
```

**エラー**: 無効なトークン - 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "リフレッシュトークンが無効です"
  }
}
```

**エラー**: 有効期限切れ - 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "REFRESH_TOKEN_EXPIRED",
    "message": "リフレッシュトークンの有効期限が切れています。再度ログインしてください"
  }
}
```

#### 実装ノート

- リフレッシュトークンは1回の使用で無効化（トークンローテーション）
- 新しいアクセストークンと共に新しいリフレッシュトークンも発行
- レート制限を適用（同一IPから30回/時間の制限）
- 不審なリフレッシュトークンの使用を検出した場合、関連するすべてのトークンを無効化

---

### 4.5 パスワードリセット要求 - POST /api/auth/password-reset/request

パスワードリセットのためのメール送信を要求します。

#### リクエスト

```json
{
  "email": "user@example.com"
}
```

#### バリデーションルール

- `email`: 必須、有効なメールアドレス形式

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "message": "パスワードリセット手順を記載したメールを送信しました"
  }
}
```

**注意**: セキュリティ上の理由から、メールアドレスが存在しない場合でも同じ成功レスポンスを返します。

#### 実装ノート

- リセットトークンの有効期限は24時間
- 同一メールアドレスへのリクエストは1時間に1回まで
- リセットメールには一意のトークンを含むURLを記載
- レート制限を適用（同一IPから5回/時間の制限）

---

### 4.6 パスワードリセット確認 - POST /api/auth/password-reset/confirm

リセットトークンを検証し、新しいパスワードを設定します。

#### リクエスト

```json
{
  "token": "reset_token_123456",
  "password": "NewPassword123!"
}
```

#### バリデーションルール

- `token`: 必須、有効なリセットトークン
- `password`: 必須、8文字以上

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "message": "パスワードが正常にリセットされました"
  }
}
```

**エラー**: 無効なトークン - 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "INVALID_RESET_TOKEN",
    "message": "パスワードリセットトークンが無効です"
  }
}
```

**エラー**: 有効期限切れ - 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "RESET_TOKEN_EXPIRED",
    "message": "パスワードリセットトークンの有効期限が切れています。再度リクエストしてください"
  }
}
```

**エラー**: バリデーションエラー - 422 Unprocessable Entity
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力データが不正です",
    "details": {
      "password": "パスワードは8文字以上である必要があります"
    }
  }
}
```

#### 実装ノート

- トークン使用後は即時無効化（再利用防止）
- パスワード変更後は全てのセッションを無効化（セキュリティ対策）
- レート制限を適用（同一IPから10回/時間の制限）

---

### 4.7 現在のユーザー情報取得 - GET /api/auth/me

認証されたユーザー自身の情報を取得します。

#### リクエスト

リクエストボディは不要です。認証ヘッダーにアクセストークンを含める必要があります。

#### レスポンス

**成功**: 200 OK
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123456",
      "email": "user@example.com",
      "name": "山田太郎",
      "role": "user",
      "organizationId": "org_123456",
      "organization": {
        "id": "org_123456",
        "name": "山田不動産開発",
        "subscription": "free"
      }
    }
  }
}
```

**エラー**: 認証エラー - 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "認証が必要です"
  }
}
```

#### 実装ノート

- デフォルトで組織情報も含めて返却
- クエリパラメータ `?fields=id,email,name` で返却フィールドを制限可能
- レート制限を適用（同一ユーザーから60回/分の制限）

## 5. セキュリティ考慮事項

### 5.1 レート制限ポリシー

各エンドポイントには以下のレート制限を適用します：

| エンドポイント | 制限 | 適用範囲 | 理由 |
|--------------|------|--------|------|
| `/api/auth/register` | 5回/時間 | IPアドレス | スパム登録防止 |
| `/api/auth/login` | 10回/分 | IPアドレス+メールアドレス | ブルートフォース攻撃対策 |
| `/api/auth/password-reset/request` | 5回/時間 | IPアドレス & 1回/時間/メールアドレス | スパムメール防止 |
| `/api/auth/refresh` | 30回/時間 | IPアドレス | トークン探索攻撃対策 |
| `/api/auth/me` | 60回/分 | ユーザーID | 通常利用に十分な余裕 |

制限超過時のレスポンス（429 Too Many Requests）：
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "リクエスト制限を超えました。しばらく待ってから再試行してください",
    "details": {
      "retryAfter": 60
    }
  }
}
```

### 5.2 トークンセキュリティ

1. **アクセストークンの保護**:
   - HttpOnly, Secure, SameSite=Strict属性付きクッキーとして保存
   - XSS攻撃からの保護

2. **リフレッシュトークンの保護**:
   - 同様にHttpOnly, Secure, SameSite=Strict属性付きクッキーとして保存
   - 1回使用したらローテーション（使い捨て）

3. **JWT署名**:
   - HS256アルゴリズムによる署名
   - 強力な秘密鍵の使用と定期的なローテーション

### 5.3 その他のセキュリティ対策

1. **CSRF対策**:
   - Double Submit Cookie Patternの実装
   - 状態変更操作に対するCSRFトークン要求

2. **ブルートフォース対策**:
   - 連続5回の認証失敗でアカウントを一時的にロック（15分間）
   - 失敗回数の指数バックオフによる待機時間の増加

3. **セキュアなパスワード管理**:
   - bcrypt（コスト係数12）によるハッシュ化
   - パスワード強度要件の強制
   - 平文パスワードの永続化なし

## 6. フロントエンド実装ガイド

### 6.1 認証状態管理

```typescript
// src/features/auth/context/AuthContext.tsx
import React, { createContext, useState, useEffect } from 'react';
import { User, AuthToken } from '@shared/index';
import { authApi } from '../api/authApi';
import { tokenService } from '../services/tokenService';

// コンテキスト定義
export const AuthContext = createContext({});

export const AuthProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // 初期認証状態の確認
    const checkAuth = async () => {
      try {
        if (tokenService.hasValidToken()) {
          const userData = await authApi.me();
          setUser(userData);
        }
      } catch (error) {
        // トークンが無効の場合は認証状態をクリア
        tokenService.clearTokens();
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // ログイン処理
  const login = async (email: string, password: string, rememberMe = false) => {
    const response = await authApi.login(email, password, rememberMe);
    tokenService.setTokens(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  };
  
  // ログアウト処理
  const logout = async () => {
    await authApi.logout();
    tokenService.clearTokens();
    setUser(null);
  };
  
  // コンテキスト値の提供
  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// カスタムフック
export const useAuth = () => React.useContext(AuthContext);
```

### 6.2 トークン管理

```typescript
// src/features/auth/services/tokenService.ts
import jwtDecode from 'jwt-decode';
import { AuthToken } from '@shared/index';

interface DecodedToken {
  exp: number;
  // その他のJWTクレーム
}

export const tokenService = {
  // トークンの保存
  setTokens(tokens: AuthToken) {
    // アクセストークンとリフレッシュトークンをセキュアに保存
    // 実際の実装はフロントエンドフレームワークに依存
  },
  
  // トークンの取得
  getAccessToken() {
    // 保存されたアクセストークンを取得
  },
  
  getRefreshToken() {
    // 保存されたリフレッシュトークンを取得
  },
  
  // トークンの有効性チェック
  hasValidToken() {
    const token = this.getAccessToken();
    if (!token) return false;
    
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      return decoded.exp * 1000 > Date.now();
    } catch (error) {
      return false;
    }
  },
  
  // トークンのクリア
  clearTokens() {
    // 保存されたトークンを安全に削除
  }
};
```

### 6.3 API呼び出し

```typescript
// src/features/auth/api/authApi.ts
import axios from 'axios';
import { API_PATHS } from '@shared/index';

const api = axios.create({
  baseURL: process.env.API_BASE_URL || '',
  withCredentials: true, // Cookieを含める
});

export const authApi = {
  // ユーザー登録
  async register(email, password, name, organizationName) {
    const response = await api.post(API_PATHS.AUTH.REGISTER, {
      email,
      password,
      name,
      organizationName
    });
    return response.data;
  },
  
  // ログイン
  async login(email, password, rememberMe = false) {
    const response = await api.post(API_PATHS.AUTH.LOGIN, {
      email,
      password,
      rememberMe
    });
    return response.data;
  },
  
  // ログアウト
  async logout() {
    const response = await api.post(API_PATHS.AUTH.LOGOUT);
    return response.data;
  },
  
  // トークン更新
  async refreshToken(refreshToken) {
    const response = await api.post(API_PATHS.AUTH.REFRESH, {
      refreshToken
    });
    return response.data;
  },
  
  // パスワードリセット要求
  async requestPasswordReset(email) {
    const response = await api.post(API_PATHS.AUTH.PASSWORD_RESET_REQUEST, {
      email
    });
    return response.data;
  },
  
  // パスワードリセット確認
  async confirmPasswordReset(token, password) {
    const response = await api.post(API_PATHS.AUTH.PASSWORD_RESET_CONFIRM, {
      token,
      password
    });
    return response.data;
  },
  
  // 現在のユーザー情報取得
  async me() {
    const response = await api.get(API_PATHS.AUTH.ME);
    return response.data.data.user;
  }
};
```

## 7. バックエンド実装ガイド

### 7.1 コントローラー実装

```typescript
// src/features/auth/auth.controller.ts
import { Request, Response } from 'express';
import * as authService from './auth.service';
import { validateLogin, validateRegister, validatePasswordReset } from './auth.validator';

// ユーザー登録
export const register = async (req: Request, res: Response) => {
  try {
    // バリデーション
    const { error, value } = validateRegister(req.body);
    if (error) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力データが不正です',
          details: error.details.reduce((acc, curr) => {
            acc[curr.path[0]] = curr.message;
            return acc;
          }, {})
        }
      });
    }
    
    // 登録処理
    const result = await authService.registerUser(
      value.email,
      value.password,
      value.name,
      value.organizationName
    );
    
    // レスポンス
    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    // エラーハンドリング
    if (error.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'このメールアドレスは既に使用されています'
        }
      });
    }
    
    // その他のエラー
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '内部サーバーエラーが発生しました'
      }
    });
  }
};

// 他のエンドポイント実装（login, logout, refreshToken, resetPassword等）...
```

### 7.2 サービス実装

```typescript
// src/features/auth/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserModel, OrganizationModel, TokenModel } from '../../db/models';
import { config } from '../../config';
import { User, UserRole, SubscriptionType } from '@shared/index';

// ユーザー登録
export const registerUser = async (
  email: string,
  password: string,
  name: string,
  organizationName: string
) => {
  // メールアドレス重複チェック
  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    throw { code: 'DUPLICATE_EMAIL' };
  }
  
  // パスワードハッシュ化
  const passwordHash = await bcrypt.hash(password, 12);
  
  // 組織作成
  const organization = await OrganizationModel.create({
    id: `org_${uuidv4()}`,
    name: organizationName,
    subscription: SubscriptionType.FREE,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // ユーザー作成
  const user = await UserModel.create({
    id: `user_${uuidv4()}`,
    email,
    passwordHash,
    name,
    role: UserRole.USER,
    organizationId: organization.id,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // トークン生成
  const tokens = generateTokens(user);
  
  // リフレッシュトークン保存
  await saveRefreshToken(user.id, tokens.refreshToken);
  
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: user.createdAt
    },
    token: tokens
  };
};

// トークン生成
export const generateTokens = (user: User) => {
  const payload = {
    sub: user.id,
    role: user.role,
    organizationId: user.organizationId
  };
  
  // アクセストークン生成
  const token = jwt.sign(
    payload,
    config.auth.jwtSecret,
    { expiresIn: config.auth.accessTokenExpiry }
  );
  
  // リフレッシュトークン生成
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.auth.jwtSecret,
    { expiresIn: config.auth.refreshTokenExpiry }
  );
  
  // 有効期限計算
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + config.auth.accessTokenExpiry);
  
  return {
    token,
    refreshToken,
    expiresAt: expiresAt.toISOString()
  };
};

// リフレッシュトークン保存
export const saveRefreshToken = async (userId: string, refreshToken: string) => {
  await TokenModel.create({
    id: uuidv4(),
    userId,
    token: refreshToken,
    expiresAt: new Date(Date.now() + config.auth.refreshTokenExpiry * 1000),
    createdAt: new Date()
  });
};

// 他の認証関連サービス実装...
```

### 7.3 ミドルウェア実装

```typescript
// src/features/auth/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

// 認証必須ミドルウェア
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // ヘッダーからトークン取得
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: '認証が必要です'
      }
    });
  }
  
  try {
    // トークン検証
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    // トークン無効
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'アクセストークンの有効期限が切れています'
        }
      });
    }
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'トークンが無効です'
      }
    });
  }
};

// レート制限ミドルウェア
export const rateLimit = (limit: number, windowMs: number) => {
  // 実装省略
};
```

### 7.4 ルーティング設定

```typescript
// src/features/auth/auth.routes.ts
import express from 'express';
import * as authController from './auth.controller';
import { requireAuth, rateLimit } from './auth.middleware';

const router = express.Router();

// 認証エンドポイント
router.post('/register', rateLimit(5, 60 * 60 * 1000), authController.register);
router.post('/login', rateLimit(10, 60 * 1000), authController.login);
router.post('/logout', requireAuth, authController.logout);
router.post('/refresh', rateLimit(30, 60 * 60 * 1000), authController.refreshToken);
router.post('/password-reset/request', rateLimit(5, 60 * 60 * 1000), authController.requestPasswordReset);
router.post('/password-reset/confirm', rateLimit(10, 60 * 60 * 1000), authController.confirmPasswordReset);
router.get('/me', requireAuth, authController.getProfile);

export default router;
```

## 8. テスト戦略

### 8.1 単体テスト

以下の重要な機能に対する単体テストを実装します：

1. トークン生成と検証機能
2. パスワードハッシュ化と検証機能
3. 入力バリデーション機能
4. 認証サービスの個別機能

### 8.2 統合テスト

以下のエンドポイントに対する統合テストを実装します：

1. 登録 → ログイン → プロフィール取得 → ログアウトの完全フロー
2. トークン更新フロー
3. パスワードリセットフロー
4. エラーケースの検証

### 8.3 セキュリティテスト

以下のセキュリティ側面をテストします：

1. レート制限の有効性
2. ブルートフォース攻撃に対する防御
3. CSRF対策の有効性
4. トークン漏洩時のリスク軽減策の有効性