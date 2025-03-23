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
  Tag
} from 'antd';
import { 
  BarChartOutlined, 
  UserOutlined,
  ReloadOutlined,
  DownloadOutlined,
  HomeOutlined,
  KeyOutlined
} from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import moment from 'moment';
import usageService from '../../services/usage.service';
import workspaceService from '../../services/workspace.service';
import UsageCharts from './UsageCharts';
import './WorkspaceUsage.css';

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

/**
 * ワークスペース使用量詳細コンポーネント
 * 特定のワークスペースのトークン使用量詳細を表示
 */
const WorkspaceUsage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [dateRange, setDateRange] = useState([
    moment().startOf('month'), 
    moment()
  ]);

  // 初期データ読み込み
  useEffect(() => {
    fetchWorkspaceDetails();
    fetchUsageData();
  }, [id]);

  // ワークスペース詳細の取得
  const fetchWorkspaceDetails = async () => {
    try {
      const data = await workspaceService.getWorkspaceById(id);
      setWorkspace(data);
    } catch (err) {
      console.error('ワークスペース詳細取得エラー:', err);
      setError('ワークスペース情報の取得に失敗しました');
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
      
      const data = await usageService.getWorkspaceUsage(id, {
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
    link.setAttribute("download", `${workspace?.name}_usage_${moment().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      title: '役割',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        let color = 'blue';
        let text = role;
        
        switch(role) {
          case 'workspace_admin':
            color = 'gold';
            text = '管理者';
            break;
          case 'workspace_developer':
            color = 'green';
            text = '開発者';
            break;
          case 'workspace_user':
            color = 'blue';
            text = 'ユーザー';
            break;
          case 'workspace_billing':
            color = 'purple';
            text = '請求担当者';
            break;
        }
        
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'トークン使用量',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (value) => value?.toLocaleString() || 0,
    },
    {
      title: '使用割合',
      key: 'percentage',
      render: (_, record) => {
        const total = usageData?.usage?.totalTokens || 1;
        const percentage = ((record.totalTokens || 0) / total) * 100;
        
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
      render: (value) => value?.toLocaleString() || 0,
    },
  ];

  // 日別使用量テーブルのカラム定義
  const dailyColumns = [
    {
      title: '日付',
      dataIndex: 'date',
      key: 'date',
      render: (text) => {
        const date = moment(text).format('YYYY/MM/DD');
        return date;
      }
    },
    {
      title: '合計トークン',
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
      title: 'トークン比率',
      key: 'ratio',
      render: (_, record) => {
        const inputPercentage = record.totalTokens > 0 ? 
          (record.inputTokens / record.totalTokens) * 100 : 0;
        const outputPercentage = record.totalTokens > 0 ?
          (record.outputTokens / record.totalTokens) * 100 : 0;
          
        return (
          <div style={{ width: '150px' }}>
            <div className="token-ratio-bar">
              <div 
                className="input-tokens" 
                style={{ width: `${inputPercentage}%` }}
                title={`入力: ${record.inputTokens.toLocaleString()} (${inputPercentage.toFixed(1)}%)`}
              ></div>
              <div 
                className="output-tokens" 
                style={{ width: `${outputPercentage}%` }}
                title={`出力: ${record.outputTokens.toLocaleString()} (${outputPercentage.toFixed(1)}%)`}
              ></div>
            </div>
            <div className="token-ratio-legend">
              <span className="input-legend">入力</span>
              <span className="output-legend">出力</span>
            </div>
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
    <div className="workspace-usage-container">
      {/* パンくずリスト */}
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <Link to="/dashboard"><HomeOutlined /> ダッシュボード</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to="/organizations">組織一覧</Link>
        </Breadcrumb.Item>
        {workspace?.organizationId && (
          <Breadcrumb.Item>
            <Link to={`/organizations/${workspace.organizationId._id}`}>{workspace.organizationId.name}</Link>
          </Breadcrumb.Item>
        )}
        <Breadcrumb.Item>
          <Link to={`/workspaces/${id}`}>{workspace?.name || 'Loading...'}</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>使用量</Breadcrumb.Item>
      </Breadcrumb>

      <Card 
        title={
          <span>
            <BarChartOutlined /> ワークスペース使用量: {workspace?.name || 'Loading...'}
          </span>
        } 
        extra={
          workspace?.apiKey && (
            <Button icon={<KeyOutlined />} onClick={() => window.location.href = `/workspaces/${id}/apikey`}>
              APIキー管理
            </Button>
          )
        }
        className="workspace-usage-card"
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
              </div>
            </Col>
          </Row>
        </div>

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
                      <span className="total">{workspace?.monthlyBudget?.toLocaleString() || '無制限'}</span>
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

            {/* APIキー情報 */}
            {workspace?.apiKey && (
              <Row gutter={16} className="apikey-row">
                <Col span={24}>
                  <Card className="apikey-card">
                    <Row gutter={16}>
                      <Col xs={24} md={6}>
                        <div className="apikey-info">
                          <div className="label">APIキー名:</div>
                          <div className="value">{workspace.apiKey.name || 'キー名未設定'}</div>
                        </div>
                      </Col>
                      <Col xs={24} md={6}>
                        <div className="apikey-info">
                          <div className="label">ステータス:</div>
                          <div className="value">
                            <Tag color={workspace.apiKey.status === 'active' ? 'green' : 'red'}>
                              {workspace.apiKey.status === 'active' ? '有効' : '無効'}
                            </Tag>
                          </div>
                        </div>
                      </Col>
                      <Col xs={24} md={6}>
                        <div className="apikey-info">
                          <div className="label">プレフィックス:</div>
                          <div className="value">{workspace.apiKey.keyHint || '-'}</div>
                        </div>
                      </Col>
                      <Col xs={24} md={6}>
                        <div className="apikey-info">
                          <div className="label">作成日:</div>
                          <div className="value">
                            {workspace.apiKey.createdAt ? moment(workspace.apiKey.createdAt).format('YYYY/MM/DD') : '-'}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            )}

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
            <Tabs defaultActiveKey="daily" className="data-tabs">
              <TabPane 
                tab={
                  <span>
                    <BarChartOutlined />
                    日別使用量
                  </span>
                } 
                key="daily"
              >
                <Table 
                  dataSource={usageData.daily} 
                  columns={dailyColumns}
                  rowKey="date"
                  pagination={{ pageSize: 7 }}
                />
              </TabPane>
              
              <TabPane 
                tab={
                  <span>
                    <UserOutlined />
                    ユーザー別使用量
                  </span>
                } 
                key="users"
              >
                <Table 
                  dataSource={usageData.users} 
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

export default WorkspaceUsage;