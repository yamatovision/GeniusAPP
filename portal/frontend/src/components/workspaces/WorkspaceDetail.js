import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Descriptions,
  Space,
  Tabs,
  Form,
  Input,
  InputNumber,
  Switch,
  Spin,
  message,
  Tag,
  Divider,
  Modal,
  Progress,
  Tooltip
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  DeleteOutlined,
  TeamOutlined,
  BarChartOutlined,
  KeyOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import workspaceService from '../../services/workspace.service';
import './WorkspaceDetail.css';

const { confirm } = Modal;
const { TabPane } = Tabs;

/**
 * ワークスペース詳細コンポーネント
 * ワークスペースの詳細表示と編集機能を提供
 */
const WorkspaceDetail = () => {
  const { organizationId, workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();
  const [usageData, setUsageData] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // ワークスペース詳細を取得
  const fetchWorkspaceDetails = async () => {
    try {
      setLoading(true);
      const data = await workspaceService.getWorkspaceById(workspaceId);
      setWorkspace(data);
      return data;
    } catch (error) {
      console.error('ワークスペース詳細取得エラー:', error);
      message.error('ワークスペース詳細の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // ワークスペース使用量を取得
  const fetchUsageData = async () => {
    try {
      setUsageLoading(true);
      const data = await workspaceService.getWorkspaceUsage(workspaceId, {
        period: 'month'
      });
      // データが正しく取得できたか確認してからセット
      if (data && !data.error) {
        setUsageData(data);
      } else {
        console.error('使用量データ取得失敗:', data?.error || '不明なエラー');
        // デフォルト値をセット（アプリケーションがクラッシュしないように）
        setUsageData({
          daily: [],
          organizations: [],
          totalTokens: 0,
          budgetPercentage: 0
        });
      }
    } catch (error) {
      console.error('ワークスペース使用量取得エラー:', error);
      // エラー時にもデフォルト値をセット
      setUsageData({
        daily: [],
        organizations: [],
        totalTokens: 0,
        budgetPercentage: 0
      });
    } finally {
      setUsageLoading(false);
    }
  };

  // コンポーネントマウント時にワークスペース詳細を取得
  useEffect(() => {
    if (workspaceId) {
      // ワークスペース詳細と使用量を並行して取得
      const fetchData = async () => {
        const workspaceData = await fetchWorkspaceDetails();
        if (workspaceData) {
          // フォームに初期値をセット
          form.setFieldsValue({
            name: workspaceData.name,
            description: workspaceData.description,
            monthlyBudget: workspaceData.monthlyBudget,
            syncWithAnthropic: workspaceData.syncWithAnthropic
          });
        }
        await fetchUsageData();
      };
      
      fetchData();
    }
  }, [workspaceId, form]);

  // WebSocketイベントリスナーの設定
  useEffect(() => {
    // ワークスペース更新イベント
    const updateUnsubscribe = workspaceService.subscribe('workspace_updated', (data) => {
      if (data._id === workspaceId) {
        fetchWorkspaceDetails();
      }
    });

    // クリーンアップ関数
    return () => {
      updateUnsubscribe();
    };
  }, [workspaceId]);

  // 編集モードの切り替え
  const toggleEdit = () => {
    setEditing(!editing);
    if (!editing) {
      form.setFieldsValue({
        name: workspace.name,
        description: workspace.description,
        monthlyBudget: workspace.monthlyBudget,
        syncWithAnthropic: workspace.syncWithAnthropic
      });
    }
  };

  // ワークスペース更新ハンドラ
  const handleUpdateWorkspace = async (values) => {
    try {
      await workspaceService.updateWorkspace(workspaceId, values);
      message.success('ワークスペースが更新されました');
      setEditing(false);
      fetchWorkspaceDetails();
    } catch (error) {
      console.error('ワークスペース更新エラー:', error);
      message.error('ワークスペースの更新に失敗しました: ' + (error.response?.data?.error || error.message));
    }
  };

  // ワークスペースアーカイブ確認ダイアログ
  const confirmArchive = () => {
    confirm({
      title: 'ワークスペースをアーカイブしますか？',
      icon: <ExclamationCircleOutlined />,
      content: `ワークスペース「${workspace.name}」をアーカイブします。この操作は取り消せません。`,
      okText: 'アーカイブ',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: async () => {
        try {
          await workspaceService.archiveWorkspace(workspaceId);
          message.success('ワークスペースがアーカイブされました');
          navigate(`/organizations/${organizationId}/workspaces`);
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

  // 使用量データの表示
  const renderUsageData = () => {
    if (usageLoading) {
      return <Spin tip="使用量データを読み込み中..." />;
    }

    if (!usageData) {
      return <p>使用量データはありません</p>;
    }

    // データの安全性を確保
    const totalTokens = usageData.totalTokens || 0;
    const monthlyBudget = workspace.monthlyBudget || 1; // ゼロ除算を防止
    
    const percentage = (totalTokens / monthlyBudget) * 100;
    const formattedPercentage = percentage.toFixed(1);
    let color = 'green';
    if (percentage > 80) color = 'red';
    else if (percentage > 60) color = 'orange';

    return (
      <div className="usage-summary">
        <h3>使用量は直接Anthropicコンソールで確認してください</h3>
        <div className="usage-note">
          <p>使用量や予算管理はAnthropicWebコンソールで直接行ってください。</p>
          <p>AppGeniusでは正確な使用量データを表示できません。</p>
        </div>
        <Link to={`/organizations/${organizationId}/workspaces/${workspaceId}/usage`}>
          <Button type="primary" icon={<BarChartOutlined />}>
            詳細な使用状況を表示
          </Button>
        </Link>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="workspace-detail-container">
        <Card>
          <Spin tip="ワークスペース情報を読み込み中..." />
        </Card>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="workspace-detail-container">
        <Card>
          <p>ワークスペースが見つかりませんでした</p>
          <Button type="primary">
            <Link to={`/organizations/${organizationId}/workspaces`}>ワークスペース一覧に戻る</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="workspace-detail-container">
      <Card
        title={
          <Space>
            <Link to={`/organizations/${organizationId}/workspaces`}>
              <Button type="text" icon={<ArrowLeftOutlined />}>ワークスペース一覧に戻る</Button>
            </Link>
            <span>{editing ? 'ワークスペース編集' : 'ワークスペース詳細'}</span>
          </Space>
        }
        extra={
          <Space>
            {!workspace.isArchived && (
              <>
                {editing ? (
                  <>
                    <Button onClick={toggleEdit} icon={<CloseOutlined />}>キャンセル</Button>
                    <Button type="primary" onClick={form.submit} icon={<SaveOutlined />}>保存</Button>
                  </>
                ) : (
                  <>
                    <Link to={`/organizations/${organizationId}/workspaces/${workspaceId}/members`}>
                      <Button icon={<TeamOutlined />}>メンバー管理</Button>
                    </Link>
                    <Link to={`/organizations/${organizationId}/workspaces/${workspaceId}/apikey`}>
                      <Button icon={<KeyOutlined />}>APIキー管理</Button>
                    </Link>
                    <Button onClick={toggleEdit} icon={<EditOutlined />}>編集</Button>
                    <Button type="primary" danger onClick={confirmArchive} icon={<DeleteOutlined />}>
                      アーカイブ
                    </Button>
                  </>
                )}
              </>
            )}
          </Space>
        }
      >
        {editing ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleUpdateWorkspace}
            initialValues={{
              name: workspace.name,
              description: workspace.description,
              monthlyBudget: workspace.monthlyBudget,
              syncWithAnthropic: workspace.syncWithAnthropic
            }}
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
              name="syncWithAnthropic"
              label="Anthropicと同期"
              valuePropName="checked"
              extra="Anthropic組織のワークスペースとして同期します"
            >
              <Switch />
            </Form.Item>
          </Form>
        ) : (
          <>
            <Tabs defaultActiveKey="details">
              <TabPane tab="基本情報" key="details">
                <Descriptions bordered column={1} className="workspace-descriptions">
                  <Descriptions.Item label="ID">{workspace._id}</Descriptions.Item>
                  <Descriptions.Item label="ワークスペース名">{workspace.name}</Descriptions.Item>
                  <Descriptions.Item label="説明">{workspace.description || '説明なし'}</Descriptions.Item>
                  <Descriptions.Item label="組織">{workspace.organizationName || organizationId}</Descriptions.Item>
                  <Descriptions.Item label="作成日">{new Date(workspace.createdAt).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="最終更新日">{new Date(workspace.updatedAt).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="ステータス">
                    {getStatusTag(workspace.status, workspace.isArchived)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Anthropic同期">
                    {workspace.syncWithAnthropic ? (
                      <Tag color="green">有効</Tag>
                    ) : (
                      <Tag color="orange">無効</Tag>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="月間トークン予算">
                    {workspace.monthlyBudget?.toLocaleString() || 0} トークン
                  </Descriptions.Item>
                </Descriptions>
              </TabPane>
              
              <TabPane tab="使用量" key="usage">
                {renderUsageData()}
              </TabPane>
            </Tabs>
          </>
        )}
      </Card>
    </div>
  );
};

export default WorkspaceDetail;