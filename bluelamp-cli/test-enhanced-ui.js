// EnhancedChatUIのテスト
const { EnhancedChatUI } = require('./dist/core/enhanced-chat-ui');

// chalkの代わりにANSIエスケープシーケンスを直接使用
const green = (text) => `\x1b[32m${text}\x1b[0m`;

const ui = new EnhancedChatUI();

ui.appendOutput('🚀 Enhanced BlueLamp CLI UI');
ui.appendOutput('ClaudeCode風の改良版チャットUIです');
ui.appendOutput('');
ui.appendOutput('📝 機能:');
ui.appendOutput('- エンターで送信');
ui.appendOutput('- バックスラッシュ(\\)を末尾に付けてエンターで改行');
ui.appendOutput('- 複数行モードでは空行入力で送信');
ui.appendOutput('- 上下矢印でスクロール');
ui.appendOutput('- 6行以上のペーストは自動的に折りたたみ');
ui.appendOutput('- 日本語入力対応');
ui.appendOutput('- Ctrl+Cで終了');
ui.newLine();

// 簡単なボット応答
const botResponses = {
  'hello': 'こんにちは！調子はどうですか？',
  'こんにちは': 'こんにちは！何かお手伝いできることはありますか？',
  'help': '使い方:\n- hello/こんにちは: 挨拶\n- time: 現在時刻\n- clear: 画面クリア\n- exit/終了: 終了',
  'time': () => new Date().toLocaleString('ja-JP'),
  'clear': () => {
    ui.outputHistory = [];
    ui.redraw();
    return '画面をクリアしました';
  }
};

ui.on('input', (text) => {
  // ボット応答
  const command = text.toLowerCase().trim();
  
  if (command === 'exit' || command === '終了') {
    ui.appendOutput('👋 終了します...');
    setTimeout(() => {
      ui.destroy();
    }, 1000);
    return;
  }
  
  let response = botResponses[command];
  if (typeof response === 'function') {
    response = response();
  }
  
  if (response) {
    ui.appendOutput(green('🤖 Bot: ') + response);
  } else {
    ui.appendOutput(green('🤖 Bot: ') + `"${text}" を受信しました`);
  }
  ui.newLine();
});

ui.on('exit', () => {
  console.log('Goodbye!');
  process.exit(0);
});

