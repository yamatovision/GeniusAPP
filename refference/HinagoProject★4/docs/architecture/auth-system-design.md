# 認証システム設計書

## 1. 概要

このドキュメントではHinagoProject（ボリュームチェックシステム）の認証システムの詳細設計を定義します。
シンプルで堅牢な認証基盤を提供し、不動産ディベロッパー企業の各担当者が安全にシステムを利用できる環境を構築します。

## 2. 認証メカニズム

### 2.1 選定方式
* JWT（JSON Web Token）ベースの認証
* リフレッシュトークンによるアクセストークン再発行

### 2.2 選定理由
* ステートレス性によるスケーラビリティ確保
* フロントエンド/バックエンド分離アーキテクチャとの親和性
* 将来的な拡張性の確保（マイクロサービス対応など）

## 3. ユーザーロール設計

### 3.1 ロール構成
プロジェクトの初期段階では単一ロール構成を採用し、シンプルな権限管理を行います：

* `USER` - システムの全機能にアクセス可能な標準ユーザー

### 3.2 将来的な拡張可能性
今後の要件変化に応じて、以下のようなロール拡張が可能な設計とします：

* `ADMIN` - 管理者権限（ユーザー管理、システム設定）
* `READ_ONLY` - 参照のみ権限（閲覧のみユーザー）

## 4. 認証フロー

### 4.1 登録（サインアップ）フロー
```
1. ユーザーが登録フォームに必要情報を入力
   - メールアドレス
   - パスワード（8文字以上）
   - ユーザー名
   - 組織名
   
2. バリデーションチェック
   - メールアドレスの形式検証
   - パスワード強度検証
   - 必須項目入力確認
   
3. メールアドレスの重複チェック
   
4. パスワードのハッシュ化（bcrypt）
   
5. ユーザー情報の保存
   - ユーザーテーブルに基本情報保存
   - 組織テーブルに組織情報保存
   
6. 認証トークンの生成
   - アクセストークン（短期）
   - リフレッシュトークン（長期）
   
7. トークンをレスポンスとして返却
   
8. 自動ログイン状態でダッシュボードへリダイレクト
```

### 4.2 ログイン（サインイン）フロー
```
1. ユーザーがログインフォームに認証情報を入力
   - メールアドレス
   - パスワード
   - ログイン状態保持オプション（Remember Me）
   
2. 認証情報の検証
   - メールアドレスでユーザー検索
   - パスワードハッシュの検証
   
3. 認証失敗時
   - エラーメッセージを表示
   - ログイン試行回数の記録（ブルートフォース対策）
   
4. 認証成功時
   - アクセストークン生成（有効期間: 15分）
   - リフレッシュトークン生成（有効期間: 7日、または30日（Remember Me選択時））
   - ユーザー情報の取得

5. レスポンスの返却
   - トークン情報
   - ユーザー基本情報
   
6. フロントエンドでのトークン保存
   - アクセストークン: Cookie (HttpOnly, Secure)
   - リフレッシュトークン: Cookie (HttpOnly, Secure)
   
7. ダッシュボードへリダイレクト
```

### 4.3 パスワードリセットフロー
```
1. ユーザーがパスワードリセットフォームにメールアドレスを入力

2. リセットトークンの生成と保存
   - 一意のリセットトークン生成
   - 有効期限設定（24時間）
   - ユーザーIDとの紐付け

3. リセットメールの送信
   - リセットリンク（トークン付きURL）
   - 有効期限の通知

4. ユーザーがメール内のリセットリンクをクリック

5. トークンの検証
   - 存在確認
   - 有効期限確認

6. 新パスワード設定フォームの表示

7. ユーザーが新パスワードを入力（確認用2回）

8. パスワードのバリデーションとハッシュ化

9. パスワードの更新

10. リセットトークンの無効化

11. 完了通知とログインページへのリダイレクト
```

### 4.4 トークン更新フロー
```
1. アクセストークンの有効期限切れを検出

2. リフレッシュトークンを使用した再認証リクエスト

3. リフレッシュトークンの検証
   - 存在確認
   - 有効期限確認
   - トークンの有効性確認

4. 検証成功時
   - 新しいアクセストークン生成
   - 必要に応じてリフレッシュトークンも更新

5. 検証失敗時
   - 再ログインを要求

6. 新トークンの返却と保存
```

### 4.5 ログアウトフロー
```
1. ユーザーがログアウトリクエスト

2. クライアント側
   - アクセストークンのクリア
   - リフレッシュトークンのクリア
   - アプリケーション状態のリセット

3. サーバー側
   - リフレッシュトークンの無効化（ブラックリスト登録）

4. ログインページへのリダイレクト
```

