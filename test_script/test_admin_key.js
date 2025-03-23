/**
 * Anthropic Admin API キーテスト
 * 管理者APIキーを使用してエンドポイントをテスト
 */
const axios = require('axios');

// アドミンキー (引数または環境変数から取得)
const ADMIN_API_KEY = process.argv[2] || process.env.ANTHROPIC_ADMIN_API_KEY || '';

if (!ADMIN_API_KEY) {
  console.error('エラー: Admin APIキーが指定されていません。');
  console.error('使用法: node test_admin_key.js [APIキー]');
  process.exit(1);
}

// テスト設定
const config = {
  // テストするAPIエンドポイント
  endpoints: [
    {
      name: "組織ワークスペースAPI（最新）",
      url: "https://api.anthropic.com/v1/organizations/workspaces",
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ADMIN_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    },
    {
      name: "標準ワークスペースAPI（旧）",
      url: "https://api.anthropic.com/v1/workspaces",
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ADMIN_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    },
    {
      name: "管理者ワークスペースAPI（旧）",
      url: "https://api.anthropic.com/v1/admin/workspaces",
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ADMIN_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }
  ],
  // テストユーザー情報
  testData: {
    name: `テストワークスペース-${Date.now()}`
    // descriptionフィールドは現在のAPIでは受け付けられていないため削除
  }
};

/**
 * エンドポイントをテスト
 */
async function testEndpoint(endpoint) {
  console.log(`エンドポイントをテスト中: ${endpoint.name} (${endpoint.url})`);
  
  try {
    // GETリクエストでエンドポイントの存在を確認
    const response = await axios.get(endpoint.url, {
      headers: endpoint.headers
    });
    
    console.log(`✅ 成功! ステータス: ${response.status}`);
    console.log(`データ: ${JSON.stringify(response.data).substring(0, 150)}...`);
    
    return { 
      valid: true, 
      status: response.status,
      message: "エンドポイントが存在し、アクセス可能です",
      data: response.data
    };
  } catch (error) {
    if (error.response) {
      // APIからのレスポンスがある場合
      const status = error.response.status;
      console.log(`❌ エラー! ステータス: ${status} - ${error.response.statusText}`);
      
      if (error.response.data) {
        console.log(`エラーデータ: ${JSON.stringify(error.response.data)}`);
      }
      
      return { 
        valid: false, 
        status: status,
        message: `エラー: ${status} - ${error.response.statusText}`,
        error: error.response.data
      };
    } else if (error.request) {
      // リクエストは送信されたがレスポンスがない
      console.log(`❌ サーバーからの応答がありませんでした`);
      return { 
        valid: false,
        message: "サーバーからの応答がありませんでした" 
      };
    } else {
      // リクエスト設定時のエラー
      console.log(`❌ リクエスト設定エラー: ${error.message}`);
      return { 
        valid: false,
        message: `リクエスト設定エラー: ${error.message}` 
      };
    }
  }
}

/**
 * 実際にワークスペースを作成してみる
 */
async function testCreateWorkspace(url, headers, data) {
  console.log(`\nワークスペース作成テスト: ${url}`);
  
  try {
    const response = await axios.post(url, data, { headers });
    
    console.log(`✅ ワークスペース作成成功!`);
    console.log(`作成されたワークスペース: ${JSON.stringify(response.data)}`);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.log(`❌ ワークスペース作成失敗`);
    
    if (error.response) {
      console.log(`ステータス: ${error.response.status} - ${error.response.statusText}`);
      if (error.response.data) {
        console.log(`エラーデータ: ${JSON.stringify(error.response.data)}`);
      }
    } else {
      console.log(`エラー: ${error.message}`);
    }
    
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// メイン実行関数
async function main() {
  console.log("======== Anthropic Admin API キーテスト ========\n");
  console.log(`APIキー: ${ADMIN_API_KEY.substring(0, 10)}...`);
  
  // 各エンドポイントをテスト
  const results = {};
  
  for (const endpoint of config.endpoints) {
    console.log("\n" + "-".repeat(50));
    results[endpoint.name] = await testEndpoint(endpoint);
  }
  
  // 結果の表示
  console.log("\n======== テスト結果サマリー ========");
  
  const validEndpoints = [];
  
  for (const [name, result] of Object.entries(results)) {
    const icon = result.valid ? "✅" : "❌";
    console.log(`${icon} ${name}: ${result.message}`);
    
    if (result.valid) {
      validEndpoints.push(name);
    }
  }
  
  // 有効なエンドポイントがあれば、ワークスペース作成をテスト
  if (validEndpoints.length > 0) {
    console.log("\n======== ワークスペース作成テスト ========");
    
    let createResult;
    
    // 「組織ワークスペースAPI（最新）」が有効なら、それを使ってテスト
    if (validEndpoints.includes("組織ワークスペースAPI（最新）")) {
      const endpoint = config.endpoints.find(e => e.name === "組織ワークスペースAPI（最新）");
      createResult = await testCreateWorkspace(endpoint.url, endpoint.headers, config.testData);
    } 
    // そうでなければ「標準ワークスペースAPI（旧）」をテスト
    else if (validEndpoints.includes("標準ワークスペースAPI（旧）")) {
      const endpoint = config.endpoints.find(e => e.name === "標準ワークスペースAPI（旧）");
      createResult = await testCreateWorkspace(endpoint.url, endpoint.headers, config.testData);
    }
    // 最後に「管理者ワークスペースAPI（旧）」をテスト
    else if (validEndpoints.includes("管理者ワークスペースAPI（旧）")) {
      const endpoint = config.endpoints.find(e => e.name === "管理者ワークスペースAPI（旧）");
      createResult = await testCreateWorkspace(endpoint.url, endpoint.headers, config.testData);
    }
    
    // 結果を表示
    if (createResult) {
      console.log("\n結果: " + (createResult.success ? "成功 ✅" : "失敗 ❌"));
    }
  } else {
    console.log("\n❌ 有効なエンドポイントが見つかりませんでした。");
    console.log("APIキーが正しいこと、および必要な権限があることを確認してください。");
  }
}

// 実行
main().catch(error => {
  console.error("テスト実行中にエラーが発生しました:", error);
});