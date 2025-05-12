import * as vscode from 'vscode';
import { NoProjectViewPanel } from '../../ui/noProjectView/NoProjectViewPanel';
import { ScopeManagerPanel } from '../../ui/scopeManager/ScopeManagerPanel';
import { Logger } from '../../utils/logger';
import { EventEmitter } from 'events';

/**
 * プロジェクト状態管理サービス
 * アプリケーション全体のプロジェクト状態を管理し、
 * 適切なビュー（プロジェクトビューorプロジェクト選択画面）を表示する
 */
export class ProjectStateService {
  private static _instance: ProjectStateService;
  private _context: vscode.ExtensionContext;
  private _hasActiveProject: boolean = false;
  private _activeProjectPath: string | undefined;
  
  // イベントエミッター
  private _onProjectStateChanged = new vscode.EventEmitter<boolean>();
  public readonly onProjectStateChanged = this._onProjectStateChanged.event;

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(context?: vscode.ExtensionContext): ProjectStateService {
    if (!ProjectStateService._instance) {
      if (!context) {
        throw new Error('ProjectStateService初期化時にはExtensionContextが必要です');
      }
      ProjectStateService._instance = new ProjectStateService(context);
    }
    return ProjectStateService._instance;
  }

  /**
   * コンストラクタ
   */
  private constructor(context: vscode.ExtensionContext) {
    this._context = context;
    Logger.info('ProjectStateService: 初期化されました');
  }

