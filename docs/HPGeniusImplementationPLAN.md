# HPGenius実装計画書

**作成日**: 2025-01-23  
**バージョン**: 1.0.0  
**ステータス**: 実装準備中  

## 1. 概要

本書は、AppGeniusのコードベースを基にHPGeniusを実装するための具体的な手順を記載しています。LPGeniusと同様にAppGeniusの堅牢な基盤を活用しつつ、企業サイト制作に特化したシステムへと変換していきます。

## 2. 実装の基本方針

- **段階的実装**: まずMVPとして基本的な企業サイト制作機能を実装
- **既存資産の活用**: AppGeniusの拡張機能基盤を最大限に活用
- **CMS統合重視**: LP制作と異なり、継続的な更新を前提とした設計
- **品質保証強化**: 企業の信頼性に関わるため、品質検証を重視

## 3. 実装ステップ

### Step 1: プロジェクトのコピーと初期設定（30分）

```bash
# 1. AppGeniusプロジェクトをコピー
cp -r /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius /Users/tatsuya/Desktop/システム開発/HPGenius

# 2. 新しいプロジェクトディレクトリに移動
cd /Users/tatsuya/Desktop/システム開発/HPGenius

# 3. Gitリポジトリの初期化（新規プロジェクトとして）
rm -rf .git
git init
git add .
git commit -m "初期コミット: AppGeniusベースのHPGeniusプロジェクト開始"
```

### Step 2: 不要ファイルの削除とクリーンアップ（30分）

#### 削除対象ディレクトリ・ファイル：
```bash
# Portal関連は削除しない（共通のPortalを使用するため）

# 複雑な認証関連（基本認証のみ残す）
rm -rf src/core/auth/PermissionManager.ts
rm src/ui/auth/AuthGuard.ts

# AppGenius固有のサービス
rm src/services/AppGeniusEventBus.ts
rm src/services/ProjectManagementService.ts
rm src/services/ClaudeCodeLauncherService.ts  # LP用なので削除

# 不要なドキュメント
rm docs/requirements.md  # AppGeniusの要件定義書
rm docs/lpgenius_requirements.md  # LPGeniusの要件定義書
```

#### Portal連携の設定：
```typescript
// src/config/promptUrls.ts を作成
export const HP_GENIUS_PROMPTS = {
  brandStrategist: 'https://portal.appgenius.com/api/prompts/public/[ID1]',
  sitemapArchitect: 'https://portal.appgenius.com/api/prompts/public/[ID2]',
  contentStrategist: 'https://portal.appgenius.com/api/prompts/public/[ID3]',
  designSystemCreator: 'https://portal.appgenius.com/api/prompts/public/[ID4]',
  uxDesigner: 'https://portal.appgenius.com/api/prompts/public/[ID5]',
  frontendImplementer: 'https://portal.appgenius.com/api/prompts/public/[ID6]',
  performanceOptimizer: 'https://portal.appgenius.com/api/prompts/public/[ID7]',
  seoSpecialist: 'https://portal.appgenius.com/api/prompts/public/[ID8]',
  cmsIntegrationEngineer: 'https://portal.appgenius.com/api/prompts/public/[ID9]',
  qualityAssuranceManager: 'https://portal.appgenius.com/api/prompts/public/[ID10]'
};
```

#### 保持・拡張するファイル：
- `src/extension.ts` - VSCode拡張の基盤
- `src/utils/` - ユーティリティ関数群
- `src/ui/scopeManager/` - UI基盤として活用
- `media/` - アセットとUIコンポーネント

### Step 3: HPGenius用の基本構造作成（1.5時間）

```bash
# 新しいディレクトリ構造を作成
mkdir -p docs/prompts/hpgenius
mkdir -p src/agents
mkdir -p src/templates/website
mkdir -p src/cms
mkdir -p mockups/templates
mkdir -p mockups/components
mkdir -p dist/
mkdir -p assets/templates
```

#### 作成するファイル：

