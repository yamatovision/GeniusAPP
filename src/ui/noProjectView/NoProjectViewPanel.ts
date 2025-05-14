import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { ProjectServiceImpl } from '../scopeManager/services/implementations/ProjectServiceImpl';
// ProjectStateServiceに依存せず直接ProjectServiceImplを使用
import { FileSystemServiceImpl } from '../scopeManager/services/implementations/FileSystemServiceImpl';

/**
 * プロジェクト未選択時専用のWebViewパネル
 * ユーザーに新規プロジェクト作成または既存プロジェクト読み込みの選択肢を提供
 */
export class NoProjectViewPanel {
  public static currentPanel: NoProjectViewPanel | undefined;
  private static readonly viewType = 'noProjectView';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _projectService: ProjectServiceImpl;
  private _fileSystemService: FileSystemServiceImpl;

  /**
   * 新しいインスタンスを作成し、パネルを表示
   */
  public static createOrShow(extensionUri: vscode.Uri): NoProjectViewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は再利用
    if (NoProjectViewPanel.currentPanel) {
      NoProjectViewPanel.currentPanel._panel.reveal(column);
      return NoProjectViewPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      NoProjectViewPanel.viewType,
      'プロジェクト選択',
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

    NoProjectViewPanel.currentPanel = new NoProjectViewPanel(panel, extensionUri);
    return NoProjectViewPanel.currentPanel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // サービスの初期化 - ProjectStateServiceに依存せず直接ProjectServiceImplを使用
    this._fileSystemService = FileSystemServiceImpl.getInstance();
    this._projectService = ProjectServiceImpl.getInstance(this._fileSystemService);

    // コンテンツの設定
    this._update();

    // パネルが破棄された時のイベント
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // メッセージハンドラーの設定
    this._setupMessageHandler();
  }

  /**
   * Webviewコンテンツを更新
   */
  private _update() {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  /**
   * メッセージハンドラーをセットアップ
   */
  private _setupMessageHandler(): void {
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.command) {
            case 'createNewProject':
              Logger.info('NoProjectViewPanel: 新規プロジェクト作成モーダル表示リクエスト');
              await this._handleShowCreateProjectModal();
              break;

            case 'loadExistingProject':
              Logger.info('NoProjectViewPanel: 既存プロジェクト読み込みリクエスト');
              await this._handleLoadExistingProject();
              break;

            case 'createProject':
              // プロジェクト名とオプションの説明を受け取り
              Logger.info(`NoProjectViewPanel: プロジェクト作成リクエスト: ${message.name}`);
              if (message.name) {
                await this._handleCreateProject(message.name, message.description || '');
              } else {
                Logger.warn('NoProjectViewPanel: プロジェクト名が指定されていません');
                vscode.window.showErrorMessage('プロジェクト名を入力してください');
              }
              break;
          }
        } catch (error) {
          Logger.error(`NoProjectViewPanel: メッセージ処理中にエラーが発生: ${message.command}`, error as Error);
          vscode.window.showErrorMessage(`操作に失敗しました: ${(error as Error).message}`);
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * 新規プロジェクト作成モーダル表示
   */
  private async _handleShowCreateProjectModal(): Promise<void> {
    try {
      Logger.info('NoProjectViewPanel: 新規プロジェクトモーダル表示処理');

      // モーダルHTML生成
      const modalHtml = this._generateNewProjectModalHtml();

      // モーダル表示のメッセージ送信
      this._panel.webview.postMessage({
        command: 'showModal',
        html: modalHtml
      });
    } catch (error) {
      Logger.error('NoProjectViewPanel: モーダル表示中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`モーダル表示に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 新規プロジェクトモーダルのHTML生成
   */
  private _generateNewProjectModalHtml(): string {
    return `
      <div id="new-project-modal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>新規プロジェクト作成</h2>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="project-name">プロジェクト名 <span class="required">*</span></label>
              <input type="text" id="project-name" required placeholder="例: MyWebApp">
            </div>
            <div class="form-group">
              <label for="project-description">プロジェクト説明</label>
              <textarea id="project-description" placeholder="プロジェクトの概要を入力してください"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" id="cancel-new-project" class="secondary-button">キャンセル</button>
            <button type="button" id="create-project-btn" class="primary-button">作成</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 新規プロジェクト作成処理
   * @param projectName プロジェクト名
   * @param description プロジェクトの説明
   */
  private async _handleCreateProject(projectName: string, description: string): Promise<void> {
    try {
      Logger.info(`NoProjectViewPanel: 新規プロジェクト作成処理開始: ${projectName}`);

      if (!projectName || projectName.trim() === '') {
        Logger.warn('NoProjectViewPanel: プロジェクト名が空です');
        vscode.window.showErrorMessage('プロジェクト名を入力してください');
        return;
      }

      // ProjectServiceImplを使用してプロジェクト作成
      // これによりScopeManagerPanelと同じ処理フローになる
      const projectId = await this._projectService.createProject(projectName, description);

      // 作成したプロジェクトパスを取得
      const activeProject = this._projectService.getActiveProject();
      if (!activeProject || !activeProject.path) {
        throw new Error('プロジェクト作成後にプロジェクト情報が取得できませんでした');
      }

      // VSCode設定に直接保存 - ProjectStateService非依存
      await vscode.workspace.getConfiguration('appgenius').update('currentProjectPath', activeProject.path, true);
      Logger.info(`NoProjectViewPanel: プロジェクトパスをVSCode設定に保存: ${activeProject.path}`);

      // ScopeManagerPanelを表示 - 複数の方法でコンテキストを取得
      const { ScopeManagerPanel } = require('../scopeManager/ScopeManagerPanel');
      // グローバル変数とextensions APIの両方からコンテキストを取得（フォールバック方式）
      const extensionContext = (global as any).__extensionContext ||
                             (global as any).extensionContext ||
                             (global as any).appgeniusContext;

      if (!extensionContext) {
        Logger.warn('NoProjectViewPanel: 拡張機能コンテキストが見つかりませんでした - コマンド経由で実行します');
        // コンテキストが見つからない場合はコマンド経由で実行
        await vscode.commands.executeCommand('appgenius-ai.openScopeManager', activeProject.path);
      } else {
        Logger.info('NoProjectViewPanel: ScopeManagerPanelを直接表示します');
        ScopeManagerPanel.createOrShow(this._extensionUri, extensionContext, activeProject.path);
      }

      Logger.info(`NoProjectViewPanel: 新規プロジェクト "${projectName}" が作成されました: ${activeProject.path}`);
    } catch (error) {
      Logger.error('NoProjectViewPanel: プロジェクト作成中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`プロジェクト作成に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 既存プロジェクト読み込み処理
   */
  private async _handleLoadExistingProject(): Promise<void> {
    try {
      Logger.info('NoProjectViewPanel: 既存プロジェクト読み込み処理開始');

      // ProjectServiceImplを使用して既存プロジェクトをロード
      // これによりScopeManagerPanelと同じ処理フローになる
      const projectInfo = await this._projectService.loadExistingProject();

      // プロジェクトロード後の処理 - ProjectStateService非依存
      if (projectInfo && projectInfo.path) {
        // VSCode設定に直接保存
        await vscode.workspace.getConfiguration('appgenius').update('currentProjectPath', projectInfo.path, true);
        Logger.info(`NoProjectViewPanel: プロジェクトパスをVSCode設定に保存: ${projectInfo.path}`);

        // ScopeManagerPanelを表示 - 複数の方法でコンテキストを取得
        const { ScopeManagerPanel } = require('../scopeManager/ScopeManagerPanel');
        // グローバル変数とextensions APIの両方からコンテキストを取得（フォールバック方式）
        const extensionContext = (global as any).__extensionContext ||
                               (global as any).extensionContext ||
                               (global as any).appgeniusContext;

        if (!extensionContext) {
          Logger.warn('NoProjectViewPanel: 拡張機能コンテキストが見つかりませんでした - コマンド経由で実行します');
          // コンテキストが見つからない場合はコマンド経由で実行
          await vscode.commands.executeCommand('appgenius-ai.openScopeManager', projectInfo.path);
        } else {
          Logger.info('NoProjectViewPanel: ScopeManagerPanelを直接表示します');
          ScopeManagerPanel.createOrShow(this._extensionUri, extensionContext, projectInfo.path);
        }

        Logger.info(`NoProjectViewPanel: プロジェクト "${projectInfo.name}" を読み込みました: ${projectInfo.path}`);
      } else {
        Logger.warn('NoProjectViewPanel: プロジェクト情報が取得できませんでした');
      }
    } catch (error) {
      Logger.error('NoProjectViewPanel: プロジェクト読み込み中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`プロジェクト読み込みに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * リソースを破棄
   */
  public dispose() {
    NoProjectViewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * nonce値を生成
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Webview用のHTMLを生成
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // スタイルシートのURIを取得
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'styles', 'reset.css')
    );

    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'styles', 'vscode.css')
    );

    const styleDesignSystemUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'styles', 'design-system.css')
    );

    // 新しく追加した専用CSSのURI
    const styleNoProjectViewUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'noProjectView', 'noProjectView.css')
    );

    // Material Icons用のフォントURL
    const materialIconsCss = "https://fonts.googleapis.com/icon?family=Material+Icons";

    // nonce値を生成
    const nonce = this._getNonce();

    // HTMLを返却
    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}';">
      <link href="${styleResetUri}" rel="stylesheet">
      <link href="${styleVSCodeUri}" rel="stylesheet">
      <link href="${styleDesignSystemUri}" rel="stylesheet">
      <link href="${styleNoProjectViewUri}" rel="stylesheet">
      <link href="${materialIconsCss}" rel="stylesheet">
      <title>プロジェクト選択</title>
    </head>
    <body>
      <div class="no-project-container">
        <div class="no-project-card">
          <div class="no-project-icon">
            <span class="material-icons">rocket_launch</span>
          </div>
          <h2 class="no-project-title">新しい可能性を創造しましょう！</h2>
          <p class="no-project-text">
            ブルーランプがあなたの創造力を拡張します。新しいプロジェクトを始めて、AIと一緒に理想のアプリケーションを形にしましょう。
            アイデアをコードに、ビジョンを現実に。すべての素晴らしい開発は、最初の一歩から始まります。
          </p>
          <div class="project-actions">
            <button class="project-button primary-button" id="create-new-project">
              <span class="material-icons project-button-icon">add</span>
              新規プロジェクト作成
            </button>
            <button class="project-button secondary-button" id="load-existing-project">
              <span class="material-icons project-button-icon">folder</span>
              既存プロジェクトを読み込む
            </button>
          </div>
        </div>
      </div>

