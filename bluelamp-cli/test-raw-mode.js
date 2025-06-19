// RawModeUIのテスト
const { RawModeUI } = require('./dist/raw-mode-ui');

const green = (text) => `\x1b[32m${text}\x1b[0m`;

const ui = new RawModeUI();

ui.appendOutput('🎮 Raw Mode UI');
ui.appendOutput('readlineを使わない完全カスタム実装');
ui.appendOutput('');
ui.appendOutput('📝 操作方法:');
ui.appendOutput('- Enter: メッセージ送信');
ui.appendOutput('- \\ + Enter: 改行を追加');
ui.appendOutput('- 矢印キー: カーソル移動');
ui.appendOutput('- 複数行を自由に編集可能');
ui.appendOutput('- ペーストした内容も編集可能');
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
  if (lines.length > 1) {
    ui.appendOutput(green('🤖 Bot: ') + `${lines.length}行のメッセージを受信しました`);
  } else {
    ui.appendOutput(green('🤖 Bot: ') + `"${text}" を受信しました`);
  }
  ui.newLine();
});

ui.on('exit', () => {
  console.log('\nGoodbye!');
  process.exit(0);
});