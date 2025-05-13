// toolkit-update.js
const fs = require('fs');
const path = require('path');

// 構成設定
const CONFIG = {
  versionFile: './toolkit-version.json',
  dashboardFile: './toolkit-dashboard.html',
  claudeMdFile: './CLAUDE.md',
  currentStatusFile: './docs/CURRENT_STATUS.md'
};

// メインの更新関数
async function updateDashboard() {
  console.log('AppGenius ツールキットダッシュボードを更新しています...');
  
  try {
    // バージョン情報を読み込む
    const versionData = readVersionData();
    
    // ステータス情報を読み込む
    const statusData = readStatusData();
    
    // HTMLテンプレートを読み込む
    let dashboardHtml = fs.readFileSync(CONFIG.dashboardFile, 'utf8');
    
    // テンプレートを更新
    dashboardHtml = updateVersionSection(dashboardHtml, versionData);
    dashboardHtml = updateStatusSection(dashboardHtml, statusData);
    dashboardHtml = updateComponentSection(dashboardHtml, versionData);
    dashboardHtml = updateTimestamp(dashboardHtml);
    
    // 更新したHTMLを保存
    fs.writeFileSync(CONFIG.dashboardFile, dashboardHtml, 'utf8');
    
    console.log('ツールキットダッシュボードが更新されました！');
    console.log(`ファイル: ${CONFIG.dashboardFile}`);
  } catch (error) {
    console.error('ダッシュボード更新中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

// バージョン情報を読み込む
function readVersionData() {
  try {
    if (!fs.existsSync(CONFIG.versionFile)) {
      throw new Error(`バージョンファイルが見つかりません: ${CONFIG.versionFile}`);
    }
    
    return JSON.parse(fs.readFileSync(CONFIG.versionFile, 'utf8'));
  } catch (error) {
    throw new Error(`バージョンデータの読み込みに失敗しました: ${error.message}`);
  }
}

// ステータス情報を読み込む
function readStatusData() {
  try {
    if (!fs.existsSync(CONFIG.currentStatusFile)) {
      return { 
        total: 0, 
        completed: 0, 
        progress: 0,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
    }
    
    const content = fs.readFileSync(CONFIG.currentStatusFile, 'utf8');
    
    // 総ファイル数を抽出
    const totalMatch = content.match(/完成予定ファイル数: (\d+)/);
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;
    
    // 完了ファイル数を抽出
    const completedMatch = content.match(/作成済みファイル数: (\d+)/);
    const completed = completedMatch ? parseInt(completedMatch[1]) : 0;
    
    // 進捗率を抽出
    const progressMatch = content.match(/進捗率: ([\d.]+)%/);
    const progress = progressMatch ? parseFloat(progressMatch[1]) : 0;
    
    // 更新日を抽出
    const updateMatch = content.match(/最終更新日: ([\d\/]+)/);
    const lastUpdated = updateMatch ? updateMatch[1].replace(/\//g, '-') : new Date().toISOString().split('T')[0];
    
    return { total, completed, progress, lastUpdated };
  } catch (error) {
    throw new Error(`ステータスデータの読み込みに失敗しました: ${error.message}`);
  }
}

// バージョンセクションを更新
function updateVersionSection(html, versionData) {
  html = html.replace(
    /<p>AppGenius ツールキットバージョン: <strong>.*?<\/strong><\/p>/,
    `<p>AppGenius ツールキットバージョン: <strong>${versionData.version}</strong></p>`
  );
  
  const componentCount = Object.keys(versionData.components).length;
  html = html.replace(
    /<p>実装済みコンポーネント: <strong>.*?<\/strong><\/p>/,
    `<p>実装済みコンポーネント: <strong>${componentCount}/${componentCount}</strong></p>`
  );
  
  return html;
}

// ステータスセクションを更新
function updateStatusSection(html, statusData) {
  html = html.replace(
    /<p>完成予定ファイル数: <strong>.*?<\/strong><\/p>/,
    `<p>完成予定ファイル数: <strong>${statusData.total}</strong></p>`
  );
  
  html = html.replace(
    /<p>作成済みファイル数: <strong>.*?<\/strong><\/p>/,
    `<p>作成済みファイル数: <strong>${statusData.completed}</strong></p>`
  );
  
  html = html.replace(
    /<p>進捗率: <strong>.*?<\/strong><\/p>/,
    `<p>進捗率: <strong>${statusData.progress}%</strong></p>`
  );
  
  html = html.replace(
    /<div class="progress" style="width: .*?%"><\/div>/,
    `<div class="progress" style="width: ${statusData.progress}%"></div>`
  );
  
  return html;
}

// コンポーネントセクションを更新
function updateComponentSection(html, versionData) {
  // 各コンポーネントごとにHTMLを更新
  Object.entries(versionData.components).forEach(([name, info]) => {
    // バージョン情報を更新
    const versionRegex = new RegExp(`<span>${name}<\\/span>\\s*<span class="component-version">.*?<\\/span>`);
    html = html.replace(
      versionRegex,
      `<span>${name}</span><span class="component-version">v${info.version}</span>`
    );
    
    // 更新日を更新
    const dateRegex = new RegExp(`<div class="component-date">最終更新日: .*?<\\/div>`);
    html = html.replace(
      dateRegex,
      `<div class="component-date">最終更新日: ${info.lastUpdated}</div>`
    );
    
    // 依存関係を更新
    const depsStr = info.dependencies ? info.dependencies.join(', ') : '';
    const depsRegex = new RegExp(`<div class="component-deps">依存: .*?<\\/div>`);
    html = html.replace(
      depsRegex,
      `<div class="component-deps">依存: ${depsStr}</div>`
    );
  });
  
  return html;
}

// タイムスタンプを更新
function updateTimestamp(html) {
  const today = new Date().toISOString().split('T')[0];
  
  html = html.replace(
    /<span id="updated-date">.*?<\/span>/,
    `<span id="updated-date">${today}</span>`
  );
  
  return html;
}

// プログラム実行
updateDashboard().catch(console.error);