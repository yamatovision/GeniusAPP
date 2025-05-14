import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from '../../../../services/AppGeniusEventBus';
import { ProjectManagementService } from '../../../../services/ProjectManagementService';
import { IProjectService, IFileSystemService, IProjectInfo } from '../interfaces';

/**
 * プロジェクトサービス実装
 * IProjectServiceインターフェースの実装
 */
export class ProjectServiceImpl implements IProjectService {
  private _onProjectSelected = new vscode.EventEmitter<IProjectInfo>();
  public readonly onProjectSelected = this._onProjectSelected.event;
  
  private _onProjectCreated = new vscode.EventEmitter<IProjectInfo>();
  public readonly onProjectCreated = this._onProjectCreated.event;
  
  private _onProjectRemoved = new vscode.EventEmitter<IProjectInfo>();
  public readonly onProjectRemoved = this._onProjectRemoved.event;
  
  private _onProjectsUpdated = new vscode.EventEmitter<IProjectInfo[]>();
  public readonly onProjectsUpdated = this._onProjectsUpdated.event;
  
  // 新規イベントエミッター
  private _onProjectUIStateUpdated = new vscode.EventEmitter<{
    allProjects: IProjectInfo[];
    activeProject: IProjectInfo | null;
    progressFilePath: string;
    progressFileExists: boolean;
  }>();
  public readonly onProjectUIStateUpdated = this._onProjectUIStateUpdated.event;
  
  private _disposables: vscode.Disposable[] = [];
  private _projectPath: string = '';
  private _progressFilePath: string = '';
  private _currentProjects: IProjectInfo[] = [];
  private _activeProject: IProjectInfo | null = null;
  private _extensionPath: string;
  private _fileSystemService: IFileSystemService;
  private _projectManagementService: ProjectManagementService;
  
  // シングルトンインスタンス
  private static _instance: ProjectServiceImpl;
  
  public static getInstance(fileSystemService?: IFileSystemService): ProjectServiceImpl {
    if (!ProjectServiceImpl._instance) {
      ProjectServiceImpl._instance = new ProjectServiceImpl(fileSystemService);
    }
    return ProjectServiceImpl._instance;
  }
  
  private constructor(fileSystemService?: IFileSystemService) {
    // インターフェースの型を使用して依存関係を受け取る
    if (!fileSystemService) {
      throw new Error('FileSystemServiceが必要です');
    }
    this._fileSystemService = fileSystemService;
    
    // 拡張機能のパスを取得
    this._extensionPath = vscode.extensions.getExtension('mikoto.appgenius-ai')?.extensionPath || '';
    
    // ProjectManagementServiceのインスタンスを取得
    this._projectManagementService = ProjectManagementService.getInstance();
    
    // プロジェクト情報を初期化
    this._initializeProjects();
    
    // イベントバスのイベントをリッスン
    this._setupEventListeners();
  }
  
  /**
   * プロジェクト情報を初期化
   */
  private _initializeProjects(): void {
    try {
      // ProjectManagementServiceからプロジェクト一覧を取得
      this._currentProjects = this._projectManagementService.getAllProjects();
      this._activeProject = this._projectManagementService.getActiveProject();
      
      Logger.info(`ProjectService: プロジェクト一覧を取得しました: ${this._currentProjects.length}件`);
    } catch (error) {
      Logger.warn(`ProjectService: プロジェクト情報の初期化に失敗しました: ${error}`);
      this._currentProjects = [];
      this._activeProject = null;
    }
  }
  
