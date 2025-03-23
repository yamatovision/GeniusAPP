import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { isLoggedIn, getCurrentUser, logout } from '../../services/simple/simpleAuth.service';
import SimpleLogin from './SimpleLogin';
import SimpleRegister from './SimpleRegister';
import SimpleDashboard from './SimpleDashboard';
import SimpleOrganizationForm from './SimpleOrganizationForm';
import SimpleOrganizationDetail from './SimpleOrganizationDetail';
import SimpleUserManagement from './SimpleUserManagement';
import './SimpleApp.css';

// プライベートルート (認証必須)
const SimplePrivateRoute = ({ children }) => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isLoggedIn()) {
        navigate('/simple/login');
        return;
      }
      
      try {
        // バックエンドでも認証を確認
        await getCurrentUser();
        setChecking(false);
      } catch (err) {
        console.error('認証確認エラー:', err);
        // エラーがあればログアウトしてログインページへ
        logout();
        navigate('/simple/login');
      }
    };
    
    checkAuth();
  }, [navigate]);

  if (checking) {
    return (
      <div className="simple-loading-container">
        <div className="simple-loading">認証を確認中...</div>
      </div>
    );
  }

  return children;
};

const SimpleApp = () => {
  const [user, setUser] = useState(null);
  const [showHeader, setShowHeader] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // ログイン状態とユーザー情報を取得
    const fetchUserData = async () => {
      if (isLoggedIn()) {
        try {
          const userData = await getCurrentUser();
          setUser(userData.data.user);
        } catch (err) {
          console.error('ユーザー情報取得エラー:', err);
          // 認証エラーの場合はログアウト
          if (err.message?.includes('認証') || err.message?.includes('トークン')) {
            handleLogout();
          }
        }
      } else {
        setUser(null);
      }
    };

    fetchUserData();

    // ヘッダーの表示制御
    const path = window.location.pathname;
    setShowHeader(!path.includes('/login') && !path.includes('/register'));

    // パスが変わったときにヘッダー表示を更新
    const handleLocationChange = () => {
      const newPath = window.location.pathname;
      setShowHeader(!newPath.includes('/login') && !newPath.includes('/register'));
    };

    window.addEventListener('popstate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      navigate('/simple/login');
    } catch (err) {
      console.error('ログアウトエラー:', err);
    }
  };

  return (
    <div className="simple-app">
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
                  <button onClick={handleLogout} className="simple-logout-button">
                    ログアウト
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      )}
      
      <main className="simple-main">
        <Routes>
          <Route path="/login" element={
            isLoggedIn() ? <Navigate to="/simple/dashboard" /> : <SimpleLogin />
          } />
          
          <Route path="/register" element={
            isLoggedIn() ? <Navigate to="/simple/dashboard" /> : <SimpleRegister />
          } />
          
          <Route path="/dashboard" element={
            <SimplePrivateRoute>
              <SimpleDashboard />
            </SimplePrivateRoute>
          } />
          
          <Route path="/organizations/new" element={
            <SimplePrivateRoute>
              <SimpleOrganizationForm />
            </SimplePrivateRoute>
          } />
          
          <Route path="/organizations/:id" element={
            <SimplePrivateRoute>
              <SimpleOrganizationDetail />
            </SimplePrivateRoute>
          } />
          
          <Route path="/organizations/:id/edit" element={
            <SimplePrivateRoute>
              <SimpleOrganizationForm />
            </SimplePrivateRoute>
          } />
          
          <Route path="/organizations/:id/users" element={
            <SimplePrivateRoute>
              <SimpleUserManagement />
            </SimplePrivateRoute>
          } />
          
          <Route path="/" element={
            <Navigate to="/simple/dashboard" replace />
          } />
          
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
      
      <footer className="simple-footer">
        <div className="simple-footer-container">
          <p>AppGenius © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
};

export default SimpleApp;