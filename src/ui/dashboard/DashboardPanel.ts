import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { ProjectManagementService, Project } from '../../services/ProjectManagementService';
import { AppGeniusEventBus, AppGeniusEventType } from '../../services/AppGeniusEventBus';
import { AppGeniusStateManager } from '../../services/AppGeniusStateManager';
import { ProtectedPanel } from '../auth/ProtectedPanel';
import { Feature } from '../../core/auth/roles';

/**
 * ダッシュボードパネル
 * プロジェクト管理と機能選択のためのWebViewインターフェース
 * 権限保護されたパネルの基底クラスを継承
 */
export class DashboardPanel extends ProtectedPanel {
  public static currentPanel: DashboardPanel | undefined;
  private static readonly viewType = 'dashboard';
  // 必要な権限を指定
  protected static readonly _feature: Feature = Feature.DASHBOARD;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _aiService: AIService;
  private readonly _projectService: ProjectManagementService;
  private readonly _stateManager: AppGeniusStateManager;
  private readonly _eventBus: AppGeniusEventBus;
  private _disposables: vscode.Disposable[] = [];

  // 現在の作業状態
  private _currentProjects: Project[] = [];
  private _activeProject: Project | undefined;
  private _projectRequirements: any = {};
  private _projectMockups: any = {};
  private _projectScopes: any = {};

