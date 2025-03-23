/**
 * Anthropic Admin API 詳細テスト
 * 管理者APIキーの各種エンドポイントを詳細にテスト
 */
const axios = require('axios');

// アドミンキー
const ADMIN_API_KEY = process.argv[2] || process.env.ANTHROPIC_ADMIN_API_KEY || '';

if (!ADMIN_API_KEY) {
  console.error('エラー: Admin APIキーが指定されていません。');
  console.error('使用法: node test_admin_api.js [APIキー]');
  process.exit(1);
}

// テスト設定
const config = {
  baseUrl: 'https://api.anthropic.com',
  endpoints: [
    // ドキュメントやヒントから考えられるすべての可能性をテスト
    { name: "標準API", path: "/v1/messages", method: "GET" },
    { name: "Admin組織API", path: "/v1/admin/organizations", method: "GET" },
    { name: "Admin組織一覧API", path: "/v1/admin/organizations/list", method: "GET" },
    { name: "Adminユーザー一覧API", path: "/v1/admin/users", method: "GET" },
    { name: "Adminワークスペース一覧API", path: "/v1/admin/workspaces", method: "GET" },
    { name: "Adminワークスペース作成API", path: "/v1/admin/workspaces", method: "POST" },
    { name: "標準ワークスペース一覧API", path: "/v1/workspaces", method: "GET" },
    { name: "標準ワークスペース作成API", path: "/v1/workspaces", method: "POST" },
    { name: "Adminワークスペース詳細API", path: "/v1/workspaces/info", method: "GET" }
  ],
  testData: {
    workspace: {
      name: `テストワークスペース-${Date.now()}`,
      description: "API詳細テスト用ワークスペース"
    }
  },
  headers: {
    standard: {
      'Content-Type': 'application/json',
      'X-API-Key': ADMIN_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    beta: {
      'Content-Type': 'application/json',
      'X-API-Key': ADMIN_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'workspaces-2023-10'
    }
  }
};

/**
 * エンドポイントをテスト
 */
async function testEndpoint(endpoint) {
  console.log(`\n[${endpoint.method}] ${endpoint.name} (${config.baseUrl}${endpoint.path})`);
  
  try {
    let response;
    
    // エンドポイントに応じてヘッダーを使い分け
    const headers = endpoint.path.includes('workspaces') ? config.headers.beta : config.headers.standard;
    
    // リクエストメソッドによって処理を分ける
    if (endpoint.method === 'GET') {
      response = await axios.get(`${config.baseUrl}${endpoint.path}`, { headers });
    } else if (endpoint.method === 'POST') {
      const data = endpoint.path.includes('workspaces') ? config.testData.workspace : {};
      response = await axios.post(`${config.baseUrl}${endpoint.path}`, data, { headers });
    }
    
    console.log(`✅ 成功! ステータス: ${response.status}`);
    
    // レスポンスが大きい場合は概要のみ表示
    if (response.data) {
      if (typeof response.data === 'object') {
        const json = JSON.stringify(response.data);
        console.log(`データ: ${json.length > 500 ? json.substring(0, 500) + '...' : json}`);
      } else {
        console.log(`データ: ${response.data}`);
      }
    }
    
    return { 
      valid: true, 
      status: response.status,
      message: "エンドポイントが存在し、アクセス可能です",
      data: response.data
    };
  } catch (error) {
    // エラーの詳細なデバッグ
    if (error.response) {
      const status = error.response.status;
      console.log(`❌ エラー! ステータス: ${status} - ${error.response.statusText}`);
      
      // 401/403エラーはエンドポイントが存在することを示す
      if (status === 401 || status === 403) {
        console.log('👉 認証エラーですが、エンドポイントは存在します');
      }
      
      // 404エラーはエンドポイントが存在しないことを示す
      if (status === 404) {
        console.log('👉 エンドポイントが存在しません');
      }
      
      if (error.response.data) {
        console.log(`エラーデータ: ${JSON.stringify(error.response.data)}`);
      }
      
      return { 
        valid: status === 200 || status === 201,
        exists: status !== 404,
        status: status,
        message: `エラー: ${status} - ${error.response.statusText}`,
        error: error.response.data
      };
    } else if (error.request) {
      console.log(`❌ サーバーからの応答がありませんでした`);
      return { 
        valid: false,
        exists: null,
        message: "サーバーからの応答がありませんでした" 
      };
    } else {
      console.log(`❌ リクエスト設定エラー: ${error.message}`);
      return { 
        valid: false,
        exists: null,
        message: `リクエスト設定エラー: ${error.message}` 
      };
    }
  }
}

/**
 * ワークスペース作成の強化テスト
 * APIバージョンとbetaヘッダーを様々に変えて試す
 */
async function testWorkspaceCreation() {
  console.log("\n======== ワークスペース作成強化テスト ========");
  
  // テストするバージョンとヘッダーの組み合わせ
  const testCombinations = [
    {
      name: "標準ヘッダー",
      url: `${config.baseUrl}/v1/workspaces`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ADMIN_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    },
    {
      name: "Betaヘッダー",
      url: `${config.baseUrl}/v1/workspaces`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ADMIN_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'workspaces-2023-10'
      }
    },
    {
      name: "最新バージョン",
      url: `${config.baseUrl}/v1/workspaces`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ADMIN_API_KEY,
        'anthropic-version': '2023-12-01'
      }
    },
    {
      name: "Admin API パス",
      url: `${config.baseUrl}/v1/admin/workspaces`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ADMIN_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'workspaces-2023-10'
      }
    },
    {
      name: "v1/workspace（単数形）",
      url: `${config.baseUrl}/v1/workspace`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ADMIN_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    },
    {
      name: "v2試行",
      url: `${config.baseUrl}/v2/workspaces`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ADMIN_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }
  ];
  
  // 各組み合わせをテスト
  for (const test of testCombinations) {
    console.log(`\n[POST] ${test.name} (${test.url})`);
    
    try {
      const response = await axios.post(test.url, config.testData.workspace, {
        headers: test.headers
      });
      
      console.log(`✅ 成功! ステータス: ${response.status}`);
      console.log(`データ: ${JSON.stringify(response.data)}`);
      
      // 成功した場合は詳細を返す
      return {
        success: true,
        combination: test.name,
        data: response.data
      };
    } catch (error) {
      if (error.response) {
        console.log(`❌ エラー! ステータス: ${error.response.status} - ${error.response.statusText}`);
        
        if (error.response.data) {
          console.log(`エラーデータ: ${JSON.stringify(error.response.data)}`);
        }
      } else {
        console.log(`❌ エラー: ${error.message}`);
      }
    }
  }
  
  return {
    success: false,
    message: "すべての組み合わせでワークスペース作成に失敗しました"
  };
}

