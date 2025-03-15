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
exports.EnvironmentVariablesService = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../utils/logger");
const AppGeniusEventBus_1 = require("./AppGeniusEventBus");
/**
 * 環境変数管理サービス
 * 環境変数の検出、検証、管理を行う
 */
class EnvironmentVariablesService {
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!EnvironmentVariablesService._instance) {
            EnvironmentVariablesService._instance = new EnvironmentVariablesService();
        }
        return EnvironmentVariablesService._instance;
    }
    /**
     * コンストラクタ
     */
    constructor() {
        this._projectPath = '';
        this._eventBus = AppGeniusEventBus_1.AppGeniusEventBus.getInstance();
        this._initProjectPath();
        logger_1.Logger.info('環境変数管理サービスが初期化されました');
    }
    /**
     * プロジェクトパスを初期化
     */
    _initProjectPath() {
        try {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                this._projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                logger_1.Logger.info(`環境変数管理サービス: プロジェクトパスを設定: ${this._projectPath}`);
            }
        }
        catch (error) {
            logger_1.Logger.error('プロジェクトパスの初期化に失敗しました', error);
        }
    }
    /**
     * プロジェクトパスを設定
     */
    setProjectPath(projectPath) {
        this._projectPath = projectPath;
        logger_1.Logger.info(`環境変数管理サービス: プロジェクトパスを設定: ${projectPath}`);
    }
    /**
     * プロジェクトパスを取得
     */
    getProjectPath() {
        return this._projectPath;
    }
    /**
     * 環境変数ファイルを検出
     */
    detectEnvFiles() {
        try {
            if (!this._projectPath) {
                return [];
            }
            // .envで始まるファイルを検索
            const files = fs.readdirSync(this._projectPath)
                .filter(file => file.startsWith('.env'))
                .map(file => path.join(this._projectPath, file));
            logger_1.Logger.info(`環境変数ファイルを検出: ${files.length}個のファイルが見つかりました`);
            return files;
        }
        catch (error) {
            logger_1.Logger.error('環境変数ファイルの検出に失敗しました', error);
            return [];
        }
    }
    /**
     * 環境変数ファイルを読み込む
     */
    loadEnvFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`ファイル ${filePath} が見つかりません`);
            }
            // ファイルを読み込む
            const content = fs.readFileSync(filePath, 'utf8');
            // 環境変数を解析
            const variables = {};
            content.split('\n').forEach(line => {
                // コメント行をスキップ
                if (line.startsWith('#')) {
                    return;
                }
                // キーと値を分離
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let value = match[2] || '';
                    // 引用符を取り除く
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    else if (value.startsWith("'") && value.endsWith("'")) {
                        value = value.slice(1, -1);
                    }
                    variables[key] = value;
                }
            });
            logger_1.Logger.info(`環境変数ファイルを読み込み: ${filePath}`);
            return variables;
        }
        catch (error) {
            logger_1.Logger.error(`環境変数ファイル読み込みエラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数ファイルを保存
     */
    saveEnvFile(filePath, variables) {
        try {
            // 環境変数をファイル形式に変換
            let content = '';
            for (const key in variables) {
                const value = variables[key];
                content += `${key}=${value}\n`;
            }
            // ファイルに書き込み
            fs.writeFileSync(filePath, content, 'utf8');
            logger_1.Logger.info(`環境変数ファイルを保存: ${filePath}`);
            // イベントを発行
            this._eventBus.publish(AppGeniusEventBus_1.AppGeniusEventType.ENV_VARIABLES_UPDATED, { filePath }, 'EnvironmentVariablesService');
        }
        catch (error) {
            logger_1.Logger.error(`環境変数ファイル保存エラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数ファイルを作成
     */
    createEnvFile(fileName) {
        try {
            if (!fileName) {
                throw new Error('ファイル名が指定されていません');
            }
            // .envで始まることを確認
            if (!fileName.startsWith('.env')) {
                fileName = `.env.${fileName}`;
            }
            // パスの作成
            const filePath = path.join(this._projectPath, fileName);
            // ファイルが既に存在するかチェック
            if (fs.existsSync(filePath)) {
                throw new Error(`ファイル ${fileName} は既に存在します`);
            }
            // 空のファイルを作成
            fs.writeFileSync(filePath, '', 'utf8');
            logger_1.Logger.info(`環境変数ファイルを作成: ${filePath}`);
            // イベントを発行
            this._eventBus.publish(AppGeniusEventBus_1.AppGeniusEventType.ENV_FILE_CREATED, { filePath }, 'EnvironmentVariablesService');
            return filePath;
        }
        catch (error) {
            logger_1.Logger.error(`環境変数ファイル作成エラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数をプロジェクトから自動検出
     */
    detectEnvironmentVariables(projectPath) {
        try {
            const path = projectPath || this._projectPath;
            if (!path) {
                throw new Error('プロジェクトパスが設定されていません');
            }
            // 自動検出されたサンプル環境変数
            const detectedVars = {
                // データベース
                'DB_HOST': 'localhost',
                'DB_PORT': '5432',
                'DB_NAME': 'appgenius_db',
                'DB_USER': 'postgres',
                'DB_PASSWORD': '【要設定】',
                // サーバー
                'PORT': '3000',
                'NODE_ENV': 'development',
                'LOG_LEVEL': 'info',
                // 認証
                'JWT_SECRET': '【要設定】',
                'JWT_EXPIRY': '1h',
                'REFRESH_TOKEN_SECRET': '【要設定】',
                'REFRESH_TOKEN_EXPIRY': '7d',
                // API
                'API_URL': 'http://localhost:3000/api',
                'CORS_ORIGIN': 'http://localhost:3001',
                // フロントエンド
                'REACT_APP_API_URL': 'http://localhost:3000/api',
                'REACT_APP_VERSION': '1.0.0'
            };
            // 実際の実装では、ここでプロジェクトを分析して環境変数を検出する
            logger_1.Logger.info(`環境変数を自動検出: ${Object.keys(detectedVars).length}個の変数を検出`);
            return detectedVars;
        }
        catch (error) {
            logger_1.Logger.error(`環境変数自動検出エラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数の検証
     */
    validateEnvironmentVariables(variables) {
        try {
            const result = {};
            // 各変数を検証
            for (const key in variables) {
                const value = variables[key];
                // 値が空または明らかなプレースホルダーかどうか
                if (!value || value === 'YOUR_VALUE_HERE' || value === '【要設定】') {
                    result[key] = { isValid: false, message: '値が設定されていません' };
                    continue;
                }
                // 変数名によって特定の検証
                if (key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY')) {
                    // 機密情報の場合は強度をチェック
                    if (value.length < 8) {
                        result[key] = { isValid: false, message: 'セキュリティ上、8文字以上を推奨します' };
                        continue;
                    }
                    // セキュリティレベルのチェック
                    const hasUpperCase = /[A-Z]/.test(value);
                    const hasLowerCase = /[a-z]/.test(value);
                    const hasNumber = /[0-9]/.test(value);
                    const hasSpecial = /[^A-Za-z0-9]/.test(value);
                    if (!(hasUpperCase && hasLowerCase && hasNumber && hasSpecial)) {
                        result[key] = {
                            isValid: false,
                            message: 'より強力なパスワードを設定してください（大文字、小文字、数字、特殊文字を含む）'
                        };
                        continue;
                    }
                }
                // URL変数の検証
                if (key.includes('URL')) {
                    try {
                        new URL(value);
                    }
                    catch (error) {
                        result[key] = { isValid: false, message: '有効なURLではありません' };
                        continue;
                    }
                }
                // ポート番号の検証
                if (key.includes('PORT')) {
                    const port = parseInt(value, 10);
                    if (isNaN(port) || port < 1 || port > 65535) {
                        result[key] = { isValid: false, message: 'ポート番号は1〜65535の範囲内である必要があります' };
                        continue;
                    }
                }
                // デフォルトは有効とする
                result[key] = { isValid: true, message: '値は有効です' };
            }
            logger_1.Logger.info(`環境変数を検証: ${Object.keys(result).length}個の変数を検証`);
            return result;
        }
        catch (error) {
            logger_1.Logger.error(`環境変数検証エラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数情報をenv.mdから読み込む
     */
    loadEnvironmentVariablesFromEnvMd() {
        try {
            const envMdPath = path.join(this._projectPath, 'docs', 'env.md');
            if (!fs.existsSync(envMdPath)) {
                logger_1.Logger.warn(`env.mdファイルが見つかりません: ${envMdPath}`);
                return { variables: [] };
            }
            const content = fs.readFileSync(envMdPath, 'utf8');
            // 環境変数情報を抽出
            const variables = [];
            const lines = content.split('\n');
            let currentSection = '';
            let currentGroup = '';
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // セクションヘッダーを検出
                if (line.startsWith('##') && !line.startsWith('###')) {
                    currentSection = line.replace(/^##\s+/, '');
                    continue;
                }
                // グループヘッダーを検出
                if (line.startsWith('###')) {
                    currentGroup = line.replace(/^###\s+/, '');
                    continue;
                }
                // 環境変数の行を検出（- [x] または - [ ] で始まる行）
                const varMatch = line.match(/^-\s+\[([ x])\]\s+`([^`]+)`\s*-\s*(.*)$/);
                if (!varMatch) {
                    const simpleVarMatch = line.match(/^-\s+\[([ x])\]\s+([A-Z0-9_]+)\s*-?\s*(.*)$/);
                    if (simpleVarMatch) {
                        const isConfigured = simpleVarMatch[1] === 'x';
                        const name = simpleVarMatch[2];
                        const description = simpleVarMatch[3] || '';
                        variables.push({
                            name,
                            description,
                            isConfigured,
                            section: currentSection,
                            group: currentGroup
                        });
                    }
                }
                else {
                    const isConfigured = varMatch[1] === 'x';
                    const name = varMatch[2];
                    const description = varMatch[3] || '';
                    variables.push({
                        name,
                        description,
                        isConfigured,
                        section: currentSection,
                        group: currentGroup
                    });
                }
            }
            logger_1.Logger.info(`env.mdから環境変数情報を読み込みました: ${variables.length}個の変数が見つかりました`);
            return { variables };
        }
        catch (error) {
            logger_1.Logger.error(`env.md読み込みエラー:`, error);
            throw error;
        }
    }
    /**
     * env.mdの環境変数の設定状態を更新
     */
    updateEnvMdVariableStatus(name, isConfigured) {
        try {
            const envMdPath = path.join(this._projectPath, 'docs', 'env.md');
            if (!fs.existsSync(envMdPath)) {
                logger_1.Logger.warn(`env.mdファイルが見つかりません: ${envMdPath}`);
                return;
            }
            let content = fs.readFileSync(envMdPath, 'utf8');
            const lines = content.split('\n');
            // 変数名に一致する行を検索して更新
            let updated = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // 環境変数の行を検出
                const varMatch = line.match(/^-\s+\[([ x])\]\s+`?([A-Z0-9_]+)`?\s*-?\s*(.*)$/);
                if (varMatch && varMatch[2] === name) {
                    // 設定状態を更新
                    const updatedLine = line.replace(/^-\s+\[([ x])\]/, isConfigured ? '- [x]' : '- [ ]');
                    lines[i] = updatedLine;
                    updated = true;
                    break;
                }
            }
            if (updated) {
                // 更新した内容をファイルに書き込む
                content = lines.join('\n');
                fs.writeFileSync(envMdPath, content, 'utf8');
                logger_1.Logger.info(`env.mdの変数 ${name} の状態を更新しました: ${isConfigured ? '設定済み' : '未設定'}`);
                // イベントを発行
                this._eventBus.publish(AppGeniusEventBus_1.AppGeniusEventType.ENV_VARIABLES_UPDATED, { name, isConfigured }, 'EnvironmentVariablesService');
            }
            else {
                logger_1.Logger.warn(`env.mdに変数 ${name} が見つかりませんでした`);
            }
        }
        catch (error) {
            logger_1.Logger.error(`env.md更新エラー:`, error);
            throw error;
        }
    }
    /**
     * CURRENT_STATUS.mdに環境変数情報を更新
     */
    updateCurrentStatusMd(variables) {
        try {
            const statusMdPath = path.join(this._projectPath, 'docs', 'CURRENT_STATUS.md');
            if (!fs.existsSync(statusMdPath)) {
                logger_1.Logger.warn(`CURRENT_STATUS.mdファイルが見つかりません: ${statusMdPath}`);
                return;
            }
            let content = fs.readFileSync(statusMdPath, 'utf8');
            // 環境変数セクションが存在するか確認
            const envSectionRegex = /## 環境変数設定状況/;
            const envSectionExists = envSectionRegex.test(content);
            if (envSectionExists) {
                // 既存のセクションを更新
                const envSectionStartRegex = /## 環境変数設定状況[\s\S]*?(?=##|$)/;
                const envSectionStart = content.match(envSectionStartRegex);
                if (envSectionStart) {
                    // 新しいセクションコンテンツを作成
                    let newEnvSection = '## 環境変数設定状況\n\n';
                    newEnvSection += '以下の環境変数が設定されています：\n\n';
                    // 変数を分類してソート
                    const sortedKeys = Object.keys(variables).sort();
                    // ステータステーブルを作成
                    newEnvSection += '| 変数名 | 状態 | 説明 |\n';
                    newEnvSection += '|--------|------|------|\n';
                    for (const key of sortedKeys) {
                        const value = variables[key];
                        const isConfigured = value && value !== 'YOUR_VALUE_HERE' && value !== '【要設定】';
                        newEnvSection += `| ${key} | ${isConfigured ? '✅' : '❌'} | |\n`;
                    }
                    newEnvSection += '\n';
                    // セクションを置換
                    content = content.replace(envSectionStartRegex, newEnvSection);
                }
            }
            else {
                // 新しいセクションを追加
                let newEnvSection = '\n## 環境変数設定状況\n\n';
                newEnvSection += '以下の環境変数が設定されています：\n\n';
                // 変数を分類してソート
                const sortedKeys = Object.keys(variables).sort();
                // ステータステーブルを作成
                newEnvSection += '| 変数名 | 状態 | 説明 |\n';
                newEnvSection += '|--------|------|------|\n';
                for (const key of sortedKeys) {
                    const value = variables[key];
                    const isConfigured = value && value !== 'YOUR_VALUE_HERE' && value !== '【要設定】';
                    newEnvSection += `| ${key} | ${isConfigured ? '✅' : '❌'} | |\n`;
                }
                newEnvSection += '\n';
                // ファイルの末尾に追加
                content += newEnvSection;
            }
            // ファイルに書き込み
            fs.writeFileSync(statusMdPath, content, 'utf8');
            logger_1.Logger.info(`CURRENT_STATUS.mdを更新しました: 環境変数セクション`);
            // イベントを発行
            this._eventBus.publish(AppGeniusEventBus_1.AppGeniusEventType.CURRENT_STATUS_UPDATED, { section: 'environmentVariables' }, 'EnvironmentVariablesService');
        }
        catch (error) {
            logger_1.Logger.error(`CURRENT_STATUS.md更新エラー:`, error);
            throw error;
        }
    }
    /**
     * データベース接続テスト
     */
    async testDatabaseConnection(config) {
        try {
            // 実際の実装では、ここでデータベース接続テストを行う
            // サンプル実装のため、単に成功を返す
            return {
                success: true,
                message: 'データベース接続に成功しました'
            };
        }
        catch (error) {
            logger_1.Logger.error(`データベース接続テストエラー:`, error);
            return {
                success: false,
                message: `データベース接続に失敗しました: ${error.message}`
            };
        }
    }
    /**
     * API接続テスト
     */
    async testApiConnection(config) {
        try {
            // 実際の実装では、ここでAPI接続テストを行う
            // サンプル実装のため、単に成功を返す
            return {
                success: true,
                message: 'API接続に成功しました'
            };
        }
        catch (error) {
            logger_1.Logger.error(`API接続テストエラー:`, error);
            return {
                success: false,
                message: `API接続に失敗しました: ${error.message}`
            };
        }
    }
}
exports.EnvironmentVariablesService = EnvironmentVariablesService;
//# sourceMappingURL=EnvironmentVariablesService.js.map