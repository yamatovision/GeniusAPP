import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './logger';
import { MessageBroker, MessageType } from './MessageBroker';
import { PlatformManager } from './PlatformManager';
import { ClaudeMdService } from './ClaudeMdService';
import { ScopeItemStatus, IImplementationItem, IImplementationScope } from '../types';

/**
 * MarkdownManager クラス
 * CLAUDE.md内のスコープ情報を管理するクラス
 */
export class MarkdownManager {
  private static instance: MarkdownManager;
  private claudeMdService: ClaudeMdService;

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): MarkdownManager {
    if (!MarkdownManager.instance) {
      MarkdownManager.instance = new MarkdownManager();
    }
    return MarkdownManager.instance;
  }

  /**
   * コンストラクタ
   */
  private constructor() {
    this.claudeMdService = ClaudeMdService.getInstance();
    Logger.debug('MarkdownManager initialized');
  }
  
  /**
   * ディレクトリ構造からファイル一覧を抽出
   */
  public extractFilesFromStructure(projectPath: string): string[] {
    try {
      const structurePath = path.join(projectPath, 'docs', 'structure.md');
      if (!fs.existsSync(structurePath)) {
        Logger.warn(`構造ファイルが見つかりません: ${structurePath}`);
        return [];
      }

      const content = fs.readFileSync(structurePath, 'utf8');
      // コードブロック内の内容を抽出
      const codeBlockMatch = content.match(/```[\s\S]*?```/g);
      if (!codeBlockMatch) {
        Logger.warn('構造ファイル内にコードブロックが見つかりません');
        return [];
      }

      const filesList: string[] = [];
      const codeBlock = codeBlockMatch[0].replace(/```/g, '').trim();
      
      // 各行をパースしてファイルパスを抽出
      const lines = codeBlock.split('\n');
      
      // ディレクトリパスをトラッキング
      let currentPath: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // インデントレベルを計算（文字列の開始位置まで）
        const indentLevel = line.search(/[^\s│├─┬┼└┤┐┘┌┴┬]/);
        const indentCount = Math.max(0, Math.floor(indentLevel / 4));
        
        // ディレクトリパスを現在の階層に調整
        currentPath = currentPath.slice(0, indentCount);
        
        // ディレクトリとファイルを区別
        const isDirectory = trimmedLine.endsWith('/') || (!trimmedLine.includes('.') && !trimmedLine.endsWith('Dockerfile'));
        const name = trimmedLine.replace(/[│├─┬┼└┤┐┘┌┴┬]+/g, '').trim();
        
        if (isDirectory) {
          currentPath.push(name);
        } else {
          // ファイルパスを構築
          const filePath = [...currentPath, name].join('/');
          filesList.push(filePath);
        }
      }

      Logger.debug(`構造ファイルから${filesList.length}個のファイルを抽出しました`);
      return filesList;
    } catch (error) {
      Logger.error('ディレクトリ構造からファイル一覧の抽出に失敗しました', error as Error);
      return [];
    }
  }

  /**
   * プロジェクト内の実際のファイルをスキャン
   */
  public async scanProjectFiles(projectPath: string): Promise<string[]> {
    try {
      // fs.readdirを使ってディレクトリをスキャン
      const walkDir = async (dir: string, fileList: string[] = [], basePath: string = ''): Promise<string[]> => {
        const files = await fs.promises.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = await fs.promises.stat(filePath);
          
          // gitディレクトリ、node_modules、その他無視すべきディレクトリをスキップ
          if (file === '.git' || file === 'node_modules' || file === 'dist' || 
              file === '.vscode' || file.startsWith('.')) {
            continue;
          }
          
          const relativePath = path.join(basePath, file);
          
          if (stat.isDirectory()) {
            fileList = await walkDir(filePath, fileList, relativePath);
          } else {
            fileList.push(relativePath);
          }
        }
        
        return fileList;
      };
      
      const fileList = await walkDir(projectPath);
      Logger.debug(`プロジェクト内に${fileList.length}個のファイルを検出しました`);
      return fileList;
    } catch (error) {
      Logger.error('プロジェクトファイルのスキャンに失敗しました', error as Error);
      return [];
    }
  }

  /**
   * プロジェクトの進捗情報を更新
   */
  public updateProjectProgress(
    projectPath: string, 
    completedFiles: string[], 
    totalFiles: string[]
  ): boolean {
    try {
      // 進捗率を計算
      const completedCount = completedFiles.length;
      const totalCount = totalFiles.length;
      const percentage = totalCount > 0 
        ? Math.round((completedCount / totalCount) * 100) 
        : 0;
      
      // 現在の処理は何もしない
      Logger.info(`プロジェクト進捗情報を更新しました: ${completedCount}/${totalCount} (${percentage}%)`);
      return true;
    } catch (error) {
      Logger.error('進捗情報の更新に失敗しました', error as Error);
      return false;
    }
  }

  /**
   * プロジェクトの進捗情報を取得
   */
  public getProjectProgress(projectPath: string): { 
    completed: string[], 
    total: string[], 
    percentage: number 
  } {
    try {
      // ダミーデータを返す
      const completed: string[] = [];
      const total: string[] = [];
      
      return {
        completed: completed,
        total: total,
        percentage: 0
      };
    } catch (error) {
      Logger.error('進捗情報の取得に失敗しました', error as Error);
      return { completed: [], total: [], percentage: 0 };
    }
  }

  /**
   * プロジェクトフォルダとディレクトリ構造から進捗を更新
   */
  public async updateProgressFromProject(projectPath: string): Promise<{
    completed: string[],
    total: string[],
    percentage: number
  }> {
    try {
      // ダミーデータを返す
      return {
        completed: [],
        total: [],
        percentage: 0
      };
    } catch (error) {
      Logger.error('プロジェクト進捗の更新に失敗しました', error as Error);
      return { completed: [], total: [], percentage: 0 };
    }
  }

  /**
   * CLAUDE.mdからスコープ情報を読み込む
   * @param projectPath プロジェクトパス
   * @returns 全スコープデータの配列
   */
  public getScopesFromClaudeMd(projectPath: string): IImplementationScope[] {
    try {
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');

      // ファイルが存在するか確認
      if (!fs.existsSync(claudeMdPath)) {
        Logger.warn(`CLAUDE.mdファイルが見つかりません: ${claudeMdPath}`);
        return [];
      }

      // ファイルを読み込む
      const claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');

      // スコープセクションを探す
      const scopeSection = this.claudeMdService.getClaudeMdSection(projectPath, 'スコープ');
      if (!scopeSection) {
        Logger.debug('スコープセクションが見つかりません');
        return [];
      }

      // スコープ情報を抽出
      return this.extractScopes(scopeSection, projectPath);
    } catch (error) {
      Logger.error('CLAUDE.mdからのスコープ読み込みに失敗しました', error as Error);
      return [];
    }
  }

  /**
   * スコープセクションからスコープデータを抽出
   * @param scopeSection セクションテキスト
   * @returns スコープデータの配列
   */
  private extractScopes(scopeSection: string, projectPath: string = ""): IImplementationScope[] {
    const scopes: IImplementationScope[] = [];
    const scopeBlocks = scopeSection.split(/(?=###\s+スコープ:)/g);

    for (const block of scopeBlocks) {
      const scopeMatch = block.match(/###\s+スコープ:\s+(.*?)(?:\n|$)/);
      if (!scopeMatch) continue;

      const scopeName = scopeMatch[1].trim();
      const idMatch = block.match(/- ID:\s+([a-zA-Z0-9-_]+)/);
      const scopeId = idMatch ? idMatch[1] : `scope-${Date.now()}-${uuidv4().substring(0, 8)}`;
      
      // 説明を抽出
      const descriptionMatch = block.match(/- 説明:\s+(.*?)(?=\n-|\n###|\n$)/s);
      const description = descriptionMatch ? descriptionMatch[1].trim() : '';
      
      // 推定工数を抽出
      const estimatedTimeMatch = block.match(/- 工数見積:\s+(.*?)(?=\n|\n-|$)/);
      const estimatedTime = estimatedTimeMatch ? estimatedTimeMatch[1].trim() : '0時間';
      
      // 日付を抽出
      const startDateMatch = block.match(/- 開始日:\s+(\d{4}-\d{2}-\d{2})/);
      const startDate = startDateMatch ? startDateMatch[1] : undefined;
      
      const targetDateMatch = block.match(/- 完了予定日:\s+(\d{4}-\d{2}-\d{2})/);
      const targetDate = targetDateMatch ? targetDateMatch[1] : undefined;
      
      // ステータスを抽出
      const statusMatch = block.match(/- 状態:\s+(✅|🔄|✓|❌)\s+(.*?)(?=\n|\n-|$)/);
      const statusText = statusMatch ? statusMatch[2].trim() : '未着手';
      const progress = statusText === '完了' ? 100 : statusText === '進行中' ? 50 : 0;
      
      // 実装項目を抽出
      const items: IImplementationItem[] = [];
      const itemSection = block.match(/#### 実装項目\n([\s\S]*?)(?=###|\n$)/);
      
      if (itemSection) {
        const itemBlocks = itemSection[1].split(/(?=- \[[ x]\])/g);
        
        for (const itemBlock of itemBlocks) {
          const isSelectedMatch = itemBlock.match(/- \[([ x])\]/);
          if (!isSelectedMatch) continue;
          
          const isSelected = isSelectedMatch[1] === 'x';
          
          const titleMatch = itemBlock.match(/- \[[ x]\]\s+(.+?)(?=\n|$)/);
          const title = titleMatch ? titleMatch[1].trim() : '';
          
          const idMatch = itemBlock.match(/  - ID:\s+([a-zA-Z0-9-_]+)/);
          const id = idMatch ? idMatch[1] : `item-${Date.now()}-${uuidv4().substring(0, 6)}`;
          
          const descriptionMatch = itemBlock.match(/  - 説明:\s+(.*?)(?=\n  -|\n-|\n$)/s);
          const description = descriptionMatch ? descriptionMatch[1].trim() : '';
          
          const priorityMatch = itemBlock.match(/  - 優先度:\s+(high|medium|low)/);
          const priority = (priorityMatch ? priorityMatch[1] : 'medium') as 'high' | 'medium' | 'low';
          
          const complexityMatch = itemBlock.match(/  - 複雑度:\s+(high|medium|low)/);
          const complexity = (complexityMatch ? complexityMatch[1] : 'medium') as 'high' | 'medium' | 'low';
          
          const dependenciesMatch = itemBlock.match(/  - 依存関係:\s+(.*?)(?=\n  -|\n-|\n$)/);
          const dependenciesText = dependenciesMatch ? dependenciesMatch[1].trim() : '';
          const dependencies = dependenciesText ? dependenciesText.split(',').map(d => d.trim()) : [];
          
          const statusMatch = itemBlock.match(/  - 状態:\s+(pending|in-progress|completed|blocked)/);
          const status = statusMatch 
            ? statusMatch[1] as ScopeItemStatus 
            : (isSelected ? ScopeItemStatus.PENDING : undefined);
          
          const progressMatch = itemBlock.match(/  - 進捗:\s+(\d+)%/);
          const progress = progressMatch ? parseInt(progressMatch[1]) : (isSelected ? 0 : undefined);
          
          const notesMatch = itemBlock.match(/  - メモ:\s+(.*?)(?=\n  -|\n-|\n$)/s);
          const notes = notesMatch ? notesMatch[1].trim() : undefined;
          
          // 関連ファイル
          const filesMatch = itemBlock.match(/  - 関連ファイル:\s+(.*?)(?=\n  -|\n-|\n$)/s);
          const filesText = filesMatch ? filesMatch[1].trim() : '';
          const relatedFiles = filesText ? filesText.split('\n').map(f => f.trim().replace(/^- /, '')) : undefined;
          
          // 関連モックアップ
          const mockupsMatch = itemBlock.match(/  - 関連モックアップ:\s+(.*?)(?=\n  -|\n-|\n$)/s);
          const mockupsText = mockupsMatch ? mockupsMatch[1].trim() : '';
          const relatedMockups = mockupsText ? mockupsText.split('\n').map(m => m.trim().replace(/^- /, '')) : undefined;
          
          // 関連要件
          const requirementsMatch = itemBlock.match(/  - 関連要件:\s+(.*?)(?=\n  -|\n-|\n$)/s);
          const requirementsText = requirementsMatch ? requirementsMatch[1].trim() : '';
          const relatedRequirements = requirementsText ? requirementsText.split('\n').map(r => r.trim().replace(/^- /, '')) : undefined;
          
          items.push({
            id,
            title,
            description,
            priority,
            complexity,
            isSelected,
            dependencies,
            status,
            progress,
            notes,
            relatedFiles,
            relatedMockups,
            relatedRequirements
          });
        }
      }
      
      // 選択されたID一覧
      const selectedIds = items
        .filter(item => item.isSelected)
        .map(item => item.id);
      
      scopes.push({
        id: scopeId,
        name: scopeName,
        description,
        items,
        selectedIds,
        estimatedTime,
        totalProgress: progress,
        startDate,
        targetDate,
        projectPath: projectPath
      });
    }
    
    return scopes;
  }

  /**
   * 特定のスコープをCLAUDE.mdから読み込む
   * @param projectPath プロジェクトパス
   * @param scopeId スコープID
   * @returns スコープデータまたはnull
   */
  public getScopeFromClaudeMd(projectPath: string, scopeId: string): IImplementationScope | null {
    const scopes = this.getScopesFromClaudeMd(projectPath);
    return scopes.find(scope => scope.id === scopeId) || null;
  }

  /**
   * スコープリストをCLAUDE.mdに保存
   * @param projectPath プロジェクトパス
   * @param scopes スコープデータの配列
   * @returns 成功したかどうか
   */
  public saveScopesToClaudeMd(projectPath: string, scopes: IImplementationScope[]): boolean {
    try {
      const markdownContent = this.formatScopesToMarkdown(scopes);
      return this.claudeMdService.updateClaudeMdSection(projectPath, 'スコープ', markdownContent);
    } catch (error) {
      Logger.error('スコープのCLAUDE.mdへの保存に失敗しました', error as Error);
      return false;
    }
  }

  /**
   * 単一のスコープをCLAUDE.mdに保存または更新
   * @param projectPath プロジェクトパス
   * @param scope スコープデータ
   * @returns 成功したかどうか
   */
  public saveScopeToClaudeMd(projectPath: string, scope: IImplementationScope): boolean {
    try {
      // 既存のスコープを取得
      const existingScopes = this.getScopesFromClaudeMd(projectPath);
      
      // 同じIDのスコープを更新、なければ追加
      const updatedScopes = existingScopes.filter(s => s.id !== scope.id);
      updatedScopes.push(scope);
      
      // 保存
      return this.saveScopesToClaudeMd(projectPath, updatedScopes);
    } catch (error) {
      Logger.error(`スコープ(${scope.id})のCLAUDE.mdへの保存に失敗しました`, error as Error);
      return false;
    }
  }

  /**
   * スコープリストをMarkdown形式にフォーマット
   * @param scopes スコープデータの配列
   * @returns Markdown形式のテキスト
   */
  private formatScopesToMarkdown(scopes: IImplementationScope[]): string {
    if (!scopes || scopes.length === 0) {
      return "このプロジェクトにはまだスコープが定義されていません。";
    }
    
    return scopes.map(scope => this.formatScopeToMarkdown(scope)).join('\n\n');
  }

  /**
   * 単一のスコープをMarkdown形式にフォーマット
   * @param scope スコープデータ
   * @returns Markdown形式のテキスト
   */
  private formatScopeToMarkdown(scope: IImplementationScope): string {
    // ステータスアイコンを決定
    let statusIcon = '✅'; // デフォルトは実装予定
    let statusText = '実装予定';
    
    if (scope.totalProgress === 100) {
      statusIcon = '✓';
      statusText = '完了';
    } else if (scope.totalProgress > 0) {
      statusIcon = '🔄';
      statusText = '進行中';
    }
    
    let markdown = `### スコープ: ${scope.name}\n\n`;
    markdown += `- ID: ${scope.id}\n`;
    markdown += `- 説明: ${scope.description}\n`;
    markdown += `- 状態: ${statusIcon} ${statusText}\n`;
    markdown += `- 工数見積: ${scope.estimatedTime}\n`;
    
    if (scope.startDate) {
      markdown += `- 開始日: ${scope.startDate}\n`;
    }
    
    if (scope.targetDate) {
      markdown += `- 完了予定日: ${scope.targetDate}\n`;
    }
    
    // 実装項目がある場合
    if (scope.items && scope.items.length > 0) {
      markdown += `\n#### 実装項目\n\n`;
      
      for (const item of scope.items) {
        const isSelected = scope.selectedIds.includes(item.id);
        
        markdown += `- [${isSelected ? 'x' : ' '}] ${item.title}\n`;
        markdown += `  - ID: ${item.id}\n`;
        markdown += `  - 説明: ${item.description}\n`;
        markdown += `  - 優先度: ${item.priority}\n`;
        markdown += `  - 複雑度: ${item.complexity}\n`;
        
        if (item.dependencies && item.dependencies.length > 0) {
          markdown += `  - 依存関係: ${item.dependencies.join(', ')}\n`;
        } else {
          markdown += `  - 依存関係: なし\n`;
        }
        
        if (isSelected && item.status) {
          markdown += `  - 状態: ${item.status}\n`;
        }
        
        if (isSelected && typeof item.progress === 'number') {
          markdown += `  - 進捗: ${item.progress}%\n`;
        }
        
        if (item.notes) {
          markdown += `  - メモ: ${item.notes}\n`;
        }
        
        // 関連ファイル
        if (item.relatedFiles && item.relatedFiles.length > 0) {
          markdown += `  - 関連ファイル:\n`;
          for (const file of item.relatedFiles) {
            markdown += `    - ${file}\n`;
          }
        }
        
        // 関連モックアップ
        if (item.relatedMockups && item.relatedMockups.length > 0) {
          markdown += `  - 関連モックアップ:\n`;
          for (const mockup of item.relatedMockups) {
            markdown += `    - ${mockup}\n`;
          }
        }
        
        // 関連要件
        if (item.relatedRequirements && item.relatedRequirements.length > 0) {
          markdown += `  - 関連要件:\n`;
          for (const requirement of item.relatedRequirements) {
            markdown += `    - ${requirement}\n`;
          }
        }
        
        markdown += '\n';
      }
    } else {
      markdown += '\n_このスコープには実装項目がまだ定義されていません。_\n';
    }
    
    return markdown;
  }

  /**
   * スコープを削除
   * @param projectPath プロジェクトパス
   * @param scopeId スコープID
   * @returns 成功したかどうか
   */
  public deleteScope(projectPath: string, scopeId: string): boolean {
    try {
      // 既存のスコープを取得
      const existingScopes = this.getScopesFromClaudeMd(projectPath);
      
      // 指定されたスコープを除外
      const updatedScopes = existingScopes.filter(s => s.id !== scopeId);
      
      // 同じ数であれば削除するものがなかった
      if (updatedScopes.length === existingScopes.length) {
        Logger.warn(`削除対象のスコープが見つかりません: ${scopeId}`);
        return false;
      }
      
      // 保存
      return this.saveScopesToClaudeMd(projectPath, updatedScopes);
    } catch (error) {
      Logger.error(`スコープの削除に失敗しました: ${scopeId}`, error as Error);
      return false;
    }
  }

  /**
   * スコープのステータスを更新
   * @param projectPath プロジェクトパス
   * @param scopeId スコープID
   * @param status 新しいステータス
   * @param progress 進捗率（0-100）
   * @returns 成功したかどうか
   */
  public updateScopeStatus(
    projectPath: string, 
    scopeId: string, 
    status: 'pending' | 'in-progress' | 'completed',
    progress?: number
  ): boolean {
    try {
      // スコープを取得
      const scope = this.getScopeFromClaudeMd(projectPath, scopeId);
      
      if (!scope) {
        Logger.warn(`ステータス更新対象のスコープが見つかりません: ${scopeId}`);
        return false;
      }
      
      // 進捗率に基づいてステータスを自動調整
      if (typeof progress === 'number') {
        scope.totalProgress = Math.max(0, Math.min(100, progress));
        
        if (progress >= 100) {
          status = 'completed';
        } else if (progress > 0 && status === 'pending') {
          status = 'in-progress';
        }
      } else if (status === 'completed') {
        scope.totalProgress = 100;
      } else if (status === 'in-progress' && scope.totalProgress === 0) {
        scope.totalProgress = 10; // 開始時は10%程度
      }
      
      // 保存
      return this.saveScopeToClaudeMd(projectPath, scope);
    } catch (error) {
      Logger.error(`スコープステータスの更新に失敗しました: ${scopeId}`, error as Error);
      return false;
    }
  }

  /**
   * スコープアイテムのステータスを更新
   * @param projectPath プロジェクトパス
   * @param scopeId スコープID
   * @param itemId アイテムID
   * @param status 新しいステータス
   * @param progress 進捗率
   * @returns 成功したかどうか
   */
  public updateScopeItemStatus(
    projectPath: string,
    scopeId: string,
    itemId: string,
    status: ScopeItemStatus,
    progress?: number
  ): boolean {
    try {
      // スコープを取得
      const scope = this.getScopeFromClaudeMd(projectPath, scopeId);
      
      if (!scope) {
        Logger.warn(`スコープが見つかりません: ${scopeId}`);
        return false;
      }
      
      // アイテムを取得
      const item = scope.items.find(i => i.id === itemId);
      
      if (!item) {
        Logger.warn(`スコープアイテムが見つかりません: ${itemId}`);
        return false;
      }
      
      // ステータスを更新
      item.status = status;
      
      // 進捗を更新
      if (typeof progress === 'number') {
        item.progress = Math.max(0, Math.min(100, progress));
      } else {
        // ステータスに応じて進捗率を自動調整
        if (status === ScopeItemStatus.COMPLETED) {
          item.progress = 100;
        } else if (status === ScopeItemStatus.PENDING && item.progress === 0) {
          // 既に設定されている場合は変更しない
        } else if (status === ScopeItemStatus.IN_PROGRESS && (!item.progress || item.progress === 0)) {
          item.progress = 10; // 開始時は10%程度
        }
      }
      
      // スコープ全体の進捗率を再計算
      const selectedItems = scope.items.filter(i => scope.selectedIds.includes(i.id));
      if (selectedItems.length > 0) {
        const totalProgress = selectedItems.reduce((sum, i) => sum + (i.progress || 0), 0) / selectedItems.length;
        scope.totalProgress = Math.round(totalProgress);
      }
      
      // 保存
      return this.saveScopeToClaudeMd(projectPath, scope);
    } catch (error) {
      Logger.error(`スコープアイテムステータスの更新に失敗しました: ${scopeId}/${itemId}`, error as Error);
      return false;
    }
  }

  /**
   * JSONからスコープを作成/更新してCLAUDE.mdに保存
   * @param projectPath プロジェクトパス
   * @param scopeData スコープデータのJSON
   * @returns 成功したかどうか
   */
  public importScopeFromJson(projectPath: string, scopeData: any): boolean {
    try {
      // スコープIDがない場合は生成
      if (!scopeData.id) {
        scopeData.id = `scope-${Date.now()}-${uuidv4().substring(0, 8)}`;
      }
      
      // 必須フィールドがない場合はデフォルト値を設定
      if (!scopeData.name) {
        scopeData.name = `スコープ ${new Date().toISOString().split('T')[0]}`;
      }
      
      if (!scopeData.description) {
        scopeData.description = '詳細なし';
      }
      
      if (!scopeData.items) {
        scopeData.items = [];
      }
      
      if (!scopeData.selectedIds) {
        scopeData.selectedIds = [];
      }
      
      if (!scopeData.estimatedTime) {
        scopeData.estimatedTime = '未見積';
      }
      
      if (typeof scopeData.totalProgress !== 'number') {
        scopeData.totalProgress = 0;
      }
      
      // スコープを保存
      return this.saveScopeToClaudeMd(projectPath, scopeData as IImplementationScope);
    } catch (error) {
      Logger.error('JSONからのスコープインポートに失敗しました', error as Error);
      return false;
    }
  }

  /**
   * VSCode設定からスコープをインポートしてCLAUDE.mdに保存
   * @param projectPath プロジェクトパス
   * @returns 成功したかどうか
   */
  public importScopeFromVSCodeSettings(projectPath: string): boolean {
    try {
      // VSCode設定からスコープ情報を取得
      const config = vscode.workspace.getConfiguration('appgeniusAI');
      const implementationScope = config.get('implementationScope');
      
      if (!implementationScope) {
        Logger.warn('VSCode設定からスコープ情報が見つかりません');
        return false;
      }
      
      // JSON文字列の場合はパース
      const scopeData = typeof implementationScope === 'string'
        ? JSON.parse(implementationScope)
        : implementationScope;
      
      // プロジェクトパスを設定
      scopeData.projectPath = scopeData.projectPath || projectPath;
      
      // インポート
      return this.importScopeFromJson(projectPath, scopeData);
    } catch (error) {
      Logger.error('VSCode設定からのスコープインポートに失敗しました', error as Error);
      return false;
    }
  }

  /**
   * 実装アイテムの選択状態を更新
   * @param projectPath プロジェクトパス
   * @param scopeId スコープID
   * @param itemId アイテムID
   * @param isSelected 選択するかどうか
   * @returns 成功したかどうか
   */
  public toggleScopeItemSelection(
    projectPath: string,
    scopeId: string,
    itemId: string,
    isSelected: boolean
  ): boolean {
    try {
      // スコープを取得
      const scope = this.getScopeFromClaudeMd(projectPath, scopeId);
      
      if (!scope) {
        Logger.warn(`スコープが見つかりません: ${scopeId}`);
        return false;
      }
      
      // アイテムを取得
      const item = scope.items.find(i => i.id === itemId);
      
      if (!item) {
        Logger.warn(`スコープアイテムが見つかりません: ${itemId}`);
        return false;
      }
      
      // 選択状態を更新
      item.isSelected = isSelected;
      
      // 選択されたIDリストを更新
      if (isSelected) {
        if (!scope.selectedIds.includes(itemId)) {
          scope.selectedIds.push(itemId);
        }
        
        // 新しく選択された項目はpending状態で初期化
        if (!item.status) {
          item.status = ScopeItemStatus.PENDING;
          item.progress = 0;
        }
      } else {
        scope.selectedIds = scope.selectedIds.filter(id => id !== itemId);
      }
      
      // 保存
      return this.saveScopeToClaudeMd(projectPath, scope);
    } catch (error) {
      Logger.error(`スコープアイテム選択状態の更新に失敗しました: ${scopeId}/${itemId}`, error as Error);
      return false;
    }
  }

  /**
   * スコープアイテムにメモを追加/更新
   * @param projectPath プロジェクトパス
   * @param scopeId スコープID
   * @param itemId アイテムID
   * @param notes メモ内容
   * @returns 成功したかどうか
   */
  public updateScopeItemNotes(
    projectPath: string,
    scopeId: string,
    itemId: string,
    notes: string
  ): boolean {
    try {
      // スコープを取得
      const scope = this.getScopeFromClaudeMd(projectPath, scopeId);
      
      if (!scope) {
        Logger.warn(`スコープが見つかりません: ${scopeId}`);
        return false;
      }
      
      // アイテムを取得
      const item = scope.items.find(i => i.id === itemId);
      
      if (!item) {
        Logger.warn(`スコープアイテムが見つかりません: ${itemId}`);
        return false;
      }
      
      // メモを更新
      item.notes = notes;
      
      // 保存
      return this.saveScopeToClaudeMd(projectPath, scope);
    } catch (error) {
      Logger.error(`スコープアイテムメモの更新に失敗しました: ${scopeId}/${itemId}`, error as Error);
      return false;
    }
  }

  /**
   * スコープの実装状況をClaudeCodeに通知
   * @param projectPath プロジェクトパス
   * @param scopeId スコープID
   * @returns 成功したかどうか
   */
  public notifyClaudeCodeOfScopeUpdate(projectPath: string, scopeId: string): boolean {
    try {
      // スコープを取得
      const scope = this.getScopeFromClaudeMd(projectPath, scopeId);
      
      if (!scope) {
        Logger.warn(`通知対象のスコープが見つかりません: ${scopeId}`);
        return false;
      }
      
      // メッセージブローカーを初期化
      const messageBroker = MessageBroker.getInstance(scopeId);
      
      // 通知メッセージを送信
      messageBroker.sendMessage(MessageType.SCOPE_UPDATE, {
        scopeId,
        scopeData: scope,
        action: 'scope_updated',
        timestamp: Date.now(),
        source: 'vscode'
      });
      
      Logger.info(`スコープ更新通知を送信しました: ${scopeId}`);
      return true;
    } catch (error) {
      Logger.error(`スコープ更新通知の送信に失敗しました: ${scopeId}`, error as Error);
      return false;
    }
  }

  /**
   * CLAUDE.mdにスコープセクションが存在しない場合に初期セクションを作成
   * @param projectPath プロジェクトパス
   * @returns 成功したかどうか
   */
  public initializeScopeSection(projectPath: string): boolean {
    try {
      // スコープセクションを確認
      const scopeSection = this.claudeMdService.getClaudeMdSection(projectPath, 'スコープ');
      
      if (!scopeSection) {
        // 初期セクションを作成
        const initialSection = `このプロジェクトにはまだスコープが定義されていません。

スコープを追加するには、VSCode拡張の「実装スコープ選択」機能を使用するか、このセクションに直接Markdown形式でスコープを追加してください。

### スコープの例: ユーザー認証機能

- ID: scope-example
- 説明: ユーザー登録、ログイン、パスワードリセットなどの認証機能
- 状態: ✅ 実装予定
- 工数見積: 16時間
- 開始日: 2025-03-01
- 完了予定日: 2025-03-10

#### 実装項目

- [x] ユーザー登録機能
  - ID: item-register
  - 説明: 新規ユーザーの登録機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: なし
  - 状態: pending
  - 進捗: 0%

- [x] ログイン機能
  - ID: item-login
  - 説明: ユーザーログイン機能を実装
  - 優先度: high
  - 複雑度: medium
  - 依存関係: item-register
  - 状態: pending
  - 進捗: 0%

- [ ] パスワードリセット機能
  - ID: item-password-reset
  - 説明: パスワードリセット機能を実装
  - 優先度: medium
  - 複雑度: high
  - 依存関係: item-register, item-login
`;
        
        return this.claudeMdService.updateClaudeMdSection(projectPath, 'スコープ', initialSection);
      }
      
      return true;
    } catch (error) {
      Logger.error('スコープセクションの初期化に失敗しました', error as Error);
      return false;
    }
  }

  /**
   * 要件定義から実装項目を抽出してスコープを作成
   * @param projectPath プロジェクトパス
   * @param requirementsText 要件定義のテキスト
   * @param aiService AIサービス（要件解析用）
   * @returns 作成されたスコープID、失敗時はnull
   */
  public async createScopeFromRequirements(
    projectPath: string,
    requirementsText: string,
    aiService: any
  ): Promise<string | null> {
    try {
      // AIに要件定義書から実装項目を抽出させる
      const prompt = `以下の要件定義書から実装項目を抽出し、ID、タイトル、説明、優先度、複雑度、依存関係を付けてJSONフォーマットで返してください。
JSONの形式は以下のようにしてください:
\`\`\`json
[
  {
    "id": "ITEM-001",
    "title": "ユーザー登録機能",
    "description": "新規ユーザーを登録できる機能。氏名、メールアドレス、パスワードを入力する。",
    "priority": "high", // high, medium, lowのいずれか
    "complexity": "medium", // high, medium, lowのいずれか
    "dependencies": [] // 依存する他の項目のIDの配列
  },
  ...
]
\`\`\`

要件定義書:
${requirementsText}`;
      
      const response = await aiService.sendMessage(prompt, 'implementation');
      
      // レスポンスからJSON部分を抽出
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch || !jsonMatch[1]) {
        throw new Error('AIからの応答をパースできませんでした');
      }
      
      // 非同期処理を待機してからパース
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const items = JSON.parse(jsonMatch[1]);
      
      // 進捗管理用のプロパティを追加
      const implementationItems = items.map((item: any) => ({
        ...item,
        isSelected: false,
        status: ScopeItemStatus.PENDING,
        progress: 0,
        notes: ''
      }));
      
      // スコープを作成
      const scopeId = `scope-${Date.now()}-${uuidv4().substring(0, 8)}`;
      const scopeName = `要件定義からの抽出 ${new Date().toISOString().split('T')[0]}`;
      
      const scope: IImplementationScope = {
        id: scopeId,
        name: scopeName,
        description: '要件定義から自動抽出された実装項目のスコープ',
        items: implementationItems,
        selectedIds: [],
        estimatedTime: '未見積',
        totalProgress: 0,
        startDate: new Date().toISOString().split('T')[0],
        projectPath
      };
      
      // スコープセクションを初期化
      this.initializeScopeSection(projectPath);
      
      // スコープを保存する前に少し待機（ファイル操作のタイミングの問題を軽減）
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // スコープを保存
      if (this.saveScopeToClaudeMd(projectPath, scope)) {
        Logger.info(`要件定義から${implementationItems.length}個の実装項目を持つスコープを作成しました: ${scopeId}`);
        
        // 保存した後に読み込み前に少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return scopeId;
      } else {
        return null;
      }
    } catch (error) {
      Logger.error('要件定義からのスコープ作成に失敗しました', error as Error);
      return null;
    }
  }
}