import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  Space, 
  InputNumber, 
  Select, 
  Alert, 
  Spin,
  message
} from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import organizationService from '../../services/organization.service';
import userService from '../../services/user.service';
import './OrganizationForm.css';

const { Option } = Select;

/**
 * 組織フォームコンポーネント
 * 組織の新規作成および編集機能を提供
 */
const OrganizationForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [initialValues, setInitialValues] = useState({
    name: '',
    description: '',
    adminUserId: '',
    status: 'active'
  });

  const isEditMode = !!id;

  // ユーザー一覧を取得
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await userService.getUsers();
      setUsers(response.data || []);
    } catch (error) {
      console.error('ユーザー一覧取得エラー:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 編集モードの場合は組織情報を取得
  const fetchOrganizationDetail = async () => {
    if (!isEditMode) return;
    
    try {
      setLoading(true);
      const data = await organizationService.getOrganizationById(id);
      
      setInitialValues({
        name: data.name,
        description: data.description || '',
        adminUserId: data.adminId?._id || data.adminId,
        status: data.status
      });
      
      form.setFieldsValue({
        name: data.name,
        description: data.description || '',
        adminUserId: data.adminId?._id || data.adminId,
        status: data.status
      });
    } catch (error) {
      console.error('組織詳細取得エラー:', error);
      setSubmitError('組織情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時にデータを取得
  useEffect(() => {
    fetchUsers();
    fetchOrganizationDetail();
  }, [id]);

  // フォーム送信ハンドラ
  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      setSubmitError('');
      
      // 送信データの準備
      const submitData = { ...values };
      
      // 管理者設定方法に基づいてデータ整形
      if (values.adminMethod === 'existing') {
        // 既存ユーザーから選択した場合
        delete submitData.adminEmail;
        delete submitData.adminName;
        
        // 管理者ユーザーIDが選択されているか確認
        if (!submitData.adminUserId) {
          throw new Error('管理者ユーザーを選択してください');
        }
      } else if (values.adminMethod === 'email') {
        // メールアドレスで招待する場合
        delete submitData.adminUserId;
        
        // 管理者メールと名前が入力されているか確認
        if (!submitData.adminEmail) {
          throw new Error('管理者メールアドレスを入力してください');
        }
        if (!submitData.adminName) {
          throw new Error('管理者名を入力してください');
        }
      } else {
        // 管理者設定方法が選択されていない場合
        throw new Error('管理者設定方法を選択してください');
      }
      
      // デフォルトワークスペースは自動的にバックエンドで作成されるので、
      // フロント側では特に何もしない
      
      // 管理者設定方法自体は不要なので削除
      delete submitData.adminMethod;
      
      if (isEditMode) {
        // Admin APIキーはSystemConfigで一元管理するため不要
        
        await organizationService.updateOrganization(id, submitData);
        navigate(`/organizations/${id}`);
      } else {
        const result = await organizationService.createOrganization(submitData);
        
        // 新規ユーザーが作成された場合の通知
        if (result.admin && result.admin.isNewUser) {
          message.success(`新規管理者ユーザー (${result.admin.email}) が作成され、招待メールが送信されました`);
        }
        
        navigate(`/organizations/${result.organization._id}`);
      }
    } catch (error) {
      console.error('組織保存エラー:', error);
      
      // エラーメッセージの改善
      let errorMessage = error.response?.data?.error || error.message || '組織情報の保存に失敗しました';
      
      // 特定のエラーメッセージをより明確にする
      if (errorMessage.includes('管理者ユーザーID') || errorMessage.includes('管理者メール')) {
        errorMessage = '組織を作成するには、既存の管理者ユーザーを選択するか、新規管理者のメールアドレスと名前を入力してください';
      }
      
      setSubmitError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="organization-form-container">
      <Card
        title={isEditMode ? '組織情報の編集' : '新規組織作成'}
        extra={
          <Space>
            <Button 
              onClick={() => isEditMode ? navigate(`/organizations/${id}`) : navigate('/organizations')}
              icon={<CloseOutlined />}
            >
              キャンセル
            </Button>
            <Button 
              type="primary" 
              onClick={() => form.submit()} 
              icon={<SaveOutlined />}
              loading={loading}
            >
              保存
            </Button>
          </Space>
        }
      >
        {submitError && (
          <Alert 
            message="エラー" 
            description={submitError} 
            type="error" 
            showIcon 
            closable 
            style={{ marginBottom: '16px' }}
          />
        )}
        
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            initialValues={initialValues}
            onFinish={handleSubmit}
          >
            <Form.Item
              name="name"
              label="組織名"
              rules={[{ required: true, message: '組織名を入力してください' }]}
            >
              <Input placeholder="組織名を入力" />
            </Form.Item>
            
            <Form.Item
              name="description"
              label="説明"
            >
              <Input.TextArea placeholder="組織の説明" rows={3} />
            </Form.Item>
            
            <Form.Item
              name="adminMethod"
              label="管理者設定方法"
              initialValue="existing"
            >
              <Select>
                <Option value="existing">既存ユーザーから選択</Option>
                <Option value="email">メールアドレスで招待</Option>
              </Select>
            </Form.Item>
            
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => 
                prevValues.adminMethod !== currentValues.adminMethod
              }
            >
              {({ getFieldValue }) => 
                getFieldValue('adminMethod') === 'existing' ? (
                  <Form.Item
                    name="adminUserId"
                    label="管理者ユーザー"
                    rules={[
                      { 
                        required: true, 
                        message: '管理者ユーザーを選択してください' 
                      }
                    ]}
                  >
                    <Select
                      placeholder="管理者ユーザーを選択"
                      loading={loadingUsers}
                      showSearch
                      optionFilterProp="children"
                    >
                      {users.map(user => (
                        <Option key={user._id} value={user._id}>
                          {user.username || user.email}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                ) : (
                  <>
                    <Form.Item
                      name="adminEmail"
                      label="管理者メールアドレス"
                      rules={[
                        { 
                          required: true, 
                          message: '管理者メールアドレスを入力してください' 
                        },
                        {
                          type: 'email',
                          message: '有効なメールアドレスを入力してください'
                        }
                      ]}
                    >
                      <Input placeholder="例: admin@example.com" />
                    </Form.Item>
                    
                    <Form.Item
                      name="adminName"
                      label="管理者名（新規ユーザーの場合）"
                      tooltip="メールアドレスが新規ユーザーの場合に使用されます"
                      rules={[
                        { 
                          required: true, 
                          message: '管理者名を入力してください' 
                        }
                      ]}
                    >
                      <Input placeholder="例: 山田太郎" />
                    </Form.Item>
                  </>
                )
              }
            </Form.Item>
            
            
                        
            {isEditMode && (
              <Form.Item
                name="status"
                label="ステータス"
                rules={[{ required: true, message: 'ステータスを選択してください' }]}
              >
                <Select placeholder="ステータスを選択">
                  <Option value="active">有効</Option>
                  <Option value="suspended">停止中</Option>
                  <Option value="pending">保留中</Option>
                </Select>
              </Form.Item>
            )}
            
            {/* Admin APIキーはSystemConfigで一元管理するため削除 */}
            
            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button 
                  onClick={() => isEditMode ? navigate(`/organizations/${id}`) : navigate('/organizations')}
                >
                  キャンセル
                </Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {isEditMode ? '更新' : '作成'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default OrganizationForm;