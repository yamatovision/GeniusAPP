// 階層構造のパーサーをテストするスクリプト
const fs = require('fs');
const path = require('path');

// テスト用のツリー構造データ - 様々な形式をテスト
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
  },
  {
    name: "スペースと特殊文字を含む構造",
    input: `
my project/
├── special chars/
│   ├── file-with-dash.txt
│   └── file with spaces.txt
├── .hidden/
│   └── .config.json
└── package-lock.json
`
  },
  {
    name: "シンプルな形式",
    input: `
project/
  src/
    index.js
    utils.js
  dist/
    bundle.js
  README.md
`
  },
  {
    name: "変則的な記号を使用",
    input: `
project/
+-- src/
|   +-- index.js
|   \-- utils.js
+-- dist/
|   \-- bundle.js
\-- README.md
`
  }
];

// エラー出力用の関数
function logError(message) {
  console.error('\x1b[31m%s\x1b[0m', message);
}

// 成功出力用の関数
function logSuccess(message) {
  console.log('\x1b[32m%s\x1b[0m', message);
}

// インデントレベルを計算する関数
function getIndentLevel(line) {
  // インデント記号の数を数える
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if ('│├└─+|\\ '.includes(line[i])) {
      count++;
    } else {
      break;
    }
  }
  return Math.ceil(count / 2); // 2文字で1レベルとする
}

// メイン解析関数
function parseTreeStructure(text) {
  console.log('解析を開始します...');
  const result = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // ルートディレクトリ名を特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].endsWith('/')) {
    rootDir = lines[0].replace('/', '');
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift(); // ルート行を削除
  }
  
  // 各行のインデントレベルを計算
  const lineInfo = lines.map(line => {
    // インデントレベルを計算
    const indentLevel = getIndentLevel(line);
    
    // 実際のパス部分を抽出（インデントと記号を除去）
    const pathPart = line.replace(/^[│├└─+|\\s]+/, '').trim();
    
    return {
      indentLevel,
      isDirectory: pathPart.endsWith('/'),
      pathPart: pathPart.endsWith('/') ? pathPart.slice(0, -1) : pathPart
    };
  });
  
  // デバッグ用にインデントレベルを表示
  lineInfo.forEach((info, index) => {
    console.log(`行 ${index+1}: レベル=${info.indentLevel}, ディレクトリ=${info.isDirectory}, パス=${info.pathPart}`);
  });
  
  // パスの構築用
  const pathStack = [];
  
  for (let i = 0; i < lineInfo.length; i++) {
    const { indentLevel, isDirectory, pathPart } = lineInfo[i];
    
    // スタックをインデントレベルに合わせる
    while (pathStack.length > indentLevel) {
      pathStack.pop();
    }
    
    if (isDirectory) {
      pathStack[indentLevel] = pathPart;
    } else {
      // スタックの有効な部分だけを取得
      const validStack = pathStack.slice(0, indentLevel);
      
      // ファイルパスを構築
      const filePath = [...validStack, pathPart].join('/');
      
      result.push({
        path: filePath,
        content: `// ${filePath}\n\n// このファイルは自動生成されたスケルトンです\n\n`
      });
      
      console.log(`ファイルパスを抽出: ${filePath}, スタック: ${JSON.stringify(validStack)}`);
    }
  }
  
  return result;
}

// 全てのテストケースを実行
let passedTests = 0;
const totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`\n======= テストケース ${index + 1}: ${testCase.name} =======`);
  
  try {
    const files = parseTreeStructure(testCase.input);
    
    if (files.length > 0) {
      logSuccess(`成功: ${files.length}個のファイルを抽出しました`);
      console.log('抽出されたファイル:');
      files.forEach((file, i) => {
        console.log(`${i + 1}. ${file.path}`);
      });
      passedTests++;
    } else {
      logError('失敗: ファイルが抽出されませんでした');
    }
  } catch (error) {
    logError(`エラー: ${error.message}`);
    console.error(error);
  }
});

console.log(`\n======= テスト結果 =======`);
console.log(`${passedTests}/${totalTests} テストに成功しました`);

// ディレクトリが正しく作成されるかをテスト
function testDirectoryCreation() {
  console.log('\n======= ディレクトリ作成テスト =======');
  
  // テストケース1のファイルを使用
  const testFiles = parseTreeStructure(testCases[0].input);
  const testRoot = path.join(__dirname, 'test_output');
  
  // ルートディレクトリを作成
  if (!fs.existsSync(testRoot)) {
    fs.mkdirSync(testRoot, { recursive: true });
  }
  
  // 各ファイルパスからディレクトリを抽出
  const dirPaths = new Set();
  
  testFiles.forEach(file => {
    const parts = file.path.split('/');
    if (parts.length > 1) {
      const dirPath = parts.slice(0, -1).join('/');
      dirPaths.add(dirPath);
    }
  });
  
  // ディレクトリパスを階層順（浅い順）にソート
  const sortedDirPaths = Array.from(dirPaths).sort((a, b) => 
    a.split('/').length - b.split('/').length
  );
  
  console.log(`作成予定のディレクトリ: ${sortedDirPaths.length}件`);
  sortedDirPaths.forEach((dirPath, index) => {
    console.log(`${index + 1}. ${dirPath}`);
  });
  
  // ファイルパスを表示
  console.log(`\n作成予定のファイル: ${testFiles.length}件`);
  testFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file.path}`);
  });
}

// ディレクトリ作成テストを実行
testDirectoryCreation();