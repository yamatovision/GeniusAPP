import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger';
import { ClaudeCodeLauncherService } from '../../services/ClaudeCodeLauncherService';
import { PlatformManager } from '../../utils/PlatformManager';

/**
 * 環境変数アシスタントのメインパネルクラス
 * 環境変数の検出、表示、編集、検証をサポートする
 */
export class EnvironmentVariablesAssistantPanel {
  public static currentPanel: EnvironmentVariablesAssistantPanel | undefined;
  private static readonly viewType = 'environmentVariablesAssistant';
  
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _projectPath: string = '';
  
  // UIデータ共有ディレクトリ
  private _claudeUiDataDir: string = '';
  private _claudeUiDataDirInitialized: boolean = false;
  
  // 環境変数関連のデータ
  private _envFiles: string[] = [];
  private _activeEnvFile: string | null = null;
  private _envVariables: { [filePath: string]: Record<string, string> } = {};
  
  // UI監視とスクリーンショット
  private _domSnapshotInterval: NodeJS.Timeout | null = null;
  private _fileWatcher: fs.FSWatcher | null = null;
  
  /**
   * パネルの作成または表示（シングルトンパターン）
   */
  public static createOrShow(extensionUri: vscode.Uri, projectPath?: string): EnvironmentVariablesAssistantPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    
    // すでにパネルが存在する場合は、それを表示
    if (EnvironmentVariablesAssistantPanel.currentPanel) {
      EnvironmentVariablesAssistantPanel.currentPanel._panel.reveal(column);
      
      // プロジェクトパスが指定されている場合は更新
      if (projectPath) {
        EnvironmentVariablesAssistantPanel.currentPanel.setProjectPath(projectPath);
      }
      
      return EnvironmentVariablesAssistantPanel.currentPanel;
    }
    
    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      EnvironmentVariablesAssistantPanel.viewType,
      '環境変数アシスタント',
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
    
    EnvironmentVariablesAssistantPanel.currentPanel = new EnvironmentVariablesAssistantPanel(panel, extensionUri, projectPath);
    return EnvironmentVariablesAssistantPanel.currentPanel;
  }
  
  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, projectPath?: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    
    // プロジェクトパスが指定されている場合は設定
    if (projectPath) {
      this.setProjectPath(projectPath);
    }
    
    // WebViewの内容を設定
    this._update();
    
    // パネルが破棄されたときのクリーンアップ
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    
    // パネルの状態が変更されたときに更新
    this._panel.onDidChangeViewState(
      e => {
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
        try {
          switch (message.command) {
            case 'initialize':
              await this._handleInitialize();
              break;
              
            case 'saveEnvironmentVariable':
              await this._handleSaveEnvironmentVariable(
                message.variableName, 
                message.variableValue, 
                message.variableFilePath
              );
              break;
              
            case 'createEnvFile':
              await this._handleCreateEnvFile(message.fileName);
              break;
              
            case 'selectEnvFile':
              await this._handleSelectEnvFile(message.filePath);
              break;
              
            case 'testConnection':
              await this._handleTestConnection(message.connectionType, message.config);
              break;
              
            case 'autoDetectVariables':
              await this._handleAutoDetectVariables();
              break;
              
            case 'saveAllVariables':
              await this._handleSaveAllVariables();
              break;
              
            case 'launchClaudeCodeAssistant':
              await this._handleLaunchClaudeCodeAssistant();
              break;
              
            case 'captureDOMSnapshot':
              await this._handleCaptureDOMSnapshot(message.data);
              break;
          }
        } catch (error) {
          Logger.error(`メッセージ処理エラー: ${message.command}`, error as Error);
          await this._showError(`操作に失敗しました: ${(error as Error).message}`);
        }
      },
      null,
      this._disposables
    );
  }
  
  /**
   * プロジェクトパスを設定
   */
  public async setProjectPath(projectPath: string): Promise<void> {
    if (!fs.existsSync(projectPath)) {
      throw new Error(`プロジェクトパスが存在しません: ${projectPath}`);
    }
    
    this._projectPath = projectPath;
    Logger.info(`環境変数アシスタント: プロジェクトパスを設定しました: ${projectPath}`);
    
    // ClaudeCode用のUI共有ディレクトリを初期化
    await this._initializeClaudeUiDataDir();
    
    // 環境変数ファイルの検出
    this._detectEnvFiles();
    
    // WebViewの更新
    await this._updateWebview();
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    EnvironmentVariablesAssistantPanel.currentPanel = undefined;
    
    // DOM監視を停止
    if (this._domSnapshotInterval) {
      clearInterval(this._domSnapshotInterval);
      this._domSnapshotInterval = null;
    }
    
    // ファイル監視を停止
    if (this._fileWatcher) {
      this._fileWatcher.close();
      this._fileWatcher = null;
    }
    
    // パネルを破棄
    this._panel.dispose();
    
    // 他のリソースを解放
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
  
  /**
   * WebViewのHTML生成
   */
  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;
    
    // WebView内でのリソースへのパスを取得
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'environmentVariablesAssistant.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'environmentVariablesAssistant.css')
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource}; style-src ${webview.cspSource}; font-src ${webview.cspSource};">
  <title>環境変数アシスタント</title>
  <link href="${resetCssUri}" rel="stylesheet">
  <link href="${vscodeCssUri}" rel="stylesheet">
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>環境変数アシスタント</h1>
      <div class="progress-indicator">
        <div class="progress-text">進捗: <span id="progress-value">0/0</span></div>
        <div class="progress-bar">
          <div class="progress-value" style="width: 0%"></div>
        </div>
      </div>
    </header>
    
    <div class="main-content">
      <div class="env-list">
        <div id="env-loading" class="loading">
          <div class="spinner"></div>
          <div>環境変数を読み込み中...</div>
        </div>
      </div>
      
      <div class="guide-panel">
        <div class="guide-panel-title">環境変数設定ガイド</div>
        <div class="guide-steps">
          <div class="guide-step">
            <span class="step-number">1</span>
            「AIアシスタントを起動」ボタンをクリックして、ClaudeCodeを起動します。
          </div>
          <div class="guide-step">
            <span class="step-number">2</span>
            AIが必要な環境変数を分析し、設定方法を提案します。
          </div>
          <div class="guide-step">
            <span class="step-number">3</span>
            AIの指示に従って環境変数を設定します。
          </div>
          <div class="guide-step">
            <span class="step-number">4</span>
            設定情報をCLAUDE.mdに追加して、プロジェクト情報を一元管理します。
          </div>
        </div>
        
        <div class="ai-suggestion">
          <div id="ai-suggestion-text">
            ClaudeCodeと連携して、プロジェクトに必要な環境変数を分析・設定しましょう。AIがプロジェクトコードを分析し、必要な環境変数を特定して適切な設定方法を提案します。
          </div>
          <button id="launch-claude-assistant" class="button button-primary">AIアシスタントを起動</button>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <button id="auto-detect-variables" class="button button-secondary">プロジェクト分析を開始</button>
      <button id="save-all-variables" class="button button-success">CLAUDE.mdに環境変数情報を追加</button>
    </div>
  </div>
  
  <script src="${scriptUri}"></script>
