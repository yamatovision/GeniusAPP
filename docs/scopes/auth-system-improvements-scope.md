# 認証システム改善スコープ - シンプル化アプローチ

## 概要

AppGeniusの認証システムにおいて、複数の問題が発見されました。このスコープでは、以下の3つの主要問題に対処するため、「単一の信頼できる情報源」原則に基づいた認証システムの完全なリファクタリングを行います。

1. **認証情報キャッシュの管理不備**: ユーザー切り替え時にキャッシュが適切にクリアされず、前ユーザーの情報が表示される問題
2. **ログアウト時の無限ループ**: ログアウト時にScreenOrientation APIエラーやリダイレクトの無限ループが発生する問題
3. **タブ間のセッション同期問題**: 別タブに移動して戻ると「セッションの有効期限切れ」メッセージが表示される問題

## 背景

- ユーザーがmetavicer2@でログインしたのに、レノンさん（lennon@gmail）の情報が表示されるという報告がありました
- ログアウト時に多数のエラーが発生し、無限ループに陥る問題が報告されています
- 別タブに移動して戻ると「セッションの有効期限が切れた」というメッセージが頻繁に表示されます
- `http://localhost:3000/login` のページを更新するとURLが `http://localhost:3000/login?expired=true#/login?expired=true` と重複表示される問題があります

## 根本原因分析

### 1. 複数の状態管理ソースによる混乱

現状では複数の場所で認証状態が管理されており、一貫性が保たれていません：

- **重複ファイル問題**:
  - `simpleAuth.service.js` - 独自のキャッシュ管理（300秒）と認証状態保持
  - `AuthContext.js` - 別のリフレッシュサイクル（300秒）と状態管理
  - グローバル変数 vs ローカルストレージ vs メモリ内状態の不整合

- **責任の不明確さ**:
  - 認証状態の更新が複数の場所で行われている
  - キャッシュの制御が分散している
  - トークン管理の責任者が曖昧

### 2. URL処理の問題

- リダイレクト処理が適切に行われておらず、URLパラメータが重複して追加される
- 認証エラー時の処理が一貫していない

### 3. イベントフローの混乱

- ログアウト処理が完了する前にリダイレクトが発生
- 状態のクリアが不完全

## リファクタリング計画 - 「削除と単純化」を中心に

### 1. 削除対象ファイル

1. **完全に削除するファイル**:
   - `portal/frontend/src/services/simple/simpleAuth.service.js` - 新しいAuthServiceに完全統合
   - `portal/frontend/src/utils/simple-auth-header.js` - 認証ヘッダー生成を一元化

2. **内容を大幅に削減するファイル**:
   - `portal/frontend/src/contexts/AuthContext.js` - シンプルなラッパーだけに削減

### 2. 削除する冗長なコード

1. **AuthContext.js から削除**:
   ```javascript
   // 完全に削除
   const AUTH_REFRESH_INTERVAL = 300 * 1000; // 5分
   
   // 定期更新を行うuseEffect全体を削除
   useEffect(() => {
     if (!isAuthenticated) return;
     const refreshTimer = setInterval(() => {...}, AUTH_REFRESH_INTERVAL);
     return () => clearInterval(refreshTimer);
   }, [isAuthenticated]);
   
   // refreshUserInfo関数全体を削除
   const refreshUserInfo = async (force = false) => {...}
   ```

2. **App.js から削除**:
   ```javascript
   // window.locationを使った直接リダイレクト処理
   onClick={() => window.location.href = '/dashboard'}
   
   // window.locationを使ったすべてのリダイレクト
   window.location.href = '/login'

   // 複雑な独自PrivateRouteコンポーネント全体
   const PrivateRoute = ({ children }) => {...}
   ```

3. **Login.js から削除**:
   ```javascript
   // URLパラメータ取得の重複コード
   const params = new URLSearchParams(location.search);
   const errorMsg = params.get('error');
   
   // 複雑なログイン処理の大部分（単純化）
   ```

### 3. 新しいファイル構造（シンプル化）

新しい構造は以下の通りです（最小限の追加）:

```
portal/frontend/src/
├── auth/ (認証関連コードを集約)
│   ├── AuthService.js (単一の認証管理ソース)
│   ├── AuthContext.js (UIコンポーネント用の薄いラッパー)
│   └── AuthGuard.js (保護ルートの単純コンポーネント)
```