1. **CLAUDE.md**の更新
```markdown
# HPGenius

## System Instructions
このプロジェクトでは、セッション開始時に必ず最初の会話で指定されているファイルを読み込んでください。
常に日本語で対応してください。

## プロジェクト概要
HPGeniusは、自然言語でプロフェッショナルな企業サイト・ホームページを作成できるWeb制作支援システムです。
```

2. **新しいSCOPE_PROGRESS.md**
```markdown
# HPGenius 開発進捗状況

## 1. 基本情報
- **ステータス**: 開始段階
- **完了タスク数**: 0/10
- **進捗率**: 0%
- **次のマイルストーン**: エージェントプロンプト作成完了

## 2. 実装計画

| フェーズ | 状態 | 担当エージェント | 解説 |
|---------|------|----------------|------|
| **1. ブランド戦略** | [ ] | ★1 ブランド戦略アナリスト | 企業理念とブランド価値を明確化 |
| **2. サイトマップ設計** | [ ] | ★2 サイトマップアーキテクト | 情報構造を設計 |
| **3. コンテンツ企画** | [ ] | ★3 コンテンツストラテジスト | 各ページの内容を企画 |
| **4. デザインシステム** | [ ] | ★4 デザインシステムクリエイター | 統一されたデザインを構築 |
| **5. UX設計** | [ ] | ★5 UXデザイナー | 使いやすいインターフェースを設計 |
| **6. フロントエンド実装** | [ ] | ★6 フロントエンド実装者 | HTML/CSS/JSを実装 |
| **7. パフォーマンス最適化** | [ ] | ★7 パフォーマンスオプティマイザー | 表示速度を最適化 |
| **8. SEO対策** | [ ] | ★8 SEOスペシャリスト | 検索エンジン最適化 |
| **9. CMS統合** | [ ] | ★9 CMS統合エンジニア | 更新システムを実装 |
| **10. 品質保証** | [ ] | ★10 品質保証マネージャー | 全体の品質を検証 |
```

### Step 4: Portal へのプロンプト登録とURL取得（1.5時間）

既存のAppGenius Portalに新しいプロンプトを登録：

1. **Portal管理画面にアクセス**
   - AppGeniusのPortal管理画面にログイン
   - プロンプト管理セクションへ移動

2. **HPGenius用プロンプトの登録**
   ```
   以下の10個のプロンプトを登録：
   - ★1 ブランド戦略アナリスト
   - ★2 サイトマップアーキテクト
   - ★3 コンテンツストラテジスト
   - ★4 デザインシステムクリエイター
   - ★5 UXデザイナー
   - ★6 フロントエンド実装者
   - ★7 パフォーマンスオプティマイザー
   - ★8 SEOスペシャリスト
   - ★9 CMS統合エンジニア
   - ★10 品質保証マネージャー
   ```

3. **発行されたURLを記録**
   各プロンプトの公開URLを`src/config/promptUrls.ts`に記録

4. **タグ付けとカテゴリ設定**
   - タグ: "HPGenius", "企業サイト", "ホームページ"
   - カテゴリ: "Web制作"

### Step 5: VSCode拡張機能の改修（3.5時間）

#### 5.1 extension.tsの修正

```typescript
// src/extension.ts の変更点

// 1. 拡張機能名の変更
const EXTENSION_NAME = 'HPGenius';
const EXTENSION_ID = 'hpgenius';

// 2. コマンドの変更（10個のエージェント用）
context.subscriptions.push(
    vscode.commands.registerCommand('hpgenius.startProject', startWebsiteProject),
    vscode.commands.registerCommand('hpgenius.openBrandStrategist', openBrandStrategist),
    vscode.commands.registerCommand('hpgenius.openSitemapArchitect', openSitemapArchitect),
    vscode.commands.registerCommand('hpgenius.openContentStrategist', openContentStrategist),
    // ... 他の7つのエージェントコマンド
);

// 3. プロジェクトテンプレートの変更
async function createProjectStructure(projectPath: string) {
    // HPGenius用のディレクトリ構造を作成
    const dirs = [
        'docs',
        'mockups',
        'mockups/pages',
        'mockups/components',
        'dist',
        'dist/css',
        'dist/js',
        'dist/images',
        'assets/images',
        'assets/fonts',
        'content',
        'content/pages',
        'content/blog',
    ];
    // ... ディレクトリ作成処理
}
```

