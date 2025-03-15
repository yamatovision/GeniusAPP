"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolkitManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("./logger");
const PlatformManager_1 = require("./PlatformManager");
/**
 * AppGeniusツールキット管理クラス
 * ツールキットのコンポーネント、バージョン、依存関係を管理する
 */
class ToolkitManager {
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!ToolkitManager.instance) {
            ToolkitManager.instance = new ToolkitManager();
        }
        return ToolkitManager.instance;
    }
    /**
     * コンストラクタ
     */
    constructor() {
        this._config = null;
        this._configFilePath = '';
        this._extensionPath = '';
        this._versionUpdateHandlers = new Map();
        const platformManager = PlatformManager_1.PlatformManager.getInstance();
        this._extensionPath = platformManager.getExtensionPath();
        this._configFilePath = path.join(this._extensionPath, 'toolkit-version.json');
        // 初期設定
        this._initialize();
    }
    /**
     * 初期化処理
     */
    async _initialize() {
        try {
            // 設定ファイルが存在する場合は読み込む
            if (fs.existsSync(this._configFilePath)) {
                const configContent = fs.readFileSync(this._configFilePath, 'utf8');
                this._config = JSON.parse(configContent);
                logger_1.Logger.info(`ツールキット設定をロードしました: ${this._configFilePath}`);
            }
            else {
                // 設定ファイルが存在しない場合はデフォルト設定を作成
                this._config = this._createDefaultConfig();
                this._saveConfig();
                logger_1.Logger.info(`デフォルトのツールキット設定を作成しました: ${this._configFilePath}`);
            }
        }
        catch (error) {
            logger_1.Logger.error('ツールキット初期化エラー:', error);
            this._config = this._createDefaultConfig();
        }
    }
    /**
     * デフォルト設定を作成
     */
    _createDefaultConfig() {
        return {
            version: '0.2.0',
            lastUpdated: new Date().toISOString().split('T')[0],
            components: {
                "ClaudeCodeLauncherService": {
                    id: "ClaudeCodeLauncherService",
                    name: "ClaudeCode起動サービス",
                    version: "1.2.0",
                    path: "./src/services/ClaudeCodeLauncherService.ts",
                    lastUpdated: new Date().toISOString().split('T')[0],
                    dependencies: [
                        "AppGeniusEventBus",
                        "PlatformManager",
                        "ScopeExporter"
                    ],
                    description: "VSCode拡張からClaudeCodeを起動し、スコープ実装を進める"
                },
                "ScopeManagerPanel": {
                    id: "ScopeManagerPanel",
                    name: "スコープマネージャー",
                    version: "1.1.5",
                    path: "./src/ui/scopeManager/ScopeManagerPanel.ts",
                    lastUpdated: new Date().toISOString().split('T')[0],
                    dependencies: [
                        "ClaudeCodeLauncherService",
                        "FileOperationManager"
                    ],
                    description: "スコープの管理と進捗状況の追跡を行うパネル"
                },
                "EnvironmentVariablesAssistantPanel": {
                    id: "EnvironmentVariablesAssistantPanel",
                    name: "環境変数アシスタント",
                    version: "1.0.2",
                    path: "./src/ui/environmentVariablesAssistant/EnvironmentVariablesAssistantPanel.ts",
                    lastUpdated: new Date().toISOString().split('T')[0],
                    dependencies: [
                        "ClaudeCodeLauncherService",
                        "FileOperationManager"
                    ],
                    description: "環境変数の検出、編集、検証を行うパネル"
                },
                "DebugDetectivePanel": {
                    id: "DebugDetectivePanel",
                    name: "デバッグ探偵",
                    version: "1.0.1",
                    path: "./src/ui/debugDetective/DebugDetectivePanel.ts",
                    lastUpdated: new Date().toISOString().split('T')[0],
                    dependencies: [
                        "KnowledgeBaseManager",
                        "ErrorSessionManager"
                    ],
                    description: "エラーの検出と解決を支援するパネル"
                }
            },
            integrationPoints: {
                "CLAUDE.md": {
                    id: "CLAUDE.md",
                    name: "CLAUDE.md",
                    version: "1.3.0",
                    path: "./CLAUDE.md",
                    lastUpdated: new Date().toISOString().split('T')[0],
                    description: "プロジェクトの中心的なドキュメント"
                },
                "CURRENT_STATUS.md": {
                    id: "CURRENT_STATUS.md",
                    name: "CURRENT_STATUS.md",
                    version: "1.1.0",
                    path: "./docs/CURRENT_STATUS.md",
                    lastUpdated: new Date().toISOString().split('T')[0],
                    description: "現在のプロジェクト状況を管理するドキュメント"
                },
                "Scope_Implementation_Assistant_Prompt.md": {
                    id: "Scope_Implementation_Assistant_Prompt.md",
                    name: "実装アシスタントプロンプト",
                    version: "1.2.0",
                    path: "./docs/Scope_Implementation_Assistant_Prompt.md",
                    lastUpdated: new Date().toISOString().split('T')[0],
                    description: "実装アシスタント用のプロンプトテンプレート"
                }
            }
        };
    }
    /**
     * 設定を保存
     */
    _saveConfig() {
        try {
            if (!this._config) {
                return;
            }
            // 最終更新日を設定
            this._config.lastUpdated = new Date().toISOString().split('T')[0];
            // JSONに変換して保存
            const configContent = JSON.stringify(this._config, null, 2);
            fs.writeFileSync(this._configFilePath, configContent, 'utf8');
            logger_1.Logger.info(`ツールキット設定を保存しました: ${this._configFilePath}`);
        }
        catch (error) {
            logger_1.Logger.error('ツールキット設定保存エラー:', error);
        }
    }
    /**
     * ツールキットのバージョンを取得
     */
    getToolkitVersion() {
        return this._config?.version || '0.0.0';
    }
    /**
     * コンポーネント情報を取得
     */
    getComponent(id) {
        return this._config?.components[id];
    }
    /**
     * 全コンポーネント情報を取得
     */
    getAllComponents() {
        if (!this._config) {
            return [];
        }
        return Object.values(this._config.components);
    }
    /**
     * コンポーネントが存在するか確認
     */
    hasComponent(id) {
        return !!this._config?.components[id];
    }
    /**
     * コンポーネントを追加または更新
     */
    updateComponent(component) {
        if (!this._config) {
            return;
        }
        this._config.components[component.id] = component;
        this._saveConfig();
    }
    /**
     * コンポーネントを削除
     */
    removeComponent(id) {
        if (!this._config || !this._config.components[id]) {
            return;
        }
        delete this._config.components[id];
        this._saveConfig();
    }
    /**
     * 統合ポイント情報を取得
     */
    getIntegrationPoint(id) {
        return this._config?.integrationPoints[id];
    }
    /**
     * 全統合ポイント情報を取得
     */
    getAllIntegrationPoints() {
        if (!this._config) {
            return [];
        }
        return Object.values(this._config.integrationPoints);
    }
    /**
     * 統合ポイントを追加または更新
     */
    updateIntegrationPoint(point) {
        if (!this._config) {
            return;
        }
        this._config.integrationPoints[point.id] = point;
        this._saveConfig();
    }
    /**
     * コンポーネントのバージョンを更新
     */
    updateComponentVersion(id, version) {
        if (!this._config || !this._config.components[id]) {
            return;
        }
        this._config.components[id].version = version;
        this._config.components[id].lastUpdated = new Date().toISOString().split('T')[0];
        this._saveConfig();
    }
    /**
     * ツールキットのバージョンを更新
     */
    updateToolkitVersion(version) {
        if (!this._config) {
            return;
        }
        this._config.version = version;
        this._saveConfig();
    }
    /**
     * 依存関係の分析を実行
     */
    analyzeDependencies() {
        const result = {
            missingDependencies: [],
            outdatedDependencies: [],
            circularDependencies: []
        };
        if (!this._config) {
            return result;
        }
        // コンポーネントマップを作成
        const componentMap = new Map();
        Object.values(this._config.components).forEach(component => {
            componentMap.set(component.id, component);
        });
        // 依存関係チェック
        Object.values(this._config.components).forEach(component => {
            component.dependencies.forEach(depId => {
                // 依存先コンポーネントがない場合
                if (!componentMap.has(depId)) {
                    result.missingDependencies.push(`${component.id} -> ${depId}`);
                }
            });
        });
        // 循環依存チェック
        Object.values(this._config.components).forEach(component => {
            const visited = new Set();
            const pathStack = [];
            const detectCycle = (currentId) => {
                if (pathStack.includes(currentId)) {
                    // 循環依存を検出
                    const cycleStart = pathStack.indexOf(currentId);
                    const cycle = [...pathStack.slice(cycleStart), currentId];
                    result.circularDependencies.push(cycle.join(' -> '));
                    return true;
                }
                if (visited.has(currentId)) {
                    return false;
                }
                visited.add(currentId);
                pathStack.push(currentId);
                const currentComponent = componentMap.get(currentId);
                if (currentComponent) {
                    for (const depId of currentComponent.dependencies) {
                        if (detectCycle(depId)) {
                            return true;
                        }
                    }
                }
                pathStack.pop();
                return false;
            };
            detectCycle(component.id);
        });
        return result;
    }
    /**
     * ダッシュボードの更新
     * toolkit-dashboard.htmlを現在の状態で再生成する
     */
    async updateDashboard() {
        try {
            // ダッシュボードテンプレートパス
            const dashboardPath = path.join(this._extensionPath, 'toolkit-dashboard.html');
            // ダッシュボードを生成
            const dashboardHtml = this._generateDashboardHtml();
            // ファイルに書き込み
            fs.writeFileSync(dashboardPath, dashboardHtml, 'utf8');
            logger_1.Logger.info(`ツールキットダッシュボードを更新しました: ${dashboardPath}`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error('ダッシュボード更新エラー:', error);
            return false;
        }
    }
    /**
     * ダッシュボードHTMLを生成
     */
    _generateDashboardHtml() {
        if (!this._config) {
            return '';
        }
        // コンポーネント状態データを準備
        const componentData = this.getAllComponents();
        const integrationPoints = this.getAllIntegrationPoints();
        const today = new Date().toISOString().split('T')[0];
        // ツールキットの安定度を計算
        const stabilityPercent = 85; // TODO: コンポーネントの状態から計算する
        // ディレクトリ構造を生成
        const mermaidDirStructure = this._generateMermaidDirStructure();
        // 依存関係図を生成
        const mermaidDepGraph = this._generateMermaidDependencyGraph();
        // コンポーネント一覧を生成
        const componentListHtml = componentData.map(comp => {
            return `
      <div class="component-card">
        <div class="component-header">
          <span>${comp.name}</span>
          <span class="component-version">v${comp.version}</span>
        </div>
        <div class="component-description">${comp.description || ''}</div>
        <div class="component-date">最終更新日: ${comp.lastUpdated}</div>
        <div class="component-deps">依存: ${comp.dependencies.join(', ')}</div>
      </div>`;
        }).join('');
        // 統合ポイント一覧を生成
        const integrationListHtml = integrationPoints.map(point => {
            return `
      <div class="component-card">
        <div class="component-header">
          <span>${point.name}</span>
          <span class="component-version">v${point.version}</span>
        </div>
        <div class="component-description">${point.description || ''}</div>
        <div class="component-date">最終更新日: ${point.lastUpdated}</div>
      </div>`;
        }).join('');
        // タイムラインを生成
        const mermaidTimeline = `
timeline
    title AppGenius 改善ロードマップ
    section 短期計画 (Q2)
        理想的なディレクトリ構造への移行 : 4月
        命名規則の標準化とドキュメント化 : 4月〜5月
        CLAUDE.md初期テンプレートの改善 : 5月
        CURRENT_STATUS.md初期テンプレートの標準化 : 5月
        APIドキュメント管理の再検討 : 6月
    section 中期計画 (Q3)
        環境変数管理システムの強化 : 7月
        デバッグ知識ベースの拡充 : 7月〜8月
        スコープマネージャーUIの改善 : 8月〜9月
    section 長期計画 (Q4)
        プロジェクト間でのツールキット共有機能 : 10月
        AIプロンプト自動最適化システム : 10月〜11月
        リファレンス管理システムの強化 : 11月〜12月
`;
        // ファイル構造の項目を生成
        const fileStructureHtml = `
    <div class="file-structure">
      <!-- 要件定義 -->
      <div class="file-group">
        <div class="file-group-title">要件定義</div>
        <ul class="file-list">
          <li class="core-file">requirementsadvicer.md (入力)</li>
          <li class="core-file">requirements.md (出力)</li>
          <li class="core-file">mockups/*.html (出力)</li>
        </ul>
        <div style="margin-top: 10px; font-size: 0.85rem; color: #666;">
          <p><strong>機能:</strong> ユーザーの要求から要件定義とモックアップ作成</p>
        </div>
      </div>

      <!-- モックアップギャラリー -->
      <div class="file-group">
        <div class="file-group-title">モックアップギャラリー</div>
        <ul class="file-list">
          <li class="core-file">mockup_analysis_template.md (入力)</li>
          <li class="core-file">mockups/*.html (更新)</li>
          <li class="core-file">scopes/*-requirements.md (出力)</li>
        </ul>
        <div style="margin-top: 10px; font-size: 0.85rem; color: #666;">
          <p><strong>機能:</strong> モックアップ表示、編集、個別要件生成</p>
        </div>
      </div>

      <!-- スコープマネージャー -->
      <div class="file-group">
        <div class="file-group-title">スコープマネージャー</div>
        <ul class="file-list">
          <li class="core-file">Scope_Manager_Prompt.md (入力)</li>
          <li class="core-file">Scope_Implementation_Assistant_Prompt.md (入力)</li>
          <li class="core-file">CURRENT_STATUS.md (出力/管理)</li>
          <li class="core-file">scope.md (出力/管理)</li>
          <li class="optional-file">structure.md (入力)</li>
          <li class="optional-file">api.md (入力)</li>
          <li class="optional-file">env.example (連携)</li>
        </ul>
        <div style="margin-top: 10px; font-size: 0.85rem; color: #666;">
          <p><strong>機能:</strong> スコープ定義、優先順位付け、実装管理</p>
        </div>
      </div>

      <!-- デバッグ探偵 -->
      <div class="file-group">
        <div class="file-group-title">デバッグ探偵</div>
        <ul class="file-list">
          <li class="core-file">DebugDetector.md (入力)</li>
          <li class="core-file">logs/debug/knowledge/ (出力)</li>
          <li class="core-file">logs/debug/sessions/ (出力)</li>
          <li class="optional-file">logs/debug/archived/ (出力)</li>
        </ul>
        <div style="margin-top: 10px; font-size: 0.85rem; color: #666;">
          <p><strong>機能:</strong> エラー分析、解決策提案、知識ベース管理</p>
        </div>
      </div>

      <!-- 環境変数アシスタント -->
      <div class="file-group">
        <div class="file-group-title">環境変数アシスタント</div>
        <ul class="file-list">
          <li class="core-file">environmentVariablesAssistant-requirements.md (入力)</li>
          <li class="core-file">env.example (出力)</li>
          <li class="core-file">CLAUDE.md 環境変数セクション (更新)</li>
        </ul>
        <div style="margin-top: 10px; font-size: 0.85rem; color: #666;">
          <p><strong>機能:</strong> 環境変数管理、設定ファイル生成、カテゴリ管理</p>
        </div>
      </div>
    </div>
    `;
        // ダッシュボードHTMLを組み立て
        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AppGenius ツールキットダッシュボード</title>
    <style>
        :root {
            --primary-color: #007acc;
            --secondary-color: #0066b8;
            --success-color: #28a745;
            --warning-color: #ffc107;
            --danger-color: #dc3545;
            --light-color: #f8f9fa;
            --dark-color: #212529;
            --border-color: #dee2e6;
            --text-color: #333;
            --vs-bg: #1e1e1e;
            --vs-text: #d4d4d4;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            color: var(--text-color);
            background-color: var(--light-color);
            margin: 0;
            padding: 0;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            background-color: var(--primary-color);
            color: white;
            padding: 1rem;
            margin-bottom: 2rem;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        h1, h2, h3, h4 {
            margin-top: 0;
        }

        .last-updated {
            font-size: 0.9rem;
            font-style: italic;
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }

        .dashboard-card {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 20px;
            position: relative;
            overflow: hidden;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 10px;
        }

        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .status-stable {
            background-color: var(--success-color);
            color: white;
        }

        .status-updating {
            background-color: var(--warning-color);
            color: var(--dark-color);
        }

        .status-critical {
            background-color: var(--danger-color);
            color: white;
        }

        .component-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }

        .component-card {
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 12px;
            border-left: 4px solid var(--primary-color);
        }

        .component-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-weight: 600;
        }

        .component-version {
            color: var(--primary-color);
            font-size: 0.85rem;
        }

        .component-description {
            font-size: 0.9rem;
            margin-bottom: 8px;
        }

        .component-date {
            color: #666;
            font-size: 0.8rem;
        }

        .component-deps {
            font-size: 0.8rem;
            color: #666;
            margin-top: 5px;
        }

        .progress-bar {
            height: 8px;
            background-color: #e9ecef;
            border-radius: 4px;
            margin-top: 10px;
            overflow: hidden;
        }

        .progress {
            height: 100%;
            background-color: var(--success-color);
        }

        .integration-line {
            position: absolute;
            background-color: rgba(0, 122, 204, 0.3);
            z-index: 10;
        }

        .dep-graph {
            height: 400px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background-color: white;
            margin-bottom: 30px;
        }

        .modules-section {
            margin-top: 40px;
        }

        .module-container {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 20px;
            margin-top: 20px;
        }

        .module-card {
            flex: 1;
            min-width: 300px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            padding: 15px;
        }

        .module-title {
            font-weight: 600;
            margin-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 5px;
        }

        .function-list {
            font-family: 'Courier New', Courier, monospace;
            font-size: 0.9rem;
            list-style-type: none;
            padding-left: 0;
        }

        .function-list li {
            padding: 4px 0;
        }

        footer {
            margin-top: 50px;
            text-align: center;
            font-size: 0.9rem;
            color: #666;
            padding: 20px;
            border-top: 1px solid var(--border-color);
        }

        /* VS Code風スタイル */
        .vs-code-style {
            background-color: var(--vs-bg);
            color: var(--vs-text);
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
            overflow-x: auto;
        }

        .keyword {
            color: #569cd6;
        }

        .string {
            color: #ce9178;
        }

        .comment {
            color: #6a9955;
        }

        .function {
            color: #dcdcaa;
        }

        /* メルマガ風UI説明 */
        .implementation-note {
            background-color: #f8f8f8;
            border-left: 4px solid #007acc;
            padding: 15px;
            margin: 20px 0;
            font-size: 0.9rem;
        }

        .implementation-note h4 {
            margin-top: 0;
            color: #007acc;
        }

        /* mermaid対応 */
        .mermaid {
            margin: 20px 0;
        }

        /* 新規追加: ファイル構造図 */
        .file-structure {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 15px;
            margin: 20px 0;
        }

        .file-group {
            background-color: white;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .file-group-title {
            font-weight: 600;
            margin-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 5px;
            color: var(--primary-color);
        }

        .file-list {
            list-style-type: none;
            padding-left: 0;
            font-size: 0.9rem;
        }

        .file-list li {
            padding: 4px 0;
            border-left: 2px solid #eee;
            padding-left: 8px;
            margin-bottom: 3px;
        }

        .file-list li.core-file {
            border-left-color: var(--success-color);
            font-weight: 500;
        }

        .file-list li.optional-file {
            border-left-color: var(--warning-color);
            font-style: italic;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>AppGenius ツールキットダッシュボード</h1>
                <p class="last-updated">最終更新日: <span id="updated-date">${today}</span></p>
            </div>
            <div>
                <select id="theme-selector">
                    <option value="light">ライトモード</option>
                    <option value="dark">ダークモード</option>
                </select>
            </div>
        </header>

        <div class="dashboard-grid">
            <!-- ツールキット概要カード -->
            <div class="dashboard-card">
                <div class="card-header">
                    <h2>ツールキット概要</h2>
                    <span class="status-badge status-stable">安定</span>
                </div>
                <div>
                    <p>AppGenius ツールキットバージョン: <strong>${this._config.version}</strong></p>
                    <p>実装済みコンポーネント: <strong>${componentData.length}/${componentData.length}</strong></p>
                    <p>コンポーネント安定度: <strong>${stabilityPercent}%</strong></p>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${stabilityPercent}%"></div>
                    </div>
                </div>
            </div>

            <!-- プロジェクト状況カード -->
            <div class="dashboard-card">
                <div class="card-header">
                    <h2>プロジェクト状況</h2>
                    <span class="status-badge status-updating">進行中</span>
                </div>
                <div>
                    <p>完成予定ファイル数: <strong>48</strong></p>
                    <p>作成済みファイル数: <strong>18</strong></p>
                    <p>進捗率: <strong>37.5%</strong></p>
                    <div class="progress-bar">
                        <div class="progress" style="width: 37.5%"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- コンポーネント一覧 -->
        <h2>コアコンポーネント</h2>
        <div class="component-grid">
            ${componentListHtml}
        </div>

        <h2>統合ポイント</h2>
        <div class="component-grid">
            ${integrationListHtml}
        </div>

        <!-- 依存関係グラフ -->
        <h2>コンポーネント依存関係図</h2>
        <div class="dep-graph">
            <div class="mermaid">
${mermaidDepGraph}
            </div>
        </div>

        <!-- 理想的なディレクトリ構造 -->
        <h2>理想的なディレクトリ構造</h2>
        <div class="dep-graph">
            <div class="mermaid">
${mermaidDirStructure}
            </div>
        </div>

        <!-- 各UIコンポーネントとファイルの関係 -->
        <h2>UIコンポーネントとファイルの関係</h2>
        ${fileStructureHtml}

        <!-- コード連携例 -->
        <h2>連携メカニズム</h2>
        <div class="vs-code-style">
            <span class="comment">// ファイル結合方式（推奨）</span><br>
            <span class="keyword">const</span> tempDir = path.<span class="function">join</span>(projectPath, <span class="string">'temp'</span>);<br>
            <span class="keyword">const</span> combinedFilePath = path.<span class="function">join</span>(tempDir, <span class="string">\`combined_prompt_\${Date.now()}.md\`</span>);<br>
            <br>
            <span class="comment">// ファイル内容を結合</span><br>
            <span class="keyword">const</span> promptContent = fs.<span class="function">readFileSync</span>(promptFilePath, <span class="string">'utf8'</span>);<br>
            <span class="keyword">const</span> secondContent = fs.<span class="function">readFileSync</span>(secondFilePath, <span class="string">'utf8'</span>);<br>
            <br>
            <span class="comment">// 結合ファイルを作成（セクション見出しなどで構造化）</span><br>
            <span class="keyword">const</span> combinedContent = <br>
            &nbsp;&nbsp;promptContent + <br>
            &nbsp;&nbsp;<span class="string">'\n\n# 追加情報\n\n'</span> +<br>
            &nbsp;&nbsp;secondContent;<br>
            <br>
            fs.<span class="function">writeFileSync</span>(combinedFilePath, combinedContent, <span class="string">'utf8'</span>);<br>
        </div>

        <div class="implementation-note">
            <h4>コード連携の特徴</h4>
            <p>AppGeniusツールキットでは、VSCodeとClaudeCodeの間で情報をシームレスに共有するために「ファイル結合方式」を採用しています。この方式は、複数のコンテキストファイルを単一のプロンプトファイルに結合することで、AIに十分なコンテキストを提供します。</p>
            <p>このアプローチは特に以下の場合に効果的です：</p>
            <ul>
                <li>スコープ情報とステータス情報の両方をAIに渡す必要がある場合</li>
                <li>AIプロンプトとプロジェクト構造情報を同時に参照する必要がある場合</li>
                <li>複数の関連ファイルをまとめて分析する必要がある場合</li>
            </ul>
        </div>

        <!-- モジュール機能一覧 -->
        <div class="modules-section">
            <h2>モジュール機能一覧</h2>
            <div class="module-container">
                <!-- ClaudeCodeLauncherService -->
                <div class="module-card">
                    <div class="module-title">ClaudeCodeLauncherService</div>
                    <ul class="function-list">
                        <li>launchClaudeCode(scope)</li>
                        <li>launchClaudeCodeWithMockup(mockupFilePath, projectPath)</li>
                        <li>launchClaudeCodeWithPrompt(projectPath, promptFilePath)</li>
                        <li>installClaudeCode()</li>
                        <li>resetStatus()</li>
                    </ul>
                </div>

                <!-- ScopeManagerPanel -->
                <div class="module-card">
                    <div class="module-title">ScopeManagerPanel</div>
                    <ul class="function-list">
                        <li>createOrShow(extensionUri, projectPath)</li>
                        <li>setProjectPath(projectPath)</li>
                        <li>_loadStatusFile()</li>
                        <li>_updateStatusFile()</li>
                        <li>_handleStartImplementation()</li>
                    </ul>
                </div>

                <!-- EnvironmentVariablesAssistantPanel -->
                <div class="module-card">
                    <div class="module-title">EnvironmentVariablesAssistantPanel</div>
                    <ul class="function-list">
                        <li>createOrShow(extensionUri, projectPath)</li>
                        <li>analyzeProject()</li>
                        <li>generateEnvironmentFiles()</li>
                        <li>updateClaudeMd()</li>
                        <li>checkEnvironmentVariables()</li>
                    </ul>
                </div>

                <!-- DebugDetectivePanel -->
                <div class="module-card">
                    <div class="module-title">DebugDetectivePanel</div>
                    <ul class="function-list">
                        <li>createOrShow(extensionUri, projectPath)</li>
                        <li>createErrorSession()</li>
                        <li>analyzeError(errorData)</li>
                        <li>searchKnowledgeBase(query)</li>
                        <li>generateSolution(errorData)</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- 改善計画 -->
        <h2>改善計画</h2>
        <div class="dep-graph">
            <div class="mermaid">
${mermaidTimeline}
            </div>
        </div>

        <footer>
            <p>© 2025 AppGenius Project - ビジュアルダッシュボード v1.0.0</p>
            <p>このダッシュボードは自動的に生成されたものです。更新するには <code>npm run update-dashboard</code> を実行してください。</p>
        </footer>
    </div>

    <script>
        // mermaidの初期化
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: { 
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });

        // 日付を更新
        document.getElementById('updated-date').textContent = new Date().toISOString().split('T')[0];

        // ダークモード切り替え
        document.getElementById('theme-selector').addEventListener('change', function(e) {
            if (e.target.value === 'dark') {
                document.body.style.backgroundColor = '#1e1e1e';
                document.body.style.color = '#d4d4d4';
                // ダークモード時のカード背景色変更
                document.querySelectorAll('.dashboard-card, .module-card, .file-group').forEach(el => {
                    el.style.backgroundColor = '#252526';
                    el.style.color = '#d4d4d4';
                });
            } else {
                document.body.style.backgroundColor = '#f8f9fa';
                document.body.style.color = '#333';
                // ライトモード時のカード背景色変更
                document.querySelectorAll('.dashboard-card, .module-card, .file-group').forEach(el => {
                    el.style.backgroundColor = 'white';
                    el.style.color = '#333';
                });
            }
        });
    </script>
</body>
</html>
    `;
    }
    /**
     * Mermaid形式の依存関係グラフを生成
     */
    _generateMermaidDependencyGraph() {
        if (!this._config) {
            return 'graph TD\n    A[No data]';
        }
        let mermaidGraph = 'graph TD\n';
        // ノードの定義
        const components = Object.values(this._config.components);
        components.forEach(comp => {
            mermaidGraph += `    ${comp.id}[${comp.name}]\n`;
        });
        // 依存関係の定義
        components.forEach(comp => {
            comp.dependencies.forEach(dep => {
                mermaidGraph += `    ${dep} --> ${comp.id}\n`;
            });
        });
        // スタイルの定義
        components.forEach(comp => {
            const style = comp.id === 'ClaudeCodeLauncherService'
                ? 'fill:#28a745,color:#fff'
                : comp.id === 'ScopeManagerPanel'
                    ? 'fill:#007acc,color:#fff'
                    : 'fill:#17a2b8,color:#fff';
            mermaidGraph += `    style ${comp.id} ${style}\n`;
        });
        return mermaidGraph;
    }
    /**
     * Mermaid形式のディレクトリ構造を生成
     */
    _generateMermaidDirStructure() {
        return `graph TD
    Root[Root/] --> A[CLAUDE.md]
    Root --> B[CURRENT_STATUS.md]
    Root --> C[Assistant/]
    Root --> D[mockups/]
    Root --> E[Requirements/]
    Root --> F[docs/]
    Root --> G[logs/]
    Root --> H[reference/]
    
    C --> C1[requirementsadvicer.md]
    C --> C2[mockup_analysis_template.md]
    C --> C3[Scope_Manager_Prompt.md]
    C --> C4[Scope_Implementation_Assistant_Prompt.md]
    C --> C5[DebugDetector.md]
    C --> C6[environmentVariablesAssistant-requirements.md]
    
    D --> D1[*.html]
    D --> D2[metadata.json]
    
    E --> E1[requirements.md]
    E --> E2[scopes/]
    E2 --> E2A[*-requirements.md]
    
    F --> F1[api.md]
    F --> F2[scope.md]
    F --> F3[structure.md]
    F --> F4[env.example]
    
    G --> G1[debug/]
    G1 --> G1A[archived/]
    G1 --> G1B[knowledge/]
    G1 --> G1C[sessions/]
    
    style A fill:#ff6b6b,color:#fff,stroke:#333,stroke-width:2px
    style B fill:#4bcffa,color:#000,stroke:#333,stroke-width:2px
    style C fill:#feca57,color:#000
    style D fill:#1dd1a1,color:#000
    style E fill:#1dd1a1,color:#000
    style F fill:#5f27cd,color:#fff
    style G fill:#54a0ff,color:#000`;
    }
    /**
     * バージョン更新ハンドラーを登録
     */
    registerVersionUpdateHandler(id, handler) {
        this._versionUpdateHandlers.set(id, handler);
    }
    /**
     * surfコマンドを設定
     * ClaudeCode CLIのalias（surf）を設定する
     */
    async configureSurfCommand() {
        try {
            const platformManager = PlatformManager_1.PlatformManager.getInstance();
            const isWindows = platformManager.isWindows();
            const os = isWindows ? 'Windows' : platformManager.isMac() ? 'macOS' : 'Linux';
            // OSに応じたシェル設定ファイルのパス
            const homeDir = platformManager.getHomeDir();
            const shellConfigPath = isWindows
                ? path.join(homeDir, 'profile.ps1')
                : platformManager.isMac()
                    ? path.join(homeDir, '.zshrc')
                    : path.join(homeDir, '.bashrc');
            // alias コマンドの内容
            const aliasCommand = isWindows
                ? `function surf { claude code $args }`
                : `alias surf='claude code'`;
            // シェル設定ファイルが存在するか確認
            let fileContent = '';
            let fileExists = false;
            try {
                fileContent = fs.readFileSync(shellConfigPath, 'utf8');
                fileExists = true;
            }
            catch (error) {
                fileExists = false;
            }
            // すでにalias設定があるか確認
            if (fileExists && fileContent.includes(aliasCommand)) {
                return {
                    success: true,
                    message: `surf コマンドは既に設定されています (${os})`
                };
            }
            // ファイルに追記または新規作成
            let newContent = fileExists
                ? fileContent + '\n\n# Added by AppGenius\n' + aliasCommand + '\n'
                : '# Created by AppGenius\n' + aliasCommand + '\n';
            fs.writeFileSync(shellConfigPath, newContent, 'utf8');
            return {
                success: true,
                message: `surf コマンドを ${shellConfigPath} に設定しました (${os})`
            };
        }
        catch (error) {
            logger_1.Logger.error('surf コマンド設定エラー:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
    /**
     * ツールキット全体を更新
     */
    async updateToolkit() {
        try {
            // すべてのコンポーネント状態を更新
            for (const [id, handler] of this._versionUpdateHandlers.entries()) {
                try {
                    logger_1.Logger.info(`コンポーネント更新を実行: ${id}`);
                    const success = await handler();
                    if (!success) {
                        logger_1.Logger.warn(`コンポーネント更新失敗: ${id}`);
                    }
                }
                catch (error) {
                    logger_1.Logger.error(`コンポーネント更新エラー: ${id}`, error);
                }
            }
            // ダッシュボードを更新
            await this.updateDashboard();
            // 現在の日付を設定
            const today = new Date().toISOString().split('T')[0];
            if (this._config) {
                this._config.lastUpdated = today;
                this._saveConfig();
            }
            logger_1.Logger.info('ツールキット全体の更新が完了しました');
            return true;
        }
        catch (error) {
            logger_1.Logger.error('ツールキット更新エラー:', error);
            return false;
        }
    }
}
exports.ToolkitManager = ToolkitManager;
//# sourceMappingURL=ToolkitManager.js.map