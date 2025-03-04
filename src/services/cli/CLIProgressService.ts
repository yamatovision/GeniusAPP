import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from '../AppGeniusEventBus';
import { AppGeniusStateManager, ImplementationItem } from '../AppGeniusStateManager';
import { CLIExecutionStatus } from './CLILauncherService';

/**
 * CLI進捗情報
 */
export interface CLIProgressInfo {
  status: CLIExecutionStatus;
  totalProgress: number;
  items: ImplementationItem[];
  currentItem?: string;
  message?: string;
  timestamp: number;
}

/**
 * CLI進捗管理サービス
 * CLIからの進捗情報を処理し、UIに反映する
 */
export class CLIProgressService {
  private static instance: CLIProgressService;
  private eventBus: AppGeniusEventBus;
  private stateManager: AppGeniusStateManager;
  private statusBarItem: vscode.StatusBarItem;
  
  // 現在の進捗状態
  private currentProgress: CLIProgressInfo | null = null;
  private projectId: string | null = null;
  
  private constructor() {
    this.eventBus = AppGeniusEventBus.getInstance();
    this.stateManager = AppGeniusStateManager.getInstance();
    
    // ステータスバーアイテムの作成
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.name = 'AppGenius CLI Progress';
    this.statusBarItem.tooltip = 'AppGenius CLI 進捗状況';
    this.statusBarItem.command = 'appgenius-ai.showCliProgress';
    
    // イベントリスナーの登録
    this.registerEventListeners();
    
    Logger.info('CLIProgressService initialized');
  }
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): CLIProgressService {
    if (!CLIProgressService.instance) {
      CLIProgressService.instance = new CLIProgressService();
    }
    return CLIProgressService.instance;
  }
  
  /**
   * イベントリスナーの登録
   */
  private registerEventListeners(): void {
    // CLI起動イベント
    this.eventBus.onEventType(AppGeniusEventType.CLI_STARTED, (event) => {
      Logger.debug('CLI起動イベントを受信しました');
      this.updateStatusBar(CLIExecutionStatus.RUNNING, 0, '起動中...');
      this.statusBarItem.show();
      
      // スコープIDを記録（進捗ファイル監視のため）
      const scopeId = event.data?.scopeId;
      if (scopeId) {
        // ホームディレクトリ内の進捗ファイルパスを設定
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const progressFilePath = path.join(homeDir, '.appgenius', 'progress', `${scopeId}.json`);
        
        // 外部プロセスからの進捗ファイル監視を開始
        this.watchExternalProgressFile(progressFilePath);
      }
    });
    
    // CLI進捗イベント
    this.eventBus.onEventType(AppGeniusEventType.CLI_PROGRESS, (eventData) => {
      const progress = eventData.data as CLIProgressInfo;
      Logger.debug(`CLI進捗イベントを受信しました: ${progress.totalProgress}%`);
      
      this.currentProgress = progress;
      
      // 進捗をUIに反映
      this.updateStatusBar(
        progress.status, 
        progress.totalProgress, 
        progress.currentItem || ''
      );
      
      // 実装状態を更新
      this.updateImplementationState(progress);
      
      // 100%完了していたら完了イベントを発火
      if (progress.totalProgress >= 100 && progress.status === CLIExecutionStatus.RUNNING) {
        this.eventBus.emit(
          AppGeniusEventType.CLI_COMPLETED,
          progress,
          'CLIProgressService'
        );
      }
    });
    
    // CLI完了イベント
    this.eventBus.onEventType(AppGeniusEventType.CLI_COMPLETED, () => {
      Logger.debug('CLI完了イベントを受信しました');
      this.updateStatusBar(CLIExecutionStatus.COMPLETED, 100, '完了');
      
      // 通知を表示
      vscode.window.showInformationMessage('AppGenius CLI: 実装が完了しました');
      
      // 5秒後にステータスバーを非表示
      setTimeout(() => {
        this.statusBarItem.hide();
      }, 5000);
    });
    
    // CLIエラーイベント
    this.eventBus.onEventType(AppGeniusEventType.CLI_ERROR, (event) => {
      const error = event.data as Error;
      Logger.error('CLIエラーイベントを受信しました', error);
      this.updateStatusBar(CLIExecutionStatus.FAILED, 0, `エラー: ${error.message}`);
      
      // エラー通知
      vscode.window.showErrorMessage(`AppGenius CLI エラー: ${error.message}`);
    });
    
    // CLI停止イベント
    this.eventBus.onEventType(AppGeniusEventType.CLI_STOPPED, () => {
      Logger.debug('CLI停止イベントを受信しました');
      this.updateStatusBar(CLIExecutionStatus.IDLE, 0, '停止');
      
      // 5秒後にステータスバーを非表示
      setTimeout(() => {
        this.statusBarItem.hide();
      }, 5000);
      
      // 進捗ファイル監視を停止
      this.stopExternalProgressWatcher();
    });
    
    // プロジェクト選択イベント
    this.eventBus.onEventType(AppGeniusEventType.PROJECT_SELECTED, (event) => {
      this.projectId = event.data?.id;
    });
  }
  
  // 外部プロセス(CLI)が書き込む進捗ファイルを監視するウォッチャー
  private externalProgressWatcher: fs.FSWatcher | null = null;
  private externalProgressInterval: NodeJS.Timeout | null = null;
  
  /**
   * 外部プロセスからの進捗ファイルを監視
   */
  private watchExternalProgressFile(progressFilePath: string): void {
    try {
      // 既に監視中なら停止
      this.stopExternalProgressWatcher();
      
      Logger.debug(`外部進捗ファイルの監視を開始: ${progressFilePath}`);
      
      // ディレクトリの存在確認
      const progressDir = path.dirname(progressFilePath);
      if (!fs.existsSync(progressDir)) {
        fs.mkdirSync(progressDir, { recursive: true });
      }
      
      // 定期的に進捗ファイルをチェック（ファイルが存在しない場合に対応）
      this.externalProgressInterval = setInterval(() => {
        this.checkExternalProgressFile(progressFilePath);
      }, 3000); // 3秒ごとにチェック
      
      // ファイル変更のウォッチャーを設定
      this.externalProgressWatcher = fs.watch(progressDir, (_eventType, fileName) => {
        if (fileName === path.basename(progressFilePath)) {
          this.checkExternalProgressFile(progressFilePath);
        }
      });
      
    } catch (error) {
      Logger.error('外部進捗ファイルの監視開始に失敗しました', error as Error);
    }
  }
  
  /**
   * 外部進捗ファイルをチェック
   */
  private checkExternalProgressFile(progressFilePath: string): void {
    try {
      if (!fs.existsSync(progressFilePath)) {
        return; // ファイルがまだ存在しない
      }
      
      const fileContent = fs.readFileSync(progressFilePath, 'utf8');
      if (!fileContent.trim()) {
        return; // 空のファイル
      }
      
      const progressData = JSON.parse(fileContent);
      
      // ProgressData型からCLIProgressInfo型への変換
      const progressInfo: CLIProgressInfo = {
        status: this.mapProgressStatus(progressData.status),
        totalProgress: progressData.completed || 0,
        items: this.currentProgress?.items || [],  // 既存のアイテムを維持
        currentItem: progressData.currentTask,
        message: progressData.error,
        timestamp: Date.now()
      };
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.CLI_PROGRESS,
        progressInfo,
        'CLIProgressService'
      );
      
      // エラー状態を確認
      if (progressData.status === 'failed' && progressData.error) {
        this.eventBus.emit(
          AppGeniusEventType.CLI_ERROR,
          new Error(progressData.error),
          'CLIProgressService'
        );
      }
      
    } catch (error) {
      // JSON解析エラーなどは無視（ファイルが書き込み中の可能性）
    }
  }
  
  /**
   * 外部進捗ファイルの監視を停止
   */
  private stopExternalProgressWatcher(): void {
    if (this.externalProgressWatcher) {
      this.externalProgressWatcher.close();
      this.externalProgressWatcher = null;
      Logger.debug('外部進捗ファイルの監視を停止しました');
    }
    
    if (this.externalProgressInterval) {
      clearInterval(this.externalProgressInterval);
      this.externalProgressInterval = null;
    }
  }
  
  /**
   * 進捗状態をCLIExecutionStatusに変換
   */
  private mapProgressStatus(status: string): CLIExecutionStatus {
    switch (status) {
      case 'started':
      case 'in-progress':
        return CLIExecutionStatus.RUNNING;
      case 'completed':
        return CLIExecutionStatus.COMPLETED;
      case 'failed':
        return CLIExecutionStatus.FAILED;
      default:
        return CLIExecutionStatus.RUNNING;
    }
  }
  
  /**
   * ステータスバーの更新
   */
  private updateStatusBar(status: CLIExecutionStatus, progress: number, message: string): void {
    // ステータスに応じたアイコン
    let icon = '';
    switch (status) {
      case CLIExecutionStatus.RUNNING:
        icon = '$(sync~spin)';
        break;
      case CLIExecutionStatus.COMPLETED:
        icon = '$(check)';
        break;
      case CLIExecutionStatus.FAILED:
        icon = '$(error)';
        break;
      case CLIExecutionStatus.PAUSED:
        icon = '$(debug-pause)';
        break;
      default:
        icon = '$(terminal)';
    }
    
    // 進捗パーセント
    const progressStr = progress > 0 ? `${Math.round(progress)}%` : '';
    
    // ステータスバーのテキスト
    this.statusBarItem.text = `${icon} CLI: ${progressStr} ${message}`;
    
    // ツールチップの更新
    this.statusBarItem.tooltip = `AppGenius CLI - 状態: ${status}, 進捗: ${progressStr}`;
    
    // コマンドの設定
    this.statusBarItem.command = 'appgenius-ai.showCliProgress';
    
    // 表示
    this.statusBarItem.show();
  }
  
  /**
   * 実装状態の更新
   */
  private async updateImplementationState(progress: CLIProgressInfo): Promise<void> {
    try {
      if (!this.projectId) {
        // プロジェクトIDが不明な場合はスキップ
        return;
      }
      
      // 実装項目と進捗を更新
      await this.stateManager.updateImplementationProgress(
        this.projectId,
        progress.items,
        progress.totalProgress
      );
      
      Logger.debug(`実装状態を更新しました: ${progress.totalProgress}%`);
    } catch (error) {
      Logger.error('実装状態の更新に失敗しました', error as Error);
    }
  }
  
  /**
   * CLI進捗ダイアログを表示
   */
  public async showProgressDialog(): Promise<void> {
    try {
      if (!this.currentProgress) {
        vscode.window.showInformationMessage('CLIの進捗情報がありません');
        return;
      }
      
      // 完了したアイテムをカウント
      const completedItems = this.currentProgress.items.filter(
        item => item.progress === 100
      ).length;
      
      // 総アイテム数
      const totalItems = this.currentProgress.items.length;
      
      // 進捗情報ダイアログ
      const message = `
CLI 実行状態: ${this.currentProgress.status}
全体進捗: ${this.currentProgress.totalProgress}%
項目完了: ${completedItems} / ${totalItems}
現在の項目: ${this.currentProgress.currentItem || 'なし'}
      `;
      
      vscode.window.showInformationMessage(message);
    } catch (error) {
      Logger.error('進捗ダイアログの表示に失敗しました', error as Error);
      vscode.window.showErrorMessage(`進捗情報の表示に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}