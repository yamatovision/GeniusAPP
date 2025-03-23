import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Tabs, 
  Spin, 
  Alert, 
  Select, 
  Button, 
  Statistic, 
  Row, 
  Col,
  Table,
  Tag,
  Progress,
  Space,
  Tooltip,
  Badge,
  Divider
} from 'antd';
import { 
  DashboardOutlined, 
  TeamOutlined, 
  AppstoreOutlined,
  KeyOutlined,
  UserOutlined,
  ReloadOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import adminService from '../../services/admin.service';
import './AdminDashboard.css';

// APIキー管理コンポーネントをインポート
import ApiKeyManagement from './ApiKeyManagement';

// Chart.js関連のインポート
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';

// Chart.jsコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement
);

const { TabPane } = Tabs;
const { Option } = Select;

/**
 * 管理者ダッシュボードコンポーネント
 * 管理者向けの包括的な管理インターフェースを提供
 */
const AdminDashboard = () => {
  // 状態管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // 初期データ読み込み
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ダッシュボードデータの取得
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // バッチ処理で複数のAPIを呼び出す
      const [statsData, orgsData, wsData, keysData] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getAllOrganizations({ includeArchived: false }),
        adminService.getAllWorkspaces({ includeArchived: false }),
        adminService.getAllApiKeys({ status: 'active' })
      ]);
      
      setDashboardStats(statsData);
      setOrganizations(orgsData);
      setWorkspaces(wsData);
      setApiKeys(keysData);
    } catch (err) {
      console.error('ダッシュボードデータ取得エラー:', err);
      setError('ダッシュボードデータの取得に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // データ更新ハンドラ
  const handleRefresh = () => {
    fetchDashboardData();
  };

  // タブ変更ハンドラ
  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  // 組織テーブルのカラム定義
  const organizationColumns = [
    {
      title: '組織名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Link to={`/organizations/${record.id}`}>{text}</Link>
      ),
    },
    {
      title: 'メンバー数',
      dataIndex: 'memberCount',
      key: 'memberCount',
      sorter: (a, b) => a.memberCount - b.memberCount,
    },
    {
      title: 'ワークスペース数',
      dataIndex: 'workspaceCount',
      key: 'workspaceCount',
      sorter: (a, b) => a.workspaceCount - b.workspaceCount,
    },
    {
      title: 'トークン使用量',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (value) => value.toLocaleString(),
    },
    {
      title: '予算使用率',
      dataIndex: 'budgetPercentage',
      key: 'budgetPercentage',
      sorter: (a, b) => a.budgetPercentage - b.budgetPercentage,
      render: (value, record) => {
        let color = 'green';
        if (value > 90) color = 'red';
        else if (value > 75) color = 'orange';
        else if (value > 50) color = 'blue';
        
        return (
          <div style={{ width: '150px' }}>
            <Progress 
              percent={value} 
              size="small" 
              status={value >= 100 ? 'exception' : 'normal'} 
              strokeColor={color}
            />
          </div>
        );
      },
    },
    {
      title: '作成日',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
  ];

  // ワークスペーステーブルのカラム定義
  const workspaceColumns = [
    {
      title: 'ワークスペース名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Link to={`/workspaces/${record.id}`}>{text}</Link>
      ),
    },
    {
      title: '組織',
      dataIndex: 'organizationName',
      key: 'organizationName',
      render: (text, record) => (
        <Link to={`/organizations/${record.organizationId}`}>{text}</Link>
      ),
    },
    {
      title: 'APIキー数',
      dataIndex: 'apiKeyCount',
      key: 'apiKeyCount',
      sorter: (a, b) => a.apiKeyCount - b.apiKeyCount,
    },
    {
      title: 'メンバー数',
      dataIndex: 'memberCount',
      key: 'memberCount',
      sorter: (a, b) => a.memberCount - b.memberCount,
    },
    {
      title: 'トークン使用量',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (value) => value.toLocaleString(),
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'gray'}>
          {status === 'active' ? 'アクティブ' : 'アーカイブ済み'}
        </Tag>
      ),
    },
  ];

  // ユーザーテーブルのカラム定義
  const userColumns = [
    {
      title: 'ユーザー名',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <Link to={`/users/${record.id}`}>{text}</Link>
      ),
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
        const roleColors = {
          admin: 'red',
          developer: 'blue',
          user: 'green',
          billing: 'orange'
        };
        
        return (
          <Tag color={roleColors[role] || 'default'}>
            {role}
          </Tag>
        );
      },
    },
    {
      title: '所属組織',
      dataIndex: 'organizationName',
      key: 'organizationName',
      render: (text, record) => text ? (
        <Link to={`/organizations/${record.organizationId}`}>{text}</Link>
      ) : '-',
    },
    {
      title: 'トークン使用量',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (value) => value.toLocaleString(),
    },
    {
      title: '最終ログイン',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
  ];

  // アラートカードの表示
  const renderAlertCards = () => {
    if (!dashboardStats || !dashboardStats.alerts) return null;
    
    const { alerts } = dashboardStats;
    
    return (
      <Row gutter={16} className="alert-cards">
        {alerts.map((alert, index) => (
          <Col xs={24} md={8} key={index}>
            <Card className={`alert-card alert-priority-${alert.priority}`}>
              <div className="alert-icon">
                {alert.priority === 'high' ? (
                  <WarningOutlined style={{ color: '#f5222d' }} />
                ) : (
                  <InfoCircleOutlined style={{ color: '#faad14' }} />
                )}
              </div>
              <div className="alert-content">
                <h4>{alert.title}</h4>
                <p>{alert.message}</p>
                {alert.actionLink && (
                  <Link to={alert.actionLink}>詳細を確認</Link>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  // 全体統計の表示
  const renderSystemStats = () => {
    if (!dashboardStats) return null;
    
    return (
      <Row gutter={16} className="stats-row">
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="総ユーザー数"
              value={dashboardStats.userCount}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="組織数"
              value={dashboardStats.organizationCount}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="ワークスペース数"
              value={dashboardStats.workspaceCount}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="APIキー数"
              value={dashboardStats.apiKeyCount}
              prefix={<KeyOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <div className="active-count">
              アクティブ: {dashboardStats.activeApiKeyCount}
            </div>
          </Card>
        </Col>
      </Row>
    );
  };

  // 使用量チャートの表示
  const renderUsageCharts = () => {
    if (!dashboardStats || !dashboardStats.usageData) return null;
    
    const { usageData } = dashboardStats;
    
    // 折れ線グラフのデータ
    const lineChartData = {
      labels: usageData.dates,
      datasets: [
        {
          label: '合計トークン',
          data: usageData.totalTokens,
          fill: false,
          backgroundColor: 'rgb(75, 192, 192)',
          borderColor: 'rgba(75, 192, 192, 0.2)',
        },
        {
          label: '入力トークン',
          data: usageData.inputTokens,
          fill: false,
          backgroundColor: 'rgb(54, 162, 235)',
          borderColor: 'rgba(54, 162, 235, 0.2)',
        },
        {
          label: '出力トークン',
          data: usageData.outputTokens,
          fill: false,
          backgroundColor: 'rgb(153, 102, 255)',
          borderColor: 'rgba(153, 102, 255, 0.2)',
        },
      ],
    };
    
    // 円グラフのデータ
    const pieChartData = {
      labels: ['Claude-3-Opus', 'Claude-3-Sonnet', 'Claude-3-Haiku', 'Claude-2', 'その他'],
      datasets: [
        {
          data: usageData.modelDistribution,
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
          ],
          hoverBackgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
          ],
        },
      ],
    };
    
    return (
      <Row gutter={16} className="chart-row">
        <Col xs={24} md={16}>
          <Card title="トークン使用量推移">
            <Line data={lineChartData} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="モデル使用分布">
            <Pie data={pieChartData} />
          </Card>
        </Col>
      </Row>
    );
  };

  return (
    <div className="admin-dashboard-container">
      <Card 
        title={
          <span>
            <DashboardOutlined /> 管理者ダッシュボード
          </span>
        } 
        extra={
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={loading}
          >
            更新
          </Button>
        }
        className="admin-dashboard-card"
      >
        {/* エラーメッセージ */}
        {error && (
          <Alert 
            message="エラー" 
            description={error} 
            type="error" 
            showIcon 
            style={{ marginBottom: '20px' }}
          />
        )}

        {/* 読み込み中表示 */}
        {loading ? (
          <div className="loading-container">
            <Spin size="large" />
            <p>データを読み込んでいます...</p>
          </div>
        ) : dashboardStats ? (
          <>
            {/* アラートセクション */}
            {dashboardStats.alerts && dashboardStats.alerts.length > 0 && (
              <>
                {renderAlertCards()}
                <Divider />
              </>
            )}

            {/* 全体統計 */}
            {renderSystemStats()}

            {/* 使用量チャート */}
            {renderUsageCharts()}

            {/* タブセクション */}
            <Tabs 
              activeKey={activeTab} 
              onChange={handleTabChange}
              className="admin-tabs"
              tabBarStyle={{ marginTop: '24px' }}
            >
              <TabPane 
                tab={
                  <span>
                    <TeamOutlined />
                    組織管理
                  </span>
                } 
                key="organizations"
              >
                <Table 
                  dataSource={organizations} 
                  columns={organizationColumns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </TabPane>
              
              <TabPane 
                tab={
                  <span>
                    <AppstoreOutlined />
                    ワークスペース管理
                  </span>
                } 
                key="workspaces"
              >
                <Table 
                  dataSource={workspaces} 
                  columns={workspaceColumns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </TabPane>
              
              <TabPane 
                tab={
                  <span>
                    <KeyOutlined />
                    APIキー管理
                  </span>
                } 
                key="apikeys"
              >
                <ApiKeyManagement apiKeys={Array.isArray(apiKeys.apiKeys) ? apiKeys.apiKeys : []} onUpdate={fetchDashboardData} />
              </TabPane>
              
              <TabPane 
                tab={
                  <span>
                    <UserOutlined />
                    ユーザー管理
                  </span>
                } 
                key="users"
              >
                <Table 
                  dataSource={dashboardStats.users && Array.isArray(dashboardStats.users) ? dashboardStats.users : []} 
                  columns={userColumns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </TabPane>
            </Tabs>
          </>
        ) : (
          <div className="empty-data-message">
            <Alert
              message="データなし"
              description="ダッシュボードデータがありません。更新ボタンをクリックしてください。"
              type="info"
              showIcon
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminDashboard;