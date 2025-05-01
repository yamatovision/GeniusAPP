/**
 * ClaudeCode起動カウンターを直接更新するスクリプト（修正版）
 * APIキーを使用して認証し、シラン.タツヤさん（67e207d18ccc8aab3e3b6a8f）の
 * カウンターを更新します
 */

const axios = require('axios');

// 設定
const BASE_URL = 'https://appgenius-portal-backend-235426778039.asia-northeast1.run.app/api';
const USER_ID = '67e207d18ccc8aab3e3b6a8f'; // シラン.タツヤさんのID

// APIキーを設定してください（必要に応じて）
const API_KEY = 'sk-ant-xxxxxxxxxx'; // 実際のAPIキーに置き換えてください

// 直接カウンターを更新する関数
async function incrementClaudeCodeLaunchCount() {
  try {
    console.log(`ClaudeCode起動カウンターを更新します: ユーザーID ${USER_ID}`);
    
    // APIエンドポイントURL
    const url = `${BASE_URL}/simple/users/${USER_ID}/increment-claude-code-launch`;
    console.log(`API呼び出しURL: ${url}`);

    // APIヘッダーを設定（認証情報を含む）
    const headers = {
      'Content-Type': 'application/json'
    };

    // APIキーが提供されている場合はヘッダーに追加
    if (API_KEY && API_KEY.startsWith('sk-ant-')) {
      headers['x-api-key'] = API_KEY;
      console.log('APIキーを使用して認証します');
    } else {
      console.log('警告: APIキーが設定されていないか、無効です');
    }
    
    // リクエスト設定の詳細ログ
    console.log(`ヘッダー情報: ${JSON.stringify(headers)}`);
    
    // APIリクエスト送信
    console.log(`API呼び出し開始`);
    const response = await axios.post(url, {}, { headers });
    
    // レスポンス分析
    console.log(`API呼び出しステータス: ${response.status}`);
    console.log(`APIレスポンス: ${JSON.stringify(response.data)}`);
    
    if (response.status === 200) {
      const newCount = response.data?.data?.claudeCodeLaunchCount || 'N/A';
      const isSuccess = response.data?.success === true;
      console.log(`ClaudeCode起動カウンター更新成功: 新しい値=${newCount}, 成功フラグ=${isSuccess}`);
      return true;
    }
    
    console.log(`ClaudeCode起動カウンター更新：予期しないレスポンス (${response.status})`);
    return false;
  } catch (error) {
    console.error('ClaudeCode起動カウンター更新エラー:', error);
    
    // エラーの詳細を分析
    if (error.response) {
      console.error(`APIエラー: ステータス=${error.response.status}, データ=${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error(`APIエラー: リクエストは送信されましたがレスポンスがありません`);
    } else {
      console.error(`APIエラー: リクエスト設定中にエラーが発生しました: ${error.message}`);
    }
    
    // URL情報
    if (error.config?.url) {
      console.error(`APIエラー: URL=${error.config.url}`);
    }
    
    return false;
  }
}

// スクリプト実行
incrementClaudeCodeLaunchCount()
  .then(success => {
    console.log(`APIリクエスト結果: ${success ? '成功' : '失敗'}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('予期しないエラーが発生しました:', err);
    process.exit(1);
  });