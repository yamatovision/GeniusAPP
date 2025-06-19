import { EventEmitter } from 'events';
import chalk from 'chalk';

/**
 * アプローチ1: タイマーベースの検出
 * 短時間で連続する入力をペーストとして認識
 */
export class TimerBasedChatUI extends EventEmitter {
  private outputHistory: string[] = [];
  private currentInput: string = '';
  private pasteBuffer: string = '';
  private pasteTimer: NodeJS.Timeout | null = null;
  private isPasting: boolean = false;
  private lastInputTime: number = 0;
  
  // ペースト検出の閾値（ミリ秒）
  private readonly PASTE_THRESHOLD = 10;
  private readonly PASTE_TIMEOUT = 50;

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    console.clear();
    
    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    
    process.stdin.on('data', this.handleKeyPress.bind(this));
    
    this.redraw();
  }

  private handleKeyPress(key: Buffer): void {
    const char = key.toString();
    const now = Date.now();
    
    // Ctrl+C
    if (char === '\x03') {
      this.emit('exit');
      this.cleanup();
      return;
    }

    // 入力間隔をチェックしてペーストを検出
    const timeSinceLastInput = now - this.lastInputTime;
    
    if (timeSinceLastInput < this.PASTE_THRESHOLD) {
      // ペースト中と判定
      if (!this.isPasting) {
        this.isPasting = true;
        this.pasteBuffer = '';
      }
    }
    
    this.lastInputTime = now;

    if (this.isPasting) {
      // ペーストバッファに追加
      this.pasteBuffer += char;
      
      // タイマーをリセット
      if (this.pasteTimer) {
        clearTimeout(this.pasteTimer);
      }
      
      // 一定時間入力がなければペースト終了
      this.pasteTimer = setTimeout(() => {
        this.processPaste();
      }, this.PASTE_TIMEOUT);
    } else {
      // 通常の入力処理
      this.processNormalInput(char);
    }
  }

  private processPaste(): void {
    this.isPasting = false;
    
    // ペーストバッファを行に分割
    const lines = this.pasteBuffer.split(/\r?\n/);
    
    // 空のペーストは無視
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
      this.pasteBuffer = '';
      return;
    }
    
    // 各行を処理
    lines.forEach((line, index) => {
      if (line.trim() || index < lines.length - 1) {
        // 入力を送信
        this.currentInput = line;
        this.emit('input', line);
        this.appendOutput(chalk.cyan('あなた: ') + line);
        this.currentInput = '';
      }
    });
    
    this.pasteBuffer = '';
    this.redraw();
  }

  private processNormalInput(char: string): void {
    // エンター
    if (char === '\r' || char === '\n') {
      if (this.currentInput.trim()) {
        const input = this.currentInput;
        this.currentInput = '';
        this.emit('input', input);
        this.appendOutput(chalk.cyan('あなた: ') + input);
      }
      this.redraw();
      return;
    }

    // バックスペース
    if (char === '\x7f' || char === '\x08') {
      if (this.currentInput.length > 0) {
        const bytes = Buffer.from(this.currentInput);
        if (bytes.length > 0) {
          let deleteBytes = 1;
          const lastByte = bytes[bytes.length - 1];
          if (lastByte >= 0x80) {
            deleteBytes = 3;
          }
          this.currentInput = bytes.slice(0, -deleteBytes).toString();
        }
      }
      this.redraw();
      return;
    }

    // 通常の文字入力
    if (char.length > 0) {
      this.currentInput += char;
      this.redraw();
    }
  }

  private redraw(): void {
    console.clear();
    
    const termHeight = process.stdout.rows || 24;
    const termWidth = process.stdout.columns || 80;
    
    const inputLines = Math.ceil(this.currentInput.length / (termWidth - 4)) || 1;
    const inputHeight = Math.max(3, inputLines + 2);
    
    const availableLines = termHeight - inputHeight - 1;
    
    const startIndex = Math.max(0, this.outputHistory.length - availableLines);
    for (let i = startIndex; i < this.outputHistory.length; i++) {
      console.log(this.outputHistory[i]);
    }
    
    for (let i = this.outputHistory.length; i < availableLines; i++) {
      console.log('');
    }
    
    console.log(chalk.gray('─'.repeat(termWidth)));
    
    this.drawInputBox(termWidth, inputHeight);
  }

  private drawInputBox(width: number, height: number): void {
    console.log(chalk.green('╭' + '─'.repeat(width - 2) + '╮'));
    
    const lines = this.wrapText(this.currentInput, width - 6);
    for (let i = 0; i < height - 2; i++) {
      if (i === 0 && lines.length === 0) {
        console.log(chalk.green('│') + ' > ' + ' '.repeat(width - 6) + chalk.green('│'));
      } else if (i < lines.length) {
        const line = lines[i];
        const padding = ' '.repeat(width - 6 - this.getDisplayWidth(line));
        console.log(chalk.green('│') + ' ' + (i === 0 ? '> ' : '  ') + line + padding + chalk.green('│'));
      } else {
        console.log(chalk.green('│') + ' '.repeat(width - 2) + chalk.green('│'));
      }
    }
    
    console.log(chalk.green('╰' + '─'.repeat(width - 2) + '╯'));
    
    const cursorLine = Math.max(0, Math.min(lines.length - 1, height - 3));
    const lastLine = lines[cursorLine] || '';
    const cursorX = 4 + this.getDisplayWidth(lastLine) + (cursorLine === 0 ? 2 : 0);
    const cursorY = (process.stdout.rows || 24) - height + cursorLine + 2;
    
    if (!isNaN(cursorY) && !isNaN(cursorX)) {
      process.stdout.write(`\x1b[${cursorY};${cursorX}H`);
    }
  }

  private wrapText(text: string, maxWidth: number): string[] {
    if (!text) return [];
    
    const lines: string[] = [];
    let currentLine = '';
    let currentWidth = 0;
    
    for (const char of text) {
      const charWidth = this.getCharWidth(char);
      if (currentWidth + charWidth > maxWidth) {
        lines.push(currentLine);
        currentLine = char;
        currentWidth = charWidth;
      } else {
        currentLine += char;
        currentWidth += charWidth;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  private getCharWidth(char: string): number {
    return char.charCodeAt(0) > 0x7F ? 2 : 1;
  }

  private getDisplayWidth(text: string): number {
    let width = 0;
    for (const char of text) {
      width += this.getCharWidth(char);
    }
    return width;
  }

  public appendOutput(text: string): void {
    this.outputHistory.push(text);
    this.redraw();
  }

  public newLine(): void {
    this.outputHistory.push('');
    this.redraw();
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    console.clear();
  }

  public destroy(): void {
    this.cleanup();
    process.exit(0);
  }
}