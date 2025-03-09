import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { Logger } from './logger';
import { ToolkitManager } from './ToolkitManager';
import { PlatformManager } from './PlatformManager';

/**
 * ツールキット更新のステータス
 */
export enum UpdateStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * ツールキット更新の結果
 */
export interface UpdateResult {
  status: UpdateStatus;
  componentResults: Record<string, {
    success: boolean;
    message: string;
    version?: string;
  }>;
  errorMessage?: string;
}

/**
 * ツールキット更新サービス
 * コアコンポーネントとダッシュボードの更新を担当する
 */
export class ToolkitUpdater {
  private static instance: ToolkitUpdater;
  private _status: UpdateStatus = UpdateStatus.NOT_STARTED;
  private _lastUpdateResult: UpdateResult | null = null;
  private _toolkitManager: ToolkitManager;
  private _platformManager: PlatformManager;

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ToolkitUpdater {
    if (!ToolkitUpdater.instance) {
      ToolkitUpdater.instance = new ToolkitUpdater();
    }
    return ToolkitUpdater.instance;
  }

  /**
   * コンストラクタ
   */
  private constructor() {
    this._toolkitManager = ToolkitManager.getInstance();
    this._platformManager = PlatformManager.getInstance();
    
    // バージョン更新ハンドラーを登録
    this._registerUpdateHandlers();
  }

  /**
   * 更新メカニズムをセットアップ（VSCode拡張のアクティベーション時に呼び出し）
   */
  public setup(): void {
    try {
      // コンポーネントの検証と初期化
      this._validateComponents();
      
      // ダッシュボード生成確認
      this._ensureDashboardExists();
      
      Logger.info('ツールキット更新サービスをセットアップしました');
    } catch (error) {
      Logger.error('ツールキット更新サービスのセットアップに失敗しました', error as Error);
    }
  }

  /**
   * 更新ハンドラーを登録
   */
  private _registerUpdateHandlers(): void {
    // 各コンポーネントの更新ハンドラーを登録
    
    // ClaudeCodeLauncherService
    this._toolkitManager.registerVersionUpdateHandler(
      'ClaudeCodeLauncherService',
      this._updateClaudeCodeLauncherService.bind(this)
    );
    
    // ScopeManagerPanel
    this._toolkitManager.registerVersionUpdateHandler(
      'ScopeManagerPanel',
      this._updateScopeManagerPanel.bind(this)
    );
    
    // EnvironmentVariablesAssistantPanel
    this._toolkitManager.registerVersionUpdateHandler(
      'EnvironmentVariablesAssistantPanel',
      this._updateEnvironmentVariablesAssistantPanel.bind(this)
    );
    
    // DebugDetectivePanel
    this._toolkitManager.registerVersionUpdateHandler(
      'DebugDetectivePanel',
      this._updateDebugDetectivePanel.bind(this)
    );
    
    // 統合ポイント更新
    this._toolkitManager.registerVersionUpdateHandler(
      'IntegrationPoints',
      this._updateIntegrationPoints.bind(this)
    );
  }

  /**
   * ツールキットの全コンポーネントを検証
   */
  private _validateComponents(): void {
    const components = this._toolkitManager.getAllComponents();
    
    for (const component of components) {
      const filePath = path.join(this._platformManager.getExtensionPath(), component.path);
      
      if (!fs.existsSync(filePath)) {
        Logger.warn(`コンポーネントファイルが見つかりません: ${component.id} (${filePath})`);
      } else {
        Logger.info(`コンポーネント検証OK: ${component.id}`);
      }
    }
  }

  /**
   * ダッシュボードファイルの存在確認
   */
  private _ensureDashboardExists(): void {
    const dashboardPath = path.join(this._platformManager.getExtensionPath(), 'toolkit-dashboard.html');
    
    if (!fs.existsSync(dashboardPath)) {
      Logger.info('ダッシュボードファイルが存在しないため作成します');
      this._toolkitManager.updateDashboard();
    }
  }

