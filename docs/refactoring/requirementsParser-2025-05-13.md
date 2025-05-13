# リファクタリング計画: src/core/requirementsParser.ts 2025-05-13

## 1. 現状分析

### 1.1 対象概要
`requirementsParser.ts`は要件定義ファイルから構造化された情報（ページ情報など）を抽出するユーティリティクラスです。主にモックアップギャラリー機能でページ情報を取得するために使用されています。

### 1.2 問題点と課題
- 使用箇所が限定的（MockupGalleryPanel.tsのみ）
- 専用の機能でありながら`/core`ディレクトリに配置されている
- ParseクラスとしてはUIコンポーネントから直接参照するのは設計としてよくない
- コード全体に対して責務が明確に分離されていない

### 1.3 関連ファイル一覧
- /src/core/requirementsParser.ts - リファクタリング対象のファイル
- /src/ui/mockupGallery/MockupGalleryPanel.ts - requirementsParserを使用しているファイル
- /src/services/mockupStorageService.ts - モックアップのストレージ機能

### 1.4 依存関係図
```
MockupGalleryPanel.ts
       ↓
requirementsParser.ts
       ↓
Logger.ts（ロギング機能）
```

## 2. リファクタリングの目標

### 2.1 期待される成果
- より適切なディレクトリ構造でのファイル配置
- 責務の明確な分離
- クラス間の適切な参照関係の実現
- 将来的な機能拡張性の向上

### 2.2 維持すべき機能
- 要件定義ファイルからのページ情報抽出機能
- ディレクトリ構造からのページ情報抽出機能
- 現在のインターフェース互換性（PageInfo型など）

## 3. 理想的な実装

### 3.1 全体アーキテクチャ
- `/src/services/requirementsParserService.ts` - サービスとしての実装
- MockupGalleryPanelは直接requirementsParserServiceを使用

### 3.2 核心的な改善ポイント
- 単一責任の原則に従って、ファイルの配置を`/services`ディレクトリに移動
- UIコンポーネントはサービス経由でパース機能を利用するように変更
- APIの使いやすさを向上

### 3.3 新しいディレクトリ構造
```
src/
  ├── services/
  │   ├── mockupStorageService.ts
  │   └── requirementsParserService.ts  # 新しい場所
  └── ui/
      └── mockupGallery/
          └── MockupGalleryPanel.ts     # 参照を変更
```

## 4. 実装計画

### フェーズ1: ファイル移動と名前変更
- **目標**: ファイルを適切なディレクトリに移動し、名前を変更する
- **影響範囲**: `/src/core/requirementsParser.ts`, `/src/ui/mockupGallery/MockupGalleryPanel.ts`
- **タスク**:
  1. **T1.1**: `requirementsParser.ts`を`/src/services/requirementsParserService.ts`として新規作成
     - 対象: `/src/core/requirementsParser.ts`
     - 実装: 既存コードをベースに、新しいファイルにサービスとして実装
  2. **T1.2**: パスの調整
     - 対象: `/src/services/requirementsParserService.ts`
     - 実装: インポートパスを修正（例: '../utils/logger'）
- **検証ポイント**:
  - 新しいファイルが正しく作成されていること
  - インポートパスが正しく調整されていること

### フェーズ2: インターフェース変更の実装
- **目標**: クラス名とメソッド名を適切に変更
- **影響範囲**: `/src/services/requirementsParserService.ts`
- **タスク**:
  1. **T2.1**: クラス名の変更
     - 対象: `/src/services/requirementsParserService.ts`
     - 実装: `RequirementsParser`を`RequirementsParserService`に変更
  2. **T2.2**: シングルトンパターンの実装
     - 対象: `/src/services/requirementsParserService.ts`
     - 実装: `getInstance()`メソッドを追加し、シングルトンパターンを実装
  3. **T2.3**: メソッド名の調整
     - 対象: `/src/services/requirementsParserService.ts`
     - 実装: メソッド名をより説明的に変更
- **検証ポイント**:
  - 新しいクラス名が適切に反映されていること
  - シングルトンパターンが正しく実装されていること
  - メソッド名が明確で説明的であること

