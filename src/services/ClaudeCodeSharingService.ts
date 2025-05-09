import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TempFileManager } from '../utils/TempFileManager';
import { 
  SharedFile, 
  SharingHistory, 
  SharingSettings, 
  SharingEvent, 
  SharingEventType, 
  FileSaveOptions 
} from '../types/SharingTypes';

/**
 * ClaudeCode共有サービス
 * VSCodeとClaudeCode間のデータ共有を管理
 */
export class ClaudeCodeSharingService {
  private context: vscode.ExtensionContext;
  private tempFileManager: TempFileManager;
  private history: SharingHistory;
  private settings: SharingSettings;
  private eventHandlers: Map<SharingEventType, ((event: SharingEvent) => void)[]>;
  
  /**
   * コンストラクタ
   * @param context VSCode拡張コンテキスト
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.tempFileManager = new TempFileManager();
    this.eventHandlers = new Map();
    
    // デフォルト設定
    this.settings = {
      defaultExpirationHours: 24,
      maxHistoryItems: 20,
      maxTextSize: 100000,
      maxImageSize: 10 * 1024 * 1024, // 10MB
      allowedImageFormats: ['png', 'jpg', 'jpeg', 'gif'],
      preserveHistoryBetweenSessions: true,
      baseStoragePath: ''
    };
    
    // 履歴の初期化
    this.history = this.loadHistory();
    
    // 起動時にクリーンアップ実行
    this.tempFileManager.cleanupExpiredFiles();
    
    // 定期的なクリーンアップをスケジュール
    this.tempFileManager.scheduleCleanupJob(3); // 3時間ごとにクリーンアップ
  }
  
  /**
   * プロジェクト特有の一時ディレクトリを設定
   * @param projectPath プロジェクトパス
   */
  public setProjectBasePath(projectPath: string): void {
    if (!projectPath) return;
    
    // プロジェクト直下の隠しディレクトリに一時ファイルを保存するよう設定
    const tempDir = path.join(projectPath, '.appgenius_temp');
    
    // ディレクトリが存在しなければ作成
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // 新しいTempFileManagerを設定
    this.tempFileManager = new TempFileManager(tempDir);
    
    // 設定を更新
    this.settings.baseStoragePath = tempDir;
  }
  
  /**
   * 履歴をロード
   */
  private loadHistory(): SharingHistory {
    if (this.settings.preserveHistoryBetweenSessions) {
      const savedHistory = this.context.globalState.get<SharingHistory>('claude-code-sharing-history');
      if (savedHistory) {
        // 日付文字列をDateオブジェクトに変換
        savedHistory.lastUpdated = new Date(savedHistory.lastUpdated);
        savedHistory.items.forEach(item => {
          item.createdAt = new Date(item.createdAt);
          item.expiresAt = new Date(item.expiresAt);
        });
        
        // 有効期限切れのアイテムを除外
        const now = new Date();
        savedHistory.items = savedHistory.items.filter(item => {
          const isValid = item.expiresAt > now;
          item.isExpired = !isValid;
          return isValid;
        });
        
        return savedHistory;
      }
    }
    
    return {
      items: [],
      lastUpdated: new Date()
    };
  }
  
  /**
   * 履歴を保存
   */
  private saveHistory(): void {
    if (this.settings.preserveHistoryBetweenSessions) {
      this.context.globalState.update('claude-code-sharing-history', this.history);
    }
  }
  
  /**
   * 履歴に項目を追加
   * @param item 追加する共有ファイル
   */
  private addToHistory(item: SharedFile): void {
    // 履歴の先頭に追加
    this.history.items.unshift(item);
    
    // 最大数を超えないよう管理
    if (this.history.items.length > this.settings.maxHistoryItems) {
      this.history.items = this.history.items.slice(0, this.settings.maxHistoryItems);
    }
    
    this.history.lastUpdated = new Date();
    
    // 変更を保存
    this.saveHistory();
    
    // イベント発行
    this.emitEvent({
      type: SharingEventType.FILE_CREATED,
      fileId: item.id,
      timestamp: new Date()
    });
  }
  
