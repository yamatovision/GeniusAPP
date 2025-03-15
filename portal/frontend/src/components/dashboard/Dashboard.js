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
  Alert,
  CircularProgress,
  LinearProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import { Link } from 'react-router-dom';
import { 
  PersonOutline as PersonIcon,
  VpnKey as ApiKeyIcon,
  Description as PromptIcon,
  BarChart as UsageIcon,
  DashboardCustomize as DashboardIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import authService from '../../services/auth.service';
import userService from '../../services/user.service';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tokenUsage, setTokenUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

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

  // トークン使用量を取得
  useEffect(() => {
    const fetchTokenUsage = async () => {
      if (!user) return;
      try {
        setLoadingUsage(true);
        const response = await userService.getTokenUsage('month');
        setTokenUsage(response);
      } catch (err) {
        console.error('トークン使用量取得エラー:', err);
      } finally {
        setLoadingUsage(false);
      }
    };

    if (user) {
      fetchTokenUsage();
    }
  }, [user]);

  // 手動更新用の関数
  const refreshTokenUsage = async () => {
    try {
      setLoadingUsage(true);
      const response = await userService.getTokenUsage('month');
      setTokenUsage(response);
    } catch (err) {
      console.error('トークン使用量取得エラー:', err);
    } finally {
      setLoadingUsage(false);
    }
  };

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
                <ListItem button component={Link} to="/prompts">
                  <ListItemIcon>
                    <PromptIcon />
                  </ListItemIcon>
                  <ListItemText primary="プロンプト管理" />
                </ListItem>
                <Divider />
                <ListItem button component={Link} to="/users">
                  <ListItemIcon>
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText primary="ユーザー管理" />
                </ListItem>
                <Divider />
                <ListItem button component={Link} to="/plans">
                  <ListItemIcon>
                    <ApiKeyIcon />
                  </ListItemIcon>
                  <ListItemText primary="アクセスプラン管理" />
                </ListItem>
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
                            {user?.isActive !== undefined ? (user.isActive ? 'アクティブ' : '無効') : '確認中...'}
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
              
              {/* トークン使用量表示セクション */}
              <Grid item xs={12}>
                <Paper elevation={1} sx={{ p: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                      トークン使用状況
                    </Typography>
                    <Tooltip title="更新">
                      <IconButton onClick={refreshTokenUsage} disabled={loadingUsage}>
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  
                  {loadingUsage ? (
                    <Box display="flex" justifyContent="center" py={3}>
                      <CircularProgress />
                    </Box>
                  ) : tokenUsage ? (
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                              合計入力トークン
                            </Typography>
                            <Typography variant="h5" component="div">
                              {(tokenUsage.overall?.totalInputTokens || 0).toLocaleString()} トークン
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                              合計出力トークン
                            </Typography>
                            <Typography variant="h5" component="div">
                              {(tokenUsage.overall?.totalOutputTokens || 0).toLocaleString()} トークン
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                              リクエスト成功率
                            </Typography>
                            <Typography variant="h5" component="div">
                              {(tokenUsage.overall?.successRate || 0).toFixed(1)}%
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                              平均応答時間
                            </Typography>
                            <Typography variant="h5" component="div">
                              {(tokenUsage.overall?.avgResponseTime || 0).toFixed(0)} ms
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      {user?.plan?.tokenLimit && (
                        <Grid item xs={12}>
                          <Card variant="outlined">
                            <CardContent>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography color="textSecondary" gutterBottom>
                                  月間使用量上限 ({user.plan?.type || 'basic'} プラン)
                                </Typography>
                                <Typography variant="body2">
                                  {Math.round(((tokenUsage.overall?.totalInputTokens || 0) + (tokenUsage.overall?.totalOutputTokens || 0)) / user.plan.tokenLimit * 100)}% 使用中
                                </Typography>
                              </Box>
                              <LinearProgress 
                                variant="determinate" 
                                value={Math.min(100, ((tokenUsage.overall?.totalInputTokens || 0) + (tokenUsage.overall?.totalOutputTokens || 0)) / user.plan.tokenLimit * 100)} 
                                sx={{ height: 10, borderRadius: 5, mt: 1 }}
                                color={
                                  ((tokenUsage.overall?.totalInputTokens || 0) + (tokenUsage.overall?.totalOutputTokens || 0)) / user.plan.tokenLimit > 0.9 ? 'error' :
                                  ((tokenUsage.overall?.totalInputTokens || 0) + (tokenUsage.overall?.totalOutputTokens || 0)) / user.plan.tokenLimit > 0.7 ? 'warning' :
                                  'primary'
                                }
                              />
                              <Box display="flex" justifyContent="space-between" mt={1}>
                                <Typography variant="body2">
                                  {((tokenUsage.overall?.totalInputTokens || 0) + (tokenUsage.overall?.totalOutputTokens || 0)).toLocaleString()} トークン
                                </Typography>
                                <Typography variant="body2">
                                  上限: {user.plan.tokenLimit.toLocaleString()} トークン
                                </Typography>
                              </Box>
                              <Typography variant="caption" color="textSecondary">
                                次回リセット日: {user.plan?.nextResetDate ? new Date(user.plan.nextResetDate).toLocaleDateString('ja-JP') : '情報なし'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      )}
                    </Grid>
                  ) : (
                    <Alert severity="info">トークン使用データがありません</Alert>
                  )}
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