/**
 * API接続テストスクリプト
 * ClaudeCode起動カウンター更新APIの接続性を確認します
 */

const axios = require('axios');
const readline = require('readline');

// ユーザー入力を受け付ける関数
const prompt = async (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

// メイン処理
const main = async () => {
  try {
    console.log('===== ClaudeCode起動カウンターAPI接続テスト =====');
    
    // ユーザーIDの入力
    const userId = await prompt('テスト対象のユーザーIDを入力してください: ');
    if (!userId) {
      console.error('ユーザーIDが指定されていません');
      return;
    }
    
    // 認証情報の入力
    console.log('\n認証方法を選択してください:');
    console.log('1) Bearerトークン');
    console.log('2) APIキー');
    console.log('3) 認証なし（ローカル環境のみ）');
    
    const authType = await prompt('選択 (1-3): ');
    let authHeader = {};
    
    switch (authType) {
      case '1':
        const token = await prompt('Bearerトークンを入力してください: ');
        authHeader = { 'Authorization': `Bearer ${token}` };
        break;
      case '2':
        const apiKey = await prompt('APIキーを入力してください: ');
        authHeader = { 'x-api-key': apiKey };
        break;
      case '3':
        console.log('認証なしで続行します（ローカル環境の場合のみ動作します）');
        break;
      default:
        console.error('無効な選択です');
        return;
    }
    
    // Content-Typeを追加
    authHeader['Content-Type'] = 'application/json';
    
    // テスト対象のURIベースを選択
    console.log('\nテスト環境を選択してください:');
    console.log('1) ローカル環境（http://localhost:3000）');
    console.log('2) 開発環境（カスタムURL）');
    
    const envType = await prompt('選択 (1-2): ');
    let baseUrl;
    
    switch (envType) {
      case '1':
        baseUrl = 'http://localhost:3000';
        break;
      case '2':
        baseUrl = await prompt('開発環境のベースURLを入力してください: ');
        break;
      default:
        console.error('無効な選択です');
        return;
    }
    
    // エンドポイントパターンを設定
    const endpoints = [
      `/api/simple/users/${userId}/increment-claude-code-launch`,
      `/simple/users/${userId}/increment-claude-code-launch`
    ];
    
    // タイムアウト設定
    const timeout = 10000; // 10秒
    
    // 各エンドポイントをテスト
    for (const endpoint of endpoints) {
      const fullUrl = `${baseUrl}${endpoint}`;
      console.log(`\n----- テスト: ${fullUrl} -----`);
      
      try {
        console.log('リクエスト送信中...');
        
        // タイムスタンプでリクエスト開始時間を記録
        const startTime = Date.now();
        
        const response = await axios.post(
          fullUrl,
          {}, // 空のリクエストボディ
          {
            headers: authHeader,
            timeout: timeout
          }
        );
        
        // 応答時間を計算
        const responseTime = Date.now() - startTime;
        
        // 成功レスポンス
        console.log(`✅ ステータス: ${response.status} ${response.statusText}`);
        console.log(`✅ 応答時間: ${responseTime}ms`);
        console.log('✅ レスポンスデータ:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // 成功した場合、次のエンドポイントはテストしない
        break;
      } catch (error) {
        // エラーレスポンス
        console.error(`❌ エラー: ${error.message}`);
        
        if (axios.isAxiosError(error)) {
          if (error.response) {
            // サーバーからのエラーレスポンス
            console.error(`❌ ステータス: ${error.response.status}`);
            console.error('❌ レスポンスデータ:');
            console.error(JSON.stringify(error.response.data, null, 2));
          } else if (error.request) {
            // リクエストは送信されたがレスポンスがない
            console.error('❌ リクエストは送信されましたがレスポンスがありません');
            console.error('❌ タイムアウトの可能性があります');
          }
        }
        
        // 次のエンドポイントを試行するためのプロンプト
        if (endpoint !== endpoints[endpoints.length - 1]) {
          const retry = await prompt('次のエンドポイントを試行しますか？(y/n): ');
          if (retry.toLowerCase() !== 'y') {
            break;
          }
        }
      }
    }
    
    console.log('\n===== テスト完了 =====');
    
  } catch (error) {
    console.error('予期しないエラーが発生しました:', error);
  }
};

// スクリプト実行
main().catch(console.error);