### 4. キーとなる変更点

1. **単一の認証管理ソース**:
   - すべての認証ロジックを`AuthService.js`に集約
   - データ整合性の保証はこのサービスだけが担当

2. **認証状態の正規化**:
   - メモリとストレージの状態を常に同期
   - シンプルな認証状態構造
   ```javascript
   {
     isAuthenticated: boolean, 
     user: object | null, 
     loading: boolean,
     error: string | null
   }
   ```

3. **共通インターフェース**:
   - シンプルなAPIだけを提供
   ```javascript
   login(email, password) // ログイン
   logout() // ログアウト
   getAuthState() // 現在の認証状態を取得
   getAuthHeader() // 認証ヘッダーを取得
   ```

4. **シンプルなリダイレクト処理**:
   ```javascript
   // 常にReact Routerのnavigateを使用（window.locationは使わない）
   navigate('/login', { replace: true })
   ```

## 実装タスク

### 1. コア認証サービスの作成

```javascript
// AuthService.js - シンプルな認証サービス
class AuthService {
  // シングルトンインスタンス
  static instance = null;
  
  // プライベート状態
  #authenticated = false;
  #user = null;
  #loading = true;
  #error = null;
  #accessToken = null;
  
  // シンプルなリフレッシュサイクル
  #refreshInterval = 60 * 1000; // 1分
  #refreshTimer = null;
  
  // シングルトンインスタンスの取得
  static getInstance() {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  // 初期化
  constructor() {
    this.init();
  }
  
  // 初期化処理
  async init() {
    // ローカルストレージから認証情報を取得
    try {
      const userData = this.#loadUserData();
      if (userData && userData.accessToken) {
        this.#user = userData;
        this.#authenticated = true;
        this.#accessToken = userData.accessToken;
        this.#startRefreshCycle();
      }
    } catch (e) {
      console.error('認証初期化エラー:', e);
    } finally {
      this.#loading = false;
      this.#notifyStateChange();
    }
  }
  
  // ログイン
  async login(email, password) {
    this.#loading = true;
    this.#error = null;
    this.#notifyStateChange();
    
    try {
      // APIリクエスト
      const response = await fetch('/api/simple/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'ログインに失敗しました');
      }
      
      // 認証情報を保存
      this.#user = data.data;
      this.#authenticated = true;
      this.#accessToken = data.data.accessToken;
      this.#saveUserData(data.data);
      this.#startRefreshCycle();
      
      return data;
    } catch (error) {
      this.#error = error.message;
      throw error;
    } finally {
      this.#loading = false;
      this.#notifyStateChange();
    }
  }
  
  // ログアウト
  async logout() {
    try {
      // リフレッシュサイクルを停止
      this.#stopRefreshCycle();
      
      // ローカルでの状態クリア
      this.#clearUserData();
      this.#authenticated = false;
      this.#user = null;
      this.#accessToken = null;
      
      // サーバーへのログアウトは非同期で行い、クライアント側では結果を待たない
      fetch('/api/simple/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.#user?.refreshToken })
      }).catch(e => console.warn('サーバーログアウトエラー:', e));
      
      return true;
    } catch (error) {
      console.error('ログアウトエラー:', error);
      return false;
    } finally {
      this.#notifyStateChange();
    }
  }
  
  // 認証状態の取得
  getAuthState() {
    return {
      isAuthenticated: this.#authenticated,
      user: this.#user,
      loading: this.#loading,
      error: this.#error
    };
  }
  
  // 認証ヘッダーの取得
  getAuthHeader() {
    return this.#accessToken 
      ? { 'Authorization': `Bearer ${this.#accessToken}` }
      : {};
  }
  
  // プライベートメソッド: ユーザーデータの保存
  #saveUserData(userData) {
    try {
      localStorage.setItem('simpleUser', JSON.stringify(userData));
      // 冗長性のため主要トークンを別途保存
      localStorage.setItem('accessToken', userData.accessToken);
    } catch (e) {
      console.error('ユーザーデータ保存エラー:', e);
    }
  }
  
  // プライベートメソッド: ユーザーデータの読み込み
  #loadUserData() {
    try {
      const data = localStorage.getItem('simpleUser');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('ユーザーデータ読み込みエラー:', e);
      return null;
    }
  }
  
  // プライベートメソッド: ユーザーデータのクリア
  #clearUserData() {
    try {
      localStorage.removeItem('simpleUser');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      sessionStorage.removeItem('simpleUser');
    } catch (e) {
      console.error('ユーザーデータクリアエラー:', e);
    }
  }
  
  // プライベートメソッド: 状態変更通知
  #notifyStateChange() {
    // カスタムイベントで状態変更を通知
    window.dispatchEvent(new CustomEvent('auth:stateChanged', {
      detail: this.getAuthState()
    }));
  }
  
  // プライベートメソッド: リフレッシュサイクル開始
  #startRefreshCycle() {
    this.#stopRefreshCycle();
    this.#refreshTimer = setInterval(() => {
      this.#verifyAuth();
    }, this.#refreshInterval);
  }
  
  // プライベートメソッド: リフレッシュサイクル停止
  #stopRefreshCycle() {
    if (this.#refreshTimer) {
      clearInterval(this.#refreshTimer);
      this.#refreshTimer = null;
    }
  }
  
  // プライベートメソッド: 認証検証
  async #verifyAuth() {
    if (!this.#authenticated || !this.#accessToken) return;
    
    try {
      const response = await fetch('/api/simple/auth/check', {
        headers: { 'Authorization': `Bearer ${this.#accessToken}` }
      });
      
      if (!response.ok) {
        // トークンが無効な場合はログアウト
        this.logout();
      }
    } catch (e) {
      console.warn('認証検証エラー:', e);
    }
  }
}

