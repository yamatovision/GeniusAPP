import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PlatformManager } from './PlatformManager';
import { Logger } from './logger';
import { MessageBroker, MessageType } from './MessageBroker';
import { ScopeItemStatus, IImplementationItem, IImplementationScope } from '../types';

/**
 * 実装項目インターフェース
 */
export type ImplementationItem = IImplementationItem;

/**
 * スコープデータインターフェース
 */
export type ScopeData = IImplementationScope;

/**
 * スコープエクスポータークラス
 * スコープ情報の標準化と永続化を提供
 */
export class ScopeExporter {
  private static instance: ScopeExporter;
  
  // スコープ保存ディレクトリのパス
  private scopesDirPath: string;
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ScopeExporter {
    if (!ScopeExporter.instance) {
      ScopeExporter.instance = new ScopeExporter();
    }
    return ScopeExporter.instance;
  }
  
  /**
   * コンストラクタ
   */
  private constructor() {
    // スコープ保存ディレクトリのパスを構築
    const platformManager = PlatformManager.getInstance();
    this.scopesDirPath = platformManager.getTempDirectory('scopes');
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.scopesDirPath)) {
      fs.mkdirSync(this.scopesDirPath, { recursive: true });
    }
    
    Logger.debug(`ScopeExporter initialized with directory: ${this.scopesDirPath}`);
  }
  
  /**
   * スコープを標準化して保存
   */
  public exportScope(scope: any): string {
    try {
      // スコープIDが存在しない場合は生成
      const scopeId = scope.id || `scope-${Date.now()}-${uuidv4().substring(0, 8)}`;
      
      // スコープデータを標準化
      const standardizedScope: IImplementationScope = {
        id: scopeId,
        name: scope.name || `スコープ ${scopeId.substring(0, 8)}`,
        description: scope.description || '',
        projectPath: scope.projectPath || '',
        requirements: Array.isArray(scope.requirements) ? scope.requirements : [],
        items: this.standardizeSelectedItems(scope),
        selectedIds: Array.isArray(scope.selectedIds) ? scope.selectedIds : [],
        estimatedTime: scope.estimatedTime || "0",
        totalProgress: scope.totalProgress || 0,
        startDate: scope.startDate || new Date().toISOString().split('T')[0],
        targetDate: scope.targetDate || '',
        created: Date.now(),
        updated: Date.now()
      };
      
      // スコープファイルのパスを構築
      const scopeFilePath = this.getScopeFilePath(scopeId);
      
      // スコープをファイルに書き込む
      fs.writeFileSync(scopeFilePath, JSON.stringify(standardizedScope, null, 2), 'utf8');
      
      Logger.debug(`Scope exported: ${scopeId}`);
      
      // メッセージブローカーを通じてスコープ作成メッセージを送信
      try {
        const messageBroker = MessageBroker.getInstance();
        messageBroker.sendMessage(MessageType.SCOPE_CREATE, {
          scopeId,
          scopeFilePath
        });
      } catch (error) {
        Logger.warn('Failed to send scope creation message', error as Error);
      }
      
      return scopeFilePath;
    } catch (error) {
      Logger.error('Failed to export scope', error as Error);
      throw error;
    }
  }
  
  /**
   * 選択された項目を標準化
   */
  private standardizeSelectedItems(scope: any): IImplementationItem[] {
    // 選択された項目がない場合は空配列を返す
    if (!scope.items && !scope.selectedItems) {
      return [];
    }
    
    // 通常のitems形式を優先
    if (Array.isArray(scope.items)) {
      return scope.items.map((item: any) => ({
        id: item.id || uuidv4(),
        title: item.title || 'タイトルなし',
        description: item.description || '',
        completed: !!item.completed,
        status: item.status || (item.completed ? ScopeItemStatus.COMPLETED : ScopeItemStatus.PENDING),
        progress: item.progress || (item.completed ? 100 : 0),
        priority: item.priority || 'medium',
        complexity: item.complexity || 'medium',
        dependencies: item.dependencies || [],
        estimatedHours: item.estimatedHours || 0,
        relatedFiles: item.relatedFiles || []
      }));
    }
    
    // 後方互換性のためselectedItemsもサポート
    if (Array.isArray(scope.selectedItems)) {
      return scope.selectedItems.map((item: any) => ({
        id: item.id || uuidv4(),
        title: item.title || 'タイトルなし',
        description: item.description || '',
        completed: !!item.completed,
        status: item.completed ? ScopeItemStatus.COMPLETED : ScopeItemStatus.PENDING,
        progress: item.completed ? 100 : 0,
        priority: item.priority || 'medium',
        complexity: item.complexity || 'medium',
        dependencies: item.dependencies || [],
        estimatedHours: item.estimatedHours || 0,
        relatedFiles: item.relatedFiles || []
      }));
    }
    
    // 選択された項目IDと全項目から選択された項目を抽出
    if (Array.isArray(scope.selectedIds) && Array.isArray(scope.items)) {
      return scope.items
        .filter((item: any) => scope.selectedIds.includes(item.id))
        .map((item: any) => ({
          id: item.id || uuidv4(),
          title: item.title || 'タイトルなし',
          description: item.description || '',
          completed: !!item.completed,
          status: item.status || (item.completed ? ScopeItemStatus.COMPLETED : ScopeItemStatus.PENDING),
          progress: item.progress || (item.completed ? 100 : 0),
          priority: item.priority || 'medium',
          complexity: item.complexity || 'medium',
          dependencies: item.dependencies || [],
          estimatedHours: item.estimatedHours || 0,
          relatedFiles: item.relatedFiles || []
        }));
    }
    
    return [];
  }
  
  /**
   * スコープを読み込む
   */
  public importScope(scopeIdOrPath: string): ScopeData | null {
    try {
      // パスかIDかを判断
      const scopeFilePath = scopeIdOrPath.endsWith('.json')
        ? scopeIdOrPath
        : this.getScopeFilePath(scopeIdOrPath);
      
      // ファイルが存在するか確認
      if (!fs.existsSync(scopeFilePath)) {
        Logger.warn(`Scope file not found: ${scopeFilePath}`);
        return null;
      }
      
      // スコープファイルを読み込む
      const scopeJson = fs.readFileSync(scopeFilePath, 'utf8');
      const scope = JSON.parse(scopeJson) as ScopeData;
      
      Logger.debug(`Scope imported: ${scope.id}`);
      
      return scope;
    } catch (error) {
      Logger.error(`Failed to import scope: ${scopeIdOrPath}`, error as Error);
      return null;
    }
  }
  
  /**
   * スコープファイルのパスを取得
   */
  private getScopeFilePath(scopeId: string): string {
    return path.join(this.scopesDirPath, `${scopeId}.json`);
  }
  
  /**
   * 利用可能なすべてのスコープIDを取得
   */
  public getAvailableScopeIds(): string[] {
    try {
      // スコープディレクトリ内のすべてのJSONファイルを取得
      const files = fs.readdirSync(this.scopesDirPath).filter(file => file.endsWith('.json'));
      
      // ファイル名からスコープIDを抽出
      return files.map(file => file.replace('.json', ''));
    } catch (error) {
      Logger.error('Failed to get available scope IDs', error as Error);
      return [];
    }
  }
  
  /**
   * 利用可能なすべてのスコープを取得
   */
  public getAvailableScopes(): ScopeData[] {
    try {
      // 利用可能なすべてのスコープIDを取得
      const scopeIds = this.getAvailableScopeIds();
      
      // 各スコープを読み込む
      return scopeIds
        .map(id => this.importScope(id))
        .filter((scope): scope is ScopeData => scope !== null);
    } catch (error) {
      Logger.error('Failed to get available scopes', error as Error);
      return [];
    }
  }
  
  /**
   * スコープを削除
   */
  public deleteScope(scopeId: string): boolean {
    try {
      // スコープファイルのパスを取得
      const scopeFilePath = this.getScopeFilePath(scopeId);
      
      // ファイルが存在するか確認
      if (!fs.existsSync(scopeFilePath)) {
        Logger.warn(`Scope file not found: ${scopeFilePath}`);
        return false;
      }
      
      // スコープファイルを削除
      fs.unlinkSync(scopeFilePath);
      
      Logger.debug(`Scope deleted: ${scopeId}`);
      
      return true;
    } catch (error) {
      Logger.error(`Failed to delete scope: ${scopeId}`, error as Error);
      return false;
    }
  }
  
  /**
   * プロジェクトパスが有効かどうかを確認
   */
  public isValidProjectPath(projectPath: string): boolean {
    try {
      // パスが存在するか確認
      if (!fs.existsSync(projectPath)) {
        return false;
      }
      
      // ディレクトリかどうか確認
      const stats = fs.statSync(projectPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }
  
  /**
   * スコープをコマンドラインに引き継ぐためのコマンドを生成
   */
  public generateCliCommand(scopeId: string): string {
    // スコープファイルのパスを取得
    const scopeFilePath = this.getScopeFilePath(scopeId);
    
    // スコープを読み込む
    const scope = this.importScope(scopeId);
    
    if (!scope) {
      return '';
    }
    
    // CLIコマンドを構築（ClaudeCodeを使用）
    return `claude --scope=${scopeId} "${path.join(scope.projectPath, 'CLAUDE.md')}"`;
  }
}