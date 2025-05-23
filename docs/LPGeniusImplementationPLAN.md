# LPGenius実装計画書

**作成日**: 2025-01-23  
**バージョン**: 1.0.0  
**ステータス**: 実装準備中  

## 1. 概要

本書は、AppGeniusのコードベースを基にLPGeniusを実装するための具体的な手順を記載しています。AppGeniusの堅牢な基盤を活用しつつ、LP制作に特化したシステムへと変換していきます。

## 2. 実装の基本方針

- **段階的実装**: まずMVPとして基本的なLP制作機能を実装
- **既存資産の活用**: AppGeniusの拡張機能基盤を最大限に活用
- **シンプル化**: LP制作に不要な複雑な機能は削除
- **フィードバックループ重視**: 各エージェントでユーザー確認を組み込む

## 3. 実装ステップ

### Step 1: プロジェクトのコピーと初期設定（30分）

```bash
# 1. AppGeniusプロジェクトをコピー
cp -r /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius /Users/tatsuya/Desktop/システム開発/LPGenius

# 2. 新しいプロジェクトディレクトリに移動
cd /Users/tatsuya/Desktop/システム開発/LPGenius

# 3. Gitリポジトリの初期化（新規プロジェクトとして）
rm -rf .git
git init
git add .
git commit -m "初期コミット: AppGeniusベースのLPGeniusプロジェクト開始"
```

### Step 2: 不要ファイルの削除とクリーンアップ（30分）

#### 削除対象ディレクトリ・ファイル：
```bash
# Portal関連は削除しない（共通のPortalを使用するため）

# 複雑な認証関連（シンプル化のため）
rm -rf src/core/auth/
rm src/ui/auth/*

# AppGenius固有のサービス
rm src/services/AppGeniusEventBus.ts
rm src/services/ProjectManagementService.ts

# 不要なドキュメント
rm docs/requirements.md  # AppGeniusの要件定義書
rm -rf docs/archive/     # 過去のアーカイブ
```

#### Portal連携の設定：
```typescript
// src/config/promptUrls.ts を作成
export const LP_GENIUS_PROMPTS = {
  conversionStrategist: 'https://portal.appgenius.com/api/prompts/public/[ID1]',
  salesCopywriter: 'https://portal.appgenius.com/api/prompts/public/[ID2]',
  lpDesigner: 'https://portal.appgenius.com/api/prompts/public/[ID3]',
  lpStructureArchitect: 'https://portal.appgenius.com/api/prompts/public/[ID4]',
  performanceOptimizer: 'https://portal.appgenius.com/api/prompts/public/[ID5]',
  trackingSetup: 'https://portal.appgenius.com/api/prompts/public/[ID6]',
  implementationEngineer: 'https://portal.appgenius.com/api/prompts/public/[ID7]',
  abTestManager: 'https://portal.appgenius.com/api/prompts/public/[ID8]'
};
```

#### 保持・活用するファイル：
- `src/extension.ts` - VSCode拡張の基盤
- `src/utils/` - ユーティリティ関数群
- `src/ui/scopeManager/` - UI基盤として活用
- `media/` - アセットとUIコンポーネント

### Step 3: LPGenius用の基本構造作成（1時間）

```bash
# 新しいディレクトリ構造を作成
mkdir -p docs/prompts/lpgenius
mkdir -p src/agents
mkdir -p src/templates/lp
mkdir -p mockups/templates
mkdir -p dist/
```

#### 作成するファイル：

1. **CLAUDE.md**の更新
```markdown
# LPGenius

## System Instructions
このプロジェクトでは、セッション開始時に必ず最初の会話で指定されているファイルを読み込んでください。
常に日本語で対応してください。

## プロジェクト概要
LPGeniusは、自然言語でプロ品質のランディングページを作成できるLP制作支援システムです。
```

