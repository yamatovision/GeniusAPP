// HybridUIのテスト
const { HybridUI } = require('./dist/hybrid-ui');

const green = (text) => `\x1b[32m${text}\x1b[0m`;

const ui = new HybridUI();

ui.appendOutput('🔀 Hybrid UI');
ui.appendOutput('readlineの安定性 + 複数行編集');
ui.appendOutput('');
ui.appendOutput('📝 使い方:');
ui.appendOutput('- 複数行ペーストすると自動的に複数行モードに');
ui.appendOutput('- 複数行モードではEnterで送信');
ui.appendOutput('- 入力欄で自由に編集可能');
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
  
  if (lines.length <= 5) {
    lines.forEach((line, i) => {
      ui.appendOutput(`    ${i+1}: ${line}`);
    });
  }
  
  ui.newLine();
});

ui.on('exit', () => {
  console.log('Goodbye!');
  process.exit(0);
});