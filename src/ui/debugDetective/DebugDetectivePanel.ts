import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from '../../services/AppGeniusEventBus';
import { ClaudeCodeLauncherService } from '../../services/ClaudeCodeLauncherService';
import { ErrorSessionManager } from './ErrorSessionManager';
import { KnowledgeBaseManager } from './KnowledgeBaseManager';

/**
 * デバッグ探偵パネル
 * エラー検出と解決を支援するシャーロックホームズ風デバッグアシスタント
 */
export class DebugDetectivePanel {
  public static currentPanel: DebugDetectivePanel | undefined;
  private static readonly viewType = 'debugDetective';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _eventBus: AppGeniusEventBus;
  private readonly _errorSessionManager: ErrorSessionManager;
  private readonly _knowledgeBaseManager: KnowledgeBaseManager;
  private readonly _claudeCodeLauncher: ClaudeCodeLauncherService;
  private _disposables: vscode.Disposable[] = [];

  // 作業状態
  private _projectPath: string = '';
  private _currentErrorSession: any = null;
  private _relatedFiles: string[] = [];
  private _detectedErrorType: string = '';

  /**
   * パネルを作成または表示
   */
  public static createOrShow(extensionUri: vscode.Uri, projectPath: string): DebugDetectivePanel {
    try {
      Logger.info(`デバッグ探偵パネル作成開始: projectPath=${projectPath}`);
      
      // プロジェクトパスのチェック
      if (!projectPath || projectPath.trim() === '') {
        Logger.error('プロジェクトパスが指定されていません');
        vscode.window.showErrorMessage('プロジェクトパスが指定されていません。プロジェクトを選択してください。');
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // デバッグプロンプトファイルの存在を確認
      const debugPromptPath = path.join(projectPath, 'docs', 'prompts', 'debug_detective.md');
      if (!fs.existsSync(debugPromptPath)) {
        Logger.warn(`デバッグプロンプトファイルが見つかりません: ${debugPromptPath}`);
        vscode.window.showWarningMessage(`デバッグプロンプトファイル（debug_detective.md）が見つかりません。調査機能が制限されます。`);
      }
      
      const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;
  
      // すでにパネルが存在する場合は、それを表示
      if (DebugDetectivePanel.currentPanel) {
        Logger.info('既存のデバッグ探偵パネルを再表示します');
        DebugDetectivePanel.currentPanel._panel.reveal(column);
        
        // プロジェクトパスが変わっていれば更新
        if (projectPath && DebugDetectivePanel.currentPanel._projectPath !== projectPath) {
          Logger.info(`プロジェクトパスを更新します: ${projectPath}`);
          DebugDetectivePanel.currentPanel._projectPath = projectPath;
          DebugDetectivePanel.currentPanel._update();
        }
        
        return DebugDetectivePanel.currentPanel;
      }
  
      Logger.info('新しいデバッグ探偵パネルを作成します');
      
      // 新しいパネルを作成
      const panel = vscode.window.createWebviewPanel(
        DebugDetectivePanel.viewType,
        'デバッグ探偵 - シャーロックホームズ',
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
        }
      );
  
      Logger.info('デバッグ探偵インスタンスを初期化します');
      try {
        DebugDetectivePanel.currentPanel = new DebugDetectivePanel(panel, extensionUri, projectPath);
        Logger.info('デバッグ探偵パネル作成完了');
        return DebugDetectivePanel.currentPanel;
      } catch (error) {
        // パネルの初期化に失敗した場合、パネルを破棄
        panel.dispose();
        Logger.error('デバッグ探偵インスタンスの初期化に失敗しました', error as Error);
        throw error;
      }
    } catch (error) {
      Logger.error('デバッグ探偵パネル作成エラー', error as Error);
      Logger.error(`エラー詳細: ${error instanceof Error ? error.stack : String(error)}`);
      vscode.window.showErrorMessage(`デバッグ探偵パネルの作成に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, projectPath: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._projectPath = projectPath;
    
    // サービスの初期化
    this._eventBus = AppGeniusEventBus.getInstance();
    this._errorSessionManager = new ErrorSessionManager(projectPath);
    this._knowledgeBaseManager = new KnowledgeBaseManager(projectPath);
    this._claudeCodeLauncher = ClaudeCodeLauncherService.getInstance();
    
    // 初期化処理
    this._initializeDebugDetective();
    
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
          case 'addErrorLog':
            await this._handleAddErrorLog(message.errorLog);
            break;
          case 'scanErrorLog':
            await this._handleScanErrorLog(message.errorLog);
            break;
          case 'startInvestigation':
            await this._handleStartInvestigation(message.sessionId, message.selectedFiles);
            break;
          case 'applySolution':
            await this._handleApplySolution(message.solutionId, message.fileChanges);
            break;
          case 'markAsResolved':
            await this._handleMarkAsResolved(message.sessionId, message.saveAsKnowledge);
            break;
          case 'addToKnowledgeBase':
            await this._handleAddToKnowledgeBase(message.knowledge);
            break;
          case 'browseKnowledge':
            await this._handleBrowseKnowledge(message.filter);
            break;
          case 'runBackendTest':
            await this._handleRunBackendTest(message.testCommand);
            break;
          case 'runFrontendTest':
            await this._handleRunFrontendTest(message.testCommand);
            break;
          case 'getErrorSessions':
            await this._handleGetErrorSessions();
            break;
          case 'saveTerminalOutput':
            await this._handleSaveTerminalOutput();
            break;
          case 'detectErrorType':
            await this._handleDetectErrorType(message.errorLog);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * デバッグ探偵初期化
   */
  private async _initializeDebugDetective(): Promise<void> {
    try {
      Logger.info(`デバッグ探偵の初期化を開始します。プロジェクトパス: ${this._projectPath}`);
      
      // プロジェクトパスの検証
      if (!this._projectPath || this._projectPath.trim() === '') {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      Logger.info('ログディレクトリの作成を開始します');
      // ログディレクトリの作成
      await this._ensureDebugDirectories();
      
      Logger.info('エラーセッションマネージャーの初期化を開始します');
      // エラーセッション初期化
      await this._errorSessionManager.initialize();
      
      Logger.info('知見ベースマネージャーの初期化を開始します');
      // 知見ベース初期化
      await this._knowledgeBaseManager.initialize();
      
      // デバッグプロンプトファイルの存在を確認
      const debugPromptPath = path.join(this._projectPath, 'docs', 'prompts', 'debug_detective.md');
      Logger.info(`デバッグプロンプトファイルをチェックします: ${debugPromptPath}`);
      if (!fs.existsSync(debugPromptPath)) {
        Logger.warn(`デバッグプロンプトファイルが見つかりません: ${debugPromptPath}`);
        vscode.window.showWarningMessage(`デバッグプロンプトファイルが見つかりません: debug_detective.md`);
      } else {
        Logger.info(`デバッグプロンプトファイルを確認しました: ${debugPromptPath}`);
      }
      
      Logger.info(`デバッグ探偵を初期化しました。プロジェクトパス: ${this._projectPath}`);
    } catch (error) {
      Logger.error('デバッグ探偵初期化エラー', error as Error);
      Logger.error(`エラー詳細: ${error instanceof Error ? error.stack : String(error)}`);
      vscode.window.showErrorMessage(`デバッグ探偵の初期化に失敗しました: ${(error as Error).message}`);
      // エラーを再スローして呼び出し元でも検知できるようにする
      throw error;
    }
  }

  /**
   * デバッグディレクトリの作成
   */
  private async _ensureDebugDirectories(): Promise<void> {
    try {
      Logger.info(`デバッグディレクトリの作成を開始します: プロジェクトパス=${this._projectPath}`);
      
      // logs/debugディレクトリの作成
      const logsPath = path.join(this._projectPath, 'logs');
      const debugPath = path.join(logsPath, 'debug');
      const sessionsPath = path.join(debugPath, 'sessions');
      const archivedPath = path.join(debugPath, 'archived');
      const knowledgePath = path.join(debugPath, 'knowledge');
      
      Logger.info(`logsPathを作成します: ${logsPath}`);
      if (!fs.existsSync(logsPath)) {
        fs.mkdirSync(logsPath, { recursive: true });
        Logger.info(`logsPathを新規作成しました: ${logsPath}`);
      } else {
        Logger.info(`logsPathは既に存在します: ${logsPath}`);
      }
      
      Logger.info(`debugPathを作成します: ${debugPath}`);
      if (!fs.existsSync(debugPath)) {
        fs.mkdirSync(debugPath, { recursive: true });
        Logger.info(`debugPathを新規作成しました: ${debugPath}`);
      } else {
        Logger.info(`debugPathは既に存在します: ${debugPath}`);
      }
      
      Logger.info(`sessionsPathを作成します: ${sessionsPath}`);
      if (!fs.existsSync(sessionsPath)) {
        fs.mkdirSync(sessionsPath, { recursive: true });
        Logger.info(`sessionsPathを新規作成しました: ${sessionsPath}`);
      } else {
        Logger.info(`sessionsPathは既に存在します: ${sessionsPath}`);
      }
      
      Logger.info(`archivedPathを作成します: ${archivedPath}`);
      if (!fs.existsSync(archivedPath)) {
        fs.mkdirSync(archivedPath, { recursive: true });
        Logger.info(`archivedPathを新規作成しました: ${archivedPath}`);
      } else {
        Logger.info(`archivedPathは既に存在します: ${archivedPath}`);
      }
      
      Logger.info(`knowledgePathを作成します: ${knowledgePath}`);
      if (!fs.existsSync(knowledgePath)) {
        fs.mkdirSync(knowledgePath, { recursive: true });
        Logger.info(`knowledgePathを新規作成しました: ${knowledgePath}`);
      } else {
        Logger.info(`knowledgePathは既に存在します: ${knowledgePath}`);
      }
      
      // ディレクトリが正しく作成されたか確認
      const dirs = [logsPath, debugPath, sessionsPath, archivedPath, knowledgePath];
      for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
          throw new Error(`ディレクトリの作成に失敗しました: ${dir}`);
        }
      }
      
      // .gitkeepファイルを作成して空ディレクトリをgitで追跡できるようにする
      fs.writeFileSync(path.join(sessionsPath, '.gitkeep'), '', 'utf8');
      fs.writeFileSync(path.join(archivedPath, '.gitkeep'), '', 'utf8');
      fs.writeFileSync(path.join(knowledgePath, '.gitkeep'), '', 'utf8');
      
      Logger.info(`デバッグディレクトリを作成しました: ${debugPath}`);
    } catch (error) {
      Logger.error('デバッグディレクトリ作成エラー', error as Error);
      throw error;
    }
  }

  /**
   * エラーログの追加処理
   */
  private async _handleAddErrorLog(errorLog: string): Promise<void> {
    try {
      if (!errorLog || errorLog.trim() === '') {
        throw new Error('エラーログが空です');
      }
      
      // エラーセッションを作成
      const sessionId = await this._errorSessionManager.createSession(errorLog);
      
      // エラーの種類を検出
      const errorType = await this._detectErrorType(errorLog);
      
      // 関連ファイルを自動検出
      const detectedFiles = await this._detectRelatedFiles(errorLog);
      
      // エラーセッション情報を更新
      await this._errorSessionManager.updateSession(sessionId, {
        errorType,
        relatedFiles: detectedFiles
      });
      
      // 現在のセッションを更新
      this._currentErrorSession = await this._errorSessionManager.getSession(sessionId);
      this._relatedFiles = detectedFiles;
      this._detectedErrorType = errorType;
      
      // UI更新
      await this._updateWebview();
      
      // 作成済みセッションIDを通知
      await this._panel.webview.postMessage({
        command: 'errorSessionCreated',
        sessionId,
        errorType,
        relatedFiles: detectedFiles
      });
      
      Logger.info(`エラーセッションを作成しました: ${sessionId}`);
    } catch (error) {
      Logger.error('エラーログ追加エラー', error as Error);
      await this._showError(`エラーログの追加に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * エラーログのスキャン処理
   */
  private async _handleScanErrorLog(errorLog: string): Promise<void> {
    try {
      if (!errorLog || errorLog.trim() === '') {
        throw new Error('エラーログが空です');
      }
      
      // エラーの種類を検出
      const errorType = await this._detectErrorType(errorLog);
      
      // 関連ファイルを自動検出
      const relatedFiles = await this._detectRelatedFiles(errorLog);
      
      // 類似のエラーセッションを検索
      const similarSessions = await this._errorSessionManager.findSimilarSessions(errorLog);
      
      // 類似エラーの知見を検索
      const relatedKnowledge = await this._knowledgeBaseManager.findRelatedKnowledge(errorLog, errorType);
      
      // 結果を通知
      await this._panel.webview.postMessage({
        command: 'scanResult',
        errorType,
        relatedFiles,
        similarSessions,
        relatedKnowledge
      });
      
      Logger.info(`エラーログをスキャンしました`);
    } catch (error) {
      Logger.error('エラーログスキャンエラー', error as Error);
      await this._showError(`エラーログのスキャンに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 調査開始処理
   */
  private async _handleStartInvestigation(sessionId: string, selectedFiles: string[]): Promise<void> {
    try {
      if (!sessionId) {
        throw new Error('セッションIDが指定されていません');
      }
      
      // セッション情報の取得
      const session = await this._errorSessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`セッションが見つかりません: ${sessionId}`);
      }
      
      // 選択されたファイルを更新
      if (selectedFiles && selectedFiles.length > 0) {
        await this._errorSessionManager.updateSession(sessionId, {
          relatedFiles: selectedFiles
        });
      }
      
      // 調査用プロンプトを作成
      const debugPromptPath = path.join(this._projectPath, 'docs', 'prompts', 'debug_detective.md');
      
      // プロンプトファイルの存在確認
      if (!fs.existsSync(debugPromptPath)) {
        Logger.error(`デバッグプロンプトファイルが見つかりません: ${debugPromptPath}`);
        throw new Error(`デバッグプロンプトファイル（debug_detective.md）が見つかりません。docs/prompts/debug_detective.mdを確認してください。`);
      }
      
      // 実際のファイル内容を読み込み
      const relatedFilesContent = await this._loadRelatedFilesContent(
        selectedFiles.length > 0 ? selectedFiles : session.relatedFiles
      );
      
      // エラー情報とファイル内容を結合したプロンプトを作成
      const tempDir = path.join(this._projectPath, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const combinedPromptPath = path.join(
        tempDir, 
        `combined_debug_${Date.now()}.md`
      );
      
      Logger.info(`デバッグプロンプトファイルを読み込みます: ${debugPromptPath}`);
      let combinedContent = fs.readFileSync(debugPromptPath, 'utf8');
      combinedContent += '\n\n# エラー情報\n\n```\n';
      combinedContent += session.errorLog;
      combinedContent += '\n```\n\n';
      
      combinedContent += '# 関連ファイル\n\n';
      for (const [filePath, content] of Object.entries(relatedFilesContent)) {
        combinedContent += `## ${filePath}\n\n`;
        combinedContent += '```\n';
        combinedContent += content;
        combinedContent += '\n```\n\n';
      }
      
      Logger.info(`調査用プロンプトを作成します: ${combinedPromptPath}`);
      fs.writeFileSync(combinedPromptPath, combinedContent, 'utf8');
      
      // 調査ステータスを更新
      await this._errorSessionManager.updateSession(sessionId, {
        status: 'investigating',
        investigationStartTime: new Date().toISOString()
      });
      
      // ClaudeCodeを起動
      Logger.info(`ClaudeCodeを起動します: ${combinedPromptPath}`);
      await this._claudeCodeLauncher.launchClaudeCodeWithPrompt(
        this._projectPath,
        combinedPromptPath,
        { title: `デバッグ探偵 - 調査中: ${session.errorType || '不明なエラー'}` }
      );
      
      // UI更新
      this._currentErrorSession = await this._errorSessionManager.getSession(sessionId);
      await this._updateWebview();
      
      Logger.info(`調査を開始しました: ${sessionId}`);
    } catch (error) {
      Logger.error('調査開始エラー', error as Error);
      Logger.error(`エラー詳細: ${error instanceof Error ? error.stack : String(error)}`);
      await this._showError(`調査の開始に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 解決策適用処理
   */
  private async _handleApplySolution(solutionId: string, fileChanges: any[]): Promise<void> {
    try {
      if (!solutionId) {
        throw new Error('解決策IDが指定されていません');
      }
      
      if (!fileChanges || fileChanges.length === 0) {
        throw new Error('ファイル変更が指定されていません');
      }
      
      // ファイル変更を適用
      for (const change of fileChanges) {
        const { filePath, oldContent, newContent } = change;
        
        // ファイルが存在することを確認
        const fullPath = path.isAbsolute(filePath) 
          ? filePath 
          : path.join(this._projectPath, filePath);
          
        if (!fs.existsSync(fullPath)) {
          // 新規ファイルの場合はディレクトリを作成
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // 新規ファイルを作成
          fs.writeFileSync(fullPath, newContent, 'utf8');
          Logger.info(`新規ファイルを作成しました: ${fullPath}`);
        } else {
          // 既存ファイルを更新
          const currentContent = fs.readFileSync(fullPath, 'utf8');
          
          // 現在の内容とoldContentが一致するか確認
          if (currentContent !== oldContent) {
            // 警告を表示し、確認を求める
            const answer = await vscode.window.showWarningMessage(
              `ファイル「${path.basename(filePath)}」の内容が変更されています。上書きしますか？`,
              { modal: true },
              '上書きする',
              'キャンセル'
            );
            
            if (answer !== '上書きする') {
              continue;
            }
          }
          
          // ファイルを更新
          fs.writeFileSync(fullPath, newContent, 'utf8');
          Logger.info(`ファイルを更新しました: ${fullPath}`);
        }
      }
      
      // 解決策適用ステータスを更新
      const sessionId = solutionId.split('-')[0]; // セッションIDを取得
      await this._errorSessionManager.updateSession(sessionId, {
        solutionApplied: true,
        solutionAppliedTime: new Date().toISOString()
      });
      
      // UI更新
      this._currentErrorSession = await this._errorSessionManager.getSession(sessionId);
      await this._updateWebview();
      
      // 解決策適用通知
      await this._panel.webview.postMessage({
        command: 'solutionApplied',
        sessionId,
        success: true
      });
      
      Logger.info(`解決策を適用しました: ${solutionId}`);
      vscode.window.showInformationMessage('解決策を適用しました。確認テストを実行してください。');
    } catch (error) {
      Logger.error('解決策適用エラー', error as Error);
      await this._showError(`解決策の適用に失敗しました: ${(error as Error).message}`);
      
      // エラー通知
      await this._panel.webview.postMessage({
        command: 'solutionApplied',
        success: false,
        error: (error as Error).message
      });
    }
  }

  /**
   * 解決済みマーク処理
   */
  private async _handleMarkAsResolved(sessionId: string, saveAsKnowledge: boolean): Promise<void> {
    try {
      if (!sessionId) {
        throw new Error('セッションIDが指定されていません');
      }
      
      // セッション情報の取得
      const session = await this._errorSessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`セッションが見つかりません: ${sessionId}`);
      }
      
      // 解決済みステータスを更新
      await this._errorSessionManager.updateSession(sessionId, {
        status: 'resolved',
        resolvedTime: new Date().toISOString()
      });
      
      // 知見として保存する場合
      if (saveAsKnowledge && session.errorType) {
        // 知見ベースに追加
        await this._knowledgeBaseManager.addKnowledge({
          title: `${session.errorType} の解決`,
          errorType: session.errorType,
          problem: session.errorLog,
          solution: session.solution || '手動で解決されました',
          relatedFiles: session.relatedFiles || [],
          tags: [session.errorType],
          createdAt: new Date().toISOString()
        });
        
        Logger.info(`知見ベースに追加しました: ${session.errorType}`);
      }
      
      // 48時間後にアーカイブするタイマーを設定
      setTimeout(async () => {
        try {
          await this._errorSessionManager.archiveSession(sessionId);
          Logger.info(`セッションをアーカイブしました: ${sessionId}`);
        } catch (e) {
          Logger.error(`セッションアーカイブエラー: ${sessionId}`, e as Error);
        }
      }, 48 * 60 * 60 * 1000); // 48時間
      
      // UI更新
      this._currentErrorSession = await this._errorSessionManager.getSession(sessionId);
      await this._updateWebview();
      
      // 解決済み通知
      await this._panel.webview.postMessage({
        command: 'sessionResolved',
        sessionId,
        saveAsKnowledge
      });
      
      Logger.info(`解決済みとしてマークしました: ${sessionId}`);
      vscode.window.showInformationMessage(
        saveAsKnowledge 
          ? 'エラーを解決済みとしてマークし、知見ベースに追加しました。'
          : 'エラーを解決済みとしてマークしました。'
      );
    } catch (error) {
      Logger.error('解決済みマークエラー', error as Error);
      await this._showError(`解決済みマークに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 知見ベースに追加処理
   */
  private async _handleAddToKnowledgeBase(knowledge: any): Promise<void> {
    try {
      if (!knowledge) {
        throw new Error('知見情報が指定されていません');
      }
      
      // 必須フィールドの確認
      if (!knowledge.title || !knowledge.problem || !knowledge.solution) {
        throw new Error('知見のタイトル、問題、解決策は必須です');
      }
      
      // 知見ベースに追加
      const knowledgeId = await this._knowledgeBaseManager.addKnowledge({
        ...knowledge,
        createdAt: new Date().toISOString()
      });
      
      // UI更新
      await this._panel.webview.postMessage({
        command: 'knowledgeAdded',
        knowledgeId
      });
      
      Logger.info(`知見を追加しました: ${knowledgeId}`);
      vscode.window.showInformationMessage('知見ベースに追加しました。');
    } catch (error) {
      Logger.error('知見追加エラー', error as Error);
      await this._showError(`知見の追加に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 知見ベース閲覧処理
   */
  private async _handleBrowseKnowledge(filter?: any): Promise<void> {
    try {
      // 知見ベースのすべての知見を取得
      const knowledgeList = await this._knowledgeBaseManager.getAllKnowledge(filter);
      
      // UI更新
      await this._panel.webview.postMessage({
        command: 'knowledgeList',
        knowledgeList
      });
      
      Logger.info(`知見ベースを取得しました: ${knowledgeList.length}件`);
    } catch (error) {
      Logger.error('知見ベース閲覧エラー', error as Error);
      await this._showError(`知見ベースの取得に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * バックエンドテスト実行処理
   */
  private async _handleRunBackendTest(testCommand?: string): Promise<void> {
    try {
      // テストコマンドが指定されていない場合はデフォルトを使用
      const command = testCommand || 'npm test';
      
      // ターミナルで実行
      const terminal = vscode.window.createTerminal('バックエンドテスト');
      terminal.show();
      
      // プロジェクトディレクトリに移動
      terminal.sendText(`cd "${this._projectPath}"`);
      
      // テストコマンドを実行
      terminal.sendText(command);
      
      Logger.info(`バックエンドテストを実行しました: ${command}`);
      vscode.window.showInformationMessage(`バックエンドテストを実行しています: ${command}`);
    } catch (error) {
      Logger.error('バックエンドテスト実行エラー', error as Error);
      await this._showError(`バックエンドテストの実行に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * フロントエンドテスト実行処理
   */
  private async _handleRunFrontendTest(testCommand?: string): Promise<void> {
    try {
      // テストコマンドが指定されていない場合はデフォルトを使用
      const command = testCommand || 'npm run test:frontend';
      
      // ターミナルで実行
      const terminal = vscode.window.createTerminal('フロントエンドテスト');
      terminal.show();
      
      // プロジェクトディレクトリに移動
      terminal.sendText(`cd "${this._projectPath}"`);
      
      // テストコマンドを実行
      terminal.sendText(command);
      
      Logger.info(`フロントエンドテストを実行しました: ${command}`);
      vscode.window.showInformationMessage(`フロントエンドテストを実行しています: ${command}`);
    } catch (error) {
      Logger.error('フロントエンドテスト実行エラー', error as Error);
      await this._showError(`フロントエンドテストの実行に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * エラーセッション一覧取得処理
   */
  private async _handleGetErrorSessions(): Promise<void> {
    try {
      // エラーセッション一覧を取得
      const sessions = await this._errorSessionManager.getAllSessions();
      
      // UI更新
      await this._panel.webview.postMessage({
        command: 'errorSessions',
        sessions
      });
      
      Logger.info(`エラーセッション一覧を取得しました: ${sessions.length}件`);
    } catch (error) {
      Logger.error('エラーセッション一覧取得エラー', error as Error);
      await this._showError(`エラーセッション一覧の取得に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ターミナル出力保存処理
   */
  private async _handleSaveTerminalOutput(): Promise<void> {
    try {
      // クリップボードからターミナル出力を取得するよう促す
      vscode.window.showInformationMessage(
        'ターミナル出力をクリップボードにコピーし、テキストエリアに貼り付けてください。'
      );
    } catch (error) {
      Logger.error('ターミナル出力保存エラー', error as Error);
      await this._showError(`ターミナル出力の保存に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * エラータイプ検出処理
   */
  private async _handleDetectErrorType(errorLog: string): Promise<void> {
    try {
      if (!errorLog || errorLog.trim() === '') {
        throw new Error('エラーログが空です');
      }
      
      // エラーの種類を検出
      const errorType = await this._detectErrorType(errorLog);
      
      // UI更新
      await this._panel.webview.postMessage({
        command: 'errorTypeDetected',
        errorType
      });
      
      Logger.info(`エラータイプを検出しました: ${errorType}`);
    } catch (error) {
      Logger.error('エラータイプ検出エラー', error as Error);
      await this._showError(`エラータイプの検出に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * エラーの種類を検出
   */
  private async _detectErrorType(errorLog: string): Promise<string> {
    // エラーパターンの定義
    const errorPatterns = [
      { pattern: /(TypeError|ReferenceError|SyntaxError|RangeError)/i, type: '構文エラー' },
      { pattern: /(ENOENT|EACCES|EPERM|EEXIST)/i, type: 'ファイルシステムエラー' },
      { pattern: /(Cannot find module|Module not found)/i, type: 'モジュールエラー' },
      { pattern: /(Connection refused|ECONNREFUSED|timeout|ETIMEDOUT)/i, type: '接続エラー' },
      { pattern: /(Uncaught|unhandled)/i, type: '未処理例外' },
      { pattern: /(undefined is not a function|is not a function)/i, type: '型エラー' },
      { pattern: /(DatabaseError|MongoError|SequelizeError|PrismaClientKnownRequestError)/i, type: 'データベースエラー' },
      { pattern: /(AUTH_|Authorization|Authentication|token|jwt)/i, type: '認証エラー' },
      { pattern: /(Cannot read property|Cannot access|is undefined)/i, type: 'プロパティアクセスエラー' },
      { pattern: /(Component|React|Vue|Angular|DOM)/i, type: 'UIコンポーネントエラー' },
      { pattern: /(404|500|403|401|422|400)/i, type: 'HTTPエラー' },
      { pattern: /(npm ERR|yarn error|package.json)/i, type: 'パッケージ管理エラー' },
      { pattern: /(webpack|babel|rollup|vite|esbuild)/i, type: 'ビルドエラー' },
      { pattern: /(test|expect|assert|describe|it\(|test\()/i, type: 'テストエラー' },
      { pattern: /(memory leak|Out of memory|heap)/i, type: 'メモリエラー' },
      { pattern: /(TypeScript|TS|type annotations|interface)/i, type: '型定義エラー' },
      { pattern: /(lint|eslint|tslint|prettier)/i, type: 'リントエラー' },
      { pattern: /(環境変数|env|process.env|Environment)/i, type: '環境変数エラー' },
    ];
    
    // エラーパターンを順に検査
    for (const { pattern, type } of errorPatterns) {
      if (pattern.test(errorLog)) {
        return type;
      }
    }
    
    // デフォルト
    return '不明なエラー';
  }

  /**
   * エラーに関連するファイルを検出
   */
  private async _detectRelatedFiles(errorLog: string): Promise<string[]> {
    try {
      const relatedFiles: string[] = [];
      
      // ファイルパスのパターンを検出
      const filePathPatterns = [
        /(?:at |from |in |file |path:)([^()\n:]+\.(?:js|ts|jsx|tsx|vue|html|css|scss|json))/gi,
        /([a-zA-Z0-9_\-/.]+\.(?:js|ts|jsx|tsx|vue|html|css|scss|json))(?::(\d+))?(?::(\d+))?/gi,
        /(?:import|require|from) ['"]([^'"]+)['"]/gi,
        /(?:load|open|read|write|access) ['"]([^'"]+)['"]/gi
      ];
      
      // パターンごとに検出
      for (const pattern of filePathPatterns) {
        let match;
        while ((match = pattern.exec(errorLog)) !== null) {
          const filePath = match[1].trim();
          
          // 絶対パスかどうかをチェック
          const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this._projectPath, filePath);
            
          // ファイルが存在するか確認
          try {
            if (fs.existsSync(fullPath)) {
              // 重複を避けて追加
              if (!relatedFiles.includes(fullPath)) {
                relatedFiles.push(fullPath);
              }
            } else {
              // プロジェクト内を検索
              const foundFile = await this._searchFileInProject(filePath);
              if (foundFile && !relatedFiles.includes(foundFile)) {
                relatedFiles.push(foundFile);
              }
            }
          } catch (e) {
            // エラー処理は行わない
          }
        }
      }
      
      // パッケージ.jsonを検索（モジュールエラーの場合）
      if (errorLog.includes('Cannot find module') || errorLog.includes('Module not found')) {
        const packageJsonPath = path.join(this._projectPath, 'package.json');
        if (fs.existsSync(packageJsonPath) && !relatedFiles.includes(packageJsonPath)) {
          relatedFiles.push(packageJsonPath);
        }
      }
      
      // 環境変数を検索（環境変数エラーの場合）
      if (errorLog.includes('process.env') || errorLog.includes('環境変数')) {
        const envPaths = [
          path.join(this._projectPath, '.env'),
          path.join(this._projectPath, '.env.local'),
          path.join(this._projectPath, '.env.development'),
          path.join(this._projectPath, '.env.production')
        ];
        
        for (const envPath of envPaths) {
          if (fs.existsSync(envPath) && !relatedFiles.includes(envPath)) {
            relatedFiles.push(envPath);
          }
        }
      }
      
      return relatedFiles;
    } catch (error) {
      Logger.error('関連ファイル検出エラー', error as Error);
      return [];
    }
  }

  /**
   * プロジェクト内のファイルを検索
   */
  private async _searchFileInProject(fileName: string): Promise<string | null> {
    try {
      // ファイル名のみを取得
      const baseFileName = path.basename(fileName);
      
      // ファイル名に拡張子が含まれていない場合は一般的な拡張子を追加
      const searchPatterns = baseFileName.includes('.')
        ? [baseFileName]
        : [
            `${baseFileName}.js`,
            `${baseFileName}.ts`,
            `${baseFileName}.jsx`,
            `${baseFileName}.tsx`,
            `${baseFileName}.vue`,
            `${baseFileName}.html`,
            `${baseFileName}.css`,
            `${baseFileName}.scss`,
            `${baseFileName}.json`
          ];
          
      // VS Codeの検索APIを使用
      for (const pattern of searchPatterns) {
        const uris = await vscode.workspace.findFiles(
          `**/${pattern}`,
          '**/node_modules/**',
          10
        );
        
        if (uris.length > 0) {
          return uris[0].fsPath;
        }
      }
      
      return null;
    } catch (error) {
      Logger.error('ファイル検索エラー', error as Error);
      return null;
    }
  }

  /**
   * 関連ファイルの内容を読み込む
   */
  private async _loadRelatedFilesContent(filePaths: string[]): Promise<Record<string, string>> {
    const contents: Record<string, string> = {};
    
    for (const filePath of filePaths) {
      try {
        // ファイルが存在するか確認
        if (!fs.existsSync(filePath)) {
          continue;
        }
        
        // ファイルの内容を読み込む
        const content = fs.readFileSync(filePath, 'utf8');
        
        // ファイルサイズが大きすぎる場合は最初の1000行だけ読み込む
        const lines = content.split('\n');
        const truncatedContent = lines.length > 1000
          ? lines.slice(0, 1000).join('\n') + '\n... (truncated)'
          : content;
          
        contents[filePath] = truncatedContent;
      } catch (error) {
        Logger.error(`ファイル読み込みエラー: ${filePath}`, error as Error);
      }
    }
    
    return contents;
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
      // エラーセッション一覧を取得
      const sessions = await this._errorSessionManager.getAllSessions();
      
      // 知見ベース一覧を取得
      const knowledgeBase = await this._knowledgeBaseManager.getAllKnowledge();
      
      await this._panel.webview.postMessage({
        command: 'updateState',
        currentErrorSession: this._currentErrorSession,
        relatedFiles: this._relatedFiles,
        detectedErrorType: this._detectedErrorType,
        sessions,
        knowledgeBase,
        projectPath: this._projectPath
      });
    } catch (error) {
      Logger.error(`WebView状態更新エラー`, error as Error);
      // 最低限のメッセージを送信
      await this._panel.webview.postMessage({
        command: 'showError',
        message: 'デバッグデータの読み込み中にエラーが発生しました。'
      });
    }
  }

  /**
   * WebView用のHTMLを生成
   */
  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    try {
      // WebView内でのリソースへのパスを取得
      const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'debugDetective.js')
      );
      const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'debugDetective.css')
      );
      const resetCssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
      );
      const vscodeCssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
      );
      
      // シャーロックアイコンのパスを取得
      const sherlockIconPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'assets', 'sherlock.svg');
      const sherlockIconExists = fs.existsSync(sherlockIconPath.fsPath);
      
      // アイコンが存在する場合のみURIを取得
      const sherlockIconUri = sherlockIconExists 
        ? webview.asWebviewUri(sherlockIconPath)
        : webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg')); // フォールバックアイコン

    // WebViewのHTMLを構築
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline'; frame-src https:;">
  <title>デバッグ探偵 - シャーロックホームズ</title>
  <link href="${resetCssUri}" rel="stylesheet">
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <div class="detective-container">
    <!-- ヘッダー -->
    <div class="header">
      <div class="header-title">
        <img src="${sherlockIconUri}" alt="シャーロックホームズ" class="sherlock-icon">
        <h1>デバッグ探偵 - シャーロックホームズ</h1>
      </div>
      <div class="header-actions">
        <button id="refresh-btn" class="button">
          <i class="icon">🔄</i> 更新
        </button>
      </div>
    </div>
    
    <!-- メインコンテンツ -->
    <div class="content">
      <!-- タブメニュー -->
      <div class="tabs">
        <button class="tab-button active" data-tab="error-session">エラーセッション</button>
        <button class="tab-button" data-tab="solution">解決策</button>
        <button class="tab-button" data-tab="knowledge-base">知見ベース</button>
        <button class="tab-button" data-tab="test">テスト実行</button>
      </div>
      
      <!-- タブコンテンツ -->
      <div class="tab-content">
        <!-- エラーセッションタブ -->
        <div class="tab-pane active" id="error-session-tab">
          <div class="error-input-section">
            <h2>エラー情報入力</h2>
            <div class="error-input">
              <textarea id="error-log" placeholder="エラーログをここに貼り付けてください..."></textarea>
              <div class="button-group">
                <button id="scan-error-btn" class="button secondary">
                  <i class="icon">🔍</i> エラースキャン
                </button>
                <button id="add-error-btn" class="button primary">
                  <i class="icon">➕</i> エラー追加
                </button>
              </div>
              <div class="or-separator">または</div>
              <div class="button-group">
                <button id="load-log-btn" class="button">
                  <i class="icon">📄</i> ログファイルを選択
                </button>
                <button id="save-terminal-btn" class="button">
                  <i class="icon">📋</i> ターミナル出力を取得
                </button>
              </div>
            </div>
          </div>
          
          <div class="error-sessions-section">
            <h2>エラーセッション一覧</h2>
            <div id="error-sessions-container" class="error-sessions-container">
              <!-- エラーセッション一覧が動的に表示されます -->
              <div class="loading">
                <div class="loading-spinner"></div>
                <div>エラーセッションを読み込み中...</div>
              </div>
            </div>
          </div>
          
          <div class="current-session-section" id="current-session-section" style="display: none;">
            <h2>現在のエラーセッション</h2>
            <div id="current-session-container" class="current-session-container">
              <!-- 現在のエラーセッションが表示されます -->
            </div>
          </div>
          
          <div class="related-files-section" id="related-files-section" style="display: none;">
            <h2>関連ファイル（自動検出）</h2>
            <div id="related-files-container" class="related-files-container">
              <!-- 関連ファイル一覧が表示されます -->
            </div>
            <div class="button-group">
              <button id="start-investigation-btn" class="button primary">
                <i class="icon">🕵️</i> 事件を調査する
              </button>
            </div>
          </div>
        </div>
        
        <!-- 解決策タブ -->
        <div class="tab-pane" id="solution-tab">
          <div class="solution-section">
            <h2>解決策</h2>
            <div id="solution-container" class="solution-container">
              <!-- 解決策が表示されます -->
              <div class="empty-state">
                <i class="icon large">🔍</i>
                <p>エラーセッションを選択して調査を開始してください。</p>
              </div>
            </div>
          </div>
          
          <div class="solution-actions" id="solution-actions" style="display: none;">
            <button id="apply-solution-btn" class="button primary">
              <i class="icon">✅</i> 解決策を適用
            </button>
            <button id="mark-resolved-btn" class="button secondary">
              <i class="icon">✓</i> 解決済みにする
            </button>
            <div class="checkbox-group">
              <input type="checkbox" id="save-knowledge" checked>
              <label for="save-knowledge">知見として保存</label>
            </div>
          </div>
        </div>
        
        <!-- 知見ベースタブ -->
        <div class="tab-pane" id="knowledge-base-tab">
          <div class="knowledge-filter-section">
            <h2>知見フィルター</h2>
            <div class="filter-controls">
              <div class="search-box">
                <input type="text" id="knowledge-search" placeholder="キーワード検索...">
                <button id="search-knowledge-btn" class="button">
                  <i class="icon">🔍</i> 検索
                </button>
              </div>
              <div class="filter-group">
                <label>エラータイプ:</label>
                <select id="error-type-filter">
                  <option value="">すべて</option>
                  <option value="構文エラー">構文エラー</option>
                  <option value="ファイルシステムエラー">ファイルシステムエラー</option>
                  <option value="モジュールエラー">モジュールエラー</option>
                  <option value="接続エラー">接続エラー</option>
                  <option value="未処理例外">未処理例外</option>
                  <option value="データベースエラー">データベースエラー</option>
                  <option value="認証エラー">認証エラー</option>
                  <option value="環境変数エラー">環境変数エラー</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="knowledge-list-section">
            <h2>知見ベース一覧</h2>
            <div id="knowledge-list-container" class="knowledge-list-container">
              <!-- 知見一覧が表示されます -->
              <div class="loading">
                <div class="loading-spinner"></div>
                <div>知見ベースを読み込み中...</div>
              </div>
            </div>
          </div>
          
          <div class="knowledge-detail-section" id="knowledge-detail-section" style="display: none;">
            <h2>知見詳細</h2>
            <div id="knowledge-detail-container" class="knowledge-detail-container">
              <!-- 知見詳細が表示されます -->
            </div>
          </div>
          
          <div class="knowledge-add-section">
            <button id="add-knowledge-btn" class="button primary">
              <i class="icon">➕</i> 新しい知見を追加
            </button>
          </div>
        </div>
        
        <!-- テスト実行タブ -->
        <div class="tab-pane" id="test-tab">
          <div class="test-section">
            <h2>テスト実行</h2>
            <div class="test-container">
              <div class="test-group">
                <h3>バックエンドテスト</h3>
                <div class="test-input">
                  <input type="text" id="backend-test-command" placeholder="npm test" value="npm test">
                  <button id="run-backend-test-btn" class="button primary">
                    <i class="icon">▶️</i> 実行
                  </button>
                </div>
                <div class="test-description">
                  <p>サーバーサイドのテストを実行します。API、データベース接続、認証などの機能をテストします。</p>
                </div>
              </div>
              
              <div class="test-group">
                <h3>フロントエンドテスト</h3>
                <div class="test-input">
                  <input type="text" id="frontend-test-command" placeholder="npm run test:frontend" value="npm run test:frontend">
                  <button id="run-frontend-test-btn" class="button primary">
                    <i class="icon">▶️</i> 実行
                  </button>
                </div>
                <div class="test-description">
                  <p>UIコンポーネント、レンダリング、状態管理などのフロントエンド機能をテストします。</p>
                </div>
              </div>
              
              <div class="test-group">
                <h3>タイプチェック</h3>
                <div class="test-input">
                  <input type="text" id="typecheck-command" placeholder="npm run typecheck" value="npm run typecheck">
                  <button id="run-typecheck-btn" class="button primary">
                    <i class="icon">▶️</i> 実行
                  </button>
                </div>
                <div class="test-description">
                  <p>TypeScriptの型チェックを実行します。型の不一致や未定義の変数などを検出します。</p>
                </div>
              </div>
              
              <div class="test-group">
                <h3>リント</h3>
                <div class="test-input">
                  <input type="text" id="lint-command" placeholder="npm run lint" value="npm run lint">
                  <button id="run-lint-btn" class="button primary">
                    <i class="icon">▶️</i> 実行
                  </button>
                </div>
                <div class="test-description">
                  <p>コードの品質をチェックします。コードスタイルやベストプラクティスの違反を検出します。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 新規知見追加モーダル -->
  <div id="add-knowledge-modal" class="modal">
    <div class="modal-content">
      <h2>新規知見追加</h2>
      <form id="add-knowledge-form">
        <div class="form-group">
          <label for="knowledge-title">タイトル <span style="color: #e74c3c;">*</span></label>
          <input type="text" id="knowledge-title" required placeholder="例: MongoDB接続タイムアウトエラーの解決">
        </div>
        <div class="form-group">
          <label for="knowledge-error-type">エラータイプ <span style="color: #e74c3c;">*</span></label>
          <select id="knowledge-error-type" required>
            <option value="構文エラー">構文エラー</option>
            <option value="ファイルシステムエラー">ファイルシステムエラー</option>
            <option value="モジュールエラー">モジュールエラー</option>
            <option value="接続エラー">接続エラー</option>
            <option value="未処理例外">未処理例外</option>
            <option value="型エラー">型エラー</option>
            <option value="データベースエラー">データベースエラー</option>
            <option value="認証エラー">認証エラー</option>
            <option value="プロパティアクセスエラー">プロパティアクセスエラー</option>
            <option value="UIコンポーネントエラー">UIコンポーネントエラー</option>
            <option value="HTTPエラー">HTTPエラー</option>
            <option value="パッケージ管理エラー">パッケージ管理エラー</option>
            <option value="ビルドエラー">ビルドエラー</option>
            <option value="テストエラー">テストエラー</option>
            <option value="メモリエラー">メモリエラー</option>
            <option value="型定義エラー">型定義エラー</option>
            <option value="リントエラー">リントエラー</option>
            <option value="環境変数エラー">環境変数エラー</option>
            <option value="その他">その他</option>
          </select>
        </div>
        <div class="form-group">
          <label for="knowledge-problem">問題 <span style="color: #e74c3c;">*</span></label>
          <textarea id="knowledge-problem" required rows="5" placeholder="エラーの内容や発生状況を詳しく記述してください"></textarea>
        </div>
        <div class="form-group">
          <label for="knowledge-solution">解決策 <span style="color: #e74c3c;">*</span></label>
          <textarea id="knowledge-solution" required rows="5" placeholder="問題の解決方法や対策を詳しく記述してください"></textarea>
        </div>
        <div class="form-group">
          <label for="knowledge-tags">タグ（カンマ区切り）</label>
          <input type="text" id="knowledge-tags" placeholder="例: MongoDB, タイムアウト, 接続">
        </div>
        <div class="form-actions">
          <button type="button" class="button secondary" id="cancel-add-knowledge">キャンセル</button>
          <button type="submit" class="button primary">追加</button>
        </div>
      </form>
    </div>
  </div>
  
  <!-- スクリプト -->
  <script src="${scriptUri}"></script>
</body>
</html>`;
    } catch (error) {
      Logger.error(`WebView HTML生成エラー`, error as Error);
      // エラーが発生した場合のシンプルなフォールバックHTMLを返す
      return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>デバッグ探偵 - シャーロックホームズ</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .error { color: #c25450; margin: 20px 0; padding: 10px; border: 1px solid #c25450; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>デバッグ探偵 - シャーロックホームズ</h1>
  <div class="error">
    <h2>エラーが発生しました</h2>
    <p>デバッグ探偵の初期化中にエラーが発生しました。開発ログを確認してください。</p>
    <button onclick="window.location.reload()">再読み込み</button>
  </div>
</body>
</html>`;
    }
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    DebugDetectivePanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}