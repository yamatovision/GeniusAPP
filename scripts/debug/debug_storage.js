/**
 * セキュアストレージの内容を確認するためのデバッグスクリプト
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// セキュアストレージのデータパスを取得（VSCode互換）
function getSecureStoragePath() {
  let storagePath;
  
  // OSに応じたパスの構築
  if (process.platform === 'darwin') {
    // macOS
    storagePath = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'appgenius');
  } else if (process.platform === 'win32') {
    // Windows
    storagePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'appgenius');
  } else {
    // Linux
    storagePath = path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'appgenius');
  }
  
  return storagePath;
}

// 代替ストレージ位置を確認
function getAllPossibleStoragePaths() {
  const paths = [];
  
  // 標準的なVSCode拡張機能のストレージパス
  paths.push(getSecureStoragePath());
  
  // AppGeniusの認証保存場所
  paths.push(path.join(os.homedir(), '.appgenius'));
  
  // OS固有のアプリケーションサポートパス
  if (process.platform === 'darwin') {
    paths.push(path.join(os.homedir(), 'Library', 'Application Support', 'appgenius'));
  } else if (process.platform === 'win32') {
    paths.push(path.join(os.homedir(), 'AppData', 'Roaming', 'appgenius'));
  } else {
    paths.push(path.join(os.homedir(), '.config', 'appgenius'));
  }
  
  // 一時的なフォールバックパス
  paths.push(path.join(os.tmpdir(), 'appgenius-auth'));
  
  return paths;
}

// ファイル一覧を表示し、内容をチェック
function listAllFiles() {
  const paths = getAllPossibleStoragePaths();
  
  console.log('=== AppGenius関連ファイルの検索結果 ===');
  
  paths.forEach(dirPath => {
    console.log(`\n検索ディレクトリ: ${dirPath}`);
    
    try {
      if (!fs.existsSync(dirPath)) {
        console.log(`  ディレクトリが存在しません`);
        return;
      }
      
      const files = fs.readdirSync(dirPath);
      console.log(`  ファイル数: ${files.length}`);
      
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          console.log(`  📁 ${file}/`);
        } else {
          console.log(`  📄 ${file} (${stats.size} bytes)`);
          
          // 特定のファイルの内容を表示
          if (file === 'auth.json' || file === 'claude-auth.json' || file.includes('apiKey')) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              let parsedContent;
              
              try {
                parsedContent = JSON.parse(content);
                
                // APIキーなどの機密情報を部分的にマスク
                if (parsedContent.accessToken) {
                  const token = parsedContent.accessToken;
                  parsedContent.accessToken = token.substring(0, 10) + '...' + token.substring(token.length - 10);
                }
                
                if (parsedContent.keyValue) {
                  const key = parsedContent.keyValue;
                  parsedContent.keyValue = key.substring(0, 5) + '...' + key.substring(key.length - 5);
                }
                
                console.log(`    内容: ${JSON.stringify(parsedContent, null, 2)}`);
              } catch (e) {
                console.log(`    内容の解析に失敗: ${e.message}`);
                // バイナリファイルの場合は中身を表示しない
                if (content.length < 100) {
                  console.log(`    生データ: ${content}`);
                } else {
                  console.log(`    生データ: (${content.length} バイトのデータ、表示省略)`);
                }
              }
            } catch (readError) {
              console.log(`    ファイル読み取りエラー: ${readError.message}`);
            }
          }
        }
      });
    } catch (error) {
      console.error(`  ディレクトリ読み取りエラー: ${error.message}`);
    }
  });
}

// 実行
console.log('AppGenius関連のストレージ診断を開始します...');
listAllFiles();
console.log('\n診断完了');