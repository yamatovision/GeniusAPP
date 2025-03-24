import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  CardActions, 
  Grid, 
  Button, 
  Skeleton,
  Chip,
  Divider,
  Alert
} from '@mui/material';
import { Link } from 'react-router-dom';
import { 
  Business as BusinessIcon,
  People as PeopleIcon,
  Add as AddIcon,
  Launch as LaunchIcon,
  Key as KeyIcon
} from '@mui/icons-material';
import { getSimpleOrganizations } from '../../services/simple/simpleOrganization.service';
import { getCurrentUser } from '../../services/simple/simpleAuth.service';

/**
 * 組織カード表示コンポーネント
 * シンプルダッシュボードの組織カード表示機能を標準ダッシュボードに統合
 * @param {Object} props
 * @param {Function} props.onSelectOrganization - 組織選択時のコールバック関数
 */
const OrganizationCards = ({ onSelectOrganization = () => {} }) => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 現在のユーザー情報を取得
    const fetchUserData = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData.data.user);
      } catch (err) {
        console.error('ユーザー情報取得エラー:', err);
        setError('ユーザー情報の取得に失敗しました');
      }
    };

    // 組織一覧を取得
    const fetchOrganizations = async () => {
      try {
        setLoading(true);
        const response = await getSimpleOrganizations();
        setOrganizations(response.data);
        setLoading(false);
      } catch (err) {
        console.error('組織一覧取得エラー:', err);
        setError('組織一覧の取得に失敗しました');
        setLoading(false);
      }
    };

    fetchUserData();
    fetchOrganizations();
  }, []);

  // ユーザーがSuperAdminまたはAdminの場合のみ新規組織作成ボタンを表示
  const canCreateOrganization = user && (user.role === 'SuperAdmin' || user.role === 'Admin');

  if (loading) {
    return (
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            組織一覧
          </Typography>
          <Skeleton variant="rectangular" width={120} height={36} />
        </Box>
        <Grid container spacing={2}>
          {[1, 2, 3].map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item}>
              <Skeleton variant="rectangular" height={200} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box mb={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          組織一覧
        </Typography>
        {canCreateOrganization && (
          <Button 
            variant="contained" 
            color="primary" 
            component={Link} 
            to="/simple/organizations/new"
            startIcon={<AddIcon />}
          >
            新規組織作成
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {organizations.length === 0 ? (
        <Card variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary" gutterBottom>
            組織が見つかりません
          </Typography>
          {canCreateOrganization && (
            <Button 
              variant="outlined" 
              color="primary" 
              component={Link} 
              to="/simple/organizations/new"
              startIcon={<AddIcon />}
              sx={{ mt: 1 }}
            >
              新規組織を作成する
            </Button>
          )}
        </Card>
      ) : (
        <Grid container spacing={2}>
          {organizations.map(org => (
            <Grid item xs={12} sm={6} md={4} key={org._id}>
              <Card 
                variant="outlined" 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {org.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {org.description || '説明なし'}
                  </Typography>
                  <Box mt={2}>
                    <Chip 
                      icon={<KeyIcon />} 
                      label={`APIキー: ${org.apiKeyIds?.length || 0}個`} 
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>ワークスペース:</strong> {org.workspaceName}
                    </Typography>
                  </Box>
                </CardContent>
                <Divider />
                <CardActions sx={{ p: 2, justifyContent: 'space-between' }}>
                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => onSelectOrganization(org._id)}
                  >
                    APIキー管理
                  </Button>
                  <Box>
                    {canCreateOrganization && (
                      <Button 
                        variant="outlined"
                        component={Link}
                        to={`/simple/organizations/${org._id}/users`}
                        size="small"
                        startIcon={<PeopleIcon />}
                        sx={{ mr: 1 }}
                      >
                        ユーザー
                      </Button>
                    )}
                    <Button 
                      variant="contained"
                      color="primary"
                      href={`https://console.anthropic.com/workspaces/new?name=${encodeURIComponent(org.workspaceName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      startIcon={<LaunchIcon />}
                      title="Claude管理画面でこの名前のワークスペースを作成"
                    >
                      作成
                    </Button>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default OrganizationCards;