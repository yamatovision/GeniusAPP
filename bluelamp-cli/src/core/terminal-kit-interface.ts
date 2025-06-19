import { EventEmitter } from 'events';
const termkit = require('terminal-kit');

export interface TerminalKitInterfaceOptions {
  outputRatio?: number; // 出力エリアの比率（デフォルト: 0.8）
  title?: string;
}

export class TerminalKitInterface extends EventEmitter {
  private term: any;
  private outputBuffer: string[] = [];
  private inputBuffer: string = '';
  private outputAreaHeight: number;
  private inputAreaHeight: number = 5;
  private isInPasteMode: boolean = false;
  private pasteBuffer: string = '';
  private pasteTimeout: NodeJS.Timeout | null = null;
  private cursorLine: number = 0;
  private cursorColumn: number = 0;

  constructor(options: TerminalKitInterfaceOptions = {}) {
    super();
    
    this.term = termkit.terminal;
    
    // フルスクリーンモードを先に有効化
    this.term.fullscreen();
    
    // ターミナルサイズを取得（process.stdoutから直接取得）
    const width = process.stdout.columns || 80;
    const height = process.stdout.rows || 24;
    
    // terminal-kitの値が無効な場合は上書き
    if (!this.term.width || this.term.width === Infinity) {
      this.term.width = width;
    }
    if (!this.term.height || this.term.height === Infinity) {
      this.term.height = height;
    }
    
    // デバッグ情報
    console.error('TerminalKitInterface initialized');
    console.error('Event listeners:', this.eventNames());
    
    this.term.grabInput({ mouse: true });
    
    // 画面サイズの計算
    this.outputAreaHeight = Math.floor(this.term.height * (options.outputRatio || 0.8));
    
    // 初期画面の設定
    this.setupScreen();
    
    // イベントハンドラーの設定
    this.setupEventHandlers();
    
    // イベントリスナーの確認
    console.error('Input event listeners:', this.listenerCount('input'));
  }

  private setupScreen(): void {
    // 画面をクリア
    this.term.clear();
    
    // 出力エリアとボーダーを描画
    this.drawBorder();
    
    // ステータスラインを描画
    this.drawStatusLine();
    
    // 入力エリアのボーダーを描画
    this.drawInputBorder();
    
    // カーソルを入力エリアに配置
    this.moveCursorToInput();
  }

  private drawBorder(): void {
    // 出力エリアの上部ボーダー
    this.term.moveTo(1, 1);
    const borderWidth = Math.max(0, this.term.width - 2);
    this.term.cyan('╭' + '─'.repeat(borderWidth) + '╮');
    
    // 出力エリアの側面ボーダー
    for (let i = 2; i <= this.outputAreaHeight; i++) {
      this.term.moveTo(1, i).cyan('│');
      this.term.moveTo(this.term.width, i).cyan('│');
    }
    
    // 出力エリアの下部ボーダー
    this.term.moveTo(1, this.outputAreaHeight + 1);
    this.term.cyan('╰' + '─'.repeat(borderWidth) + '╯');
  }

  private drawStatusLine(): void {
    this.term.moveTo(1, this.outputAreaHeight + 2);
    this.term.bgBlue.white.eraseLine();
    const statusText = ' Enter: 送信 | Shift+Enter: 改行 | Ctrl+C: 終了 ';
    const padding = Math.max(0, Math.floor((this.term.width - statusText.length) / 2));
    this.term.move(padding, 0).white(statusText);
    this.term.bgDefaultColor();
  }

  private drawInputBorder(): void {
    const inputTop = this.outputAreaHeight + 3;
    const lines = this.inputBuffer.split('\n');
    const requiredHeight = Math.max(5, lines.length + 2); // 最小5行、内容に応じて拡張
    
    // 入力エリアの高さを動的に調整
    if (requiredHeight !== this.inputAreaHeight) {
      this.inputAreaHeight = requiredHeight;
      // 画面全体を再描画
      this.setupScreen();
      this.redrawOutput();
    }
    
    // 入力エリアの上部ボーダー
    this.term.moveTo(1, inputTop);
    const inputBorderWidth = Math.max(0, this.term.width - 2);
    this.term.green('╭' + '─'.repeat(inputBorderWidth) + '╮');
    
    // 入力エリアの側面ボーダーと内容をクリア
    for (let i = 1; i < this.inputAreaHeight - 1; i++) {
      this.term.moveTo(1, inputTop + i).green('│');
      this.term.moveTo(3, inputTop + i).eraseLineAfter();
      this.term.moveTo(this.term.width, inputTop + i).green('│');
    }
    
    // 入力エリアの下部ボーダー
    this.term.moveTo(1, inputTop + this.inputAreaHeight - 1);
    this.term.green('╰' + '─'.repeat(inputBorderWidth) + '╯');
  }

