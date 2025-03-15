import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Card, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { FaUser, FaEnvelope, FaKey, FaShieldAlt, FaSave, FaTimes } from 'react-icons/fa';
import userService from '../../services/user.service';
import './UserForm.css';

/**
 * ユーザー作成・編集フォームコンポーネント
 * UserDetailと共通部分が多いですが、独立したフォームとして利用可能なコンポーネント
 */
const UserForm = ({ user: initialUser, onSuccess, isNewUser = true }) => {
  const navigate = useNavigate();
  
  // 初期値
  const defaultUser = {
    name: '',
    email: '',
    password: '',
    role: 'user',
    isActive: true
  };
  
  // ステート
  const [user, setUser] = useState(initialUser || defaultUser);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  
  // 管理者権限チェック
  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const currentUser = await userService.getCurrentUser();
        setIsAdmin(currentUser.role === 'admin');
      } catch (err) {
        console.error('ユーザー権限取得エラー:', err);
      }
    };
    
    checkAdminRole();
  }, []);
  
  // 初期値が変更された場合
  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
    }
  }, [initialUser]);
  
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
      let result;
      
      if (isNewUser) {
        // 新規ユーザーの作成
        result = await userService.createUser(user);
        setSuccess('ユーザーが正常に作成されました');
      } else {
        // 既存ユーザーの更新
        const userData = { ...user };
        // パスワードが空の場合は送信しない
        if (!userData.password) {
          delete userData.password;
        }
        
        result = await userService.updateUser(user._id, userData);
        setSuccess('ユーザー情報が正常に更新されました');
      }
      
      // 成功時のコールバック
      if (onSuccess) {
        onSuccess(result.user);
      }
      
      // 新規作成の場合は一覧に戻る
      if (isNewUser) {
        setTimeout(() => {
          navigate('/users');
        }, 1500);
      }
    } catch (err) {
      if (err.errors) {
        // バリデーションエラー
        setValidationErrors(err.errors.reduce((acc, curr) => {
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
  
  return (
    <Card className="user-form-card">
      <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
        {isNewUser ? 'ユーザー登録' : 'ユーザー編集'}
      </Card.Header>
      
      <Card.Body>
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
              variant="outline-secondary"
              className="me-2"
              onClick={() => navigate('/users')}
              disabled={saving}
            >
              <FaTimes className="me-2" />
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
      </Card.Body>
    </Card>
  );
};

export default UserForm;