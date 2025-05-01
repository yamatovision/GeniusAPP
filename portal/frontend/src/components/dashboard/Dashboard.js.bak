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
  Button,
  Tab,
  Tabs,
  Chip
} from '@mui/material';
import { Link } from 'react-router-dom';
import { 
  PersonOutline as PersonIcon,
  VpnKey as ApiKeyIcon,
  Key as KeyIcon,
  Description as PromptIcon,
  BarChart as UsageIcon,
  DashboardCustomize as DashboardIcon,
  AdminPanelSettings as AdminIcon,
  Business as BusinessIcon,
  WorkspacePremium as WorkspaceIcon,
  People as PeopleIcon
} from '@mui/icons-material';
// シンプル認証サービスを使用
import * as simpleAuthService from '../../services/simple/simpleAuth.service';
import OrganizationCards from './OrganizationCards';
import ApiKeyManager from './ApiKeyManager';
import WorkspaceManager from './WorkspaceManager';
import UserManager from './UserManager';

const Dashboard = () => {
  console.log('Dashboardコンポーネントがレンダリングされました');
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgName, setSelectedOrgName] = useState('');
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
    // 現在のユーザー情報を取得（リトライロジック強化版）
    const fetchUserData = async () => {
      logDebugEvent('FETCH_USER_DATA_STARTED', {});
      try {
        setLoading(true);
        console.log('ダッシュボード: ユーザー情報取得開始');
        
        // 1. まず、各種ストレージからユーザー情報を確認（信頼性向上のため複数ソース確認）
        const simpleUserRaw = localStorage.getItem('simpleUser');
        const storedUser = localStorage.getItem('user');
        const accessToken = localStorage.getItem('accessToken');
        
        // ローカルストレージのデータをログに記録
        logDebugEvent('LOCAL_STORAGE_CHECK', { 
          hasSimpleUser: !!simpleUserRaw, 
          hasUser: !!storedUser,
          hasToken: !!accessToken
        });
        
        // simpleUser（主要な認証情報）を優先的に処理
        if (simpleUserRaw) {
          try {
            const simpleUser = JSON.parse(simpleUserRaw);
            console.log('ダッシュボード: simpleUserからユーザー情報を取得:', simpleUser);
            
            // simpleUserからの情報をセット（即時表示のため）
            if (simpleUser.user) {
              setUser(simpleUser.user);
            } else {
              // ユーザー情報を含むオブジェクト全体を表示用に使用
              const { accessToken, refreshToken, ...userDisplay } = simpleUser;
              setUser(userDisplay);
            }
          } catch (parseError) {
            console.error('ダッシュボード: simpleUser解析エラー:', parseError);
          }
        } 
        // バックアップとして標準ユーザー情報を使用
        else if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            console.log('ダッシュボード: バックアップからユーザー情報を取得:', parsedUser);
            setUser(parsedUser);
          } catch (parseError) {
            console.error('ダッシュボード: バックアップ情報解析エラー:', parseError);
          }
        }
        
        // 2. サーバーからの情報取得のためのリトライ機能を実装
        let retryCount = 0;
        const MAX_RETRIES = 2;
        
        // リトライ込みの情報取得関数
        const getServerUserData = async (forceRefresh = false, retry = 0) => {
          try {
            // サーバーから最新情報を取得（改善版simpleAuthService使用）
            console.log(`ダッシュボード: サーバーからのユーザー情報取得 (試行 ${retry + 1}/${MAX_RETRIES + 1})`);
            
            // retry > 0の場合はforceRefreshを使用
            const response = await simpleAuthService.getCurrentUser(retry > 0 ? true : forceRefresh);
            console.log('ダッシュボード: サーバーからユーザー情報取得成功:', response);
            
            // レスポンス形式に応じて処理
            const userData = response.data || response;
            logDebugEvent('USER_DATA_FETCHED', { userData, retry });
            
            if (userData && userData.user) {
              // data.userの形式の場合
              setUser(userData.user);
              setError(''); // エラーをクリア
              logDebugEvent('USER_SET_FROM_RESPONSE_USER', { user: userData.user });
            } else if (userData) {
              // dataオブジェクト自体がユーザー情報の場合
              setUser(userData);
              setError(''); // エラーをクリア
              logDebugEvent('USER_SET_FROM_DIRECT_RESPONSE', { user: userData });
            } else {
              logDebugEvent('USER_DATA_EMPTY', { userData });
            }
            
            return true;
          } catch (err) {
            logDebugEvent('SERVER_FETCH_ERROR', { retry, message: err.message });
            console.error(`ダッシュボード: サーバー取得エラー (試行 ${retry + 1}):`, err);
            
            // リトライ可能な場合
            if (retry < MAX_RETRIES) {
              // トークンリフレッシュを試行
              try {
                console.log('ダッシュボード: トークンリフレッシュを試行します');
                await simpleAuthService.refreshToken();
                console.log('ダッシュボード: トークンリフレッシュ成功、再試行します');
              } catch (refreshError) {
                console.error('ダッシュボード: トークンリフレッシュ失敗:', refreshError);
              }
              
              // 少し待機してから再試行
              await new Promise(resolve => setTimeout(resolve, 1000));
              return getServerUserData(true, retry + 1);
            }
            
            // 最大リトライ回数を超えた場合はエラー表示
            setError('ユーザー情報の取得に失敗しました。ネットワーク接続を確認してください。');
            
            // エラー情報を保存
            setDebugInfo(prev => ({
              ...prev,
              errors: [...prev.errors, { 
                timestamp: new Date().toISOString(), 
                type: 'MAX_RETRY_ERROR',
                details: {
                  message: err.message,
                  response: err.response?.status,
                  data: err.response?.data
                }
              }].slice(-5) // 最新5件保持
            }));
            
            return false;
          }
        };
        
        // サーバーからのデータ取得を実行（キャッシュを優先）
        await getServerUserData(false, 0);
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

  // デバッグモードの切り替え
  const [showDebug, setShowDebug] = useState(false);
  const toggleDebug = () => setShowDebug(!showDebug);
  
  // レンダリング前にデバッグ情報をログに記録
  useEffect(() => {
    if (!loading) {
      logDebugEvent('RENDER_PREPARING', { 
        user: user ? 'present' : 'null',
        error: error ? error : 'none'
      });
    }
  }, [loading, user, error]);

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

