# AppGenius ダッシュボード表示問題の修正ガイド

## 問題の概要

ログインすると共通の上のバーしか表示されず、ダッシュボードのコンテンツが表示されません。さらに、プロンプト管理などのボタンを押しても全く動作しません。ブラウザコンソールには「Maximum update depth exceeded」というエラーが表示されています。

この問題は、React Routerのナビゲーション処理で無限ループが発生し、コンポーネントが正しくレンダリングされていないことが原因です。具体的には、SimplePrivateRouteコンポーネントのuseEffect内でのナビゲーション処理が無限ループを引き起こしています。

## 診断ツール

問題の診断には `test_routing.html` ファイルを使用してください。このファイルを通常のブラウザで開き、認証状態の確認や各種テストを実行できます。

```bash
# ブラウザでテストページを開く方法
open /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/test_routing.html
```

## 問題の原因と解決方法

### 1. React Routerの無限ループ問題

React Routerのナビゲーション処理が無限ループに陥っています。

#### 確認手順：
1. ブラウザの開発者ツールでコンソールを開き、「Maximum update depth exceeded」エラーを確認します
2. React DevToolsのProfierを使用して、コンポーネントの再レンダリング回数を確認します
3. SimplePrivateRouteコンポーネントのuseEffect内のナビゲーション処理を確認します

#### 修正方法：
- useEffect内での「navigate('/simple/login')」の使用を避け、代わりにRenderプロパティパターンを使用
- レンダリング関数内で「<Navigate to="/simple/login" replace />」を使用
- useEffectの依存配列を適切に設定し、無限ループを防止

### 2. 認証状態管理の問題

認証状態の管理とリダイレクト処理に問題があります。

#### 確認手順：
1. ローカルストレージの「simpleUser」キーを確認し、適切な認証情報が保存されているか確認
2. 認証リダイレクト時のブラウザ履歴スタックの状態を確認
3. 条件付きレンダリングとリダイレクトの関係を確認

#### 修正方法：
- 認証状態を保持するための新しいステート変数（isAuthenticated）を追加
- Navigateコンポーネントにreplaceプロパティを追加して履歴スタックを適切に管理
- useEffect内での状態チェックを最適化し、認証状態に応じた条件付きレンダリングを改善

### 3. useEffectの依存配列問題

useEffectの依存配列が適切に設定されていないため、再レンダリングのループが発生しています。

#### 確認手順：
1. React DevToolsを使用して、コンポーネントの再レンダリング回数を監視
2. useEffectの依存配列を確認し、必要な依存関係が正しく指定されているか確認
3. 状態更新ロジックが不要な再レンダリングを引き起こしていないか確認

#### 修正方法：
- useEffectの依存配列を最適化し、必要なステート変数のみを含める
- 状態更新条件を最適化し、必要な場合のみ状態を更新する
- アプリ初期化処理のuseEffectに適切な依存配列を指定する

### 4. API呼び出しの最適化

不要なAPI呼び出しがパフォーマンス問題を悪化させています。

#### 確認手順：
1. ブラウザの開発者ツールのNetworkタブで、繰り返しのAPI呼び出しを確認
2. APIレスポンスの状態が適切に処理され、無限ループの原因になっていないか確認
3. 認証状態に応じたAPI呼び出しの条件分岐を確認

#### 修正方法：
- 既にユーザー情報がある場合は、不要なAPIリクエストを回避
- API呼び出し前に認証状態を慎重にチェックし、必要な場合のみリクエストを実行
- エラーハンドリングを強化し、APIエラー時の適切な対応を実装

## ファイル単位の修正

### `token-refresh.js`

トークンリフレッシュのエラーハンドリングを強化します：

```javascript
// リフレッシュトークンを使って新しいアクセストークンを取得
const refreshToken = async () => {
  // ローカルストレージチェックを強化
  if (!localStorage.getItem('simpleUser')) {
    console.error('[TokenRefresh] simpleUser情報が存在しません');
    return null;
  }
  
  // エラーハンドリングを改善
  try {
    // ... 既存のコード ...
  } catch (error) {
    // APIエラーの詳細ログを強化
    console.error('[TokenRefresh] リフレッシュエラー:', error.message);
    
    if (error.response && error.response.status === 401) {
      // 認証エラー時のクリーンアップを強化
      localStorage.removeItem('simpleUser');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // 認証エラー時のリダイレクト
      setTimeout(() => {
        window.location.href = '/login?error=session_expired';
      }, 500);
    }
    
    throw error;
  }
};
```

### `simpleAuth.service.js`

認証状態確認を強化します：

