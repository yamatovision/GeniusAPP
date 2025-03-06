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
      
      // プロジェクトの内部ディレクトリの作成
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
              description: project.description
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
      // requirements.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'requirements.md'),
        `# 要件定義

## 機能要件

1. 要件1
   - 説明: 機能の詳細説明
   - 優先度: 高

2. 要件2
   - 説明: 機能の詳細説明
   - 優先度: 中

## 非機能要件

1. パフォーマンス
   - 説明: レスポンス時間や処理能力に関する要件
   - 優先度: 中

2. セキュリティ
   - 説明: セキュリティに関する要件
   - 優先度: 高

## ユーザーストーリー

- ユーザーとして、[機能]を使いたい。それによって[目的]を達成できる。
`,
        'utf8'
      );
      
      // structure.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'structure.md'),
        `# ディレクトリ構造

\`\`\`
project/
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── assets/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── styles/
│       └── utils/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   └── models/
\`\`\`
`,
        'utf8'
      );
      
      // scope.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'scope.md'),
        `# 実装スコープ

## 完了

（まだ完了した項目はありません）

## 進行中

（実装中の項目がここに表示されます）

## 未着手

1. ユーザー認証機能
   - 説明: ログイン・登録機能の実装
   - 優先度: 高
   - 関連ファイル: 未定

2. データ表示機能
   - 説明: メインデータの一覧表示
   - 優先度: 高
   - 関連ファイル: 未定
`,
        'utf8'
      );
      
      // api.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'api.md'),
        `# API設計

## エンドポイント一覧

### ユーザー管理

- \`POST /api/auth/login\`
  - 説明: ユーザーログイン
  - リクエスト: \`{ email: string, password: string }\`
  - レスポンス: \`{ token: string, user: User }\`

- \`POST /api/auth/register\`
  - 説明: ユーザー登録
  - リクエスト: \`{ name: string, email: string, password: string }\`
  - レスポンス: \`{ token: string, user: User }\`

### データ管理

- \`GET /api/data\`
  - 説明: データ一覧取得
  - リクエストパラメータ: \`{ page: number, limit: number }\`
  - レスポンス: \`{ data: DataItem[], total: number }\`
`,
        'utf8'
      );
      
      // env.example
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'env.example'),
        `# 環境変数サンプル
# 実際の値は.envファイルに設定してください

# サーバー設定
PORT=3000
NODE_ENV=development

# データベース設定
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydatabase
DB_USER=user
DB_PASSWORD=password

# 認証設定
JWT_SECRET=your_jwt_secret_key
`,
        'utf8'
      );
      
      // docs/scopes/ディレクトリを作成
      this.ensureDirectoryExists(path.join(projectPath, 'docs', 'scopes'));
      Logger.info(`Created scopes directory at: ${path.join(projectPath, 'docs', 'scopes')}`);
      
      // mockup_analysis_template.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'mockup_analysis_template.md'),
        `# モックアップ解析と要件定義のテンプレート

あなたはUIモックアップの解析と要件定義の詳細化を行うエキスパートです。すべての応答は必ず日本語で行ってください。英語でのレスポンスは避けてください。ファイルパスの確認なども日本語で行ってください。

## 解析対象
- モックアップHTML: {{MOCKUP_PATH}}
- プロジェクト: {{PROJECT_PATH}}

## 作業指示
このモックアップの解析にあたっては、ユーザーとの相談を最優先してください。以下の手順で進めてください:

1. **まず最初に、モックアップに関するユーザーの意図と考えを確認**
   - モックアップの目的についてユーザーに質問する
   - このUIで達成したいことを詳しく聞く
   - ユーザーがイメージしている利用シーンを把握する

2. **モックアップの詳細な分析と説明**
   - 分析結果をユーザーに説明し、フィードバックを求める
   - UI要素の特定と役割について確認する
   - 画面遷移とユーザーフローについて相談する

3. **改善提案と議論**
   - 改善案をユーザーに提示し、意見を求める
   - ユーザーのフィードバックに基づいて案を調整する
   - 最終的な方向性について合意を得る

4. **要件定義の詳細化（ユーザーの承認を得てから進める）**
   - ユーザーと一緒に要件を具体化する
   - 各項目についてユーザーの確認を得る
   - 非機能要件についても相談する

5. **要件の最終承認**
   - 要件定義のドラフトをユーザーに提示
   - フィードバックを反映して調整
   - 最終承認を得てから文書化を完了する

## 成果物
**必ずユーザーの最終承認を得てから**、完成した要件定義を以下の場所に保存してください:
- 保存先: \`{{PROJECT_PATH}}/docs/scopes/{{MOCKUP_NAME}}-requirements.md\`
- 注意: 必ず上記の絶対パスを使用してください。相対パスは使用しないでください。
- 重要: ユーザーとの議論を経ずに要件定義を自動生成しないでください。

## 要件定義ドキュメントの構成
要件定義には必ず以下の項目を含めてください：

### 1. 機能概要
- 目的と主な機能
- 想定ユーザー

### 2. UI要素の詳細
- 各画面の構成要素
- 入力フィールドと検証ルール
- ボタンとアクション

### 3. データ構造
- 扱うデータの種類と形式
- データの永続化要件

### 4. API・バックエンド連携
- 必要なAPIエンドポイント
- リクエスト/レスポンス形式

### 5. エラー処理
- 想定されるエラーケース
- エラーメッセージと回復方法

### 6. パフォーマンス要件
- 応答時間の目標
- 同時接続数や負荷対策

### 7. セキュリティ要件
- 認証・認可の方法
- データ保護の考慮点

## 注意事項
- ユーザーの意図を正確に把握し、非技術者でも理解できる形で要件をまとめてください
- 要件定義はマークダウン形式で作成し、見やすく構造化してください
- 将来の拡張性を考慮した設計を心がけてください`,
        'utf8'
      );
      
      Logger.info(`Initial documents created for project at: ${projectPath}`);
    } catch (error) {
      Logger.error(`Failed to create initial documents: ${(error as Error).message}`);
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
      
      // 更新前の状態をコピー
      const previousState = { ...project };
      
      // 更新を適用
      Object.assign(project, updates);
      
      // 更新日時を設定
      project.updatedAt = Date.now();
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project updated: ${id}`);
      
      // イベントバスが利用可能ならイベントを発火
      try {
        const { AppGeniusEventBus, AppGeniusEventType } = await import('./AppGeniusEventBus');
        const eventBus = AppGeniusEventBus.getInstance();
        eventBus.emit(
          AppGeniusEventType.PROJECT_UPDATED, 
          { 
            id, 
            project, 
            updates,
            previousState 
          }, 
          'ProjectManagementService',
          id
        );
      } catch (e) {
        // イベントバスが利用できなくても処理は続行
        Logger.debug('AppGeniusEventBus not available, skipping event emission');
      }
      
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
      
      // 以前の状態を記録
      const previousState = project.phases[phase];
      
      // フェーズの状態を更新
      project.phases[phase] = completed;
      
      // 更新日時を設定
      project.updatedAt = Date.now();
      
      // メタデータファイルの更新
      await this.saveMetadata();
      
      Logger.info(`Project phase updated: ${id}, ${phase}=${completed}`);
      
      // 状態が変わった場合だけイベント発火
      if (previousState !== completed) {
        try {
          const { AppGeniusEventBus, AppGeniusEventType } = await import('./AppGeniusEventBus');
          const eventBus = AppGeniusEventBus.getInstance();
          eventBus.emit(
            AppGeniusEventType.PHASE_COMPLETED, 
            { 
              projectId: id, 
              phase, 
              isCompleted: completed 
            }, 
            'ProjectManagementService',
            id
          );
        } catch (e) {
          // イベントバスが利用できなくても処理は続行
          Logger.debug('AppGeniusEventBus not available, skipping event emission');
        }
      }
      
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
      
      // プロジェクト情報を保持
      const deletedProject = this.projects.get(id);
      
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
      
      // イベントバスが利用可能ならイベントを発火
      try {
        const { AppGeniusEventBus, AppGeniusEventType } = await import('./AppGeniusEventBus');
        const eventBus = AppGeniusEventBus.getInstance();
        eventBus.emit(
          AppGeniusEventType.PROJECT_DELETED, 
          { id, project: deletedProject }, 
          'ProjectManagementService'
        );
      } catch (e) {
        // イベントバスが利用できなくても処理は続行
        Logger.debug('AppGeniusEventBus not available, skipping event emission');
      }
      
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
      
      // アクティブなプロジェクトを取得
      const project = this.projects.get(id);
      
      // configに保存
      await ConfigManager.update('activeProjectId', id, true);
      
      Logger.info(`Active project set: ${id}`);
      
      // イベントバスが利用可能ならイベントを発火
      try {
        const { AppGeniusEventBus, AppGeniusEventType } = await import('./AppGeniusEventBus');
        const eventBus = AppGeniusEventBus.getInstance();
        eventBus.emit(
          AppGeniusEventType.PROJECT_SELECTED, 
          project, 
          'ProjectManagementService'
        );
      } catch (e) {
        // イベントバスが利用できなくても処理は続行
        Logger.debug('AppGeniusEventBus not available, skipping event emission');
      }
      
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