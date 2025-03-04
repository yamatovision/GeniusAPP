// 最終的なディレクトリツリーパーサー - 記号を完全に除去
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

// 最終的なパーサー - 完全に記号を除去
function finalTreeParser(text) {
  console.log('最終パーサーで解析開始...');
  
  const result = [];
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
  
  lines.forEach((line, index) => {
    // 視覚的なインデントレベルを計算
    let indentLevel = 0;
    let indentMatch = line.match(/^(\s*(?:[│├└─+|\\]\s*)*)/);
    
    if (indentMatch) {
      const indentPart = indentMatch[1];
      // 記号の数でインデントレベルを計算
      indentLevel = (indentPart.match(/[│├└─+|\\]/g) || []).length;
    }
    
    // ファイル/ディレクトリ名を抽出（記号を除去）
    let name = '';
    let nameMatch = line.match(/[│├└─+|\\][^\S\r\n]+([^│├└─+|\\].+)$/);
    
    if (nameMatch) {
      name = nameMatch[1].trim();
    } else {
      // 記号がない場合は行全体をトリム
      name = line.trim();
    }
    
    // 記号を完全に除去
    name = name.replace(/^[├└─]+\s+/, '');
    
    // ディレクトリかファイルかを判断
    const isDirectory = name.endsWith('/');
    
    // クリーンな名前（末尾のスラッシュを除去）
    const cleanName = isDirectory ? name.slice(0, -1) : name;
    
    entries.push({
      indentLevel,
      isDirectory,
      name: cleanName
    });
    
    console.log(`行 ${index+1}: レベル=${indentLevel}, ディレクトリ=${isDirectory}, 名前=${cleanName}`);
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
      // ディレクトリをスタックに追加
      dirStack[indentLevel] = name;
      console.log(`ディレクトリをスタックに追加: ${name}, レベル=${indentLevel}, スタック=${JSON.stringify(dirStack)}`);
    } else {
      // ファイルの場合はフルパスを構築
      // 有効なディレクトリ部分のみを使用
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

// VSCode拡張に組み込むための最終実装
function vscodeImplementation(text) {
  console.log('\nVSCode実装用パーサー...');
  
  const result = [];
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // ルートディレクトリを特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].trim().endsWith('/')) {
    rootDir = lines[0].trim().replace('/', '');
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift();
  }
  
  // ディレクトリのスタック（階層構造）
  const dirStack = [];
  
  // 前の行のインデントレベル
  let prevLevel = 0;
  
  // 各行を処理
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 視覚的なインデントレベルを計算
    let indentLevel = 0;
    for (let j = 0; j < line.length; j++) {
      if ('│├└─+|\\'.includes(line[j]) || line[j] === ' ') {
        indentLevel++;
      } else {
        break;
      }
    }
    
    // インデントをレベルに変換（2文字で1レベル）
    indentLevel = Math.ceil(indentLevel / 4);
    
    // パス部分を抽出（記号を完全に除去）
    const nameMatch = line.match(/([^│├└─+|\\]+.*)$/);
    if (!nameMatch) continue;
    
    let name = nameMatch[1].trim();
    
    // 残っている可能性のある記号をすべて除去
    name = name.replace(/^[├└─]+\s+/, '');
    
    // ディレクトリかファイルかを判断
    const isDirectory = name.endsWith('/');
    
    // クリーンな名前
    const cleanName = isDirectory ? name.slice(0, -1) : name;
    
    // 同じレベルの兄弟要素かをチェック
    if (indentLevel === prevLevel) {
      // 同じレベルなら前の要素を削除
      if (dirStack.length > 0 && dirStack.length === indentLevel + 1) {
        dirStack.pop();
      }
    } 
    // レベルが深くなった場合は何もしない
    else if (indentLevel < prevLevel) {
      // レベルが浅くなった場合は、差分だけスタックから削除
      const levelsToRemove = prevLevel - indentLevel;
      for (let k = 0; k < levelsToRemove; k++) {
        if (dirStack.length > 0) {
          dirStack.pop();
        }
      }
    }
    
    if (isDirectory) {
      // ディレクトリをスタックに追加
      dirStack.push(cleanName);
      console.log(`ディレクトリを追加: ${cleanName}, スタック: ${dirStack.join('/')}`);
    } else {
      // ファイルの場合はパスを構築
      const filePath = [...dirStack, cleanName].join('/');
      
      // ルートディレクトリがある場合は付加
      const fullPath = rootDir ? `${rootDir}/${filePath}` : filePath;
      
      result.push({
        path: fullPath,
        content: `// ${fullPath}\n\n// このファイルは自動生成されたスケルトンです\n\n`
      });
      
      console.log(`ファイルを追加: ${fullPath}`);
    }
    
    // 現在のレベルを保存
    prevLevel = indentLevel;
  }
  
  return result;
}

// テスト実行
testCases.forEach((testCase, index) => {
  console.log(`\n======= テストケース ${index + 1}: ${testCase.name} =======`);
  
  const files1 = finalTreeParser(testCase.input);
  console.log(`\n最終パーサー結果: ${files1.length}個のファイルを抽出しました`);
  files1.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
  
  const files2 = vscodeImplementation(testCase.input);
  console.log(`\nVSCode実装用パーサー結果: ${files2.length}個のファイルを抽出しました`);
  files2.forEach((file, i) => {
    console.log(`${i + 1}. ${file.path}`);
  });
});