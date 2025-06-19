// ペースト処理のデバッグ用テスト
const { EnhancedChatUI } = require('./dist/core/enhanced-chat-ui');

// デバッグ用のEnhancedChatUI拡張
class DebugEnhancedChatUI extends EnhancedChatUI {
  constructor() {
    super();
    this.debugMode = true;
  }

  handleKeyPress(char, key) {
    // キー入力をログ出力
    console.error(`\n[DEBUG] Key pressed: char="${char}"`);
    if (char && typeof char === 'string') {
      console.error(`[DEBUG] charCode=${char.charCodeAt(0)}, length=${char.length}`);
    }
    if (key) {
      console.error(`[DEBUG] Key info:`, JSON.stringify(key));
    }
    console.error(`[DEBUG] Current input: "${this.currentInput}"`);
    console.error(`[DEBUG] Paste buffer: "${this.pasteBuffer}"`);
    console.error(`[DEBUG] Is pasting: ${this.isPasting}`);
    
    super.handleKeyPress(char, key);
  }

  handlePaste() {
    console.error(`\n[DEBUG] handlePaste called`);
    console.error(`[DEBUG] Paste buffer content: "${this.pasteBuffer}"`);
    console.error(`[DEBUG] Paste buffer lines:`, this.pasteBuffer.split(/\r?\n/));
    
    super.handlePaste();
  }
}

const ui = new DebugEnhancedChatUI();

ui.appendOutput('🔍 ペーストデバッグモード');
ui.appendOutput('');
ui.appendOutput('複数行のテキストをペーストしてみてください:');
ui.appendOutput('例:');
ui.appendOutput('- ダブルバッファリング');
ui.appendOutput('- 差分更新');
ui.appendOutput('- 適切なタイミングでの描画');
ui.appendOutput('');
ui.appendOutput('10. ターミナル互換性');
ui.newLine();

ui.on('input', (text) => {
  console.error(`\n[DEBUG] Input received: "${text}"`);
  console.error(`[DEBUG] Input lines:`, text.split('\n'));
  
  ui.appendOutput(`受信したテキスト: "${text}"`);
  ui.newLine();
});

ui.on('exit', () => {
  console.log('\nデバッグ終了');
  process.exit(0);
});