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
exports.registerPromptLibraryCommands = registerPromptLibraryCommands;
const vscode = __importStar(require("vscode"));
const PromptLibraryPanel_1 = require("../ui/promptLibrary/PromptLibraryPanel");
const PromptImportExport_1 = require("../ui/promptLibrary/PromptImportExport");
/**
 * プロンプトライブラリ関連のコマンドを登録する
 * @param context 拡張機能のコンテキスト
 */
function registerPromptLibraryCommands(context) {
    // プロンプトライブラリを表示するコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius.openPromptLibrary', () => {
        PromptLibraryPanel_1.PromptLibraryPanel.createOrShow(context.extensionUri);
    }));
    // プロンプトエディタを開くコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius.editPrompt', (promptId) => {
        PromptLibraryPanel_1.PromptLibraryPanel.createOrShow(context.extensionUri, promptId ? { mode: 'edit', promptId } : undefined);
    }));
    // 新規プロンプトを作成するコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius.createNewPrompt', () => {
        PromptLibraryPanel_1.PromptLibraryPanel.createOrShow(context.extensionUri, { mode: 'create' });
    }));
    // プロンプトをエクスポートするコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius.exportPrompts', async () => {
        const promptImportExport = new PromptImportExport_1.PromptImportExport();
        await promptImportExport.exportPrompts();
    }));
    // プロンプトをインポートするコマンド
    context.subscriptions.push(vscode.commands.registerCommand('appgenius.importPrompts', async () => {
        const promptImportExport = new PromptImportExport_1.PromptImportExport();
        await promptImportExport.importPrompts();
    }));
}
//# sourceMappingURL=promptLibraryCommands.js.map