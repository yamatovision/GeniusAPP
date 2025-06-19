// ImprovedChatUIのテスト
const { ImprovedChatUI } = require('./dist/core/improved-chat-ui');

// chalkの代わりにANSIエスケープシーケンスを直接使用
const green = (text) => `\x1b[32m${text}\x1b[0m`;

const ui = new ImprovedChatUI();

ui.appendOutput('🚀 Improved BlueLamp CLI UI');
ui.appendOutput('readlineベースの改良版（ペースト対応）');
ui.appendOutput('');
ui.appendOutput('📝 使い方:');
ui.appendOutput('- エンターで送信');
ui.appendOutput('- 行末に \\ を付けてエンターで改行');
ui.appendOutput('- 複数行モードでは空行で送信');
ui.appendOutput('- ペーストも正常に動作します');
ui.appendOutput('- Ctrl+Cで終了');
ui.newLine();

ui.on('input', (text) => {
  if (text === 'exit' || text === '終了') {
    ui.appendOutput('👋 終了します...');
    setTimeout(() => {
      ui.destroy();
    }, 1000);
    return;
  }
  
  // 複数行の場合は整形して表示
  if (text.includes('\n')) {
    ui.appendOutput(green('🤖 Bot: 複数行のメッセージを受信しました:'));
    text.split('\n').forEach((line, i) => {
      ui.appendOutput(`  ${i + 1}: ${line}`);
    });
  } else {
    ui.appendOutput(green('🤖 Bot: ') + `"${text}" を受信しました`);
  }
  ui.newLine();
});

ui.on('exit', () => {
  console.log('Goodbye!');
  process.exit(0);
});