## 5. セキュリティ対策

### 5.1 パスワード管理
* ハッシュアルゴリズム: bcrypt (コスト係数 12)
* パスワードポリシー: 最低8文字
* パスワード保存: ハッシュ値のみ（平文保存なし）

### 5.2 トークン管理
* アクセストークン有効期限: 15分
* リフレッシュトークン有効期限: 7日（標準）/ 30日（Remember Me選択時）
* トークン保存: HttpOnly, Secure Cookieでの保存
* トークン署名: HS256アルゴリズム

### 5.3 保護対策
* CSRF対策: Double Submit Cookie Pattern
* レート制限: 同一IPからの試行を10回/分に制限
* ブルートフォース対策: 連続5回失敗で一時的ロック（15分）
* XSS対策: HTTPヘッダー設定、入力サニタイズ

## 6. コード構造とアーキテクチャガイドライン

### 6.1 認証関連コードの構成
* バックエンド側の認証関連コードは `features/auth/` ディレクトリに集約する
* 単一責任の原則に基づき、以下のファイル構造を維持する:
  - `auth.controller.ts`: リクエスト処理とレスポンス整形
  - `auth.service.ts`: 認証ロジックの中核と業務処理
  - `auth.routes.ts`: エンドポイント定義とミドルウェア適用
  - `auth.middleware.ts`: 認証状態検証と権限チェック機能
  - `auth.validator.ts`: 入力検証ルール
  - `auth.types.ts`: 認証関連の型定義（shared/index.tsを参照）

### 6.2 フロントエンド認証管理
* 認証状態は専用のコンテキストで管理: `features/auth/AuthContext.tsx`
* トークン管理とセキュアなストレージ: `features/auth/services/tokenService.ts`
* 認証専用フック: `features/auth/hooks/useAuth.ts`
* 保護されたルート処理: `features/auth/components/ProtectedRoute.tsx`

### 6.3 依存関係と責任分離
* 認証モジュールは他の機能モジュールに依存しない（単方向依存）
* 認証状態の変更は適切なイベントシステムを通じて通知する
* 認証関連のエラー処理は専用のエラーハンドラーで一元管理
* 環境ごとの認証設定は設定ファイルから注入（ハードコード禁止）

## 7. APIインターフェース

### 7.1 認証API
| エンドポイント | メソッド | 説明 | リクエスト | レスポンス |
|--------------|--------|------|-----------|-----------|
| `/api/auth/register` | POST | ユーザー登録 | { email, password, name, organizationName } | { success, token, user } |
| `/api/auth/login` | POST | ログイン | { email, password, rememberMe } | { success, token, user } |
| `/api/auth/logout` | POST | ログアウト | - | { success } |
| `/api/auth/refresh` | POST | トークン更新 | { refreshToken } | { success, token } |
| `/api/auth/password-reset/request` | POST | パスワードリセット要求 | { email } | { success } |
| `/api/auth/password-reset/confirm` | POST | パスワードリセット確認 | { token, password } | { success } |

### 7.2 認証エラーレスポンスの標準形式
* 401 Unauthorized: `{ "success": false, "error": "認証が必要です", "code": "AUTH_REQUIRED" }`
* 403 Forbidden: `{ "success": false, "error": "この操作を実行する権限がありません", "code": "PERMISSION_DENIED" }`
* 400 Bad Request: `{ "success": false, "error": "入力データが不正です", "code": "INVALID_INPUT", "details": { ... } }`

## 8. 実装ガイドライン

### 8.1 認証ミドルウェアの実装
```typescript
// auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../../../shared';
import { config } from '../../config';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Cookieからトークン取得
  const token = req.cookies['access_token'];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: '認証が必要です',
      code: 'AUTH_REQUIRED'
    } as ApiResponse<null>);
  }
  
  try {
    // トークン検証
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.user = decoded; // Request型拡張で認証ユーザー情報を付加
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'トークンが無効です',
      code: 'INVALID_TOKEN'
    } as ApiResponse<null>);
  }
};
```

