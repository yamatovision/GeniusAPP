// SimpleChatUIのテスト
const { SimpleChatUI } = require('./dist/core/simple-chat-ui');

const ui = new SimpleChatUI();

ui.appendOutput('🚀 SimpleChatUI Test');
ui.appendOutput('ClaudeCode風のシンプルなチャットUIです');
ui.appendOutput('');
ui.appendOutput('使い方:');
ui.appendOutput('- テキストを入力してEnterで送信');
ui.appendOutput('- Ctrl+Cで終了');
ui.appendOutput('- 日本語入力対応');
ui.newLine();

ui.on('input', (text) => {
  // エコーバック
  ui.appendOutput('🤖 Bot: ' + text + ' を受信しました');
  ui.newLine();
  
  if (text === 'exit' || text === '終了') {
    ui.appendOutput('👋 終了します...');
    setTimeout(() => {
      ui.destroy();
    }, 1000);
  }
});

ui.on('exit', () => {
  console.log('Goodbye!');
  process.exit(0);
});