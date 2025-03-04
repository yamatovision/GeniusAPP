// 最終的なディレクトリツリーパーサー実装
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

// 完全な最終実装 - VSCode拡張用
function finalImplementation(text) {
  console.log('最終実装パーサーで解析開始...');
  
  const result = [];
  // 空行を削除
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // ルートディレクトリを特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].trim().endsWith('/')) {
    rootDir = lines[0].trim().replace('/', '');
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift();
  }
  
  // 各行の情報を解析
  const entries = [];
  
  // 各行のインデントレベルと名前を抽出
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimRight(); // 行末のスペースを削除
    
    // インデントレベルを計算するための位置ベースのアプローチ
    let indentLevel = 0;
    let indentChars = 0;
    
    // 行の先頭からの文字を調べ、記号やスペースをカウント
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === ' ' || char === '│' || char === '├' || char === '└' || char === '─' || 
          char === '+' || char === '|' || char === '\\') {
        indentChars++;
      } else {
        break;
      }
    }
    
    // 文字数からインデントレベルを計算（通常4文字で1レベル）
    indentLevel = Math.floor(indentChars / 4);
    
    // ファイル/ディレクトリ名部分を抽出
    let name = line.trim();
    
    // 記号を完全に除去するための強力な正規表現
    name = name.replace(/^[│├└─+|\\]*\s*/, '');
    name = name.replace(/^(├──|└──|│\s+├──|│\s+└──|\+--|\|--)\s+/, '');
    
    // ディレクトリかファイルかを判断
    const isDirectory = name.endsWith('/');
    
    // クリーンな名前（末尾のスラッシュを除去）
    name = isDirectory ? name.slice(0, -1) : name;
    
    entries.push({
      line: i + 1,
      indentLevel,
      isDirectory,
      name
    });
    
    console.log(`行 ${i+1}: レベル=${indentLevel}, ディレクトリ=${isDirectory}, 名前="${name}"`);
  }
  
  // インデントレベルを確認して最初のレベルが0でない場合は調整
  if (entries.length > 0 && entries[0].indentLevel > 0) {
    const baseLevel = entries[0].indentLevel;
    entries.forEach(entry => {
      entry.indentLevel = Math.max(0, entry.indentLevel - baseLevel);
    });
  }
  
  // ディレクトリスタック（階層構造の管理用）
  const dirStack = [];
  
  // 各エントリを処理
  entries.forEach(entry => {
    const { indentLevel, isDirectory, name } = entry;
    
    // スタックをインデントレベルに合わせる
    while (dirStack.length > indentLevel) {
      dirStack.pop();
    }
    
    if (isDirectory) {
      // ディレクトリをスタックに追加
      dirStack[indentLevel] = name;
      console.log(`ディレクトリを追加: ${name}, 現在のパス: ${dirStack.slice(0, indentLevel + 1).join('/')}`);
    } else {
      // ファイルの場合はパスを構築
      // 有効なディレクトリパス（空でない要素のみ）
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

// テスト実行
testCases.forEach((testCase, index) => {
  console.log(`\n======= テストケース ${index + 1}: ${testCase.name} =======`);
  
  const files = finalImplementation(testCase.input);
  console.log(`\n最終実装結果: ${files.length}個のファイルを抽出しました`);
  files.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
});

// VSCode拡張用の最終関数
function parseDirectoryTree(text) {
  // 空行を削除
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  const result = [];
  
  // ルートディレクトリを特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].trim().endsWith('/')) {
    rootDir = lines[0].trim().replace('/', '');
    lines.shift();
  }
  
  // エントリ情報の配列
  const entries = [];
  
  // 各行のインデントレベルと名前を抽出
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimRight();
    
    // インデントレベルを計算
    let indentChars = 0;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === ' ' || char === '│' || char === '├' || char === '└' || char === '─' || 
          char === '+' || char === '|' || char === '\\') {
        indentChars++;
      } else {
        break;
      }
    }
    
    // インデントレベルを計算（4文字で1レベル）
    const indentLevel = Math.floor(indentChars / 4);
    
    // 名前部分を抽出して記号を除去
    let name = line.trim();
    name = name.replace(/^[│├└─+|\\]*\s*/, '');
    name = name.replace(/^(├──|└──|│\s+├──|│\s+└──|\+--|\|--)\s+/, '');
    
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
  
  // 最初のエントリのインデントレベルを基準に調整
  if (entries.length > 0 && entries[0].indentLevel > 0) {
    const baseLevel = entries[0].indentLevel;
    entries.forEach(entry => {
      entry.indentLevel = Math.max(0, entry.indentLevel - baseLevel);
    });
  }
  
  // ディレクトリスタック
  const dirStack = [];
  
  // 各エントリを処理
  entries.forEach(entry => {
    const { indentLevel, isDirectory, name } = entry;
    
    // スタックをインデントレベルに合わせる
    while (dirStack.length > indentLevel) {
      dirStack.pop();
    }
    
    if (isDirectory) {
      // ディレクトリをスタックに追加
      dirStack[indentLevel] = name;
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
    }
  });
  
  return result;
}

// 最終的なVSCode実装を表示
console.log("\n最終的なVSCode実装関数:");
console.log(parseDirectoryTree.toString());