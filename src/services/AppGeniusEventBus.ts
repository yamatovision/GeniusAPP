import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

/**
 * イベントタイプの定義
 * アプリケーション内で発生する各種イベントタイプ
 */
export enum AppGeniusEventType {
  REQUIREMENTS_UPDATED = 'requirements-updated',
  MOCKUP_CREATED = 'mockup-created',
  SCOPE_UPDATED = 'scope-updated',
  IMPLEMENTATION_PROGRESS = 'implementation-progress',
  PROJECT_STRUCTURE_UPDATED = 'project-structure-updated',
  PROJECT_CREATED = 'project-created',
  PROJECT_SELECTED = 'project-selected',
  PROJECT_DELETED = 'project-deleted',
  PROJECT_UPDATED = 'project-updated',
  PHASE_COMPLETED = 'phase-completed',
  
  // CLI関連イベント
  CLI_STARTED = 'cli-started',
  CLI_PROGRESS = 'cli-progress',
  CLI_COMPLETED = 'cli-completed',
  CLI_ERROR = 'cli-error',
  CLI_STOPPED = 'cli-stopped'
}

/**
 * イベントデータの型定義
 */
export interface AppGeniusEvent<T = any> {
  type: AppGeniusEventType;
  data: T;
  timestamp: number;
  source: string;
  projectId?: string;
}

/**
 * AppGenius イベントバス
 * モジュール間のコミュニケーションと状態同期を担当
 */
export class AppGeniusEventBus {
  private static instance: AppGeniusEventBus;
  private eventEmitter = new vscode.EventEmitter<AppGeniusEvent>();
  
  private constructor() {
    Logger.info('AppGeniusEventBus initialized');
  }
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): AppGeniusEventBus {
    if (!AppGeniusEventBus.instance) {
      AppGeniusEventBus.instance = new AppGeniusEventBus();
    }
    return AppGeniusEventBus.instance;
  }
  
  /**
   * イベントを発火
   * @param type イベントタイプ
   * @param data イベントデータ
   * @param source イベント発生元
   * @param projectId プロジェクトID
   */
  public emit<T>(type: AppGeniusEventType, data: T, source: string, projectId?: string): void {
    const event: AppGeniusEvent<T> = {
      type,
      data,
      timestamp: Date.now(),
      source,
      projectId
    };
    
    Logger.debug(`Event emitted: ${type} from ${source}${projectId ? ` for project ${projectId}` : ''}`);
    this.eventEmitter.fire(event);
  }
  
  /**
   * 特定のイベントタイプをリッスン
   * @param type イベントタイプ
   * @param listener リスナー関数
   */
  public onEventType(type: AppGeniusEventType, listener: (event: AppGeniusEvent) => void): vscode.Disposable {
    return this.eventEmitter.event(event => {
      if (event.type === type) {
        listener(event);
      }
    });
  }
  
  /**
   * 全てのイベントをリッスン
   * @param listener リスナー関数
   */
  public onEvent(listener: (event: AppGeniusEvent) => void): vscode.Disposable {
    return this.eventEmitter.event(listener);
  }
  
  /**
   * 特定のプロジェクトのイベントをリッスン
   * @param projectId プロジェクトID
   * @param listener リスナー関数
   */
  public onProjectEvent(projectId: string, listener: (event: AppGeniusEvent) => void): vscode.Disposable {
    return this.eventEmitter.event(event => {
      if (event.projectId === projectId) {
        listener(event);
      }
    });
  }
}