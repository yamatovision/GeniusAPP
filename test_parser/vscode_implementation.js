/**
 * 完全なディレクトリツリーパーサー - VSCode実装用
 * ツリー形式のディレクトリ構造からファイルパスを抽出する
 * 
 * @param {string} text - ディレクトリ構造のテキスト
 * @returns {Array<{path: string, content: string}>} - 抽出されたファイルパス情報の配列
 */
function parseDirectoryTree(text) {
  // 処理対象の行を取得（空行を除去）
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const result = [];
  
  // ルートディレクトリを特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].trim().endsWith('/')) {
    rootDir = lines[0].trim().replace('/', '');
    lines.shift();
  }
  
  // 各行のエントリ情報を格納する配列
  const entries = [];
  
  // 各行の情報を抽出
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // インデントと記号を数えてレベルを計算
    let indentCount = 0;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (/[\s│├└─+|\\]/.test(char)) {
        indentCount++;
      } else {
        break;
      }
    }
    
    // 4文字で1レベルのインデント（通常の表示では2スペースだが、Unicode記号のため4文字に調整）
    const indentLevel = Math.floor(indentCount / 4);
    
    // ファイル/ディレクトリ名を抽出（記号を完全に除去）
    let name = line.trim();
    
    // 段階的に記号を除去（複数のパターンに対応）
    name = name.replace(/^[│├└─+|\\]*\s*/, ''); // 先頭の記号を除去
    name = name.replace(/^(├──|└──|│\s+├──|│\s+└──|\+--|\|--)\s+/, ''); // 一般的な記号パターンを除去
    
    // ディレクトリかファイルかを判断
    const isDirectory = name.endsWith('/');
    
    // クリーンな名前
    const cleanName = isDirectory ? name.slice(0, -1) : name;
    
    entries.push({
      indentLevel,
      isDirectory,
      name: cleanName
    });
  }
  
  // 最初のエントリのインデントレベルを基準に調整（相対的なインデントにする）
  if (entries.length > 0 && entries[0].indentLevel > 0) {
    const baseLevel = entries[0].indentLevel;
    for (let i = 0; i < entries.length; i++) {
      entries[i].indentLevel = Math.max(0, entries[i].indentLevel - baseLevel);
    }
  }
  
  // ディレクトリスタック（階層構造を管理）
  const dirStack = [];
  
  // 各エントリを処理
  for (let i = 0; i < entries.length; i++) {
    const { indentLevel, isDirectory, name } = entries[i];
    
    // スタックをインデントレベルに合わせる（深すぎるレベルを削除）
    while (dirStack.length > indentLevel) {
      dirStack.pop();
    }
    
    if (isDirectory) {
      // ディレクトリの場合はスタックに追加
      dirStack[indentLevel] = name;
    } else {
      // ファイルの場合はパスを構築
      // 有効なディレクトリパスのみを使用（空でない要素のみ）
      const validDirs = dirStack.slice(0, indentLevel).filter(dir => dir && dir.length > 0);
      const filePath = [...validDirs, name].join('/');
      
      // ルートディレクトリがある場合は付加
      const fullPath = rootDir ? `${rootDir}/${filePath}` : filePath;
      
      result.push({
        path: fullPath,
        content: `// ${fullPath}\n\n// このファイルは自動生成されたスケルトンです\n\n`
      });
    }
  }
  
  return result;
}

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
  },
  {
    name: "シンプルな表示形式",
    input: `
project/
  src/
    index.js
    utils.js
  dist/
    bundle.js
  README.md
`
  }
];

// テスト関数
function testParser() {
  testCases.forEach((testCase, index) => {
    console.log(`\n======= テストケース ${index + 1}: ${testCase.name} =======`);
    
    const files = parseDirectoryTree(testCase.input);
    console.log(`\n結果: ${files.length}個のファイルを抽出しました`);
    files.forEach((file, i) => {
      console.log(`${i + 1}. ${file.path}`);
    });
  });
}

// テスト実行
testParser();