import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  createSimpleOrganization, 
  getSimpleOrganization, 
  updateSimpleOrganization 
} from '../../services/simple/simpleOrganization.service';
import './SimpleOrganizationForm.css';

const SimpleOrganizationForm = () => {
  const [organization, setOrganization] = useState({
    name: '',
    description: '',
    workspaceName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formMode, setFormMode] = useState('create');
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    // 編集モードの場合は既存の組織データを取得
    if (id) {
      setFormMode('edit');
      fetchOrganization(id);
    }
  }, [id]);

  const fetchOrganization = async (organizationId) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await getSimpleOrganization(organizationId);
      
      if (response.success && response.data) {
        setOrganization({
          name: response.data.name || '',
          description: response.data.description || '',
          workspaceName: response.data.workspaceName || ''
        });
      } else {
        throw new Error(response.message || '組織データの取得に失敗しました');
      }
    } catch (err) {
      console.error('組織データ取得エラー:', err);
      setError('組織データの取得に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setOrganization(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!organization.name) {
      setError('組織名は必須です');
      return false;
    }
    
    if (!organization.workspaceName) {
      setError('ワークスペース名は必須です');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      let response;
      
      if (formMode === 'create') {
        response = await createSimpleOrganization(
          organization.name, 
          organization.description, 
          organization.workspaceName
        );
      } else {
        response = await updateSimpleOrganization(
          id,
          organization.name, 
          organization.description, 
          organization.workspaceName
        );
      }
      
      if (!response.success) {
        throw new Error(response.message || '操作に失敗しました');
      }
      
      console.log(`組織${formMode === 'create' ? '作成' : '更新'}成功:`, response);
      
      // 成功したらダッシュボードにリダイレクト
      navigate('/simple/dashboard');
    } catch (err) {
      console.error(`組織${formMode === 'create' ? '作成' : '更新'}エラー:`, err);
      setError(
        err.message || 
        `組織の${formMode === 'create' ? '作成' : '更新'}中にエラーが発生しました。後でもう一度お試しください。`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simple-organization-form-container">
      <div className="simple-organization-form-card">
        <div className="simple-organization-form-header">
          <h1>{formMode === 'create' ? '組織作成' : '組織編集'}</h1>
          <p>{formMode === 'create' ? '新しい組織を作成' : '組織情報を更新'}します</p>
        </div>
        
        {error && (
          <div className="simple-error-message">{error}</div>
        )}
        
        <form onSubmit={handleSubmit} className="simple-organization-form">
          <div className="simple-form-group">
            <label htmlFor="name">組織名</label>
            <input
              type="text"
              id="name"
              name="name"
              value={organization.name}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="組織名"
              required
            />
          </div>
          
          <div className="simple-form-group">
            <label htmlFor="description">説明 (任意)</label>
            <textarea
              id="description"
              name="description"
              value={organization.description}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="組織の説明"
              rows={3}
            />
          </div>
          
          <div className="simple-form-group">
            <label htmlFor="workspaceName">ワークスペース名</label>
            <input
              type="text"
              id="workspaceName"
              name="workspaceName"
              value={organization.workspaceName}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="ワークスペース名"
              required
            />
            <small className="simple-form-help">
              この組織の主要ワークスペースの名前を入力してください。<br />
              ※組織作成後、組織詳細ページまたはダッシュボードから簡単にワークスペースを作成できます。<br />
              ここで指定した名前がワークスペース作成時に自動的に入力されます。
            </small>
          </div>
          
          <div className="simple-form-actions">
            <Link to="/simple/dashboard" className="simple-button secondary">
              キャンセル
            </Link>
            <button 
              type="submit" 
              className="simple-button primary" 
              disabled={loading}
            >
              {loading ? '処理中...' : formMode === 'create' ? '組織を作成' : '組織を更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SimpleOrganizationForm;