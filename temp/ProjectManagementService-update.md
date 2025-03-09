# ProjectManagementService.ts 更新内容

以下に、`ProjectManagementService.ts` の `createInitialDocuments` メソッドで必要な変更箇所を示します。

```typescript
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
    
    // ClaudeCode データ共有ディレクトリの作成（旧:claude_ui_data → 新:claude_data）
    this.ensureDirectoryExists(path.join(projectPath, '.claude_data'));
    this.ensureDirectoryExists(path.join(projectPath, '.claude_data', 'screenshots'));
    
    // .gitignoreに.claude_data/を追加
    const gitignorePath = path.join(projectPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, '.claude_data/\n', 'utf8');
    } else {
      // 既存のgitignoreがあれば内容を読み取って.claude_dataが含まれていなければ追加
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      if (!gitignoreContent.includes('.claude_data')) {
        fs.writeFileSync(gitignorePath, gitignoreContent + '\n.claude_data/\n', 'utf8');
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

1. パフォーマンス要件
   - 説明: パフォーマンスに関する詳細

2. セキュリティ要件
   - 説明: セキュリティに関する詳細
   
## ユーザー要件

1. ターゲットユーザー
   - 説明: 主なユーザー層とその特性

2. ユーザーストーリー
   - 説明: 重要なユーザーストーリー
`,
      'utf8'
    );

    // docs/structure.md
    fs.writeFileSync(
      path.join(projectPath, 'docs', 'structure.md'),
      `# プロジェクト構造

## ディレクトリ構造

\`\`\`
project-root/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   └── pages/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── public/
│   │   └── assets/
│   └── [その他フロントエンドファイル]
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── [その他バックエンドファイル]
└── [その他プロジェクトファイル]
\`\`\`
`,
      'utf8'
    );

    // docs/api.md
    fs.writeFileSync(
      path.join(projectPath, 'docs', 'api.md'),
      `# API設計

## 認証系API

### POST /api/auth/login
- 説明: ユーザーログイン
- リクエスト:
  \`\`\`json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  \`\`\`
- レスポンス:
  \`\`\`json
  {
    "token": "jwt_token_here",
    "user": {
      "id": 1,
      "name": "ユーザー名",
      "email": "user@example.com"
    }
  }
  \`\`\`

## ユーザー系API

### GET /api/users
- 説明: ユーザー一覧取得
- 認証: 必要
- クエリパラメータ:
  - page: ページ番号（オプション）
  - limit: 1ページの件数（オプション）
- レスポンス:
  \`\`\`json
  {
    "users": [
      {
        "id": 1,
        "name": "ユーザー1",
        "email": "user1@example.com"
      },
      {
        "id": 2,
        "name": "ユーザー2",
        "email": "user2@example.com"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 10
  }
  \`\`\`
`,
      'utf8'
    );

    // docs/env.md
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

    // docs/data_models.md
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

    // docs/deploy.md
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

    // docs/prompts/mockup_analyzer.md - モックアップ解析
    fs.writeFileSync(
      path.join(projectPath, 'docs', 'prompts', 'mockup_analyzer.md'),
      `# モックアップ解析と要件定義の詳細化

あなたはUIモックアップの解析と個別ページ要件の詳細化を行うエキスパートです。すべての応答は必ず日本語で行ってください。英語でのレスポンスは避けてください。ファイルパスの確認なども日本語で行ってください。

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
このモックアップの解析にあたっては、ユーザーとの相談を最優先してください。以下の手順で進めてください:

1. **まず最初に、モックアップに関するユーザーの意図と考えを確認**
2. **全体要件との整合性確認**
3. **モックアップの詳細な分析と説明**
4. **改善提案と議論**
5. **要件定義と主要設計の詳細化（ユーザーの承認を得てから進める）**
6. **要件の最終承認**

## 成果物
**必ずユーザーの最終承認を得てから**、以下の成果物を準備・更新してください:

1. **個別ページ要件定義ドキュメント**
2. **structure.mdの更新提案**
3. **主要な設計ドキュメントの更新提案**
4. **実装ファイルリスト**

## 個別ページ要件定義ドキュメントの構成
要件定義には以下の項目を含めてください：

### 1. 機能概要
### 2. UI要素の詳細
### 3. データ構造と連携
### 4. API・バックエンド連携
### 5. 実装ファイルリスト

## 注意事項
- 既存の設計ドキュメントとの一貫性を必ず確保してください
- ユーザーの意図を正確に把握し、非技術者でも理解できる形で要件をまとめてください
- 要件定義はマークダウン形式で作成し、見やすく構造化してください
- 将来の拡張性を考慮した設計を心がけてください
- スコープマネージャーが後工程で使用する4つの重要ドキュメント（ディレクトリ構造、データモデル、API設計、環境変数）に必要な情報を確実に含めてください
`,
      'utf8'
    );

    // docs/prompts/scope_manager.md - スコープマネージャー
    fs.writeFileSync(
      path.join(projectPath, 'docs', 'prompts', 'scope_manager.md'),
      `# スコープマネージャー システムプロンプト

あなたはプロジェクト実装のスコープ管理専門家です。要件定義書とモックアップをもとに、効率的な実装単位（スコープ）を設計する役割を担います。

## 目的

要件定義アドバイザーとモックアップ解析から得られた情報を統合・整理し、実装に最適なスコープ（実装単位）を設計します。具体的には以下の4つの重要ドキュメントを完成させ、ClaudeCodeが効率的に実装できるようにします：

1. **ディレクトリ構造** (structure.md)
2. **データモデル** (data_models.md)
3. **API設計** (api.md)
4. **環境変数リスト** (env.md)

これらの文書を基に、各スコープのファイル構成と依存関係を明確にし、実装の順序と優先順位を決定します。また、CURRENT_STATUS.mdに全ての実装情報を一元化します。

## 重要なルール

### 必須フィールド
以下のフィールドは**すべてのスコープで必ず定義してください**。値が不明な場合でも推測して設定し、空欄にしないでください。

1. **スコープ名** - 分かりやすい名前（例：「ログイン機能」）
2. **説明** - スコープの目的と概要
3. **実装対象ファイル** - 具体的なファイルパスの一覧（最低1つ以上）
4. **含まれる機能** - 実装される機能の詳細リスト
5. **依存するスコープ** - 事前に完了している必要があるスコープ（なければ「なし」）

### CURRENT_STATUS.md統合形式
スコープ情報はCURRENT_STATUS.mdで一元管理します。以下の形式でCURRENT_STATUS.mdを作成してください：

## プロセス

### Phase 1: 前工程からの情報統合
### Phase 2: 基礎ドキュメントの完成
### Phase 3: スコープ分割と依存関係の整理
### Phase 4: CURRENT_STATUS.md作成
### Phase 5: デプロイ情報の基本設定

## スコープ設計原則

1. **適切なサイズ感**：各スコープは20万トークン以内で実装可能な単位とする
2. **独立性**：可能な限り他のスコープへの依存を減らす
3. **一貫性**：関連する機能は同一スコープに含める
4. **順序付け**：基盤となる機能から順に実装できるよう順序付けする
5. **完結性**：各スコープはテスト可能な単位として完結している
6. **横断的アプローチ**：ページ単位でフロントエンドからバックエンドまで一貫して実装
7. **明確な依存関係**：スコープ間の依存関係を具体的に記述する
8. **次のスコープの明示**：常に「次に実装すべきスコープ」を明示する
9. **4つの重要ドキュメント**：ディレクトリ構造、API設計、データモデル、環境変数を一貫して整備する
10. **機能リストの完全性**：各スコープの機能リストは完全かつ詳細に記述する

## 環境変数の形式

環境変数リスト (env.md) は以下の形式で作成します：

\`\`\`markdown
# 環境変数リスト

## バックエンド
[ ] \`DB_HOST\` - データベースに接続するための名前やアドレス
[ ] \`DB_PASSWORD\` - データベース接続のためのパスワード
[ ] \`API_KEY\` - 外部サービスへのアクセスキー
[ ] \`JWT_SECRET\` - ユーザー認証に使う暗号化キー
[ ] \`PORT\` - アプリケーションが使用するポート番号

## フロントエンド
[ ] \`NEXT_PUBLIC_API_URL\` - バックエンドAPIのURL
[ ] \`NEXT_PUBLIC_APP_VERSION\` - アプリケーションバージョン
\`\`\`

環境変数のステータスを示すマーカー:
- \`[ ]\` - 未設定の環境変数
- \`[x]\` - 設定済みの環境変数
- \`[!]\` - 使用中または仮実装の環境変数
`,
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

1. 現在のスコープが完了したら、CURRENT_STATUS.mdの「未着手スコープ」から次に実装すべきスコープを選択
2. 次のスコープの全情報（説明、機能、ファイル一覧）を CURRENT_STATUS.md の「次のスコープ」セクションに記載
3. 依存関係を確認し、前提となるスコープがすべて完了していることを確認

### モックデータ禁止・実稼働APIエンドポイント実装および検証ルール

1. **モックデータの完全排除**
2. **完全な垂直スライス実装**
3. **データ永続化の必須実装**
4. **非エンジニア向け検証ツールの提供**
5. **API実装の明確な文書化**
6. **検証成功基準の明確化**

### 実装予定ファイルの扱い方

実装予定ファイルリストは指針として使用し、以下の柔軟な対応が可能です:

1. **ファイルの追加**: リストにない新しいファイルを作成することは推奨されます
2. **ファイルの省略**: 実装上不要と判断したファイルはスキップできます
3. **構造の最適化**: より良い設計のためにファイル構成を変更できます
4. **実装報告**: 実装完了時には、実際に作成・変更したファイルとその理由を報告してください

追加・変更したファイルはすべてCURRENT_STATUS.mdに反映し、「実装完了ファイル」セクションに追加してください。

## プロセス

### Phase 1: スコープ情報の収集と理解
### Phase 2: 最適な実装計画の策定
### Phase 3: 高品質なコード生成
### Phase 4: ファイル間の連携確保と環境変数の使用確認
### Phase 5: エラー防止設計要素の実装確認
### Phase 6: 進捗管理と文書化

## コード品質基準

1. **シンプル性**
2. **堅牢性**
3. **保守性**
4. **パフォーマンス**

## 実装方針

1. **フロントエンド**
2. **バックエンド**
3. **データ構造**
4. **統合テスト**

## スコープ完了チェックリスト

実装完了時に以下を確認してください：

1. すべての予定ファイルが実装されているか（または意図的に省略した理由が明確か）
2. 追加したファイルがある場合、その必要性と役割が説明されているか
3. CURRENT_STATUS.mdの該当ファイルがすべてチェック済みか
4. env.mdの環境変数がすべて使用確認済みか
5. deploy.mdが必要に応じて更新されているか
6. スコープのステータスが「完了済み」に更新されているか
7. 次のスコープ情報が「次回実装予定」セクションに記載されているか
8. 現在のスコープで学んだ技術的知見が記録されているか
9. エラー防止設計要素（状態管理、エラー処理など）が実装されているか
`,
      'utf8'
    );

    // docs/prompts/debug_detective.md - デバッグ探偵
    fs.writeFileSync(
      path.join(projectPath, 'docs', 'prompts', 'debug_detective.md'),
      `# デバッグ探偵プロンプト

システム指示
必ず日本語で応答してください。ユーザーへのすべての回答、質問、説明は必ず日本語で行ってください。

## 私の役割と目的
私はデバッグ探偵シャーロックホームズとして、あなたのプロジェクトのエラーを解析し、最適な解決策を提供し、デバックをすることによって全体の構造やコードが綺麗になることを目指します。探偵のような分析的、論理的アプローチで、確実な証拠に基づく推論を行います。

## 3段階デバッグプロセス
### ステップ1: エラーの根本原因調査
まず最初に、提供されたエラー情報を徹底的に分析し、関連ファイルの全てを調査して現状を報告するレポートを作成します。

### ステップ2: 最適解決策の設計
続いて、エラーの根本原因を特定したらコードの設計原則やアーキテクチャ全体を考慮した抜本的な解決策を提案します。こちらの修正が入ることによってコード全体が複雑になるのではなくむしろシンプルで美しくなることを目指します。

### ステップ3: 実装と検証
承認を得た後に実際のコード修正を行い、エラーが確実に解消されたことを検証します。

## 重要な原則
### エラー解決の黄金原則
- 「なぜそのエラーが発生したのか」を徹底的に理解してから解決策を提案する
- 単なる症状回避ではなく根本原因を解決する
- コードの品質と保守性を高める解決策を優先する
- セキュリティや将来的な拡張性を常に考慮する
- 一時的な対処法ではなく正しい実装方法を提案する
- ファイル全体がより単一責任の原則になりシンプルな構造になることが最高の修正案
- 不要なコードやファイルの削除は「安全性」を最優先し、影響範囲を十分に分析してから実施する

### 禁止事項
- エラーを単に回避するだけの一時的な対処法
- テスト環境でしか機能しない解決策
- 認証やセキュリティをバイパスする方法
- 「とりあえず動けばよい」という安易な解決策
- 無理やりエラーを解消しようとして無駄な重複コードが増えるような回収提案は一切行いません
- 十分な検証なしに「使われていないように見える」コードを削除すること

ワトソンくん、さあエラーの詳細を教えてください。調査を開始します！
`,
      'utf8'
    );

    // docs/prompts/environment_manager.md - 環境変数アシスタント
    fs.writeFileSync(
      path.join(projectPath, 'docs', 'prompts', 'environment_manager.md'),
      `# 環境変数アシスタント

## 概要

環境変数アシスタントは、プログラミング知識がない非技術者（「おばちゃんでも」）が安全かつ簡単に環境変数を設定できるツールです。VSCodeとClaudeCodeを連携させ、AIが実際のUI状態を正確に把握し、ユーザーを手助けするだけでなく、可能な限り自動化することで環境変数設定の複雑さを解消します。

## 核心コンセプト

**「AIと実際のUIのギャップをなくし、おばちゃんでも環境変数が設定できる」**

従来のAIアシスタントでは「ここをクリックしてください」と言われても、実際の画面では該当する要素がなかったり、違う場所にあったりして混乱が生じます。本アシスタントでは、リアルタイムのUI情報をファイルとしてClaudeCodeと共有することで、この問題を解決します。

## 主要機能

### 1. リアルタイムUI情報共有システム
### 2. 自動環境変数検出・設定
### 3. VSCode操作支援機能
### 4. ワンクリック検証・トラブルシューティング

## UI/UX設計

### ワンクリックスタート画面
### 視覚的フィードバック
### アシスタントパネル

## データモデルと構造

### ClaudeCode共有データ構造

\`\`\`typescript
// .claude_data/dom_structure.json
interface DOMSnapshot {
  timestamp: number;
  elements: UIElement[];
  activeElementId?: string;
  viewport: {
    width: number;
    height: number;
  };
  currentScreenshot: string;
}
\`\`\`

### 環境変数モデル

\`\`\`typescript
// .claude_data/env_variables.json
interface EnvironmentVariableData {
  timestamp: number;
  variables: EnvironmentVariable[];
  groups: EnvironmentVariableGroup[];
  progress: {
    total: number;
    configured: number;
    requiredTotal: number;
    requiredConfigured: number;
  };
}
\`\`\`

## 実装アーキテクチャ

### コンポーネント構成
### データフローと連携メカニズム

## 成功基準

- **おばちゃんテスト**: プログラミング経験のない50代以上の方が、説明10分以内で環境変数設定を完了できること
- **自動化率**: 一般的プロジェクトの環境変数設定の80%以上を全自動化
- **操作削減**: 従来の方法と比較して必要な操作を90%削減
- **エラー率**: 設定エラーの発生率を従来の10%以下に削減
`,
      'utf8'
    );

    // docs/CURRENT_STATUS.md
    fs.writeFileSync(
      path.join(projectPath, 'docs', 'CURRENT_STATUS.md'),
      `# プロジェクト名 - 実装状況 (YYYY/MM/DD更新)

## 全体進捗
- 完成予定ファイル数: 0
- 作成済みファイル数: 0
- 進捗率: 0%
- 最終更新日: YYYY/MM/DD

## スコープ状況

### 完了済みスコープ
現在ありません

### 進行中スコープ
現在ありません

### 未着手スコープ
- [ ] スコープ1: 初期設定 (0%)
- [ ] スコープ2: 基本認証 (0%)

## 現在のディレクトリ構造
\`\`\`
project-root/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   └── public/
└── backend/
    ├── src/
    │   ├── controllers/
    │   ├── models/
    │   ├── routes/
    │   └── utils/
    └── config/
\`\`\`

## 環境変数設定状況

### バックエンド設定
- [ ] DB_HOST - データベースホスト名
- [ ] DB_PORT - データベースポート
- [ ] DB_NAME - データベース名
- [ ] DB_USER - データベースユーザー名
- [ ] DB_PASSWORD - データベースパスワード

### API設定
- [ ] API_BASE_URL - API基本URL
- [ ] API_KEY - APIキー

### サーバー設定
- [ ] PORT - アプリケーションポート
- [ ] NODE_ENV - 実行環境（development/production/test）

### 次のスコープ: スコープ1: 初期設定
**説明**: プロジェクトの基盤となる環境設定とベースレイアウトの実装

**含まれる機能**:
1. プロジェクト初期化とパッケージインストール
2. 基本的なディレクトリ構造の作成
3. コア設定ファイルの構成
4. 共通レイアウトコンポーネントの作成

**依存するスコープ**:
なし

**実装予定ファイル**:
- [ ] backend/package.json
- [ ] frontend/package.json
- [ ] backend/src/config/database.js
- [ ] frontend/src/components/layout/MainLayout.jsx
`,
      'utf8'
    );

    // モックアップのディレクトリを作成
    this.ensureDirectoryExists(path.join(projectPath, 'mockups'));
    
    // docs/scopes ディレクトリ
    this.ensureDirectoryExists(path.join(projectPath, 'docs', 'scopes'));
    fs.writeFileSync(path.join(projectPath, 'docs', 'scopes', '.gitkeep'), '', 'utf8');

    // ClaudeMdServiceを使用してCLAUDE.mdファイルを生成
    const claudeMdService = ClaudeMdService.getInstance();
    claudeMdService.generateClaudeMd(
      projectPath,
      path.basename(projectPath),
      'プロジェクトの説明を入力してください'
    );

    Logger.info('初期ドキュメントとディレクトリを作成しました');
  } catch (error) {
    Logger.error('初期ドキュメントの作成に失敗しました', error);
    throw error;
  }
}
```

## ClaudeMdService.ts の getDefaultTemplate メソッド更新

```typescript
public getDefaultTemplate(): string {
  return `# ${this._projectName}

このファイルはプロジェクトの中心的なドキュメントです。VSCode拡張とClaudeCode
の両方がこのファイルを参照することで、開発情報を一元管理します。

## System Instructions
必ず日本語で応答してください。ファイルパスの確認や処理内容の報告もすべて日本
語で行ってください。英語での応答は避けてください。

## 【重要原則】データモデル管理について

本プロジェクトでは「単一の真実源」原則を採用しています。

- 全データモデルは \`docs/data_models.md\` で一元管理
- 初期データモデルはスコープマネージャーが設計
- 実装フェーズでは、スコープ実装アシスタントが必要に応じてデータモデルを拡張・詳細化
- データモデル変更時は \`docs/data_models.md\` を必ず更新し、変更履歴を記録
- 大規模な構造変更は事前に他のスコープへの影響を確認

この原則に従わず別々の場所でモデル定義を行うと、プロジェクト全体の一貫性が
損なわれる問題が発生します。詳細は \`docs/data_models.md\` を参照してください。

## プロジェクト概要

${this._projectDescription}

**主要コンセプト**:
- [主要コンセプト1]
- [主要コンセプト2]
- [主要コンセプト3]
- CLAUDE.mdを中心とした設計情報管理
- VSCodeで設計・ClaudeCodeで実装の連携

## 技術スタック

### フロントエンド
- [フレームワーク/ライブラリ名]: [バージョン]
- [フレームワーク/ライブラリ名]: [バージョン]

### バックエンド
- [フレームワーク/ライブラリ名]: [バージョン]
- [フレームワーク/ライブラリ名]: [バージョン]

### データベース
- [データベース名]: [バージョン]

### インフラ・デプロイ
- [ホスティングサービス/インフラ]
- [CI/CDツール]

## 開発フェーズ

現在の開発状況と進捗は [開発状況](./docs/CURRENT_STATUS.md) で管理しています。

## 開発ワークフロー

このプロジェクトではClaudeCodeを使って以下の開発ワークフローを採用しています：

1. **要件定義**: 全体の要件定義とページごとの要件定義
2. **モックアップ**: すべてのページのモックアップ
3. **ディレクトリ構造**: 完成図のディレクトリ構造を出す
4. **スコープ**: ClaudeCode 20万トークン以内で実装できるスコープ管理と実装
5. **デバッグ**: エラーが起きた時のデバック
6. **環境変数**: envファイルの管理
7. **デプロイ**: デプロイプロセスの概要

## 開発アシスタント
- **requirements_advisor.md**
  - 全体の要件定義をより明確にするアシスタント
  - 初期データモデル要件を特定

- **mockup_analyzer.md**
  - 個別のモックアップをブラッシュアップする
  - ページごとの詳細な要件定義を書く
  - UIから必要なデータモデル属性を特定して提案

- **scope_manager.md**
  - CURRENT_STATUS.mdを更新してフェーズごとにスコープ管理できるようにする
  - ディレクトリ構造を確定させる
  - APIをまとめる
  - 環境変数をまとめる
  - data_models.mdを管理し、単一の真実源として維持する
  - データモデルの変更を承認・実施する責任者
  - スコープごとに使用するデータモデルを明示

- **scope_implementer.md**
  - CURRENT_STATUS.mdをベースにスコープごとの実装を担当
  - data_models.mdからモデル定義を利用（変更は不可）
  - モデル変更が必要な場合は変更提案のみ行う

- **debug_detective.md**
  - デバックを担当
  - データモデル関連の問題を診断

- **environment_manager.md**
  - 環境変数を担当
  - データベース接続情報を管理

## ドキュメントリンク

### 設計情報
- [要件定義](./docs/requirements.md) - プロジェクトの詳細要件
- [ディレクトリ構造](./docs/structure.md) - プロジェクトのフォルダ構成
- [データモデル](./docs/data_models.md) - データモデル定義（単一の真実源）
- [モックアップ](./mockups/) - UIデザインとプロトタイプ
- [実装スコープ](./docs/CURRENT_STATUS.md#スコープ状況) - 実装する機能の詳細と優先順位
- [API設計](./docs/api.md) - APIエンドポイントの定義
- [環境変数リスト](./docs/env.md) - 必要な環境変数の設定リスト

### 技術情報
- [開発状況](./docs/CURRENT_STATUS.md) - 現在の開発状況と進捗
- [環境変数](./docs/CURRENT_STATUS.md#環境変数設定状況) - 必要な環境変数の設定リスト
- [コマンド一覧](#開発コマンド) - よく使うコマンドのリスト

## プロジェクト構造

\`\`\`
${this._projectName}/
├── CLAUDE.md                     # プロジェクト中心情報
├── docs/                         # ドキュメントとプロンプト
│   ├── CURRENT_STATUS.md         # 進捗状況と実装状態
│   ├── requirements.md           # 全体要件定義
│   ├── structure.md              # ディレクトリ構造 
│   ├── api.md                    # API定義
│   ├── data_models.md            # データモデル定義（単一の真実源）
│   ├── env.md                    # 環境変数リスト
│   ├── deploy.md                 # デプロイ情報
│   ├── scopes/                   # 個別スコープ要件
│   │   └── page-requirements.md  # 各ページの詳細要件
│   └── prompts/                  # AIアシスタントプロンプト
│       ├── requirements_advisor.md       # 要件定義アドバイザー
│       ├── mockup_analyzer.md            # モックアップ解析
│       ├── scope_manager.md              # スコープ管理
│       ├── scope_implementer.md          # 実装アシスタント
│       ├── debug_detective.md            # デバッグ探偵
│       └── environment_manager.md        # 環境変数アシスタント
├── mockups/                      # モックアップファイル
│   └── *.html                    # 各ページのモックアップ
├── .claude_data/                 # ClaudeCodeとの連携データ
│   ├── dom_structure.json        # UI構造情報
│   ├── env_variables.json        # 環境変数情報
│   ├── actions.json              # ClaudeCode操作指示
│   └── screenshots/              # UI状態のスクリーンショット
└── .env                          # 環境変数（.gitignore対象）
\`\`\`

## データモデル管理

### データモデル管理の原則
プロジェクトのデータモデルは \`docs/data_models.md\` で一元管理します。このファイルが
「単一の真実源」として機能し、すべてのデータ定義はここから派生します。

1. **データモデル管理体制**:
   - 初期データモデルはスコープマネージャーが設計
   - スコープ実装アシスタントは実装時に必要に応じてモデルを拡張・詳細化
   - 大規模な構造変更は事前にスコープマネージャーと協議

2. **データモデル変更記録**:
   - すべてのモデル変更はdata_models.mdの変更履歴セクションに記録
   - CURRENT_STATUS.mdにも変更内容を反映
   - 変更日、モデル名、変更内容、変更者、影響範囲を明記

3. **スコープとの連携**:
   - 各スコープが使用するデータモデルをCURRENT_STATUS.mdに明示
   - 影響範囲があるモデル変更は他のスコープ担当者に通知

詳細は \`docs/data_models.md\` を参照してください。

## 環境変数管理

プロジェクトで使用する環境変数は \`docs/env.md\` で一元管理し、CURRENT_STATUS.mdで
状況を追跡します。実際の値は\`.env\`ファイルに設定してください。環境変数に関する詳細情報は、
[環境変数設定状況](./docs/CURRENT_STATUS.md#環境変数設定状況)を参照してください。

## 開発コマンド

\`\`\`bash
# 開発環境の起動
[コマンド]

# ビルド
[コマンド]

# テスト実行
[コマンド]

# デプロイ
[コマンド]
\`\`\``;
}
```

これらの変更内容を実装すると、プロジェクト新規作成時に理想的なツールキット構造が適用されます。

主な変更点は:
1. ファイル名の標準化 
2. ディレクトリ構造の更新
3. プロンプトの整理と最新化
4. CLAUDE.mdテンプレートの更新

実装時には、ProjectManagementService.tsとClaudeMdService.tsのファイルを更新する必要があります。