#### 5.2 package.jsonの更新

```json
{
    "name": "hpgenius",
    "displayName": "HPGenius - AI Website Builder",
    "description": "自然言語でプロフェッショナルな企業サイトを作成",
    "version": "1.0.0",
    "engines": {
        "vscode": "^1.74.0"
    },
    "categories": ["Other"],
    "activationEvents": [
        "onCommand:hpgenius.startProject"
    ],
    "main": "./dist/extension.js",
    "contributes": {
        "commands": [
            {
                "command": "hpgenius.startProject",
                "title": "HPGenius: 新規企業サイトプロジェクトを開始"
            },
            {
                "command": "hpgenius.openCMS",
                "title": "HPGenius: CMS管理画面を開く"
            }
        ]
    }
}
```

### Step 6: UI/UXの改修（2.5時間）

#### 6.1 WebsiteManagerPanelの実装

```typescript
// src/ui/websiteManager/WebsiteManagerPanel.ts
export class WebsiteManagerPanel {
    // AppGeniusのScopeManagerPanelをベースに改修
    
    private getHtmlContent(): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>HPGenius Manager</title>
                <!-- スタイルシート -->
            </head>
            <body>
                <div class="container">
                    <h1>HPGenius - 企業サイト制作管理</h1>
                    <div class="agent-cards">
                        <!-- 10個のエージェントカード -->
                    </div>
                    <div class="progress-tracker">
                        <!-- 進捗表示 -->
                    </div>
                    <div class="page-list">
                        <!-- 作成済みページ一覧 -->
                    </div>
                </div>
            </body>
            </html>
        `;
    }
}
```

#### 6.2 プロンプトカードの設定

```javascript
// media/components/promptCards/hpPromptCards.js
const hpAgents = [
    {
        id: 'brand-strategist',
        title: '★1 ブランド戦略アナリスト',
        description: '企業理念とブランド価値を明確化',
        icon: '🎨',
        promptFile: '★1brand_strategist.md'
    },
    {
        id: 'sitemap-architect',
        title: '★2 サイトマップアーキテクト',
        description: '情報構造とナビゲーションを設計',
        icon: '🗺️',
        promptFile: '★2sitemap_architect.md'
    },
    // ... 他の8つのエージェント
];
```

### Step 7: エージェント実行システムの実装（2.5時間）

Portal連携によるエージェント実行システム：

```typescript
// src/agents/HPAgentRunner.ts
import { HP_GENIUS_PROMPTS } from '../config/promptUrls';

export class HPAgentRunner {
    private currentAgent: string;
    private projectPath: string;
    
    async runAgent(agentId: string): Promise<void> {
        // 1. PortalのURLからプロンプトを取得
        const promptUrl = HP_GENIUS_PROMPTS[agentId];
        const promptContent = await this.fetchPromptFromPortal(promptUrl);
        
        // 2. プロジェクト固有の情報を付加
        const enrichedPrompt = this.enrichPromptWithContext(promptContent, {
            projectPath: this.projectPath,
            projectType: 'enterprise-website',
            pageCount: await this.getPageCount()
        });
        
        // 3. 一時ファイルにプロンプトを書き込み
        const tempFile = await this.createTempFile(enrichedPrompt);
        
        // 4. ClaudeCodeを起動
        await vscode.commands.executeCommand('claude-code.openWithFile', tempFile);
        
        // 5. 進捗を更新
        await this.updateProgress(agentId);
    }
    
    private async fetchPromptFromPortal(url: string): Promise<string> {
        // Portal APIからプロンプトを取得
        const response = await fetch(url);
        const data = await response.json();
        return data.content;
    }
}
```

### Step 8: CMS統合とページ管理システムの実装（3.5時間）

複数ページとCMS連携を管理するシステムの実装：

```typescript
// src/services/PageManagementService.ts
export class PageManagementService {
    private pages: Map<string, PageInfo> = new Map();
    
