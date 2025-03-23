import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Descriptions, 
  Button, 
  Space, 
  Tabs, 
  Table, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  message, 
  Skeleton,
  Popconfirm,
  Progress
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  SyncOutlined, 
  TeamOutlined, 
  BarChartOutlined,
  KeyOutlined,
  LeftOutlined
} from '@ant-design/icons';
import organizationService from '../../services/organization.service';
import workspaceService from '../../services/workspace.service';
import './OrganizationDetail.css';

const { TabPane } = Tabs;

/**
 * 組織詳細コンポーネント
 * 組織の詳細情報と関連するワークスペース一覧を表示
 */
const OrganizationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [createWorkspaceModalVisible, setCreateWorkspaceModalVisible] = useState(false);
  const [createWorkspaceForm] = Form.useForm();

  // 組織詳細を取得
  const fetchOrganizationDetail = async () => {
    try {
      setLoading(true);
      const data = await organizationService.getOrganizationById(id);
      setOrganization(data);
      
      // 編集フォームの初期値を設定
      editForm.setFieldsValue({
        name: data.name,
        description: data.description,
        monthlyBudget: data.monthlyBudget,
        maxUsers: data.maxUsers || 5,
        adminApiKey: '',  // セキュリティのため空にしておく
        status: data.status
      });
    } catch (error) {
      console.error('組織詳細取得エラー:', error);
      message.error('組織情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // ワークスペース一覧を取得
  const fetchWorkspaces = async () => {
    try {
      setWorkspacesLoading(true);
      const data = await workspaceService.getWorkspaces(id);
      setWorkspaces(data);
    } catch (error) {
      console.error('ワークスペース一覧取得エラー:', error);
      message.error('ワークスペース情報の取得に失敗しました');
    } finally {
      setWorkspacesLoading(false);
    }
  };

  // コンポーネントマウント時にデータを取得
  useEffect(() => {
    fetchOrganizationDetail();
    fetchWorkspaces();
  }, [id]);

  // 組織情報更新ハンドラ
  const handleUpdateOrganization = async (values) => {
    try {
      // APIキーが入力されていない場合は除外
      if (!values.adminApiKey) {
        delete values.adminApiKey;
      }
      
      await organizationService.updateOrganization(id, values);
      message.success('組織情報が更新されました');
      setEditModalVisible(false);
      fetchOrganizationDetail(); // 詳細を再取得
    } catch (error) {
      console.error('組織更新エラー:', error);
      message.error('組織情報の更新に失敗しました: ' + (error.response?.data?.error || error.message));
    }
  };

  // 新規ワークスペース作成ハンドラ
  const handleCreateWorkspace = async (values) => {
    try {
      await workspaceService.createWorkspace(id, values);
      message.success('ワークスペースが作成されました');
      setCreateWorkspaceModalVisible(false);
      createWorkspaceForm.resetFields();
      fetchWorkspaces(); // ワークスペース一覧を再取得
    } catch (error) {
      console.error('ワークスペース作成エラー:', error);
      message.error('ワークスペースの作成に失敗しました: ' + (error.response?.data?.error || error.message));
    }
  };

  // ワークスペースアーカイブハンドラ
  const handleArchiveWorkspace = async (workspaceId) => {
    try {
      await workspaceService.archiveWorkspace(workspaceId);
      message.success('ワークスペースがアーカイブされました');
      fetchWorkspaces(); // ワークスペース一覧を再取得
    } catch (error) {
      console.error('ワークスペースアーカイブエラー:', error);
      message.error('ワークスペースのアーカイブに失敗しました');
    }
  };

  // Anthropic同期ハンドラ
  const handleSyncWithAnthropic = async () => {
    try {
      const result = await organizationService.syncWithAnthropic(id, {
        syncWorkspaces: true,
        syncApiKeys: true
      });
      
      message.success('Anthropicとの同期が完了しました');
      fetchOrganizationDetail(); // 詳細を再取得
      fetchWorkspaces(); // ワークスペース一覧を再取得
      
      // 同期結果に基づいたメッセージ表示
      if (result.workspaces?.error) {
        message.warning(`ワークスペース同期エラー: ${result.workspaces.error}`);
      }
      if (result.apiKeys?.error) {
        message.warning(`APIキー同期エラー: ${result.apiKeys.error}`);
      }
    } catch (error) {
      console.error('Anthropic同期エラー:', error);
      message.error('Anthropicとの同期に失敗しました');
    }
  };

  // 組織のステータスに応じたタグを生成
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

  // ワークスペーステーブルのカラム定義
  const workspaceColumns = [
    {
      title: 'ワークスペース名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/workspaces/${record._id}`)}>{text}</a>
      ),
    },
    {
      title: 'メンバー数',
      dataIndex: 'members',
      key: 'members',
      render: (members) => members?.length || 0,
    },
    {
      title: 'ステータス',
      key: 'status',
      render: (_, record) => getStatusTag(record.status, record.isArchived),
    },
    {
      title: 'トークン使用量',
      dataIndex: 'usage',
      key: 'usage',
      render: (usage) => {
        if (!usage) return '-';
        
        const percentage = usage.budgetPercentage || 0;
        let color = 'green';
        if (percentage > 80) color = 'red';
        else if (percentage > 60) color = 'orange';
        
        return (
          <div style={{ width: '120px' }}>
            <Progress 
              percent={Math.round(percentage)} 
              size="small" 
              status={percentage >= 100 ? 'exception' : 'normal'} 
              strokeColor={color}
              format={percent => `${usage.totalTokens.toLocaleString()}`} 
            />
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => navigate(`/workspaces/${record._id}`)} 
            disabled={record.isArchived}
          />
          <Button 
            type="text" 
            icon={<TeamOutlined />} 
            onClick={() => navigate(`/workspaces/${record._id}/members`)} 
            disabled={record.isArchived}
          />
          <Button 
            type="text" 
            icon={<BarChartOutlined />} 
            onClick={() => navigate(`/workspaces/${record._id}/usage`)}
          />
          <Button 
            type="text" 
            icon={<KeyOutlined />} 
            onClick={() => navigate(`/workspaces/${record._id}/apikey`)} 
            disabled={record.isArchived}
          />
          {!record.isArchived && (
            <Popconfirm
              title="ワークスペースをアーカイブしますか？"
              onConfirm={() => handleArchiveWorkspace(record._id)}
              okText="はい"
              cancelText="いいえ"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="organization-detail-container">
      <Button 
        type="link" 
        icon={<LeftOutlined />} 
        onClick={() => navigate('/organizations')} 
        style={{ marginBottom: '16px' }}
      >
        組織一覧に戻る
      </Button>
      
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <>
          <Card
            title={`組織詳細: ${organization?.name}`}
            extra={
              <Space>
                <Button
                  type="primary"
                  icon={<SyncOutlined />}
                  onClick={handleSyncWithAnthropic}
                  disabled={!organization?.adminApiKey || organization?.isArchived}
                >
                  Anthropicと同期
                </Button>
                <Button
                  type="primary"
                  icon={<KeyOutlined />}
                  onClick={() => navigate(`/organizations/${id}/apikeys`)}
                  disabled={organization?.isArchived}
                >
                  APIキープール管理
                </Button>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setEditModalVisible(true)}
                  disabled={organization?.isArchived}
                >
                  編集
                </Button>
              </Space>
            }
          >
            <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
              <Descriptions.Item label="組織ID">{organization?._id}</Descriptions.Item>
              <Descriptions.Item label="ステータス">
                {getStatusTag(organization?.status, organization?.isArchived)}
              </Descriptions.Item>
              <Descriptions.Item label="管理者">
                {organization?.adminId?.username || organization?.adminId?.email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="メンバー数">
                {(organization?.members?.length || 0)} / {organization?.maxUsers || 5} 人
                {organization?.members?.length > 0 && organization?.maxUsers > 0 && (
                  <Progress 
                    percent={Math.round((organization?.members?.length / organization?.maxUsers) * 100)} 
                    size="small" 
                    style={{ marginTop: '5px' }}
                    status={(organization?.members?.length >= organization?.maxUsers) ? 'exception' : 'normal'}
                  />
                )}
              </Descriptions.Item>
              <Descriptions.Item label="説明" span={4}>
                {organization?.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="月間トークン予算">
                {organization?.monthlyBudget?.toLocaleString()} トークン
              </Descriptions.Item>
              <Descriptions.Item label="使用量">
                {organization?.usage?.totalTokens?.toLocaleString() || 0} トークン 
                ({organization?.usage?.budgetPercentage || 0}%)
              </Descriptions.Item>
              <Descriptions.Item label="Admin APIキー設定">
                {organization?.adminApiKey ? '設定済み' : '未設定'}
              </Descriptions.Item>
              <Descriptions.Item label="ワークスペース数">
                {workspaces.length} 個
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Tabs defaultActiveKey="workspaces2" style={{ marginTop: '24px' }}>
            <TabPane 
              tab={
                <span>
                  <KeyOutlined />
                  APIキープール
                </span>
              } 
              key="apiKeyPool"
            >
              <Card
                title="APIキープール管理"
                extra={
                  <Button
                    type="primary"
                    onClick={() => navigate(`/organizations/${id}/apikeys`)}
                    disabled={organization?.isArchived}
                  >
                    管理画面を開く
                  </Button>
                }
                style={{ marginBottom: '16px' }}
              >
                <p>組織のAPIキーを集中管理し、メンバーに割り当てることができます。</p>
                <p>APIキープールを使用すると、Anthropicのキーを一元管理でき、使用状況の監視も可能です。</p>
                <Button 
                  type="primary" 
                  icon={<KeyOutlined />}
                  onClick={() => navigate(`/organizations/${id}/apikeys`)}
                >
                  APIキープール管理を開く
                </Button>
              </Card>
            </TabPane>
            <TabPane 
              tab={
                <span>
                  <TeamOutlined />
                  ワークスペース
                </span>
              } 
              key="workspaces2"
            >
              <Card
                title="ワークスペース一覧"
                extra={
                  <Button
                    type="primary"
                    icon={<SyncOutlined />}
                    onClick={fetchWorkspaces}
                  >
                    更新
                  </Button>
                }
                style={{ marginBottom: '16px' }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => setCreateWorkspaceModalVisible(true)}
                    disabled={organization?.isArchived}
                  >
                    新規ワークスペース作成
                  </Button>
                </div>
                
                <Table
                  columns={workspaceColumns}
                  dataSource={workspaces}
                  rowKey="_id"
                  loading={workspacesLoading}
                  pagination={{
                    defaultPageSize: 5,
                    showSizeChanger: true,
                    pageSizeOptions: ['5', '10', '20'],
                  }}
                />
              </Card>
            </TabPane>
          </Tabs>

          {/* 組織編集モーダル */}
          <Modal
            title="組織情報の編集"
            open={editModalVisible}
            onCancel={() => setEditModalVisible(false)}
            footer={null}
          >
            <Form
              form={editForm}
              layout="vertical"
              onFinish={handleUpdateOrganization}
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
                name="monthlyBudget"
                label="月間トークン予算"
                rules={[{ required: true, message: '予算を入力してください' }]}
              >
                <InputNumber
                  min={1000}
                  step={1000}
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
              
              <Form.Item
                name="maxUsers"
                label="最大メンバー数"
                tooltip="この組織に追加できるメンバーの最大数"
                rules={[
                  { required: true, message: '最大メンバー数を入力してください' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (value < (organization?.members?.length || 0)) {
                        return Promise.reject(`現在のメンバー数(${organization?.members?.length}人)より小さくすることはできません`);
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber
                  min={Math.max(1, organization?.members?.length || 0)}
                  max={10000}
                  step={1}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              
              <Form.Item
                name="adminApiKey"
                label="Anthropic Admin APIキー（変更する場合のみ）"
                extra="Anthropicから取得したAdmin APIキーを入力してください（sk-ant-admin...で始まるもの）"
              >
                <Input.Password placeholder="sk-ant-admin..." />
              </Form.Item>
              
              <Form.Item
                name="status"
                label="ステータス"
                rules={[{ required: true, message: 'ステータスを選択してください' }]}
              >
                <Input.Group>
                  <Space>
                    <Button
                      type={editForm.getFieldValue('status') === 'active' ? "primary" : "default"}
                      onClick={() => editForm.setFieldsValue({ status: 'active' })}
                    >
                      有効
                    </Button>
                    <Button
                      type={editForm.getFieldValue('status') === 'suspended' ? "primary" : "default"}
                      onClick={() => editForm.setFieldsValue({ status: 'suspended' })}
                      danger
                    >
                      停止
                    </Button>
                    <Button
                      type={editForm.getFieldValue('status') === 'pending' ? "primary" : "default"}
                      onClick={() => editForm.setFieldsValue({ status: 'pending' })}
                    >
                      保留
                    </Button>
                  </Space>
                </Input.Group>
              </Form.Item>
              
              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => setEditModalVisible(false)}>
                    キャンセル
                  </Button>
                  <Button type="primary" htmlType="submit">
                    更新
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Modal>

          {/* 新規ワークスペース作成モーダル */}
          <Modal
            title="新規ワークスペース作成"
            open={createWorkspaceModalVisible}
            onCancel={() => setCreateWorkspaceModalVisible(false)}
            footer={null}
          >
            <Form
              form={createWorkspaceForm}
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
              
              <Form.Item
                name="monthlyBudget"
                label="月間トークン予算"
                initialValue={Math.floor(organization?.monthlyBudget / 2)}
                rules={[{ required: true, message: '予算を入力してください' }]}
              >
                <InputNumber
                  min={1000}
                  max={organization?.monthlyBudget}
                  step={1000}
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
              
              <Form.Item
                name="syncWithAnthropic"
                valuePropName="checked"
                initialValue={!!organization?.adminApiKey}
              >
                <div className="ant-checkbox-wrapper">
                  <span className="ant-checkbox">
                    <input 
                      type="checkbox"
                      className="ant-checkbox-input"
                      checked={createWorkspaceForm.getFieldValue('syncWithAnthropic')}
                      onChange={(e) => createWorkspaceForm.setFieldsValue({ syncWithAnthropic: e.target.checked })}
                      disabled={!organization?.adminApiKey}
                    />
                    <span className="ant-checkbox-inner"></span>
                  </span>
                  <span>
                    AnthropicにもワークスペースとAPIキーを作成
                    {!organization?.adminApiKey && (
                      <span style={{ color: 'red', marginLeft: '8px' }}>
                        (Admin APIキーが設定されていません)
                      </span>
                    )}
                  </span>
                </div>
              </Form.Item>
              
              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => setCreateWorkspaceModalVisible(false)}>
                    キャンセル
                  </Button>
                  <Button type="primary" htmlType="submit">
                    作成
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Modal>
        </>
      )}
    </div>
  );
};

export default OrganizationDetail;