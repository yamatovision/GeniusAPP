import { EventEmitter } from 'events';
import * as readline from 'readline';

export class HybridUI extends EventEmitter {
  private rl!: readline.Interface;
  private outputHistory: string[] = [];
  private multilineBuffer: string[] = [];
  private isMultilineMode: boolean = false;
  private pasteCounter: number = 0;
  private lineTimer: NodeJS.Timeout | null = null;
  private tempLines: string[] = [];

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: ''
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
    // 行をテンポラリバッファに追加
    this.tempLines.push(line);

    // タイマーをクリア
    if (this.lineTimer) {
      clearTimeout(this.lineTimer);
    }

    // 200ms待機して、連続入力を検出
    this.lineTimer = setTimeout(() => {
      // 現在入力欄にある内容も含める
      const currentInput = this.rl.line || '';
      if (currentInput) {
        this.tempLines.push(currentInput);
        // 入力欄をクリアしない - ここが重要！
      }

      // 複数行の場合は複数行モードに
      if (this.tempLines.length > 1 || (this.tempLines.length === 1 && currentInput)) {
        this.enterMultilineMode();
      } else if (this.tempLines.length === 1) {
        // 単一行はそのまま送信
        const text = this.tempLines[0];
        this.tempLines = [];
        if (text.trim()) {
          this.sendMessage(text);
        }
      }
    }, 200);
  }

  private enterMultilineMode(): void {
    this.isMultilineMode = true;
    this.multilineBuffer = [...this.tempLines];
    this.tempLines = [];
    
    // 入力欄に全ての行を表示
    const allText = this.multilineBuffer.join('\n');
    
    // 入力欄を一旦クリアして、全テキストを設定
    this.rl.write(null, { ctrl: true, name: 'u' });
    this.rl.write(allText);
    
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
    
    this.emit('input', text);
    this.newLine();
    
    // リセット
    this.isMultilineMode = false;
    this.multilineBuffer = [];
    this.updatePrompt();
  }

  private updatePrompt(): void {
    const height = process.stdout.rows || 24;
    const width = process.stdout.columns || 80;
    
    // カーソルを適切な位置に移動
    const inputLines = this.isMultilineMode ? this.multilineBuffer.length : 1;
    const promptY = height - inputLines;
    
    process.stdout.write(`\x1b[${promptY};1H`);
    process.stdout.write('\x1b[J'); // 以下をクリア
    
    if (this.isMultilineMode) {
      // 複数行モードの表示
      console.log('─'.repeat(width));
      console.log('📝 複数行モード (Enterで送信, Ctrl+Cでキャンセル)');
      this.rl.setPrompt('> ');
    } else {
      // 通常モード
      this.rl.setPrompt('> ');
    }
    
    this.rl.prompt();
  }

  private clearScreen(): void {
    console.clear();
  }

  private redraw(): void {
    this.clearScreen();
    
    const termHeight = process.stdout.rows || 24;
    const inputHeight = this.isMultilineMode ? this.multilineBuffer.length + 3 : 2;
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
    
    this.updatePrompt();
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
    if (this.lineTimer) {
      clearTimeout(this.lineTimer);
    }
    this.rl.close();
    console.clear();
    process.exit(0);
  }
}