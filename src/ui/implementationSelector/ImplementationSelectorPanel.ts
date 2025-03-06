import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { ImplementationPhaseManager, ImplementationPhase } from '../../modes/implementationMode/implementationPhases';
import { ScopeSelector } from '../../modes/implementationMode/scopeSelector';
import { IImplementationItem, IImplementationScope } from '../../types';
import { FileOperationManager } from '../../utils/fileOperationManager';

/**
 * 実装スコープ選択パネル
 * 実装項目の選択と優先度付けのためのWebViewインターフェース
 */
export class ImplementationSelectorPanel {
  public static currentPanel: ImplementationSelectorPanel | undefined;
  private static readonly viewType = 'implementationSelector';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private _phaseManager: ImplementationPhaseManager;
  private _scopeSelector: ScopeSelector;
  private _fileManager: FileOperationManager;

  // 現在の作業状態
  private _requirementsDocument: string = '';
  private _implementationItems: IImplementationItem[] = [];
  private _selectedMockupHtml: string = '';
  private _selectedFramework: string = 'react';

  /**
   * パネルを作成または表示
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService, projectPath?: string): ImplementationSelectorPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (ImplementationSelectorPanel.currentPanel) {
      ImplementationSelectorPanel.currentPanel._panel.reveal(column);
      
      // プロジェクトパスが指定されている場合は更新
      if (projectPath) {
        ImplementationSelectorPanel.currentPanel._scopeSelector.setProjectPath(projectPath);
        Logger.info(`既存パネルのプロジェクトパスを更新: ${projectPath}`);
      }
      
      return ImplementationSelectorPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      ImplementationSelectorPanel.viewType,
      '実装スコープ選択',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons')
        ]
      }
    );

    ImplementationSelectorPanel.currentPanel = new ImplementationSelectorPanel(panel, extensionUri, aiService, projectPath);
    return ImplementationSelectorPanel.currentPanel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService, projectPath?: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    
    // ビジネスロジックの初期化
    this._phaseManager = new ImplementationPhaseManager();
    this._scopeSelector = new ScopeSelector(aiService);
    this._fileManager = FileOperationManager.getInstance();
    
    // プロジェクトパスが指定されている場合は設定
    if (projectPath) {
      Logger.info(`コンストラクタでプロジェクトパスを設定: ${projectPath}`);
      this._scopeSelector.setProjectPath(projectPath);
    }

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
        try {
          switch (message.command) {
            case 'initialize':
              await this._handleInitialize();
              break;
            case 'setRequirementsDocument':
              await this._handleSetRequirementsDocument(message.text);
              break;
            case 'loadRequirementsFromFile':
              await this._handleLoadRequirementsFromFile();
              break;
            case 'extractItems':
              await this._handleExtractItems();
              break;
            case 'toggleItem':
              this._handleToggleItem(message.id);
              break;
            case 'estimateScope':
              await this._handleEstimateScope();
              break;
            case 'setMockupHtml':
              await this._handleSetMockupHtml(message.html, message.framework);
              break;
            case 'extractRequiredFiles':
              await this._handleExtractRequiredFiles();
              break;
            case 'generateImplementationPlan':
              await this._handleGenerateImplementationPlan();
              break;
            case 'completeSelection':
              await this._handleCompleteSelection();
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
   * 初期化処理
   */
  private async _handleInitialize(): Promise<void> {
    try {
      Logger.info('実装スコープ選択パネルを初期化しています');
      
      // ScopeSelectorのプロジェクトパスを使用する
      const projectPath = this._scopeSelector.getProjectPath();
      
      if (!projectPath) {
        // プロジェクトパスが設定されていない場合はワークスペースフォルダを使用
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (workspaceFolders && workspaceFolders.length > 0) {
          const wsPath = workspaceFolders[0].uri.fsPath;
          this._scopeSelector.setProjectPath(wsPath);
          Logger.info(`プロジェクトパスが未設定のためワークスペースパスを使用: ${wsPath}`);
        }
      }
      
      // 現在のプロジェクトパスを取得（上書きした可能性があるため再取得）
      const currentProjectPath = this._scopeSelector.getProjectPath();
      
      if (currentProjectPath) {
        // 要件定義ファイルを自動的に読み込む
        try {
          const requirementsPath = path.join(currentProjectPath, 'docs', 'requirements.md');
          
          if (fs.existsSync(requirementsPath)) {
            Logger.info(`要件定義ファイルを自動読み込みします: ${requirementsPath}`);
            const content = fs.readFileSync(requirementsPath, 'utf8');
            
            // 要件定義を設定
            this._requirementsDocument = content;
            this._scopeSelector.setRequirementsDocument(content);
            
            // 初期化時にマークダウンマネージャーのスコープセクションも初期化
            const { MarkdownManager } = await import('../../utils/MarkdownManager');
            const markdownManager = MarkdownManager.getInstance();
            markdownManager.initializeScopeSection(currentProjectPath);
            
            // UI上の要件定義を自動的に設定
            await this._panel.webview.postMessage({
              command: 'updateState',
              requirementsDocument: content
            });
            
            vscode.window.showInformationMessage('要件定義ファイルを自動読み込みしました');
            
            // 要件定義を読み込んだら自動的に実装項目を抽出
            setTimeout(async () => {
              try {
                await this._handleExtractItems();
              } catch (extractError) {
                Logger.warn(`実装項目の自動抽出に失敗: ${(extractError as Error).message}`);
              }
            }, 1000); // UIの更新が完了してから抽出を開始するために少し遅延
          } else {
            Logger.info('要件定義ファイルが見つかりません: ' + requirementsPath);
          }
        } catch (fileError) {
          Logger.warn(`要件定義ファイルの自動読み込みに失敗: ${(fileError as Error).message}`);
        }
      }
      
      await this._updateWebview();
    } catch (error) {
      Logger.error('パネル初期化エラー', error as Error);
    }
  }