  /**
   * ツールキット全体を更新
   */
  public async updateToolkit(): Promise<UpdateResult> {
    try {
      // 既に更新中の場合はスキップ
      if (this._status === UpdateStatus.IN_PROGRESS) {
        throw new Error('既に更新が進行中です');
      }

      this._status = UpdateStatus.IN_PROGRESS;
      
      // 初期化
      const result: UpdateResult = {
        status: UpdateStatus.IN_PROGRESS,
        componentResults: {}
      };
      
      // 各コンポーネントを更新
      const components = this._toolkitManager.getAllComponents();
      
      // 進捗通知
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ツールキットを更新中',
          cancellable: false
        },
        async (progress) => {
          const totalSteps = components.length + 2; // コンポーネント + ダッシュボード + 統合ポイント
          let currentStep = 0;
          
          try {
            // 各コンポーネントを更新
            for (const component of components) {
              progress.report({ 
                message: `コンポーネントを更新中: ${component.name}`,
                increment: (1 / totalSteps) * 100
              });
              
              try {
                const updateHandler = this._getComponentUpdateHandler(component.id);
                if (updateHandler) {
                  const success = await updateHandler();
                  
                  result.componentResults[component.id] = {
                    success,
                    message: success ? '更新成功' : '更新失敗',
                    version: component.version
                  };
                } else {
                  result.componentResults[component.id] = {
                    success: false,
                    message: '更新ハンドラーがありません',
                    version: component.version
                  };
                }
              } catch (error) {
                Logger.error(`コンポーネント更新エラー: ${component.id}`, error as Error);
                
                result.componentResults[component.id] = {
                  success: false,
                  message: `エラー: ${(error as Error).message}`,
                  version: component.version
                };
              }
              
              currentStep++;
            }
            
            // 統合ポイントを更新
            progress.report({ 
              message: '統合ポイントを更新中',
              increment: (1 / totalSteps) * 100
            });
            
            const integrationSuccess = await this._updateIntegrationPoints();
            result.componentResults['IntegrationPoints'] = {
              success: integrationSuccess,
              message: integrationSuccess ? '更新成功' : '更新失敗'
            };
            
            currentStep++;
            
            // ダッシュボードを更新
            progress.report({ 
              message: 'ダッシュボードを更新中',
              increment: (1 / totalSteps) * 100
            });
            
            const dashboardSuccess = await this._toolkitManager.updateDashboard();
            result.componentResults['Dashboard'] = {
              success: dashboardSuccess,
              message: dashboardSuccess ? '更新成功' : '更新失敗'
            };
            
            // 完了
            progress.report({ 
              message: '更新完了',
              increment: 100 - ((currentStep / totalSteps) * 100)
            });
            
            // 結果の集計
            const failures = Object.values(result.componentResults).filter(r => !r.success);
            if (failures.length === 0) {
              result.status = UpdateStatus.COMPLETED;
            } else {
              result.status = UpdateStatus.FAILED;
              result.errorMessage = `${failures.length}個のコンポーネントで更新に失敗しました`;
            }
          } catch (error) {
            result.status = UpdateStatus.FAILED;
            result.errorMessage = (error as Error).message;
          }
          
          this._status = result.status;
          this._lastUpdateResult = result;
          
          return result;
        }
      );
      
