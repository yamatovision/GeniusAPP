import { EventEmitter } from 'events';
import chalk from 'chalk';

export class SimpleChatUI extends EventEmitter {
  private outputHistory: string[] = [];
  private currentInput: string = '';

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    // 画面をクリア
    console.clear();
    
    // Ctrl+Cハンドラー
    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });

    // readlineを使用しない独自入力処理
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    
    process.stdin.on('data', this.handleKeyPress.bind(this));
    
    // 初期表示
    this.redraw();
  }

  private handleKeyPress(key: Buffer): void {
    const char = key.toString();
    
    // Ctrl+C
    if (char === '\x03') {
      this.emit('exit');
      this.cleanup();
      return;
    }

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
        // マルチバイト文字を考慮
        const bytes = Buffer.from(this.currentInput);
        if (bytes.length > 0) {
          // 最後の文字が日本語の場合は3バイト削除
          let deleteBytes = 1;
          const lastByte = bytes[bytes.length - 1];
          if (lastByte >= 0x80) {
            // マルチバイト文字の可能性
            deleteBytes = 3;
          }
          this.currentInput = bytes.slice(0, -deleteBytes).toString();
        }
      }
      this.redraw();
      return;
    }

    // 通常の文字入力（日本語含む）
    if (char.length > 0) {
      this.currentInput += char;
      this.redraw();
    }
  }

  private redraw(): void {
    // 画面をクリア
    console.clear();
    
    // 出力履歴を表示
    const termHeight = process.stdout.rows || 24;
    const termWidth = process.stdout.columns || 80;
    
    // 入力欄の高さを計算（最小3行）
    const inputLines = Math.ceil(this.currentInput.length / (termWidth - 4)) || 1;
    const inputHeight = Math.max(3, inputLines + 2);
    
    // 表示可能な出力行数
    const availableLines = termHeight - inputHeight - 1;
    
    // 出力履歴の表示
    const startIndex = Math.max(0, this.outputHistory.length - availableLines);
    for (let i = startIndex; i < this.outputHistory.length; i++) {
      console.log(this.outputHistory[i]);
    }
    
    // 空行で埋める
    for (let i = this.outputHistory.length; i < availableLines; i++) {
      console.log('');
    }
    
    // 区切り線
    console.log(chalk.gray('─'.repeat(termWidth)));
    
    // 入力欄
    this.drawInputBox(termWidth, inputHeight);
  }

  private drawInputBox(width: number, height: number): void {
    // 入力枠の描画
    console.log(chalk.green('╭' + '─'.repeat(width - 2) + '╮'));
    
    // 入力内容の表示
    const lines = this.wrapText(this.currentInput, width - 6);
    for (let i = 0; i < height - 2; i++) {
      if (i === 0 && lines.length === 0) {
        // 空の入力欄
        console.log(chalk.green('│') + ' > ' + ' '.repeat(width - 6) + chalk.green('│'));
      } else if (i < lines.length) {
        const line = lines[i];
        const padding = ' '.repeat(width - 6 - this.getDisplayWidth(line));
        console.log(chalk.green('│') + ' ' + (i === 0 ? '> ' : '  ') + line + padding + chalk.green('│'));
      } else {
        // 空行
        console.log(chalk.green('│') + ' '.repeat(width - 2) + chalk.green('│'));
      }
    }
    
    console.log(chalk.green('╰' + '─'.repeat(width - 2) + '╯'));
    
    // カーソルを入力位置に移動
    const cursorLine = Math.max(0, Math.min(lines.length - 1, height - 3));
    const lastLine = lines[cursorLine] || '';
    const cursorX = 4 + this.getDisplayWidth(lastLine) + (cursorLine === 0 ? 2 : 0);
    const cursorY = (process.stdout.rows || 24) - height + cursorLine + 2;
    
    // NaNチェック
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
    // 簡易的な文字幅計算（日本語は2、英数字は1）
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