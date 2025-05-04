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
 * - 番号付きリスト（1. 2. 3.）
 */
class SimpleMarkdownConverter {
  constructor() {
    // エスケープ用のHTML文字列
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
   * @param {string} markdown マークダウンテキスト
   * @returns {string} HTML
   */
  convertToHtml(markdown) {
    return this.convertMarkdownToHtml(markdown);
  }

  /**
   * マークダウンテキストをHTMLに変換
   * @param {string} markdown マークダウンテキスト
   * @returns {string} HTML文字列
   */
  convertMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // コードブロックとテーブルを一時的に置き換え
    const codeBlocks = [];
    const tables = [];
    
    // コードブロックを保護
    let processedMarkdown = markdown.replace(/```([\s\S]*?)```/g, (match, code) => {
      const id = `CODE_BLOCK_${codeBlocks.length}`;
      codeBlocks.push(code);
      return id;
    });
    
    // テーブルを保護
    processedMarkdown = processedMarkdown.replace(/\|(.+)\|\s*\n\|(?:[-:]+\|)+\s*\n(\|(?:.+)\|\s*\n)+/g, (match) => {
      const id = `TABLE_BLOCK_${tables.length}`;
      tables.push(match);
      return id;
    });
    
    // エスケープ処理
    let html = this._escapeHtml(processedMarkdown);
    
    // 最小限のマークダウン変換
    html = this._convertBasicMarkdown(html);
    
    // 特殊要素を復元
    html = this._restoreSpecialBlocks(html, codeBlocks, tables);
    
    return html;
  }
  
  /**
   * 基本的なマークダウン構文をHTMLに変換
   * @param {string} text マークダウンテキスト
   * @returns {string} HTML文字列
   */
  _convertBasicMarkdown(text) {
    let html = text;
    
    // 見出し処理
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // インラインコード処理
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 太字処理
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // チェックボックス処理（シンプルに統一）
    html = html.replace(/^(\d+)\. \[x\] (.+)$/gm, '<div class="checkbox-item numbered" data-number="$1"><input type="checkbox" checked> <span>$2</span></div>');
    html = html.replace(/^(\d+)\. \[ \] (.+)$/gm, '<div class="checkbox-item numbered" data-number="$1"><input type="checkbox"> <span>$2</span></div>');
    html = html.replace(/^- \[x\] (.+)$/gm, '<div class="checkbox-item"><input type="checkbox" checked> <span>$1</span></div>');
    html = html.replace(/^- \[ \] (.+)$/gm, '<div class="checkbox-item"><input type="checkbox"> <span>$1</span></div>');
    
    // 段落処理（単純化）
    const lines = html.split('\n');
    let result = '';
    for (const line of lines) {
      if (line.trim() === '') continue;
      if (line.startsWith('<')) {
        result += line + '\n';
      } else {
        result += '<p>' + line + '</p>\n';
      }
    }
    
    return result;
  }
  
  /**
   * 特殊ブロックを復元
   * @param {string} html HTML文字列
   * @param {string[]} codeBlocks コードブロック配列
   * @param {string[]} tables テーブル配列
   * @returns {string} 特殊ブロックが復元されたHTML
   */
  _restoreSpecialBlocks(html, codeBlocks, tables) {
    // コードブロックの復元
    html = html.replace(/CODE_BLOCK_(\d+)/g, (match, index) => {
      return `<pre><code>${codeBlocks[parseInt(index, 10)]}</code></pre>`;
    });
    
    // テーブルの復元
    html = html.replace(/TABLE_BLOCK_(\d+)/g, (match, index) => {
      return this._renderTable(tables[parseInt(index, 10)]);
    });
    
    return html;
  }
  
  /**
   * マークダウンテーブルをHTMLに変換
   * @param {string} tableText マークダウンテーブル
   * @returns {string} HTML形式のテーブル
   */
  _renderTable(tableText) {
    try {
      const lines = tableText.trim().split('\n');
      if (lines.length < 3) return tableText;
      
      // ヘッダー行を処理
      const headerRow = lines[0];
      const headers = headerRow.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      
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
      
      // テーブル構築
      let html = '<table class="md-table">\n<thead>\n<tr>\n';
      
      // ヘッダー行
      headers.forEach((header, i) => {
        const align = alignments[i] || 'left';
        html += `<th style="text-align: ${align}">${header}</th>\n`;
      });
      
      html += '</tr>\n</thead>\n<tbody>\n';
      
      // データ行
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        if (cells.length === 0) continue;
        
        html += '<tr>\n';
        cells.forEach((cell, j) => {
          const align = alignments[j] || 'left';
          html += `<td style="text-align: ${align}">${cell}</td>\n`;
        });
        html += '</tr>\n';
      }
      
      html += '</tbody>\n</table>';
      return html;
    } catch (e) {
      console.error('テーブル変換エラー:', e);
      return tableText;
    }
  }
  
  /**
   * HTMLエスケープ
   * @param {string} text エスケープするテキスト
   * @returns {string} エスケープ済みテキスト
   */
  _escapeHtml(text) {
    return text.replace(/[&<>"']/g, match => this.escapeMap[match]);
  }
  
  /**
   * 特殊要素のスタイリングを適用（最小限）
   */
  enhanceSpecialElements() {
    // シンプルにログだけ出力
    console.log('enhanceSpecialElements: 最小限のスタイリングを適用');
  }
  
  /**
   * チェックボックスにイベントリスナーを設定
   */
  setupCheckboxes() {
    // VSCode APIの取得（シンプル化）
    let vscode;
    try {
      vscode = window.vsCodeApi || acquireVsCodeApi();
      window.vsCodeApi = vscode;
    } catch (e) {
      console.warn('VSCode API取得エラー:', e);
      vscode = { postMessage: msg => console.log('ダミーメッセージ:', msg) };
    }
    
    // チェックボックスイベントリスナー
    document.querySelectorAll('.markdown-content input[type="checkbox"]').forEach((checkbox, index) => {
      checkbox.addEventListener('change', e => {
        vscode.postMessage({
          command: 'updateMarkdownCheckbox',
          checked: e.target.checked,
          index: index
        });
      });
    });
  }
}

// シングルトンインスタンスとexport
const markdownConverter = new SimpleMarkdownConverter();
export default markdownConverter;

// 便利な関数としてexport
export function convertMarkdownToHtml(markdown) {
  return markdownConverter.convertMarkdownToHtml(markdown);
}

export function enhanceSpecialElements() {
  return markdownConverter.enhanceSpecialElements();
}

export function setupCheckboxes() {
  return markdownConverter.setupCheckboxes();
}