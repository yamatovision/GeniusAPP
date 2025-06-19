// FinalUIV2のテスト
const { FinalUIV2 } = require('./dist/final-ui-v2');

const green = (text) => `\x1b[32m${text}\x1b[0m`;

const ui = new FinalUIV2();

ui.appendOutput('✨ Final UI V2 - 完成版');
ui.appendOutput('');
ui.appendOutput('📝 新機能:');
ui.appendOutput('- ペーストの前後に通常入力可能');
ui.appendOutput('- 例: あああ[*Pasted text*]いいい');
ui.appendOutput('- 矢印キーでカーソル移動');
ui.appendOutput('- Backspaceで削除');
ui.appendOutput('- Enterで送信');
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
  ui.appendOutput(green('🤖 Bot: ') + `受信しました（${lines.length}行）`);
  
  // デバッグ: 全文を表示
  ui.appendOutput('--- 受信内容 ---');
  ui.appendOutput(text.replace(/\n/g, '\n    '));
  ui.appendOutput('--- 終了 ---');
  
  ui.newLine();
});

ui.on('exit', () => {
  console.log('\nGoodbye!');
  process.exit(0);
});