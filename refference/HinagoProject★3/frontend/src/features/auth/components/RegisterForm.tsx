import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Link,
  Alert,
  InputAdornment,
  IconButton,
  Grid,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '@common/hooks/useAuth';

/**
 * ユーザー登録フォームコンポーネント
 */
const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { register, error, clearError, isLoading } = useAuth();
  
  // フォーム状態
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // バリデーション状態
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [organizationNameError, setOrganizationNameError] = useState('');
  
  /**
   * フォーム入力変更ハンドラ
   */
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, errorSetter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    errorSetter('');
    clearError();
  };
  
  /**
   * パスワード表示の切り替えハンドラ
   */
  const handleTogglePasswordVisibility = (field: 'password' | 'confirmPassword') => () => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };
  
  /**
   * フォーム送信ハンドラ
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーションリセット
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setOrganizationNameError('');
    
    // バリデーションチェック
    let isValid = true;
    
    // 名前の検証
    if (!name.trim()) {
      setNameError('氏名を入力してください');
      isValid = false;
    }
    
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
    
    // パスワード確認の検証
    if (!confirmPassword) {
      setConfirmPasswordError('パスワード（確認）を入力してください');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('パスワードが一致しません');
      isValid = false;
    }
    
    // 会社名の検証
    if (!organizationName.trim()) {
      setOrganizationNameError('会社名を入力してください');
      isValid = false;
    }
    
    if (!isValid) return;
    
    try {
      // ユーザー登録処理
      await register(name, email, password, organizationName);
      // 登録成功時はダッシュボードへリダイレクト
      // 注意: 現時点ではダッシュボードがないためルートに遷移
      navigate('/');
    } catch (error) {
      console.error('登録エラー:', error);
    }
  };
  
  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            id="name"
            label="氏名"
            name="name"
            autoComplete="name"
            autoFocus
            value={name}
            onChange={handleInputChange(setName, setNameError)}
            error={!!nameError}
            helperText={nameError}
            disabled={isLoading}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            id="email"
            label="メールアドレス"
            name="email"
            autoComplete="email"
            value={email}
            onChange={handleInputChange(setEmail, setEmailError)}
            error={!!emailError}
            helperText={emailError}
            disabled={isLoading}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            name="password"
            label="パスワード"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={handleInputChange(setPassword, setPasswordError)}
            error={!!passwordError}
            helperText={passwordError}
            disabled={isLoading}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="パスワードの表示切り替え"
                    onClick={handleTogglePasswordVisibility('password')}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            name="confirmPassword"
            label="パスワード（確認）"
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={handleInputChange(setConfirmPassword, setConfirmPasswordError)}
            error={!!confirmPasswordError}
            helperText={confirmPasswordError}
            disabled={isLoading}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="確認用パスワードの表示切り替え"
                    onClick={handleTogglePasswordVisibility('confirmPassword')}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            id="organizationName"
            label="会社名"
            name="organizationName"
            autoComplete="organization"
            value={organizationName}
            onChange={handleInputChange(setOrganizationName, setOrganizationNameError)}
            error={!!organizationNameError}
            helperText={organizationNameError}
            disabled={isLoading}
          />
        </Grid>
      </Grid>
      
      <Button
        type="submit"
        fullWidth
        variant="contained"
        sx={{ mt: 3, mb: 2, py: 1.5 }}
        disabled={isLoading}
      >
        {isLoading ? '登録中...' : 'アカウント登録'}
      </Button>
      
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2">
          既にアカウントをお持ちの方は{' '}
          <Link component={RouterLink} to="/login">
            こちら
          </Link>{' '}
          からログインできます。
        </Typography>
      </Box>
    </Box>
  );
};

export default RegisterForm;