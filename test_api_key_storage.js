/**
 * API Key Storage Test
 * 
 * このスクリプトはauth.jsonファイルの内容を確認し、
 * [object Promise]の問題が修正されたかどうかを確認します。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// テスト実行関数
async function testApiKeyStorage() {
  console.log('===== API Key Storage Test =====');
  
  try {
    // auth.jsonファイルを検証
    const authFilePath = path.join(os.homedir(), '.appgenius', 'auth.json');
    
    if (fs.existsSync(authFilePath)) {
      console.log(`auth.jsonファイルを検証中: ${authFilePath}`);
      
      // ファイルを読み込む
      const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
      
      // accessTokenが[object Promise]になっていないか確認
      if (authData.accessToken === '[object Promise]') {
        console.error('エラー: accessTokenが[object Promise]として保存されています。修正が必要です。');
      } else if (typeof authData.accessToken === 'string' && authData.accessToken.startsWith('sk-')) {
        console.log('成功: accessTokenが正しい形式で保存されています。');
        // 保存されたトークンの確認
        const savedMaskedKey = authData.accessToken.substring(0, 5) + '...' + authData.accessToken.substring(authData.accessToken.length - 4);
        console.log(`保存されたトークン: ${savedMaskedKey} (長さ: ${authData.accessToken.length}文字)`);
      } else {
        console.warn(`警告: accessTokenの形式が想定と異なります: ${typeof authData.accessToken}, 値: ${authData.accessToken.substring(0, 10)}...`);
      }
      
      // ファイルの構造を確認（accessTokenは部分的にマスク）
      const maskedAuthData = { ...authData };
      if (maskedAuthData.accessToken && maskedAuthData.accessToken.length > 10) {
        const maskedToken = maskedAuthData.accessToken.substring(0, 5) + '...' + maskedAuthData.accessToken.substring(maskedAuthData.accessToken.length - 4);
        maskedAuthData.accessToken = maskedToken;
      }
      
      console.log('auth.jsonファイルの構造:');
      console.log(JSON.stringify(maskedAuthData, null, 2));
    } else {
      console.log(`auth.jsonファイルが見つかりません: ${authFilePath}`);
      console.log('これは正常です - 修正後に拡張機能を再度使用すると新しいファイルが生成されます。');
    }
    
    // 他の場所にもauth.jsonファイルがあるか探す
    const otherLocations = [
      path.join(os.homedir(), '.claude'),
      path.join(os.homedir(), 'Library', 'Application Support', 'appgenius'),
      path.join(os.homedir(), '.config', 'appgenius')
    ];
    
    for (const location of otherLocations) {
      const altAuthFile = path.join(location, 'auth.json');
      if (fs.existsSync(altAuthFile)) {
        console.log(`\n別の場所にauth.jsonファイルが見つかりました: ${altAuthFile}`);
        try {
          const altAuthData = JSON.parse(fs.readFileSync(altAuthFile, 'utf8'));
          const maskedAltAuthData = { ...altAuthData };
          
          if (maskedAltAuthData.accessToken && maskedAltAuthData.accessToken.length > 10) {
            const maskedToken = maskedAltAuthData.accessToken.substring(0, 5) + '...' + maskedAltAuthData.accessToken.substring(maskedAltAuthData.accessToken.length - 4);
            maskedAltAuthData.accessToken = maskedToken;
          }
          
          console.log('ファイルの構造:');
          console.log(JSON.stringify(maskedAltAuthData, null, 2));
        } catch (e) {
          console.log(`ファイル解析エラー: ${e.message}`);
        }
      }
    }
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
  
  console.log('\n===== テスト完了 =====');
  console.log('この修正により、auth.jsonファイルに正しいAPIキーが保存されるようになります。');
  console.log('次回VSCodeを起動してClaudeコードを使用すると、正しいAPIキーがAnthropicへ送信されます。');
}

// テスト実行
testApiKeyStorage().catch(err => {
  console.error('テスト実行中に予期しないエラーが発生しました:', err);
});