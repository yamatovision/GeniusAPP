import { EventEmitter } from 'events';

export class RawModeUIV2 extends EventEmitter {
  private outputHistory: string[] = [];
  private inputBuffer: string = ''; // 単一のバッファに変更
  private displayLines: string[] = ['']; // 表示用の行
  private cursorLine: number = 0;
  private cursorColumn: number = 0;
  private pasteCounter: number = 0;
  
  // ペースト検出用
  private lastInputTime: number = 0;
  private isPasting: boolean = false;
  private pasteBuffer: string = '';

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
    const now = Date.now();
    const timeSinceLastInput = now - this.lastInputTime;
    
    // ペースト検出（10ms以内の連続入力）
    if (timeSinceLastInput < 10) {
      this.isPasting = true;
      this.pasteBuffer += key.toString();
      
      // ペースト終了を検出するタイマー
      setTimeout(() => {
        if (this.isPasting) {
          this.processPasteBuffer();
          this.isPasting = false;
          this.pasteBuffer = '';
        }
      }, 50);
      
      this.lastInputTime = now;
      return;
    }
    
    this.lastInputTime = now;
    
    // 通常の入力処理
    const char = key.toString();
    
    // Ctrl+C
    if (key[0] === 0x03) {
      this.destroy();
      return;
    }

    // Enter (送信)
    if (key[0] === 0x0d) {
      const text = this.inputBuffer.trim();
      if (text) {
        this.sendMessage(text);
      }
      return;
    }

    // Backspace
    if (key[0] === 0x7f || key[0] === 0x08) {
      if (this.inputBuffer.length > 0) {
        // カーソル位置から1文字削除
        const pos = this.getCursorPosition();
        if (pos > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, pos - 1) + this.inputBuffer.slice(pos);
          this.updateDisplayLines();
          this.moveCursorLeft();
        }
      }
      return;
    }

    // 矢印キー
    if (char.startsWith('\x1b[')) {
      this.handleArrowKeys(char);
      return;
    }

    // 通常の文字入力
    if (char.length > 0 && char.charCodeAt(0) >= 32) {
      const pos = this.getCursorPosition();
      this.inputBuffer = this.inputBuffer.slice(0, pos) + char + this.inputBuffer.slice(pos);
      this.updateDisplayLines();
      this.moveCursorRight();
    }
  }

  private processPasteBuffer(): void {
    if (this.pasteBuffer) {
      const pos = this.getCursorPosition();
      this.inputBuffer = this.inputBuffer.slice(0, pos) + this.pasteBuffer + this.inputBuffer.slice(pos);
      this.updateDisplayLines();
      
      // カーソルをペーストした分だけ移動
      const addedLength = this.pasteBuffer.length;
      for (let i = 0; i < addedLength; i++) {
        this.moveCursorRight();
      }
    }
  }

  private handleArrowKeys(char: string): void {
    switch(char) {
      case '\x1b[A': // 上
        this.moveCursorUp();
        break;
      case '\x1b[B': // 下
        this.moveCursorDown();
        break;
      case '\x1b[C': // 右
        this.moveCursorRight();
        break;
      case '\x1b[D': // 左
        this.moveCursorLeft();
        break;
    }
  }

  private getCursorPosition(): number {
    let pos = 0;
    for (let i = 0; i < this.cursorLine; i++) {
      pos += this.displayLines[i].length + 1; // +1 for newline
    }
    pos += this.cursorColumn;
    return Math.min(pos, this.inputBuffer.length);
  }

  private updateDisplayLines(): void {
    // 改行で分割して表示用の行を更新
    this.displayLines = this.inputBuffer.split('\n');
    if (this.displayLines.length === 0) {
      this.displayLines = [''];
    }
    
    // カーソル位置を調整
    this.cursorLine = Math.min(this.cursorLine, this.displayLines.length - 1);
    this.cursorColumn = Math.min(this.cursorColumn, this.displayLines[this.cursorLine].length);
    
    this.redraw();
  }

  private moveCursorUp(): void {
    if (this.cursorLine > 0) {
      this.cursorLine--;
      this.cursorColumn = Math.min(this.cursorColumn, this.displayLines[this.cursorLine].length);
      this.redraw();
    }
  }

  private moveCursorDown(): void {
    if (this.cursorLine < this.displayLines.length - 1) {
      this.cursorLine++;
      this.cursorColumn = Math.min(this.cursorColumn, this.displayLines[this.cursorLine].length);
      this.redraw();
    }
  }

  private moveCursorLeft(): void {
    if (this.cursorColumn > 0) {
      this.cursorColumn--;
    } else if (this.cursorLine > 0) {
      this.cursorLine--;
      this.cursorColumn = this.displayLines[this.cursorLine].length;
    }
    this.redraw();
  }

  private moveCursorRight(): void {
    if (this.cursorColumn < this.displayLines[this.cursorLine].length) {
      this.cursorColumn++;
    } else if (this.cursorLine < this.displayLines.length - 1) {
      this.cursorLine++;
      this.cursorColumn = 0;
    }
    this.redraw();
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
    this.inputBuffer = '';
    this.displayLines = [''];
    this.cursorLine = 0;
    this.cursorColumn = 0;
    
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
    const inputHeight = Math.min(6, this.displayLines.length + 2);
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
    this.displayLines.forEach((line, index) => {
      const prefix = index === 0 ? '> ' : '  ';
      let displayLine = prefix + line;
      
      // カーソル位置にカーソルを表示
      if (index === this.cursorLine) {
        const cursorPos = prefix.length + this.cursorColumn;
        const beforeCursor = displayLine.slice(0, cursorPos);
        const afterCursor = displayLine.slice(cursorPos);
        displayLine = beforeCursor + '│' + afterCursor;
      }
      
      console.log(displayLine);
    });
    
    // 残りの入力欄スペース
    for (let i = this.displayLines.length; i < inputHeight - 1; i++) {
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