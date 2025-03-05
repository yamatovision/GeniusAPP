# モックアップギャラリー実装計画 - ファイル操作手順

## ファイル変更・追加の全体像

```
AppGenius/
├── media/
│   ├── mockupGallery.css         [新規作成] - ギャラリーUI用スタイル
│   ├── mockupGallery.js          [新規作成] - ギャラリーUI用スクリプト
│   └── simpleMockupEditor.js     [既存参照] - 一部コード再利用
├── src/
│   ├── services/
│   │   └── mockupStorageService.ts [更新] - ステータス管理機能追加
│   ├── core/
│   │   └── aiService.ts           [更新] - モックアップ生成機能拡張
│   │   └── requirementsParser.ts  [新規作成] - 要件定義解析
│   └── ui/
│       └── mockupGallery/
│           ├── MockupGalleryPanel.ts     [更新] - 主要ロジック更新
│           └── MockupQueueManager.ts     [新規作成] - 並列処理管理
├── docs/
│   └── mockup_gallery_implementation.md [完了済]
└── mockups/
    └── mockupGallery.html        [完了済] - HTML参照用
```

## 詳細作業手順

### フェーズ1: 基盤ファイルの作成と既存ファイルの更新

#### 1. メディアファイル作成

**作業内容**: UI用のCSS・JSファイルを新規作成

1. **media/mockupGallery.css の新規作成**:
   - mockupGallery.htmlからスタイルをコピーして分離
   - WebView用のスタイル調整

2. **media/mockupGallery.js の新規作成**:
   ```javascript
   (function() {
     // 変数定義
     let mockups = [];
     let currentMockupId = null;
     let mockupQueue = [];
     
     // 初期化
     const vscode = acquireVsCodeApi();
     
     document.addEventListener('DOMContentLoaded', () => {
       // UI要素の参照取得
       // イベントリスナー設定
       // VSCodeとの通信処理
       
       // モックアップリスト読み込み
       vscode.postMessage({ command: 'loadMockups' });
       
       // 一括生成ボタン
       document.getElementById('generate-all-button').addEventListener('click', () => {
         vscode.postMessage({ command: 'generateAllMockups' });
       });
       
       // その他のイベント処理...
     });
     
     // VSCodeからのメッセージ受信処理
     window.addEventListener('message', event => {
       const message = event.data;
       // 各種コマンド処理
     });
     
     // ヘルパー関数
     function updateMockupStatus(mockupId, status) { /* ... */ }
     function renderMockupList(mockups) { /* ... */ }
     function renderMockupPreview(mockup) { /* ... */ }
     
     // UI操作関数
     function handleFeedbackSubmit() { /* ... */ }
     function handleMockupApproval() { /* ... */ }
   })();
   ```

#### 2. MockupStorageService の更新

**ファイル**: `src/services/mockupStorageService.ts`

**作業内容**: モックアップインターフェース拡張とステータス管理機能追加

1. **Mockupインターフェース更新**:
   ```typescript
   export interface Mockup {
     id: string;
     name: string;
     html: string;
     css?: string;
     js?: string;
     createdAt: number;
     updatedAt: number;
     sourceType: 'requirements' | 'manual' | 'imported';
     description?: string;
     // 以下を追加
     status: 'pending' | 'generating' | 'review' | 'approved';
     feedback?: string[];
     implementationNotes?: string;
   }
   ```

