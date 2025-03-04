// テスト用: パス解決処理のテストスクリプト
const fs = require('fs');
const path = require('path');

// モック関数とオブジェクト
const Logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  debug: (msg) => console.log(`[DEBUG] ${msg}`),
  error: (msg, err) => console.log(`[ERROR] ${msg}`, err)
};

// テスト用のディレクトリ構造文字列
const testCurrentDirectory = `
プロジェクトディレクトリ構造:
/Users/tatsuya/Desktop/システム開発/AILP/AILP

言語別ファイル数:
- TypeScript: 68
- JavaScript: 42
- HTML: 15
- CSS: 10
- その他: 23
`;

// パス抽出のテスト関数
function extractProjectPathFromDirectory(dirStructure) {
  if (dirStructure && dirStructure.includes('プロジェクトディレクトリ構造:')) {
    const pathMatch = dirStructure.match(/プロジェクトディレクトリ構造:[\s\n]*([^\s\n]+)/);
    if (pathMatch && pathMatch[1]) {
      const extractedProjectPath = pathMatch[1].trim();
      if (fs.existsSync(extractedProjectPath)) {
        Logger.info(`ディレクトリ構造情報から抽出したパス: ${extractedProjectPath} (存在します)`);
        return extractedProjectPath;
      } else {
        Logger.info(`ディレクトリ構造情報から抽出したパス: ${extractedProjectPath} (存在しません)`);
      }
    }
  }
  return null;
}

// コマンド処理のシミュレーション（修正前）
function processCommandBefore(currentDirectory, commandPath) {
  // 設定からの取得をシミュレート
  const customProjectPath = '/Users/tatsuya/Desktop/システム開発/AILP/AILP';
  let rootPath = '';
  
  if (customProjectPath && fs.existsSync(customProjectPath)) {
    rootPath = customProjectPath;
  } else {
    // ワークスペースのルートパスをシミュレート
    rootPath = '/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius';
  }
  
  // 元の実装
  let searchPath;
  if (commandPath) {
    searchPath = path.isAbsolute(commandPath) ? commandPath : path.join(rootPath, commandPath);
    Logger.debug(`[Before] 検索パス: ${searchPath} (rootPath: ${rootPath}, command.path: ${commandPath})`);
  } else {
    searchPath = rootPath;
    Logger.debug(`[Before] 検索パス: ${searchPath} (rootPath: ${rootPath})`);
  }
  
  return searchPath;
}

// コマンド処理のシミュレーション（修正後）
function processCommandAfter(currentDirectory, commandPath) {
  // 設定からの取得をシミュレート
  let customProjectPath = '/Users/tatsuya/Desktop/システム開発/AILP/AILP';
  let rootPath = '';
  
  // ディレクトリ構造情報からパスを抽出
  const extractedPath = extractProjectPathFromDirectory(currentDirectory);
  if (extractedPath) {
    rootPath = extractedPath;
  } else if (customProjectPath && fs.existsSync(customProjectPath)) {
    rootPath = customProjectPath;
  } else {
    // ワークスペースのルートパスをシミュレート
    rootPath = '/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius';
  }
  
  // 現在のディレクトリ構造情報を活用
  let searchPath;
  
  // コマンドでパスが指定されているか確認
  if (commandPath) {
    // 特殊なパターンを処理
    if (commandPath.includes('/Users/') || commandPath.includes('/Desktop/')) {
      Logger.debug(`[After] 特殊なパスを検出したが無視: ${commandPath}`);
      searchPath = rootPath;
    } else {
      // 通常のパス処理
      searchPath = path.isAbsolute(commandPath) ? commandPath : path.join(rootPath, commandPath);
    }
    Logger.debug(`[After] 検索パス: ${searchPath} (rootPath: ${rootPath}, command.path: ${commandPath})`);
  } else {
    searchPath = rootPath;
    Logger.debug(`[After] 検索パス: ${searchPath} (rootPath: ${rootPath})`);
  }
  
  return searchPath;
}

// テストケース
function runTests() {
  console.log('=== パス解決テスト開始 ===');
  
  // テストケース1: 通常のパス処理
  console.log('\nテストケース1: 通常のパス (src/utils)');
  const result1Before = processCommandBefore(testCurrentDirectory, 'src/utils');
  const result1After = processCommandAfter(testCurrentDirectory, 'src/utils');
  console.log(`修正前: ${result1Before}`);
  console.log(`修正後: ${result1After}`);
  
  // テストケース2: 絶対パス処理
  console.log('\nテストケース2: 絶対パス (/Users/tatsuya/Desktop/)');
  const result2Before = processCommandBefore(testCurrentDirectory, '/Users/tatsuya/Desktop/');
  const result2After = processCommandAfter(testCurrentDirectory, '/Users/tatsuya/Desktop/');
  console.log(`修正前: ${result2Before}`);
  console.log(`修正後: ${result2After}`);
  
  // テストケース3: 特殊パス処理
  console.log('\nテストケース3: 特殊パス (含む /Desktop/)');
  const result3Before = processCommandBefore(testCurrentDirectory, 'path/to/Desktop/folder');
  const result3After = processCommandAfter(testCurrentDirectory, 'path/to/Desktop/folder');
  console.log(`修正前: ${result3Before}`);
  console.log(`修正後: ${result3After}`);
  
  // テストケース4: パスなし（デフォルト）
  console.log('\nテストケース4: パス指定なし');
  const result4Before = processCommandBefore(testCurrentDirectory, null);
  const result4After = processCommandAfter(testCurrentDirectory, null);
  console.log(`修正前: ${result4Before}`);
  console.log(`修正後: ${result4After}`);
  
  // ディレクトリ構造からのパス抽出テスト
  console.log('\nディレクトリ構造からのパス抽出テスト:');
  const extractedPath = extractProjectPathFromDirectory(testCurrentDirectory);
  console.log(`抽出されたパス: ${extractedPath}`);
  
  console.log('\n=== パス解決テスト終了 ===');
}

// テスト実行
runTests();