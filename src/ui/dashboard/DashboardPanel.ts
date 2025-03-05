import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { ProjectManagementService, Project } from '../../services/ProjectManagementService';
import { AppGeniusEventBus, AppGeniusEventType } from '../../services/AppGeniusEventBus';
import { AppGeniusStateManager } from '../../services/AppGeniusStateManager';

/**
 * ダッシュボードパネル
 * プロジェクト管理と機能選択のためのWebViewインターフェース
 */
export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private static readonly viewType = 'dashboard';

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
   * パネルを作成または表示
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService): DashboardPanel {
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
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService) {
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
          case 'updateProject':
            await this._handleUpdateProject(message.id, message.updates);
            break;
          case 'openRequirementsEditor':
            await this._handleOpenRequirementsEditor();
            break;
          case 'openMockupDesigner':
            await this._handleOpenMockupDesigner();
            break;
          case 'openImplementationSelector':
            await this._handleOpenImplementationSelector();
            break;
          case 'openDevelopmentAssistant':
            await this._handleOpenDevelopmentAssistant();
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
   * プロジェクト一覧を更新
   */
  private async _refreshProjects(): Promise<void> {
    try {
      this._currentProjects = this._projectService.getAllProjects();
      this._activeProject = this._projectService.getActiveProject();
      
      // アクティブなプロジェクトのデータをロード
      if (this._activeProject) {
        const projectId = this._activeProject.id;
        
        // 要件定義データのロード
        try {
          const requirements = await this._stateManager.getRequirements(projectId);
          if (requirements) {
            this._projectRequirements[projectId] = requirements;
          }
        } catch (e) {
          Logger.debug(`No requirements found for project: ${projectId}`);
          // 空のオブジェクトで初期化
          this._projectRequirements[projectId] = { 
            document: '', 
            sections: [], 
            extractedItems: [], 
            chatHistory: [] 
          };
        }
        
        // スコープデータのロード
        try {
          const scope = await this._stateManager.getImplementationScope(projectId);
          if (scope) {
            this._projectScopes[projectId] = scope;
          }
        } catch (e) {
          Logger.debug(`No implementation scope found for project: ${projectId}`);
          // 基本スコープデータで初期化
          this._projectScopes[projectId] = {
            items: [],
            selectedIds: [],
            estimatedTime: '',
            totalProgress: 0,
            startDate: new Date().toISOString().split('T')[0],
            targetDate: '',
            projectPath: this._activeProject.path || ''
          };
        }
      }
      
      await this._updateWebview();
    } catch (error) {
      Logger.error(`プロジェクト一覧更新エラー`, error as Error);
      await this._showError(`プロジェクト一覧の更新中にエラーが発生しました: ${(error as Error).message}`);
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

      // ワークスペースのルートパスを取得
      let projectPath = '';
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        projectPath = workspaceFolders[0].uri.fsPath;
      }

      // プロジェクトを作成
      const projectId = await this._projectService.createProject({
        name,
        description,
        path: projectPath
      });

      // 作成したプロジェクトをアクティブに設定
      await this._projectService.setActiveProject(projectId);

      // データを更新
      await this._refreshProjects();

      // 成功メッセージを表示
      vscode.window.showInformationMessage(`プロジェクト「${name}」が作成されました`);
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

      // プロジェクトをアクティブに設定
      await this._projectService.setActiveProject(id);

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
   * プロジェクト削除処理
   */
  private async _handleDeleteProject(id: string): Promise<void> {
    try {
      // プロジェクトの存在確認
      const project = this._projectService.getProject(id);
      if (!project) {
        throw new Error(`プロジェクトが見つかりません: ${id}`);
      }

      // 確認ダイアログを表示
      const answer = await vscode.window.showWarningMessage(
        `プロジェクト「${project.name}」を削除しますか？この操作は元に戻せません。`,
        { modal: true },
        'はい',
        'いいえ'
      );

      if (answer !== 'はい') {
        return;
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

      // 要件定義エディタを開く
      vscode.commands.executeCommand('appgenius-ai.openSimpleChat');
    } catch (error) {
      Logger.error(`要件定義エディタ起動エラー`, error as Error);
      await this._showError(`要件定義エディタの起動に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップデザイナーを開く
   */
  private async _handleOpenMockupDesigner(): Promise<void> {
    try {
      // アクティブなプロジェクトがあるか確認
      if (!this._activeProject) {
        throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
      }

      // モックアップデザイナーを開く
      vscode.commands.executeCommand('appgenius-ai.openMockupDesigner');
    } catch (error) {
      Logger.error(`モックアップデザイナー起動エラー`, error as Error);
      await this._showError(`モックアップデザイナーの起動に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 実装スコープ選択を開く
   */
  private async _handleOpenImplementationSelector(): Promise<void> {
    try {
      // アクティブなプロジェクトがあるか確認
      if (!this._activeProject) {
        throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
      }

      // 実装スコープ選択を開く
      vscode.commands.executeCommand('appgenius-ai.openImplementationSelector');
    } catch (error) {
      Logger.error(`実装スコープ選択起動エラー`, error as Error);
      await this._showError(`実装スコープ選択の起動に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 開発アシスタントを開く
   */
  private async _handleOpenDevelopmentAssistant(): Promise<void> {
    try {
      // アクティブなプロジェクトがあるか確認
      if (!this._activeProject) {
        throw new Error('開いているプロジェクトがありません。まずプロジェクトを作成または選択してください。');
      }

      // 開発アシスタントを開く
      vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant');
    } catch (error) {
      Logger.error(`開発アシスタント起動エラー`, error as Error);
      await this._showError(`開発アシスタントの起動に失敗しました: ${(error as Error).message}`);
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
    // CLAUDE.mdファイルの存在確認
    const claudeMdPath = path.join(folderPath, 'CLAUDE.md');
    let claudeMdExists = fs.existsSync(claudeMdPath);
    
    // CLAUDE.mdがない場合、作成するか確認
    if (!claudeMdExists) {
      const createFile = await vscode.window.showInformationMessage(
        `選択されたフォルダにCLAUDE.mdファイルが見つかりません。新しく作成しますか？`,
        'はい', 'いいえ'
      );
      
      if (createFile !== 'はい') {
        throw new Error('プロジェクトの読み込みをキャンセルしました。');
      }
      
      // CLAUDE.mdを新規作成
      try {
        // ClaudeMdServiceをインポート
        const { ClaudeMdService } = await import('../../utils/ClaudeMdService');
        const claudeMdService = ClaudeMdService.getInstance();
        
        // フォルダ名をプロジェクト名として使用
        const folderName = path.basename(folderPath);
        
        // テンプレートからCLAUDE.mdを生成
        await claudeMdService.generateClaudeMd(folderPath, {
          name: folderName,
          description: `${folderName} プロジェクト`
        });
        
        claudeMdExists = true;
        Logger.info(`CLAUDE.mdファイルを作成しました: ${claudeMdPath}`);
      } catch (e) {
        Logger.error(`CLAUDE.mdファイルの作成に失敗しました: ${(e as Error).message}`);
        throw new Error(`CLAUDE.mdファイルの作成に失敗しました: ${(e as Error).message}`);
      }
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
      description: description,
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
   * 初期ドキュメントファイルを作成
   * @param projectPath プロジェクトのパス
   */
  private _createInitialDocuments(projectPath: string): void {
    try {
      // requirements.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'requirements.md'),
        `# 要件定義

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
`,
        'utf8'
      );
      
      // structure.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'structure.md'),
        `# ディレクトリ構造

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
`,
        'utf8'
      );
      
      // scope.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'scope.md'),
        `# 実装スコープ

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
`,
        'utf8'
      );
      
      // api.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'api.md'),
        `# API設計

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
`,
        'utf8'
      );
      
      // env.example
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'env.example'),
        `# 環境変数サンプル
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
`,
        'utf8'
      );
      
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
        
        // データがなくてもクラッシュしないように、安全にアクセス
        const mockups = this._projectMockups[projectId] || [];
        const scope = this._projectScopes[projectId] || { items: [], totalProgress: 0 };
        const scopeItems = scope.items || [];
        
        activeProjectDetails = {
          requirements: this._projectRequirements[projectId] || {},
          mockups: mockups,
          scope: scope,
          
          // モックアップ数
          mockupCount: mockups.length || 0,
          
          // 実装項目数
          scopeItemCount: scopeItems.length || 0,
          
          // 実装完了率
          implementationProgress: scope.totalProgress || 0,
          
          // 実装中の項目数
          inProgressItems: scopeItems.filter((item: any) => 
            item && item.status === 'in-progress').length || 0,
            
          // 完了した項目数
          completedItems: scopeItems.filter((item: any) => 
            item && item.status === 'completed').length || 0
        };
      }
      
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
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <div class="dashboard-container">
    <!-- ヘッダー -->
    <div class="header">
      <h1><i class="icon">🧠</i> AppGenius ダッシュボード</h1>
      <div class="header-actions">
        <button id="refresh-btn" class="button">
          <i class="icon">🔄</i> 更新
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
              <i class="icon">➕</i> 新規作成
            </button>
            <button id="load-project-btn" class="button">
              <i class="icon">📂</i> 読み込む
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
        <div class="form-group">
          <label for="project-description">説明</label>
          <textarea id="project-description" rows="3" placeholder="プロジェクトの概要や目的を記述してください"></textarea>
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