2. **ステータス管理メソッド追加**:
   ```typescript
   /**
    * モックアップのステータスを更新
    */
   public async updateMockupStatus(id: string, status: string): Promise<Mockup | undefined> {
     try {
       const mockup = this.mockups.get(id);
       if (!mockup) {
         return undefined;
       }
       
       mockup.status = status as 'pending' | 'generating' | 'review' | 'approved';
       mockup.updatedAt = Date.now();
       
       // メタデータの更新
       await this.saveMetadata();
       
       Logger.info(`Mockup status updated: ${id} -> ${status}`);
       
       return mockup;
     } catch (error) {
       Logger.error(`Failed to update mockup status: ${(error as Error).message}`);
       return undefined;
     }
   }
   
   /**
    * フィードバックを追加
    */
   public async addFeedback(id: string, feedback: string): Promise<Mockup | undefined> {
     try {
       const mockup = this.mockups.get(id);
       if (!mockup) {
         return undefined;
       }
       
       if (!mockup.feedback) {
         mockup.feedback = [];
       }
       
       mockup.feedback.push(feedback);
       mockup.updatedAt = Date.now();
       
       // メタデータの更新
       await this.saveMetadata();
       
       Logger.info(`Feedback added to mockup: ${id}`);
       
       return mockup;
     } catch (error) {
       Logger.error(`Failed to add feedback: ${(error as Error).message}`);
       return undefined;
     }
   }
   
   /**
    * 実装メモを保存
    */
   public async saveImplementationNotes(id: string, notes: string): Promise<Mockup | undefined> {
     try {
       const mockup = this.mockups.get(id);
       if (!mockup) {
         return undefined;
       }
       
       mockup.implementationNotes = notes;
       mockup.updatedAt = Date.now();
       
       // メタデータの更新
       await this.saveMetadata();
       
       Logger.info(`Implementation notes saved for mockup: ${id}`);
       
       return mockup;
     } catch (error) {
       Logger.error(`Failed to save implementation notes: ${(error as Error).message}`);
       return undefined;
     }
   }
   
   /**
    * キューの状態を取得
    */
   public getQueueStatus(): {pending: number, generating: number, completed: number, total: number} {
     const mockupList = Array.from(this.mockups.values());
     
     const pending = mockupList.filter(m => m.status === 'pending').length;
     const generating = mockupList.filter(m => m.status === 'generating').length;
     const completed = mockupList.filter(m => ['review', 'approved'].includes(m.status)).length;
     const total = mockupList.length;
     
     return { pending, generating, completed, total };
   }
   ```

3. **loadMockups メソッド更新**:
   - 既存メソッドにステータスの初期値設定を追加

### フェーズ2: AI連携とパーサーの実装

#### 1. 要件定義パーサーの作成

**ファイル**: `src/core/requirementsParser.ts` (新規作成)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';

export interface PageInfo {
  name: string;
  path: string;
  description?: string;
  features?: string[];
}

export class RequirementsParser {
  /**
   * 要件定義ファイルからページ情報を抽出
   */
  public static async extractPagesFromRequirements(requirementsPath: string): Promise<PageInfo[]> {
    try {
      if (!fs.existsSync(requirementsPath)) {
        throw new Error(`Requirements file not found: ${requirementsPath}`);
      }
      
      const content = await fs.promises.readFile(requirementsPath, 'utf8');
      
      // ページセクションを検索
      const pages: PageInfo[] = [];
      
      // 簡易的なパターン検出 - より高度な解析が必要な場合は調整
      const pagePattern = /## (?:ページ|画面|Page)[：:]\s*(.+?)(?=\n## |$)/gis;
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
   */
  public static async extractPagesFromStructure(structurePath: string): Promise<PageInfo[]> {
    try {
      if (!fs.existsSync(structurePath)) {
        throw new Error(`Structure file not found: ${structurePath}`);
      }
      
      const content = await fs.promises.readFile(structurePath, 'utf8');
      
      // フロントエンドのページディレクトリを検索
      const pages: PageInfo[] = [];
      
      // パターン検出 - pages/ または screens/ ディレクトリ内のファイル
      const pagePattern = /\s*(pages|screens)\/([^/\n]+)/g;
      let match;
      
      while ((match = pagePattern.exec(content)) !== null) {
        const pageName = match[2].trim();
        // ファイル名と思われる要素からページ名を取得
        const cleanPageName = pageName
          .replace(/\.(jsx?|tsx?|vue)$/, '') // ファイル拡張子を削除
          .replace(/([A-Z])/g, ' $1') // キャメルケースをスペース区切りに
          .replace(/^./, c => c.toUpperCase()) // 先頭を大文字に
          .trim();
        
        // 重複チェック
        if (!pages.some(p => p.name === cleanPageName)) {
          pages.push({
            name: cleanPageName,
            path: `/${pageName.toLowerCase()}`,
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
  
  // 各種ヘルパーメソッド実装
  private static extractPageName(section: string): string { /* ... */ }
  private static generatePagePath(name: string): string { /* ... */ }
  private static extractDescription(section: string): string | undefined { /* ... */ }
  private static extractFeatures(section: string): string[] | undefined { /* ... */ }
}
```

#### 2. AIServiceの拡張

**ファイル**: `src/core/aiService.ts`

**作業内容**: モックアップ生成/更新メソッドの追加

```typescript
/**
 * 特定のページのモックアップを生成
 */
public async generateMockupForPage(pageName: string, requirements: string): Promise<string> {
  try {
    const prompt = this.buildMockupGenerationPrompt(pageName, requirements);
    const response = await this.sendMessage(prompt, 'mockup-generation');
    
    // HTMLコードを抽出
    const html = this.extractHtmlFromResponse(response);
    
    if (!html) {
      throw new Error('No HTML found in the response');
    }
    
    return html;
  } catch (error) {
    Logger.error(`Failed to generate mockup for page ${pageName}: ${(error as Error).message}`);
    throw new Error(`モックアップ生成に失敗しました: ${(error as Error).message}`);
  }
}

/**
 * モックアップをフィードバックに基づいて更新
 */
public async updateMockupWithFeedback(html: string, feedback: string): Promise<string> {
  try {
    const prompt = this.buildMockupUpdatePrompt(html, feedback);
    const response = await this.sendMessage(prompt, 'mockup-update');
    
    // HTMLコードを抽出
    const updatedHtml = this.extractHtmlFromResponse(response);
    
    if (!updatedHtml) {
      throw new Error('No HTML found in the response');
    }
    
    return updatedHtml;
  } catch (error) {
    Logger.error(`Failed to update mockup with feedback: ${(error as Error).message}`);
    throw new Error(`モックアップ更新に失敗しました: ${(error as Error).message}`);
  }
}

/**
 * モックアップ生成用のプロンプトを作成
 */
private buildMockupGenerationPrompt(pageName: string, requirements: string): string {
  return `あなたはウェブアプリケーションモックアップ作成の専門家です。
以下の情報から、機能的で美しいHTMLモックアップを作成してください。

ページ名: ${pageName}

要件:
${requirements}

重要なポイント:
1. シンプルで見やすいデザインを心がける
2. 必要最小限のスタイリングを含める (インラインスタイル推奨)
3. 複雑なJavaScriptは避け、見た目のデモンストレーションを優先
4. レスポンシブデザインを考慮する

モックアップHTMLを以下のフォーマットで出力してください:

\`\`\`html
<!DOCTYPE html>
<html>
...
</html>
\`\`\``;
}

/**
 * モックアップ更新用のプロンプトを作成
 */
private buildMockupUpdatePrompt(html: string, feedback: string): string {
  return `以下のHTMLモックアップを、フィードバックに基づいて更新してください:

フィードバック:
${feedback}

現在のHTML:
\`\`\`html
${html}
\`\`\`

重要なポイント:
1. HTMLの基本構造を維持する
2. 不要な部分を削除しない
3. フィードバックのみに対応する
4. インラインスタイルを使用する
5. 完全なHTMLドキュメントを返す

更新したHTMLを以下のフォーマットで出力してください:

\`\`\`html
<!DOCTYPE html>
<html>
...
</html>
\`\`\``;
}

/**
 * AIレスポンスからHTMLコードを抽出
 */
private extractHtmlFromResponse(response: string): string | null {
  // コードブロックを検出
  const htmlMatch = response.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1].trim();
  }

  // HTMLタグを探す
  const docTypeMatch = response.match(/<(!DOCTYPE html|html)[\s\S]*<\/html>/i);
  if (docTypeMatch) {
    return docTypeMatch[0].trim();
  }

  return null;
}
```

### フェーズ3: キュー管理と並列処理

#### 1. モックアップキューマネージャークラスの作成

**ファイル**: `src/ui/mockupGallery/MockupQueueManager.ts` (新規作成)

```typescript
import { AIService } from '../../core/aiService';
import { MockupStorageService } from '../../services/mockupStorageService';
import { Logger } from '../../utils/logger';
import { PageInfo } from '../../core/requirementsParser';

interface QueueItem {
  pageInfo: PageInfo;
  requirementsText: string;
  mockupId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount?: number;
}

export class MockupQueueManager {
  private queue: QueueItem[] = [];
  private processingCount: number = 0;
  private readonly maxConcurrent: number = 3; // 同時処理数
  private readonly maxRetries: number = 2;    // 最大リトライ回数
  
  private _aiService: AIService;
  private _storage: MockupStorageService;
  private _onProgressCallback?: (queued: number, processing: number, completed: number, total: number) => void;
  private _onCompletedCallback?: (mockupId: string, pageInfo: PageInfo) => void;
  
  constructor(aiService: AIService) {
    this._aiService = aiService;
    this._storage = MockupStorageService.getInstance();
  }
  
  /**
   * 進捗状況通知のコールバックを設定
   */
  public setOnProgressCallback(callback: (queued: number, processing: number, completed: number, total: number) => void): void {
    this._onProgressCallback = callback;
  }
  
  /**
   * モックアップ完了通知のコールバックを設定
   */
  public setOnCompletedCallback(callback: (mockupId: string, pageInfo: PageInfo) => void): void {
    this._onCompletedCallback = callback;
  }
  
  /**
   * モックアップ生成をキューに追加
   */
  public async addToQueue(pageInfo: PageInfo, requirementsText: string): Promise<void> {
    this.queue.push({
      pageInfo,
      requirementsText,
      status: 'pending'
    });
    
    Logger.info(`Added to queue: ${pageInfo.name}`);
    
    this._notifyProgress();
    
    // キュー処理を開始
    await this._processQueue();
  }
  
  /**
   * 複数のモックアップ生成をキューに追加
   */
  public async addMultipleToQueue(pages: PageInfo[], requirementsText: string): Promise<void> {
    pages.forEach(page => {
      this.queue.push({
        pageInfo: page,
        requirementsText,
        status: 'pending'
      });
      
      Logger.info(`Added to queue: ${page.name}`);
    });
    
    this._notifyProgress();
    
    // キュー処理を開始
    await this._processQueue();
  }
  
  /**
   * キューの処理状況を取得
   */
  public getQueueStatus(): {queued: number, processing: number, completed: number, total: number} {
    const queued = this.queue.filter(item => item.status === 'pending').length;
    const processing = this.processingCount;
    const completed = this.queue.filter(item => ['completed', 'failed'].includes(item.status)).length;
    const total = this.queue.length;
    
    return { queued, processing, completed, total };
  }
  
  /**
   * キュー処理の実行
   */
  private async _processQueue(): Promise<void> {
    // 同時実行数が上限に達していなければ処理を続行
    while (this.processingCount < this.maxConcurrent) {
      // 保留中のアイテムを取得
      const nextItem = this.queue.find(item => item.status === 'pending');
      
      if (!nextItem) {
        // 保留中のアイテムがなければ終了
        break;
      }
      
      // 処理中に変更
      nextItem.status = 'processing';
      this.processingCount++;
      
      this._notifyProgress();
      
      // 非同期で処理
      this._processMockupGeneration(nextItem).finally(() => {
        this.processingCount--;
        this._processQueue(); // 次の処理
      });
    }
  }
  
  /**
   * 個別のモックアップ生成処理
   */
  private async _processMockupGeneration(item: QueueItem): Promise<void> {
    try {
      Logger.info(`Processing mockup generation for ${item.pageInfo.name}`);
      
      // モックアップIDの作成またはロード
      let mockupId = item.mockupId;
      
      if (!mockupId) {
        // 新規モックアップの場合は仮のIDを作成
        const tempId = `mockup_${Date.now()}_${item.pageInfo.name.toLowerCase().replace(/\s+/g, '_')}`;
        
        // ストレージにPending状態で保存
        mockupId = await this._storage.saveMockup(
          { html: '<div>生成中...</div>' },
          {
            id: tempId,
            name: item.pageInfo.name,
            sourceType: 'requirements',
            description: `Page: ${item.pageInfo.name}`
          }
        );
        
        // ステータスを更新
        await this._storage.updateMockupStatus(mockupId, 'generating');
        
        item.mockupId = mockupId;
      }
      
      // AIサービスによるモックアップ生成
      const html = await this._aiService.generateMockupForPage(
        item.pageInfo.name,
        item.requirementsText
      );
      
      // モックアップを更新
      await this._storage.updateMockup(mockupId, { html });
      await this._storage.updateMockupStatus(mockupId, 'review');
      
      // 完了ステータスに設定
      item.status = 'completed';
      
      // 完了通知
      if (this._onCompletedCallback) {
        this._onCompletedCallback(mockupId, item.pageInfo);
      }
      
      Logger.info(`Completed mockup generation for ${item.pageInfo.name}`);
    } catch (error) {
      Logger.error(`Failed to generate mockup for ${item.pageInfo.name}: ${(error as Error).message}`);
      
      // リトライカウント処理
      if (!item.retryCount) {
        item.retryCount = 1;
      } else {
        item.retryCount++;
      }
      
      if (item.retryCount <= this.maxRetries) {
        // リトライ
        Logger.info(`Retrying mockup generation for ${item.pageInfo.name} (${item.retryCount}/${this.maxRetries})`);
        item.status = 'pending';
      } else {
        // 失敗ステータスに設定
        item.status = 'failed';
        
        // モックアップのステータスを更新
        if (item.mockupId) {
          await this._storage.updateMockupStatus(item.mockupId, 'pending');
        }
      }
    } finally {
      this._notifyProgress();
    }
  }
  
  /**
   * 進捗状況の通知
   */
  private _notifyProgress(): void {
    if (this._onProgressCallback) {
      const status = this.getQueueStatus();
      this._onProgressCallback(
        status.queued,
        status.processing,
        status.completed,
        status.total
      );
    }
  }
}
```

#### 2. MockupGalleryPanel 更新

**ファイル**: `src/ui/mockupGallery/MockupGalleryPanel.ts`

**作業内容**: キューマネージャーとの連携、新UIへの対応

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { MockupStorageService, Mockup } from '../../services/mockupStorageService';
import { RequirementsParser, PageInfo } from '../../core/requirementsParser';
import { MockupQueueManager } from './MockupQueueManager';

/**
 * モックアップギャラリーパネル
 */
export class MockupGalleryPanel {
  public static currentPanel: MockupGalleryPanel | undefined;
  private static readonly viewType = 'mockupGallery';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _aiService: AIService;
  private _storage: MockupStorageService;
  private _queueManager: MockupQueueManager;
  
  // 追加
  private _projectPath: string;
  private _requirementsPath: string;
  private _structurePath: string;
  
  /**
   * パネルを作成または表示
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService, projectPath?: string): MockupGalleryPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (MockupGalleryPanel.currentPanel) {
      MockupGalleryPanel.currentPanel._panel.reveal(column);
      
      // プロジェクトパスが異なる場合は更新
      if (projectPath && MockupGalleryPanel.currentPanel._projectPath !== projectPath) {
        MockupGalleryPanel.currentPanel._updateProjectPath(projectPath);
      }
      
      return MockupGalleryPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      MockupGalleryPanel.viewType,
      'モックアップギャラリー',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist')
        ]
      }
    );

    MockupGalleryPanel.currentPanel = new MockupGalleryPanel(panel, extensionUri, aiService, projectPath);
    return MockupGalleryPanel.currentPanel;
  }

  /**
   * 特定のモックアップを選択した状態で開く
   */
  public static openWithMockup(extensionUri: vscode.Uri, aiService: AIService, mockupId: string, projectPath?: string): MockupGalleryPanel {
    const panel = MockupGalleryPanel.createOrShow(extensionUri, aiService, projectPath);
    panel._loadAndSelectMockup(mockupId);
    return panel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService, projectPath?: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._aiService = aiService;
    this._storage = MockupStorageService.getInstance();
    this._queueManager = new MockupQueueManager(aiService);
    
    // プロジェクトパスの設定
    this._projectPath = projectPath || this._getDefaultProjectPath();
    this._requirementsPath = path.join(this._projectPath, 'docs', 'requirements.md');
    this._structurePath = path.join(this._projectPath, 'docs', 'structure.md');
    
    // ストレージサービスのパス初期化
    if (projectPath) {
      this._storage.initializeWithPath(projectPath);
    }
    
    // キューマネージャーのコールバック設定
    this._queueManager.setOnProgressCallback((queued, processing, completed, total) => {
      this._panel.webview.postMessage({
        command: 'updateQueueStatus',
        status: { queued, processing, completed, total }
      });
    });
    
    this._queueManager.setOnCompletedCallback((mockupId, pageInfo) => {
      this._panel.webview.postMessage({
        command: 'mockupGenerated',
        mockupId,
        pageName: pageInfo.name
      });
    });

    // WebViewの内容を設定
    this._update();

    // パネルが破棄されたときのクリーンアップ
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // パネルの状態が変更されたときに更新
    this._panel.onDidChangeViewState(
      _e => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // WebViewからのメッセージを処理
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'loadMockups':
            await this._handleLoadMockups();
            break;
          case 'updateMockup':
            await this._handleUpdateMockup(message.mockupId, message.text);
            break;
          case 'openInBrowser':
            await this._handleOpenInBrowser(message.mockupId);
            break;
          case 'deleteMockup':
            await this._handleDeleteMockup(message.mockupId);
            break;
          case 'importMockup':
            await this._handleImportMockup();
            break;
          // 追加コマンド
          case 'generateAllMockups':
            await this._handleGenerateAllMockups();
            break;
          case 'updateMockupStatus':
            await this._handleUpdateMockupStatus(message.mockupId, message.status);
            break;
          case 'saveImplementationNotes':
            await this._handleSaveImplementationNotes(message.mockupId, message.notes);
            break;
          case 'addFeedback':
            await this._handleAddFeedback(message.mockupId, message.feedback);
            break;
        }
      },
      null,
      this._disposables
    );

    Logger.info('モックアップギャラリーパネルを作成しました');
  }
  
  /**
   * プロジェクトパスを更新
   */
  private _updateProjectPath(projectPath: string): void {
    this._projectPath = projectPath;
    this._requirementsPath = path.join(this._projectPath, 'docs', 'requirements.md');
    this._structurePath = path.join(this._projectPath, 'docs', 'structure.md');
    
    // ストレージサービスのパス初期化
    this._storage.initializeWithPath(projectPath);
    
    // モックアップを再読み込み
    this._handleLoadMockups();
    
    Logger.info(`プロジェクトパスを更新しました: ${projectPath}`);
  }
  
  /**
   * デフォルトのプロジェクトパスを取得
   */
  private _getDefaultProjectPath(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0 
      ? workspaceFolders[0].uri.fsPath 
      : process.cwd();
  }
  
  /**
   * 要件定義・ディレクトリ構造からページ一覧を取得
   */
  private async _extractPagesFromRequirements(): Promise<PageInfo[]> {
    try {
      let pages: PageInfo[] = [];
      
      // 要件定義からページを抽出
      if (fs.existsSync(this._requirementsPath)) {
        const reqPages = await RequirementsParser.extractPagesFromRequirements(this._requirementsPath);
        pages = [...pages, ...reqPages];
      }
      
      // ディレクトリ構造からページを抽出
      if (fs.existsSync(this._structurePath)) {
        const structPages = await RequirementsParser.extractPagesFromStructure(this._structurePath);
        
        // 重複を排除して追加
        structPages.forEach(page => {
          if (!pages.some(p => p.name === page.name)) {
            pages.push(page);
          }
        });
      }
      
      return pages;
    } catch (error) {
      Logger.error(`ページ抽出エラー: ${(error as Error).message}`);
      return [];
    }
  }

  // 既存メソッドの更新と残りの実装...
  // (ソース長制限のため省略。必要なメソッドは適宜実装)
}
```

### フェーズ4: UIとスクリプトの完成

#### 仕上げ作業

1. **media/mockupGallery.css の完成**
2. **media/mockupGallery.js の完成**
3. **既存機能の動作確認**
4. **メディアファイル参照の更新**

## デプロイ手順

1. 上記のファイル変更をすべて適用
2. VSCode拡張をリビルド: `npm run build`
3. 動作確認: F5キーでデバッグ実行
4. 必要に応じてバグ修正
5. バージョン番号を更新してリリース

## テスト項目

1. プロジェクト切り替え時のモックアップ表示
2. 要件定義からのページ抽出
3. 複数モックアップの同時生成
4. フィードバック反映
5. 承認フロー

## 注意事項

- 大量のモックアップ生成はAI APIの使用量が増加するため、ユーザーに注意を促すメッセージを表示することを推奨
- 複雑な要件定義の場合、ページ抽出の精度が低下する可能性があるため、手動調整の余地を残す
- 並列処理数は3が推奨値だが、システム性能や使用状況に応じて調整可能