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
exports.EnvVariablesEditor = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
/**
 * 環境変数エディタークラス
 * 環境変数の編集、検証、提案を行う
 */
class EnvVariablesEditor {
    /**
     * コンストラクタ
     */
    constructor(projectPath) {
        this._projectPath = projectPath;
    }
    /**
     * プロジェクトパスを設定
     */
    setProjectPath(projectPath) {
        this._projectPath = projectPath;
    }
    /**
     * 環境変数を検証
     * @param name 変数名
     * @param value 変数値
     * @returns 検証結果（true: 有効, false: 無効）と詳細メッセージ
     */
    validateVariable(name, value) {
        // 値が空かどうかをチェック
        if (!value) {
            return { isValid: false, message: '値が設定されていません' };
        }
        // 値がプレースホルダーかどうかをチェック
        if (value === 'YOUR_VALUE_HERE' || value === '【要設定】') {
            return { isValid: false, message: '値が設定されていません' };
        }
        // 変数名によって特定の検証を行う
        if (name.includes('PASSWORD') || name.includes('SECRET') || name.includes('KEY')) {
            // 機密情報の場合は強度をチェック
            if (value.length < 8) {
                return { isValid: false, message: 'セキュリティ上、8文字以上を推奨します' };
            }
        }
        // URL変数の検証
        if (name.includes('URL')) {
            try {
                new URL(value);
            }
            catch (error) {
                return { isValid: false, message: '有効なURLではありません' };
            }
        }
        // ポート番号の検証
        if (name.includes('PORT')) {
            const port = parseInt(value, 10);
            if (isNaN(port) || port < 1 || port > 65535) {
                return { isValid: false, message: 'ポート番号は1〜65535の範囲内である必要があります' };
            }
        }
        // データベース接続の検証
        if (name.startsWith('DB_')) {
            if (name === 'DB_PORT') {
                const port = parseInt(value, 10);
                if (isNaN(port) || port < 1 || port > 65535) {
                    return { isValid: false, message: 'データベースポートは1〜65535の範囲内である必要があります' };
                }
            }
        }
        // JWT有効期限の検証
        if (name.includes('EXPIRY') || name.includes('EXPIRES')) {
            // 時間形式をチェック (例: 1h, 7d, 30m)
            if (!value.match(/^\d+[smhdw]$/)) {
                return { isValid: false, message: '有効期限の形式が正しくありません (例: 1h, 7d, 30m)' };
            }
        }
        return { isValid: true, message: '値は有効です' };
    }
    /**
     * 環境変数の値を提案
     * @param name 変数名
     * @returns 提案値
     */
    suggestValue(name) {
        // 変数名に基づいて推奨値を提案
        if (name === 'DB_HOST') {
            return 'localhost';
        }
        else if (name === 'DB_PORT') {
            return '5432'; // PostgreSQL標準ポート
        }
        else if (name === 'DB_NAME') {
            return 'appgenius_db';
        }
        else if (name === 'DB_USER') {
            return 'postgres';
        }
        else if (name === 'NODE_ENV') {
            return 'development';
        }
        else if (name === 'PORT') {
            return '3000';
        }
        else if (name === 'JWT_EXPIRY') {
            return '1h';
        }
        else if (name === 'REFRESH_TOKEN_EXPIRY') {
            return '7d';
        }
        else if (name === 'LOG_LEVEL') {
            return 'info';
        }
        else if (name.includes('SECRET') || name.includes('KEY')) {
            return this._generateSecureRandomString(32);
        }
        else {
            return '【要設定】';
        }
    }
    /**
     * 環境変数ファイルからグループごとの変数情報を取得
     * @param envFilePath 環境変数ファイルパス
     * @returns グループごとの変数情報
     */
    async getVariableGroups(envFilePath) {
        try {
            // ファイルが存在するかチェック
            if (!fs.existsSync(envFilePath)) {
                throw new Error(`ファイル ${envFilePath} が見つかりません`);
            }
            // ファイルの内容を読み込む
            const content = fs.readFileSync(envFilePath, 'utf8');
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
            // 変数をグループに分類
            const groups = {
                database: { variables: {}, count: 0, configured: 0 },
                api: { variables: {}, count: 0, configured: 0 },
                security: { variables: {}, count: 0, configured: 0 },
                server: { variables: {}, count: 0, configured: 0 },
                frontend: { variables: {}, count: 0, configured: 0 },
                other: { variables: {}, count: 0, configured: 0 }
            };
            for (const key in variables) {
                const value = variables[key];
                const isConfigured = value && value !== 'YOUR_VALUE_HERE' && value !== '【要設定】';
                // 変数名に基づいてグループを決定
                let group = 'other';
                if (key.startsWith('DB_')) {
                    group = 'database';
                }
                else if (key.includes('API') || key.includes('URL')) {
                    group = 'api';
                }
                else if (key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN') || key.includes('AUTH')) {
                    group = 'security';
                }
                else if (key.includes('PORT') || key.includes('HOST') || key.includes('ENV') || key.includes('LOG')) {
                    group = 'server';
                }
                else if (key.startsWith('REACT_') || key.includes('APP_')) {
                    group = 'frontend';
                }
                // グループに追加
                groups[group].variables[key] = value;
                groups[group].count++;
                if (isConfigured) {
                    groups[group].configured++;
                }
            }
            return groups;
        }
        catch (error) {
            logger_1.Logger.error(`変数グループ取得エラー:`, error);
            throw error;
        }
    }
    /**
     * env.mdから環境変数の情報を取得
     * @returns 環境変数情報
     */
    async getEnvironmentVariablesFromEnvMd() {
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
            return { variables };
        }
        catch (error) {
            logger_1.Logger.error(`env.md読み込みエラー:`, error);
            throw error;
        }
    }
    /**
     * env.mdの環境変数の設定状態を更新
     * @param name 環境変数名
     * @param isConfigured 設定済みかどうか
     */
    async updateEnvMdVariableStatus(name, isConfigured) {
        try {
            const envMdPath = path.join(this._projectPath, 'docs', 'env.md');
            if (!fs.existsSync(envMdPath)) {
                logger_1.Logger.warn(`env.mdファイルが見つかりません: ${envMdPath}`);
                return;
            }
            let content = fs.readFileSync(envMdPath, 'utf8');
            const lines = content.split('\n');
            // 変数名に一致する行を検索して更新
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // 環境変数の行を検出
                const varMatch = line.match(/^-\s+\[([ x])\]\s+`?([A-Z0-9_]+)`?\s*-?\s*(.*)$/);
                if (varMatch && varMatch[2] === name) {
                    // 設定状態を更新
                    lines[i] = line.replace(/^-\s+\[([ x])\]/, isConfigured ? '- [x]' : '- [ ]');
                    break;
                }
            }
            // 更新した内容をファイルに書き込む
            content = lines.join('\n');
            fs.writeFileSync(envMdPath, content, 'utf8');
            logger_1.Logger.info(`env.mdの変数 ${name} の状態を更新しました: ${isConfigured ? '設定済み' : '未設定'}`);
        }
        catch (error) {
            logger_1.Logger.error(`env.md更新エラー:`, error);
            throw error;
        }
    }
    /**
     * セキュアなランダム文字列を生成
     * @param length 文字列の長さ
     * @returns ランダム文字列
     */
    _generateSecureRandomString(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
        let result = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            result += characters.charAt(randomIndex);
        }
        return result;
    }
}
exports.EnvVariablesEditor = EnvVariablesEditor;
//# sourceMappingURL=EnvVariablesEditor.js.map