  /**
   * 現在アクティブなプロジェクトがあるかチェック
   * @returns アクティブなプロジェクトがあるかどうか
   */
  public async checkActiveProject(): Promise<boolean> {
    try {
      Logger.info('ProjectStateService: アクティブプロジェクトをチェックします');

      // まず ProjectManagementService から最新の情報を取得
      try {
        // ProjectServiceImpl を使ってアクティブプロジェクトを確認
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ProjectServiceImpl } = require('../../ui/scopeManager/services/implementations/ProjectServiceImpl');
        const projectService = ProjectServiceImpl.getInstance();

        const activeProject = projectService.getActiveProject();
        if (activeProject && activeProject.path) {
          // ProjectServiceImpl から有効なアクティブプロジェクトが見つかった場合はそれを使用
          this._hasActiveProject = true;
          this._activeProjectPath = activeProject.path;

          Logger.info(`ProjectStateService: ProjectServiceImpl から取得したアクティブプロジェクト - パス=${this._activeProjectPath}`);

          // 設定にも保存
          await vscode.workspace.getConfiguration('appgenius').update('currentProjectPath', this._activeProjectPath, true);

          return true;
        }

        Logger.debug('ProjectStateService: ProjectServiceImpl からアクティブプロジェクトが見つかりませんでした');
      } catch (error) {
        // エラーはスキップして設定から読み込む方法に進む
        Logger.debug(`ProjectStateService: ProjectServiceImpl からの取得中にエラー: ${error}`);
      }

      // 設定から現在のプロジェクトパスを取得
      const projectPath = vscode.workspace.getConfiguration('appgenius').get<string>('currentProjectPath');

      // 詳細なデバッグログ
      Logger.debug(`ProjectStateService: 設定から取得したプロジェクトパス=${projectPath}`);
      Logger.debug(`ProjectStateService: プロジェクトパスのタイプ=${typeof projectPath}`);
      Logger.debug(`ProjectStateService: プロジェクトパスが存在するか=${!!projectPath}`);

      if (projectPath) {
        Logger.debug(`ProjectStateService: プロジェクトパスの長さ=${projectPath.length}`);

        // シンプル化: パスがあるだけで有効なプロジェクトとして扱う
        this._hasActiveProject = true;
        this._activeProjectPath = projectPath;

        Logger.info(`ProjectStateService: プロジェクトパスが存在するためアクティブとします: ${projectPath}`);
        return true;
      }

      // プロジェクトパスが存在しない場合
      this._hasActiveProject = false;
      this._activeProjectPath = undefined;

      Logger.info(`ProjectStateService: アクティブプロジェクトの状態=${this._hasActiveProject}, パス=${this._activeProjectPath || 'なし'}`);

      return false;
    } catch (error) {
      Logger.error('ProjectStateService: アクティブプロジェクトのチェック中にエラーが発生しました', error as Error);
      return false;
    }
  }

  /**
   * 適切なビューを表示
   * プロジェクトの存在に応じて、NoProjectViewPanelまたはScopeManagerPanelを表示
   */
  public async showAppropriateView(): Promise<void> {
    try {
      Logger.info('ProjectStateService: 適切なビューを表示します');

      // プロジェクト存在チェック
      const hasProject = await this.checkActiveProject();

      // 詳細なデバッグログ
      Logger.debug(`ProjectStateService: showAppropriateView - hasProject=${hasProject}`);
      Logger.debug(`ProjectStateService: showAppropriateView - _hasActiveProject=${this._hasActiveProject}`);
      Logger.debug(`ProjectStateService: showAppropriateView - _activeProjectPath=${this._activeProjectPath || 'なし'}`);
      Logger.debug(`ProjectStateService: showAppropriateView - NoProjectViewPanel.currentPanel=${!!NoProjectViewPanel.currentPanel}`);
      Logger.debug(`ProjectStateService: showAppropriateView - ScopeManagerPanel.currentPanel=${!!ScopeManagerPanel.currentPanel}`);

      if (hasProject) {
        Logger.info('ProjectStateService: アクティブなプロジェクトが存在するため、スコープマネージャーを表示します');

        // プロジェクトが存在する場合はScopeManagerを表示
        ScopeManagerPanel.createOrShow(this._context.extensionUri, this._context);

        // NoProjectViewが開いていれば閉じる
        if (NoProjectViewPanel.currentPanel) {
          Logger.info('ProjectStateService: NoProjectViewPanelを閉じます');
          NoProjectViewPanel.currentPanel.dispose();
        }
      } else {
        Logger.info('ProjectStateService: アクティブなプロジェクトが存在しないため、プロジェクト選択画面を表示します');

        // ScopeManagerが開いていれば閉じる
        if (ScopeManagerPanel.currentPanel) {
          Logger.info('ProjectStateService: ScopeManagerPanelを閉じます');
          ScopeManagerPanel.currentPanel.dispose();
        }

        // 少し遅延させてからNoProjectViewを表示（パネル切り替えのタイミング問題を回避）
        setTimeout(() => {
          Logger.info('ProjectStateService: NoProjectViewPanelを表示します');
          // プロジェクトが存在しない場合はNoProjectViewを表示
          NoProjectViewPanel.createOrShow(this._context.extensionUri);
        }, 100);
      }
    } catch (error) {
      Logger.error('ProjectStateService: 適切なビュー表示中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`適切なビューの表示に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト作成後の処理
   * @param projectPath 作成されたプロジェクトのパス
   */
  public async onProjectCreated(projectPath: string): Promise<void> {
    try {
      Logger.info(`ProjectStateService: プロジェクト作成後の処理を実行: パス=${projectPath}`);
      
      this._hasActiveProject = true;
      this._activeProjectPath = projectPath;
      
      // 設定に現在のプロジェクトパスを保存
      await vscode.workspace.getConfiguration('appgenius').update('currentProjectPath', projectPath, true);
      
      // プロジェクト状態変更イベントを発行
      this._onProjectStateChanged.fire(true);
      
      // NoProjectViewを閉じる
      if (NoProjectViewPanel.currentPanel) {
        NoProjectViewPanel.currentPanel.dispose();
      }
      
      // ScopeManagerを表示
      ScopeManagerPanel.createOrShow(this._context.extensionUri, this._context);
      
      Logger.info(`ProjectStateService: プロジェクト作成後の処理が完了しました: パス=${projectPath}`);
    } catch (error) {
      Logger.error('ProjectStateService: プロジェクト作成後の処理中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`プロジェクト作成後の処理に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト読み込み後の処理
   * @param projectPath 読み込まれたプロジェクトのパス
   */
  public async onProjectLoaded(projectPath: string): Promise<void> {
    try {
      Logger.info(`ProjectStateService: プロジェクト読み込み後の処理を実行: パス=${projectPath}`);
      
      this._hasActiveProject = true;
      this._activeProjectPath = projectPath;
      
      // 設定に現在のプロジェクトパスを保存
      await vscode.workspace.getConfiguration('appgenius').update('currentProjectPath', projectPath, true);
      
      // プロジェクト状態変更イベントを発行
      this._onProjectStateChanged.fire(true);
      
      // NoProjectViewを閉じる
      if (NoProjectViewPanel.currentPanel) {
        NoProjectViewPanel.currentPanel.dispose();
      }
      
      // ScopeManagerを表示
      ScopeManagerPanel.createOrShow(this._context.extensionUri, this._context);
      
      Logger.info(`ProjectStateService: プロジェクト読み込み後の処理が完了しました: パス=${projectPath}`);
    } catch (error) {
      Logger.error('ProjectStateService: プロジェクト読み込み後の処理中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`プロジェクト読み込み後の処理に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクトを閉じた後の処理
   */
  public async onProjectClosed(): Promise<void> {
    try {
      Logger.info(`ProjectStateService: プロジェクトを閉じた後の処理を実行`);
      
      this._hasActiveProject = false;
      this._activeProjectPath = undefined;
      
      // 設定から現在のプロジェクトパスを削除
      await vscode.workspace.getConfiguration('appgenius').update('currentProjectPath', undefined, true);
      
      // プロジェクト状態変更イベントを発行
      this._onProjectStateChanged.fire(false);
      
      // ScopeManagerを閉じる
      if (ScopeManagerPanel.currentPanel) {
        ScopeManagerPanel.currentPanel.dispose();
      }
      
      // NoProjectViewを表示
      NoProjectViewPanel.createOrShow(this._context.extensionUri);
      
      Logger.info(`ProjectStateService: プロジェクトを閉じた後の処理が完了しました`);
    } catch (error) {
      Logger.error('ProjectStateService: プロジェクトを閉じた後の処理中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`プロジェクトを閉じた後の処理に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 現在アクティブなプロジェクトパスを取得
   */
  public getActiveProjectPath(): string | undefined {
    return this._activeProjectPath;
  }

  /**
   * 現在プロジェクトがアクティブか確認
   */
  public hasActiveProject(): boolean {
    return this._hasActiveProject;
  }

  /**
   * リソースを破棄
   */
  public dispose(): void {
    this._onProjectStateChanged.dispose();
  }
}