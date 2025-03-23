import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Card, 
  Button, 
  Table, 
  Space, 
  Upload, 
  message, 
  Modal, 
  Form, 
  Input, 
  Tag, 
  Tabs,
  Typography,
  Tooltip,
  Badge,
  Divider
} from 'antd';
import { 
  UploadOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  KeyOutlined, 
  UserOutlined, 
  ExclamationCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';
import apiKeyService from '../../services/apiKey.service';
import organizationService from '../../services/organization.service';
import './ApiKeyPoolManagement.css';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { confirm } = Modal;

/**
 * APIキープール管理コンポーネント
 * 組織のAPIキープールの管理と、ユーザーへの割り当てを行う
 */
const ApiKeyPoolManagement = () => {
  const { id } = useParams();
  const [apiKeys, setApiKeys] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [assignForm] = Form.useForm();
  const [addForm] = Form.useForm();
  const [selectedTab, setSelectedTab] = useState('1');
  
  // APIキープールと組織情報を取得
  const fetchApiKeyPool = async () => {
    setLoading(true);
    try {
      const poolData = await apiKeyService.getApiKeyPool(id);
      if (poolData && poolData.availableApiKeys) {
        setApiKeys(poolData.availableApiKeys.map(key => ({
          ...key,
          key: key.keyId
        })));
      } else {
        setApiKeys([]);
      }
      
      // 組織情報を取得
      const orgData = await organizationService.getOrganizationById(id);
      setOrganization(orgData);
    } catch (error) {
      console.error('APIキープール取得エラー:', error);
      message.error('APIキー情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  // 組織メンバー情報を取得
  const fetchOrgMembers = async () => {
    setUserLoading(true);
    try {
      const usageData = await apiKeyService.getUsersApiKeyUsage(id);
      if (usageData && usageData.members) {
        setUsers(usageData.members.map(user => ({
          ...user,
          key: user.userId
        })));
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('ユーザー情報取得エラー:', error);
      message.error('ユーザー情報の取得に失敗しました');
    } finally {
      setUserLoading(false);
    }
  };
  
  // コンポーネントマウント時にデータ取得
  useEffect(() => {
    if (id) {
      fetchApiKeyPool();
      fetchOrgMembers();
    }
  }, [id]);
  
  // 新規APIキー追加
  const handleAddApiKey = async (values) => {
    try {
      await apiKeyService.addApiKeyToPool(id, {
        keyId: values.keyId,
        apiKey: values.apiKey,
        name: values.name,
        description: values.description || ''
      });
      
      message.success('APIキーがプールに追加されました');
      setAddModalVisible(false);
      addForm.resetFields();
      fetchApiKeyPool();
    } catch (error) {
      console.error('APIキー追加エラー:', error);
      message.error('APIキーの追加に失敗しました: ' + (error.response?.data?.error || error.message));
    }
  };
  
  // CSVファイルアップロード処理
  const handleCsvUpload = async (file) => {
    try {
      const result = await apiKeyService.importApiKeysFromCSV(id, file);
      
      if (result.imported > 0) {
        message.success(`${result.imported}個のAPIキーを正常にインポートしました`);
        if (result.errors > 0) {
          message.warning(`${result.errors}個のAPIキーはインポートできませんでした`);
        }
        fetchApiKeyPool();
      } else {
        message.error('インポートできるAPIキーはありませんでした');
      }
    } catch (error) {
      console.error('CSVインポートエラー:', error);
      message.error('CSVのインポートに失敗しました');
    }
    
    return false; // アップロードコンポーネントの自動アップロードを防止
  };
  
  // APIキー削除確認ダイアログ
  const confirmDeleteApiKey = (keyId) => {
    confirm({
      title: 'APIキーを削除しますか？',
      icon: <ExclamationCircleOutlined />,
      content: 'このAPIキーをプールから削除します。この操作は取り消せません。',
      okText: '削除',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: async () => {
        try {
          await apiKeyService.removeApiKeyFromPool(id, keyId);
          message.success('APIキーがプールから削除されました');
          fetchApiKeyPool();
        } catch (error) {
          console.error('APIキー削除エラー:', error);
          message.error('APIキーの削除に失敗しました');
        }
      }
    });
  };
  
  // ユーザーへのAPIキー割り当て処理
  const handleAssignKeys = async () => {
    const values = await assignForm.validateFields();
    
    if (!selectedUserIds || selectedUserIds.length === 0) {
      message.error('ユーザーを選択してください');
      return;
    }
    
    try {
      // 選択された各ユーザーに対して割り当て情報を作成
      const assignments = selectedUserIds.map(userId => ({
        userId,
        keyId: values.specificKey === 'auto' ? null : values.keyId
      }));
      
      const result = await apiKeyService.bulkAssignApiKeys(id, assignments);
      
      if (result.assigned > 0) {
        message.success(`${result.assigned}人のユーザーにAPIキーを割り当てました`);
        if (result.failed > 0) {
          message.warning(`${result.failed}人のユーザーへの割り当てに失敗しました`);
        }
        setAssignModalVisible(false);
        assignForm.resetFields();
        setSelectedUserIds([]);
        fetchApiKeyPool();
        fetchOrgMembers();
      } else {
        message.error('APIキーの割り当てに失敗しました');
      }
    } catch (error) {
      console.error('APIキー割り当てエラー:', error);
      message.error('APIキーの割り当てに失敗しました: ' + (error.response?.data?.error || error.message));
    }
  };
  
  // APIキー再割り当て確認ダイアログ
  const confirmReassignKey = (userId, userName) => {
    confirm({
      title: 'APIキーを再割り当てしますか？',
      icon: <ExclamationCircleOutlined />,
      content: `${userName}さんに新しいAPIキーを割り当てます。現在のキーは無効になります。`,
      okText: '再割り当て',
      okType: 'primary',
      cancelText: 'キャンセル',
      onOk: async () => {
        try {
          await apiKeyService.reassignUserApiKey(id, userId);
          message.success('APIキーが再割り当てされました');
          fetchOrgMembers();
          fetchApiKeyPool();
        } catch (error) {
          console.error('APIキー再割り当てエラー:', error);
          message.error('APIキーの再割り当てに失敗しました');
        }
      }
    });
  };
  
  // APIキー状態更新確認ダイアログ
  const confirmUpdateKeyStatus = (userId, userName, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const statusText = newStatus === 'active' ? '有効化' : '無効化';
    
    confirm({
      title: `APIキーを${statusText}しますか？`,
      icon: <ExclamationCircleOutlined />,
      content: `${userName}さんのAPIキーを${statusText}します。`,
      okText: statusText,
      okType: newStatus === 'active' ? 'primary' : 'danger',
      cancelText: 'キャンセル',
      onOk: async () => {
        try {
          await apiKeyService.updateUserApiKeyStatus(id, userId, { status: newStatus });
          message.success(`APIキーが${statusText}されました`);
          fetchOrgMembers();
        } catch (error) {
          console.error('APIキー状態更新エラー:', error);
          message.error(`APIキーの${statusText}に失敗しました`);
        }
      }
    });
  };
  
  // ユーザー一覧テーブルの列定義
  const userColumns = [
    {
      title: 'ユーザー名',
      dataIndex: 'name',
      key: 'name',
      render: (name) => name || '名前なし',
    },
    {
      title: 'メールアドレス',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '役割',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        switch (role) {
          case 'admin':
            return <Tag color="blue">管理者</Tag>;
          case 'member':
            return <Tag color="green">メンバー</Tag>;
          default:
            return <Tag>{role}</Tag>;
        }
      },
    },
    {
      title: 'APIキー状態',
      key: 'apiKeyStatus',
      render: (_, record) => {
        if (!record.apiKey) {
          return <Tag color="orange">未割り当て</Tag>;
        }
        
        switch (record.apiKey.status) {
          case 'active':
            return <Tag color="green">有効</Tag>;
          case 'disabled':
            return <Tag color="red">無効</Tag>;
          case 'revoked':
            return <Tag color="volcano">失効</Tag>;
          default:
            return <Tag>{record.apiKey.status}</Tag>;
        }
      },
    },
    {
      title: 'キーID',
      key: 'keyId',
      render: (_, record) => record.apiKey?.keyId || '-',
    },
    {
      title: '最終使用日',
      key: 'lastUsed',
      render: (_, record) => 
        record.apiKey?.lastUsed 
          ? new Date(record.apiKey.lastUsed).toLocaleString() 
          : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          {record.apiKey ? (
            <>
              <Button
                size="small"
                type={record.apiKey.status === 'active' ? 'danger' : 'primary'}
                onClick={() => confirmUpdateKeyStatus(
                  record.userId, 
                  record.name, 
                  record.apiKey.status
                )}
              >
                {record.apiKey.status === 'active' ? '無効化' : '有効化'}
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={() => confirmReassignKey(record.userId, record.name)}
              >
                再割り当て
              </Button>
            </>
          ) : (
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setSelectedUserIds([record.userId]);
                setAssignModalVisible(true);
              }}
            >
              割り当て
            </Button>
          )}
        </Space>
      ),
    },
  ];
  
  // APIキープールテーブルの列定義
  const keyColumns = [
    {
      title: 'キー名',
      dataIndex: 'name',
      key: 'name',
      render: (name) => name || '名前なし',
    },
    {
      title: 'キーID',
      dataIndex: 'keyId',
      key: 'keyId',
    },
    {
      title: '説明',
      dataIndex: 'description',
      key: 'description',
      render: (description) => description || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            onClick={() => {
              setAssignModalVisible(true);
              assignForm.setFieldsValue({
                specificKey: 'specific',
                keyId: record.keyId
              });
            }}
          >
            ユーザーに割り当て
          </Button>
          <Button
            type="danger"
            size="small"
            onClick={() => confirmDeleteApiKey(record.keyId)}
          >
            削除
          </Button>
        </Space>
      ),
    },
  ];
  
  // アップロードコンポーネントのカスタムリクエスト関数
  const customRequest = ({ file, onSuccess }) => {
    handleCsvUpload(file).then(() => {
      onSuccess();
    }).catch((error) => {
      console.error('アップロードエラー:', error);
    });
  };
  
  // ユーザーテーブルの行選択設定
  const rowSelection = {
    selectedRowKeys: selectedUserIds,
    onChange: (selectedRowKeys) => {
      setSelectedUserIds(selectedRowKeys);
    },
  };
  
  // 特定のキーかランダム割り当てかの選択によるフォーム表示切替
  const onSpecificKeyChange = (e) => {
    assignForm.setFieldsValue({
      keyId: e === 'specific' ? '' : undefined,
    });
  };
  
  // タブ切替ハンドラ
  const handleTabChange = (key) => {
    setSelectedTab(key);
  };
  
  return (
    <div className="api-key-pool-container">
      <Card
        title={
          <Space>
            <KeyOutlined />
            <span>APIキープール管理 ({organization?.name})</span>
            {organization && (
              <Badge 
                count={apiKeys.length} 
                style={{ backgroundColor: '#52c41a' }} 
                title={`利用可能なAPIキー: ${apiKeys.length}個`}
              />
            )}
          </Space>
        }
        extra={
          <Space>
            <Button 
              icon={<SyncOutlined />} 
              onClick={() => {
                fetchApiKeyPool();
                fetchOrgMembers();
              }}
            >
              更新
            </Button>
            <Upload
              accept=".csv"
              showUploadList={false}
              customRequest={customRequest}
              beforeUpload={(file) => {
                const isCsv = file.type === 'text/csv' || file.name.endsWith('.csv');
                if (!isCsv) {
                  message.error('CSVファイルのみアップロード可能です');
                }
                return isCsv;
              }}
            >
              <Button icon={<UploadOutlined />}>CSVインポート</Button>
            </Upload>
            <Button 
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              新規APIキー
            </Button>
          </Space>
        }
      >
        <Paragraph>
          APIキープールから組織メンバーにキーを割り当てて、ClaudeCodeでの使用を開始できるようにします。
          <br />
          APIキーはAnthropicコンソールで生成したものを登録、またはCSV形式で一括インポートできます。
        </Paragraph>
        
        <Tabs activeKey={selectedTab} onChange={handleTabChange}>
          <TabPane 
            tab={
              <span>
                <KeyOutlined />
                APIキープール ({apiKeys.length})
              </span>
            } 
            key="1"
          >
            <Table
              columns={keyColumns}
              dataSource={apiKeys}
              rowKey="keyId"
              loading={loading}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
              }}
              locale={{ emptyText: 'APIキーがありません' }}
            />
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <UserOutlined />
                ユーザー割当状況 ({users.length})
              </span>
            }
            key="2"
          >
            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                disabled={selectedUserIds.length === 0}
                onClick={() => setAssignModalVisible(true)}
              >
                選択ユーザーに割り当て ({selectedUserIds.length})
              </Button>
            </Space>
            
            <Table
              rowSelection={rowSelection}
              columns={userColumns}
              dataSource={users}
              rowKey="userId"
              loading={userLoading}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
              }}
              locale={{ emptyText: 'ユーザーがいません' }}
            />
          </TabPane>
        </Tabs>
      </Card>
      
      {/* 新規APIキー追加モーダル */}
      <Modal
        title="新規APIキーの追加"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddApiKey}
        >
          <Form.Item
            name="name"
            label="キー名"
            rules={[{ required: true, message: 'キー名を入力してください' }]}
          >
            <Input placeholder="このキーの識別名（例: Development Key 1）" />
          </Form.Item>
          
          <Form.Item
            name="keyId"
            label="キーID"
            rules={[{ required: true, message: 'キーIDを入力してください' }]}
            extra="AnthropicコンソールでのAPIキーのID（例: sk_ant_xxx...のハッシュ部分）"
          >
            <Input placeholder="APIキーのID" />
          </Form.Item>
          
          <Form.Item
            name="apiKey"
            label="APIキー（秘密鍵）"
            rules={[{ required: true, message: 'APIキーを入力してください' }]}
            extra="Anthropicで発行された完全なAPIキー。暗号化して保存されます。"
          >
            <Input.Password placeholder="sk_ant_..." />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="説明"
          >
            <Input.TextArea placeholder="このキーの用途などの説明" rows={2} />
          </Form.Item>
          
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setAddModalVisible(false)}>
                キャンセル
              </Button>
              <Button type="primary" htmlType="submit">
                追加
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* APIキー割り当てモーダル */}
      <Modal
        title={`APIキーの割り当て (${selectedUserIds.length}人のユーザー)`}
        open={assignModalVisible}
        onCancel={() => {
          setAssignModalVisible(false);
          assignForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={handleAssignKeys}
          initialValues={{ specificKey: 'auto' }}
        >
          <Form.Item
            name="specificKey"
            label="割り当て方法"
            rules={[{ required: true }]}
          >
            <Input.Group>
              <div className="assignment-radio-group">
                <Button
                  type={assignForm.getFieldValue('specificKey') === 'auto' ? 'primary' : 'default'}
                  onClick={() => {
                    assignForm.setFieldsValue({ specificKey: 'auto' });
                    onSpecificKeyChange('auto');
                  }}
                  style={{ marginRight: 8 }}
                >
                  自動割り当て
                </Button>
                <Button
                  type={assignForm.getFieldValue('specificKey') === 'specific' ? 'primary' : 'default'}
                  onClick={() => {
                    assignForm.setFieldsValue({ specificKey: 'specific' });
                    onSpecificKeyChange('specific');
                  }}
                >
                  特定のキーを使用
                </Button>
              </div>
            </Input.Group>
          </Form.Item>
          
          {assignForm.getFieldValue('specificKey') === 'specific' && (
            <Form.Item
              name="keyId"
              label="APIキーID"
              rules={[{ required: true, message: 'APIキーIDを選択してください' }]}
            >
              <Input placeholder="APIキーIDを入力" />
            </Form.Item>
          )}
          
          <div className="selected-users-summary">
            <Text strong>選択されたユーザー: {selectedUserIds.length}人</Text>
            <Paragraph>
              {selectedUserIds.length > 0 ? (
                <>
                  {users
                    .filter(user => selectedUserIds.includes(user.userId))
                    .map(user => user.name || user.email)
                    .slice(0, 5)
                    .join(', ')}
                  {selectedUserIds.length > 5 && ` ...他 ${selectedUserIds.length - 5}人`}
                </>
              ) : (
                'ユーザーが選択されていません'
              )}
            </Paragraph>
          </div>
          
          <Divider />
          
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setAssignModalVisible(false);
                assignForm.resetFields();
              }}>
                キャンセル
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                disabled={selectedUserIds.length === 0}
              >
                割り当て
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApiKeyPoolManagement;