import { AIService } from '../../core/aiService';
import { MockupStorageService } from '../../services/mockupStorageService';
import { Logger } from '../../utils/logger';
import { PageInfo } from '../../core/requirementsParser';

/**
 * キューアイテムのインターフェース
 */
interface QueueItem {
  pageInfo: PageInfo;
  requirementsText: string;
  mockupId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount?: number;
}

/**
 * モックアップ生成キューを管理するクラス
 */
export class MockupQueueManager {
  private queue: QueueItem[] = [];
  private processingCount: number = 0;
  private readonly maxConcurrent: number = 3; // 最大同時処理数
  private readonly maxRetries: number = 2;    // 最大リトライ回数
  
  private _aiService: AIService;
  private _storage: MockupStorageService;
  private _onProgressCallback?: (queued: number, processing: number, completed: number, total: number) => void;
  private _onCompletedCallback?: (mockupId: string, pageInfo: PageInfo) => void;
  
  /**
   * コンストラクタ
   * @param aiService AIサービス
   */
  constructor(aiService: AIService) {
    this._aiService = aiService;
    this._storage = MockupStorageService.getInstance();
  }
  
  /**
   * 進捗状況通知のコールバックを設定
   * @param callback コールバック関数
   */
  public setOnProgressCallback(callback: (queued: number, processing: number, completed: number, total: number) => void): void {
    this._onProgressCallback = callback;
  }
  
  /**
   * モックアップ完了通知のコールバックを設定
   * @param callback コールバック関数
   */
  public setOnCompletedCallback(callback: (mockupId: string, pageInfo: PageInfo) => void): void {
    this._onCompletedCallback = callback;
  }
  
  /**
   * モックアップ生成をキューに追加
   * @param pageInfo ページ情報
   * @param requirementsText 要件テキスト
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
   * @param pages ページ情報の配列
   * @param requirementsText 要件テキスト
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
   * @returns キュー状態
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
   * @param item キューアイテム
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
      const prompt = this._buildMockupGenerationPrompt(item.pageInfo, item.requirementsText);
      const response = await this._aiService.sendMessage(prompt, 'mockup-generation');
      
      // HTMLコードを抽出
      const html = this._extractHtmlFromResponse(response);
      
      if (!html) {
        throw new Error('No HTML found in the response');
      }
      
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
  
  /**
   * モックアップ生成プロンプトの作成
   * @param pageInfo ページ情報
   * @param requirementsText 要件テキスト
   * @returns プロンプト
   */
  private _buildMockupGenerationPrompt(pageInfo: PageInfo, requirementsText: string): string {
    // ページ情報を文字列化
    const pageInfoText = [
      `ページ名: ${pageInfo.name}`,
      pageInfo.description ? `説明: ${pageInfo.description}` : null,
      pageInfo.features && pageInfo.features.length > 0 
        ? `機能:\n${pageInfo.features.map(f => `- ${f}`).join('\n')}` : null
    ].filter(Boolean).join('\n\n');
    
    return `あなたはウェブアプリケーションモックアップ作成の専門家です。
以下の情報から、機能的で美しいHTMLモックアップを作成してください。

${pageInfoText}

プロジェクト要件:
${requirementsText}

重要なポイント:
1. シンプルで見やすいデザインを心がける
2. 必要最小限のスタイリングを含める (インラインスタイル推奨)
3. 複雑なJavaScriptは避け、見た目のデモンストレーションを優先
4. レスポンシブデザインを考慮する
5. 日本語UIとする

モックアップHTMLを以下のフォーマットで出力してください:

\`\`\`html
<!DOCTYPE html>
<html>
...
</html>
\`\`\``;
  }
  
  /**
   * AIレスポンスからHTMLコードを抽出
   * @param response AIの応答テキスト
   * @returns HTMLコード、見つからない場合はnull
   */
  private _extractHtmlFromResponse(response: string): string | null {
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
}