/**
 * API詳細ドキュメントを取得して調査する（公開情報のみ）
 */
async function fetchApiDocumentation() {
  console.log("\n======== API詳細ドキュメント調査 ========");
  
  try {
    const response = await axios.get('https://docs.anthropic.com/claude/api/workspace-management');
    console.log(`✅ APIドキュメントページが存在します。詳細を解析してください。`);
    return true;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`❌ ワークスペース管理APIのドキュメントページが見つかりません。`);
      console.log(`👉 このAPIは非公開または開発中の可能性があります。`);
    } else {
      console.log(`❌ ドキュメント取得エラー: ${error.message}`);
    }
    return false;
  }
}

// メイン実行関数
async function main() {
  console.log("======== Anthropic Admin API 詳細テスト ========\n");
  console.log(`APIキー: ${ADMIN_API_KEY.substring(0, 10)}...`);
  
  // 基本エンドポイントテスト
  const results = {};
  
  for (const endpoint of config.endpoints) {
    results[endpoint.name] = await testEndpoint(endpoint);
  }
  
  // ドキュメント調査
  await fetchApiDocumentation();
  
  // 強化テスト
  const creationResult = await testWorkspaceCreation();
  
  // 結果サマリー
  console.log("\n======== テスト結果サマリー ========");
  
  const existingEndpoints = [];
  const validEndpoints = [];
  
  for (const [name, result] of Object.entries(results)) {
    const exists = result.exists !== false;
    const icon = result.valid ? "✅" : (exists ? "⚠️" : "❌");
    console.log(`${icon} ${name}: ${result.message}`);
    
    if (exists) {
      existingEndpoints.push(name);
    }
    
    if (result.valid) {
      validEndpoints.push(name);
    }
  }
  
  // 強化テスト結果
  console.log("\n======== ワークスペース作成テスト結果 ========");
  if (creationResult && creationResult.success) {
    console.log(`✅ ${creationResult.combination}で成功しました!`);
  } else {
    console.log(`❌ すべてのテストでワークスペース作成に失敗しました`);
  }
  
  // 結論と推奨事項
  console.log("\n======== 結論と推奨事項 ========");
  if (validEndpoints.length > 0) {
    console.log("有効なエンドポイント:");
    validEndpoints.forEach(name => {
      const endpoint = config.endpoints.find(e => e.name === name);
      console.log(`- ${name}: ${config.baseUrl}${endpoint.path}`);
    });
  } else if (existingEndpoints.length > 0) {
    console.log("存在するが認証が必要なエンドポイント:");
    existingEndpoints.forEach(name => {
      const endpoint = config.endpoints.find(e => e.name === name);
      console.log(`- ${name}: ${config.baseUrl}${endpoint.path}`);
    });
    console.log("\n👉 認証方法に問題がある可能性があります。ヘッダーを確認してください。");
  } else {
    console.log("❌ テストしたすべてのエンドポイントが無効です。");
    console.log("👉 ワークスペース管理APIは非公開か、APIデザインが大幅に変更された可能性があります。");
  }
  
  // 実装提案
  console.log("\n======== 実装提案 ========");
  console.log("1. モックモード実装: API呼び出しに失敗した場合、クライアント側でモックレスポンスを生成");
  console.log("2. ドキュメント外API発見: Anthropicに問い合わせて正確なAPIエンドポイントを確認");
  console.log("3. フォールバックUI実装: APIが使用できない場合、コンソールへのリンクを表示");
}

// 実行
main().catch(error => {
  console.error("テスト実行中にエラーが発生しました:", error);
});