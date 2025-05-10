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
  // 後方互換性のために残しているもの
  PROJECT_SELECTED = 'project-selected', // 他のファイルで参照されているためコメントアウトせず残す
  PROJECT_DELETED = 'project-deleted',
  PROJECT_REMOVED = 'project-removed',
  PROJECT_UPDATED = 'project-updated', // プロジェクト関連の標準イベント
  PROJECT_PATH_UPDATED = 'project-path-updated', // 他のファイルで参照されているため残す
  PHASE_COMPLETED = 'phase-completed',

  // 環境変数関連イベント
  ENV_VARIABLES_UPDATED = 'env-variables-updated',
  ENV_FILE_CREATED = 'env-file-created',
  SCOPE_PROGRESS_UPDATED = 'scope-progress-updated',
  CURRENT_STATUS_UPDATED = 'current-status-updated', // 追加: 現在のステータス更新イベント

  // ClaudeCode関連イベント
  CLAUDE_CODE_STARTED = 'claude-code-started',
  CLAUDE_CODE_PROGRESS = 'claude-code-progress',
  CLAUDE_CODE_COMPLETED = 'claude-code-completed',
  CLAUDE_CODE_ERROR = 'claude-code-error',
  CLAUDE_CODE_STOPPED = 'claude-code-stopped',
  CLAUDE_CODE_LAUNCH_COUNTED = 'claude-code-launch-counted',

  // タブ関連イベント
  PROJECT_CHANGED = 'project-changed', // 追加: プロジェクト変更イベント
  TAB_CONTENT_UPDATED = 'tab-content-updated' // 追加: タブ内容更新イベント
}

/**
 * プロジェクト関連のイベントペイロード型定義
 * 全てのプロジェクト関連イベントで標準化された共通形式
 */
export interface ProjectEventPayload {
  id?: string;           // プロジェクトID
  path?: string;         // プロジェクトパス
  name?: string;         // プロジェクト名
  metadata?: {           // プロジェクトメタデータ
    activeTab?: string;  // アクティブタブID
    [key: string]: any;  // その他のメタデータ
  };        
  type: 'created' | 'selected' | 'updated' | 'removed'; // アクションタイプ
  timestamp?: number;    // イベント発生時刻
  tabId?: string;        // タブ状態更新時のタブID
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
   * プロジェクト関連イベントを発行する標準化されたヘルパーメソッド
   * PROJECT_UPDATEDイベントのみを発行するよう最適化されています
   * 
   * @param projectData プロジェクト情報ペイロード
   * @param source イベント発生元
   * @param legacyEvents 後方互換性のために古いイベントも発行するかどうか
   */
  public emitProjectEvent(
    projectData: ProjectEventPayload, 
    source: string,
    legacyEvents: boolean = false
  ): void {
    // タイムスタンプが指定されていない場合は現在時刻を設定
    if (!projectData.timestamp) {
      projectData.timestamp = Date.now();
    }
    
    // 主要な標準イベントを発行
    this.emit(
      AppGeniusEventType.PROJECT_UPDATED,
      projectData,
      source,
      projectData.id
    );
    
    // 後方互換性のために古いイベントも発行（オプション）
    if (legacyEvents && projectData.type) {
      // アクションタイプに基づいて適切なレガシーイベントタイプを選択
      let legacyType: AppGeniusEventType | null = null;
      
      switch (projectData.type) {
        case 'created':
          legacyType = AppGeniusEventType.PROJECT_CREATED;
          break;
        case 'removed':
          legacyType = AppGeniusEventType.PROJECT_REMOVED;
          break;
      }
      
      // レガシーイベントタイプが選択された場合のみ発行
      if (legacyType) {
        this.emit(
          legacyType,
          projectData,
          source,
          projectData.id
        );
      }
    }
    
    Logger.debug(`標準化されたプロジェクトイベント(${projectData.type || 'updated'})を発行: ${projectData.name}, ${projectData.path} from ${source}`);
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