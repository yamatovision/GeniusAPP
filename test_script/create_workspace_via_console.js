/**
 * Anthropic ワークスペース作成ツール
 * 管理者APIキーを使用してワークスペースを作成、または
 * コンソールへリダイレクトするハイブリッドツール
 */
const express = require('express');
const open = require('open');
const axios = require('axios');
require('dotenv').config();
const app = express();
const port = 3030;

// コマンドライン引数から組織情報とAPIキーを取得
const organizationName = process.argv[2] || 'テスト組織';
const workspaceName = process.argv[3] || `テストワークスペース-${Date.now()}`;
const adminApiKey = process.argv[4] || process.env.ANTHROPIC_ADMIN_API_KEY || '';

// Claudeコンソール上でワークスペースを作成するためのURLを生成
const createWorkspaceUrl = `https://console.anthropic.com/workspaces/new?name=${encodeURIComponent(workspaceName)}`;

// API経由でワークスペースを作成する関数
async function createWorkspaceViaApi(apiKey, name) {
  if (!apiKey) {
    return { success: false, error: 'API キーが設定されていません' };
  }
  
  try {
    // 正しいエンドポイントでAPIリクエスト実行
    const response = await axios.post(
      'https://api.anthropic.com/v1/organizations/workspaces',
      { name },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    
    return { 
      success: true, 
      data: response.data,
      message: `ワークスペース "${name}" が正常に作成されました (ID: ${response.data.id})`
    };
  } catch (error) {
    let errorMessage = 'ワークスペース作成に失敗しました';
    if (error.response && error.response.data) {
      errorMessage += `: ${JSON.stringify(error.response.data)}`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    return { success: false, error: errorMessage };
  }
}

// UIレンダリング用の簡易HTMLテンプレート
const pageTemplate = `
<!DOCTYPE html>
<html>
<head>
  <title>Claudeワークスペース作成ツール</title>
  <style>
    body {
      font-family: sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 { color: #333; }
    .card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      background-color: #f9f9f9;
    }
    .button {
      display: inline-block;
      background-color: #0066cc;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      text-decoration: none;
      font-weight: bold;
      margin-top: 10px;
    }
    .info {
      background-color: #e7f3fe;
      border-left: 4px solid #2196F3;
      padding: 12px;
      margin: 15px 0;
    }
    code {
      background-color: #f0f0f0;
      padding: 2px 4px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>Claudeワークスペース作成ツール</h1>
  
  <div class="card">
    <h2>組織とワークスペース情報</h2>
    <p><strong>組織名:</strong> ${organizationName}</p>
    <p><strong>ワークスペース名:</strong> ${workspaceName}</p>
  </div>
  
  <div class="info">
    <p>ワークスペース作成APIは利用できないため、Claudeコンソールで作成する必要があります。</p>
    <p>以下のボタンをクリックすると、ワークスペース名があらかじめ入力された状態でコンソールが開きます。</p>
  </div>
  
  <a href="${createWorkspaceUrl}" target="_blank" class="button">Claudeコンソールでワークスペースを作成</a>
  
  <div class="card">
    <h2>手順</h2>
    <ol>
      <li>「Claudeコンソールでワークスペースを作成」ボタンをクリックする</li>
      <li>Claudeアカウントにログインする（必要な場合）</li>
      <li>ワークスペース作成フォームで内容を確認し、必要に応じて編集する</li>
      <li>「作成」ボタンをクリックしてワークスペースを作成する</li>
      <li>作成されたワークスペースIDをコピーして、アプリケーションで利用する</li>
    </ol>
  </div>
  
  <div class="info">
    <p>このツールを使用した後は、このウィンドウを閉じて<code>Ctrl+C</code>でサーバーを停止できます。</p>
  </div>
</body>
</html>
`;

// ルート設定
app.get('/', (req, res) => {
  res.send(pageTemplate);
});

// サーバー起動
app.listen(port, () => {
  console.log(`ワークスペース作成ツールを起動しています... http://localhost:${port}`);
  
  // 自動的にブラウザを開く
  open(`http://localhost:${port}`);
  
  // コンソールガイド
  console.log('\n===== 使用方法 =====');
  console.log('1. ブラウザが自動的に開きます');
  console.log('2. 「Claudeコンソールでワークスペースを作成」ボタンをクリックします');
  console.log('3. Claudeコンソールでワークスペースを作成します');
  console.log('4. このツールを終了するには Ctrl+C を押してください\n');
});