  /**
   * テキストを共有
   * @param text 共有するテキスト
   * @param options 保存オプションまたは推奨ファイル名文字列
   * @param additionalOptions 追加の保存オプション（互換性のため）
   */
  public async shareText(
    text: any, 
    options?: FileSaveOptions | string, 
    additionalOptions?: FileSaveOptions
  ): Promise<SharedFile> {
    // null/undefined チェック
    if (text === null || text === undefined) {
      throw new Error('共有するテキストがありません（null または undefined）');
    }
    
    // 文字列でない場合は変換
    const textString = typeof text === 'string' ? text : String(text);
    
    // テキストサイズをバリデーション
    if (textString.length > this.settings.maxTextSize) {
      throw new Error(`テキストが長すぎます。${this.settings.maxTextSize}文字以内にしてください。`);
    }
    
    // このあと使う変数をtextからtextStringに変更
    text = textString;
    
    let fileOptions: FileSaveOptions = {
      type: 'text' as 'text',
      expirationHours: this.settings.defaultExpirationHours
    };
    
    // 引数がstring型の場合（後方互換性のため）
    if (typeof options === 'string') {
      fileOptions.title = options; // ファイル名のヒントとして使用
      fileOptions.metadata = { 
        suggestedFilename: options 
      };
      
      // 追加オプションがあれば適用
      if (additionalOptions) {
        fileOptions = {
          ...fileOptions,
          ...additionalOptions
        };
      }
    } 
    // 引数がオブジェクト型の場合（新しい使用法）
    else if (options && typeof options === 'object') {
      fileOptions = {
        ...fileOptions,
        ...options
      };
      
      // suggestedFilenameが直接渡された場合、metadataにも保存
      if (options.title && !options.metadata) {
        fileOptions.metadata = { 
          suggestedFilename: options.title
        };
      }
    }
    
    // テキストの先頭行をタイトルとして使用（もしtitleが指定されていない場合）
    if (!fileOptions.title && text) {
      const firstLine = text.split('\n')[0].trim();
      if (firstLine) {
        fileOptions.title = firstLine.slice(0, 50);
      }
    }
    
    const file = await this.tempFileManager.saveTextFile(text, fileOptions);
    
    // 履歴に追加
    this.addToHistory(file);
    
    return file;
  }
  
  /**
   * 画像を共有
   * @param imageData 画像データ
   * @param format 画像形式（png, jpg, jpeg, gifなど）
   * @param options 保存オプション
   */
  public async shareImage(imageData: Buffer, format: string, options?: FileSaveOptions): Promise<SharedFile> {
    // 画像形式をバリデーション
    format = format.toLowerCase();
    if (!this.settings.allowedImageFormats.includes(format)) {
      throw new Error(`サポートされていない画像形式です: ${format}。許可されている形式: ${this.settings.allowedImageFormats.join(', ')}`);
    }
    
    // 画像サイズをバリデーション
    if (imageData.length > this.settings.maxImageSize) {
      throw new Error(`画像サイズが大きすぎます。${this.settings.maxImageSize / (1024 * 1024)}MB以内にしてください。`);
    }
    
    // 画像ファイルを保存
    const file = await this.tempFileManager.saveImageFile(imageData, {
      ...options,
      type: 'image',
      format,
      expirationHours: options?.expirationHours || this.settings.defaultExpirationHours
    });
    
    // 履歴に追加
    this.addToHistory(file);
    
    return file;
  }
  
  /**
   * Base64エンコードされた画像データを共有
   * @param base64Data Base64エンコードされた画像データ
   * @param fileName 元のファイル名
   * @param options 保存オプション
   */
  public async shareBase64Image(base64Data: any, fileName: string, options?: FileSaveOptions): Promise<SharedFile> {
    // null/undefined チェック
    if (base64Data === null || base64Data === undefined) {
      throw new Error('画像データがありません（null または undefined）');
    }
    
    // 文字列でない場合は変換
    const base64String = typeof base64Data === 'string' ? base64Data : String(base64Data);
    
    // エラーログを追加（デバッグ用）
    console.log(`shareBase64Image: 画像データの型: ${typeof base64Data}, 長さ: ${base64String.length}`);
    
    // Base64ヘッダーを削除
    const base64Content = base64String.replace(/^data:image\/\w+;base64,/, '');
    
    // バッファに変換
    const buffer = Buffer.from(base64Content, 'base64');
    
    // ファイル形式を取得
    const format = path.extname(fileName).slice(1).toLowerCase() || 'png';
    
    // 画像を共有
    return this.shareImage(buffer, format, {
      ...options,
      title: fileName
    });
  }
  
