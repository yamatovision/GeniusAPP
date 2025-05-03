// @ts-check
import stateManager from '../../state/stateManager.js';

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
    
    console.log('MarkdownViewer initialized');
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
      // マークダウンをHTMLに変換（後でmarkdownConverter.jsに移動します）
      // 仮の単純な実装
      const htmlContent = this._simpleMarkdownToHtml(content);
      
      // HTMLコンテンツを設定
      this.container.innerHTML = htmlContent;
      
      // 特殊要素のスタイリング
      this._enhanceSpecialElements();
      
      // チェックボックスにイベントリスナーを設定
      this._setupCheckboxes();
      
      console.log('MarkdownViewer: マークダウンを更新しました');
    } catch (error) {
      console.error('MarkdownViewer: マークダウン更新エラー', error);
      this.container.innerHTML = `<p>マークダウンの表示に失敗しました: ${error.message}</p>`;
    }
  }
  
  /**
   * 簡易的なマークダウン→HTML変換（一時的な実装）
   * 後で markdownConverter.js に移動します
   */
  _simpleMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    let html = markdown
      // 改行をpタグに変換
      .replace(/\n\n/g, '</p><p>')
      // 見出し
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // リスト
      .replace(/^\*\s*(.*$)/gm, '<li>$1</li>')
      .replace(/^-\s*(.*$)/gm, '<li>$1</li>')
      // チェックボックス
      .replace(/- \[ \] (.*$)/gm, '<div class="checkbox-item"><input type="checkbox" id="task-$&">$1</div>')
      .replace(/- \[x\] (.*$)/gm, '<div class="checkbox-item"><input type="checkbox" id="task-$&" checked>$1</div>');
    
    // 段落タグで囲む
    html = '<p>' + html + '</p>';
    
    return html;
  }
  
  /**
   * 特殊要素のスタイリング適用
   */
  _enhanceSpecialElements() {
    try {
      // ディレクトリツリーの処理
      const directoryTrees = this.container.querySelectorAll('.directory-tree');
      directoryTrees.forEach(tree => {
        // ツリー項目のスタイリング
        tree.classList.add('enhanced-tree');
      });
      
      // プレーンなコードブロックの処理
      const preBlocks = this.container.querySelectorAll('pre.code-block');
      preBlocks.forEach(preBlock => {
        const content = preBlock.textContent || '';
        
        // ディレクトリ構造っぽい特徴を持っているかチェック
        if ((content.includes('├') || content.includes('└') || content.includes('│')) && 
            content.includes('/')) {
          
          // ディレクトリ構造のようなブロックに特別なクラスを追加
          preBlock.classList.add('directory-structure');
        }
      });
      
      // 表の処理
      const tables = this.container.querySelectorAll('table');
      tables.forEach(table => {
        table.classList.add('md-table');
        
        // テーブルヘッダーにソート機能を追加
        const headers = table.querySelectorAll('th');
        headers.forEach((header, index) => {
          header.addEventListener('click', () => this._sortTable(table, index));
          header.style.cursor = 'pointer';
        });
      });
    } catch (error) {
      console.error('MarkdownViewer: 特殊要素のスタイリング中にエラー', error);
    }
  }
  
  /**
   * チェックボックスにイベントリスナーを設定
   */
  _setupCheckboxes() {
    const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach((checkbox, index) => {
      checkbox.addEventListener('change', (e) => {
        // チェックボックス変更のメッセージを送信
        stateManager.sendMessage('updateMarkdownCheckbox', {
          checked: e.target.checked,
          index: index
        });
      });
    });
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