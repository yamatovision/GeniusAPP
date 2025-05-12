import * as vscode from 'vscode';
import * as fs from 'fs';
import { Logger } from '../../../../utils/logger';
import { IMessageHandler } from './types';
import { IProjectService } from '../interfaces/IProjectService';

/**
 * プロジェクト関連メッセージを処理するハンドラー
 */
export class ProjectMessageHandler implements IMessageHandler {
  private readonly _projectService: IProjectService;

  // 処理可能なコマンドリスト
  private static readonly COMMANDS = [
    'initialize',
    'selectProject',
    'loadExistingProject',
    'createProject',
    'removeProject',
    'refreshProjectsList'
  ];

  /**
   * コンストラクタ
   * @param projectService プロジェクトサービス
   */
  constructor(projectService: IProjectService) {
    this._projectService = projectService;
  }

  /**
   * このハンドラーで処理可能なコマンドかを判定
   * @param command コマンド名
   * @returns 処理可能な場合はtrue
   */
  public canHandle(command: string): boolean {
    return ProjectMessageHandler.COMMANDS.includes(command);
  }

  /**
   * メッセージを処理
   * @param message メッセージオブジェクト
   * @param panel WebviewPanel
   * @param context コンテキスト情報
   * @returns 処理が成功した場合はtrue
   */
  public async handleMessage(
    message: any,
    panel: vscode.WebviewPanel,
    context: any
  ): Promise<boolean> {
    switch (message.command) {
      case 'initialize':
        await this._handleInitialize(panel, context);
        return true;

      case 'selectProject':
        if (message.projectName && message.projectPath) {
          await this._handleSelectProject(
            panel,
            context,
            message.projectName,
            message.projectPath,
            message.activeTab
          );
          return true;
        }
        context.showError('プロジェクト選択に必要な情報が不足しています');
        return true;

      case 'loadExistingProject':
        await this._handleLoadExistingProject(panel, context);
        return true;

      case 'createProject':
        if (message.projectName) {
          await this._handleCreateProject(panel, context, message.projectName, message.description);
          return true;
        }
        context.showError('プロジェクトの作成に必要な情報が不足しています');
        return true;

      case 'removeProject':
        if (message.projectName && message.projectPath) {
          await this._handleRemoveProject(panel, context, message.projectName, message.projectPath, message.projectId);
          return true;
        }
        context.showError('プロジェクトの削除に必要な情報が不足しています');
        return true;

      case 'refreshProjectsList':
        await this._handleRefreshProjectsList(panel);
        return true;
    }

    return false;
  }

