// @ts-check
import stateManager from '../../state/stateManager.js';
import { convertMarkdownToHtml, enhanceSpecialElements, setupCheckboxes } from '../../utils/simpleMarkdownConverter.js';

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
    
    console.log('MarkdownViewer initialized with simple converter');
  }
  
  /**
   * 外部からの初期化用メソッド（既に初期化されている場合は何もしない）
   * エントリーポイントからの呼び出し用
   */
  init() {
    // 既に初期化済みの場合は何もしない
    console.log('MarkdownViewer: 外部からの初期化リクエストを受け取りました（必要な場合のみ再初期化）');
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
    console.log('MarkdownViewer.updateContent: 開始', {
      containerExists: !!this.container,
      contentLength: content ? content.length : 0,
      contentStart: content ? content.substring(0, 100) + '...' : 'なし'
    });
    
    if (!this.container) {
      console.error('MarkdownViewer.updateContent: コンテナが見つかりません');
      return;
    }
    
    if (!content) {
      console.warn('MarkdownViewer.updateContent: コンテンツがありません');
      this.container.innerHTML = '<p>ファイルが見つかりません</p>';
      return;
    }
    
    try {
      // 処理中の表示
      console.log('MarkdownViewer.updateContent: 処理中表示を設定します');
      this.container.classList.add('loading');
      this.container.innerHTML = '<p>マークダウンを変換中...</p>';
      
      // 非同期で処理して UI ブロッキングを防止
      console.log('MarkdownViewer.updateContent: 非同期処理を開始します');
      setTimeout(() => {
        try {
          console.time('markdown-conversion');
          console.log('MarkdownViewer.updateContent: マークダウン変換開始');
          // マークダウンをHTMLに変換（シンプル版を使用）
          const htmlContent = convertMarkdownToHtml(content);
          console.timeEnd('markdown-conversion');
          console.log('MarkdownViewer.updateContent: マークダウン変換完了', {
            htmlLength: htmlContent.length,
            htmlStart: htmlContent.substring(0, 100) + '...'
          });
          
          // DOM更新前のログ
          console.log('MarkdownViewer.updateContent: DOM更新前', {
            container: this.container.id || 'id無し',
            currentHTML: this.container.innerHTML.substring(0, 50) + '...'
          });
          
          // HTMLコンテンツを設定
          this.container.innerHTML = htmlContent;
          
          // DOM更新後のログ
          console.log('MarkdownViewer.updateContent: DOM更新後', {
            newHTML: this.container.innerHTML.substring(0, 50) + '...',
            childNodes: this.container.childNodes.length
          });
          
          // ディレクトリツリーと表の特別なスタイリングを適用
          console.log('MarkdownViewer.updateContent: 特別要素の強化を開始');
          enhanceSpecialElements();
          
          // チェックボックスのイベントリスナー設定
          console.log('MarkdownViewer.updateContent: チェックボックスの設定を開始');
          setupCheckboxes();
          
          // 表示内容を記録
          this._lastDisplayedMarkdown = content;
          
          console.log('MarkdownViewer.updateContent: マークダウン更新完了');
        } catch (error) {
          console.error('MarkdownViewer.updateContent: マークダウン更新エラー', error);
          this.container.innerHTML = `<p>マークダウンの表示に失敗しました: ${error.message}</p>
                                     <pre>${error.stack}</pre>`;
        } finally {
          // 処理中表示を解除
          console.log('MarkdownViewer.updateContent: loading クラスを削除します');
          this.container.classList.remove('loading');
        }
      }, 0);
    } catch (error) {
      console.error('MarkdownViewer.updateContent: 外部 try-catch でのエラー', error);
      this.container.innerHTML = `<p>マークダウンの表示に失敗しました: ${error.message}</p>
                                 <pre>${error.stack}</pre>`;
      this.container.classList.remove('loading');
    }
  }
  
  /**
   * テーブルのソート機能
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