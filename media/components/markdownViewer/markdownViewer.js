// @ts-check
import stateManager from '../../state/stateManager.js';
import { convertMarkdownToHtml, enhanceSpecialElements, setupCheckboxes } from '../../utils/markdownConverter.js';

class MarkdownViewer {
  constructor() {
    this.container = document.querySelector('.markdown-content');
    this.initialize();
  }
  
  initialize() {
    // 初期化時に何もない場合は「読み込み中...」を表示
    if (this.container && !this.container.innerHTML.trim()) {
      this.container.innerHTML = '<p>読み込み中...</p>';
    }
    
    // カスタムイベントのリスナーを設定
    this._setupEventListeners();
    
    console.log('MarkdownViewer initialized');
  }
  
  /**
   * カスタムイベントリスナーを設定
   */
  _setupEventListeners() {
    // マークダウン更新イベントを購読
    document.addEventListener('markdown-updated', (event) => {
      this.updateContent(event.detail.content);
    });
    
    console.log('MarkdownViewer: イベントリスナーを設定しました');
  }
  
  /**
   * マークダウンコンテンツを更新
   * @param {string} content マークダウンテキスト
   */
  updateContent(content) {
    if (!this.container) return;
    
    if (!content) {
      this.container.innerHTML = '<p>ファイルが見つかりません</p>';
      return;
    }
    
    try {
      // 処理中の表示
      this.container.classList.add('loading');
      
      // 非同期で処理して UI ブロッキングを防止
      setTimeout(() => {
        try {
          // マークダウンをHTMLに変換（外部関数を使用）
          const htmlContent = convertMarkdownToHtml(content);
          
          // HTMLコンテンツを設定
          this.container.innerHTML = htmlContent;
          
          // ディレクトリツリーと表の特別なスタイリングを適用
          enhanceSpecialElements();
          
          // チェックボックスのイベントリスナー設定
          setupCheckboxes();
          
          // 表示内容を記録
          this._lastDisplayedMarkdown = content;
          
          console.log('MarkdownViewer: マークダウンを更新しました');
        } catch (error) {
          console.error('MarkdownViewer: マークダウン更新エラー', error);
          this.container.innerHTML = `<p>マークダウンの表示に失敗しました: ${error.message}</p>`;
        } finally {
          // 処理中表示を解除
          this.container.classList.remove('loading');
        }
      }, 0);
    } catch (error) {
      console.error('MarkdownViewer: マークダウン更新エラー', error);
      this.container.innerHTML = `<p>マークダウンの表示に失敗しました: ${error.message}</p>`;
      this.container.classList.remove('loading');
    }
  }
  
  /**
   * テーブルのソート機能（残しておく - markdownConverter.jsにはないため）
   */
  _sortTable(table, columnIndex) {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const headerRow = table.querySelector('th:nth-child(' + (columnIndex + 1) + ')');
    const isAscending = !headerRow.classList.contains('sort-asc');
    
    // ソート方向クラスを設定
    table.querySelectorAll('th').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
    });
    
    headerRow.classList.add(isAscending ? 'sort-asc' : 'sort-desc');
    
    // 行をソート
    rows.sort((a, b) => {
      const cellA = a.querySelector('td:nth-child(' + (columnIndex + 1) + ')').textContent.trim();
      const cellB = b.querySelector('td:nth-child(' + (columnIndex + 1) + ')').textContent.trim();
      
      // 数値の場合は数値として比較
      if (!isNaN(cellA) && !isNaN(cellB)) {
        return isAscending ? Number(cellA) - Number(cellB) : Number(cellB) - Number(cellA);
      }
      
      // 文字列の場合は文字列として比較
      return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });
    
    // テーブルを再構築
    const tbody = table.querySelector('tbody');
    rows.forEach(row => tbody.appendChild(row));
  }
}

// 初期化して公開
const markdownViewer = new MarkdownViewer();
export default markdownViewer;