  private moveCursorToInput(): void {
    const inputTop = this.outputAreaHeight + 4;
    this.cursorLine = 0;
    this.cursorColumn = 0;
    this.term.moveTo(3, inputTop);
  }

  private setupEventHandlers(): void {
    let lastKeyTime = Date.now();
    let isComposing = false; // IME変換中フラグ
    
    this.term.on('key', (name: string, _matches: any, data: any) => {
      const currentTime = Date.now();
      
      // ペーストモードの検出（改良版）
      // 通常の日本語入力と区別するため、より短い閾値を使用
      if (currentTime - lastKeyTime < 20 && !isComposing) {
        this.isInPasteMode = true;
        if (this.pasteTimeout) clearTimeout(this.pasteTimeout);
        
        this.pasteTimeout = setTimeout(() => {
          this.isInPasteMode = false;
          this.processPastedText();
        }, 100);
      }
      
      lastKeyTime = currentTime;
      
      // Ctrl+Cで終了
      if (name === 'CTRL_C') {
        this.emit('exit');
        this.destroy();
        return;
      }
      
      // 通常の文字入力
      if (data.isCharacter && !data.ctrl && !data.meta) {
        if (this.isInPasteMode) {
          this.pasteBuffer += data.char || '';
        } else {
          this.inputBuffer += data.char || '';
          this.term(data.char || '');
          this.cursorColumn++;
        }
        return;
      }
      
      // 特殊キーの処理
      switch (name) {
        case 'ENTER':
          // デバッグ情報
          console.error('ENTER key pressed', {
            shift: data.shift,
            isInPasteMode: this.isInPasteMode,
            inputBuffer: this.inputBuffer,
            trimmedLength: this.inputBuffer.trim().length
          });
          
          if (data.shift) {
            // Shift+Enter: 改行（\マーカー付き）
            this.inputBuffer += '\\\n';
            this.cursorLine++;
            this.cursorColumn = 0;
            this.term('\\').nextLine(1).column(3);
          } else if (this.isInPasteMode) {
            // ペーストモード中: 改行のみ
            this.inputBuffer += '\n';
            this.pasteBuffer += '\n';
            this.cursorLine++;
            this.cursorColumn = 0;
            this.term.nextLine(1).column(3);
          } else {
            // Enter単体: 送信
            const text = this.inputBuffer;
            console.error('Attempting to emit input:', text);
            if (text && text.trim()) {
              console.error('Emitting input event with text:', text);
              this.emit('input', text);
              this.clearInput();
            } else {
              console.error('No text to emit (empty or whitespace only)');
            }
          }
          break;
          
        case 'BACKSPACE':
          if (this.inputBuffer.length > 0 && this.cursorColumn > 0) {
            // カーソル位置の文字を削除
            const lines = this.inputBuffer.split('\n');
            const currentLineText = lines[this.cursorLine] || '';
            
            if (this.cursorColumn > 0) {
              lines[this.cursorLine] = 
                currentLineText.slice(0, this.cursorColumn - 1) + 
                currentLineText.slice(this.cursorColumn);
              this.inputBuffer = lines.join('\n');
              
              this.term.backDelete(1);
              this.cursorColumn--;
            } else if (this.cursorLine > 0) {
              // 行の先頭で改行を削除
              this.cursorLine--;
              this.cursorColumn = lines[this.cursorLine].length;
              lines[this.cursorLine] += lines[this.cursorLine + 1];
              lines.splice(this.cursorLine + 1, 1);
              this.inputBuffer = lines.join('\n');
              this.redrawInput();
            }
          }
          break;
          
        case 'LEFT':
          if (this.cursorColumn > 0) {
            this.term.left(1);
            this.cursorColumn--;
          } else if (this.cursorLine > 0) {
            this.cursorLine--;
            const lines = this.inputBuffer.split('\n');
            this.cursorColumn = lines[this.cursorLine].length;
            this.term.up(1).column(3 + this.cursorColumn);
          }
          break;
          
        case 'RIGHT':
          const lines = this.inputBuffer.split('\n');
          const currentLineLength = (lines[this.cursorLine] || '').length;
          if (this.cursorColumn < currentLineLength) {
            this.term.right(1);
            this.cursorColumn++;
          } else if (this.cursorLine < lines.length - 1) {
            this.cursorLine++;
            this.cursorColumn = 0;
            this.term.nextLine(1).column(3);
          }
          break;
          
        case 'UP':
          if (this.cursorLine > 0) {
            this.cursorLine--;
            const lines = this.inputBuffer.split('\n');
            this.cursorColumn = Math.min(this.cursorColumn, lines[this.cursorLine].length);
            this.term.up(1).column(3 + this.cursorColumn);
          }
          break;
          
        case 'DOWN':
          const totalLines = this.inputBuffer.split('\n');
          if (this.cursorLine < totalLines.length - 1) {
            this.cursorLine++;
            this.cursorColumn = Math.min(this.cursorColumn, totalLines[this.cursorLine].length);
            this.term.down(1).column(3 + this.cursorColumn);
          }
          break;
      }
    });
    
    // ウィンドウリサイズ
    this.term.on('resize', (_width: number, height: number) => {
      this.outputAreaHeight = Math.floor(height * 0.8);
      this.setupScreen();
      this.redrawOutput();
      this.redrawInput();
    });
  }