  /**
   * 要件定義書を設定
   */
  private async _handleSetRequirementsDocument(text: string): Promise<void> {
    try {
      this._requirementsDocument = text;
      
      // プロジェクトパスを設定
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let projectPath = '';
      
      if (workspaceFolders && workspaceFolders.length > 0) {
        projectPath = workspaceFolders[0].uri.fsPath;
      }
      
      // ScopeSelectorにプロジェクトパスと要件定義書を設定
      this._scopeSelector.setProjectPath(projectPath);
      this._scopeSelector.setRequirementsDocument(text);
      
      // UIを更新
      await this._updateWebview();
      
      vscode.window.showInformationMessage('要件定義書を設定しました');
    } catch (error) {
      Logger.error('要件定義書の設定中にエラーが発生しました', error as Error);
      await this._showError(`要件定義書の設定に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ファイルから要件定義書を読み込む
   */
  private async _handleLoadRequirementsFromFile(): Promise<void> {
    try {
      // ファイル選択ダイアログを表示
      const fileUris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'ドキュメント': ['md', 'txt', 'doc', 'docx'],
          'すべてのファイル': ['*']
        },
        title: '要件定義書を選択'
      });

      if (!fileUris || fileUris.length === 0) {
        return;
      }

      // ファイルを読み込む
      const filePath = fileUris[0].fsPath;
      const content = await this._fileManager.readFileAsString(filePath);
      
      // プロジェクトパスを設定
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let projectPath = '';
      
      if (workspaceFolders && workspaceFolders.length > 0) {
        projectPath = workspaceFolders[0].uri.fsPath;
      }
      
      // ScopeSelectorにプロジェクトパスと要件定義書を設定
      this._scopeSelector.setProjectPath(projectPath);
      this._scopeSelector.setRequirementsDocument(content);
      
      // 内部状態も更新
      this._requirementsDocument = content;
      
      // UIを更新
      await this._updateWebview();
      
      vscode.window.showInformationMessage(`要件定義書をファイルから読み込みました: ${path.basename(filePath)}`);
    } catch (error) {
      Logger.error('要件定義書のファイル読み込み中にエラーが発生しました', error as Error);
      await this._showError(`要件定義書の読み込みに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 実装項目の抽出
   */
  private async _handleExtractItems(): Promise<void> {
    try {
      if (!this._requirementsDocument) {
        throw new Error('要件定義書が設定されていません');
      }

      // 抽出中のローディング表示を開始
      await this._panel.webview.postMessage({
        command: 'startExtraction'
      });

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '実装項目を抽出中...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });
          
          // 進捗表示のアップデート
          await this._panel.webview.postMessage({
            command: 'updateExtractionProgress',
            progress: 10
          });
          
          // 実装項目を抽出
          this._implementationItems = await this._scopeSelector.extractImplementationItems();
          
          // 進捗表示のアップデート
          await this._panel.webview.postMessage({
            command: 'updateExtractionProgress',
            progress: 50
          });
          
          progress.report({ increment: 50 });
          
          // UIを更新
          await this._updateWebview();
          
          // タブを実装項目タブに切り替え
          await this._panel.webview.postMessage({
            command: 'switchToItemsTab'
          });
          
          // 進捗表示のアップデート
          await this._panel.webview.postMessage({
            command: 'updateExtractionProgress',
            progress: 75
          });
          
          // 自動的に見積もりも実行
          try {
            await this._handleEstimateScope();
            
            // 進捗表示のアップデート
            await this._panel.webview.postMessage({
              command: 'updateExtractionProgress',
              progress: 100
            });
          } catch (estimateError) {
            Logger.warn(`自動見積もりに失敗: ${(estimateError as Error).message}`);
          }
          
          progress.report({ increment: 100 });
          
          // 処理完了後にローディング表示を終了
          await this._panel.webview.postMessage({
            command: 'completeExtraction'
          });
        }
      );

      vscode.window.showInformationMessage(`${this._implementationItems.length}件の実装項目を抽出しました`);
    } catch (error) {
      Logger.error('実装項目の抽出中にエラーが発生しました', error as Error);
      await this._showError(`実装項目の抽出に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 項目の選択状態を切り替え
   */
  private _handleToggleItem(id: string): void {
    try {
      this._scopeSelector.toggleItemSelection(id);
      this._updateWebview();
    } catch (error) {
      Logger.error('項目の選択状態の切り替え中にエラーが発生しました', error as Error);
      this._showError(`項目の選択状態の切り替えに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * スコープの見積もり
   */
  private async _handleEstimateScope(): Promise<void> {
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'スコープの見積もりを計算中...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });
          
          const scope = await this._scopeSelector.getCurrentScope();
          
          progress.report({ increment: 100 });
          
          // UIを更新
          await this._panel.webview.postMessage({
            command: 'updateEstimate',
            estimatedTime: scope.estimatedTime
          });
        }
      );

      vscode.window.showInformationMessage('スコープの見積もりを更新しました');
    } catch (error) {
      Logger.error('スコープの見積もり中にエラーが発生しました', error as Error);
      await this._showError(`スコープの見積もりに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップHTMLを設定
   */
  private async _handleSetMockupHtml(html: string, framework: string): Promise<void> {
    try {
      this._selectedMockupHtml = html;
      this._selectedFramework = framework || 'react';
      
      // UIを更新
      await this._updateWebview();
      
      vscode.window.showInformationMessage(`モックアップHTMLを設定しました (フレームワーク: ${framework})`);
    } catch (error) {
      Logger.error('モックアップHTMLの設定中にエラーが発生しました', error as Error);
      await this._showError(`モックアップHTMLの設定に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 必要なファイル一覧を抽出
   */
  private async _handleExtractRequiredFiles(): Promise<void> {
    try {
      if (!this._selectedMockupHtml) {
        throw new Error('モックアップHTMLが設定されていません');
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '必要なファイル一覧を抽出中...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });
          
          // 必要なファイル一覧を抽出
          const files = await this._scopeSelector.getRequiredFilesList(
            this._selectedMockupHtml,
            this._selectedFramework
          );
          
          progress.report({ increment: 100 });
          
          // UIを更新
          await this._panel.webview.postMessage({
            command: 'updateRequiredFiles',
            files: files
          });
        }
      );

      vscode.window.showInformationMessage('必要なファイル一覧を抽出しました');
    } catch (error) {
      Logger.error('必要なファイル一覧の抽出中にエラーが発生しました', error as Error);
      await this._showError(`必要なファイル一覧の抽出に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 実装計画を生成
   */
  private async _handleGenerateImplementationPlan(): Promise<void> {
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '実装計画を生成中...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });
          
          // 実装計画を生成
          const plan = await this._scopeSelector.generateImplementationPlan();
          
          progress.report({ increment: 100 });
          
          // UIを更新
          await this._panel.webview.postMessage({
            command: 'updateImplementationPlan',
            plan: plan
          });
        }
      );

      vscode.window.showInformationMessage('実装計画を生成しました');
    } catch (error) {
      Logger.error('実装計画の生成中にエラーが発生しました', error as Error);
      await this._showError(`実装計画の生成に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * スコープ選択の完了
   */
  private async _handleCompleteSelection(): Promise<void> {
    try {
      const selectedItems = this._scopeSelector.getSelectedItems();
      
      if (selectedItems.length === 0) {
        throw new Error('少なくとも1つの項目を選択してください');
      }
      
      // フェーズを完了としてマーク
      this._phaseManager.setPhaseCompletion(ImplementationPhase.SCOPE_SELECTION, true);
      
      // 次のフェーズに進む
      const success = this._phaseManager.advanceToNextPhase();
      
      if (success) {
        vscode.window.showInformationMessage('スコープが選択されました。実装フェーズに移行します。');
        
        // 現在のワークスペースを確認
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let defaultProjectPath = '';
        
        if (workspaceFolders && workspaceFolders.length > 0) {
          defaultProjectPath = workspaceFolders[0].uri.fsPath;
          Logger.debug(`デフォルトのプロジェクトパス: ${defaultProjectPath}`);
        }
        
        // ユーザーにプロジェクトディレクトリを選択してもらう
        const options: vscode.OpenDialogOptions = {
          canSelectMany: false,
          canSelectFiles: false,
          canSelectFolders: true,
          openLabel: 'プロジェクトディレクトリを選択',
          defaultUri: workspaceFolders ? workspaceFolders[0].uri : undefined
        };
        
        let projectPath = defaultProjectPath;
        
        try {
          const fileUri = await vscode.window.showOpenDialog(options);
          
          if (fileUri && fileUri.length > 0) {
            projectPath = fileUri[0].fsPath;
            // パスの存在確認
            const fs = require('fs');
            if (fs.existsSync(projectPath)) {
              vscode.window.showInformationMessage(`プロジェクトディレクトリを設定しました: ${projectPath}`);
              Logger.info(`プロジェクトディレクトリを設定しました: ${projectPath}`);
            } else {
              vscode.window.showWarningMessage(`選択されたパスが存在しません: ${projectPath}。デフォルトのワークスペースを使用します。`);
              projectPath = defaultProjectPath;
            }
          } else {
            vscode.window.showInformationMessage('プロジェクトディレクトリの選択をキャンセルしました。現在のワークスペースを使用します。');
            Logger.info(`プロジェクトディレクトリ選択キャンセル。デフォルトを使用: ${defaultProjectPath}`);
          }
        } catch (error) {
          vscode.window.showWarningMessage(`プロジェクトディレクトリの選択中にエラーが発生しました: ${(error as Error).message}。現在のワークスペースを使用します。`);
          Logger.error(`プロジェクトディレクトリ選択エラー:`, error as Error);
          projectPath = defaultProjectPath;
        }
        
        // プロジェクトパスをScopeSelectorに設定
        this._scopeSelector.setProjectPath(projectPath);
        
        // 選択完了の通知
        const notified = await this._scopeSelector.completeSelection();
        
        if (notified) {
          // スコープ情報を取得
          const currentScope = await this._scopeSelector.getCurrentScope();
        
          // CLAUDE.mdを参照するCLIの起動
          try {
            vscode.window.showInformationMessage('ClaudeCodeを起動しています...');
            
            // CLILauncherServiceのインポート
            const { ClaudeCodeLauncherService } = await import('../../services/ClaudeCodeLauncherService');
            const launcherService = ClaudeCodeLauncherService.getInstance();
            
            // ClaudeCodeを起動（CLAUDE.mdに保存されたスコープを使用）
            const scopeForLaunch: IImplementationScope = {
              id: currentScope.id || '',
              items: currentScope.items,
              selectedIds: currentScope.selectedIds || [],
              estimatedTime: currentScope.estimatedTime || '',
              totalProgress: currentScope.totalProgress || 0,
              startDate: currentScope.startDate,
              targetDate: currentScope.targetDate,
              projectPath: projectPath
            };
            const launchSuccess = await launcherService.launchClaudeCode(scopeForLaunch);
            
            if (launchSuccess) {
              vscode.window.showInformationMessage('ClaudeCodeを起動しました。実装が開始されます。');
            } else {
              // 起動に失敗した場合は開発アシスタントで代替
              vscode.window.showWarningMessage('ClaudeCodeの起動に失敗しました。代わりに開発アシスタントを開きます。');
              vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant');
            }
          } catch (error) {
            // 新しいランチャーでエラーが発生した場合は従来のランチャーを使用
            Logger.error('ClaudeCode起動中にエラーが発生:', error as Error);
            
            try {
              // 従来のCLI起動方法の代わりにClaudeCodeを試す
              vscode.window.showInformationMessage('ClaudeCodeを起動しています...');
              
              const { ClaudeCodeLauncherService } = await import('../../services/ClaudeCodeLauncherService');
              const claudeCodeLauncher = ClaudeCodeLauncherService.getInstance();
              
              // 従来の方法でVSCode設定に保存
              await this.saveToVSCodeSettings({
                id: currentScope.id,
                items: currentScope.items,
                selectedIds: currentScope.selectedIds,
                estimatedTime: currentScope.estimatedTime,
                totalProgress: currentScope.totalProgress,
                startDate: currentScope.startDate,
                targetDate: currentScope.targetDate,
                projectPath
              });
              
              // ClaudeCodeを起動
              const scopeForLaunch: IImplementationScope = {
                id: currentScope.id || '',
                items: currentScope.items,
                selectedIds: currentScope.selectedIds || [],
                estimatedTime: currentScope.estimatedTime || '',
                totalProgress: currentScope.totalProgress || 0,
                startDate: currentScope.startDate,
                targetDate: currentScope.targetDate,
                projectPath: projectPath
              };
              const launchSuccess = await claudeCodeLauncher.launchClaudeCode(scopeForLaunch);
              
              if (launchSuccess) {
                vscode.window.showInformationMessage('AppGenius CLIを起動しました。実装が開始されます。');
              } else {
                // CLIの起動に失敗した場合は開発アシスタントを代わりに開く
                vscode.window.showWarningMessage('CLIの起動に失敗しました。代わりに開発アシスタントを開きます。');
                vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant');
              }
            } catch (fallbackError) {
              // すべての方法が失敗した場合
              Logger.error('すべてのCLI起動方法に失敗:', fallbackError as Error);
              vscode.window.showErrorMessage(`CLI起動エラー: ${(fallbackError as Error).message}。開発アシスタントを開きます。`);
              vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant');
            }
          }
        } else {
          // スコープ完了の通知に失敗した場合は、従来の方法を使用
          vscode.window.showWarningMessage('スコープ通知に失敗しました。従来の方法を使用します。');
          
          // スコープ情報を取得
          const currentScope = await this._scopeSelector.getCurrentScope();
          
          // インプリメンテーションスコープを作成
          const implementationScope = {
            id: currentScope.id || `scope-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            items: selectedItems,
            selectedIds: selectedItems.map(item => item.id),
            estimatedTime: currentScope.estimatedTime,
            totalProgress: 0, // 初期進捗は0
            startDate: new Date().toISOString(),
            targetDate: currentScope.targetDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // デフォルトは1週間後
            projectPath
          };
          
          // 従来の方法でVSCode設定に保存
          await this.saveToVSCodeSettings(implementationScope);
          
          // 従来の方法でCLIを起動
          try {
            vscode.window.showInformationMessage('AppGenius CLIを起動しています...');
            
            // ClaudeCodeLauncherServiceのインポート
            const { ClaudeCodeLauncherService } = await import('../../services/ClaudeCodeLauncherService');
            const claudeCodeLauncher = ClaudeCodeLauncherService.getInstance();
            
            // ClaudeCodeを起動
            const launchSuccess = await claudeCodeLauncher.launchClaudeCode(implementationScope);
            
            if (launchSuccess) {
              vscode.window.showInformationMessage('ClaudeCodeを起動しました。実装が開始されます。');
            } else {
              // ClaudeCodeの起動に失敗した場合は開発アシスタントを代わりに開く
              vscode.window.showWarningMessage('ClaudeCodeの起動に失敗しました。代わりに開発アシスタントを開きます。');
              vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant');
            }
          } catch (error) {
            // エラーが発生した場合のフォールバック
            Logger.error('ClaudeCode起動中にエラーが発生:', error as Error);
            vscode.window.showErrorMessage(`ClaudeCode起動エラー: ${(error as Error).message}。開発アシスタントを開きます。`);
            vscode.commands.executeCommand('appgenius-ai.openDevelopmentAssistant');
          }
        }

        // このパネルを閉じる
        this.dispose();
      } else {
        vscode.window.showInformationMessage('スコープが選択されました。');
      }
    } catch (error) {
      Logger.error('スコープ選択の完了中にエラーが発生しました', error as Error);
      await this._showError(`スコープ選択の完了に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * VSCode設定にスコープ情報を保存（従来のバックアップ方法）
   */
  private async saveToVSCodeSettings(scope: any): Promise<void> {
    try {
      // スコープにIDが含まれていない場合は追加
      if (!scope.id) {
        scope.id = `scope-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      }
      
      // スコープ情報を保存する前に設定をクリア（既存の値が読み込まれない問題を回避）
      await vscode.workspace.getConfiguration('appgeniusAI').update(
        'implementationScope', 
        null, 
        true
      );
      
      // オブジェクトを直接保存
      Logger.debug(`VSCode設定に保存するスコープデータ: ${JSON.stringify(scope).substring(0, 100)}...`);
      
      // スコープ情報を保存
      await vscode.workspace.getConfiguration('appgeniusAI').update(
        'implementationScope', 
        scope, 
        true
      );
      
      Logger.info('実装スコープデータをVSCode設定に保存しました');
      
      // 保存確認
      const verifyData = vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope');
      Logger.debug(`保存後の検証: ${verifyData ? '保存成功' : '保存失敗'}`);
      
      if (!verifyData) {
        vscode.window.showWarningMessage('スコープ情報の保存に問題が発生しました。開発アシスタントに情報が引き継がれない可能性があります。');
      }
      
      // CLI連携のために一時ファイルも作成
      try {
        // ホームディレクトリに.appgenius/tempディレクトリを作成
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const tempDir = path.join(homeDir, '.appgenius', 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // スコープファイルを作成（CLIから直接アクセスできるように）
        const scopeFilePath = path.join(tempDir, `${scope.id}.json`);
        
        // スコープデータをCLI用に変換
        const scopeData = {
          id: scope.id,
          name: `Implementation Scope ${scope.id.substring(0, 8)}`,
          description: `Scope with ${scope.items?.length || 0} items`,
          projectPath: scope.projectPath,
          requirements: scope.items?.map((item: any) => item.description) || [],
          selectedItems: scope.items?.filter((item: any) => scope.selectedIds?.includes(item.id)) || [],
          estimatedTime: scope.estimatedTime,
          startDate: scope.startDate,
          targetDate: scope.targetDate
        };
        
        // ファイルに書き込み
        fs.writeFileSync(scopeFilePath, JSON.stringify(scopeData, null, 2), 'utf8');
        Logger.info(`CLIアクセス用のスコープファイルを作成しました: ${scopeFilePath}`);
      } catch (error) {
        // CLI連携用のファイル作成に失敗しても主要なVSCode設定は保存されているためエラーを無視
        Logger.warn(`CLI連携用のスコープファイル作成に失敗しました: ${(error as Error).message}`);
      }
    } catch (error) {
      Logger.error('実装スコープデータの保存中にエラーが発生しました:', error as Error);
      vscode.window.showErrorMessage(`実装スコープ情報の保存に失敗しました: ${(error as Error).message}`);
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
    try {
      const scope = await this._scopeSelector.getCurrentScope();
      
      await this._panel.webview.postMessage({
        command: 'updateState',
        requirementsDocument: this._requirementsDocument,
        items: scope.items,
        selectedIds: scope.selectedIds,
        estimatedTime: scope.estimatedTime,
        mockupHtml: this._selectedMockupHtml,
        framework: this._selectedFramework
      });
    } catch (error) {
      Logger.error('WebViewの状態更新中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`WebViewの状態更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * WebView用のHTMLを生成
   */
  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    // CSS, JS のURI生成
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
    );
    
    const implementationSelectorCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'implementationSelector.css')
    );

    const implementationSelectorJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'implementationSelector.js')
    );

    // WebViewのHTMLを構築
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>実装スコープ選択</title>
  <link href="${styleResetUri}" rel="stylesheet">
  <link href="${styleVSCodeUri}" rel="stylesheet">
  <link href="${implementationSelectorCssUri}" rel="stylesheet">
  
  <style>
    body {
      padding: 0;
      margin: 0;
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    
    h1, h2, h3 {
      color: var(--vscode-editor-foreground);
      font-weight: normal;
    }
    
    h1 {
      font-size: 1.5em;
      margin-bottom: 1em;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 0.5em;
    }
    
    h2 {
      font-size: 1.3em;
      margin: 1em 0 0.5em 0;
    }
    
    .tab-container {
      margin-top: 20px;
    }
    
    .tab-buttons {
      display: flex;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .tab-button {
      padding: 10px 20px;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--vscode-editor-foreground);
      border-bottom: 2px solid transparent;
    }
    
    .tab-button.active {
      border-bottom: 2px solid var(--vscode-button-background);
      font-weight: bold;
    }
    
    .tab-content {
      display: none;
      padding: 20px 0;
    }
    
    .tab-content.active {
      display: block;
    }
    
    textarea {
      width: 100%;
      min-height: 200px;
      margin-bottom: 20px;
      padding: 10px;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: var(--vscode-editor-line-height);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
    }
    
    .button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 2px;
      cursor: pointer;
      margin-right: 10px;
    }
    
    .button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    .button-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    
    .button-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    .item-list {
      margin-top: 20px;
    }
    
    .item-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 15px;
      display: flex;
      align-items: flex-start;
    }
    
    .item-card.selected {
      border-color: var(--vscode-focusBorder);
      background-color: var(--vscode-editor-selectionBackground);
    }
    
    .item-checkbox {
      margin-right: 15px;
      margin-top: 3px;
    }
    
    .item-content {
      flex: 1;
    }
    
    .item-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .item-description {
      margin-bottom: 10px;
      color: var(--vscode-descriptionForeground);
    }
    
    .item-metadata {
      display: flex;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    
    .item-priority {
      margin-right: 15px;
    }
    
    .priority-high {
      color: var(--vscode-errorForeground);
    }
    
    .priority-medium {
      color: var(--vscode-editorWarning-foreground);
    }
    
    .priority-low {
      color: var(--vscode-editorInfo-foreground);
    }
    
    .summary-section {
      margin-top: 30px;
      padding: 15px;
      background-color: var(--vscode-editorWidget-background);
      border-radius: 4px;
      border: 1px solid var(--vscode-panel-border);
    }
    
    .file-list {
      margin-top: 20px;
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      padding: 10px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .file-item {
      padding: 5px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .file-item:last-child {
      border-bottom: none;
    }
    
    .plan-container {
      margin-top: 20px;
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      padding: 15px;
      max-height: 500px;
      overflow-y: auto;
    }
    
    .error-message {
      color: var(--vscode-errorForeground);
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      padding: 10px;
      margin-top: 10px;
      border-radius: 2px;
    }
    
    .loading-message {
      display: flex;
      align-items: center;
      margin: 20px 0;
      padding: 10px;
      background-color: var(--vscode-editorWidget-background);
      border-radius: 4px;
      border: 1px solid var(--vscode-panel-border);
    }
    
    .loading-spinner {
      width: 20px;
      height: 20px;
      margin-right: 10px;
      border: 3px solid rgba(120, 120, 120, 0.2);
      border-radius: 50%;
      border-top-color: var(--vscode-button-background);
      animation: spin 1s ease-in-out infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .progress-container {
      width: 100%;
      height: 6px;
      background-color: var(--vscode-input-background);
      border-radius: 3px;
      margin: 10px 0;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      background-color: var(--vscode-button-background);
      width: 0%;
      transition: width 0.3s ease;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>実装スコープ選択</h1>
    
    <div class="tab-container">
      <div class="tab-buttons">
        <button id="tab-requirements" class="tab-button active">要件定義</button>
        <button id="tab-items" class="tab-button">実装項目</button>
        <button id="tab-mockup" class="tab-button">モックアップ</button>
        <button id="tab-plan" class="tab-button">実装計画</button>
      </div>
      
      <div id="tab-content-requirements" class="tab-content active">
        <h2>要件定義書</h2>
        <div id="requirements-loading" class="loading-message" style="display: none;">
          <div class="loading-spinner"></div>
          <div>要件定義を処理中...</div>
          <div class="progress-container">
            <div id="requirements-progress" class="progress-bar" style="width: 0%;"></div>
          </div>
        </div>
        <textarea id="requirements-document" placeholder="要件定義書の内容をここに入力してください..." readonly></textarea>
        <div class="button-container">
          <button id="extract-items" class="button">実装項目を抽出</button>
        </div>
      </div>
      
      <div id="tab-content-items" class="tab-content">
        <h2>実装項目</h2>
        <div>実装する項目を選択してください</div>
        <div id="item-list" class="item-list">
          <!-- アイテムがここに動的に生成されます -->
        </div>
        
        <div class="summary-section">
          <h3>選択サマリー</h3>
          <div id="selected-count">選択済み: 0 / 0 項目</div>
          <div id="estimate">推定工数: --</div>
          <div class="button-container" style="margin-top: 15px;">
            <button id="complete-selection" class="button">スコープ選択を完了</button>
          </div>
        </div>
      </div>
      
      <div id="tab-content-mockup" class="tab-content">
        <h2>モックアップ分析</h2>
        <div>モックアップHTMLから必要なファイル一覧を抽出します</div>
        
        <div style="margin-top: 20px;">
          <h3>モックアップHTML</h3>
          <textarea id="mockup-html" placeholder="モックアップHTMLをここに入力してください..."></textarea>
          
          <div style="margin-bottom: 15px;">
            <label for="framework-select">フレームワーク: </label>
            <select id="framework-select" style="padding: 5px;">
              <option value="react">React</option>
              <option value="vue">Vue</option>
              <option value="angular">Angular</option>
              <option value="svelte">Svelte</option>
            </select>
          </div>
          
          <div class="button-container">
            <button id="set-mockup" class="button">設定</button>
            <button id="extract-files" class="button">必要なファイル一覧を抽出</button>
          </div>
        </div>
        
        <div style="margin-top: 30px;">
          <h3>必要なファイル一覧</h3>
          <div id="file-list" class="file-list">
            <!-- ファイル一覧がここに動的に生成されます -->
            <div class="file-item">ファイルはまだ抽出されていません</div>
          </div>
        </div>
      </div>
      
      <div id="tab-content-plan" class="tab-content">
        <h2>実装計画</h2>
        <div>選択された実装項目に基づいて実装計画を生成します</div>
        
        <div class="button-container" style="margin-top: 15px;">
          <button id="generate-plan" class="button">実装計画を生成</button>
        </div>
        
        <div id="plan-container" class="plan-container">
          <!-- 実装計画がここに表示されます -->
          <p>実装計画はまだ生成されていません</p>
        </div>
      </div>
    </div>
  </div>
  
  <script src="${implementationSelectorJsUri}"></script>
</body>
</html>`;
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    ImplementationSelectorPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}