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
  id?: string;  // IDを追加（省略可能）
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
    if (!homeDir) {
      throw new Error('ホームディレクトリが見つかりません。AppGeniusStateManagerの初期化に失敗しました。');
    }
    
    // メインディレクトリ構造を作成
    const appGeniusDir = path.join(homeDir, '.appgenius-ai');
    this.storageDir = path.join(appGeniusDir, 'state');
    
    try {
      // 親ディレクトリの存在を確認
      this.ensureDirectoryExists(appGeniusDir);
      
      // 状態保存ディレクトリの存在を確認
      this.ensureDirectoryExists(this.storageDir);
      
      // CLIとの連携用ディレクトリも作成
      this.ensureDirectoryExists(path.join(appGeniusDir, 'scopes'));
      this.ensureDirectoryExists(path.join(appGeniusDir, 'temp'));
      this.ensureDirectoryExists(path.join(appGeniusDir, 'logs'));
      
      Logger.info(`ストレージディレクトリを確認しました: ${this.storageDir}`);
    } catch (error) {
      Logger.error(`ストレージディレクトリの作成に失敗しました: ${(error as Error).message}`);
      throw new Error(`AppGeniusStateManagerの初期化に失敗しました: ${(error as Error).message}`);
    }
    
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
      
      // 既存の設定をクリア
      await vscode.workspace.getConfiguration('appgeniusAI').update(key, null, isGlobal);
      
      // 新しい設定を保存
      await vscode.workspace.getConfiguration('appgeniusAI').update(key, data, isGlobal);
      
      // 保存の検証
      const saved = vscode.workspace.getConfiguration('appgeniusAI').get(key);
      if (!saved && data !== null) {
        Logger.warn(`保存の検証に失敗: ${key}`);
        // 再試行
        await vscode.workspace.getConfiguration('appgeniusAI').update(key, data, isGlobal);
        
        // 再検証
        const recheck = vscode.workspace.getConfiguration('appgeniusAI').get(key);
        if (!recheck && data !== null) {
          throw new Error(`設定の保存に失敗しました: ${key}`);
        }
      }
      
      Logger.debug(`Successfully saved to config: ${key}`);
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
      
      // 一時ファイルに書き込んで、成功したら名前を変更（より安全な書き込み）
      const tempFilePath = `${filePath}.tmp`;
      await fs.promises.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf8');
      
      // 既存のファイルがあれば念のためバックアップ
      if (fs.existsSync(filePath)) {
        const backupPath = `${filePath}.bak`;
        try {
          await fs.promises.copyFile(filePath, backupPath);
        } catch (backupErr) {
          Logger.warn(`バックアップの作成に失敗: ${filePath}`, backupErr as Error);
        }
      }
      
      // 一時ファイルを本番ファイルに移動（原子的操作）
      try {
        await fs.promises.rename(tempFilePath, filePath);
      } catch (renameErr) {
        // 名前変更に失敗した場合は直接コピー
        Logger.warn(`ファイル名変更に失敗、コピーを試みます: ${filePath}`, renameErr as Error);
        await fs.promises.copyFile(tempFilePath, filePath);
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      
      // ファイルの存在を確認
      if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが作成されませんでした: ${filePath}`);
      }
      
      // VSCode設定にもバックアップ（冗長性のため）
      await this.saveToConfig(`projectData.${projectId}.${key}`, data, true);
      
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
    const startTime = Date.now();
    try {
      const filePath = path.join(this.storageDir, projectId, `${key}.json`);
      Logger.debug(`データ読み込み開始: ${filePath}`);
      
      // 1. メインファイルからの読み込み試行
      if (fs.existsSync(filePath)) {
        try {
          const data = await fs.promises.readFile(filePath, 'utf8');
          const result = JSON.parse(data) as T;
          Logger.debug(`ファイルからデータを読み込みました: ${filePath}`);
          return result;
        } catch (fileError) {
          Logger.warn(`ファイルからの読み込みに失敗: ${filePath}`, fileError as Error);
          // 読み込み失敗、バックアップを試す
        }
      } else {
        Logger.debug(`ファイルが存在しません: ${filePath}`);
      }
      
      // 2. バックアップファイルからの読み込み試行
      const backupPath = `${filePath}.bak`;
      if (fs.existsSync(backupPath)) {
        try {
          const backupData = await fs.promises.readFile(backupPath, 'utf8');
          const backupResult = JSON.parse(backupData) as T;
          Logger.info(`バックアップからデータを復元: ${backupPath}`);
          
          // 復元したデータを正規のファイルに保存（自己修復）
          await this.saveProjectData(projectId, key, backupResult);
          
          return backupResult;
        } catch (backupError) {
          Logger.warn(`バックアップからの読み込みに失敗: ${backupPath}`, backupError as Error);
        }
      }
      
      // 3. VSCode設定からの読み込み試行
      try {
        const configKey = `projectData.${projectId}.${key}`;
        const configData = vscode.workspace.getConfiguration('appgeniusAI').get<T>(configKey);
        
        if (configData) {
          Logger.info(`VSCode設定からデータを復元: ${configKey}`);
          
          // 復元したデータをファイルに保存（自己修復）
          await this.saveProjectData(projectId, key, configData);
          
          return configData;
        }
      } catch (configError) {
        Logger.warn(`VSCode設定からの読み込みに失敗: ${projectId}.${key}`, configError as Error);
      }
      
      // すべての方法で失敗した場合はデフォルト値を返す
      Logger.warn(`すべての読み込み方法が失敗、デフォルト値を使用: ${projectId}.${key}`);
      return defaultValue;
    } catch (error) {
      const endTime = Date.now();
      Logger.error(`データ読み込み失敗: ${projectId}.${key} (${endTime - startTime}ms)`, error as Error);
      
      // 問題診断のための追加情報
      try {
        const filePath = path.join(this.storageDir, projectId, `${key}.json`);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          Logger.debug(`問題のファイル情報: サイズ=${stats.size}バイト, 更新=${stats.mtime}`);
        }
      } catch (diagError) {}
      
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
    try {
      Logger.info(`実装スコープを保存します: プロジェクト ${projectId}`);
      
      // CLIとの連携用にスコープIDが設定されていることを確認
      if (!scope.id) {
        scope.id = `scope-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        Logger.debug(`スコープIDを生成しました: ${scope.id}`);
      }
      
      // ProjectDataに保存
      await this.saveProjectData(projectId, 'implementationScope', scope);
      
      // VSCode設定にも直接保存（CLIとの連携用）
      await this.saveToConfig('implementationScope', scope, true);
      
      // CLI連携用の一時ファイルも作成
      try {
        // ホームディレクトリに.appgenius/scopesディレクトリを作成
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const scopesDir = path.join(homeDir, '.appgenius', 'scopes');
        this.ensureDirectoryExists(scopesDir);
        
        // スコープファイルを作成（CLIから直接アクセスできるように）
        const scopeFilePath = path.join(scopesDir, `${scope.id}.json`);
        
        // 一時ファイルに書き込んでから名前変更
        const tempFilePath = `${scopeFilePath}.tmp`;
        await fs.promises.writeFile(tempFilePath, JSON.stringify(scope, null, 2), 'utf8');
        
        if (fs.existsSync(scopeFilePath)) {
          await fs.promises.unlink(scopeFilePath).catch(() => {});
        }
        
        await fs.promises.rename(tempFilePath, scopeFilePath);
        Logger.info(`CLIアクセス用のスコープファイルを作成しました: ${scopeFilePath}`);
      } catch (cliError) {
        Logger.warn(`CLI連携用のスコープファイル作成に失敗しました: ${(cliError as Error).message}`);
        // CLIファイル作成のエラーは無視（メイン処理は続行）
      }
      
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
      
      Logger.info(`実装スコープの保存が完了しました: プロジェクト ${projectId}`);
    } catch (error) {
      Logger.error(`実装スコープの保存に失敗しました: プロジェクト ${projectId}`, error as Error);
      throw error;
    }
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
    try {
      if (!fs.existsSync(dir)) {
        Logger.debug(`ディレクトリを作成します: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
        
        // 作成されたことを確認
        if (!fs.existsSync(dir)) {
          throw new Error(`ディレクトリが作成されませんでした: ${dir}`);
        }
      }
      
      // 書き込み権限をチェック
      try {
        const testFile = path.join(dir, '.test-write-permission');
        // テストファイルに書き込み
        fs.writeFileSync(testFile, 'test', 'utf8');
        // 書き込みが成功したらファイルを削除
        fs.unlinkSync(testFile);
      } catch (writeError) {
        throw new Error(`ディレクトリ ${dir} への書き込み権限がありません: ${(writeError as Error).message}`);
      }
    } catch (error) {
      Logger.error(`ディレクトリの作成または権限チェックに失敗しました: ${dir}`, error as Error);
      throw error;
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