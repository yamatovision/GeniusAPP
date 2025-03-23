import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box, 
  IconButton, 
  Container, 
  Snackbar, 
  Alert,
  CssBaseline,
  ThemeProvider,
  createTheme 
} from '@mui/material';
import { 
  Home as HomeIcon, 
  ExitToApp as LogoutIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';

// コンポーネント
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import PromptList from './components/prompts/PromptList';
import PromptDetail from './components/prompts/PromptDetail';
import PromptForm from './components/prompts/PromptForm';
import UserList from './components/users/UserList';
import UserDetail from './components/users/UserDetail';

// 組織・ワークスペース管理
import OrganizationList from './components/organizations/OrganizationList';
import OrganizationDetail from './components/organizations/OrganizationDetail';
import OrganizationForm from './components/organizations/OrganizationForm';
import MemberManagement from './components/organizations/MemberManagement';
import WorkspaceList from './components/workspaces/WorkspaceList';
import WorkspaceDetail from './components/workspaces/WorkspaceDetail';
import ApiKeyManagement from './components/workspaces/ApiKeyManagement';
import ApiKeyPoolManagement from './components/organizations/ApiKeyPoolManagement';
import WorkspaceRedirect from './components/workspaces/WorkspaceRedirect';

// 使用量ダッシュボード
import UsageDashboard from './components/usage/UsageDashboard';
import OrganizationUsage from './components/usage/OrganizationUsage';
import WorkspaceUsage from './components/usage/WorkspaceUsage';
import UserUsage from './components/usage/UserUsage';

// 管理者ダッシュボード
import AdminDashboard from './components/admin/AdminDashboard';
import UsageLimits from './components/admin/UsageLimits';

// シンプルモード
import SimpleApp from './components/simple/SimpleApp';

// サービス
import authService from './services/auth.service';

// テーマの設定
const theme = createTheme({
  palette: {
    primary: {
      main: '#4a6eff',
    },
    secondary: {
      main: '#f50057',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

// 認証状態確認用のプライベートルート
const PrivateRoute = ({ children }) => {
  // ローカルストレージとトークン有効期限の両方を確認
  const isLoggedIn = authService.isLoggedIn();
  const token = localStorage.getItem('accessToken');
  
  // ログイン状態でない場合はログインページにリダイレクト
  if (!isLoggedIn || !token) {
    return <Navigate to="/login" />;
  }
  
  // ここでauthService.refreshTokenを呼び出すとよりセキュアになりますが、
  // パフォーマンスへの影響を考慮して実装していません
  
  return children;
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  // シンプルモードへのリダイレクト
  const isSimplePath = window.location.pathname.startsWith('/simple');

  // 認証状態の確認
  useEffect(() => {
    // シンプルモードの場合は処理をスキップ
    if (isSimplePath) {
      return;
    }
    const checkAuthStatus = async () => {
      try {
        // まずローカルストレージからトークンをチェック
        const loggedIn = authService.isLoggedIn();
        setIsLoggedIn(loggedIn);
        
        // ユーザー情報を更新
        if (loggedIn) {
          // まず保存済みのユーザー情報を表示 (UX向上)
          const storedUser = authService.getStoredUser();
          if (storedUser) {
            setUser(storedUser);
          }
          
          // バックグラウンドでユーザー情報を更新
          try {
            const response = await authService.getCurrentUser();
            if (response && response.user) {
              // アカウントが無効化されているかチェック
              if (response.user.role === 'unsubscribed') {
                // 無効化されたアカウントはログアウトさせる
                handleLogout();
                // URLパラメータにエラーメッセージを含めてログインページにリダイレクト
                window.location.href = '/login?error=account_disabled';
                return;
              }
              
              setUser(response.user);
              // 再度ログイン状態を確認
              setIsLoggedIn(true);
            } else {
              // レスポンスにユーザー情報がない場合は認証切れの可能性
              authService.refreshToken().catch(() => {
                handleLogout();
                // URLパラメータにエラーメッセージを含めてログインページにリダイレクト
                window.location.href = '/login?error=session_expired';
              });
            }
          } catch (error) {
            console.error('ユーザー情報更新エラー:', error);
            // アカウント無効化エラーの場合は特別なメッセージを表示
            if (error.response?.data?.message?.includes('アカウントが無効化されています')) {
              handleLogout();
              // URLパラメータにエラーメッセージを含めてログインページにリダイレクト
              window.location.href = '/login?error=account_disabled';
              return;
            }
            
            // 認証エラーの場合はログアウト
            if (error.response?.status === 401) {
              // トークンの更新を試みる
              authService.refreshToken().catch(() => {
                handleLogout();
                // URLパラメータにエラーメッセージを含めてログインページにリダイレクト
                window.location.href = '/login?error=session_expired';
              });
            }
          }
        } else {
          // ログインしていない場合は、ユーザー情報をクリア
          setUser(null);
        }
      } catch (error) {
        console.error('認証状態確認エラー:', error);
        // エラー時はログイン状態をクリア
        setIsLoggedIn(false);
        setUser(null);
      }
    };
    
    // 初回実行
    checkAuthStatus();
    
    // 定期的に認証状態を確認（3分ごと）
    const intervalId = setInterval(checkAuthStatus, 3 * 60 * 1000);
    
    // ページがフォーカスを取得したときにも認証状態を確認
    const handleFocus = () => {
      checkAuthStatus();
    };
    window.addEventListener('focus', handleFocus);
    
    // クリーンアップ
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // ログアウト処理
  const handleLogout = () => {
    authService.logout();
    setIsLoggedIn(false);
    setUser(null);
    showNotification('ログアウトしました', 'success');
  };

  // 通知表示
  const showNotification = (message, severity = 'info') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };

  // 通知閉じる
  const handleCloseNotification = () => {
    setNotification(prev => ({
      ...prev,
      open: false
    }));
  };

  // ログインページ以外ではヘッダーを表示する
  const shouldShowHeader = () => {
    const currentPath = window.location.pathname;
    // ログインページではヘッダーを表示しない
    return currentPath !== '/login';
  };

  // シンプルモードの場合は別のコンポーネントをレンダリング
  if (isSimplePath) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <SimpleApp />
        </Router>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        {(isLoggedIn || (!isLoggedIn && shouldShowHeader())) && (
          <AppBar position="sticky">
            <Toolbar>
              <IconButton
                edge="start"
                color="inherit"
                aria-label="home"
                sx={{ mr: 2 }}
                onClick={() => window.location.href = isLoggedIn ? '/dashboard' : '/login'}
                title={isLoggedIn ? "ダッシュボードへ" : "ログインへ"}
              >
                {isLoggedIn ? <DashboardIcon /> : <HomeIcon />}
              </IconButton>
              
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                AppGenius
              </Typography>
              
              {user ? (
                <Box mr={2}>
                  <Typography variant="body2">
                    {user.name || user.email || ''}
                  </Typography>
                </Box>
              ) : (
                shouldShowHeader() && !isLoggedIn && (
                  <Box mr={2}>
                    <Typography variant="body2">
                      ゲスト
                    </Typography>
                  </Box>
                )
              )}
              
              {isLoggedIn ? (
                <>
                  <Button 
                    color="inherit" 
                    onClick={() => window.location.href = '/simple/dashboard'}
                    sx={{ mr: 1 }}
                  >
                    シンプルモード
                  </Button>
                  <Button 
                    color="inherit" 
                    startIcon={<LogoutIcon />}
                    onClick={handleLogout}
                  >
                    ログアウト
                  </Button>
                </>
              ) : (
                <Button 
                  color="inherit" 
                  onClick={() => window.location.href = '/login'}
                >
                  ログイン
                </Button>
              )}
            </Toolbar>
          </AppBar>
        )}

        <Container>
          <Routes>
            <Route path="/login" element={
              isLoggedIn ? <Navigate to="/dashboard" /> : <Login />
            } />
            
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            
            {/* プロンプト管理ルート */}
            <Route path="/prompts" element={
              <PrivateRoute>
                <PromptList />
              </PrivateRoute>
            } />
            
            <Route path="/prompts/create" element={
              <PrivateRoute>
                <PromptForm />
              </PrivateRoute>
            } />
            
            <Route path="/prompts/edit/:id" element={
              <PrivateRoute>
                <PromptForm />
              </PrivateRoute>
            } />
            
            <Route path="/prompts/:id" element={
              <PrivateRoute>
                <PromptDetail />
              </PrivateRoute>
            } />
            
            {/* ユーザー管理ルート */}
            <Route path="/users" element={
              <PrivateRoute>
                <UserList />
              </PrivateRoute>
            } />
            
            <Route path="/users/new" element={
              <PrivateRoute>
                <UserDetail />
              </PrivateRoute>
            } />
            
            <Route path="/users/:id" element={
              <PrivateRoute>
                <UserDetail />
              </PrivateRoute>
            } />
            
            
            {/* 組織管理ルート */}
            <Route path="/organizations" element={
              <PrivateRoute>
                <OrganizationList />
              </PrivateRoute>
            } />
            
            <Route path="/organizations/new" element={
              <PrivateRoute>
                <OrganizationForm />
              </PrivateRoute>
            } />
            
            <Route path="/organizations/:id" element={
              <PrivateRoute>
                <OrganizationDetail />
              </PrivateRoute>
            } />
            
            <Route path="/organizations/:id/members" element={
              <PrivateRoute>
                <MemberManagement />
              </PrivateRoute>
            } />
            
            <Route path="/organizations/:id/apikeys" element={
              <PrivateRoute>
                <ApiKeyPoolManagement />
              </PrivateRoute>
            } />
            
            <Route path="/organizations/:id/usage" element={
              <PrivateRoute>
                <OrganizationUsage />
              </PrivateRoute>
            } />
            
            {/* ワークスペース管理ルート */}
            {/* 組織コンテキスト内のワークスペース */}
            <Route path="/organizations/:organizationId/workspaces" element={
              <PrivateRoute>
                <WorkspaceList />
              </PrivateRoute>
            } />
            
            <Route path="/organizations/:organizationId/workspaces/:workspaceId" element={
              <PrivateRoute>
                <WorkspaceDetail />
              </PrivateRoute>
            } />
            
            <Route path="/organizations/:organizationId/workspaces/:workspaceId/apikey" element={
              <PrivateRoute>
                <ApiKeyManagement />
              </PrivateRoute>
            } />
            
            <Route path="/organizations/:organizationId/workspaces/:workspaceId/members" element={
              <PrivateRoute>
                <MemberManagement />
              </PrivateRoute>
            } />
            
            <Route path="/organizations/:organizationId/workspaces/:workspaceId/usage" element={
              <PrivateRoute>
                <WorkspaceUsage />
              </PrivateRoute>
            } />
            
            {/* 下位互換性のための直接ワークスペースルート */}
            <Route path="/workspaces" element={
              <PrivateRoute>
                <WorkspaceList />
              </PrivateRoute>
            } />
            
            <Route path="/workspaces/:id" element={
              <PrivateRoute>
                <WorkspaceRedirect />
              </PrivateRoute>
            } />
            
            <Route path="/workspaces/:id/apikey" element={
              <PrivateRoute>
                <ApiKeyManagement />
              </PrivateRoute>
            } />
            
            <Route path="/workspaces/:id/members" element={
              <PrivateRoute>
                <MemberManagement />
              </PrivateRoute>
            } />
            
            <Route path="/workspaces/:id/usage" element={
              <PrivateRoute>
                <WorkspaceUsage />
              </PrivateRoute>
            } />
            
            {/* 使用量ダッシュボード */}
            <Route path="/usage" element={
              <PrivateRoute>
                <UsageDashboard />
              </PrivateRoute>
            } />
            
            <Route path="/users/:userId/usage" element={
              <PrivateRoute>
                <UserUsage />
              </PrivateRoute>
            } />
            
            {/* 管理者ダッシュボード */}
            <Route path="/admin" element={
              <PrivateRoute>
                <AdminDashboard />
              </PrivateRoute>
            } />
            
            <Route path="/admin/usage-limits" element={
              <PrivateRoute>
                <UsageLimits />
              </PrivateRoute>
            } />
            
            {/* シンプルモードへのリダイレクト - SimpleAppコンポーネントで処理 */}
            <Route path="/simple/*" element={null} />
            
            <Route path="/" element={
              isLoggedIn 
                ? <Navigate to="/dashboard" replace /> 
                : <Navigate to="/login" replace />
            } />
            
            <Route path="*" element={
              <Container>
                <Box mt={8} textAlign="center">
                  <Typography variant="h4" gutterBottom>
                    404 - ページが見つかりません
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => window.location.href = '/'}
                  >
                    ホームに戻る
                  </Button>
                </Box>
              </Container>
            } />
          </Routes>
        </Container>
        
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity}
            variant="filled"
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Router>
    </ThemeProvider>
  );
};

export default App;