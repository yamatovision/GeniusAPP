import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { isLoggedIn, getCurrentUser, getCurrentUserFromStorage, logout } from '../../services/simple/simpleAuth.service';
import SimpleLogin from './SimpleLogin';
import SimpleRegister from './SimpleRegister';
import SimpleDashboard from './SimpleDashboard';
import SimpleOrganizationForm from './SimpleOrganizationForm';
import SimpleOrganizationDetail from './SimpleOrganizationDetail';
import SimpleUserManagement from './SimpleUserManagement';
import './SimpleApp.css';

/**
 * プライベートルート (認証必須)
 * ログイン状態をチェックし、未ログインならログインページにリダイレクト
 */
const SimplePrivateRoute = ({ children }) => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  useEffect(() => {
    const checkAuth = async () => {
      console.log('SimplePrivateRoute: 認証チェック開始');
      
      // まずはログイン状態をローカルストレージから確認
      const loggedIn = isLoggedIn();
      console.log('SimplePrivateRoute: isLoggedIn()結果:', loggedIn);
      
      if (!loggedIn) {
        console.log('SimplePrivateRoute: 未ログイン、リダイレクト開始');
        setChecking(false);
        navigate('/simple/login');
        return;
      }
      
      try {
        // サーバーで認証状態を確認
        console.log('SimplePrivateRoute: サーバー認証チェック開始');
        const userCheck = await getCurrentUser();
        console.log('SimplePrivateRoute: サーバー認証チェック結果:', userCheck);
        
        if (userCheck.success && userCheck.data && userCheck.data.user) {
          // 認証成功
          console.log('SimplePrivateRoute: 認証チェック成功');
          setChecking(false);
        } else {
          // 成功レスポンスだがユーザーデータがない
          console.log('SimplePrivateRoute: 認証チェック失敗 - 有効なレスポンスがありません');
          setAuthError('認証に失敗しました。再ログインしてください。');
          await logout();
          navigate('/simple/login');
        }
      } catch (err) {
        console.error('SimplePrivateRoute: 認証チェックエラー:', err);
        
        // エラーメッセージを設定
        let errorMessage = '認証に失敗しました。再ログインしてください。';
        
        if (err.requireRelogin) {
          errorMessage = '認証セッションの有効期限が切れました。再ログインしてください。';
        }
        
        setAuthError(errorMessage);
        
        // ログアウト処理
        try {
          await logout();
        } catch (logoutErr) {
          console.error('SimplePrivateRoute: ログアウトエラー:', logoutErr);
        }
        
        // ログインページへリダイレクト
        navigate('/simple/login');
      } finally {
        setChecking(false);
      }
    };
    
    checkAuth();
  }, [navigate]);
  
  // 認証チェック中はローディング表示
  if (checking) {
    return (
      <div className="simple-loading-container">
        <div className="simple-loading">認証を確認中...</div>
      </div>
    );
  }
  
  // 認証エラー時はエラーメッセージを表示
  if (authError) {
    return (
      <div className="simple-error-container">
        <div className="simple-error">{authError}</div>
        <button 
          onClick={() => navigate('/simple/login')} 
          className="simple-button primary"
        >
          ログインページに戻る
        </button>
      </div>
    );
  }
  
  // 認証成功時は子コンポーネントを表示
  return children;
};

/**
 * シンプルアプリ本体
 * ルーティングとレイアウトを管理
 */
