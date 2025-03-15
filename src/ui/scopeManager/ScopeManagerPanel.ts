import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
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
  private _fileWatcher: vscode.FileSystemWatcher | null = null;

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
            case 'openEnvironmentVariablesAssistant':
              await this._handleOpenEnvironmentVariablesAssistant();
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
    Logger.info(`[Debug] スコープマネージャー:setProjectPath呼び出し - パラメータ: ${projectPath}`);
    
    // スタックトレースを表示（呼び出し元を特定するため）
    try {
      throw new Error('スタックトレース確認用');
    } catch (e) {
      Logger.debug(`[Debug] setProjectPathの呼び出し元スタック: ${(e as Error).stack?.split('\n').slice(1, 3).join('\n')}`);
    }
    
    this._projectPath = projectPath;
    this._statusFilePath = path.join(projectPath, 'docs', 'CURRENT_STATUS.md');
    
    Logger.info(`プロジェクトパスを設定しました: ${projectPath}`);
    Logger.info(`ステータスファイルパス: ${this._statusFilePath}, ファイル存在: ${fs.existsSync(this._statusFilePath) ? 'はい' : 'いいえ'}`);

    // 既存のファイルウォッチャーを破棄
    if (this._fileWatcher) {
      this._fileWatcher.dispose();
      this._fileWatcher = null;
    }
    
    // ファイルウォッチャーを設定
    this._setupFileWatcher();

    // パスが設定されたらステータスファイルを読み込む
    this._loadStatusFile();
    
    // WebViewにもプロジェクトパス情報を送信
    this._panel.webview.postMessage({
      command: 'updateProjectPath',
      projectPath: this._projectPath,
      statusFilePath: this._statusFilePath,
      statusFileExists: fs.existsSync(this._statusFilePath)
    });
  }
  
  /**
   * ファイル変更の監視を設定
   */
  private _setupFileWatcher(): void {
    try {
      // docs ディレクトリが存在しない場合は作成
      const docsDir = path.join(this._projectPath, 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }
      
      // CURRENT_STATUS.md の変更を監視
      this._fileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          this._projectPath, 
          'docs/CURRENT_STATUS.md'
        )
      );
      
      // ファイル変更時の処理
      this._fileWatcher.onDidChange(() => {
        Logger.info('CURRENT_STATUS.mdファイルの変更を検出しました');
        this._loadStatusFile();
      });
      
      // 新規ファイル作成時の処理
      this._fileWatcher.onDidCreate(() => {
        Logger.info('CURRENT_STATUS.mdファイルが新規作成されました');
        this._loadStatusFile();
      });
      
      // ファイル削除時の処理（必要に応じて）
      this._fileWatcher.onDidDelete(() => {
        Logger.info('CURRENT_STATUS.mdファイルが削除されました');
        // ファイルが削除された場合は空のスコープリストを表示
        this._scopes = [];
        this._updateWebview();
      });
      
      // ウォッチャーをdisposablesに追加
      this._disposables.push(this._fileWatcher);
      
      Logger.info('ファイル監視を設定しました');
    } catch (error) {
      Logger.error('ファイル監視の設定中にエラーが発生しました', error as Error);
    }
  }

  /**
   * CURRENT_STATUS.mdファイルを読み込む
   */
  private async _loadStatusFile(): Promise<void> {
    try {
      if (!this._statusFilePath) {
        Logger.warn(`ステータスファイルのパスが未設定です`);
        return;
      }
      
      // ファイルが存在しない場合、テンプレートを使用してファイルを作成するオプションを表示
      if (!fs.existsSync(this._statusFilePath)) {
        Logger.warn(`ステータスファイルが見つかりません: ${this._statusFilePath}`);
        
        // ユーザーにテンプレートファイルを作成するか確認
        const createTemplate = await vscode.window.showInformationMessage(
          `CURRENT_STATUS.mdファイルが見つかりません。テンプレートから新規作成しますか？`,
          { modal: true },
          'はい', 'いいえ'
        );
        
        if (createTemplate === 'はい') {
          try {
            // docsディレクトリが存在するか確認し、必要に応じて作成
            const docsDir = path.dirname(this._statusFilePath);
            if (!fs.existsSync(docsDir)) {
              fs.mkdirSync(docsDir, { recursive: true });
              Logger.info(`ディレクトリを作成しました: ${docsDir}`);
            }
            
            // テンプレートファイルを作成
            const template = this._getStatusFileTemplate();
            fs.writeFileSync(this._statusFilePath, template, 'utf8');
            Logger.info(`CURRENT_STATUS.mdテンプレートを作成しました: ${this._statusFilePath}`);
            
            // 作成したファイルを読み込み
            let content = template;
          } catch (error) {
            Logger.error(`テンプレートファイルの作成に失敗しました: ${(error as Error).message}`);
            vscode.window.showErrorMessage(`テンプレートファイルの作成に失敗しました: ${(error as Error).message}`);
            return;
          }
        } else {
          // ユーザーがテンプレート作成を拒否した場合
          this._panel.webview.postMessage({
            command: 'showError',
            message: `CURRENT_STATUS.mdファイルが見つかりません。ファイルを手動で作成してください: ${this._statusFilePath}`
          });
          return;
        }
      }

      // ファイルの内容を読み込む
      let content = await this._fileManager.readFileAsString(this._statusFilePath);
      
      // ステータスファイルからスコープ情報を解析
      this._parseStatusFile(content);
      
      // フォーマットチェックを行い、問題があればファイルに警告コメントを追加（一度だけ）
      let needsWarning = false;
      let warningMessage = '';
      
      // 必要なセクションが存在するか確認
      const hasUnstartedSection = content.includes('### 未着手スコープ');
      const hasInProgressSection = content.includes('### 進行中スコープ');
      const hasCompletedSection = content.includes('### 完了済みスコープ');
      
      // 未着手スコープセクションがない
      if (!hasUnstartedSection) {
        Logger.warn('「未着手スコープ」セクションが見つかりません。');
        needsWarning = true;
        warningMessage += `\n### 未着手スコープ\n`;
      }
      
      // 進行中スコープセクションがない
      if (!hasInProgressSection) {
        Logger.warn('「進行中スコープ」セクションが見つかりません。');
        needsWarning = true;
        warningMessage += `\n### 進行中スコープ\n（実装中のスコープはまだありません）\n`;
      }
      
      // 完了済みスコープセクションがない
      if (!hasCompletedSection) {
        Logger.warn('「完了済みスコープ」セクションが見つかりません。');
        needsWarning = true;
        warningMessage += `\n### 完了済みスコープ\n（完了したスコープはまだありません）\n`;
      }
      
      // 箇条書きフォーマットチェック
      const completedScopeSection = content.match(/### 完了済みスコープ\s*\n((?:.*\n)*?)(?:\n###|$)/);
      const inProgressScopeSection = content.match(/### 進行中スコープ\s*\n((?:.*\n)*?)(?:\n###|$)/);
      const pendingScopeSection = content.match(/### 未着手スコープ\s*\n((?:.*\n)*?)(?:\n###|$)/);
      
      const hasCompletedBullets = completedScopeSection && completedScopeSection[1].trim().match(/^- \[x\]/m);
      const hasInProgressBullets = inProgressScopeSection && inProgressScopeSection[1].trim().match(/^- \[ \]/m);
      const hasPendingBullets = pendingScopeSection && pendingScopeSection[1].trim().match(/^- \[ \]/m);
      
      // 警告が既に存在するか確認（重複追加を防ぐ）
      const hasExistingWarning = content.includes('<!-- スコープマネージャー警告:');
      
      // 問題があり、かつ既存の警告がない場合のみ、ファイルに警告を追加
      if ((needsWarning || !hasCompletedBullets || !hasInProgressBullets || !hasPendingBullets) && !hasExistingWarning) {
        Logger.warn('フォーマットに問題があります。ファイルに警告を追加します。');
        
        // 警告メッセージを作成
        const warningTemplate = `\n\n<!-- スコープマネージャー警告: 以下のフォーマット推奨事項を確認してください -->
<!-- 
スコープマネージャーが正しく動作するには、以下のセクションとフォーマットが必要です：

## スコープ状況

### 完了済みスコープ
（完了したスコープはまだありません）
または
- [x] 完了したスコープ名 (100%)

### 進行中スコープ
（実装中のスコープはまだありません）
または
- [ ] 進行中のスコープ名 (50%)

### 未着手スコープ
- [ ] スコープ名
  - 説明: スコープの説明
  - 優先度: 高/中/低
  - 関連ファイル: ファイルパス1, ファイルパス2
-->

${warningMessage}`;
        
        // ファイルに警告を追加
        try {
          // 不足している必須セクションを追加しつつ、警告メッセージも追記
          let updatedContent = content;
          
          // スコープ状況セクションの有無をチェック
          if (!content.includes('## スコープ状況')) {
            // ファイルの末尾にスコープ状況セクションを追加
            updatedContent = updatedContent.trim() + `\n\n## スコープ状況`;
          }
          
          // 警告を追加（ファイルの末尾）
          updatedContent = updatedContent.trim() + warningTemplate;
          
          // 更新したファイルを保存
          await fs.promises.writeFile(this._statusFilePath, updatedContent, 'utf8');
          Logger.info('CURRENT_STATUS.mdファイルにフォーマット警告とサンプルを追加しました');
          
          // 更新した内容を再読み込み
          content = updatedContent;
          // 修正したファイルを再解析
          this._parseStatusFile(content);
        } catch (writeError) {
          Logger.error(`警告の追加に失敗しました: ${(writeError as Error).message}`);
        }
      } else if (!needsWarning && hasCompletedBullets && hasInProgressBullets && hasPendingBullets) {
        // 全ての条件を満たしている場合、既存の警告があれば削除
        if (hasExistingWarning) {
          try {
            // 既存の警告を削除
            const updatedContent = content.replace(/\n*<!-- スコープマネージャー警告:[\s\S]*?-->[\s\S]*?(?=\n\n|$)/g, '');
            
            // 更新したファイルを保存
            await fs.promises.writeFile(this._statusFilePath, updatedContent, 'utf8');
            Logger.info('フォーマットが修正されたため、警告を削除しました');
            
            // 更新した内容を再読み込み
            content = updatedContent;
          } catch (removeError) {
            Logger.error(`警告の削除に失敗しました: ${(removeError as Error).message}`);
          }
        }
      }
      
      // WebViewを更新
      this._updateWebview();
    } catch (error) {
      Logger.error('ステータスファイルの読み込み中にエラーが発生しました', error as Error);
    }
  }
  
  /**
   * CURRENT_STATUS.mdファイルのテンプレートを取得（新規作成用）
   * このメソッドは直接ファイルを変更せず、テンプレート文字列を返すだけ
   */
  private _getStatusFileTemplate(): string {
    return `# プロジェクト現状

## 全体進捗
- 要件定義: 未完了
- モックアップ: 未完了
- ディレクトリ構造: 未完了
- 実装: 未開始
- テスト: 未開始
- デプロイ: 未開始

## スコープ状況

### 完了済みスコープ
（完了したスコープはまだありません）

### 進行中スコープ
（実装中のスコープはまだありません）

### 未着手スコープ
（未着手のスコープはまだありません。スコープを追加するには次の形式を使用してください）

- [ ] スコープ名
  - 説明: スコープの説明
  - 優先度: 高/中/低
  - 関連ファイル: ファイルパス1, ファイルパス2

## 環境変数設定状況

必要な環境変数:
- API_KEY: 未設定
- DATABASE_URL: 未設定

## API設計

APIエンドポイントはまだ定義されていません。
`;
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
      let nextScope: any = null;
      let inheritanceInfo: string = '';
      
      // 行ごとに処理
      const lines = content.split(/\r?\n/);
      let i = 0;
      
      while (i < lines.length) {
        const line = lines[i];
        
        // セクションヘッダーを検出 (## や ### 両方に対応)
        if (line.startsWith('## ')) {
          currentSection = line.substring(3).trim();
          i++;
          continue;
        }
        
        // スコープセクションの処理
        if (currentSection === 'スコープ状況') {
          // 見出しを検出する正規表現を拡張
          if (line.startsWith('### 完了済みスコープ')) {
            i++;
            while (i < lines.length && !lines[i].startsWith('###') && !lines[i].startsWith('## ')) {
              const scopeLine = lines[i].trim();
              // 完了スコープの箇条書きパターンを検出 ([x])
              const match = scopeLine.match(/- \[x\] (.+?) \(100%\)/);
              if (match) {
                const name = match[1];
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
            while (i < lines.length && !lines[i].startsWith('###') && !lines[i].startsWith('## ')) {
              const scopeLine = lines[i].trim();
              // 進行中スコープの箇条書きパターンを検出 ([ ] + 進捗率)
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
            while (i < lines.length && !lines[i].startsWith('###') && !lines[i].startsWith('## ')) {
              const scopeLine = lines[i].trim();
              // より柔軟な未着手スコープの検出パターン：
              // 1. 標準形式 ([ ] スコープ名 (0%))
              // 2. ダッシュボード形式 ([ ] スコープ名) - 進捗情報なし
              // 3. ID付き形式 ([ ] スコープ名 (scope-xxx-xxx))
              let match = scopeLine.match(/- \[ \] (.+?) \(0%\)/);
              
              if (!match) {
                // 進捗情報のない形式を検出
                match = scopeLine.match(/^- \[ \] ([^(]+)(?:\s|$)/);
              }
              
              if (!match && scopeLine.includes('(scope-')) {
                // スコープID付きの形式を検出
                match = scopeLine.match(/^- \[ \] (.+?) \(scope-[^)]+\)/);
              }
              
              if (match) {
                const name = match[1].trim();
                
                // ロギングを追加（デバッグ用）
                Logger.info(`未着手スコープを検出: "${name}" (行: ${scopeLine})`);
                
                // スコープID抽出を試みる (スコープIDパターンがあれば)
                let scopeId = '';
                const idMatch = scopeLine.match(/\(scope-([^)]+)\)/);
                if (idMatch) {
                  scopeId = `scope-${idMatch[1]}`;
                }
                
                // 説明の抽出を試みる（次の行がインデントされている場合）
                let description = '';
                if (i + 1 < lines.length && lines[i + 1].trim().startsWith('- 説明:')) {
                  description = lines[i + 1].trim().substring('- 説明:'.length).trim();
                }
                
                pendingScopes.push({
                  name,
                  status: 'pending',
                  progress: 0,
                  id: scopeId,
                  description: description
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
            i++; // ```の行をスキップ
            continue;
          }
        }
        
        // 実装ファイルセクションの処理（スコープ別）
        // 「実装完了ファイル」「実装すべきファイル」「実装予定ファイル」など複数のパターンに対応
        if (currentSection.includes('実装完了ファイル') || 
            currentSection.includes('実装すべきファイル') || 
            currentSection.includes('実装予定ファイル')) {
          // スコープ別のファイルリストを処理
          if (line.startsWith('### スコープ') || line.trim().startsWith('- [')) {
            let currentScopeName = '';
            
            // スコープヘッダーを検出
            if (line.startsWith('### スコープ')) {
              currentScopeName = line.substring(4).trim();
              i++;
            }
            
            // ファイルリストを処理
            while (i < lines.length && !lines[i].startsWith('###') && !lines[i].startsWith('## ')) {
              const fileLine = lines[i].trim();
              if (fileLine.startsWith('- [')) {
                const completedMatch = fileLine.match(/- \[([ x])\] ([^\(\)]+)/);
                if (completedMatch) {
                  const isCompleted = completedMatch[1] === 'x';
                  const filePath = completedMatch[2].trim();
                  
                  // 完了済みならcompletedFilesに追加
                  if (isCompleted) {
                    completedFiles.push(filePath);
                  }
                  
                  // 該当するスコープのファイルリストを更新
                  const scopesToUpdate = [...completedScopes, ...inProgressScopes, ...pendingScopes];
                  scopesToUpdate.forEach(scope => {
                    if (scope.name === currentScopeName || fileLine.includes(scope.name)) {
                      if (!scope.files) scope.files = [];
                      
                      // 既存のファイルリストにあれば更新、なければ追加
                      const fileIndex = scope.files.findIndex((f: any) => f.path === filePath);
                      if (fileIndex >= 0) {
                        scope.files[fileIndex].completed = isCompleted;
                      } else {
                        scope.files.push({
                          path: filePath,
                          completed: isCompleted
                        });
                      }
                    }
                  });
                }
              }
              i++;
            }
            continue;
          }
        }
        
        // 実装中ファイルセクションの処理（より柔軟性を持たせる）
        if (currentSection === '実装中ファイル' || currentSection.includes('実装中')) {
          if (line.trim().startsWith('- [ ]')) {
            const filePath = line.match(/- \[ \] ([^\(\)]+)/)?.[1]?.trim();
            if (filePath) {
              inProgressFiles.push(filePath);
              
              // 進行中スコープのファイルリストを更新
              inProgressScopes.forEach(scope => {
                if (line.includes(scope.name)) {
                  if (!scope.files) scope.files = [];
                  
                  // 既存のファイルリストにあれば更新、なければ追加
                  const fileIndex = scope.files.findIndex((f: any) => f.path === filePath);
                  if (fileIndex >= 0) {
                    scope.files[fileIndex].completed = false;
                  } else {
                    scope.files.push({
                      path: filePath,
                      completed: false
                    });
                  }
                }
              });
            }
          }
          i++;
          continue;
        }
        
        // 引継ぎ情報セクションの処理
        if (currentSection === '引継ぎ情報') {
          // 現在のスコープ情報の処理
          if (line.startsWith('### 現在のスコープ:')) {
            const scopeName = line.substring('### 現在のスコープ:'.length).trim();
            let scopeId = '';
            let description = '';
            let features = [];
            let files = [];
            
            // 引継ぎ情報の内容をキャプチャ
            let sectionStartIdx = i;
            let sectionEndIdx = i;
            
            i++;
            while (i < lines.length && !lines[i].startsWith('##')) {
              const currentLine = lines[i];
              
              if (currentLine.startsWith('**スコープID**:')) {
                scopeId = currentLine.substring('**スコープID**:'.length).trim();
              } else if (currentLine.startsWith('**説明**:')) {
                description = currentLine.substring('**説明**:'.length).trim();
              } else if (currentLine.startsWith('**含まれる機能**:')) {
                i++;
                while (i < lines.length && /^\d+\. /.test(lines[i])) {
                  features.push(lines[i].replace(/^\d+\. /, '').trim());
                  i++;
                }
                continue;
              } else if (currentLine.startsWith('**実装すべきファイル**:') || 
                         currentLine.startsWith('**実装予定ファイル**:') || 
                         currentLine.includes('実装すべきファイル') || 
                         currentLine.includes('実装予定ファイル')) {
                
                sectionEndIdx = i - 1; // 実装すべきファイルの前の行まで引継ぎ情報としてキャプチャ
                i++;
                
                // ファイルリストを処理（空行までまたは別のセクションまで）
                while (i < lines.length && 
                       (lines[i].trim().startsWith('- ') || lines[i].trim().length === 0) && 
                       !lines[i].startsWith('**') && 
                       !lines[i].startsWith('##')) {
                  
                  const line = lines[i].trim();
                  if (line.length === 0) {
                    i++;
                    continue;
                  }
                  
                  // 箇条書きチェックボックス形式 (- [ ] path)
                  const checkboxMatch = line.match(/- \[([ x])\] (.+)/);
                  if (checkboxMatch) {
                    const completed = checkboxMatch[1] === 'x';
                    const filePath = checkboxMatch[2].trim();
                    files.push({
                      path: filePath,
                      completed
                    });
                  } 
                  // 単純な箇条書き形式 (- path)
                  else if (line.startsWith('- ')) {
                    const filePath = line.substring(2).trim();
                    // 「（ファイルはまだ定義されていません）」はスキップ
                    if (!filePath.includes('ファイルはまだ定義されていません')) {
                      files.push({
                        path: filePath,
                        completed: false
                      });
                    }
                  }
                  i++;
                }
                continue;
              }
              
              i++;
            }
            
            // 引継ぎ情報を抽出
            if (sectionEndIdx > sectionStartIdx) {
              inheritanceInfo = lines.slice(sectionStartIdx, sectionEndIdx + 1).join('\n');
            }
            
            // 現在進行中のスコープを選択
            const found = [...completedScopes, ...inProgressScopes, ...pendingScopes].find(s => s.name.includes(scopeName));
            if (found) {
              this._currentScope = {
                ...found,
                id: scopeId,
                description,
                features,
                files,
                inheritanceInfo
              };
            } else if (scopeName) {
              // スコープリストに存在しないが、スコープ名が記載されている場合は新規作成
              const newScope = {
                name: scopeName,
                id: scopeId || `scope-${Date.now()}`,
                description,
                status: 'pending',
                progress: 0,
                features,
                files,
                inheritanceInfo
              };
              
              pendingScopes.push(newScope);
              this._currentScope = newScope;
            }
            
            continue;
          }
        }
        
        // 次のスコープ情報の処理
        if (currentSection === '次回実装予定') {
          if (line.startsWith('### 次のスコープ:')) {
            const scopeName = line.substring('### 次のスコープ:'.length).trim();
            let scopeId = '';
            let description = '';
            let features = [];
            let files = [];
            let dependencies = [];
            
            // 引継ぎ情報の開始位置
            let sectionStartIdx = i;
            let sectionEndIdx = i;
            
            i++;
            while (i < lines.length && !lines[i].startsWith('##')) {
              const currentLine = lines[i];
              
              if (currentLine.startsWith('**スコープID**:')) {
                scopeId = currentLine.substring('**スコープID**:'.length).trim();
              } else if (currentLine.startsWith('**説明**:')) {
                description = currentLine.substring('**説明**:'.length).trim();
              } else if (currentLine.startsWith('**含まれる機能**:')) {
                i++;
                while (i < lines.length && /^\d+\. /.test(lines[i])) {
                  features.push(lines[i].replace(/^\d+\. /, '').trim());
                  i++;
                }
                continue;
              } else if (currentLine.startsWith('**依存するスコープ**:')) {
                i++;
                while (i < lines.length && lines[i].trim().startsWith('- ')) {
                  dependencies.push(lines[i].replace(/^- /, '').trim());
                  i++;
                }
                continue;
              } else if (currentLine.startsWith('**実装予定ファイル**:') || 
                         currentLine.startsWith('**実装すべきファイル**:') || 
                         currentLine.includes('実装すべきファイル') || 
                         currentLine.includes('実装予定ファイル')) {
                
                sectionEndIdx = i - 1; // 実装すべきファイルの前の行まで引継ぎ情報としてキャプチャ
                i++;
                
                // ファイルリストを処理（空行までまたは別のセクションまで）
                while (i < lines.length && 
                       (lines[i].trim().startsWith('- ') || lines[i].trim().length === 0) && 
                       !lines[i].startsWith('**') && 
                       !lines[i].startsWith('##')) {
                  
                  const line = lines[i].trim();
                  if (line.length === 0) {
                    i++;
                    continue;
                  }
                  
                  // 箇条書きチェックボックス形式 (- [ ] path)
                  const checkboxMatch = line.match(/- \[([ x])\] (.+)/);
                  if (checkboxMatch) {
                    const completed = checkboxMatch[1] === 'x';
                    const filePath = checkboxMatch[2].trim();
                    files.push({
                      path: filePath,
                      completed
                    });
                  } 
                  // 単純な箇条書き形式 (- path)
                  else if (line.startsWith('- ')) {
                    const filePath = line.substring(2).trim();
                    // 「（ファイルはまだ定義されていません）」はスキップ
                    if (!filePath.includes('ファイルはまだ定義されていません')) {
                      files.push({
                        path: filePath,
                        completed: false
                      });
                    }
                  }
                  i++;
                }
                continue;
              }
              
              i++;
            }
            
            // 引継ぎ情報を抽出
            let nextInheritanceInfo = '';
            if (sectionEndIdx > sectionStartIdx) {
              nextInheritanceInfo = lines.slice(sectionStartIdx, sectionEndIdx + 1).join('\n');
            }
            
            // 次のスコープ情報を保存
            nextScope = {
              name: scopeName,
              id: scopeId || `scope-${Date.now()}`,
              description,
              status: 'pending',
              progress: 0,
              features,
              files,
              dependencies,
              inheritanceInfo: nextInheritanceInfo
            };
            
            // もし次のスコープが未着手スコープリストに存在しなければ追加
            const existingNextScope = pendingScopes.find(s => s.name.includes(scopeName));
            if (!existingNextScope && scopeName) {
              pendingScopes.push(nextScope);
            }
            
            continue;
          }
        }
        
        i++;
      }
      
      // 詳細情報からもスコープを検出（代替方法）
      // より柔軟なパターンマッチングを使用
      let detailedScopeMatches = [...content.matchAll(/#### ([^:\n]+)[\s\S]*?スコープID[^:]*?: ([^\n]*)/g)];
      
      // 別形式のスコープも検出 (### 現在のスコープ: や ### 次のスコープ: の形式)
      const currentScopeMatch = content.match(/### 現在のスコープ:\s*([^\n]+)[\s\S]*?スコープID[^:]*?:\s*([^\n]*)/);
      const nextScopeMatch = content.match(/### 次のスコープ:\s*([^\n]+)[\s\S]*?スコープID[^:]*?:\s*([^\n]*)/);
      
      if (currentScopeMatch) {
        // RegExpExecArray型として扱うために変換
        const execArray = Object.assign([null, currentScopeMatch[1], currentScopeMatch[2]], {
          index: 0,
          input: '',
          groups: undefined
        }) as RegExpExecArray;
        detailedScopeMatches.push(execArray);
      }
      
      if (nextScopeMatch) {
        // RegExpExecArray型として扱うために変換
        const execArray = Object.assign([null, nextScopeMatch[1], nextScopeMatch[2]], {
          index: 0,
          input: '',
          groups: undefined
        }) as RegExpExecArray;
        detailedScopeMatches.push(execArray);
      }
      
      // 詳細情報からスコープを補完
      for (const match of detailedScopeMatches) {
        const scopeName = match[1].trim();
        const scopeId = match[2] ? match[2].trim() : `scope-${Date.now()}`;
        
        // 既存のスコープリストに存在しなければ未着手スコープとして追加
        const existingScope = [...completedScopes, ...inProgressScopes, ...pendingScopes]
          .find(s => s.name === scopeName);
        
        if (!existingScope) {
          Logger.info(`詳細情報から新たなスコープを検出: ${scopeName}`);
          pendingScopes.push({
            name: scopeName,
            id: scopeId,
            status: 'pending',
            progress: 0
          });
        }
      }
      
      // スコープの「実装予定ファイル」や「実装すべきファイル」セクションからファイル情報を抽出
      // 実装予定/実装すべきファイルセクションを検出するより汎用的なパターン
      const fileListPatterns = [
        // #### スコープ名\n...\n**実装予定ファイル**:
        new RegExp(`#### ([^:\\n]+)[\\s\\S]*?(?:実装予定ファイル|実装すべきファイル)[^:]*:[\\s\\S]*?((?:\\s*- \\[[^\\]]*\\].*\\n)+)`, 'g'),
        // ### 現在のスコープ: スコープ名\n...\n**実装すべきファイル**:
        new RegExp(`### 現在のスコープ:\\s*([^\\n]+)[\\s\\S]*?(?:実装予定ファイル|実装すべきファイル)[^:]*:[\\s\\S]*?((?:\\s*- \\[[^\\]]*\\].*\\n)+)`, 'g'),
        // ### 次のスコープ: スコープ名\n...\n**実装予定ファイル**:
        new RegExp(`### 次のスコープ:\\s*([^\\n]+)[\\s\\S]*?(?:実装予定ファイル|実装すべきファイル)[^:]*:[\\s\\S]*?((?:\\s*- \\[[^\\]]*\\].*\\n)+)`, 'g'),
      ];
      
      for (const pattern of fileListPatterns) {
        const matches = [...content.matchAll(pattern)];
        for (const match of matches) {
          const scopeName = match[1].trim();
          const fileListText = match[2];
          
          // 対象のスコープを見つける
          const targetScope = [...completedScopes, ...inProgressScopes, ...pendingScopes]
            .find(s => s.name === scopeName);
          
          if (targetScope) {
            // ファイルリストを解析
            const fileLines = fileListText.split('\n').filter(line => line.trim().startsWith('- '));
            const files = fileLines.map(line => {
              const checkboxMatch = line.match(/- \[([ x])\] (.+)/);
              if (checkboxMatch) {
                return {
                  path: checkboxMatch[2].trim(),
                  completed: checkboxMatch[1] === 'x'
                };
              } else {
                // 単純な箇条書き形式の場合
                return {
                  path: line.replace(/^- /, '').trim(),
                  completed: false
                };
              }
            }).filter(file => 
              file.path && !file.path.includes('ファイルはまだ定義されていません')
            );
            
            // スコープにファイル情報を追加
            if (files.length > 0) {
              if (!targetScope.files) {
                targetScope.files = [];
              }
              
              // 重複を避けて追加
              for (const file of files) {
                if (!targetScope.files.some(f => f.path === file.path)) {
                  targetScope.files.push(file);
                }
              }
              
              Logger.info(`スコープ "${scopeName}" に ${files.length} 個のファイルを追加しました`);
            }
          }
        }
      }
      
      // すべてのスコープをまとめる
      this._scopes = [...completedScopes, ...inProgressScopes, ...pendingScopes];
      
      // スコープにインデックス情報を追加
      this._scopes.forEach((scope, index) => {
        scope.index = index;
        
        // スコープ詳細情報の関連付け
        const detailMatch = content.match(new RegExp(`#### [^:\n]*${scope.name}[^:\n]*\\s*\\n\\s*\\*\\*スコープID\\*\\*: ([^\\n]*)`, 'i'));
        if (detailMatch) {
          scope.id = detailMatch[1].trim();
          
          // 機能一覧を抽出
          const featuresSection = content.match(new RegExp(`#### [^:\n]*${scope.name}[^:\n]*[\\s\\S]*?\\*\\*含まれる機能\\*\\*:[\\s\\S]*?(\\d+\\. .*?)\\n\\n`, 'i'));
          if (featuresSection) {
            const featuresText = featuresSection[1];
            scope.features = featuresText.split('\n').map(line => line.replace(/^\d+\. /, '').trim());
          }
        }
        
        // 現在のスコープを特定
        if (this._currentScope && scope.name.includes(this._currentScope.name)) {
          this._selectedScopeIndex = index;
          
          // 現在のスコープが既に選択されている場合は、引継ぎ情報を引き継ぐ
          if (this._currentScope.inheritanceInfo) {
            scope.inheritanceInfo = this._currentScope.inheritanceInfo;
          }
        }
      });
      
      // 現在のスコープが選択されていない場合、次のスコープを選択
      if (this._selectedScopeIndex < 0 && nextScope) {
        const nextScopeIndex = this._scopes.findIndex(s => s.name.includes(nextScope.name));
        if (nextScopeIndex >= 0) {
          this._selectedScopeIndex = nextScopeIndex;
          this._currentScope = this._scopes[nextScopeIndex];
          
          // 次のスコープに引継ぎ情報がある場合は設定
          if (nextScope.inheritanceInfo) {
            this._currentScope.inheritanceInfo = nextScope.inheritanceInfo;
          }
        }
      }
      
      Logger.info(`${this._scopes.length}個のスコープを読み込みました`);
      
      if (this._selectedScopeIndex >= 0) {
        Logger.info(`現在のスコープ: ${this._scopes[this._selectedScopeIndex].name}`);
      }
      
      if (nextScope) {
        Logger.info(`次のスコープ: ${nextScope.name}`);
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
      
      // 中央ポータルURL
      const portalUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704';
      
      // ステータスファイルの内容を追加コンテンツとして渡す
      let additionalContent = '';
      const statusFilePath = path.join(this._projectPath, 'docs', 'CURRENT_STATUS.md');
      
      if (fs.existsSync(statusFilePath)) {
        const statusContent = fs.readFileSync(statusFilePath, 'utf8');
        additionalContent = `# 現在の状態\n\n${statusContent}`;
      }
      
      // インテグレーションサービスを取得
      const integrationService = ClaudeCodeIntegrationService.getInstance();
      
      try {
        // 公開URLから起動（追加情報も渡す）
        Logger.info(`公開URL経由でClaudeCodeを起動します: ${portalUrl}`);
        await integrationService.launchWithPublicUrl(
          portalUrl,
          this._projectPath,
          additionalContent
        );
        
        vscode.window.showInformationMessage('スコープ作成のためのClaudeCodeを起動しました。');
      } catch (error) {
        // URL起動に失敗した場合、ローカルファイルにフォールバック
        Logger.warn(`公開URL経由の起動に失敗しました。ローカルファイルで試行します: ${error}`);
        
        // スコープマネージャプロンプトのパスを取得
        const promptFilePath = path.join(this._projectPath, 'docs', 'prompts', 'scope_manager.md');
        
        if (!fs.existsSync(promptFilePath)) {
          throw new Error(`スコープマネージャプロンプトファイルが見つかりません: ${promptFilePath}`);
        }
        
        // 一時的なテンプレートファイルを作成
        const tempDir = os.tmpdir(); // 一時ディレクトリに保存（25秒後に自動削除）
        const tempFilePath = path.join(tempDir, `combined_scope_${Date.now()}.md`);
        
        // プロンプトファイルの内容を読み込む
        let promptContent = fs.readFileSync(promptFilePath, 'utf8');
        
        // ステータスの内容を追加
        if (additionalContent) {
          promptContent += '\n\n' + additionalContent;
        }
        
        // 一時的なテンプレートファイルを作成
        fs.writeFileSync(tempFilePath, promptContent, 'utf8');
        
        // ClaudeCodeの起動
        const launcher = ClaudeCodeLauncherService.getInstance();
        const success = await launcher.launchClaudeCodeWithPrompt(
          this._projectPath,
          tempFilePath,
          { 
            title: 'ClaudeCode - スコープ作成', 
            deletePromptFile: true // 25秒後に削除
          }
        );
        
        if (success) {
          vscode.window.showInformationMessage('スコープ作成のためのClaudeCodeを起動しました（ローカルモード）。');
        } else {
          vscode.window.showErrorMessage('ClaudeCodeの起動に失敗しました。');
        }
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
      
      // 中央ポータルURL
      const portalUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a';
      
      // ステータスファイルの内容を追加コンテンツとして渡す
      let additionalContent = '';
      const statusFilePath = path.join(this._projectPath, 'docs', 'CURRENT_STATUS.md');
      
      if (fs.existsSync(statusFilePath)) {
        const statusContent = fs.readFileSync(statusFilePath, 'utf8');
        additionalContent = `# 現在の状態\n\n${statusContent}`;
      }
      
      // インテグレーションサービスを取得
      const integrationService = ClaudeCodeIntegrationService.getInstance();
      
      try {
        // 公開URLから起動（追加情報も渡す）
        Logger.info(`公開URL経由でClaudeCodeを起動します: ${portalUrl}`);
        await integrationService.launchWithPublicUrl(
          portalUrl,
          this._projectPath,
          additionalContent
        );
        
        vscode.window.showInformationMessage('実装アシスタントのためのClaudeCodeを起動しました。');
      } catch (error) {
        // URL起動に失敗した場合、ローカルファイルにフォールバック
        Logger.warn(`公開URL経由の起動に失敗しました。ローカルファイルで試行します: ${error}`);
        
        // 実装アシスタントプロンプトのパスを取得
        const promptFilePath = path.join(this._projectPath, 'docs', 'prompts', 'scope_implementer.md');
        
        if (!fs.existsSync(promptFilePath)) {
          throw new Error(`実装アシスタントプロンプトファイルが見つかりません: ${promptFilePath}`);
        }
        
        // 一時的なテンプレートファイルを作成
        const tempDir = os.tmpdir(); // 一時ディレクトリに保存（25秒後に自動削除）
        const tempFilePath = path.join(tempDir, `combined_implementer_${Date.now()}.md`);
        
        // プロンプトファイルの内容を読み込む
        let promptContent = fs.readFileSync(promptFilePath, 'utf8');
        
        // ステータスの内容を追加
        if (additionalContent) {
          promptContent += '\n\n' + additionalContent;
        }
        
        // 一時的なテンプレートファイルを作成
        fs.writeFileSync(tempFilePath, promptContent, 'utf8');
        
        // ClaudeCodeの起動
        const launcher = ClaudeCodeLauncherService.getInstance();
        const success = await launcher.launchClaudeCodeWithPrompt(
          this._projectPath,
          tempFilePath,
          { 
            title: 'ClaudeCode - 実装アシスタント',
            deletePromptFile: true // 25秒後に削除
          }
        );
        
        if (success) {
          vscode.window.showInformationMessage('実装アシスタントのためのClaudeCodeを起動しました（ローカルモード）。');
        } else {
          vscode.window.showErrorMessage('ClaudeCodeの起動に失敗しました。');
        }
      }
    } catch (error) {
      Logger.error('実装アシスタントの起動に失敗しました', error as Error);
      await this._showError(`実装アシスタントの起動に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 環境変数アシスタントを開く
   */
  private async _handleOpenEnvironmentVariablesAssistant(): Promise<void> {
    try {
      // 環境変数アシスタントを開くコマンドを実行
      await vscode.commands.executeCommand('appgenius-ai.openEnvironmentVariablesAssistant', this._projectPath);
      
      Logger.info('環境変数アシスタントを開きました');
    } catch (error) {
      Logger.error('環境変数アシスタントの起動に失敗しました', error as Error);
      await this._showError(`環境変数アシスタントの起動に失敗しました: ${(error as Error).message}`);
    }
  }

  private async _handleStartImplementation(): Promise<void> {
    try {
      if (!this._currentScope) {
        throw new Error('スコープが選択されていません');
      }
      
      // 実装アシスタントプロンプトのパスを取得
      const promptFilePath = path.join(this._projectPath, 'docs', 'prompts', 'scope_implementer.md');
      
      // CURRENT_STATUS.mdファイルへの参照を追加
      const statusFilePath = path.join(this._projectPath, 'docs', 'CURRENT_STATUS.md');
      
      // ClaudeCodeの起動方法を決定
      const launcher = ClaudeCodeLauncherService.getInstance();
      let success = false;
      
      // ファイル配列が未定義または空の場合のデフォルト値を設定
      const files = this._currentScope.files || [];
      
      // 実装に必要な情報の準備
      const scopeInfo: IImplementationScope = {
        id: this._currentScope.id || `scope-${Date.now()}`,
        name: this._currentScope.name,
        description: this._currentScope.description || '説明が設定されていません',
        items: files.map((file: any) => ({
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
        selectedIds: files
          .filter((f: any) => !f.completed)
          .map(() => `file-${Math.random().toString(36).substr(2, 9)}`),
        estimatedTime: this._currentScope.estimatedTime || "10時間",
        totalProgress: this._currentScope.progress || 0,
        projectPath: this._projectPath
      };
      
      // CURRENT_STATUS.mdファイルの存在を確認
      if (!fs.existsSync(statusFilePath)) {
        // 存在しない場合は作成
        await this._updateStatusFile();
        Logger.info(`CURRENT_STATUS.mdファイルが存在しなかったため作成しました: ${statusFilePath}`);
      }
      
      // ステータスファイルの内容を読み込む
      const statusContent = fs.readFileSync(statusFilePath, 'utf8');
      
      // 中央ポータルURL
      const portalUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a';
      
      // 追加情報（現在の実装状況など）
      const additionalContent = `# 現在の実装状況\n\n以下は現在の実装状況です。この情報を参考にして実装を進めてください。\n\n${statusContent}\n\n# 選択されたスコープ\n\n現在選択されているスコープ: **${this._currentScope.name}**\n\n説明: ${this._currentScope.description || '説明が設定されていません'}\n\n進捗: ${this._currentScope.progress || 0}%`;
      
      try {
        // インテグレーションサービスを動的importで安全に取得
        const integrationService = await import('../../services/ClaudeCodeIntegrationService').then(
          module => module.ClaudeCodeIntegrationService.getInstance()
        );
        
        // 公開URLから起動（追加情報も渡す）
        Logger.info(`公開URL経由でClaudeCodeを起動します: ${portalUrl}`);
        await integrationService.launchWithPublicUrl(
          portalUrl,
          this._projectPath,
          additionalContent
        );
        
        // 成功とみなす
        success = true;
      } catch (error) {
        Logger.warn(`公開URL経由の起動に失敗しました。ローカルファイルで試行します: ${error}`);
        
        // 実装アシスタントプロンプトが存在する場合はそれを使用
        if (fs.existsSync(promptFilePath)) {
          try {
            // プロンプトファイルの内容を読み込む
            const promptContent = fs.readFileSync(promptFilePath, 'utf8');
            
            // 一時的な結合ファイルを作成して両方の内容を含める
            const tempDir = os.tmpdir(); // OSの一時ディレクトリを使用
            const combinedFilePath = path.join(tempDir, `combined_prompt_${Date.now()}.md`);
            
            // 結合ファイルを作成
            const combinedContent = 
              promptContent + 
              '\n\n# 現在の実装状況\n\n' +
              '以下は現在の実装状況です。この情報を参考にして実装を進めてください。\n\n' +
              statusContent + 
              '\n\n# 選択されたスコープ\n\n' +
              `現在選択されているスコープ: **${this._currentScope.name}**\n\n` +
              `説明: ${this._currentScope.description || '説明が設定されていません'}\n\n` +
              `進捗: ${this._currentScope.progress || 0}%`;
            
            fs.writeFileSync(combinedFilePath, combinedContent, 'utf8');
            Logger.info(`結合プロンプトファイルを作成しました: ${combinedFilePath}`);
            
            // ClaudeCodeの起動
            const launcher = ClaudeCodeLauncherService.getInstance();
            success = await launcher.launchClaudeCodeWithPrompt(
              this._projectPath,
              combinedFilePath,
              { 
                title: 'ClaudeCode - 実装アシスタント',
                deletePromptFile: true // 25秒後に自動削除
              }
            );
            
            // メッセージを変更してローカルモードであることを示す
            if (success) {
              vscode.window.showInformationMessage('実装アシスタントのためのClaudeCodeを起動しました（ローカルモード）。');
            }
          } catch (error) {
            Logger.error('結合プロンプトファイルの作成に失敗しました', error as Error);
            throw error;
          }
        } else {
          // 旧式のスコープベースの起動方法にフォールバック
          success = await launcher.launchClaudeCode(scopeInfo);
        }
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
    
    .file-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 8px;
      margin-top: 12px;
    }
    
    .file-item {
      display: flex;
      align-items: center;
      padding: 4px 0;
    }
    
    .file-checkbox {
      margin-right: 8px;
      cursor: default;
    }
    
    .inheritance-info {
      margin-top: 20px;
      padding: 12px;
      background-color: var(--vscode-editor-infoBackground);
      border-radius: 4px;
      border-left: 4px solid var(--vscode-infoForeground);
      font-size: 14px;
      line-height: 1.5;
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
          <button id="create-scope-button" class="button button-secondary" style="width: 100%; margin-top: 10px;">
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
                <button id="implement-button" class="button">
                  <i class="material-icons" style="margin-right: 4px;">code</i>
                  実装開始
                </button>
              </div>
            </div>
            
            <div id="scope-detail-content" style="display: none;">
              <p id="scope-description"></p>
              
              <div class="metadata-item" style="margin-bottom: 16px;">
                <div class="metadata-label">進捗</div>
                <div id="scope-progress" class="metadata-value"></div>
              </div>
              
              <h3 style="margin-top: 20px;">実装予定ファイル</h3>
              <div id="implementation-files" class="file-list">
                <!-- ファイルリストがここに動的に生成されます -->
                <div class="file-item">実装予定ファイルが定義されていません</div>
              </div>
              
              <div id="inheritance-info" class="inheritance-info">
                引継ぎ情報はありません
              </div>
              
              <div id="scope-warn-message" style="color: var(--vscode-errorForeground); margin-top: 8px; text-align: center; display: none;">
                このスコープを実装するには、事前に必要な準備をすべて完了させてください。
              </div>
            </div>
            
            <div id="scope-empty-message">
              左側のリストからスコープを選択してください。
            </div>
          </div>
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