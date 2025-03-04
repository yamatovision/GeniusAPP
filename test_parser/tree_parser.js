#!/usr/bin/env node

/**
 * ディレクトリ構造からファイルパスを抽出するシンプルなスクリプト
 * 使用方法: 
 *   node tree_parser.js < tree.txt
 * または
 *   node tree_parser.js tree.txt
 */

const fs = require('fs');

// 標準入力またはファイルから入力を読み込む
function getInput() {
  if (process.argv.length > 2) {
    // ファイルから読み込む
    const filePath = process.argv[2];
    return fs.readFileSync(filePath, 'utf-8');
  } else {
    // 標準入力から読み込む
    const chunks = [];
    process.stdin.on('data', chunk => chunks.push(chunk));
    return new Promise(resolve => {
      process.stdin.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });
    });
  }
}

// ディレクトリ構造を解析してファイルパスを抽出
function parseDirectoryTree(text) {
  // 空行を除去して行ごとに分割
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const result = [];
  
  // ルートディレクトリを特定
  let rootDir = '';
  if (lines.length > 0 && lines[0].trim().endsWith('/')) {
    rootDir = lines[0].trim().replace('/', '');
    console.log(`ルートディレクトリ: ${rootDir}`);
    lines.shift();
  }
  
  // ディレクトリの階層を管理するスタック
  const dirStack = [];
  
  // 各行を処理
  lines.forEach(line => {
    // インデントの深さを計算 (スペースと記号の数)
    const indent = line.search(/[^\s│├└─+|\\]/);
    
    // インデントからレベルを計算 (2スペースで1レベル)
    const level = Math.floor(indent / 2);
    
    // 名前部分を抽出 (すべての記号とスペースを除去)
    let name = line.trim();
    name = name.replace(/[│├└─+|\\]/g, '').trim(); // すべての記号を削除
    
    // ディレクトリかファイルかを判定
    const isDirectory = name.endsWith('/');
    
    // クリーンな名前 (末尾のスラッシュを除去)
    const cleanName = isDirectory ? name.slice(0, -1) : name;
    
    // スタックをレベルに合わせる
    while (dirStack.length > level) {
      dirStack.pop();
    }
    
    if (isDirectory) {
      // ディレクトリの場合はスタックに追加
      dirStack[level] = cleanName;
    } else {
      // ファイルの場合はパスを構築
      const validDirs = dirStack.slice(0, level).filter(Boolean);
      const filePath = [...validDirs, cleanName].join('/');
      
      // ルートディレクトリがある場合は付加
      const fullPath = rootDir ? `${rootDir}/${filePath}` : filePath;
      
      result.push(fullPath);
    }
  });
  
  return result;
}

// メイン処理
async function main() {
  try {
    // 入力を取得
    const input = await getInput();
    
    // ディレクトリ構造を解析
    const files = parseDirectoryTree(input);
    
    // 結果を表示
    console.log('\n抽出されたファイルパス:');
    files.forEach((file, i) => {
      console.log(`${i + 1}. ${file}`);
    });
    
    // ファイル作成のコマンドを表示
    console.log('\nファイル作成コマンド:');
    files.forEach(file => {
      // ディレクトリ部分を取得
      const dirPath = file.substring(0, file.lastIndexOf('/'));
      console.log(`mkdir -p "${dirPath}" && touch "${file}"`);
    });
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトを実行
if (require.main === module) {
  main();
}