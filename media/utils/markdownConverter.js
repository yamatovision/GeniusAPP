// @ts-check

/**
 * 超シンプルなマークダウン変換ユーティリティ
 * 
 * マークダウンテキストをHTMLに変換する最小限の機能を提供します。
 * CURRENT_STATUSファイルの表示に特化した基本的なマークダウン構文のみサポート。
 * 
 * 注意: このファイルは互換性のために維持されています。
 * 新しい実装は simpleMarkdownConverter.js を参照してください。
 */

// 実際の実装をsimpleMarkdownConverterから取得
import simpleConverter from './simpleMarkdownConverter.js';

class MarkdownConverter {
  /**
   * マークダウンテキストをHTMLに変換
   * @param {string} markdown マークダウンテキスト
   * @returns {string} HTML文字列
   */
  convertMarkdownToHtml(markdown) {
    // 実装はsimpleMarkdownConverterに委譲
    return simpleConverter.convertMarkdownToHtml(markdown);
  }
  
  /**
   * HTMLコードに特殊スタイリングを適用
   */
  enhanceSpecialElements() {
    return simpleConverter.enhanceSpecialElements();
  }
  
  /**
   * チェックボックスにイベントリスナー設定
   */
  setupCheckboxes() {
    return simpleConverter.setupCheckboxes();
  }
  
  /**
   * 統一インターフェース
   */
  convertToHtml(markdown) {
    return this.convertMarkdownToHtml(markdown);
  }
}

// シングルトンインスタンス
const markdownConverter = new MarkdownConverter();
export default markdownConverter;

// モジュール単位でexportする関数
export function convertMarkdownToHtml(markdown) {
  return markdownConverter.convertMarkdownToHtml(markdown);
}

export function enhanceSpecialElements() {
  return markdownConverter.enhanceSpecialElements();
}

export function setupCheckboxes() {
  return markdownConverter.setupCheckboxes();
}