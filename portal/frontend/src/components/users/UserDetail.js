import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Form, Button, Alert, Spinner, Tab, Tabs, Badge, Row, Col } from 'react-bootstrap';
import { FaUser, FaEnvelope, FaKey, FaShieldAlt, FaHistory, FaCheck, FaTimes, FaSave, FaArrowLeft, FaBan } from 'react-icons/fa';
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
    apiAccess: {
      enabled: true,
      accessLevel: 'basic'
    }
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(!isNewUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [validationErrors, setValidationErrors] = useState({});
  const [tokenUsage, setTokenUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  
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
      
      // 管理者の場合はトークン使用量も取得
      if (currentUserRole === 'admin' && !isNewUser) {
        await fetchTokenUsage();
      }
    } catch (err) {
      setError('ユーザー情報の取得に失敗しました: ' + (err.message || '不明なエラー'));
      console.error('ユーザー詳細取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // トークン使用量データの取得
  const fetchTokenUsage = async () => {
    if (isNewUser) return;
    
    setLoadingUsage(true);
    try {
      const data = await userService.getUserTokenUsage(id, 'month');
      setTokenUsage(data);
    } catch (err) {
      console.error('トークン使用量取得エラー:', err);
    } finally {
      setLoadingUsage(false);
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
  
  // ユーザーの状態表示（ロールベース）
  const renderStatusBadge = () => {
    switch (user.role) {
      case 'inactive':
      case 'unsubscribed':
        return <Badge bg="secondary"><FaTimes /> 無効</Badge>;
      case 'unpaid':
        return <Badge bg="warning"><FaCheck /> 有効（未払い）</Badge>;
      default:
        return <Badge bg="success"><FaCheck /> 有効</Badge>;
    }
  };
  
  // 役割のバッジを表示
  const renderRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <Badge bg="danger"><FaShieldAlt /> 管理者</Badge>;
      case 'unpaid':
        return <Badge bg="warning"><FaBan /> 未払いユーザー</Badge>;
      case 'inactive':
      case 'unsubscribed':
        return <Badge bg="secondary"><FaBan /> 退会済みユーザー</Badge>;
      default:
        return <Badge bg="primary"><FaUser /> 一般ユーザー</Badge>;
    }
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
                            <option value="unpaid">未払いユーザー</option>
                            <option value="unsubscribed">退会済みユーザー</option>
                          </Form.Select>
                          <Form.Text className="text-muted">
                            「未払いユーザー」はUIアクセスのみ可能、「退会済みユーザー」は全機能利用停止
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>アカウント状態</Form.Label>
                          <div className="mt-2">
                            {renderStatusBadge()}
                            <div className="small text-muted mt-1">
                              アカウント状態は役割設定で自動的に変更されます
                            </div>
                          </div>
                        </Form.Group>
                      </Col>
                    </Row>
                    
                    <hr />
                    <h5>API設定</h5>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>ClaudeCode API アクセス</Form.Label>
                          <div>
                            <Form.Check
                              type="switch"
                              id="user-api-access-switch"
                              label={user.apiAccess?.enabled ? 'API利用可能' : 'API利用不可'}
                              name="apiAccess.enabled"
                              checked={user.apiAccess?.enabled || false}
                              onChange={handleChange}
                            />
                          </div>
                          <Form.Text className="text-muted">
                            OFFにするとClaudeCode APIを利用できなくなります
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>APIアクセスレベル</Form.Label>
                          <Form.Select
                            name="apiAccess.accessLevel"
                            value={user.apiAccess?.accessLevel || 'basic'}
                            onChange={handleChange}
                            disabled={!user.apiAccess?.enabled}
                          >
                            <option value="basic">基本（basic）</option>
                            <option value="advanced">高度（advanced）</option>
                            <option value="full">フル（full）</option>
                          </Form.Select>
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
            
            <Tab eventKey="info" title="詳細情報" disabled={isNewUser}>
              <div className="user-info-panel">
                {!isNewUser && (
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
                          <dd className="col-sm-8">{renderStatusBadge()}</dd>
                          
                          <dt className="col-sm-4">API利用状態：</dt>
                          <dd className="col-sm-8">
                            {user.role === 'inactive' || user.role === 'unsubscribed' ? (
                              <span className="badge bg-secondary">利用停止中（ロールによる制限）</span>
                            ) : user.role === 'unpaid' ? (
                              <span className="badge bg-warning">利用不可（未払い）</span>
                            ) : user.apiAccess?.enabled ? (
                              <span className="badge bg-success">利用可能 ({user.apiAccess.accessLevel})</span>
                            ) : (
                              <span className="badge bg-danger">利用不可</span>
                            )}
                          </dd>
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
                )}
              </div>
            </Tab>
            
            <Tab eventKey="usage" title="使用量情報" disabled={isNewUser}>
              <div className="token-usage-panel p-3">
                {!isNewUser && (
                  loadingUsage ? (
                    <div className="text-center my-5">
                      <Spinner animation="border" role="status">
                        <span className="visually-hidden">読み込み中...</span>
                      </Spinner>
                    </div>
                  ) : tokenUsage ? (
                    <>
                      <h5 className="mb-4">トークン使用量サマリー（過去30日間）</h5>
                      
                      <Row>
                        <Col md={4}>
                          <Card className="mb-3">
                            <Card.Body>
                              <Card.Title>合計トークン</Card.Title>
                              <h3 className="text-primary">
                                {tokenUsage.overall?.totalTokens?.toLocaleString() || 0}
                              </h3>
                              <Card.Text className="text-muted">
                                入力: {tokenUsage.overall?.inputTokens?.toLocaleString() || 0}<br />
                                出力: {tokenUsage.overall?.outputTokens?.toLocaleString() || 0}
                              </Card.Text>
                            </Card.Body>
                          </Card>
                        </Col>
                        
                        <Col md={4}>
                          <Card className="mb-3">
                            <Card.Body>
                              <Card.Title>API使用量</Card.Title>
                              <h3 className="text-info">
                                {tokenUsage.bySource?.apiUsage?.totalTokens?.toLocaleString() || 0}
                              </h3>
                              <Card.Text className="text-muted">
                                入力: {tokenUsage.bySource?.apiUsage?.inputTokens?.toLocaleString() || 0}<br />
                                出力: {tokenUsage.bySource?.apiUsage?.outputTokens?.toLocaleString() || 0}
                              </Card.Text>
                            </Card.Body>
                          </Card>
                        </Col>
                        
                        <Col md={4}>
                          <Card className="mb-3">
                            <Card.Body>
                              <Card.Title>プロンプト使用量</Card.Title>
                              <h3 className="text-success">
                                {tokenUsage.bySource?.promptUsage?.totalTokens?.toLocaleString() || 0}
                              </h3>
                              <Card.Text className="text-muted">
                                入力: {tokenUsage.bySource?.promptUsage?.inputTokens?.toLocaleString() || 0}<br />
                                出力: {tokenUsage.bySource?.promptUsage?.outputTokens?.toLocaleString() || 0}
                              </Card.Text>
                            </Card.Body>
                          </Card>
                        </Col>
                      </Row>
                      
                      <h5 className="mb-3 mt-4">使用制限</h5>
                      <Row>
                        <Col md={6}>
                          <Card>
                            <Card.Body>
                              <Card.Title>月間使用量上限</Card.Title>
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <span>使用中: {tokenUsage.overall?.totalTokens?.toLocaleString() || 0}</span>
                                <span>上限: {tokenUsage.limits?.monthly?.toLocaleString() || '無制限'}</span>
                              </div>
                              
                              {tokenUsage.limits?.monthly && (
                                <div className="progress">
                                  <div 
                                    className={`progress-bar ${
                                      (tokenUsage.overall?.totalTokens / tokenUsage.limits.monthly) > 0.9 ? 'bg-danger' : 
                                      (tokenUsage.overall?.totalTokens / tokenUsage.limits.monthly) > 0.7 ? 'bg-warning' : 'bg-success'
                                    }`}
                                    role="progressbar" 
                                    style={{ width: `${Math.min(100, (tokenUsage.overall?.totalTokens / tokenUsage.limits.monthly) * 100)}%` }}
                                  >
                                    {Math.round((tokenUsage.overall?.totalTokens / tokenUsage.limits.monthly) * 100)}%
                                  </div>
                                </div>
                              )}
                              
                              <Card.Text className="text-muted mt-2">
                                次回リセット: {tokenUsage.limits?.nextReset ? new Date(tokenUsage.limits.nextReset).toLocaleDateString() : '情報なし'}
                              </Card.Text>
                            </Card.Body>
                          </Card>
                        </Col>
                        
                        <Col md={6}>
                          <Card>
                            <Card.Body>
                              <Card.Title>利用状況サマリー</Card.Title>
                              <dl className="row mb-0">
                                <dt className="col-sm-6">リクエスト数:</dt>
                                <dd className="col-sm-6">{tokenUsage.overall?.requests || 0}回</dd>
                                
                                <dt className="col-sm-6">平均応答時間:</dt>
                                <dd className="col-sm-6">
                                  {Math.round(tokenUsage.bySource?.promptUsage?.avgResponseTime || 0)}ms
                                </dd>
                                
                                <dt className="col-sm-6">成功率:</dt>
                                <dd className="col-sm-6">
                                  {Math.round(tokenUsage.bySource?.promptUsage?.successRate || 0)}%
                                </dd>
                              </dl>
                            </Card.Body>
                          </Card>
                        </Col>
                      </Row>
                      
                      <div className="d-flex justify-content-end mt-3">
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={fetchTokenUsage}
                          disabled={loadingUsage}
                        >
                          {loadingUsage ? '更新中...' : '使用量を更新'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Alert variant="info">
                      トークン使用量データがありません
                    </Alert>
                  )
                )}
              </div>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
};

export default UserDetail;