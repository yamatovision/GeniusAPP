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
exports.ConfigManager = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("./logger");
/**
 * 拡張機能の設定を管理するクラス
 */
class ConfigManager {
    /**
     * 設定値を取得する
     */
    static get(key, defaultValue) {
        try {
            const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
            const value = config.get(key, defaultValue);
            return value;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to get config value for ${key}`, error);
            return defaultValue;
        }
    }
    /**
     * 設定値を更新する
     */
    static async update(key, value, global = false) {
        try {
            const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
            await config.update(key, value, global);
            logger_1.Logger.debug(`Config ${key} updated to ${value}`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to update config ${key}`, error);
            throw new Error(`設定 ${key} の更新に失敗しました`);
        }
    }
    /**
     * 拡張機能のバージョンを取得する
     */
    static getExtensionVersion() {
        try {
            const extension = vscode.extensions.getExtension('appgenius-ai.appgenius-ai');
            return extension ? extension.packageJSON.version : 'unknown';
        }
        catch (error) {
            logger_1.Logger.error('Failed to get extension version', error);
            return 'unknown';
        }
    }
    /**
     * デバッグモードが有効かどうかを取得する
     */
    static isDebugMode() {
        return this.get('debugMode', false);
    }
    /**
     * API認証情報を安全に保存する
     */
    static async saveApiCredentials(apiKey) {
        try {
            // VSCodeのSecretsを使用して安全に保存
            await vscode.workspace.getConfiguration(this.CONFIG_SECTION).update('apiKeyExists', true, true);
            // 実際のキーを保存（実際のプロダクションコードではSecrets APIを使用すべき）
            // この実装はPhase 1のプロトタイプ用
            await this.update('apiKey', apiKey, true);
            logger_1.Logger.info('API credentials saved');
        }
        catch (error) {
            logger_1.Logger.error('Failed to save API credentials', error);
            throw new Error('API認証情報の保存に失敗しました');
        }
    }
    /**
     * API認証情報を取得する
     */
    static getApiCredentials() {
        try {
            // APIキーが存在するかチェック
            const apiKeyExists = this.get('apiKeyExists', false);
            if (!apiKeyExists) {
                return undefined;
            }
            // 実際のキーを取得（実際のプロダクションコードではSecrets APIを使用すべき）
            return this.get('apiKey');
        }
        catch (error) {
            logger_1.Logger.error('Failed to get API credentials', error);
            return undefined;
        }
    }
    /**
     * API認証情報を削除する
     */
    static async clearApiCredentials() {
        try {
            await vscode.workspace.getConfiguration(this.CONFIG_SECTION).update('apiKeyExists', false, true);
            await this.update('apiKey', undefined, true);
            logger_1.Logger.info('API credentials cleared');
        }
        catch (error) {
            logger_1.Logger.error('Failed to clear API credentials', error);
            throw new Error('API認証情報の削除に失敗しました');
        }
    }
}
exports.ConfigManager = ConfigManager;
ConfigManager.CONFIG_SECTION = 'appgeniusAI';
//# sourceMappingURL=configManager.js.map