  private processPastedText(): void {
    if (this.pasteBuffer) {
      this.inputBuffer += this.pasteBuffer;
      this.redrawInput();
      this.pasteBuffer = '';
    }
  }

  private clearInput(): void {
    this.inputBuffer = '';
    this.cursorLine = 0;
    this.cursorColumn = 0;
    this.drawInputBorder();
    this.moveCursorToInput();
  }

  private redrawInput(): void {
    // 入力エリアを再描画
    this.drawInputBorder();
    
    const inputTop = this.outputAreaHeight + 4;
    const lines = this.inputBuffer.split('\n');
    
    for (let i = 0; i < Math.min(lines.length, this.inputAreaHeight - 2); i++) {
      this.term.moveTo(3, inputTop + i);
      this.term(lines[i]);
    }
    
    // カーソルを正しい位置に戻す
    this.term.moveTo(3 + this.cursorColumn, inputTop + this.cursorLine);
  }

  private redrawOutput(): void {
    // 出力エリアを再描画
    const startLine = Math.max(0, this.outputBuffer.length - (this.outputAreaHeight - 2));
    
    for (let i = 0; i < this.outputAreaHeight - 2; i++) {
      this.term.moveTo(3, i + 2);
      this.term.eraseLineAfter();
      
      const bufferIndex = startLine + i;
      if (bufferIndex < this.outputBuffer.length) {
        const line = this.outputBuffer[bufferIndex];
        // 長い行は切り詰める
        if (line.length > this.term.width - 4) {
          this.term(line.substring(0, this.term.width - 7) + '...');
        } else {
          this.term(line);
        }
      }
    }
  }

  public appendOutput(text: string): void {
    // 改行で分割して出力バッファに追加
    const lines = text.split('\n');
    for (const line of lines) {
      if (line) {
        this.outputBuffer.push(line);
      }
    }
    
    // 出力エリアを更新
    this.redrawOutput();
    
    // カーソルを入力エリアに戻す
    const inputTop = this.outputAreaHeight + 4;
    this.term.moveTo(3 + this.cursorColumn, inputTop + this.cursorLine);
  }

  public appendStreamOutput(text: string): void {
    // ストリーミング出力（改行なし）
    if (this.outputBuffer.length === 0) {
      this.outputBuffer.push(text);
    } else {
      this.outputBuffer[this.outputBuffer.length - 1] += text;
    }
    
    this.redrawOutput();
    
    // カーソルを入力エリアに戻す
    const inputTop = this.outputAreaHeight + 4;
    this.term.moveTo(3 + this.cursorColumn, inputTop + this.cursorLine);
  }

  public newLine(): void {
    this.outputBuffer.push('');
    this.redrawOutput();
  }

  public clearOutput(): void {
    this.outputBuffer = [];
    this.drawBorder();
    this.redrawOutput();
  }

  public destroy(): void {
    this.term.fullscreen(false);
    this.term.grabInput(false);
    this.term.clear();
    this.term.processExit(0);
  }
}