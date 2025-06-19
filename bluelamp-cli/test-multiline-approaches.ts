#!/usr/bin/env ts-node

import { TimerBasedChatUI } from './src/test-approaches/approach1-timer-based';
import { BufferBasedChatUI } from './src/test-approaches/approach2-buffer-based';
import { NonRawModeChatUI } from './src/test-approaches/approach3-non-raw-mode';
import { ChunkBasedChatUI } from './src/test-approaches/approach4-chunk-based';

// コマンドライン引数からアプローチを選択
const approach = process.argv[2] || '1';

console.log(`\n複数行ペーストテスト - アプローチ${approach}\n`);
console.log('使い方:');
console.log('- 複数行のテキストをペーストしてテスト');
console.log('- Ctrl+C で終了');
console.log('\nテストケース例:');
console.log('1. 2行のペースト:');
console.log('   行1');
console.log('   行2');
console.log('\n2. 空行を含むペースト:');
console.log('   行1');
console.log('   ');
console.log('   行3');
console.log('\n------------------\n');

let ui: any;

switch (approach) {
  case '1':
    console.log('アプローチ1: タイマーベース検出');
    ui = new TimerBasedChatUI();
    break;
  case '2':
    console.log('アプローチ2: バッファベース検出');
    ui = new BufferBasedChatUI();
    break;
  case '3':
    console.log('アプローチ3: Non-Raw Mode (readline)');
    ui = new NonRawModeChatUI();
    break;
  case '4':
    console.log('アプローチ4: チャンクベース検出');
    ui = new ChunkBasedChatUI();
    break;
  default:
    console.error('無効なアプローチ番号です。1-4を指定してください。');
    process.exit(1);
}

// 入力を受信したときのログ
ui.on('input', (text: string) => {
  console.log(`\n[受信] "${text}"`);
});

ui.on('exit', () => {
  console.log('\n終了します...');
  process.exit(0);
});

// 1秒後にテスト開始メッセージを表示
setTimeout(() => {
  ui.appendOutput('テスト開始: 複数行のテキストをペーストしてください');
}, 1000);