import { EventEmitter } from 'events';

export class RawModeUI extends EventEmitter {
  private outputHistory: string[] = [];
  private inputBuffer: string[] = ['']; // 複数行対応
  private currentLine: number = 0;
  private cursorX: number = 0;
  private pasteCounter: number = 0;

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    // Raw modeを有効化
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    
    // 初期画面
    this.clearScreen();
    this.redraw();
    
    // キー入力ハンドラー
    process.stdin.on('data', (key) => {
      this.handleKeyPress(key);
    });
  }

  private handleKeyPress(key: Buffer): void {
    const char = key.toString();
    
    // Ctrl+C
    if (key[0] === 0x03) {
      this.destroy();
      return;
    }

    // Enter (送信)
    if (key[0] === 0x0d) {
      const text = this.inputBuffer.join('\n').trim();
      if (text) {
        this.sendMessage(text);
      }
      return;
    }

    // Shift+Enter または \ + Enter (改行)
    if (char === '\n' || (key[0] === 0x0d && this.inputBuffer[this.currentLine].endsWith('\\'))) {
      // 改行を追加
      if (this.inputBuffer[this.currentLine].endsWith('\\')) {
        this.inputBuffer[this.currentLine] = this.inputBuffer[this.currentLine].slice(0, -1);
      }
      this.currentLine++;
      this.inputBuffer.splice(this.currentLine, 0, '');
      this.cursorX = 0;
      this.redraw();
      return;
    }

    // Backspace
    if (key[0] === 0x7f || key[0] === 0x08) {
      if (this.cursorX > 0) {
        const line = this.inputBuffer[this.currentLine];
        this.inputBuffer[this.currentLine] = line.slice(0, this.cursorX - 1) + line.slice(this.cursorX);
        this.cursorX--;
      } else if (this.currentLine > 0) {
        // 前の行と結合
        const prevLine = this.inputBuffer[this.currentLine - 1];
        const currentLineContent = this.inputBuffer[this.currentLine];
        this.inputBuffer.splice(this.currentLine, 1);
        this.currentLine--;
        this.cursorX = prevLine.length;
        this.inputBuffer[this.currentLine] = prevLine + currentLineContent;
      }
      this.redraw();
      return;
    }

    // 矢印キー
    if (char === '\x1b[A') { // 上
      if (this.currentLine > 0) {
        this.currentLine--;
        this.cursorX = Math.min(this.cursorX, this.inputBuffer[this.currentLine].length);
        this.redraw();
      }
      return;
    }
    if (char === '\x1b[B') { // 下
      if (this.currentLine < this.inputBuffer.length - 1) {
        this.currentLine++;
        this.cursorX = Math.min(this.cursorX, this.inputBuffer[this.currentLine].length);
        this.redraw();
      }
      return;
    }
    if (char === '\x1b[C') { // 右
      if (this.cursorX < this.inputBuffer[this.currentLine].length) {
        this.cursorX++;
        this.redraw();
      }
      return;
    }
    if (char === '\x1b[D') { // 左
      if (this.cursorX > 0) {
        this.cursorX--;
        this.redraw();
      }
      return;
    }

    // 通常の文字入力
    if (char.length > 0 && char.charCodeAt(0) >= 32) {
      const line = this.inputBuffer[this.currentLine];
      this.inputBuffer[this.currentLine] = line.slice(0, this.cursorX) + char + line.slice(this.cursorX);
      this.cursorX += char.length;
      this.redraw();
    }
  }

  private sendMessage(text: string): void {
    // 6行以上は折りたたみ
    const lines = text.split('\n');
    if (lines.length >= 6) {
      this.pasteCounter++;
      this.appendOutput(`あなた: [*Pasted text #${this.pasteCounter} +${lines.length} lines*]`);
    } else {
      this.appendOutput('あなた: ' + text.replace(/\n/g, '\n        '));
    }
    
    // イベント発火
    this.emit('input', text);
    
    // 入力欄をクリア
    this.inputBuffer = [''];
    this.currentLine = 0;
    this.cursorX = 0;
    
    this.newLine();
    this.redraw();
  }

  private clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[H');
  }

  private redraw(): void {
    const termHeight = process.stdout.rows || 24;
    const termWidth = process.stdout.columns || 80;
    
    // 入力欄の高さを計算
    const inputHeight = Math.min(6, this.inputBuffer.length + 2);
    const outputHeight = termHeight - inputHeight - 1;
    
    // 画面クリア
    this.clearScreen();
    
    // 出力履歴を表示
    const startIndex = Math.max(0, this.outputHistory.length - outputHeight);
    for (let i = startIndex; i < this.outputHistory.length; i++) {
      console.log(this.outputHistory[i]);
    }
    
    // 空行で埋める
    for (let i = this.outputHistory.length - startIndex; i < outputHeight; i++) {
      console.log('');
    }
    
    // 区切り線
    console.log('─'.repeat(termWidth));
    
    // 入力欄の表示
    this.inputBuffer.forEach((line, index) => {
      const prefix = index === 0 ? '> ' : '  ';
      let displayLine = prefix + line;
      
      // カーソル位置にカーソルを表示
      if (index === this.currentLine) {
        const cursorPos = prefix.length + this.cursorX;
        displayLine = displayLine.slice(0, cursorPos) + '│' + displayLine.slice(cursorPos);
      }
      
      console.log(displayLine);
    });
    
    // 残りの入力欄スペース
    for (let i = this.inputBuffer.length; i < inputHeight - 1; i++) {
      console.log('');
    }
  }

  public appendOutput(text: string): void {
    const lines = text.split('\n');
    for (const line of lines) {
      this.outputHistory.push(line);
    }
    
    if (this.outputHistory.length > 10000) {
      this.outputHistory = this.outputHistory.slice(-10000);
    }
    
    this.redraw();
  }

  public newLine(): void {
    this.outputHistory.push('');
    this.redraw();
  }

  public destroy(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    this.clearScreen();
    this.emit('exit');
    process.exit(0);
  }
}