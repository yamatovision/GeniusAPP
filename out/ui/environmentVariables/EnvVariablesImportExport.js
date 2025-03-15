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
exports.EnvVariablesImportExport = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../../utils/logger");
/**
 * 環境変数インポート・エクスポートクラス
 * 環境変数のインポート、エクスポート、変換を行う
 */
class EnvVariablesImportExport {
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
     * 環境変数をJSONファイルからインポート
     * @param jsonFilePath JSONファイルパス
     * @returns インポートした環境変数
     */
    async importFromJson(jsonFilePath) {
        try {
            // ファイルが存在するかチェック
            if (!fs.existsSync(jsonFilePath)) {
                throw new Error(`ファイル ${jsonFilePath} が見つかりません`);
            }
            // JSONファイルを読み込む
            const content = fs.readFileSync(jsonFilePath, 'utf8');
            const data = JSON.parse(content);
            // 環境変数を抽出
            const variables = {};
            for (const key in data) {
                if (typeof data[key] === 'string') {
                    variables[key] = data[key];
                }
                else {
                    variables[key] = JSON.stringify(data[key]);
                }
            }
            logger_1.Logger.info(`JSONファイルから環境変数をインポートしました: ${jsonFilePath}`);
            return variables;
        }
        catch (error) {
            logger_1.Logger.error(`JSONインポートエラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数をJSONファイルにエクスポート
     * @param variables 環境変数
     * @param jsonFilePath JSONファイルパス
     */
    async exportToJson(variables, jsonFilePath) {
        try {
            // JSONデータを作成
            const data = { ...variables };
            // JSONファイルに書き込み
            fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf8');
            logger_1.Logger.info(`環境変数をJSONファイルにエクスポートしました: ${jsonFilePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`JSONエクスポートエラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数をYAMLファイルからインポート
     * @param yamlFilePath YAMLファイルパス
     * @returns インポートした環境変数
     */
    async importFromYaml(yamlFilePath) {
        try {
            // ファイルが存在するかチェック
            if (!fs.existsSync(yamlFilePath)) {
                throw new Error(`ファイル ${yamlFilePath} が見つかりません`);
            }
            // YAMLファイルを読み込む
            const content = fs.readFileSync(yamlFilePath, 'utf8');
            // 簡易的なYAML解析（実際の実装では正式なYAMLパーサーを使用）
            const variables = {};
            content.split('\n').forEach(line => {
                // コメント行をスキップ
                if (line.startsWith('#')) {
                    return;
                }
                // キーと値を分離
                const match = line.match(/^\s*([\w.-]+)\s*:\s*(.*)?\s*$/);
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
            logger_1.Logger.info(`YAMLファイルから環境変数をインポートしました: ${yamlFilePath}`);
            return variables;
        }
        catch (error) {
            logger_1.Logger.error(`YAMLインポートエラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数をYAMLファイルにエクスポート
     * @param variables 環境変数
     * @param yamlFilePath YAMLファイルパス
     */
    async exportToYaml(variables, yamlFilePath) {
        try {
            // YAML形式に変換
            let content = '';
            for (const key in variables) {
                const value = variables[key];
                // 値に特殊文字が含まれる場合は引用符で囲む
                const needQuotes = /[:#]/.test(value) || value.includes(' ');
                content += `${key}: ${needQuotes ? `"${value}"` : value}\n`;
            }
            // YAMLファイルに書き込み
            fs.writeFileSync(yamlFilePath, content, 'utf8');
            logger_1.Logger.info(`環境変数をYAMLファイルにエクスポートしました: ${yamlFilePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`YAMLエクスポートエラー:`, error);
            throw error;
        }
    }
    /**
     * .envファイルから環境変数をインポート
     * @param envFilePath .envファイルパス
     * @returns インポートした環境変数
     */
    async importFromEnv(envFilePath) {
        try {
            // ファイルが存在するかチェック
            if (!fs.existsSync(envFilePath)) {
                throw new Error(`ファイル ${envFilePath} が見つかりません`);
            }
            // .envファイルを読み込む
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
            logger_1.Logger.info(`.envファイルから環境変数をインポートしました: ${envFilePath}`);
            return variables;
        }
        catch (error) {
            logger_1.Logger.error(`.envインポートエラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数を.envファイルにエクスポート
     * @param variables 環境変数
     * @param envFilePath .envファイルパス
     */
    async exportToEnv(variables, envFilePath) {
        try {
            // .env形式に変換
            let content = '';
            for (const key in variables) {
                const value = variables[key];
                // 値に空白が含まれる場合は引用符で囲む
                const needQuotes = value.includes(' ');
                content += `${key}=${needQuotes ? `"${value}"` : value}\n`;
            }
            // .envファイルに書き込み
            fs.writeFileSync(envFilePath, content, 'utf8');
            logger_1.Logger.info(`環境変数を.envファイルにエクスポートしました: ${envFilePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`.envエクスポートエラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数をCSVファイルからインポート
     * @param csvFilePath CSVファイルパス
     * @returns インポートした環境変数
     */
    async importFromCsv(csvFilePath) {
        try {
            // ファイルが存在するかチェック
            if (!fs.existsSync(csvFilePath)) {
                throw new Error(`ファイル ${csvFilePath} が見つかりません`);
            }
            // CSVファイルを読み込む
            const content = fs.readFileSync(csvFilePath, 'utf8');
            // 環境変数を解析
            const variables = {};
            // CSVの各行を処理
            const lines = content.split('\n');
            // ヘッダー行をスキップ
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line)
                    continue;
                // CSVの値を分離（簡易的な実装）
                const values = line.split(',');
                if (values.length >= 2) {
                    const key = values[0].trim();
                    let value = values[1].trim();
                    // 引用符を取り除く
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    variables[key] = value;
                }
            }
            logger_1.Logger.info(`CSVファイルから環境変数をインポートしました: ${csvFilePath}`);
            return variables;
        }
        catch (error) {
            logger_1.Logger.error(`CSVインポートエラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数をCSVファイルにエクスポート
     * @param variables 環境変数
     * @param csvFilePath CSVファイルパス
     */
    async exportToCsv(variables, csvFilePath) {
        try {
            // CSV形式に変換
            let content = 'Key,Value,Description\n';
            for (const key in variables) {
                const value = variables[key];
                // 値にカンマが含まれる場合は引用符で囲む
                const escapedValue = value.includes(',') ? `"${value}"` : value;
                content += `${key},${escapedValue},\n`;
            }
            // CSVファイルに書き込み
            fs.writeFileSync(csvFilePath, content, 'utf8');
            logger_1.Logger.info(`環境変数をCSVファイルにエクスポートしました: ${csvFilePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`CSVエクスポートエラー:`, error);
            throw error;
        }
    }
    /**
     * 環境変数をCURRENT_STATUS.mdに追加
     * @param variables 環境変数
     */
    async updateCurrentStatusMd(variables) {
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
        }
        catch (error) {
            logger_1.Logger.error(`CURRENT_STATUS.md更新エラー:`, error);
            throw error;
        }
    }
}
exports.EnvVariablesImportExport = EnvVariablesImportExport;
//# sourceMappingURL=EnvVariablesImportExport.js.map