import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
  createTheme,
  Chip,
  Tooltip
} from '@mui/material';
import { 
  Home as HomeIcon, 
  ExitToApp as LogoutIcon,
  Dashboard as DashboardIcon,
  Description as PromptIcon,
  People as PeopleIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';

// コンポーネント
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import PromptList from './components/prompts/PromptList';
import PromptDetail from './components/prompts/PromptDetail';
import PromptForm from './components/prompts/PromptForm';
import UserList from './components/users/UserList';
import UserDetail from './components/users/UserDetail';

// 管理者ダッシュボード
import AdminDashboard from './components/admin/AdminDashboard';
import UsageLimits from './components/admin/UsageLimits';

// シンプルモード
import SimpleApp from './components/simple/SimpleApp';

// 新しい認証システム
import { AuthProvider, useAuth } from './auth/AuthContext';
import AuthGuard, { LoginGuard } from './auth/AuthGuard';

// テーマの設定
const theme = createTheme({
  palette: {
    primary: {
      main: '#4a6eff',
    },
    secondary: {
      main: '#5f6368',
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

// 注: AuthGuardコンポーネントを使用するため、PrivateRouteは不要になりました

// AuthContextを内部で使用するメインアプリコンポーネント
const MainApp = () => {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const navigate = useNavigate();

  // シンプルモードへのリダイレクト
  const isSimplePath = window.location.pathname.startsWith('/simple');

  // ログアウト処理 - window.locationではなくnavigateを使用
  const handleLogout = async () => {
    try {
      // ログアウト処理
      await logout();
      // 成功したらログインページへリダイレクト
      navigate('/login', { replace: true });
      showNotification('ログアウトしました', 'success');
    } catch (error) {
      console.error('ログアウトエラー:', error);
      showNotification('ログアウトに失敗しました', 'error');
    }
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

  // シンプルパスはメインダッシュボードにリダイレクト
  if (isSimplePath) {
    // /simple/loginと/simple/registerは例外
    const currentPath = window.location.pathname;
    if (currentPath === '/simple/login' || currentPath === '/simple/register') {
      return (
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <SimpleApp />
          </Router>
        </ThemeProvider>
      );
    } else {
      // それ以外は標準ダッシュボードにリダイレクト
      window.location.href = '/dashboard';
      return null;
    }
  }

  return (
    <>
        {(isAuthenticated || (!isAuthenticated && shouldShowHeader())) && (
          <AppBar position="sticky">
            <Toolbar>
              <IconButton
                edge="start"
                color="inherit"
                aria-label="home"
                sx={{ mr: 2 }}
                onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login', { replace: true })}
                title={isAuthenticated ? "ダッシュボードへ" : "ログインへ"}
              >
                {isAuthenticated ? <DashboardIcon /> : <HomeIcon />}
              </IconButton>
              
              <Typography variant="h5" component="div" sx={{ 
                flexGrow: 1, 
                fontWeight: 'bold', 
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center'
              }}>
                AppGenius
              </Typography>
              
              {user ? (
                <Box mr={3} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body1" sx={{ fontWeight: 'medium', mr: 1 }}>
                    {user.name || user.email || ''}
                  </Typography>
                  {user.role && (
                    <Chip 
                      size="small" 
                      label={user.role} 
                      color="default"
                      variant="outlined"
                      sx={{ 
                        fontSize: '0.75rem', 
                        height: '24px',
                        fontWeight: 'medium',
                        '& .MuiChip-label': { px: 1 }
                      }}
                    />
                  )}
                </Box>
              ) : (
                shouldShowHeader() && !isAuthenticated && (
                  <Box mr={3}>
                    <Typography variant="body2">
                      ゲスト
                    </Typography>
                  </Box>
                )
              )}
              
              {isAuthenticated ? (
                <>
                  {/* ナビゲーションリンク */}
                  <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
                    <Tooltip title="ダッシュボード" arrow>
                      <IconButton
                        color="inherit"
                        onClick={() => navigate('/dashboard', { replace: true })}
                        size="large"
                        sx={{ 
                          backgroundColor: window.location.pathname === '/dashboard' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.25)'
                          }
                        }}
                      >
                        <DashboardIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="プロンプト管理" arrow>
                      <IconButton
                        color="inherit"
                        onClick={() => navigate('/prompts', { replace: true })}
                        size="large"
                        sx={{ 
                          backgroundColor: window.location.pathname.startsWith('/prompts') ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.25)'
                          }
                        }}
                      >
                        <PromptIcon />
                      </IconButton>
                    </Tooltip>
                    {user?.role === 'SuperAdmin' || user?.role === 'Admin' ? (
                      <Tooltip title="ユーザー管理" arrow>
                        <IconButton
                          color="inherit"
                          onClick={() => navigate('/users', { replace: true })}
                          size="large"
                          sx={{ 
                            backgroundColor: window.location.pathname.startsWith('/users') ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.25)'
                            }
                          }}
                        >
                          <PeopleIcon />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    {user?.role === 'SuperAdmin' || user?.role === 'Admin' ? (
                      <Tooltip title="管理者画面" arrow>
                        <IconButton
                          color="inherit"
                          onClick={() => navigate('/admin', { replace: true })}
                          size="large"
                          sx={{ 
                            backgroundColor: window.location.pathname.startsWith('/admin') ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.25)'
                            }
                          }}
                        >
                          <AdminIcon />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Box>
                  
                  <Tooltip title="ログアウト" arrow>
                    <IconButton 
                      color="inherit" 
                      onClick={handleLogout}
                      size="large"
                      sx={{ ml: 1 }}
                    >
                      <LogoutIcon />
                    </IconButton>
                  </Tooltip>
                </>
              ) : (
                <Tooltip title="ログイン" arrow>
                  <IconButton
                    color="inherit"
                    onClick={() => navigate('/login', { replace: true })}
                    size="large"
                  >
                    <LogoutIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Toolbar>
          </AppBar>
        )}

        <Container>
          <Routes>
            <Route path="/login" element={
              <LoginGuard>
                <Login />
              </LoginGuard>
            } />
            
            <Route path="/dashboard" element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            } />
            
            {/* プロンプト管理ルート */}
            <Route path="/prompts" element={
              <AuthGuard>
                <PromptList />
              </AuthGuard>
            } />
            
            <Route path="/prompts/create" element={
              <AuthGuard>
                <PromptForm />
              </AuthGuard>
            } />
            
            <Route path="/prompts/edit/:id" element={
              <AuthGuard>
                <PromptForm />
              </AuthGuard>
            } />
            
            <Route path="/prompts/:id" element={
              <AuthGuard>
                <PromptDetail />
              </AuthGuard>
            } />
            
            {/* ユーザー管理ルート */}
            <Route path="/users" element={
              <AuthGuard>
                <UserList />
              </AuthGuard>
            } />
            
            <Route path="/users/new" element={
              <AuthGuard>
                <UserDetail />
              </AuthGuard>
            } />
            
            <Route path="/users/:id" element={
              <AuthGuard>
                <UserDetail />
              </AuthGuard>
            } />
            
            
            {/* 組織関連ルート、ワークスペース関連ルートを削除 */}
            
            {/* シンプル化のため使用量ダッシュボードも削除 */}
            
            {/* 管理者ダッシュボード */}
            <Route path="/admin" element={
              <AuthGuard>
                <AdminDashboard />
              </AuthGuard>
            } />
            
            <Route path="/admin/usage-limits" element={
              <AuthGuard>
                <UsageLimits />
              </AuthGuard>
            } />
            
            {/* シンプルモードへのリダイレクト - SimpleAppコンポーネントで処理 */}
            <Route path="/simple/*" element={null} />
            
            <Route path="/" element={
              // 認証コンテキストを使用
              isAuthenticated 
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
                    onClick={() => navigate('/', { replace: true })}
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
    </>
  );
};

// メインアプリをラップするためのApp関数
const App = () => {
  // シンプルモードへのリダイレクト
  const isSimplePath = window.location.pathname.startsWith('/simple');

  // シンプルモードの場合は標準ダッシュボードにリダイレクト
  if (isSimplePath) {
    // /simple/loginと/simple/registerは例外
    const currentPath = window.location.pathname;
    if (currentPath === '/simple/login' || currentPath === '/simple/register') {
      return (
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <SimpleApp />
          </Router>
        </ThemeProvider>
      );
    } else {
      // それ以外は標準ダッシュボードにリダイレクト
      window.location.href = '/dashboard';
      return null;
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;