import * as vscode from 'vscode';
import * as path from 'path';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { ProjectManagementService, Project } from '../../services/ProjectManagementService';

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
  private _disposables: vscode.Disposable[] = [];

  // 現在の作業状態
  private _currentProjects: Project[] = [];
  private _activeProject: Project | undefined;

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
        ]
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
          case 'refreshProjects':
            await this._refreshProjects();
            break;
        }
      },
      null,
      this._disposables
    );

    // 初期データをロード
    this._refreshProjects();
  }

  /**
   * プロジェクト一覧を更新
   */
  private async _refreshProjects(): Promise<void> {
    try {
      this._currentProjects = this._projectService.getAllProjects();
      this._activeProject = this._projectService.getActiveProject();
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
   * WebViewを更新
   */
  private async _update(): Promise<void> {
    if (!this._panel.visible) {
      return;
    }

    this._panel.webview.html = this._getHtmlForWebview();
    await this._updateWebview();
  }

  /**
   * WebViewの状態を更新
   */
  private async _updateWebview(): Promise<void> {
    await this._panel.webview.postMessage({
      command: 'updateState',
      projects: this._currentProjects,
      activeProject: this._activeProject
    });
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
  <title>AppGenius ダッシュボード</title>
  <link href="${resetCssUri}" rel="stylesheet">
  <link href="${vscodeCssUri}" rel="stylesheet">
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <div class="dashboard-container">
    <div class="header">
      <h1>AppGenius AI ダッシュボード</h1>
      <p>プロジェクト管理と機能選択</p>
    </div>
    
    <div class="content">
      <div class="sidebar">
        <div class="project-list">
          <div class="sidebar-header">
            <h2>プロジェクト一覧</h2>
            <button id="new-project-btn" class="button">新規作成</button>
          </div>
          <div id="projects-container" class="projects-container">
            <!-- プロジェクト一覧が動的に表示されます -->
            <div class="loading">プロジェクトを読み込み中...</div>
          </div>
        </div>
      </div>
      
      <div class="main">
        <div id="active-project-panel" class="active-project-panel">
          <!-- アクティブなプロジェクトの詳細情報が表示されます -->
          <div class="no-active-project">
            <h2>プロジェクトを選択してください</h2>
            <p>左側のリストからプロジェクトを選択するか、新しいプロジェクトを作成してください。</p>
          </div>
        </div>
        
        <div id="tools-panel" class="tools-panel">
          <h2>開発ツール</h2>
          <div class="tools-grid">
            <div class="tool-card" id="requirements-editor">
              <h3>要件定義エディタ</h3>
              <p>プロジェクト要件を定義・管理します</p>
              <button class="button">開く</button>
            </div>
            <div class="tool-card" id="mockup-designer">
              <h3>モックアップデザイナー</h3>
              <p>UIデザインとプロトタイプを作成します</p>
              <button class="button">開く</button>
            </div>
            <div class="tool-card" id="implementation-selector">
              <h3>実装スコープ選択</h3>
              <p>コード生成の範囲と機能を選択します</p>
              <button class="button">開く</button>
            </div>
            <div class="tool-card" id="development-assistant">
              <h3>開発アシスタント</h3>
              <p>コーディング・デバッグをサポートします</p>
              <button class="button">開く</button>
            </div>
          </div>
        </div>
        
        <div id="actions-panel" class="actions-panel">
          <h2>プロジェクトアクション</h2>
          <div class="actions-container">
            <button id="analyze-project" class="button">プロジェクト分析</button>
            <button id="export-project" class="button">エクスポート</button>
            <button id="project-settings" class="button">設定</button>
          </div>
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
          <label for="project-name">プロジェクト名 *</label>
          <input type="text" id="project-name" required>
        </div>
        <div class="form-group">
          <label for="project-description">説明</label>
          <textarea id="project-description" rows="3"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" id="cancel-new-project">キャンセル</button>
          <button type="submit" class="button primary">作成</button>
        </div>
      </form>
    </div>
  </div>
  
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