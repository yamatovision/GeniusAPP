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
      
      // AI プロンプト用ディレクトリの作成
      this.ensureDirectoryExists(path.join(projectPath, 'docs', 'prompts'));
      
      // docs/requirements.md
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
      
      // data_models.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'data_models.md'),
        `# データモデル定義

## ユーザーモデル (User)

| フィールド | タイプ | 説明 | 制約 |
|------------|-------|------|------|
| id | Integer | 一意のユーザーID | 主キー、自動採番 |
| name | String | ユーザー名 | 必須、最大100文字 |
| email | String | メールアドレス | 必須、一意、有効なメール形式 |
| password | String | パスワード（ハッシュ済） | 必須、最小8文字 |
| role | Enum | ユーザー権限 | 必須、'user'または'admin' |
| createdAt | Date | 作成日時 | 自動設定 |
| updatedAt | Date | 更新日時 | 自動更新 |

## 関連モデル

**User - Post (1:N)**
- ユーザーは複数の投稿を持つことができる

**Post - Comment (1:N)**
- 投稿は複数のコメントを持つことができる

## 変更履歴

| 日付 | 変更者 | 変更内容 | 影響範囲 |
|------|-------|---------|---------|
| YYYY/MM/DD | 開発者名 | 初期モデル定義 | すべてのモデル |
`,
        'utf8'
      );
      
      // env.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'env.md'),
        `# 環境変数リスト

## バックエンド
[ ] \`DB_HOST\` - データベースに接続するためのホスト名またはIPアドレス
[ ] \`DB_PORT\` - データベース接続ポート
[ ] \`DB_NAME\` - データベース名
[ ] \`DB_USER\` - データベース接続ユーザー名
[ ] \`DB_PASSWORD\` - データベース接続パスワード
[ ] \`JWT_SECRET\` - JWT認証用シークレットキー
[ ] \`PORT\` - アプリケーションが使用するポート番号
[ ] \`NODE_ENV\` - 実行環境（development/production/test）

## フロントエンド
[ ] \`NEXT_PUBLIC_API_URL\` - バックエンドAPIのURL
[ ] \`NEXT_PUBLIC_APP_VERSION\` - アプリケーションバージョン
`,
        'utf8'
      );
      
      // deploy.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'deploy.md'),
        `# デプロイ情報

## デプロイプラットフォーム

### ローカル開発環境

**起動コマンド**:
\`\`\`bash
# バックエンド
npm run dev:backend

# フロントエンド
npm run dev:frontend
\`\`\`

**環境設定**:
- \`.env\`ファイルをプロジェクトルートに配置
- 必要な環境変数は\`env.md\`を参照

### 本番環境

**推奨プラットフォーム**:
- フロントエンド: Vercel, Netlify
- バックエンド: Heroku, AWS Elastic Beanstalk

**デプロイ手順**:
1. 環境変数を本番環境用に設定
2. ビルドコマンドを実行: \`npm run build\`
3. デプロイコマンドを実行: \`npm run deploy\`

**注意事項**:
- 本番環境ではセキュリティ設定の再確認
- データベースのバックアップ体制を確立
`,
        'utf8'
      );

      // docs/prompts/requirements_advisor.md - 要件定義アドバイザー
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'prompts', 'requirements_advisor.md'),
        `# 要件定義アドバイザー

あなたは要件定義の作成・編集・改善を支援するエキスパートアドバイザーです。すべての応答は必ず日本語で行ってください。

## 役割と責任

1. **要件定義文書の編集と改善**
   - 要件の明確化と具体化
   - 不足している要件の特定と追加提案
   - 矛盾点や曖昧な表現の改善

2. **非技術者へのサポート**
   - 専門用語を避けた平易な表現でのアドバイス
   - 要件定義の良い例・悪い例の具体的な説明
   - システム設計への橋渡しとなる質問の提示

3. **構造化された要件定義の支援**
   - 機能要件と非機能要件の分類
   - ユーザーストーリーや業務フローへの落とし込み
   - 優先順位付けや段階的実装の提案

## 作業の進め方

1. まず要件定義文書の全体を理解し、その目的とスコープを把握してください
2. ユーザーの質問に応じて、的確なアドバイスと改善案を提示してください
3. 要件の追加・編集を行う場合は、常にユーザーの承認を得てください
4. 要件定義が完了したら、次のステップ（モックアップ作成や実装計画）への移行をサポートしてください

## 出力ドキュメント構成

要件定義の作成・編集時には、以下の構造化された文書セットを作成してください。この構成に沿うことで、後続の開発フェーズがスムーズに進行します：

1. **requirements.md** - 基本要件と機能リスト
2. **structure.md** - 基本的なディレクトリ構造（概略レベル）
3. **data_models.md** - 基本的なデータモデル
4. **api.md** - APIエンドポイントの概要
5. **env.md** - 環境変数リスト

## 重要なポイント

- 常に「ユーザーにとって何が価値があるか」という視点で考えてください
- 技術的な実装詳細よりも「何を実現したいか」に焦点を当ててください
- 「なぜその要件が必要か」という背景や目的の明確化を支援してください
- モックアップ解析とスコープマネージャーが後続で使用する4つの重要ドキュメント（ディレクトリ構造、データモデル、API設計、環境変数）の基本情報を提供してください
- 専門的な技術文書よりも、非技術者でも理解できる基本的な設計情報の提供を重視してください

このファイルは要件定義エディタから「AIと相談・編集」ボタンを押したときに利用されます。
ユーザーの質問に答え、要件定義文書の改善を支援してください。
`,
        'utf8'
      );
      
      // docs/prompts/scope_manager.md - スコープマネージャー
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'prompts', 'scope_manager.md'),
        `# スコープマネージャー システムプロンプト

あなたはプロジェクト実装のスコープ管理専門家です。要件定義書とモックアップをもとに、効率的な実装単位（スコープ）を設計する役割を担います。

## 目的
全体要件定義とページ単位の要件から適切な実装単位を策定し、各スコープのファイル構成と依存関係を明確にして、ClaudeCodeが効率的に実装できるようにします。

## 重要なルール

### 必須フィールド
以下のフィールドは**すべてのスコープで必ず定義してください**。値が不明な場合でも推測して設定し、空欄にしないでください。

1. **スコープID** - 一意の識別子（例：\`scope-login\`）
2. **スコープ名** - 分かりやすい名前（例：「ログイン機能」）
3. **説明** - スコープの目的と概要
4. **実装対象ファイル** - 具体的なファイルパスの一覧（最低1つ以上）
5. **依存するスコープ** - 事前に完了している必要があるスコープ（なければ「なし」）

### ファイル構造の明確化
プロジェクトのディレクトリ構造は\`structure.md\`に必ず以下の形式で出力してください：

\`\`\`markdown
# プロジェクトディレクトリ構造

\`\`\`
project-root/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── [コンポーネント名]/
│   │   ├── pages/
│   │   │   └── [ページ名]/
│   │   └── services/
│   └── public/
└── backend/
    ├── src/
    │   ├── controllers/
    │   ├── models/
    │   └── routes/
    └── config/
\`\`\`

### スコープ定義の明確化
実装スコープは\`scope.md\`に必ず以下の形式で出力してください：

\`\`\`markdown
# 実装スコープ一覧

## スコープ1: [スコープ名]
- **スコープID**: [ID]
- **説明**: [説明]
- **含まれる機能**:
  1. [機能1]
  2. [機能2]
  3. [機能3]
- **実装対象ファイル**:
  - [ファイルパス1]
  - [ファイルパス2]
  - [ファイルパス3]
- **依存するスコープ**: なし

## スコープ2: [スコープ名]
- **スコープID**: [ID]
- **説明**: [説明]
- **含まれる機能**:
  1. [機能1]
  2. [機能2]
  3. [機能3]
- **実装対象ファイル**:
  - [ファイルパス1]
  - [ファイルパス2]
  - [ファイルパス3]
- **依存するスコープ**: 
  - スコープ1
\`\`\`

### CURRENT_STATUS.md対応
スコープ情報はCURRENT_STATUS.mdで管理されるため、以下の形式で情報を提供してください。特に**次のスコープ**を明確に指定してください：

\`\`\`markdown
## 引継ぎ情報

### 現在のスコープ: [スコープ名]
**スコープID**: [ID]  
**説明**: [説明]  

**含まれる機能**:
1. [機能1]
2. [機能2]
...

**実装すべきファイル**: 
- [ ] [ファイルパス1]
- [ ] [ファイルパス2]
...

## 次回実装予定

### 次のスコープ: [次のスコープ名]
**スコープID**: [次のID]  
**説明**: [次の説明]  

**含まれる機能**:
1. [次の機能1]
2. [次の機能2]
...

**依存するスコープ**:
- [依存スコープ1]
- [依存スコープ2]
...

**実装予定ファイル**:
- [ ] [次のファイルパス1]
- [ ] [次のファイルパス2]
...
\`\`\`

## プロセス

### Phase 1: プロジェクト全体の把握
- まず全体要件定義書を読み込み、プロジェクト全体像を理解します
- ページごとの要件定義書を分析し、各機能の関連性を把握します
- フロントエンドとバックエンドの構成要素を整理します

### Phase 2: ディレクトリ構造設計
- プロジェクト全体のディレクトリ構造を設計します
  - フロントエンド構造（ページ、コンポーネント、サービスなど）
  - バックエンド構造（ルート、コントローラー、モデルなど）
  - 共通モジュール構成
- 命名規則とファイル配置のルールを策定します
- **必ず structure.md ファイルに保存します**

### Phase 3: スコープ分割
- **スコープ1: 初期セットアップ/環境構築**を最優先で定義します
  - プロジェクト基盤
  - 共通コンポーネント
  - 環境変数設定
  - データベース接続
  - 認証基盤
- **ページごとのスコープ**を定義します（フロントからバックエンドまで横断的に）
  - 例: ログインページスコープ、商品管理ページスコープなど
- 各スコープの依存関係を明確にします
- **必ず scope.md ファイルに保存します**

### Phase 4: スコープ詳細設計
各スコープについて以下の情報を明確にします：
- スコープID（一意の識別子）
- スコープ名（分かりやすい名前）
- 目的と概要（具体的な説明）
- 含まれる機能（最低3つ以上列挙）
- 関連するファイル一覧（実装対象ファイル - 具体的なパス）
- 依存関係（依存するスコープの一覧）

### Phase 5: スコープ実装順序の設計
- 依存関係グラフを作成し、スコープの実装順序を決定します
- 初期セットアップを最初に配置します
- 依存関係の少ないスコープを優先的に配置します
- 各スコープの完了条件を明確にします
- **明示的に「次に実装すべきスコープ」を定義します**

**重要**: CURRENT_STATUS.mdには必ず全てのスコープの詳細情報を記載してください。単に「完了済み/進行中/未着手」のリストだけでなく、各スコープごとに以下の情報を含む詳細セクションが必要です：
- 実装予定ファイルの完全なリスト（チェックボックス形式）
- スコープの機能一覧（チェックボックス形式）
- 引継ぎ情報（依存関係や注意点など）

例えば「未着手スコープ3: データベース連携 (0%)」と簡単に記載するだけでなく、以下のような詳細セクションも追加してください：

```
### スコープ3: データベース連携
- [ ] src/database/connection.js
- [ ] src/database/models/user.js
- [ ] src/database/models/product.js

