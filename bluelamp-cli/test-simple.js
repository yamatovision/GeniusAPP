// シンプルなテスト
const termkit = require('terminal-kit');
const term = termkit.terminal;

console.log('Simple terminal-kit test');
console.log('Type something and press Enter:');

term.inputField({}, (error, input) => {
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('\nYou typed:', input);
  }
  
  term.processExit(0);
});