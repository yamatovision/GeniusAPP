// 改良版ディレクトリツリーパーサー
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

// 改良版パーサー
function parseTreeStructure(text) {
  console.log('改良版パーサーで解析開始...');
  
  const result = [];
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // ルートディレクトリ名を特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].endsWith('/')) {
    rootDir = lines[0].replace('/', '');
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift(); // ルート行を削除
  }
  
  // 各行のパスとレベルを抽出
  const parsedLines = [];
  
  for (const line of lines) {
    // インデントレベルを計算（記号の数ではなく、視覚的な深さで）
    let indentCount = 0;
    let symbolsFound = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if ('│├└─+|\\ '.includes(char)) {
        symbolsFound = true;
      } else {
        if (symbolsFound) {
          // 記号の後に最初の非記号文字が見つかった
          indentCount++;
          symbolsFound = false;
        }
      }
    }
    
    // 実際のパス部分を抽出（インデントと記号を除去）
    const pathMatch = line.match(/[^│├└─+|\\s]+.*$/);
    const pathPart = pathMatch ? pathMatch[0].trim() : '';
    
    parsedLines.push({
      originalLine: line,
      indentLevel: indentCount,
      isDirectory: pathPart.endsWith('/'),
      pathPart: pathPart.endsWith('/') ? pathPart.slice(0, -1) : pathPart
    });
  }
  
  // インデントパターンに基づいて別の方法でレベルを計算
  const calculatedLevels = [];
  let previousLevel = 0;
  
  for (let i = 0; i < parsedLines.length; i++) {
    const line = parsedLines[i].originalLine;
    
    // 最初のパス部分の位置を見つける
    const pathMatch = line.match(/[^│├└─+|\\s]+.*$/);
    const pathIndex = pathMatch ? line.indexOf(pathMatch[0]) : 0;
    
    // このインデックスから深さを計算
    const level = Math.floor(pathIndex / 4); // 4文字で1レベル
    
    // 特例：レベルが急に深くなりすぎる場合は調整
    const calculatedLevel = (level > previousLevel + 1) ? previousLevel + 1 : level;
    calculatedLevels.push(calculatedLevel);
    previousLevel = calculatedLevel;
  }
  
  // 最終的なインデントレベルを計算された値で更新
  for (let i = 0; i < parsedLines.length; i++) {
    parsedLines[i].indentLevel = calculatedLevels[i];
  }
  
  // デバッグ用に計算結果を表示
  parsedLines.forEach((info, index) => {
    console.log(`行 ${index+1}: レベル=${info.indentLevel}, ディレクトリ=${info.isDirectory}, パス=${info.pathPart}`);
  });
  
  // パスの構築用のスタック
  const pathStack = [];
  
  // ファイルパスを構築
  for (let i = 0; i < parsedLines.length; i++) {
    const { indentLevel, isDirectory, pathPart } = parsedLines[i];
    
    // スタックを現在のレベルに調整
    while (pathStack.length > indentLevel) {
      pathStack.pop();
    }
    
    // 現在のレベルが深すぎる場合は調整
    while (pathStack.length < indentLevel) {
      pathStack.push(""); // 不明な部分は空で埋める
    }
    
    // パスの記号を除去
    const cleanPath = pathPart.replace(/^[├└]+\s+/, '');
    
    if (isDirectory) {
      // ディレクトリの場合はこのレベルに追加
      pathStack[indentLevel] = cleanPath;
    } else {
      // ファイルの場合は完全なパスを構築
      const completePath = [...pathStack].filter(p => p !== "");
      const filePath = [...completePath, cleanPath].join('/');
      
      result.push({
        path: filePath,
        content: `// ${filePath}\n\n// このファイルは自動生成されたスケルトンです\n\n`
      });
      
      console.log(`ファイルパスを抽出: ${filePath}, スタック: ${JSON.stringify(completePath)}`);
    }
  }
  
  return result;
}

