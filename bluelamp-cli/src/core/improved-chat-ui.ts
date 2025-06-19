import { EventEmitter } from 'events';
import * as readline from 'readline';
import chalk from 'chalk';

export class ImprovedChatUI extends EventEmitter {
  private rl!: readline.Interface;
  private outputHistory: string[] = [];
  private isMultiline: boolean = false;
  private multilineBuffer: string[] = [];

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    // readlineインターフェースを使用（ペースト対応のため）
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: ''
    });

    // 初期画面
    this.clearScreen();
    this.redraw();
    
    // 行入力ハンドラー
    this.rl.on('line', (line) => {
      this.handleLine(line);
    });

    // Ctrl+C
    this.rl.on('SIGINT', () => {
      this.emit('exit');
      this.destroy();
    });

    // プロンプトを表示
    this.updatePrompt();
  }

  private handleLine(line: string): void {
    // 複数行モードの処理
    if (this.isMultiline) {
      if (line.trim() === '') {
        // 空行で送信
        const fullText = this.multilineBuffer.join('\n');
        this.multilineBuffer = [];
        this.isMultiline = false;
        this.processInput(fullText);
      } else {
        // 行を追加
        this.multilineBuffer.push(line);
        this.updatePrompt();
      }
      return;
    }

    // 行末に \ がある場合は複数行モード
    if (line.endsWith('\\')) {
      this.isMultiline = true;
      this.multilineBuffer.push(line.slice(0, -1));
      this.updatePrompt();
      return;
    }

    // 通常の入力
    if (line.trim()) {
      this.processInput(line);
    } else {
      this.updatePrompt();
    }
  }

  private processInput(text: string): void {
    // 入力を履歴に追加
    this.appendOutput(chalk.cyan('あなた: ') + text.replace(/\n/g, '\n        '));
    
    // イベント発火
    this.emit('input', text);
    
    // プロンプト更新
    this.updatePrompt();
  }

  private updatePrompt(): void {
    const width = process.stdout.columns || 80;
    const inputHeight = this.multilineBuffer.length + 3;
    
    // カーソルを入力位置に移動
    const cursorY = (process.stdout.rows || 24) - inputHeight;
    process.stdout.write(`\x1b[${cursorY};1H`);
    
    // 入力エリアをクリア
    process.stdout.write('\x1b[J');
    
    // 区切り線
    console.log(chalk.gray('─'.repeat(width)));
    
    // 入力ボックス
    console.log(chalk.green('╭' + '─'.repeat(width - 2) + '╮'));
    
    // 複数行表示
    if (this.multilineBuffer.length > 0) {
      this.multilineBuffer.forEach((line, index) => {
        const prefix = index === 0 ? '> ' : '  ';
        const padding = ' '.repeat(width - 4 - line.length - (index === 0 ? 2 : 0));
        console.log(chalk.green('│ ') + prefix + line + padding + chalk.green(' │'));
      });
    }
    
    // 現在の入力行
    const currentLinePrefix = this.multilineBuffer.length === 0 ? '> ' : '  ';
    const promptLine = chalk.green('│ ') + currentLinePrefix;
    
    // ボックスの下部
    if (!this.isMultiline) {
      const padding = ' '.repeat(width - 4 - (this.multilineBuffer.length === 0 ? 2 : 0));
      console.log(promptLine + padding + chalk.green(' │'));
      console.log(chalk.green('╰' + '─'.repeat(width - 2) + '╯'));
    } else {
      // 複数行モードのインジケータ
      process.stdout.write(promptLine);
      const remainingWidth = width - 4 - (this.multilineBuffer.length === 0 ? 2 : 0);
      process.stdout.write(' '.repeat(remainingWidth) + chalk.green(' │\n'));
      console.log(chalk.green('╰' + '─'.repeat(width - 2) + '╯'));
      console.log(chalk.gray('複数行モード - 空行で送信'));
    }
    
    // readlineのプロンプトを設定
    this.rl.setPrompt(promptLine);
    this.rl.prompt();
  }

  private clearScreen(): void {
    console.clear();
  }

  private redraw(): void {
    this.clearScreen();
    
    const termHeight = process.stdout.rows || 24;
    const inputHeight = this.multilineBuffer.length + 5;
    const availableLines = termHeight - inputHeight;
    
    // 出力履歴を表示
    const startIndex = Math.max(0, this.outputHistory.length - availableLines);
    for (let i = startIndex; i < this.outputHistory.length; i++) {
      console.log(this.outputHistory[i]);
    }
    
    // 空行で埋める
    for (let i = this.outputHistory.length - startIndex; i < availableLines; i++) {
      console.log('');
    }
  }

  public appendOutput(text: string): void {
    // 複数行のテキストを分割
    const lines = text.split('\n');
    for (const line of lines) {
      this.outputHistory.push(line);
    }
    
    // 履歴の上限
    if (this.outputHistory.length > 1000) {
      this.outputHistory = this.outputHistory.slice(-1000);
    }
    
    // 再描画
    this.redraw();
  }

  public newLine(): void {
    this.outputHistory.push('');
    this.redraw();
  }

  public destroy(): void {
    this.rl.close();
    console.clear();
    process.exit(0);
  }
}