### フェーズ3: 参照の更新
- **目標**: MockupGalleryPanelの参照を更新
- **影響範囲**: `/src/ui/mockupGallery/MockupGalleryPanel.ts`
- **タスク**:
  1. **T3.1**: インポート文の更新
     - 対象: `/src/ui/mockupGallery/MockupGalleryPanel.ts`
     - 実装: `import`パスを`'../../services/requirementsParserService'`に変更
  2. **T3.2**: 呼び出し箇所の更新
     - 対象: `/src/ui/mockupGallery/MockupGalleryPanel.ts`の`_extractPagesFromRequirements`メソッド
     - 実装: `RequirementsParser`の代わりに`RequirementsParserService.getInstance()`を使用
- **検証ポイント**:
  - インポート文が正しく更新されていること
  - 呼び出し箇所が正しく更新されていること
  - 実行時エラーが発生しないこと

### フェーズ4: 旧ファイルの削除
- **目標**: 不要になった旧ファイルを削除
- **影響範囲**: `/src/core/requirementsParser.ts`
- **タスク**:
  1. **T4.1**: 旧ファイルの削除
     - 対象: `/src/core/requirementsParser.ts`
     - 実装: 既存のファイルを削除
- **検証ポイント**:
  - 旧ファイルが削除されていること
  - アプリケーションが正常に動作すること

## 5. 期待される効果

### 5.1 コード削減
直接的なコード削減はありませんが、重複回避と将来的な拡張性が向上します。

### 5.2 保守性向上
- 適切なディレクトリ構造によるコード管理の容易化
- 責務の明確な分離によるコードの理解しやすさの向上
- サービスとしての統一的な実装パターン

### 5.3 拡張性改善
- 将来的に要件パース機能を他のコンポーネントでも利用可能に
- サービスとして実装することで、機能拡張時の変更範囲の局所化が可能

## 6. リスクと対策

### 6.1 潜在的リスク
- MockupGalleryPanelの動作が変わる可能性
- 型定義の互換性問題

### 6.2 対策
- すべての変更後に機能テストを実施
- インターフェースの互換性を維持
- 段階的な変更で影響範囲を最小限に抑える

## 7. 備考
この変更はより大きなリファクタリング「src-structure-2025-05-13」の一部として実施することも可能です。ただし、単独でも実施可能な範囲で計画されています。

---

## 実装例

### 新しいサービスの実装例

```typescript
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
 * 要件定義ファイルからページ情報を抽出するサービスクラス
 */
export class RequirementsParserService {
  private static instance: RequirementsParserService;

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): RequirementsParserService {
    if (!RequirementsParserService.instance) {
      RequirementsParserService.instance = new RequirementsParserService();
    }
    return RequirementsParserService.instance;
  }

  /**
   * コンストラクタ（privateでシングルトンを実現）
   */
  private constructor() {
    Logger.debug('RequirementsParserService: インスタンス作成');
  }

  /**
   * 要件定義ファイルからページ情報を抽出
   * @param requirementsPath 要件定義ファイルのパス
   * @returns ページ情報の配列
   */
  public async extractPagesFromRequirements(requirementsPath: string): Promise<PageInfo[]> {
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
  public async extractPagesFromStructure(structurePath: string): Promise<PageInfo[]> {
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
  private extractPageName(section: string): string {
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
  private generatePagePath(name: string): string {
    return '/' + name.toLowerCase()
      .replace(/\s+/g, '-') // スペースをハイフンに
      .replace(/[^\w\-]/g, ''); // 英数字、ハイフン以外を削除
  }
  
  /**
   * ページセクションから説明を抽出
   * @param section ページセクション
   * @returns 説明文
   */
  private extractDescription(section: string): string | undefined {
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
  private extractFeatures(section: string): string[] | undefined {
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
```

### MockupGalleryPanel.tsでの参照の更新例

```typescript
// 修正前
import { RequirementsParser, PageInfo } from '../../core/requirementsParser';

// 修正後
import { RequirementsParserService, PageInfo } from '../../services/requirementsParserService';

// ...

// 修正前の使用箇所
const reqPages = await RequirementsParser.extractPagesFromRequirements(requirementsPath);
const structPages = await RequirementsParser.extractPagesFromStructure(structurePath);

// 修正後の使用箇所
const parserService = RequirementsParserService.getInstance();
const reqPages = await parserService.extractPagesFromRequirements(requirementsPath);
const structPages = await parserService.extractPagesFromStructure(structurePath);
```