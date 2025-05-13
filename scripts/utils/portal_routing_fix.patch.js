/**
 * AppGenius ポータルルーティング問題修正パッチ
 * 
 * 問題：
 * ログインするとヘッダーバーは表示されるが、ダッシュボードコンテンツが表示されず、
 * プロンプト管理などのボタンを押しても動作しない
 * 
 * 問題の原因候補と修正方法
 */

// 修正ステップ：

// 1. App.js修正 - ルーティングが適切に動作するように修正
// 修正ファイル: /portal/frontend/src/App.js

/*
問題点: 
- PrivateRouteコンポーネントでの認証チェックに問題がある可能性
- React Routerのバージョンとの互換性問題
- レンダリングフローでの条件付きレンダリングの問題

修正内容:
- PrivateRouteコンポーネントを簡略化
- ルーティング条件の見直し
- 認証状態の確認方法を強化
*/

// App.js内のPrivateRoute修正
// 次のように変更：

const PrivateRoute = ({ children }) => {
  // 認証状態をシンプルに確認するように変更
  const isAuthenticated = !!localStorage.getItem('simpleUser');
  
  // 認証されていなければログインページに直接リダイレクト
  if (!isAuthenticated) {
    console.log('認証が必要なページへのアクセスですが、ログインしていません');
    return <Navigate to="/login" />;
  }
  
  // 認証済みの場合は子コンポーネントを表示
  return children;
};

// 2. token-refresh.js修正 - リフレッシュロジックのエラーハンドリング強化
// 修正ファイル: /portal/frontend/src/utils/token-refresh.js

/*
問題点:
- トークンリフレッシュのエラーハンドリングが不十分
- simpleUserの存在確認が不十分
- リフレッシュリクエストのタイミングや条件に問題がある可能性

修正内容:
- エラーハンドリングの強化
- リフレッシュ前の初期チェックを追加
- デバッグログの詳細化
*/

// token-refresh.js内のエラーハンドリング修正
// 次のように変更：

// リフレッシュトークンを使って新しいアクセストークンを取得(関数内部を修正)
const refreshToken = async () => {
  // 追加: ローカルストレージチェックを強化
  if (!localStorage.getItem('simpleUser')) {
    console.error('[TokenRefresh] simpleUser情報が存在しません');
    return null;
  }

  // 既存のコード
  const now = Math.floor(Date.now() / 1000);
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    console.log(`[TokenRefresh] 最小間隔(${MIN_REFRESH_INTERVAL}秒)内の連続リフレッシュをスキップ`);
    return null;
  }
  
  // 既にリフレッシュ中なら待機
  if (isRefreshing) {
    console.log('[TokenRefresh] 既存のリフレッシュ処理の完了を待機');
    return new Promise(resolve => {
      refreshSubscribers.push(token => resolve(token));
    });
  }
  
  try {
    isRefreshing = true;
    console.log('[TokenRefresh] トークンリフレッシュ開始');
    
    // ユーザー情報取得
    const user = getSimpleUser();
    if (!user || !user.refreshToken) {
      // 修正: エラーメッセージの詳細化
      console.error('[TokenRefresh] リフレッシュトークンが見つかりません', {
        user: !!user,
        hasRefreshToken: !!(user && user.refreshToken)
      });
      throw new Error('リフレッシュトークンがありません');
    }
    
    // 追加: リクエスト前のログ出力
    console.log('[TokenRefresh] リフレッシュAPIを呼び出し', {
      url: `${SIMPLE_API_URL}/auth/refresh-token`,
      hasRefreshToken: !!user.refreshToken,
      refreshTokenLength: user.refreshToken.length
    });
    
    // リフレッシュAPIを呼び出し
    const response = await axios.post(
      `${SIMPLE_API_URL}/auth/refresh-token`, 
      { refreshToken: user.refreshToken }
    );
    
    // 修正: 詳細なログ出力
    console.log(`[TokenRefresh] リフレッシュAPIレスポンス:`, {
      status: response.status,
      success: response.data?.success,
      hasAccessToken: !!(response.data?.data?.accessToken)
    });
    
    if (response.data.success && response.data.data.accessToken) {
      // 以下は既存のコード
      // ...
    }
  } catch (error) {
    // 修正: エラーハンドリングの強化
    console.error('[TokenRefresh] リフレッシュエラー:', error.message);
    
    // APIレスポンスの詳細をログに記録
    if (error.response) {
      console.error('[TokenRefresh] APIエラー詳細:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.response.config.url
      });
      
      // 追加: 認証エラーの詳細なハンドリング
      if (error.response.status === 401) {
        console.log('[TokenRefresh] 認証エラー (401)による強制ログアウト');
        // ストレージを完全にクリア
        localStorage.removeItem('simpleUser');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        // 追加: ページリロードによる強制更新
        console.log('[TokenRefresh] 認証エラーによりページをリロードします');
        // リロード前に少し遅延を入れる
        setTimeout(() => {
          window.location.href = '/login?error=session_expired';
        }, 500);
      }
    } else if (error.request) {
      // ネットワークエラーの詳細ログ
      console.error('[TokenRefresh] ネットワークエラー:', {
        method: error.config?.method,
        url: error.config?.url,
        message: 'サーバーからの応答がありません'
      });
    }
    
    throw error;
  } finally {
    isRefreshing = false;
  }
};