      <script nonce="${nonce}">
        // VSCodeのWebView APIを取得
        const vscode = acquireVsCodeApi();

        // 初期化
        document.addEventListener('DOMContentLoaded', () => {
          console.log('NoProjectView: 初期化完了');
        });

        // プロジェクト作成ボタンのイベントハンドラー
        document.getElementById('create-new-project').addEventListener('click', () => {
          console.log('新規プロジェクト作成ボタンがクリックされました');
          vscode.postMessage({ command: 'createNewProject' });
        });

        // プロジェクト読み込みボタンのイベントハンドラー
        document.getElementById('load-existing-project').addEventListener('click', () => {
          console.log('既存プロジェクト読み込みボタンがクリックされました');
          vscode.postMessage({ command: 'loadExistingProject' });
        });

        // モーダル関連のイベントハンドラー
        window.addEventListener('message', event => {
          const message = event.data;
          switch (message.command) {
            case 'showModal':
              // モーダルをDOMに追加
              const modalContainer = document.createElement('div');
              modalContainer.innerHTML = message.html;
              document.body.appendChild(modalContainer);

              // イベントリスナーを設定
              document.getElementById('cancel-new-project').addEventListener('click', () => {
                hideModal();
              });

              document.getElementById('create-project-btn').addEventListener('click', () => {
                const projectName = document.getElementById('project-name').value.trim();
                const projectDescription = document.getElementById('project-description')?.value?.trim() || '';

                if (projectName) {
                  vscode.postMessage({
                    command: 'createProject',
                    name: projectName,
                    description: projectDescription
                  });
                  hideModal();
                } else {
                  // エラーメッセージ表示
                  alert('プロジェクト名を入力してください');
                }
              });

              // フォーカス設定
              document.getElementById('project-name').focus();
              break;
          }
        });

        // モーダルを閉じる関数
        function hideModal() {
          const modal = document.getElementById('new-project-modal');
          if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
          }
        }
      </script>
    </body>
    </html>`;
  }
}