  /**
   * 履歴から共有アイテムを取得
   * @param limit 取得する最大アイテム数（デフォルトは全て）
   */
  public getHistory(limit?: number): SharedFile[] {
    // 有効期限切れのアイテムを除外
    const now = new Date();
    const validItems = this.history.items.filter(item => {
      const isValid = item.expiresAt > now;
      item.isExpired = !isValid;
      return isValid;
    });
    
    return limit ? validItems.slice(0, limit) : validItems;
  }
  
  /**
   * 履歴からアイテムを削除
   * @param id 削除するアイテムのID
   */
  public deleteFromHistory(id: string): boolean {
    const index = this.history.items.findIndex(item => item.id === id);
    
    if (index !== -1) {
      const file = this.history.items[index];
      
      // ファイルも削除
      if (this.tempFileManager.fileExists(file.path)) {
        this.tempFileManager.deleteFile(file.path);
      }
      
      // 履歴から削除
      this.history.items.splice(index, 1);
      this.history.lastUpdated = new Date();
      this.saveHistory();
      
      // イベント発行
      this.emitEvent({
        type: SharingEventType.FILE_DELETED,
        fileId: id,
        timestamp: new Date()
      });
      
      return true;
    }
    
    return false;
  }
  
  /**
   * 履歴をクリア
   * @param deleteFiles ファイルも削除するかどうか
   */
  public clearHistory(deleteFiles: boolean = true): void {
    if (deleteFiles) {
      // 全ファイルの削除
      this.history.items.forEach(file => {
        if (this.tempFileManager.fileExists(file.path)) {
          this.tempFileManager.deleteFile(file.path);
        }
      });
    }
    
    // 履歴をクリア
    this.history.items = [];
    this.history.lastUpdated = new Date();
    this.saveHistory();
  }
  
  /**
   * ファイルアクセスを記録
   * @param id アクセスされたファイルのID
   */
  public recordAccess(id: string): void {
    const file = this.history.items.find(item => item.id === id);
    
    if (file) {
      file.accessCount++;
      this.saveHistory();
      
      // イベント発行
      this.emitEvent({
        type: SharingEventType.FILE_ACCESSED,
        fileId: id,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * ClaudeCode用のコマンドを生成
   * @param file 共有ファイル
   */
  public generateCommand(file: SharedFile): string {
    return `view ${file.path}`;
  }
  
  /**
   * 期限切れファイルをクリーンアップ
   */
  public cleanupExpiredFiles(): number {
    const deletedCount = this.tempFileManager.cleanupExpiredFiles(this.history.items);
    
    // 有効期限切れのアイテムを履歴から削除
    const now = new Date();
    const originalLength = this.history.items.length;
    
    this.history.items = this.history.items.filter(item => {
      const isValid = item.expiresAt > now;
      
      if (!isValid) {
        // イベント発行
        this.emitEvent({
          type: SharingEventType.FILE_EXPIRED,
          fileId: item.id,
          timestamp: new Date()
        });
      }
      
      return isValid;
    });
    
    if (this.history.items.length !== originalLength) {
      this.history.lastUpdated = new Date();
      this.saveHistory();
    }
    
    return deletedCount;
  }
  
  /**
   * 設定を更新
   * @param settings 新しい設定値
   */
  public updateSettings(settings: Partial<SharingSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings
    };
    
    // 設定変更をグローバルステートに保存
    this.context.globalState.update('claude-code-sharing-settings', this.settings);
  }
  
  /**
   * 現在の設定を取得
   */
  public getSettings(): SharingSettings {
    return { ...this.settings };
  }
  
  /**
   * イベントハンドラを登録
   * @param type イベントタイプ
   * @param handler ハンドラ関数
   */
  public subscribeToEvent(type: SharingEventType, handler: (event: SharingEvent) => void): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, []);
    }
    
    this.eventHandlers.get(type)?.push(handler);
  }
  
  /**
   * イベントハンドラの登録を解除
   * @param type イベントタイプ
   * @param handler ハンドラ関数
   */
  public unsubscribeFromEvent(type: SharingEventType, handler: (event: SharingEvent) => void): void {
    if (this.eventHandlers.has(type)) {
      const handlers = this.eventHandlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    }
  }
  
  /**
   * イベントを発行
   * @param event イベント情報
   */
  private emitEvent(event: SharingEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`イベントハンドラ実行中にエラーが発生しました: ${error}`);
        }
      });
    }
  }
}