      return result;
    } catch (error) {
      this._status = UpdateStatus.FAILED;
      
      const result: UpdateResult = {
        status: UpdateStatus.FAILED,
        componentResults: {},
        errorMessage: (error as Error).message
      };
      
      this._lastUpdateResult = result;
      return result;
    }
  }

  /**
   * コンポーネント更新ハンドラーを取得
   */
  private _getComponentUpdateHandler(componentId: string): (() => Promise<boolean>) | null {
    switch (componentId) {
      case 'ClaudeCodeLauncherService':
        return this._updateClaudeCodeLauncherService.bind(this);
      case 'ScopeManagerPanel':
        return this._updateScopeManagerPanel.bind(this);
      case 'EnvironmentVariablesAssistantPanel':
        return this._updateEnvironmentVariablesAssistantPanel.bind(this);
      case 'DebugDetectivePanel':
        return this._updateDebugDetectivePanel.bind(this);
      default:
        return null;
    }
  }

  /**
   * ClaudeCodeLauncherServiceを更新
   */
  private async _updateClaudeCodeLauncherService(): Promise<boolean> {
    try {
      // ファイルパスを取得
      const component = this._toolkitManager.getComponent('ClaudeCodeLauncherService');
      if (!component) {
        throw new Error('コンポーネント情報が見つかりません');
      }
      
      const filePath = path.join(this._platformManager.getExtensionPath(), component.path);
      
      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルの内容を解析（バージョン情報などを抽出）
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 依存関係を抽出
      const dependencies = this._extractDependencies(content);
      
      // バージョン情報を更新
      component.dependencies = dependencies;
      component.lastUpdated = new Date().toISOString().split('T')[0];
      
      // コンポーネント情報を更新
      this._toolkitManager.updateComponent(component);
      
      Logger.info(`ClaudeCodeLauncherServiceを更新しました: ${component.version}`);
      return true;
    } catch (error) {
      Logger.error('ClaudeCodeLauncherService更新エラー:', error as Error);
      return false;
    }
  }

  /**
   * ScopeManagerPanelを更新
   */
  private async _updateScopeManagerPanel(): Promise<boolean> {
    try {
      // ファイルパスを取得
      const component = this._toolkitManager.getComponent('ScopeManagerPanel');
      if (!component) {
        throw new Error('コンポーネント情報が見つかりません');
      }
      
      const filePath = path.join(this._platformManager.getExtensionPath(), component.path);
      
      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルの内容を解析（バージョン情報などを抽出）
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 依存関係を抽出
      const dependencies = this._extractDependencies(content);
      
      // バージョン情報を更新
      component.dependencies = dependencies;
      component.lastUpdated = new Date().toISOString().split('T')[0];
      
      // コンポーネント情報を更新
      this._toolkitManager.updateComponent(component);
      
      Logger.info(`ScopeManagerPanelを更新しました: ${component.version}`);
      return true;
    } catch (error) {
      Logger.error('ScopeManagerPanel更新エラー:', error as Error);
      return false;
    }
  }

  /**
   * EnvironmentVariablesAssistantPanelを更新
   */
  private async _updateEnvironmentVariablesAssistantPanel(): Promise<boolean> {
    try {
      // ファイルパスを取得
      const component = this._toolkitManager.getComponent('EnvironmentVariablesAssistantPanel');
      if (!component) {
        throw new Error('コンポーネント情報が見つかりません');
      }
      
      const filePath = path.join(this._platformManager.getExtensionPath(), component.path);
      
      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルの内容を解析（バージョン情報などを抽出）
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 依存関係を抽出
      const dependencies = this._extractDependencies(content);
      
      // バージョン情報を更新
      component.dependencies = dependencies;
      component.lastUpdated = new Date().toISOString().split('T')[0];
      
      // コンポーネント情報を更新
      this._toolkitManager.updateComponent(component);
      
      Logger.info(`EnvironmentVariablesAssistantPanelを更新しました: ${component.version}`);
      return true;
    } catch (error) {
      Logger.error('EnvironmentVariablesAssistantPanel更新エラー:', error as Error);
      return false;
    }
  }

  /**
   * DebugDetectivePanelを更新
   */
  private async _updateDebugDetectivePanel(): Promise<boolean> {
    try {
      // ファイルパスを取得
      const component = this._toolkitManager.getComponent('DebugDetectivePanel');
      if (!component) {
        throw new Error('コンポーネント情報が見つかりません');
      }
      
      const filePath = path.join(this._platformManager.getExtensionPath(), component.path);
      
      // ファイルの存在確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルの内容を解析（バージョン情報などを抽出）
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 依存関係を抽出
      const dependencies = this._extractDependencies(content);
      
      // バージョン情報を更新
      component.dependencies = dependencies;
      component.lastUpdated = new Date().toISOString().split('T')[0];
      
      // コンポーネント情報を更新
      this._toolkitManager.updateComponent(component);
      
      Logger.info(`DebugDetectivePanelを更新しました: ${component.version}`);
      return true;
    } catch (error) {
      Logger.error('DebugDetectivePanel更新エラー:', error as Error);
      return false;
    }
  }

  /**
   * 統合ポイントを更新
   */
  private async _updateIntegrationPoints(): Promise<boolean> {
    try {
      // 各統合ポイントの状態を確認
      const integrationPoints = this._toolkitManager.getAllIntegrationPoints();
      
      let success = true;
      
      for (const point of integrationPoints) {
        try {
          const filePath = path.join(this._platformManager.getExtensionPath(), point.path);
          
          // ファイルの存在確認
          if (!fs.existsSync(filePath)) {
            Logger.warn(`統合ポイントファイルが見つかりません: ${point.id} (${filePath})`);
            continue;
          }
          
          // ファイルの最終更新日を取得
          const stats = fs.statSync(filePath);
          const lastModified = stats.mtime.toISOString().split('T')[0];
          
          // 更新日が異なる場合は更新
          if (lastModified !== point.lastUpdated) {
            point.lastUpdated = lastModified;
            this._toolkitManager.updateIntegrationPoint(point);
            Logger.info(`統合ポイントの更新日を更新しました: ${point.id} (${lastModified})`);
          }
        } catch (error) {
          Logger.error(`統合ポイント更新エラー: ${point.id}`, error as Error);
          success = false;
        }
      }
      
      return success;
    } catch (error) {
      Logger.error('統合ポイント更新エラー:', error as Error);
      return false;
    }
  }

  /**
   * TypeScriptファイルから依存関係を抽出
   */
  private _extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // importパターンを検出
    const imports = content.match(/import\s+{[^}]+}\s+from\s+['"]([^'"]+)['"]/g) || [];
    
    for (const importLine of imports) {
      // モジュール名を抽出
      const match = importLine.match(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/);
      if (match) {
        const importedItems = match[1].split(',').map(item => item.trim());
        const modulePath = match[2];
        
        // 相対パスの場合は、ファイル名部分を抽出
        if (modulePath.startsWith('.')) {
          const filename = path.basename(modulePath);
          const serviceName = this._extractServiceNameFromPath(filename);
          if (serviceName) {
            dependencies.push(serviceName);
          }
        } else {
          // 外部モジュールの場合はそのまま追加
          dependencies.push(modulePath);
        }
      }
    }
    
    // 重複を削除して返す
    return [...new Set(dependencies)];
  }

  /**
   * パスからサービス名を抽出
   */
  private _extractServiceNameFromPath(filename: string): string | null {
    // .tsや.jsを削除
    filename = filename.replace(/\.(ts|js)$/, '');
    
    // ServiceやManagerで終わるファイル名からサービス名を抽出
    if (filename.endsWith('Service') || filename.endsWith('Manager')) {
      return filename;
    }
    
    // Panelで終わるファイル名からパネル名を抽出
    if (filename.endsWith('Panel')) {
      return filename;
    }
    
    return null;
  }

  /**
   * 更新状態を取得
   */
  public getStatus(): UpdateStatus {
    return this._status;
  }

  /**
   * 最後の更新結果を取得
   */
  public getLastUpdateResult(): UpdateResult | null {
    return this._lastUpdateResult;
  }
}