// 別のアプローチ: 行の先頭から実際のパス部分までの距離でインデントレベルを計算
function parseTreeStructureAlt(text) {
  console.log('\n代替パーサーで解析開始...');
  
  const result = [];
  const lines = text.split('\n')
    .filter(line => line.trim().length > 0);
  
  // ルートディレクトリ名を取得
  let rootDir = '';
  if (lines.length > 0 && lines[0].trim().endsWith('/')) {
    rootDir = lines[0].trim().replace('/', '');
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift();
  }
  
  // 各行のパスと階層レベルを抽出
  const parsedLines = [];
  
  for (const line of lines) {
    // パス部分を抽出（インデントと記号を除去）
    const pathMatch = line.match(/([^│├└─+|\\s]+.*)$/);
    if (!pathMatch) continue;
    
    const pathPart = pathMatch[1].trim();
    
    // パスの開始位置を取得（これがインデントレベルを示す）
    const pathStartIndex = line.indexOf(pathMatch[1]);
    
    // インデントレベルを計算（4スペースまたは記号+スペースで1レベル）
    const indentLevel = Math.round(pathStartIndex / 4);
    
    parsedLines.push({
      indentLevel,
      isDirectory: pathPart.endsWith('/'),
      pathPart: pathPart.endsWith('/') ? pathPart.slice(0, -1) : pathPart,
      // ファイル/ディレクトリ名から記号を除去
      cleanName: pathPart.replace(/^[├└─]+\s+/, '').replace(/\/$/, '')
    });
  }
  
  // デバッグ用に計算結果を表示
  parsedLines.forEach((info, index) => {
    console.log(`行 ${index+1}: レベル=${info.indentLevel}, ディレクトリ=${info.isDirectory}, 名前=${info.cleanName}`);
  });
  
  // パスの構築用のスタック（レベルごとのパス）
  const pathStack = [];
  
  // ファイルパスを構築
  for (let i = 0; i < parsedLines.length; i++) {
    const { indentLevel, isDirectory, cleanName } = parsedLines[i];
    
    // スタックを現在のレベルに調整
    while (pathStack.length > indentLevel) {
      pathStack.pop();
    }
    
    if (isDirectory) {
      // ディレクトリの場合は現在のスタックに追加
      pathStack[indentLevel] = cleanName;
    } else {
      // ファイルの場合は、現在のスタックとファイル名からパスを構築
      const dirPath = pathStack.slice(0, indentLevel).filter(Boolean);
      const filePath = [...dirPath, cleanName].join('/');
      
      result.push({
        path: filePath,
        content: `// ${filePath}\n\n// このファイルは自動生成されたスケルトンです\n\n`
      });
      
      console.log(`ファイルパス抽出: ${filePath}`);
    }
  }
  
  return result;
}

// テスト実行
testCases.forEach((testCase, index) => {
  console.log(`\n======= テストケース ${index + 1}: ${testCase.name} =======`);
  
  // 改良版パーサーでテスト
  const files1 = parseTreeStructure(testCase.input);
  console.log(`\n改良版パーサーの結果: ${files1.length}個のファイルを抽出しました`);
  files1.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
  
  // 代替パーサーでテスト
  const files2 = parseTreeStructureAlt(testCase.input);
  console.log(`\n代替パーサーの結果: ${files2.length}個のファイルを抽出しました`);
  files2.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
});

// VSCodeへの組み込み用の最終バージョン
function finalParser(text) {
  console.log('\n最終バージョンのパーサーで解析開始...');
  
  const result = [];
  const lines = text.split('\n')
    .filter(line => line.trim().length > 0);
  
  // ルートディレクトリ名を取得
  let rootDir = '';
  const rootMatch = lines[0] && lines[0].trim().match(/^([^/]+)\/$/);
  if (rootMatch) {
    rootDir = rootMatch[1];
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift();
  }
  
  // 各行の実際のパス部分とインデントレベルを抽出
  const parsedLines = [];
  
  for (const line of lines) {
    // ファイル/ディレクトリ名を抽出（インデントと記号を除去）
    // 例: "├── app/" -> "app/"、"└── index.html" -> "index.html"
    const nameMatch = line.match(/(?:[│├└─+|\\s]+)?([^│├└─+|\\s].+)$/);
    if (!nameMatch) continue;
    
    const name = nameMatch[1].trim();
    
    // 行の先頭からファイル/ディレクトリ名の開始位置までの距離を計算
    const indentWidth = line.indexOf(nameMatch[1]);
    
    // インデントレベルを計算（4スペース = 1レベル、および記号を考慮）
    const indentLevel = Math.max(0, Math.round(indentWidth / 4));
    
    parsedLines.push({
      indentLevel,
      isDirectory: name.endsWith('/'),
      name: name.endsWith('/') ? name.slice(0, -1) : name
    });
  }
  
  // パスの構築用のスタック
  const pathStack = new Array(10).fill(''); // 十分な深さのスタックを初期化
  
  // ファイルパスを構築
  for (let i = 0; i < parsedLines.length; i++) {
    const { indentLevel, isDirectory, name } = parsedLines[i];
    
    // 現在のレベルにパス部分を設定
    pathStack[indentLevel] = name;
    
    // このレベル以降のスタックをクリア
    for (let j = indentLevel + 1; j < pathStack.length; j++) {
      pathStack[j] = '';
    }
    
    if (isDirectory) {
      // ディレクトリの場合は何もしない（次の項目のための準備）
      console.log(`ディレクトリを追加: ${name}, レベル: ${indentLevel}`);
    } else {
      // ファイルの場合はパスを構築
      const pathParts = pathStack.slice(0, indentLevel + 1).filter(p => p !== '');
      const filePath = pathParts.join('/');
      
      // ルートディレクトリがある場合は先頭に追加
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

// 最終パーサーでテスト
testCases.forEach((testCase, index) => {
  console.log(`\n======= テストケース ${index + 1}: 最終パーサー =======`);
  
  const files = finalParser(testCase.input);
  console.log(`\n最終パーサーの結果: ${files.length}個のファイルを抽出しました`);
  files.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
});