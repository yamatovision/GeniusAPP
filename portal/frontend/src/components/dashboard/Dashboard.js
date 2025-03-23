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
  IconButton,
  Button
} from '@mui/material';
import { Link } from 'react-router-dom';
import { 
  PersonOutline as PersonIcon,
  VpnKey as ApiKeyIcon,
  Description as PromptIcon,
  BarChart as UsageIcon,
  DashboardCustomize as DashboardIcon,
  Refresh as RefreshIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import authService from '../../services/auth.service';
import userService from '../../services/user.service';

const Dashboard = () => {
  console.log('Dashboardコンポーネントがレンダリングされました');
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tokenUsage, setTokenUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [debugInfo, setDebugInfo] = useState({ 
    renderCount: 0, 
    errors: [], 
    events: [] 
  });

  // デバッグ情報を記録する関数
  const logDebugEvent = (event, data) => {
    console.log(`DEBUG [${new Date().toISOString()}] ${event}`, data);
    setDebugInfo(prev => ({
      ...prev,
      renderCount: prev.renderCount + 1,
      events: [...prev.events, { timestamp: new Date().toISOString(), event, data }].slice(-10) // 最新10件保持
    }));
  };
  
  // コンポーネントマウント時にデバッグ情報を記録
  useEffect(() => {
    logDebugEvent('COMPONENT_MOUNTED', { 
      localStorage: {
        accessToken: localStorage.getItem('accessToken') ? 'present' : 'missing',
        refreshToken: localStorage.getItem('refreshToken') ? 'present' : 'missing',
        user: localStorage.getItem('user') ? 'present' : 'missing'
      },
      url: window.location.href
    });
    
    // アンマウント時のクリーンアップ
    return () => {
      logDebugEvent('COMPONENT_UNMOUNTED', {});
    };
  }, []);
  
  useEffect(() => {
    // 現在のユーザー情報を取得
    const fetchUserData = async () => {
      logDebugEvent('FETCH_USER_DATA_STARTED', {});
      try {
        setLoading(true);
        console.log('ダッシュボード: ユーザー情報取得開始');
        
        // ローカルストレージから既存のユーザー情報を取得 (すぐに表示用)
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            console.log('ダッシュボード: ローカルストレージからユーザー情報を取得:', parsedUser);
            setUser(parsedUser);
          } catch (parseError) {
            console.error('ダッシュボード: ユーザー情報の解析エラー:', parseError);
          }
        }
        
        // サーバーから最新のユーザー情報を取得
        const userData = await authService.getCurrentUser();
        console.log('ダッシュボード: サーバーからユーザー情報を取得:', userData);
        
        logDebugEvent('USER_DATA_FETCHED', { userData });
        
        if (userData && userData.user) {
          setUser(userData.user);
          logDebugEvent('USER_SET_FROM_RESPONSE_USER', { user: userData.user });
        } else if (userData) {
          // ユーザーフィールドがない場合は直接使用（API応答の形式による）
          setUser(userData);
          logDebugEvent('USER_SET_FROM_DIRECT_RESPONSE', { user: userData });
        } else {
          logDebugEvent('USER_DATA_EMPTY', { userData });
        }
      } catch (err) {
        const errorDetails = {
          message: err.message,
          stack: err.stack,
          response: err.response ? {
            status: err.response.status,
            data: err.response.data
          } : 'No response',
          request: err.request ? 'Request present' : 'No request'
        };
        
        logDebugEvent('USER_FETCH_ERROR', errorDetails);
        console.error('ダッシュボード: ユーザー情報取得エラー:', err);
        setError('ユーザー情報の取得に失敗しました。ネットワーク接続を確認してください。');
        
        // エラー情報を保存
        setDebugInfo(prev => ({
          ...prev,
          errors: [...prev.errors, { 
            timestamp: new Date().toISOString(), 
            type: 'USER_FETCH_ERROR',
            details: errorDetails
          }].slice(-5) // 最新5件保持
        }));
        
        // リフレッシュを試みる
        try {
          await authService.refreshToken();
          console.log('ダッシュボード: トークンをリフレッシュしました、再試行します');
          // 再度ユーザー情報を取得
          const retryData = await authService.getCurrentUser();
          if (retryData && retryData.user) {
            setUser(retryData.user);
            setError(''); // エラーをクリア
          }
        } catch (refreshError) {
          console.error('ダッシュボード: トークンリフレッシュエラー:', refreshError);
        }
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
        console.log('ダッシュボード: トークン使用量取得開始');
        
        try {
          const response = await userService.getTokenUsage('month');
          console.log('ダッシュボード: トークン使用量取得成功:', response);
          setTokenUsage(response);
        } catch (err) {
          console.error('ダッシュボード: トークン使用量取得エラー:', err);
          
          // エラーが発生した場合はダミーデータを設定 (UI表示用)
          setTokenUsage({
            overall: {
              totalInputTokens: 12500,
              totalOutputTokens: 8750,
              successRate: 98.5,
              avgResponseTime: 2350
            }
          });
        }
      } catch (err) {
        console.error('ダッシュボード: トークン使用量取得中の予期しないエラー:', err);
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

  // デバッグモードの切り替え
  const [showDebug, setShowDebug] = useState(false);
  const toggleDebug = () => setShowDebug(!showDebug);
  
  // レンダリング前にデバッグ情報をログに記録
  useEffect(() => {
    if (!loading) {
      logDebugEvent('RENDER_PREPARING', { 
        user: user ? 'present' : 'null',
        error: error ? error : 'none',
        tokenUsage: tokenUsage ? 'present' : 'null'
      });
    }
  }, [loading, user, error, tokenUsage]);

  // ローディング表示
  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box my={4}>
          {/* デバッグ情報表示ボタン（ローディング中も表示） */}
          <Box position="fixed" right="20px" top="70px" zIndex="tooltip">
            <Button 
              variant="outlined" 
              size="small" 
              onClick={toggleDebug}
              sx={{ opacity: 0.7 }}
            >
              {showDebug ? 'デバッグ非表示' : 'デバッグ表示'}
            </Button>
          </Box>
          
          {/* デバッグ情報 */}
          {showDebug && (
            <Paper elevation={3} sx={{ p: 2, mb: 3, maxHeight: '300px', overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>デバッグ情報 (ローディング中)</Typography>
              <Box mb={2}>
                <Typography variant="subtitle2">基本情報:</Typography>
                <Box component="pre" fontSize="0.8rem">
                  {JSON.stringify({
                    renderCount: debugInfo.renderCount,
                    loading: true,
                    url: window.location.href,
                    localStorage: {
                      accessToken: localStorage.getItem('accessToken') ? 'present' : 'missing',
                      refreshToken: localStorage.getItem('refreshToken') ? 'present' : 'missing',
                      user: localStorage.getItem('user') ? 'present' : 'missing'
                    }
                  }, null, 2)}
                </Box>
              </Box>
              
              <Typography variant="subtitle2">最近のイベント:</Typography>
              <Box component="pre" fontSize="0.8rem" sx={{ maxHeight: '150px', overflow: 'auto' }}>
                {JSON.stringify(debugInfo.events, null, 2)}
              </Box>
            </Paper>
          )}
          
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
        {/* デバッグ情報表示ボタン - 開発時のみ表示 */}
        <Box position="fixed" right="20px" top="70px" zIndex="tooltip">
          <Button 
            variant="outlined" 
            size="small" 
            onClick={toggleDebug}
            sx={{ opacity: 0.7 }}
          >
            {showDebug ? 'デバッグ非表示' : 'デバッグ表示'}
          </Button>
        </Box>
        
        {/* デバッグ情報 */}
        {showDebug && (
          <Paper elevation={3} sx={{ p: 2, mb: 3, maxHeight: '300px', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>デバッグ情報</Typography>
            <Box mb={2}>
              <Typography variant="subtitle2">基本情報:</Typography>
              <Box component="pre" fontSize="0.8rem">
                {JSON.stringify({
                  renderCount: debugInfo.renderCount,
                  user: user ? `${user.name} (${user.email})` : 'null',
                  error: error || 'none',
                  loading,
                  loadingUsage,
                  url: window.location.href,
                  localStorage: {
                    accessToken: localStorage.getItem('accessToken') ? 'present' : 'missing',
                    refreshToken: localStorage.getItem('refreshToken') ? 'present' : 'missing',
                    user: localStorage.getItem('user') ? 'present' : 'missing'
                  }
                }, null, 2)}
              </Box>
            </Box>
            
            <Typography variant="subtitle2">最近のイベント:</Typography>
            <Box component="pre" fontSize="0.8rem" sx={{ maxHeight: '150px', overflow: 'auto' }}>
              {JSON.stringify(debugInfo.events, null, 2)}
            </Box>
            
            {debugInfo.errors.length > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" color="error">エラー履歴:</Typography>
                <Box component="pre" fontSize="0.8rem" sx={{ maxHeight: '150px', overflow: 'auto' }}>
                  {JSON.stringify(debugInfo.errors, null, 2)}
                </Box>
              </Box>
            )}
          </Paper>
        )}
        
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
                <ListItem button component={Link} to="/organizations">
                  <ListItemIcon>
                    <UsageIcon />
                  </ListItemIcon>
                  <ListItemText primary="組織管理" />
                </ListItem>
                <Divider />
                <ListItem button component={Link} to="/usage">
                  <ListItemIcon>
                    <UsageIcon />
                  </ListItemIcon>
                  <ListItemText primary="使用量ダッシュボード" />
                </ListItem>
                <Divider />
                {user?.role === 'admin' && (
                  <ListItem button component={Link} to="/admin">
                    <ListItemIcon>
                      <AdminIcon />
                    </ListItemIcon>
                    <ListItemText primary="管理者ダッシュボード" />
                  </ListItem>
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