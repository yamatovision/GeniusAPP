import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  Table, 
  Button, 
  Card, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  Tooltip, 
  message,
  Progress,
  Switch
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UsergroupAddOutlined,
  BarChartOutlined,
  KeyOutlined,
  SyncOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import workspaceService from '../../services/workspace.service';
import './WorkspaceList.css';

/**
 * ワークスペース一覧コンポーネント
 * 組織内のワークスペース一覧表示と新規作成機能を提供
 */
const WorkspaceList = () => {
  const { organizationId } = useParams();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [includeArchived, setIncludeArchived] = useState(false);

  // ワークスペース一覧を取得
  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await workspaceService.getWorkspaces(organizationId, {
        includeArchived
      });
      setWorkspaces(data);
    } catch (error) {
      console.error('ワークスペース一覧取得エラー:', error);
      message.error('ワークスペース情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時にワークスペース一覧を取得
  useEffect(() => {
    if (organizationId) {
      fetchWorkspaces();
    }
  }, [organizationId, includeArchived]);

  // WebSocketイベントリスナーの設定
  useEffect(() => {
    // ワークスペース作成イベント
    const createUnsubscribe = workspaceService.subscribe('workspace_created', (data) => {
      if (data.organizationId === organizationId) {
        fetchWorkspaces();
      }
    });

    // ワークスペース更新イベント
    const updateUnsubscribe = workspaceService.subscribe('workspace_updated', (data) => {
      if (data.organizationId === organizationId) {
        fetchWorkspaces();
      }
    });

    // ワークスペース削除イベント
    const deleteUnsubscribe = workspaceService.subscribe('workspace_deleted', (data) => {
      if (data.organizationId === organizationId) {
        fetchWorkspaces();
      }
    });

    // クリーンアップ関数
    return () => {
      createUnsubscribe();
      updateUnsubscribe();
      deleteUnsubscribe();
    };
  }, [organizationId]);

  // 新規ワークスペース作成ハンドラ
  const handleCreateWorkspace = async (values) => {
    try {
      await workspaceService.createWorkspace(organizationId, values);
      message.success('ワークスペースが作成されました');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchWorkspaces(); // 一覧を再取得
    } catch (error) {
      console.error('ワークスペース作成エラー:', error);
      message.error('ワークスペースの作成に失敗しました: ' + (error.response?.data?.error || error.message));
    }
  };

  // ワークスペースアーカイブ確認モーダル
  const confirmArchive = (workspace) => {
    Modal.confirm({
      title: 'ワークスペースをアーカイブしますか？',
      content: `ワークスペース「${workspace.name}」をアーカイブします。この操作は取り消せません。`,
      okText: 'アーカイブ',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: async () => {
        try {
          await workspaceService.archiveWorkspace(workspace._id);
          message.success('ワークスペースがアーカイブされました');
          fetchWorkspaces(); // 一覧を再取得
        } catch (error) {
          console.error('ワークスペースアーカイブエラー:', error);
          message.error('ワークスペースのアーカイブに失敗しました');
        }
      },
    });
  };

  // ワークスペースのステータスに応じたタグを生成
  const getStatusTag = (status, isArchived) => {
    if (isArchived) {
      return <Tag color="gray">アーカイブ済み</Tag>;
    }

    switch (status) {
      case 'active':
        return <Tag color="green">有効</Tag>;
      case 'suspended':
        return <Tag color="red">停止中</Tag>;
      case 'pending':
        return <Tag color="orange">保留中</Tag>;
      default:
        return <Tag color="blue">{status}</Tag>;
    }
  };

  // テーブルのカラム定義
  const columns = [
    {
      title: 'ワークスペース名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Link to={`/organizations/${organizationId}/workspaces/${record._id}`}>{text}</Link>
      ),
    },
    {
      title: '説明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'メンバー数',
      dataIndex: 'members',
      key: 'members',
      render: (members) => members?.length || 0,
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => getStatusTag(status, record.isArchived),
    },
    {
      title: 'トークン使用量',
      dataIndex: 'usage',
      key: 'usage',
      render: (usage, record) => {
        if (!usage) return '-';
        
        const percentage = usage.budgetPercentage || 0;
        let color = 'green';
        if (percentage > 80) color = 'red';
        else if (percentage > 60) color = 'orange';
        
        return (
          <Tooltip title={`${usage.totalTokens.toLocaleString()} / ${(record.monthlyBudget || 0).toLocaleString()} トークン`}>
            <Progress percent={percentage} size="small" status={percentage >= 100 ? 'exception' : 'normal'} strokeColor={color} />
          </Tooltip>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Link to={`/organizations/${organizationId}/workspaces/${record._id}`}>
            <Button type="text" icon={<EditOutlined />} disabled={record.isArchived} />
          </Link>
          <Link to={`/organizations/${organizationId}/workspaces/${record._id}/members`}>
            <Button type="text" icon={<UsergroupAddOutlined />} disabled={record.isArchived} />
          </Link>
          <Link to={`/organizations/${organizationId}/workspaces/${record._id}/usage`}>
            <Button type="text" icon={<BarChartOutlined />} />
          </Link>
          <Link to={`/organizations/${organizationId}/workspaces/${record._id}/apikey`}>
            <Button type="text" icon={<KeyOutlined />} disabled={record.isArchived} />
          </Link>
          {!record.isArchived && (
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => confirmArchive(record)} 
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="workspace-list-container">
      <Card
        title={
          <Space>
            <Link to={`/organizations/${organizationId}`}>
              <Button type="text" icon={<ArrowLeftOutlined />}>組織に戻る</Button>
            </Link>
            <span>ワークスペース一覧</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={fetchWorkspaces}
            >
              更新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              新規ワークスペース
            </Button>
          </Space>
        }
      >
        <div className="table-options">
          <Space>
            <span>アーカイブ済みを表示: </span>
            <Switch 
              checked={includeArchived} 
              onChange={setIncludeArchived}
              size="small"
            />
          </Space>
        </div>
        
        <Table
          columns={columns}
          dataSource={workspaces}
          rowKey="_id"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
          }}
        />
      </Card>

      {/* 新規ワークスペース作成モーダル */}
      <Modal
        title="新規ワークスペース作成"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateWorkspace}
        >
          <Form.Item
            name="name"
            label="ワークスペース名"
            rules={[{ required: true, message: 'ワークスペース名を入力してください' }]}
          >
            <Input placeholder="ワークスペース名を入力" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="説明"
          >
            <Input.TextArea placeholder="ワークスペースの説明" rows={3} />
          </Form.Item>
          
          {/* 予算設定はAnthropicWebコンソールで行うため削除 */}
          
          <Form.Item
            name="syncWithAnthropic"
            label="Anthropicと同期"
            valuePropName="checked"
            initialValue={true}
            extra="Anthropic組織のワークスペースとして同期します"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateModalVisible(false)}>
                キャンセル
              </Button>
              <Button type="primary" htmlType="submit">
                作成
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkspaceList;