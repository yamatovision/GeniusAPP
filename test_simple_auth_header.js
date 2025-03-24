/**
 * シンプル認証とClaudeCodeAPIの統合テスト
 * 
 * 認証処理とAPI接続テストの挙動を検証するためのテストスクリプト
 */

const axios = require('axios');
const vscode = require('vscode');

/**
 * VS Codeからシークレットストレージを取得
 * この関数は実際のVS Code環境でのみ動作します
 */
async function getSecretToken() {
  try {
    // 拡張機能のコンテキストを取得（VS Codeの拡張機能コンテキスト）
    const context = vscode.extensions.getExtension('yamatovision.appgenius-ai').exports.getExtensionContext();
    const secretStorage = context.secrets;
    
    // SimpleAuthのアクセストークンを取得
    const accessToken = await secretStorage.get('appgenius.simple.accessToken');
    return accessToken;
  } catch (error) {
    console.error('エラー: シークレットトークンの取得に失敗しました', error);
    return null;
  }
}

/**
 * SimpleAuth用のURL（ローカル環境）でAPI接続テスト
 */
async function testSimpleAuthLocalEndpoint(token) {
  try {
    console.log('--- SimpleAuthローカルエンドポイントのテスト (非推奨) ---');
    console.log('※ このエンドポイントはAPI_BASE_URL変更後は機能しません');
    const response = await axios.get('http://localhost:3001/simple/auth/check', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000 // 5秒タイムアウト
    });
    console.log('結果: 成功', response.status);
    console.log('データ:', response.data);
    return true;
  } catch (error) {
    console.error('エラー: SimpleAuthローカルエンドポイントでの検証に失敗しました');
    if (error.response) {
      console.error('ステータス:', error.response.status);
      console.error('レスポンスデータ:', error.response.data);
    } else {
      console.error('エラー詳細:', error.message);
    }
    return false;
  }
}

/**
 * ClaudeCodeAPI用のURL（本番環境）でAPI接続テスト
 */
async function testProductionEndpoint(token) {
  try {
    console.log('--- 本番環境エンドポイントのテスト ---');
    const response = await axios.get('https://geniemon-portal-backend-production.up.railway.app/api/simple/auth/check', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000 // 5秒タイムアウト
    });
    console.log('結果: 成功', response.status);
    console.log('データ:', response.data);
    return true;
  } catch (error) {
    console.error('エラー: 本番環境エンドポイントでの検証に失敗しました');
    if (error.response) {
      console.error('ステータス:', error.response.status);
      console.error('レスポンスデータ:', error.response.data);
    } else {
      console.error('エラー詳細:', error.message);
    }
    return false;
  }
}

/**
 * APIプロキシを使用したトークン使用履歴記録テスト
 */
async function testApiProxyEndpoint(token) {
  try {
    console.log('--- APIプロキシエンドポイントのテスト ---');
    const response = await axios.post('https://geniemon-portal-backend-production.up.railway.app/api/proxy/usage/record', {
      tokenCount: 100,
      modelId: 'claude-3-opus-20240229',
      context: 'test'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000 // 5秒タイムアウト
    });
    console.log('結果: 成功', response.status);
    console.log('データ:', response.data);
    return true;
  } catch (error) {
    console.error('エラー: APIプロキシエンドポイントでの検証に失敗しました');
    if (error.response) {
      console.error('ステータス:', error.response.status);
      console.error('レスポンスデータ:', error.response.data);
    } else {
      console.error('エラー詳細:', error.message);
    }
    return false;
  }
}

/**
 * テスト実行のメイン関数
 */
async function main() {
  console.log('=== API接続テスト開始 ===');
  
  // テスト用のトークン（VS Codeコマンド実行時は自動的に取得されます）
  let token = process.env.TEST_TOKEN || await getSecretToken();
  
  if (!token) {
    console.error('エラー: 認証トークンがありません。テストを実行できません。');
    console.log('ヒント: プログラムに環境変数TEST_TOKENを設定するか、VS Code拡張機能内から実行してください。');
    return;
  }
  
  console.log('トークンの存在: あり');
  
  // 各環境でのテスト実行
  const localSuccess = await testSimpleAuthLocalEndpoint(token);
  const productionSuccess = await testProductionEndpoint(token);
  const proxySuccess = await testApiProxyEndpoint(token);
  
  // テスト結果のまとめ
  console.log('\n=== テスト結果のまとめ ===');
  console.log(`SimpleAuthローカルエンドポイント: ${localSuccess ? '成功 ✅' : '失敗 ❌'}`);
  console.log(`本番環境エンドポイント: ${productionSuccess ? '成功 ✅' : '失敗 ❌'}`);
  console.log(`APIプロキシエンドポイント: ${proxySuccess ? '成功 ✅' : '失敗 ❌'}`);
  
  if (!localSuccess || !productionSuccess) {
    console.log('\n問題の可能性:');
    console.log('1. SimpleAuthServiceのAPI_BASE_URLが不正か、アクセスできないURLを指定している');
    console.log('2. 認証トークンの有効期限が切れている');
    console.log('3. ネットワークの接続問題');
    console.log('4. サーバー側の認証処理に問題がある');
    
    console.log('\n解決策の候補:');
    console.log('1. SimpleAuthServiceのAPI_BASE_URLを修正する');
    console.log('2. システムを再起動して新しいトークンを取得する');
    console.log('3. ネットワーク接続を確認する');
  }
}

// テスト実行
main().catch(error => {
  console.error('テスト実行エラー:', error);
});