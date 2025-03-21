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
  Description as DescriptionIcon,
  ArrowBack as ArrowBackIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
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

// バージョン比較関数 - 2つのバージョンが同じかどうかを判定
const isVersionSelected = (selectedVersion, version) => {
  // MongoDB IDは_idまたはidで格納されている場合がある
  const selectedId = selectedVersion._id || selectedVersion.id;
  const versionId = version._id || version.id;
  
  // どちらかがnullやundefinedの場合
  if (!selectedId || !versionId) {
    return false;
  }
  
  // 文字列に変換して比較
  return String(selectedId) === String(versionId);
};

const PromptDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState(null);
  const [versions, setVersions] = useState([]);
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
        // バックエンドが直接バージョン配列を返す場合と、versions プロパティに含まれる場合の両方に対応
        setVersions(Array.isArray(versionData) ? versionData : (versionData.versions || []));
        
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
      console.log('プロンプト削除開始:', id);
      
      // IDの検証
      if (!id) {
        console.error('プロンプトIDがありません');
        setError('プロンプトの削除に失敗しました: IDが無効です');
        return;
      }
      
      // 削除API呼び出し
      await promptService.deletePrompt(id);
      console.log('プロンプト削除成功:', id);
      
      // 一覧ページに戻る
      navigate('/prompts');
    } catch (err) {
      console.error('プロンプト削除エラー:', err);
      const errorMsg = err.response?.data?.message || '不明なエラー';
      setError(`プロンプトの削除に失敗しました: ${errorMsg}`);
    }
  };

  // プロンプトの複製
  const handleClone = async () => {
    handleMenuClose();
    
    try {
      setError(null); // 前回のエラーをクリア
      
      // 安全なID確認
      if (!id) {
        console.error('プロンプトIDがありません');
        setError('プロンプトの複製に失敗しました: IDが無効です');
        return;
      }
      
      console.log('複製を開始します: プロンプトID:', id);
      const result = await promptService.clonePrompt(id);
      console.log('複製API応答:', result);
      
      // 厳密な結果確認（idまたは_idを許容）
      if (result && typeof result === 'object' && result.prompt && 
          typeof result.prompt === 'object' && (result.prompt.id || result.prompt._id)) {
        const promptId = result.prompt.id || result.prompt._id;
        console.log('複製成功:', promptId);
        navigate(`/prompts/edit/${promptId}`);
      } else {
        console.error('無効な応答構造:', result);
        setError('プロンプトの複製に失敗しました: サーバーからの応答が不正です');
      }
    } catch (err) {
      console.error('プロンプト複製エラー:', err);
      const errorMsg = err.response?.data?.message || '不明なエラー';
      setError(`プロンプトの複製に失敗しました: ${errorMsg}`);
    }
  };

  // バージョン表示切替
  const handleViewVersion = (version) => {
    // バージョンを選択して内容を表示
    if (!version) {
      console.error('バージョンデータがありません');
      return;
    }
    
    // MongoDB IDは_idまたはidプロパティに格納されている可能性がある
    const versionId = version._id || version.id;
    console.log('選択されたバージョン:', versionId, version);
    
    // 選択されたバージョンを設定
    setSelectedVersion(version);
    
    // コンテンツタブに切り替え
    setTabValue(0);
  };

  // 最新バージョンに戻る
  const handleBackToLatest = () => {
    setSelectedVersion(null);
  };
  
  // 選択したバージョンを最新に設定
  const handleSetAsLatest = async (version) => {
    if (!version || !prompt) return;
    
    try {
      setError(null);
      
      // 確認ダイアログを表示
      const confirmResult = window.confirm(
        `バージョン ${version.versionNumber} を最新バージョンとして設定しますか？\n` +
        `このバージョンの内容が公式バージョンになります。`
      );
      
      if (!confirmResult) return;
      
      // バージョンの内容でプロンプトを更新
      const updateData = {
        content: version.content
      };
      
      // プロンプト更新APIを呼び出し
      await promptService.updatePrompt(prompt.id || prompt._id, updateData);
      
      // 更新成功メッセージ
      window.alert(`バージョン ${version.versionNumber} が最新バージョンとして設定されました。`);
      
      // データを再読み込み
      const promptData = await promptService.getPromptById(id);
      setPrompt(promptData);
      
    } catch (err) {
      console.error('最新バージョン設定エラー:', err);
      const errorMsg = err.response?.data?.message || '不明なエラー';
      setError(`バージョンの設定に失敗しました: ${errorMsg}`);
    }
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
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  color="success" 
                  size="small" 
                  variant="outlined"
                  onClick={() => handleSetAsLatest(selectedVersion)}
                >
                  このバージョンを最新に設定
                </Button>
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={handleBackToLatest}
                >
                  最新バージョンを表示
                </Button>
              </Box>
            }
          >
            選択中: バージョン {selectedVersion.versionNumber} （作成日: {formatDate(selectedVersion.createdAt)}）
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
                backgroundColor: selectedVersion && isVersionSelected(selectedVersion, version) ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                borderRadius: 1
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">
                      バージョン {version.versionNumber || index + 1}
                      {selectedVersion && isVersionSelected(selectedVersion, version) ? (
                        <Chip label="選択中" size="small" color="primary" sx={{ ml: 1 }} />
                      ) : (
                        index === 0 && !selectedVersion && (
                          <Chip label="最新" size="small" color="success" sx={{ ml: 1 }} />
                        )
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
                        variant={selectedVersion && isVersionSelected(selectedVersion, version) ? "contained" : "outlined"}
                        onClick={() => handleViewVersion(version)}
                        startIcon={<DescriptionIcon />}
                        color="primary"
                      >
                        選択
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

  // 使用統計表示は削除されました

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
          </Tabs>
          
          <TabPanel value={tabValue} index={0}>
            {renderPromptContent()}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            {renderVersionHistory()}
          </TabPanel>
        </Paper>
        
        {renderDeleteDialog()}
      </Box>
    </Container>
  );
};

export default PromptDetail;