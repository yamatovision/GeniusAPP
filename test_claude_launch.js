#!/usr/bin/env node

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

console.log('==== ClaudeCode 起動テスト ====');
console.log(`対象ファイル: ${testFilePath}`);

// CLIパスを調べる
exec('which claude', (error, stdout, stderr) => {
  if (error) {
    console.error('ClaudeCode CLIが見つかりません。インストールされていることを確認してください。');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
  
  const claudePath = stdout.trim();
  console.log(`ClaudeCode CLIパス: ${claudePath}`);
  
  // バージョン確認
  exec('claude --version', (error, stdout, stderr) => {
    if (error) {
      console.error('ClaudeCode CLIのバージョン確認に失敗しました。');
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    
    console.log(`ClaudeCode バージョン: ${stdout.trim()}`);
    
    // 起動テスト - 新しいターミナルウィンドウで実行
    console.log('\n直接コマンドでClaudeCodeを起動します...');
    
    // macOSの場合
    if (process.platform === 'darwin') {
      // AppleScriptを使用してターミナルを開き、コマンドを実行
      const command = `osascript -e 'tell application "Terminal" to do script "cd '${__dirname}' && claude '${testFilePath}'"'`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('ターミナルウィンドウでのClaudeCode起動に失敗しました');
          console.error(`Error: ${error.message}`);
          return;
        }
        console.log('新しいターミナルウィンドウでClaudeCodeを起動しました');
      });
    } else {
      // Linux/Windowsの場合はコマンドラインでテスト
      console.log('このコマンドを手動で実行してください:');
      console.log(`cd "${__dirname}" && claude "${testFilePath}"`);
    }
  });
});