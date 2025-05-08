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
exports.CommandHandler = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
const TerminalInterface_1 = require("./TerminalInterface");
/**
 * VSCodeのコマンドハンドラークラス
 * ユーザーのコマンド入力を受け付け、AIに転送する
 */
class CommandHandler {
    constructor(aiService) {
        this.aiService = aiService;
        this.disposables = [];
        this.lastQuery = '';
        this.terminalInterface = TerminalInterface_1.TerminalInterface.getInstance(aiService);
        this.registerCommands();
    }
    /**
     * コマンドを登録
     */
    registerCommands() {
        // AIコマンド実行
        this.disposables.push(vscode.commands.registerCommand('appgenius-ai.executeCommand', async () => {
            try {
                const query = await vscode.window.showInputBox({
                    prompt: 'AIへのコマンドまたは質問を入力',
                    placeHolder: 'AIへの指示を入力してください...',
                    value: this.lastQuery
                });
                if (query) {
                    this.lastQuery = query;
                    this.terminalInterface.showTerminal();
                    await this.terminalInterface.processQuery(query);
                }
            }
            catch (error) {
                logger_1.Logger.error(`コマンド実行エラー: ${error.message}`);
                vscode.window.showErrorMessage(`コマンド実行エラー: ${error.message}`);
            }
        }));
        // ターミナルを表示
        this.disposables.push(vscode.commands.registerCommand('appgenius-ai.showTerminal', () => {
            this.terminalInterface.showTerminal();
        }));
        // ヘルプを表示
        this.disposables.push(vscode.commands.registerCommand('appgenius-ai.showHelp', async () => {
            this.terminalInterface.showTerminal();
            await this.terminalInterface.processQuery('/help');
        }));
        // ターミナルからログアウト
        this.disposables.push(vscode.commands.registerCommand('appgenius-ai.logout', async () => {
            try {
                logger_1.Logger.info('ターミナルからログアウトコマンドが実行されました');
                this.terminalInterface.showTerminal();
                await this.terminalInterface.processLogout();
            }
            catch (error) {
                logger_1.Logger.error(`ログアウトコマンド実行エラー: ${error.message}`);
                vscode.window.showErrorMessage(`ログアウトエラー: ${error.message}`);
            }
        }));
    }
    /**
     * リソースを解放
     */
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.terminalInterface.dispose();
    }
}
exports.CommandHandler = CommandHandler;
//# sourceMappingURL=CommandHandler.js.map