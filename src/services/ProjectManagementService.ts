import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { ConfigManager } from '../utils/configManager';

/**
 * プロジェクト情報インターフェース
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  path: string;
  status: 'active' | 'archived';
  phases: {
    requirements: boolean;
    design: boolean;
    implementation: boolean;
    testing: boolean;
    deployment: boolean;
  };
  metadata: Record<string, any>;
}

/**
 * プロジェクト管理サービス
 * プロジェクトの作成、更新、削除、一覧表示を担当
 */
export class ProjectManagementService {
  private static instance: ProjectManagementService;
  private projects: Map<string, any>;
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
    this.projects = new Map();
    
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
  public async createProject(projectData: any): Promise<string> {
    try {
      // プロジェクトIDの生成
      const id = `project_${Date.now()}`;
      const projectDir = path.join(this.storageDir, id);
      
      // プロジェクトの内部ディレクトリの作成
      this.ensureDirectoryExists(projectDir);
      
      // 現在時刻を取得
      const now = Date.now();
      
      // プロジェクトメタデータを作成
      const project = {
        id,
        name: projectData.name,
        description: '',
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
      
      // プロジェクトパスが指定されている場合は、プロジェクトフォルダ構造を作成
      if (project.path) {
        try {
          // プロジェクトフォルダを作成
          this.ensureDirectoryExists(project.path);
          // 新しいプロジェクト構造を作成
          this.ensureDirectoryExists(path.join(project.path, 'docs'));
          this.ensureDirectoryExists(path.join(project.path, 'mockups'));
          // 基本的なドキュメントファイルを作成
          this.createInitialDocuments(project.path);
          // CLAUDE.mdファイルを生成
          try {
            const { ClaudeMdService } = await import('../utils/ClaudeMdService');
            const claudeMdService = ClaudeMdService.getInstance();
            await claudeMdService.generateClaudeMd(project.path, {
              name: project.name,
              description: ""
            });
            Logger.info(`CLAUDE.md file created for project: ${id}`);
          } catch (e) {
            Logger.warn(`Failed to create CLAUDE.md file: ${(e as Error).message}`);
          }
        } catch (e) {
          Logger.error(`Failed to create project structure: ${(e as Error).message}`);
        }
      }
      
      // メモリ上のマップに保存
      this.projects.set(id, project);
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project created: ${id}`);
      
      // イベントバスが利用可能ならイベントを発火
      try {
        // 動的インポートを使用してAppGeniusEventBusをロード
        const { AppGeniusEventBus, AppGeniusEventType } = await import('./AppGeniusEventBus');
        const eventBus = AppGeniusEventBus.getInstance();
        eventBus.emit(
          AppGeniusEventType.PROJECT_CREATED, 
          project, 
          'ProjectManagementService'
        );
      } catch (e) {
        // イベントバスが利用できなくても処理は続行
        Logger.debug('AppGeniusEventBus not available, skipping event emission');
      }
      
      return id;
    } catch (error) {
      Logger.error(`Failed to create project: ${(error as Error).message}`);
      throw new Error(`プロジェクトの作成に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 初期ドキュメントファイルを作成
   * @param projectPath プロジェクトのパス
   */
  private createInitialDocuments(projectPath: string): void {
    try {
      // 必要最小限のディレクトリ構成のみを作成
      // docs/ディレクトリの作成
      this.ensureDirectoryExists(path.join(projectPath, 'docs'));
      // docs/scopes/ディレクトリの作成
      this.ensureDirectoryExists(path.join(projectPath, 'docs', 'scopes'));
      // mockups/ディレクトリの作成
      this.ensureDirectoryExists(path.join(projectPath, 'mockups'));
      
      // デバッグディレクトリの作成
      this.ensureDirectoryExists(path.join(projectPath, 'logs'));
      this.ensureDirectoryExists(path.join(projectPath, 'logs', 'debug'));
      this.ensureDirectoryExists(path.join(projectPath, 'logs', 'debug', 'sessions'));
      this.ensureDirectoryExists(path.join(projectPath, 'logs', 'debug', 'archived'));
      this.ensureDirectoryExists(path.join(projectPath, 'logs', 'debug', 'knowledge'));
      
      // .gitkeepファイルを追加して空ディレクトリを追跡可能に
      fs.writeFileSync(path.join(projectPath, 'logs', 'debug', 'sessions', '.gitkeep'), '', 'utf8');
      fs.writeFileSync(path.join(projectPath, 'logs', 'debug', 'archived', '.gitkeep'), '', 'utf8');
      fs.writeFileSync(path.join(projectPath, 'logs', 'debug', 'knowledge', '.gitkeep'), '', 'utf8');
      
      // ClaudeCode データ共有ディレクトリの作成
      this.ensureDirectoryExists(path.join(projectPath, '.claude_data'));
      this.ensureDirectoryExists(path.join(projectPath, '.claude_data', 'screenshots'));
      
      // 一時ファイル用ディレクトリの作成
      this.ensureDirectoryExists(path.join(projectPath, 'temp'));
      
      // .gitignoreに.claude_data/とtemp/を追加
      const gitignorePath = path.join(projectPath, '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, '.claude_data/\ntemp/\n', 'utf8');
      } else {
        // 既存のgitignoreがあれば内容を読み取って必要な項目が含まれていなければ追加
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        let updatedContent = gitignoreContent;
        
        if (!gitignoreContent.includes('.claude_data')) {
          updatedContent += '\n.claude_data/\n';
        }
        
        if (!gitignoreContent.includes('temp/')) {
          updatedContent += 'temp/\n';
        }
        
        if (updatedContent !== gitignoreContent) {
          fs.writeFileSync(gitignorePath, updatedContent, 'utf8');
        }
      }
      
      // CURRENT_STATUSTEMPLATE.mdを作成（既存ファイルがある場合は作成しない）
      try {
        const currentStatusTemplatePath = path.join(projectPath, 'docs', 'CURRENT_STATUSTEMPLATE.md');
        
        // 既存のCURRENT_STATUSTEMPLATE.mdファイルが存在するかチェック
        if (!fs.existsSync(currentStatusTemplatePath)) {
          // ファイルが存在しない場合のみ作成
          const templatePath = path.join(__dirname, '../../docs/CURRENT_STATUSTEMPLATE.md');
          
          if (fs.existsSync(templatePath)) {
            // システムのテンプレートをコピー
            const templateContent = fs.readFileSync(templatePath, 'utf8');
            fs.writeFileSync(currentStatusTemplatePath, templateContent, 'utf8');
            Logger.info(`CURRENT_STATUSTEMPLATE.md created for project at: ${projectPath}`);
          } else {
            // テンプレートが見つからない場合は基本的なCURRENT_STATUSTEMPLATE.mdを作成
            fs.writeFileSync(
              currentStatusTemplatePath,
              `# CURRENT_STATUSTEMPLATE

このプロジェクトは複数のAIがプロジェクト完遂のために統一性のある綺麗な重複のないジョブスもニッコリのシンプルかつ美しいコードアーキテクチャーで堅牢性と拡張性の高いアプリケーションを開発を行えることを目的にCURRENT_STATUSに基づいて実装管理を行っています。

CURRENT_STATUSTEMPLATEはこのCURRENT_STATUSを更新していくための手順書です。
なお、このプロジェクトはCURRENT_STATUSの記述ルールをパースしてプロジェクトスコープに反映させてユーザーに開発進捗を知らせることになりますのでパースルールから外れないように下記の形式を必ず守って記述更新をしてください。

## パースルール

ScopeManagerPanelはCURRENT_STATUS.mdの内容を以下のルールでパースして表示します：

1. **スコープの検出**:
   - 「### 完了済みスコープ」セクションから \`- [x] スコープ名 (100%)\` 形式のスコープを検出
   - 「### 進行中スコープ」セクションから \`- [ ] スコープ名 (進捗率%)\` 形式のスコープを検出
   - 「### 未着手スコープ」セクションから \`- [ ] スコープ名 (0%)\` または \`- [ ] スコープ名\` 形式のスコープを検出

2. **ファイルリストの検出**:
   - 「## スコープ名」形式のセクションからそのスコープに関連するファイルリストを検出
   - \`- [x] ファイルパス\` は完了したファイル、\`- [ ] ファイルパス\` は未完了のファイルとして認識

3. **進捗率の計算**:
   - 各スコープの進捗率はファイルリストの完了状態から自動計算される
   - 明示的に記載された進捗率（例：\`スコープ名 (50%)\`）も認識される

4. **セクション名の重要性**:
   - 「### 完了済みスコープ」「### 進行中スコープ」「### 未着手スコープ」の見出しは正確に記述する必要がある
   - 「## スコープ名」の見出しはスコープ名と完全に一致する必要がある

これらのルールに従わない記述や形式はパースエラーを引き起こす可能性があります。

<具体例>

# プロジェクト名 - 実装状況 (YYYY/MM/DD更新)

## 全体進捗
- 完成予定ファイル数: 82
- 作成済みファイル数: 41
- 進捗率: 50%
- 最終更新日: 2025/03/12

## スコープ状況

### 完了済みスコープ
- [x] スコープ名1 (100%)
- [x] スコープ名2 (100%)

### 進行中スコープ
- [ ] スコープ名3 (50%)

### 未着手スコープ
- [ ] スコープ名4 (0%)
- [ ] スコープ名5 (0%)

## 最終的なディレクトリ構造(予測)
\`\`\`
project-root/
└── [ディレクトリ構造]
\`\`\`

## 現在のディレクトリ構造
\`\`\`
project-root/
└── [ディレクトリ構造]
\`\`\`

## スコープ名1 
- [x] src/ui/auth/AuthStatusBar.ts
- [x] src/services/AuthEventBus.ts
- [x] src/core/auth/authCommands.ts
- [ ] src/ui/promptLibrary/PromptLibraryPanel.ts
- [ ] src/ui/promptLibrary/PromptEditor.ts
- [ ] src/ui/promptLibrary/CategoryManager.ts
- [ ] src/ui/promptLibrary/PromptImportExport.ts
- [ ] src/commands/promptLibraryCommands.ts

### 参考資料
- 要件定義書: docs/requirements.md
- スコープ仕様書: docs/scopes/scope-name1.md
- API仕様: docs/api.md
</具体例>`,
              'utf8'
            );
            Logger.info(`Basic CURRENT_STATUSTEMPLATE.md created for project at: ${projectPath}`);
          }
        } else {
          Logger.info(`CURRENT_STATUSTEMPLATE.md already exists for project at: ${projectPath}, skipping creation`);
        }
      } catch (error) {
        Logger.error(`Failed to create CURRENT_STATUSTEMPLATE.md: ${(error as Error).message}`);
        // エラーが発生しても処理は続行
      }
    } catch (error) {
      Logger.error(`Failed to create initial documents: ${(error as Error).message}`);
    }
  }

  /**
   * プロジェクトのロード
   */
  private loadProjects(): void {
    try {
      if (!fs.existsSync(this.metadataFile)) {
        // メタデータファイルが存在しない場合は空のJSONファイルを作成
        fs.writeFileSync(this.metadataFile, JSON.stringify({ projects: [] }), 'utf8');
        return;
      }
      
      // 同期的にファイルを読み込むが、大量のプロジェクトがある場合も考慮して最適化
      const data = fs.readFileSync(this.metadataFile, 'utf8');
      if (!data || data.trim() === '') {
        Logger.warn('Project metadata file is empty, initializing with empty projects list');
        fs.writeFileSync(this.metadataFile, JSON.stringify({ projects: [] }), 'utf8');
        return;
      }
      
      try {
        const metadata = JSON.parse(data);
        
        if (metadata.projects && Array.isArray(metadata.projects)) {
          // Mapをクリアしてから再構築（重複を避ける）
          this.projects.clear();
          
          // 高速にプロジェクトをロード
          metadata.projects.forEach((project: any) => {
            if (project.id) {
              this.projects.set(project.id, project);
            }
          });
        }
        
        Logger.info(`Loaded ${this.projects.size} projects`);
      } catch (parseError) {
        // JSONパースエラーの場合、ファイルが破損している可能性がある
        Logger.error(`Failed to parse projects metadata: ${(parseError as Error).message}`);
        
        // バックアップを作成して新しいファイルを作成
        const backupPath = `${this.metadataFile}.backup-${Date.now()}`;
        fs.copyFileSync(this.metadataFile, backupPath);
        Logger.info(`Created backup of corrupted metadata file: ${backupPath}`);
        
        // 空のプロジェクトリストで初期化
        this.projects.clear();
        fs.writeFileSync(this.metadataFile, JSON.stringify({ projects: [] }), 'utf8');
      }
    } catch (error) {
      Logger.error(`Failed to load projects: ${(error as Error).message}`);
      // エラー発生時は空のプロジェクトリストを使用
      this.projects.clear();
    }
  }
  
  /**
   * メタデータの保存
   */
  private async saveMetadata(): Promise<void> {
    try {
      const projectsArray = Array.from(this.projects.values());
      const metadata = { projects: projectsArray };
      
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
      Logger.debug(`Saved metadata for ${projectsArray.length} projects`);
    } catch (error) {
      Logger.error(`Failed to save metadata: ${(error as Error).message}`);
    }
  }
  
  /**
   * ディレクトリが存在することを確認し、存在しない場合は作成する
   * @param dirPath ディレクトリのパス
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  
  /**
   * プロジェクトの取得
   * @param id プロジェクトID
   * @returns プロジェクト情報
   */
  public getProject(id: string): any {
    return this.projects.get(id);
  }
  
  /**
   * すべてのプロジェクトの取得
   * @returns すべてのプロジェクト
   */
  public getAllProjects(): any[] {
    return Array.from(this.projects.values());
  }
  
  /**
   * 現在アクティブなプロジェクトを取得
   * @returns アクティブなプロジェクト情報
   */
  public getActiveProject(): any {
    // 現在のところ、最後に更新されたプロジェクトをアクティブとみなす
    const projects = this.getAllProjects();
    if (projects.length === 0) {
      return null;
    }
    
    // updatedAtの降順でソート
    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    return projects[0];
  }
  
  /**
   * プロジェクトの更新
   * @param id プロジェクトID
   * @param projectData 更新するプロジェクトデータ
   * @returns 更新されたプロジェクト
   */
  public async updateProject(id: string, projectData: any): Promise<any> {
    try {
      const existingProject = this.projects.get(id);
      
      if (!existingProject) {
        throw new Error(`Project with ID ${id} not found`);
      }
      
      // 更新するフィールドをマージ
      const updatedProject = {
        ...existingProject,
        ...projectData,
        updatedAt: Date.now()
      };
      
      // メモリ上のマップを更新
      this.projects.set(id, updatedProject);
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project updated: ${id}`);
      
      return updatedProject;
    } catch (error) {
      Logger.error(`Failed to update project: ${(error as Error).message}`);
      throw new Error(`プロジェクトの更新に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * プロジェクトの削除
   * @param id プロジェクトID
   * @returns 成功した場合はtrue
   */
  public async deleteProject(id: string): Promise<boolean> {
    try {
      if (!this.projects.has(id)) {
        throw new Error(`Project with ID ${id} not found`);
      }
      
      // プロジェクトの内部ディレクトリを削除（オプション）
      const projectDir = path.join(this.storageDir, id);
      if (fs.existsSync(projectDir)) {
        // 再帰的に削除（注意: node.js 12.10.0以上が必要）
        fs.rmdirSync(projectDir, { recursive: true });
      }
      
      // メモリ上のマップから削除
      this.projects.delete(id);
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project deleted: ${id}`);
      
      return true;
    } catch (error) {
      Logger.error(`Failed to delete project: ${(error as Error).message}`);
      throw new Error(`プロジェクトの削除に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * プロジェクトの検索
   * @param query 検索クエリ
   * @returns 検索結果
   */
  public searchProjects(query: string): any[] {
    try {
      const searchTerm = query.toLowerCase();
      
      return Array.from(this.projects.values()).filter(project => {
        // プロジェクト名と説明で検索
        return (
          project.name.toLowerCase().includes(searchTerm) ||
          (project.description && project.description.toLowerCase().includes(searchTerm))
        );
      });
    } catch (error) {
      Logger.error(`Failed to search projects: ${(error as Error).message}`);
      return [];
    }
  }
  
  /**
   * プロジェクトのアーカイブ/アクティブ化
   * @param id プロジェクトID
   * @param isArchived アーカイブ状態にするかどうか
   * @returns 更新されたプロジェクト
   */
  public async toggleArchiveProject(id: string, isArchived: boolean): Promise<any> {
    try {
      const existingProject = this.projects.get(id);
      
      if (!existingProject) {
        throw new Error(`Project with ID ${id} not found`);
      }
      
      // プロジェクトのステータスを更新
      const updatedProject = {
        ...existingProject,
        status: isArchived ? 'archived' : 'active',
        updatedAt: Date.now()
      };
      
      // メモリ上のマップを更新
      this.projects.set(id, updatedProject);
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project ${isArchived ? 'archived' : 'activated'}: ${id}`);
      
      return updatedProject;
    } catch (error) {
      Logger.error(`Failed to toggle archive project: ${(error as Error).message}`);
      throw new Error(`プロジェクトのアーカイブ状態変更に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 指定したプロジェクトをアクティブに設定
   * @param projectId プロジェクトID
   * @returns 更新されたプロジェクト
   */
  public async setActiveProject(projectId: string): Promise<any> {
    try {
      const project = this.getProject(projectId);
      
      if (!project) {
        throw new Error(`プロジェクトID ${projectId} が見つかりません`);
      }
      
      // プロジェクトの最終更新日時を更新することで、getActiveProject()メソッドで
      // 自動的に最新のプロジェクトとして選択されるようにする
      const updatedProject = await this.updateProject(projectId, {
        updatedAt: Date.now()
      });
      
      Logger.info(`プロジェクトをアクティブに設定: ${projectId}`);
      
      return updatedProject;
    } catch (error) {
      Logger.error(`プロジェクトのアクティブ設定に失敗: ${(error as Error).message}`);
      throw new Error(`プロジェクトのアクティブ設定に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * プロジェクトのフェーズ状態を更新
   * @param projectId プロジェクトID
   * @param phase 更新するフェーズ名
   * @param isCompleted 完了状態
   * @returns 更新されたプロジェクト
   */
  public async updateProjectPhase(projectId: string, phase: string, isCompleted: boolean): Promise<any> {
    try {
      const project = this.getProject(projectId);
      
      if (!project) {
        throw new Error(`プロジェクトID ${projectId} が見つかりません`);
      }
      
      // フェーズが存在するか確認
      if (!project.phases || typeof project.phases !== 'object') {
        project.phases = {
          requirements: false,
          design: false,
          implementation: false,
          testing: false,
          deployment: false
        };
      }
      
      // フェーズ状態を更新
      const updatedPhases = {
        ...project.phases,
        [phase]: isCompleted
      };
      
      // プロジェクトを更新
      const updatedProject = await this.updateProject(projectId, {
        phases: updatedPhases,
        updatedAt: Date.now()
      });
      
      Logger.info(`プロジェクトフェーズを更新: ${projectId}.${phase} = ${isCompleted}`);
      
      return updatedProject;
    } catch (error) {
      Logger.error(`プロジェクトフェーズの更新に失敗: ${(error as Error).message}`);
      throw new Error(`プロジェクトフェーズの更新に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * プロジェクトのエクスポート
   * @param id プロジェクトID
   * @param exportPath エクスポート先のパス
   * @returns 成功した場合はtrue
   */
  public async exportProject(id: string, exportPath: string): Promise<boolean> {
    try {
      const project = this.projects.get(id);
      
      if (!project) {
        throw new Error(`Project with ID ${id} not found`);
      }
      
      // プロジェクトデータとメタデータをJSONとしてエクスポート
      const exportData = {
        ...project,
        exportedAt: Date.now()
      };
      
      this.ensureDirectoryExists(path.dirname(exportPath));
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8');
      
      Logger.info(`Project exported: ${id} to ${exportPath}`);
      
      return true;
    } catch (error) {
      Logger.error(`Failed to export project: ${(error as Error).message}`);
      throw new Error(`プロジェクトのエクスポートに失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * プロジェクトのインポート
   * @param importPath インポート元のパス
   * @returns インポートされたプロジェクトのID
   */
  public async importProject(importPath: string): Promise<string> {
    try {
      // インポートファイルを読み込み
      const data = fs.readFileSync(importPath, 'utf8');
      const importedData = JSON.parse(data);
      
      // 新しいIDを生成
      const newId = `project_${Date.now()}`;
      
      // インポートデータを新しいプロジェクトとして作成
      const project = {
        ...importedData,
        id: newId,
        importedAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // メモリ上のマップに保存
      this.projects.set(newId, project);
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project imported: ${newId} from ${importPath}`);
      
      return newId;
    } catch (error) {
      Logger.error(`Failed to import project: ${(error as Error).message}`);
      throw new Error(`プロジェクトのインポートに失敗しました: ${(error as Error).message}`);
    }
  }
}