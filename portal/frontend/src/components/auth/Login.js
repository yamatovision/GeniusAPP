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
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

// VSCode環境からのログインかを判定する関数
const isVSCodeClient = () => {
  return window.location.href.includes('vscode-webview') || 
         navigator.userAgent.includes('VSCode') ||
         window.name.includes('vscode');
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [rememberMe, setRememberMe] = useState(true); // VSCode用のログイン記憶設定
  const [loginDisabled, setLoginDisabled] = useState(false); // レート制限によるログイン無効化状態
  const [retryTimer, setRetryTimer] = useState(0); // リトライまでの残り秒数
  
  // 認証コンテキストを使用
  const { login, error: authError, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 認証エラーとローディング状態の統合
  const error = localError || authError;
  const loading = localLoading || authLoading;
  
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
        setLocalError('アカウントが無効化されています。管理者にお問い合わせください。');
      } else if (errorMsg === 'session_expired') {
        setLocalError('セッションの有効期限が切れました。再度ログインしてください。');
      } else {
        setLocalError(decodeURIComponent(errorMsg));
      }
    }
  }, [location]);

  // 入力検証
  const validateInput = () => {
    if (!email) {
      setLocalError('メールアドレスを入力してください');
      return false;
    }
    
    if (!password) {
      setLocalError('パスワードを入力してください');
      return false;
    }
    
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      setLocalError('有効なメールアドレスを入力してください');
      return false;
    }
    
    return true;
  };

  // ログイン処理
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // エラー初期化
    setLocalError('');
    
    // 入力検証
    if (!validateInput()) {
      return;
    }
    
    setLocalLoading(true);
    
    try {
      console.log('ログイン処理開始');
      
      // メールアドレス記憶
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      // 認証コンテキストを使用してログイン
      const loginResult = await login(email, password);
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
        setLocalError('');
        return;
      }
      
      // 通常のウェブアプリの場合はダッシュボードにリダイレクト
      console.log('ダッシュボードへリダイレクト');
      
      // React Routerのナビゲーション機能を使用
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('ログインエラー:', err);
      
      // レート制限エラーかどうかをチェック
      if (err.response?.status === 429) {
        // レート制限が発生した場合、再試行時間を設定
        const retryAfter = err.response?.data?.error?.retryAfter || 30; // デフォルト30秒に短縮
        const maxRetryTime = 60; // 最大60秒
        
        // 再試行時間を適切な範囲に制限
        const adjustedRetryTime = Math.min(retryAfter, maxRetryTime);
        
        setLoginDisabled(true);
        setRetryTimer(adjustedRetryTime);
        
        console.log(`レート制限検出: ${adjustedRetryTime}秒後に再試行可能`);
        
        // カウントダウンタイマーを開始
        const timerId = setInterval(() => {
          setRetryTimer((prev) => {
            if (prev <= 1) {
              clearInterval(timerId);
              setLoginDisabled(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        // より親切なエラーメッセージを表示
        setLocalError(`ログイン試行回数の制限を超えました。${adjustedRetryTime}秒後に再試行できます。複数回のリクエストが検出されました。`);
      } else {
        // 通常のエラー
        console.error('認証エラー詳細:', err.response?.data);
        setLocalError(
          err.response?.data?.error?.message || 
          'ログイン中にエラーが発生しました。後でもう一度お試しください。'
        );
      }
    } finally {
      setLocalLoading(false);
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
                  disabled={loading || loginDisabled}
                >
                  {loading ? <CircularProgress size={24} /> : 
                   loginDisabled ? `再試行まで ${retryTimer}秒` : 'ログイン'}
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