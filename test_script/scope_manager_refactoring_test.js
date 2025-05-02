/**
 * ScopeManagerPanelのリファクタリングテストスクリプト
 * 
 * 使用方法:
 *   node test_script/scope_manager_refactoring_test.js [options]
 * 
 * オプション:
 *   --use-new    新しい実装を使用
 *   --use-old    旧実装を使用
 */

const fs = require('fs');
const path = require('path');

// 現在の環境設定を取得
let useNewImpl = process.env.SCOPE_MANAGER_USE_NEW_IMPL === 'true';

// コマンドライン引数を解析
const args = process.argv.slice(2);
if (args.includes('--use-new')) {
  useNewImpl = true;
} else if (args.includes('--use-old')) {
  useNewImpl = false;
}

// 環境変数ファイルのパス
const envFilePath = path.join(__dirname, '..', '.env');

// .envファイルを読み込む
let envContent = '';
try {
  if (fs.existsSync(envFilePath)) {
    envContent = fs.readFileSync(envFilePath, 'utf8');
  }
} catch (err) {
  console.error('環境変数ファイルの読み込みに失敗しました:', err);
}

// SCOPE_MANAGER_USE_NEW_IMPL環境変数を設定または更新
const envVarName = 'SCOPE_MANAGER_USE_NEW_IMPL';
const newValue = useNewImpl ? 'true' : 'false';

if (envContent.includes(`${envVarName}=`)) {
  // 既存の変数を更新
  envContent = envContent.replace(
    new RegExp(`${envVarName}=.*`),
    `${envVarName}=${newValue}`
  );
} else {
  // 新しい変数を追加
  envContent += `\n${envVarName}=${newValue}\n`;
}

// .envファイルに書き込む
try {
  fs.writeFileSync(envFilePath, envContent);
  console.log(`環境変数 ${envVarName} を ${newValue} に設定しました`);
} catch (err) {
  console.error('環境変数ファイルの書き込みに失敗しました:', err);
}

// コマンドのパス
const vscodePath = process.platform === 'win32' 
  ? 'code.cmd' 
  : 'code';

// フラグを出力
console.log(`ScopeManagerPanelの実装: ${useNewImpl ? '新実装' : '旧実装'}`);
console.log('VSCodeを再起動して変更を適用してください');
console.log(`コマンド例: ${vscodePath} --disable-extensions --enable-proposed-api anthropic.claude-code-cli ${__dirname}/..`);