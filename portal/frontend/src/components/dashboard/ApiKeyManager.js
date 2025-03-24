import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  TextField, 
  IconButton, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction,
  Divider, 
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Chip,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Key as KeyIcon
} from '@mui/icons-material';
import { 
  getSimpleOrganizationApiKeys, 
  createSimpleApiKey, 
  deleteSimpleApiKey 
} from '../../services/simple/simpleApiKey.service';

/**
 * APIキー管理コンポーネント
 * シンプルダッシュボードのAPIキー管理機能を標準ダッシュボードに統合
 */
const ApiKeyManager = ({ organizationId }) => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [processingKey, setProcessingKey] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState(null);
  const [showFullKey, setShowFullKey] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (organizationId) {
      fetchApiKeys();
    }
  }, [organizationId]);

  // APIキー一覧を取得
  const fetchApiKeys = async () => {
    if (!organizationId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await getSimpleOrganizationApiKeys(organizationId);
      
      if (!response.success) {
        throw new Error(response.message || 'APIキー一覧の取得に失敗しました');
      }
      
      setApiKeys(response.data || []);
    } catch (err) {
      console.error('APIキー取得エラー:', err);
      setError('APIキー一覧の取得に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // APIキーを追加
  const handleAddApiKey = async () => {
    try {
      setProcessingKey('adding');
      setError(null);
      
      if (!newApiKey || newApiKey.trim() === '') {
        setError('APIキーを入力してください');
        return;
      }
      
      const response = await createSimpleApiKey(organizationId, newApiKey);
      
      if (!response.success) {
        throw new Error(response.message || 'APIキーの追加に失敗しました');
      }
      
      // 成功したらフォームをリセットして一覧を更新
      setSuccessMessage('APIキーが正常に追加されました');
      setNewApiKey('');
      setShowAddForm(false);
      await fetchApiKeys();
      
      // 3秒後に成功メッセージを消す
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('APIキー追加エラー:', err);
      setError('APIキーの追加に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setProcessingKey(null);
    }
  };

  // 削除ダイアログを表示
  const openDeleteDialog = (key) => {
    setKeyToDelete(key);
    setDeleteDialogOpen(true);
  };

  // APIキーを削除
  const handleDeleteApiKey = async () => {
    if (!keyToDelete) return;
    
    try {
      setProcessingKey(keyToDelete._id);
      setError(null);
      
      const response = await deleteSimpleApiKey(organizationId, keyToDelete._id);
      
      if (!response.success) {
        throw new Error(response.message || 'APIキーの削除に失敗しました');
      }
      
      // 成功したら一覧を更新
      setSuccessMessage('APIキーが正常に削除されました');
      await fetchApiKeys();
      
      // 3秒後に成功メッセージを消す
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('APIキー削除エラー:', err);
      setError('APIキーの削除に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setProcessingKey(null);
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
    }
  };

  // APIキーの表示/非表示を切り替え
  const toggleKeyVisibility = (keyId) => {
    setShowFullKey(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  // APIキーをクリップボードにコピー
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setSuccessMessage('APIキーをクリップボードにコピーしました');
        setTimeout(() => setSuccessMessage(null), 3000);
      })
      .catch(err => {
        console.error('クリップボードへのコピーに失敗しました:', err);
        setError('クリップボードへのコピーに失敗しました');
      });
  };

  // キーの表示形式を整形
  const formatKeyDisplay = (key, keyId) => {
    if (showFullKey[keyId]) {
      return key;
    }
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  };

  // ローディング表示
  if (loading && apiKeys.length === 0) {
    return (
      <Box mb={3}>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              <KeyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              APIキー管理
            </Typography>
          </Box>
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box mb={3}>
      <Paper elevation={1} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <KeyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            APIキー管理
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'キャンセル' : 'APIキーを追加'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}

        {showAddForm && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                新しいAPIキーを追加
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <TextField 
                  fullWidth
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="APIキーを入力してください"
                  variant="outlined"
                  size="small"
                  disabled={processingKey === 'adding'}
                />
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleAddApiKey}
                  disabled={!newApiKey || processingKey === 'adding'}
                >
                  {processingKey === 'adding' ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    '追加'
                  )}
                </Button>
              </Box>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                ※ Anthropic API Keyを入力してください。APIキーは「sk-ant-」で始まります。
              </Typography>
            </CardContent>
          </Card>
        )}

        {apiKeys.length === 0 ? (
          <Card variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="textSecondary" gutterBottom>
              登録されているAPIキーがありません
            </Typography>
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<AddIcon />}
              onClick={() => setShowAddForm(true)}
              sx={{ mt: 1 }}
            >
              APIキーを追加する
            </Button>
          </Card>
        ) : (
          <>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              登録済みAPIキー ({apiKeys.length}件)
            </Typography>
            <List sx={{ width: '100%' }}>
              {apiKeys.map((key, index) => (
                <React.Fragment key={key._id}>
                  <ListItem 
                    sx={{ 
                      py: 2,
                      bgcolor: showFullKey[key._id] ? 'action.hover' : 'transparent',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <ListItemText 
                      primary={
                        <Box display="flex" alignItems="center">
                          <Typography 
                            variant="body1" 
                            component="span" 
                            fontFamily="monospace"
                            sx={{ 
                              mr: 1,
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {formatKeyDisplay(key.keyValue, key._id)}
                          </Typography>
                          <Chip 
                            size="small" 
                            label={new Date(key.createdAt).toLocaleDateString()}
                            variant="outlined"
                            sx={{ ml: 1 }}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="textSecondary">
                          追加日: {new Date(key.createdAt).toLocaleDateString('ja-JP', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Typography>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title={showFullKey[key._id] ? "APIキーを隠す" : "APIキーを表示"}>
                        <IconButton 
                          edge="end" 
                          onClick={() => toggleKeyVisibility(key._id)}
                          size="small"
                          sx={{ mr: 1 }}
                        >
                          {showFullKey[key._id] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="クリップボードにコピー">
                        <IconButton 
                          edge="end" 
                          onClick={() => copyToClipboard(key.keyValue)}
                          size="small"
                          sx={{ mr: 1 }}
                        >
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="APIキーを削除">
                        <IconButton 
                          edge="end" 
                          onClick={() => openDeleteDialog(key)}
                          size="small"
                          color="error"
                          disabled={processingKey === key._id}
                        >
                          {processingKey === key._id ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            <DeleteIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < apiKeys.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </>
        )}
      </Paper>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>APIキーを削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            このAPIキーを削除してもよろしいですか？この操作は取り消せません。
          </DialogContentText>
          {keyToDelete && (
            <Typography 
              variant="body2" 
              fontFamily="monospace" 
              sx={{ mt: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}
            >
              {formatKeyDisplay(keyToDelete.keyValue, keyToDelete._id)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            キャンセル
          </Button>
          <Button 
            onClick={handleDeleteApiKey} 
            color="error" 
            variant="contained"
            disabled={processingKey === (keyToDelete?._id || 'deleting')}
          >
            {processingKey === (keyToDelete?._id || 'deleting') ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              '削除'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApiKeyManager;