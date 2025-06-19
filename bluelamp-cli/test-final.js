// FinalUIのテスト
const { FinalUI } = require('./dist/final-ui');

const green = (text) => `\x1b[32m${text}\x1b[0m`;

const ui = new FinalUI();

ui.appendOutput('✨ Final UI - 完成版');
ui.appendOutput('');
ui.appendOutput('📝 機能:');
ui.appendOutput('- ペーストした内容が入力欄に完全表示');
ui.appendOutput('- 6行以上は自動的に折りたたみ');
ui.appendOutput('- Enterで送信（完全な内容を送信）');
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
  
  const lines = text.split('\n');
  ui.appendOutput(green('🤖 Bot: ') + `${lines.length}行のメッセージを受信しました`);
  
  // 内容を表示（10行まで）
  ui.appendOutput('--- 受信内容 ---');
  lines.slice(0, 10).forEach((line, i) => {
    ui.appendOutput(`    ${i+1}: ${line}`);
  });
  if (lines.length > 10) {
    ui.appendOutput(`    ... 他 ${lines.length - 10} 行`);
  }
  ui.appendOutput('--- 終了 ---');
  
  ui.newLine();
});

ui.on('exit', () => {
  console.log('\nGoodbye!');
  process.exit(0);
});