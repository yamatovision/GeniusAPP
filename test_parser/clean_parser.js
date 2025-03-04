// クリーンなディレクトリツリーパーサー - シンプルで堅牢なアプローチ
const fs = require('fs');
const path = require('path');

// テスト用のツリー構造データ
const testCases = [
  {
    name: "標準的なツリー構造",
    input: `
myproject/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── Button.jsx
│   │   │   └── Navbar.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── About.jsx
│   │   └── app.jsx
│   └── styles/
│       ├── global.css
│       └── components.css
├── public/
│   ├── index.html
│   └── favicon.ico
└── package.json
`
  },
  {
    name: "深いネスト構造",
    input: `
deepnest/
├── level1/
│   ├── level2/
│   │   ├── level3/
│   │   │   ├── level4/
│   │   │   │   └── file.txt
│   │   │   └── file3.txt
│   │   └── file2.txt
│   └── file1.txt
└── root.txt
`
  }
];

// 最もシンプルで堅牢なアプローチ
function cleanPathParser(text) {
  console.log('クリーンなパス解析開始...');
  
  const result = [];
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // ルートディレクトリを特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].trim().endsWith('/')) {
    rootDir = lines[0].trim().replace('/', '');
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift();
  }
  
  // 行のインデントレベルを計算
  function getVisualIndent(line) {
    // インデントの視覚的な深さを計算
    // ├, │, └ などの記号を考慮
    const match = line.match(/^(\s*(?:[│├└─+|\\]\s*)*)/);
    if (!match) return 0;
    
    const indentPart = match[1];
    // 各記号は1つのインデントレベルとしてカウント
    return (indentPart.match(/[│├└─+|\\]/g) || []).length;
  }
  
  // 名前部分の抽出（記号を除く）
  function extractName(line) {
    // 最後の記号の後にあるパス部分を抽出
    const match = line.match(/[│├└─+|\\]\s+([^│├└─+|\\].+)$/);
    if (match) {
      return match[1].trim();
    }
    
    // 記号がない場合は行全体をトリム
    return line.trim();
  }
  
  // ディレクトリのスタック（階層構造を保持）
  const dirStack = [];
  
  // 各行を処理
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // インデントレベルを取得
    const indentLevel = getVisualIndent(line);
    
    // スタックをインデントレベルに合わせる
    while (dirStack.length > indentLevel) {
      dirStack.pop();
    }
    
    // ファイル名またはディレクトリ名を抽出（記号を除去）
    const name = extractName(line);
    
    // ディレクトリかファイルかを判定
    const isDirectory = name.endsWith('/');
    
    // クリーンな名前（末尾のスラッシュを除去）
    const cleanName = isDirectory ? name.slice(0, -1) : name;
    
    if (isDirectory) {
      // ディレクトリの場合はスタックに追加
      dirStack[indentLevel] = cleanName;
      console.log(`ディレクトリをスタックに追加: ${cleanName}, レベル=${indentLevel}`);
    } else {
      // ファイルの場合はスタックを使ってパスを構築
      // 有効なディレクトリパスのみを使用
      const validDirs = dirStack.slice(0, indentLevel).filter(d => d);
      
      // ファイルパスを作成
      const filePath = [...validDirs, cleanName].join('/');
      
      // ルートディレクトリがある場合は付加
      const fullPath = rootDir ? `${rootDir}/${filePath}` : filePath;
      
      result.push({
        path: fullPath,
        content: `// ${fullPath}\n\n// このファイルは自動生成されたスケルトンです\n\n`
      });
      
      console.log(`ファイルを抽出: ${fullPath}`);
    }
  }
  
  return result;
}

// Indentレベルを視覚的位置で計算する新アプローチ
function indentBasedParser(text) {
  console.log('\nインデント位置ベースのパーサー開始...');
  
  const result = [];
  const lines = text.split('\n').filter(line => line.length > 0);
  
  // ルートディレクトリを特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].trim().endsWith('/')) {
    rootDir = lines[0].trim().replace('/', '');
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift();
  }
  
  // 各行のインデント位置とパス情報を解析
  const entries = [];
  
  lines.forEach((line, index) => {
    // 実際のファイル/ディレクトリ名を抽出
    // 最後の記号の後のテキストを取得
    const nameMatch = line.match(/[│├└─+|\\][^\S\r\n]+([^│├└─+|\\].+)$/);
    if (!nameMatch) return; // マッチしない行はスキップ
    
    const name = nameMatch[1].trim();
    
    // ファイル/ディレクトリ名の開始位置を取得
    const startPos = line.indexOf(nameMatch[1]);
    
    // 位置から視覚的なインデントレベルを計算
    const indentLevel = Math.max(0, Math.floor(startPos / 4));
    
    // ディレクトリかファイルかを判定
    const isDirectory = name.endsWith('/');
    
    // クリーンな名前
    const cleanName = isDirectory ? name.slice(0, -1) : name;
    
    entries.push({
      line: index + 1,
      name: cleanName,
      indentLevel,
      isDirectory,
      startPos
    });
    
    console.log(`行 ${index+1}: レベル=${indentLevel}, 位置=${startPos}, ディレクトリ=${isDirectory}, 名前=${cleanName}`);
  });
  
  // 最初の要素のインデントを基準にする
  if (entries.length > 0) {
    const baseIndent = entries[0].indentLevel;
    entries.forEach(entry => {
      entry.indentLevel = Math.max(0, entry.indentLevel - baseIndent);
    });
  }
  
  // ディレクトリツリーを構築
  const dirStack = [];
  
  // 各エントリを処理
  entries.forEach(entry => {
    const { indentLevel, isDirectory, name } = entry;
    
    // スタックをインデントレベルに合わせる
    while (dirStack.length > indentLevel) {
      dirStack.pop();
    }
    
    if (isDirectory) {
      // ディレクトリはスタックに追加
      dirStack[indentLevel] = name;
      console.log(`ディレクトリパス: ${dirStack.slice(0, indentLevel + 1).join('/')}`);
    } else {
      // ファイルの場合はパスを構築
      const validDirs = dirStack.slice(0, indentLevel).filter(d => d);
      const filePath = [...validDirs, name].join('/');
      
      // ルートディレクトリがある場合は付加
      const fullPath = rootDir ? `${rootDir}/${filePath}` : filePath;
      
      result.push({
        path: fullPath,
        content: `// ${fullPath}\n\n// このファイルは自動生成されたスケルトンです\n\n`
      });
      
      console.log(`ファイルを抽出: ${fullPath}`);
    }
  });
  
  return result;
}

// 両方のパーサーでテスト
testCases.forEach((testCase, index) => {
  console.log(`\n======= テストケース ${index + 1}: ${testCase.name} =======`);
  
  const files1 = cleanPathParser(testCase.input);
  console.log(`\nクリーンパーサー結果: ${files1.length}個のファイルを抽出しました`);
  files1.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
  
  const files2 = indentBasedParser(testCase.input);
  console.log(`\nインデント位置ベースパーサー結果: ${files2.length}個のファイルを抽出しました`);
  files2.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
});