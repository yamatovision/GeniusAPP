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
    
    // テーブルを保護
    html = html.replace(/\|(.+)\|\s*\n\|(?:[-:]+\|)+\s*\n(\|(?:.+)\|\s*\n)+/g, (match) => {
      const id = `TABLE_BLOCK_${tables.length}`;
      tables.push(match);
      return id;
    });
    
    // エスケープ処理
    html = this._escapeHtml(html);
    
    // マークダウン要素の変換
    // 見出し処理
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // インラインコード処理
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 太字処理
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // チェックボックス処理 - シンプルにチェックボックス部分だけを置換
    html = html.replace(/\[x\]/g, '<input type="checkbox" checked>');
    html = html.replace(/\[ \]/g, '<input type="checkbox">');
    
    // 段落処理 - divタグを使用して間隔を調整
    const lines = html.split('\n');
    let result = '';
    for (const line of lines) {
      if (line.trim() === '') continue;
      if (line.startsWith('<')) {
        result += line + '\n';  // HTMLタグの場合はそのまま + 改行追加
      } else {
        result += '<div class="md-line">' + line + '</div>\n';  // divタグで囲む + 改行追加
      }
    }
    
    // コードブロックの復元
    result = result.replace(/CODE_BLOCK_(\d+)/g, (match, index) => {
      return `<pre><code>${codeBlocks[Number(index)]}</code></pre>`;
    });
    
    // テーブルの復元
    result = result.replace(/TABLE_BLOCK_(\d+)/g, (match, index) => {
      return this._renderTable(tables[Number(index)]);
    });
    
    return result;
  }
  
  /**
   * マークダウンテーブルをHTMLに変換
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
    } catch {
      return tableText;
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
export const enhanceSpecialElements = () => { console.log('enhanceSpecialElements: 何もしません'); };