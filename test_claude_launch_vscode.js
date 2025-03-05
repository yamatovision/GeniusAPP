const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// テスト対象のファイルパス
const testFilePath = path.resolve(__dirname, 'docs/requirements.md');

// ファイルが存在するか確認
if (!fs.existsSync(testFilePath)) {
  console.error(`テストファイルが見つかりません: ${testFilePath}`);
  process.exit(1);
}

console.log('==== VSCode ターミナルでの ClaudeCode 起動テスト ====');
console.log(`対象ファイル: ${testFilePath}`);

// 直接ターミナルで実行するコマンドを表示
console.log('\n以下のコマンドをVSCodeターミナルで直接実行してください:');
console.log('---------------------------------------------------');
console.log(`cd "${__dirname}" && claude "${testFilePath}"`);
console.log('---------------------------------------------------');

// CLIパスとバージョンを確認
exec('which claude', (error, stdout, stderr) => {
  if (error) {
    console.error('ClaudeCode CLIが見つかりません。インストールされていることを確認してください。');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
  
  const claudePath = stdout.trim();
  console.log(`\nClaudeCode CLIパス: ${claudePath}`);
  
  exec('claude --version', (error, stdout, stderr) => {
    if (error) {
      console.error('ClaudeCode CLIのバージョン確認に失敗しました。');
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    
    console.log(`ClaudeCode バージョン: ${stdout.trim()}`);
  });
});