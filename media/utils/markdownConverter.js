// @ts-check

/**
 * マークダウン変換ユーティリティ
 * 
 * マークダウンテキストをHTMLに変換するための機能を提供します。
 */
class MarkdownConverter {
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
   * @param {string} text マークダウンテキスト
   * @returns {string} HTML
   */
  convertToHtml(text) {
    if (!text) return '';
    
    // 特殊文字をエスケープ（コードブロック内は除く）
    text = this._escapeHtml(text);
    
    // プレーンテキストを分割（コードブロックを保護）
    const chunks = this._splitByCodeBlocks(text);
    
    // 各チャンクを処理
    const processedChunks = chunks.map((chunk, index) => {
      // 偶数インデックスがプレーンテキスト、奇数インデックスがコードブロック
      if (index % 2 === 0) {
        return this._processPlainText(chunk);
      } else {
        return chunk; // コードブロックはそのまま保持
      }
    });
    
    // 結果を結合
    let html = processedChunks.join('');
    
    // リストをul/olで囲む
    html = this._wrapLists(html);
    
    return html;
  }

  /**
   * コードブロックを保護しながらテキストを分割
   * @param {string} text マークダウンテキスト
   * @returns {string[]} コードブロックと通常テキストの配列
   */
  _splitByCodeBlocks(text) {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const chunks = [];
    let lastIndex = 0;
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      // コードブロック前の通常テキスト
      chunks.push(text.substring(lastIndex, match.index));
      // コードブロック
      chunks.push(this._formatCodeBlock(match[0]));
      lastIndex = match.index + match[0].length;
    }
    
    // 最後の通常テキスト
    chunks.push(text.substring(lastIndex));
    
