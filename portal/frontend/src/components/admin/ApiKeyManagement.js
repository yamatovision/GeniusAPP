import React, { useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Input, 
  Modal, 
  Form, 
  Select, 
  Tag, 
  Space, 
  Tooltip, 
  Popconfirm, 
  message,
  Badge
} from 'antd';
import { 
  KeyOutlined, 
  EditOutlined, 
  StopOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SearchOutlined
} from '@ant-design/icons';
import adminService from '../../services/admin.service';
import './ApiKeyManagement.css';

const { Option } = Select;
const { confirm } = Modal;

/**
 * APIキー管理コンポーネント
 * APIキーの一覧表示と管理機能を提供
 */
const ApiKeyManagement = ({ apiKeys = [], onUpdate }) => {
  // 状態管理
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [filteredKeys, setFilteredKeys] = useState(apiKeys);

  // コンポーネントが更新されたときに検索フィルタを適用
  React.useEffect(() => {
    // apiKeysが配列であることを確認
    const validApiKeys = Array.isArray(apiKeys) ? apiKeys : [];
    setFilteredKeys(validApiKeys);
    handleSearch(searchText);
  }, [apiKeys]);

  // 検索処理
  const handleSearch = (value) => {
    setSearchText(value);
    // apiKeysが配列であることを確認
    if (!Array.isArray(apiKeys)) {
      setFilteredKeys([]);
      return;
    }
    
    const filtered = apiKeys.filter(key => 
      (key.name && key.name.toLowerCase().includes(value.toLowerCase())) ||
      (key.id && key.id.toLowerCase().includes(value.toLowerCase())) ||
      (key.description && key.description.toLowerCase().includes(value.toLowerCase())) ||
      (key.workspaceName && key.workspaceName.toLowerCase().includes(value.toLowerCase()))
    );
    setFilteredKeys(filtered);
  };

  // 編集モーダルを開く
  const handleEdit = (record) => {
    setSelectedKey(record);
    form.setFieldsValue({
      name: record.name,
      status: record.status,
      description: record.description || '',
    });
    setEditModalVisible(true);
  };

  // APIキー更新処理
  const handleUpdate = async (values) => {
    setLoading(true);
    try {
      await adminService.updateApiKeyStatus(selectedKey.id, values);
      message.success('APIキーが正常に更新されました');
      setEditModalVisible(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('APIキー更新エラー:', error);
      message.error('APIキーの更新に失敗しました: ' + (error.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // APIキー無効化の確認
  const showDeactivateConfirm = (record) => {
    confirm({
      title: 'APIキーを無効化しますか？',
      icon: <ExclamationCircleOutlined />,
      content: `APIキー "${record.name}" (${record.id.substring(0, 8)}...) を無効化します。この操作は取り消せません。`,
      okText: '無効化',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: async () => {
        setLoading(true);
        try {
          await adminService.updateApiKeyStatus(record.id, { status: 'inactive' });
          message.success('APIキーが無効化されました');
          if (onUpdate) onUpdate();
        } catch (error) {
          console.error('APIキー無効化エラー:', error);
          message.error('APIキーの無効化に失敗しました: ' + (error.message || '不明なエラー'));
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // テーブルカラム定義
  const columns = [
    {
      title: 'キー名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <span>
          <KeyOutlined style={{ marginRight: 8 }} />
          {text}
          {record.isDefault && (
            <Tag color="blue" style={{ marginLeft: 8 }}>デフォルト</Tag>
          )}
        </span>
      ),
    },
    {
      title: 'キーID',
      dataIndex: 'id',
      key: 'id',
      render: (text) => (
        <Tooltip title={text}>
          <code>{text.substring(0, 12)}...</code>
        </Tooltip>
      ),
    },
    {
      title: 'ワークスペース',
      dataIndex: 'workspaceName',
      key: 'workspaceName',
      render: (text) => text || '-',
    },
    {
      title: '作成日',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '最終使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (date) => date ? new Date(date).toLocaleDateString() : '未使用',
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        if (status === 'active') {
          return <Badge status="success" text="アクティブ" />;
        } else {
          return <Badge status="error" text="無効" />;
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            編集
          </Button>
          {record.status === 'active' && (
            <Button
              icon={<StopOutlined />}
              size="small"
              danger
              onClick={() => showDeactivateConfirm(record)}
            >
              無効化
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="api-key-management">
      {/* 検索 */}
      <div className="search-container">
        <Input
          placeholder="キー名、ID、説明で検索..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ width: 300, marginBottom: 16 }}
        />
      </div>

      {/* APIキーテーブル */}
      <Table
        dataSource={Array.isArray(filteredKeys) ? filteredKeys : []}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 編集モーダル */}
      <Modal
        title="APIキーの編集"
        visible={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            name="name"
            label="キー名"
            rules={[{ required: true, message: 'キー名を入力してください' }]}
          >
            <Input placeholder="キー名" />
          </Form.Item>

          <Form.Item
            name="description"
            label="説明"
          >
            <Input.TextArea placeholder="キーの説明（オプション）" rows={3} />
          </Form.Item>

          <Form.Item
            name="status"
            label="ステータス"
            rules={[{ required: true, message: 'ステータスを選択してください' }]}
          >
            <Select>
              <Option value="active">アクティブ</Option>
              <Option value="inactive">無効</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditModalVisible(false)}>
                キャンセル
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                更新
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApiKeyManagement;