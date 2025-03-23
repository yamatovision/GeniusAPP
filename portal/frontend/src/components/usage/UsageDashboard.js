import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Tabs, 
  Spin, 
  Alert, 
  Select, 
  DatePicker, 
  Button, 
  Statistic, 
  Row, 
  Col,
  Divider,
  Table,
  Tag,
  Progress,
  Space
} from 'antd';
import { 
  BarChartOutlined, 
  TeamOutlined, 
  ReloadOutlined,
  DownloadOutlined,
  ArrowUpOutlined, 
  ArrowDownOutlined 
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import moment from 'moment';
import usageService from '../../services/usage.service';
import organizationService from '../../services/organization.service';
import './UsageDashboard.css';

// サブコンポーネントのインポート
import UsageCharts from './UsageCharts';

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

/**
 * 使用量ダッシュボードコンポーネント
 * トークン使用量の集計と可視化を提供
 */
const UsageDashboard = () => {
  // 状態管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState('all');
  const [dateRange, setDateRange] = useState([
    moment().startOf('month'), 
    moment()
  ]);
  const [timeUnit, setTimeUnit] = useState('day');

  // 初期データ読み込み
  useEffect(() => {
    fetchOrganizations();
    // ユーザーのロールをローカルストレージから確認
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    
    // 管理者でない場合は、全システムデータアクセスを試みないようにする
    if (!isAdmin) {
      setSelectedOrganization(''); // 組織が選択されるまで空に
    } else {
      fetchUsageData();
    }

    // 更新時刻を表示するために現在時刻を設定
    setLastUpdated(new Date());
  }, []);

  // 最終更新時刻の状態
  const [lastUpdated, setLastUpdated] = useState(null);

  // 組織一覧の取得
  const fetchOrganizations = async () => {
    try {
      const data = await organizationService.getOrganizations();
      setOrganizations(data);
    } catch (err) {
      console.error('組織データ取得エラー:', err);
      setError('組織データの取得に失敗しました');
    }
  };

  // 使用量データの取得
  const fetchUsageData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 組織が選択されていない場合は処理を中止
      if (!selectedOrganization && selectedOrganization !== 'all') {
        setError('組織を選択してください');
        setLoading(false);
        return;
      }
      
      // 日付範囲をISOフォーマットに変換
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      
      // ユーザーのロールを確認
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      
      let data;
      
      // 組織別データまたは全体データを取得
      if (selectedOrganization === 'all') {
        // 管理者のみが全システムデータにアクセス可能
        if (!isAdmin) {
          setError('全システムデータへのアクセス権限がありません');
          setLoading(false);
          return;
        }
        
        data = await usageService.getSystemUsage({
          startDate,
          endDate,
          period: timeUnit
        });
      } else {
        data = await usageService.getOrganizationUsage(selectedOrganization, {
          startDate,
          endDate,
          period: timeUnit
        });
      }
      
      setUsageData(data);
      // 更新時刻を設定
      setLastUpdated(new Date());
    } catch (err) {
      console.error('使用量データ取得エラー:', err);
      
      // 403エラーの場合は適切なメッセージを表示
      if (err.response?.status === 403) {
        setError('この操作を行う権限がありません。管理者権限が必要です。');
      } else {
        setError('使用量データの取得に失敗しました: ' + (err.message || '不明なエラー'));
      }
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

  // 時間単位変更ハンドラ
  const handleTimeUnitChange = (value) => {
    setTimeUnit(value);
  };

  // 組織選択ハンドラ
  const handleOrganizationChange = (value) => {
    setSelectedOrganization(value);
    // 組織が変更されたら自動的にデータを取得する
    if (value) {
      setTimeout(() => {
        fetchUsageData();
      }, 100);
    }
  };

  // データ検索ハンドラ
  const handleSearch = () => {
    fetchUsageData();
  };

  // CSVエクスポートハンドラ (実装例)
  const handleExportCSV = () => {
    if (!usageData) return;
    
    // CSV形式のデータを生成
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // ヘッダー行
    csvContent += "日付,合計トークン,入力トークン,出力トークン,リクエスト数\n";
    
    // 日別データ
    usageData.daily.forEach(day => {
      csvContent += `${day.date},${day.totalTokens},${day.inputTokens},${day.outputTokens},${day.requestCount}\n`;
    });
    
    // エンコードとダウンロード
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `token_usage_${moment().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 組織テーブルのカラム定義
  const organizationColumns = [
    {
      title: '組織名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Link to={`/organizations/${record.id}/usage`}>{text}</Link>
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
            <div style={{ fontSize: '12px', color: '#888' }}>
              {record.totalTokens.toLocaleString()} / {record.budgetLimit.toLocaleString()}
            </div>
          </div>
        );
      },
    },
    {
      title: 'リクエスト数',
      dataIndex: 'requestCount',
      key: 'requestCount',
      sorter: (a, b) => a.requestCount - b.requestCount,
      render: (value) => value.toLocaleString(),
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
      title: 'リクエスト数',
      dataIndex: 'requestCount',
      key: 'requestCount',
      render: (value) => value.toLocaleString(),
    },
  ];

  // ユーザーの権限確認
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  return (
    <div className="usage-dashboard-container">
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <BarChartOutlined /> トークン使用量ダッシュボード
              {isAdmin && <Tag color="blue" style={{ marginLeft: '10px' }}>管理者モード</Tag>}
            </span>
            {lastUpdated && (
              <span style={{ fontSize: '14px', color: '#888' }}>
                最終更新: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        } 
        className="usage-dashboard-card"
      >
        {/* フィルターセクション */}
        <div className="usage-filter-section">
          <Row gutter={16} align="middle">
            <Col xs={24} md={6}>
              <div className="filter-item">
                <label>組織:</label>
                <Select 
                  style={{ width: '100%' }} 
                  value={selectedOrganization}
                  onChange={handleOrganizationChange}
                  placeholder="組織を選択してください"
                >
                  {isAdmin && <Option value="all">全ての組織</Option>}
                  {organizations.map(org => (
                    <Option key={org._id} value={org._id}>{org.name}</Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div className="filter-item">
                <label>期間:</label>
                <RangePicker 
                  value={dateRange}
                  onChange={handleDateRangeChange}
                  style={{ width: '100%' }}
                />
              </div>
            </Col>
            <Col xs={24} md={4}>
              <div className="filter-item">
                <label>単位:</label>
                <Select 
                  style={{ width: '100%' }} 
                  value={timeUnit}
                  onChange={handleTimeUnitChange}
                >
                  <Option value="day">日別</Option>
                  <Option value="week">週別</Option>
                  <Option value="month">月別</Option>
                </Select>
              </div>
            </Col>
            <Col xs={24} md={6}>
              <div className="filter-item button-group">
                <Button 
                  type="primary" 
                  onClick={handleSearch}
                  disabled={!selectedOrganization && selectedOrganization !== 'all'}
                >
                  検索
                </Button>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={handleRefresh}
                  disabled={!selectedOrganization && selectedOrganization !== 'all'}
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
            {/* 概要統計 */}
            <Row gutter={16} className="stats-row">
              <Col xs={24} sm={12} md={6}>
                <Card className="stat-card">
                  <Statistic
                    title="合計トークン"
                    value={usageData.summary.totalTokens}
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
                    value={usageData.summary.inputTokens}
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
                    value={usageData.summary.outputTokens}
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
                    value={usageData.summary.requestCount}
                    formatter={value => value.toLocaleString()}
                    precision={0}
                    valueStyle={{ color: '#cf1322' }}
                  />
                  <div className="success-rate">
                    成功率: {(usageData.summary.successRate * 100).toFixed(1)}%
                  </div>
                </Card>
              </Col>
            </Row>

            {/* チャートセクション */}
            <Card className="chart-card">
              <UsageCharts usageData={usageData} timeUnit={timeUnit} />
            </Card>

            {/* タブセクション */}
            <Tabs defaultActiveKey="organizations" className="data-tabs">
              <TabPane 
                tab={
                  <span>
                    <TeamOutlined />
                    組織別使用量
                  </span>
                } 
                key="organizations"
              >
                <Table 
                  dataSource={Array.isArray(usageData.organizations) ? usageData.organizations : []} 
                  columns={organizationColumns}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                />
              </TabPane>
              
              <TabPane 
                tab={
                  <span>
                    <TeamOutlined />
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

export default UsageDashboard;