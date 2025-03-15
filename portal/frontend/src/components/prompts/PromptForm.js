import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  Grid, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Chip,
  FormControlLabel,
  Switch,
  FormHelperText,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Autocomplete,
  Divider,
  Snackbar
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
  DeleteOutline as DeleteIcon,
  VisibilityOff as PrivateIcon,
  Visibility as PublicIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import promptService from '../../services/prompt.service';
import ReactMarkdown from 'react-markdown';

// APIのベースURL（promptService.jsと同じ値を使用）
const API_URL = `${process.env.REACT_APP_API_URL || '/api'}/prompts`;

const PromptForm = () => {
  // URLパラメータからプロンプトIDを取得（編集モードの場合）
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 状態変数
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);
  const [isPublic, setIsPublic] = useState(true);
  const [versionDescription, setVersionDescription] = useState('');
  
  // 入力検証エラー
  const [errors, setErrors] = useState({});
  
  // UI状態
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  
  // メタデータ用
  const [tagOptions, setTagOptions] = useState([]);
  const [newTag, setNewTag] = useState('');
  
  // 編集モードかどうかを判定
  const isEditMode = !!id;
  
  // 画面初期化：メタデータ（タグ）の取得
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        // タグの取得
        const metadataResponse = await promptService.getCategoriesAndTags();
        setTagOptions(metadataResponse.tags || []);
      } catch (err) {
        console.error('メタデータ取得エラー:', err);
        setError('タグ情報の取得に失敗しました');
      }
    };
    
    fetchMetadata();
  }, []);
  
  // 編集モード時：プロンプトデータの取得
  useEffect(() => {
    if (isEditMode && id) {  // idが存在する場合のみ実行
      const fetchPromptData = async () => {
        setLoading(true);
        try {
          // IDの検証
          if (!id || id === 'undefined') {
            throw new Error('無効なプロンプトIDです');
          }
          
          console.log('プロンプト詳細取得API呼び出し:', `${API_URL}/${id}`);
          const promptData = await promptService.getPromptById(id);
          
          if (promptData) {
            // フォームに値をセット
            console.log('取得したプロンプトデータ:', promptData);
            
            // レスポンス構造が異なる場合に対応
            const data = promptData.prompt || promptData;
            
            setTitle(data.title || '');
            setDescription(data.description || '');
            setContent(data.content || '');
            setTags(data.tags || []);
            setIsPublic(data.isPublic !== undefined ? data.isPublic : true);
          }
          
          setError('');
        } catch (err) {
          console.error('プロンプト取得エラー:', err);
          setError(`プロンプトの取得に失敗しました: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };
      
      fetchPromptData();
    } else {
      // 新規作成モードの初期値設定
      setLoading(false);
      setIsPublic(true);
    }
  }, [id, isEditMode, location.search]);
  
  // フォーム送信
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 入力検証
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setSubmitLoading(true);
    setError('');
    setSuccess('');
    
    // プロンプトデータの構築
    const promptData = {
      title,
      description,
      content,
      type: 'system', // 常にシステムプロンプトとして設定
      tags,
      isPublic
    };
    
    try {
      if (isEditMode) {
        // 編集モード：更新
        await promptService.updatePrompt(id, promptData);
        
        // バージョン説明がある場合は新しいバージョンを作成
        if (versionDescription.trim()) {
          await promptService.createPromptVersion(id, {
            content,
            description: versionDescription
          });
        }
        
        setSuccess('プロンプトを更新しました');
        setSnackbarOpen(true);
        
        // 成功通知を表示した後、一覧画面に戻る
        setTimeout(() => {
          navigate('/prompts');
        }, 1500);
      } else {
        // 新規作成モード
        const result = await promptService.createPrompt(promptData);
        setSuccess('プロンプトを作成しました');
        setSnackbarOpen(true);
        
        // 成功通知を表示した後、一覧画面に戻る
        setTimeout(() => {
          navigate('/prompts');
        }, 1500);
      }
    } catch (err) {
      console.error('プロンプト保存エラー:', err);
      setError('プロンプトの保存に失敗しました');
    } finally {
      setSubmitLoading(false);
    }
  };
  
  // 入力検証
  const validateForm = () => {
    const errors = {};
    
    if (!title.trim()) {
      errors.title = 'タイトルは必須です';
    }
    
    if (!content.trim()) {
      errors.content = 'プロンプト内容は必須です';
    }
    
    return errors;
  };
  
  // タグ追加
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };
  
  // タグ削除
  const handleDeleteTag = (tagToDelete) => {
    setTags(tags.filter(tag => tag !== tagToDelete));
  };
  
  // プロンプト削除
  const handleDelete = async () => {
    setDeleteDialogOpen(false);
    
    try {
      await promptService.deletePrompt(id);
      // 削除後、一覧ページに戻る
      navigate('/prompts');
    } catch (err) {
      console.error('プロンプト削除エラー:', err);
      setError('プロンプトの削除に失敗しました');
    }
  };
  
  // キャンセル処理
  const handleCancel = () => {
    if (isEditMode) {
      navigate(`/prompts/${id}`);
    } else {
      navigate('/prompts');
    }
  };
  
  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
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
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}
        
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={handleCancel} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1">
              {isEditMode ? 'プロンプト編集' : 'プロンプト作成'}
            </Typography>
          </Box>
          
          {isEditMode && (
            <Tooltip title="プロンプトを削除">
              <Button 
                color="error" 
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteDialogOpen(true)}
              >
                削除
              </Button>
            </Tooltip>
          )}
        </Box>
        
        <Paper elevation={1} sx={{ p: 3 }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* 基本情報セクション */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  基本情報
                </Typography>
              </Grid>
              
              {/* タイトル */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="タイトル"
                  variant="outlined"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  error={!!errors.title}
                  helperText={errors.title}
                  required
                />
              </Grid>
              
              {/* 説明 */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="説明"
                  variant="outlined"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  rows={2}
                  placeholder="このプロンプトの目的や使用方法の説明を入力してください"
                />
              </Grid>
              
              
              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={isPublic} 
                      onChange={(e) => setIsPublic(e.target.checked)} 
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {isPublic ? (
                        <>
                          <PublicIcon color="success" sx={{ mr: 1 }} />
                          <span>公開</span>
                        </>
                      ) : (
                        <>
                          <PrivateIcon color="default" sx={{ mr: 1 }} />
                          <span>非公開</span>
                        </>
                      )}
                    </Box>
                  }
                  sx={{ mt: 1 }}
                />
                <FormHelperText>
                  {isPublic ? 
                    '公開するとすべてのユーザーがこのプロンプトを閲覧できます' : 
                    '非公開にするとあなただけがこのプロンプトを閲覧できます'}
                </FormHelperText>
              </Grid>
              
              {/* タグ */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  freeSolo
                  value={tags}
                  onChange={(event, newValue) => {
                    setTags(newValue);
                  }}
                  options={tagOptions.map(tag => tag.name)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant="outlined"
                      label="タグ"
                      placeholder="Enterで追加"
                      helperText="関連するキーワードを追加してください"
                    />
                  )}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
              </Grid>
              
              {/* プロンプト内容 */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    プロンプト内容
                  </Typography>
                  <Button
                    startIcon={<CodeIcon />}
                    onClick={() => setPreviewMode(!previewMode)}
                  >
                    {previewMode ? 'エディターに戻る' : 'プレビュー'}
                  </Button>
                </Box>
                
                {previewMode ? (
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      minHeight: 300, 
                      maxHeight: 600, 
                      overflow: 'auto' 
                    }}
                  >
                    <ReactMarkdown>
                      {content}
                    </ReactMarkdown>
                  </Paper>
                ) : (
                  <TextField
                    fullWidth
                    variant="outlined"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    multiline
                    rows={15}
                    placeholder="プロンプト内容を入力してください。マークダウン形式をサポートしています。"
                    error={!!errors.content}
                    helperText={errors.content}
                    required
                    sx={{ fontFamily: 'monospace' }}
                  />
                )}
              </Grid>
              
              {/* バージョン説明（編集モードのみ） */}
              {isEditMode && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="バージョン説明（変更点）"
                    variant="outlined"
                    value={versionDescription}
                    onChange={(e) => setVersionDescription(e.target.value)}
                    placeholder="主な変更点を入力してください（入力すると新しいバージョンとして保存されます）"
                  />
                  <FormHelperText>
                    このフィールドに入力すると変更履歴として記録されます。空の場合は直接更新されます。
                  </FormHelperText>
                </Grid>
              )}
              
              {/* フォーム送信ボタン */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleCancel}
                    startIcon={<CancelIcon />}
                    disabled={submitLoading}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    disabled={submitLoading}
                  >
                    {submitLoading ? (
                      <CircularProgress size={24} />
                    ) : (
                      isEditMode ? '更新' : '作成'
                    )}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Paper>
        
        {/* 削除確認ダイアログ */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>プロンプトの削除</DialogTitle>
          <DialogContent>
            <DialogContentText>
              プロンプト「{title}」を削除します。この操作は取り消せません。続行しますか？
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              削除
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* 成功通知のスナックバー */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setSnackbarOpen(false)} 
            severity="success" 
            variant="filled"
            sx={{ width: '100%' }}
          >
            {success}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default PromptForm;