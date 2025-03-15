import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Skeleton,
  Alert,
  Tooltip,
  Divider
} from '@mui/material';
import { 
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
  Description as PromptIcon
} from '@mui/icons-material';
import promptService from '../../services/prompt.service';
import { useNavigate } from 'react-router-dom';

const PromptList = () => {
  // 状態変数
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortOrder, setSortOrder] = useState('updatedAt:desc');
  const navigate = useNavigate();

  // メタデータ（カテゴリーとタグ）取得
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const data = await promptService.getCategoriesAndTags();
        setCategories(data.categories || []);
        setTags(data.tags || []);
      } catch (err) {
        console.error('メタデータ取得エラー:', err);
      }
    };

    fetchMetadata();
  }, []);

  // プロンプト一覧取得
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        setLoading(true);
        setError('');

        const options = {
          page: page + 1, // APIは1ベース
          limit: rowsPerPage,
          sort: sortOrder,
          search: searchQuery || undefined,
          category: selectedCategory || undefined,
          tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined
        };

        const data = await promptService.getPrompts(options);
        setPrompts(data.prompts || []);
        setTotalCount(data.totalCount || 0);
      } catch (err) {
        setError('プロンプト一覧の取得に失敗しました');
        console.error('プロンプト一覧取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, [page, rowsPerPage, sortOrder, searchQuery, selectedCategory, selectedTags]);

  // ページ変更ハンドラ
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // 1ページあたりの行数変更ハンドラ
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 検索クエリ変更ハンドラ
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setPage(0); // 検索時は1ページ目に戻す
  };

  // カテゴリー選択ハンドラ
  const handleCategoryChange = (event) => {
    setSelectedCategory(event.target.value);
    setPage(0);
  };

  // タグ選択ハンドラ
  const handleTagToggle = (tag) => {
    setSelectedTags(prevTags => {
      if (prevTags.includes(tag)) {
        return prevTags.filter(t => t !== tag);
      } else {
        return [...prevTags, tag];
      }
    });
    setPage(0);
  };

  // フィルターリセットハンドラ
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedTags([]);
    setPage(0);
  };

  // プロンプト編集ページへ遷移
  const handleEditPrompt = (id) => {
    navigate(`/prompts/edit/${id}`);
  };

  // プロンプト詳細ページへ遷移
  const handleViewPrompt = (id) => {
    navigate(`/prompts/${id}`);
  };

  // プロンプト削除ハンドラ
  const handleDeletePrompt = async (id) => {
    if (window.confirm('このプロンプトを削除してもよろしいですか？')) {
      try {
        await promptService.deletePrompt(id);
        // 成功後に一覧を更新
        setPrompts(prevPrompts => prevPrompts.filter(prompt => prompt._id !== id));
      } catch (err) {
        setError('プロンプトの削除に失敗しました');
        console.error('プロンプト削除エラー:', err);
      }
    }
  };

  // プロンプト複製ハンドラ
  const handleClonePrompt = async (id) => {
    try {
      const result = await promptService.clonePrompt(id);
      // 成功後に編集ページへ遷移
      navigate(`/prompts/edit/${result.prompt._id}`);
    } catch (err) {
      setError('プロンプトの複製に失敗しました');
      console.error('プロンプト複製エラー:', err);
    }
  };

  // 新規プロンプト作成ページへ遷移
  const handleCreatePrompt = () => {
    navigate('/prompts/create');
  };

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

  // 現在の日時を取得
  const currentDate = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // ローディング表示
  if (loading && page === 0) {
    return (
      <Container maxWidth="lg">
        <Box my={4}>
          <Skeleton variant="rectangular" height={100} />
          <Box my={3}>
            <Skeleton variant="rectangular" height={60} />
          </Box>
          <Skeleton variant="rectangular" height={400} />
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
              <PromptIcon fontSize="large" color="primary" />
            </Grid>
            <Grid item xs>
              <Typography variant="h4" component="h1">
                プロンプト管理
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                {currentDate}
              </Typography>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleCreatePrompt}
              >
                新規作成
              </Button>
            </Grid>
          </Grid>
        </Paper>

        <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="プロンプトを検索..."
                value={searchQuery}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="category-filter-label">カテゴリー</InputLabel>
                <Select
                  labelId="category-filter-label"
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  label="カテゴリー"
                >
                  <MenuItem value="">すべて</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="sort-order-label">並び替え</InputLabel>
                <Select
                  labelId="sort-order-label"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  label="並び替え"
                >
                  <MenuItem value="updatedAt:desc">更新日時 (新しい順)</MenuItem>
                  <MenuItem value="updatedAt:asc">更新日時 (古い順)</MenuItem>
                  <MenuItem value="createdAt:desc">作成日時 (新しい順)</MenuItem>
                  <MenuItem value="createdAt:asc">作成日時 (古い順)</MenuItem>
                  <MenuItem value="title:asc">タイトル (A-Z)</MenuItem>
                  <MenuItem value="title:desc">タイトル (Z-A)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                onClick={handleResetFilters}
              >
                リセット
              </Button>
            </Grid>

            {tags.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  タグで絞り込み:
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {tags.map((tag) => (
                    <Chip
                      key={tag.name}
                      label={`${tag.name} (${tag.count})`}
                      clickable
                      color={selectedTags.includes(tag.name) ? "primary" : "default"}
                      onClick={() => handleTagToggle(tag.name)}
                    />
                  ))}
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>

        <Paper elevation={1}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>タイトル</TableCell>
                  <TableCell>カテゴリー</TableCell>
                  <TableCell>タグ</TableCell>
                  <TableCell>最終更新日</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  // ローディング中の表示
                  Array.from(new Array(rowsPerPage)).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell><Skeleton variant="text" /></TableCell>
                      <TableCell><Skeleton variant="text" /></TableCell>
                      <TableCell><Skeleton variant="text" /></TableCell>
                      <TableCell><Skeleton variant="text" /></TableCell>
                      <TableCell><Skeleton variant="text" /></TableCell>
                    </TableRow>
                  ))
                ) : prompts.length > 0 ? (
                  // プロンプト一覧表示
                  prompts.map((prompt) => (
                    <TableRow key={prompt._id} hover>
                      <TableCell>
                        <Box 
                          sx={{ 
                            cursor: 'pointer',
                            fontWeight: 'medium',
                            '&:hover': { color: 'primary.main' }
                          }}
                          onClick={() => handleViewPrompt(prompt._id)}
                        >
                          {prompt.title}
                        </Box>
                        <Typography variant="caption" color="textSecondary">
                          {prompt.type === 'system' ? 'システムプロンプト' : 'ユーザープロンプト'}
                          {prompt.isPublic ? ' ・ 公開' : ' ・ 非公開'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {prompt.category ? (
                          <Chip size="small" label={prompt.category} />
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            未設定
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {prompt.tags && prompt.tags.length > 0 ? (
                            prompt.tags.map((tag, index) => (
                              <Chip 
                                key={`${prompt._id}-tag-${index}`} 
                                size="small" 
                                label={tag} 
                                sx={{ mr: 0.5, mb: 0.5 }} 
                              />
                            ))
                          ) : (
                            <Typography variant="caption" color="textSecondary">
                              未設定
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={`作成日: ${formatDate(prompt.createdAt)}`}>
                          <Typography>{formatDate(prompt.updatedAt)}</Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Box>
                          <Tooltip title="編集">
                            <IconButton 
                              color="primary" 
                              onClick={() => handleEditPrompt(prompt._id)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="複製">
                            <IconButton 
                              color="info" 
                              onClick={() => handleClonePrompt(prompt._id)}
                            >
                              <CopyIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="削除">
                            <IconButton 
                              color="error" 
                              onClick={() => handleDeletePrompt(prompt._id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  // 結果がない場合の表示
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Box py={3}>
                        <Typography variant="subtitle1" color="textSecondary">
                          プロンプトが見つかりませんでした
                        </Typography>
                        {(searchQuery || selectedCategory || selectedTags.length > 0) && (
                          <Button 
                            variant="text" 
                            color="primary" 
                            onClick={handleResetFilters}
                            sx={{ mt: 1 }}
                          >
                            検索条件をリセット
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage="表示件数:"
            labelDisplayedRows={({ from, to, count }) => 
              `${from}–${to} / ${count !== -1 ? count : `${to}以上`}`
            }
          />
        </Paper>
      </Box>
    </Container>
  );
};

export default PromptList;