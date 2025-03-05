/**
 * AppGenius CLIツールの直接テスト
 */
const { spawn } = require('child_process');
const path = require('path');

// テストするプロンプト
const prompt = process.argv[2] || "マークダウンファイルを探して";

console.log(`プロンプト "${prompt}" でCLIツールをテストします...\n`);

// ツールプロセスを起動
const cliPath = path.join(__dirname, 'dist', 'commands', 'tool-cli.js');
const toolProcess = spawn('node', [cliPath, prompt]);

// 出力を表示
toolProcess.stdout.on('data', (data) => {
  console.log(`${data}`);
});

// エラー出力を表示
toolProcess.stderr.on('data', (data) => {
  console.error(`エラー: ${data}`);
});

// プロセス終了を処理
toolProcess.on('close', (code) => {
  console.log(`\nプロセスが終了しました (コード: ${code})`);
});