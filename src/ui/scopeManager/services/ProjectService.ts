import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IProjectInfo } from '../types/ScopeManagerTypes';
import { Logger } from '../../../utils/logger';
import { FileSystemService, IFileSystemService } from './FileSystemService';
import { AppGeniusEventBus, AppGeniusEventType } from '../../../services/AppGeniusEventBus';

/**
 * プロジェクトサービスインターフェース
 * ScopeManagerPanelのプロジェクト管理機能を分離
 */
export interface IProjectService {
  // プロジェクト操作
  createProject(name: string, description: string): Promise<string>;
  loadExistingProject(projectPath: string): Promise<IProjectInfo>;
  selectProject(name: string, path: string, activeTab?: string): Promise<void>;
  removeProject(name: string, path: string, id?: string): Promise<boolean>;
  
  // プロジェクト情報
  getActiveProject(): IProjectInfo | null;
  getAllProjects(): IProjectInfo[];
  
  // プロジェクトパス関連
  setProjectPath(projectPath: string): Promise<void>;
  getStatusFilePath(): string;
  
  // タブ状態管理
  saveTabState(projectId: string, tabId: string): Promise<void>;
  
  // イベント
  onProjectSelected: vscode.Event<IProjectInfo>;
  onProjectCreated: vscode.Event<IProjectInfo>;
  onProjectRemoved: vscode.Event<IProjectInfo>;
  onProjectsUpdated: vscode.Event<IProjectInfo[]>;
  
  // リソース解放
  dispose(): void;
}

/**
 * プロジェクトサービス実装クラス
 */
export class ProjectService implements IProjectService {
  private _onProjectSelected = new vscode.EventEmitter<IProjectInfo>();
  public readonly onProjectSelected = this._onProjectSelected.event;
  
  private _onProjectCreated = new vscode.EventEmitter<IProjectInfo>();
  public readonly onProjectCreated = this._onProjectCreated.event;
  
  private _onProjectRemoved = new vscode.EventEmitter<IProjectInfo>();
  public readonly onProjectRemoved = this._onProjectRemoved.event;
  
  private _onProjectsUpdated = new vscode.EventEmitter<IProjectInfo[]>();
  public readonly onProjectsUpdated = this._onProjectsUpdated.event;
  
  private _disposables: vscode.Disposable[] = [];
  private _projectPath: string = '';
  private _statusFilePath: string = '';
  private _currentProjects: IProjectInfo[] = [];
  private _activeProject: IProjectInfo | null = null;
  private _extensionPath: string;
  private _fileSystemService: IFileSystemService;
  
  // シングルトンインスタンス
  private static _instance: ProjectService;
  
  public static getInstance(fileSystemService?: IFileSystemService): ProjectService {
    if (!ProjectService._instance) {
      ProjectService._instance = new ProjectService(fileSystemService);
    }
    return ProjectService._instance;
  }
  
  private constructor(fileSystemService?: IFileSystemService) {
    this._fileSystemService = fileSystemService || FileSystemService.getInstance();
    // 拡張機能のパスを取得
    this._extensionPath = vscode.extensions.getExtension('mikoto.appgenius-ai')?.extensionPath || '';
    
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
      const projectService = this._getProjectManagementService();
      this._currentProjects = projectService.getAllProjects();
      this._activeProject = projectService.getActiveProject();
      
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
    // イベントバスからのPROJECT_SELECTED, PROJECT_CREATED, PROJECT_REMOVEDイベントをリッスン
    const eventBus = AppGeniusEventBus.getInstance();
    
    // プロジェクト選択イベント
    this._disposables.push(
      eventBus.onEventType(AppGeniusEventType.PROJECT_SELECTED, async (event) => {
        // 自分自身が送信したイベントは無視（循環を防ぐ）
        if (event.source === 'ProjectService') {
          return;
        }
        
        Logger.info(`ProjectService: 他のコンポーネントからのプロジェクト選択イベントを受信しました: ${event.data?.name}`);
        
        // プロジェクト情報を更新
        this._activeProject = event.data;
        
        // イベントを発火
        this._onProjectSelected.fire(event.data);
      })
    );
    
    // プロジェクト作成イベント
    this._disposables.push(
      eventBus.onEventType(AppGeniusEventType.PROJECT_CREATED, async (event) => {
        // 自分自身が送信したイベントは無視
        if (event.source === 'ProjectService') {
          return;
        }
        
        Logger.info(`ProjectService: 他のコンポーネントからのプロジェクト作成イベントを受信しました: ${event.data?.name}`);
        
        // プロジェクト一覧を更新
        this._initializeProjects();
        
        // イベントを発火
        this._onProjectCreated.fire(event.data);
        this._onProjectsUpdated.fire(this._currentProjects);
      })
    );
    
    // プロジェクト削除イベント
    this._disposables.push(
      eventBus.onEventType(AppGeniusEventType.PROJECT_REMOVED, async (event) => {
        // 自分自身が送信したイベントは無視
        if (event.source === 'ProjectService') {
          return;
        }
        
        Logger.info(`ProjectService: 他のコンポーネントからのプロジェクト削除イベントを受信しました: ${event.data?.name}`);
        
        // プロジェクト一覧を更新
        this._initializeProjects();
        
        // イベントを発火
        this._onProjectRemoved.fire(event.data);
        this._onProjectsUpdated.fire(this._currentProjects);
      })
    );
  }
  
