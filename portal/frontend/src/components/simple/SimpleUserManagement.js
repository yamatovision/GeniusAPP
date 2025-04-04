import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { 
  getSimpleOrganizationUsers, 
  addSimpleOrganizationUser, 
  removeSimpleOrganizationUser, 
  updateSimpleUserRole,
  updateSimpleUser,
  getSimpleUser
} from '../../services/simple/simpleUser.service';
import { 
  getSimpleOrganization 
} from '../../services/simple/simpleOrganization.service';
import {
  getSimpleOrganizationApiKeys
} from '../../services/simple/simpleApiKey.service';
import { isLoggedIn, getCurrentUser } from '../../services/simple/simpleAuth.service';
import './SimpleUserManagement.css';

const SimpleUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingUser, setAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'User',
    apiKeyId: ''
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
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
        setCurrentUser(userData.data.user);
        
        // 権限チェック (SuperAdminとAdminのみアクセス可能)
        if (userData.data.user.role !== 'SuperAdmin' && userData.data.user.role !== 'Admin') {
          navigate('/simple/dashboard');
          return;
        }
      } catch (err) {
        console.error('ユーザー情報取得エラー:', err);
        setError('ユーザー情報の取得に失敗しました');
      }
    };
    
    checkAuth();
    fetchData();
  }, [id, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 組織情報を取得
      const orgResponse = await getSimpleOrganization(id);
      
      if (!orgResponse.success) {
        throw new Error(orgResponse.message || '組織データの取得に失敗しました');
      }
      
      // APIから返される構造は {organization, apiKeys, members} を含む
      console.log('組織データ応答:', orgResponse);
      setOrganization(orgResponse.data.organization || orgResponse.data);
      
      // ユーザー一覧を取得
      const usersResponse = await getSimpleOrganizationUsers(id);
      
      if (!usersResponse.success) {
        throw new Error(usersResponse.message || 'ユーザー一覧の取得に失敗しました');
      }
      
      setUsers(usersResponse.data || []);
      
      // APIキー一覧を取得
      const apiKeysResponse = await getSimpleOrganizationApiKeys(id);
      
      if (!apiKeysResponse.success) {
        console.warn('APIキー一覧の取得に失敗しました:', apiKeysResponse.message);
        setApiKeys([]);
      } else {
        setApiKeys(apiKeysResponse.data || []);
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
      setError('データの取得に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setError('名前、メールアドレス、パスワードは必須です');
      return false;
    }
    
    if (newUser.password.length < 8) {
      setError('パスワードは8文字以上である必要があります');
      return false;
    }
    
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(newUser.email)) {
      setError('有効なメールアドレスを入力してください');
      return false;
    }
    
    return true;
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await addSimpleOrganizationUser(
        id, 
        newUser.name, 
        newUser.email, 
        newUser.password, 
        newUser.role,
        newUser.apiKeyId ? newUser.apiKeyId : null  // APIキーIDがあれば送信
      );
      
      if (!response.success) {
        throw new Error(response.message || 'ユーザーの追加に失敗しました');
      }
      
      // 成功したらフォームをリセットして一覧を更新
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'User',
        apiKeyId: ''
      });
      setAddingUser(false);
      fetchData();
    } catch (err) {
      console.error('ユーザー追加エラー:', err);
      setError('ユーザーの追加に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      setLoading(true);
      
      const response = await updateSimpleUserRole(id, userId, newRole);
      
      if (!response.success) {
        throw new Error(response.message || 'ユーザーの役割更新に失敗しました');
      }
      
      // 成功したら一覧を更新
      fetchData();
    } catch (err) {
      console.error('役割更新エラー:', err);
      setError('ユーザーの役割更新に失敗しました: ' + (err.message || '不明なエラー'));
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setLoading(true);
      
      const response = await removeSimpleOrganizationUser(id, userToDelete._id);
      
      if (!response.success) {
        throw new Error(response.message || 'ユーザーの削除に失敗しました');
      }
      
      // 成功したらモーダルを閉じて一覧を更新
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchData();
    } catch (err) {
      console.error('ユーザー削除エラー:', err);
      setError('ユーザーの削除に失敗しました: ' + (err.message || '不明なエラー'));
      setShowDeleteModal(false);
      setUserToDelete(null);
      setLoading(false);
    }
  };

  const openDeleteModal = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };
  
  const openEditMode = (user) => {
    setUserToEdit({
      _id: user._id,
      name: user.name,
      email: user.email,
      password: '',
      showPasswordField: false,
      apiKeyId: user.apiKeyId || '',
    });
    setEditMode(true);
  };
  
  const handleEditUser = async (e) => {
    e.preventDefault();
    
    if (!userToEdit || !userToEdit.name || !userToEdit.email) {
      setError('名前とメールアドレスは必須です');
      return;
    }
    
    // パスワードフィールドを表示している場合、パスワードのバリデーション
    if (userToEdit.showPasswordField && userToEdit.password) {
      if (userToEdit.password.length < 8) {
        setError('パスワードは8文字以上である必要があります');
        return;
      }
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // パスワードが入力されている場合のみパスワードを更新
      const passwordToUpdate = userToEdit.showPasswordField && userToEdit.password ? userToEdit.password : null;
      
      const response = await updateSimpleUser(
        userToEdit._id,
        userToEdit.name,
        userToEdit.email,
        passwordToUpdate,
        userToEdit.apiKeyId || null  // APIキーIDがあれば送信
      );
      
      if (!response.success) {
        throw new Error(response.message || 'ユーザー情報の更新に失敗しました');
      }
      
      // 成功したら編集モードを閉じて一覧を更新
      setEditMode(false);
      setUserToEdit(null);
      fetchData();
    } catch (err) {
      console.error('ユーザー更新エラー:', err);
      setError('ユーザー情報の更新に失敗しました: ' + (err.message || '不明なエラー'));
      setLoading(false);
    }
  };

  // 現在のユーザーがSuperAdminかどうか
  const isSuperAdmin = currentUser && currentUser.role === 'SuperAdmin';

  if (loading && !organization) {
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
    <div className="simple-user-management-container">
      {organization && (
        <>
          <div className="simple-user-management-header">
            <div className="simple-user-management-title">
              <h1>{organization.name} - ユーザー管理</h1>
            </div>
            
            <div className="simple-user-management-actions">
              <Link 
                to={`/simple/organizations/${id}`} 
                className="simple-button secondary"
              >
                組織詳細に戻る
              </Link>
            </div>
          </div>
          
          {error && (
            <div className="simple-error-message">{error}</div>
          )}
          
          <div className="simple-user-section">
            <div className="simple-section-header">
              <h2>ユーザー一覧</h2>
              <button 
                className="simple-button small primary"
                onClick={() => setAddingUser(!addingUser)}
              >
                {addingUser ? 'キャンセル' : 'ユーザーを追加'}
              </button>
            </div>
            
            {addingUser && (
              <div className="simple-user-form">
                <form onSubmit={handleAddUser}>
                  <div className="simple-form-row">
                    <div className="simple-form-group">
                      <label htmlFor="name">名前</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={newUser.name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    
                    <div className="simple-form-group">
                      <label htmlFor="email">メールアドレス</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={newUser.email}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="simple-form-row">
                    <div className="simple-form-group">
                      <label htmlFor="password">パスワード (8文字以上)</label>
                      <input
                        type="password"
                        id="password"
                        name="password"
                        value={newUser.password}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    
                    <div className="simple-form-group">
                      <label htmlFor="role">役割</label>
                      <select
                        id="role"
                        name="role"
                        value={newUser.role}
                        onChange={handleInputChange}
                      >
                        <option value="User">ユーザー</option>
                        <option value="Admin">管理者</option>
                        {isSuperAdmin && (
                          <option value="SuperAdmin">スーパー管理者</option>
                        )}
                      </select>
                    </div>
                  </div>
                  
                  <div className="simple-form-row">
                    <div className="simple-form-group">
                      <label htmlFor="apiKeyId">APIキー</label>
                      <select
                        id="apiKeyId"
                        name="apiKeyId"
                        value={newUser.apiKeyId}
                        onChange={handleInputChange}
                      >
                        <option value="">選択なし</option>
                        {apiKeys.map(apiKey => (
                          <option key={apiKey.id} value={apiKey.id}>
                            {`APIキー ID: ${apiKey.id.substring(0, 6)}...`}
                          </option>
                        ))}
                      </select>
                      <small className="form-text text-muted">
                        ユーザーに割り当てるAPIキーを選択してください
                      </small>
                    </div>
                  </div>
                  
                  <div className="simple-form-actions">
                    <button 
                      type="button" 
                      className="simple-button secondary"
                      onClick={() => setAddingUser(false)}
                    >
                      キャンセル
                    </button>
                    <button 
                      type="submit" 
                      className="simple-button primary"
                      disabled={loading}
                    >
                      {loading ? '処理中...' : 'ユーザーを追加'}
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            {users.length === 0 ? (
              <div className="simple-empty-state">
                <p>ユーザーが見つかりません</p>
                {!addingUser && (
                  <button 
                    className="simple-button secondary"
                    onClick={() => setAddingUser(true)}
                  >
                    ユーザーを追加する
                  </button>
                )}
              </div>
            ) : (
              <div className="simple-user-list">
                <table className="simple-table">
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>メールアドレス</th>
                      <th>役割</th>
                      <th>APIキー</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user._id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          {user._id === currentUser?.id ? (
                            <span className="simple-role-tag">{
                              user.role === 'SuperAdmin' ? 'スーパー管理者' : 
                              user.role === 'Admin' ? '管理者' : 'ユーザー'
                            }</span>
                          ) : (
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user._id, e.target.value)}
                              disabled={!isSuperAdmin && user.role === 'SuperAdmin'}
                            >
                              <option value="User">ユーザー</option>
                              <option value="Admin">管理者</option>
                              {isSuperAdmin && (
                                <option value="SuperAdmin">スーパー管理者</option>
                              )}
                            </select>
                          )}
                        </td>
                        <td>
                          {user.apiKeyId ? (
                            <span className="simple-api-key">
                              {user.apiKeyId.substring(0, 6)}...
                              <span className="simple-tooltip">
                                APIキーID: {user.apiKeyId}
                              </span>
                            </span>
                          ) : (
                            <span className="simple-api-key-missing">未設定</span>
                          )}
                        </td>
                        <td className="user-actions">
                          <div className="button-group">
                            <button 
                              className="simple-button small secondary"
                              onClick={() => openEditMode(user)}
                            >
                              編集
                            </button>
                            {user._id !== currentUser?.id && (
                              <button 
                                className="simple-button small danger"
                                onClick={() => openDeleteModal(user)}
                              >
                                削除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {editMode && userToEdit && (
            <div className="edit-user-form">
              <h3>ユーザー情報編集</h3>
              <form onSubmit={handleEditUser}>
                <div className="simple-form-row">
                  <div className="simple-form-group">
                    <label htmlFor="edit-name">名前</label>
                    <input
                      type="text"
                      id="edit-name"
                      value={userToEdit.name}
                      onChange={(e) => setUserToEdit({...userToEdit, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="simple-form-group">
                    <label htmlFor="edit-email">メールアドレス</label>
                    <input
                      type="email"
                      id="edit-email"
                      value={userToEdit.email}
                      onChange={(e) => setUserToEdit({...userToEdit, email: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="simple-form-row password-toggle-container">
                  <div className="simple-form-checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={userToEdit.showPasswordField}
                        onChange={() => setUserToEdit({
                          ...userToEdit, 
                          showPasswordField: !userToEdit.showPasswordField,
                          password: ''
                        })}
                      />
                      パスワードを変更する
                    </label>
                  </div>
                </div>
                
                {userToEdit.showPasswordField && (
                  <div className="simple-form-row">
                    <div className="simple-form-group">
                      <label htmlFor="edit-password">新しいパスワード (8文字以上)</label>
                      <input
                        type="password"
                        id="edit-password"
                        value={userToEdit.password}
                        onChange={(e) => setUserToEdit({...userToEdit, password: e.target.value})}
                        minLength="8"
                      />
                    </div>
                  </div>
                )}
                
                <div className="simple-form-row">
                  <div className="simple-form-group">
                    <label htmlFor="edit-apiKeyId">APIキー</label>
                    <select
                      id="edit-apiKeyId"
                      value={userToEdit?.apiKeyId || ''}
                      onChange={(e) => setUserToEdit({...userToEdit, apiKeyId: e.target.value})}
                    >
                      <option value="">選択なし</option>
                      {apiKeys.map(apiKey => (
                        <option key={apiKey.id} value={apiKey.id}>
                          {`APIキー ID: ${apiKey.id.substring(0, 6)}...`}
                        </option>
                      ))}
                    </select>
                    <small className="form-text text-muted">
                      ユーザーに割り当てるAPIキーを選択してください
                    </small>
                  </div>
                </div>
                
                <div className="simple-form-actions">
                  <button 
                    type="button" 
                    className="simple-button secondary"
                    onClick={() => {
                      setEditMode(false);
                      setUserToEdit(null);
                    }}
                  >
                    キャンセル
                  </button>
                  <button 
                    type="submit" 
                    className="simple-button primary"
                    disabled={loading}
                  >
                    {loading ? '保存中...' : '保存する'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {showDeleteModal && userToDelete && (
            <div className="simple-modal-overlay">
              <div className="simple-modal">
                <h2>ユーザーを削除</h2>
                <p>本当に「{userToDelete.name}」を削除しますか？</p>
                <div className="simple-modal-actions">
                  <button 
                    className="simple-button secondary"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setUserToDelete(null);
                    }}
                    disabled={loading}
                  >
                    キャンセル
                  </button>
                  <button 
                    className="simple-button danger"
                    onClick={handleDeleteUser}
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

export default SimpleUserManagement;