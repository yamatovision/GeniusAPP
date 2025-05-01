import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { isLoggedIn, getCurrentUser, getCurrentUserFromStorage, logout } from '../../services/simple/simpleAuth.service';
import SimpleLogin from './SimpleLogin';
import SimpleRegister from './SimpleRegister';
// SimpleDashboardは使用しなくなったためインポートから削除
import SimpleOrganizationForm from './SimpleOrganizationForm';
import SimpleOrganizationDetail from './SimpleOrganizationDetail';
import SimpleUserManagement from './SimpleUserManagement';
import './SimpleApp.css';

/**
 * プライベートルート (認証必須)
 * ログイン状態をチェックし、未ログインならログインページにリダイレクト
 * 無限ループ問題を解決するためにシンプル化
 */
const SimplePrivateRoute = ({ children }) => {
  // ローカルストレージから直接認証状態を確認（効率化・単純化）
  const isUserLoggedIn = !!localStorage.getItem('simpleUser');
  
  // 認証されていない場合は直接リダイレクト
  if (!isUserLoggedIn) {
    // window.location.hrefを使用してシンプルにリダイレクト（React Routerの無限ループを回避）
    window.location.href = '/simple/login';
    return null;
  }
  
  // 認証されている場合は子コンポーネントを表示
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
    
    // トークンの状態を一度だけ確認して初期化
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
          
          // バックグラウンドでサーバーから最新情報を取得（負荷軽減のため条件付き）
          // すでにユーザー情報がある場合、即時アップデートは行わない
          if (!localUser || !localUser.user) {
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
          }
        } catch (err) {
          console.error('SimpleApp: 初期化エラー', err);
          // エラーを無視（PrivateRouteで対応）
        }
      } else {
        setUser(null);
      }
    };
    
    // 初期化処理を一度だけ実行
    initializeApp();
    
    // ヘッダー表示制御 - ルートに基づいてUI表示を管理
    const updateHeaderVisibility = () => {
      const path = window.location.pathname;
      const shouldShow = !path.includes('/login') && !path.includes('/register');
      if (showHeader !== shouldShow) {
        setShowHeader(shouldShow);
      }
    };
    
    // 初期表示設定
    updateHeaderVisibility();
    
    // パスが変わったときにヘッダー表示を更新
    window.addEventListener('popstate', updateHeaderVisibility);
    
    return () => {
      window.removeEventListener('popstate', updateHeaderVisibility);
    };
  }, [showHeader]); // showHeaderの変更のみを監視
  
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
              <Link to="/dashboard">AppGenius</Link>
            </div>
            
            <nav className="simple-nav">
              <Link to="/dashboard">ダッシュボード</Link>
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
          {/* 認証不要ルート - 直接チェックでシンプル化 */}
          <Route path="/simple/login" element={
            localStorage.getItem('simpleUser') ? (
              // 既に認証済みの場合はダッシュボードへ直接リダイレクト（React Router無限ループ回避）
              <div>
                <script dangerouslySetInnerHTML={{
                  __html: `window.location.href = '/simple/dashboard';`
                }} />
                リダイレクト中...
              </div>
            ) : <SimpleLogin />
          } />
          
          <Route path="/simple/register" element={
            localStorage.getItem('simpleUser') ? (
              // 既に認証済みの場合はダッシュボードへ直接リダイレクト（React Router無限ループ回避）
              <div>
                <script dangerouslySetInnerHTML={{
                  __html: `window.location.href = '/simple/dashboard';`
                }} />
                リダイレクト中...
              </div>
            ) : <SimpleRegister />
          } />
          
          {/* 認証必須ルート - すべて標準ダッシュボードにリダイレクト */}
          <Route path="/simple/dashboard" element={
            <div>
              <script dangerouslySetInnerHTML={{
                __html: `window.location.href = '/dashboard';`
              }} />
              標準ダッシュボードにリダイレクト中...
            </div>
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
          
          {/* リダイレクト - React Routerを使わず直接リダイレクト */}
          <Route path="/simple" element={
            <div>
              <script dangerouslySetInnerHTML={{
                __html: `window.location.href = '/dashboard';`
              }} />
              リダイレクト中...
            </div>
          } />
          
          {/* 404ページ */}
          <Route path="*" element={
            <div className="simple-not-found">
              <h1>404 - ページが見つかりません</h1>
              <Link to="/dashboard" className="simple-button secondary">
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