// 3. simpleAuth.service.js修正 - 認証状態確認の改善
// 修正ファイル: /portal/frontend/src/services/simple/simpleAuth.service.js

/*
問題点:
- 認証状態確認の方法に問題がある可能性
- simpleUser情報の取得や処理に問題がある可能性
- APIレスポンス処理の不備

修正内容:
- 認証状態確認処理の強化
- ローカルストレージ処理の信頼性向上
- エラー処理の改善
*/

// isLoggedIn関数の修正
// 次のように変更：

export const isLoggedIn = () => {
  try {
    // 修正: simpleUserの存在確認と内容検証を強化
    const simpleUserStr = localStorage.getItem('simpleUser');
    if (!simpleUserStr) {
      console.log('simpleAuth.isLoggedIn: simpleUserが存在しません');
      return false;
    }
    
    let user;
    try {
      user = JSON.parse(simpleUserStr);
    } catch (parseError) {
      console.error('simpleAuth.isLoggedIn: simpleUserの解析に失敗しました', parseError);
      return false;
    }
    
    if (!user || !user.accessToken) {
      console.log('simpleAuth.isLoggedIn: アクセストークンが存在しません');
      return false;
    }
    
    // 追加: トークンの基本的な形式チェック
    const tokenParts = user.accessToken.split('.');
    if (tokenParts.length !== 3) {
      console.log('simpleAuth.isLoggedIn: トークンの形式が不正です');
      return false; 
    }
    
    // 追加: トークンの有効期限チェック
    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      if (payload.exp) {
        const expTime = payload.exp * 1000; // ミリ秒に変換
        if (Date.now() > expTime) {
          console.log('simpleAuth.isLoggedIn: トークンの有効期限が切れています');
          // リフレッシュを自動的に試みない（PrivateRouteやコンポーネント側で対応）
          return false;
        }
      }
    } catch (tokenError) {
      console.error('simpleAuth.isLoggedIn: トークン検証エラー', tokenError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('simpleAuth.isLoggedIn: エラー発生', error);
    return false;
  }
};

// 4. Dashboard.js修正 - コンポーネントレンダリング問題の修正
// 修正ファイル: /portal/frontend/src/components/dashboard/Dashboard.js

/*
問題点:
- データ取得と表示処理のタイミングの問題
- ユーザー情報取得の二重処理の問題
- エラーハンドリングの不備

修正内容:
- ユーザー情報取得とレンダリングのフローを明確化
- エラーハンドリングの強化
- デバッグ情報の充実
*/

// useEffect内のユーザー情報取得部分を修正
// 次のように変更：

useEffect(() => {
  // 現在のユーザー情報を取得
  const fetchUserData = async () => {
    logDebugEvent('FETCH_USER_DATA_STARTED', {});
    try {
      setLoading(true);
      console.log('ダッシュボード: ユーザー情報取得開始');
      
      // 追加: 認証状態を明示的に確認
      const isUserLoggedIn = localStorage.getItem('simpleUser') !== null;
      logDebugEvent('AUTH_CHECK', { isLoggedIn: isUserLoggedIn });
      
      if (!isUserLoggedIn) {
        console.warn('ダッシュボード: 認証情報が見つかりません');
        setError('認証情報が見つかりません。再ログインしてください。');
        setLoading(false);
        return;
      }
      
      // ローカルストレージから既存のユーザー情報を取得 (すぐに表示用)
      const storedUser = localStorage.getItem('user');
      const storedSimpleUser = localStorage.getItem('simpleUser');
      
      logDebugEvent('STORED_USER_CHECK', { 
        hasUser: !!storedUser, 
        hasSimpleUser: !!storedSimpleUser
      });
      
      if (storedSimpleUser) {
        try {
          const parsedUser = JSON.parse(storedSimpleUser);
          console.log('ダッシュボード: ローカルストレージからユーザー情報を取得:', parsedUser);
          // ユーザーオブジェクトを直接設定するのではなく、適切にユーザー情報を抽出
          if (parsedUser.user) {
            setUser(parsedUser.user);
          } else {
            // ユーザー情報が直接含まれている場合（email、nameなどのフィールドを持つ）
            const userInfo = {
              name: parsedUser.name,
              email: parsedUser.email,
              role: parsedUser.role,
              id: parsedUser.id || parsedUser._id
            };
            setUser(userInfo);
          }
        } catch (parseError) {
          console.error('ダッシュボード: ユーザー情報の解析エラー:', parseError);
          logDebugEvent('USER_PARSE_ERROR', { error: parseError.message });
        }
      }
      
      // 修正: API呼び出し前の状態チェック
      const authToken = (function() {
        try {
          const userData = JSON.parse(localStorage.getItem('simpleUser') || '{}');
          return userData.accessToken;
        } catch (e) {
          return null;
        }
      })();
      
      logDebugEvent('AUTH_TOKEN_CHECK', { hasToken: !!authToken });
      
      if (!authToken) {
        console.error('ダッシュボード: アクセストークンがありません');
        setError('認証情報が不足しています。再ログインしてください。');
        setLoading(false);
        return;
      }
      
      // サーバーから最新のユーザー情報を取得（シンプル認証API使用）
      try {
        console.log('ダッシュボード: サーバーAPIコール開始');
        const response = await simpleAuthService.getCurrentUser();
        console.log('ダッシュボード: サーバーからユーザー情報を取得:', response);
        
        // シンプル認証APIのレスポンス形式に合わせて処理
        const userData = response.data || response;
        logDebugEvent('USER_DATA_FETCHED', { userData });
        
        if (userData && userData.user) {
          // data.userの形式の場合
          setUser(userData.user);
          logDebugEvent('USER_SET_FROM_RESPONSE_USER', { user: userData.user });
        } else if (userData) {
          // dataオブジェクト自体がユーザー情報の場合
          setUser(userData);
          logDebugEvent('USER_SET_FROM_DIRECT_RESPONSE', { user: userData });
        } else {
          logDebugEvent('USER_DATA_EMPTY', { userData });
          setError('ユーザー情報が取得できませんでした。');
        }
      } catch (apiError) {
        const errorDetails = {
          message: apiError.message,
          stack: apiError.stack,
          response: apiError.response ? {
            status: apiError.response.status,
            data: apiError.response.data
          } : 'No response',
          request: apiError.request ? 'Request present' : 'No request'
        };
        
        logDebugEvent('USER_FETCH_ERROR', errorDetails);
        console.error('ダッシュボード: ユーザー情報取得エラー:', apiError);
        setError('ユーザー情報の取得に失敗しました。ネットワーク接続を確認してください。');
        
        // エラー情報を保存
        setDebugInfo(prev => ({
          ...prev,
          errors: [...prev.errors, { 
            timestamp: new Date().toISOString(), 
            type: 'USER_FETCH_ERROR',
            details: errorDetails
          }].slice(-5) // 最新5件保持
        }));
        
        // シンプル認証でトークンリフレッシュを試みる
        try {
          await simpleAuthService.refreshToken();
          console.log('ダッシュボード: トークンをリフレッシュしました、再試行します');
          // 再度ユーザー情報を取得
          const response = await simpleAuthService.getCurrentUser();
          const retryData = response.data || response;
          
          if (retryData && retryData.user) {
            setUser(retryData.user);
            setError(''); // エラーをクリア
          } else if (retryData) {
            setUser(retryData);
            setError(''); // エラーをクリア
          }
        } catch (refreshError) {
          console.error('ダッシュボード: トークンリフレッシュエラー:', refreshError);
          logDebugEvent('TOKEN_REFRESH_ERROR', { 
            message: refreshError.message,
            response: refreshError.response ? {
              status: refreshError.response.status,
              data: refreshError.response.data
            } : 'No response'
          });
          
          // リフレッシュ失敗時は明確なエラーメッセージを表示
          setError('認証セッションの更新に失敗しました。再ログインしてください。');
          
          // 追加: 致命的なリフレッシュエラーの場合はローカルストレージをクリア
          if (refreshError.response && refreshError.response.status === 401) {
            localStorage.removeItem('simpleUser');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            
            // リロードオプションを表示（実装によっては異なる方法でユーザーに示す）
            setDebugInfo(prev => ({
              ...prev,
              requireRelogin: true
            }));
          }
        }
      }
    } catch (err) {
      console.error('ダッシュボード: 全体的なエラー:', err);
      setError('予期しないエラーが発生しました。ページを再読み込みしてください。');
      logDebugEvent('UNEXPECTED_ERROR', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  fetchUserData();
}, []);

// 実装手順
// 1. まずtoken-refresh.jsを修正して、リフレッシュ時のエラーハンドリングを強化する
// 2. simpleAuth.service.jsのisLoggedIn関数を修正して、認証状態確認を強化する
// 3. App.jsのPrivateRouteコンポーネントを修正して、ルーティングの信頼性を向上させる
// 4. Dashboard.jsのユーザー情報取得ロジックを修正して、レンダリング問題を解決する

// このパッチを適用することで、ダッシュボードのルーティング問題とレンダリング問題が解決されることが期待されます。