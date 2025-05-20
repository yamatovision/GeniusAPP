import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@common/hooks/useAuth';
import LoginPage from '@features/auth/pages/LoginPage';
import RegisterPage from '@features/auth/pages/RegisterPage';
import PasswordResetPage from '@features/auth/pages/PasswordResetPage';
import LoadingSpinner from '@common/components/LoadingSpinner';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import theme from '@app/theme';

/**
 * 保護されたルートコンポーネント
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

/**
 * アプリケーションルートコンポーネント
 */
const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Routes>
          {/* 認証ルート */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/password-reset" element={<PasswordResetPage />} />
          
          {/* デフォルトルート */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* 存在しないルート */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Box>
    </ThemeProvider>
  );
};

export default App;