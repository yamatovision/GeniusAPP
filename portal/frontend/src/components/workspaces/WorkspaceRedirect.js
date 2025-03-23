import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Alert, Card } from 'antd';
import authService from '../../services/auth.service';

/**
 * ワークスペースリダイレクトコンポーネント
 * /workspaces/:id 形式のURLを /organizations/:organizationId/workspaces/:id に変換
 */
const WorkspaceRedirect = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const redirectToOrgContext = async () => {
      try {
        // ユーザー情報から最初の組織IDを取得
        const userData = await authService.getCurrentUser();
        
        if (userData && userData.user && userData.user.organizations && userData.user.organizations.length > 0) {
          // ユーザーの最初の組織へリダイレクト
          const organizationId = userData.user.organizations[0]._id || userData.user.organizations[0].id;
          navigate(`/organizations/${organizationId}/workspaces/${id}`, { replace: true });
        } else {
          // 組織が見つからない場合はエラー
          setError('リダイレクトに必要な組織情報が見つかりません。ダッシュボードから再度アクセスしてください。');
        }
      } catch (error) {
        console.error('リダイレクトエラー:', error);
        setError('リダイレクト処理中にエラーが発生しました。再度お試しください。');
      }
    };

    redirectToOrgContext();
  }, [id, navigate]);

  if (error) {
    return (
      <Card title="リダイレクトエラー" style={{ maxWidth: 600, margin: '100px auto' }}>
        <Alert
          message="ワークスペースへのアクセスエラー"
          description={error}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 100 }}>
      <Spin tip="ワークスペースページにリダイレクト中..." size="large" />
      <p style={{ marginTop: 20 }}>ワークスペース情報を読み込んでいます...</p>
    </div>
  );
};

export default WorkspaceRedirect;