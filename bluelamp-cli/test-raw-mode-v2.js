// RawModeUIV2のテスト
const { RawModeUIV2 } = require('./dist/raw-mode-ui-v2');

const green = (text) => `\x1b[32m${text}\x1b[0m`;

const ui = new RawModeUIV2();

ui.appendOutput('🎮 Raw Mode UI V2');
ui.appendOutput('ペースト処理を改善した版');
ui.appendOutput('');
ui.appendOutput('📝 操作方法:');
ui.appendOutput('- Enter: メッセージ送信');
ui.appendOutput('- 改行は直接ペースト可能');
ui.appendOutput('- 矢印キー: カーソル移動');
ui.appendOutput('- 複数行を自由に編集可能');
ui.appendOutput('- Ctrl+C: 終了');
ui.newLine();

ui.on('input', (text) => {
  if (text === 'exit' || text === '終了') {
    ui.appendOutput('👋 終了します...');
    setTimeout(() => {
      ui.destroy();
    }, 1000);
    return;
  }
  
  const lines = text.split('\n');
  ui.appendOutput(green('🤖 Bot: ') + `${lines.length}行のメッセージを受信しました`);
  
  // デバッグ用：受信した内容を表示
  if (lines.length <= 5) {
    lines.forEach((line, i) => {
      ui.appendOutput(`    ${i+1}: ${line}`);
    });
  }
  
  ui.newLine();
});

ui.on('exit', () => {
  console.log('\nGoodbye!');
  process.exit(0);
});