### 8.2 フロントエンドでの認証状態管理
```typescript
// AuthContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { User, AuthToken } from '@shared/index';
import { tokenService } from '../services/tokenService';
import { authApi } from '../api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 初期認証チェック
  useEffect(() => {
    checkAuth()
      .finally(() => setLoading(false));
  }, []);
  
  // 認証状態を確認
  const checkAuth = async (): Promise<boolean> => {
    try {
      const token = tokenService.getAccessToken();
      
      // トークンがない場合は未認証
      if (!token) {
        return false;
      }
      
      // トークンの有効期限確認
      if (tokenService.isTokenExpired(token)) {
        // リフレッシュトークンでの更新を試行
        try {
          await refreshToken();
        } catch {
          // 更新失敗時は未認証状態に
          setUser(null);
          return false;
        }
      }
      
      // ユーザー情報取得（キャッシュされている場合はそれを使用）
      const userData = tokenService.getTokenUser() || await fetchUserData();
      setUser(userData);
      return true;
    } catch (error) {
      setUser(null);
      return false;
    }
  };
  
  // ログイン処理
  const login = async (email: string, password: string, rememberMe = false): Promise<void> => {
    setLoading(true);
    try {
      const response = await authApi.login(email, password, rememberMe);
      tokenService.setTokens(response.data.token);
      setUser(response.data.user);
    } finally {
      setLoading(false);
    }
  };
  
  // ログアウト処理
  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await authApi.logout();
    } finally {
      tokenService.clearTokens();
      setUser(null);
      setLoading(false);
    }
  };
  
  // トークン更新処理
  const refreshToken = async (): Promise<void> => {
    const refreshToken = tokenService.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await authApi.refreshToken(refreshToken);
    tokenService.setTokens(response.data.token);
  };
  
  // ユーザーデータ取得
  const fetchUserData = async (): Promise<User> => {
    const response = await authApi.getProfile();
    return response.data.user;
  };
  
  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// 認証フック
export const useAuth = () => useContext(AuthContext);
```

### 8.3 トークン管理サービスの実装
```typescript
// tokenService.ts
import jwtDecode from 'jwt-decode';
import { User, AuthToken } from '@shared/index';

interface DecodedToken {
  sub: string;
  role: string;
  exp: number;
  user: User;
}

export const tokenService = {
  // トークンの保存
  setTokens(token: AuthToken): void {
    document.cookie = `access_token=${token.token}; path=/; max-age=86400; HttpOnly; Secure; SameSite=Strict`;
    localStorage.setItem('refresh_token', token.refreshToken);
    
    // ユーザー情報をローカルストレージに保存（オプション）
    const decoded = jwtDecode<DecodedToken>(token.token);
    if (decoded.user) {
      localStorage.setItem('user', JSON.stringify(decoded.user));
    }
  },
  
  // アクセストークン取得
  getAccessToken(): string | null {
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('access_token='));
    return tokenCookie ? tokenCookie.split('=')[1] : null;
  },
  
  // リフレッシュトークン取得
  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  },
  
  // トークンからユーザー情報取得
  getTokenUser(): User | null {
    const userJson = localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
  },
  
  // トークンの有効期限確認
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  },
  
  // トークンのクリア
  clearTokens(): void {
    document.cookie = 'access_token=; path=/; max-age=0; HttpOnly; Secure; SameSite=Strict';
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }
};
```

## 9. 認証テスト戦略

### 9.1 単体テスト対象
- 認証サービスのビジネスロジック
- JWTトークン生成と検証
- パスワードハッシュ化とチェック
- 入力バリデーション

### 9.2 統合テスト対象
- 認証エンドポイントの動作検証
- 認証ミドルウェアの機能検証
- トークン更新フローの全体検証

### 9.3 E2Eテスト対象
- ユーザー登録からログインまでの流れ
- パスワードリセットフロー
- 認証状態に応じたUI制御

## 10. 移行と運用計画

### 10.1 実装フェーズ
1. 認証バックエンド実装 (2日)
2. フロントエンド認証コンポーネント実装 (2日)
3. 認証状態管理とルート保護実装 (1日)
4. セキュリティ対策の実装とテスト (1日)

### 10.2 運用監視計画
- 認証失敗のログ記録とアラート設定
- ログイン試行回数の監視（異常値検出）
- トークン更新エラーの監視とトラッキング

## 11. APIデザイナーへの引き継ぎポイント

### 11.1 認証が必要なエンドポイント
* すべての `/api/` エンドポイントは認証が必要（以下を除く）
* 認証不要エンドポイント: `/api/auth/login`, `/api/auth/register`, `/api/auth/password-reset/request`, `/api/auth/password-reset/confirm`

### 11.2 認証エラーレスポンスの標準形式
* 401 Unauthorized: `{ "success": false, "error": "認証が必要です", "code": "AUTH_REQUIRED" }`
* 403 Forbidden: `{ "success": false, "error": "この操作を実行する権限がありません", "code": "PERMISSION_DENIED" }`