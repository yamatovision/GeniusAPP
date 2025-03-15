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
exports.PromptSelector = void 0;
const vscode = __importStar(require("vscode"));
const claudeCodeApiClient_1 = require("../../api/claudeCodeApiClient");
const ClaudeCodeIntegrationService_1 = require("../../services/ClaudeCodeIntegrationService");
const logger_1 = require("../../utils/logger");
class PromptSelector {
    /**
     * コンストラクタ - プライベート（直接インスタンス生成禁止）
     */
    constructor() {
        this._quickPick = vscode.window.createQuickPick();
        this._apiClient = claudeCodeApiClient_1.ClaudeCodeApiClient.getInstance();
        this._integrationService = ClaudeCodeIntegrationService_1.ClaudeCodeIntegrationService.getInstance();
        this._initializeQuickPick();
    }
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!PromptSelector.instance) {
            PromptSelector.instance = new PromptSelector();
        }
        return PromptSelector.instance;
    }
    /**
     * QuickPickの初期化
     */
    _initializeQuickPick() {
        this._quickPick.placeholder = '使用するプロンプトを選択してください';
        this._quickPick.matchOnDescription = true;
        this._quickPick.matchOnDetail = true;
        // QuickPickの選択変更ハンドラー
        this._quickPick.onDidAccept(async () => {
            try {
                const selectedItem = this._quickPick.selectedItems[0];
                if (!selectedItem) {
                    return;
                }
                this._quickPick.hide();
                // ワークスペースの選択
                await this._selectWorkspaceAndLaunch(selectedItem.id);
            }
            catch (error) {
                logger_1.Logger.error('プロンプト選択処理中にエラーが発生しました', error);
                vscode.window.showErrorMessage(`プロンプト選択中にエラーが発生しました: ${error.message}`);
            }
        });
        // QuickPickが非表示になったときのハンドラー
        this._quickPick.onDidHide(() => {
            this._quickPick.items = [];
        });
    }
    /**
     * プロンプト選択UIを表示
     */
    async show() {
        try {
            this._quickPick.busy = true;
            // プロンプト一覧を取得
            const prompts = await this._apiClient.getPrompts();
            if (!prompts || prompts.length === 0) {
                vscode.window.showInformationMessage('利用可能なプロンプトがありません。プロンプトライブラリに追加してください。');
                return;
            }
            // QuickPickアイテムに変換
            const promptItems = prompts.map(prompt => ({
                label: prompt.title,
                description: prompt.category || '',
                detail: prompt.tags ? prompt.tags.join(', ') : '',
                id: prompt.id
            }));
            this._quickPick.items = promptItems;
            this._quickPick.busy = false;
            this._quickPick.show();
        }
        catch (error) {
            logger_1.Logger.error('プロンプト選択UI表示中にエラーが発生しました', error);
            vscode.window.showErrorMessage(`プロンプト選択UI表示中にエラーが発生しました: ${error.message}`);
        }
    }
    /**
     * ワークスペースの選択とClaudeCodeの起動
     */
    async _selectWorkspaceAndLaunch(promptId) {
        try {
            // プロジェクトルートを取得
            const workspaceFolders = vscode.workspace.workspaceFolders;
            let projectPath;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('プロジェクトフォルダが開かれていません。');
                return;
            }
            else if (workspaceFolders.length === 1) {
                projectPath = workspaceFolders[0].uri.fsPath;
            }
            else {
                // 複数のワークスペースがある場合は選択させる
                const folderItems = workspaceFolders.map(folder => ({
                    label: folder.name,
                    description: folder.uri.fsPath,
                    path: folder.uri.fsPath
                }));
                const selectedFolder = await vscode.window.showQuickPick(folderItems, {
                    placeHolder: 'プロジェクトフォルダを選択してください'
                });
                if (!selectedFolder) {
                    return;
                }
                projectPath = selectedFolder.path;
            }
            // ClaudeCodeを起動
            await this._integrationService.launchWithPrompt(promptId, projectPath);
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCode起動中にエラーが発生しました', error);
            vscode.window.showErrorMessage(`ClaudeCode起動中にエラーが発生しました: ${error.message}`);
        }
    }
    /**
     * リソース解放
     */
    dispose() {
        this._quickPick.dispose();
    }
}
exports.PromptSelector = PromptSelector;
//# sourceMappingURL=PromptSelector.js.map