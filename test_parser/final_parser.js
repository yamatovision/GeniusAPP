// 最終的なディレクトリツリーパーサー - シンプルで堅牢なアプローチ
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

// シンプルなアプローチでツリー構造を解析する関数
function parseDirectoryTree(text) {
  console.log('シンプルなパーサーで解析開始...');
  
  const files = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // ルートディレクトリを特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].endsWith('/')) {
    rootDir = lines[0].slice(0, -1); // スラッシュを削除
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift();
  }
  
  // 各行のインデントレベルとパス部分を解析
  const parsedLines = [];
  
  // 記号とそのインデントレベルのマッピング
  const symbolToIndent = {
    '├': 1, '└': 1, '│': 0, 
    // 以下は他の形式の記号
    '+': 1, '|': 0, '\\': 1
  };
  
  for (const line of lines) {
    // 行から記号を取り除いてファイル/ディレクトリ名を抽出
    let cleanLine = line;
    let indentLevel = 0;
    
    // パス部分を抽出するための正規表現
    // 様々な記号（├, └, │, +, |, \, ─ など）とスペースを考慮
    const pathMatch = line.match(/([^│├└─+|\\s]+.*)$/);
    
    if (pathMatch) {
      // パス部分の開始位置を取得
      const pathIndex = line.indexOf(pathMatch[1]);
      
      // インデントレベルを計算（文字位置に基づく）
      indentLevel = Math.floor(pathIndex / 2);
      
      // パス部分（記号なし）
      cleanLine = pathMatch[1];
    }
    
    // ディレクトリかファイルかを判断
    const isDirectory = cleanLine.endsWith('/');
    
    // 名前から余分な記号を削除
    let name = cleanLine;
    // ├── や └── などの記号とスペースを削除
    name = name.replace(/^[├└─+|\\]+\s+/, '');
    
    // ディレクトリの場合は末尾のスラッシュを削除
    if (isDirectory) {
      name = name.slice(0, -1);
    }
    
    parsedLines.push({
      originalLine: line,
      indentLevel,
      isDirectory,
      name
    });
    
    console.log(`行を解析: レベル=${indentLevel}, ディレクトリ=${isDirectory}, 名前=${name}`);
  }
  
  // ファイル構造を構築
  const pathStack = Array(20).fill(''); // 十分な深さのスタック
  
  for (let i = 0; i < parsedLines.length; i++) {
    const { indentLevel, isDirectory, name } = parsedLines[i];
    
    // 現在のインデントレベルにパス要素を設定
    pathStack[indentLevel] = name;
    
    // 現在のレベルより深いスタック要素をクリア
    for (let j = indentLevel + 1; j < pathStack.length; j++) {
      pathStack[j] = '';
    }
    
    if (isDirectory) {
      // ディレクトリの場合は次の項目のための情報を保持するだけ
      console.log(`ディレクトリをスタックに追加: ${name}, レベル=${indentLevel}`);
    } else {
      // ファイルの場合はパスを構築
      // 有効なパス要素だけを含める
      const validPath = pathStack.slice(0, indentLevel + 1).filter(p => p !== '');
      
      // ファイルのフルパスを構築
      let filePath = validPath.join('/');
      
      // ルートディレクトリがある場合は先頭に追加
      if (rootDir) {
        filePath = `${rootDir}/${filePath}`;
      }
      
      files.push({
        path: filePath,
        content: `// ${filePath}\n\n// このファイルは自動生成されたスケルトンです\n\n`
      });
      
      console.log(`ファイルを抽出: ${filePath}`);
    }
  }
  
  return files;
}

// 正規表現を使った別のアプローチ - より単純な方法
function parseWithRegex(text) {
  console.log('\n正規表現ベースのパーサーで解析開始...');
  
  const files = [];
  
  // ルートディレクトリ名を取得
  let rootDir = '';
  const rootMatch = text.match(/^\s*([^/\n]+)\/\s*$/m);
  if (rootMatch) {
    rootDir = rootMatch[1];
    console.log(`ルートディレクトリ: ${rootDir}`);
  }
  
  // 各行の内容とインデントレベルを解析
  const lines = text.split('\n');
  const entries = [];
  
  for (const line of lines) {
    // 空行をスキップ
    if (!line.trim()) continue;
    
    // ルートディレクトリ行をスキップ
    if (line.trim().match(/^[^/\n]+\/$/)) continue;
    
    // インデントレベル（先頭のスペース数）
    const leadingSpaces = line.match(/^\s*/)[0].length;
    const indentLevel = Math.floor(leadingSpaces / 2);
    
    // ファイル/ディレクトリ名部分を抽出（記号を含む可能性あり）
    const nameWithSymbols = line.trim();
    
    // 記号を取り除く
    const cleanName = nameWithSymbols.replace(/^[│├└─+|\\]+\s+/, '');
    
    // ディレクトリかファイルかを判断
    const isDirectory = cleanName.endsWith('/');
    
    // 最終的な名前
    const finalName = isDirectory ? cleanName.slice(0, -1) : cleanName;
    
    entries.push({
      indentLevel,
      isDirectory,
      name: finalName
    });
    
    console.log(`エントリ解析: レベル=${indentLevel}, ディレクトリ=${isDirectory}, 名前=${finalName}`);
  }
  
  // 各行のインデントレベルを相対的に計算し直す
  // 先頭の要素を基準にして、相対的な深さを決定
  if (entries.length > 0) {
    const baseIndent = entries[0].indentLevel;
    
    for (let i = 0; i < entries.length; i++) {
      entries[i].indentLevel = Math.max(0, entries[i].indentLevel - baseIndent);
    }
  }
  
  // ファイル構造を構築するためのスタック
  const dirStack = [];
  
  // 各エントリを処理
  for (const entry of entries) {
    const { indentLevel, isDirectory, name } = entry;
    
    // スタックの深さをインデントレベルに合わせる
    while (dirStack.length > indentLevel) {
      dirStack.pop();
    }
    
    if (isDirectory) {
      // ディレクトリをスタックに追加
      dirStack.push(name);
      console.log(`ディレクトリパスを追加: ${name}, 現在のスタック: ${dirStack.join('/')}`);
    } else {
      // ファイルの場合はパスを構築
      const dirPath = [...dirStack];
      const filePath = [...dirPath, name].join('/');
      
      // ルートディレクトリがある場合は先頭に追加
      const fullPath = rootDir ? `${rootDir}/${filePath}` : filePath;
      
      files.push({
        path: fullPath,
        content: `// ${fullPath}\n\n// このファイルは自動生成されたスケルトンです\n\n` 
      });
      
      console.log(`ファイルを抽出: ${fullPath}`);
    }
  }
  
  return files;
}

// すべてのテストケースでパーサーをテスト
testCases.forEach((testCase, index) => {
  console.log(`\n======= テストケース ${index + 1}: ${testCase.name} =======`);
  
  const files1 = parseDirectoryTree(testCase.input);
  console.log(`\nシンプルパーサーの結果: ${files1.length}個のファイルを抽出`);
  files1.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
  
  const files2 = parseWithRegex(testCase.input);
  console.log(`\n正規表現パーサーの結果: ${files2.length}個のファイルを抽出`);
  files2.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
});