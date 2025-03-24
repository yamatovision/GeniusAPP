import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  TextField, 
  Grid, 
  Alert, 
  CircularProgress,
  InputAdornment,
  Divider,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import { 
  Launch as LaunchIcon, 
  Check as CheckIcon,
  Warning as WarningIcon,
  WorkspacePremium as WorkspaceIcon
} from '@mui/icons-material';
import { createSimpleWorkspace, getSimpleOrganization } from '../../services/simple/simpleOrganization.service';

/**
 * ワークスペース管理コンポーネント
 * 組織のワークスペース作成・管理機能を提供
 * @param {Object} props
 * @param {string} props.organizationId - 組織ID
 * @param {Function} props.onWorkspaceUpdate - ワークスペースの更新時に呼び出されるコールバック
 */
const WorkspaceManager = ({ organizationId, onWorkspaceUpdate = () => {} }) => {
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');

  // 組織情報を取得
  useEffect(() => {
    if (organizationId) {
      fetchOrganizationData();
    }
  }, [organizationId]);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getSimpleOrganization(organizationId);
      
      if (!response.success) {
        throw new Error(response.message || '組織データの取得に失敗しました');
      }
      
      setOrganization(response.data);
      setWorkspaceName(response.data.workspaceName || '');
      
      // すでにワークスペースIDが設定されているか確認
      if (response.data.workspaceId) {
        setWorkspaceId(response.data.workspaceId);
      }
    } catch (err) {
      console.error('組織データ取得エラー:', err);
      setError('組織データの取得に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // APIを使用して自動的にワークスペースを作成
  const handleCreateWorkspace = async () => {
    try {
      if (!organizationId) {
        setError('組織IDが指定されていません');
        return;
      }
      
      setCreating(true);
      setError(null);
      setSuccess(null);
      
      const response = await createSimpleWorkspace(organizationId);
      
      if (!response.success) {
        throw new Error(response.message || 'ワークスペースの作成に失敗しました');
      }
      
      // 作成成功
      setSuccess('ワークスペースが正常に作成されました');
      
      // ワークスペースIDを保存
      if (response.data && response.data.workspaceId) {
        setWorkspaceId(response.data.workspaceId);
      }
      
      // 親コンポーネントに通知
      onWorkspaceUpdate();
      
      // 最新の組織データを再取得
      fetchOrganizationData();
    } catch (err) {
      console.error('ワークスペース作成エラー:', err);
      setError('ワークスペースの作成に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setCreating(false);
    }
  };

  // ローディング表示
  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  // 組織データが取得できない場合
  if (!organization) {
    return (
      <Alert severity="error">
        組織データを取得できませんでした。再度お試しください。
      </Alert>
    );
  }

  // ワークスペースが既に存在する場合
  const hasWorkspace = !!workspaceId;

  return (
    <Box mb={3}>
      <Paper elevation={1} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          <WorkspaceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          ワークスペース管理
        </Typography>
        <Divider sx={{ my: 2 }} />

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

        <Grid container spacing={3}>
          {/* ワークスペース情報カード */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  ワークスペース情報
                </Typography>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    ワークスペース名:
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 2 }}>
                    {workspaceName || '未設定'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    ワークスペースID:
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      {workspaceId ? workspaceId : '未作成'}
                    </Typography>
                    {workspaceId && (
                      <Chip 
                        icon={<CheckIcon />} 
                        label="接続済み" 
                        color="success" 
                        size="small" 
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* ワークスペース操作カード */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  ワークスペース操作
                </Typography>
                
                <Box sx={{ mt: 2 }}>
                  {hasWorkspace ? (
                    <>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        ワークスペースは既に作成されています。Anthropicコンソールで確認できます。
                      </Alert>
                      <Button
                        variant="contained"
                        color="primary"
                        href="https://console.anthropic.com/workspaces"
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<LaunchIcon />}
                        fullWidth
                      >
                        Anthropicコンソールを開く
                      </Button>
                    </>
                  ) : (
                    <>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          ワークスペースの作成方法を選択してください:
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          • 自動作成: APIキーを使用して自動的にワークスペースを作成します
                        </Typography>
                        <Typography variant="body2">
                          • 手動作成: Anthropicコンソールでワークスペースを作成します
                        </Typography>
                      </Alert>

                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={handleCreateWorkspace}
                            disabled={creating}
                            fullWidth
                          >
                            {creating ? (
                              <>
                                <CircularProgress size={20} sx={{ mr: 1 }} />
                                作成中...
                              </>
                            ) : (
                              '自動作成'
                            )}
                          </Button>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Button
                            variant="outlined"
                            color="primary"
                            href={`https://console.anthropic.com/workspaces/new?name=${encodeURIComponent(workspaceName)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            startIcon={<LaunchIcon />}
                            fullWidth
                          >
                            手動作成
                          </Button>
                        </Grid>
                      </Grid>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* APIキーの有無チェック */}
        {!hasWorkspace && organization.apiKeyIds?.length === 0 && (
          <Alert severity="warning" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <WarningIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              ワークスペースの自動作成にはAPIキーが必要です。先にAPIキーを追加してください。
            </Typography>
          </Alert>
        )}
        
        {/* 使用方法の説明 */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            ワークスペースについて
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ワークスペースはAnthropicのClaudeモデルを使用するための環境です。ワークスペースを作成すると、
            組織のメンバーがClaudeを利用できるようになります。
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default WorkspaceManager;