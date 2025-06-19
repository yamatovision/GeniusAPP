import { EventEmitter } from 'events';
import * as readline from 'readline';
import chalk from 'chalk';

/**
 * アプローチ3: Non-Raw Mode with readline
 * readlineを使用し、複数行検出はカスタムロジックで対応
 */
export class NonRawModeChatUI extends EventEmitter {
  private outputHistory: string[] = [];
  private rl: readline.Interface;
  private multilineBuffer: string[] = [];
  private multilineTimer: NodeJS.Timeout | null = null;
  private isMultilineMode: boolean = false;

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    console.clear();
    
    // readlineインターフェースを作成
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: ''
    });

    // 通常の行入力ハンドラー
    this.rl.on('line', (line) => {
      this.handleLine(line);
    });

    // 終了ハンドラー
    this.rl.on('close', () => {
      this.cleanup();
      process.exit(0);
    });

    // プロンプトを非表示に
    this.rl.setPrompt('');
    
    this.redraw();
  }

  private handleLine(line: string): void {
    // 複数行モードの検出
    if (this.multilineTimer) {
      clearTimeout(this.multilineTimer);
    }

    // バッファに追加
    this.multilineBuffer.push(line);

    // 50ms以内に次の行が来るかチェック
    this.multilineTimer = setTimeout(() => {
      this.processMultilineBuffer();
    }, 50);
  }

  private processMultilineBuffer(): void {
    if (this.multilineBuffer.length === 0) return;

    if (this.multilineBuffer.length === 1) {
      // 単一行の処理
      const line = this.multilineBuffer[0];
      if (line.trim()) {
        this.emit('input', line);
        this.appendOutput(chalk.cyan('あなた: ') + line);
      }
    } else {
      // 複数行の処理
      this.multilineBuffer.forEach(line => {
        if (line.trim()) {
          this.emit('input', line);
          this.appendOutput(chalk.cyan('あなた: ') + line);
        }
      });
    }

    this.multilineBuffer = [];
    this.redraw();
  }

  private redraw(): void {
    // カーソル位置を保存
    process.stdout.write('\x1b[s');
    
    // 画面をクリア
    console.clear();
    
    const termHeight = process.stdout.rows || 24;
    const termWidth = process.stdout.columns || 80;
    
    // 入力欄の高さ
    const inputHeight = 3;
    
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
    
    // readlineのプロンプトを再表示
    this.rl.prompt(true);
  }

  private drawInputBox(width: number, height: number): void {
    console.log(chalk.green('╭' + '─'.repeat(width - 2) + '╮'));
    
    // 入力欄（readlineが管理）
    console.log(chalk.green('│') + ' > ' + ' '.repeat(width - 6) + chalk.green('│'));
    
    console.log(chalk.green('╰' + '─'.repeat(width - 2) + '╯'));
    
    // カーソルを入力位置に移動
    const cursorY = (process.stdout.rows || 24) - 2;
    process.stdout.write(`\x1b[${cursorY};4H`);
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
    this.rl.close();
    this.cleanup();
    process.exit(0);
  }
}