import { EventEmitter } from 'events';
import chalk from 'chalk';

export class EnhancedChatUI extends EventEmitter {
  private outputHistory: string[] = [];
  private currentInput: string = '';
  private inputLines: string[] = [];
  private isMultiline: boolean = false;
  private scrollOffset: number = 0;
  private lastKeyTime: number = Date.now();
  private pasteBuffer: string = '';
  private isPasting: boolean = false;

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
    
    // ウィンドウリサイズ対応
    process.stdout.on('resize', () => {
      this.redraw();
    });
    
    // 初期表示
    this.redraw();
  }

  private handleKeyPress(key: Buffer): void {
    const char = key.toString();
    const currentTime = Date.now();
    
    // ペースト検出（高速な連続入力）
    if (currentTime - this.lastKeyTime < 20) {
      this.isPasting = true;
      this.pasteBuffer += char;
      
      // ペースト終了を検出するタイマー
      setTimeout(() => {
        if (this.isPasting) {
          this.isPasting = false;
          this.handlePaste();
        }
      }, 50);
      
      this.lastKeyTime = currentTime;
      return;
    }
    
    this.lastKeyTime = currentTime;
    this.isPasting = false;
    
    // Ctrl+C
    if (char === '\x03') {
      this.emit('exit');
      this.cleanup();
      return;
    }

    // エンター
    if (char === '\r' || char === '\n') {
      if (this.isMultiline) {
        // 複数行モードでの空行入力で送信
        if (this.currentInput.trim() === '' && this.inputLines.length > 0) {
          const fullText = this.inputLines.join('\n');
          this.currentInput = '';
          this.inputLines = [];
          this.isMultiline = false;
          this.emit('input', fullText);
          this.appendOutput(chalk.cyan('あなた: ') + fullText.replace(/\n/g, '\n        '));
        } else {
          // 改行を追加
          this.inputLines.push(this.currentInput);
          this.currentInput = '';
        }
      } else if (this.currentInput.trim()) {
        // 単一行モードで送信
        const text = this.currentInput;
        this.currentInput = '';
        this.emit('input', text);
        this.appendOutput(chalk.cyan('あなた: ') + text);
      }
      this.redraw();
      return;
    }

    // Shift+Enter (簡易検出 - 実際にはターミナルによって異なる)
    if (char === '\x1b[13;2u' || (char === '\n' && this.currentInput.endsWith('\\'))) {
      this.isMultiline = true;
      if (this.currentInput.endsWith('\\')) {
        this.currentInput = this.currentInput.slice(0, -1);
      }
      this.inputLines.push(this.currentInput + '\\');
      this.currentInput = '';
      this.redraw();
      return;
    }

    // バックスペース
    if (char === '\x7f' || char === '\x08') {
      if (this.currentInput.length > 0) {
        // 日本語を考慮した削除
        const bytes = Buffer.from(this.currentInput);
        let deleteCount = 1;
        
        // 最後の文字が日本語かチェック
        if (bytes.length >= 3) {
          const last3Bytes = bytes.slice(-3);
          // UTF-8の日本語文字パターン
          if (last3Bytes[0] >= 0xE0 && last3Bytes[0] <= 0xEF) {
            deleteCount = 3;
          }
        }
        
        this.currentInput = bytes.slice(0, -deleteCount).toString();
      } else if (this.inputLines.length > 0 && this.isMultiline) {
        // 複数行モードで現在行が空の場合、前の行に戻る
        this.currentInput = this.inputLines.pop() || '';
        if (this.currentInput.endsWith('\\')) {
          this.currentInput = this.currentInput.slice(0, -1);
        }
      }
      this.redraw();
      return;
    }

    // 上下矢印でスクロール
    if (char === '\x1b[A') { // 上矢印
      this.scrollUp();
      return;
    }
    if (char === '\x1b[B') { // 下矢印
      this.scrollDown();
      return;
    }

    // 通常の文字入力
    if (char.length > 0 && char !== '\x1b') {
      this.currentInput += char;
      this.redraw();
    }
  }

  private handlePaste(): void {
    if (this.pasteBuffer) {
      const lines = this.pasteBuffer.split(/\r?\n/);
      
      // 6行以上の場合は折りたたみ表示
      if (lines.length > 6) {
        this.appendOutput(chalk.gray(`[*Pasted text +${lines.length} lines*]`));
        this.inputLines = lines;
        this.isMultiline = true;
        this.currentInput = '';
      } else {
        // 少ない行数はそのまま入力
        this.currentInput += this.pasteBuffer;
      }
      
      this.pasteBuffer = '';
      this.redraw();
    }
  }

  private scrollUp(): void {
    if (this.scrollOffset < this.outputHistory.length - 10) {
      this.scrollOffset++;
      this.redraw();
    }
  }

  private scrollDown(): void {
    if (this.scrollOffset > 0) {
      this.scrollOffset--;
      this.redraw();
    }
  }

  private redraw(): void {
    // 画面をクリア
    console.clear();
    
    const termHeight = process.stdout.rows || 24;
    const termWidth = process.stdout.columns || 80;
    
    // 入力欄の高さを計算
    const inputDisplayLines = this.inputLines.length + 1;
    const inputHeight = Math.max(3, Math.min(6, inputDisplayLines + 2));
    
    // 表示可能な出力行数
    const availableLines = termHeight - inputHeight - 1;
    
    // スクロールを考慮した出力履歴の表示
    const endIndex = this.outputHistory.length - this.scrollOffset;
    const startIndex = Math.max(0, endIndex - availableLines);
    
    // スクロールインジケータ
    if (this.scrollOffset > 0) {
      console.log(chalk.gray(`↑ ${this.scrollOffset}行上にスクロール中...`));
    }
    
    // 出力履歴の表示
    for (let i = startIndex; i < endIndex; i++) {
      console.log(this.outputHistory[i]);
    }
    
    // 空行で埋める
    for (let i = endIndex - startIndex; i < availableLines; i++) {
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
    
    // 複数行の表示
    let displayedLines = 0;
    
    // 既存の入力行
    for (let i = 0; i < this.inputLines.length && displayedLines < height - 2; i++) {
      const line = this.inputLines[i];
      const displayLine = this.truncateLine(line, width - 6);
      const padding = ' '.repeat(width - 6 - this.getDisplayWidth(displayLine));
      console.log(chalk.green('│') + ' ' + (i === 0 ? '> ' : '  ') + displayLine + padding + chalk.green('│'));
      displayedLines++;
    }
    
    // 現在の入力行
    if (displayedLines < height - 2) {
      const prefix = this.inputLines.length === 0 ? '> ' : '  ';
      const displayLine = this.truncateLine(this.currentInput, width - 6);
      const padding = ' '.repeat(width - 6 - this.getDisplayWidth(displayLine));
      console.log(chalk.green('│') + ' ' + prefix + displayLine + padding + chalk.green('│'));
      displayedLines++;
    }
    
    // 残りの空行
    for (let i = displayedLines; i < height - 2; i++) {
      console.log(chalk.green('│') + ' '.repeat(width - 2) + chalk.green('│'));
    }
    
    // 下部ボーダー
    console.log(chalk.green('╰' + '─'.repeat(width - 2) + '╯'));
    
    // ステータス行（複数行モードの場合）
    if (this.isMultiline) {
      console.log(chalk.gray('複数行モード - 空行を入力して送信'));
    }
    
    // カーソルを入力位置に移動
    const cursorY = (process.stdout.rows || 24) - (this.isMultiline ? 2 : 1);
    const cursorX = 4 + this.getDisplayWidth(this.currentInput) + (this.inputLines.length === 0 ? 2 : 0);
    
    if (!isNaN(cursorY) && !isNaN(cursorX)) {
      process.stdout.write(`\x1b[${cursorY};${cursorX}H`);
    }
  }

  private truncateLine(text: string, maxWidth: number): string {
    if (this.getDisplayWidth(text) <= maxWidth) {
      return text;
    }
    
    // 幅に収まるように切り詰め
    let result = '';
    let width = 0;
    
    for (const char of text) {
      const charWidth = this.getCharWidth(char);
      if (width + charWidth > maxWidth - 3) {
        return result + '...';
      }
      result += char;
      width += charWidth;
    }
    
    return result;
  }

  private getCharWidth(char: string): number {
    // 簡易的な文字幅計算（日本語は2、英数字は1）
    const code = char.charCodeAt(0);
    if (code >= 0x3000 && code <= 0x9FFF) return 2; // CJK文字
    if (code >= 0xFF00 && code <= 0xFFEF) return 2; // 全角記号
    return 1;
  }

  private getDisplayWidth(text: string): number {
    let width = 0;
    for (const char of text) {
      width += this.getCharWidth(char);
    }
    return width;
  }

  public appendOutput(text: string): void {
    // 複数行のテキストを分割して追加
    const lines = text.split('\n');
    for (const line of lines) {
      this.outputHistory.push(line);
    }
    
    // 履歴の上限管理
    const maxHistory = 1000;
    if (this.outputHistory.length > maxHistory) {
      this.outputHistory = this.outputHistory.slice(-maxHistory);
    }
    
    // スクロールをリセット
    this.scrollOffset = 0;
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