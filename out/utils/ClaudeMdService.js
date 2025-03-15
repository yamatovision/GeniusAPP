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
exports.ClaudeMdService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
/**
 * CLAUDE.mdファイルを管理するサービス
 */
class ClaudeMdService {
    constructor() {
        this._projectName = '';
        this._projectDescription = '';
    }
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!ClaudeMdService.instance) {
            ClaudeMdService.instance = new ClaudeMdService();
        }
        return ClaudeMdService.instance;
    }
    /**
     * プロジェクト用のCLAUDE.mdを生成
     * @param projectPath プロジェクトパス
     * @param projectNameOrOptions プロジェクト名または設定オブジェクト
     * @param projectDescription プロジェクトの説明（オプション）
     */
    async generateClaudeMd(projectPath, projectNameOrOptions, projectDescription) {
        try {
            // 引数の互換性を保持するための処理
            if (typeof projectNameOrOptions === 'object') {
                this._projectName = projectNameOrOptions.name;
                this._projectDescription = projectNameOrOptions.description;
            }
            else {
                this._projectName = projectNameOrOptions;
                this._projectDescription = projectDescription || '';
            }
            const templatePath = path.join(__dirname, '..', '..', 'templates', 'claude_md_template.md');
            let template = fs.existsSync(templatePath)
                ? fs.readFileSync(templatePath, 'utf8')
                : this.getDefaultTemplate();
            // CLAUDE.mdを保存
            const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
            fs.writeFileSync(claudeMdPath, template, 'utf8');
            logger_1.Logger.info(`CLAUDE.mdを生成しました: ${claudeMdPath}`);
            return claudeMdPath;
        }
        catch (error) {
            logger_1.Logger.error('CLAUDE.md生成エラー', error);
            throw error;
        }
    }
    /**
     * 既存のCLAUDE.mdを読み込む
     */
    loadClaudeMd(projectPath) {
        const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
        if (fs.existsSync(claudeMdPath)) {
            return fs.readFileSync(claudeMdPath, 'utf8');
        }
        return null;
    }
    /**
     * CLAUDE.md内の指定セクションを更新
     */
    updateClaudeMdSection(projectPath, sectionName, content) {
        try {
            const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
            // ファイルが存在するか確認
            if (!fs.existsSync(claudeMdPath)) {
                // ファイルが存在しない場合は新規作成
                const template = this.getDefaultTemplate();
                fs.writeFileSync(claudeMdPath, template, 'utf8');
            }
            // ファイルを読み込む
            let claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');
            // セクションのパターン
            const sectionPattern = new RegExp(`## ${sectionName}[\\s\\S]*?(?=##|$)`, 'm');
            const newSection = `## ${sectionName}\n\n${content}\n\n`;
            // セクションの置換または追加
            if (claudeMdContent.match(sectionPattern)) {
                claudeMdContent = claudeMdContent.replace(sectionPattern, newSection);
            }
            else {
                claudeMdContent += `\n${newSection}`;
            }
            // ファイルに書き戻す
            fs.writeFileSync(claudeMdPath, claudeMdContent, 'utf8');
            logger_1.Logger.info(`CLAUDE.mdの${sectionName}セクションを更新しました`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`CLAUDE.mdセクション更新エラー: ${sectionName}`, error);
            return false;
        }
    }
    /**
     * CLAUDE.md内の指定セクションを取得
     */
    getClaudeMdSection(projectPath, sectionName) {
        try {
            const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
            // ファイルが存在するか確認
            if (!fs.existsSync(claudeMdPath)) {
                return null;
            }
            // ファイルを読み込む
            const claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');
            // セクションを正規表現で抽出
            const sectionPattern = new RegExp(`## ${sectionName}([\\s\\S]*?)(?=##|$)`, 'm');
            const match = claudeMdContent.match(sectionPattern);
            if (match && match[1]) {
                return match[1].trim();
            }
            return null;
        }
        catch (error) {
            logger_1.Logger.error(`CLAUDE.mdセクション取得エラー: ${sectionName}`, error);
            return null;
        }
    }
    /**
     * ファイルの存在を確認
     * @param filePath ファイルパス
     * @returns 存在するかどうか
     */
    fileExists(filePath) {
        return fs.existsSync(filePath);
    }
    /**
     * プロジェクト情報を更新
     */
    async updateProjectInfo(projectPath, updates) {
        try {
            const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
            // ファイルの存在確認
            if (!this.fileExists(claudeMdPath)) {
                logger_1.Logger.error(`CLAUDE.mdファイルが見つかりません: ${claudeMdPath}`);
                return false;
            }
            // ファイルを読み込む
            let content = fs.readFileSync(claudeMdPath, 'utf8');
            // 各更新項目を処理
            if (updates.name) {
                // タイトル（最初の行）を更新
                content = content.replace(/^# .*$/m, `# ${updates.name} 開発ガイド`);
            }
            if (updates.date || updates.status) {
                // プロジェクト情報セクションを探す
                const infoSection = content.match(/## プロジェクト情報\n([\s\S]*?)(\n##|\n$)/);
                if (infoSection) {
                    let infoContent = infoSection[1];
                    // 日付を更新
                    if (updates.date) {
                        infoContent = infoContent.replace(/- 作成日:.*$/m, `- 作成日: ${updates.date}`);
                    }
                    // ステータスを更新
                    if (updates.status) {
                        if (infoContent.includes('- ステータス:')) {
                            infoContent = infoContent.replace(/- ステータス:.*$/m, `- ステータス: ${updates.status}`);
                        }
                        else {
                            // ステータスが存在しない場合は追加
                            infoContent += `- ステータス: ${updates.status}\n`;
                        }
                    }
                    // 更新した情報を元の内容に反映
                    content = content.replace(infoSection[0], `## プロジェクト情報\n${infoContent}${infoSection[2]}`);
                }
                else {
                    // プロジェクト情報セクションが見つからない場合は作成
                    const newInfoSection = `## プロジェクト情報\n- 作成日: ${updates.date || new Date().toISOString().split('T')[0]}\n- 作成者: AppGenius AI\n- ステータス: ${updates.status || '進行中'}\n\n`;
                    content += `\n${newInfoSection}`;
                }
            }
            // ファイルに書き込む
            fs.writeFileSync(claudeMdPath, content);
            logger_1.Logger.info(`CLAUDE.mdファイルを更新しました: ${claudeMdPath}`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`CLAUDE.mdファイルの更新に失敗しました`, error);
            return false;
        }
    }
    /**
     * 特定のフェーズの進捗状況を更新する
     * @param projectPath プロジェクトパス
     * @param phase 更新するフェーズ名
     * @param isCompleted 完了したかどうか
     * @returns 成功したかどうか
     */
    async updateProgressStatus(projectPath, phase, isCompleted) {
        try {
            const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
            // ファイルの存在確認
            if (!this.fileExists(claudeMdPath)) {
                logger_1.Logger.error(`CLAUDE.mdファイルが見つかりません: ${claudeMdPath}`);
                return false;
            }
            // ファイルを読み込む
            let content = fs.readFileSync(claudeMdPath, 'utf8');
            // フェーズ名を日本語に変換
            const phaseMapping = {
                'requirements': '要件定義',
                'mockup': 'モックアップ',
                'directoryStructure': 'ディレクトリ構造',
                'implementation': '実装',
                'test': 'テスト',
                'deployment': 'デプロイ'
            };
            const phaseJapanese = phaseMapping[phase] || phase;
            const status = isCompleted ? '完了' : '未完了';
            // 進捗状況セクションを探す
            const progressSection = content.match(/## 進捗状況\n([\s\S]*?)(\n##|\n$)/);
            if (progressSection) {
                let progressContent = progressSection[1];
                // 既存のフェーズステータスを更新
                const phaseRegex = new RegExp(`- ${phaseJapanese}:.*$`, 'm');
                if (progressContent.match(phaseRegex)) {
                    progressContent = progressContent.replace(phaseRegex, `- ${phaseJapanese}: ${status}`);
                }
                else {
                    // フェーズが存在しない場合は追加
                    progressContent += `- ${phaseJapanese}: ${status}\n`;
                }
                // 更新した内容を元の内容に反映
                content = content.replace(progressSection[0], `## 進捗状況\n${progressContent}${progressSection[2]}`);
            }
            else {
                // 進捗状況セクションが見つからない場合は作成
                const newProgressSection = `## 進捗状況\n- ${phaseJapanese}: ${status}\n\n`;
                content += `\n${newProgressSection}`;
            }
            // チェックリストも更新
            const checklistSection = content.match(/## チェックリスト\n([\s\S]*?)(\n##|\n$)/);
            if (checklistSection) {
                let checklistContent = checklistSection[1];
                // 対応するチェックリストアイテムを探す
                let checklistItems = {
                    'requirements': /- \[([ x])\] 要件定義の完了/,
                    'mockup': /- \[([ x])\] モックアップの作成/,
                    'directoryStructure': /- \[([ x])\] ディレクトリ構造の確定/,
                    'implementation': /- \[([ x])\] 実装の開始/,
                    'test': /- \[([ x])\] テストの実施/,
                    'deployment': /- \[([ x])\] デプロイの準備/
                };
                const checkRegex = checklistItems[phase];
                if (checkRegex && checklistContent.match(checkRegex)) {
                    checklistContent = checklistContent.replace(checkRegex, `- [${isCompleted ? 'x' : ' '}] ${phaseJapanese}${phase === 'requirements' ? 'の完了' : 'の' + (phase === 'implementation' ? '開始' : '作成')}`);
                }
                // 更新した内容を元の内容に反映
                content = content.replace(checklistSection[0], `## チェックリスト\n${checklistContent}${checklistSection[2]}`);
            }
            // ファイルに書き込む
            fs.writeFileSync(claudeMdPath, content);
            logger_1.Logger.info(`CLAUDE.mdの進捗状況を更新しました: ${phase} -> ${status}`);
            // ディレクトリ構造が完了した場合、ファイル一覧を抽出して更新
            if (phase === 'directoryStructure' && isCompleted) {
                await this.extractFileListFromStructure(projectPath);
            }
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`CLAUDE.mdの進捗状況更新に失敗しました`, error);
            return false;
        }
    }
    /**
     * 複数のフェーズの進捗状況を一度に更新する
     * @param projectPath プロジェクトパス
     * @param updates 更新するフェーズと状態のマップ
     * @returns 成功したかどうか
     */
    async updateMultipleProgressStatus(projectPath, updates) {
        try {
            const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
            // ファイルの存在確認
            if (!this.fileExists(claudeMdPath)) {
                logger_1.Logger.error(`CLAUDE.mdファイルが見つかりません: ${claudeMdPath}`);
                return false;
            }
            // 進捗セクションを一括で更新
            let content = fs.readFileSync(claudeMdPath, 'utf8');
            // フェーズ名を日本語に変換するマッピング
            const phaseMapping = {
                'requirements': '要件定義',
                'mockup': 'モックアップ',
                'directoryStructure': 'ディレクトリ構造',
                'implementation': '実装',
                'test': 'テスト',
                'deployment': 'デプロイ'
            };
            // 進捗状況セクションを探す
            const progressSection = content.match(/## 進捗状況\n([\s\S]*?)(\n##|\n$)/);
            // チェックリストセクションを探す
            const checklistSection = content.match(/## チェックリスト\n([\s\S]*?)(\n##|\n$)/);
            if (progressSection) {
                let progressContent = progressSection[1];
                // 各更新を適用
                for (const [phase, isCompleted] of Object.entries(updates)) {
                    const phaseJapanese = phaseMapping[phase] || phase;
                    const status = isCompleted ? '完了' : '未完了';
                    // 既存のフェーズステータスを更新
                    const phaseRegex = new RegExp(`- ${phaseJapanese}:.*$`, 'm');
                    if (progressContent.match(phaseRegex)) {
                        progressContent = progressContent.replace(phaseRegex, `- ${phaseJapanese}: ${status}`);
                    }
                    else {
                        // フェーズが存在しない場合は追加
                        progressContent += `- ${phaseJapanese}: ${status}\n`;
                    }
                }
                // 更新した内容を元の内容に反映
                content = content.replace(progressSection[0], `## 進捗状況\n${progressContent}${progressSection[2]}`);
            }
            // チェックリストも更新
            if (checklistSection) {
                let checklistContent = checklistSection[1];
                // 各更新を適用
                for (const [phase, isCompleted] of Object.entries(updates)) {
                    // 対応するチェックリストアイテムを探す
                    const phaseJapanese = phaseMapping[phase] || phase;
                    let checklistPattern;
                    switch (phase) {
                        case 'requirements':
                            checklistPattern = '要件定義の完了';
                            break;
                        case 'mockup':
                            checklistPattern = 'モックアップの作成';
                            break;
                        case 'directoryStructure':
                            checklistPattern = 'ディレクトリ構造の確定';
                            break;
                        case 'implementation':
                            checklistPattern = '実装の開始';
                            break;
                        case 'test':
                            checklistPattern = 'テストの実施';
                            break;
                        case 'deployment':
                            checklistPattern = 'デプロイの準備';
                            break;
                        default:
                            checklistPattern = `${phaseJapanese}`;
                            break;
                    }
                    const checkRegex = new RegExp(`- \\[([ x])\\] ${checklistPattern}`);
                    if (checklistContent.match(checkRegex)) {
                        checklistContent = checklistContent.replace(checkRegex, `- [${isCompleted ? 'x' : ' '}] ${checklistPattern}`);
                    }
                }
                // 更新した内容を元の内容に反映
                content = content.replace(checklistSection[0], `## チェックリスト\n${checklistContent}${checklistSection[2]}`);
            }
            // ファイルに書き込む
            fs.writeFileSync(claudeMdPath, content);
            logger_1.Logger.info(`CLAUDE.mdの複数の進捗状況を更新しました`);
            // ディレクトリ構造が完了した場合、ファイル一覧を抽出して更新
            if (updates['directoryStructure'] === true) {
                await this.extractFileListFromStructure(projectPath);
            }
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`CLAUDE.mdの複数の進捗状況更新に失敗しました`, error);
            return false;
        }
    }
    /**
     * ディレクトリ構造からファイル一覧を抽出しCLAUDE.mdに追加
     */
    async extractFileListFromStructure(projectPath) {
        try {
            // ディレクトリ構造ファイルを読み込む
            const structurePath = path.join(projectPath, 'docs', 'structure.md');
            if (!fs.existsSync(structurePath)) {
                logger_1.Logger.warn('ディレクトリ構造ファイルが見つかりません');
                return false;
            }
            const structureContent = fs.readFileSync(structurePath, 'utf8');
            // コードブロックを抽出
            const codeBlockRegex = /```[\s\S]*?```/g;
            const codeBlocks = structureContent.match(codeBlockRegex);
            if (!codeBlocks || codeBlocks.length === 0) {
                logger_1.Logger.warn('ディレクトリ構造のコードブロックが見つかりません');
                return false;
            }
            // 最初のコードブロックを処理
            const treeContent = codeBlocks[0].replace(/```/g, '').trim();
            // パスを抽出
            const filePaths = this.parseDirectoryTree(treeContent);
            // コード関連のファイルのみをフィルタリング
            const codeFilePaths = filePaths.filter(filePath => !filePath.endsWith('/') &&
                !filePath.includes('node_modules/') &&
                !filePath.includes('.git/') &&
                !filePath.includes('.vscode/') &&
                (filePath.endsWith('.js') ||
                    filePath.endsWith('.ts') ||
                    filePath.endsWith('.jsx') ||
                    filePath.endsWith('.tsx') ||
                    filePath.endsWith('.html') ||
                    filePath.endsWith('.css') ||
                    filePath.endsWith('.json') ||
                    filePath.endsWith('.md')));
            // 開発達成率セクションを更新
            const achievementContent = `- 作成済みファイル: 0\n- 計画済みファイル: ${codeFilePaths.length}\n- 達成率: 0%`;
            this.updateClaudeMdSection(projectPath, '開発達成率', achievementContent);
            // CLAUDE.mdの「実装対象ファイル」セクションを更新
            const fileListContent = codeFilePaths.map(file => `- [ ] ${file}`).join('\n');
            this.updateClaudeMdSection(projectPath, '実装対象ファイル', fileListContent);
            logger_1.Logger.info(`${codeFilePaths.length}個のファイルをCLAUDE.mdに追加しました`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error('ファイル一覧の抽出に失敗しました', error);
            return false;
        }
    }
    /**
     * ディレクトリツリーからファイルパスを解析
     */
    parseDirectoryTree(text) {
        const lines = text.split('\n');
        const result = [];
        const stack = [];
        let currentPath = '';
        for (const line of lines) {
            if (!line.trim())
                continue;
            // インデントレベルを計算（フォルダ構造の深さ）
            let level = 0;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === ' ' || line[i] === '│' || line[i] === '├' || line[i] === '└' || line[i] === '─') {
                    level = Math.floor(i / 2) + 1;
                    continue;
                }
                break;
            }
            // クリーンな名前を取得（ツリー記号を削除）
            const cleanName = line.replace(/[│├└─\s]/g, '').trim();
            // スタックをレベルに合わせて調整
            while (stack.length >= level) {
                stack.pop();
            }
            // 現在のパスを構築
            stack.push(cleanName);
            currentPath = stack.join('/');
            // フォルダの場合はスラッシュを追加
            const isDirectory = !line.includes('.') || cleanName.includes('.gitkeep');
            if (isDirectory) {
                currentPath += '/';
            }
            result.push(currentPath);
        }
        return result;
    }
    /**
     * ファイルの実装状況を更新する
     * @param projectPath プロジェクトパス
     * @param filePath 実装されたファイルパス
     * @param isImplemented 実装済みかどうか
     */
    async updateFileImplementationStatus(projectPath, filePath, isImplemented) {
        try {
            const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
            // ファイルの存在確認
            if (!this.fileExists(claudeMdPath)) {
                logger_1.Logger.error(`CLAUDE.mdファイルが見つかりません: ${claudeMdPath}`);
                return false;
            }
            // ファイルを読み込む
            const content = fs.readFileSync(claudeMdPath, 'utf8');
            // 実装対象ファイルセクションを探す
            const fileSection = content.match(/## 実装対象ファイル\n([\s\S]*?)(\n##|\n$)/);
            if (fileSection) {
                let fileContent = fileSection[1];
                const fileRegex = new RegExp(`- \\[([ x])\\] ${filePath.replace(/\//g, '\\/')}`, 'g');
                // ファイルのステータスを更新
                if (fileContent.match(fileRegex)) {
                    fileContent = fileContent.replace(fileRegex, `- [${isImplemented ? 'x' : ' '}] ${filePath}`);
                    // 更新した内容を元の内容に反映
                    const updatedContent = content.replace(fileSection[0], `## 実装対象ファイル\n${fileContent}${fileSection[2]}`);
                    fs.writeFileSync(claudeMdPath, updatedContent);
                    // 開発達成率も更新
                    await this.updateAchievementRate(projectPath);
                    logger_1.Logger.info(`ファイル「${filePath}」の実装状況を更新しました: ${isImplemented ? '完了' : '未完了'}`);
                    return true;
                }
                else {
                    logger_1.Logger.warn(`ファイル「${filePath}」が実装対象ファイル一覧に見つかりません`);
                }
            }
            return false;
        }
        catch (error) {
            logger_1.Logger.error(`ファイル実装状況の更新に失敗しました: ${filePath}`, error);
            return false;
        }
    }
    /**
     * 開発達成率を更新する
     */
    async updateAchievementRate(projectPath) {
        try {
            const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
            // ファイルの存在確認
            if (!this.fileExists(claudeMdPath)) {
                logger_1.Logger.error(`CLAUDE.mdファイルが見つかりません: ${claudeMdPath}`);
                return false;
            }
            // ファイルを読み込む
            const content = fs.readFileSync(claudeMdPath, 'utf8');
            // 実装対象ファイルセクションを探す
            const fileSection = content.match(/## 実装対象ファイル\n([\s\S]*?)(\n##|\n$)/);
            if (fileSection) {
                const fileContent = fileSection[1];
                // チェック済みのファイル数を数える
                const totalFiles = (fileContent.match(/- \[([ x])\]/g) || []).length;
                const implementedFiles = (fileContent.match(/- \[x\]/g) || []).length;
                // 達成率を計算
                const achievementRate = totalFiles > 0 ? Math.round((implementedFiles / totalFiles) * 100) : 0;
                // 開発達成率セクションを更新
                const achievementContent = `- 作成済みファイル: ${implementedFiles}\n- 計画済みファイル: ${totalFiles}\n- 達成率: ${achievementRate}%`;
                this.updateClaudeMdSection(projectPath, '開発達成率', achievementContent);
                logger_1.Logger.info(`開発達成率を更新しました: ${achievementRate}%`);
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.Logger.error('開発達成率の更新に失敗しました', error);
            return false;
        }
    }
    /**
     * デフォルトのテンプレートを取得
     */
    getDefaultTemplate() {
        return `# \${PROJECT_NAME}

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

\${PROJECT_NAME}は非技術者がClaudeCodeを活用して開発できるアプリケーションです。AIチャットを中心とした開発フローと、コンテンツの適切な保存・管理機能を提供します。

**主要コンセプト**:
- AIとの対話を中心とした開発体験
- 生成コンテンツの自動保存と管理
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
\${PROJECT_NAME}/
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
\`\`\`

## 進捗状況
- 要件定義: 未完了
- モックアップ: 未完了
- ディレクトリ構造: 未完了
- 実装: 未開始
- テスト: 未開始
- デプロイ: 未開始

## 開発達成率
- 作成済みファイル: 0
- 計画済みファイル: 0
- 達成率: 0%

## 実装対象ファイル
_ディレクトリ構造が確定次第、このセクションに実装対象ファイルが自動的に追加されます_

## チェックリスト
- [ ] 要件定義の完了
- [ ] モックアップの作成
- [ ] ディレクトリ構造の確定
- [ ] API設計の完了
- [ ] 環境変数の設定
- [ ] 実装スコープの決定
- [ ] 実装の開始
- [ ] テストの実施
- [ ] デプロイの準備

## プロジェクト情報
- 作成日: ${new Date().toISOString().split('T')[0]}
- 作成者: AppGenius AI
- ステータス: 進行中`;
    }
}
exports.ClaudeMdService = ClaudeMdService;
//# sourceMappingURL=ClaudeMdService.js.map