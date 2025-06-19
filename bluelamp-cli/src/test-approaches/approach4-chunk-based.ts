import { EventEmitter } from 'events';
import chalk from 'chalk';

/**
 * アプローチ4: チャンクベースの検出
 * 大きなデータチャンクを検出してペーストとして処理
 */
export class ChunkBasedChatUI extends EventEmitter {
  private outputHistory: string[] = [];
  private currentInput: string = '';
  private chunkBuffer: Buffer[] = [];
  private chunkTimer: NodeJS.Timeout | null = null;

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

    // Raw modeを使わずに、データをチャンクで受信
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', this.handleChunk.bind(this));
    
    this.redraw();
  }

  private handleChunk(chunk: string): void {
    // Ctrl+C
    if (chunk === '\x03') {
      this.emit('exit');
      this.cleanup();
      return;
    }

    // チャンクサイズで判定
    if (chunk.length > 1) {
      // 大きなチャンク = ペーストの可能性
      this.handlePasteChunk(chunk);
    } else {
      // 単一文字 = 通常入力
      this.handleSingleInput(chunk);
    }
  }

  private handlePasteChunk(chunk: string): void {
    // 改行で分割して処理
    const lines = chunk.split(/\r?\n/);
    
    // 現在の入力と最初の行を結合
    if (lines.length > 0 && this.currentInput) {
      lines[0] = this.currentInput + lines[0];
      this.currentInput = '';
    }
    
    // 最後の行が改行で終わっていない場合は、入力として保持
    let keepLastLine = false;
    if (!chunk.endsWith('\n') && !chunk.endsWith('\r')) {
      keepLastLine = true;
    }
    
    const processLines = keepLastLine ? lines.slice(0, -1) : lines;
    const lastLine = keepLastLine ? lines[lines.length - 1] : '';
    
    // 各行を処理
    processLines.forEach(line => {
      if (line.trim()) {
        this.emit('input', line);
        this.appendOutput(chalk.cyan('あなた: ') + line);
      }
    });
    
    this.currentInput = lastLine;
    this.redraw();
  }

  private handleSingleInput(char: string): void {
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
    if (char === '\x7f' || char === '\x08' || char === '\b') {
      if (this.currentInput.length > 0) {
        this.currentInput = this.currentInput.slice(0, -1);
      }
      this.redraw();
      return;
    }

    // 通常の文字入力
    if (char.length > 0 && char.charCodeAt(0) >= 32) {
      this.currentInput += char;
      this.redraw();
    }
  }

  private redraw(): void {
    // カーソルを保存
    process.stdout.write('\x1b[s');
    
    // 画面をクリア
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
    
    // カーソル位置を計算して移動
    const cursorLine = Math.min(lines.length - 1, height - 3);
    const lastLineText = lines[cursorLine] || '';
    const cursorX = 4 + this.getDisplayWidth(lastLineText) + (cursorLine === 0 ? 2 : 0);
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
    console.clear();
  }

  public destroy(): void {
    this.cleanup();
    process.exit(0);
  }
}