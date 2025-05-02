import * as vscode from 'vscode';
import { IProjectInfo, ScopeManagerStateChangeEvent, ScopeManagerStateChangeType } from '../types/ScopeManagerTypes';
import { SharedFile, FileSaveOptions } from '../../../types/SharingTypes';
import { IFileSystemService, FileSystemService } from '../services/FileSystemService';
import { IProjectService, ProjectService } from '../services/ProjectService';
import { ISharingService, SharingService } from '../services/SharingService';
import { IAuthenticationHandler, AuthenticationHandler } from '../services/AuthenticationHandler';
import { Feature } from '../../../core/auth/roles';

/**
 * ScopeManagerViewModelインターフェース
 * ScopeManagerPanelの状態管理とビジネスロジックを集約
 */
export interface IScopeManagerViewModel {
  // 状態
  readonly projectPath: string;
  readonly statusFilePath: string;
  readonly directoryStructure: string;
  readonly activeProject: IProjectInfo | null;
  readonly projects: IProjectInfo[];
  
  // 初期化
  initialize(): Promise<void>;
  
  // プロジェクト操作
  setProjectPath(projectPath: string): Promise<void>;
  createProject(name: string, description: string): Promise<void>;
  loadExistingProject(): Promise<void>;
  selectProject(name: string, path: string, activeTab?: string): Promise<void>;
  removeProject(name: string, path: string, id?: string): Promise<void>;
  
  // ファイル操作
  getMarkdownContent(filePath: string): Promise<string>;
  showDirectoryStructure(): Promise<string>;
  
  // タブ操作
  saveTabState(tabId: string): Promise<void>;
  
  // 共有機能
  shareText(text: string, suggestedFilename?: string): Promise<SharedFile>;
  shareImage(imageData: string, fileName: string): Promise<SharedFile>;
  getHistory(): Promise<SharedFile[]>;
  deleteFromHistory(fileId: string): Promise<void>;
  copyCommand(fileId: string): Promise<void>;
  reuseHistoryItem(fileId: string): Promise<void>;
  
  // ClaudeCode連携
  launchPromptFromURL(url: string, index: number, name?: string): Promise<void>;
  
  // モックアップ
  openMockupGallery(filePath?: string): Promise<void>;
  openMockupInBrowser(filePath: string): Promise<void>;
  
  // 認証
  checkAccess(): boolean;
  
  // イベント
  onStateChanged: vscode.Event<ScopeManagerStateChangeEvent>;
  onError: vscode.Event<string>;
  onSuccess: vscode.Event<string>;
  
  // リソース解放
  dispose(): void;
}

/**
 * ScopeManagerViewModel実装クラス
 * TODO: 実装を追加
 */
export class ScopeManagerViewModel implements IScopeManagerViewModel {
  // 状態変更イベント
  private _onStateChanged = new vscode.EventEmitter<ScopeManagerStateChangeEvent>();
  public readonly onStateChanged = this._onStateChanged.event;
  
  // エラーイベント
  private _onError = new vscode.EventEmitter<string>();
  public readonly onError = this._onError.event;
  
  // 成功イベント
  private _onSuccess = new vscode.EventEmitter<string>();
  public readonly onSuccess = this._onSuccess.event;
  
  // 依存サービス
  private _fileSystemService: IFileSystemService;
  private _projectService: IProjectService;
  private _sharingService: ISharingService;
  private _authHandler: IAuthenticationHandler;
  
  // 状態
  private _projectPath: string = '';
  private _statusFilePath: string = '';
  private _directoryStructure: string = '';
  private _activeProject: IProjectInfo | null = null;
  private _projects: IProjectInfo[] = [];
  
  // disposables
  private _disposables: vscode.Disposable[] = [];
  
  // 必要な機能/権限
  private readonly _requiredFeature: Feature = Feature.SCOPE_MANAGER;
  
  // シングルトンインスタンス
  private static _instance: ScopeManagerViewModel;
  
  public static getInstance(
    fileSystemService?: IFileSystemService,
    projectService?: IProjectService,
    sharingService?: ISharingService,
    authHandler?: IAuthenticationHandler
  ): ScopeManagerViewModel {
    if (!ScopeManagerViewModel._instance) {
      ScopeManagerViewModel._instance = new ScopeManagerViewModel(
        fileSystemService || FileSystemService.getInstance(),
        projectService || ProjectService.getInstance(),
        sharingService || SharingService.getInstance(),
        authHandler || AuthenticationHandler.getInstance()
      );
    }
    return ScopeManagerViewModel._instance;
  }
  