const SimpleApp = () => {
  const [user, setUser] = useState(null);
  const [showHeader, setShowHeader] = useState(true);
  const navigate = useNavigate();
  
  // 初期化処理
  useEffect(() => {
    const checkTokenValidity = () => {
      // ローカルストレージからトークンを取得して検証
      try {
        const simpleUser = JSON.parse(localStorage.getItem('simpleUser') || '{}');
        if (simpleUser && simpleUser.accessToken) {
          const token = simpleUser.accessToken;
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            
            // トークンの発行元と対象を検証 - 厳格チェックを緩和 (2025/3/23)
            // 認証システムを統一したため、古いトークンのクリアロジックは削除
            
            // 有効期限のチェック
            if (payload.exp) {
              const expTime = payload.exp * 1000;
              const now = Date.now();
              if (expTime < now) {
                console.warn('SimpleApp: 期限切れのトークンを検出しました');
                localStorage.removeItem('simpleUser');
                return false;
              }
            }
            
            return true;
          }
        }
      } catch (e) {
        console.error('SimpleApp: トークン検証エラー', e);
        return false;
      }
      
      return false;
    };
    
    const initializeApp = async () => {
      // トークンの有効性を確認
      const tokenValid = checkTokenValidity();
      
      // ログイン状態を確認
      const loggedIn = tokenValid && isLoggedIn();
      console.log("SimpleApp: ログイン状態チェック", loggedIn);
      
      if (loggedIn) {
        try {
          // ローカルストレージからユーザー情報を取得
          const localUser = getCurrentUserFromStorage();
          if (localUser && localUser.user) {
            setUser(localUser.user);
          }
          
          // バックグラウンドでサーバーから最新情報を取得
          try {
            console.log("SimpleApp: サーバーからユーザー情報取得");
            const userData = await getCurrentUser();
            
            if (userData.success && userData.data && userData.data.user) {
              console.log("SimpleApp: ユーザー情報取得成功", userData.data.user);
              setUser(userData.data.user);
            } else {
              console.log("SimpleApp: ユーザー情報が不正", userData);
            }
          } catch (apiError) {
            console.error("SimpleApp: ユーザー情報取得エラー", apiError);
            // サイレントに処理（PrivateRouteで対応）
          }
        } catch (err) {
          console.error('SimpleApp: 初期化エラー', err);
          // エラーを無視（PrivateRouteで対応）
        }
      } else {
        setUser(null);
      }
    };
    
    initializeApp();
    
    // ヘッダー表示制御
    const updateHeaderVisibility = () => {
      const path = window.location.pathname;
      setShowHeader(!path.includes('/login') && !path.includes('/register'));
    };
    
    // 初期表示設定
    updateHeaderVisibility();
    
    // パスが変わったときにヘッダー表示を更新
    window.addEventListener('popstate', updateHeaderVisibility);
    
    return () => {
      window.removeEventListener('popstate', updateHeaderVisibility);
    };
  }, []);
  
  // ログアウト処理
  const handleLogout = async () => {
    try {
      console.log("SimpleApp: ログアウト実行");
      await logout();
      setUser(null);
      navigate('/simple/login');
    } catch (err) {
      console.error('SimpleApp: ログアウトエラー', err);
      // エラーが発生しても強制的にログアウト
      localStorage.removeItem('simpleUser');
      setUser(null);
      navigate('/simple/login');
    }
  };
  
  return (
    <div className="simple-app">
      {/* ヘッダー（ログイン/登録画面以外で表示） */}
      {showHeader && (
        <header className="simple-header">
          <div className="simple-header-container">
            <div className="simple-logo">
              <Link to="/simple/dashboard">AppGenius Simple</Link>
            </div>
            
            <nav className="simple-nav">
              <Link to="/simple/dashboard">ダッシュボード</Link>
            </nav>
            
            <div className="simple-user-menu">
              {user && (
                <>
                  <span className="simple-user-name">{user.name}</span>
                  <button 
                    onClick={handleLogout} 
                    className="simple-logout-button"
                  >
                    ログアウト
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      )}
      
      {/* メインコンテンツ */}
      <main className="simple-main">
        <Routes>
          {/* 認証不要ルート */}
          <Route path="/simple/login" element={
            isLoggedIn() ? <Navigate to="/simple/dashboard" /> : <SimpleLogin />
          } />
          
          <Route path="/simple/register" element={
            isLoggedIn() ? <Navigate to="/simple/dashboard" /> : <SimpleRegister />
          } />
          
          {/* 認証必須ルート */}
          <Route path="/simple/dashboard" element={
            <SimplePrivateRoute>
              <SimpleDashboard />
            </SimplePrivateRoute>
          } />
          
          <Route path="/simple/organizations/new" element={
            <SimplePrivateRoute>
              <SimpleOrganizationForm />
            </SimplePrivateRoute>
          } />
          
          <Route path="/simple/organizations/:id" element={
            <SimplePrivateRoute>
              <SimpleOrganizationDetail />
            </SimplePrivateRoute>
          } />
          
          <Route path="/simple/organizations/:id/edit" element={
            <SimplePrivateRoute>
              <SimpleOrganizationForm />
            </SimplePrivateRoute>
          } />
          
          <Route path="/simple/organizations/:id/users" element={
            <SimplePrivateRoute>
              <SimpleUserManagement />
            </SimplePrivateRoute>
          } />
          
          {/* リダイレクト */}
          <Route path="/simple" element={
            <Navigate to="/simple/dashboard" replace />
          } />
          
          {/* 404ページ */}
          <Route path="*" element={
            <div className="simple-not-found">
              <h1>404 - ページが見つかりません</h1>
              <Link to="/simple/dashboard" className="simple-button secondary">
                ダッシュボードに戻る
              </Link>
            </div>
          } />
        </Routes>
      </main>
      
      {/* フッター */}
      <footer className="simple-footer">
        <div className="simple-footer-container">
          <p>AppGenius © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
};

export default SimpleApp;