import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { 
  getSimpleOrganization, 
  deleteSimpleOrganization,
  createSimpleWorkspace 
} from '../../services/simple/simpleOrganization.service';
import { 
  getSimpleOrganizationApiKeys, 
  createSimpleApiKey, 
  deleteSimpleApiKey 
} from '../../services/simple/simpleApiKey.service';
import { isLoggedIn, getCurrentUser } from '../../services/simple/simpleAuth.service';
import './SimpleOrganizationDetail.css';

const SimpleOrganizationDetail = () => {
  const [organization, setOrganization] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingKey, setAddingKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceCreated, setWorkspaceCreated] = useState(false);
  const [workspaceId, setWorkspaceId] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // ログイン状態と権限を確認
    const checkAuth = async () => {
      if (!isLoggedIn()) {
        navigate('/simple/login');
        return;
      }
      
      try {
        const userData = await getCurrentUser();
        setUserRole(userData.data.user.role);
      } catch (err) {
        console.error('ユーザー情報取得エラー:', err);
        setError('ユーザー情報の取得に失敗しました');
      }
    };
    
    checkAuth();
    fetchOrganizationData();
  }, [id, navigate]);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 組織情報を取得
      const orgResponse = await getSimpleOrganization(id);
      
      if (!orgResponse.success) {
        throw new Error(orgResponse.message || '組織データの取得に失敗しました');
      }
      
      setOrganization(orgResponse.data);
      
      // APIキー一覧を取得
      const keysResponse = await getSimpleOrganizationApiKeys(id);
      
      if (!keysResponse.success) {
        throw new Error(keysResponse.message || 'APIキー一覧の取得に失敗しました');
      }
      
      setApiKeys(keysResponse.data || []);
    } catch (err) {
      console.error('データ取得エラー:', err);
      setError('データの取得に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddApiKey = async () => {
    try {
      setAddingKey(true);
      setError(null);
      
      if (!newApiKey || newApiKey.trim() === '') {
        setError('APIキーを入力してください');
        return;
      }
      
      const response = await createSimpleApiKey(id, newApiKey);
      
      if (!response.success) {
        throw new Error(response.message || 'APIキーの追加に失敗しました');
      }
      
      // 成功したらフォームをリセットして一覧を更新
      setNewApiKey('');
      fetchOrganizationData();
    } catch (err) {
      console.error('APIキー追加エラー:', err);
      setError('APIキーの追加に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setAddingKey(false);
    }
  };

  const handleDeleteApiKey = async (apiKeyId) => {
    try {
      await deleteSimpleApiKey(id, apiKeyId);
      // 成功したら一覧を更新
      fetchOrganizationData();
    } catch (err) {
      console.error('APIキー削除エラー:', err);
      setError('APIキーの削除に失敗しました: ' + (err.message || '不明なエラー'));
    }
  };

  const handleDeleteOrganization = async () => {
    try {
      setLoading(true);
      
      const response = await deleteSimpleOrganization(id);
      
      if (!response.success) {
        throw new Error(response.message || '組織の削除に失敗しました');
      }
      
      // 成功したらダッシュボードに戻る
      navigate('/simple/dashboard');
    } catch (err) {
      console.error('組織削除エラー:', err);
      setError('組織の削除に失敗しました: ' + (err.message || '不明なエラー'));
      setShowDeleteModal(false);
      setLoading(false);
    }
  };
  
  // ワークスペース自動作成
  const handleCreateWorkspace = async () => {
    try {
      setCreatingWorkspace(true);
      setError(null);
      
      // APIを使用してワークスペースを作成
      const response = await createSimpleWorkspace(id);
      
      if (!response.success) {
        throw new Error(response.message || 'ワークスペースの作成に失敗しました');
      }
      
      // 成功したらワークスペース情報を設定
      setWorkspaceCreated(true);
      if (response.data && response.data.workspaceId) {
        setWorkspaceId(response.data.workspaceId);
      }
      
      // 組織データを再取得
      fetchOrganizationData();
      
    } catch (err) {
      console.error('ワークスペース作成エラー:', err);
      setError('ワークスペースの作成に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setCreatingWorkspace(false);
    }
  };

  // 権限チェック (SuperAdminとAdminのみ編集可能)
  const canEdit = userRole === 'SuperAdmin' || userRole === 'Admin';
  // SuperAdminのみ削除可能
  const canDelete = userRole === 'SuperAdmin';

  if (loading) {
    return (
      <div className="simple-loading-container">
        <div className="simple-loading">読み込み中...</div>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <div className="simple-error-container">
        <div className="simple-error-message">{error}</div>
        <Link to="/simple/dashboard" className="simple-button secondary">
          ダッシュボードに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="simple-organization-detail-container">
      {organization && (
        <>
          <div className="simple-organization-detail-header">
            <div className="simple-organization-detail-title">
              <h1>{organization.name}</h1>
              <p className="simple-organization-meta">
                ワークスペース: {organization.workspaceName}
              </p>
            </div>
            
            <div className="simple-organization-detail-actions">
              {canEdit && (
                <>
                  <Link 
                    to={`/simple/organizations/${id}/users`} 
                    className="simple-button primary"
                  >
                    ユーザー管理
                  </Link>
                  <Link 
                    to={`/simple/organizations/${id}/edit`} 
                    className="simple-button secondary"
                  >
                    編集
                  </Link>
                </>
              )}
              
              {canDelete && (
                <button 
                  className="simple-button danger"
                  onClick={() => setShowDeleteModal(true)}
                >
                  削除
                </button>
              )}
            </div>
          </div>
          
          {organization.description && (
            <div className="simple-organization-description">
              <h2>説明</h2>
              <p>{organization.description}</p>
            </div>
          )}
          
          <div className="simple-organization-workspace">
            <div className="simple-section-header">
              <h2>ワークスペース</h2>
            </div>
            <div className="simple-workspace-info">
              <p><b>ワークスペース名:</b> {organization.workspaceName}</p>
              
              {error && <div className="simple-error-message">{error}</div>}
              
              {workspaceCreated ? (
                <div className="simple-workspace-success">
                  <p>✅ ワークスペースが正常に作成されました！</p>
                  {workspaceId && (
                    <p><b>ワークスペースID:</b> {workspaceId}</p>
                  )}
                  <a 
                    href="https://console.anthropic.com/workspaces" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="simple-button secondary"
                  >
                    Claude管理画面でワークスペースを確認
                  </a>
                </div>
              ) : (
                <div className="simple-workspace-actions">
                  {apiKeys.length > 0 ? (
                    <button 
                      onClick={handleCreateWorkspace} 
                      className="simple-button primary"
                      disabled={creatingWorkspace}
                    >
                      {creatingWorkspace ? 'ワークスペース作成中...' : 'APIを使って自動作成'}
                    </button>
                  ) : (
                    <div className="simple-workspace-warning">
                      <p>⚠️ ワークスペースの自動作成にはAPIキーが必要です。先にAPIキーを追加してください。</p>
                    </div>
                  )}
                  
                  <p className="simple-workspace-separator">または</p>
                  
                  <a 
                    href={`https://console.anthropic.com/workspaces/new?name=${encodeURIComponent(organization.workspaceName)}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="simple-button secondary"
                  >
                    Claude管理画面で手動作成
                  </a>
                </div>
              )}
              
              <div className="simple-workspace-help">
                <p>※ 自動作成では、登録済みのAPIキーを使用してAnthropicにワークスペースを作成します。</p>
                <p>※ 手動作成では、Claude管理画面が開き、「{organization.workspaceName}」という名前がすでに入力された状態でワークスペースを作成できます。</p>
                <p>※ 手動作成には、Claude管理画面でのログイン・認証が必要です。</p>
              </div>
            </div>
          </div>
          
          <div className="simple-organization-api-keys">
            <div className="simple-section-header">
              <h2>APIキー</h2>
              {canEdit && (
                <button 
                  className="simple-button small primary"
                  onClick={() => setAddingKey(!addingKey)}
                >
                  {addingKey ? 'キャンセル' : 'APIキーを追加'}
                </button>
              )}
            </div>
            
            {error && (
              <div className="simple-error-message">{error}</div>
            )}
            
            {addingKey && (
              <div className="simple-api-key-form">
                <input
                  type="text"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="APIキーを入力"
                  disabled={loading}
                />
                <button 
                  className="simple-button primary"
                  onClick={handleAddApiKey}
                  disabled={loading}
                >
                  追加
                </button>
              </div>
            )}
            
            {apiKeys.length === 0 ? (
              <div className="simple-empty-state">
                <p>APIキーがありません</p>
                {canEdit && !addingKey && (
                  <button 
                    className="simple-button secondary"
                    onClick={() => setAddingKey(true)}
                  >
                    APIキーを追加する
                  </button>
                )}
              </div>
            ) : (
              <div className="simple-api-key-list">
                {apiKeys.map(key => (
                  <div key={key._id} className="simple-api-key-item">
                    <div className="simple-api-key-info">
                      <p className="simple-api-key-value">
                        {key.keyValue.substring(0, 8)}...{key.keyValue.substring(key.keyValue.length - 4)}
                      </p>
                      <p className="simple-api-key-date">
                        追加日: {new Date(key.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    {canEdit && (
                      <button 
                        className="simple-button small danger"
                        onClick={() => handleDeleteApiKey(key._id)}
                      >
                        削除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="simple-organization-detail-footer">
            <Link to="/simple/dashboard" className="simple-button secondary">
              ダッシュボードに戻る
            </Link>
          </div>
          
          {showDeleteModal && (
            <div className="simple-modal-overlay">
              <div className="simple-modal">
                <h2>組織を削除</h2>
                <p>この操作は取り消せません。本当に「{organization.name}」を削除しますか？</p>
                <div className="simple-modal-actions">
                  <button 
                    className="simple-button secondary"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={loading}
                  >
                    キャンセル
                  </button>
                  <button 
                    className="simple-button danger"
                    onClick={handleDeleteOrganization}
                    disabled={loading}
                  >
                    {loading ? '削除中...' : '削除する'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SimpleOrganizationDetail;