  private constructor(
    fileSystemService: IFileSystemService,
    projectService: IProjectService,
    sharingService: ISharingService,
    authHandler: IAuthenticationHandler
  ) {
    this._fileSystemService = fileSystemService;
    this._projectService = projectService;
    this._sharingService = sharingService;
    this._authHandler = authHandler;
    
    // サービスのイベントをリッスン
    this._registerEventListeners();
  }
  
  // ゲッター
  public get projectPath(): string {
    return this._projectPath;
  }
  
  public get statusFilePath(): string {
    return this._statusFilePath;
  }
  
  public get directoryStructure(): string {
    return this._directoryStructure;
  }
  
  public get activeProject(): IProjectInfo | null {
    return this._activeProject;
  }
  
  public get projects(): IProjectInfo[] {
    return this._projects;
  }
  
  /**
   * イベントリスナーを登録
   */
  private _registerEventListeners(): void {
    // FileSystemServiceのイベントをリッスン
    this._disposables.push(
      this._fileSystemService.onStatusFileChanged(filePath => {
        this._onStateChanged.fire({
          type: ScopeManagerStateChangeType.MARKDOWN_CONTENT_UPDATED,
          data: { filePath }
        });
      })
    );

    // ProjectServiceのイベントをリッスン
    this._disposables.push(
      this._projectService.onProjectSelected(project => {
        this._activeProject = project;
        this._onStateChanged.fire({
          type: ScopeManagerStateChangeType.ACTIVE_PROJECT_CHANGED,
          data: project
        });
      })
    );

    this._disposables.push(
      this._projectService.onProjectsUpdated(projects => {
        this._projects = projects;
        this._onStateChanged.fire({
          type: ScopeManagerStateChangeType.PROJECTS_UPDATED,
          data: projects
        });
      })
    );

    this._disposables.push(
      this._projectService.onProjectCreated(project => {
        // プロジェクト作成イベントは既にonProjectsUpdatedでプロジェクト一覧更新として処理されるため、
        // 追加のアクションは必要ない場合がある。必要に応じてカスタム処理を追加。
        this._onSuccess.fire(`プロジェクト「${project.name}」を作成しました`);
      })
    );

    this._disposables.push(
      this._projectService.onProjectRemoved(project => {
        // プロジェクト削除イベントは既にonProjectsUpdatedでプロジェクト一覧更新として処理されるため、
        // 追加のアクションは必要ない場合がある。必要に応じてカスタム処理を追加。
        this._onSuccess.fire(`プロジェクト「${project.name}」の登録を解除しました`);
      })
    );

    // SharingServiceのイベントをリッスン（必要な場合）
    // 現時点ではSharingServiceにイベントが実装されていない可能性があるため、
    // 実装されている場合にのみ追加する
  }
  
  /**
   * 初期化
   */
  public async initialize(): Promise<void> {
    try {
      // ProjectServiceから現在のプロジェクト情報を取得
      this._projects = this._projectService.getAllProjects();
      this._activeProject = this._projectService.getActiveProject();
      
      // アクティブプロジェクトがある場合はそのパスを設定
      if (this._activeProject && this._activeProject.path) {
        // ProjectServiceのプロジェクトパスを設定
        await this._projectService.setProjectPath(this._activeProject.path);
        this._projectPath = this._activeProject.path;
        this._statusFilePath = this._projectService.getStatusFilePath();
        
        // ディレクトリ構造を取得
        this._directoryStructure = await this._fileSystemService.getDirectoryStructure(this._projectPath);
        
        // 状態変更イベントを発火
        this._onStateChanged.fire({
          type: ScopeManagerStateChangeType.PROJECT_PATH_CHANGED,
          data: {
            projectPath: this._projectPath,
            statusFilePath: this._statusFilePath,
            statusFileExists: this._statusFilePath ? await this._checkFileExists(this._statusFilePath) : false
          }
        });
        
        // ディレクトリ構造更新イベントを発火
        this._onStateChanged.fire({
          type: ScopeManagerStateChangeType.DIRECTORY_STRUCTURE_UPDATED,
          data: this._directoryStructure
        });
        
        // ステータスファイルが存在する場合はマークダウンコンテンツを読み込む
        if (this._statusFilePath && await this._checkFileExists(this._statusFilePath)) {
          const content = await this._fileSystemService.readMarkdownFile(this._statusFilePath);
          this._onStateChanged.fire({
            type: ScopeManagerStateChangeType.MARKDOWN_CONTENT_UPDATED,
            data: { content }
          });
        }
      }
      
      // プロジェクト一覧イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.PROJECTS_UPDATED,
        data: this._projects
      });
      
