// ペースト検出のテスト
console.log('ペースト検出テスト');
console.log('テキストをペーストしてみてください:');
console.log('');

let buffer = '';
let lastTime = Date.now();
let inputCount = 0;

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.on('data', (chunk) => {
  const now = Date.now();
  const delta = now - lastTime;
  lastTime = now;
  
  const char = chunk.toString();
  buffer += char;
  inputCount++;
  
  // デバッグ情報
  console.log(`入力 #${inputCount}: "${char.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}" (${chunk.length}バイト, ${delta}ms後)`);
  
  // エンターキーで終了
  if (char === '\r' || char === '\n') {
    console.log('\n=== 結果 ===');
    console.log('総入力文字数:', buffer.length);
    console.log('入力内容:', buffer.replace(/\n/g, '\\n').replace(/\r/g, '\\r'));
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.exit(0);
  }
  
  // Ctrl+Cで終了
  if (char === '\x03') {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('\nタイムアウト（30秒）');
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.exit(0);
}, 30000);