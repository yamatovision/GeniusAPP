import React from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Avatar,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import RegisterForm from '@features/auth/components/RegisterForm';

/**
 * ユーザー登録ページコンポーネント
 */
const RegisterPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(to right bottom, #f5f5f5, #e0e0e0)',
      }}
    >
      <Container component="main" maxWidth="sm" sx={{ mb: 4, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Paper
          elevation={3}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* ヘッダー部分 */}
          <Box
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Avatar
              sx={{
                m: 1,
                bgcolor: 'white',
                color: 'primary.main',
                width: 56,
                height: 56,
              }}
            >
              <PersonAddIcon fontSize="large" />
            </Avatar>
            <Typography component="h1" variant="h5" sx={{ mt: 1, fontWeight: 500 }}>
              アカウント登録
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 400 }}>
              ボリュームチェックシステム
            </Typography>
          </Box>

          {/* フォーム部分 */}
          <Box sx={{ p: 3, pt: 4 }}>
            <RegisterForm />
          </Box>
        </Paper>
      </Container>

      {/* フッター */}
      <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          mt: 'auto',
          backgroundColor: 'white',
          borderTop: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          &copy; {new Date().getFullYear()} Hinago - ボリュームチェックシステム. All Rights Reserved.
        </Typography>
      </Box>
    </Box>
  );
};

export default RegisterPage;