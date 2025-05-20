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
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import AuthAPI from '@features/auth/api';

interface PasswordResetConfirmFormProps {
  token: string;
}

/**
 * パスワードリセット確認フォームコンポーネント
 */
const PasswordResetConfirmForm: React.FC<PasswordResetConfirmFormProps> = ({ token }) => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  /**
   * パスワードの変更ハンドラ
   */
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setPasswordError('');
    setError(null);
  };
  
  /**
   * 確認用パスワードの変更ハンドラ
   */
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    setConfirmPasswordError('');
    setError(null);
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
    setPasswordError('');
    setConfirmPasswordError('');
    setError(null);
    
    // バリデーションチェック
    let isValid = true;
    
    // パスワードの検証
    if (!password) {
      setPasswordError('新しいパスワードを入力してください');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('パスワードは6文字以上で入力してください');
      isValid = false;
    }
    
    // 確認用パスワードの検証
    if (!confirmPassword) {
      setConfirmPasswordError('確認用パスワードを入力してください');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('パスワードが一致しません');
      isValid = false;
    }
    
    if (!isValid) return;
    
    setIsLoading(true);
    
    try {
      // パスワードリセット確認API呼び出し
      await AuthAPI.confirmPasswordReset({ token, password });
      setSuccess(true);
    } catch (error) {
      console.error('パスワードリセットエラー:', error);
      setError('パスワードのリセットに失敗しました。リンクが無効か期限切れの可能性があります。');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (success) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          パスワードが正常にリセットされました！
        </Alert>
        <Typography variant="body1" sx={{ mb: 2 }}>
          新しいパスワードでログインできます。
        </Typography>
        <Button
          component={RouterLink}
          to="/login"
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
        >
          ログイン画面へ
        </Button>
      </Box>
    );
  }
  
  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Typography variant="body1" paragraph>
        新しいパスワードを設定してください。
      </Typography>
      
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label="新しいパスワード"
        type={showPassword ? 'text' : 'password'}
        id="password"
        autoComplete="new-password"
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
                onClick={handleTogglePasswordVisibility('password')}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      
      <TextField
        margin="normal"
        required
        fullWidth
        name="confirmPassword"
        label="新しいパスワード（確認）"
        type={showConfirmPassword ? 'text' : 'password'}
        id="confirmPassword"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={handleConfirmPasswordChange}
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
      
      <Button
        type="submit"
        fullWidth
        variant="contained"
        sx={{ mt: 3, mb: 2, py: 1.5 }}
        disabled={isLoading}
      >
        {isLoading ? '処理中...' : 'パスワードを変更'}
      </Button>
      
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2">
          <Link component={RouterLink} to="/login">
            ログイン画面に戻る
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default PasswordResetConfirmForm;