```javascript
export const isLoggedIn = () => {
  try {
    const simpleUserStr = localStorage.getItem('simpleUser');
    if (!simpleUserStr) {
      return false;
    }
    
    let user;
    try {
      user = JSON.parse(simpleUserStr);
    } catch (parseError) {
      return false;
    }
    
    if (!user || !user.accessToken) {
      return false;
    }
    
    // トークンの基本的な形式チェック
    const tokenParts = user.accessToken.split('.');
    if (tokenParts.length !== 3) {
      return false; 
    }
    
    // トークンの有効期限チェック
    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      if (payload.exp && Date.now() > payload.exp * 1000) {
        return false;
      }
    } catch (tokenError) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};
```

### `App.js`

`PrivateRoute` コンポーネントを修正します：

```javascript
const PrivateRoute = ({ children }) => {
  // 認証状態をシンプルに確認
  const isAuthenticated = !!localStorage.getItem('simpleUser');
  
  // 認証されていなければログインページにリダイレクト
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // 認証済みの場合は子コンポーネントを表示
  return children;
};
```

### `Dashboard.js`

ユーザー情報取得とレンダリングロジックを修正します：

```javascript
useEffect(() => {
  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // 認証状態を明示的に確認
      const isUserLoggedIn = localStorage.getItem('simpleUser') !== null;
      
      if (!isUserLoggedIn) {
        setError('認証情報が見つかりません。再ログインしてください。');
        setLoading(false);
        return;
      }
      
      // ローカルストレージからユーザー情報を取得
      const storedSimpleUser = localStorage.getItem('simpleUser');
      
      if (storedSimpleUser) {
        try {
          const parsedUser = JSON.parse(storedSimpleUser);
          
          // 適切にユーザー情報を設定
          if (parsedUser.user) {
            setUser(parsedUser.user);
          } else {
            const userInfo = {
              name: parsedUser.name,
              email: parsedUser.email,
              role: parsedUser.role,
              id: parsedUser.id || parsedUser._id
            };
            setUser(userInfo);
          }
        } catch (parseError) {
          console.error('ユーザー情報の解析エラー:', parseError);
        }
      }
      
      // API呼び出し前の状態チェック
      const authToken = (function() {
        try {
          const userData = JSON.parse(localStorage.getItem('simpleUser') || '{}');
          return userData.accessToken;
        } catch (e) {
          return null;
        }
      })();
      
      if (!authToken) {
        setError('認証情報が不足しています。再ログインしてください。');
        setLoading(false);
        return;
      }
      
      // サーバーからユーザー情報を取得
      try {
        const response = await simpleAuthService.getCurrentUser();
        
        // レスポンス処理を改善
        const userData = response.data || response;
        
        if (userData && userData.user) {
          setUser(userData.user);
        } else if (userData) {
          setUser(userData);
        } else {
          setError('ユーザー情報が取得できませんでした。');
        }
      } catch (apiError) {
        // エラーハンドリングを強化
        console.error('ユーザー情報取得エラー:', apiError);
        setError('ユーザー情報の取得に失敗しました。');
        
        // トークンリフレッシュを試みる
        try {
          await simpleAuthService.refreshToken();
          // 再度ユーザー情報を取得
          const response = await simpleAuthService.getCurrentUser();
          // ... レスポンス処理 ...
        } catch (refreshError) {
          // リフレッシュ失敗時の処理を強化
        }
      }
    } catch (err) {
      // 全体的なエラーハンドリング
    } finally {
      setLoading(false);
    }
  };

  fetchUserData();
}, []);
```

## 問題が解決しない場合

上記の修正を適用しても問題が解決しない場合は、以下の追加対策を検討してください：

1. **開発サーバーの再起動**: フロントエンドおよびバックエンドのサーバーを再起動します

```bash
# フロントエンドの再起動
cd portal/frontend
npm run build
npm start

# バックエンドの再起動
cd portal
node server.js
```

2. **ブラウザキャッシュのクリア**: 開発者ツールの「Application」タブでストレージをクリアし、ブラウザをハードリロードします（Ctrl+Shift+R）

3. **別ブラウザでのテスト**: 問題がブラウザ固有である可能性を排除するため、別のブラウザでテストします

4. **認証フローの完全なリセット**: すべてのストレージをクリアし、バックエンドのセッションを再開します

```bash
# バックエンドのセッションをリセットするスクリプト
node portal/scripts/clear-expired-sessions.js
```

## 追加のデバッグ手法

より詳細な問題診断には、以下の手法が有効です：

1. 「dashboard_routing_fix.js」に含まれるデバッグ関数をブラウザコンソールで実行する
2. ブラウザの開発者ツールでNetwork → Preserve logを有効にし、ページ遷移間のリクエストを追跡する
3. Redux DevToolsなどのツールを使用して状態変化を監視する（Redux使用時のみ）

## 参考資料

- React Routerの認証関連ドキュメント：[https://reactrouter.com/docs/en/v6/examples/auth](https://reactrouter.com/docs/en/v6/examples/auth)
- JWT認証のベストプラクティス：[https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)
- React開発者ツールのインストール：[https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)