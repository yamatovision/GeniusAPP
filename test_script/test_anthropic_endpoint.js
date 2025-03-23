/**
 * Anthropic API エンドポイントテスト
 * 単純なテストでワークスペース作成エンドポイントを確認
 */
const axios = require('axios');

// テスト設定
const config = {
  // テストするAPIエンドポイント
  endpoints: [
    {
      name: "標準ワークスペースAPI",
      url: "https://api.anthropic.com/v1/workspaces",
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    },
    {
      name: "管理者ワークスペースAPI",
      url: "https://api.anthropic.com/v1/admin/workspaces",
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    },
    {
      name: "代替管理者ワークスペースAPI",
      url: "https://api.anthropic.com/v1/admin/organizations/workspaces",
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    }
  ],
  // テストユーザー情報
  testData: {
    name: `テストワークスペース-${Date.now()}`,
    description: "APIエンドポイントのテスト用"
  }
};

/**
 * 404エラーのみをチェックする単純なテスト
 * APIキーなしでもエンドポイントの存在確認は可能
 */
async function testEndpoint(endpoint) {
  console.log(`エンドポイントをテスト中: ${endpoint.name} (${endpoint.url})`);
  
  try {
    await axios.post(endpoint.url, config.testData, {
      headers: endpoint.headers
    });
    
    // ここには到達しないはず (APIキーがないため)
    return { valid: true, exists: true, message: "エンドポイントが存在し、アクセス可能です" };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      
      // 401 (Unauthorized) または 403 (Forbidden) はエンドポイントが存在することを示す
      if (status === 401 || status === 403) {
        return { 
          valid: true,
          exists: true,
          status,
          message: `エンドポイントが存在します (ステータス: ${status} - ${error.response.statusText})` 
        };
      }
      
      // 404 (Not Found) はエンドポイントが存在しないことを示す
      if (status === 404) {
        return { 
          valid: false,
          exists: false,
          status,
          message: `エンドポイントが存在しません (ステータス: ${status} - ${error.response.statusText})` 
        };
      }
      
      // その他のステータスコード
      return {
        valid: false,
        exists: true,
        status,
        message: `エンドポイントへのアクセスにエラーが発生しました (ステータス: ${status} - ${error.response.statusText})`
      };
    } else if (error.request) {
      // リクエストは送信されたがレスポンスがない
      return { 
        valid: false,
        exists: null,
        message: "サーバーからの応答がありませんでした" 
      };
    } else {
      // リクエスト設定時のエラー
      return { 
        valid: false,
        exists: null,
        message: `リクエスト設定エラー: ${error.message}` 
      };
    }
  }
}

// メイン実行関数
async function main() {
  console.log("======== Anthropic API エンドポイントテスト ========\n");
  
  const results = {};
  
  // 各エンドポイントをテスト
  for (const endpoint of config.endpoints) {
    results[endpoint.name] = await testEndpoint(endpoint);
    console.log(`結果: ${results[endpoint.name].message}`);
    console.log("-".repeat(50));
  }
  
  // 結果の表示
  console.log("\n======== テスト結果サマリー ========");
  for (const [name, result] of Object.entries(results)) {
    const icon = result.exists === true ? "✅" : result.exists === false ? "❌" : "⚠️";
    console.log(`${icon} ${name}: ${result.message}`);
  }
  
  // 推奨エンドポイントの表示
  console.log("\n======== 推奨エンドポイント ========");
  const validEndpoints = Object.entries(results)
    .filter(([_, result]) => result.exists === true)
    .map(([name, _]) => name);
    
  if (validEndpoints.length > 0) {
    console.log(`以下のエンドポイントが有効です：`);
    validEndpoints.forEach(name => {
      const endpoint = config.endpoints.find(e => e.name === name);
      console.log(`- ${name}: ${endpoint.url}`);
    });
    
    // 通常のワークスペースAPIが有効であれば、それを推奨
    if (validEndpoints.includes("標準ワークスペースAPI")) {
      console.log("\n✨ 推奨: 標準ワークスペースAPI (https://api.anthropic.com/v1/workspaces)");
      console.log("シンプルな認証を使用するためには、このエンドポイントを使用してください。");
    } else {
      console.log("\n⚠️ 標準ワークスペースAPIが有効ではないようです。");
      console.log("管理者権限を持つAPIキーが必要な可能性があります。");
    }
  } else {
    console.log("❌ テストしたすべてのエンドポイントが無効です。");
    console.log("Anthropic APIの仕様が変更された可能性があります。");
    console.log("最新のAnthropicドキュメントを確認してください。");
  }
}

// 実行
main().catch(error => {
  console.error("テスト実行中にエラーが発生しました:", error);
});