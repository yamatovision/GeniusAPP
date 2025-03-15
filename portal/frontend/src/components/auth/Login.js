import React, { useState } from 'react';
import { 
  Container, 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Alert, 
  CircularProgress, 
  Link 
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import authService from '../../services/auth.service';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // 入力検証
  const validateInput = () => {
    if (!email) {
      setError('メールアドレスを入力してください');
      return false;
    }
    
    if (!password) {
      setError('パスワードを入力してください');
      return false;
    }
    
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      setError('有効なメールアドレスを入力してください');
      return false;
    }
    
    return true;
  };

  // ログイン処理
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // エラー初期化
    setError('');
    
    // 入力検証
    if (!validateInput()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // 認証サービスを使用してログイン
      await authService.login(email, password);
      
      // ダッシュボードにリダイレクト
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.error?.message || 
        'ログイン中にエラーが発生しました。後でもう一度お試しください。'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box my={8}>
        <Paper elevation={3}>
          <Box p={4}>
            <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
              <Typography variant="h4" component="h1" gutterBottom>
                AppGenius
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                プロンプト管理ポータル
              </Typography>
            </Box>
            
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}
            
            <form onSubmit={handleLogin}>
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                id="email"
                label="メールアドレス"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                name="password"
                label="パスワード"
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              
              <Box mt={3} mb={2}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'ログイン'}
                </Button>
              </Box>
              
              <Box display="flex" justifyContent="center">
                <Link component="button" variant="body2" onClick={() => alert('この機能は準備中です')}>
                  パスワードをお忘れですか？
                </Link>
              </Box>
            </form>
          </Box>
        </Paper>
        
        <Box mt={4} textAlign="center">
          <Typography variant="body2" color="textSecondary">
            AppGenius © {new Date().getFullYear()}
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;