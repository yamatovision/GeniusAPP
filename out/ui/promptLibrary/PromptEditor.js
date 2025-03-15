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
exports.PromptEditor = void 0;
const vscode = __importStar(require("vscode"));
const claudeCodeApiClient_1 = require("../../api/claudeCodeApiClient");
/**
 * プロンプトエディタクラス
 * - プロンプトの閲覧
 * - プロンプトの編集
 * - 新規プロンプトの作成
 */
class PromptEditor {
    /**
     * コンストラクタ
     */
    constructor() {
        this._currentPrompt = null;
        this._mode = 'view';
        this._apiClient = claudeCodeApiClient_1.ClaudeCodeApiClient.getInstance();
    }
    /**
     * プロンプトをロード
     * @param promptId プロンプトID
     */
    async loadPrompt(promptId) {
        try {
            const prompt = await this._apiClient.getPromptDetail(promptId);
            if (prompt) {
                this._currentPrompt = {
                    id: prompt.id,
                    title: prompt.title,
                    content: prompt.content,
                    type: prompt.type,
                    category: prompt.category || '',
                    tags: prompt.tags || [],
                    isPublic: prompt.isPublic || false
                };
                return this._currentPrompt;
            }
            vscode.window.showErrorMessage(`プロンプト(ID: ${promptId})の取得に失敗しました。`);
            return null;
        }
        catch (error) {
            console.error(`プロンプト(ID: ${promptId})のロードに失敗しました:`, error);
            vscode.window.showErrorMessage(`プロンプトの取得に失敗しました: ${error}`);
            return null;
        }
    }
    /**
     * 現在のプロンプトを取得
     */
    getCurrentPrompt() {
        return this._currentPrompt;
    }
    /**
     * 新規プロンプト作成モードの初期化
     */
    initNewPrompt() {
        this._currentPrompt = {
            title: '',
            content: '',
            type: 'system',
            category: '',
            tags: [],
            isPublic: false
        };
        this._mode = 'create';
    }
    /**
     * 編集モードを設定
     */
    setMode(mode) {
        this._mode = mode;
    }
    /**
     * 現在のモードを取得
     */
    getMode() {
        return this._mode;
    }
    /**
     * プロンプトの更新または作成
     * @param promptData プロンプトデータ
     */
    async savePrompt(promptData) {
        try {
            // バリデーション
            if (!promptData.title || promptData.title.trim() === '') {
                vscode.window.showErrorMessage('タイトルは必須です。');
                return false;
            }
            if (!promptData.content || promptData.content.trim() === '') {
                vscode.window.showErrorMessage('プロンプト内容は必須です。');
                return false;
            }
            // APIに送信するデータを準備
            // 注: 実際のAPIによって必要なフォーマットは異なる可能性があるため、
            // 必要に応じてこの部分を調整する必要があります
            const apiData = {
                title: promptData.title.trim(),
                content: promptData.content.trim(),
                type: promptData.type,
                category: promptData.category || undefined,
                tags: promptData.tags && promptData.tags.length > 0 ? promptData.tags : undefined,
                isPublic: promptData.isPublic
            };
            // 新規作成または更新
            let success = false;
            // 注: 実際のAPIエンドポイントはプロジェクトによって異なるため、
            // 必要に応じてこの部分を調整する必要があります
            if (this._mode === 'create') {
                // 新規作成のAPIコールがまだ実装されていないため、暫定対応
                vscode.window.showInformationMessage('プロンプトの新規作成機能はまだ実装されていません。');
                success = true;
            }
            else if (this._mode === 'edit' && this._currentPrompt?.id) {
                // 更新のAPIコールがまだ実装されていないため、暫定対応
                vscode.window.showInformationMessage('プロンプトの更新機能はまだ実装されていません。');
                success = true;
            }
            if (success) {
                this._currentPrompt = promptData;
                vscode.window.showInformationMessage('プロンプトを保存しました。');
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('プロンプトの保存に失敗しました:', error);
            vscode.window.showErrorMessage(`プロンプトの保存に失敗しました: ${error}`);
            return false;
        }
    }
    /**
     * プロンプトの利用履歴を記録
     * @param promptId プロンプトID
     */
    async recordUsage(promptId) {
        try {
            // プロンプト詳細を取得し、最新のバージョンIDを特定
            const prompt = await this._apiClient.getPromptDetail(promptId);
            if (!prompt) {
                return false;
            }
            // バージョン履歴を取得
            const versions = await this._apiClient.getPromptVersions(promptId);
            if (!versions || versions.length === 0) {
                return false;
            }
            // 最新のバージョンID
            const latestVersionId = versions[0].id;
            // 利用履歴を記録
            return await this._apiClient.recordPromptUsage(promptId, latestVersionId, 'vscode-extension');
        }
        catch (error) {
            console.error('プロンプト利用履歴の記録に失敗しました:', error);
            return false;
        }
    }
}
exports.PromptEditor = PromptEditor;
//# sourceMappingURL=PromptEditor.js.map