export default AuthService;
```

### 2. シンプルな認証コンテキスト

```javascript
// AuthContext.js - 薄いラッパーだけに簡素化
import React, { createContext, useState, useEffect } from 'react';
import AuthService from './AuthService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // AuthServiceのシングルトンインスタンス
  const authService = AuthService.getInstance();
  
  // 認証状態 
  const [authState, setAuthState] = useState(authService.getAuthState());
  
  // 認証状態変更イベントのリスナー
  useEffect(() => {
    const handleAuthChange = () => {
      setAuthState(authService.getAuthState());
    };
    
    // イベントリスナーを登録
    window.addEventListener('auth:stateChanged', handleAuthChange);
    window.addEventListener('focus', () => authService.checkAuth());
    
    return () => {
      window.removeEventListener('auth:stateChanged', handleAuthChange);
      window.removeEventListener('focus', () => authService.checkAuth());
    };
  }, []);
  
  // 最小限の認証API
  const contextValue = {
    // 状態
    ...authState,
    
    // メソッド
    login: authService.login.bind(authService),
    logout: authService.logout.bind(authService),
    getAuthHeader: authService.getAuthHeader.bind(authService)
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// シンプルなカスタムフック
export const useAuth = () => React.useContext(AuthContext);

export default AuthContext;
```

### 3. シンプルな保護ルート

```javascript
// AuthGuard.js - シンプルな保護ルートコンポーネント
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const AuthGuard = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  // ローディング中
  if (loading) {
    return <div>Loading...</div>;
  }
  
  // 未認証ならリダイレクト
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  // 認証済みなら子要素を表示
  return children;
};

export default AuthGuard;
```

## 期待される成果

このシンプル化リファクタリングにより：

1. **コード量の削減**
   - 認証関連のコード量を50%以上削減
   - 重複ロジックを排除し保守性向上

2. **シンプルな責任分担**
   - 認証管理: AuthService
   - UI連携: AuthContext
   - ルート保護: AuthGuard

3. **一貫したユーザー体験**
   - ログアウト時の無限ループ解消
   - URLパラメータ重複なし
   - セッション期限切れメッセージの適切な表示

4. **将来の拡張性**
   - 新機能を追加しやすいシンプルな構造
   - 明確なインターフェースによる依存性の軽減

## テスト計画

1. **ユーザー切り替えテスト**
   - ユーザーAからBへのログイン切り替えでキャッシュ問題が解消されていることを確認

2. **ログアウト安定性テスト**
   - 複数回ログアウトしても安定して動作することを確認
   - リダイレクトでURLが重複しないことを確認

3. **タブ間同期テスト**
   - 複数タブで認証状態が同期されることを確認

4. **セッション期限切れテスト**
   - トークン有効期限切れ時に適切に処理されることを確認