  /**
   * イベントリスナーを設定
   */
  private _setupEventListeners(): void {
    // イベントバスからのプロジェクト関連イベントをリッスン
    const eventBus = AppGeniusEventBus.getInstance();
    
    // 統一されたプロジェクト更新イベント
    this._disposables.push(
      eventBus.onEventType(AppGeniusEventType.PROJECT_UPDATED, async (event) => {
        // 自分自身が送信したイベントは無視（循環を防ぐ）
        if (event.source === 'ProjectService') {
          return;
        }
        
        if (!event.data) {
          return;
        }
        
        Logger.info(`ProjectService: 他のコンポーネントからのプロジェクト更新イベントを受信しました: ${event.data?.name}, タイプ: ${event.data?.type}`);
        
        // イベントタイプに基づいて処理を分岐
        switch(event.data.type) {
          case 'selected':
            // プロジェクト選択イベント
            this._activeProject = event.data;
            this._onProjectSelected.fire(event.data);
            break;
            
          case 'created':
            // プロジェクト作成イベント
            this._initializeProjects();
            this._onProjectCreated.fire(event.data);
            this._onProjectsUpdated.fire(this._currentProjects);
            break;
            
          case 'removed':
            // プロジェクト削除イベント
            this._initializeProjects();
            this._onProjectRemoved.fire(event.data);
            this._onProjectsUpdated.fire(this._currentProjects);
            break;
            
          case 'updated':
          default:
            // その他の更新イベント（タブ状態変更など）
            if (event.data.id && this._activeProject && this._activeProject.id === event.data.id) {
              // アクティブプロジェクトの更新の場合
              this._activeProject = { 
                ...this._activeProject, 
                ...event.data,
                metadata: { ...this._activeProject.metadata, ...event.data.metadata }
              };
            }
            break;
        }
      })
    );
    
    // プロジェクト関連のレガシーイベントリスナー
    // 削除予定のため、必要なものだけを残す
    this._disposables.push(
      eventBus.onEventType(AppGeniusEventType.PROJECT_CREATED, async (event) => {
        if (event.source === 'ProjectService') return;
        
        Logger.info(`ProjectService: (レガシー) プロジェクト作成イベントを受信: ${event.data?.name}`);
        this._initializeProjects();
        this._onProjectCreated.fire(event.data);
        this._onProjectsUpdated.fire(this._currentProjects);
      })
    );
    
    this._disposables.push(
      eventBus.onEventType(AppGeniusEventType.PROJECT_REMOVED, async (event) => {
        if (event.source === 'ProjectService') return;
        
        Logger.info(`ProjectService: (レガシー) プロジェクト削除イベントを受信: ${event.data?.name}`);
        this._initializeProjects();
        this._onProjectRemoved.fire(event.data);
        this._onProjectsUpdated.fire(this._currentProjects);
      })
    );
  }
  
  /**
   * 新規プロジェクト作成
   * @param name プロジェクト名
   * @param description プロジェクト説明
   * @returns 新規作成したプロジェクトのID
   */
  public async createProject(name: string, description: string): Promise<string> {
    try {
      Logger.info(`ProjectService: 新規プロジェクト作成: ${name}`);
      
      // フォルダ選択ダイアログを表示
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'プロジェクト保存先を選択',
        title: '新規プロジェクトの保存先'
      });
      
      if (!folderUri || folderUri.length === 0) {
        Logger.info('ProjectService: プロジェクト作成がキャンセルされました: フォルダが選択されていません');
        throw new Error('プロジェクト保存先が選択されていません');
      }
      
      const projectPath = folderUri[0].fsPath;
      
      // プロジェクトディレクトリを作成
      const projectDir = path.join(projectPath, name);
      
      // すでに同名のディレクトリがある場合は確認
      if (fs.existsSync(projectDir)) {
        const overwrite = await vscode.window.showWarningMessage(
          `フォルダ「${name}」はすでに存在します。上書きしますか？`,
          { modal: true },
          '上書きする'
        );
        
        if (overwrite !== '上書きする') {
          Logger.info('ProjectService: プロジェクト作成がキャンセルされました: 上書き確認でキャンセル');
          throw new Error('プロジェクト作成がキャンセルされました');
        }
      } else {
        // ディレクトリを作成
        await this._fileSystemService.ensureDirectoryExists(projectDir);
      }
      
      // docs, mockupsディレクトリを作成
      const docsDir = path.join(projectDir, 'docs');
      const mockupsDir = path.join(projectDir, 'mockups');
      
      await this._fileSystemService.ensureDirectoryExists(docsDir);
      await this._fileSystemService.ensureDirectoryExists(mockupsDir);
      
      // CLAUDE.mdファイルを作成
      try {
        // ClaudeMdServiceをインポートして使用
        const { ClaudeMdService } = await import('../../../../utils/ClaudeMdService');
        const claudeMdService = ClaudeMdService.getInstance();
        
        // ClaudeMdServiceを使用してCLAUDE.mdを生成
        await claudeMdService.generateClaudeMd(projectDir, {
          name: name,
          description: description || ""
        });
        
        Logger.info(`ProjectService: CLAUDE.mdを生成しました: ${path.join(projectDir, 'CLAUDE.md')}`);
      } catch (error) {
        Logger.error(`ProjectService: CLAUDE.md生成エラー: ${error}`, error as Error);
        
        // エラーが発生した場合は処理を続行（プロジェクト作成自体は失敗させない）
        Logger.info(`ProjectService: プロジェクト作成は続行します`);
      }
      
