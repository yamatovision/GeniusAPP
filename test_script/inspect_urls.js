// APIエンドポイントを検査するツール
const fs = require('fs');
const path = require('path');

// distディレクトリのJSファイルをスキャン
function scanDistForUrls() {
  console.log('Scanning dist/extension.js for API URLs...');
  
  const distPath = path.join(__dirname, '..', 'dist', 'extension.js');
  
  if (\!fs.existsSync(distPath)) {
    console.error('Error: dist/extension.js not found');
    return;
  }
  
  const content = fs.readFileSync(distPath, 'utf8');
  
  // 使用量関連の呼び出しを検索
  const usagePatterns = [
    /\/usage\/current/g,
    /\/proxy\/usage\/me/g,
    /['"]\/?api\/([^'"]*usage[^'"]*)['"]/g
  ];
  
  usagePatterns.forEach(pattern => {
    console.log(`\nSearching for pattern: ${pattern}`);
    const matches = content.match(pattern);
    
    if (matches && matches.length > 0) {
      console.log(`Found ${matches.length} matches:`);
      matches.forEach((match, i) => {
        console.log(`  ${i+1}. ${match}`);
        
        // 周辺のコードスニペットを取得
        const index = content.indexOf(match);
        const start = Math.max(0, index - 100);
        const end = Math.min(content.length, index + match.length + 100);
        const snippet = content.substring(start, end);
        
        console.log(`\nCode snippet around match ${i+1}:`);
        console.log(snippet);
        console.log('-'.repeat(80));
      });
    } else {
      console.log('No matches found');
    }
  });
}

// 実行
scanDistForUrls();
