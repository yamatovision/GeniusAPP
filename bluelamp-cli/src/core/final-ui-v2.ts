import { EventEmitter } from 'events';

interface TextSegment {
  type: 'normal' | 'paste';
  content: string;
  displayText?: string; // ペーストの場合の表示用テキスト
  pasteId?: number;
}

export interface FinalUIOptions {
  title?: string;
  welcome?: string;
}

export class FinalUIV2 extends EventEmitter {
  private outputHistory: string[] = [];
  private segments: TextSegment[] = [{ type: 'normal', content: '' }];
  private currentSegmentIndex: number = 0;
  private cursorPosition: number = 0;
  private pasteCounter: number = 0;

  constructor(options: FinalUIOptions = {}) {
    super();
    this.initialize(options);
  }

  private initialize(_options: FinalUIOptions): void {
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
        this.sendMessage();
        return;
      }
      
      // Backspace
      if ((chunk[0] === 0x7f || chunk[0] === 0x08) && !collectTimer) {
        this.handleBackspace();
        return;
      }
      
      // 矢印キー
      if (char.startsWith('\x1b[') && !collectTimer) {
        this.handleArrowKey(char);
        return;
      }
      
      // 入力をバッファに収集
      inputBuffer += char;
      
      // タイマーをリセット
      if (collectTimer) {
        clearTimeout(collectTimer);
      }
      
