import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Card,
  CardContent,
  Skeleton,
  Alert
} from '@mui/material';
import { 
  PersonOutline as PersonIcon,
  VpnKey as ApiKeyIcon,
  Description as PromptIcon,
  BarChart as UsageIcon,
  DashboardCustomize as DashboardIcon
} from '@mui/icons-material';
import authService from '../../services/auth.service';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // 現在のユーザー情報を取得
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const userData = await authService.getCurrentUser();
        setUser(userData.user);
      } catch (err) {
        setError('ユーザー情報の取得に失敗しました');
        console.error('ユーザー情報取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // 現在の日時を取得
  const currentDate = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // ローディング表示
  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box my={4}>
          <Skeleton variant="rectangular" height={200} />
          <Box mt={4}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Skeleton variant="rectangular" height={240} />
              </Grid>
              <Grid item xs={12} md={8}>
                <Skeleton variant="rectangular" height={240} />
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box my={4}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <DashboardIcon fontSize="large" color="primary" />
            </Grid>
            <Grid item xs>
              <Typography variant="h4" component="h1">
                ダッシュボード
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                {currentDate}
              </Typography>
            </Grid>
            <Grid item>
              <Typography variant="body1">
                ようこそ、
                <Typography component="span" fontWeight="bold">
                  {user?.name || 'ゲスト'}
                </Typography>
                さん
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {user?.email || ''}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ height: '100%' }}>
              <List>
                <ListItem button>
                  <ListItemIcon>
                    <DashboardIcon />
                  </ListItemIcon>
                  <ListItemText primary="ダッシュボード" />
                </ListItem>
                <Divider />
                <ListItem button>
                  <ListItemIcon>
                    <PromptIcon />
                  </ListItemIcon>
                  <ListItemText primary="プロンプト管理" secondary="準備中..." />
                </ListItem>
                <Divider />
                <ListItem button>
                  <ListItemIcon>
                    <UsageIcon />
                  </ListItemIcon>
                  <ListItemText primary="使用状況" secondary="準備中..." />
                </ListItem>
                <Divider />
                <ListItem button>
                  <ListItemIcon>
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText primary="プロファイル設定" secondary="準備中..." />
                </ListItem>
                {user?.role === 'admin' && (
                  <>
                    <Divider />
                    <ListItem button>
                      <ListItemIcon>
                        <ApiKeyIcon />
                      </ListItemIcon>
                      <ListItemText primary="管理者設定" secondary="準備中..." />
                    </ListItem>
                  </>
                )}
              </List>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={8}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper elevation={1} sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    アカウント概要
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography color="textSecondary" gutterBottom>
                            アカウント種別
                          </Typography>
                          <Typography variant="h5" component="div">
                            {user?.role === 'admin' ? '管理者' : '一般ユーザー'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography color="textSecondary" gutterBottom>
                            アカウント状態
                          </Typography>
                          <Typography variant="h5" component="div" color={user?.isActive ? 'success.main' : 'error.main'}>
                            {user?.isActive ? 'アクティブ' : '無効'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography color="textSecondary" gutterBottom>
                            最終ログイン
                          </Typography>
                          <Typography variant="h5" component="div">
                            {user?.lastLogin 
                              ? new Date(user.lastLogin).toLocaleString('ja-JP') 
                              : '情報なし'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography color="textSecondary" gutterBottom>
                            アカウント作成日
                          </Typography>
                          <Typography variant="h5" component="div">
                            {user?.createdAt 
                              ? new Date(user.createdAt).toLocaleDateString('ja-JP') 
                              : '情報なし'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              
              <Grid item xs={12}>
                <Paper elevation={1} sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    システム通知
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box p={2} bgcolor="info.light" borderRadius={1}>
                    <Typography variant="body1">
                      ⚠️ 現在は開発中のため、一部機能に制限があります。
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default Dashboard;