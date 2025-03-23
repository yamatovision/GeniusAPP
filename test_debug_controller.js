// デバッグコントローラーの検証スクリプト
const fs = require('fs');
const path = require('path');

function checkControllerExists() {
  const debugControllerPath = path.join(__dirname, 'portal', 'backend', 'controllers', 'simpleAuth.debug.js');
  
  console.log(`デバッグコントローラーファイルの確認: ${debugControllerPath}`);
  
  try {
    const stats = fs.statSync(debugControllerPath);
    console.log(`ファイルが存在します: ${stats.isFile()}`);
    console.log(`ファイルサイズ: ${stats.size} bytes`);
    console.log(`最終更新日: ${stats.mtime}`);
    
    // ファイル内容をチェック
    const content = fs.readFileSync(debugControllerPath, 'utf-8');
    const exportedFunction = content.includes('exports.debugAuth');
    console.log(`debugAuth関数のエクスポート: ${exportedFunction ? '確認' : '見つかりません'}`);
    
    return true;
  } catch (err) {
    console.error(`エラー: ${err.message}`);
    return false;
  }
}

function checkRouterImport() {
  const routerPath = path.join(__dirname, 'portal', 'backend', 'routes', 'simple.routes.js');
  
  console.log(`\nルーターファイルの確認: ${routerPath}`);
  
  try {
    const content = fs.readFileSync(routerPath, 'utf-8');
    
    // デバッグコントローラーのインポート確認
    const importLine = content.match(/require\(['"](\.\.\/controllers\/simpleAuth\.debug)['"]\)/);
    console.log(`デバッグコントローラーのインポート: ${importLine ? importLine[0] : '見つかりません'}`);
    
    // デバッグエンドポイントの定義確認
    const endpointDefinition = content.includes("'/auth/debug'");
    console.log(`デバッグエンドポイントの定義: ${endpointDefinition ? '確認' : '見つかりません'}`);
    
    // simpleAuthDebug変数の使用確認
    const debugVarUsage = content.includes('simpleAuthDebug.debugAuth');
    console.log(`simpleAuthDebug変数の使用: ${debugVarUsage ? '確認' : '見つかりません'}`);
    
    return true;
  } catch (err) {
    console.error(`エラー: ${err.message}`);
    return false;
  }
}

// 実行
console.log('==== デバッグコントローラー検証 ====');
const controllerExists = checkControllerExists();
const routerImportsController = checkRouterImport();

console.log('\n==== 検証結果 ====');
console.log(`デバッグコントローラーファイル: ${controllerExists ? '✅ OK' : '❌ 問題あり'}`);
console.log(`ルーターの設定: ${routerImportsController ? '✅ OK' : '❌ 問題あり'}`);

if (!controllerExists || !routerImportsController) {
  console.log('\n🔍 問題の可能性:');
  console.log('1. simpleAuth.debug.jsファイルが存在しないか、内容が不完全');
  console.log('2. simple.routes.jsでデバッグコントローラーの読み込みが正しくない');
  console.log('3. デバッグエンドポイントの定義が不適切');
}