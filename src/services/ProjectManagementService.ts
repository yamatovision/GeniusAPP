import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { ConfigManager } from '../utils/configManager';

/**
 * プロジェクト情報の型定義
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  path: string;
  status: 'active' | 'archived' | 'completed';
  phases: {
    requirements: boolean;
    design: boolean;
    implementation: boolean;
    testing: boolean;
    deployment: boolean;
  };
  metadata: {
    [key: string]: any;
  };
}

/**
 * プロジェクト管理サービス
 * プロジェクトの作成、更新、削除、一覧表示を担当
 */
export class ProjectManagementService {
  private static instance: ProjectManagementService;
  private projects: Map<string, Project> = new Map();
  private storageDir: string;
  private metadataFile: string;

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ProjectManagementService {
    if (!ProjectManagementService.instance) {
      ProjectManagementService.instance = new ProjectManagementService();
    }
    return ProjectManagementService.instance;
  }

  /**
   * コンストラクタ
   */
  private constructor() {
    // ストレージディレクトリの設定
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.storageDir = path.join(homeDir, '.appgenius-ai', 'projects');
    this.metadataFile = path.join(this.storageDir, 'projects.json');

    // ディレクトリの作成
    this.ensureDirectoryExists(this.storageDir);
    
    // 既存のプロジェクトをロード
    this.loadProjects();
    
    Logger.info(`ProjectManagementService initialized: ${this.storageDir}`);
  }

