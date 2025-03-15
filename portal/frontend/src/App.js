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
  const isLoggedIn = authService.isLoggedIn();
  return isLoggedIn ? children : <Navigate to="/login" />;
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  // 認証状態の確認
  useEffect(() => {
    const checkAuthStatus = () => {
      const loggedIn = authService.isLoggedIn();
      setIsLoggedIn(loggedIn);
      
      if (loggedIn) {
        const storedUser = authService.getStoredUser();
        setUser(storedUser);
        
        // ユーザー情報を最新化
        authService.getCurrentUser()
          .then(response => {
            setUser(response.user);
          })
          .catch(error => {
            console.error('認証エラー:', error);
            if (error.response?.status === 401) {
              handleLogout();
              showNotification('セッションが期限切れです。再度ログインしてください。', 'warning');
            }
          });
      }
    };
    
    checkAuthStatus();
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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        {isLoggedIn && (
          <AppBar position="sticky">
            <Toolbar>
              <IconButton
                edge="start"
                color="inherit"
                aria-label="home"
                sx={{ mr: 2 }}
                onClick={() => window.location.href = '/dashboard'}
                title="ダッシュボードへ"
              >
                <HomeIcon />
              </IconButton>
              
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                AppGenius
              </Typography>
              
              {user && (
                <Box mr={2}>
                  <Typography variant="body2">
                    {user.name}
                  </Typography>
                </Box>
              )}
              
              <Button 
                color="inherit" 
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
              >
                ログアウト
              </Button>
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
            
            <Route path="/" element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} />} />
            
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