{/* ヘッダーはアプリケーションバーに統合したため削除 */}

        <Grid container spacing={3}>
          <Grid item xs={12}>
            {/* 統合ダッシュボードセクション */}
            <Paper elevation={3} sx={{ p: 0, overflow: 'hidden', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
              <Box sx={{ 
                borderBottom: 2, 
                borderColor: 'divider', 
                backgroundColor: '#f8fafd', 
                px: 3, 
                pt: 2,
                pb: 1
              }}>
                {/* 選択中の組織情報 */}
                {selectedOrgId && currentTab > 0 && (
                  <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                    <Chip 
                      icon={<BusinessIcon />}
                      label={`選択中の組織: ${organizations?.find(org => org._id === selectedOrgId)?.name || '未選択'}`}
                      variant="outlined"
                      color="primary"
                      sx={{ mr: 2 }}
                    />
                    <Button 
                      size="small" 
                      variant="outlined" 
                      onClick={() => {
                        setCurrentTab(0);
                        // 組織選択をクリアするだけで、ユーザーの所属は変更しない
                      }}
                    >
                      組織選択へ戻る
                    </Button>
                  </Box>
                )}
                
                <Tabs 
                  value={currentTab} 
                  onChange={(e, newValue) => setCurrentTab(newValue)}
                  aria-label="dashboard tabs"
                  indicatorColor="primary"
                  textColor="primary"
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    '& .MuiTab-root': {
                      fontSize: '1rem',
                      fontWeight: 500,
                      py: 2,
                      minHeight: '60px',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: 'rgba(74, 110, 255, 0.05)'
                      }
                    },
                    '& .Mui-selected': {
                      fontWeight: 'bold',
                      color: 'primary.main'
                    },
                    '& .MuiTabs-indicator': {
                      height: 3
                    }
                  }}
                >
                  <Tab 
                    icon={<BusinessIcon sx={{ mr: 1, fontSize: '24px' }} />} 
                    label="組織管理" 
                    id="tab-0" 
                    aria-controls="tabpanel-0"
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<WorkspaceIcon sx={{ mr: 1, fontSize: '24px' }} />} 
                    label="ワークスペース" 
                    id="tab-1" 
                    aria-controls="tabpanel-1"
                    disabled={!selectedOrgId}
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<ApiKeyIcon sx={{ mr: 1, fontSize: '24px' }} />} 
                    label="APIキー管理" 
                    id="tab-2" 
                    aria-controls="tabpanel-2"
                    disabled={!selectedOrgId}
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<PeopleIcon sx={{ mr: 1, fontSize: '24px' }} />} 
                    label="ユーザー管理" 
                    id="tab-3" 
                    aria-controls="tabpanel-3"
                    disabled={!selectedOrgId}
                    iconPosition="start"
                  />
                </Tabs>
              </Box>
              
              {/* 組織カード一覧パネル */}
              <Box
                role="tabpanel"
                hidden={currentTab !== 0}
                id="tabpanel-0"
                aria-labelledby="tab-0"
                sx={{ p: 4 }}
              >
                {currentTab === 0 && (
                  <OrganizationCards 
                    onSelectOrganization={(orgId) => {
                      // 組織の選択時に組織一覧から名前を取得して保持
                      const selectedOrg = organizations.find(org => org._id === orgId);
                      setSelectedOrgId(orgId);
                      setSelectedOrgName(selectedOrg?.name || '');
                      setCurrentTab(1); // 組織選択時に自動的にワークスペースタブに切り替え
                      logDebugEvent('ORGANIZATION_SELECTED', { organizationId: orgId, name: selectedOrg?.name });
                    }}
                    onOpenUserManagement={(orgId) => {
                      // ユーザー管理は組織選択のみを行い、実際のユーザーの所属は変更しない
                      const selectedOrg = organizations.find(org => org._id === orgId);
                      setSelectedOrgId(orgId);
                      setSelectedOrgName(selectedOrg?.name || '');
                      setCurrentTab(3); // ユーザーボタンクリック時にユーザー管理タブに切り替え
                      logDebugEvent('USER_MANAGEMENT_OPENED', { organizationId: orgId, name: selectedOrg?.name });
                    }}
                    onOpenWorkspaceManager={(orgId) => {
                      // APIキー管理は組織選択のみを行う
                      const selectedOrg = organizations.find(org => org._id === orgId);
                      setSelectedOrgId(orgId);
                      setSelectedOrgName(selectedOrg?.name || '');
                      setCurrentTab(2); // APIキー管理タブ（インデックス2）に切り替え
                      logDebugEvent('API_KEY_MANAGEMENT_OPENED', { organizationId: orgId, name: selectedOrg?.name });
                    }}
                    onOrganizationsLoaded={(orgs) => {
                      // 組織一覧が読み込まれたらstateに保存
                      setOrganizations(orgs);
                      logDebugEvent('ORGANIZATIONS_LOADED', { count: orgs.length });
                    }}
                  />
                )}
              </Box>
              
              {/* ワークスペース管理パネル */}
              <Box
                role="tabpanel"
                hidden={currentTab !== 1}
                id="tabpanel-1"
                aria-labelledby="tab-1"
                sx={{ p: 4 }}
              >
                {currentTab === 1 && selectedOrgId && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center' }}>
                      <WorkspaceIcon sx={{ mr: 1, fontSize: '24px', color: 'primary.main' }} />
                      {selectedOrgName} - ワークスペース管理
                    </Typography>
                    <WorkspaceManager 
                      organizationId={selectedOrgId}
                      onWorkspaceUpdate={() => {
                        // ワークスペース更新時のイベント処理
                      }}
                    />
                  </Box>
                )}
              </Box>
              
              {/* APIキー管理パネル */}
              <Box
                role="tabpanel"
                hidden={currentTab !== 2}
                id="tabpanel-2"
                aria-labelledby="tab-2"
                sx={{ p: 4 }}
              >
                {currentTab === 2 && selectedOrgId && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center' }}>
                      <KeyIcon sx={{ mr: 1, fontSize: '24px', color: 'primary.main' }} />
                      {selectedOrgName} - APIキー管理
                    </Typography>
                    <ApiKeyManager organizationId={selectedOrgId} />
                  </Box>
                )}
              </Box>
              
              {/* ユーザー管理パネル */}
              <Box
                role="tabpanel"
                hidden={currentTab !== 3}
                id="tabpanel-3"
                aria-labelledby="tab-3"
                sx={{ p: 4 }}
              >
                {currentTab === 3 && selectedOrgId && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center' }}>
                      <PeopleIcon sx={{ mr: 1, fontSize: '24px', color: 'primary.main' }} />
                      {selectedOrgName} - ユーザー管理
                    </Typography>
                    <UserManager 
                      organizationId={selectedOrgId}
                      onUserUpdate={() => {
                        // ユーザー更新時のイベント処理
                        logDebugEvent('USER_UPDATED', { organizationId: selectedOrgId });
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default Dashboard;