  /**
   * プロジェクトの作成
   * @param projectData プロジェクトの初期データ
   * @returns 作成されたプロジェクトのID
   */
  public async createProject(
    projectData: {
      name: string;
      description?: string;
      path?: string;
    }
  ): Promise<string> {
    try {
      // プロジェクトIDの生成
      const id = `project_${Date.now()}`;
      const projectDir = path.join(this.storageDir, id);
      
      // ディレクトリの作成
      this.ensureDirectoryExists(projectDir);
      
      // 現在時刻を取得
      const now = Date.now();
      
      // プロジェクトメタデータを作成
      const project: Project = {
        id,
        name: projectData.name,
        description: projectData.description || '',
        createdAt: now,
        updatedAt: now,
        path: projectData.path || '',
        status: 'active',
        phases: {
          requirements: false,
          design: false,
          implementation: false,
          testing: false,
          deployment: false
        },
        metadata: {}
      };
      
      // メモリ上のマップに保存
      this.projects.set(id, project);
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project created: ${id}`);
      
      return id;
    } catch (error) {
      Logger.error(`Failed to create project: ${(error as Error).message}`);
      throw new Error(`プロジェクトの作成に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクトの更新
   * @param id プロジェクトID
   * @param updates 更新内容
   * @returns 更新されたプロジェクト
   */
  public async updateProject(
    id: string,
    updates: Partial<Omit<Project, 'id' | 'createdAt'>>
  ): Promise<Project | undefined> {
    try {
      // 既存のプロジェクトを取得
      const project = this.projects.get(id);
      if (!project) {
        Logger.warn(`Project not found: ${id}`);
        return undefined;
      }
      
      // 更新を適用
      Object.assign(project, updates);
      
      // 更新日時を設定
      project.updatedAt = Date.now();
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project updated: ${id}`);
      
      return project;
    } catch (error) {
      Logger.error(`Failed to update project: ${(error as Error).message}`);
      throw new Error(`プロジェクトの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクトのフェーズ状態を更新
   * @param id プロジェクトID
   * @param phase フェーズ名
   * @param completed 完了状態
   * @returns 更新されたプロジェクト
   */
  public async updateProjectPhase(
    id: string,
    phase: keyof Project['phases'],
    completed: boolean
  ): Promise<Project | undefined> {
    try {
      // 既存のプロジェクトを取得
      const project = this.projects.get(id);
      if (!project) {
        Logger.warn(`Project not found: ${id}`);
        return undefined;
      }
      
      // フェーズの状態を更新
      project.phases[phase] = completed;
      
      // 更新日時を設定
      project.updatedAt = Date.now();
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project phase updated: ${id}, ${phase}=${completed}`);
      
      return project;
    } catch (error) {
      Logger.error(`Failed to update project phase: ${(error as Error).message}`);
      throw new Error(`プロジェクトフェーズの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクトの削除
   * @param id プロジェクトID
   * @returns 削除が成功したかどうか
   */
  public async deleteProject(id: string): Promise<boolean> {
    try {
      // 存在確認
      if (!this.projects.has(id)) {
        return false;
      }
      
      // メモリから削除
      this.projects.delete(id);
      
      // ディレクトリのパス
      const projectDir = path.join(this.storageDir, id);
      
      // ディレクトリが存在する場合は削除
      if (fs.existsSync(projectDir)) {
        await this.deleteDirectory(projectDir);
      }
      
      // メタデータの更新
      await this.saveMetadata();
      
      Logger.info(`Project deleted: ${id}`);
      
      return true;
    } catch (error) {
      Logger.error(`Failed to delete project: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * プロジェクトの取得
   * @param id プロジェクトID
   * @returns プロジェクトデータ
   */
  public getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  /**
   * 全てのプロジェクトを取得
   * @returns プロジェクトの配列
   */
  public getAllProjects(): Project[] {
    return Array.from(this.projects.values())
      .sort((a, b) => b.updatedAt - a.updatedAt); // 更新日時でソート
  }

  /**
   * 指定したステータスのプロジェクトを取得
   * @param status プロジェクトステータス
   * @returns プロジェクトの配列
   */
  public getProjectsByStatus(status: Project['status']): Project[] {
    return Array.from(this.projects.values())
      .filter(project => project.status === status)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * プロジェクトのメタデータを更新
   * @param id プロジェクトID
   * @param key メタデータのキー
   * @param value メタデータの値
   * @returns 更新されたプロジェクト
   */
  public async updateProjectMetadata(
    id: string,
    key: string,
    value: any
  ): Promise<Project | undefined> {
    try {
      // 既存のプロジェクトを取得
      const project = this.projects.get(id);
      if (!project) {
        Logger.warn(`Project not found: ${id}`);
        return undefined;
      }
      
      // メタデータを更新
      project.metadata[key] = value;
      
      // 更新日時を設定
      project.updatedAt = Date.now();
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project metadata updated: ${id}, ${key}`);
      
      return project;
    } catch (error) {
      Logger.error(`Failed to update project metadata: ${(error as Error).message}`);
      throw new Error(`プロジェクトメタデータの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 現在アクティブなプロジェクトを取得
   * @returns アクティブなプロジェクト
   */
  public getActiveProject(): Project | undefined {
    // configから現在アクティブなプロジェクトIDを取得
    const activeProjectId = ConfigManager.get<string>('activeProjectId');
    
    if (activeProjectId && this.projects.has(activeProjectId)) {
      return this.projects.get(activeProjectId);
    }
    
    return undefined;
  }

  /**
   * アクティブなプロジェクトを設定
   * @param id プロジェクトID
   * @returns 成功したかどうか
   */
  public async setActiveProject(id: string): Promise<boolean> {
    try {
      // プロジェクトの存在確認
      if (!this.projects.has(id)) {
        return false;
      }
      
      // configに保存
      await ConfigManager.update('activeProjectId', id, true);
      
      Logger.info(`Active project set: ${id}`);
      
      return true;
    } catch (error) {
      Logger.error(`Failed to set active project: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * プロジェクトのディスクからのロード
   */
  private async loadProjects(): Promise<void> {
    try {
      // メタデータファイルが存在するか確認
      if (fs.existsSync(this.metadataFile)) {
        // メタデータファイルを読み込む
        const metadata = await fs.promises.readFile(this.metadataFile, 'utf8');
        const projectList = JSON.parse(metadata) as Project[];
        
        // メタデータをマップに設定
        projectList.forEach(project => {
          this.projects.set(project.id, project);
        });
        
        Logger.info(`Loaded ${projectList.length} projects from metadata`);
      } else {
        Logger.info('No project metadata found, creating new file');
        // 新しいメタデータファイルを作成
        await this.saveMetadata();
      }
    } catch (error) {
      Logger.error(`Failed to load projects: ${(error as Error).message}`);
    }
  }

  /**
   * メタデータをファイルに保存
   */
  private async saveMetadata(): Promise<void> {
    try {
      const projectList = Array.from(this.projects.values());
      await fs.promises.writeFile(this.metadataFile, JSON.stringify(projectList, null, 2), 'utf8');
      Logger.debug(`Saved metadata for ${projectList.length} projects`);
    } catch (error) {
      Logger.error(`Failed to save metadata: ${(error as Error).message}`);
    }
  }

  /**
   * ディレクトリが存在することを確認し、なければ作成
   * @param dir ディレクトリパス
   */
  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * ディレクトリを再帰的に削除
   * @param dir ディレクトリパス
   */
  private async deleteDirectory(dir: string): Promise<void> {
    if (fs.promises.rm) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    } else {
      // 古いバージョンのNode.jsの場合は再帰的に削除
      const files = await fs.promises.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.promises.lstat(filePath);
        
        if (stat.isDirectory()) {
          await this.deleteDirectory(filePath);
        } else {
          await fs.promises.unlink(filePath);
        }
      }
      
      await fs.promises.rmdir(dir);
    }
  }
}