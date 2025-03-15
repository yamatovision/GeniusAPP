import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Form, Button, Alert, Spinner, Tab, Tabs, Badge, Row, Col } from 'react-bootstrap';
import { FaUser, FaEnvelope, FaKey, FaShieldAlt, FaHistory, FaCheck, FaTimes, FaSave, FaArrowLeft } from 'react-icons/fa';
import userService from '../../services/user.service';
import './UserDetail.css';

/**
 * ユーザー詳細・編集コンポーネント
 * ユーザーの詳細表示と編集機能を提供
 */
const UserDetail = () => {
  // URLパラメータからユーザーIDを取得
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewUser = id === 'new';
  
  // ステート
  const [user, setUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    isActive: true
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(!isNewUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [validationErrors, setValidationErrors] = useState({});
  
  // 初期データの読み込み
  useEffect(() => {
    const fetchCurrentUserRole = async () => {
      try {
        const currentUser = await userService.getCurrentUser();
        setCurrentUserRole(currentUser.role);
      } catch (err) {
        console.error('現在のユーザー情報取得エラー:', err);
      }
    };
    
    fetchCurrentUserRole();
    
    if (!isNewUser) {
      fetchUserData();
    }
  }, [id, isNewUser]);
  
  // ユーザーデータの取得
  const fetchUserData = async () => {
    setLoading(true);
    try {
      const userData = await userService.getUserById(id);
      setUser(userData);
      setError(null);
    } catch (err) {
      setError('ユーザー情報の取得に失敗しました: ' + (err.message || '不明なエラー'));
      console.error('ユーザー詳細取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 入力フィールドの変更ハンドラ
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUser(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // バリデーションエラーをクリア
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: null
      }));
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
      if (isNewUser) {
        // 新規ユーザーの作成
        await userService.createUser(user);
        setSuccess('ユーザーが正常に作成されました');
        setTimeout(() => {
          navigate('/users');
        }, 2000);
      } else {
        // 既存ユーザーの更新
        const userData = { ...user };
        // パスワードが空の場合は送信しない
        if (!userData.password) {
          delete userData.password;
        }
        
        await userService.updateUser(id, userData);
        setSuccess('ユーザー情報が正常に更新されました');
        fetchUserData(); // 最新データを再取得
      }
    } catch (err) {
      if (err.errors) {
        // バリデーションエラーがサーバーから返された場合
        setValidationErrors(err.errors.reduce((acc, curr) => {
          // エラーメッセージからフィールド名を推測
          const field = curr.toLowerCase().includes('メールアドレス') ? 'email' :
                      curr.toLowerCase().includes('パスワード') ? 'password' :
                      curr.toLowerCase().includes('ユーザー名') ? 'name' : 'general';
          
          return { ...acc, [field]: curr };
        }, {}));
      } else {
        setError('ユーザー情報の保存に失敗しました: ' + (err.message || '不明なエラー'));
      }
      console.error('ユーザー保存エラー:', err);
    } finally {
      setSaving(false);
    }
  };
  
  // フォームバリデーション
  const validateForm = () => {
    const errors = {};
    
    if (!user.name.trim()) {
      errors.name = 'ユーザー名は必須です';
    }
    
    if (!user.email.trim()) {
      errors.email = 'メールアドレスは必須です';
    } else if (!/^[\w+-]+(\.[\w+-]+)*@[\w+-]+(\.[\w+-]+)*(\.[a-zA-Z]{2,})$/.test(user.email)) {
      errors.email = '有効なメールアドレスを入力してください';
    }
    
    if (isNewUser && !user.password) {
      errors.password = 'パスワードは必須です';
    } else if (user.password && user.password.length < 8) {
      errors.password = 'パスワードは8文字以上である必要があります';
    }
    
    if (user.password && user.password !== confirmPassword) {
      errors.confirmPassword = 'パスワードが一致しません';
    }
    
    return errors;
  };
  
  // 管理者かどうかを判定
  const isAdmin = currentUserRole === 'admin';
  
  // アクティブ状態のバッジを表示
  const renderStatusBadge = (isActive) => {
    return isActive 
      ? <Badge bg="success"><FaCheck /> 有効</Badge>
      : <Badge bg="secondary"><FaTimes /> 無効</Badge>;
  };
  
  // 役割のバッジを表示
  const renderRoleBadge = (role) => {
    return role === 'admin'
      ? <Badge bg="danger"><FaShieldAlt /> 管理者</Badge>
      : <Badge bg="primary"><FaUser /> 一般ユーザー</Badge>;
  };
  
  if (loading) {
    return (
      <div className="text-center my-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">読み込み中...</span>
        </Spinner>
      </div>
    );
  }
  
  return (
    <div className="user-detail-container p-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{isNewUser ? '新規ユーザー登録' : 'ユーザー詳細'}</h2>
        <Button variant="outline-secondary" as={Link} to="/users">
          <FaArrowLeft /> ユーザー一覧に戻る
        </Button>
      </div>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert variant="success" className="mb-4">
          {success}
        </Alert>
      )}
      
      <Card className="mb-4 user-detail-card">
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-4"
          >
            <Tab eventKey="general" title="基本情報">
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaUser className="me-2" />
                        ユーザー名
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="name"
                        value={user.name}
                        onChange={handleChange}
                        isInvalid={!!validationErrors.name}
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.name}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaEnvelope className="me-2" />
                        メールアドレス
                      </Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        value={user.email}
                        onChange={handleChange}
                        isInvalid={!!validationErrors.email}
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.email}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaKey className="me-2" />
                        {isNewUser ? 'パスワード' : '新しいパスワード'}
                        {!isNewUser && <small className="text-muted ms-2">（変更する場合のみ）</small>}
                      </Form.Label>
                      <Form.Control
                        type="password"
                        name="password"
                        value={user.password || ''}
                        onChange={handleChange}
                        isInvalid={!!validationErrors.password}
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.password}
                      </Form.Control.Feedback>
                      <Form.Text className="text-muted">
                        パスワードは8文字以上である必要があります
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaKey className="me-2" />
                        パスワード（確認）
                      </Form.Label>
                      <Form.Control
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        isInvalid={!!validationErrors.confirmPassword}
                      />
                      <Form.Control.Feedback type="invalid">
                        {validationErrors.confirmPassword}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
                
                {/* 管理者のみ表示する設定項目 */}
                {isAdmin && (
                  <>
                    <hr />
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaShieldAlt className="me-2" />
                            役割
                          </Form.Label>
                          <Form.Select
                            name="role"
                            value={user.role}
                            onChange={handleChange}
                          >
                            <option value="user">一般ユーザー</option>
                            <option value="admin">管理者</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>ステータス</Form.Label>
                          <div>
                            <Form.Check
                              type="switch"
                              id="user-active-switch"
                              label={user.isActive ? '有効' : '無効'}
                              name="isActive"
                              checked={user.isActive}
                              onChange={handleChange}
                            />
                          </div>
                        </Form.Group>
                      </Col>
                    </Row>
                  </>
                )}
                
                <div className="d-flex justify-content-end mt-4">
                  <Button
                    variant="secondary"
                    className="me-2"
                    as={Link}
                    to="/users"
                    disabled={saving}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        保存中...
                      </>
                    ) : (
                      <>
                        <FaSave className="me-2" />
                        {isNewUser ? 'ユーザーを作成' : '変更を保存'}
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Tab>
            
            {!isNewUser && (
              <Tab eventKey="info" title="詳細情報">
                <div className="user-info-panel">
                  <Row>
                    <Col md={6}>
                      <div className="info-group">
                        <h5>基本情報</h5>
                        <dl className="row">
                          <dt className="col-sm-4">ユーザーID：</dt>
                          <dd className="col-sm-8"><code>{user._id}</code></dd>
                          
                          <dt className="col-sm-4">ユーザー名：</dt>
                          <dd className="col-sm-8">{user.name}</dd>
                          
                          <dt className="col-sm-4">メールアドレス：</dt>
                          <dd className="col-sm-8">{user.email}</dd>
                          
                          <dt className="col-sm-4">役割：</dt>
                          <dd className="col-sm-8">{renderRoleBadge(user.role)}</dd>
                          
                          <dt className="col-sm-4">ステータス：</dt>
                          <dd className="col-sm-8">{renderStatusBadge(user.isActive)}</dd>
                        </dl>
                      </div>
                    </Col>
                    
                    <Col md={6}>
                      <div className="info-group">
                        <h5>システム情報</h5>
                        <dl className="row">
                          <dt className="col-sm-4">登録日：</dt>
                          <dd className="col-sm-8">
                            {user.createdAt 
                              ? new Date(user.createdAt).toLocaleString() 
                              : '情報なし'}
                          </dd>
                          
                          <dt className="col-sm-4">最終更新：</dt>
                          <dd className="col-sm-8">
                            {user.updatedAt 
                              ? new Date(user.updatedAt).toLocaleString() 
                              : '情報なし'}
                          </dd>
                          
                          <dt className="col-sm-4">最終ログイン：</dt>
                          <dd className="col-sm-8">
                            {user.lastLogin 
                              ? new Date(user.lastLogin).toLocaleString() 
                              : '未ログイン'}
                          </dd>
                        </dl>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Tab>
            )}
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
};

export default UserDetail;