  /**
   * 初期化処理
   */
  private async _handleInitialize(panel: vscode.WebviewPanel, context: any): Promise<void> {
    try {
      Logger.info('ProjectMessageHandler: 初期化処理を開始');

      // 最新のプロジェクト一覧を取得して送信
      const allProjects = await this._projectService.refreshProjectsList();
      const activeProject = this._projectService.getActiveProject();

      panel.webview.postMessage({
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject ? {
          id: activeProject.id,
          name: activeProject.name,
          path: activeProject.path
        } : null
      });

      // アクティブタブ情報
      const activeTab = activeProject?.metadata?.activeTab || 'scope-progress';

      // 選択されたタブに応じた初期化実行
      if (activeTab === 'scope-progress' && context.progressFilePath && fs.existsSync(context.progressFilePath)) {
        // Scopeプログレスタブの初期化（実際の実装はScopeManagerPanelから移行する）
        // ここではMarkdownコンテンツの取得などの処理を行う
      }

      Logger.info('ProjectMessageHandler: 初期化処理完了');
    } catch (error) {
      Logger.error('初期化処理中にエラーが発生しました', error as Error);
      context.showError(`初期化に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト選択処理
   */
  private async _handleSelectProject(
    panel: vscode.WebviewPanel,
    context: any,
    projectName: string,
    projectPath: string,
    activeTab?: string
  ): Promise<void> {
    try {
      Logger.info(`ProjectMessageHandler: プロジェクト選択処理を開始 - ${projectName}`);
      
      // プロジェクトをアクティブに設定
      await this._projectService.selectProject(projectName, projectPath, activeTab);
      
      // UIを更新するためのメッセージを送信
      const allProjects = await this._projectService.getAllProjects();
      const activeProject = this._projectService.getActiveProject();
      
      panel.webview.postMessage({
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject ? {
          id: activeProject.id,
          name: activeProject.name,
          path: activeProject.path
        } : null
      });
      
      context.showSuccess(`プロジェクト "${projectName}" が選択されました`);
      Logger.info(`ProjectMessageHandler: プロジェクト選択処理完了 - ${projectName}`);
    } catch (error) {
      Logger.error(`プロジェクト選択中にエラーが発生しました: ${projectName}`, error as Error);
      context.showError(`プロジェクト選択に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 既存プロジェクトを読み込む処理
   */
  private async _handleLoadExistingProject(panel: vscode.WebviewPanel, context: any): Promise<void> {
    try {
      Logger.info('ProjectMessageHandler: 既存プロジェクトを読み込む処理を開始');
      
      // ユーザーにフォルダ選択ダイアログを表示
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        canSelectFiles: false,
        canSelectFolders: true,
        openLabel: '既存プロジェクトを選択'
      };
      
      const folderUri = await vscode.window.showOpenDialog(options);
      if (folderUri && folderUri.length > 0) {
        const projectPath = folderUri[0].fsPath;
        
        // プロジェクトを読み込む
        await this._projectService.loadExistingProject(projectPath);
        
        // プロジェクト一覧を更新
        const allProjects = await this._projectService.getAllProjects();
        const activeProject = this._projectService.getActiveProject();
        
        panel.webview.postMessage({
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject ? {
            id: activeProject.id,
            name: activeProject.name,
            path: activeProject.path
          } : null
        });
        
        context.showSuccess('プロジェクトを読み込みました');
      }
      
      Logger.info('ProjectMessageHandler: 既存プロジェクトを読み込む処理完了');
    } catch (error) {
      Logger.error('プロジェクト読み込み中にエラーが発生しました', error as Error);
      context.showError(`プロジェクト読み込みに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト作成処理
   */
  private async _handleCreateProject(
    panel: vscode.WebviewPanel,
    context: any,
    projectName: string,
    description?: string
  ): Promise<void> {
    try {
      Logger.info(`ProjectMessageHandler: プロジェクト作成処理を開始 - ${projectName}`);
      
      // ユーザーにフォルダ選択ダイアログを表示
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        canSelectFiles: false,
        canSelectFolders: true,
        openLabel: 'プロジェクトフォルダを選択'
      };
      
      const folderUri = await vscode.window.showOpenDialog(options);
      if (folderUri && folderUri.length > 0) {
        const projectPath = folderUri[0].fsPath;
        
        // プロジェクトを作成
        await this._projectService.createProject(projectName, description || '');
        
        // プロジェクト一覧を更新
        const allProjects = await this._projectService.getAllProjects();
        const activeProject = this._projectService.getActiveProject();
        
        panel.webview.postMessage({
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject ? {
            id: activeProject.id,
            name: activeProject.name,
            path: activeProject.path
          } : null
        });
        
        context.showSuccess(`プロジェクト "${projectName}" を作成しました`);
      }
      
      Logger.info(`ProjectMessageHandler: プロジェクト作成処理完了 - ${projectName}`);
    } catch (error) {
      Logger.error(`プロジェクト作成中にエラーが発生しました: ${projectName}`, error as Error);
      context.showError(`プロジェクト作成に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト削除処理
   */
  private async _handleRemoveProject(
    panel: vscode.WebviewPanel,
    context: any,
    projectName: string,
    projectPath: string,
    projectId?: string
  ): Promise<void> {
    try {
      Logger.info(`ProjectMessageHandler: プロジェクト削除処理を開始 - ${projectName}`);
      
      // 削除の確認
      const confirmation = await vscode.window.showWarningMessage(
        `プロジェクト "${projectName}" をリストから削除しますか？ファイルは削除されません。`,
        { modal: true },
        '削除'
      );
      
      if (confirmation === '削除') {
        // プロジェクトを削除
        await this._projectService.removeProject(projectName, projectPath, projectId);
        
        // プロジェクト一覧を更新
        const allProjects = await this._projectService.getAllProjects();
        const activeProject = this._projectService.getActiveProject();
        
        panel.webview.postMessage({
          command: 'updateProjects',
          projects: allProjects,
          activeProject: activeProject ? {
            id: activeProject.id,
            name: activeProject.name,
            path: activeProject.path
          } : null
        });
        
        context.showSuccess(`プロジェクト "${projectName}" をリストから削除しました`);
      }
      
      Logger.info(`ProjectMessageHandler: プロジェクト削除処理完了 - ${projectName}`);
    } catch (error) {
      Logger.error(`プロジェクト削除中にエラーが発生しました: ${projectName}`, error as Error);
      context.showError(`プロジェクト削除に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト一覧更新処理
   */
  private async _handleRefreshProjectsList(panel: vscode.WebviewPanel): Promise<void> {
    try {
      Logger.info('ProjectMessageHandler: プロジェクト一覧更新処理を開始');
      
      // プロジェクト一覧を更新
      const allProjects = await this._projectService.refreshProjectsList();
      const activeProject = this._projectService.getActiveProject();
      
      panel.webview.postMessage({
        command: 'updateProjects',
        projects: allProjects,
        activeProject: activeProject ? {
          id: activeProject.id,
          name: activeProject.name,
          path: activeProject.path
        } : null
      });
      
      Logger.info('ProjectMessageHandler: プロジェクト一覧更新処理完了');
    } catch (error) {
      Logger.error('プロジェクト一覧の更新中にエラーが発生しました', error as Error);
      // エラーはUIに表示せず、ログのみ残す
    }
  }
}