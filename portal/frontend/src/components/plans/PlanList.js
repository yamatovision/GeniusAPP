import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Grid, 
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import planService from '../../services/plan.service';

/**
 * プラン一覧ページ
 * APIアクセスレベルとプラン設定の管理画面
 */
const PlanList = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [initializeDialogOpen, setInitializeDialogOpen] = useState(false);
  const [success, setSuccess] = useState(null);

  // プラン一覧の取得
  useEffect(() => {
    fetchPlans();
  }, []);

  // プラン一覧を取得
  const fetchPlans = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await planService.getAllPlans();
      setPlans(response.plans || []);
    } catch (error) {
      console.error('プラン一覧取得エラー:', error);
      setError('プランの読み込みに失敗しました。' + 
        (error.response?.data?.message || error.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // プラン削除ダイアログを開く
  const handleOpenDeleteDialog = (plan) => {
    setPlanToDelete(plan);
    setDeleteDialogOpen(true);
  };

  // プラン削除ダイアログを閉じる
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setPlanToDelete(null);
  };

  // プラン削除の実行
  const handleDeletePlan = async () => {
    if (!planToDelete) return;

    try {
      await planService.deletePlan(planToDelete._id);
      setSuccess(`プラン「${planToDelete.name}」を削除しました`);
      fetchPlans();
    } catch (error) {
      console.error('プラン削除エラー:', error);
      setError('プランの削除に失敗しました。' + 
        (error.response?.data?.message || error.message || '不明なエラー'));
    } finally {
      handleCloseDeleteDialog();
    }
  };

  // 初期化ダイアログを開く
  const handleOpenInitializeDialog = () => {
    setInitializeDialogOpen(true);
  };

  // 初期化ダイアログを閉じる
  const handleCloseInitializeDialog = () => {
    setInitializeDialogOpen(false);
  };

  // デフォルトプランの初期化
  const handleInitializeDefaultPlans = async (force = false) => {
    try {
      await planService.initializeDefaultPlans(force);
      setSuccess('デフォルトプランを初期化しました');
      fetchPlans();
    } catch (error) {
      console.error('デフォルトプラン初期化エラー:', error);
      setError('デフォルトプランの初期化に失敗しました。' + 
        (error.response?.data?.message || error.message || '不明なエラー'));
    } finally {
      handleCloseInitializeDialog();
    }
  };

  // 成功メッセージをクリア
  const clearSuccess = () => {
    setSuccess(null);
  };

  // エラーメッセージをクリア
  const clearError = () => {
    setError(null);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          APIアクセスプラン管理
        </Typography>
        <Box>
          <Button 
            variant="outlined" 
            color="primary" 
            startIcon={<RefreshIcon />} 
            onClick={fetchPlans}
            sx={{ mr: 1 }}
          >
            更新
          </Button>
          <Button 
            variant="outlined" 
            color="secondary" 
            startIcon={<RefreshIcon />} 
            onClick={handleOpenInitializeDialog}
            sx={{ mr: 1 }}
          >
            デフォルト初期化
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            component={Link} 
            to="/plans/new" 
            startIcon={<AddIcon />}
          >
            新規プラン作成
          </Button>
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={clearSuccess}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            登録済みプラン一覧
          </Typography>
          
          {loading ? (
            <Box display="flex" justifyContent="center" my={3}>
              <CircularProgress />
            </Box>
          ) : plans.length === 0 ? (
            <Alert severity="info">
              登録されたプランはありません。デフォルト初期化ボタンを押すか、新規プランを作成してください。
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>プラン名</TableCell>
                    <TableCell>アクセスレベル</TableCell>
                    <TableCell align="right">月間トークン上限</TableCell>
                    <TableCell align="right">日次トークン上限</TableCell>
                    <TableCell>状態</TableCell>
                    <TableCell align="center">操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan._id}>
                      <TableCell>
                        <Typography variant="body1">{plan.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {plan.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={plan.accessLevel}
                          color={
                            plan.accessLevel === 'basic' ? 'default' :
                            plan.accessLevel === 'advanced' ? 'primary' : 'secondary'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {plan.monthlyTokenLimit.toLocaleString()} トークン
                      </TableCell>
                      <TableCell align="right">
                        {plan.dailyTokenLimit 
                          ? `${plan.dailyTokenLimit.toLocaleString()} トークン`
                          : '制限なし'}
                      </TableCell>
                      <TableCell>
                        {plan.isActive ? (
                          <Chip 
                            icon={<CheckCircleIcon />} 
                            label="有効" 
                            color="success" 
                            size="small" 
                          />
                        ) : (
                          <Chip 
                            icon={<CancelIcon />} 
                            label="無効" 
                            color="error" 
                            size="small" 
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          component={Link} 
                          to={`/plans/${plan._id}`}
                          color="primary"
                          title="編集"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton 
                          color="error" 
                          onClick={() => handleOpenDeleteDialog(plan)}
                          title="削除"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* プラン削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>プラン削除の確認</DialogTitle>
        <DialogContent>
          <DialogContentText>
            プラン「{planToDelete?.name}」を削除してもよろしいですか？
            <br />
            このプランを利用しているユーザーがいる場合は削除できません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="primary">
            キャンセル
          </Button>
          <Button onClick={handleDeletePlan} color="error">
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* デフォルトプラン初期化確認ダイアログ */}
      <Dialog
        open={initializeDialogOpen}
        onClose={handleCloseInitializeDialog}
      >
        <DialogTitle>デフォルトプラン初期化の確認</DialogTitle>
        <DialogContent>
          <DialogContentText>
            デフォルトプランを初期化しますか？
            <br />
            すでにプランが存在する場合は、既存のプランを残したまま足りないプランのみ追加されます。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInitializeDialog} color="primary">
            キャンセル
          </Button>
          <Button onClick={() => handleInitializeDefaultPlans(false)} color="primary">
            足りないプランのみ追加
          </Button>
          <Button onClick={() => handleInitializeDefaultPlans(true)} color="error">
            すべて初期化
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PlanList;