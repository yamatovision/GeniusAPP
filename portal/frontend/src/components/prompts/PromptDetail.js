import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Tabs, 
  Tab, 
  Box, 
  Card, 
  CardContent, 
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  Grid,
  Button,
  TextField,
  CircularProgress,
  Container,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Skeleton,
  Menu,
  MenuItem
} from '@mui/material';
import { 
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  History as HistoryIcon,
  BarChart as ChartIcon,
  Description as DescriptionIcon,
  ArrowBack as ArrowBackIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import promptService from '../../services/prompt.service';

// タブパネルのコンテナ
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`prompt-tabpanel-${index}`}
      aria-labelledby={`prompt-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `prompt-tab-${index}`,
    'aria-controls': `prompt-tabpanel-${index}`,
  };
}

// 日付フォーマット関数
const formatDate = (dateString) => {
  if (!dateString) return '情報なし';
  return new Date(dateString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const PromptDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState(null);
  const [versions, setVersions] = useState([]);
  const [usageStats, setUsageStats] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // メニュー開閉
  const handleMenuOpen = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  useEffect(() => {
    const fetchPromptData = async () => {
      setLoading(true);
      try {
        // プロンプト詳細の取得
        const promptData = await promptService.getPromptById(id);
        setPrompt(promptData);
        
        // バージョン履歴の取得
        const versionData = await promptService.getPromptVersions(id);
        setVersions(versionData.versions || []);
        
        // 使用統計の取得
        const usageData = await promptService.getPromptUsageStats(id, { period: 'month' });
        setUsageStats(usageData);
        
        setError(null);
      } catch (err) {
        console.error("プロンプト詳細の取得に失敗しました:", err);
        setError("プロンプト詳細の取得に失敗しました。再度お試しください。");
      } finally {
        setLoading(false);
      }
    };

    fetchPromptData();
  }, [id]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // 編集ページへの遷移
  const handleEdit = () => {
    navigate(`/prompts/edit/${id}`);
    handleMenuClose();
  };

  // プロンプトの削除
  const handleDelete = async () => {
    setDeleteDialogOpen(false);
    handleMenuClose();
    
    try {
      await promptService.deletePrompt(id);
      navigate('/prompts');
    } catch (err) {
      console.error('プロンプト削除エラー:', err);
      setError('プロンプトの削除に失敗しました');
    }
  };

  // プロンプトの複製
  const handleClone = async () => {
    handleMenuClose();
    
    try {
      const result = await promptService.clonePrompt(id);
      navigate(`/prompts/edit/${result.prompt._id}`);
    } catch (err) {
      console.error('プロンプト複製エラー:', err);
      setError('プロンプトの複製に失敗しました');
    }
  };

  // バージョン表示切替
  const handleViewVersion = (version) => {
    setSelectedVersion(version);
  };

  // 最新バージョンに戻る
  const handleBackToLatest = () => {
    setSelectedVersion(null);
  };

  // プロンプト内容のレンダリング
  const renderPromptContent = () => {
    if (loading) {
      return (
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="rectangular" height={100} />
          <Skeleton variant="text" sx={{ mt: 2 }} />
          <Skeleton variant="text" />
          <Skeleton variant="rectangular" height={300} sx={{ mt: 2 }} />
        </Box>
      );
    }
    
    if (!prompt) return null;

    // 表示するコンテンツを決定（選択されたバージョンまたは最新）
    const displayContent = selectedVersion 
      ? selectedVersion
      : prompt;
    
    return (
      <Box sx={{ mt: 2 }}>
        {selectedVersion && (
          <Alert 
            severity="info" 
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={handleBackToLatest}>
                最新バージョンに戻る
              </Button>
            }
          >
            バージョン {selectedVersion.versionNumber} を表示しています（{formatDate(selectedVersion.createdAt)}）
          </Alert>
        )}
        
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography variant="h5" gutterBottom>
                {prompt.title}
              </Typography>
              
              {!selectedVersion && (
                <IconButton onClick={handleMenuOpen}>
                  <MoreVertIcon />
                </IconButton>
              )}
              
              <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleEdit}>
                  <EditIcon fontSize="small" sx={{ mr: 1 }} />
                  編集
                </MenuItem>
                <MenuItem onClick={handleClone}>
                  <CopyIcon fontSize="small" sx={{ mr: 1 }} />
                  複製
                </MenuItem>
                <MenuItem onClick={() => setDeleteDialogOpen(true)} sx={{ color: 'error.main' }}>
                  <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                  削除
                </MenuItem>
              </Menu>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Chip 
                label={displayContent.type === 'system' ? 'システムプロンプト' : 'ユーザープロンプト'} 
                color="primary" 
                size="small" 
                sx={{ mr: 1 }}
              />
              <Chip 
                label={prompt.isPublic ? '公開' : '非公開'} 
                color={prompt.isPublic ? 'success' : 'default'} 
                size="small" 
              />
            </Box>
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              作成日: {formatDate(prompt.createdAt)}
              {' ・ '}
              更新日: {formatDate(prompt.updatedAt)}
              {prompt.category && ` ・ カテゴリー: ${prompt.category}`}
            </Typography>
            
            {prompt.tags?.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1, flexWrap: 'wrap' }}>
                {prompt.tags.map((tag, index) => (
                  <Chip key={index} label={tag} size="small" variant="outlined" />
                ))}
              </Box>
            )}
            
            {prompt.description && (
              <>
                <Typography variant="body1" paragraph sx={{ mt: 2 }}>
                  {prompt.description}
                </Typography>
                <Divider sx={{ my: 2 }} />
              </>
            )}
            
            <Typography variant="h6" gutterBottom>
              プロンプト内容
            </Typography>
            
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              backgroundColor: '#f5f5f5', 
              borderRadius: 1,
              maxHeight: '500px',
              overflow: 'auto',
              fontFamily: 'monospace'
            }}>
              <ReactMarkdown>
                {displayContent.content}
              </ReactMarkdown>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  };

  // バージョン履歴のレンダリング
  const renderVersionHistory = () => {
    if (loading) {
      return (
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="rectangular" height={60} />
          <Skeleton variant="rectangular" height={60} sx={{ mt: 1 }} />
          <Skeleton variant="rectangular" height={60} sx={{ mt: 1 }} />
        </Box>
      );
    }
    
    if (!versions || versions.length === 0) {
      return <Typography>バージョン履歴はありません。</Typography>;
    }
    
    return (
      <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
        {versions.map((version, index) => (
          <React.Fragment key={version._id || index}>
            <ListItem 
              alignItems="flex-start"
              sx={{ 
                backgroundColor: selectedVersion?._id === version._id ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                borderRadius: 1
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">
                      バージョン {version.versionNumber || index + 1}
                      {index === 0 && !selectedVersion && (
                        <Chip label="現在" size="small" color="primary" sx={{ ml: 1 }} />
                      )}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      作成日: {formatDate(version.createdAt)}
                    </Typography>
                    
                    {version.description && (
                      <Typography variant="body2" paragraph sx={{ mt: 1 }}>
                        {version.description}
                      </Typography>
                    )}
                    
                    <Box sx={{ mt: 2 }}>
                      <Button 
                        size="small" 
                        variant={selectedVersion?._id === version._id ? "contained" : "outlined"}
                        onClick={() => handleViewVersion(version)}
                        startIcon={<DescriptionIcon />}
                      >
                        {selectedVersion?._id === version._id ? "表示中" : "内容を表示"}
                      </Button>
                    </Box>
                  </Box>
                }
              />
            </ListItem>
            {index < versions.length - 1 && <Divider variant="inset" component="li" />}
          </React.Fragment>
        ))}
      </List>
    );
  };

  // 使用統計のレンダリング
  const renderUsageStats = () => {
    if (loading) {
      return (
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="rectangular" height={300} />
          <Skeleton variant="rectangular" height={300} sx={{ mt: 3 }} />
        </Box>
      );
    }
    
    if (!usageStats || !usageStats.data || usageStats.data.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <Typography variant="h6" color="text.secondary">
            使用統計データはありません
          </Typography>
        </Box>
      );
    }
    
    // 使用統計データの整形
    const monthlyData = usageStats.data.map(item => ({
      month: item.period,
      count: item.count,
      tokens: item.totalTokens || 0
    }));
    
    // クライアント分布
    const clientData = usageStats.clients?.map(client => ({
      name: client.name,
      count: client.count
    })) || [];
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            月別使用統計
          </Typography>
          <Paper elevation={0} variant="outlined" sx={{ p: 2, height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="count" name="使用回数" stroke="#8884d8" activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="tokens" name="トークン数" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        {clientData.length > 0 && (
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              クライアント別使用回数
            </Typography>
            <Paper elevation={0} variant="outlined" sx={{ p: 2, height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={clientData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" name="使用回数" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}
        
        <Grid item xs={12} md={clientData.length > 0 ? 6 : 12}>
          <Typography variant="h6" gutterBottom>
            使用統計サマリー
          </Typography>
          <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
            <List>
              <ListItem>
                <ListItemText 
                  primary="総使用回数" 
                  secondary={usageStats.totalUsage || 0} 
                />
              </ListItem>
              <Divider component="li" />
              <ListItem>
                <ListItemText 
                  primary="総トークン数" 
                  secondary={usageStats.totalTokens || 0} 
                />
              </ListItem>
              <Divider component="li" />
              <ListItem>
                <ListItemText 
                  primary="最初の使用" 
                  secondary={usageStats.firstUsed ? formatDate(usageStats.firstUsed) : '情報なし'} 
                />
              </ListItem>
              <Divider component="li" />
              <ListItem>
                <ListItemText 
                  primary="最新の使用" 
                  secondary={usageStats.lastUsed ? formatDate(usageStats.lastUsed) : '情報なし'} 
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  // 戻るボタン
  const handleBack = () => {
    navigate('/prompts');
  };

  // 削除確認ダイアログ
  const renderDeleteDialog = () => (
    <Dialog
      open={deleteDialogOpen}
      onClose={() => setDeleteDialogOpen(false)}
    >
      <DialogTitle>プロンプトの削除</DialogTitle>
      <DialogContent>
        <DialogContentText>
          プロンプト「{prompt?.title}」を削除します。この操作は取り消せません。続行しますか？
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
        <Button onClick={handleDelete} color="error" variant="contained">
          削除
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Container maxWidth="lg">
      <Box my={4}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={handleBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          
          <Typography variant="h4" component="h1">
            {loading ? (
              <Skeleton width={300} />
            ) : (
              prompt?.title || 'プロンプト詳細'
            )}
          </Typography>
        </Box>
        
        <Paper elevation={1}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab icon={<DescriptionIcon />} label="コンテンツ" {...a11yProps(0)} />
            <Tab icon={<HistoryIcon />} label="バージョン履歴" {...a11yProps(1)} />
            <Tab icon={<ChartIcon />} label="使用統計" {...a11yProps(2)} />
          </Tabs>
          
          <TabPanel value={tabValue} index={0}>
            {renderPromptContent()}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            {renderVersionHistory()}
          </TabPanel>
          
          <TabPanel value={tabValue} index={2}>
            {renderUsageStats()}
          </TabPanel>
        </Paper>
        
        {renderDeleteDialog()}
      </Box>
    </Container>
  );
};

export default PromptDetail;