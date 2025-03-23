import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Spin, 
  Alert, 
  DatePicker, 
  Button, 
  Statistic, 
  Row, 
  Col,
  Divider,
  Table,
  Progress,
  Space,
  Tabs,
  Breadcrumb,
  Modal
} from 'antd';
import { 
  BarChartOutlined, 
  AppstoreOutlined,
  ReloadOutlined,
  DownloadOutlined,
  HomeOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import moment from 'moment';
import usageService from '../../services/usage.service';
import organizationService from '../../services/organization.service';
import UsageCharts from './UsageCharts';
import UsageImporter from './UsageImporter';
import './OrganizationUsage.css';

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

/**
 * 組織別使用量詳細コンポーネント
 * 特定の組織のトークン使用量詳細を表示
 */
const OrganizationUsage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [dateRange, setDateRange] = useState([
    moment().startOf('month'), 
    moment()
  ]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  
  // ユーザーの権限確認
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  // 初期データ読み込み
  useEffect(() => {
    fetchOrganizationDetails();
    fetchUsageData();
  }, [id]);

  // 組織詳細の取得
  const fetchOrganizationDetails = async () => {
    try {
      const data = await organizationService.getOrganizationById(id);
      setOrganization(data);
    } catch (err) {
      console.error('組織詳細取得エラー:', err);
      setError('組織情報の取得に失敗しました');
    }
  };

  // 使用量データの取得
  const fetchUsageData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 日付範囲をISOフォーマットに変換
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      
      const data = await usageService.getOrganizationUsage(id, {
        startDate,
        endDate,
        period: 'day'
      });
      
      setUsageData(data);
    } catch (err) {
      console.error('使用量データ取得エラー:', err);
      setError('使用量データの取得に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // データ更新ハンドラ
  const handleRefresh = () => {
    fetchUsageData();
  };

  // 日付範囲変更ハンドラ
  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
    }
  };

  // データ検索ハンドラ
  const handleSearch = () => {
    fetchUsageData();
  };

  // CSVエクスポートハンドラ
  const handleExportCSV = () => {
    if (!usageData) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "日付,合計トークン,入力トークン,出力トークン,リクエスト数\n";
    
    usageData.daily.forEach(day => {
      csvContent += `${day.date},${day.totalTokens},${day.inputTokens},${day.outputTokens},${day.requestCount}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${organization?.name}_usage_${moment().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ワークスペーステーブルのカラム定義
  const workspaceColumns = [
    {
      title: 'ワークスペース名',
      dataIndex: 'workspaceName',
      key: 'workspaceName',
      render: (text, record) => (
        <Link to={`/workspaces/${record.workspaceId}/usage`}>{text || '（名称未設定）'}</Link>
      ),
    },
    {
      title: 'トークン使用量',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (value) => value.toLocaleString(),
    },
    {
      title: '入力トークン',
      dataIndex: 'inputTokens',
      key: 'inputTokens',
      render: (value) => value.toLocaleString(),
    },
    {
      title: '出力トークン',
      dataIndex: 'outputTokens',
      key: 'outputTokens',
      render: (value) => value.toLocaleString(),
    },
    {
      title: '使用率',
      dataIndex: 'percentage',
      key: 'percentage',
      sorter: (a, b) => a.percentage - b.percentage,
      render: (value) => {
        let color = 'green';
        if (value > 90) color = 'red';
        else if (value > 75) color = 'orange';
        else if (value > 50) color = 'blue';
        
        return (
          <Progress 
            percent={value} 
            size="small" 
            status={value >= 100 ? 'exception' : 'normal'} 
            strokeColor={color}
          />
        );
      },
    },
    {
      title: 'リクエスト数',
      dataIndex: 'count',
      key: 'count',
      render: (value) => value?.toLocaleString() || 0,
    },
  ];

  // ユーザーテーブルのカラム定義
  const userColumns = [
    {
      title: 'ユーザー名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'メールアドレス',
      dataIndex: 'email',
      key: 'email',
      render: (email) => email || '-',
    },
    {
      title: 'トークン使用量',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (value) => value.toLocaleString(),
    },
    {
      title: '使用割合',
      key: 'percentage',
      render: (_, record) => {
        const total = usageData?.usage?.totalTokens || 1;
        const percentage = (record.totalTokens / total) * 100;
        
        return (
          <div>
            {percentage.toFixed(1)}%
            <Progress 
              percent={percentage} 
              size="small" 
              showInfo={false}
            />
          </div>
        );
      },
    },
    {
      title: 'リクエスト数',
      dataIndex: 'requestCount',
      key: 'requestCount',
      render: (value) => value.toLocaleString(),
    },
  ];

  return (
    <div className="organization-usage-container">
      {/* パンくずリスト */}
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <Link to="/dashboard"><HomeOutlined /> ダッシュボード</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to="/organizations">組織一覧</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to={`/organizations/${id}`}>{organization?.name || 'Loading...'}</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>使用量</Breadcrumb.Item>
      </Breadcrumb>

      <Card 
        title={
          <span>
            <BarChartOutlined /> 組織使用量: {organization?.name || 'Loading...'}
          </span>
        } 
        className="organization-usage-card"
      >
        {/* フィルターセクション */}
        <div className="usage-filter-section">
          <Row gutter={16} align="middle">
            <Col xs={24} md={12}>
              <div className="filter-item">
                <label>期間:</label>
                <RangePicker 
                  value={dateRange}
                  onChange={handleDateRangeChange}
                  style={{ width: '100%' }}
                />
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div className="filter-item button-group">
                <Button 
                  type="primary" 
                  onClick={handleSearch}
                >
                  検索
                </Button>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={handleRefresh}
                >
                  更新
                </Button>
                <Button 
                  icon={<DownloadOutlined />} 
                  onClick={handleExportCSV}
                  disabled={!usageData}
                >
                  CSV
                </Button>
                {isAdmin && (
                  <Button 
                    icon={<UploadOutlined />} 
                    onClick={() => setImportModalVisible(true)}
                    type="primary"
                    ghost
                  >
                    CSVインポート
                  </Button>
                )}
              </div>
            </Col>
          </Row>
        </div>
        
        {/* CSVインポートモーダル */}
        <Modal
          title="CSVデータインポート"
          open={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          footer={null}
          width={800}
          destroyOnClose={true}
        >
          <UsageImporter 
            organizations={[organization].filter(Boolean)}
            onImportComplete={(result) => {
              setImportModalVisible(false);
              fetchUsageData(); // データを再読み込み
            }}
          />
        </Modal>

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
        ) : usageData ? (
          <>
            {/* 予算と使用量 */}
            <Row gutter={16} className="budget-row">
              <Col span={24}>
                <Card className="budget-card">
                  <div className="budget-header">
                    <h3>トークン予算の利用状況</h3>
                    <div className="budget-amount">
                      <span className="used">{usageData.usage.totalTokens.toLocaleString()}</span>
                      <span className="separator"> / </span>
                      <span className="total">{organization?.monthlyBudget?.toLocaleString() || '無制限'}</span>
                    </div>
                  </div>
                  <Progress 
                    percent={usageData.budget.usagePercentage} 
                    status={usageData.budget.usagePercentage >= 100 ? 'exception' : 'normal'} 
                    strokeColor={
                      usageData.budget.usagePercentage >= 90 ? '#f5222d' :
                      usageData.budget.usagePercentage >= 75 ? '#fa8c16' :
                      usageData.budget.usagePercentage >= 50 ? '#1890ff' : '#52c41a'
                    }
                  />
                  <div className="budget-footer">
                    期間: {moment(usageData.period.start).format('YYYY/MM/DD')} 〜 {moment(usageData.period.end).format('YYYY/MM/DD')}
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 使用量詳細 */}
            <Row gutter={16} className="stats-row">
              <Col xs={24} sm={12} md={6}>
                <Card className="stat-card">
                  <Statistic
                    title="合計トークン"
                    value={usageData.usage.totalTokens}
                    formatter={value => value.toLocaleString()}
                    precision={0}
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="stat-card">
                  <Statistic
                    title="入力トークン"
                    value={usageData.usage.inputTokens}
                    formatter={value => value.toLocaleString()}
                    precision={0}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="stat-card">
                  <Statistic
                    title="出力トークン"
                    value={usageData.usage.outputTokens}
                    formatter={value => value.toLocaleString()}
                    precision={0}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card className="stat-card">
                  <Statistic
                    title="APIリクエスト数"
                    value={usageData.usage.requestCount}
                    formatter={value => value.toLocaleString()}
                    precision={0}
                    valueStyle={{ color: '#cf1322' }}
                  />
                  <div className="success-rate">
                    成功率: {(usageData.usage.successRate * 100).toFixed(1)}%
                  </div>
                </Card>
              </Col>
            </Row>

            {/* チャートセクション */}
            <Card className="chart-card">
              <UsageCharts usageData={usageData} timeUnit="day" />
            </Card>

            {/* タブセクション */}
            <Tabs defaultActiveKey="workspaces" className="data-tabs">
              <TabPane 
                tab={
                  <span>
                    <AppstoreOutlined />
                    ワークスペース別使用量
                  </span>
                } 
                key="workspaces"
              >
                <Table 
                  dataSource={Array.isArray(usageData.workspaces) ? usageData.workspaces : []} 
                  columns={workspaceColumns}
                  rowKey="workspaceId"
                  pagination={{ pageSize: 5 }}
                />
              </TabPane>
              
              {usageData.users && (
                <TabPane 
                  tab={
                    <span>
                      <AppstoreOutlined />
                      ユーザー別使用量
                    </span>
                  } 
                  key="users"
                >
                  <Table 
                    dataSource={Array.isArray(usageData.users) ? usageData.users : []} 
                    columns={userColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                  />
                </TabPane>
              )}
            </Tabs>
          </>
        ) : (
          <div className="empty-data-message">
            <Alert
              message="データなし"
              description="使用量データがありません。検索条件を変更してください。"
              type="info"
              showIcon
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default OrganizationUsage;