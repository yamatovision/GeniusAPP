import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger';
import { FileOperationManager } from '../../utils/fileOperationManager';
import { ScopeItemStatus, IImplementationItem, IImplementationScope } from '../../types';
import { ClaudeCodeLauncherService } from '../../services/ClaudeCodeLauncherService';

/**
 * スコープマネージャーパネルクラス
 * CURRENT_STATUS.mdファイルと連携して実装スコープの管理を行う
 */
export class ScopeManagerPanel {
  public static currentPanel: ScopeManagerPanel | undefined;
  private static readonly viewType = 'scopeManager';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private _projectPath: string = '';
  private _fileManager: FileOperationManager;
  private _statusFilePath: string = '';
  private _scopes: any[] = [];
  private _selectedScopeIndex: number = -1;
  private _currentScope: any = null;
  private _directoryStructure: string = '';

  /**
   * パネルを作成または表示
   */
  public static createOrShow(extensionUri: vscode.Uri, projectPath?: string): ScopeManagerPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (ScopeManagerPanel.currentPanel) {
      ScopeManagerPanel.currentPanel._panel.reveal(column);
      
      // プロジェクトパスが指定されている場合は更新
      if (projectPath) {
        ScopeManagerPanel.currentPanel.setProjectPath(projectPath);
      }
      
      return ScopeManagerPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      ScopeManagerPanel.viewType,
      'スコープマネージャー',
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

    ScopeManagerPanel.currentPanel = new ScopeManagerPanel(panel, extensionUri, projectPath);
    return ScopeManagerPanel.currentPanel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, projectPath?: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._fileManager = FileOperationManager.getInstance();
    
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
            case 'selectScope':
              await this._handleSelectScope(message.index);
              break;
            case 'updateScopeStatus':
              await this._handleUpdateScopeStatus(message.scopeId, message.status, message.progress);
              break;
            case 'toggleFileStatus':
              await this._handleToggleFileStatus(message.filePath, message.completed);
              break;
            case 'startImplementation':
              await this._handleStartImplementation();
              break;
            case 'editScope':
              await this._handleEditScope(message.scopeData);
              break;
            case 'showDirectoryStructure':
              await this._handleShowDirectoryStructure();
              break;
            case 'addNewScope':
              await this._handleAddNewScope();
              break;
            case 'launchScopeCreator':
              await this._handleLaunchScopeCreator();
              break;
            case 'launchImplementationAssistant':
              await this._handleLaunchImplementationAssistant();
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
   * プロジェクトパスを設定する
   */
  public setProjectPath(projectPath: string): void {
    this._projectPath = projectPath;
    this._statusFilePath = path.join(projectPath, 'docs', 'CURRENT_STATUS.md');
    
    Logger.info(`プロジェクトパスを設定しました: ${projectPath}`);
    Logger.info(`ステータスファイルパス: ${this._statusFilePath}`);

    // パスが設定されたらステータスファイルを読み込む
    this._loadStatusFile();
  }

  /**
   * CURRENT_STATUS.mdファイルを読み込む
   */
  private async _loadStatusFile(): Promise<void> {
    try {
      if (!this._statusFilePath || !fs.existsSync(this._statusFilePath)) {
        Logger.warn(`ステータスファイルが見つかりません: ${this._statusFilePath}`);
        return;
      }

      // ファイルの内容を読み込む
      const content = await this._fileManager.readFileAsString(this._statusFilePath);
      
      // ステータスファイルからスコープ情報を解析
      this._parseStatusFile(content);
      
      // WebViewを更新
      this._updateWebview();
    } catch (error) {
      Logger.error('ステータスファイルの読み込み中にエラーが発生しました', error as Error);
    }
  }

  /**
   * ステータスファイルからスコープ情報を解析
   */
  private _parseStatusFile(content: string): void {
    try {
      this._scopes = [];
      let currentSection = '';
      let completedScopes: any[] = [];
      let inProgressScopes: any[] = [];
      let pendingScopes: any[] = [];
      let directoryStructure = '';
      let completedFiles: string[] = [];
      let inProgressFiles: string[] = [];
      
      // 行ごとに処理
      const lines = content.split(/\r?\n/);
      let i = 0;
      
      while (i < lines.length) {
        const line = lines[i];
        
        // セクションヘッダーを検出
        if (line.startsWith('## ')) {
          currentSection = line.substring(3).trim();
          i++;
          continue;
        }
        
        // スコープセクションの処理
        if (currentSection === 'スコープ状況') {
          if (line.startsWith('### 完了済みスコープ')) {
            i++;
            while (i < lines.length && !lines[i].startsWith('###')) {
              const scopeLine = lines[i].trim();
              if (scopeLine.match(/- \[x\] (.+?) \(100%\)/)) {
                const name = scopeLine.match(/- \[x\] (.+?) \(100%\)/)![1];
                completedScopes.push({
                  name,
                  status: 'completed',
                  progress: 100
                });
              }
              i++;
            }
            continue;
          } else if (line.startsWith('### 進行中スコープ')) {
            i++;
            while (i < lines.length && !lines[i].startsWith('###')) {
              const scopeLine = lines[i].trim();
              const match = scopeLine.match(/- \[ \] (.+?) \((\d+)%\)/);
              if (match) {
                const name = match[1];
                const progress = parseInt(match[2]);
                inProgressScopes.push({
                  name,
                  status: 'in-progress',
                  progress
                });
              }
              i++;
            }
            continue;
          } else if (line.startsWith('### 未着手スコープ')) {
            i++;
            while (i < lines.length && !lines[i].startsWith('##')) {
              const scopeLine = lines[i].trim();
              const match = scopeLine.match(/- \[ \] (.+?) \(0%\)/);
              if (match) {
                const name = match[1];
                pendingScopes.push({
                  name,
                  status: 'pending',
                  progress: 0
                });
              }
              i++;
            }
            continue;
          }
        }
        
        // ディレクトリ構造セクションの処理
        if (currentSection === '現在のディレクトリ構造') {
          if (line.startsWith('```')) {
            i++;
            let structureContent = '';
            while (i < lines.length && !lines[i].startsWith('```')) {
              structureContent += lines[i] + '\n';
              i++;
            }
            directoryStructure = structureContent;
            this._directoryStructure = structureContent;
          }
        }
        
        // 実装完了ファイルセクションの処理
        if (currentSection === '実装完了ファイル') {
          if (line.trim().startsWith('- ✅ ')) {
            const filePath = line.match(/- ✅ (.+?) \(/)?.[1];
            if (filePath) {
              completedFiles.push(filePath);
            }
          }
        }
        
        // 実装中ファイルセクションの処理
        if (currentSection === '実装中ファイル') {
          if (line.trim().startsWith('- ⏳ ')) {
            const filePath = line.match(/- ⏳ (.+?) \(/)?.[1];
            if (filePath) {
              inProgressFiles.push(filePath);
            }
          }
        }
        
        // 現在のスコープ情報の処理
        if (currentSection === '引継ぎ情報') {
          if (line.startsWith('### 現在のスコープ:')) {
            const scopeName = line.substring('### 現在のスコープ:'.length).trim();
            let scopeId = '';
            let description = '';
            let priority = '';
            let estimatedTime = '';
            let features = [];
            let files = [];
            
            i++;
            while (i < lines.length && !lines[i].startsWith('##')) {
              const currentLine = lines[i];
              
              if (currentLine.startsWith('**スコープID**:')) {
                scopeId = currentLine.substring('**スコープID**:'.length).trim();
              } else if (currentLine.startsWith('**説明**:')) {
                description = currentLine.substring('**説明**:'.length).trim();
              } else if (currentLine.startsWith('**優先度**:')) {
                priority = currentLine.substring('**優先度**:'.length).trim();
              } else if (currentLine.startsWith('**見積作業時間**:')) {
                estimatedTime = currentLine.substring('**見積作業時間**:'.length).trim();
              } else if (currentLine.startsWith('**含まれる機能**:')) {
                i++;
                while (i < lines.length && /^\d+\. /.test(lines[i])) {
                  features.push(lines[i].replace(/^\d+\. /, '').trim());
                  i++;
                }
                continue;
              } else if (currentLine.startsWith('**実装すべきファイル**:')) {
                i++;
                while (i < lines.length && lines[i].trim().startsWith('- [')) {
                  const fileMatch = lines[i].match(/- \[([ x])\] (.+)/);
                  if (fileMatch) {
                    const completed = fileMatch[1] === 'x';
                    const filePath = fileMatch[2];
                    files.push({
                      path: filePath,
                      completed
                    });
                  }
                  i++;
                }
                continue;
              }
              
              i++;
            }
            
            // 現在進行中のスコープを選択
            const found = [...completedScopes, ...inProgressScopes, ...pendingScopes].find(s => s.name.includes(scopeName));
            if (found) {
              this._currentScope = {
                ...found,
                id: scopeId,
                description,
                priority,
                estimatedTime,
                features,
                files
              };
            }
            
            continue;
          }
        }
        
        i++;
      }
      
      // すべてのスコープをまとめる
      this._scopes = [...completedScopes, ...inProgressScopes, ...pendingScopes];
      
      // スコープにインデックス情報を追加
      this._scopes.forEach((scope, index) => {
        scope.index = index;
        
        // 現在のスコープを特定
        if (this._currentScope && scope.name.includes(this._currentScope.name)) {
          this._selectedScopeIndex = index;
        }
      });
      
      Logger.info(`${this._scopes.length}個のスコープを読み込みました`);
      
      if (this._selectedScopeIndex >= 0) {
        Logger.info(`現在のスコープ: ${this._scopes[this._selectedScopeIndex].name}`);
      }
    } catch (error) {
      Logger.error('ステータスファイルの解析中にエラーが発生しました', error as Error);
    }
  }

  /**
   * 初期化処理
   */
  private async _handleInitialize(): Promise<void> {
    try {
      Logger.info('スコープマネージャーパネルを初期化しています');
      
      // プロジェクトパスが設定されていない場合はワークスペースフォルダを使用
      if (!this._projectPath) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (workspaceFolders && workspaceFolders.length > 0) {
          const wsPath = workspaceFolders[0].uri.fsPath;
          this.setProjectPath(wsPath);
          Logger.info(`プロジェクトパスが未設定のためワークスペースパスを使用: ${wsPath}`);
        }
      }
      
      // ステータスファイルを読み込む
      await this._loadStatusFile();
      
      // WebViewを更新
      this._updateWebview();
    } catch (error) {
      Logger.error('パネル初期化エラー', error as Error);
    }
  }

  /**
   * スコープを選択
   */
  private async _handleSelectScope(index: number): Promise<void> {
    try {
      if (index < 0 || index >= this._scopes.length) {
        throw new Error('無効なスコープインデックスです');
      }
      
      this._selectedScopeIndex = index;
      this._currentScope = this._scopes[index];
      
      // WebViewを更新
      this._updateWebview();
      
      Logger.info(`スコープを選択しました: ${this._currentScope.name}`);
    } catch (error) {
      Logger.error('スコープ選択中にエラーが発生しました', error as Error);
      await this._showError(`スコープの選択に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * スコープのステータスを更新
   */
  private async _handleUpdateScopeStatus(scopeId: string, status: string, progress: number): Promise<void> {
    try {
      if (this._selectedScopeIndex < 0) {
        throw new Error('スコープが選択されていません');
      }
      
      // 選択中のスコープのステータスを更新
      this._scopes[this._selectedScopeIndex].status = status;
      this._scopes[this._selectedScopeIndex].progress = progress;
      this._currentScope.status = status;
      this._currentScope.progress = progress;
      
      // CURRENT_STATUS.mdファイルを更新
      await this._updateStatusFile();
      
      // WebViewを更新
      this._updateWebview();
      
      Logger.info(`スコープステータスを更新しました: ${status}, 進捗: ${progress}%`);
    } catch (error) {
      Logger.error('スコープステータスの更新中にエラーが発生しました', error as Error);
      await this._showError(`スコープステータスの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ファイルのステータスを切り替え
   */
  private async _handleToggleFileStatus(filePath: string, completed: boolean): Promise<void> {
    try {
      if (!this._currentScope) {
        throw new Error('スコープが選択されていません');
      }
      
      // ファイルのステータスを更新
      const fileIndex = this._currentScope.files.findIndex((f: any) => f.path === filePath);
      if (fileIndex >= 0) {
        this._currentScope.files[fileIndex].completed = completed;
      }
      
      // 進捗率を再計算
      const completedCount = this._currentScope.files.filter((f: any) => f.completed).length;
      const totalCount = this._currentScope.files.length;
      const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      
      // スコープのステータスと進捗を更新
      this._currentScope.progress = newProgress;
      this._scopes[this._selectedScopeIndex].progress = newProgress;
      
      // すべてのファイルが完了した場合はステータスを完了に
      if (newProgress === 100) {
        this._currentScope.status = 'completed';
        this._scopes[this._selectedScopeIndex].status = 'completed';
      } else if (newProgress > 0) {
        this._currentScope.status = 'in-progress';
        this._scopes[this._selectedScopeIndex].status = 'in-progress';
      }
      
      // CURRENT_STATUS.mdファイルを更新
      await this._updateStatusFile();
      
      // WebViewを更新
      this._updateWebview();
      
      Logger.info(`ファイルステータスを更新しました: ${filePath}, 完了: ${completed}, 新しい進捗: ${newProgress}%`);
    } catch (error) {
      Logger.error('ファイルステータスの更新中にエラーが発生しました', error as Error);
      await this._showError(`ファイルステータスの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * スコープ作成プロンプトでClaudeCodeを起動
   */
  private async _handleLaunchScopeCreator(): Promise<void> {
    try {
      if (!this._projectPath) {
        throw new Error('プロジェクトパスが設定されていません');
      }
      
      // スコープマネージャプロンプトのパスを取得
      const promptFilePath = path.join(this._projectPath, 'docs', 'Scope_Manager_Prompt.md');
      
      if (!fs.existsSync(promptFilePath)) {
        throw new Error(`スコープマネージャプロンプトファイルが見つかりません: ${promptFilePath}`);
      }
      
      // ClaudeCodeの起動
      const launcher = ClaudeCodeLauncherService.getInstance();
      const success = await launcher.launchClaudeCodeWithPrompt(
        this._projectPath,
        promptFilePath,
        { title: 'ClaudeCode - スコープ作成' }
      );
      
      if (success) {
        vscode.window.showInformationMessage('スコープ作成のためのClaudeCodeを起動しました。');
      } else {
        vscode.window.showErrorMessage('ClaudeCodeの起動に失敗しました。');
      }
    } catch (error) {
      Logger.error('スコープ作成の起動に失敗しました', error as Error);
      await this._showError(`スコープ作成の起動に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 実装アシスタントプロンプトでClaudeCodeを起動
   */
  private async _handleLaunchImplementationAssistant(): Promise<void> {
    try {
      if (!this._projectPath) {
        throw new Error('プロジェクトパスが設定されていません');
      }
      
      // 実装アシスタントプロンプトのパスを取得
      const promptFilePath = path.join(this._projectPath, 'docs', 'Scope_Implementation_Assistant_Prompt.md');
      
      if (!fs.existsSync(promptFilePath)) {
        throw new Error(`実装アシスタントプロンプトファイルが見つかりません: ${promptFilePath}`);
      }
      
      // ClaudeCodeの起動
      const launcher = ClaudeCodeLauncherService.getInstance();
      const success = await launcher.launchClaudeCodeWithPrompt(
        this._projectPath,
        promptFilePath,
        { title: 'ClaudeCode - 実装アシスタント' }
      );
      
      if (success) {
        vscode.window.showInformationMessage('実装アシスタントのためのClaudeCodeを起動しました。');
      } else {
        vscode.window.showErrorMessage('ClaudeCodeの起動に失敗しました。');
      }
    } catch (error) {
      Logger.error('実装アシスタントの起動に失敗しました', error as Error);
      await this._showError(`実装アシスタントの起動に失敗しました: ${(error as Error).message}`);
    }
  }

  private async _handleStartImplementation(): Promise<void> {
    try {
      if (!this._currentScope) {
        throw new Error('スコープが選択されていません');
      }
      
      // 実装アシスタントプロンプトのパスを取得
      const promptFilePath = path.join(this._projectPath, 'docs', 'Scope_Implementation_Assistant_Prompt.md');
      
      // 実装に必要な情報の準備
      const scopeInfo: IImplementationScope = {
        id: this._currentScope.id || `scope-${Date.now()}`,
        name: this._currentScope.name,
        description: this._currentScope.description,
        items: this._currentScope.files.map((file: any) => ({
          id: `file-${Math.random().toString(36).substr(2, 9)}`,
          title: file.path,
          description: `Implementation of ${file.path}`,
          status: file.completed ? ScopeItemStatus.COMPLETED : ScopeItemStatus.PENDING,
          progress: file.completed ? 100 : 0,
          priority: 'medium',
          complexity: 'medium',
          dependencies: [],
          relatedFiles: [file.path]
        })),
        selectedIds: this._currentScope.files
          .filter((f: any) => !f.completed)
          .map((f: any, i: number) => `file-${Math.random().toString(36).substr(2, 9)}`),
        estimatedTime: this._currentScope.estimatedTime || "10時間",
        totalProgress: this._currentScope.progress || 0,
        projectPath: this._projectPath
      };
      
      // ClaudeCodeの起動方法を決定
      const launcher = ClaudeCodeLauncherService.getInstance();
      let success = false;
      
      // 実装アシスタントプロンプトが存在する場合はそれを使用、なければ通常の方法で起動
      if (fs.existsSync(promptFilePath)) {
        success = await launcher.launchClaudeCodeWithPrompt(
          this._projectPath,
          promptFilePath,
          { title: 'ClaudeCode - 実装アシスタント' }
        );
      } else {
        success = await launcher.launchClaudeCode(scopeInfo);
      }
      
      if (success) {
        vscode.window.showInformationMessage('ClaudeCodeを起動しました。実装が開始されます。');
        
        // スコープのステータスを進行中に更新
        if (this._currentScope.status === 'pending') {
          this._currentScope.status = 'in-progress';
          this._scopes[this._selectedScopeIndex].status = 'in-progress';
          
          // 進捗が0の場合は10%に設定（開始の印として）
          if (this._currentScope.progress === 0) {
            this._currentScope.progress = 10;
            this._scopes[this._selectedScopeIndex].progress = 10;
          }
          
          // CURRENT_STATUS.mdファイルを更新
          await this._updateStatusFile();
          
          // WebViewを更新
          this._updateWebview();
        }
      } else {
        vscode.window.showErrorMessage('ClaudeCodeの起動に失敗しました。');
      }
    } catch (error) {
      Logger.error('実装開始中にエラーが発生しました', error as Error);
      await this._showError(`実装の開始に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * スコープを編集
   */
  private async _handleEditScope(scopeData: any): Promise<void> {
    try {
      if (this._selectedScopeIndex < 0) {
        throw new Error('スコープが選択されていません');
      }
      
      // スコープの情報を更新
      this._scopes[this._selectedScopeIndex].name = scopeData.name;
      this._scopes[this._selectedScopeIndex].description = scopeData.description;
      this._scopes[this._selectedScopeIndex].priority = scopeData.priority;
      this._scopes[this._selectedScopeIndex].estimatedTime = scopeData.estimatedTime;
      
      // 現在のスコープも更新
      this._currentScope = {
        ...this._currentScope,
        name: scopeData.name,
        description: scopeData.description,
        priority: scopeData.priority,
        estimatedTime: scopeData.estimatedTime
      };
      
      // ファイルリストを更新
      if (scopeData.files) {
        this._currentScope.files = scopeData.files.map((file: string) => ({
          path: file,
          completed: false
        }));
      }
      
      // CURRENT_STATUS.mdファイルを更新
      await this._updateStatusFile();
      
      // WebViewを更新
      this._updateWebview();
      
      Logger.info(`スコープを編集しました: ${scopeData.name}`);
    } catch (error) {
      Logger.error('スコープ編集中にエラーが発生しました', error as Error);
      await this._showError(`スコープの編集に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * ディレクトリ構造を表示
   */
  private async _handleShowDirectoryStructure(): Promise<void> {
    try {
      if (!this._directoryStructure) {
        throw new Error('ディレクトリ構造が読み込まれていません');
      }
      
      // ディレクトリ構造を表示
      await this._panel.webview.postMessage({
        command: 'showDirectoryStructure',
        structure: this._directoryStructure
      });
      
      Logger.info('ディレクトリ構造を表示しました');
    } catch (error) {
      Logger.error('ディレクトリ構造の表示中にエラーが発生しました', error as Error);
      await this._showError(`ディレクトリ構造の表示に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 新しいスコープを追加
   */
  private async _handleAddNewScope(): Promise<void> {
    try {
      // 新しいスコープの情報を入力するフォームを表示
      const name = await vscode.window.showInputBox({
        prompt: 'スコープ名を入力してください',
        placeHolder: '例: 初期セットアップ/環境構築'
      });
      
      if (!name) {
        return;
      }
      
      const description = await vscode.window.showInputBox({
        prompt: 'スコープの説明を入力してください',
        placeHolder: '例: プロジェクトの基盤となる環境を整備する'
      });
      
      const priority = await vscode.window.showQuickPick(['高', '中', '低'], {
        placeHolder: '優先度を選択してください'
      });
      
      const estimatedTime = await vscode.window.showInputBox({
        prompt: '見積作業時間を入力してください',
        placeHolder: '例: 16時間',
        value: '8時間'
      });
      
      // 新しいスコープを作成
      const newScope = {
        name,
        description,
        priority,
        estimatedTime,
        status: 'pending',
        progress: 0,
        id: `scope-${Date.now()}`,
        files: [],
        features: [],
        index: this._scopes.length
      };
      
      // スコープリストに追加
      this._scopes.push(newScope);
      
      // 新しいスコープを選択
      this._selectedScopeIndex = this._scopes.length - 1;
      this._currentScope = newScope;
      
      // CURRENT_STATUS.mdファイルを更新
      await this._updateStatusFile();
      
      // WebViewを更新
      this._updateWebview();
      
      Logger.info(`新しいスコープを追加しました: ${name}`);
    } catch (error) {
      Logger.error('スコープ追加中にエラーが発生しました', error as Error);
      await this._showError(`スコープの追加に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * CURRENT_STATUS.mdファイルを更新
   */
  private async _updateStatusFile(): Promise<void> {
    try {
      if (!this._statusFilePath) {
        throw new Error('ステータスファイルパスが設定されていません');
      }
      
      // docsディレクトリが存在しない場合は作成
      const docsDir = path.join(this._projectPath, 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
        Logger.info(`docsディレクトリを作成しました: ${docsDir}`);
      }
      
      // ファイルの内容を生成
      let content = '# 実装状況 (';
      content += new Date().toISOString().split('T')[0].replace(/-/g, '/');
      content += '更新)\n\n';
      
      // 全体進捗
      const totalFiles = this._scopes.reduce((sum, scope) => sum + (scope.files?.length || 0), 0);
      const completedFiles = this._scopes.reduce((sum, scope) => {
        return sum + (scope.files?.filter((f: any) => f.completed)?.length || 0);
      }, 0);
      const progressPercent = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
      
      content += '## 全体進捗\n';
      content += `- 完成予定ファイル数: ${totalFiles}\n`;
      content += `- 作成済みファイル数: ${completedFiles}\n`;
      content += `- 進捗率: ${progressPercent}%\n`;
      content += `- 最終更新日: ${new Date().toISOString().split('T')[0].replace(/-/g, '/')}\n\n`;
      
      // スコープ状況
      content += '## スコープ状況\n\n';
      
      // 完了済みスコープ
      const completedScopes = this._scopes.filter(s => s.status === 'completed');
      content += '### 完了済みスコープ\n';
      if (completedScopes.length === 0) {
        content += '（完了したスコープはまだありません）\n\n';
      } else {
        completedScopes.forEach(scope => {
          content += `- [x] ${scope.name} (100%)\n`;
        });
        content += '\n';
      }
      
      // 進行中スコープ
      const inProgressScopes = this._scopes.filter(s => s.status === 'in-progress');
      content += '### 進行中スコープ\n';
      if (inProgressScopes.length === 0) {
        content += '（実装中のスコープはまだありません）\n\n';
      } else {
        inProgressScopes.forEach(scope => {
          content += `- [ ] ${scope.name} (${scope.progress}%)\n`;
        });
        content += '\n';
      }
      
      // 未着手スコープ
      const pendingScopes = this._scopes.filter(s => s.status === 'pending');
      content += '### 未着手スコープ\n';
      if (pendingScopes.length === 0) {
        content += '（未着手のスコープはありません）\n\n';
      } else {
        pendingScopes.forEach(scope => {
          content += `- [ ] ${scope.name} (0%)\n`;
        });
        content += '\n';
      }
      
      // ディレクトリ構造
      content += '## 現在のディレクトリ構造\n';
      content += '```\n';
      content += this._directoryStructure || '（ディレクトリ構造はまだ定義されていません）\n';
      content += '```\n\n';
      
      // 実装完了ファイル
      content += '## 実装完了ファイル\n';
      const allCompletedFiles = this._scopes.flatMap(scope => 
        (scope.files || [])
          .filter((f: any) => f.completed)
          .map((f: any) => ({ path: f.path, scope: scope.name }))
      );
      
      if (allCompletedFiles.length === 0) {
        content += '（実装済みファイルはまだありません）\n\n';
      } else {
        allCompletedFiles.forEach(file => {
          content += `- ✅ ${file.path} (${file.scope})\n`;
        });
        content += '\n';
      }
      
      // 実装中ファイル
      content += '## 実装中ファイル\n';
      const allInProgressFiles = this._scopes
        .filter(scope => scope.status === 'in-progress')
        .flatMap(scope => 
          (scope.files || [])
            .filter((f: any) => !f.completed)
            .map((f: any) => ({ path: f.path, scope: scope.name }))
        );
      
      if (allInProgressFiles.length === 0) {
        content += '（実装中のファイルはまだありません）\n\n';
      } else {
        allInProgressFiles.forEach(file => {
          content += `- ⏳ ${file.path} (${file.scope})\n`;
        });
        content += '\n';
      }
      
      // 引継ぎ情報
      content += '## 引継ぎ情報\n\n';
      
      // 現在のスコープ情報
      if (this._currentScope) {
        content += `### 現在のスコープ: ${this._currentScope.name}\n`;
        content += `**スコープID**: ${this._currentScope.id || `scope-${Date.now()}`}  \n`;
        content += `**説明**: ${this._currentScope.description || ''}  \n`;
        content += `**優先度**: ${this._currentScope.priority || '中'}  \n`;
        content += `**見積作業時間**: ${this._currentScope.estimatedTime || '8時間'}\n\n`;
        
        // 含まれる機能
        content += '**含まれる機能**:\n';
        if (this._currentScope.features && this._currentScope.features.length > 0) {
          this._currentScope.features.forEach((feature: string, index: number) => {
            content += `${index + 1}. ${feature}\n`;
          });
        } else {
          content += '1. （機能はまだ定義されていません）\n';
        }
        content += '\n';
        
        // 実装すべきファイル
        content += '**実装すべきファイル**: \n';
        if (this._currentScope.files && this._currentScope.files.length > 0) {
          this._currentScope.files.forEach((file: any) => {
            content += `- [${file.completed ? 'x' : ' '}] ${file.path}\n`;
          });
        } else {
          content += '- [ ] （ファイルはまだ定義されていません）\n';
        }
        content += '\n';
      } else {
        content += '（現在のスコープはまだ選択されていません）\n\n';
      }
      
      // 次回実装予定
      content += '## 次回実装予定\n\n';
      
      // 次のスコープを特定（現在のスコープが進行中なら次のスコープ、そうでなければ最初の未着手スコープ）
      let nextScope = null;
      if (this._currentScope && this._currentScope.status === 'in-progress') {
        // 現在のスコープが進行中なら、最初の未着手スコープを次のスコープとする
        nextScope = pendingScopes[0];
      } else if (this._currentScope && this._currentScope.status === 'completed') {
        // 現在のスコープが完了なら、最初の進行中または未着手スコープを次のスコープとする
        nextScope = inProgressScopes[0] || pendingScopes[0];
      } else {
        // 現在のスコープが未選択なら、最初の進行中スコープまたは未着手スコープを次のスコープとする
        nextScope = inProgressScopes[0] || pendingScopes[0] || this._currentScope;
      }
      
      if (nextScope) {
        content += `### 次のスコープ: ${nextScope.name}\n`;
        content += `**スコープID**: ${nextScope.id || `scope-${Date.now()}`}  \n`;
        content += `**説明**: ${nextScope.description || ''}  \n`;
        content += `**優先度**: ${nextScope.priority || '中'}  \n`;
        content += `**見積作業時間**: ${nextScope.estimatedTime || '8時間'}\n\n`;
        
        // 含まれる機能
        content += '**含まれる機能**:\n';
        if (nextScope.features && nextScope.features.length > 0) {
          nextScope.features.forEach((feature: string, index: number) => {
            content += `${index + 1}. ${feature}\n`;
          });
        } else {
          content += '1. （機能はまだ定義されていません）\n';
        }
        content += '\n';
        
        // 依存するスコープ
        const prevScopes = completedScopes
          .map(s => s.name)
          .filter(name => name !== nextScope.name);
        
        if (prevScopes.length > 0) {
          content += '**依存するスコープ**:\n';
          prevScopes.forEach((name: string) => {
            content += `- ${name}\n`;
          });
          content += '\n';
        }
        
        // 実装予定ファイル
        content += '**実装予定ファイル**:\n';
        if (nextScope.files && nextScope.files.length > 0) {
          nextScope.files
            .filter((f: any) => !f.completed)
            .forEach((file: any) => {
              content += `- [ ] ${file.path}\n`;
            });
        } else {
          content += '- [ ] （ファイルはまだ定義されていません）\n';
        }
      } else {
        content += '（次回実装予定のスコープはありません）\n';
      }
      
      // ファイルに書き込み
      await fs.promises.writeFile(this._statusFilePath, content, 'utf8');
      
      Logger.info(`CURRENT_STATUS.mdファイルを更新しました: ${this._statusFilePath}`);
    } catch (error) {
      Logger.error('ステータスファイルの更新中にエラーが発生しました', error as Error);
      throw error;
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
      // 選択中のスコープを設定
      let selectedScope = null;
      if (this._selectedScopeIndex >= 0 && this._selectedScopeIndex < this._scopes.length) {
        selectedScope = {
          ...this._scopes[this._selectedScopeIndex],
          files: this._currentScope?.files || []
        };
      }
      
      // WebViewにデータを送信
      await this._panel.webview.postMessage({
        command: 'updateState',
        scopes: this._scopes,
        selectedScopeIndex: this._selectedScopeIndex,
        selectedScope,
        directoryStructure: this._directoryStructure
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
    
    // モックアップのJS/CSSを使用
    const scopeManagerCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.css')
    );

    const scopeManagerJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'scopeManager.js')
    );

    // WebViewのHTMLを構築
    // モックアップを参考にしたHTML
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>スコープマネージャー</title>
  <link href="${styleResetUri}" rel="stylesheet">
  <link href="${styleVSCodeUri}" rel="stylesheet">
  <link href="${scopeManagerCssUri}" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
    }
    
    .scope-tree-item {
      padding: 8px 16px;
      border-radius: 4px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      cursor: pointer;
    }
    
    .scope-tree-item.active {
      background-color: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
      font-weight: 500;
    }
    
    .scope-tree-item:hover:not(.active) {
      background-color: var(--vscode-list-hoverBackground);
    }
    
    .scope-progress {
      height: 6px;
      border-radius: 3px;
      margin-top: 4px;
      overflow: hidden;
      background-color: var(--vscode-progressBar-background);
    }
    
    .scope-progress-bar {
      height: 100%;
      transition: width 0.3s;
    }
    
    .status-pending {
      background-color: var(--vscode-terminal-ansiYellow);
    }
    
    .status-in-progress {
      background-color: var(--vscode-terminal-ansiBlue);
    }
    
    .status-completed {
      background-color: var(--vscode-terminal-ansiGreen);
    }
    
    .status-blocked {
      background-color: var(--vscode-terminal-ansiRed);
    }
    
    .dependency-graph {
      width: 100%;
      height: 200px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background-color: var(--vscode-editor-background);
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 16px;
      overflow: hidden;
    }
    
    .file-item {
      display: flex;
      align-items: center;
      padding: 4px 0;
    }
    
    .file-checkbox {
      margin-right: 8px;
      cursor: pointer;
    }
    
    .scope-action-button {
      margin-top: 16px !important;
    }
    
    .status-chip {
      margin-left: auto !important;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      color: white;
    }
    
    .progress-section {
      margin-top: 24px;
    }
    
    .dependency-chip {
      margin: 4px !important;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      display: inline-block;
    }
    
    .scope-detail-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    
    .button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 2px;
      cursor: pointer;
      margin-right: 10px;
      font-size: 13px;
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
    
    .icon-button {
      background: transparent;
      border: none;
      color: var(--vscode-editor-foreground);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }
    
    .icon-button:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    
    .material-icons {
      font-size: 20px;
      vertical-align: middle;
    }
    
    .file-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 8px;
      margin-top: 12px;
    }
    
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .metadata-item {
      padding: 8px;
    }
    
    .metadata-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    
    .metadata-value {
      font-size: 14px;
    }
    
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .dialog {
      background-color: var(--vscode-editor-background);
      border-radius: 4px;
      padding: 16px;
      width: 500px;
      max-width: 90%;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    .dialog-title {
      font-size: 18px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
    }
    
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    
    .form-group {
      margin-bottom: 16px;
    }
    
    .form-label {
      display: block;
      margin-bottom: 4px;
    }
    
    .form-input {
      width: 100%;
      padding: 6px 8px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
    }
    
    .form-textarea {
      width: 100%;
      padding: 6px 8px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      min-height: 80px;
      resize: vertical;
    }
  </style>
</head>
<body>
  <div id="app">
    <div style="padding: 20px;">
      <h1>スコープマネージャー</h1>
      <p>プロジェクトの実装単位を管理し、ClaudeCodeに実装を依頼します</p>
      
      <div style="display: flex; margin-top: 20px;">
        <!-- 左側：スコープリスト -->
        <div style="width: 30%; padding-right: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h2>実装スコープ</h2>
            <button id="add-scope-button" class="icon-button">
              <i class="material-icons">add</i>
            </button>
          </div>
          
          <div id="scope-list">
            <!-- スコープリストがここに動的に生成されます -->
            <div class="scope-tree-item">
              <div style="flex-grow: 1;">
                <div>スコープを読み込んでいます...</div>
              </div>
            </div>
          </div>
          
          <button id="directory-structure-button" class="button" style="width: 100%; margin-top: 16px;">
            <i class="material-icons" style="margin-right: 4px;">folder</i>
            ディレクトリ構造を表示
          </button>
          <button id="create-scope-button" class="button button-secondary" style="width: 100%; margin-top: 10px; display: none;">
            <i class="material-icons" style="margin-right: 4px;">create_new_folder</i>
            スコープを作成する
          </button>
        </div>
        
        <!-- 右側：スコープ詳細 -->
        <div style="width: 70%; padding-left: 20px;">
          <div id="scope-detail-panel">
            <div class="scope-detail-header">
              <h2 id="scope-title">スコープを選択してください</h2>
              <div id="scope-actions" style="display: none;">
                <button id="edit-scope-button" class="icon-button">
                  <i class="material-icons">edit</i>
                </button>
                <button id="dependency-graph-button" class="icon-button">
                  <i class="material-icons">share</i>
                </button>
              </div>
            </div>
            
            <div id="scope-detail-content" style="display: none;">
              <p id="scope-description"></p>
              
              <div class="metadata-grid">
                <div class="metadata-item">
                  <div class="metadata-label">優先度</div>
                  <div id="scope-priority" class="metadata-value"></div>
                </div>
                <div class="metadata-item">
                  <div class="metadata-label">複雑度</div>
                  <div id="scope-complexity" class="metadata-value"></div>
                </div>
                <div class="metadata-item">
                  <div class="metadata-label">見積時間</div>
                  <div id="scope-estimated-time" class="metadata-value"></div>
                </div>
                <div class="metadata-item">
                  <div class="metadata-label">進捗</div>
                  <div id="scope-progress" class="metadata-value"></div>
                </div>
              </div>
              
              <div id="dependency-section">
                <h3>依存関係</h3>
                <div id="dependencies-content">依存関係はありません</div>
              </div>
              
              <div id="dependency-graph" class="dependency-graph" style="display: none;">
                <!-- 依存関係グラフがここに表示されます -->
              </div>
              
              <h3 style="margin-top: 20px;">実装対象ファイル</h3>
              <div id="file-list" class="file-list">
                <!-- ファイルリストがここに動的に生成されます -->
                <div class="file-item">ファイルがありません</div>
              </div>
              
              <!-- ボタンエリア -->
              <button id="implement-button" class="button scope-action-button" style="width: 100%;">
                <i class="material-icons" style="margin-right: 4px;">code</i>
                このスコープの実装を開始する
              </button>
              <div id="scope-warn-message" style="color: var(--vscode-errorForeground); margin-top: 8px; text-align: center; display: none;">
                このスコープを実装するには、依存するスコープをすべて完了させる必要があります。
              </div>
            </div>
            
            <div id="scope-empty-message">
              左側のリストからスコープを選択してください。
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 編集ダイアログ -->
    <div id="edit-dialog" class="dialog-overlay" style="display: none;">
      <div class="dialog">
        <h3 class="dialog-title">スコープを編集</h3>
        <div>
          <div class="form-group">
            <label class="form-label" for="edit-name">スコープ名</label>
            <input type="text" id="edit-name" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-description">説明</label>
            <textarea id="edit-description" class="form-textarea"></textarea>
          </div>
          <div style="display: flex; gap: 16px;">
            <div class="form-group" style="flex: 1;">
              <label class="form-label" for="edit-priority">優先度</label>
              <select id="edit-priority" class="form-input">
                <option value="高">高</option>
                <option value="中">中</option>
                <option value="低">低</option>
              </select>
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label" for="edit-estimated-time">見積時間</label>
              <input type="text" id="edit-estimated-time" class="form-input">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-files">実装ファイル（1行に1つのファイルパス）</label>
            <textarea id="edit-files" class="form-textarea"></textarea>
          </div>
        </div>
        <div class="dialog-footer">
          <button id="edit-cancel" class="button button-secondary">キャンセル</button>
          <button id="edit-save" class="button">保存</button>
        </div>
      </div>
    </div>
    
    <!-- ディレクトリ構造ダイアログ -->
    <div id="directory-dialog" class="dialog-overlay" style="display: none;">
      <div class="dialog">
        <h3 class="dialog-title">ディレクトリ構造</h3>
        <pre id="directory-structure" style="background-color: var(--vscode-editor-background); padding: 10px; overflow: auto; max-height: 400px; white-space: pre-wrap; font-family: monospace;"></pre>
        <div class="dialog-footer">
          <button id="directory-close" class="button">閉じる</button>
        </div>
      </div>
    </div>
  </div>
  
  <script src="${scopeManagerJsUri}"></script>
</body>
</html>`;
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    ScopeManagerPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}