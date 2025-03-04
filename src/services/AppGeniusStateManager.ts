import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { AppGeniusEventBus, AppGeniusEventType } from './AppGeniusEventBus';
import { ProjectManagementService, Project } from './ProjectManagementService';

/**
 * 要件定義情報
 */
export interface Requirements {
  document: string;
  sections: RequirementSection[];
  extractedItems: RequirementItem[];
  chatHistory: ChatMessage[];
}

/**
 * 要件セクション
 */
export interface RequirementSection {
  id: string;
  title: string;
  content: string;
}

/**
 * 要件項目
 */
export interface RequirementItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * チャットメッセージ
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  codeBlocks?: CodeBlock[];
}

/**
 * コードブロック
 */
export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  filename?: string;
  path?: string;
}

/**
 * モックアップ
 */
export interface Mockup {
  id: string;
  name: string;
  description?: string;
  pageId: string;
  pageName: string;
  html: string;
  css?: string;
  js?: string;
  htmlPath?: string;
  cssPath?: string;
  jsPath?: string;
  createdAt: number;
  updatedAt: number;
  sourceType: 'requirements' | 'manual' | 'imported';
}

/**
 * ページ定義
 */
export interface PageDefinition {
  id: string;
  name: string;
  description: string;
  route: string;
  components: string[];
  apiEndpoints: string[];
  mockups: string[];
}

/**
 * 実装スコープ
 */
export interface ImplementationScope {
  items: ImplementationItem[];
  selectedIds: string[];
  estimatedTime: string;
  totalProgress: number;
  startDate: string;
  targetDate: string;
  projectPath: string;
}

/**
 * 実装項目
 */
export interface ImplementationItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  complexity: 'high' | 'medium' | 'low';
  isSelected: boolean;
  dependencies: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  progress: number;
  notes?: string;
  assignee?: string;
  estimatedHours?: number;
  relatedMockups?: string[];
  relatedRequirements?: string[];
}

/**
 * フェーズステータス
 */
export interface PhaseStatus {
  isCompleted: boolean;
  progress: number;
  startDate?: string;
  completionDate?: string;
}

/**
 * AppGenius状態管理サービス
 * 各モジュール間のデータ共有と永続化を担当
 */
export class AppGeniusStateManager {
  private static instance: AppGeniusStateManager;
  private eventBus: AppGeniusEventBus;
  private projectService: ProjectManagementService;
  private storageDir: string;
  
  private constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.storageDir = path.join(homeDir, '.appgenius-ai', 'state');
    this.ensureDirectoryExists(this.storageDir);
    
    this.eventBus = AppGeniusEventBus.getInstance();
    this.projectService = ProjectManagementService.getInstance();
    
