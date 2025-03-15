import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  InputAdornment,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import planService from '../../services/plan.service';

/**
 * プラン詳細・編集ページ
 * APIアクセスプランの作成・編集UI
 */
const PlanDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewPlan = id === 'new';

  // プラン情報のステート
  const [plan, setPlan] = useState({
    name: '',
    accessLevel: 'basic',
    monthlyTokenLimit: 100000,
    dailyTokenLimit: null,
    concurrentRequestLimit: 5,
    allowedModels: ['sonnet'],
    description: '',
    isActive: true
  });

  // isNewPlanが真の場合は初期値falseで開始
  const [loading, setLoading] = useState(isNewPlan ? false : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // 初期データの読み込み
  useEffect(() => {
    // 新規作成モードなら初期値を設定してローディング終了
    if (isNewPlan || id === 'new') {
      setLoading(false);
      return;
    }
    
    // 既存プランの場合はデータを取得
    if (id && id !== 'new') {
      setLoading(true);
      fetchPlanData();
    } else {
      // IDがない場合もローディングを終了
      setLoading(false);
    }
  }, [id, isNewPlan]);

  // プランデータの取得
  const fetchPlanData = async () => {
    try {
      // 安全チェック
      if (isNewPlan || id === 'new') {
        console.log('新規プラン作成モードです - データ取得をスキップします');
        setLoading(false);
        return;
      }
      
      // IDの検証
      if (!id) {
        console.log('IDが指定されていません - 新規モードとして扱います');
        setLoading(false);
        return;
      }
      
      if (id === 'undefined' || id === 'null') {
        throw new Error('有効なプランIDが指定されていません');
      }
      
      // プランデータを取得
      console.log(`プランID: ${id} のデータを取得します`);
      const data = await planService.getPlanById(id);
      
      // データが取得できた場合のみステートを更新
      if (data) {
        setPlan(data);
        console.log('プランデータを正常に取得しました', data);
      } else {
        console.warn('プランデータが空です');
      }
    } catch (error) {
      console.error('プラン取得エラー:', error);
      setError('プラン情報の取得に失敗しました: ' + 
        (error.response?.data?.message || error.message || '不明なエラー'));
    } finally {
      // 必ずローディング状態を終了
      setLoading(false);
    }
  };

  // 入力変更ハンドラ
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // 整数値の入力を処理
    if (name === 'monthlyTokenLimit' || name === 'dailyTokenLimit' || name === 'concurrentRequestLimit') {
      // 「制限なし」の場合はnullを設定
      if (value === '' && name === 'dailyTokenLimit') {
        setPlan(prev => ({ ...prev, [name]: null }));
        return;
      }
      
      // 数値またはnullに変換
      const numValue = value === '' ? null : parseInt(value, 10);
      if (!isNaN(numValue) || numValue === null) {
        setPlan(prev => ({ ...prev, [name]: numValue }));
      }
    } else if (type === 'checkbox') {
      setPlan(prev => ({ ...prev, [name]: checked }));
    } else {
      setPlan(prev => ({ ...prev, [name]: value }));
    }
    
    // バリデーションエラーをクリア
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // フォーム送信ハンドラ
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // バリデーション
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // 保存の前にデバッグログ出力
      console.log('プラン保存処理開始:', { isNewPlan, id, plan });
      
      // 新規作成か更新かの確認（より明示的に）
      if (isNewPlan || id === 'new' || !id) {
        console.log('新規プラン作成処理を実行します');
        // 新規プランの作成
        const result = await planService.createPlan(plan);
        console.log('プラン作成結果:', result);
        
        setSuccess('プランが正常に作成されました');
        
        // 作成成功時のみナビゲーション実行
        if (result) {
          setTimeout(() => {
            navigate('/plans');
          }, 2000);
        }
      } else {
        console.log(`既存プラン(ID: ${id})の更新処理を実行します`);
        // 既存プランの更新
        const result = await planService.updatePlan(id, plan);
        console.log('プラン更新結果:', result);
        
        setSuccess('プラン情報が正常に更新されました');
        // 既存データを再取得
        await fetchPlanData(); 
      }
    } catch (error) {
      console.error('プラン保存エラー:', error);
      setError('プラン情報の保存に失敗しました: ' + 
        (error.response?.data?.message || error.message || '不明なエラー'));
    } finally {
      setSaving(false);
    }
  };

  // フォームバリデーション
  const validateForm = () => {
    const errors = {};
    
    if (!plan.name.trim()) {
      errors.name = 'プラン名は必須です';
    }
    
    if (!plan.accessLevel) {
      errors.accessLevel = 'アクセスレベルは必須です';
    }
    
    if (!plan.monthlyTokenLimit || plan.monthlyTokenLimit <= 0) {
      errors.monthlyTokenLimit = '月間トークン上限は0より大きい値を設定してください';
    }
    
    if (plan.dailyTokenLimit !== null && plan.dailyTokenLimit <= 0) {
      errors.dailyTokenLimit = '日次トークン上限は0より大きい値を設定してください';
    }
    
    if (!plan.concurrentRequestLimit || plan.concurrentRequestLimit <= 0) {
      errors.concurrentRequestLimit = '同時接続数上限は0より大きい値を設定してください';
    }
    
    return errors;
  };

  // デバッグ用ログ
  console.log(`レンダリング中 - isNewPlan: ${isNewPlan}, id: ${id}, loading: ${loading}`);

  if (loading) {
    console.log('ローディング表示中...');
    return (
      <Container maxWidth="md">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
          <Typography variant="body2" color="textSecondary" sx={{ ml: 2 }}>
            データ読み込み中...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {isNewPlan ? 'プラン新規作成' : 'プラン編集'}
        </Typography>
        <Button
          variant="outlined"
          component={Link}
          to="/plans"
          startIcon={<ArrowBackIcon />}
        >
          プラン一覧に戻る
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="プラン名"
                  name="name"
                  value={plan.name}
                  onChange={handleChange}
                  fullWidth
                  required
                  error={!!validationErrors.name}
                  helperText={validationErrors.name}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="アクセスレベル"
                  name="accessLevel"
                  value={plan.accessLevel}
                  onChange={handleChange}
                  fullWidth
                  required
                  error={!!validationErrors.accessLevel}
                  helperText={validationErrors.accessLevel}
                >
                  <MenuItem value="basic">ベーシック (basic)</MenuItem>
                  <MenuItem value="advanced">アドバンスト (advanced)</MenuItem>
                  <MenuItem value="premium">プレミアム (premium)</MenuItem>
                </TextField>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="月間トークン上限"
                  name="monthlyTokenLimit"
                  type="number"
                  value={plan.monthlyTokenLimit}
                  onChange={handleChange}
                  fullWidth
                  required
                  InputProps={{
                    endAdornment: <InputAdornment position="end">トークン</InputAdornment>,
                  }}
                  error={!!validationErrors.monthlyTokenLimit}
                  helperText={validationErrors.monthlyTokenLimit}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="日次トークン上限"
                  name="dailyTokenLimit"
                  type="number"
                  value={plan.dailyTokenLimit === null ? '' : plan.dailyTokenLimit}
                  onChange={handleChange}
                  fullWidth
                  InputProps={{
                    endAdornment: <InputAdornment position="end">トークン</InputAdornment>,
                  }}
                  error={!!validationErrors.dailyTokenLimit}
                  helperText={validationErrors.dailyTokenLimit || '空白の場合は制限なし'}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="同時接続数上限"
                  name="concurrentRequestLimit"
                  type="number"
                  value={plan.concurrentRequestLimit}
                  onChange={handleChange}
                  fullWidth
                  required
                  error={!!validationErrors.concurrentRequestLimit}
                  helperText={validationErrors.concurrentRequestLimit}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={plan.isActive}
                      onChange={handleChange}
                      name="isActive"
                      color="primary"
                    />
                  }
                  label="プランを有効にする"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider textAlign="left">
                  <Chip label="詳細設定" />
                </Divider>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="説明"
                  name="description"
                  value={plan.description}
                  onChange={handleChange}
                  fullWidth
                  multiline
                  rows={2}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box display="flex" justifyContent="flex-end" mt={2}>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => navigate('/plans')}
                    startIcon={<CancelIcon />}
                    sx={{ mr: 1 }}
                    disabled={saving}
                  >
                    キャンセル
                  </Button>
                  
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        保存中...
                      </>
                    ) : (
                      isNewPlan ? 'プランを作成' : '変更を保存'
                    )}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
};

export default PlanDetail;