  /**
   * ProjectManagementServiceを取得
   */
  private _getProjectManagementService(): any {
    const { ProjectManagementService } = require('../../../services/ProjectManagementService');
    return ProjectManagementService.getInstance();
  }
  
  /**
   * 新規プロジェクト作成
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
      
      // CLAUDE.mdとCURRENT_STATUS.mdファイルを作成
      const claudeMdPath = path.join(projectDir, 'CLAUDE.md');
      const statusFilePath = path.join(docsDir, 'CURRENT_STATUS.md');
      
      // CLAUDETEMPLATEからCLAUDE.mdのコンテンツを作成
      let claudeMdContent = '';
      // 拡張機能のパスを使用して正確なテンプレートファイルを参照
      const claudeTemplatePath = path.join(this._extensionPath, 'docs', 'CLAUDETEMPLATE.md');
      try {
        if (fs.existsSync(claudeTemplatePath)) {
          // テンプレートファイルを読み込む
          claudeMdContent = fs.readFileSync(claudeTemplatePath, 'utf8');
          // プロジェクト名とプロジェクト説明を置換
          claudeMdContent = claudeMdContent
            .replace(/# プロジェクト名/, `# ${name}`)
            .replace(/\[プロジェクトの概要と目的を簡潔に記述してください。1-2段落程度が理想的です。\]/, description || `${name}プロジェクトの説明をここに記述します。`)
            .replace(/\[コマンド\]/g, 'npm start'); // 開発コマンドの例を追加
          
          Logger.info(`ProjectService: CLAUDETEMPLATEを読み込みました: ${claudeTemplatePath}`);
        } else {
          // テンプレートが見つからない場合はデフォルトテンプレートを使用
          claudeMdContent = this._getDefaultClaudeTemplate(name, description);
          Logger.warn(`ProjectService: CLAUDETEMPLATEが見つかりませんでした。デフォルトテンプレートを使用します。検索パス: ${claudeTemplatePath}`);
        }
      } catch (error) {
        // エラーが発生した場合はデフォルトテンプレートを使用
        claudeMdContent = this._getDefaultClaudeTemplate(name, description);
        Logger.error(`ProjectService: CLAUDETEMPLATEの読み込みに失敗しました: ${claudeTemplatePath}`, error as Error);
      }
      
      // ファイルに書き込み
      fs.writeFileSync(claudeMdPath, claudeMdContent, 'utf8');
      
      // CURRENT_STATUS.mdファイルを作成
      await this._fileSystemService.createDefaultStatusFile(projectDir, name);
      
      // ProjectManagementServiceにプロジェクトを登録
      try {
        // ProjectManagementServiceを取得
        const projectService = this._getProjectManagementService();
        
        // 新規プロジェクトとして登録
        const projectId = await projectService.createProject({
          name: name,
          description: description || "",
          path: projectDir
        });
        
        Logger.info(`ProjectService: 新規作成したプロジェクトをProjectManagementServiceに登録: ID=${projectId}, 名前=${name}, パス=${projectDir}`);
        
        // プロジェクトをアクティブに設定
        await projectService.setActiveProject(projectId);
        Logger.info(`ProjectService: 新規作成したプロジェクトをアクティブに設定: ID=${projectId}`);
        
        // プロジェクト一覧を更新
        this._currentProjects = projectService.getAllProjects();
        this._activeProject = projectService.getActiveProject();
        
        // プロジェクト選択イベントを発行
        try {
          const eventBus = AppGeniusEventBus.getInstance();
          eventBus.emit(
            AppGeniusEventType.PROJECT_CREATED,
            { id: projectId, path: projectDir, name: name },
            'ProjectService',
            projectId
          );
          Logger.info(`ProjectService: プロジェクト作成イベントを発行: ${name}, ${projectDir}`);
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
      const statusFilePath = path.join(docsDir, 'CURRENT_STATUS.md');
      
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
      
      // ステータスファイルが存在しない場合は作成
      if (!fs.existsSync(statusFilePath)) {
        const createStatus = await vscode.window.showInformationMessage(
          'CURRENT_STATUS.mdファイルが見つかりません。自動的に作成しますか？',
          { modal: true },
          '作成する'
        );
        
        if (createStatus === '作成する') {
          await this._fileSystemService.createDefaultStatusFile(projectPath);
        } else {
          Logger.info('ProjectService: プロジェクト読み込みがキャンセルされました: CURRENT_STATUS.mdの作成がキャンセル');
          throw new Error('CURRENT_STATUS.mdの作成がキャンセルされました');
        }
      }
      
      // mockupsディレクトリが存在しない場合は作成
      const mockupsDir = path.join(projectPath, 'mockups');
      if (!fs.existsSync(mockupsDir)) {
        await this._fileSystemService.ensureDirectoryExists(mockupsDir);
      }
      
      // プロジェクト名を取得（フォルダ名から）
      const projectName = path.basename(projectPath);
      
      // ProjectManagementServiceにプロジェクトを登録 - ここが追加されたコード
      try {
        // ProjectManagementServiceを取得
        const projectService = this._getProjectManagementService();
        
        // 既存のプロジェクトを検索
        const projects = projectService.getAllProjects();
        let projectId: string | undefined;
        let existingProject = projects.find((p: any) => p.path === projectPath);
        
        if (existingProject) {
          // 既存のプロジェクトが見つかった場合は、アクティブに設定
          projectId = existingProject.id;
          await projectService.updateProject(projectId, {
            updatedAt: Date.now()
          });
          Logger.info(`ProjectService: 既存プロジェクトをアクティブに更新: ID=${projectId}, 名前=${projectName}`);
        } else {
          // 新規プロジェクトとして登録
          projectId = await projectService.createProject({
            name: projectName,
            description: "",
            path: projectPath
          });
          Logger.info(`ProjectService: 読み込んだプロジェクトを新規登録: ID=${projectId}, 名前=${projectName}, パス=${projectPath}`);
        }
        
        // プロジェクトをアクティブに設定
        if (projectId) {
          await projectService.setActiveProject(projectId);
          Logger.info(`ProjectService: 読み込んだプロジェクトをアクティブに設定: ID=${projectId}`);
        }
        
        // プロジェクト一覧を更新
        this._currentProjects = projectService.getAllProjects();
        this._activeProject = projectService.getActiveProject();
        
        // プロジェクト選択イベントを発行
        try {
          const eventBus = AppGeniusEventBus.getInstance();
          eventBus.emit(
            AppGeniusEventType.PROJECT_SELECTED,
            { id: projectId, path: projectPath, name: projectName },
            'ProjectService',
            projectId || projectPath
          );
          Logger.info(`ProjectService: プロジェクト選択イベントを発行: ${projectName}, ${projectPath}`);
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
   */
  public async selectProject(name: string, path: string, activeTab?: string): Promise<void> {
    try {
      Logger.info(`ProjectService: プロジェクト選択: ${name}, パス: ${path}`);
      
      // ProjectManagementServiceを取得
      const projectService = this._getProjectManagementService();
      
      // 既存のプロジェクトを検索
      const projects = projectService.getAllProjects();
      let projectId: string | undefined;
      let project = projects.find((p: any) => p.path === path);
      
      // プロジェクトが見つからない場合、パスが存在するか確認
      if (!project) {
        // 相対パスをフルパスに変換して試行
        const fullPath = path.resolve(path);
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
        const existingProject = projectService.getProject(projectId);
        
        // アクティブタブ情報を更新
        if (existingProject) {
          const metadata = existingProject.metadata || {};
          await projectService.updateProject(projectId, {
            metadata: {
              ...metadata,
              activeTab: activeTab || metadata.activeTab || 'current-status'
            }
          });
        }
        
        await projectService.setActiveProject(projectId);
        Logger.info(`ProjectService: 既存プロジェクトをアクティブに設定: ID=${projectId}, パス=${path}, アクティブタブ=${activeTab || (existingProject?.metadata?.activeTab) || 'current-status'}`);
      } else {
        // プロジェクトが見つからない場合は、新規作成または更新
        try {
          const existingProjectWithPath = projects.find((p: any) => p.path === path);
          
          if (existingProjectWithPath) {
            // パスが同じプロジェクトが見つかった場合は更新
            projectId = existingProjectWithPath.id;
            await projectService.updateProject(projectId, {
              name: name,
              updatedAt: Date.now(),
              metadata: {
                ...existingProjectWithPath.metadata,
                activeTab: activeTab || existingProjectWithPath.metadata?.activeTab || 'current-status'
              }
            });
            Logger.info(`ProjectService: 既存プロジェクトを更新: ID=${projectId}, 名前=${name}, アクティブタブ=${activeTab || existingProjectWithPath.metadata?.activeTab || 'current-status'}`);
          } else {
            // 新規プロジェクトとして登録
            projectId = await projectService.createProject({
              name: name,
              description: "",
              path: path,
              metadata: {
                activeTab: activeTab || 'current-status'
              }
            });
            Logger.info(`ProjectService: 新規プロジェクトを作成: ID=${projectId}, 名前=${name}, パス=${path}, アクティブタブ=${activeTab || 'current-status'}`);
          }
          
          // 作成または更新したプロジェクトをアクティブに設定
          if (projectId) {
            await projectService.setActiveProject(projectId);
          }
        } catch (error) {
          Logger.warn(`ProjectService: プロジェクト登録に失敗しましたが、ローカルパスのみで続行します: ${error}`);
        }
      }
      
      // イベントバスでプロジェクト選択イベントを発火
      try {
        const eventBus = AppGeniusEventBus.getInstance();
        eventBus.emit(
          AppGeniusEventType.PROJECT_SELECTED,
          { id: projectId, path: path, name: name },
          'ProjectService',
          projectId || path
        );
        Logger.info(`ProjectService: プロジェクト選択イベントを発行: ${name}, ${path}`);
      } catch (error) {
        Logger.warn(`ProjectService: イベント発行に失敗しました: ${error}`);
      }
      
      // ProjectManagementServiceから最新のプロジェクト情報を取得して同期
      try {
        const updatedProject = projectId ? 
          projectService.getProject(projectId) : 
          projectService.getActiveProject();
        
        // プロジェクト一覧を更新
        this._currentProjects = projectService.getAllProjects();
        this._activeProject = updatedProject;
        
        // イベントを発火
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
   */
  public async removeProject(name: string, path: string, id?: string): Promise<boolean> {
    try {
      Logger.info(`ProjectService: プロジェクト登録解除: ${name}, パス: ${path}, ID: ${id || 'なし'}`);
      
      if (!name && !path && !id) {
        throw new Error('プロジェクト情報が不足しています');
      }
      
      // ProjectManagementServiceを使用してプロジェクトを登録解除
      try {
        const projectService = this._getProjectManagementService();
        
        // IDが指定されている場合はそれを使用、なければパスで検索
        let removed = false;
        
        if (id) {
          removed = await projectService.removeProjectById(id);
        } else {
          removed = await projectService.removeProjectByPath(path);
        }
        
        if (removed) {
          Logger.info(`ProjectService: プロジェクト「${name}」の登録解除に成功しました`);
          
          // プロジェクト一覧を更新
          this._currentProjects = projectService.getAllProjects();
          this._activeProject = projectService.getActiveProject();
          
          // イベントを発行
          this._onProjectRemoved.fire({
            id: id || `local_${Date.now()}`,
            name: name,
            path: path
          });
          this._onProjectsUpdated.fire(this._currentProjects);
          
          // イベントバスでプロジェクト削除イベントを発火
          try {
            const eventBus = AppGeniusEventBus.getInstance();
            eventBus.emit(
              AppGeniusEventType.PROJECT_REMOVED,
              { id: id, path: path, name: name },
              'ProjectService',
              id || path
            );
            Logger.info(`ProjectService: プロジェクト削除イベントを発行: ${name}, ${path}`);
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
   */
  public getActiveProject(): IProjectInfo | null {
    return this._activeProject;
  }
  
  /**
   * プロジェクト一覧を取得
   */
  public getAllProjects(): IProjectInfo[] {
    return this._currentProjects;
  }
  
  /**
   * プロジェクトパスを設定
   */
  public async setProjectPath(projectPath: string): Promise<void> {
    this._projectPath = projectPath;
    this._statusFilePath = path.join(projectPath, 'docs', 'CURRENT_STATUS.md');
    
    Logger.info(`ProjectService: プロジェクトパスを設定しました: ${projectPath}`);
    Logger.info(`ProjectService: ステータスファイルパス: ${this._statusFilePath}, ファイル存在: ${fs.existsSync(this._statusFilePath) ? 'はい' : 'いいえ'}`);
    
    // ステータスファイルを作成（必要な場合）
    if (!fs.existsSync(this._statusFilePath)) {
      await this._fileSystemService.createDefaultStatusFile(projectPath);
    }
  }
  
  /**
   * ステータスファイルパスを取得
   */
  public getStatusFilePath(): string {
    return this._statusFilePath;
  }
  
  /**
   * タブ状態を保存
   */
  public async saveTabState(projectId: string, tabId: string): Promise<void> {
    try {
      if (!projectId || !tabId) {
        Logger.warn('ProjectService: タブ状態を保存できません: プロジェクトIDまたはタブIDが指定されていません');
        throw new Error('プロジェクトIDまたはタブIDが指定されていません');
      }
      
      Logger.info(`ProjectService: タブ状態を保存します: プロジェクトID=${projectId}, タブID=${tabId}`);
      
      // ProjectManagementServiceを取得
      const projectService = this._getProjectManagementService();
      
      // プロジェクト情報を取得
      const project = projectService.getProject(projectId);
      if (!project) {
        throw new Error(`プロジェクトが見つかりません: ${projectId}`);
      }
      
      // メタデータにタブ情報を追加
      const metadata = project.metadata || {};
      metadata.activeTab = tabId;
      
      // プロジェクトを更新
      await projectService.updateProject(projectId, {
        metadata: metadata
      });
      
      // アクティブプロジェクトを再取得
      this._activeProject = projectService.getProject(projectId);
      
      Logger.info(`ProjectService: タブ状態を保存しました: プロジェクト=${project.name}, タブID=${tabId}`);
    } catch (error) {
      Logger.error(`ProjectService: タブ状態の保存に失敗しました: ${(error as Error).message}`, error as Error);
      throw error;
    }
  }
  
  /**
   * デフォルトのCLAUDE.mdテンプレートを取得
   */
  private _getDefaultClaudeTemplate(projectName: string, description?: string): string {
    return `# ${projectName}

## プロジェクト概要

${description || `${projectName}プロジェクトの説明をここに記述します。`}

## 参考リンク

- [要件定義](./docs/requirements.md)
- [開発状況](./docs/CURRENT_STATUS.md)

## プロジェクト情報
- 作成日: ${new Date().toISOString().split('T')[0]}
- ステータス: 計画中
`;
  }
  
  /**
   * リソースを解放
   */
  public dispose(): void {
    this._onProjectSelected.dispose();
    this._onProjectCreated.dispose();
    this._onProjectRemoved.dispose();
    this._onProjectsUpdated.dispose();
    
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}