    return chunks;
  }

  /**
   * コードブロックを整形
   * @param {string} block マークダウンコードブロック
   * @returns {string} HTML整形済みコードブロック
   */
  _formatCodeBlock(block) {
    // 言語が指定されているか確認
    const firstLineEnd = block.indexOf('\n');
    const firstLine = block.substring(3, firstLineEnd).trim();
    const language = firstLine || 'plaintext';
    
    // コードブロックの内容
    const code = block.substring(firstLineEnd + 1, block.length - 3).trim();
    
    return `<pre class="code-block ${language}"><code class="language-${language}">${code}</code></pre>`;
  }

  /**
   * 通常のテキストを処理
   * @param {string} text プレーンテキスト
   * @returns {string} 処理済みHTML
   */
  _processPlainText(text) {
    // 見出し
    text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // 水平線
    text = text.replace(/^---$/gm, '<hr>');
    
    // 斜体と太字
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // インラインコード
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // リンク
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // チェックボックス
    text = text.replace(/- \[x\] (.*$)/gm, '<div class="checkbox-item"><input type="checkbox" checked><span>$1</span></div>');
    text = text.replace(/- \[ \] (.*$)/gm, '<div class="checkbox-item"><input type="checkbox"><span>$1</span></div>');
    
    // リスト
    text = text.replace(/^\* (.*$)/gm, '<li>$1</li>');
    text = text.replace(/^- (.*$)/gm, '<li>$1</li>');
    text = text.replace(/^[0-9]+\. (.*$)/gm, '<li class="ordered">$1</li>');
    
    // テーブル
    text = this._processTables(text);
    
    // 段落
    text = text.replace(/\n\n/g, '</p><p>');
    text = '<p>' + text + '</p>';
    
    // 空の段落を削除
    text = text.replace(/<p><\/p>/g, '');
    
    return text;
  }

  /**
   * テーブルを処理
   * @param {string} text テキスト
   * @returns {string} テーブル処理済みHTML
   */
  _processTables(text) {
    const lines = text.split('\n');
    let tableStart = -1;
    let tableEnd = -1;
    let headerRow = -1;
    
    // テーブルの開始と終了を特定
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        // テーブルの開始
        if (tableStart === -1) {
          tableStart = i;
          headerRow = i;
        }
        
        // ヘッダー区切り行をスキップ
        if (i === tableStart + 1 && lines[i].includes('---')) {
          continue;
        }
        
        // テーブルの最後を更新
        tableEnd = i;
      } else if (tableStart !== -1 && !lines[i].trim().startsWith('|')) {
        // テーブルの区切りが終わったらループを抜ける
        break;
      }
    }
    
    // テーブルが見つからなければそのまま返す
    if (tableStart === -1 || tableEnd === -1) {
      return text;
    }
    
    // テーブルをHTML形式に変換
    let tableHtml = '<table class="md-table">\n<thead>\n<tr>\n';
    
    // ヘッダー行
    const headerCols = lines[headerRow].trim().split('|').filter(col => col.trim() !== '');
    headerCols.forEach(col => {
      tableHtml += `<th>${col.trim()}</th>\n`;
    });
    
    tableHtml += '</tr>\n</thead>\n<tbody>\n';
    
    // データ行
    for (let i = tableStart + 2; i <= tableEnd; i++) {
      const cols = lines[i].trim().split('|').filter(col => col.trim() !== '');
      
      tableHtml += '<tr>\n';
      cols.forEach(col => {
        tableHtml += `<td>${col.trim()}</td>\n`;
      });
      tableHtml += '</tr>\n';
    }
    
    tableHtml += '</tbody>\n</table>';
    
    // テーブル部分を置換
    const beforeTable = lines.slice(0, tableStart).join('\n');
    const afterTable = lines.slice(tableEnd + 1).join('\n');
    
    return beforeTable + '\n' + tableHtml + '\n' + afterTable;
  }
  
  /**
   * リスト要素をul/olで囲む
   * @param {string} html HTML
   * @returns {string} リスト処理済みHTML
   */
  _wrapLists(html) {
    // 連続するliをul/olで囲む
    let inList = false;
    let isOrdered = false;
    const lines = html.split('\n');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('<li')) {
        const currentIsOrdered = line.includes('<li class="ordered">');
        
        // リストの開始
        if (!inList) {
          inList = true;
          isOrdered = currentIsOrdered;
          result.push(isOrdered ? '<ol>' : '<ul>');
        }
        // 順序付きリストと非順序リストの切り替え
        else if (isOrdered !== currentIsOrdered) {
          result.push(isOrdered ? '</ol>' : '</ul>');
          isOrdered = currentIsOrdered;
          result.push(isOrdered ? '<ol>' : '<ul>');
        }
        
        // リスト項目の追加
        result.push(line.replace('<li class="ordered">', '<li>'));
      } else {
        // リストの終了
        if (inList) {
          result.push(isOrdered ? '</ol>' : '</ul>');
          inList = false;
        }
        
        result.push(line);
      }
    }
    
    // 残りのリストを閉じる
    if (inList) {
      result.push(isOrdered ? '</ol>' : '</ul>');
    }
    
    return result.join('\n');
  }
  
  /**
   * HTMLをエスケープ
   * @param {string} text エスケープするテキスト
   * @returns {string} エスケープ済みテキスト
   */
  _escapeHtml(text) {
    return text.replace(/[&<>"']/g, match => this.escapeMap[match]);
  }
  
  /**
   * ScopeManagerPanelから移行: マークダウンをHTMLに変換する別の実装
   * この関数はリファクタリング前のscopeManager.jsから移行されました
   * @param {string} markdown マークダウンテキスト
   * @returns {string} HTML文字列
   */
  convertMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // コードブロックを先に処理して保護
    const codeBlocks = [];
    let processedMarkdown = markdown.replace(/```([\s\S]*?)```/g, (match, code) => {
      const id = `CODE_BLOCK_${codeBlocks.length}`;
      codeBlocks.push(code);
      return id;
    });
    
    // テーブルを先に処理して保護
    const tables = [];
    processedMarkdown = processedMarkdown.replace(/\|(.+)\|\s*\n\|(?:[-:]+\|)+\s*\n(\|(?:.+)\|\s*\n)+/g, (match) => {
      const id = `TABLE_BLOCK_${tables.length}`;
      tables.push(match);
      return id;
    });
    
    // 強調（太字）を保護
    const boldTexts = [];
    processedMarkdown = processedMarkdown.replace(/\*\*(.+?)\*\*/g, (match, text) => {
      const id = `BOLD_TEXT_${boldTexts.length}`;
      boldTexts.push(text);
      return id;
    });
    
    // 斜体を保護
    const italicTexts = [];
    processedMarkdown = processedMarkdown.replace(/(?<!\*)\*([^\*]+)\*(?!\*)/g, (match, text) => {
      const id = `ITALIC_TEXT_${italicTexts.length}`;
      italicTexts.push(text);
      return id;
    });
    
    // 番号付きリストアイテムの番号を保持する特別処理
    processedMarkdown = processedMarkdown.replace(/^(\s*)(\d+)\.\s+(.+)$/gm, (match, indent, number, content) => {
      return `${indent}NUM_LIST_${number}. ${content}`;
    });
    
    // ネスト付きリストの処理のために行を分割
    const lines = processedMarkdown.split('\n');
    const processedLines = [];
    let inList = false;
    let inNumberedList = false;
    let currentListLevel = 0;
    let listStack = [];
    
    // 各行を順番に処理（リストの処理）
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 番号付きリストアイテムの検出
      const numberedListMatch = trimmedLine.match(/^(\s*)NUM_LIST_(\d+)\. (.+)$/);
      
      // 通常のリストアイテムの検出
      const listMatch = trimmedLine.match(/^(\s*)[-*+] (.+)$/);
      
      if (numberedListMatch) {
        // 番号付きリストアイテムの場合
        const indent = numberedListMatch[1];
        const number = numberedListMatch[2];
        const content = numberedListMatch[3];
        const indentLevel = Math.floor(indent.length / 2); // 2スペースごとに1レベル
        
        // リスト開始または継続
        if (!inList) {
          inList = true;
          inNumberedList = true;
          processedLines.push('<ol>');
          listStack.push('ol');
          currentListLevel = 0;
        } else if (!inNumberedList && currentListLevel === 0) {
          // 番号なしから番号付きリストへの切り替え
          processedLines.push('</ul>');
          listStack.pop();
          processedLines.push('<ol>');
          listStack.push('ol');
          inNumberedList = true;
        }
        
        // レベルの調整
        while (indentLevel > currentListLevel) {
          // インデントレベルが増えたら新しいリストを開始（番号付きリストを維持）
          const listType = inNumberedList ? 'ol' : 'ul';
          processedLines.push(`<${listType}>`);
          listStack.push(listType);
          currentListLevel++;
        }
        
        while (indentLevel < currentListLevel) {
          // インデントレベルが減ったらリストを閉じる
          processedLines.push(`</${listStack.pop()}>`);
          currentListLevel--;
        }
        
        // コンテンツの処理（太字や斜体の復元など）
        let processedContent = content;
        
        // チェックボックスのパターン
        if (processedContent.match(/^\[ \] /)) {
          processedContent = processedContent.replace(/^\[ \] /, '<input type="checkbox"> ');
        } else if (processedContent.match(/^\[x\] /)) {
          processedContent = processedContent.replace(/^\[x\] /, '<input type="checkbox" checked> ');
        }
        
        // ✓や✅などの絵文字を含む完了マーク
        if (processedContent.match(/^(✓|✅|☑️|✔️) /)) {
          processedContent = processedContent.replace(/^(✓|✅|☑️|✔️) /, '<span class="completed-mark">$1</span> ');
        }
        
        // リストアイテムの追加（番号付き）
        processedLines.push(`<li value="${number}">${processedContent}</li>`);
      } else if (listMatch) {
        // 通常のリストアイテムの場合
        const indent = listMatch[1];
        const content = listMatch[2];
        const indentLevel = Math.floor(indent.length / 2); // 2スペースごとに1レベル
        
        // リスト開始または継続
        if (!inList) {
          inList = true;
          inNumberedList = false;
          processedLines.push('<ul>');
          listStack.push('ul');
          currentListLevel = 0;
        } else if (inNumberedList && currentListLevel === 0) {
          // 番号付きから番号なしリストへの切り替え
          processedLines.push('</ol>');
          listStack.pop();
          processedLines.push('<ul>');
          listStack.push('ul');
          inNumberedList = false;
        }
        
        // レベルの調整
        while (indentLevel > currentListLevel) {
          // インデントレベルが増えたら新しいリストを開始
          processedLines.push('<ul>');
          listStack.push('ul');
          currentListLevel++;
        }
        
        while (indentLevel < currentListLevel) {
          // インデントレベルが減ったらリストを閉じる
          processedLines.push(`</${listStack.pop()}>`);
          currentListLevel--;
        }
        
        // コンテンツの処理
        let processedContent = content;
        
        // チェックボックスのパターン
        if (processedContent.match(/^\[ \] /)) {
          processedContent = processedContent.replace(/^\[ \] /, '<input type="checkbox"> ');
        } else if (processedContent.match(/^\[x\] /)) {
          processedContent = processedContent.replace(/^\[x\] /, '<input type="checkbox" checked> ');
        }
        
        // ✓や✅などの絵文字を含む完了マーク
        if (processedContent.match(/^(✓|✅|☑️|✔️) /)) {
          processedContent = processedContent.replace(/^(✓|✅|☑️|✔️) /, '<span class="completed-mark">$1</span> ');
        }
        
        // リストアイテムの追加（通常）
        processedLines.push(`<li>${processedContent}</li>`);
      } else if (trimmedLine === '' && inList) {
        // 空行でリストが終了
        while (listStack.length > 0) {
          processedLines.push(`</${listStack.pop()}>`);
        }
        inList = false;
        inNumberedList = false;
        currentListLevel = 0;
        processedLines.push('');
      } else {
        // 通常の行はそのまま追加
        processedLines.push(line);
      }
    }
    
    // 最後にリストが閉じられていない場合は閉じる
    if (inList) {
      while (listStack.length > 0) {
        processedLines.push(`</${listStack.pop()}>`);
      }
    }
    
    // 処理済みの行を結合
    let processedText = processedLines.join('\n');
    
    // 見出し処理
    processedText = processedText
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    
    // リンク処理
    processedText = processedText
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    
    // インラインコード処理
    processedText = processedText
      .replace(/`(.+?)`/g, '<code>$1</code>');
    
    // 太字テキストを復元
    for (let i = 0; i < boldTexts.length; i++) {
      processedText = processedText.replace(
        new RegExp(`BOLD_TEXT_${i}`, 'g'), 
        `<strong>${boldTexts[i]}</strong>`
      );
    }
    
    // 斜体テキストを復元
    for (let i = 0; i < italicTexts.length; i++) {
      processedText = processedText.replace(
        new RegExp(`ITALIC_TEXT_${i}`, 'g'), 
        `<em>${italicTexts[i]}</em>`
      );
    }
    
    // 段落処理
    let html = processedText.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    
    // テーブルを復元して変換
    html = html.replace(/TABLE_BLOCK_(\d+)/g, (match, index) => {
      const tableContent = tables[parseInt(index, 10)];
      return this.convertMarkdownTableToHtml(tableContent);
    });
    
    // コードブロックを復元
    html = html.replace(/CODE_BLOCK_(\d+)/g, (match, index) => {
      const code = codeBlocks[parseInt(index, 10)];
      // コードブロックをHTMLエスケープして<pre>タグで囲む
      const escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      return `<pre class="code-block">${escapedCode}</pre>`;
    });
    
    return html;
  }

  /**
   * ScopeManagerPanelから移行: マークダウンテーブルをHTMLテーブルに変換する
   * この関数はリファクタリング前のscopeManager.jsから移行されました
   * @param {string} markdownTable マークダウン形式のテーブル
   * @returns {string} HTMLテーブル
   */
  convertMarkdownTableToHtml(markdownTable) {
    try {
      if (!markdownTable) return '';
      
      // テーブル行を分割
      const lines = markdownTable.trim().split('\n');
      if (lines.length < 3) return markdownTable; // 最低でもヘッダー行、区切り行、データ行が必要
      
      // ヘッダー行を処理
      const headerRow = lines[0];
      const headers = headerRow.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      
      // 行の配置情報を取得（左寄せ、中央寄せ、右寄せ）
      const alignmentRow = lines[1];
      const alignments = alignmentRow.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '')
        .map(cell => {
          if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
          if (cell.endsWith(':')) return 'right';
          return 'left';
        });
      
      // テーブルのHTML開始
      let html = '<table class="md-table">\n';
      
      // ヘッダー行を追加
      html += '  <thead>\n    <tr>\n';
      headers.forEach((header, index) => {
        const align = alignments[index] || 'left';
        html += `      <th style="text-align: ${align}">${header}</th>\n`;
      });
      html += '    </tr>\n  </thead>\n';
      
      // データ行を追加
      html += '  <tbody>\n';
      for (let i = 2; i < lines.length; i++) {
        const row = lines[i];
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        
        html += '    <tr>\n';
        cells.forEach((cell, index) => {
          const align = alignments[index] || 'left';
          // 絵文字や特殊文字（✅❌⚠️など）はそのまま保持
          html += `      <td style="text-align: ${align}">${cell}</td>\n`;
        });
        html += '    </tr>\n';
      }
      html += '  </tbody>\n</table>';
      
      return html;
    } catch (error) {
      console.error('テーブル変換エラー:', error);
      return markdownTable; // エラー時は元のマークダウンを返す
    }
  }
  
  /**
   * ScopeManagerPanelから移行: ディレクトリツリーと表の特別なスタイリングを適用
   * この関数はリファクタリング前のscopeManager.jsから移行されました
   */
  enhanceSpecialElements() {
    try {
      // ディレクトリツリーの処理
      const directoryTrees = document.querySelectorAll('.directory-tree');
      directoryTrees.forEach(tree => {
        // ツリー項目の特別スタイリング
        const treeItems = tree.querySelectorAll('.tree-item');
        treeItems.forEach(item => {
          // 必要に応じて追加スタイリング
          item.style.fontFamily = 'monospace';
        });

        // 適切なスタイルクラスを追加
        tree.classList.add('enhanced-tree');
      });

      // プレーンなコードブロックの処理 - すべてのpreブロックを拡張
      const preBlocks = document.querySelectorAll('.markdown-content pre.code-block');
      preBlocks.forEach(preBlock => {
        const content = preBlock.textContent || '';
        
        // コードブロックのベーススタイル（すべての場合に適用）
        preBlock.style.fontFamily = 'monospace';
        preBlock.style.whiteSpace = 'pre'; // 改行と空白を正確に保持
        preBlock.style.overflow = 'auto';
        preBlock.style.backgroundColor = 'var(--app-gray-100)';
        preBlock.style.padding = '12px';
        preBlock.style.borderRadius = 'var(--app-border-radius-sm)';
        preBlock.style.border = '1px solid var(--app-border-color)';
        preBlock.style.lineHeight = '1.5';
        preBlock.style.color = 'var(--app-text)';
        
        // ディレクトリ構造っぽい特徴を持っているかチェック
        if ((content.includes('├') || content.includes('└') || content.includes('│')) && 
            content.includes('/')) {
          
          // ディレクトリ構造のような特徴を持つブロックには特別なクラスを追加
          preBlock.classList.add('directory-structure');
          
          // ツリー表示のハイライト用の特別なスタイリング
          // （必要に応じてここに追加）
        }
      });
      
      console.log('特殊要素のスタイリングを完了しました');
    } catch (error) {
      console.error('特殊要素のスタイリング中にエラーが発生しました:', error);
    }
  }

  /**
   * ScopeManagerPanelから移行: マークダウン内のチェックボックスにイベントリスナーを設定
   * この関数はリファクタリング前のscopeManager.jsから移行されました
   */
  setupCheckboxes() {
    // VSCode API取得
    const vscode = acquireVsCodeApi();
    
    const checkboxes = document.querySelectorAll('.markdown-content input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        // チェックボックス変更のメッセージを送信
        // この部分は実際の実装では、CURRENT_STATUS.mdファイルの変更に連動する必要がある
        console.log('チェックボックス状態変更:', e.target.checked);
        
        // マークダウン内のチェックボックス変更メッセージを送信
        vscode.postMessage({
          command: 'updateMarkdownCheckbox',
          checked: e.target.checked,
          // 実際の実装では、ここにチェックボックスを特定するための情報が必要
          // 例: テキスト内容や行番号など
          index: Array.from(checkboxes).indexOf(e.target)
        });
      });
    });
  }
}

// シングルトンインスタンス
const markdownConverter = new MarkdownConverter();
export default markdownConverter;

// モジュール単位でexportする関数（scopeManager.jsから移行）
export function convertMarkdownToHtml(markdown) {
  return markdownConverter.convertMarkdownToHtml(markdown);
}

export function enhanceSpecialElements() {
  return markdownConverter.enhanceSpecialElements();
}

export function setupCheckboxes() {
  return markdownConverter.setupCheckboxes();
}