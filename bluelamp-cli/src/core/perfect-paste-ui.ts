import { EventEmitter } from 'events';
import * as readline from 'readline';

export class PerfectPasteUI extends EventEmitter {
  private rl!: readline.Interface;
  private outputHistory: string[] = [];
  private pendingLines: string[] = [];
  private lineTimer: NodeJS.Timeout | null = null;
  private pasteCounter: number = 0;

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

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
    // 行を追加
    this.pendingLines.push(line);

    // タイマーをクリア
    if (this.lineTimer) {
      clearTimeout(this.lineTimer);
    }

    // 150ms待って、それ以上入力がなければ処理
    this.lineTimer = setTimeout(() => {
      // 重要: 現在の入力欄の内容も確認
      const currentInput = this.rl.line || '';
      
      if (currentInput.trim()) {
        // 入力欄に残っている内容も追加
        this.pendingLines.push(currentInput);
        // 入力欄をクリア
        this.rl.write(null, { ctrl: true, name: 'u' });
      }
      
      this.processPendingLines();
    }, 150);
  }

  private processPendingLines(): void {
    if (this.pendingLines.length === 0) return;

    const text = this.pendingLines.join('\n');
    this.pendingLines = [];

    // 6行以上の場合は折りたたみ表示
    if (text.split('\n').length >= 6) {
      const lines = text.split('\n');
      this.pasteCounter++;
      this.appendOutput(`あなた: [*Pasted text #${this.pasteCounter} +${lines.length} lines*]`);
      // 実際の内容も保存（必要に応じて展開可能）
      this.emit('input', text);
    } else {
      // 通常の表示
      this.appendOutput('あなた: ' + text.replace(/\n/g, '\n        '));
      this.emit('input', text);
    }

    this.newLine();
    this.updatePrompt();
  }

  private updatePrompt(): void {
    const height = process.stdout.rows || 24;
    
    // カーソルを最下部に移動
    process.stdout.write(`\x1b[${height};1H`);
    
    // プロンプト行をクリア
    process.stdout.write('\x1b[K');
    
    // プロンプトを表示
    this.rl.setPrompt('> ');
    this.rl.prompt();
  }

  private clearScreen(): void {
    console.clear();
  }

  private redraw(): void {
    this.clearScreen();
    
    const termHeight = process.stdout.rows || 24;
    const availableLines = termHeight - 1; // プロンプト用に1行確保
    
    // 出力履歴を表示（最新のものから）
    const startIndex = Math.max(0, this.outputHistory.length - availableLines);
    for (let i = startIndex; i < this.outputHistory.length; i++) {
      console.log(this.outputHistory[i]);
    }
    
    // 空行で埋める
    for (let i = this.outputHistory.length - startIndex; i < availableLines; i++) {
      console.log('');
    }
    
    this.updatePrompt();
  }

  public appendOutput(text: string): void {
    const lines = text.split('\n');
    for (const line of lines) {
      this.outputHistory.push(line);
    }
    
    // 履歴の上限
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
    if (this.lineTimer) {
      clearTimeout(this.lineTimer);
    }
    this.rl.close();
    console.clear();
    process.exit(0);
  }
}