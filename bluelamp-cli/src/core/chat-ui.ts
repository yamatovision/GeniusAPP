import { EventEmitter } from 'events';
import * as readline from 'readline';
import chalk from 'chalk';

interface ChatUIOptions {
  title?: string;
  prompt?: string;
}

export class ChatUI extends EventEmitter {
  private rl: readline.Interface;
  private messages: string[] = [];
  private inputBuffer: string = '';
  private inputLines: string[] = [];
  private isMultiline: boolean = false;
  private lastOutputLine: number = 0;

  constructor(options: ChatUIOptions = {}) {
    super();

    // readlineインターフェースの設定
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: options.prompt || '> '
    });

    this.setupInterface();
    this.clearScreen();
    
    if (options.title) {
      this.appendOutput(chalk.cyan(options.title));
      this.appendOutput('');
    }
  }

  private setupInterface(): void {
    // 生のモードを有効化（より細かいキー制御のため）
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    // キー入力の処理
    process.stdin.on('data', (key) => {
      const keyStr = key.toString();
      
      // Ctrl+C
      if (keyStr === '\x03') {
        this.emit('exit');
        this.destroy();
        return;
      }

      // エンター（Shift押してない場合）
      if (keyStr === '\r' || keyStr === '\n') {
        if (this.isMultiline) {
          // 複数行モード中は改行を追加
          this.inputLines.push(this.inputBuffer);
          this.inputBuffer = '';
          this.redrawInput();
        } else if (this.inputBuffer.trim()) {
          // 単一行モードで入力があれば送信
          const text = this.inputBuffer;
          this.inputBuffer = '';
          this.inputLines = [];
          this.clearInput();
          this.emit('input', text);
        }
        return;
      }

      // Shift+Enter検出（簡易版）
      // 実際の実装では、より洗練された方法が必要
      if (keyStr === '\x1b[13;2u') {
        this.isMultiline = true;
        this.inputLines.push(this.inputBuffer + '\\');
        this.inputBuffer = '';
        this.redrawInput();
        return;
      }

      // バックスペース
      if (keyStr === '\x7f' || keyStr === '\b') {
        if (this.inputBuffer.length > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.redrawInput();
        }
        return;
      }

      // 通常の文字入力
      if (keyStr.length === 1 && keyStr >= ' ' && keyStr <= '~') {
        this.inputBuffer += keyStr;
        this.redrawInput();
      }
    });
  }

  private clearScreen(): void {
    console.clear();
    this.lastOutputLine = 0;
  }

  private redrawInput(): void {
    // カーソルを入力エリアの開始位置に移動
    const inputStartLine = this.lastOutputLine + 2;
    process.stdout.write(`\x1b[${inputStartLine};1H`);
    
    // 入力エリアをクリア
    process.stdout.write('\x1b[J');
    
    // 入力枠を描画
    const width = process.stdout.columns || 80;
    console.log(chalk.green('─'.repeat(width)));
    
    // 複数行の入力を表示
    if (this.inputLines.length > 0) {
      this.inputLines.forEach(line => {
        console.log(chalk.white('│ ') + line);
      });
    }
    
    // 現在の入力行
    process.stdout.write(chalk.white('│ > ') + this.inputBuffer);
    
    // カーソル位置を維持
    const cursorPos = 5 + this.inputBuffer.length;
    process.stdout.write(`\x1b[${inputStartLine + this.inputLines.length + 2};${cursorPos}H`);
  }

  private clearInput(): void {
    // 入力エリアの開始位置に移動してクリア
    const inputStartLine = this.lastOutputLine + 2;
    process.stdout.write(`\x1b[${inputStartLine};1H`);
    process.stdout.write('\x1b[J');
  }

  public appendOutput(text: string): void {
    // メッセージを追加
    this.messages.push(text);
    
    // 現在のカーソル位置を保存
    process.stdout.write('\x1b[s');
    
    // 出力エリアに追加
    process.stdout.write(`\x1b[${this.lastOutputLine + 1};1H`);
    console.log(text);
    this.lastOutputLine++;
    
    // 入力エリアを再描画
    this.redrawInput();
    
    // カーソル位置を復元
    process.stdout.write('\x1b[u');
  }

  public newLine(): void {
    this.appendOutput('');
  }

  public destroy(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    this.rl.close();
    console.clear();
    process.exit(0);
  }
}

// 使用例
if (require.main === module) {
  const ui = new ChatUI({
    title: 'ChatUI Test'
  });

  ui.appendOutput('Welcome! Type something and press Enter.');
  ui.appendOutput('Press Shift+Enter for multiline input.');
  ui.appendOutput('Press Ctrl+C to exit.');
  ui.newLine();

  ui.on('input', (text: string) => {
    ui.appendOutput(chalk.cyan('You: ') + text);
    ui.appendOutput(chalk.green('Bot: ') + 'Echo: ' + text);
    ui.newLine();
  });

  ui.on('exit', () => {
    console.log('Goodbye!');
    process.exit(0);
  });
}