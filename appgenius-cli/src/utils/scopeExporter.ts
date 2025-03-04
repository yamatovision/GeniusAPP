import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ScopeData } from '../types';
import { logger } from './logger';
import { PlatformManager } from './platformManager';
import { MessageBroker, MessageType } from './messageBroker';
import { configManager } from './configManager';

/**
 * スコープエクスポータークラス（CLI用）
 * スコープ情報のインポート・エクスポート機能を提供
 * CLAUDE.mdの管理機能も含む
 */
export class ScopeExporter {
  private static instance: ScopeExporter;
  
  // スコープ保存ディレクトリのパス
  private scopesDirPath: string;
  
  // プロジェクトID
  private projectId: string;
  
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
    // プラットフォームマネージャーを取得
    const platformManager = PlatformManager.getInstance();
    
    // VSCode環境からプロジェクトIDとスコープパスを取得
    const vscodeEnv = platformManager.getVSCodeEnvironment();
    this.projectId = vscodeEnv.projectId || 'default';
    
    // スコープ保存ディレクトリのパスを構築
    this.scopesDirPath = platformManager.getScopesDirectory();
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.scopesDirPath)) {
      fs.mkdirSync(this.scopesDirPath, { recursive: true });
    }
    
    logger.debug(`ScopeExporter initialized with directory: ${this.scopesDirPath}`);
    logger.debug(`Project ID: ${this.projectId}`);
    
    // 環境変数からスコープパスが指定されている場合、自動的にインポート
    if (vscodeEnv.scopePath && fs.existsSync(vscodeEnv.scopePath)) {
      try {
        const scopeData = this.importScope(vscodeEnv.scopePath);
        if (scopeData) {
          logger.info(`自動的にスコープをインポートしました: ${scopeData.name} (${scopeData.id})`);
          
          // メッセージブローカーに通知
          MessageBroker.getInstance().sendScopeUpdate('imported', {
            scopeId: scopeData.id,
            name: scopeData.name
          });
        }
      } catch (error) {
        logger.error(`スコープの自動インポートに失敗しました: ${vscodeEnv.scopePath}`, error as Error);
      }
    }
  }
  
  /**
   * スコープファイルをインポート
   */
  public importScope(scopeIdOrPath: string): ScopeData | null {
    try {
      // パスかIDかを判断
      const scopeFilePath = scopeIdOrPath.endsWith('.json')
        ? scopeIdOrPath
        : this.getScopeFilePath(scopeIdOrPath);
      
      // ファイルが存在するか確認
      if (!fs.existsSync(scopeFilePath)) {
        logger.warn(`スコープファイルが見つかりません: ${scopeFilePath}`);
        return null;
      }
      
      // スコープファイルを読み込む
      const scopeJson = fs.readFileSync(scopeFilePath, 'utf8');
      const scope = JSON.parse(scopeJson) as ScopeData;
      
      logger.debug(`スコープをインポートしました: ${scope.id}`);
      
      return scope;
    } catch (error) {
      logger.error(`スコープのインポートに失敗しました: ${scopeIdOrPath}`, error as Error);
      return null;
    }
  }
  
  /**
   * スコープファイルのパスを取得
   */
  public getScopeFilePath(scopeId: string): string {
    return path.join(this.scopesDirPath, `${scopeId}.json`);
  }
  
  /**
   * スコープ情報の更新
   */
  public updateScope(scopeData: ScopeData): boolean {
    try {
      // 更新日時を設定
      scopeData.updated = Date.now();
      
      // スコープファイルのパスを構築
      const scopeFilePath = this.getScopeFilePath(scopeData.id);
      
      // スコープをファイルに書き込む
      fs.writeFileSync(scopeFilePath, JSON.stringify(scopeData, null, 2), 'utf8');
      
      logger.debug(`スコープを更新しました: ${scopeData.id}`);
      
      // メッセージブローカーを通じてスコープ更新メッセージを送信
      try {
        MessageBroker.getInstance().sendScopeUpdate('updated', {
          scopeId: scopeData.id,
          name: scopeData.name
        });
      } catch (error) {
        logger.warn('スコープ更新メッセージの送信に失敗しました', error as Error);
      }
      
      return true;
    } catch (error) {
      logger.error(`スコープの更新に失敗しました: ${scopeData.id}`, error as Error);
      return false;
    }
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
      logger.error('利用可能なスコープIDの取得に失敗しました', error as Error);
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
      logger.error('利用可能なスコープの取得に失敗しました', error as Error);
      return [];
    }
  }
  
  /**
   * スコープデータのJSON文字列を取得（デバッグ用）
   */
  public getScopeJson(scopeData: ScopeData): string {
    return JSON.stringify(scopeData, null, 2);
  }
  
  /**
   * 現在のスコープIDを取得
   */
  public getCurrentScopeId(): string {
    return this.projectId;
  }
  
  /**
   * スコープデータをCLAUDE.mdにエクスポート
   * VSCode連携のためのメモリファイル対応
   */
  public exportScopeToMemory(scope: ScopeData, memoryFilePath?: string): boolean {
    try {
      // メモリファイルのパスを決定
      const config = configManager.getConfig();
      const claudeMdPath = memoryFilePath || path.join(config.projectRoot, 'CLAUDE.md');
      
      // 既存のファイルを読み込み
      let existingContent = '';
      if (fs.existsSync(claudeMdPath)) {
        existingContent = fs.readFileSync(claudeMdPath, 'utf8');
      }
      
      // スコープセクションを構築
      const scopeSection = this.formatScopeForMemory(scope);
      
      // 既存のスコープセクションを検索
      const scopeRegex = /## Project Scope[\s\S]*?(?=##|$)/;
      const newContent = existingContent.match(scopeRegex) 
        ? existingContent.replace(scopeRegex, scopeSection)
        : existingContent + '\n\n' + scopeSection;
      
      // ファイルに書き込み
      fs.writeFileSync(claudeMdPath, newContent, 'utf8');
      
      logger.info(`スコープを ${claudeMdPath} にエクスポートしました`);
      return true;
    } catch (error) {
      logger.error(`スコープのメモリへのエクスポートに失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * メモリフォーマットでスコープセクションを構築
   */
  private formatScopeForMemory(scope: ScopeData): string {
    let content = '## Project Scope\n\n';
    
    // スコープ基本情報
    content += `### General Information\n\n`;
    content += `- **Name**: ${scope.name || 'Untitled Project'}\n`;
    content += `- **ID**: ${scope.id || 'No ID'}\n`;
    content += `- **Description**: ${scope.description || 'No description'}\n`;
    content += `- **Project Path**: ${scope.projectPath || 'Not specified'}\n\n`;
    
    // 要件情報
    if (scope.requirements && scope.requirements.length > 0) {
      content += `### Requirements\n\n`;
      scope.requirements.forEach((req, index) => {
        content += `${index + 1}. ${req}\n`;
      });
      content += '\n';
    }
    
    // 選択された実装項目
    if (scope.selectedItems && scope.selectedItems.length > 0) {
      content += `### Implementation Items\n\n`;
      scope.selectedItems.forEach((item, index) => {
        const title = item.title || 'Untitled Item';
        const id = item.id || 'No ID';
        content += `${index + 1}. **${title}** (ID: ${id})\n`;
      });
      content += '\n';
    }
    
    return content;
  }
  
  /**
   * 標準のCLAUDE.mdテンプレートを生成
   */
  public generateMemoryTemplate(projectName: string, projectPath: string): string {
    return `# AppGenius Project: ${projectName}

## Requirements
プロジェクトの要件を記述してください。

## Directory Structure
プロジェクトのディレクトリ構造を記述してください。

## Mockups
モックアップの参照情報と説明を記述してください。
例: ユーザー登録画面 [mockups/register.png]
- ユーザー名、メール、パスワード入力フィールドあり
- 登録ボタンは右下に配置

## Project Scope
プロジェクトスコープ情報が自動的に追加されます。

## Coding Conventions
コーディング規約を記述してください。
- クラス名: PascalCase
- メソッド名: camelCase
- 変数名: camelCase
- 定数: UPPER_SNAKE_CASE

## Implementation Notes
実装に関する特記事項を記述してください。

## Work Status
作業状況を記録します。
`;
  }
  
  /**
   * CLAUDE.mdファイルからスコープ情報を抽出
   */
  public importScopeFromMemory(memoryFilePath?: string): ScopeData | null {
    try {
      // メモリファイルのパスを決定
      const config = configManager.getConfig();
      const claudeMdPath = memoryFilePath || path.join(config.projectRoot, 'CLAUDE.md');
      
      // ファイルが存在しない場合はnullを返す
      if (!fs.existsSync(claudeMdPath)) {
        logger.warn(`CLAUDE.mdファイルが見つかりません: ${claudeMdPath}`);
        return null;
      }
      
      // ファイルを読み込み
      const content = fs.readFileSync(claudeMdPath, 'utf8');
      
      // スコープセクションを抽出
      const scopeRegex = /## Project Scope[\s\S]*?(?=##|$)/;
      const scopeMatch = content.match(scopeRegex);
      
      if (!scopeMatch) {
        logger.warn('CLAUDE.mdにスコープ情報が見つかりません');
        return null;
      }
      
      // スコープ情報を解析
      const scopeSection = scopeMatch[0];
      
      // 基本情報を抽出
      const nameMatch = scopeSection.match(/\*\*Name\*\*:\s*(.+)/);
      const idMatch = scopeSection.match(/\*\*ID\*\*:\s*(.+)/);
      const descriptionMatch = scopeSection.match(/\*\*Description\*\*:\s*(.+)/);
      const projectPathMatch = scopeSection.match(/\*\*Project Path\*\*:\s*(.+)/);
      
      // 要件を抽出
      const requirementsSection = scopeSection.includes('### Requirements') 
        ? scopeSection.split('### Requirements')[1].split('###')[0]
        : '';
      
      const requirements = requirementsSection
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim());
      
      // 実装項目を抽出
      const itemsSection = scopeSection.includes('### Implementation Items') 
        ? scopeSection.split('### Implementation Items')[1].split('###')[0]
        : '';
      
      const itemLines = itemsSection
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()));
      
      const selectedItems = itemLines.map(line => {
        const titleMatch = line.match(/\*\*(.+?)\*\*/);
        const idMatch = line.match(/\(ID:\s*(.+?)\)/);
        
        return {
          title: titleMatch ? titleMatch[1] : undefined,
          id: idMatch ? idMatch[1] : undefined
        };
      });
      
      // スコープデータを構築
      const scopeData: ScopeData = {
        id: idMatch ? idMatch[1].trim() : uuidv4(),
        name: nameMatch ? nameMatch[1].trim() : 'Untitled Scope',
        description: descriptionMatch ? descriptionMatch[1].trim() : '',
        projectPath: projectPathMatch ? projectPathMatch[1].trim() : config.projectRoot,
        requirements: requirements.length > 0 ? requirements : undefined,
        selectedItems: selectedItems.length > 0 ? selectedItems : undefined
      };
      
      return scopeData;
    } catch (error) {
      logger.error(`CLAUDE.mdからのスコープ情報抽出に失敗しました: ${(error as Error).message}`);
      return null;
    }
  }
  
  /**
   * 指定されたセクションをCLAUDE.mdに追加/更新
   */
  public updateMemorySection(sectionName: string, content: string, memoryFilePath?: string): boolean {
    try {
      // メモリファイルのパスを決定
      const config = configManager.getConfig();
      const claudeMdPath = memoryFilePath || path.join(config.projectRoot, 'CLAUDE.md');
      
      // 既存のファイルを読み込み
      let existingContent = '';
      if (fs.existsSync(claudeMdPath)) {
        existingContent = fs.readFileSync(claudeMdPath, 'utf8');
      } else {
        // ファイルが存在しない場合はテンプレートを作成
        existingContent = this.generateMemoryTemplate('New Project', config.projectRoot);
      }
      
      // セクションを構築
      const newSection = `## ${sectionName}\n\n${content}\n\n`;
      
      // 既存のセクションを検索
      const sectionRegex = new RegExp(`## ${sectionName}[\\s\\S]*?(?=##|$)`);
      const newContent = existingContent.match(sectionRegex) 
        ? existingContent.replace(sectionRegex, newSection)
        : existingContent + '\n\n' + newSection;
      
      // ファイルに書き込み
      fs.writeFileSync(claudeMdPath, newContent, 'utf8');
      
      logger.info(`${sectionName}セクションを ${claudeMdPath} に更新しました`);
      return true;
    } catch (error) {
      logger.error(`${sectionName}セクションの更新に失敗しました: ${(error as Error).message}`);
      return false;
    }
  }
}