      // 複数行検出（改行が含まれている場合）
      if (inputBuffer.includes('\n') || inputBuffer.includes('\r')) {
        collectTimer = setTimeout(() => {
          this.processPaste(inputBuffer);
          inputBuffer = '';
          collectTimer = null;
        }, 50);
      } else {
        // 通常の文字入力
        collectTimer = setTimeout(() => {
          this.processNormalInput(inputBuffer);
          inputBuffer = '';
          collectTimer = null;
        }, 100);
      }
    });
  }

  private processNormalInput(input: string): void {
    // インデックスの範囲チェック
    if (this.currentSegmentIndex >= this.segments.length) {
      this.segments.push({ type: 'normal', content: '' });
      this.currentSegmentIndex = this.segments.length - 1;
    }
    
    const currentSegment = this.segments[this.currentSegmentIndex];
    
    if (currentSegment && currentSegment.type === 'normal') {
      // 現在のセグメントに追加
      const before = currentSegment.content.slice(0, this.cursorPosition);
      const after = currentSegment.content.slice(this.cursorPosition);
      currentSegment.content = before + input + after;
      this.cursorPosition += input.length;
    } else {
      // ペーストセグメントの後に通常テキストを追加
      if (this.currentSegmentIndex === this.segments.length - 1) {
        // 最後のセグメントの場合、新しいセグメントを追加
        this.segments.push({ type: 'normal', content: input });
        this.currentSegmentIndex++;
        this.cursorPosition = input.length;
      } else {
        // 次のセグメントに移動して追加
        this.currentSegmentIndex++;
        this.cursorPosition = 0;
        this.processNormalInput(input);
        return;
      }
    }
    
    this.redraw();
  }

  private processPaste(input: string): void {
    // 改行を正規化
    const normalizedInput = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedInput.split('\n');
    
    // ペーストセグメントを作成
    const pasteSegment: TextSegment = {
      type: 'paste',
      content: normalizedInput
    };
    
    // 6行以上は折りたたみ表示
    if (lines.length >= 6) {
      this.pasteCounter++;
      pasteSegment.displayText = `[*Pasted text #${this.pasteCounter} +${lines.length} lines*]`;
      pasteSegment.pasteId = this.pasteCounter;
    }
    
    // 現在のカーソル位置にペーストを挿入
    const currentSegment = this.segments[this.currentSegmentIndex];
    
    if (currentSegment.type === 'normal' && currentSegment.content === '') {
      // 空のセグメントの場合は置き換え
      this.segments[this.currentSegmentIndex] = pasteSegment;
    } else if (currentSegment.type === 'normal') {
      // テキストの途中にペースト
      const before = currentSegment.content.slice(0, this.cursorPosition);
      const after = currentSegment.content.slice(this.cursorPosition);
      
      const newSegments: TextSegment[] = [];
      
      // 現在のセグメントより前のセグメント
      for (let i = 0; i < this.currentSegmentIndex; i++) {
        newSegments.push(this.segments[i]);
      }
      
      // 分割されたセグメント
      if (before) {
        newSegments.push({ type: 'normal', content: before });
      }
      newSegments.push(pasteSegment);
      if (after) {
        newSegments.push({ type: 'normal', content: after });
      }
      
      // 残りのセグメント
      for (let i = this.currentSegmentIndex + 1; i < this.segments.length; i++) {
        newSegments.push(this.segments[i]);
      }
      
      this.segments = newSegments;
      this.currentSegmentIndex = newSegments.indexOf(pasteSegment);
      // ペーストの後に新しい通常セグメントを追加
      if (this.currentSegmentIndex === this.segments.length - 1 || 
          this.segments[this.currentSegmentIndex + 1].type !== 'normal') {
        this.segments.splice(this.currentSegmentIndex + 1, 0, { type: 'normal', content: '' });
      }
      this.currentSegmentIndex++;
      this.cursorPosition = 0;
    }
    
    this.redraw();
  }

  private handleBackspace(): void {
    const currentSegment = this.segments[this.currentSegmentIndex];
    
    if (currentSegment.type === 'normal' && this.cursorPosition > 0) {
      // 通常セグメント内での削除
      const before = currentSegment.content.slice(0, this.cursorPosition - 1);
      const after = currentSegment.content.slice(this.cursorPosition);
      currentSegment.content = before + after;
      this.cursorPosition--;
      
      // 空になったセグメントを削除
      if (currentSegment.content === '' && this.segments.length > 1) {
        this.segments.splice(this.currentSegmentIndex, 1);
        if (this.currentSegmentIndex > 0) {
          this.currentSegmentIndex--;
          const prevSegment = this.segments[this.currentSegmentIndex];
          this.cursorPosition = prevSegment.type === 'normal' ? prevSegment.content.length : 0;
        }
      }
    } else if (this.cursorPosition === 0 && this.currentSegmentIndex > 0) {
      // セグメント間での削除
      this.currentSegmentIndex--;
      const prevSegment = this.segments[this.currentSegmentIndex];
      
      if (prevSegment.type === 'paste') {
        // ペーストセグメントを削除
        this.segments.splice(this.currentSegmentIndex, 1);
        if (this.currentSegmentIndex > 0) {
          this.currentSegmentIndex--;
          const segment = this.segments[this.currentSegmentIndex];
          this.cursorPosition = segment.type === 'normal' ? segment.content.length : 0;
        } else {
          this.cursorPosition = 0;
        }
      } else {
        this.cursorPosition = prevSegment.content.length;
      }
    }
    
    this.redraw();
  }

  private handleArrowKey(key: string): void {
    if (key === '\x1b[D') { // 左
      if (this.cursorPosition > 0) {
        const currentSegment = this.segments[this.currentSegmentIndex];
        if (currentSegment.type === 'normal') {
          this.cursorPosition--;
        }
      } else if (this.currentSegmentIndex > 0) {
        this.currentSegmentIndex--;
        const segment = this.segments[this.currentSegmentIndex];
        this.cursorPosition = segment.type === 'normal' ? segment.content.length : 0;
      }
      this.redraw();
    } else if (key === '\x1b[C') { // 右
      const currentSegment = this.segments[this.currentSegmentIndex];
      if (currentSegment.type === 'normal' && this.cursorPosition < currentSegment.content.length) {
        this.cursorPosition++;
      } else if (this.currentSegmentIndex < this.segments.length - 1) {
        this.currentSegmentIndex++;
        this.cursorPosition = 0;
      }
      this.redraw();
    }
  }

  private sendMessage(): void {
    // 全セグメントを結合してフルテキストを作成
    const fullText = this.segments.map(seg => seg.content).join('');
    
    if (!fullText.trim()) return;
    
    // 表示用テキストを作成
    let displayText = '';
    for (const seg of this.segments) {
      if (seg.type === 'paste' && seg.displayText) {
        displayText += seg.displayText;
      } else {
        displayText += seg.content;
      }
    }
    
    // 出力に追加
    this.appendOutput('あなた: ' + displayText.replace(/\n/g, '\n        '));
    
    // イベント発火（完全なテキストを送る）
    this.emit('input', fullText);
    
    // クリア
    this.segments = [{ type: 'normal', content: '' }];
    this.currentSegmentIndex = 0;
    this.cursorPosition = 0;
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
    
    // 表示用テキストを構築
    let displayLines: string[] = [];
    let cursorLine = 0;
    let cursorCol = 0;
    let foundCursor = false;
    
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const isCurrent = i === this.currentSegmentIndex;
      
      if (seg.type === 'paste' && seg.displayText) {
        const lines = seg.displayText.split('\n');
        displayLines.push(...lines);
        
        if (isCurrent && !foundCursor) {
          cursorLine = displayLines.length;
          cursorCol = 0;
          foundCursor = true;
        }
      } else {
        const lines = seg.content.split('\n');
        for (let j = 0; j < lines.length; j++) {
          if (j > 0) displayLines.push('');
          
          if (isCurrent && j === 0 && !foundCursor) {
            cursorLine = displayLines.length;
            cursorCol = this.cursorPosition;
            foundCursor = true;
          }
          
          if (displayLines.length === 0 || j > 0) {
            displayLines.push(lines[j]);
          } else {
            displayLines[displayLines.length - 1] += lines[j];
          }
        }
      }
    }
    
    if (displayLines.length === 0) {
      displayLines = [''];
    }
    
    // 入力欄の高さを計算
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
    for (let i = 0; i < displayLines.length && i < inputHeight - 1; i++) {
      const prefix = i === 0 ? '> ' : '  ';
      let line = prefix + displayLines[i];
      
      // カーソル表示
      if (i === cursorLine && foundCursor) {
        const pos = prefix.length + cursorCol;
        line = line.slice(0, pos) + '│' + line.slice(pos);
      }
      
      console.log(line);
    }
    
    // 残りのスペース
    for (let i = displayLines.length; i < inputHeight - 1; i++) {
      console.log('');
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