      // SCOPE_PROGRESS.mdファイルを作成
      await this._fileSystemService.createProgressFile(projectDir, name);
      
      // ProjectManagementServiceにプロジェクトを登録
      try {
        // 新規プロジェクトとして登録
        const projectId = await this._projectManagementService.createProject({
          name: name,
          description: description || "",
          path: projectDir
        });
        
        Logger.info(`ProjectService: 新規作成したプロジェクトをProjectManagementServiceに登録: ID=${projectId}, 名前=${name}, パス=${projectDir}`);
        
        // プロジェクトをアクティブに設定
        await this._projectManagementService.setActiveProject(projectId);
        Logger.info(`ProjectService: 新規作成したプロジェクトをアクティブに設定: ID=${projectId}`);
        
        // プロジェクト一覧を更新
        this._currentProjects = this._projectManagementService.getAllProjects();
        this._activeProject = this._projectManagementService.getActiveProject();
        
        // プロジェクト更新イベント(作成)を発行
        try {
          const eventBus = AppGeniusEventBus.getInstance();
          eventBus.emit(
            AppGeniusEventType.PROJECT_UPDATED,
            { 
              id: projectId, 
              path: projectDir, 
              name: name,
              type: 'created',
              metadata: { activeTab: 'scope-progress' },
              timestamp: Date.now()
            },
            'ProjectService',
            projectId
          );
          Logger.info(`ProjectService: プロジェクト更新イベント(作成)を発行: ${name}, ${projectDir}`);
        } catch (error) {
          Logger.warn(`ProjectService: イベント発行に失敗しました: ${error}`);
        }
        
        // プロジェクトパスを設定
        await this.setProjectPath(projectDir);
        
        // イベント発火
        this._onProjectCreated.fire({
          id: projectId,
          name: name,
          path: projectDir
        });
        this._onProjectsUpdated.fire(this._currentProjects);
        
        return projectId;
      } catch (error) {
        Logger.warn(`ProjectService: ProjectManagementServiceへの登録に失敗しましたが、ローカルでは続行します: ${error}`);
        
        // プロジェクトパスを設定
        await this.setProjectPath(projectDir);
        
        return `local_${Date.now()}`;
      }
    } catch (error) {
      Logger.error(`ProjectService: プロジェクト作成中にエラーが発生しました: ${name}`, error as Error);
      throw error;
    }
  }
  
  /**
   * 既存プロジェクトの読み込み
   * @param projectPath 読み込むプロジェクトのパス
   * @returns プロジェクト情報
   */
  public async loadExistingProject(projectPath?: string): Promise<IProjectInfo> {
    try {
      Logger.info('ProjectService: 既存プロジェクト読み込み処理を開始');
      
      // プロジェクトパスが指定されていない場合はフォルダ選択ダイアログを表示
      if (!projectPath) {
        const folderUri = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: 'プロジェクトフォルダを選択',
          title: '既存プロジェクトの選択'
        });
        
        if (!folderUri || folderUri.length === 0) {
          Logger.info('ProjectService: プロジェクト読み込みがキャンセルされました: フォルダが選択されていません');
          throw new Error('プロジェクトフォルダが選択されていません');
        }
        
        projectPath = folderUri[0].fsPath;
      }
      
      // 選択されたフォルダが有効なプロジェクトかチェック
      const docsDir = path.join(projectPath, 'docs');
      
      // FileSystemServiceを使って進捗ファイルパスを取得
      const progressFilePath = this._fileSystemService.getProgressFilePath(projectPath);
      const progressFileName = path.basename(progressFilePath);
      const existsProgressFile = fs.existsSync(progressFilePath);
      
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(docsDir)) {
        const createDocs = await vscode.window.showInformationMessage(
          'docsディレクトリが見つかりません。自動的に作成しますか？',
          { modal: true },
          '作成する'
        );
        
        if (createDocs === '作成する') {
          await this._fileSystemService.ensureDirectoryExists(docsDir);
        } else {
          Logger.info('ProjectService: プロジェクト読み込みがキャンセルされました: docsディレクトリの作成がキャンセル');
          throw new Error('docsディレクトリの作成がキャンセルされました');
        }
      }
      
      // 進捗ファイルが存在しない場合は作成
      if (!existsProgressFile) {
        // 常にSCOPE_PROGRESS.mdを使用
        const progressFileName = 'SCOPE_PROGRESS.md';
        
        // 自動的に作成する（メッセージ表示なし）
        Logger.info(`ProjectService: ${progressFileName}を自動的に作成します`);
        await this._fileSystemService.createProgressFile(projectPath);
      }
      
      // mockupsディレクトリが存在しない場合は作成
      const mockupsDir = path.join(projectPath, 'mockups');
      if (!fs.existsSync(mockupsDir)) {
        await this._fileSystemService.ensureDirectoryExists(mockupsDir);
      }
      
      // プロジェクト名を取得（フォルダ名から）
      const projectName = path.basename(projectPath);
      
      // ProjectManagementServiceにプロジェクトを登録
      try {
        // 既存のプロジェクトを検索
        const projects = this._projectManagementService.getAllProjects();
        let projectId: string | undefined;
        let existingProject = projects.find((p: any) => p.path === projectPath);
        
        if (existingProject) {
          // 既存のプロジェクトが見つかった場合は、アクティブに設定
          projectId = existingProject.id;
          await this._projectManagementService.updateProject(projectId, {
            updatedAt: Date.now()
          });
          Logger.info(`ProjectService: 既存プロジェクトをアクティブに更新: ID=${projectId}, 名前=${projectName}`);
        } else {
          // 新規プロジェクトとして登録
          projectId = await this._projectManagementService.createProject({
            name: projectName,
            description: "",
            path: projectPath
          });
          Logger.info(`ProjectService: 読み込んだプロジェクトを新規登録: ID=${projectId}, 名前=${projectName}, パス=${projectPath}`);
        }
        
        // プロジェクトをアクティブに設定
        if (projectId) {
          await this._projectManagementService.setActiveProject(projectId);
          Logger.info(`ProjectService: 読み込んだプロジェクトをアクティブに設定: ID=${projectId}`);
        }
        
        // プロジェクト一覧を更新
        this._currentProjects = this._projectManagementService.getAllProjects();
        this._activeProject = this._projectManagementService.getActiveProject();
        
        // プロジェクト更新イベント(選択)を発行
        try {
          const eventBus = AppGeniusEventBus.getInstance();
          eventBus.emit(
            AppGeniusEventType.PROJECT_UPDATED,
            { 
              id: projectId, 
              path: projectPath, 
              name: projectName,
              type: 'selected',
              metadata: { activeTab: 'scope-progress' },
              timestamp: Date.now()
            },
            'ProjectService',
            projectId || projectPath
          );
          Logger.info(`ProjectService: プロジェクト更新イベント(選択)を発行: ${projectName}, ${projectPath}`);
        } catch (error) {
          Logger.warn(`ProjectService: イベント発行に失敗しました: ${error}`);
        }
        
        // プロジェクトパスを設定
        await this.setProjectPath(projectPath);
        
        // イベントを発火
        const projectInfo = {
          id: projectId || `local_${Date.now()}`,
          name: projectName,
          path: projectPath
        };
        
        this._onProjectSelected.fire(projectInfo);
        this._onProjectsUpdated.fire(this._currentProjects);
        
        return projectInfo;
      } catch (error) {
        Logger.warn(`ProjectService: プロジェクト登録に失敗しましたが、ローカルパスのみで続行します: ${error}`);
        
        // プロジェクトパスを設定
        await this.setProjectPath(projectPath);
        
        // 最低限の情報で返却
        const projectInfo = {
          id: `local_${Date.now()}`,
          name: projectName,
          path: projectPath
        };
        
        this._onProjectSelected.fire(projectInfo);
        
        return projectInfo;
      }
    } catch (error) {
      Logger.error('ProjectService: プロジェクト読み込み中にエラーが発生しました', error as Error);
      throw error;
    }
  }
  
  /**
   * プロジェクト選択
   * @param name プロジェクト名
   * @param path プロジェクトパス
   * @param activeTab アクティブタブID（オプション）
   */
  public async selectProject(name: string, path: string, activeTab?: string): Promise<void> {
    try {
      Logger.info(`ProjectService: プロジェクト選択: ${name}, パス: ${path}`);
      
      // 既存のプロジェクトを検索
      const projects = this._projectManagementService.getAllProjects();
      let projectId: string | undefined;
      let project = projects.find((p: any) => p.path === path);
      
      // プロジェクトが見つからない場合、パスが存在するか確認
      if (!project) {
        // 相対パスをフルパスに変換して試行
        const pathModule = require('path');
        const fullPath = pathModule.resolve(path);
        project = projects.find((p: any) => p.path === fullPath);
        
        if (project) {
          path = fullPath;
          Logger.info(`ProjectService: 相対パスから絶対パスに変換: ${path} -> ${fullPath}`);
        } else if (fs.existsSync(path)) {
          // プロジェクトはデータベースにないが、パスは存在する場合
          Logger.info(`ProjectService: プロジェクトがデータベースにありませんが、パスは存在します: ${path}`);
        } else if (fs.existsSync(fullPath)) {
          // 絶対パスとして存在する場合
          path = fullPath;
          Logger.info(`ProjectService: 相対パスから絶対パスに変換: ${path} -> ${fullPath}`);
        } else {
          // フォルダ選択ダイアログを表示
          const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: `プロジェクト「${name}」のフォルダを選択`
          });
          
          if (!folderUri || folderUri.length === 0) {
            throw new Error('プロジェクトのフォルダが選択されませんでした');
          }
          
          path = folderUri[0].fsPath;
          Logger.info(`ProjectService: ユーザーが新しいプロジェクトパスを選択: ${path}`);
        }
      } else {
        projectId = project.id;
      }
      
      // 既存のプロジェクトと同じ場合は何もしない
      if (this._projectPath === path) {
        Logger.info(`ProjectService: 同じプロジェクトが既に選択されています: ${path}`);
        return;
      }
      
      // プロジェクトパスを更新
      await this.setProjectPath(path);
      
      // 既存プロジェクトのIDがあれば、そのプロジェクトをアクティブに設定
      if (projectId) {
        // プロジェクトの既存メタデータを取得
        const existingProject = this._projectManagementService.getProject(projectId);
        
        // アクティブタブ情報を更新
        if (existingProject) {
          const metadata = existingProject.metadata || {};
          await this._projectManagementService.updateProject(projectId, {
            metadata: {
              ...metadata,
              activeTab: activeTab || metadata.activeTab || 'scope-progress'
            }
          });
        }
        
        await this._projectManagementService.setActiveProject(projectId);
        Logger.info(`ProjectService: 既存プロジェクトをアクティブに設定: ID=${projectId}, パス=${path}, アクティブタブ=${activeTab || (existingProject?.metadata?.activeTab) || 'scope-progress'}`);
      } else {
        // プロジェクトが見つからない場合は、新規作成または更新
        try {
          const existingProjectWithPath = projects.find((p: any) => p.path === path);
          
          if (existingProjectWithPath) {
            // パスが同じプロジェクトが見つかった場合は更新
            projectId = existingProjectWithPath.id;
            await this._projectManagementService.updateProject(projectId, {
              name: name,
              updatedAt: Date.now(),
              metadata: {
                ...existingProjectWithPath.metadata,
                activeTab: activeTab || existingProjectWithPath.metadata?.activeTab || 'scope-progress'
              }
            });
            Logger.info(`ProjectService: 既存プロジェクトを更新: ID=${projectId}, 名前=${name}, アクティブタブ=${activeTab || existingProjectWithPath.metadata?.activeTab || 'scope-progress'}`);
          } else {
            // 新規プロジェクトとして登録
            projectId = await this._projectManagementService.createProject({
              name: name,
              description: "",
              path: path,
              metadata: {
                activeTab: activeTab || 'scope-progress'
              }
            });
            Logger.info(`ProjectService: 新規プロジェクトを作成: ID=${projectId}, 名前=${name}, パス=${path}, アクティブタブ=${activeTab || 'scope-progress'}`);
          }
          
          // 作成または更新したプロジェクトをアクティブに設定
          if (projectId) {
            await this._projectManagementService.setActiveProject(projectId);
          }
        } catch (error) {
          Logger.warn(`ProjectService: プロジェクト登録に失敗しましたが、ローカルパスのみで続行します: ${error}`);
        }
      }
      
      // ProjectManagementServiceから最新のプロジェクト情報を取得して同期
      try {
        const updatedProject = projectId ? 
          this._projectManagementService.getProject(projectId) : 
          this._projectManagementService.getActiveProject();
        
        // プロジェクト一覧を更新
        this._currentProjects = this._projectManagementService.getAllProjects();
        this._activeProject = updatedProject;
        
        // イベントバスで統一されたプロジェクト更新イベントを発行
        const eventBus = AppGeniusEventBus.getInstance();
        eventBus.emit(
          AppGeniusEventType.PROJECT_UPDATED,
          { 
            id: projectId, 
            path: path, 
            name: name,
            type: 'selected',
            metadata: updatedProject?.metadata || { activeTab: activeTab || 'scope-progress' },
            timestamp: Date.now()
          },
          'ProjectService',
          projectId || path
        );
        Logger.info(`ProjectService: プロジェクト更新イベント(選択)を発行: ${name}, ${path}`);
        
        // VSCode内部イベントも発火
        this._onProjectSelected.fire({
          id: projectId || `local_${Date.now()}`,
          name: name,
          path: path
        });
        this._onProjectsUpdated.fire(this._currentProjects);
      } catch (error) {
        Logger.warn(`ProjectService: プロジェクト情報の更新に失敗しました: ${error}`);
      }
    } catch (error) {
      Logger.error(`ProjectService: プロジェクトを開く際にエラーが発生しました`, error as Error);
      throw error;
    }
  }
  
  /**
   * プロジェクト削除（登録解除）
   * @param name プロジェクト名
   * @param path プロジェクトパス
   * @param id プロジェクトID（オプション）
   * @returns 削除が成功したかどうか
   */
  public async removeProject(name: string, path: string, id?: string): Promise<boolean> {
    try {
      Logger.info(`ProjectService: プロジェクト登録解除: ${name}, パス: ${path}, ID: ${id || 'なし'}`);
      
      if (!name && !path && !id) {
        throw new Error('プロジェクト情報が不足しています');
      }
      
      // ProjectManagementServiceを使用してプロジェクトを登録解除
      try {
        // IDが指定されている場合はそれを使用、なければパスで検索
        let removed = false;
        
        if (id) {
          removed = await this._projectManagementService.removeProjectById(id);
        } else {
          removed = await this._projectManagementService.removeProjectByPath(path);
        }
        
        if (removed) {
          Logger.info(`ProjectService: プロジェクト「${name}」の登録解除に成功しました`);
          
          // プロジェクト一覧を更新
          this._currentProjects = this._projectManagementService.getAllProjects();
          this._activeProject = this._projectManagementService.getActiveProject();
          
          // イベントを発行
          this._onProjectRemoved.fire({
            id: id || `local_${Date.now()}`,
            name: name,
            path: path
          });
          this._onProjectsUpdated.fire(this._currentProjects);
          
          // イベントバスでプロジェクト更新イベント(削除)を発火
          try {
            const eventBus = AppGeniusEventBus.getInstance();
            eventBus.emit(
              AppGeniusEventType.PROJECT_UPDATED,
              { 
                id: id, 
                path: path, 
                name: name,
                type: 'removed',
                timestamp: Date.now()
              },
              'ProjectService',
              id || path
            );
            Logger.info(`ProjectService: プロジェクト更新イベント(削除)を発行: ${name}, ${path}`);
          } catch (error) {
            Logger.warn(`ProjectService: イベント発行に失敗しました: ${error}`);
          }
          
          return true;
        } else {
          Logger.warn(`ProjectService: プロジェクト「${name}」の登録解除に失敗しました`);
          return false;
        }
      } catch (error) {
        Logger.error('ProjectService: プロジェクト登録解除エラー', error as Error);
        throw error;
      }
    } catch (error) {
      Logger.error('ProjectService: プロジェクト登録解除処理エラー', error as Error);
      throw error;
    }
  }
  
  /**
   * アクティブプロジェクトを取得
   * @returns アクティブなプロジェクト情報（なければnull）
   */
  public getActiveProject(): IProjectInfo | null {
    return this._activeProject;
  }
  
  /**
   * プロジェクト一覧を取得
   * @returns 全プロジェクト情報の配列
   */
  public getAllProjects(): IProjectInfo[] {
    return this._currentProjects;
  }
  
  /**
   * プロジェクトパスを設定
   * @param projectPath プロジェクトパス
   */
  public async setProjectPath(projectPath: string): Promise<void> {
    this._projectPath = projectPath;

    // FileSystemServiceから進捗ファイルパスを取得
    this._progressFilePath = this._fileSystemService.getProgressFilePath(projectPath);

    Logger.info(`ProjectService: プロジェクトパスを設定しました: ${projectPath}`);
    Logger.info(`ProjectService: 進捗ファイルパス: ${this._progressFilePath}, ファイル存在: ${fs.existsSync(this._progressFilePath) ? 'はい' : 'いいえ'}`);

    // 進捗ファイルを作成（必要な場合）
    if (!fs.existsSync(this._progressFilePath)) {
      // SCOPE_PROGRESS.mdを作成
      await this._fileSystemService.createProgressFile(projectPath);
    }

    // 重要: VSCode設定にも現在のプロジェクトパスを直接保存
    // これにより、他のコンポーネントも同じプロジェクトパスを参照できる
    try {
      await vscode.workspace.getConfiguration('appgenius').update('currentProjectPath', projectPath, true);
      Logger.info(`ProjectService: VSCode設定にプロジェクトパスを保存しました: ${projectPath}`);
    } catch (error) {
      Logger.warn(`ProjectService: VSCode設定へのプロジェクトパス保存に失敗しました: ${error}`);
    }
  }
  
  /**
   * 進捗ファイルパスを取得
   * @returns スコープ進捗ファイルのパス
   */
  public getProgressFilePath(): string {
    if (this._projectPath) {
      return this._fileSystemService.getProgressFilePath(this._projectPath);
    }
    return this._progressFilePath;
  }

  /**
   * アクティブプロジェクトのパスを取得
   * @returns アクティブプロジェクトのパス。設定されていない場合は空文字列
   */
  public getActiveProjectPath(): string {
    let projectPath = '';

    if (this._activeProject && this._activeProject.path) {
      projectPath = this._activeProject.path;
    } else {
      projectPath = this._projectPath;
    }

    // macOSの.DS_Storeパスが混入している場合、それを除去
    if (projectPath.includes('.DS_Store')) {
      Logger.warn(`ProjectService: 不正なパス(.DS_Store)を修正: ${projectPath}`);
      projectPath = projectPath.replace(/\/.DS_Store(?:\/|$)/, '/');
    }

    return projectPath;
  }
  
  /**
   * タブ状態を保存
   * プロジェクトのメタデータにアクティブタブ情報を永続化
   * @param projectId 保存対象のプロジェクトID
   * @param tabId 保存するタブID
   */
  public async saveTabState(projectId: string, tabId: string): Promise<void> {
    try {
      // 入力パラメータの検証
      if (!projectId || !tabId) {
        Logger.warn('ProjectService: タブ状態を保存できません: プロジェクトIDまたはタブIDが指定されていません');
        throw new Error('プロジェクトIDまたはタブIDが指定されていません');
      }
      
      // 現在の状態をログ出力
      Logger.info(`ProjectService: タブ状態を保存します: プロジェクトID=${projectId}, タブID=${tabId}`);
      
      // 1. プロジェクト情報を取得
      const project = this._projectManagementService.getProject(projectId);
      if (!project) {
        throw new Error(`プロジェクトが見つかりません: ${projectId}`);
      }
      
      // 2. 現在のメタデータを取得
      const metadata = project.metadata || {};
      
      // 3. 前回のアクティブタブと比較
      const previousTab = metadata.activeTab;
      if (previousTab === tabId) {
        // 同じタブの場合は処理をスキップ（不要な更新を防止）
        Logger.info(`ProjectService: 同じタブID(${tabId})が既に保存されているため、更新をスキップします`);
        return;
      }
      
      // 4. メタデータにタブ情報を保存
      metadata.activeTab = tabId;
      metadata.lastTabUpdateTime = Date.now(); // 最終更新時間も記録
      
      // 5. プロジェクトを更新
      await this._projectManagementService.updateProject(projectId, {
        metadata: metadata,
        updatedAt: Date.now() // プロジェクト自体の更新時間も更新
      });
      
      // 6. アクティブプロジェクトを再取得して内部状態を更新
      this._activeProject = this._projectManagementService.getProject(projectId);
      
      // 7. イベントバスにも通知（タブ状態変更を他のコンポーネントに伝達）
      try {
        const eventBus = AppGeniusEventBus.getInstance();
        eventBus.emit(
          AppGeniusEventType.PROJECT_UPDATED,
          { 
            id: projectId, 
            path: project.path, 
            name: project.name,
            type: 'updated',
            metadata: metadata,
            timestamp: Date.now()
          },
          'ProjectService',
          projectId
        );
        Logger.debug(`ProjectService: タブ状態変更イベントを発信: ${tabId}`);
      } catch (error) {
        // イベントバスエラーは無視（コア機能には影響しない）
        Logger.debug(`ProjectService: イベント発信に失敗しましたが処理を継続します: ${(error as Error).message}`);
      }
      
      Logger.info(`ProjectService: タブ状態を保存しました: プロジェクト=${project.name}, タブID=${tabId}`);
    } catch (error) {
      Logger.error(`ProjectService: タブ状態の保存に失敗しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  // _getDefaultClaudeTemplateメソッドは削除（ClaudeMdServiceに一元化）
  
  /**
   * プロジェクト一覧を更新して取得
   * @returns 更新されたプロジェクト一覧
   */
  public async refreshProjectsList(): Promise<IProjectInfo[]> {
    try {
      // ProjectManagementServiceからプロジェクト一覧を再取得
      this._currentProjects = this._projectManagementService.getAllProjects();
      this._activeProject = this._projectManagementService.getActiveProject();
      
      Logger.info(`ProjectService: プロジェクト一覧を更新しました: ${this._currentProjects.length}件`);
      
      // 現在のプロジェクト状態を通知
      if (this._activeProject && this._activeProject.path) {
        const progressFilePath = this.getProgressFilePath();
        
        this._onProjectUIStateUpdated.fire({
          allProjects: this._currentProjects,
          activeProject: this._activeProject,
          progressFilePath: progressFilePath,
          progressFileExists: fs.existsSync(progressFilePath)
        });
      }
      
      return this._currentProjects;
    } catch (error) {
      Logger.error(`ProjectService: プロジェクト一覧の更新に失敗しました`, error as Error);
      return this._currentProjects;
    }
  }

  /**
   * プロジェクトUI状態を同期
   * UI更新に必要な情報を一度に取得
   * @param projectPath 対象プロジェクトパス
   * @returns UI更新に必要な情報
   */
  public async syncProjectUIState(projectPath: string): Promise<{
    allProjects: IProjectInfo[];
    activeProject: IProjectInfo | null;
    progressFilePath: string;
    progressFileExists: boolean;
  }> {
    try {
      // プロジェクトパスが指定されている場合は、パスを更新
      if (projectPath && projectPath !== this._projectPath) {
        await this.setProjectPath(projectPath);
      }
      
      // 最新のプロジェクト一覧を取得
      const allProjects = this.getAllProjects();
      const activeProject = this.getActiveProject();
      const progressFilePath = this.getProgressFilePath();
      
      // 結果をまとめて返す
      const result = {
        allProjects: allProjects,
        activeProject: activeProject,
        progressFilePath: progressFilePath,
        progressFileExists: fs.existsSync(progressFilePath)
      };
      
      // イベントも発火
      this._onProjectUIStateUpdated.fire(result);
      
      return result;
    } catch (error) {
      Logger.error(`ProjectService: プロジェクトUI状態の同期に失敗しました`, error as Error);
      
      // エラー時も最低限の情報を返す
      return {
        allProjects: this._currentProjects,
        activeProject: this._activeProject,
        progressFilePath: this._progressFilePath,
        progressFileExists: false
      };
    }
  }

  /**
   * 指定されたプロジェクトがアクティブであることを確認し、必要に応じて選択状態を更新
   * @param name プロジェクト名
   * @param path プロジェクトパス
   * @param activeTab アクティブタブID（オプション）
   * @returns 処理が成功したかどうか
   */
  public async ensureActiveProject(name: string, path: string, activeTab?: string): Promise<boolean> {
    try {
      // 現在のアクティブプロジェクトを取得
      const activeProject = this.getActiveProject();
      
      // 指定されたプロジェクトが現在のアクティブプロジェクトと一致するか確認
      if (activeProject && activeProject.path === path) {
        Logger.info(`ProjectService: 既にアクティブなプロジェクトです: ${name}`);
        
        // タブ状態を更新する場合は、タブ状態を保存
        if (activeTab && activeProject.id) {
          await this.saveTabState(activeProject.id, activeTab);
          Logger.info(`ProjectService: タブ状態を更新しました: ${activeTab}`);
        }
        
        return true;
      } else {
        // アクティブプロジェクトが一致しない場合は、指定されたプロジェクトをアクティブに設定
        await this.selectProject(name, path, activeTab);
        Logger.info(`ProjectService: プロジェクトをアクティブに設定しました: ${name}`);
        
        return true;
      }
    } catch (error) {
      Logger.error('ProjectService: プロジェクトの同期に失敗しました', error as Error);
      return false;
    }
  }
  
  /**
   * リソースを解放
   */
  public dispose(): void {
    this._onProjectSelected.dispose();
    this._onProjectCreated.dispose();
    this._onProjectRemoved.dispose();
    this._onProjectsUpdated.dispose();
    this._onProjectUIStateUpdated.dispose(); // 新規イベントエミッターの解放
    
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}