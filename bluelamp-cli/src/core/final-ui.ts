import { EventEmitter } from 'events';
import * as readline from 'readline';

export class FinalUI extends EventEmitter {
  private rl!: readline.Interface;
  private outputHistory: string[] = [];
  private pasteCounter: number = 0;
  private fullText: string = ''; // 完全なテキストを保持
  private displayText: string = ''; // 表示用テキスト

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    // Raw modeで入力を制御
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    
    this.clearScreen();
    this.redraw();
    
    // バッファを使って入力を収集
    let inputBuffer = '';
    let collectTimer: NodeJS.Timeout | null = null;
    
    process.stdin.on('data', (chunk) => {
      const char = chunk.toString();
      
      // Ctrl+C
      if (chunk[0] === 0x03) {
        this.destroy();
        return;
      }
      
      // Enter（単独）
      if (chunk[0] === 0x0d && !collectTimer) {
        if (this.fullText.trim()) {
          this.sendMessage();
        }
        return;
      }
      
      // 入力をバッファに収集
      inputBuffer += char;
      
      // タイマーをリセット
      if (collectTimer) {
        clearTimeout(collectTimer);
      }
      
      // 150ms待って入力を処理
      collectTimer = setTimeout(() => {
        this.processInput(inputBuffer);
        inputBuffer = '';
        collectTimer = null;
      }, 150);
    });
  }

  private processInput(input: string): void {
    // 改行を正規化
    this.fullText = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    const lines = this.fullText.split('\n');
    
    // 6行以上は折りたたみ表示
    if (lines.length >= 6) {
      this.pasteCounter++;
      this.displayText = `[*Pasted text #${this.pasteCounter} +${lines.length} lines*]`;
    } else {
      this.displayText = this.fullText;
    }
    
    this.redraw();
  }

  private sendMessage(): void {
    const text = this.fullText;
    const lines = text.split('\n');
    
    // 出力に追加
    if (lines.length >= 6) {
      this.appendOutput(`あなた: [*Pasted text #${this.pasteCounter} +${lines.length} lines*]`);
    } else {
      this.appendOutput('あなた: ' + text.replace(/\n/g, '\n        '));
    }
    
    // イベント発火（完全なテキストを送る）
    this.emit('input', text);
    
    // クリア
    this.fullText = '';
    this.displayText = '';
    this.pasteCounter = 0;
    
    this.newLine();
    this.redraw();
  }

  private clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[H');
  }

  private redraw(): void {
    const termHeight = process.stdout.rows || 24;
    const termWidth = process.stdout.columns || 80;
    
    // 入力欄の行数を計算
    const displayLines = this.displayText.split('\n');
    const inputHeight = Math.min(6, displayLines.length + 2);
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
    if (this.displayText) {
      displayLines.forEach((line, index) => {
        const prefix = index === 0 ? '> ' : '  ';
        console.log(prefix + line);
      });
      
      // 残りのスペース
      for (let i = displayLines.length; i < inputHeight - 1; i++) {
        console.log('');
      }
    } else {
      console.log('> ');
      for (let i = 1; i < inputHeight - 1; i++) {
        console.log('');
      }
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