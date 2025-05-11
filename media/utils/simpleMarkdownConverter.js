// @ts-check

/**
 * 超シンプルなマークダウン変換ユーティリティ
 * 
 * マークダウンテキストをHTMLに変換するための最小限の機能を提供します。
 * 以下の基本的なマークダウン構文のみをサポート:
 * - 見出し（#, ##, ###）
 * - コードブロック（``` ```）とインラインコード（`）
 * - 太字（**）
 * - チェックリスト（[x], [ ]）
 * - テーブル（|---|）
 * 
 * 【動作原理】
 * 1. コードブロックとテーブルを一時的に置換してマークダウン処理から保護
 * 2. マークダウン要素を適切なHTML要素に変換
 * 3. 段落処理で行を.md-lineクラスのdivで囲む
 * 4. 保護したコンテンツを復元
 * 
 * 太字処理: **text** → <strong>text</strong>
 * この機能は以下のサイクルで処理されます:
 * 1. 非貪欲マッチングを使用した正規表現パターンで太字を検出
 * 2. 検出されたテキストをstrongタグで囲んだHTMLに置換
 * 3. 生成されたHTMLはCSSのfont-weightプロパティで表示を制御
 */
class SimpleMarkdownConverter {
  constructor() {
    this.escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
  }

  /**
   * マークダウンテキストをHTMLに変換
   */
  convertMarkdownToHtml(markdown) {
    // ログ出力を削除
    
    if (!markdown) return '';
    
    // コードブロックとテーブルを一時的に置き換え
    const codeBlocks = [];
    const tables = [];
    
    // コードブロックを保護
    let html = markdown.replace(/```([\s\S]*?)```/g, (match, code) => {
      const id = `CODE_BLOCK_${codeBlocks.length}`;
      codeBlocks.push(code);
      return id;
    });
    
    // テーブルを保護 - より堅牢なパターンマッチング
    html = html.replace(/^\|(.+\|)\s*\r?\n\|([-:\s|]+)\|\s*\r?\n(\|.+\|\s*\r?\n)+/gm, (match) => {
      const id = `\n__TABLE_BLOCK_${tables.length}__\n`;
      tables.push(match);
      return id;
    });
    
    // エスケープ処理はコメントアウト（マークダウン構文を保持するため）
    // html = this._escapeHtml(html);
    
    // マークダウン要素の変換
    // 見出し処理 - インラインスタイルを使用
    html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:1.1em; margin-top:0.7em; margin-bottom:0.3em; font-weight:600; color:#569CD6;">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:1.2em; margin-top:0.8em; margin-bottom:0.4em; font-weight:600; color:#569CD6;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1.5em; margin-top:1em; margin-bottom:0.5em; font-weight:600; border-bottom:1px solid var(--vscode-panel-border); padding-bottom:0.3em; color:#569CD6;">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:2em; margin-top:1.2em; margin-bottom:0.6em; font-weight:600; border-bottom:1px solid var(--vscode-panel-border); padding-bottom:0.3em; color:#569CD6;">$1</h1>');
    
    // インラインコード処理 - インラインスタイルを使用
    html = html.replace(/`([^`]+)`/g, '<code style="font-family:var(--vscode-editor-font-family,monospace); background-color:#1E1E1E; color:#FFFFFF; padding:0.2em 0.4em; border-radius:3px; font-size:0.85em; border:1px solid #3E3E3E;">$1</code>');
    
    // 太字処理
    const boldPattern = /\*\*(.*?)\*\*/g;
    
    // 太字処理 - インラインスタイルを使用して適切なスタイリング
    html = html.replace(boldPattern, (match, content) => {
      return `<span style="font-weight:700; color:#003366;">${content}</span>`;
    });
    
    // チェックボックス処理 - シンプルにチェックボックス部分だけを置換
    html = html.replace(/\[x\]/g, '<input type="checkbox" checked>');
    html = html.replace(/\[ \]/g, '<input type="checkbox">');
    
    // 段落処理 - divタグを使用して間隔を調整
    const lines = html.split('\n');
    let result = '';
    let previousLine = ''; // 直前の行を記録
    
    for (const line of lines) {
      if (line.trim() === '') {
        // 見出し後の空行は無視（過剰なスペースを防ぐ）
        const isAfterHeading = previousLine.match(/<h[1-6]>.*<\/h[1-6]>/);
        if (!isAfterHeading) {
          // 見出し以外の後の空行は<br>タグに変換
          result += '<br>\n';
        }
        continue;
      }
      
      if (line.startsWith('<')) {
        result += line + '\n';  // HTMLタグの場合はそのまま + 改行追加
      } else {
        result += '<div class="md-line">' + line + '</div>\n';  // divタグで囲む + 改行追加
      }
      
      previousLine = line; // 現在の行を記録
    }
    
    // コードブロックの復元 - インラインスタイルを使用
    result = result.replace(/CODE_BLOCK_(\d+)/g, (match, index) => {
      return `<pre style="background-color:#1E1E1E; padding:16px; border-radius:6px; overflow-x:auto; margin:1em 0; border:1px solid #3E3E3E; box-shadow:0 2px 8px rgba(0,0,0,0.15);"><code style="background-color:transparent; padding:0; color:#E0E0E0; display:block; line-height:1.5;">${codeBlocks[Number(index)]}</code></pre>`;
    });
    
    // テーブルの復元 - 新しい識別子形式に対応
    result = result.replace(/__TABLE_BLOCK_(\d+)__/g, (match, index) => {
      return this._renderTable(tables[Number(index)]);
    });
    
    return result;
  }
  
  /**
   * マークダウンテーブルをHTMLに変換
   */
  _renderTable(tableText) {
    try {
      console.log("テーブル処理開始:", tableText);
      const lines = tableText.trim().split('\n');
      if (lines.length < 3) {
        console.log("テーブル行数不足:", lines.length);
        return tableText;
      }

      // ヘッダー行を処理
      const headerRow = lines[0];
      const headers = headerRow.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      console.log("ヘッダー:", headers);

      // 配置情報を処理
      const alignmentRow = lines[1];
      const alignments = alignmentRow.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '')
        .map(cell => {
          if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
          if (cell.endsWith(':')) return 'right';
          return 'left';
        });
      console.log("配置情報:", alignments);

      // テーブル構築 - 直接HTMLタグとして処理して段落処理を回避
      let html = '<div class="table-container">\n<table class="md-table">\n<thead>\n<tr>\n';

      // ヘッダー行
      headers.forEach((header, i) => {
        const align = alignments[i] || 'left';
        html += `<th style="text-align: ${align}">${header}</th>\n`;
      });

      html += '</tr>\n</thead>\n<tbody>\n';

      // データ行
      for (let i = 2; i < lines.length; i++) {
        const rowText = lines[i];
        if (!rowText.trim() || !rowText.includes('|')) continue;

        const cells = rowText.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        if (cells.length === 0) continue;

        html += '<tr>\n';
        cells.forEach((cell, j) => {
          const align = alignments[j] || 'left';
          html += `<td style="text-align: ${align}">${cell}</td>\n`;
        });
        html += '</tr>\n';
      }

      html += '</tbody>\n</table>\n</div>';
      console.log("テーブル処理完了");
      return html;
    } catch (error) {
      console.error("テーブル処理エラー:", error);
      // エラーが発生した場合でも最低限のテーブル表示を試みる
      return `<div class="table-error">${tableText}</div>`;
    }
  }
  
  /**
   * HTMLエスケープ
   */
  _escapeHtml(text) {
    return text.replace(/[&<>"']/g, match => this.escapeMap[match]);
  }
  
  /**
   * チェックボックスにイベントリスナーを設定
   */
  setupCheckboxes() {
    try {
      const vscode = window.vsCodeApi || acquireVsCodeApi();
      window.vsCodeApi = vscode;
      
      document.querySelectorAll('.markdown-content input[type="checkbox"]').forEach((checkbox, index) => {
        checkbox.addEventListener('change', e => {
          vscode.postMessage({
            command: 'updateMarkdownCheckbox',
            checked: e.target.checked,
            index
          });
        });
      });
    } catch (e) {
      console.log('チェックボックス設定をスキップ');
    }
  }
}

// シングルトンインスタンスとして公開
const markdownConverter = new SimpleMarkdownConverter();
export default markdownConverter;

// 互換性のための関数
export const convertMarkdownToHtml = markdown => markdownConverter.convertMarkdownToHtml(markdown);
export const setupCheckboxes = () => markdownConverter.setupCheckboxes();
// 互換性のために空関数を提供
export const enhanceSpecialElements = () => {};