    async createPage(pageInfo: PageInfo): Promise<void> {
        // ページ情報の保存
        this.pages.set(pageInfo.id, pageInfo);
        
        // HTMLファイルの生成
        await this.generatePageHTML(pageInfo);
        
        // サイトマップの更新
        await this.updateSitemap();
    }
    
    async getPageHierarchy(): Promise<PageHierarchy> {
        // ページの階層構造を返す
        return this.buildHierarchy(this.pages);
    }
}

// src/cms/CMSIntegrationService.ts
export class CMSIntegrationService {
    private cmsType: 'wordpress' | 'contentful' | 'custom';
    
    async setupCMS(projectPath: string, cmsType: string): Promise<void> {
        // CMS連携の基本設定
        // 詳細な実装はCMS統合エンジニアエージェントが担当
        await this.createCMSConfig(projectPath, cmsType);
    }
}
```

### Step 9: デバッグとテスト（2.5時間）

1. **基本動作確認**
   - VSCode拡張機能として正しく起動するか
   - 10個のエージェントコマンドが動作するか
   - CMS統合機能が正しく動作するか

2. **統合テスト**
   - 新規プロジェクト作成フロー
   - 複数ページの作成と管理
   - CMS連携テスト

3. **エラーハンドリング**
   - ページ作成エラー
   - CMS接続エラー
   - 大規模サイト（50ページ以上）での動作

### Step 10: ドキュメント整備（1.5時間）

1. **README.mdの作成**
```markdown
# HPGenius

AI駆動の企業サイト・ホームページ制作支援システム

## 特徴
- 自然言語で企業サイト制作
- 10の専門AIエージェント
- CMS統合
- SEO最適化
```

2. **使い方ガイドの作成**
   - インストール方法
   - 基本的な使い方
   - CMS連携方法
   - 複数ページの管理

## 4. 実装スケジュール

| 日程 | タスク | 想定時間 |
|------|--------|---------|
| Day 1 | Step 1-3: 初期セットアップ | 2.5時間 |
| Day 2 | Step 4-5: Portal登録と拡張機能 | 5時間 |
| Day 3 | Step 6-7: UI/UXとエージェント実行 | 5時間 |
| Day 4 | Step 8-10: CMS/ページ管理とテスト | 7.5時間 |

**合計想定時間**: 約20時間（Portal活用により2.5時間短縮、それでもLPGeniusより5時間多い）

## 5. LPGeniusとの主な違い

### 5.1 機能面の違い
| 項目 | HPGenius | LPGenius |
|------|----------|----------|
| エージェント数 | 10個 | 8個 |
| ページ数 | 10-50ページ | 1ページ |
| CMS統合 | 必須 | 不要 |
| SEO機能 | 高度（サイト全体） | 基本（単一ページ） |
| 更新頻度 | 頻繁 | A/Bテスト時のみ |

### 5.2 技術的な違い
- **ページ管理システム**: 複数ページの階層管理が必要
- **CMS統合**: WordPress等との連携機能
- **テンプレートシステム**: ページタイプ別のテンプレート
- **コンテンツ管理**: ブログ、ニュース等の動的コンテンツ

### 5.3 実装の複雑さ
- エージェントが2個多い（ブランド戦略、品質保証）
- CMS統合による追加開発
- 複数ページ管理の実装
- より高度なSEO機能

## 6. 実装のポイント

### 6.1 AppGeniusから引き継ぐもの
- VSCode拡張機能の基本構造
- ClaudeCode連携の仕組み
- プロジェクト管理システム
- UI/UXの基本設計

### 6.2 HPGenius独自の実装
- 企業サイト特化の10エージェント
- CMS統合機能
- 複数ページ管理
- サイトマップ自動生成
- 高度なSEO機能

### 6.3 注意事項
- LPGeniusより複雑なため、段階的な実装が重要
- CMS連携部分は十分なテストが必要
- 大規模サイトでのパフォーマンスに注意

## 7. 次のステップ

実装完了後：
1. ベータテストの実施（特にCMS連携）
2. 様々な業種でのテスト
3. エンタープライズ機能の検討
4. マーケットプレイスへの公開準備