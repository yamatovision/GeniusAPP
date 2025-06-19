// SimpleClaudeUIのテスト
const { SimpleClaudeUI } = require('./dist/core/simple-claude-ui');

const green = (text) => `\x1b[32m${text}\x1b[0m`;

const ui = new SimpleClaudeUI();

ui.appendOutput('🚀 Simple Claude UI');
ui.appendOutput('ペーストに対応したシンプルなUI');
ui.appendOutput('');
ui.appendOutput('📝 機能:');
ui.appendOutput('- 複数行の入力は自動的にまとめて送信');
ui.appendOutput('- 6行以上は折りたたみ表示');
ui.appendOutput('- 100ms以内の連続入力をペーストとして検出');
ui.newLine();

ui.on('input', (text) => {
  if (text === 'exit' || text === '終了') {
    ui.appendOutput('👋 終了します...');
    setTimeout(() => {
      ui.destroy();
    }, 1000);
    return;
  }
  
  // 応答
  const lines = text.split('\n');
  if (lines.length > 1) {
    ui.appendOutput(green('🤖 Bot: ') + `${lines.length}行のメッセージを受信しました`);
  } else {
    ui.appendOutput(green('🤖 Bot: ') + `"${text}" を受信しました`);
  }
  ui.newLine();
});

ui.on('exit', () => {
  console.log('Goodbye!');
  process.exit(0);
});