  /**
   * 実際のパネル作成・表示ロジック
   * ProtectedPanelから呼び出される
   */
  protected static _createOrShowPanel(extensionUri: vscode.Uri, aiService: AIService): DashboardPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      return DashboardPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      DashboardPanel.viewType,
      'AppGenius ダッシュボード',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist')
        ],
        enableFindWidget: true,
        enableCommandUris: true
        // WebViewオプションでsandboxを指定していましたが、現在のVSCode APIではサポートされていないため削除しました
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, aiService);
    return DashboardPanel.currentPanel;
  }
  
  /**
   * 外部向けのパネル作成・表示メソッド
   * 権限チェック付きで、パネルを表示する
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService): DashboardPanel | undefined {
    // 権限チェック
    if (!this.checkPermissionForFeature(Feature.DASHBOARD, 'DashboardPanel')) {
      return undefined;
    }
    
    // 権限があれば表示
    return this._createOrShowPanel(extensionUri, aiService);
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService) {
    super(); // 親クラスのコンストラクタを呼び出し
    
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._aiService = aiService;
    
    // サービスの初期化
    this._projectService = ProjectManagementService.getInstance();
    this._stateManager = AppGeniusStateManager.getInstance();
    this._eventBus = AppGeniusEventBus.getInstance();
    
    // データの初期化
    this._currentProjects = this._projectService.getAllProjects();
    this._activeProject = this._projectService.getActiveProject();

    // WebViewの内容を設定
    this._update();

    // パネルが破棄されたときのクリーンアップ
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // パネルの状態が変更されたときに更新
    this._panel.onDidChangeViewState(
      _e => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // WebViewからのメッセージを処理
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'createProject':
            await this._handleCreateProject(message.name, message.description);
            break;
          case 'openProject':
            await this._handleOpenProject(message.id);
            break;
          case 'deleteProject':
            await this._handleDeleteProject(message.id);
            break;
          case 'confirmDeleteProject':
            await this._handleConfirmDeleteProject(message.id, message.projectName);
            break;
          case 'updateProject':
            await this._handleUpdateProject(message.id, message.updates);
            break;
          case 'openRequirementsEditor':
            await this._handleOpenRequirementsEditor();
            break;
          case 'openMockupEditor':
            await this._handleOpenMockupEditor();
            break;
          case 'openImplementationSelector': // 古いコマンドも互換性のために残す
          case 'openScopeManager':
            await this._handleOpenScopeManager();
            break;
          // 開発アシスタントは削除済み
          case 'openDebugDetective':
            await this._handleOpenDebugDetective();
            break;
          case 'openEnvironmentVariablesAssistant':
            await this._handleOpenEnvironmentVariablesAssistant();
            break;
          case 'openReferenceManager':
            await this._handleOpenReferenceManager();
            break;
          case 'analyzeProject':
            await this._handleAnalyzeProject();
            break;
          case 'loadExistingProject':
            await this._handleLoadExistingProject();
            break;
          case 'refreshProjects':
            await this._refreshProjects();
            break;
          case 'showVSCodeMessage':
            await this._handleShowVSCodeMessage(message.type, message.message);
            break;
        }
      },
      null,
      this._disposables
    );

    // イベントリスナーの登録
    this._registerEventListeners();

    // 初期データをロード
    this._refreshProjects();
  }
  
  /**
   * イベントリスナーの登録
   */
  private _registerEventListeners(): void {
    // 要件定義更新イベント
    this._disposables.push(
      this._eventBus.onEventType(AppGeniusEventType.REQUIREMENTS_UPDATED, async (event) => {
        if (event.projectId) {
          Logger.debug(`Requirements updated for project: ${event.projectId}`);
          this._projectRequirements[event.projectId] = event.data;
          
          // 要件定義が更新されたら、モックアップギャラリーのロック解除を確認
          const project = this._projectService.getProject(event.projectId);
          if (project && project.path) {
            // モックアップフォルダの確認（要件定義更新時に再確認する）
            const hasMockupFiles = this._checkMockupFolderStatus(project.path, event.projectId);
            if (hasMockupFiles) {
              Logger.info(`要件定義更新によりモックアップギャラリーが利用可能になりました: ${event.projectId}`);
            }
          }
          
          // アクティブなプロジェクトの場合、UIを更新
          if (this._activeProject && this._activeProject.id === event.projectId) {
            await this._updateWebview();
          }
        }
      })
    );
    
    // モックアップ作成イベント
    this._disposables.push(
      this._eventBus.onEventType(AppGeniusEventType.MOCKUP_CREATED, async (event) => {
        if (event.projectId) {
          Logger.debug(`Mockup created for project: ${event.projectId}`);
          if (!this._projectMockups[event.projectId]) {
            this._projectMockups[event.projectId] = [];
          }
          
          // 重複を避けるために既存のものを削除
          const mockupId = event.data.id;
          const existingIndex = this._projectMockups[event.projectId]
            .findIndex((m: any) => m.id === mockupId);
          
          if (existingIndex >= 0) {
            this._projectMockups[event.projectId][existingIndex] = event.data;
          } else {
            this._projectMockups[event.projectId].push(event.data);
          }
          
          // モックアップ作成イベントが発生したら、HTMLファイルの有無を再確認
          const project = this._projectService.getProject(event.projectId);
          if (project && project.path) {
            // モックアップHTMLファイルの有無を確認し、UI更新のフラグを立てる
            this._checkMockupFolderStatus(project.path, event.projectId);
            Logger.info(`モックアップ作成イベントを検知: ${event.projectId}, ギャラリー表示を更新します`);
          }
          
          // アクティブなプロジェクトの場合、UIを更新
          if (this._activeProject && this._activeProject.id === event.projectId) {
            await this._updateWebview();
          }
        }
      })
    );
    
    // スコープ更新イベント
    this._disposables.push(
      this._eventBus.onEventType(AppGeniusEventType.SCOPE_UPDATED, async (event) => {
        if (event.projectId) {
          Logger.debug(`Scope updated for project: ${event.projectId}`);
          this._projectScopes[event.projectId] = event.data;
          
          // アクティブなプロジェクトの場合、UIを更新
          if (this._activeProject && this._activeProject.id === event.projectId) {
            await this._updateWebview();
          }
        }
      })
    );
    
    // 実装進捗イベント
    this._disposables.push(
      this._eventBus.onEventType(AppGeniusEventType.IMPLEMENTATION_PROGRESS, async (event) => {
        if (event.projectId && this._projectScopes[event.projectId]) {
          Logger.debug(`Implementation progress updated for project: ${event.projectId}`);
          
          // スコープの進捗を更新
          const scope = this._projectScopes[event.projectId];
          scope.items = event.data.items;
          scope.totalProgress = event.data.totalProgress;
          
          // アクティブなプロジェクトの場合、UIを更新
          if (this._activeProject && this._activeProject.id === event.projectId) {
            await this._updateWebview();
          }
        }
      })
    );
    
    // プロジェクト作成イベント
    this._disposables.push(
      this._eventBus.onEventType(AppGeniusEventType.PROJECT_CREATED, async () => {
        await this._refreshProjects();
      })
    );
    
    // プロジェクト削除イベント
    this._disposables.push(
      this._eventBus.onEventType(AppGeniusEventType.PROJECT_DELETED, async (event) => {
        const projectId = event.data?.id;
        if (projectId) {
          // 削除されたプロジェクトのデータをクリーンアップ
          delete this._projectRequirements[projectId];
          delete this._projectMockups[projectId];
          delete this._projectScopes[projectId];
          
          await this._refreshProjects();
        }
      })
    );
    
    // フェーズ完了イベント
    this._disposables.push(
      this._eventBus.onEventType(AppGeniusEventType.PHASE_COMPLETED, async () => {
        await this._refreshProjects();
      })
    );
  }

  /**
   * プロジェクト一覧を更新（簡略化版）
   */
  private async _refreshProjects(): Promise<void> {
    try {
      // 基本プロジェクト情報のみ取得して画面を更新（重い処理は避ける）
      this._currentProjects = this._projectService.getAllProjects();
      this._activeProject = this._projectService.getActiveProject();
      
      // 最低限のデータだけすぐに画面に表示
      await this._updateWebview();
      
      // ローディング状態を終了
      await this._panel.webview.postMessage({
        command: 'refreshComplete'
      });
      
      // 必要に応じて詳細データを別途バックグラウンドでロード
      if (this._activeProject) {
        // このメソッドは非同期だがawaitしない（UIをブロックしないため）
        this._loadProjectDetails(this._activeProject.id);
      }
    } catch (error) {
      Logger.error(`プロジェクト一覧更新エラー`, error as Error);
      await this._showError(`プロジェクト一覧の更新中にエラーが発生しました: ${(error as Error).message}`);
      
      // エラー時にもローディング状態を解除
      await this._panel.webview.postMessage({
        command: 'refreshComplete'
      });
    }
  }
  
  /**
   * プロジェクト詳細情報を非同期でバックグラウンドロード
   * UI応答性を維持するため、メインのレンダリング後に実行
   */
  /**
   * モックアップフォルダの状態をチェックする関数（一元管理のため抽出）
   * @param projectPath プロジェクトパス
   * @param projectId プロジェクトID
   * @returns モックアップHTMLファイルの有無
   */
  private _checkMockupFolderStatus(projectPath: string, projectId: string): boolean {
    let hasMockupFiles = false;
    
    try {
      const mockupsDir = path.join(projectPath, 'mockups');
      if (fs.existsSync(mockupsDir)) {
        const files = fs.readdirSync(mockupsDir);
        hasMockupFiles = files.some(file => file.endsWith('.html'));
        
        // 既存のactiveProjectDetailsがない場合は初期化
        if (!this._projectMockups[projectId]) {
          this._projectMockups[projectId] = [];
        }
      }
    } catch (err) {
      Logger.warn(`モックアップフォルダの確認中にエラー: ${(err as Error).message}`);
    }
    
    return hasMockupFiles;
  }

  private async _loadProjectDetails(projectId: string): Promise<void> {
    try {
      const project = this._projectService.getProject(projectId);
      if (!project) return;
      
      const projectPath = project.path;
      
      // 最低限必要なデータだけロード
      if (!(projectId in this._projectRequirements)) {
        try {
          const requirements = await this._stateManager.getRequirements(projectId);
          if (requirements) {
            this._projectRequirements[projectId] = requirements;
          } else {
            // 空のオブジェクトで初期化
            this._projectRequirements[projectId] = { 
              document: '', 
              sections: [], 
              extractedItems: [], 
              chatHistory: [] 
            };
          }
        } catch (e) {
          Logger.debug(`No requirements found for project: ${projectId}`);
        }
      }
      
      // スコープ情報がまだない場合のみロード
      if (!(projectId in this._projectScopes)) {
        try {
          const scope = await this._stateManager.getImplementationScope(projectId);
          if (scope) {
            this._projectScopes[projectId] = scope;
          } else {
            // 基本スコープデータで初期化
            this._projectScopes[projectId] = {
              items: [],
              selectedIds: [],
              estimatedTime: '',
              totalProgress: 0,
              startDate: new Date().toISOString().split('T')[0],
              targetDate: '',
              projectPath: projectPath || ''
            };
          }
        } catch (e) {
          Logger.debug(`No implementation scope found for project: ${projectId}`);
        }
      }

      // モックアップファイルの存在を初回ロード時だけ確認
      if (project.path) {
        // 抽出した関数を使用
        this._checkMockupFolderStatus(project.path, projectId);
      }
      
      // 詳細情報が読み込まれた後、UI更新（ロードインジケータは表示せずに更新）
      await this._updateWebview();
    } catch (error) {
      Logger.error(`プロジェクト詳細情報読み込みエラー: ${projectId}`, error as Error);
    }
  }

  /**
   * プロジェクト作成処理
   */
  private async _handleCreateProject(name: string, description: string): Promise<void> {
    try {
      if (!name) {
        throw new Error('プロジェクト名を入力してください');
      }

      // 常にフォルダ選択ダイアログを表示して保存先を選択させる
      const options: vscode.OpenDialogOptions = {
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: `プロジェクト「${name}」の保存先を選択`
      };
      
      const folderUri = await vscode.window.showOpenDialog(options);
      if (!folderUri || folderUri.length === 0) {
        throw new Error('プロジェクトの保存先が選択されていません');
      }
      
      // 選択されたフォルダに、プロジェクト名のサブフォルダを作成
      const projectPath = path.join(folderUri[0].fsPath, name);
      
      // プロジェクトを作成
      const projectId = await this._projectService.createProject({
        name,
        description: "",
        path: projectPath
      });

      // 作成したプロジェクトをアクティブに設定
      await this._projectService.setActiveProject(projectId);

      // データを更新
      await this._refreshProjects();

      // 成功メッセージを表示
      vscode.window.showInformationMessage(`プロジェクト「${name}」が作成されました: ${projectPath}`);
    } catch (error) {
      Logger.error(`プロジェクト作成エラー`, error as Error);
      await this._showError(`プロジェクトの作成に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクトオープン処理
   */
  private async _handleOpenProject(id: string): Promise<void> {
    try {
      // プロジェクトの存在確認
      const project = this._projectService.getProject(id);
      if (!project) {
        throw new Error(`プロジェクトが見つかりません: ${id}`);
      }

      // プロジェクトフォルダの存在確認
      if (!fs.existsSync(project.path)) {
        const message = `プロジェクトフォルダが見つかりません: ${project.path}`;
        Logger.error(message);
        
        // フォルダ選択ダイアログを表示
        const options: vscode.OpenDialogOptions = {
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: `プロジェクト「${project.name}」のフォルダを選択`
        };
        
        const folderUri = await vscode.window.showOpenDialog(options);
        if (!folderUri || folderUri.length === 0) {
          throw new Error('プロジェクトのフォルダパスを更新できませんでした');
        }
        
        // プロジェクトパスを更新（AppGeniusStateManagerを経由）
        const newPath = folderUri[0].fsPath;
        const stateManager = AppGeniusStateManager.getInstance();
        await stateManager.updateProjectPath(id, newPath);
        Logger.info(`プロジェクトパスを更新しました: ID=${id}, 新しいパス=${newPath}`);
        
        // 更新されたプロジェクト情報を取得
        const updatedProject = this._projectService.getProject(id);
        if (!updatedProject) {
          throw new Error(`プロジェクト情報の更新に失敗しました: ${id}`);
        }
        
        // 更新後のパスを使用
        project.path = updatedProject.path;
      }

      // CLAUDE.mdファイルの存在チェック - 存在しなくても続行するように変更
      const claudeMdPath = path.join(project.path, 'CLAUDE.md');
      if (!fs.existsSync(claudeMdPath)) {
        // ファイルが存在しないことをログに記録するだけで続行
        Logger.info(`CLAUDE.mdファイルが見つかりませんが、問題なく続行します: ${claudeMdPath}`);
      }

      // docs/mockupsディレクトリの存在確認
      const docsPath = path.join(project.path, 'docs');
      const mockupsPath = path.join(project.path, 'mockups');
      
      if (!fs.existsSync(docsPath)) {
        fs.mkdirSync(docsPath, { recursive: true });
        this._createInitialDocuments(project.path);
      }
      
      if (!fs.existsSync(mockupsPath)) {
        fs.mkdirSync(mockupsPath, { recursive: true });
      }

      // プロジェクトをアクティブに設定
      await this._projectService.setActiveProject(id);
      
      // プロジェクト選択イベントを発火
      this._eventBus.emit(
        AppGeniusEventType.PROJECT_SELECTED,
        { id, path: project.path, name: project.name },
        'DashboardPanel',
        id
      );
      
      Logger.info(`プロジェクト選択イベント発火: ID=${id}, パス=${project.path}`);

      // データを更新
      await this._refreshProjects();

      // 成功メッセージを表示
      vscode.window.showInformationMessage(`プロジェクト「${project.name}」を開きました`);
    } catch (error) {
      Logger.error(`プロジェクトオープンエラー: ${id}`, error as Error);
      await this._showError(`プロジェクトを開けませんでした: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト削除確認処理
   * WebViewから送信されたconfirmDeleteProjectメッセージを処理
   */
  private async _handleConfirmDeleteProject(id: string, projectName: string): Promise<void> {
    try {
      // VSCodeのネイティブな確認ダイアログを表示
      const answer = await vscode.window.showWarningMessage(
        `プロジェクト「${projectName}」を削除しますか？この操作は元に戻せません。`,
        { modal: true },
        'はい',
        'いいえ'
      );

      // ユーザーが「はい」を選択した場合のみ削除処理を実行
      if (answer === 'はい') {
        await this._handleDeleteProject(id);
      }
    } catch (error) {
      Logger.error(`プロジェクト削除確認エラー: ${id}`, error as Error);
      await this._showError(`プロジェクト削除確認中にエラーが発生しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト削除処理
   */
  private async _handleDeleteProject(id: string): Promise<void> {
    try {
      // プロジェクトの存在確認
      const project = this._projectService.getProject(id);
      if (!project) {
        throw new Error(`プロジェクトが見つかりません: ${id}`);
      }

      // プロジェクトを削除
      const success = await this._projectService.deleteProject(id);
      if (!success) {
        throw new Error('プロジェクトの削除に失敗しました');
      }

      // アクティブプロジェクトを更新
      if (this._activeProject && this._activeProject.id === id) {
        const projects = this._projectService.getAllProjects();
        if (projects.length > 0) {
          await this._projectService.setActiveProject(projects[0].id);
        }
      }

      // データを更新
      await this._refreshProjects();

      // 成功メッセージを表示
      vscode.window.showInformationMessage(`プロジェクト「${project.name}」が削除されました`);
    } catch (error) {
      Logger.error(`プロジェクト削除エラー: ${id}`, error as Error);
      await this._showError(`プロジェクトの削除に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト更新処理
   */
  private async _handleUpdateProject(id: string, updates: Partial<Project>): Promise<void> {
    try {
      // プロジェクトの存在確認
      const project = this._projectService.getProject(id);
      if (!project) {
        throw new Error(`プロジェクトが見つかりません: ${id}`);
      }

      // プロジェクトを更新
      await this._projectService.updateProject(id, updates);

      // データを更新
      await this._refreshProjects();

      // 成功メッセージを表示
      vscode.window.showInformationMessage(`プロジェクト「${project.name}」が更新されました`);
    } catch (error) {
      Logger.error(`プロジェクト更新エラー: ${id}`, error as Error);
      await this._showError(`プロジェクトの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 要件定義エディタを開く
   */
  private async _handleOpenRequirementsEditor(): Promise<void> {
    try {
      // アクティブなプロジェクトがあるか確認
      if (!this._activeProject) {
        throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
      }

      // プロジェクトのパスを取得
      const projectPath = this._activeProject.path;
      
      if (!projectPath) {
        throw new Error('プロジェクトパスが設定されていません。プロジェクト設定を確認してください。');
      }
      
      Logger.info(`要件定義エディタを開きます。プロジェクトパス: ${projectPath}`);

      // 先にメッセージを表示せずに直接コマンド実行
      // 要件定義エディタを開く（プロジェクトパスを引数として渡す）
      await vscode.commands.executeCommand('appgenius-ai.openSimpleChat', projectPath);
    } catch (error) {
      Logger.error(`要件定義エディタ起動エラー`, error as Error);
      await this._showError(`要件定義エディタの起動に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップギャラリーを開く
   */
  private async _handleOpenMockupEditor(): Promise<void> {
    try {
      // アクティブなプロジェクトがあるか確認
      if (!this._activeProject) {
        throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
      }

      // プロジェクトのパスを取得
      const projectPath = this._activeProject.path;
      
      // プロジェクトパスをパラメータとして渡してモックアップギャラリーを開く
      await vscode.commands.executeCommand('appgenius-ai.openMockupGallery', projectPath);
      
      // ユーザーに通知
      Logger.info(`モックアップギャラリーを開きます。プロジェクトパス: ${projectPath}`);
    } catch (error) {
      Logger.error(`モックアップギャラリー起動エラー`, error as Error);
      await this._showError(`モックアップギャラリーの起動に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * スコープマネージャーを開く
   */
  private async _handleOpenScopeManager(): Promise<void> {
    try {
      // アクティブなプロジェクトがあるか確認
      if (!this._activeProject) {
        throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
      }

      // プロジェクトパスを取得
      const projectPath = this._activeProject.path;
      
      if (!projectPath) {
        throw new Error('プロジェクトパスが設定されていません。プロジェクト設定を確認してください。');
      }
      
      Logger.info(`スコープマネージャーを開きます。プロジェクトパス: ${projectPath}`);

      // 先にメッセージを表示せずに直接コマンド実行
      // スコープマネージャーを開く（プロジェクトパスを引数として渡す）
      Logger.info(`[Debug] openScopeManagerコマンド実行: パラメータ=${projectPath}`);
      await vscode.commands.executeCommand('appgenius-ai.openScopeManager', projectPath);
    } catch (error) {
      Logger.error(`スコープマネージャー起動エラー`, error as Error);
      await this._showError(`スコープマネージャーの起動に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 開発アシスタント機能は削除済み
   */
  
  /**
   * デバッグ探偵を開く
   */
  private async _handleOpenDebugDetective(): Promise<void> {
    try {
      // アクティブなプロジェクトがあるか確認
      if (!this._activeProject) {
        throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
      }

      // プロジェクトパスを取得
      const projectPath = this._activeProject.path;
      
      if (!projectPath) {
        throw new Error('プロジェクトパスが設定されていません。プロジェクト設定を確認してください。');
      }
      
      Logger.info(`デバッグ探偵を開きます。プロジェクトパス: ${projectPath}`);

      // 先にメッセージを表示せずに直接コマンド実行
      // デバッグ探偵を開く（プロジェクトパスを引数として渡す）
      await vscode.commands.executeCommand('appgenius-ai.openDebugDetective', projectPath);
    } catch (error) {
      Logger.error(`デバッグ探偵起動エラー`, error as Error);
      await this._showError(`デバッグ探偵の起動に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 環境変数アシスタントを開く
   */
  private async _handleOpenEnvironmentVariablesAssistant(): Promise<void> {
    try {
      // アクティブなプロジェクトがあるか確認
      if (!this._activeProject) {
        throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
      }

      // プロジェクトパスを取得
      const projectPath = this._activeProject.path;
      
      // 環境変数アシスタントを開く
      await vscode.commands.executeCommand('appgenius-ai.openEnvironmentVariablesAssistant', projectPath);
    } catch (error) {
      Logger.error(`環境変数アシスタント起動エラー`, error as Error);
      await this._showError(`環境変数アシスタントの起動に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * リファレンスマネージャーを開く
   */
  private async _handleOpenReferenceManager(): Promise<void> {
    try {
      // アクティブなプロジェクトがあるか確認
      if (!this._activeProject) {
        throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
      }

      // Webview経由でリファレンス追加中の場合はそのメッセージをバックエンドに送信
      await this._panel.webview.postMessage({
        command: 'syncReferenceManagerState'
      });

      // リファレンスマネージャーを開く
      vscode.commands.executeCommand('appgenius-ai.openReferenceManager');
    } catch (error) {
      Logger.error(`リファレンスマネージャー起動エラー`, error as Error);
      await this._showError(`リファレンスマネージャーの起動に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクト分析を実行
   */
  private async _handleAnalyzeProject(): Promise<void> {
    try {
      // アクティブなプロジェクトがあるか確認
      if (!this._activeProject) {
        throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
      }

      // プロジェクト分析を実行
      vscode.commands.executeCommand('appgenius-ai.analyzeProject');
    } catch (error) {
      Logger.error(`プロジェクト分析エラー`, error as Error);
      await this._showError(`プロジェクト分析の実行に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 既存プロジェクトを読み込む
   */
  private async _handleLoadExistingProject(): Promise<void> {
    try {
      // フォルダ選択ダイアログを表示
      const options: vscode.OpenDialogOptions = {
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'プロジェクトフォルダを選択'
      };
      
      const folderUri = await vscode.window.showOpenDialog(options);
      if (!folderUri || folderUri.length === 0) {
        return; // ユーザーがキャンセルした場合
      }
      
      const folderPath = folderUri[0].fsPath;
      
      // プロジェクトフォルダを検証
      await this._validateAndLoadProject(folderPath);
    } catch (error) {
      Logger.error(`プロジェクト読み込みエラー`, error as Error);
      await this._showError(`プロジェクトの読み込みに失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * プロジェクトフォルダを検証して読み込む
   */
  private async _validateAndLoadProject(folderPath: string): Promise<void> {
    // CLAUDE.mdファイルの存在確認 - 存在しなくても続行するように変更
    const claudeMdPath = path.join(folderPath, 'CLAUDE.md');
    let claudeMdExists = fs.existsSync(claudeMdPath);
    
    // CLAUDE.mdがなくても、常に続行するように修正
    if (!claudeMdExists) {
      Logger.info(`CLAUDE.mdファイルが見つかりませんが、問題なく続行します: ${claudeMdPath}`);
    }
    
    // docs/mockupsディレクトリの存在確認
    const docsPath = path.join(folderPath, 'docs');
    const mockupsPath = path.join(folderPath, 'mockups');
    
    // 必要に応じてディレクトリを作成
    if (!fs.existsSync(docsPath)) {
      fs.mkdirSync(docsPath, { recursive: true });
      
      // 基本的なドキュメントファイルも作成
      try {
        this._createInitialDocuments(folderPath);
        Logger.info(`初期ドキュメントファイルを作成しました`);
      } catch (e) {
        Logger.warn(`初期ドキュメントの作成に失敗しました: ${(e as Error).message}`);
      }
    }
    
    if (!fs.existsSync(mockupsPath)) {
      fs.mkdirSync(mockupsPath, { recursive: true });
    }
    
    // フォルダ名をプロジェクト名として取得
    const folderName = path.basename(folderPath);
    
    // CLAUDE.mdから説明を取得
    let description = '';
    try {
      const claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');
      const firstLine = claudeMdContent.split('\n')[0];
      if (firstLine && firstLine.startsWith('# ')) {
        description = firstLine.substring(2).replace(' 開発ガイド', '').trim();
      }
    } catch (e) {
      Logger.warn(`CLAUDE.mdファイルの読み込みに失敗しました: ${(e as Error).message}`);
    }
    
    // プロジェクトを作成
    const projectData = {
      name: folderName,
      description: "",
      path: folderPath
    };
    
    try {
      // プロジェクトを登録
      const projectId = await this._projectService.createProject(projectData);
      
      // 作成したプロジェクトをアクティブに設定
      await this._projectService.setActiveProject(projectId);
      
      // データを更新
      await this._refreshProjects();
      
      // 成功メッセージを表示
      vscode.window.showInformationMessage(`プロジェクト「${folderName}」を読み込みました`);
    } catch (error) {
      Logger.error(`プロジェクト登録エラー`, error as Error);
      throw new Error(`プロジェクトの登録に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ファイルが初期テンプレートから変更されているか確認
   * @param content ファイルの内容
   * @param fileType ファイルの種類（'requirements' または 'structure'）
   */
  private _isFileChangedFromTemplate(content: string, fileType: 'requirements' | 'structure'): boolean {
    // テンプレート内容
    const templates: Record<string, string> = {
      requirements: `# 要件定義

## 機能要件

1. 要件1
   - 説明: 機能の詳細説明
   - 優先度: 高

2. 要件2
   - 説明: 機能の詳細説明
   - 優先度: 中

## 非機能要件

1. パフォーマンス
   - 説明: レスポンス時間や処理能力に関する要件
   - 優先度: 中

2. セキュリティ
   - 説明: セキュリティに関する要件
   - 優先度: 高

## ユーザーストーリー

- ユーザーとして、[機能]を使いたい。それによって[目的]を達成できる。`,
      structure: `# ディレクトリ構造

\`\`\`
project/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── assets/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── styles/
│       └── utils/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   └── models/
\`\`\``
    };
    
    const templateContent = templates[fileType];
    
    // 行数が異なるか確認
    const contentLines = content.split('\n').filter(line => line.trim() !== '');
    const templateLines = templateContent.split('\n').filter(line => line.trim() !== '');
    
    // 行数が明らかに異なる場合は変更されたと判断
    if (Math.abs(contentLines.length - templateLines.length) > 3) {
      return true;
    }
    
    // 同じ行数でも内容が異なるか確認（最低でも30%以上の行が変更されていること）
    let differentLines = 0;
    for (let i = 0; i < Math.min(contentLines.length, templateLines.length); i++) {
      if (contentLines[i] !== templateLines[i]) {
        differentLines++;
      }
    }
    
    const diffPercentage = differentLines / Math.min(contentLines.length, templateLines.length);
    return diffPercentage > 0.3; // 30%以上の行が異なる場合は変更されたと判断
  }

  /**
   * エラーメッセージの表示
   */
  private async _showError(message: string): Promise<void> {
    vscode.window.showErrorMessage(message);
    
    // WebViewにもエラーを表示
    await this._panel.webview.postMessage({ 
      command: 'showError', 
      message 
    });
  }
  
  /**
   * VSCodeメッセージ表示処理
   */
  private async _handleShowVSCodeMessage(type: string, message: string): Promise<void> {
    switch (type) {
      case 'info':
        vscode.window.showInformationMessage(message);
        break;
      case 'warning':
        vscode.window.showWarningMessage(message);
        break;
      case 'error':
        vscode.window.showErrorMessage(message);
        break;
      default:
        vscode.window.showInformationMessage(message);
    }
  }
  
  /**
   * 初期ドキュメントファイルを作成
   * @param projectPath プロジェクトのパス
   */
  private _createInitialDocuments(projectPath: string): void {
    try {
      const docsDir = path.join(projectPath, 'docs');
      
      // 各ファイルの作成（既存のファイルは上書きしない）
      const files = [
        {
          path: path.join(docsDir, 'requirements.md'),
          content: `# 要件定義

## 機能要件

1. 要件1
   - 説明: 機能の詳細説明
   - 優先度: 高

2. 要件2
   - 説明: 機能の詳細説明
   - 優先度: 中

## 非機能要件

1. パフォーマンス
   - 説明: レスポンス時間や処理能力に関する要件
   - 優先度: 中

2. セキュリティ
   - 説明: セキュリティに関する要件
   - 優先度: 高

## ユーザーストーリー

- ユーザーとして、[機能]を使いたい。それによって[目的]を達成できる。
`
        },
        {
          path: path.join(docsDir, 'structure.md'),
          content: `# ディレクトリ構造

\`\`\`
project/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── assets/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── styles/
│       └── utils/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   └── models/
\`\`\`
`
        },
        {
          path: path.join(docsDir, 'scope.md'),
          content: `# 実装スコープ

## 完了

（まだ完了した項目はありません）

## 進行中

（実装中の項目がここに表示されます）

## 未着手

1. ユーザー認証機能
   - 説明: ログイン・登録機能の実装
   - 優先度: 高
   - 関連ファイル: 未定

2. データ表示機能
   - 説明: メインデータの一覧表示
   - 優先度: 高
   - 関連ファイル: 未定
`
        },
        {
          path: path.join(docsDir, 'api.md'),
          content: `# API設計

## エンドポイント一覧

### ユーザー管理

- \`POST /api/auth/login\`
  - 説明: ユーザーログイン
  - リクエスト: \`{ email: string, password: string }\`
  - レスポンス: \`{ token: string, user: User }\`

- \`POST /api/auth/register\`
  - 説明: ユーザー登録
  - リクエスト: \`{ name: string, email: string, password: string }\`
  - レスポンス: \`{ token: string, user: User }\`

### データ管理

- \`GET /api/data\`
  - 説明: データ一覧取得
  - リクエストパラメータ: \`{ page: number, limit: number }\`
  - レスポンス: \`{ data: DataItem[], total: number }\`
`
        },
        {
          path: path.join(docsDir, 'env.example'),
          content: `# 環境変数サンプル
# 実際の値は.envファイルに設定してください

# サーバー設定
PORT=3000
NODE_ENV=development

# データベース設定
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydatabase
DB_USER=user
DB_PASSWORD=password

# 認証設定
JWT_SECRET=your_jwt_secret_key
`
        }
      ];
      
      // 各ファイルを順番に処理
      for (const file of files) {
        // ファイルが存在しない場合のみ作成
        if (!fs.existsSync(file.path)) {
          fs.writeFileSync(file.path, file.content, 'utf8');
          Logger.info(`${path.basename(file.path)} を作成しました: ${file.path}`);
        } else {
          Logger.info(`${path.basename(file.path)} は既に存在するため、スキップします: ${file.path}`);
        }
      }
      
      // CURRENT_STATUS.mdの作成は ProjectManagementService.createInitialDocuments で行うため、ここでは実装しない
      
      Logger.info(`初期ドキュメントを作成しました: ${projectPath}`);
    } catch (error) {
      Logger.error(`初期ドキュメント作成エラー: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * WebViewを更新
   */
  private async _update(): Promise<void> {
    if (!this._panel.visible) {
      return;
    }

    try {
      this._panel.webview.html = this._getHtmlForWebview();
      await this._updateWebview();
    } catch (error) {
      Logger.error(`WebView更新エラー`, error as Error);
      // エラーが発生しても最低限のUIは維持
      this._panel.webview.html = this._getHtmlForWebview();
    }
  }

  /**
   * WebViewの状態を更新
   */
  private async _updateWebview(): Promise<void> {
    try {
      // プロジェクト詳細情報を追加
      let activeProjectDetails = undefined;
      
      if (this._activeProject) {
        const projectId = this._activeProject.id;
        const projectPath = this._activeProject.path || '';
        
        // データがなくてもクラッシュしないように、安全にアクセス
        const mockups = this._projectMockups[projectId] || [];
        const scope = this._projectScopes[projectId] || { items: [], totalProgress: 0 };
        const scopeItems = scope.items || [];
        
        // ファイル進捗情報は使用しない
        let fileProgress = { completed: [], total: [], percentage: 0 };

        // 共通関数を使用してモックアップの状態を確認（毎回のチェックはせず、既存の値を使用）
        const hasMockupFiles = this._checkMockupFolderStatus(projectPath, projectId);
        
        activeProjectDetails = {
          requirements: this._projectRequirements[projectId] || {},
          mockups: mockups,
          scope: scope,
          
          // モックアップ数
          mockupCount: mockups.length || 0,
          
          // モックアップファイルの存在フラグを追加
          hasMockupFiles: hasMockupFiles,
          
          // 実装項目数
          scopeItemCount: scopeItems.length || 0,
          
          // 実装完了率
          implementationProgress: scope.totalProgress || 0,
          
          // 実装中の項目数
          inProgressItems: scopeItems.filter((item: any) => 
            item && item.status === 'in-progress').length || 0,
            
          // 完了した項目数
          completedItems: scopeItems.filter((item: any) => 
            item && item.status === 'completed').length || 0,
            
          // ファイル進捗情報
          fileProgress: {
            completed: fileProgress.completed,
            total: fileProgress.total,
            percentage: fileProgress.percentage
          }
        };
      }
      
      // WebViewに状態更新を送信
      await this._panel.webview.postMessage({
        command: 'updateState',
        projects: this._currentProjects || [],
        activeProject: this._activeProject || null,
        activeProjectDetails: activeProjectDetails
      });
    } catch (error) {
      Logger.error(`WebView状態更新エラー`, error as Error);
      // 最低限のメッセージを送信
      await this._panel.webview.postMessage({
        command: 'showError',
        message: 'プロジェクトデータの読み込み中にエラーが発生しました。'
      });
    }
  }

  /**
   * WebView用のHTMLを生成
   */
  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    // WebView内でのリソースへのパスを取得
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.css')
    );
    const resetCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    const designSystemUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'design-system.css')
    );
    const accessibilityUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'accessibility.css')
    );
    const vscodeCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
    );

    // WebViewのHTMLを構築
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; frame-src https:;">
  <title>AppGenius ダッシュボード</title>
  <link href="${resetCssUri}" rel="stylesheet">
  <link href="${designSystemUri}" rel="stylesheet">
  <link href="${accessibilityUri}" rel="stylesheet">
  <link href="${styleUri}" rel="stylesheet">
  <style>
    /* 青背景エリアの文字は常に白に強制上書き */
    .header h1, 
    .header-actions button,
    .header-actions button span,
    .step-number, 
    .step-action,
    .project-buttons button,
    .project-buttons button span,
    .open-button {
      color: white !important;
    }
    
    /* ライトモード固定スタイル */
    .dashboard-container {
      color-scheme: light !important;
      background-color: white !important;
      color: #333 !important;
    }
    
    /* ダークモード用スタイル（将来的な拡張） */
    .dashboard-container.theme-dark {
      color-scheme: dark !important;
      background-color: #1e1e1e !important;
      color: #e0e0e0 !important;
    }
  </style>
</head>
<body>
  <div class="dashboard-container theme-light">
    <!-- ヘッダー -->
    <div class="header">
      <h1>AppGenius ダッシュボード</h1>
      <div class="header-actions">
        <button id="theme-toggle" class="button">
          <i class="icon">🌓</i> <span>テーマ切替</span>
        </button>
      </div>
    </div>
    
    <!-- メインコンテンツ -->
    <div class="content">
      <!-- サイドバー -->
      <div class="sidebar">
        <div class="sidebar-header">
          <h2>プロジェクト一覧</h2>
          <div class="project-buttons">
            <button id="new-project-btn" class="button">
              <i class="icon">➕</i> <span>新規作成</span>
            </button>
            <button id="load-project-btn" class="button">
              <i class="icon">📂</i> <span>読み込む</span>
            </button>
          </div>
          <button id="toggle-sidebar" class="toggle-sidebar" title="サイドバー切替">
            <i class="icon">◀</i>
          </button>
        </div>
        <div id="projects-container" class="projects-container">
          <!-- プロジェクト一覧が動的に表示されます -->
          <div class="loading">
            <div class="loading-spinner"></div>
            <div>プロジェクトを読み込み中...</div>
          </div>
        </div>
      </div>
      
      <!-- メインエリア -->
      <div class="main">
        <div id="active-project-info">
          <!-- プロジェクト情報がここに表示されます -->
        </div>
      </div>
    </div>
  </div>

  <!-- 新規プロジェクト作成モーダル -->
  <div id="new-project-modal" class="modal">
    <div class="modal-content">
      <h2>新規プロジェクト作成</h2>
      <form id="new-project-form">
        <div class="form-group">
          <label for="project-name">プロジェクト名 <span style="color: #e74c3c;">*</span></label>
          <input type="text" id="project-name" required placeholder="例: MyWebApp">
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" id="cancel-new-project">キャンセル</button>
          <button type="submit" class="button primary">作成</button>
        </div>
      </form>
    </div>
  </div>
  
  <!-- スクリプト -->
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    DashboardPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}