2. **新しいSCOPE_PROGRESS.md**
```markdown
# LPGenius 開発進捗状況

## 1. 基本情報
- **ステータス**: 開始段階
- **完了タスク数**: 0/8
- **進捗率**: 0%
- **次のマイルストーン**: エージェントプロンプト作成完了

## 2. 実装計画

| フェーズ | 状態 | 担当エージェント | 解説 |
|---------|------|----------------|------|
| **1. コンバージョン戦略** | [ ] | ★1 コンバージョン戦略アナリスト | ターゲットとオファーを明確化 |
| **2. セールスコピー作成** | [ ] | ★2 セールスコピーライター | 説得力のあるコピーを作成 |
| **3. LPデザイン** | [ ] | ★3 LPデザインスペシャリスト | 視覚的なデザインを実装 |
| **4. LP構造設計** | [ ] | ★4 LP構造アーキテクト | 最適なセクション構成を設計 |
| **5. パフォーマンス最適化** | [ ] | ★5 パフォーマンス最適化エンジニア | 表示速度を最適化 |
| **6. 計測設定** | [ ] | ★6 計測・分析セットアップ | アナリティクスを設定 |
| **7. 実装** | [ ] | ★7 実装エンジニア | 本番環境用コードを生成 |
| **8. A/Bテスト** | [ ] | ★8 A/Bテストマネージャー | 継続的な改善を支援 |
```

### Step 4: Portal へのプロンプト登録とURL取得（1時間）

既存のAppGenius Portalに新しいプロンプトを登録：

1. **Portal管理画面にアクセス**
   - AppGeniusのPortal管理画面にログイン
   - プロンプト管理セクションへ移動

2. **LPGenius用プロンプトの登録**
   ```
   以下の8個のプロンプトを登録：
   - ★1 コンバージョン戦略アナリスト
   - ★2 セールスコピーライター
   - ★3 LPデザインスペシャリスト
   - ★4 LP構造アーキテクト
   - ★5 パフォーマンス最適化エンジニア
   - ★6 計測・分析セットアップ
   - ★7 実装エンジニア
   - ★8 A/Bテストマネージャー
   ```

3. **発行されたURLを記録**
   各プロンプトの公開URLを`src/config/promptUrls.ts`に記録

4. **タグ付けとカテゴリ設定**
   - タグ: "LPGenius", "LP制作"
   - カテゴリ: "Web制作"

### Step 5: VSCode拡張機能の改修（3時間）

#### 5.1 extension.tsの修正

```typescript
// src/extension.ts の変更点

// 1. 拡張機能名の変更
const EXTENSION_NAME = 'LPGenius';
const EXTENSION_ID = 'lpgenius';

// 2. コマンドの変更
context.subscriptions.push(
    vscode.commands.registerCommand('lpgenius.startProject', startLPProject),
    vscode.commands.registerCommand('lpgenius.openStrategist', openStrategist),
    vscode.commands.registerCommand('lpgenius.openCopywriter', openCopywriter),
    // ... 他のエージェントコマンド
);

// 3. プロジェクトテンプレートの変更
async function createProjectStructure(projectPath: string) {
    // LPGenius用のディレクトリ構造を作成
    const dirs = [
        'docs',
        'mockups',
        'dist',
        'assets/images',
        'assets/fonts',
    ];
    // ... ディレクトリ作成処理
}
```

#### 5.2 package.jsonの更新

```json
{
    "name": "lpgenius",
    "displayName": "LPGenius - AI LP Builder",
    "description": "自然言語でプロ品質のランディングページを作成",
    "version": "1.0.0",
    "engines": {
        "vscode": "^1.74.0"
    },
    "categories": ["Other"],
    "activationEvents": [
        "onCommand:lpgenius.startProject"
    ],
    "main": "./dist/extension.js",
    "contributes": {
        "commands": [
            {
                "command": "lpgenius.startProject",
                "title": "LPGenius: 新規LPプロジェクトを開始"
            }
        ]
    }
}
```

### Step 6: UI/UXの改修（2時間）

#### 6.1 ScopeManagerのLP版への改修

```typescript
// src/ui/lpManager/LPManagerPanel.ts
export class LPManagerPanel {
    // AppGeniusのScopeManagerPanelをベースに改修
    
    private getHtmlContent(): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>LPGenius Manager</title>
                <!-- スタイルシート -->
            </head>
            <body>
                <div class="container">
                    <h1>LPGenius - LP制作管理</h1>
                    <div class="agent-cards">
                        <!-- 8つのエージェントカード -->
                    </div>
                    <div class="progress-tracker">
                        <!-- 進捗表示 -->
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
// media/components/promptCards/lpPromptCards.js
const lpAgents = [
    {
        id: 'conversion-strategist',
        title: '★1 コンバージョン戦略アナリスト',
        description: 'ターゲットとオファーを明確化',
        icon: '🎯',
        promptFile: '★1conversion_strategist.md'
    },
    // ... 他の7つのエージェント
];
```

