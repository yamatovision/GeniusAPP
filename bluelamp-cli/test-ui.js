// テスト用スクリプト
const { TerminalKitInterface } = require('./dist/core/terminal-kit-interface');

console.log('Terminal UI Test');
console.log('このメッセージが表示されたら、5秒後にUIが起動します...');

setTimeout(() => {
  const ui = new TerminalKitInterface({
    title: 'BlueLamp CLI Test'
  });

  ui.appendOutput('Welcome to BlueLamp CLI!');
  ui.appendOutput('This is a test of the terminal UI.');
  ui.appendOutput('');
  ui.appendOutput('Type something and press Enter to send.');
  ui.appendOutput('Press Shift+Enter to add a new line.');
  ui.appendOutput('Press Ctrl+C to exit.');

  // イベントリスナーの確認
  console.error('UI event names:', ui.eventNames());
  console.error('Input listeners before:', ui.listenerCount('input'));
  
  ui.on('input', (text) => {
    console.error('Input event received:', text);
    ui.appendOutput('You typed: ' + text);
    ui.appendOutput('');
    
    if (text.toLowerCase() === 'exit') {
      ui.appendOutput('Goodbye!');
      setTimeout(() => {
        ui.destroy();
      }, 1000);
    }
  });
  
  console.error('Input listeners after:', ui.listenerCount('input'));

  ui.on('exit', () => {
    console.log('UI closed');
    process.exit(0);
  });
}, 5000);