      // アクティブプロジェクトイベントを発火
      if (this._activeProject) {
        this._onStateChanged.fire({
          type: ScopeManagerStateChangeType.ACTIVE_PROJECT_CHANGED,
          data: this._activeProject
        });
      }
      
      // 共有履歴を取得（必要な場合）
      try {
        const history = await this._sharingService.getHistory();
        this._onStateChanged.fire({
          type: ScopeManagerStateChangeType.SHARING_HISTORY_UPDATED,
          data: history
        });
      } catch (error) {
        // 共有履歴の取得に失敗しても処理は続行
        console.warn('共有履歴の取得に失敗しました', error);
      }
    } catch (error) {
      this._onError.fire(`初期化に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * ファイルの存在確認（ヘルパーメソッド）
   */
  private async _checkFileExists(filePath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const fs = require('fs');
      fs.access(filePath, fs.constants.F_OK, (err: any) => {
        resolve(!err);
      });
    });
  }
  
  /**
   * プロジェクトパスを設定
   */
  public async setProjectPath(projectPath: string): Promise<void> {
    try {
      if (!projectPath) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // ProjectServiceのプロジェクトパスを設定
      await this._projectService.setProjectPath(projectPath);
      
      // 内部状態を更新
      this._projectPath = projectPath;
      this._statusFilePath = this._projectService.getStatusFilePath();
      
      // ディレクトリ構造を取得
      this._directoryStructure = await this._fileSystemService.getDirectoryStructure(this._projectPath);
      
      // 状態変更イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.PROJECT_PATH_CHANGED,
        data: {
          projectPath: this._projectPath,
          statusFilePath: this._statusFilePath,
          statusFileExists: this._statusFilePath ? await this._checkFileExists(this._statusFilePath) : false
        }
      });
      
      // ディレクトリ構造更新イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.DIRECTORY_STRUCTURE_UPDATED,
        data: this._directoryStructure
      });
      
      // ステータスファイルが存在する場合はマークダウンコンテンツを読み込む
      if (this._statusFilePath && await this._checkFileExists(this._statusFilePath)) {
        const content = await this._fileSystemService.readMarkdownFile(this._statusFilePath);
        this._onStateChanged.fire({
          type: ScopeManagerStateChangeType.MARKDOWN_CONTENT_UPDATED,
          data: { content }
        });
      }
    } catch (error) {
      this._onError.fire(`プロジェクトパスの設定に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * プロジェクト作成
   */
  public async createProject(name: string, description: string): Promise<void> {
    try {
      if (!name) {
        throw new Error('プロジェクト名が指定されていません');
      }
      
      // ProjectServiceを使用してプロジェクトを作成
      const projectId = await this._projectService.createProject(name, description);
      
      // プロジェクト情報を更新
      this._projects = this._projectService.getAllProjects();
      this._activeProject = this._projectService.getActiveProject();
      
      // 新しいプロジェクトが正常に作成され、アクティブになっている場合はそのパスを設定
      if (this._activeProject && this._activeProject.path) {
        await this.setProjectPath(this._activeProject.path);
      }
      
      // 成功メッセージを発行（プロジェクト作成イベントはProjectServiceのイベントハンドラで既に処理）
      this._onSuccess.fire(`プロジェクト「${name}」を作成しました`);
    } catch (error) {
      this._onError.fire(`プロジェクトの作成に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * 既存プロジェクト読み込み
   */
  public async loadExistingProject(): Promise<void> {
    try {
      // ProjectServiceを使用して既存プロジェクトを読み込み
      const projectInfo = await this._projectService.loadExistingProject();
      
      // プロジェクト情報を更新
      this._projects = this._projectService.getAllProjects();
      this._activeProject = this._projectService.getActiveProject();
      
      // プロジェクトが正常に読み込まれた場合はそのパスを設定
      if (projectInfo && projectInfo.path) {
        await this.setProjectPath(projectInfo.path);
      }
      
      // 成功メッセージを発行
      if (projectInfo && projectInfo.name) {
        this._onSuccess.fire(`プロジェクト「${projectInfo.name}」を読み込みました`);
      }
    } catch (error) {
      this._onError.fire(`プロジェクトの読み込みに失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * プロジェクト選択
   */
  public async selectProject(name: string, path: string, activeTab?: string): Promise<void> {
    try {
      if (!path) {
        throw new Error('プロジェクトパスが指定されていません');
      }
      
      // ProjectServiceを使用してプロジェクトを選択
      await this._projectService.selectProject(name, path, activeTab);
      
      // プロジェクト情報を更新
      this._projects = this._projectService.getAllProjects();
      this._activeProject = this._projectService.getActiveProject();
      
      // プロジェクトパスを設定
      await this.setProjectPath(path);
      
      // 成功メッセージを発行
      this._onSuccess.fire(`プロジェクト「${name}」を開きました`);
    } catch (error) {
      this._onError.fire(`プロジェクトを開けませんでした: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * プロジェクト削除
   */
  public async removeProject(name: string, path: string, id?: string): Promise<void> {
    try {
      if (!name && !path && !id) {
        throw new Error('プロジェクト情報が不足しています');
      }
      
      // ProjectServiceを使用してプロジェクトを削除
      const success = await this._projectService.removeProject(name, path, id);
      
      if (!success) {
        throw new Error(`プロジェクト「${name}」の登録解除に失敗しました`);
      }
      
      // プロジェクト情報を更新
      this._projects = this._projectService.getAllProjects();
      this._activeProject = this._projectService.getActiveProject();
      
      // 成功メッセージを発行（プロジェクト削除イベントはProjectServiceのイベントハンドラで既に処理）
      this._onSuccess.fire(`プロジェクト「${name}」の登録を解除しました`);
      
      // 現在のプロジェクトが削除されたプロジェクトと同じ場合、別のプロジェクトへ切り替え
      if (this._projectPath === path) {
        if (this._activeProject && this._activeProject.path) {
          await this.setProjectPath(this._activeProject.path);
        } else if (this._projects.length > 0) {
          await this.setProjectPath(this._projects[0].path);
        }
      }
    } catch (error) {
      this._onError.fire(`プロジェクト登録解除に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * マークダウンコンテンツを取得
   */
  public async getMarkdownContent(filePath: string): Promise<string> {
    try {
      if (!filePath) {
        throw new Error('ファイルパスが指定されていません');
      }
      
      // FileSystemServiceを使用してマークダウンファイルを読み込む
      const content = await this._fileSystemService.readMarkdownFile(filePath);
      
      // 状態変更イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.MARKDOWN_CONTENT_UPDATED,
        data: { content, filePath }
      });
      
      return content;
    } catch (error) {
      this._onError.fire(`マークダウンファイルの読み込みに失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * ディレクトリ構造を表示
   */
  public async showDirectoryStructure(): Promise<string> {
    try {
      if (!this._projectPath) {
        throw new Error('プロジェクトパスが設定されていません');
      }
      
      // FileSystemServiceを使用してディレクトリ構造を取得
      this._directoryStructure = await this._fileSystemService.getDirectoryStructure(this._projectPath);
      
      // 状態変更イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.DIRECTORY_STRUCTURE_UPDATED,
        data: this._directoryStructure
      });
      
      return this._directoryStructure;
    } catch (error) {
      this._onError.fire(`ディレクトリ構造の取得に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * タブ状態を保存
   */
  public async saveTabState(tabId: string): Promise<void> {
    try {
      if (!tabId) {
        throw new Error('タブIDが指定されていません');
      }
      
      if (!this._activeProject || !this._activeProject.id) {
        this._onError.fire('タブ状態を保存できません: 有効なアクティブプロジェクトが存在しません');
        return;
      }
      
      // ProjectServiceを使用してタブ状態を保存
      await this._projectService.saveTabState(this._activeProject.id, tabId);
      
      // アクティブプロジェクト情報を更新
      this._activeProject = this._projectService.getActiveProject();
      
      // 必要に応じてイベントを発火（タブ状態の変更はUIの重要な状態変更ではない場合が多いため、
      // 任意でコメントアウト可能）
      /*
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.PROJECT_STATE_SYNC,
        data: this._activeProject
      });
      */
    } catch (error) {
      this._onError.fire(`タブ状態の保存に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * テキスト共有
   */
  public async shareText(text: string, suggestedFilename?: string): Promise<SharedFile> {
    try {
      if (!text) {
        throw new Error('共有するテキストが指定されていません');
      }
      
      // オプション設定
      const options: FileSaveOptions = {
        type: 'text',
        expirationHours: 24 // デフォルト有効期限
      };
      
      // 提案されたファイル名があれば使用
      if (suggestedFilename) {
        options.title = suggestedFilename;
        options.metadata = { suggestedFilename };
      }
      
      // SharingServiceを使用してテキストを共有
      const file = await this._sharingService.shareText(text, options);
      
      // 共有履歴を更新
      const history = await this._sharingService.getHistory();
      
      // 状態変更イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.SHARING_HISTORY_UPDATED,
        data: history
      });
      
      // 共有結果イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.SHARE_RESULT,
        data: {
          filePath: file.path,
          command: this._sharingService.generateCommand(file),
          type: 'text',
          title: file.title || suggestedFilename,
          originalName: file.originalName
        }
      });
      
      return file;
    } catch (error) {
      this._onError.fire(`テキストの共有に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * 画像共有
   */
  public async shareImage(imageData: string, fileName: string): Promise<SharedFile> {
    try {
      if (!imageData) {
        throw new Error('画像データが見つかりません');
      }
      
      // SharingServiceを使用して画像を共有
      const file = await this._sharingService.shareBase64Image(imageData, fileName);
      
      // 共有履歴を更新
      const history = await this._sharingService.getHistory();
      
      // 状態変更イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.SHARING_HISTORY_UPDATED,
        data: history
      });
      
      // 共有結果イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.SHARE_RESULT,
        data: {
          filePath: file.path,
          command: this._sharingService.generateCommand(file),
          type: 'image'
        }
      });
      
      return file;
    } catch (error) {
      this._onError.fire(`画像の共有に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * 共有履歴を取得
   */
  public async getHistory(): Promise<SharedFile[]> {
    try {
      // SharingServiceから履歴を取得
      const history = await this._sharingService.getHistory();
      
      // 状態変更イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.SHARING_HISTORY_UPDATED,
        data: history
      });
      
      return history;
    } catch (error) {
      this._onError.fire(`共有履歴の取得に失敗しました: ${(error as Error).message}`);
      return [];
    }
  }
  
  /**
   * 履歴から削除
   */
  public async deleteFromHistory(fileId: string): Promise<void> {
    try {
      if (!fileId) {
        throw new Error('ファイルIDが指定されていません');
      }
      
      // SharingServiceから履歴を削除
      const success = this._sharingService.deleteFromHistory(fileId);
      
      if (!success) {
        throw new Error('履歴の削除に失敗しました');
      }
      
      // 履歴を更新して状態変更イベントを発火
      const history = await this._sharingService.getHistory();
      
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.SHARING_HISTORY_UPDATED,
        data: history
      });
    } catch (error) {
      this._onError.fire(`履歴の削除に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * コマンドをコピー
   */
  public async copyCommand(fileId: string): Promise<void> {
    try {
      if (!fileId) {
        throw new Error('ファイルIDが指定されていません');
      }
      
      // ファイルを履歴から検索
      const history = await this._sharingService.getHistory();
      const file = history.find(item => item.id === fileId);
      
      if (!file) {
        throw new Error('指定されたファイルが見つかりません');
      }
      
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // VSCodeのクリップボード機能を使用
      await vscode.env.clipboard.writeText(command);
      
      // アクセスカウントを増やす
      this._sharingService.recordAccess(fileId);
      
      // 成功メッセージを発行
      this._onSuccess.fire(`コマンド "${command}" をコピーしました！`);
    } catch (error) {
      this._onError.fire(`コピーに失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * 履歴アイテムを再利用
   */
  public async reuseHistoryItem(fileId: string): Promise<void> {
    try {
      if (!fileId) {
        throw new Error('ファイルIDが指定されていません');
      }
      
      // ファイルを履歴から検索
      const history = await this._sharingService.getHistory();
      const file = history.find(item => item.id === fileId);
      
      if (!file) {
        throw new Error('指定されたファイルが見つかりません');
      }
      
      // コマンドを生成
      const command = this._sharingService.generateCommand(file);
      
      // アクセスカウントを増やす
      this._sharingService.recordAccess(fileId);
      
      // 共有結果イベントを発火
      this._onStateChanged.fire({
        type: ScopeManagerStateChangeType.SHARE_RESULT,
        data: {
          filePath: file.path,
          command: command,
          type: file.type
        }
      });
    } catch (error) {
      this._onError.fire(`履歴の再利用に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * プロンプトURLからClaudeCodeを起動
   */
  public async launchPromptFromURL(url: string, index: number, name?: string): Promise<void> {
    try {
      if (!url) {
        throw new Error('プロンプトURLが指定されていません');
      }
      
      if (!this._projectPath) {
        throw new Error('プロジェクトパスが設定されていません');
      }
      
      Logger.info(`プロンプトを取得中: ${url}`);
      
      // PromptServiceClientを使用してプロンプトを取得
      const { PromptServiceClient } = require('../../../services/PromptServiceClient');
      const promptServiceClient = PromptServiceClient.getInstance();
      
      // プロンプトの内容を取得して一時ファイルに保存
      const promptFilePath = await promptServiceClient.fetchAndSavePrompt(url, index, this._projectPath);
      
      // ClaudeCodeLauncherServiceを使用してClaudeCodeを起動
      const { ClaudeCodeLauncherService } = require('../../../services/ClaudeCodeLauncherService');
      const launcher = ClaudeCodeLauncherService.getInstance();
      
      const success = await launcher.launchClaudeCodeWithPrompt(
        this._projectPath,
        promptFilePath,
        {
          deletePromptFile: true, // 使用後に一時ファイルを削除
          splitView: true, // 分割ビューで表示
          promptType: name // プロンプト名をターミナルタイトルに反映
        }
      );
      
      if (success) {
        Logger.info(`ClaudeCode起動成功: ${promptFilePath}`);
        this._onSuccess.fire('ClaudeCodeを起動しました');
      } else {
        throw new Error('ClaudeCodeの起動に失敗しました');
      }
    } catch (error) {
      this._onError.fire(`プロンプトの取得または起動に失敗しました: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * モックアップギャラリーを開く
   */
  public async openMockupGallery(filePath?: string): Promise<void> {
    try {
      if (!this._projectPath) {
        throw new Error('プロジェクトパスが設定されていません');
      }
      
      // VSCodeコマンドを使ってモックアップギャラリーを開く
      await vscode.commands.executeCommand('appgenius-ai.openMockupGallery', this._projectPath);
      
      Logger.info(`モックアップギャラリーを開きました${filePath ? ': ' + filePath : ''}`);
      
      this._onSuccess.fire('モックアップギャラリーを開きました');
    } catch (error) {
      this._onError.fire(`モックアップギャラリーを開けませんでした: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * モックアップをブラウザで開く
   */
  public async openMockupInBrowser(filePath: string): Promise<void> {
    try {
      if (!filePath) {
        throw new Error('ファイルパスが指定されていません');
      }
      
      // VSCodeのAPIを使用して外部ブラウザでファイルを開く
      await vscode.env.openExternal(vscode.Uri.file(filePath));
      
      Logger.info(`モックアップをブラウザで開きました: ${filePath}`);
    } catch (error) {
      this._onError.fire(`モックアップをブラウザで開けませんでした: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * アクセス権限を確認
   */
  public checkAccess(): boolean {
    return this._authHandler.checkPermission(this._requiredFeature);
  }
  
  /**
   * リソースを解放
   */
  public dispose(): void {
    this._onStateChanged.dispose();
    this._onError.dispose();
    this._onSuccess.dispose();
    
    // 依存サービスの解放
    this._fileSystemService.dispose();
    this._projectService.dispose();
    this._sharingService.dispose();
    this._authHandler.dispose();
    
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}