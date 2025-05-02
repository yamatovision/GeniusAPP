import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

/**
 * マークダウンパーサークラス
 * シンプルなマークダウン解析と変換のためのクラス
 */
export class MarkdownParser {
  private static _instance: MarkdownParser;
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): MarkdownParser {
    if (!MarkdownParser._instance) {
      MarkdownParser._instance = new MarkdownParser();
    }
    return MarkdownParser._instance;
  }
  
  private constructor() {
    Logger.debug('MarkdownParser initialized');
  }
  
  /**
   * マークダウンテキストをHTMLに変換
   * @param markdownText マークダウンテキスト
   * @returns HTML形式のテキスト
   */
  public convertToHtml(markdownText: string): string {
    if (!markdownText) return '';
    
    // マークダウンを基本的なHTMLに変換
    return this._basicMarkdownToHtml(markdownText);
  }
  
  /**
   * 基本的なマークダウン記法をHTMLに変換する
   * @param markdown 処理対象のマークダウンテキスト
   * @returns HTML形式のテキスト
   */
  private _basicMarkdownToHtml(markdown: string): string {
    // 見出し変換
    let html = markdown
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    
    // チェックボックス付きリスト（優先処理）
    html = html.replace(/^- \[( |x)\] (.+)$/gm, (match, checked, content) => {
      const isChecked = checked === 'x' ? 'checked' : '';
      return `<li class="task-list-item"><input type="checkbox" ${isChecked} disabled> ${content}</li>`;
    });
    
    // 通常リスト
    html = html.replace(/^- (.+)$/gm, (match, content) => {
      // 既にHTMLタグを含む場合はスキップ
      return match.includes('<li>') ? match : `<li>${content}</li>`;
    });
    
    // リストをul/olタグで囲む
    html = this._processLists(html);
    
    // 強調
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // リンク
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    
    // インラインコード
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    
    // コードブロックの検出と処理 - シンプルにpreタグで囲む
    html = html.replace(/```\n([\s\S]*?)\n```/gs, (match, content) => {
      // エスケープして<pre>タグで囲むだけのシンプルな実装
      const escapedContent = this._escapeHtml(content);
      return `<pre class="code-block">${escapedContent}</pre>`;
    });
    
    // 段落処理
    html = html
      .split('\n\n')
      .map(para => {
        if (para.trim() === '') return '';
        if (para.trim().startsWith('<')) return para;
        return `<p>${para}</p>`;
      })
      .join('\n');
    
    return html;
  }
  
  /**
   * リストアイテムをul/olタグで適切にグループ化
   * @param html 処理対象のHTML
   * @returns 処理済みHTML
   */
  private _processLists(html: string): string {
    // liタグを検出
    const listItemRegex = /<li(?:\s+class="[^"]*")?>[^<]*<\/li>/g;
    const listItems = html.match(listItemRegex);
    
    if (!listItems) return html;
    
    // 連続するリストアイテムを検出してulタグでラップ
    let processedHtml = html;
    let currentIndex = 0;
    let inList = false;
    
    for (let i = 0; i < listItems.length; i++) {
      const item = listItems[i];
      const itemIndex = processedHtml.indexOf(item, currentIndex);
      
      if (itemIndex === -1) continue;
      
      // リストの開始または続行
      if (!inList) {
        // リストの開始
        processedHtml = processedHtml.substring(0, itemIndex) + 
                       '<ul>\n' + 
                       processedHtml.substring(itemIndex);
        currentIndex = itemIndex + 5; // '<ul>\n'.length = 5
        inList = true;
      }
      
      // 次のアイテムの位置
      currentIndex = itemIndex + item.length;
      
      // リストの終了条件をチェック
      const isLastItem = i === listItems.length - 1;
      
      if (isLastItem || (i + 1 < listItems.length && 
          processedHtml.indexOf(listItems[i + 1], currentIndex) - currentIndex > 10)) {
        // リストの終了
        processedHtml = processedHtml.substring(0, currentIndex) + 
                       '\n</ul>' + 
                       processedHtml.substring(currentIndex);
        currentIndex += 6; // '\n</ul>'.length = 6
        inList = false;
      }
    }
    
    return processedHtml;
  }
  
  /**
   * HTML文字のエスケープ処理
   * @param text エスケープするテキスト
   * @returns エスケープされたテキスト
   */
  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}