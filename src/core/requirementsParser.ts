import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';

/**
 * ページ情報のインターフェース
 */
export interface PageInfo {
  name: string;
  path: string;
  description?: string;
  features?: string[];
}

/**
 * 要件定義ファイルからページ情報を抽出するクラス
 */
export class RequirementsParser {
  /**
   * 要件定義ファイルからページ情報を抽出
   * @param requirementsPath 要件定義ファイルのパス
   * @returns ページ情報の配列
   */
  public static async extractPagesFromRequirements(requirementsPath: string): Promise<PageInfo[]> {
    try {
      if (!fs.existsSync(requirementsPath)) {
        throw new Error(`Requirements file not found: ${requirementsPath}`);
      }
      
      const content = await fs.promises.readFile(requirementsPath, 'utf8');
      
      // ページセクションを検索
      const pages: PageInfo[] = [];
      
      // ページセクションを検索するパターン
      // ## ページ: ページ名 または ## 画面: 画面名 などのフォーマット
      const pagePattern = /#{1,3}\s*(?:ページ|画面|Page|Screen)[：:]\s*(.+?)(?=\n#{1,3}|\n$|$)/gis;
      let match;
      
      while ((match = pagePattern.exec(content)) !== null) {
        const pageSection = match[0];
        const pageName = this.extractPageName(pageSection);
        const pagePath = this.generatePagePath(pageName);
        const description = this.extractDescription(pageSection);
        const features = this.extractFeatures(pageSection);
        
        pages.push({
          name: pageName,
          path: pagePath,
          description,
          features
        });
      }
      
      Logger.info(`Extracted ${pages.length} pages from requirements`);
      
      return pages;
    } catch (error) {
      Logger.error(`Failed to extract pages from requirements: ${(error as Error).message}`);
      return [];
    }
  }
  
  /**
   * ディレクトリ構造ファイルからページ情報を抽出
   * @param structurePath ディレクトリ構造ファイルのパス
   * @returns ページ情報の配列
   */
  public static async extractPagesFromStructure(structurePath: string): Promise<PageInfo[]> {
    try {
      if (!fs.existsSync(structurePath)) {
        throw new Error(`Structure file not found: ${structurePath}`);
      }
      
      const content = await fs.promises.readFile(structurePath, 'utf8');
      
      // フロントエンドのページディレクトリを検索
      const pages: PageInfo[] = [];
      
      // pages/ または screens/ ディレクトリを検索するパターン
      const pagePattern = /[│├└]\s+(pages|screens)\/([^/\n]+)/g;
      let match;
      
      while ((match = pagePattern.exec(content)) !== null) {
        const pageName = match[2].trim()
          .replace(/\.(jsx?|tsx?|vue)$/, '') // ファイル拡張子を削除
          .replace(/([A-Z])/g, ' $1') // キャメルケースをスペース区切りに
          .replace(/[-_]/g, ' ') // ハイフンとアンダースコアをスペースに
          .replace(/^./, c => c.toUpperCase()) // 先頭を大文字に
          .trim();
        
        // 重複チェック
        if (!pages.some(p => p.name === pageName)) {
          pages.push({
            name: pageName,
            path: `/${pageName.toLowerCase().replace(/\s+/g, '-')}`,
          });
        }
      }
      
      Logger.info(`Extracted ${pages.length} pages from structure`);
      
      return pages;
    } catch (error) {
      Logger.error(`Failed to extract pages from structure: ${(error as Error).message}`);
      return [];
    }
  }
  
  /**
   * ページセクションからページ名を抽出
   * @param section ページセクション
   * @returns ページ名
   */
  private static extractPageName(section: string): string {
    // ヘッダー行からページ名を抽出
    const headerMatch = section.match(/#{1,3}\s*(?:ページ|画面|Page|Screen)[：:]\s*(.+?)(?=\n|$)/i);
    if (headerMatch && headerMatch[1]) {
      return headerMatch[1].trim();
    }
    return 'Unknown Page';
  }
  
  /**
   * ページ名からURLパスを生成
   * @param name ページ名
   * @returns URLパス
   */
  private static generatePagePath(name: string): string {
    return '/' + name.toLowerCase()
      .replace(/\s+/g, '-') // スペースをハイフンに
      .replace(/[^\w\-]/g, ''); // 英数字、ハイフン以外を削除
  }
  
  /**
   * ページセクションから説明を抽出
   * @param section ページセクション
   * @returns 説明文
   */
  private static extractDescription(section: string): string | undefined {
    // ヘッダー行を除いた最初の段落を説明として抽出
    const lines = section.split('\n');
    let descriptionLines: string[] = [];
    let inDescription = false;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 空行が出現したら段落の区切り
      if (line === '') {
        if (inDescription) break;
        else continue;
      }
      
      // 次のセクションが始まったら終了
      if (line.startsWith('#')) break;
      
      // 箇条書きが始まったら終了
      if (line.startsWith('-') || line.startsWith('*')) break;
      
      // 説明の開始
      inDescription = true;
      descriptionLines.push(line);
    }
    
    return descriptionLines.length > 0 ? descriptionLines.join(' ') : undefined;
  }
  
  /**
   * ページセクションから機能リストを抽出
   * @param section ページセクション
   * @returns 機能の配列
   */
  private static extractFeatures(section: string): string[] | undefined {
    // 箇条書きリストを機能として抽出
    const featurePattern = /[-*]\s+(.+?)(?=\n|$)/g;
    const features: string[] = [];
    let match;
    
    while ((match = featurePattern.exec(section)) !== null) {
      if (match[1]) {
        features.push(match[1].trim());
      }
    }
    
    return features.length > 0 ? features : undefined;
  }
}