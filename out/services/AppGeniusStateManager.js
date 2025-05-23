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
exports.AppGeniusStateManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../utils/logger");
const AppGeniusEventBus_1 = require("./AppGeniusEventBus");
const ProjectManagementService_1 = require("./ProjectManagementService");
/**
 * AppGenius状態管理サービス
 * 各モジュール間のデータ共有と永続化を担当
 */
class AppGeniusStateManager {
    constructor() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        if (!homeDir) {
            throw new Error('ホームディレクトリが見つかりません。AppGeniusStateManagerの初期化に失敗しました。');
        }
        // メインディレクトリ構造を作成
        const appGeniusDir = path.join(homeDir, '.appgenius-ai');
        this.storageDir = path.join(appGeniusDir, 'state');
        try {
            // 親ディレクトリの存在を確認
            this.ensureDirectoryExists(appGeniusDir);
            // 状態保存ディレクトリの存在を確認
            this.ensureDirectoryExists(this.storageDir);
            // CLIとの連携用ディレクトリも作成
            this.ensureDirectoryExists(path.join(appGeniusDir, 'scopes'));
            this.ensureDirectoryExists(path.join(appGeniusDir, 'temp'));
            this.ensureDirectoryExists(path.join(appGeniusDir, 'logs'));
            logger_1.Logger.info(`ストレージディレクトリを確認しました: ${this.storageDir}`);
        }
        catch (error) {
            logger_1.Logger.error(`ストレージディレクトリの作成に失敗しました: ${error.message}`);
            throw new Error(`AppGeniusStateManagerの初期化に失敗しました: ${error.message}`);
        }
        this.eventBus = AppGeniusEventBus_1.AppGeniusEventBus.getInstance();
        this.projectService = ProjectManagementService_1.ProjectManagementService.getInstance();
        this.registerEventHandlers();
        logger_1.Logger.info('AppGeniusStateManager initialized');
    }
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!AppGeniusStateManager.instance) {
            AppGeniusStateManager.instance = new AppGeniusStateManager();
        }
        return AppGeniusStateManager.instance;
    }
    /**
     * VSCode設定への状態保存
     * @param key 設定キー
     * @param data 保存するデータ
     * @param isGlobal グローバル設定かどうか
     */
    async saveToConfig(key, data, isGlobal = false) {
        try {
            logger_1.Logger.debug(`Saving to config: ${key}`);
            // 既存の設定をクリア
            await vscode.workspace.getConfiguration('appgeniusAI').update(key, null, isGlobal);
            // 新しい設定を保存
            await vscode.workspace.getConfiguration('appgeniusAI').update(key, data, isGlobal);
            // 保存の検証
            const saved = vscode.workspace.getConfiguration('appgeniusAI').get(key);
            if (!saved && data !== null) {
                logger_1.Logger.warn(`保存の検証に失敗: ${key}`);
                // 再試行
                await vscode.workspace.getConfiguration('appgeniusAI').update(key, data, isGlobal);
                // 再検証
                const recheck = vscode.workspace.getConfiguration('appgeniusAI').get(key);
                if (!recheck && data !== null) {
                    throw new Error(`設定の保存に失敗しました: ${key}`);
                }
            }
            logger_1.Logger.debug(`Successfully saved to config: ${key}`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to save to config: ${key}`, error);
            throw error;
        }
    }
    /**
     * VSCode設定からの状態取得
     * @param key 設定キー
     * @param defaultValue デフォルト値
     */
    getFromConfig(key, defaultValue) {
        try {
            return vscode.workspace.getConfiguration('appgeniusAI').get(key, defaultValue);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to get from config: ${key}`, error);
            return defaultValue;
        }
    }
    /**
     * プロジェクトのローカルデータを保存
     * @param projectId プロジェクトID
     * @param key データキー
     * @param data 保存するデータ
     */
    async saveProjectData(projectId, key, data) {
        try {
            const projectDir = path.join(this.storageDir, projectId);
            this.ensureDirectoryExists(projectDir);
            const filePath = path.join(projectDir, `${key}.json`);
            // 一時ファイルに書き込んで、成功したら名前を変更（より安全な書き込み）
            const tempFilePath = `${filePath}.tmp`;
            await fs.promises.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf8');
            // 既存のファイルがあれば念のためバックアップ
            if (fs.existsSync(filePath)) {
                const backupPath = `${filePath}.bak`;
                try {
                    await fs.promises.copyFile(filePath, backupPath);
                }
                catch (backupErr) {
                    logger_1.Logger.warn(`バックアップの作成に失敗: ${filePath}`, backupErr);
                }
            }
            // 一時ファイルを本番ファイルに移動（原子的操作）
            try {
                await fs.promises.rename(tempFilePath, filePath);
            }
            catch (renameErr) {
                // 名前変更に失敗した場合は直接コピー
                logger_1.Logger.warn(`ファイル名変更に失敗、コピーを試みます: ${filePath}`, renameErr);
                await fs.promises.copyFile(tempFilePath, filePath);
                await fs.promises.unlink(tempFilePath).catch(() => { });
            }
            // ファイルの存在を確認
            if (!fs.existsSync(filePath)) {
                throw new Error(`ファイルが作成されませんでした: ${filePath}`);
            }
            // VSCode設定にもバックアップ（冗長性のため）
            await this.saveToConfig(`projectData.${projectId}.${key}`, data, true);
            // プロジェクトの更新日時を更新
            const project = this.projectService.getProject(projectId);
            if (project) {
                await this.projectService.updateProject(projectId, {
                    updatedAt: Date.now()
                });
            }
            logger_1.Logger.debug(`Saved project data: ${projectId}.${key}`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to save project data: ${projectId}.${key}`, error);
            throw error;
        }
    }
    /**
     * プロジェクトのローカルデータを取得
     * @param projectId プロジェクトID
     * @param key データキー
     * @param defaultValue デフォルト値
     */
    async getProjectData(projectId, key, defaultValue) {
        const startTime = Date.now();
        try {
            const filePath = path.join(this.storageDir, projectId, `${key}.json`);
            logger_1.Logger.debug(`データ読み込み開始: ${filePath}`);
            // 1. メインファイルからの読み込み試行
            if (fs.existsSync(filePath)) {
                try {
                    const data = await fs.promises.readFile(filePath, 'utf8');
                    const result = JSON.parse(data);
                    logger_1.Logger.debug(`ファイルからデータを読み込みました: ${filePath}`);
                    return result;
                }
                catch (fileError) {
                    logger_1.Logger.warn(`ファイルからの読み込みに失敗: ${filePath}`, fileError);
                    // 読み込み失敗、バックアップを試す
                }
            }
            else {
                logger_1.Logger.debug(`ファイルが存在しません: ${filePath}`);
            }
            // 2. バックアップファイルからの読み込み試行
            const backupPath = `${filePath}.bak`;
            if (fs.existsSync(backupPath)) {
                try {
                    const backupData = await fs.promises.readFile(backupPath, 'utf8');
                    const backupResult = JSON.parse(backupData);
                    logger_1.Logger.info(`バックアップからデータを復元: ${backupPath}`);
                    // 復元したデータを正規のファイルに保存（自己修復）
                    await this.saveProjectData(projectId, key, backupResult);
                    return backupResult;
                }
                catch (backupError) {
                    logger_1.Logger.warn(`バックアップからの読み込みに失敗: ${backupPath}`, backupError);
                }
            }
            // 3. VSCode設定からの読み込み試行
            try {
                const configKey = `projectData.${projectId}.${key}`;
                const configData = vscode.workspace.getConfiguration('appgeniusAI').get(configKey);
                if (configData) {
                    logger_1.Logger.info(`VSCode設定からデータを復元: ${configKey}`);
                    // 復元したデータをファイルに保存（自己修復）
                    await this.saveProjectData(projectId, key, configData);
                    return configData;
                }
            }
            catch (configError) {
                logger_1.Logger.warn(`VSCode設定からの読み込みに失敗: ${projectId}.${key}`, configError);
            }
            // すべての方法で失敗した場合はデフォルト値を返す
            logger_1.Logger.warn(`すべての読み込み方法が失敗、デフォルト値を使用: ${projectId}.${key}`);
            return defaultValue;
        }
        catch (error) {
            const endTime = Date.now();
            logger_1.Logger.error(`データ読み込み失敗: ${projectId}.${key} (${endTime - startTime}ms)`, error);
            // 問題診断のための追加情報
            try {
                const filePath = path.join(this.storageDir, projectId, `${key}.json`);
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    logger_1.Logger.debug(`問題のファイル情報: サイズ=${stats.size}バイト, 更新=${stats.mtime}`);
                }
            }
            catch (diagError) { }
            return defaultValue;
        }
    }
    /**
     * 要件定義の保存
     * @param projectId プロジェクトID
     * @param requirements 要件定義データ
     */
    async saveRequirements(projectId, requirements) {
        try {
            // プロジェクトパスを取得
            const project = this.projectService.getProject(projectId);
            if (!project || !project.path) {
                // プロジェクトパスが設定されていない場合は従来の方法で保存
                await this.saveProjectData(projectId, 'requirements', requirements);
            }
            else {
                // 新しいプロジェクト構造に保存
                const requirementsPath = path.join(project.path, 'docs', 'requirements.md');
                this.ensureDirectoryExists(path.dirname(requirementsPath));
                // 構造化された要件データをマークダウンに変換
                const markdownContent = this.convertRequirementsToMarkdown(requirements);
                // ファイルに保存
                await fs.promises.writeFile(requirementsPath, markdownContent, 'utf8');
                logger_1.Logger.info(`Requirements saved to ${requirementsPath}`);
                // 初期テンプレートからの変更を確認
                const isChanged = this.isRequirementsChangedFromInitial(markdownContent);
                // CLAUDE.mdのセクションも更新
                try {
                    const { ClaudeMdService } = await Promise.resolve().then(() => __importStar(require('../utils/ClaudeMdService')));
                    const claudeMdService = ClaudeMdService.getInstance();
                    claudeMdService.updateClaudeMdSection(project.path, '要件定義', `[要件定義ファイル](./docs/requirements.md) - ${requirements.extractedItems.length}個の要件が定義されています。`);
                }
                catch (e) {
                    logger_1.Logger.warn(`Failed to update CLAUDE.md: ${e.message}`);
                }
                // バックアップとして従来の方法でも保存
                await this.saveProjectData(projectId, 'requirements', requirements);
            }
            // 要件定義完了フェーズを更新 (すでに取得したプロジェクト情報を再利用)
            if (project) {
                // 変更が十分であれば完了とマーク
                const updatePhase = true; // 常にtrueとして処理（以前の条件は削除）
                await this.projectService.updateProjectPhase(projectId, 'requirements', updatePhase);
                // イベント発火
                this.eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.REQUIREMENTS_UPDATED, requirements, 'AppGeniusStateManager', projectId);
            }
        }
        catch (error) {
            logger_1.Logger.error(`Failed to save requirements: ${error.message}`);
            throw error;
        }
    }
    /**
     * 要件定義の取得
     * @param projectId プロジェクトID
     */
    async getRequirements(projectId) {
        try {
            // プロジェクトパスを取得
            const project = this.projectService.getProject(projectId);
            if (!project || !project.path) {
                // プロジェクトパスが設定されていない場合は従来の方法で取得
                return this.getProjectData(projectId, 'requirements', undefined);
            }
            // 新しいプロジェクト構造から読み込み
            const requirementsPath = path.join(project.path, 'docs', 'requirements.md');
            if (fs.existsSync(requirementsPath)) {
                // マークダウンからRequirementsオブジェクトに変換
                const markdownContent = await fs.promises.readFile(requirementsPath, 'utf8');
                const requirements = this.convertMarkdownToRequirements(markdownContent);
                return requirements;
            }
            // 新しい場所に見つからない場合は従来の方法で取得
            return this.getProjectData(projectId, 'requirements', undefined);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to get requirements: ${error.message}`);
            return undefined;
        }
    }
    /**
     * ディレクトリ構造の保存
     * @param projectId プロジェクトID
     * @param structureContent ディレクトリ構造のマークダウン内容
     */
    async saveStructure(projectId, structureContent) {
        try {
            // プロジェクトパスを取得
            const project = this.projectService.getProject(projectId);
            if (!project || !project.path) {
                throw new Error('プロジェクトパスが設定されていません');
            }
            // 新しいプロジェクト構造に保存
            const structurePath = path.join(project.path, 'docs', 'structure.md');
            this.ensureDirectoryExists(path.dirname(structurePath));
            // ファイルに保存
            await fs.promises.writeFile(structurePath, structureContent, 'utf8');
            logger_1.Logger.info(`Directory structure saved to ${structurePath}`);
            // 初期テンプレートからの変更を確認
            const isChanged = this.isStructureChangedFromInitial(structureContent);
            // 変更されていればフェーズを更新
            if (isChanged) {
                // directoryStructureは直接のフェーズではないため、設計(design)フェーズとして扱う
                await this.projectService.updateProjectPhase(projectId, 'design', true);
                // CLAUDE.mdのセクションも更新
                try {
                    const { ClaudeMdService } = await Promise.resolve().then(() => __importStar(require('../utils/ClaudeMdService')));
                    const claudeMdService = ClaudeMdService.getInstance();
                    claudeMdService.updateClaudeMdSection(project.path, 'ディレクトリ構造', `[ディレクトリ構造ファイル](./docs/structure.md) - カスタム構造が定義されています。`);
                    // ファイル一覧の抽出も実行
                    await claudeMdService.extractFileListFromStructure(project.path);
                }
                catch (e) {
                    logger_1.Logger.warn(`Failed to update CLAUDE.md: ${e.message}`);
                }
                // イベント発火
                this.eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.PROJECT_STRUCTURE_UPDATED, { content: structureContent }, 'AppGeniusStateManager', projectId);
            }
        }
        catch (error) {
            logger_1.Logger.error(`Failed to save structure: ${error.message}`);
            throw error;
        }
    }
    /**
     * ディレクトリ構造が初期テンプレートから変更されているか確認
     * @param content 現在の構造ファイルの内容
     */
    isStructureChangedFromInitial(content) {
        // 初期テンプレートの内容（DashboardPanel._createInitialDocumentsから抽出）
        const initialStructureTemplate = `# ディレクトリ構造

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
\`\`\``;
        // 初期テンプレートと異なるか確認
        // 厳密な比較ではなく、コンテンツが十分に変更されているかを判断
        // カスタマイズコード：明らかに初期テンプレートと異なる構造かチェック
        // 行数が異なるか確認
        const contentLines = content.split('\n').filter(line => line.trim() !== '');
        const templateLines = initialStructureTemplate.split('\n').filter(line => line.trim() !== '');
        // 行数が明らかに異なる場合は変更されたと判断
        if (Math.abs(contentLines.length - templateLines.length) > 3) {
            return true;
        }
        // 同じ行数でも内容が異なるか確認（最低でも30%以上の行が変更されていること）
        let differentLines = 0;
        for (let i = 0; i < Math.min(contentLines.length, templateLines.length); i++) {
            if (contentLines[i] !== templateLines[i]) {
                differentLines++;
            }
        }
        const diffPercentage = differentLines / Math.min(contentLines.length, templateLines.length);
        return diffPercentage > 0.3; // 30%以上の行が異なる場合は変更されたと判断
    }
    /**
     * 要件定義が初期テンプレートから変更されているか確認
     * @param content 現在の要件定義ファイルの内容
     */
    isRequirementsChangedFromInitial(content) {
        // 初期テンプレートの内容（DashboardPanel._createInitialDocumentsから抽出）
        const initialRequirementsTemplate = `# 要件定義

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

- ユーザーとして、[機能]を使いたい。それによって[目的]を達成できる。`;
        // 初期テンプレートと異なるか確認
        // 厳密な比較ではなく、コンテンツが十分に変更されているかを判断
        // 行数が異なるか確認
        const contentLines = content.split('\n').filter(line => line.trim() !== '');
        const templateLines = initialRequirementsTemplate.split('\n').filter(line => line.trim() !== '');
        // 行数が明らかに異なる場合は変更されたと判断
        if (Math.abs(contentLines.length - templateLines.length) > 3) {
            return true;
        }
        // 同じ行数でも内容が異なるか確認（最低でも30%以上の行が変更されていること）
        let differentLines = 0;
        for (let i = 0; i < Math.min(contentLines.length, templateLines.length); i++) {
            if (contentLines[i] !== templateLines[i]) {
                differentLines++;
            }
        }
        const diffPercentage = differentLines / Math.min(contentLines.length, templateLines.length);
        return diffPercentage > 0.3; // 30%以上の行が異なる場合は変更されたと判断
    }
    /**
     * 要件定義をマークダウンに変換
     */
    convertRequirementsToMarkdown(requirements) {
        let markdown = '# 要件定義\n\n';
        // ドキュメント全体の内容
        if (requirements.document) {
            markdown += requirements.document + '\n\n';
        }
        // 機能要件セクション
        markdown += '## 機能要件\n\n';
        const functionalItems = requirements.extractedItems.filter(item => item.title.toLowerCase().includes('機能') ||
            !item.title.toLowerCase().includes('非機能'));
        functionalItems.forEach((item, index) => {
            markdown += `${index + 1}. ${item.title}\n`;
            markdown += `   - 説明: ${item.description}\n`;
            markdown += `   - 優先度: ${item.priority}\n`;
            markdown += '\n';
        });
        // 非機能要件セクション
        markdown += '## 非機能要件\n\n';
        const nonFunctionalItems = requirements.extractedItems.filter(item => item.title.toLowerCase().includes('非機能'));
        if (nonFunctionalItems.length > 0) {
            nonFunctionalItems.forEach((item, index) => {
                markdown += `${index + 1}. ${item.title}\n`;
                markdown += `   - 説明: ${item.description}\n`;
                markdown += `   - 優先度: ${item.priority}\n`;
                markdown += '\n';
            });
        }
        else {
            markdown += '準備中...\n\n';
        }
        // セクション（追加情報）
        if (requirements.sections && requirements.sections.length > 0) {
            requirements.sections.forEach(section => {
                if (section.title && !section.title.toLowerCase().includes('機能要件') &&
                    !section.title.toLowerCase().includes('非機能要件')) {
                    markdown += `## ${section.title}\n\n`;
                    markdown += `${section.content}\n\n`;
                }
            });
        }
        return markdown;
    }
    /**
     * マークダウンから要件定義オブジェクトに変換
     */
    convertMarkdownToRequirements(markdown) {
        const requirements = {
            document: '',
            sections: [],
            extractedItems: [],
            chatHistory: []
        };
        try {
            // セクション分割
            const sections = markdown.split(/^##\s+/m).filter(Boolean);
            // メインドキュメント部分
            if (sections[0] && sections[0].startsWith('# ')) {
                const mainContent = sections[0].replace(/^#\s+.*?\n/m, '').trim();
                requirements.document = mainContent;
            }
            // 各セクションを処理
            for (let i = 1; i < sections.length; i++) {
                const section = sections[i];
                const titleMatch = section.match(/^(.*?)\n/);
                const title = titleMatch ? titleMatch[1].trim() : `Section ${i}`;
                const content = section.replace(/^.*?\n/, '').trim();
                requirements.sections.push({
                    id: `section_${Date.now()}_${i}`,
                    title,
                    content
                });
                // 機能要件と非機能要件からアイテムを抽出
                if (title.toLowerCase().includes('機能要件') || title.toLowerCase().includes('非機能要件')) {
                    const requirementItems = content.split(/^\d+\.\s+/m).filter(Boolean);
                    requirementItems.forEach(item => {
                        const lines = item.split('\n').filter(line => line.trim() !== '');
                        if (lines.length > 0) {
                            const title = lines[0].trim();
                            let description = '';
                            let priority = 'medium';
                            for (let j = 1; j < lines.length; j++) {
                                const line = lines[j].trim();
                                if (line.startsWith('- 説明:')) {
                                    description = line.replace('- 説明:', '').trim();
                                }
                                else if (line.startsWith('- 優先度:')) {
                                    const priorityStr = line.replace('- 優先度:', '').trim().toLowerCase();
                                    if (['high', 'medium', 'low'].includes(priorityStr)) {
                                        priority = priorityStr;
                                    }
                                }
                            }
                            requirements.extractedItems.push({
                                id: `req_${Date.now()}_${requirements.extractedItems.length}`,
                                title,
                                description,
                                priority: priority
                            });
                        }
                    });
                }
            }
            return requirements;
        }
        catch (error) {
            logger_1.Logger.error(`Error converting markdown to requirements: ${error.message}`);
            return requirements;
        }
    }
    /**
     * モックアップの保存
     * @param projectId プロジェクトID
     * @param mockup モックアップデータ
     */
    async saveMockup(projectId, mockup) {
        // 既存のモックアップリストを取得
        const mockups = await this.getProjectData(projectId, 'mockups', []);
        // 既存のモックアップを更新または新規追加
        const index = mockups.findIndex(m => m.id === mockup.id);
        if (index >= 0) {
            mockups[index] = mockup;
        }
        else {
            mockups.push(mockup);
        }
        // 保存
        await this.saveProjectData(projectId, 'mockups', mockups);
        // デザインフェーズが1つ以上のモックアップで完了とみなす
        if (mockups.length > 0) {
            const project = this.projectService.getProject(projectId);
            if (project) {
                await this.projectService.updateProjectPhase(projectId, 'design', true);
            }
        }
        // イベント発火
        this.eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.MOCKUP_CREATED, mockup, 'AppGeniusStateManager', projectId);
    }
    /**
     * モックアップリストの取得
     * @param projectId プロジェクトID
     */
    async getMockups(projectId) {
        return this.getProjectData(projectId, 'mockups', []);
    }
    /**
     * 実装スコープの保存
     * @param projectId プロジェクトID
     * @param scope 実装スコープデータ
     */
    async saveImplementationScope(projectId, scope) {
        try {
            logger_1.Logger.info(`実装スコープを保存します: プロジェクト ${projectId}`);
            // CLIとの連携用にスコープIDが設定されていることを確認
            if (!scope.id) {
                scope.id = `scope-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                logger_1.Logger.debug(`スコープIDを生成しました: ${scope.id}`);
            }
            // プロジェクトの取得
            const project = this.projectService.getProject(projectId);
            // プロジェクトパスが設定されている場合は、新しい構造に保存
            if (project && project.path) {
                const scopePath = path.join(project.path, 'docs', 'scope.md');
                this.ensureDirectoryExists(path.dirname(scopePath));
                // 構造化されたスコープデータをマークダウンに変換
                const markdownContent = this.convertScopeToMarkdown(scope);
                // ファイルに保存
                await fs.promises.writeFile(scopePath, markdownContent, 'utf8');
                logger_1.Logger.info(`Scope saved to ${scopePath}`);
                // CLAUDE.mdのセクションも更新
                try {
                    const { ClaudeMdService } = await Promise.resolve().then(() => __importStar(require('../utils/ClaudeMdService')));
                    const claudeMdService = ClaudeMdService.getInstance();
                    claudeMdService.updateClaudeMdSection(project.path, '実装スコープ', `[実装スコープファイル](./docs/scope.md) - 進捗: ${scope.totalProgress}% (${scope.items.filter(i => i.status === 'completed').length}/${scope.items.length}項目完了)`);
                    // 進捗状況も更新
                    const statusSection = `- 要件定義: ${project.phases.requirements ? '完了' : '未完了'}\n` +
                        `- モックアップ: ${project.phases.design ? '完了' : '未完了'}\n` +
                        `- ディレクトリ構造: ${project.phases.implementation ? '完了' : '未完了'}\n` +
                        `- 実装: ${scope.totalProgress === 100 ? '完了' : scope.totalProgress > 0 ? `${scope.totalProgress}%完了` : '未開始'}\n` +
                        `- テスト: ${project.phases.testing ? '完了' : '未開始'}\n` +
                        `- デプロイ: ${project.phases.deployment ? '完了' : '未開始'}`;
                    claudeMdService.updateClaudeMdSection(project.path, '進捗状況', statusSection);
                    // チェックリストも更新
                    const checklistSection = `- [${project.phases.requirements ? 'x' : ' '}] 要件定義の完了\n` +
                        `- [${project.phases.design ? 'x' : ' '}] モックアップの作成\n` +
                        `- [${project.phases.implementation ? 'x' : ' '}] ディレクトリ構造の確定\n` +
                        `- [${scope.items.length > 0 ? 'x' : ' '}] API設計の完了\n` +
                        `- [ ] 環境変数の設定\n` +
                        `- [${scope.items.length > 0 ? 'x' : ' '}] 実装スコープの決定\n` +
                        `- [${scope.totalProgress > 0 ? 'x' : ' '}] 実装の開始\n` +
                        `- [${project.phases.testing ? 'x' : ' '}] テストの実施\n` +
                        `- [${project.phases.deployment ? 'x' : ' '}] デプロイの準備`;
                    claudeMdService.updateClaudeMdSection(project.path, 'チェックリスト', checklistSection);
                }
                catch (e) {
                    logger_1.Logger.warn(`Failed to update CLAUDE.md: ${e.message}`);
                }
            }
            // ProjectDataに保存（バックアップとして）
            await this.saveProjectData(projectId, 'implementationScope', scope);
            // VSCode設定にも直接保存（CLIとの連携用）
            await this.saveToConfig('implementationScope', scope, true);
            // CLI連携用の一時ファイルも作成
            try {
                // ホームディレクトリに.appgenius/scopesディレクトリを作成
                const homeDir = process.env.HOME || process.env.USERPROFILE || '';
                const scopesDir = path.join(homeDir, '.appgenius-ai', 'scopes');
                this.ensureDirectoryExists(scopesDir);
                // スコープファイルを作成（CLIから直接アクセスできるように）
                const scopeFilePath = path.join(scopesDir, `${scope.id}.json`);
                // 一時ファイルに書き込んでから名前変更
                const tempFilePath = `${scopeFilePath}.tmp`;
                await fs.promises.writeFile(tempFilePath, JSON.stringify(scope, null, 2), 'utf8');
                if (fs.existsSync(scopeFilePath)) {
                    await fs.promises.unlink(scopeFilePath).catch(() => { });
                }
                await fs.promises.rename(tempFilePath, scopeFilePath);
                logger_1.Logger.info(`CLIアクセス用のスコープファイルを作成しました: ${scopeFilePath}`);
            }
            catch (cliError) {
                logger_1.Logger.warn(`CLI連携用のスコープファイル作成に失敗しました: ${cliError.message}`);
                // CLIファイル作成のエラーは無視（メイン処理は続行）
            }
            // スコープが設定されたら実装フェーズが開始されたとみなす
            // 進捗状況に基づいて実装フェーズの完了状態を更新
            if (project) {
                const isCompleted = scope.totalProgress >= 100;
                await this.projectService.updateProjectPhase(projectId, 'implementation', isCompleted);
            }
            // イベント発火
            this.eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.SCOPE_UPDATED, scope, 'AppGeniusStateManager', projectId);
            logger_1.Logger.info(`実装スコープの保存が完了しました: プロジェクト ${projectId}`);
        }
        catch (error) {
            logger_1.Logger.error(`実装スコープの保存に失敗しました: プロジェクト ${projectId}`, error);
            throw error;
        }
    }
    /**
     * 実装スコープの取得
     * @param projectId プロジェクトID
     */
    async getImplementationScope(projectId) {
        try {
            // プロジェクトパスを取得
            const project = this.projectService.getProject(projectId);
            if (!project || !project.path) {
                // プロジェクトパスが設定されていない場合は従来の方法で取得
                return this.getProjectData(projectId, 'implementationScope', undefined);
            }
            // 新しいプロジェクト構造から読み込み
            const scopePath = path.join(project.path, 'docs', 'scope.md');
            if (fs.existsSync(scopePath)) {
                // マークダウンからImplementationScopeオブジェクトに変換
                const markdownContent = await fs.promises.readFile(scopePath, 'utf8');
                const scope = this.convertMarkdownToScope(markdownContent, project.path);
                return scope;
            }
            // 新しい場所に見つからない場合は従来の方法で取得
            return this.getProjectData(projectId, 'implementationScope', undefined);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to get implementation scope: ${error.message}`);
            return undefined;
        }
    }
    /**
     * 実装スコープをマークダウンに変換
     */
    convertScopeToMarkdown(scope) {
        let markdown = '# 実装スコープ\n\n';
        // 完了した項目
        markdown += '## 完了\n\n';
        const completedItems = scope.items.filter(item => item.status === 'completed');
        if (completedItems.length > 0) {
            completedItems.forEach((item, index) => {
                markdown += `${index + 1}. ${item.title}\n`;
                markdown += `   - 説明: ${item.description}\n`;
                markdown += `   - 優先度: ${item.priority}\n`;
                markdown += `   - 複雑度: ${item.complexity}\n`;
                if (item.relatedFiles && item.relatedFiles.length > 0) {
                    markdown += `   - 関連ファイル: ${item.relatedFiles.join(', ')}\n`;
                }
                markdown += '\n';
            });
        }
        else {
            markdown += '（まだ完了した項目はありません）\n\n';
        }
        // 進行中の項目
        markdown += '## 進行中\n\n';
        const inProgressItems = scope.items.filter(item => item.status === 'in-progress');
        if (inProgressItems.length > 0) {
            inProgressItems.forEach((item, index) => {
                markdown += `${index + 1}. ${item.title}\n`;
                markdown += `   - 説明: ${item.description}\n`;
                markdown += `   - 優先度: ${item.priority}\n`;
                markdown += `   - 複雑度: ${item.complexity}\n`;
                markdown += `   - 進捗: ${item.progress}%\n`;
                if (item.relatedFiles && item.relatedFiles.length > 0) {
                    markdown += `   - 関連ファイル: ${item.relatedFiles.join(', ')}\n`;
                }
                markdown += '\n';
            });
        }
        else {
            markdown += '（実装中の項目がここに表示されます）\n\n';
        }
        // 未着手の項目
        markdown += '## 未着手\n\n';
        const pendingItems = scope.items.filter(item => item.status === 'pending');
        if (pendingItems.length > 0) {
            pendingItems.forEach((item, index) => {
                markdown += `${index + 1}. ${item.title}\n`;
                markdown += `   - 説明: ${item.description}\n`;
                markdown += `   - 優先度: ${item.priority}\n`;
                markdown += `   - 複雑度: ${item.complexity}\n`;
                if (item.dependencies && item.dependencies.length > 0) {
                    markdown += `   - 依存関係: ${item.dependencies.join(', ')}\n`;
                }
                markdown += '\n';
            });
        }
        else {
            markdown += '（未着手の項目がここに表示されます）\n\n';
        }
        // 全体の進捗情報
        markdown += '## 進捗情報\n\n';
        markdown += `- 全体進捗: ${scope.totalProgress}%\n`;
        markdown += `- 開始日: ${scope.startDate || '未設定'}\n`;
        markdown += `- 目標日: ${scope.targetDate || '未設定'}\n`;
        markdown += `- 合計項目数: ${scope.items.length}\n`;
        markdown += `- 完了項目数: ${completedItems.length}\n`;
        markdown += `- 進行中項目数: ${inProgressItems.length}\n`;
        markdown += `- 未着手項目数: ${pendingItems.length}\n`;
        return markdown;
    }
    /**
     * マークダウンから実装スコープオブジェクトに変換
     */
    convertMarkdownToScope(markdown, projectPath) {
        const scopeTemplate = {
            id: `scope-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            items: [],
            selectedIds: [],
            estimatedTime: '',
            totalProgress: 0,
            startDate: new Date().toISOString().split('T')[0],
            targetDate: '',
            projectPath: projectPath
        };
        try {
            // セクション分割
            const sections = markdown.split(/^##\s+/m).filter(Boolean);
            // 進捗情報セクションの処理
            const progressSection = sections.find(section => section.trim().startsWith('進捗情報'));
            if (progressSection) {
                const progressLines = progressSection.split('\n').filter(line => line.trim() !== '');
                for (const line of progressLines) {
                    if (line.includes('全体進捗:')) {
                        const progress = line.match(/\d+/);
                        if (progress) {
                            scopeTemplate.totalProgress = parseInt(progress[0], 10);
                        }
                    }
                    else if (line.includes('開始日:')) {
                        const startDate = line.replace('- 開始日:', '').trim();
                        if (startDate !== '未設定') {
                            scopeTemplate.startDate = startDate;
                        }
                    }
                    else if (line.includes('目標日:')) {
                        const targetDate = line.replace('- 目標日:', '').trim();
                        if (targetDate !== '未設定') {
                            scopeTemplate.targetDate = targetDate;
                        }
                    }
                }
            }
            // 完了項目の処理
            this.extractImplementationItems(markdown, '完了', 'completed', scopeTemplate);
            // 進行中項目の処理
            this.extractImplementationItems(markdown, '進行中', 'in-progress', scopeTemplate);
            // 未着手項目の処理
            this.extractImplementationItems(markdown, '未着手', 'pending', scopeTemplate);
            // 選択されたIDの設定（デフォルトですべてを選択）
            scopeTemplate.selectedIds = scopeTemplate.items.map(item => item.id);
            // 全体の進捗を再計算
            const completedItems = scopeTemplate.items.filter(item => item.status === 'completed').length;
            if (scopeTemplate.items.length > 0) {
                scopeTemplate.totalProgress = Math.round((completedItems / scopeTemplate.items.length) * 100);
            }
            else {
                scopeTemplate.totalProgress = 0;
            }
            return scopeTemplate;
        }
        catch (error) {
            logger_1.Logger.error(`Error converting markdown to scope: ${error.message}`);
            return scopeTemplate;
        }
    }
    /**
     * マークダウンから実装項目を抽出
     */
    extractImplementationItems(markdown, sectionName, status, scope) {
        try {
            // セクションを正規表現で抽出
            const sectionPattern = new RegExp(`## ${sectionName}([\\s\\S]*?)(?=##|$)`, 'm');
            const match = markdown.match(sectionPattern);
            if (match && match[1]) {
                const sectionContent = match[1].trim();
                if (sectionContent.includes('（まだ完了した項目はありません）') ||
                    sectionContent.includes('（実装中の項目がここに表示されます）') ||
                    sectionContent.includes('（未着手の項目がここに表示されます）')) {
                    return;
                }
                // 項目を抽出
                const itemPattern = /^\d+\.\s+(.*?)(?=^\d+\.|$)/gms;
                let itemMatch;
                while ((itemMatch = itemPattern.exec(sectionContent)) !== null) {
                    const itemContent = itemMatch[0].trim();
                    const lines = itemContent.split('\n').filter(line => line.trim() !== '');
                    if (lines.length > 0) {
                        // タイトルを抽出（"1. タイトル" 形式から "タイトル" を取得）
                        const titleLine = lines[0];
                        const title = titleLine.replace(/^\d+\.\s+/, '').trim();
                        // 初期値を設定
                        const item = {
                            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                            title,
                            description: '',
                            priority: 'medium',
                            complexity: 'medium',
                            isSelected: true,
                            dependencies: [],
                            status: status,
                            progress: status === 'completed' ? 100 : status === 'in-progress' ? 50 : 0
                        };
                        // 詳細情報を抽出
                        for (let i = 1; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (line.startsWith('- 説明:')) {
                                item.description = line.replace('- 説明:', '').trim();
                            }
                            else if (line.startsWith('- 優先度:')) {
                                const priority = line.replace('- 優先度:', '').trim().toLowerCase();
                                if (['high', 'medium', 'low'].includes(priority)) {
                                    item.priority = priority;
                                }
                            }
                            else if (line.startsWith('- 複雑度:')) {
                                const complexity = line.replace('- 複雑度:', '').trim().toLowerCase();
                                if (['high', 'medium', 'low'].includes(complexity)) {
                                    item.complexity = complexity;
                                }
                            }
                            else if (line.startsWith('- 進捗:')) {
                                const progressMatch = line.match(/\d+/);
                                if (progressMatch) {
                                    item.progress = parseInt(progressMatch[0], 10);
                                }
                            }
                            else if (line.startsWith('- 関連ファイル:')) {
                                const files = line.replace('- 関連ファイル:', '').trim();
                                item.relatedFiles = files.split(',').map(f => f.trim());
                            }
                            else if (line.startsWith('- 依存関係:')) {
                                const deps = line.replace('- 依存関係:', '').trim();
                                item.dependencies = deps.split(',').map(d => d.trim());
                            }
                        }
                        // 配列に追加
                        scope.items.push(item);
                    }
                }
            }
        }
        catch (error) {
            logger_1.Logger.error(`Error extracting implementation items: ${error.message}`);
        }
    }
    /**
     * 実装進捗の更新
     * @param projectId プロジェクトID
     * @param items 実装項目リスト
     * @param totalProgress 全体進捗
     */
    async updateImplementationProgress(projectId, items, totalProgress) {
        // 既存のスコープを取得
        const scope = await this.getImplementationScope(projectId);
        if (!scope) {
            return;
        }
        // 進捗を更新
        scope.items = items;
        scope.totalProgress = totalProgress;
        // 保存
        await this.saveImplementationScope(projectId, scope);
        // 進捗状況をプロジェクトにも反映
        const project = this.projectService.getProject(projectId);
        if (project) {
            // 全ての項目が完了したら実装フェーズ完了
            const isImplementationCompleted = totalProgress >= 100;
            await this.projectService.updateProjectPhase(projectId, 'implementation', isImplementationCompleted);
            // イベント発火
            this.eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.IMPLEMENTATION_PROGRESS, { items, totalProgress }, 'AppGeniusStateManager', projectId);
        }
    }
    /**
     * プロジェクトパスを更新
     * @param projectId プロジェクトID
     * @param projectPath プロジェクトパス
     */
    async updateProjectPath(projectId, projectPath) {
        try {
            if (!projectId || !projectPath) {
                throw new Error('プロジェクトIDとパスは必須です');
            }
            logger_1.Logger.debug(`プロジェクトパス更新開始: ID=${projectId}, パス=${projectPath}`);
            // プロジェクトの存在確認
            const project = this.projectService.getProject(projectId);
            if (!project) {
                throw new Error(`プロジェクトが見つかりません: ${projectId}`);
            }
            // 既存のパスと同じ場合は何もしない
            if (project.path === projectPath) {
                logger_1.Logger.debug(`プロジェクトパスは既に設定されています: ${projectPath}`);
                return;
            }
            // パス更新
            await this.projectService.updateProject(projectId, { path: projectPath });
            // イベント発火
            this.eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.PROJECT_PATH_UPDATED, { projectId, projectPath }, 'AppGeniusStateManager', projectId);
            logger_1.Logger.info(`プロジェクトパスを更新しました: ID=${projectId}, パス=${projectPath}`);
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクトパス更新エラー: ${error.message}`);
            throw error;
        }
    }
    /**
     * 現在アクティブなプロジェクトのパスを取得
     * @returns プロジェクトパス。アクティブなプロジェクトがない場合は空文字列を返す
     */
    getCurrentProjectPath() {
        try {
            const activeProject = this.projectService.getActiveProject();
            if (!activeProject) {
                return '';
            }
            return activeProject.path || '';
        }
        catch (error) {
            logger_1.Logger.error(`アクティブプロジェクトパス取得エラー: ${error.message}`);
            return '';
        }
    }
    /**
     * 指定したプロジェクトIDのパスを取得
     * @param projectId プロジェクトID
     * @returns プロジェクトパス。プロジェクトが見つからない場合は空文字列を返す
     */
    getProjectPath(projectId) {
        try {
            if (!projectId) {
                return '';
            }
            const project = this.projectService.getProject(projectId);
            if (!project) {
                return '';
            }
            return project.path || '';
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクトパス取得エラー: ID=${projectId}, エラー=${error.message}`);
            return '';
        }
    }
    /**
     * イベントハンドラの登録
     */
    registerEventHandlers() {
        // プロジェクト作成イベント
        this.eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.PROJECT_CREATED, async (event) => {
            const projectId = event.data?.id;
            if (projectId) {
                logger_1.Logger.info(`Project created event received: ${projectId}`);
                // プロジェクトディレクトリ作成
                const projectDir = path.join(this.storageDir, projectId);
                this.ensureDirectoryExists(projectDir);
            }
        });
        // プロジェクト削除イベント
        this.eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.PROJECT_DELETED, async (event) => {
            const projectId = event.data?.id;
            if (projectId) {
                logger_1.Logger.info(`Project deleted event received: ${projectId}`);
                // プロジェクトデータの削除
                const projectDir = path.join(this.storageDir, projectId);
                if (fs.existsSync(projectDir)) {
                    await this.deleteDirectory(projectDir);
                }
            }
        });
        // フェーズ完了イベント
        this.eventBus.onEventType(AppGeniusEventBus_1.AppGeniusEventType.PHASE_COMPLETED, async (event) => {
            const { projectId, phase, isCompleted } = event.data;
            if (projectId && phase) {
                logger_1.Logger.info(`Phase completed event received: ${projectId}.${phase} = ${isCompleted}`);
                // プロジェクトのフェーズ状態を更新
                await this.projectService.updateProjectPhase(projectId, phase, isCompleted);
            }
        });
    }
    /**
     * ディレクトリが存在することを確認し、なければ作成
     * @param dir ディレクトリパス
     */
    ensureDirectoryExists(dir) {
        try {
            if (!fs.existsSync(dir)) {
                logger_1.Logger.debug(`ディレクトリを作成します: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
                // 作成されたことを確認
                if (!fs.existsSync(dir)) {
                    throw new Error(`ディレクトリが作成されませんでした: ${dir}`);
                }
            }
            // 書き込み権限をチェック
            try {
                const testFile = path.join(dir, '.test-write-permission');
                // テストファイルに書き込み
                fs.writeFileSync(testFile, 'test', 'utf8');
                // 書き込みが成功したらファイルを削除
                fs.unlinkSync(testFile);
            }
            catch (writeError) {
                throw new Error(`ディレクトリ ${dir} への書き込み権限がありません: ${writeError.message}`);
            }
        }
        catch (error) {
            logger_1.Logger.error(`ディレクトリの作成または権限チェックに失敗しました: ${dir}`, error);
            throw error;
        }
    }
    /**
     * ディレクトリを再帰的に削除
     * @param dir ディレクトリパス
     */
    async deleteDirectory(dir) {
        if (fs.promises.rm) {
            await fs.promises.rm(dir, { recursive: true, force: true });
        }
        else {
            // 古いバージョンのNode.jsの場合は再帰的に削除
            const files = await fs.promises.readdir(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = await fs.promises.lstat(filePath);
                if (stat.isDirectory()) {
                    await this.deleteDirectory(filePath);
                }
                else {
                    await fs.promises.unlink(filePath);
                }
            }
            await fs.promises.rmdir(dir);
        }
    }
}
exports.AppGeniusStateManager = AppGeniusStateManager;
//# sourceMappingURL=AppGeniusStateManager.js.map