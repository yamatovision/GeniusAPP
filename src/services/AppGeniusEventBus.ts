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
  PROJECT_REMOVED = 'project-removed', // PROJECT_DELETEDと同等の機能だがProjectServiceとの互換性のため追加
  PROJECT_UPDATED = 'project-updated',
  PROJECT_PATH_UPDATED = 'project-path-updated', // 追加: プロジェクトパス更新イベント
  PHASE_COMPLETED = 'phase-completed',
  
  // 環境変数関連イベント
  ENV_VARIABLES_UPDATED = 'env-variables-updated',
  ENV_FILE_CREATED = 'env-file-created',
  CURRENT_STATUS_UPDATED = 'current-status-updated',
  
  // ClaudeCode関連イベント
  CLAUDE_CODE_STARTED = 'claude-code-started',
  CLAUDE_CODE_PROGRESS = 'claude-code-progress',
  CLAUDE_CODE_COMPLETED = 'claude-code-completed',
  CLAUDE_CODE_ERROR = 'claude-code-error',
  CLAUDE_CODE_STOPPED = 'claude-code-stopped',
  CLAUDE_CODE_LAUNCH_COUNTED = 'claude-code-launch-counted'
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
   * イベントを発行（emit と同等の機能を持つ別名メソッド）
   * @param type イベントタイプ
   * @param data イベントデータ
   * @param source イベント発生元
   * @param projectId プロジェクトID
   */
  public publish<T>(type: AppGeniusEventType, data: T, source: string, projectId?: string): void {
    this.emit(type, data, source, projectId);
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