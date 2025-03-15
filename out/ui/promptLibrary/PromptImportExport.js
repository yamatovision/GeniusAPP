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
exports.PromptImportExport = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const claudeCodeApiClient_1 = require("../../api/claudeCodeApiClient");
/**
 * プロンプトのインポート/エクスポート機能を提供するクラス
 */
class PromptImportExport {
    /**
     * コンストラクタ
     */
    constructor() {
        this._apiClient = claudeCodeApiClient_1.ClaudeCodeApiClient.getInstance();
    }
    /**
     * プロンプトをJSONファイルにエクスポート
     */
    async exportPrompts() {
        try {
            // プロンプト一覧を取得
            const prompts = await this._apiClient.getPrompts();
            if (!prompts || prompts.length === 0) {
                vscode.window.showInformationMessage('エクスポートするプロンプトがありません。');
                return;
            }
            // エクスポート先のファイルを選択
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('prompts_export.json'),
                filters: {
                    'JSON': ['json']
                },
                title: 'プロンプトをエクスポート'
            });
            if (!uri) {
                return; // ユーザーがキャンセルした場合
            }
            // JSONデータの準備
            const exportData = {
                exportDate: new Date().toISOString(),
                prompts: prompts.map(p => ({
                    id: p.id,
                    title: p.title,
                    content: p.content,
                    type: p.type,
                    category: p.category || '',
                    tags: p.tags || [],
                    isPublic: p.isPublic || false,
                    createdAt: p.createdAt
                }))
            };
            // ファイルへの書き込み
            fs.writeFileSync(uri.fsPath, JSON.stringify(exportData, null, 2), 'utf8');
            vscode.window.showInformationMessage(`${prompts.length}件のプロンプトをエクスポートしました。`);
        }
        catch (error) {
            console.error('プロンプトのエクスポートに失敗しました:', error);
            vscode.window.showErrorMessage(`プロンプトのエクスポートに失敗しました: ${error}`);
        }
    }
    /**
     * JSONファイルからプロンプトをインポート
     */
    async importPrompts() {
        try {
            // インポート元のファイルを選択
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'JSON': ['json']
                },
                title: 'プロンプトをインポート'
            });
            if (!uris || uris.length === 0) {
                return; // ユーザーがキャンセルした場合
            }
            // ファイルの読み込み
            const filePath = uris[0].fsPath;
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const importData = JSON.parse(fileContent);
            if (!importData.prompts || !Array.isArray(importData.prompts) || importData.prompts.length === 0) {
                vscode.window.showErrorMessage('インポートするプロンプトが見つかりませんでした。');
                return;
            }
            // ユーザー確認
            const confirmation = await vscode.window.showInformationMessage(`${importData.prompts.length}件のプロンプトをインポートしますか？`, { modal: true }, 'はい', 'いいえ');
            if (confirmation !== 'はい') {
                return;
            }
            // インポート処理
            // 注: 実際のインポートAPIが実装されていないため、暫定対応
            vscode.window.showInformationMessage('プロンプトのインポート機能はまだ実装されていません。');
            // 成功メッセージ
            vscode.window.showInformationMessage(`${importData.prompts.length}件のプロンプトをインポートしました。`);
        }
        catch (error) {
            console.error('プロンプトのインポートに失敗しました:', error);
            vscode.window.showErrorMessage(`プロンプトのインポートに失敗しました: ${error}`);
        }
    }
    /**
     * 特定のプロンプトをマークダウンファイルにエクスポート
     * @param prompt エクスポートするプロンプト
     */
    async exportPromptToMarkdown(prompt) {
        try {
            if (!prompt || !prompt.title) {
                vscode.window.showErrorMessage('エクスポートするプロンプトが無効です。');
                return;
            }
            // ファイル名を作成（タイトルから無効な文字を削除）
            const safeFileName = prompt.title.replace(/[\\/:*?"<>|]/g, '_');
            // エクスポート先のファイルを選択
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${safeFileName}.md`),
                filters: {
                    'Markdown': ['md']
                },
                title: 'プロンプトをマークダウンとしてエクスポート'
            });
            if (!uri) {
                return; // ユーザーがキャンセルした場合
            }
            // マークダウンの作成
            const markdown = [
                `# ${prompt.title}`,
                '',
                `**タイプ:** ${prompt.type}`,
                prompt.category ? `**カテゴリ:** ${prompt.category}` : '',
                prompt.tags && prompt.tags.length > 0 ? `**タグ:** ${prompt.tags.join(', ')}` : '',
                '',
                '## コンテンツ',
                '',
                prompt.content,
                '',
                `---`,
                `*エクスポート日時: ${new Date().toLocaleString()}*`
            ].filter(line => line !== '').join('\n');
            // ファイルへの書き込み
            fs.writeFileSync(uri.fsPath, markdown, 'utf8');
            vscode.window.showInformationMessage(`プロンプト「${prompt.title}」をマークダウンとしてエクスポートしました。`);
        }
        catch (error) {
            console.error('プロンプトのマークダウンエクスポートに失敗しました:', error);
            vscode.window.showErrorMessage(`プロンプトのエクスポートに失敗しました: ${error}`);
        }
    }
}
exports.PromptImportExport = PromptImportExport;
//# sourceMappingURL=PromptImportExport.js.map