import React from 'react';
import { Card, Tabs, Radio } from 'antd';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import './UsageCharts.css';

const { TabPane } = Tabs;

/**
 * 使用量チャートコンポーネント
 * 様々なグラフを使って使用量データを可視化
 */
const UsageCharts = ({ usageData, timeUnit }) => {
  const [chartType, setChartType] = React.useState('line');

  // 日別データを処理
  const dailyData = usageData && usageData.daily ? usageData.daily.map(day => ({
    ...day,
    date: day.date, // ISO形式からフォーマット変更が必要なら ここで
  })) : [];

  // 組織別データを処理 (usageDataが存在するか確認)
  const organizationData = usageData && usageData.organizations ? usageData.organizations.map(org => ({
    name: org.name,
    value: org.totalTokens,
    percentage: org.budgetPercentage
  })) : [];

  // 円グラフの色
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF', '#FF6B6B', '#4ECDC4', '#C7F464'];

  // カスタムツールチップ
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toLocaleString()}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // 円グラフ用カスタムツールチップ
  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="org-name">{payload[0].name}</p>
          <p className="org-value">
            {`${payload[0].value.toLocaleString()} トークン (${payload[0].payload.percentage?.toFixed(1) || 0}%)`}
          </p>
        </div>
      );
    }
    return null;
  };

  // 時間単位に基づいたX軸フォーマット
  const getXAxisFormat = () => {
    switch (timeUnit) {
      case 'week':
        return (date) => {
          const week = date.split('-W')[1];
          return `第${week}週`;
        };
      case 'month':
        return (date) => {
          const month = date.split('-')[1];
          return `${month}月`;
        };
      case 'day':
      default:
        return (date) => {
          const parts = date.split('-');
          return `${parts[1]}/${parts[2]}`;
        };
    }
  };

  return (
    <div className="usage-charts">
      <div className="chart-controls">
        <Radio.Group value={chartType} onChange={e => setChartType(e.target.value)}>
          <Radio.Button value="line">折れ線グラフ</Radio.Button>
          <Radio.Button value="bar">棒グラフ</Radio.Button>
          <Radio.Button value="pie">円グラフ</Radio.Button>
        </Radio.Group>
      </div>

      <Tabs defaultActiveKey="daily" className="chart-tabs">
        <TabPane tab="日別使用量" key="daily">
          <div className="chart-container">
            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={dailyData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={getXAxisFormat()} />
                  <YAxis 
                    tickFormatter={(value) => (value / 1000) + 'k'} 
                    label={{ value: 'トークン数', angle: -90, position: 'insideLeft' }} 
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="totalTokens" 
                    name="合計トークン" 
                    stroke="#8884d8" 
                    strokeWidth={2} 
                    activeDot={{ r: 8 }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="inputTokens" 
                    name="入力トークン" 
                    stroke="#82ca9d" 
                    strokeWidth={2} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="outputTokens" 
                    name="出力トークン" 
                    stroke="#ffc658" 
                    strokeWidth={2} 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={dailyData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={getXAxisFormat()} />
                  <YAxis tickFormatter={(value) => (value / 1000) + 'k'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="inputTokens" 
                    name="入力トークン" 
                    stackId="a" 
                    fill="#8884d8" 
                  />
                  <Bar 
                    dataKey="outputTokens" 
                    name="出力トークン" 
                    stackId="a" 
                    fill="#82ca9d" 
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'pie' && organizationData.length > 0 && (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={organizationData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={150}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {organizationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabPane>

        <TabPane tab="リクエスト数" key="requests">
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={dailyData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={getXAxisFormat()} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="requestCount" 
                  name="APIリクエスト数" 
                  stroke="#ff7300" 
                  strokeWidth={2} 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default UsageCharts;