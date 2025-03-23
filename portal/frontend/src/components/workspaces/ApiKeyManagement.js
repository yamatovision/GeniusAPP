import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Table,
  Tag,
  Input,
  Modal,
  Form,
  message,
  Spin,
  Alert,
  Tooltip,
  Typography
} from 'antd';
import {
  ArrowLeftOutlined,
  KeyOutlined,
  SyncOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import workspaceService from '../../services/workspace.service';
import './ApiKeyManagement.css';

const { Text, Paragraph } = Typography;
const { confirm } = Modal;

/**
 * APIキー管理コンポーネント
 * ワークスペースのAPIキー管理機能を提供
 */
const ApiKeyManagement = () => {
  const { organizationId, workspaceId } = useParams();
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [newKeyVisible, setNewKeyVisible] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [workspace, setWorkspace] = useState(null);

  // ワークスペース情報を取得
  const fetchWorkspaceInfo = async () => {
    try {
      const data = await workspaceService.getWorkspaceById(workspaceId);
      setWorkspace(data);
    } catch (error) {
      console.error('ワークスペース情報取得エラー:', error);
      message.error('ワークスペース情報の取得に失敗しました');
    }
  };

  // APIキー情報を取得
  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const data = await workspaceService.getWorkspaceApiKey(workspaceId);
      if (data && data.keys) {
        setApiKeys(data.keys.map(key => ({
          ...key,
          key: key._id || key.id
        })));
      } else {
        setApiKeys([]);
      }
    } catch (error) {
      console.error('APIキー情報取得エラー:', error);
      message.error('APIキー情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時にAPIキー情報を取得
  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceInfo();
      fetchApiKeys();
    }
  }, [workspaceId]);

  // 新規APIキー生成処理
  const handleCreateApiKey = async (values) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/apikey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(values)
      });
      
      if (!response.ok) {
        throw new Error('APIキーの生成に失敗しました');
      }
      
      const data = await response.json();
      setNewKey(data.key);
      setNewKeyVisible(true);
      
      message.success('新しいAPIキーが生成されました');
      setCreateModalVisible(false);
      createForm.resetFields();
      
      // キー一覧を再取得（ただし新しいシークレットは含まれない）
      fetchApiKeys();
    } catch (error) {
      console.error('APIキー生成エラー:', error);
      message.error('APIキーの生成に失敗しました: ' + (error.response?.data?.error || error.message));
    }
  };

  // APIキー無効化確認ダイアログ
  const confirmRevokeKey = (keyId) => {
    confirm({
      title: 'APIキーを無効化しますか？',
      icon: <ExclamationCircleOutlined />,
      content: 'この操作は取り消せません。現在このキーを使用しているアプリケーションは動作しなくなります。',
      okText: '無効化',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: async () => {
        try {
          await fetch(`/api/workspaces/${workspaceId}/apikey/${keyId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            }
          });
          
          message.success('APIキーが無効化されました');
          fetchApiKeys(); // 一覧を再取得
        } catch (error) {
          console.error('APIキー無効化エラー:', error);
          message.error('APIキーの無効化に失敗しました');
        }
      },
    });
  };

  // キーの可視性切り替え
  const toggleKeyVisibility = () => {
    setNewKeyVisible(!newKeyVisible);
  };

  // APIキーをクリップボードにコピー
  const copyKeyToClipboard = () => {
    navigator.clipboard.writeText(newKey).then(
      () => {
        message.success('APIキーをクリップボードにコピーしました');
      },
      (err) => {
        console.error('コピーに失敗しました:', err);
        message.error('APIキーのコピーに失敗しました');
      }
    );
  };

  // テーブルのカラム定義
  const columns = [
    {
      title: 'キー名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '作成日',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '前回使用日',
      dataIndex: 'lastUsed',
      key: 'lastUsed',
      render: (date) => date ? new Date(date).toLocaleString() : '未使用',
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        switch (status) {
          case 'active':
            return <Tag color="green">有効</Tag>;
          case 'revoked':
            return <Tag color="red">無効</Tag>;
          default:
            return <Tag color="blue">{status}</Tag>;
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          {record.status === 'active' && (
            <Button 
              type="text" 
              danger 
              onClick={() => confirmRevokeKey(record._id || record.id)}
            >
              無効化
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="apikey-management-container">
      <Card
        title={
          <Space>
            <Link to={`/organizations/${organizationId}/workspaces/${workspaceId}`}>
              <Button type="text" icon={<ArrowLeftOutlined />}>ワークスペースに戻る</Button>
            </Link>
            <span>APIキー管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={fetchApiKeys}
            >
              更新
            </Button>
            <Button
              type="primary"
              icon={<KeyOutlined />}
              onClick={() => setCreateModalVisible(true)}
              disabled={workspace?.isArchived}
            >
              新規APIキー
            </Button>
          </Space>
        }
      >
        <Alert
          message="APIキーは秘密情報です"
          description="APIキーはシークレット情報です。生成時に一度だけ表示されるため、安全な場所に保管してください。キーが漏洩した場合は直ちに無効化し、新しいキーを生成してください。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        {newKey && (
          <div className="new-key-alert">
            <Alert
              message="新しいAPIキーが生成されました"
              description={
                <div>
                  <p>このキーは現在のみ表示されます。必ず安全な場所に保存してください。</p>
                  <div className="key-display">
                    <Input.Password
                      value={newKey}
                      readOnly
                      visibilityToggle={{ visible: newKeyVisible, onVisibleChange: toggleKeyVisibility }}
                      addonAfter={
                        <Tooltip title="コピー">
                          <Button type="text" icon={<CopyOutlined />} onClick={copyKeyToClipboard} />
                        </Tooltip>
                      }
                    />
                    <Button
                      type="text"
                      icon={newKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={toggleKeyVisibility}
                    >
                      {newKeyVisible ? '隠す' : '表示'}
                    </Button>
                  </div>
                </div>
              }
              type="success"
              showIcon
              closable
              onClose={() => setNewKey('')}
            />
          </div>
        )}
        
        <Table
          columns={columns}
          dataSource={apiKeys}
          rowKey="key"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
          }}
          locale={{ emptyText: 'APIキーがありません' }}
        />
      </Card>

      {/* 新規APIキー作成モーダル */}
      <Modal
        title="新規APIキー作成"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateApiKey}
        >
          <Form.Item
            name="name"
            label="APIキー名"
            rules={[{ required: true, message: 'APIキー名を入力してください' }]}
          >
            <Input placeholder="このキーの用途（例: プロダクション用、開発用など）" />
          </Form.Item>
          
          <Paragraph type="secondary">
            <ul>
              <li>生成したAPIキーは一度だけ表示されます</li>
              <li>キーの使用には毎月の予算制限が適用されます</li>
              <li>不要になったキーは速やかに無効化してください</li>
            </ul>
          </Paragraph>
          
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateModalVisible(false)}>
                キャンセル
              </Button>
              <Button type="primary" htmlType="submit">
                キーを生成
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApiKeyManagement;