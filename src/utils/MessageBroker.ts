import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PlatformManager } from './PlatformManager';
import { Logger } from './logger';

/**
 * メッセージの種類
 */
export enum MessageType {
  SCOPE_CREATE = 'scope:create',
  SCOPE_UPDATE = 'scope:update',
  PROGRESS_REPORT = 'progress:report',
  COMMAND_EXECUTE = 'command:execute',
  RESULT_SUBMIT = 'result:submit'
}

/**
 * メッセージの状態
 */
export enum MessageStatus {
  NEW = 'new',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * メッセージのインターフェース
 */
export interface Message {
  id: string;
  type: MessageType;
  status: MessageStatus;
  payload: any;
  timestamp: number;
}

/**
 * メッセージ受信コールバック
 */
export type MessageCallback = (message: Message) => void;

/**
 * メッセージブローカークラス
 * ファイルベースのメッセージングを提供
 */
export class MessageBroker {
  private static instance: MessageBroker;
  
  // メッセージディレクトリのパス
  private messageDirPath: string;
  
  // ファイル監視インスタンス
  private watcher: fs.FSWatcher | null = null;
  
  // メッセージ受信コールバック
  private messageCallbacks: Map<MessageType, MessageCallback[]> = new Map();
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(projectId?: string): MessageBroker {
    if (!MessageBroker.instance) {
      MessageBroker.instance = new MessageBroker(projectId);
    }
    return MessageBroker.instance;
  }
  
  /**
   * コンストラクタ
   */
  private constructor(projectId?: string) {
    // プロジェクトIDが指定されていない場合は環境変数から取得
    const actualProjectId = projectId || process.env.APPGENIUS_PROJECT_ID || 'default';
    
    // メッセージディレクトリのパスを構築
    const platformManager = PlatformManager.getInstance();
    this.messageDirPath = path.join(
      platformManager.getTempDirectory('messages'),
      actualProjectId
    );
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.messageDirPath)) {
      fs.mkdirSync(this.messageDirPath, { recursive: true });
    }
    
    Logger.debug(`MessageBroker initialized with directory: ${this.messageDirPath}`);
  }
  
  /**
   * メッセージを送信
   */
  public sendMessage(type: MessageType, payload: any): string {
    try {
      // メッセージIDを生成
      const messageId = uuidv4();
      
      // メッセージオブジェクトを構築
      const message: Message = {
        id: messageId,
        type,
        status: MessageStatus.NEW,
        payload,
        timestamp: Date.now()
      };
      
      // メッセージファイルのパスを構築
      const messageFilePath = this.getMessageFilePath(messageId, MessageStatus.NEW);
      
      // メッセージをファイルに書き込む
      fs.writeFileSync(messageFilePath, JSON.stringify(message, null, 2), 'utf8');
      
      Logger.debug(`Message sent: ${messageId} (${type})`);
      
      return messageId;
    } catch (error) {
      Logger.error('Failed to send message', error as Error);
      throw error;
    }
  }
  
  /**
   * メッセージ受信のためのリスナーを登録
   */
  public onMessage(type: MessageType, callback: MessageCallback): void {
    // 指定されたタイプのコールバック配列を取得または作成
    if (!this.messageCallbacks.has(type)) {
      this.messageCallbacks.set(type, []);
    }
    
    // コールバックを登録
    this.messageCallbacks.get(type)!.push(callback);
    
    // ウォッチャーがまだ作成されていない場合は作成
    this.ensureWatcher();
    
    Logger.debug(`Message listener registered for type: ${type}`);
  }
  
  /**
   * すべてのタイプのメッセージを受信するリスナーを登録
   */
  public onAnyMessage(callback: MessageCallback): void {
    // すべてのメッセージタイプに対してリスナーを登録
    Object.values(MessageType).forEach(type => {
      this.onMessage(type as MessageType, callback);
    });
    
    Logger.debug('Message listener registered for all message types');
  }
  
  /**
   * ファイル監視が作成されていることを確認
   */
  private ensureWatcher(): void {
    if (this.watcher !== null) {
      return;
    }
    
    try {
      // メッセージディレクトリを監視
      this.watcher = fs.watch(this.messageDirPath, (_eventType, filename) => {
        // ファイル名がnullまたは.jsonで終わらない場合はスキップ
        if (!filename || !filename.endsWith('.json')) {
          return;
        }
        
        // 'new'ステータスのファイルのみ処理
        if (!filename.includes('.new.')) {
          return;
        }
        
        this.processMessageFile(filename);
      });
      
      Logger.debug(`File watcher started for directory: ${this.messageDirPath}`);
    } catch (error) {
      Logger.error('Failed to create file watcher', error as Error);
    }
  }
  
  /**
   * メッセージファイルを処理
   */
  private processMessageFile(filename: string): void {
    try {
      // メッセージファイルのパスを取得
      const filePath = path.join(this.messageDirPath, filename);
      
      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
        return;
      }
      
      // メッセージを読み込む
      const messageJson = fs.readFileSync(filePath, 'utf8');
      const message = JSON.parse(messageJson) as Message;
      
      // メッセージのステータスを「処理中」に更新
      message.status = MessageStatus.PROCESSING;
      
      // ファイル名を更新（.new.json → .processing.json）
      const processingFilePath = this.getMessageFilePath(message.id, MessageStatus.PROCESSING);
      
      // 元のファイルを削除して新しいステータスのファイルを作成
      fs.renameSync(filePath, processingFilePath);
      
      // 更新されたメッセージを書き込む
      fs.writeFileSync(processingFilePath, JSON.stringify(message, null, 2), 'utf8');
      
      Logger.debug(`Processing message: ${message.id} (${message.type})`);
      
      // 該当するタイプのコールバックを実行
      if (this.messageCallbacks.has(message.type)) {
        this.messageCallbacks.get(message.type)!.forEach(callback => {
          try {
            callback(message);
          } catch (callbackError) {
            Logger.error(`Error in message callback for ${message.type}`, callbackError as Error);
          }
        });
      }
      
      // メッセージを処理済みとしてマーク
      this.markMessageAsCompleted(message.id);
    } catch (error) {
      Logger.error(`Failed to process message file: ${filename}`, error as Error);
    }
  }
  
  /**
   * メッセージを処理完了としてマーク
   */
  public markMessageAsCompleted(messageId: string): void {
    try {
      // 処理中ファイルのパスを取得
      const processingFilePath = this.getMessageFilePath(messageId, MessageStatus.PROCESSING);
      
      // ファイルが存在するか確認
      if (!fs.existsSync(processingFilePath)) {
        return;
      }
      
      // メッセージを読み込む
      const messageJson = fs.readFileSync(processingFilePath, 'utf8');
      const message = JSON.parse(messageJson) as Message;
      
      // メッセージのステータスを「完了」に更新
      message.status = MessageStatus.COMPLETED;
      
      // 完了ファイルのパスを取得
      const completedFilePath = this.getMessageFilePath(messageId, MessageStatus.COMPLETED);
      
      // 処理中ファイルを削除して完了ファイルを作成
      fs.renameSync(processingFilePath, completedFilePath);
      
      // 更新されたメッセージを書き込む
      fs.writeFileSync(completedFilePath, JSON.stringify(message, null, 2), 'utf8');
      
      Logger.debug(`Message marked as completed: ${messageId}`);
    } catch (error) {
      Logger.error(`Failed to mark message as completed: ${messageId}`, error as Error);
    }
  }
  
  /**
   * メッセージを失敗としてマーク
   */
  public markMessageAsFailed(messageId: string, error: Error): void {
    try {
      // 処理中ファイルのパスを取得
      const processingFilePath = this.getMessageFilePath(messageId, MessageStatus.PROCESSING);
      
      // ファイルが存在するか確認
      if (!fs.existsSync(processingFilePath)) {
        return;
      }
      
      // メッセージを読み込む
      const messageJson = fs.readFileSync(processingFilePath, 'utf8');
      const message = JSON.parse(messageJson) as Message;
      
      // メッセージのステータスを「失敗」に更新
      message.status = MessageStatus.FAILED;
      
      // エラー情報を追加
      message.payload.error = {
        message: error.message,
        stack: error.stack
      };
      
      // 失敗ファイルのパスを取得
      const failedFilePath = this.getMessageFilePath(messageId, MessageStatus.FAILED);
      
      // 処理中ファイルを削除して失敗ファイルを作成
      fs.renameSync(processingFilePath, failedFilePath);
      
      // 更新されたメッセージを書き込む
      fs.writeFileSync(failedFilePath, JSON.stringify(message, null, 2), 'utf8');
      
      Logger.debug(`Message marked as failed: ${messageId}`);
    } catch (error) {
      Logger.error(`Failed to mark message as failed: ${messageId}`, error as Error);
    }
  }
  
  /**
   * メッセージファイルのパスを取得
   */
  private getMessageFilePath(messageId: string, status: MessageStatus): string {
    return path.join(this.messageDirPath, `${messageId}.${status}.json`);
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    
    this.messageCallbacks.clear();
    
    Logger.debug('MessageBroker disposed');
  }
}