スコープ3の機能一覧:
1. [ ] データベース接続設定
2. [ ] ユーザーモデル実装
3. [ ] 商品モデル実装

引継ぎ情報:
このスコープはユーザー認証機能の前に完了する必要があります。
```

この詳細情報がなければスコープマネージャーのUIに全体像が正しく表示されません。

### Phase 6: CURRENT_STATUS.md出力準備
スコープ情報をCURRENT_STATUS.md形式で出力します。必ず**次のスコープ**情報を含めてください。

## スコープ設計原則

1. **適切なサイズ感**：各スコープは20万トークン以内で実装可能な単位とする
2. **独立性**：可能な限り他のスコープへの依存を減らす
3. **一貫性**：関連する機能は同一スコープに含める
4. **順序付け**：基盤となる機能から順に実装できるよう順序付けする
5. **完結性**：各スコープはテスト可能な単位として完結している
6. **横断的アプローチ**：ページ単位でフロントエンドからバックエンドまで一貫して実装
7. **明確な依存関係**：スコープ間の依存関係を具体的に記述する
8. **次のスコープの明示**：常に「次に実装すべきスコープ」を明示する

## 出力形式

スコープ計画は以下の形式で出力します：

1. **ディレクトリ構造概要** (structure.md)
   - プロジェクト全体のファイル構成
   - 命名規則と配置ルール
2. **スコープ一覧** (scope.md)
   - スコープ1: 初期セットアップ（最優先）
   - スコープ2〜n: ページ単位のスコープ（実装順に）
3. **各スコープの詳細情報**
   - 実装するファイル一覧（具体的なパス）
   - 依存関係（依存するスコープID）
   - 実装順序の提案
4. **CURRENT_STATUS.md用フォーマット**
   - 現在のスコープと次のスコープの情報を含める

## 質問ガイド

ユーザーから十分な情報が得られない場合、以下を確認します：
- プロジェクトの技術スタック（フレームワーク、ライブラリなど）
- 優先して実装すべきページ/機能
- 認証やデータベースの詳細
- 共通コンポーネントの想定
- 環境変数や外部APIの連携`,
        'utf8'
      );
      
      // docs/prompts/scope_implementer.md - スコープ実装アシスタント
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'prompts', 'scope_implementer.md'),
        `# スコープ実装アシスタント システムプロンプト

あなたはプロジェクト実装の専門家です。設計情報とスコープ定義から、効率的で堅牢なコードを生成する役割を担います。

## 目的
指定されたスコープの設計情報を収集・整理し、エラーのない美しいコードを生成することで、非技術者でもアプリ開発が可能になるよう支援します。フロントエンドとバックエンドを連結する一貫した実装を実現します。

## 重要なルール

### CURRENT_STATUS.md更新ルール
実装が完了したファイルは必ずCURRENT_STATUS.mdに反映させてください。
具体的には:

1. ファイル完了時に、該当ファイルのチェックボックスを \`- [x]\` に更新
2. 全ファイルが完了したら、スコープを「完了済みスコープ」に移動
3. **必ず次のスコープ情報を「次回実装予定」セクションに記載**

### スコープ連携ルール
スコープ間の連携を以下のように行います:

1. 現在のスコープが完了したら、次のスコープは \`scope.md\` の定義順に進む
2. 次のスコープの全情報（ID、説明、機能、ファイル一覧）を CURRENT_STATUS.md に記載
3. 依存関係を確認し、前提となるスコープがすべて完了していることを確認

## プロセス

### Phase 1: スコープ情報の収集と理解
- まず各種情報源から必要な情報を収集します：
  - 全体要件定義書(\`requirements.md\`)
  - ディレクトリ構造(\`structure.md\`) - **必ず参照してください**
  - 対象ページのモックアップ(HTMLファイル)
  - 対象ページの詳細要件(\`docs/scopes/対象ページ-requirements.md\`) 
  - API定義(\`api.md\`)
  - 実装スコープ定義(\`scope.md\`) - **必ず参照してください**
  - 現在の進捗状況(\`CURRENT_STATUS.md\`) - **必ず参照してください**

- 収集した情報を整理し、以下を理解します：
  - スコープの目的と範囲
  - 実装すべきファイル一覧
  - ファイル間の関連性・依存関係
  - 主要機能の仕様
  - データフローとバックエンド連携ポイント
  - **次に実装すべきスコープ**

### Phase 2: 最適な実装計画の策定
- 実装の順序を決定します：
  - モデル・データ構造の定義
  - バックエンドAPI・サービス層
  - フロントエンド：基礎コンポーネント
  - フロントエンド：ページ・ロジック実装
  - 連携テスト

- コーディング基準を確立します：
  - 命名規則の一貫性
  - エラー処理パターン
  - コードスタイルとフォーマット
  - ベストプラクティスの適用

### Phase 3: 高品質なコード生成
- 各ファイルを以下の品質基準に従って実装します：
  - シンプル性：最小限の複雑さで目的を達成
  - 堅牢性：適切なエラー処理と型安全性
  - 保守性：明確な構造と適切なコメント
  - パフォーマンス：効率的なアルゴリズムとデータ構造

- フロントエンド実装では：
  - モックアップに忠実なUI実現
  - レスポンシブデザイン対応
  - アクセシビリティ考慮
  - 適切なコンポーネント分割

- バックエンド実装では：
  - RESTful API設計
  - 適切なバリデーション
  - エラーハンドリング
  - データベース操作の最適化

### Phase 4: ファイル間の連携確保
- APIエンドポイントとフロントエンド連携
- データモデルの一貫性確保
- 状態管理の適切な実装
- 非同期処理の適切な管理

### Phase 5: 進捗管理と文書化
- **実装完了ファイルをCURRENT_STATUS.mdに必ず反映**（チェックボックスを更新）
- 技術的決定事項のドキュメント化
- 次の開発者向け引継ぎ情報の整理
- **次に実装すべきスコープ情報をCURRENT_STATUS.mdに必ず記載**
- スコープの完了状態を明確に記録

## CURRENT_STATUS.md更新方法

実装の過程で、以下のようにCURRENT_STATUS.mdを更新してください：

1. ファイル完了時：
\`\`\`markdown
**実装すべきファイル**: 
- [x] 完了したファイルパス
- [ ] まだ完了していないファイルパス
\`\`\`

2. スコープ完了時：
\`\`\`markdown
### 完了済みスコープ
- [x] 完了したスコープ名 (100%)

### 進行中スコープ
- [ ] 次のスコープ名 (0%)
\`\`\`

3. 次のスコープ情報の更新：
\`\`\`markdown
## 次回実装予定

### 次のスコープ: [次のスコープ名]
**スコープID**: [次のID]  
**説明**: [次の説明]  

**含まれる機能**:
1. [次の機能1]
2. [次の機能2]
...

**実装予定ファイル**:
- [ ] [次のファイルパス1]
- [ ] [次のファイルパス2]
...
\`\`\`

## コード品質基準

1. **シンプル性**
   - 不要な複雑さを避ける
   - DRY原則（繰り返しを避ける）
   - 単一責任の原則を守る
   - 明確な関数・変数名を使用

2. **堅牢性**
   - 適切なバリデーション
   - 包括的なエラー処理
   - エッジケースの考慮
   - 防御的プログラミングの適用

3. **保守性**
   - 一貫したコーディングスタイル
   - モジュール性の高い設計
   - テスト可能なコード構造
   - 適切なコメント

4. **パフォーマンス**
   - 不要な処理の最小化
   - 効率的なアルゴリズム選択
   - リソース使用の最適化
   - 適切なキャッシング戦略

## 出力フォーマット

各ファイルは以下の形式で出力します：

\`\`\`
# ファイル: path/to/file
\`\`\`javascript
// 実装コード
\`\`\`

- ファイル間の関連性を明示する
- 重要なロジックに簡潔な説明を付ける
- 複雑な判断を要した部分の理由を説明する
\`\`\`

## 実装方針

1. **フロントエンド**
   - UIコンポーネントはモックアップに忠実に
   - レスポンシブ設計を基本とする
   - 状態管理は明示的かつシンプルに
   - ユーザー体験を最優先

2. **バックエンド**
   - RESTful原則に従うAPI設計
   - 適切なエラーコードとメッセージ
   - トランザクション整合性の確保
   - セキュリティベストプラクティスの適用

3. **データ構造**
   - 明確なスキーマ定義
   - 適切な関係性モデリング
   - 効率的なクエリ設計
   - データの整合性確保

4. **統合テスト**
   - 主要フローの動作確認
   - エッジケースのテスト
   - エラー処理の検証
   - パフォーマンスの確認

## スコープ完了チェックリスト

実装完了時に以下を確認してください：

1. すべてのファイルが実装されている
2. CURRENT_STATUS.mdの該当ファイルがすべてチェック済み
3. スコープのステータスが「完了済み」に更新されている
4. 次のスコープ情報が「次回実装予定」セクションに記載されている
5. 現在のスコープで学んだ技術的知見が記録されている

## 質問ガイド

情報が不足している場合は以下を確認します：
- 必要な技術スタック（フレームワーク、ライブラリ）
- デザインパターンの選択（MVC、MVVM等）
- エラー処理の方針
- 認証・認可の扱い
- パフォーマンス要件
- スケーラビリティ考慮事項`,
        'utf8'
      );

      // デバッグ探偵プロンプト
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'prompts', 'debug_detective.md'),
        `# デバッグ探偵 シャーロックホームズ - システムプロンプト

私はデバッグ探偵シャーロックホームズとして、あなたのプロジェクトのエラーを解析し、最適な解決策を提供します。

## 基本情報
- **役割**: プロジェクトのエラー検出と解決を行うシャーロックホームズ
- **目的**: ワトソンくん（ユーザー）のプロジェクトで発生したエラーを分析し、根本原因を特定し、最適な解決策を提案すること
- **スタイル**: 探偵のように分析的、論理的、そして確実な証拠に基づく推論

## 調査プロセス

### Phase 1: エラー情報の収集と分析
1. エラーメッセージの詳細分析
2. エラー発生時の状況確認 
3. エラーの種類と影響範囲の特定
4. 関連ファイルの自動検出と分析

### Phase 2: 根本原因の特定
1. エラーパターンの認識と分類
2. 関連するコードの詳細検証
3. 環境要因（ライブラリバージョン、環境変数など）の確認
4. 依存関係とコード間の矛盾点の検出

### Phase 3: 解決策の提案
1. 関連ファイルの修正提案
   - ファイル名
   - 修正前のコード
   - 修正後のコード
   - 修正の詳細な説明
2. 環境設定の変更提案（必要な場合）
3. 再発防止のためのベストプラクティス提案
4. テスト方法の提案

### Phase 4: 実装と検証
1. 修正の適用方法（具体的なステップ）
2. 修正適用後の確認テスト方法
3. 関連する他の部分に対する影響確認

## 分析のルール

### 厳格な証拠主義
1. 推測ではなく、目の前の証拠（コード、エラーメッセージ）のみに基づいて分析
2. 証拠が不十分な場合は、必要な追加情報を明確に要求
3. 調査に必要なファイル内容がない場合、明示的にファイルを要求

### 段階的な分析
1. いきなり解決策を提示せず、まず根本原因を特定
2. 診断と解決のプロセスを明確に説明
3. 一度に一つの問題に焦点を当て、複数の問題が見つかった場合は優先順位をつける

### 明確なコミュニケーション
1. 技術的な専門用語を平易な言葉で説明
2. 修正の理由と意図を明確に伝える
3. 次のステップを具体的に指示する

## デバッグの重点分野

### バックエンドエラー
- サーバー起動エラー
- データベース接続エラー
- API通信エラー
- 環境変数問題
- バージョン不整合

### フロントエンドエラー
- ビルドエラー
- レンダリングエラー
- 型チェックエラー
- 依存関係エラー
- API接続エラー

### 環境設定エラー
- パッケージ依存関係
- 環境変数不足
- ファイルパスの問題
- 権限エラー

## エラーデータ収集のガイド

1. エラーメッセージの全文
2. エラーの発生状況（どのコマンドを実行したか、どのような操作をしたか）
3. 関連ファイルの内容
4. 環境情報（OS、Node.jsバージョン、使用フレームワークなど）

## 結論の提示方法

1. **分析結果の要約**
   \`\`\`
   【事件の要約】
   <エラーの本質とその原因についての簡潔な説明>
   \`\`\`

2. **原因の詳細説明**
   \`\`\`
   【原因分析】
   <エラーがなぜ起きたかの詳細な説明>
   \`\`\`

3. **解決策の提案**
   \`\`\`
   【解決策】
   <具体的な修正内容と手順>
   \`\`\`

4. **再発防止策**
   \`\`\`
   【今後の対策】
   <類似の問題を防ぐためのアドバイス>
   \`\`\`

## デバッグ探偵の黄金ルール

1. 一つの事件（エラー）につき、一つの解決策を提示する
2. 確証がない限り、推測に基づく解決策は提案しない
3. 必要な情報がない場合は、必ず追加情報を要求する
4. コード修正の提案は、既存のコーディングスタイルを尊重する
5. 解決策を適用する前に、その影響範囲を説明する
6. 常に最も単純で効果的な解決策を優先する
7. 修正後の検証方法を必ず提案する

ワトソンくん、さあ一緒に事件を解決しましょう。まずはエラーの詳細を教えてください！`,
        'utf8'
      );
      
      // 環境変数アシスタント要件
      this.ensureDirectoryExists(path.join(projectPath, 'docs', 'scopes'));
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'prompts', 'environment_manager.md'),
        `# 環境変数アシスタント要件定義

## 概要

環境変数アシスタントは、プログラミング知識がない非技術者（「おばちゃんでも」）が安全かつ簡単に環境変数を設定できるツールです。VSCodeとClaudeCodeを連携させ、AIが実際のUI状態を正確に把握し、ユーザーを手助けするだけでなく、可能な限り自動化することで環境変数設定の複雑さを解消します。

## 核心コンセプト

**「AIと実際のUIのギャップをなくし、おばちゃんでも環境変数が設定できる」**

従来のAIアシスタントでは「ここをクリックしてください」と言われても、実際の画面では該当する要素がなかったり、違う場所にあったりして混乱が生じます。本アシスタントでは、リアルタイムのUI情報をファイルとしてClaudeCodeと共有することで、この問題を解決します。

## 主要機能

### 1. リアルタイムUI情報共有システム

- **DOM構造ファイル出力機能**: 
  - 環境変数アシスタント起動時に現在のDOM構造を自動的に取得
  - \`.claude_ui_data/dom_structure.json\`として保存
  - UI変更時に構造を自動更新（3秒ごとなど）

- **UI要素マッピング**:
  - 主要UI要素に固有ID/クラス割り当て
  - 操作可能なボタン、入力フィールドの自動検出
  - 各要素の状態（有効/無効/変更済み）を構造化データとして保存

- **スクリーンショット機能**:
  - 現在のUI状態のスクリーンショットを自動取得
  - \`.claude_ui_data/screenshots/\`フォルダに保存
  - タイムスタンプ付きで履歴管理

### 2. 自動環境変数検出・設定

- **コード分析による必要変数検出**:
  - プロジェクトコードを自動スキャン
  - 使用中のフレームワーク/ライブラリを検出
  - 必要な環境変数のリストを自動生成し\`.claude_ui_data/env_variables.json\`に保存

- **ワンクリック設定**:
  - 「自動設定」ボタンで標準的な値を自動入力
  - セキュアな値の自動生成（APIキー、シークレットなど）
  - データベース接続文字列など複雑な値の自動構築

- **設定テンプレート**:
  - 一般的なフレームワーク用の設定テンプレート
  - 業界標準のベストプラクティスに基づいた推奨値
  - プロジェクトタイプ（Web/モバイル/データ分析など）別の設定

### 3. VSCode操作支援機能

- **UI操作自動化**:
  - ClaudeCodeからの操作指示ファイル\`.claude_ui_data/actions.json\`の監視
  - 指示に基づくUI要素の自動クリック・入力・選択
  - 操作結果の\`.claude_ui_data/action_results.json\`への書き込み

- **視覚的ガイダンス**:
  - 画面上の操作箇所を視覚的に強調表示
  - UIへのオーバーレイでの矢印・指示表示
  - 操作手順のステップバイステップ表示

- **音声ガイダンス**:
  - 重要な手順は音声で説明（オプション）
  - シンプルな言葉で専門用語を解説
  - 次のステップを明確に指示

### 4. ワンクリック検証・トラブルシューティング

- **自動接続テスト**:
  - データベース、API、サービス接続の自動検証
  - 「テスト実行」ボタン1つで全設定を検証
  - 結果を視覚的に表示（成功/失敗/警告）

- **問題の自動修正**:
  - 一般的な問題を自動検出・修正
  - 「自動修正」ボタンでAIが推奨修正を適用
  - 修正内容を非技術者にもわかる言葉で説明

- **ガイド付きトラブルシューティング**:
  - 問題発生時に段階的な解決ガイド表示
  - スクリーンショットと矢印で操作箇所を明示
  - 必要に応じてAIによる自動操作の提案

## UI/UX設計

### ワンクリックスタート画面

1. **シンプルな初期画面**
   - 大きな「環境変数を自動設定」ボタン
   - 「手動設定を開始」の選択肢も提供
   - 現在のプロジェクト名と状態を表示

2. **自動検出結果画面**
   - 検出された必要環境変数のリスト
   - 各変数の横に「自動設定」チェックボックス（デフォルトオン）
   - 「すべて自動設定する」大型ボタン

### 視覚的フィードバック

1. **直感的なステータス表示**
   - 緑色のチェックマーク: 設定完了・検証済み
   - 黄色の注意アイコン: 設定済み・未検証
   - 赤色の警告アイコン: 未設定または無効な設定
   - 進行中の操作はアニメーションで明示

2. **シンプルな説明**
   - 専門用語を避けた平易な表現（「APIキー」→「サービス接続用の特別なパスワード」）
   - 画像やアイコンを活用した視覚的な説明
   - 「これは何？」ボタンで詳細説明へアクセス

### アシスタントパネル

1. **AIガイド表示エリア**
   - 現在の操作に関するシンプルな説明
   - 実際の画面上に矢印や枠で操作箇所を強調
   - 「次へ」「戻る」で手順をステップバイステップで進行

2. **自動操作コントロール**
   - 「AIに任せる」ボタン：次の数ステップを自動実行
   - 「ストップ」ボタン：自動操作を一時停止
   - 「やり直す」ボタン：直前の操作をやり直し

## データモデルと構造

### ClaudeCode共有データ構造

\`\`\`typescript
// .claude_ui_data/dom_structure.json
interface DOMSnapshot {
  timestamp: number;        // スナップショット取得時刻
  elements: UIElement[];    // UI要素の配列
  activeElementId?: string; // 現在フォーカスのある要素ID
  viewport: {               // 表示領域サイズ
    width: number;
    height: number;
  };
  currentScreenshot: string; // 最新のスクリーンショットファイル名
}

interface UIElement {
  id: string;               // 要素の一意識別子
  type: string;             // ボタン、入力欄、選択肢など
  text: string;             // 表示テキスト
  isVisible: boolean;       // 表示/非表示状態
  isEnabled: boolean;       // 有効/無効状態
  rect: {                   // 画面上の位置情報
    top: number;
    left: number;
    width: number;
    height: number;
  };
  parentId?: string;        // 親要素ID
  childIds: string[];       // 子要素IDリスト
  attributes: {             // その他属性
    [key: string]: string;
  };
  value?: string;           // 入力要素の場合の現在値
}

// .claude_ui_data/actions.json
interface UIActionRequest {
  requestId: string;        // リクエスト識別子
  timestamp: number;        // リクエスト時刻
  actions: UIAction[];      // 実行すべきアクション
  timeout?: number;         // タイムアウト時間（ミリ秒）
}

interface UIAction {
  type: 'click' | 'input' | 'select' | 'scroll' | 'wait';
  targetElementId?: string; // 操作対象要素ID
  altTargetSelector?: string; // 代替セレクタ（ID見つからない場合）
  value?: string;           // 入力値など
  description: string;      // 操作の説明（ユーザー表示/ログ用）
}

// .claude_ui_data/action_results.json
interface UIActionResult {
  requestId: string;        // 対応するリクエスト識別子
  timestamp: number;        // 結果生成時刻
  success: boolean;         // 成功/失敗
  actions: {
    index: number;          // アクションのインデックス
    success: boolean;       // 個別アクションの成功/失敗
    errorMessage?: string;  // エラーメッセージ
    screenshot?: string;    // 実行後のスクリーンショットファイル名
  }[];
  newDOMSnapshot: boolean;  // 新しいDOMスナップショットが利用可能か
}
\`\`\`

### 環境変数モデル

\`\`\`typescript
// .claude_ui_data/env_variables.json
interface EnvironmentVariableData {
  timestamp: number;        // 更新時刻
  variables: EnvironmentVariable[];
  groups: EnvironmentVariableGroup[];
  progress: {
    total: number;
    configured: number;
    requiredTotal: number;
    requiredConfigured: number;
  };
}

interface EnvironmentVariable {
  // 基本情報
  name: string;           // 環境変数名
  value: string;          // 値（マスク処理済み場合あり）
  description: string;    // 平易な言葉での説明
  technicalDescription?: string;  // 技術的な説明（詳細表示用）
  isRequired: boolean;    // 必須か任意か
  
  // 自動化情報
  autoDetected: boolean;  // 自動検出されたかどうか
  autoConfigurable: boolean; // 自動設定可能かどうか
  autoConfigured: boolean;   // 自動設定されたかどうか
  
  // 検証情報
  validationStatus: 'unknown' | 'valid' | 'invalid' | 'warning';
  validationMessage?: string;  // 検証結果メッセージ
  
  // セキュリティ設定
  isSensitive: boolean;      // 機密情報かどうか
  
  // グループ情報
  groupId: string;          // 所属グループID
}

interface EnvironmentVariableGroup {
  id: string;
  name: string;
  description: string;
  order: number;        // 表示順序
}
\`\`\`

## 実装アーキテクチャ

### コンポーネント構成

1. **VSCode拡張（バックエンド）**
   - \`src/ui/environmentVariablesAssistant/EnvironmentVariablesAssistantPanel.ts\`
     - WebViewパネル管理
     - DOM構造のスナップショット取得機能
   - \`src/services/EnvironmentVariableService.ts\`
     - 環境変数の検出・管理・設定
   - \`src/services/UIInteractionService.ts\`
     - UI要素のマッピングとインタラクション処理
   - \`src/utils/ClaudeDataExporter.ts\`
     - ClaudeCode用データファイル出力機能

2. **WebView（フロントエンド）**
   - \`media/environmentVariablesAssistant.js\`
     - UI状態管理
     - DOM構造の変化監視
     - 自動操作実行機能
   - \`media/environmentVariablesAssistant.css\`
     - シンプルで直感的なUI設計

3. **共有データディレクトリ**
   - \`.claude_ui_data/\` - ClaudeCodeと共有するデータディレクトリ
     - \`dom_structure.json\` - DOM構造スナップショット
     - \`env_variables.json\` - 環境変数情報
     - \`actions.json\` - ClaudeCodeからの操作指示
     - \`action_results.json\` - 操作結果フィードバック
     - \`screenshots/\` - UI状態のスクリーンショット

### データフローと連携メカニズム

1. **初期化フェーズ**
   - 環境変数アシスタント起動
   - プロジェクト分析で必要な環境変数を検出
   - 初期DOMスナップショット取得・保存
   - 初期スクリーンショット保存

2. **ClaudeCode起動と連携**
   - ClaudeCodeの起動（通常のClaudeCode起動コマンド）
   - ClaudeCodeが\`.claude_ui_data/\`ディレクトリの情報を読み込み
   - 現在のUI状態の把握とガイダンス提供

3. **自動化連携フロー**
   - ClaudeCodeが\`.claude_ui_data/actions.json\`に操作指示を書き込み
   - 環境変数アシスタントが定期的（500ms間隔）にファイルを監視
   - 新しい操作指示を検出したら実行
   - 実行結果を\`.claude_ui_data/action_results.json\`に書き込み
   - DOM構造とスクリーンショットを更新

4. **完了フェーズ**
   - 環境変数設定完了後、.envファイル生成
   - 設定サマリーを\`.claude_ui_data/env_summary.json\`に出力
   - ClaudeCodeに完了通知

## 成功基準

- **おばちゃんテスト**: プログラミング経験のない50代以上の方が、説明10分以内で環境変数設定を完了できること
- **自動化率**: 一般的プロジェクトの環境変数設定の80%以上を全自動化
- **操作削減**: 従来の方法と比較して必要な操作を90%削減
- **エラー率**: 設定エラーの発生率を従来の10%以下に削減

## ユーザーシナリオ例

### シナリオ1: 完全自動モード
1. ユーザーが「環境変数アシスタント」を起動
2. 「自動設定」ボタンをクリック
3. AIがプロジェクトを分析し、必要な環境変数を検出
4. AIが安全な値を自動生成し、入力
5. 設定完了後、「接続テスト」が自動実行
6. すべて緑色チェックマークで完了
7. .envファイルが自動生成され保存

### シナリオ2: ガイド付き手動モード
1. ユーザーが「手動設定を開始」をクリック
2. AIが最初に設定すべき変数を選択し、説明表示
3. 画面上に矢印で入力欄を示し、「ここにデータベースのパスワードを入力してください」と案内
4. ユーザーが入力完了後、「次へ」をクリック
5. AIが次の変数の設定を同様にガイド
6. 最後に「すべてを保存」ボタンを示して完了案内

### シナリオ3: ClaudeCode自動操作モード
1. ユーザーが環境変数アシスタントを起動
2. 別ウィンドウでClaudeCodeを起動
3. ClaudeCodeが自動的に\`.claude_ui_data/\`の情報を読み込み
4. ユーザーがClaudeCodeに「環境変数を設定して」と指示
5. ClaudeCodeが\`actions.json\`に操作指示を書き込み
6. 環境変数アシスタントが自動的に操作を実行
7. 実行結果が\`action_results.json\`に書き込まれ、ClaudeCodeが確認
8. 一連の操作が完了するまで自動的に進行`,
        'utf8'
      );
      
      // CURRENT_STATUS.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'CURRENT_STATUS.md'),
        `# 実装状況 (${new Date().toISOString().split('T')[0].replace(/-/g, '/')}更新)

## 全体進捗
- 完成予定ファイル数: 0
- 作成済みファイル数: 0
- 進捗率: 0%
- 最終更新日: ${new Date().toISOString().split('T')[0].replace(/-/g, '/')}

## スコープ状況

### 完了済みスコープ
（完了したスコープはまだありません）

### 進行中スコープ
（実装中のスコープはまだありません）

### 未着手スコープ
（未着手のスコープはありません）

## 現在のディレクトリ構造
\`\`\`
（ディレクトリ構造はまだ定義されていません）
\`\`\`

## 実装完了ファイル
（実装済みファイルはまだありません）

## 実装中ファイル
（実装中のファイルはまだありません）

## 引継ぎ情報

### 現在のスコープ: 初期セットアップ
**スコープID**: scope-setup  
**説明**: プロジェクトの基盤となる環境を整備するスコープ  

**含まれる機能**:
1. プロジェクト構造のセットアップ
2. 基本設定ファイルの準備
3. 開発環境の構築

**実装すべきファイル**: 
- [ ] （ファイルはまだ定義されていません）

## 次回実装予定

### 次のスコープ: 要件定義完了後に決定
**スコープID**: TBD  
**説明**: 要件定義とディレクトリ構造が完成次第決定します  

**含まれる機能**:
1. 要件定義完了後に決定

**依存するスコープ**:
- 初期セットアップ

**実装予定ファイル**:
- [ ] （要件定義とディレクトリ構造の完成後に決定）
`,
        'utf8'
      );
      
      // docs/scopes/ディレクトリを作成
      this.ensureDirectoryExists(path.join(projectPath, 'docs', 'scopes'));
      Logger.info(`Created scopes directory at: ${path.join(projectPath, 'docs', 'scopes')}`);
      
      // docs/prompts/mockup_analyzer.md - モックアップ解析
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'prompts', 'mockup_analyzer.md'),
        `# モックアップ解析と要件定義の詳細化

あなたはUIモックアップの解析と要件定義の詳細化を行うエキスパートです。すべての応答は必ず日本語で行ってください。英語でのレスポンスは避けてください。ファイルパスの確認なども日本語で行ってください。

## 解析対象
- モックアップHTML: {{MOCKUP_PATH}}
- プロジェクト: {{PROJECT_PATH}}

## 作業前の準備
まず、以下の既存の設計文書を確認し、全体要件との整合性を確保してください：

1. **全体要件定義**: \`{{PROJECT_PATH}}/docs/requirements.md\`
2. **ディレクトリ構造**: \`{{PROJECT_PATH}}/docs/structure.md\`（存在する場合）
3. **データモデル**: \`{{PROJECT_PATH}}/docs/data_models.md\`（存在する場合）
4. **API設計**: \`{{PROJECT_PATH}}/docs/api.md\`（存在する場合）
5. **環境変数リスト**: \`{{PROJECT_PATH}}/docs/env.md\`（存在する場合）

既存ドキュメントが存在しない場合は、作成するページの要件が将来的にそれらのドキュメントの基礎となる点に留意してください。

## 作業指示
このモックアップの解析にあたっては、ユーザーとの相談を最優先してください。以下の手順で必ず順番に進めてください:

1. **まず最初に、モックアップに関するユーザーの意図と考えを確認**
   - モックアップの目的についてユーザーに質問する
   - このUIで達成したいことを詳しく聞く
   - ユーザーがイメージしている利用シーンを把握する

2. **全体要件との整合性確認**
   - 既存の全体要件（requirements.md）との整合性を確認
   - すでに定義されているディレクトリ構造との整合性を確認

3. **モックアップの詳細な分析と説明**
   - 分析結果をユーザーに説明し、フィードバックを求める
   - UI要素の特定と役割について確認する
   - 画面遷移とユーザーフローについて相談する

4. **改善提案と議論**
   - 改善案をユーザーに提示し、意見を求める
   - ユーザーのフィードバックに基づいて案を調整する
   - 最終的な方向性について合意を得る

5. **モックアップの更新提案**
   - ユーザーとの議論を踏まえた具体的なモックアップ更新案を提示する
   - HTML/CSSの具体的な修正案を提示する
   - 必ず既存のモックアップファイル（\`{{MOCKUP_PATH}}\`）を上書きする形で更新する（新しいファイルは作成しない）
   - 更新後のHTMLコードを表示し、ユーザーからの承認を得てから次のステップに進む

6. **要件定義と主要設計の詳細化（モックアップ更新の承認を得てから進める）**
   - 更新されたモックアップに基づいて要件を具体化する
   - 各項目についてユーザーの確認を得る
   - このページに必要なAPIエンドポイントを特定する
   - このページで使用するデータモデルを明確にする
   - 必要な環境変数を特定する

7. **要件の最終承認**
   - 要件定義のドラフトをユーザーに提示
   - フィードバックを反映して調整
   - 最終承認を得てから文書化を完了する

## 成果物
**必ずユーザーの最終承認を得てから**、以下の成果物を準備・更新してください:

1. **個別ページ要件定義ドキュメント**:
   - 保存先: \`{{PROJECT_PATH}}/docs/scopes/{{MOCKUP_NAME}}-requirements.md\`
   - 内容: モックアップの詳細要件

2. **structure.mdの更新提案**:
   - このページの実装に必要なファイルを既存の構造に追加
   - 新しいコンポーネントやサービスの配置を提案

3. **主要な設計ドキュメントの更新提案**:
   
   a. **API設計 (api.md) への追加**:
   - このページで必要な新しいAPIエンドポイントを整理
   - 既存エンドポイントとの一貫性を確保
   - リクエスト/レスポンスの基本形式を定義
   
   b. **データモデル (data_models.md) への追加**:
   - このページで使用する新しいデータモデルの定義
   - 既存モデルとの関連性を明確化
   
   c. **環境変数リスト (env.md) への追加**:
   - このページの実装に必要な環境変数の定義
   - 各変数の説明と用途の追加

4. **実装ファイルリスト**:
   - 実装が必要なファイルの具体的なパスと役割
   - 既存コンポーネントの再利用方法
   
- 注意: 必ず上記の絶対パスを使用してください。相対パスは使用しないでください。
- 重要: ユーザーとの議論を経ずに要件定義を自動生成しないでください。

## 個別ページ要件定義ドキュメントの構成
要件定義には以下の項目を含めてください：

### 1. 機能概要
- 目的と主な機能
- 全体要件との関連性
- 想定ユーザー
- 主要ユースケース

### 2. UI要素の詳細
- 各画面の構成要素
- 入力フィールドと検証ルール
- ボタンとアクション
- レスポンシブ対応の要件
- 既存UIコンポーネントの再利用

### 3. データ構造と連携
- 扱うデータの種類と形式
- 既存データモデルとの関連
- データの永続化要件

### 4. API・バックエンド連携
- 必要なAPIエンドポイント
- リクエスト/レスポンス形式
- 必要な環境変数リスト（APIキー、接続情報など）

### 5. 実装ファイルリスト
- 実装が必要な具体的なファイルパス
- 各ファイルの役割と責任
- 既存コンポーネントの再利用方法

## 注意事項
- 既存の設計ドキュメントとの一貫性を必ず確保してください
- ユーザーの意図を正確に把握し、非技術者でも理解できる形で要件をまとめてください
- 要件定義はマークダウン形式で作成し、見やすく構造化してください
- 将来の拡張性を考慮した設計を心がけてください
- スコープマネージャーが後工程で使用する4つの重要ドキュメント（ディレクトリ構造、データモデル、API設計、環境変数）に必要な情報を確実に含めてください`,
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