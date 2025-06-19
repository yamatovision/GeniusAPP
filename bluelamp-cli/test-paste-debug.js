// ペーストの動作を詳しく調べるテスト
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

let lineCount = 0;
let buffer = [];
let timer = null;

console.log('📋 ペースト動作デバッグ');
console.log('複数行をペーストしてください');
console.log('');

rl.prompt();

rl.on('line', (line) => {
  lineCount++;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Line #${lineCount}: "${line}" (length: ${line.length})`);
  
  buffer.push(line);
  
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`\n=== バッファ内容 (${buffer.length}行) ===`);
    buffer.forEach((l, i) => console.log(`  ${i+1}: "${l}"`));
    console.log('=================\n');
    buffer = [];
  }, 300);
  
  rl.prompt();
});

// 入力イベントも監視
process.stdin.on('data', (chunk) => {
  const str = chunk.toString();
  const lines = str.split('\n');
  console.error(`[RAW INPUT] ${lines.length}行検出: ${JSON.stringify(lines)}`);
});