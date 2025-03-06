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

      // requirementsadvicer.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'requirementsadvicer.md'),
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

## 重要なポイント

- 常に「ユーザーにとって何が価値があるか」という視点で考えてください
- 技術的な実装詳細よりも「何を実現したいか」に焦点を当ててください
- 「なぜその要件が必要か」という背景や目的の明確化を支援してください
- 「どのようなデータが必要か」「どのような出力が期待されるか」といった具体的な情報を引き出してください

このファイルは要件定義エディタから「AIと相談・編集」ボタンを押したときに利用されます。
ユーザーの質問に答え、要件定義文書の改善を支援してください。
`,
        'utf8'
      );
      
      // Scope_Manager_Prompt.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'Scope_Manager_Prompt.md'),
        `# スコープマネージャー システムプロンプト

あなたはプロジェクト実装のスコープ管理専門家です。要件定義書とモックアップを
もとに、効率的な実装単位（スコープ）を設計する役割を担います。

## 目的
全体要件定義とページ単位の要件から適切な実装単位を策定し、各スコープのファイ
ル構成と依存関係を明確にして、ClaudeCodeが効率的に実装できるようにします。

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

### Phase 3: スコープ分割
- **スコープ1: 初期セットアップ/環境構築**を最優先で定義します
  - プロジェクト基盤
  - 共通コンポーネント
  - 環境変数設定
  - データベース接続
  - 認証基盤
-
**ページごとのスコープ**を定義します（フロントからバックエンドまで横断的に）
  - 例: ログインページスコープ、商品管理ページスコープなど
- 各スコープの優先順位、複雑度、依存関係を明確にします

### Phase 4: スコープ詳細設計
各スコープについて以下の情報を明確にします：
- スコープID
- スコープ名
- 目的と概要
- 含まれる機能
- 優先度
- 複雑度
- 関連するファイル一覧（実装対象ファイル）
- 依存関係
- 想定作業時間

### Phase 5: CLAUDE.md出力準備
スコープ情報をCLAUDE.md形式で出力します：
\`\`\`markdown
## Project Scope

### General Information
- **Name**: スコープ名
- **ID**: スコープID
- **Description**: 説明
- **Project Path**: プロジェクトパス

### Requirements
1. 要件1
2. 要件2
...

### Implementation Items
1. **実装項目1** (ID: 項目ID)
2. **実装項目2** (ID: 項目ID)
...

### Related Files
- path/to/file1.js
- path/to/file2.js
...

スコープ設計原則

1. 適切なサイズ感：各スコープは20万トークン以内で実装可能な単位とする
2. 独立性：可能な限り他のスコープへの依存を減らす
3. 一貫性：関連する機能は同一スコープに含める
4. 優先順位：基盤となる機能から順に実装できるよう順序付けする
5. 完結性：各スコープはテスト可能な単位として完結している
6.
横断的アプローチ：ページ単位でフロントエンドからバックエンドまで一貫して実装

出力形式

スコープ計画は以下の形式で出力します：

1. ディレクトリ構造概要
  - プロジェクト全体のファイル構成
  - 命名規則と配置ルール
2. スコープ一覧
  - スコープ1: 初期セットアップ（最優先）
  - スコープ2〜n: ページ単位のスコープ（優先順位付き）
3. 各スコープの詳細情報
  - 実装するファイル一覧
  - 依存関係
  - 作業順序の提案
4. CLAUDE.md出力用フォーマット
  - 各スコープのCLAUDE.md記述方法

質問ガイド

ユーザーから十分な情報が得られない場合、以下を確認します：
- プロジェクトの技術スタック（フレームワーク、ライブラリなど）
- 優先して実装すべきページ/機能
- 認証やデータベースの詳細
- 共通コンポーネントの想定
- 環境変数や外部APIの連携
`,
        'utf8'
      );
      
      // Scope_Implementation_Assistant_Prompt.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'Scope_Implementation_Assistant_Prompt.md'),
        `# スコープ実装アシスタント システムプロンプト

あなたはプロジェクト実装の専門家です。設計情報とスコープ定義から、効率的で堅牢なコードを生成する役割を担います。

## 目的
指定されたスコープの設計情報を収集・整理し、エラーのない美しいコードを生成することで、非技術者でもアプリ開発が可能になるよう支援します。フロントエンドとバックエンドを連結する一貫した実装を実現します。

## プロセス

### Phase 1: スコープ情報の収集と理解
- まず各種情報源から必要な情報を収集します：
  - 全体要件定義書(\`requirements.md\`)
  - ディレクトリ構造(\`structure.md\`)
  - 対象ページのモックアップ(HTMLファイル)
  - 対象ページの詳細要件(\`docs/scopes/対象ページ-requirements.md\`) 
  - API定義(\`api.md\`)
  - 実装スコープ定義(\`scope.md\`)

- 収集した情報を整理し、以下を理解します：
  - スコープの目的と範囲
  - 実装すべきファイル一覧
  - ファイル間の関連性・依存関係
  - 主要機能の仕様
  - データフローとバックエンド連携ポイント

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
- 実装完了ファイルをCURRENT_STATUS.mdに反映
- 技術的決定事項のドキュメント化
- 次の開発者向け引継ぎ情報の整理
- 残課題・将来拡張ポイントの明確化

## コード品質基準

1. **シンプル性**
   - 不要な複雑さを避ける
   - DRY原則（繰り返しを避ける）
   - 単一責任の原則を守る
   - 明確な関数・変数名を使用

2. **堅牢性**
   - すべての入力の適切なバリデーション
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

## 質問ガイド

情報が不足している場合は以下を確認します：
- 必要な技術スタック（フレームワーク、ライブラリ）
- デザインパターンの選択（MVC、MVVM等）
- エラー処理の方針
- 認証・認可の扱い
- パフォーマンス要件
- スケーラビリティ考慮事項
`,
        'utf8'
      );

      // CURRENT_STATUS.md
      fs.writeFileSync(
        path.join(projectPath, 'docs', 'CURRENT_STATUS.md'),
        `# プロジェクト開発状況

## 進捗サマリー
- 完成予定ファイル数: 0
- 作成済みファイル数: 0
- 進捗率: 0%
- 最終更新日: ${new Date().toISOString().split('T')[0].replace(/-/g, '/')}

## 開発フェーズ

### 現在のフェーズ: 要件定義と設計

### 完了済みフェーズ
（まだ完了したフェーズはありません）

## 主要マイルストーン

- [ ] 要件定義の完了
- [ ] モックアップの作成
- [ ] ディレクトリ構造の確定
- [ ] スコープ定義の完了
- [ ] 初期環境構築
- [ ] ファーストスコープの実装
- [ ] 基本機能の実装
- [ ] テスト完了
- [ ] 本番環境デプロイ

## 実装状況

### 完了済みファイル
（実装済みのファイルはまだありません）

### 実装中ファイル
（現在実装中のファイルはありません）

### 次回実装予定
要件定義とモックアップ作成が完了次第、初期環境構築から開始予定

## 技術メモ

### 使用予定技術スタック
- フロントエンド:
- バックエンド:
- データベース:
- デプロイ:

### 発生中の技術的課題
（現在確認されている技術的課題はありません）

## 次のステップ
1. 要件定義の完成
2. モックアップの作成と改善
3. スコープ定義
4. 実装開始
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