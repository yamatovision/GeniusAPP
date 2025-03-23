import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Spin, 
  Alert, 
  Select, 
  DatePicker, 
  Button, 
  Statistic, 
  Row, 
  Col,
  Table,
  Tag,
  Progress,
  Space
} from 'antd';
import { 
  BarChartOutlined, 
  UserOutlined, 
  ReloadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import moment from 'moment';
import usageService from '../../services/usage.service';
import './UsageDashboard.css';

// サブコンポーネントのインポート
import UsageCharts from './UsageCharts';

const { RangePicker } = DatePicker;
const { Option } = Select;

/**
 * ユーザー別使用量コンポーネント
 * 特定ユーザーのトークン使用量の集計と可視化を提供
 */
const UserUsage = () => {
  // URLパラメータからユーザーIDを取得
  const { userId } = useParams();
  
  // 状態管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [dateRange, setDateRange] = useState([
    moment().startOf('month'), 
    moment()
  ]);
  const [timeUnit, setTimeUnit] = useState('day');

  // 初期データ読み込み
  useEffect(() => {
    fetchUserData();
    fetchUsageData();
  }, [userId]);

  // ユーザー情報の取得
  const fetchUserData = async () => {
    try {
      // ユーザー情報取得APIがあることを前提としています
      // 適宜APIエンドポイントを調整してください
      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setUserData(data);
    } catch (err) {
      console.error('ユーザーデータ取得エラー:', err);
      setError('ユーザーデータの取得に失敗しました');
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
      
      const data = await usageService.getUserUsage(userId, {
        startDate,
        endDate,
        period: timeUnit
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

  // 時間単位変更ハンドラ
  const handleTimeUnitChange = (value) => {
    setTimeUnit(value);
  };

  // データ検索ハンドラ
  const handleSearch = () => {
    fetchUsageData();
  };

  // CSVエクスポートハンドラ
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
    link.setAttribute("download", `user_usage_${userId}_${moment().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // モデル使用量テーブルのカラム定義
  const modelColumns = [
    {
      title: 'モデル',
      dataIndex: 'model',
      key: 'model',
      render: (text) => {
        const modelType = text.includes('claude-3') ? 'success' : 
                         text.includes('claude-2') ? 'warning' : 'default';
        return (
          <Tag color={modelType}>{text}</Tag>
        );
      }
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
    {
      title: '平均応答時間',
      dataIndex: 'avgResponseTime',
      key: 'avgResponseTime',
      render: (value) => `${value.toFixed(2)}ms`,
    },
  ];

  return (
    <div className="usage-dashboard-container">
      <Card 
        title={
          <span>
            <UserOutlined /> ユーザー使用量分析: {userData ? userData.username : userId}
          </span>
        } 
        className="usage-dashboard-card"
      >
        {/* フィルターセクション */}
        <div className="usage-filter-section">
          <Row gutter={16} align="middle">
            <Col xs={24} md={10}>
              <div className="filter-item">
                <label>期間:</label>
                <RangePicker 
                  value={dateRange}
                  onChange={handleDateRangeChange}
                  style={{ width: '100%' }}
                />
              </div>
            </Col>
            <Col xs={24} md={6}>
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
            <Col xs={24} md={8}>
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

            {/* モデル別使用量 */}
            <Card 
              title="モデル別使用量" 
              className="model-usage-card"
              style={{ marginTop: '20px' }}
            >
              <Table 
                dataSource={usageData.models} 
                columns={modelColumns}
                rowKey="model"
                pagination={false}
              />
            </Card>
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

export default UserUsage;