</body>
</html>`;
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
      // 進捗状況を計算
      const totalVars = this._countTotalVariables();
      const configuredVars = this._countConfiguredVariables();
      
      // WebViewにデータを送信
      await this._panel.webview.postMessage({
        command: 'updateState',
        envFiles: this._envFiles,
        activeEnvFile: this._activeEnvFile,
        envVariables: this._envVariables,
        progress: {
          total: totalVars,
          configured: configuredVars
        },
        projectPath: this._projectPath
      });
    } catch (error) {
      Logger.error(`WebView状態更新エラー`, error as Error);
      await this._showError('環境変数データの読み込み中にエラーが発生しました');
    }
  }
  
  /**
   * 初期化を処理
   */
  private async _handleInitialize(): Promise<void> {
    try {
      // プロジェクトパスがない場合は、アクティブなワークスペースを使用
      if (!this._projectPath) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          this._projectPath = workspaceFolders[0].uri.fsPath;
          Logger.info(`環境変数アシスタント: ワークスペースからプロジェクトパスを設定: ${this._projectPath}`);
        } else {
          await this._showError('プロジェクトパスが設定されていません。フォルダを開いてから再試行してください。');
          return;
        }
      }
      
      // ClaudeCode用のUI共有ディレクトリを初期化
      await this._initializeClaudeUiDataDir();
      
      // 環境変数ファイルの検出
      this._detectEnvFiles();
      
      // DOM構造の定期監視を開始
      this._startDOMSnapshotCapture();
      
      // AI操作ファイルの監視を開始
      this._startActionsFileWatch();
      
      // WebViewを更新
      await this._updateWebview();
    } catch (error) {
      Logger.error(`初期化エラー:`, error as Error);
      await this._showError(`初期化に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 環境変数の保存を処理
   */
  private async _handleSaveEnvironmentVariable(name: string, value: string, filePath: string): Promise<void> {
    try {
      if (!filePath) {
        if (!this._activeEnvFile) {
          throw new Error('環境変数ファイルが選択されていません');
        }
        filePath = this._activeEnvFile;
      }
      
      // ファイルのデータがなければ初期化
      if (!this._envVariables[filePath]) {
        this._envVariables[filePath] = {};
      }
      
      // 変数を更新
      this._envVariables[filePath][name] = value;
      
      // ファイルに書き込み
      await this._saveEnvFile(filePath, this._envVariables[filePath]);
      
      // WebViewを更新
      await this._updateWebview();
      
      vscode.window.showInformationMessage(`環境変数 ${name} を保存しました`);
    } catch (error) {
      Logger.error(`環境変数保存エラー:`, error as Error);
      await this._showError(`環境変数の保存に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 環境変数ファイルの作成を処理
   */
  private async _handleCreateEnvFile(fileName: string): Promise<void> {
    try {
      if (!fileName) {
        throw new Error('ファイル名が指定されていません');
      }
      
      // .envで始まることを確認
      if (!fileName.startsWith('.env')) {
        fileName = `.env.${fileName}`;
      }
      
      // パスの作成
      const filePath = path.join(this._projectPath, fileName);
      
      // ファイルが既に存在するかチェック
      if (fs.existsSync(filePath)) {
        throw new Error(`ファイル ${fileName} は既に存在します`);
      }
      
      // 空のファイルを作成
      fs.writeFileSync(filePath, '', 'utf8');
      
      // 環境変数ファイルを再検出
      this._detectEnvFiles();
      
      // 新しいファイルをアクティブに
      this._activeEnvFile = filePath;
      this._envVariables[filePath] = {};
      
      // WebViewを更新
      await this._updateWebview();
      
      vscode.window.showInformationMessage(`環境変数ファイル ${fileName} を作成しました`);
    } catch (error) {
      Logger.error(`環境変数ファイル作成エラー:`, error as Error);
      await this._showError(`環境変数ファイルの作成に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 環境変数ファイルの選択を処理
   */
  private async _handleSelectEnvFile(filePath: string): Promise<void> {
    try {
      if (!filePath) {
        throw new Error('ファイルパスが指定されていません');
      }
      
      // ファイルが存在するかチェック
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイル ${filePath} が見つかりません`);
      }
      
      // ファイルを読み込む
      await this._loadEnvFile(filePath);
      
      // アクティブファイルを更新
      this._activeEnvFile = filePath;
      
      // WebViewを更新
      await this._updateWebview();
    } catch (error) {
      Logger.error(`環境変数ファイル選択エラー:`, error as Error);
      await this._showError(`環境変数ファイルの選択に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 値の検証を処理
   */
  private async _handleTestConnection(connectionType: string, config: any): Promise<void> {
    try {
      // 検証結果の初期化
      let success = false;
      let message = '';
      const { name, value } = config;
      
      // 値が空の場合はチェック失敗
      if (!value || value.trim() === '') {
        message = '値が設定されていません。適切な値を入力してください。';
        
        // 結果をWebViewに送信
        await this._panel.webview.postMessage({
          command: 'connectionTestResult',
          connectionType,
          success: false,
          message
        });
        
        vscode.window.showWarningMessage(message);
        return;
      }
      
      // 接続タイプに応じた形式の検証（実際の接続テストではなく形式チェック）
      switch (connectionType) {
        case 'database':
          // データベース接続文字列の形式を簡易チェック
          if (value.includes('://') && (
              value.includes('mongodb') || 
              value.includes('postgres') || 
              value.includes('mysql') || 
              value.includes('sqlite')
            )) {
            success = true;
            message = 'データベース接続文字列の形式が有効です。アプリケーション実行時に実際の接続を確認してください。';
          } else {
            success = false;
            message = 'データベース接続文字列の形式が一般的ではありません。「mongodb://user:password@host:port/db」のような形式を確認してください。';
          }
          break;
          
        case 'api':
          // APIキーまたはURLの形式を簡易チェック
          if ((name.toLowerCase().includes('key') && value.length > 10) || 
              (name.toLowerCase().includes('url') && value.includes('://'))) {
            success = true;
            message = 'API設定の形式が有効です。アプリケーション実行時に実際の接続を確認してください。';
          } else {
            success = false;
            message = 'API設定の形式が一般的ではありません。URLの場合は「https://」で始まる完全なURLを、APIキーの場合は発行元から提供された完全なキーを入力してください。';
          }
          break;
          
        case 'smtp':
          // SMTPサーバーの形式を簡易チェック
          if (value.includes('.') && !value.includes('://') && !value.includes(' ')) {
            success = true;
            message = 'SMTPサーバー設定の形式が有効です。アプリケーション実行時に実際の接続を確認してください。';
          } else {
            success = false;
            message = 'SMTPサーバー設定の形式が一般的ではありません。「smtp.example.com」のようなホスト名を入力してください。';
          }
          break;
          
        default:
          // その他の一般的な環境変数
          if (value.length > 0) {
            success = true;
            message = '値が設定されています。アプリケーション実行時に機能を確認してください。';
          } else {
            success = false;
            message = '値が設定されていません。';
          }
      }
      
      // 結果をWebViewに送信
      await this._panel.webview.postMessage({
        command: 'connectionTestResult',
        connectionType,
        success,
        message
      });
      
      // 結果メッセージを表示
      if (success) {
        vscode.window.showInformationMessage(message);
      } else {
        vscode.window.showWarningMessage(message);
      }
    } catch (error) {
      Logger.error(`値の検証エラー:`, error as Error);
      await this._showError(`値の検証に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 環境変数の自動検出を処理
   */
  private async _handleAutoDetectVariables(): Promise<void> {
    try {
      // プロジェクトの種類を検出（例：Node.js, Django, Rails など）
      const projectType = await this._detectProjectType();
      
      // プロジェクトタイプに応じたテンプレート変数を取得
      const templateVariables = this._getTemplateVariables(projectType);
      
      // アクティブファイルがない場合は.envを選択または作成
      if (!this._activeEnvFile) {
        const defaultEnvPath = path.join(this._projectPath, '.env');
        
        if (fs.existsSync(defaultEnvPath)) {
          this._activeEnvFile = defaultEnvPath;
          await this._loadEnvFile(defaultEnvPath);
        } else {
          // .envファイルを作成
          fs.writeFileSync(defaultEnvPath, '', 'utf8');
          this._activeEnvFile = defaultEnvPath;
          this._envVariables[defaultEnvPath] = {};
          this._envFiles.push(defaultEnvPath);
        }
      }
      
      // 既存の変数と結合
      this._envVariables[this._activeEnvFile] = {
        ...this._envVariables[this._activeEnvFile],
        ...templateVariables
      };
      
      // 環境変数データをClaudeCode共有ディレクトリに書き出し
      await this._writeEnvVariablesData();
      
      // WebViewを更新
      await this._updateWebview();
      
      vscode.window.showInformationMessage(`${Object.keys(templateVariables).length}個の環境変数を検出しました`);
    } catch (error) {
      Logger.error(`環境変数自動検出エラー:`, error as Error);
      await this._showError(`環境変数の自動検出に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * すべての環境変数の保存を処理
   */
  private async _handleSaveAllVariables(): Promise<void> {
    try {
      // アクティブファイルがない場合はエラー
      if (!this._activeEnvFile) {
        throw new Error('環境変数ファイルが選択されていません');
      }
      
      // 環境変数ファイルを保存
      await this._saveEnvFile(this._activeEnvFile, this._envVariables[this._activeEnvFile]);
      
      // .env.exampleも作成
      const examplePath = path.join(this._projectPath, '.env.example');
      await this._saveEnvExampleFile(examplePath, this._envVariables[this._activeEnvFile]);
      
      // .gitignoreに.envを追加
      await this._addToGitignore();
      
      // 環境変数データをClaudeCode共有ディレクトリに書き出し
      await this._writeEnvVariablesData();
      
      // 環境変数サマリーを作成
      await this._writeEnvSummary();
      
      vscode.window.showInformationMessage('すべての環境変数を保存しました');
    } catch (error) {
      Logger.error(`すべての環境変数保存エラー:`, error as Error);
      await this._showError(`環境変数の保存に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * DOM構造のキャプチャを処理
   */
  private async _handleCaptureDOMSnapshot(data: any): Promise<void> {
    try {
      // クローン作成して機密情報をマスク
      const snapshot = this._maskSensitiveInfo(data);
      
      // スクリーンショットの保存（data.currentScreenshotがある場合）
      if (data.currentScreenshot) {
        const screenshotsDir = path.join(this._claudeUiDataDir, 'screenshots');
        
        // ディレクトリが存在しない場合は作成
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        
        // スクリーンショットファイルのパス
        const screenshotPath = path.join(screenshotsDir, data.currentScreenshot);
        
        // TODO: 実際のUI画像をキャプチャする
        // 今回はモックデータとして空の画像ファイルを作成
        fs.writeFileSync(screenshotPath, '', 'utf8');
      }
      
      // DOM構造をJSONとして保存
      await this._writeDOMSnapshot(snapshot);
      
      Logger.debug('DOM構造をキャプチャしました');
    } catch (error) {
      Logger.error(`DOM構造キャプチャエラー:`, error as Error);
      // 通知しない（バックグラウンド処理のため）
    }
  }
  
  /**
   * ClaudeCodeアシスタントの起動を処理
   */
  private async _handleLaunchClaudeCodeAssistant(): Promise<void> {
    try {
      // プロンプトファイルを準備
      const promptFilePath = await this._prepareEnvAssistantPrompt();
      
      // ClaudeCodeを起動
      const launcher = ClaudeCodeLauncherService.getInstance();
      const success = await launcher.launchClaudeCodeWithPrompt(
        this._projectPath,
        promptFilePath,
        { title: 'ClaudeCode - 環境変数アシスタント' }
      );
      
      if (success) {
        vscode.window.showInformationMessage('環境変数アシスタント用のClaudeCodeを起動しました');
      } else {
        vscode.window.showErrorMessage('ClaudeCodeの起動に失敗しました');
      }
    } catch (error) {
      Logger.error(`ClaudeCodeアシスタント起動エラー:`, error as Error);
      await this._showError(`ClaudeCodeアシスタントの起動に失敗しました: ${(error as Error).message}`);
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
   * ClaudeCode用のUI共有ディレクトリを初期化
   */
  private async _initializeClaudeUiDataDir(): Promise<void> {
    try {
      // すでに初期化済みならスキップ
      if (this._claudeUiDataDirInitialized) {
        return;
      }
      
      // プロジェクトパスのチェック
      if (!this._projectPath || !fs.existsSync(this._projectPath)) {
        throw new Error('有効なプロジェクトパスが設定されていません');
      }
      
      // ディレクトリパスを構築
      this._claudeUiDataDir = path.join(this._projectPath, '.claude_ui_data');
      
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(this._claudeUiDataDir)) {
        fs.mkdirSync(this._claudeUiDataDir, { recursive: true });
      }
      
      // スクリーンショット用サブディレクトリを作成
      const screenshotsDir = path.join(this._claudeUiDataDir, 'screenshots');
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }
      
      // .gitignoreファイルに追加
      await this._addDirToGitignore('.claude_ui_data/');
      
      // アクションファイルの初期化
      const actionsFilePath = path.join(this._claudeUiDataDir, 'actions.json');
      if (!fs.existsSync(actionsFilePath)) {
        fs.writeFileSync(actionsFilePath, JSON.stringify({
          requestId: 'init',
          timestamp: Date.now(),
          actions: []
        }, null, 2), 'utf8');
      }
      
      // アクション結果ファイルの初期化
      const actionResultsFilePath = path.join(this._claudeUiDataDir, 'action_results.json');
      if (!fs.existsSync(actionResultsFilePath)) {
        fs.writeFileSync(actionResultsFilePath, JSON.stringify({
          requestId: 'init',
          timestamp: Date.now(),
          success: true,
          actions: []
        }, null, 2), 'utf8');
      }
      
      // 初期化完了
      this._claudeUiDataDirInitialized = true;
      Logger.info(`UI共有ディレクトリを初期化しました: ${this._claudeUiDataDir}`);
    } catch (error) {
      Logger.error(`UI共有ディレクトリの初期化に失敗しました`, error as Error);
      throw error;
    }
  }
  
  /**
   * DOM構造の定期キャプチャを開始
   */
  private _startDOMSnapshotCapture(): void {
    // 既存のインターバルがあれば停止
    if (this._domSnapshotInterval) {
      clearInterval(this._domSnapshotInterval);
    }
    
    // WebViewにスナップショット取得リクエストを送信
    this._domSnapshotInterval = setInterval(() => {
      if (this._panel.visible) {
        this._panel.webview.postMessage({ command: 'requestDOMSnapshot' });
      }
    }, 3000); // 3秒ごとに更新
  }
  
  /**
   * アクションファイルの監視を開始
   */
  private _startActionsFileWatch(): void {
    // 既存のウォッチャーがあれば停止
    if (this._fileWatcher) {
      this._fileWatcher.close();
      this._fileWatcher = null;
    }
    
    // アクションファイルパス
    const actionsFilePath = path.join(this._claudeUiDataDir, 'actions.json');
    
    // ファイルが存在しない場合は作成
    if (!fs.existsSync(actionsFilePath)) {
      fs.writeFileSync(actionsFilePath, JSON.stringify({
        requestId: 'init',
        timestamp: Date.now(),
        actions: []
      }, null, 2), 'utf8');
    }
    
    // ファイル変更の監視を開始
    this._fileWatcher = fs.watch(actionsFilePath, (eventType) => {
      if (eventType === 'change') {
        this._processActionsFile();
      }
    });
  }
  
  /**
   * アクションファイルを処理
   */
  private async _processActionsFile(): Promise<void> {
    try {
      // アクションファイルパス
      const actionsFilePath = path.join(this._claudeUiDataDir, 'actions.json');
      
      // ファイルが存在しなければスキップ
      if (!fs.existsSync(actionsFilePath)) {
        return;
      }
      
      // ファイルを読み込み
      const content = fs.readFileSync(actionsFilePath, 'utf8');
      const actionRequest = JSON.parse(content);
      
      // リクエストIDとアクションを取得
      const { requestId, actions } = actionRequest;
      
      // アクションがなければスキップ
      if (!actions || actions.length === 0) {
        return;
      }
      
      // アクション結果
      const actionResults = {
        requestId,
        timestamp: Date.now(),
        success: true,
        actions: [] as any[],
        newDOMSnapshot: false
      };
      
      // アクションを順番に実行
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        
        // アクションをWebViewに転送
        const result = await this._executeAction(action);
        
        // 結果を追加
        actionResults.actions.push({
          index: i,
          success: result.success,
          errorMessage: result.errorMessage,
          screenshot: result.screenshot
        });
        
        // エラーがあれば全体を失敗にする
        if (!result.success) {
          actionResults.success = false;
        }
      }
      
      // 新しいDOM構造があることを示す
      actionResults.newDOMSnapshot = true;
      
      // 結果ファイルに書き込み
      const actionResultsFilePath = path.join(this._claudeUiDataDir, 'action_results.json');
      fs.writeFileSync(actionResultsFilePath, JSON.stringify(actionResults, null, 2), 'utf8');
      
      // アクションファイルをクリア
      fs.writeFileSync(actionsFilePath, JSON.stringify({
        requestId: 'processed',
        timestamp: Date.now(),
        actions: []
      }, null, 2), 'utf8');
    } catch (error) {
      Logger.error(`アクションファイル処理エラー:`, error as Error);
      
      // エラー結果を書き込み
      const actionResultsFilePath = path.join(this._claudeUiDataDir, 'action_results.json');
      fs.writeFileSync(actionResultsFilePath, JSON.stringify({
        requestId: 'error',
        timestamp: Date.now(),
        success: false,
        error: (error as Error).message,
        actions: []
      }, null, 2), 'utf8');
    }
  }
  
  /**
   * アクションを実行
   */
  private async _executeAction(action: any): Promise<{ success: boolean; errorMessage?: string; screenshot?: string }> {
    try {
      // アクションをWebViewに転送
      await this._panel.webview.postMessage({
        command: 'executeAction',
        action
      });
      
      // 実際には、WebViewからの応答を待つ必要があるが、
      // ここではシンプルにするためにタイムアウトを使用
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // スクリーンショットファイル名
      const screenshotName = `screenshot_${Date.now()}.png`;
      
      // WebViewのDOMスナップショットを要求
      await this._panel.webview.postMessage({ command: 'requestDOMSnapshot' });
      
      // スクリーンショット名を返す
      return {
        success: true,
        screenshot: screenshotName
      };
    } catch (error) {
      Logger.error(`アクション実行エラー:`, error as Error);
      return {
        success: false,
        errorMessage: (error as Error).message
      };
    }
  }
  
  /**
   * 機密情報をマスク
   */
  private _maskSensitiveInfo(data: any): any {
    // データをクローン
    const clone = JSON.parse(JSON.stringify(data));
    
    // 要素が配列で、要素があれば処理
    if (Array.isArray(clone.elements)) {
      clone.elements.forEach(element => {
        // 入力要素で値が存在し、かつmaskがtrueの場合はマスク
        if (element.type === 'input' && element.value && element.attributes && element.attributes.mask === 'true') {
          element.value = '********';
        }
      });
    }
    
    return clone;
  }
  
  /**
   * DOM構造をJSONとして書き込み
   */
  private async _writeDOMSnapshot(snapshot: any): Promise<void> {
    try {
      if (!this._claudeUiDataDirInitialized) {
        await this._initializeClaudeUiDataDir();
      }
      
      const domSnapshotPath = path.join(this._claudeUiDataDir, 'dom_structure.json');
      fs.writeFileSync(domSnapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (error) {
      Logger.error(`DOM構造の書き込みに失敗しました`, error as Error);
    }
  }
  
  /**
   * 環境変数データをJSONとして書き込み
   */
  private async _writeEnvVariablesData(): Promise<void> {
    try {
      if (!this._claudeUiDataDirInitialized) {
        await this._initializeClaudeUiDataDir();
      }
      
      // 環境変数モデルの作成
      const envData = {
        timestamp: Date.now(),
        variables: this._generateEnvVariablesModel(),
        groups: this._generateEnvGroups(),
        progress: {
          total: this._countTotalVariables(),
          configured: this._countConfiguredVariables(),
          requiredTotal: this._countRequiredVariables(),
          requiredConfigured: this._countConfiguredRequiredVariables()
        }
      };
      
      // JSONとして書き込み
      const envVariablesPath = path.join(this._claudeUiDataDir, 'env_variables.json');
      fs.writeFileSync(envVariablesPath, JSON.stringify(envData, null, 2), 'utf8');
    } catch (error) {
      Logger.error(`環境変数データの書き込みに失敗しました`, error as Error);
    }
  }
  
  /**
   * 環境変数サマリーを書き込み
   */
  private async _writeEnvSummary(): Promise<void> {
    try {
      if (!this._claudeUiDataDirInitialized) {
        await this._initializeClaudeUiDataDir();
      }
      
      // 環境変数の概要を作成
      const summary = {
        timestamp: Date.now(),
        activeFile: this._activeEnvFile ? path.basename(this._activeEnvFile) : null,
        variableCount: this._countTotalVariables(),
        configuredCount: this._countConfiguredVariables(),
        requiredConfiguredCount: this._countConfiguredRequiredVariables(),
        categories: this._getVariableCategories()
      };
      
      // JSONとして書き込み
      const envSummaryPath = path.join(this._claudeUiDataDir, 'env_summary.json');
      fs.writeFileSync(envSummaryPath, JSON.stringify(summary, null, 2), 'utf8');
    } catch (error) {
      Logger.error(`環境変数サマリーの書き込みに失敗しました`, error as Error);
    }
  }
  
  /**
   * 環境変数アシスタント用のプロンプトを準備
   */
  private async _prepareEnvAssistantPrompt(): Promise<string> {
    try {
      // テンプレートディレクトリの取得
      const platformManager = PlatformManager.getInstance();
      const tempDir = platformManager.getTempDirectory('env-assistant');
      
      // ディレクトリが存在しなければ作成
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // プロンプトファイル名と内容を作成
      const promptPath = path.join(tempDir, `env-assistant-${Date.now()}.md`);
      
      // テンプレートから内容を作成
      const content = this._generateEnvAssistantPrompt();
      
      // ファイルに書き込み
      fs.writeFileSync(promptPath, content, 'utf8');
      
      Logger.info(`環境変数アシスタントプロンプトを作成しました: ${promptPath}`);
      return promptPath;
    } catch (error) {
      Logger.error(`環境変数アシスタントプロンプトの準備に失敗しました`, error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数アシスタント用のプロンプトを生成
   */
  private _generateEnvAssistantPrompt(): string {
    // プロジェクトパスと環境変数ファイルパスを取得
    const projectPath = this._projectPath;
    const envFilePath = this._activeEnvFile || path.join(projectPath, '.env');
    
    // プロンプトを生成
    return `# 環境変数設定アシスタント

あなたは、アプリケーション開発を助ける環境変数設定の専門家です。スコープ実装アシスタントと連携して、プロジェクトが必要とする環境変数の設定と管理を支援します。

## プロジェクト情報

- プロジェクトパス: ${projectPath}
- 環境変数ファイル: ${envFilePath}

## CLAUDE.mdとの連携

CLAUDE.mdファイルには、既に設定済みの環境変数や追加すべき環境変数の情報が記載されている場合があります。この情報を参照し、以下を行ってください：

1. 既存のCLAUDE.mdファイルの内容から環境変数関連情報を探し出す
2. 「環境変数」「API設定」「接続情報」などのセクションがあれば特に注意深く確認
3. 見つかった情報をもとに、設定すべき環境変数のリストを作成

## プロジェクト分析

プロジェクトのコードを分析して、必要な環境変数を特定してください：

1. package.jsonなどの依存関係から使用技術を特定
2. 主要なフレームワークやライブラリが必要とする一般的な環境変数を確認
3. コード内で'process.env'、'env('などの環境変数参照を探す
4. データベース接続設定、API設定、認証情報などの重要設定を確認

## 環境変数設定ガイド

以下のような環境変数カテゴリ別に設定ガイドを提供してください：

### 1. 開発環境設定
- NODE_ENV, DEBUG等の基本設定
- ポート番号、ホスト設定

### 2. データベース接続設定
- データベースURL/接続文字列
- 認証情報（ユーザー名、パスワード）
- データベース名、ポート等

### 3. API連携設定
- APIキー、シークレット
- エンドポイントURL
- 認証トークン

### 4. 認証・セキュリティ設定
- JWTシークレット
- セッション設定
- 暗号化キー

### 5. サードパーティサービス設定
- クラウドサービス認証情報
- 外部APIキー

## ファイル生成と管理

以下のファイル生成と管理方針に従ってください：

1. `.env`ファイル - 実際の値を含む（ローカル開発用）
2. `.env.example`ファイル - サンプル値やプレースホルダーを含む（共有・バージョン管理用）
3. `.gitignore`にこれらのファイルが含まれていることを確認

## CLAUDE.mdへの情報追加

次の形式で環境変数情報をCLAUDE.mdに追加することを提案してください：

\`\`\`markdown
## 環境変数設定

以下の環境変数が必要です：

### 開発環境設定
- NODE_ENV=development - 実行環境設定
- PORT=3000 - サーバーポート番号

### データベース設定
- DB_HOST=localhost - データベースホスト
- DB_PORT=5432 - データベースポート
- DB_USER=pguser - データベースユーザー名
- DB_PASSWORD=******** - データベースパスワード（実際の値で置き換え）
- DB_NAME=myappdb - データベース名

### API設定
- API_KEY=******** - APIキー（実際の値で置き換え）
- API_URL=https://api.example.com - APIエンドポイント

### セキュリティ設定
- JWT_SECRET=******** - JWTシークレットキー（実際の値で置き換え）
- SESSION_SECRET=******** - セッションシークレット（実際の値で置き換え）
\`\`\`

## セキュリティガイドライン

1. 実際の値を含む環境変数ファイルはバージョン管理システムにコミットしないこと
2. 機密情報（パスワード、APIキーなど）はランダムで強力な値を使用すること
3. 開発環境と本番環境の設定は分けて管理すること
4. 環境変数の値はアプリケーション起動時に適切にバリデーションすること

## 具体的な支援内容

1. プロジェクトが必要とする環境変数のリストを作成
2. 各環境変数の目的と適切な値の例を説明
3. 安全な値の生成方法（特に機密情報）を提案
4. 環境変数ファイルの作成と管理方法を案内
5. スコープ実装アシスタントとの連携方法を説明

プロジェクトの種類や使用技術に応じて、適切な環境変数の設定をサポートしてください。ユーザーの質問に対しては明確で具体的な説明と例を提供してください。`;
  }
  
  /**
   * 環境変数ファイルを検出
   */
  private _detectEnvFiles(): void {
    try {
      // プロジェクトパスが設定されていなければスキップ
      if (!this._projectPath) {
        return;
      }
      
      // プロジェクトルートにある.envで始まるファイルを検索
      const files = fs.readdirSync(this._projectPath)
        .filter(file => file.startsWith('.env'))
        .map(file => path.join(this._projectPath, file));
      
      this._envFiles = files;
      
      // .envファイルが存在する場合は読み込み
      const defaultEnvPath = path.join(this._projectPath, '.env');
      if (fs.existsSync(defaultEnvPath)) {
        this._loadEnvFile(defaultEnvPath);
        this._activeEnvFile = defaultEnvPath;
      } else if (files.length > 0) {
        // .envがなく、他の.envファイルがある場合は最初のものを読み込み
        this._loadEnvFile(files[0]);
        this._activeEnvFile = files[0];
      }
      
      Logger.info(`環境変数ファイルを検出しました: ${files.length}個`);
    } catch (error) {
      Logger.error(`環境変数ファイルの検出に失敗しました`, error as Error);
      this._envFiles = [];
      this._activeEnvFile = null;
    }
  }
  
  /**
   * 環境変数ファイルを読み込み
   */
  private async _loadEnvFile(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
      }
      
      // ファイルの内容を読み込む
      const content = await fs.promises.readFile(filePath, 'utf8');
      
      // 環境変数を解析
      this._parseEnvFile(content, filePath);
      
      Logger.info(`環境変数ファイルを読み込みました: ${filePath}`);
    } catch (error) {
      Logger.error('環境変数ファイルの読み込み中にエラーが発生しました', error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数ファイルを解析
   */
  private _parseEnvFile(content: string, filePath: string): void {
    // 内容を行ごとに分割
    const lines = content.split(/\r?\n/);
    const variables: Record<string, string> = {};
    
    // 各行を解析
    lines.forEach(line => {
      // コメント行と空行をスキップ
      if (line.startsWith('#') || line.trim() === '') {
        return;
      }
      
      // KEY=VALUE形式を解析
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2];
        variables[key] = value;
      }
    });
    
    // 解析結果を保存
    this._envVariables[filePath] = variables;
  }
  
  /**
   * 環境変数ファイルを保存
   */
  private async _saveEnvFile(filePath: string, variables: Record<string, string>): Promise<void> {
    try {
      // 環境変数を文字列に変換
      let content = '';
      Object.entries(variables).forEach(([key, value]) => {
        content += `${key}=${value}\n`;
      });
      
      // ファイルに書き込む
      await fs.promises.writeFile(filePath, content, 'utf8');
      
      Logger.info(`環境変数ファイルを保存しました: ${filePath}`);
    } catch (error) {
      Logger.error('環境変数ファイルの保存中にエラーが発生しました', error as Error);
      throw error;
    }
  }
  
  /**
   * 環境変数の例ファイルを保存
   */
  private async _saveEnvExampleFile(filePath: string, variables: Record<string, string>): Promise<void> {
    try {
      // 環境変数を文字列に変換（値はプレースホルダーに）
      let content = '# 環境変数の設定例\n';
      content += '# このファイルをコピーして .env ファイルを作成し、実際の値を設定してください\n';
      content += '# 機密情報（パスワード、APIキーなど）は実際の値に置き換えてください\n\n';
      
      Object.entries(variables).forEach(([key, value]) => {
        // 値が「要設定」マーカーを含む場合はそのまま使用（すでに説明的）
        if (typeof value === 'string' && value.includes('【要設定】')) {
          content += `# ${this._getVariableDescription(key, this._detectVariableCategory(key))}\n`;
          content += `${key}=${value}\n\n`;
        } else {
          // 値をプレースホルダーに置き換え
          const placeholderValue = this._getPlaceholderValue(key, value);
          content += `# ${this._getVariableDescription(key, this._detectVariableCategory(key))}\n`;
          content += `${key}=${placeholderValue}\n\n`;
        }
      });
      
      // ファイルの最後に注意書きを追加
      content += '\n# 注意: このファイルを直接使用せず、.envファイルにコピーして使用してください\n';
      content += '# .envファイルは.gitignoreに追加して、リポジトリにコミットされないようにしてください\n';
      
      // ファイルに書き込む
      await fs.promises.writeFile(filePath, content, 'utf8');
      
      Logger.info(`環境変数例ファイルを保存しました: ${filePath}`);
    } catch (error) {
      Logger.error('環境変数例ファイルの保存中にエラーが発生しました', error as Error);
      throw error;
    }
  }
  
  /**
   * .gitignoreに.envを追加
   */
  private async _addToGitignore(): Promise<void> {
    try {
      // .gitignoreファイルのパス
      const gitignorePath = path.join(this._projectPath, '.gitignore');
      
      // ファイルが存在しない場合は作成
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, '.env\n', 'utf8');
        return;
      }
      
      // 既存の内容を読み込む
      const content = fs.readFileSync(gitignorePath, 'utf8');
      
      // .envが含まれているかチェック
      if (!content.split('\n').some(line => line.trim() === '.env')) {
        // 含まれていなければ追加
        fs.writeFileSync(gitignorePath, content + '\n.env\n', 'utf8');
      }
    } catch (error) {
      Logger.error('.gitignoreの更新に失敗しました', error as Error);
      // 続行する（重要度が低いため）
    }
  }
  
  /**
   * ディレクトリを.gitignoreに追加
   */
  private async _addDirToGitignore(dirPath: string): Promise<void> {
    try {
      // .gitignoreファイルのパス
      const gitignorePath = path.join(this._projectPath, '.gitignore');
      
      // ファイルが存在しない場合は作成
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, `${dirPath}\n`, 'utf8');
        return;
      }
      
      // 既存の内容を読み込む
      const content = fs.readFileSync(gitignorePath, 'utf8');
      
      // 指定したパスが含まれているかチェック
      if (!content.split('\n').some(line => line.trim() === dirPath)) {
        // 含まれていなければ追加
        fs.writeFileSync(gitignorePath, content + `\n${dirPath}\n`, 'utf8');
      }
    } catch (error) {
      Logger.error('.gitignoreの更新に失敗しました', error as Error);
      // 続行する（重要度が低いため）
    }
  }
  
  /**
   * プロジェクトタイプを検出（Node.js, Django, Rails など）
   */
  private async _detectProjectType(): Promise<string> {
    try {
      // package.jsonがあればNode.js
      if (fs.existsSync(path.join(this._projectPath, 'package.json'))) {
        return 'nodejs';
      }
      
      // requirements.txtがあればPython/Django
      if (fs.existsSync(path.join(this._projectPath, 'requirements.txt'))) {
        // django関連ファイルがあればDjango
        if (fs.existsSync(path.join(this._projectPath, 'manage.py'))) {
          return 'django';
        }
        return 'python';
      }
      
      // Gemfileがあれば Ruby/Rails
      if (fs.existsSync(path.join(this._projectPath, 'Gemfile'))) {
        return 'rails';
      }
      
      // 他のプロジェクトタイプも同様に検出
      
      // デフォルトはgeneric
      return 'generic';
    } catch (error) {
      Logger.error('プロジェクトタイプの検出に失敗しました', error as Error);
      return 'generic';
    }
  }
  
  /**
   * プロジェクトタイプに応じたテンプレート変数を取得
   */
  private _getTemplateVariables(projectType: string): Record<string, string> {
    // プロジェクトタイプに応じたテンプレート変数
    switch (projectType) {
      case 'nodejs':
        return {
          'NODE_ENV': 'development',
          'PORT': '3000',
          'DATABASE_URL': '【要設定】例: mongodb://localhost:27017/myapp',
          'API_KEY': '【要設定】実際のAPIキーに置き換えてください',
          'JWT_SECRET': '【要設定】セキュアなランダム文字列を生成してください'
        };
        
      case 'django':
        return {
          'DEBUG': 'True',
          'SECRET_KEY': '【要設定】セキュアなランダム文字列を生成してください',
          'DATABASE_URL': '【要設定】例: postgresql://user:password@localhost:5432/myapp',
          'ALLOWED_HOSTS': 'localhost,127.0.0.1'
        };
        
      case 'rails':
        return {
          'RAILS_ENV': 'development',
          'DATABASE_URL': '【要設定】例: postgresql://user:password@localhost:5432/myapp',
          'SECRET_KEY_BASE': '【要設定】セキュアなランダム文字列を生成してください'
        };
        
      case 'generic':
      default:
        return {
          'APP_ENV': 'development',
          'APP_DEBUG': 'true',
          'APP_PORT': '8080',
          'DB_HOST': 'localhost',
          'DB_PORT': '5432',
          'DB_USER': '【要設定】データベースユーザー名',
          'DB_PASSWORD': '【要設定】データベースパスワード',
          'DB_NAME': 'myapp',
          'API_KEY': '【要設定】実際のAPIキーに置き換えてください'
        };
    }
  }
  
  /**
   * 環境変数名に応じたプレースホルダー値を取得
   */
  private _getPlaceholderValue(key: string, value: string): string {
    // キーに応じて適切なプレースホルダーを返す
    const lowercaseKey = key.toLowerCase();
    
    if (lowercaseKey.includes('password') || lowercaseKey.includes('secret') || lowercaseKey.includes('key')) {
      return 'your-secret-value';
    }
    
    if (lowercaseKey.includes('email')) {
      return 'your-email@example.com';
    }
    
    if (lowercaseKey.includes('url') || lowercaseKey.includes('uri')) {
      // URLの場合は構造を維持するが、認証情報をマスク
      try {
        // URLの形式かチェック
        if (value.includes('://')) {
          const url = new URL(value);
          // ユーザー名とパスワードをマスク
          url.username = 'user';
          url.password = 'password';
          return url.toString();
        }
      } catch (e) {
        // URLでない場合はそのまま
      }
    }
    
    // デフォルトは実際の値を使用（機密でない場合）
    return value;
  }
  
  /**
   * 環境変数モデルを生成
   */
  private _generateEnvVariablesModel(): any[] {
    const variables: any[] = [];
    
    // アクティブファイルがなければ空配列を返す
    if (!this._activeEnvFile || !this._envVariables[this._activeEnvFile]) {
      return variables;
    }
    
    // 環境変数ごとの情報を生成
    Object.entries(this._envVariables[this._activeEnvFile]).forEach(([name, value]) => {
      // 変数の種類を判定
      const category = this._detectVariableCategory(name);
      const isRequired = this._isRequiredVariable(name, category);
      const isSensitive = this._isSensitiveVariable(name);
      
      // 値に要設定マーカーが含まれているかチェック
      const needsConfiguration = typeof value === 'string' && value.includes('【要設定】');
      // 自動生成されたデフォルト値かチェック
      const isDefaultValue = typeof value === 'string' && (
        value === 'your-api-key' || 
        value === 'your-secret-key' || 
        value === 'your-secret-key-base' ||
        value.includes('your-') || 
        value.includes('dbpassword')
      );
      
      // 変数情報を作成
      variables.push({
        name,
        value: isSensitive ? '********' : value, // 機密情報はマスク
        description: this._getVariableDescription(name, category),
        technicalDescription: this._getVariableTechnicalDescription(name, category),
        isRequired,
        
        // 自動化情報
        autoDetected: true,
        autoConfigurable: this._isAutoConfigurable(name, category),
        autoConfigured: !needsConfiguration && !isDefaultValue,
        
        // 検証情報
        validationStatus: needsConfiguration || isDefaultValue ? 'warning' : value ? 'valid' : 'unknown',
        validationMessage: needsConfiguration ? '設定が必要です' : isDefaultValue ? 'デフォルト値から変更してください' : '',
        
        // セキュリティ設定
        isSensitive,
        
        // グループ情報
        groupId: category
      });
    });
    
    return variables;
  }
  
  /**
   * 環境変数グループを生成
   */
  private _generateEnvGroups(): any[] {
    // 基本的なカテゴリグループ
    return [
      {
        id: 'database',
        name: 'データベース設定',
        description: 'データベース接続に関する設定',
        order: 1
      },
      {
        id: 'api',
        name: 'API設定',
        description: 'API連携に関する設定',
        order: 2
      },
      {
        id: 'security',
        name: 'セキュリティ設定',
        description: '認証や暗号化に関する設定',
        order: 3
      },
      {
        id: 'server',
        name: 'サーバー設定',
        description: 'サーバー動作に関する設定',
        order: 4
      },
      {
        id: 'other',
        name: 'その他の設定',
        description: '分類されていない設定',
        order: 5
      }
    ];
  }
  
  /**
   * 変数のカテゴリを検出
   */
  private _detectVariableCategory(name: string): string {
    const lowercaseName = name.toLowerCase();
    
    if (lowercaseName.includes('db') || lowercaseName.includes('database') || lowercaseName.includes('mongo') || lowercaseName.includes('sql')) {
      return 'database';
    }
    
    if (lowercaseName.includes('api') || lowercaseName.includes('endpoint') || lowercaseName.includes('url') || lowercaseName.includes('uri')) {
      return 'api';
    }
    
    if (lowercaseName.includes('secret') || lowercaseName.includes('key') || lowercaseName.includes('token') || lowercaseName.includes('password') || lowercaseName.includes('auth')) {
      return 'security';
    }
    
    if (lowercaseName.includes('port') || lowercaseName.includes('host') || lowercaseName.includes('env') || lowercaseName.includes('debug') || lowercaseName.includes('log')) {
      return 'server';
    }
    
    return 'other';
  }
  
  /**
   * 変数の説明を取得
   */
  private _getVariableDescription(name: string, category: string): string {
    // よく使われる変数名に対する説明
    const descriptions: Record<string, string> = {
      'NODE_ENV': '実行環境（開発/本番）を指定します',
      'PORT': 'アプリケーションが動作するポート番号',
      'DATABASE_URL': 'データベースへの接続URL',
      'API_KEY': 'APIサービスへのアクセスに必要な認証キー',
      'JWT_SECRET': 'JWTトークンの署名に使用する秘密鍵',
      'SECRET_KEY': 'アプリケーションのセキュリティに使用する秘密鍵',
      'DEBUG': 'デバッグモードの有効/無効を設定',
      'ALLOWED_HOSTS': 'アクセスを許可するホスト名のリスト'
    };
    
    // 名前が完全一致する場合は対応する説明を返す
    if (descriptions[name]) {
      return descriptions[name];
    }
    
    // カテゴリに応じた汎用的な説明
    switch (category) {
      case 'database':
        return 'データベース接続に関する設定';
      case 'api':
        return 'API連携に関する設定';
      case 'security':
        return 'セキュリティ関連の設定';
      case 'server':
        return 'サーバー動作に関する設定';
      default:
        return 'アプリケーション設定';
    }
  }
  
  /**
   * 変数の技術的な説明を取得
   */
  private _getVariableTechnicalDescription(name: string, category: string): string {
    // よく使われる変数名に対する技術的な説明
    const descriptions: Record<string, string> = {
      'NODE_ENV': '値には "development", "production", "test" などを指定します。この値によってアプリケーションの動作が変わります。',
      'PORT': 'アプリケーションがリッスンするTCPポート番号。通常は3000, 8080などを使用します。',
      'DATABASE_URL': '形式: "protocol://username:password@host:port/database_name"。例: "postgresql://user:pass@localhost:5432/mydb"',
      'API_KEY': 'APIプロバイダから提供される認証キー。通常は英数字の長い文字列です。',
      'JWT_SECRET': 'JWTトークンの署名と検証に使用される秘密鍵。長くランダムな文字列を使用してください。',
      'SECRET_KEY': 'セッション管理や暗号化に使用される秘密鍵。安全な乱数生成器で生成された値を使用してください。',
      'DEBUG': 'True/Falseまたは1/0で指定。本番環境ではFalseに設定すべきです。',
      'ALLOWED_HOSTS': 'カンマ区切りのホスト名リスト。例: "example.com,www.example.com,localhost"'
    };
    
    // 名前が完全一致する場合は対応する説明を返す
    if (descriptions[name]) {
      return descriptions[name];
    }
    
    // カテゴリに応じた汎用的な説明
    switch (category) {
      case 'database':
        return 'データベースへの接続情報（ホスト、ポート、認証情報など）を指定します。';
      case 'api':
        return 'APIの接続先URLやエンドポイント、認証情報などを指定します。';
      case 'security':
        return 'アプリケーションのセキュリティに関わる設定です。適切な強度の値を使用してください。';
      case 'server':
        return 'サーバーの動作環境やログレベルなどを指定します。';
      default:
        return 'アプリケーション固有の設定値です。';
    }
  }
  
  /**
   * 変数が必須かどうかを判定
   */
  private _isRequiredVariable(name: string, category: string): boolean {
    // 一般的に必須とされる変数名のリスト
    const requiredVars = [
      'NODE_ENV', 'PORT', 'DATABASE_URL', 'API_KEY', 'JWT_SECRET', 'SECRET_KEY', 'DB_PASSWORD'
    ];
    
    // 名前が完全一致する場合は必須
    if (requiredVars.includes(name)) {
      return true;
    }
    
    // データベースとセキュリティカテゴリは基本的に必須
    if (category === 'database' || category === 'security') {
      return true;
    }
    
    return false;
  }
  
  /**
   * 変数が機密情報かどうかを判定
   */
  private _isSensitiveVariable(name: string): boolean {
    const lowercaseName = name.toLowerCase();
    
    // パスワード、キー、トークン、シークレットなどの単語を含む場合は機密
    return lowercaseName.includes('password') ||
      lowercaseName.includes('secret') ||
      lowercaseName.includes('key') ||
      lowercaseName.includes('token') ||
      lowercaseName.includes('auth') ||
      lowercaseName.includes('credentials');
  }
  
  /**
   * 変数が自動設定可能かどうかを判定
   */
  private _isAutoConfigurable(name: string, category: string): boolean {
    // サーバー設定は自動設定可能
    if (category === 'server') {
      return true;
    }
    
    // 一般的に自動設定可能な変数
    const autoConfigurableVars = [
      'NODE_ENV', 'PORT', 'DEBUG', 'APP_ENV', 'APP_DEBUG', 'APP_PORT'
    ];
    
    // 名前が完全一致する場合は自動設定可能
    if (autoConfigurableVars.includes(name)) {
      return true;
    }
    
    // 機密情報は自動設定不可
    if (this._isSensitiveVariable(name)) {
      return false;
    }
    
    return false;
  }
  
  /**
   * 総変数数を取得
   */
  private _countTotalVariables(): number {
    // アクティブファイルがなければ0を返す
    if (!this._activeEnvFile || !this._envVariables[this._activeEnvFile]) {
      return 0;
    }
    
    return Object.keys(this._envVariables[this._activeEnvFile]).length;
  }
  
  /**
   * 設定済み変数数を取得
   */
  private _countConfiguredVariables(): number {
    // アクティブファイルがなければ0を返す
    if (!this._activeEnvFile || !this._envVariables[this._activeEnvFile]) {
      return 0;
    }
    
    // 値が設定されている変数の数をカウント
    return Object.values(this._envVariables[this._activeEnvFile])
      .filter(value => !!value && value !== 'your-api-key' && value !== 'your-secret-key').length;
  }
  
  /**
   * 必須変数数を取得
   */
  private _countRequiredVariables(): number {
    // アクティブファイルがなければ0を返す
    if (!this._activeEnvFile || !this._envVariables[this._activeEnvFile]) {
      return 0;
    }
    
    // 必須変数の数をカウント
    return Object.keys(this._envVariables[this._activeEnvFile])
      .filter(name => this._isRequiredVariable(name, this._detectVariableCategory(name))).length;
  }
  
  /**
   * 設定済み必須変数数を取得
   */
  private _countConfiguredRequiredVariables(): number {
    // アクティブファイルがなければ0を返す
    if (!this._activeEnvFile || !this._envVariables[this._activeEnvFile]) {
      return 0;
    }
    
    // 必須かつ設定済みの変数の数をカウント
    let count = 0;
    
    Object.entries(this._envVariables[this._activeEnvFile]).forEach(([name, value]) => {
      const category = this._detectVariableCategory(name);
      const isRequired = this._isRequiredVariable(name, category);
      
      if (isRequired && !!value && value !== 'your-api-key' && value !== 'your-secret-key') {
        count++;
      }
    });
    
    return count;
  }
  
  /**
   * 変数カテゴリ一覧を取得
   */
  private _getVariableCategories(): any {
    // アクティブファイルがなければ空オブジェクトを返す
    if (!this._activeEnvFile || !this._envVariables[this._activeEnvFile]) {
      return {};
    }
    
    // カテゴリごとの変数数をカウント
    const categories: Record<string, { total: number; configured: number }> = {};
    
    Object.entries(this._envVariables[this._activeEnvFile]).forEach(([name, value]) => {
      const category = this._detectVariableCategory(name);
      
      // カテゴリが存在しなければ初期化
      if (!categories[category]) {
        categories[category] = { total: 0, configured: 0 };
      }
      
      // 総数をカウント
      categories[category].total++;
      
      // 設定済みの場合はカウント
      if (!!value && value !== 'your-api-key' && value !== 'your-secret-key') {
        categories[category].configured++;
      }
    });
    
    return categories;
  }
}