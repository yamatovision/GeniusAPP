import * as vscode from 'vscode';
import { SharedFile, FileSaveOptions } from '../../../types/SharingTypes';
import { Logger } from '../../../utils/logger';
import { ClaudeCodeSharingService } from '../../../services/ClaudeCodeSharingService';

/**
 * 共有サービスインターフェース
 * ScopeManagerPanelの共有機能を分離
 */
export interface ISharingService {
  // 共有機能
  shareText(text: string, options?: FileSaveOptions): Promise<SharedFile>;
  shareImage(imageData: string, fileName: string): Promise<SharedFile>;
  
  // 履歴管理
  getHistory(): SharedFile[];
  deleteFromHistory(fileId: string): boolean;
  recordAccess(fileId: string): void;
  
  // コマンド生成
  generateCommand(file: SharedFile): string;
  
  // プロジェクト関連
  setProjectBasePath(projectPath: string): void;
  
  // クリーンアップ
  cleanupExpiredFiles(): void;
  
  // イベント
  onHistoryUpdated: vscode.Event<SharedFile[]>;
  
  // リソース解放
  dispose(): void;
}

/**
 * 共有サービス実装クラス
 * ClaudeCodeSharingServiceを内部で利用して共有機能を提供
 */
export class SharingService implements ISharingService {
  private _onHistoryUpdated = new vscode.EventEmitter<SharedFile[]>();
  public readonly onHistoryUpdated = this._onHistoryUpdated.event;
  
  private _disposables: vscode.Disposable[] = [];
  private _projectBasePath: string = '';
  private _history: SharedFile[] = [];
  private _claudeCodeSharingService: ClaudeCodeSharingService;
  
  // シングルトンインスタンス
  private static _instance: SharingService;
  
  public static getInstance(context?: vscode.ExtensionContext): SharingService {
    if (!SharingService._instance) {
      if (!context) {
        throw new Error('共有サービスの初期化にはExtensionContextが必要です');
      }
      SharingService._instance = new SharingService(context);
    }
    return SharingService._instance;
  }
  
  private constructor(context: vscode.ExtensionContext) {
    // ClaudeCodeSharingServiceを初期化
    this._claudeCodeSharingService = new ClaudeCodeSharingService(context);
    
    Logger.info('SharingService: 初期化完了');
  }
  
  /**
   * テキストを共有
   * @param text 共有するテキスト
   * @param options 保存オプション
   */
  public async shareText(text: any, options?: FileSaveOptions): Promise<SharedFile> {
    try {
      // textがnullかundefinedの場合はエラー
      if (text === null || text === undefined) {
        throw new Error('共有するテキストがnullまたはundefinedです');
      }
      
      // textが文字列でない場合は変換
      const textString = typeof text === 'string' ? text : String(text);
      
      Logger.info('SharingService: テキスト共有を開始します', { 
        textType: typeof text,
        textString: typeof textString, 
        textLength: textString.length, 
        hasOptions: !!options 
      });
      
      // ClaudeCodeSharingServiceを使ってテキストを共有
      const file = await this._claudeCodeSharingService.shareText(textString, options);
      
      Logger.info('SharingService: テキスト共有成功', { 
        fileName: file.fileName,
        originalName: file.originalName,
        title: file.title
      });
      
      // 履歴を更新
      this._updateHistory();
      
      return file;
    } catch (error) {
      Logger.error('SharingService: テキスト共有エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 画像を共有
   * @param imageData Base64形式の画像データ
   * @param fileName ファイル名
   */
  public async shareImage(imageData: any, fileName: string): Promise<SharedFile> {
    try {
      // imageDataがnullかundefinedの場合はエラー
      if (imageData === null || imageData === undefined) {
        throw new Error('共有する画像データがnullまたはundefinedです');
      }
      
      // imageDataが文字列でない場合は変換
      const imageDataString = typeof imageData === 'string' ? imageData : String(imageData);
      
      Logger.info('SharingService: 画像共有を開始します', { 
        imageType: typeof imageData,
        imageDataString: typeof imageDataString,
        dataLength: imageDataString.length, 
        fileName: fileName
      });
      
      // ClaudeCodeSharingServiceを使って画像を共有
      const file = await this._claudeCodeSharingService.shareBase64Image(imageDataString, fileName);
      
      Logger.info('SharingService: 画像共有成功', { 
        fileName: file.fileName
      });
      
      // 履歴を更新
      this._updateHistory();
      
      return file;
    } catch (error) {
      Logger.error('SharingService: 画像共有エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * 履歴を取得
   */
  public getHistory(): SharedFile[] {
    try {
      // ClaudeCodeSharingServiceから履歴を取得して内部キャッシュも更新
      this._history = this._claudeCodeSharingService.getHistory();
      return this._history;
    } catch (error) {
      Logger.error('SharingService: 履歴取得エラー', error as Error);
      return [];
    }
  }
  
  /**
   * 内部履歴キャッシュを更新
   */
  private _updateHistory(): void {
    try {
      // ClaudeCodeSharingServiceから履歴を取得
      this._history = this._claudeCodeSharingService.getHistory();
      
      // 履歴更新イベントを発火
      this._onHistoryUpdated.fire(this._history);
    } catch (error) {
      Logger.error('SharingService: 履歴更新エラー', error as Error);
    }
  }
  
  /**
   * 履歴から項目を削除
   * @param fileId 削除するファイルID
   */
  public deleteFromHistory(fileId: string): boolean {
    try {
      // ClaudeCodeSharingServiceを使って履歴から削除
      const success = this._claudeCodeSharingService.deleteFromHistory(fileId);
      
      if (success) {
        // 履歴を更新
        this._updateHistory();
      }
      
      return success;
    } catch (error) {
      Logger.error('SharingService: 履歴削除エラー', error as Error);
      return false;
    }
  }
  
  /**
   * 履歴項目のアクセスカウントを増やす
   * @param fileId ファイルID
   */
  public recordAccess(fileId: string): void {
    try {
      this._claudeCodeSharingService.recordAccess(fileId);
    } catch (error) {
      Logger.error('SharingService: アクセス記録エラー', error as Error);
    }
  }
  
  /**
   * 共有ファイルからコマンドを生成
   * @param file 共有ファイル
   */
  public generateCommand(file: SharedFile): string {
    try {
      return this._claudeCodeSharingService.generateCommand(file);
    } catch (error) {
      Logger.error('SharingService: コマンド生成エラー', error as Error);
      return '';
    }
  }
  
  /**
   * ファイルIDからコマンドを生成して取得
   * @param fileId ファイルID
   * @returns コマンド文字列またはnull（ファイルが見つからない場合）
   */
  public async getCommandByFileId(fileId: string): Promise<string | null> {
    try {
      Logger.info(`SharingService: fileId=${fileId}のコマンドを取得します`);
      const history = this.getHistory();
      const file = history.find(item => item.id === fileId);
      
      if (!file) {
        Logger.warn(`SharingService: fileId=${fileId}のファイルが見つかりません`);
        return null;
      }
      
      // アクセス記録を更新
      this.recordAccess(fileId);
      
      // コマンドを生成して返す
      return this.generateCommand(file);
    } catch (error) {
      Logger.error(`SharingService: fileId=${fileId}のコマンド取得エラー`, error as Error);
      return null;
    }
  }
  
  /**
   * プロジェクトのベースパスを設定
   * @param projectPath プロジェクトパス
   */
  public setProjectBasePath(projectPath: string): void {
    this._projectBasePath = projectPath;
    
    this._claudeCodeSharingService.setProjectBasePath(projectPath);
    
    Logger.info(`SharingService: プロジェクトベースパスを設定しました: ${projectPath}`);
  }
  
  /**
   * 期限切れファイルのクリーンアップ
   */
  public cleanupExpiredFiles(): void {
    try {
      this._claudeCodeSharingService.cleanupExpiredFiles();
    } catch (error) {
      Logger.error('SharingService: クリーンアップエラー', error as Error);
    }
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    // イベントエミッタを解放
    this._onHistoryUpdated.dispose();
    
    // Disposablesを解放
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
    
    // ClaudeCodeSharingServiceのクリーンアップを実行
    this._claudeCodeSharingService.cleanupExpiredFiles();
  }
}