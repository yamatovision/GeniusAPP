// シンプルなペーストテスト用コード
const readline = require('readline');

// readlineインターフェース設定
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

console.log('📋 シンプルなペーストテスト');
console.log('複数行のテキストをペーストしてください：');
console.log('');

rl.prompt();

rl.on('line', (line) => {
  console.log(`受信: "${line}"`);
  console.log(`文字数: ${line.length}`);
  console.log(`改行を含む: ${line.includes('\n')}`);
  console.log('---');
  rl.prompt();
});

rl.on('SIGINT', () => {
  console.log('\n終了します');
  process.exit(0);
});