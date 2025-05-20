import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  FormControlLabel,
  Checkbox,
  Link,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '@common/hooks/useAuth';

/**
 * ログインフォームコンポーネント
 */
const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login, error, clearError, isLoading } = useAuth();
  
  // フォーム状態
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // バリデーション状態
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  /**
   * メールアドレスの変更ハンドラ
   */
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setEmailError('');
    clearError();
  };
  
  /**
   * パスワードの変更ハンドラ
   */
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setPasswordError('');
    clearError();
  };
  
  /**
   * パスワード表示の切り替えハンドラ
   */
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  /**
   * フォーム送信ハンドラ
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーションリセット
    setEmailError('');
    setPasswordError('');
    
    // バリデーションチェック
    let isValid = true;
    
    // メールアドレスの検証
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('メールアドレスを入力してください');
      isValid = false;
    } else if (!emailRegex.test(email)) {
      setEmailError('有効なメールアドレスを入力してください');
      isValid = false;
    }
    
    // パスワードの検証
    if (!password) {
      setPasswordError('パスワードを入力してください');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('パスワードは6文字以上で入力してください');
      isValid = false;
    }
    
    if (!isValid) return;
    
    try {
      // ログイン処理
      await login(email, password, rememberMe);
      // ログイン成功時はダッシュボードへリダイレクト
      // 注意: 現時点ではダッシュボードがないためルートに遷移
      navigate('/');
    } catch (error) {
      console.error('ログインエラー:', error);
    }
  };
  
  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <TextField
        margin="normal"
        required
        fullWidth
        id="email"
        label="メールアドレス"
        name="email"
        autoComplete="email"
        autoFocus
        value={email}
        onChange={handleEmailChange}
        error={!!emailError}
        helperText={emailError}
        disabled={isLoading}
      />
      
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label="パスワード"
        type={showPassword ? 'text' : 'password'}
        id="password"
        autoComplete="current-password"
        value={password}
        onChange={handlePasswordChange}
        error={!!passwordError}
        helperText={passwordError}
        disabled={isLoading}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="パスワードの表示切り替え"
                onClick={handleTogglePasswordVisibility}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              value="remember"
              color="primary"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
            />
          }
          label="ログイン状態を保持する"
        />
        <Link component={RouterLink} to="/password-reset" variant="body2">
          パスワードをお忘れですか？
        </Link>
      </Box>
      
      <Button
        type="submit"
        fullWidth
        variant="contained"
        sx={{ mt: 3, mb: 2, py: 1.5 }}
        disabled={isLoading}
      >
        {isLoading ? 'ログイン中...' : 'ログイン'}
      </Button>
      
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2">
          アカウントをお持ちでない方は{' '}
          <Link component={RouterLink} to="/register">
            こちら
          </Link>{' '}
          から登録できます。
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginForm;