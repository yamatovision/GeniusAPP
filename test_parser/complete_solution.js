// 完全な解決策 - ディレクトリツリーパーサー - 記号をすべて除去
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

// 完全な解決策 - 文字位置ベースのアプローチ
function completeTreeParser(text) {
  console.log('完全解決策パーサーで解析開始...');
  
  const result = [];
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // ルートディレクトリを特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].trim().endsWith('/')) {
    rootDir = lines[0].trim().replace('/', '');
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift();
  }
  
  // 各行のインデントレベルと名前を抽出
  const entries = [];
  
  for (const line of lines) {
    // 行の中から実際のファイル/ディレクトリ名を探す
    const nameMatch = line.match(/([^│├└─+|\\s]+[^│├└─+\\]*)$/);
    
    if (!nameMatch) continue; // パス部分が見つからない行はスキップ
    
    const name = nameMatch[1].trim();
    
    // パス部分の開始位置を取得（インデントレベルを計算するため）
    const pathStart = line.indexOf(nameMatch[1]);
    
    // 位置に基づいてインデントレベルを計算
    // 通常、4スペース（または記号+スペース）が1レベルのインデント
    const indentLevel = Math.floor(pathStart / 4);
    
    // ディレクトリかファイルかを判定
    const isDirectory = name.endsWith('/');
    
    // クリーンな名前（すべての記号を除去し、末尾のスラッシュも削除）
    let cleanName = name;
    cleanName = cleanName.replace(/^[│├└─+|\\s]+/, ''); // 先頭の記号を除去
    cleanName = isDirectory ? cleanName.slice(0, -1) : cleanName; // 末尾のスラッシュを除去
    
    // 一般的な記号パターンを除去
    cleanName = cleanName.replace(/^(├──|└──|│\s+├──|│\s+└──|\+--|\|--)\s+/, '');
    
    entries.push({
      indentLevel,
      isDirectory,
      name: cleanName,
      originalName: name
    });
    
    console.log(`行を解析: レベル=${indentLevel}, ディレクトリ=${isDirectory}, 名前="${cleanName}", 元の名前="${name}"`);
  }
  
  // ディレクトリスタック（階層構造の追跡用）
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
      console.log(`ディレクトリをスタックに追加: ${name}, レベル=${indentLevel}, スタック=${dirStack.slice(0, indentLevel + 1).join('/')}`);
    } else {
      // ファイルの場合はパスを構築
      const validDirs = dirStack.slice(0, indentLevel).filter(Boolean);
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

// 完全に記号を除去する特殊な関数
function cleanFileName(name) {
  // すべての一般的なディレクトリツリー記号を除去
  return name
    .replace(/^[│├└─+|\\s]+/, '') // 先頭の記号を除去
    .replace(/^(├──|└──|│\s+├──|│\s+└──|\+--|\|--)\s+/, '') // 一般的な記号パターンを除去
    .trim(); // 余分なスペースを除去
}

// VSCodeに統合する最終的な実装
function vscodeFinalParser(text) {
  console.log('\nVSCode最終実装...');
  
  const result = [];
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // ルートディレクトリを特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].trim().endsWith('/')) {
    rootDir = lines[0].trim().replace('/', '');
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift();
  }
  
  // 各行の文字位置を分析して「視覚的」なインデントレベルを計算
  const analyzedLines = [];
  
  // 最初にすべての行の位置を分析
  lines.forEach(line => {
    // 視覚的なトークン（実際のファイル/ディレクトリ名）の開始位置
    const visualTokenMatch = line.match(/([^\s│├└─+|\\][^│├└─+\\]*)$/);
    if (!visualTokenMatch) return;
    
    const token = visualTokenMatch[1];
    const tokenStart = line.indexOf(visualTokenMatch[1]);
    
    analyzedLines.push({
      original: line,
      token,
      tokenStart
    });
  });
  
  // トークン位置の中央値を求めてレベルを計算
  const positions = analyzedLines.map(line => line.tokenStart).sort((a, b) => a - b);
  const uniquePositions = [...new Set(positions)].sort((a, b) => a - b);
  
  // 位置からインデントレベルへのマッピング
  const positionToLevel = {};
  uniquePositions.forEach((pos, index) => {
    positionToLevel[pos] = index;
  });
  
  // 各行にインデントレベルを割り当て
  const entries = [];
  analyzedLines.forEach(line => {
    // インデントレベルを取得
    const indentLevel = positionToLevel[line.tokenStart];
    
    // 名前を正規化（すべての記号を除去）
    let name = line.token;
    const isDirectory = name.endsWith('/');
    
    // 記号をすべて除去
    name = cleanFileName(name);
    
    // ディレクトリの場合は末尾のスラッシュを除去
    if (isDirectory) {
      name = name.replace(/\/$/, '');
    }
    
    entries.push({
      indentLevel,
      isDirectory,
      name
    });
    
    console.log(`行の解析: レベル=${indentLevel}, ディレクトリ=${isDirectory}, 名前="${name}"`);
  });
  
  // ディレクトリのスタック
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
      console.log(`ディレクトリを追加: ${name}, 現在のパス: ${dirStack.slice(0, indentLevel + 1).join('/')}`);
    } else {
      // ファイルの場合はパスを構築
      const validDirs = dirStack.slice(0, indentLevel).filter(Boolean);
      const filePath = [...validDirs, name].join('/');
      
      // ルートディレクトリがある場合は付加
      const fullPath = rootDir ? `${rootDir}/${filePath}` : filePath;
      
      result.push({
        path: fullPath,
        content: `// ${fullPath}\n\n// このファイルは自動生成されたスケルトンです\n\n`
      });
      
      console.log(`ファイルを追加: ${fullPath}`);
    }
  });
  
  return result;
}

// テスト
testCases.forEach((testCase, index) => {
  console.log(`\n======= テストケース ${index + 1}: ${testCase.name} =======`);
  
  const files1 = completeTreeParser(testCase.input);
  console.log(`\n完全解決策パーサー結果: ${files1.length}個のファイルを抽出しました`);
  files1.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
  
  const files2 = vscodeFinalParser(testCase.input);
  console.log(`\nVSCode最終実装結果: ${files2.length}個のファイルを抽出しました`);
  files2.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
});