    this.registerEventHandlers();
    Logger.info('AppGeniusStateManager initialized');
  }
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): AppGeniusStateManager {
    if (!AppGeniusStateManager.instance) {
      AppGeniusStateManager.instance = new AppGeniusStateManager();
    }
    return AppGeniusStateManager.instance;
  }
  
  /**
   * VSCode設定への状態保存
   * @param key 設定キー
   * @param data 保存するデータ
   * @param isGlobal グローバル設定かどうか
   */
  public async saveToConfig<T>(key: string, data: T, isGlobal: boolean = false): Promise<void> {
    try {
      Logger.debug(`Saving to config: ${key}`);
      await vscode.workspace.getConfiguration('appgeniusAI').update(key, data, isGlobal);
    } catch (error) {
      Logger.error(`Failed to save to config: ${key}`, error as Error);
      throw error;
    }
  }
  
  /**
   * VSCode設定からの状態取得
   * @param key 設定キー
   * @param defaultValue デフォルト値
   */
  public getFromConfig<T>(key: string, defaultValue: T): T {
    try {
      return vscode.workspace.getConfiguration('appgeniusAI').get<T>(key, defaultValue);
    } catch (error) {
      Logger.error(`Failed to get from config: ${key}`, error as Error);
      return defaultValue;
    }
  }
  
  /**
   * プロジェクトのローカルデータを保存
   * @param projectId プロジェクトID
   * @param key データキー
   * @param data 保存するデータ
   */
  public async saveProjectData<T>(projectId: string, key: string, data: T): Promise<void> {
    try {
      const projectDir = path.join(this.storageDir, projectId);
      this.ensureDirectoryExists(projectDir);
      
      const filePath = path.join(projectDir, `${key}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      
      // プロジェクトの更新日時を更新
      const project = this.projectService.getProject(projectId);
      if (project) {
        await this.projectService.updateProject(projectId, {
          updatedAt: Date.now()
        });
      }
      
      Logger.debug(`Saved project data: ${projectId}.${key}`);
    } catch (error) {
      Logger.error(`Failed to save project data: ${projectId}.${key}`, error as Error);
      throw error;
    }
  }
  
  /**
   * プロジェクトのローカルデータを取得
   * @param projectId プロジェクトID
   * @param key データキー
   * @param defaultValue デフォルト値
   */
  public async getProjectData<T>(projectId: string, key: string, defaultValue: T): Promise<T> {
    try {
      const filePath = path.join(this.storageDir, projectId, `${key}.json`);
      
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }
      
      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data) as T;
    } catch (error) {
      Logger.error(`Failed to get project data: ${projectId}.${key}`, error as Error);
      return defaultValue;
    }
  }
  
  /**
   * 要件定義の保存
   * @param projectId プロジェクトID
   * @param requirements 要件定義データ
   */
  public async saveRequirements(projectId: string, requirements: Requirements): Promise<void> {
    await this.saveProjectData(projectId, 'requirements', requirements);
    
    // 要件定義完了フェーズを更新
    const project = this.projectService.getProject(projectId);
    if (project) {
      await this.projectService.updateProjectPhase(projectId, 'requirements', true);
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.REQUIREMENTS_UPDATED,
        requirements,
        'AppGeniusStateManager',
        projectId
      );
    }
  }
  
  /**
   * 要件定義の取得
   * @param projectId プロジェクトID
   */
  public async getRequirements(projectId: string): Promise<Requirements | undefined> {
    return this.getProjectData<Requirements>(projectId, 'requirements', undefined as any);
  }
  
  /**
   * モックアップの保存
   * @param projectId プロジェクトID
   * @param mockup モックアップデータ
   */
  public async saveMockup(projectId: string, mockup: Mockup): Promise<void> {
    // 既存のモックアップリストを取得
    const mockups = await this.getProjectData<Mockup[]>(projectId, 'mockups', []);
    
    // 既存のモックアップを更新または新規追加
    const index = mockups.findIndex(m => m.id === mockup.id);
    if (index >= 0) {
      mockups[index] = mockup;
    } else {
      mockups.push(mockup);
    }
    
    // 保存
    await this.saveProjectData(projectId, 'mockups', mockups);
    
    // デザインフェーズが1つ以上のモックアップで完了とみなす
    if (mockups.length > 0) {
      const project = this.projectService.getProject(projectId);
      if (project) {
        await this.projectService.updateProjectPhase(projectId, 'design', true);
      }
    }
    
    // イベント発火
    this.eventBus.emit(
      AppGeniusEventType.MOCKUP_CREATED,
      mockup,
      'AppGeniusStateManager',
      projectId
    );
  }
  
  /**
   * モックアップリストの取得
   * @param projectId プロジェクトID
   */
  public async getMockups(projectId: string): Promise<Mockup[]> {
    return this.getProjectData<Mockup[]>(projectId, 'mockups', []);
  }
  
  /**
   * 実装スコープの保存
   * @param projectId プロジェクトID
   * @param scope 実装スコープデータ
   */
  public async saveImplementationScope(projectId: string, scope: ImplementationScope): Promise<void> {
    await this.saveProjectData(projectId, 'implementationScope', scope);
    
    // スコープが設定されたら実装フェーズが開始されたとみなす
    const project = this.projectService.getProject(projectId);
    if (project) {
      // 進捗状況に基づいて実装フェーズの完了状態を更新
      const isCompleted = scope.totalProgress >= 100;
      await this.projectService.updateProjectPhase(projectId, 'implementation', isCompleted);
    }
    
    // イベント発火
    this.eventBus.emit(
      AppGeniusEventType.SCOPE_UPDATED,
      scope,
      'AppGeniusStateManager',
      projectId
    );
  }
  
  /**
   * 実装スコープの取得
   * @param projectId プロジェクトID
   */
  public async getImplementationScope(projectId: string): Promise<ImplementationScope | undefined> {
    return this.getProjectData<ImplementationScope>(projectId, 'implementationScope', undefined as any);
  }
  
  /**
   * 実装進捗の更新
   * @param projectId プロジェクトID
   * @param items 実装項目リスト
   * @param totalProgress 全体進捗
   */
  public async updateImplementationProgress(
    projectId: string, 
    items: ImplementationItem[],
    totalProgress: number
  ): Promise<void> {
    // 既存のスコープを取得
    const scope = await this.getImplementationScope(projectId);
    if (!scope) {
      return;
    }
    
    // 進捗を更新
    scope.items = items;
    scope.totalProgress = totalProgress;
    
    // 保存
    await this.saveImplementationScope(projectId, scope);
    
    // 進捗状況をプロジェクトにも反映
    const project = this.projectService.getProject(projectId);
    if (project) {
      // 全ての項目が完了したら実装フェーズ完了
      const isImplementationCompleted = totalProgress >= 100;
      await this.projectService.updateProjectPhase(projectId, 'implementation', isImplementationCompleted);
      
      // イベント発火
      this.eventBus.emit(
        AppGeniusEventType.IMPLEMENTATION_PROGRESS,
        { items, totalProgress },
        'AppGeniusStateManager',
        projectId
      );
    }
  }
  
  /**
   * イベントハンドラの登録
   */
  private registerEventHandlers(): void {
    // プロジェクト作成イベント
    this.eventBus.onEventType(AppGeniusEventType.PROJECT_CREATED, async (event) => {
      const projectId = event.data?.id;
      if (projectId) {
        Logger.info(`Project created event received: ${projectId}`);
        // プロジェクトディレクトリ作成
        const projectDir = path.join(this.storageDir, projectId);
        this.ensureDirectoryExists(projectDir);
      }
    });
    
    // プロジェクト削除イベント
    this.eventBus.onEventType(AppGeniusEventType.PROJECT_DELETED, async (event) => {
      const projectId = event.data?.id;
      if (projectId) {
        Logger.info(`Project deleted event received: ${projectId}`);
        // プロジェクトデータの削除
        const projectDir = path.join(this.storageDir, projectId);
        if (fs.existsSync(projectDir)) {
          await this.deleteDirectory(projectDir);
        }
      }
    });
    
    // フェーズ完了イベント
    this.eventBus.onEventType(AppGeniusEventType.PHASE_COMPLETED, async (event) => {
      const { projectId, phase, isCompleted } = event.data;
      if (projectId && phase) {
        Logger.info(`Phase completed event received: ${projectId}.${phase} = ${isCompleted}`);
        // プロジェクトのフェーズ状態を更新
        await this.projectService.updateProjectPhase(projectId, phase, isCompleted);
      }
    });
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