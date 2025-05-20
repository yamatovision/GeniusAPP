import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Link,
  Alert,
} from '@mui/material';
import AuthAPI from '@features/auth/api';

/**
 * パスワードリセット要求フォームコンポーネント
 */
const PasswordResetRequestForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState('');
  
  /**
   * メールアドレスの変更ハンドラ
   */
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setEmailError('');
    setError(null);
  };
  
  /**
   * フォーム送信ハンドラ
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーションリセット
    setEmailError('');
    setError(null);
    
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
    
    if (!isValid) return;
    
    setIsLoading(true);
    
    try {
      // パスワードリセット要求API呼び出し
      await AuthAPI.requestPasswordReset({ email });
      setSuccess(true);
    } catch (error) {
      console.error('パスワードリセット要求エラー:', error);
      setError('パスワードリセット要求の処理中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (success) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          パスワードリセットの手順を記載したメールを送信しました。メールの指示に従ってパスワードをリセットしてください。
        </Alert>
        <Typography variant="body1" sx={{ mb: 2 }}>
          メールが届かない場合は、迷惑メールフォルダを確認するか、別のメールアドレスでお試しください。
        </Typography>
        <Button
          component={RouterLink}
          to="/login"
          variant="outlined"
          sx={{ mt: 2 }}
        >
          ログイン画面に戻る
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
        登録済みのメールアドレスを入力してください。パスワードリセットのためのリンクをメールで送信します。
      </Typography>
      
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
      
      <Button
        type="submit"
        fullWidth
        variant="contained"
        sx={{ mt: 3, mb: 2, py: 1.5 }}
        disabled={isLoading}
      >
        {isLoading ? '処理中...' : 'パスワードリセットを要求'}
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

export default PasswordResetRequestForm;