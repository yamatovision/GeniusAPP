import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Alert, 
  CircularProgress, 
  Link,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import authService from '../../services/auth.service';

// VSCode環境からのログインかを判定する関数
const isVSCodeClient = () => {
  return window.location.href.includes('vscode-webview') || 
         navigator.userAgent.includes('VSCode') ||
         window.name.includes('vscode');
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true); // VSCode用のログイン記憶設定
  const navigate = useNavigate();
  const location = useLocation();
  
  // 保存されたメールアドレスを読み込む
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
    }
    
    // URLからエラーメッセージを取得
    const params = new URLSearchParams(location.search);
    const errorMsg = params.get('error');
    if (errorMsg) {
      if (errorMsg === 'account_disabled') {
        setError('アカウントが無効化されています。管理者にお問い合わせください。');
      } else if (errorMsg === 'session_expired') {
        setError('セッションの有効期限が切れました。再度ログインしてください。');
      } else {
        setError(decodeURIComponent(errorMsg));
      }
    }
  }, [location]);

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
      console.log('ログイン処理開始');
      
      // メールアドレス記憶
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      // 認証サービスを使用してログイン
      const loginResult = await authService.login(email, password);
      console.log('ログイン成功:', loginResult);
      
      // VSCodeの場合は閉じる指示を表示
      if (isVSCodeClient()) {
        // VSCode拡張にメッセージを送信
        try {
          if (window.acquireVsCodeApi) {
            const vscode = window.acquireVsCodeApi();
            vscode.postMessage({ type: 'login-success' });
          }
        } catch (e) {
          console.error('VSCode API呼び出しエラー:', e);
        }
        
        // メッセージを表示（VSCode拡張が処理を続行）
        setError('');
        return;
      }
      
      // 通常のウェブアプリの場合はダッシュボードにリダイレクト
      console.log('ダッシュボードへリダイレクト');
      
      // リダイレクトを遅延させて確実に状態を更新
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
        window.location.reload(); // 状態をリセットするためにページをリロード
      }, 100);
    } catch (err) {
      console.error('ログインエラー:', err);
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
              {isVSCodeClient() && (
                <Typography variant="caption" color="primary" sx={{ mt: 1 }}>
                  VSCode拡張用ログイン画面
                </Typography>
              )}
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
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      color="primary"
                      size="small"
                    />
                  }
                  label="メールアドレスを記憶する"
                />
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