// PerfectPasteUIのテスト
const { PerfectPasteUI } = require('./dist/core/perfect-paste-ui');

const green = (text) => `\x1b[32m${text}\x1b[0m`;

const ui = new PerfectPasteUI();

ui.appendOutput('🎯 Perfect Paste UI');
ui.appendOutput('入力欄に残った最後の行も含めて処理します');
ui.appendOutput('');
ui.appendOutput('📝 機能:');
ui.appendOutput('- 複数行ペーストを完全にサポート');
ui.appendOutput('- 最後の行も含めて処理');
ui.appendOutput('- 6行以上は折りたたみ表示');
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
    // 内容も表示
    lines.forEach((line, i) => {
      ui.appendOutput(`    ${i+1}: ${line}`);
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