/**
 * 統計データフォーマッター
 * バックエンドから取得した統計データをフロントエンドで表示しやすい形式に変換します
 */

/**
 * 時系列データを図表表示用に変換
 * @param {Array} timeSeriesData - バックエンドから取得した時系列データ
 * @param {string} interval - 間隔（'hour'|'day'|'week'|'month'）
 * @returns {Object} チャート表示用のデータ
 */
export const formatTimeSeriesForChart = (timeSeriesData, interval) => {
  if (!timeSeriesData || !timeSeriesData.length) {
    return {
      labels: [],
      datasets: [
        {
          label: '使用回数',
          data: [],
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        {
          label: 'トークン数',
          data: [],
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1
        }
      ]
    };
  }

  // 日付フォーマットを設定
  const dateFormatOptions = {
    hour: { hour: '2-digit', minute: '2-digit' },
    day: { month: 'short', day: 'numeric' },
    week: { month: 'short', day: 'numeric' },
    month: { year: 'numeric', month: 'short' }
  };

  // ラベルと使用回数データを作成
  const labels = timeSeriesData.map(item => {
    const date = new Date(item.date);
    return date.toLocaleDateString('ja-JP', dateFormatOptions[interval] || dateFormatOptions.day);
  });

  // 使用回数データセット
  const usageData = timeSeriesData.map(item => item.count);
  
  // トークン数データセット
  const tokenData = timeSeriesData.map(item => 
    (item.inputTokens || 0) + (item.outputTokens || 0)
  );
  
  // 成功率データセット
  const successData = timeSeriesData.map(item => {
    if (item.total === 0) return 0;
    return ((item.successful / item.total) * 100).toFixed(1);
  });

  return {
    labels,
    datasets: [
      {
        label: '使用回数',
        data: usageData,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        yAxisID: 'y'
      },
      {
        label: 'トークン数',
        data: tokenData,
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
        yAxisID: 'y1'
      },
      {
        label: '成功率 (%)',
        data: successData,
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
        yAxisID: 'y2'
      }
    ]
  };
};

/**
 * バージョン別統計データを円グラフ表示用に変換
 * @param {Array} versionStats - バックエンドから取得したバージョン別統計データ
 * @returns {Object} 円グラフ表示用のデータ
 */
export const formatVersionStatsForPieChart = (versionStats) => {
  if (!versionStats || !versionStats.length) {
    return {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [],
        hoverBackgroundColor: []
      }]
    };
  }

  // バージョン別の色パレット
  const colorPalette = [
    'rgba(255, 99, 132, 0.6)',
    'rgba(54, 162, 235, 0.6)',
    'rgba(255, 206, 86, 0.6)',
    'rgba(75, 192, 192, 0.6)',
    'rgba(153, 102, 255, 0.6)',
    'rgba(255, 159, 64, 0.6)',
    'rgba(199, 199, 199, 0.6)',
    'rgba(83, 102, 255, 0.6)',
    'rgba(40, 159, 64, 0.6)',
    'rgba(210, 199, 199, 0.6)'
  ];

  // 各バージョンのラベルと使用回数を抽出
  const labels = versionStats.map(ver => `v${ver.versionNumber || '?'} (${ver.count}回)`);
  const data = versionStats.map(ver => ver.count);
  
  // バージョン数に合わせて色を割り当て
  const backgroundColor = versionStats.map((_, index) => 
    colorPalette[index % colorPalette.length]
  );
  
  // ホバー時の色（やや濃く）
  const hoverBackgroundColor = backgroundColor.map(color => 
    color.replace('0.6', '0.8')
  );

  return {
    labels,
    datasets: [{
      data,
      backgroundColor,
      hoverBackgroundColor
    }]
  };
};

/**
 * 総計統計データをフォーマット
 * @param {Object} overallStats - バックエンドから取得した総計統計データ
 * @returns {Object} UIで表示するフォーマットに変換したデータ
 */
export const formatOverallStats = (overallStats) => {
  if (!overallStats) {
    return {
      totalUses: 0,
      successRate: '0%',
      avgResponseTime: '0ms',
      totalTokens: 0,
      avgTokensPerUse: 0
    };
  }

  const successRate = overallStats.total > 0 
    ? ((overallStats.successful / overallStats.total) * 100).toFixed(1) + '%'
    : '0%';

  const avgResponseTime = overallStats.total > 0
    ? ((overallStats.totalResponseTime / overallStats.total) || 0).toFixed(0) + 'ms'
    : '0ms';

  const totalTokens = (overallStats.totalInputTokens || 0) + (overallStats.totalOutputTokens || 0);
  const avgTokensPerUse = overallStats.total > 0
    ? Math.round(totalTokens / overallStats.total)
    : 0;

  return {
    totalUses: overallStats.total || 0,
    successRate,
    avgResponseTime,
    totalTokens,
    avgTokensPerUse
  };
};