### Step 7: エージェント実行システムの実装（2時間）

```typescript
// src/agents/AgentRunner.ts
import { LP_GENIUS_PROMPTS } from '../config/promptUrls';

export class LPAgentRunner {
    private currentAgent: string;
    private projectPath: string;
    
    async runAgent(agentId: string): Promise<void> {
        // 1. PortalのURLからプロンプトを取得
        const promptUrl = LP_GENIUS_PROMPTS[agentId];
        const promptContent = await this.fetchPromptFromPortal(promptUrl);
        
        // 2. 一時ファイルにプロンプトを書き込み
        const tempFile = await this.createTempFile(promptContent);
        
        // 3. ClaudeCodeを起動（AppGeniusの仕組みを流用）
        await vscode.commands.executeCommand('claude-code.openWithFile', tempFile);
        
        // 4. 進捗を更新
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

### Step 8: テンプレートシステムの実装（2時間）

```typescript
// src/templates/LPTemplateService.ts
export class LPTemplateService {
    // LP用のテンプレートを管理
    
    async createInitialFiles(projectPath: string): Promise<void> {
        // CLAUDE.mdの作成
        await this.createClaudeFile(projectPath);
        
        // SCOPE_PROGRESS.mdの作成
        await this.createScopeProgressFile(projectPath);
        
        // 要件定義書のコピー
        await this.copyRequirementsFile(projectPath);
    }
    
    async generateLPTemplate(type: 'basic' | 'video' | 'form'): Promise<string> {
        // 基本的なLPテンプレートHTMLを生成
        const templates = {
            basic: this.getBasicTemplate(),
            video: this.getVideoTemplate(),
            form: this.getFormTemplate()
        };
        
        return templates[type];
    }
}
```

### Step 9: デバッグとテスト（2時間）

1. **基本動作確認**
   - VSCode拡張機能として正しく起動するか
   - 各コマンドが正しく動作するか
   - エージェントプロンプトが正しく読み込まれるか

2. **統合テスト**
   - 新規プロジェクト作成フロー
   - 各エージェントの連携
   - 成果物の生成確認

3. **エラーハンドリング**
   - ファイルが見つからない場合
   - ClaudeCodeが起動しない場合
   - 権限エラーの処理

### Step 10: ドキュメント整備（1時間）

1. **README.mdの作成**
```markdown
# LPGenius

AI駆動のランディングページ制作支援システム

## 特徴
- 自然言語でLP制作
- 8つの専門AIエージェント
- コンバージョン最適化
```

2. **使い方ガイドの作成**
   - インストール方法
   - 基本的な使い方
   - 各エージェントの説明

## 4. 実装スケジュール

| 日程 | タスク | 想定時間 |
|------|--------|---------|
| Day 1 | Step 1-3: 初期セットアップ | 2時間 |
| Day 2 | Step 4-5: Portal登録と拡張機能 | 4時間 |
| Day 3 | Step 6-7: UI/UXとエージェント | 4時間 |
| Day 4 | Step 8-10: テンプレートとテスト | 5時間 |

**合計想定時間**: 約15時間（Portal活用により2.5時間短縮）

## 5. 実装のポイント

### 5.1 AppGeniusから引き継ぐもの
- VSCode拡張機能の基本構造
- ClaudeCode連携の仕組み
- プロジェクト管理システム
- UI/UXの基本設計

### 5.2 LPGenius独自の実装
- LP特化のエージェントプロンプト
- マーケティング寄りのUI
- シンプルな実行フロー
- A/Bテスト管理機能

### 5.3 注意事項
- AppGeniusの複雑な機能は削除してシンプルに
- フィードバックループを重視した設計
- 将来のファネル拡張を考慮したアーキテクチャ

## 6. 次のステップ

実装完了後：
1. ベータテストの実施
2. ユーザーフィードバックの収集
3. Phase 2機能（高度な最適化）の検討
4. マーケットプレイスへの公開準備