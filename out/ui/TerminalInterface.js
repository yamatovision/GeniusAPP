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
exports.TerminalInterface = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
/**
 * AppGenius AIのターミナルインターフェースを管理するクラス
 * ユーザー入力の受付とAI応答の表示を担当
 */
class TerminalInterface {
    constructor(aiService) {
        this.aiService = aiService;
    }
    /**
     * シングルトンインスタンスを取得または作成
     */
    static getInstance(aiService) {
        if (!TerminalInterface.instance) {
            TerminalInterface.instance = new TerminalInterface(aiService);
        }
        return TerminalInterface.instance;
    }
    /**
     * ターミナルを表示し、初期化する
     */
    showTerminal() {
        try {
            if (!this.terminal) {
                // ターミナル作成をデバッグログに記録
                logger_1.Logger.debug('ターミナルを作成しています...');
                // 新しいターミナルインスタンスを作成
                this.terminal = vscode.window.createTerminal({
                    name: 'AppGenius AI',
                    hideFromUser: false,
                    isTransient: false
                });
                logger_1.Logger.info('AppGenius AI ターミナルを作成しました');
                // 1秒待ってからメッセージを表示（ターミナル初期化待ち）
                setTimeout(() => {
                    try {
                        // 初期メッセージを表示
                        if (this.terminal) {
                            // シンプルな初期メッセージ
                            this.terminal.sendText(`AppGenius AI ターミナルへようこそ！`);
                            this.terminal.sendText(`コマンドを入力してください（例: /help）`);
                            this.terminal.sendText(``);
                            logger_1.Logger.debug('ターミナルに初期メッセージを送信しました');
                            // シンプルなプロンプト
                            this.terminal.sendText(`> `);
                        }
                    }
                    catch (error) {
                        logger_1.Logger.error(`ターミナルメッセージ表示中にエラー: ${error.message}`);
                        vscode.window.showErrorMessage(`ターミナル初期化エラー: ${error.message}`);
                    }
                }, 1000);
            }
            // ターミナルを前面に表示
            this.terminal.show(true);
            logger_1.Logger.debug('ターミナルを表示しました');
            // ターミナルのフォーカスを明示的に設定
            vscode.commands.executeCommand('workbench.action.terminal.focus');
        }
        catch (error) {
            logger_1.Logger.error(`ターミナル表示中にエラー: ${error.message}`);
            vscode.window.showErrorMessage(`ターミナルエラー: ${error.message}`);
            // エラー発生時はステータスバーに通知
            vscode.window.setStatusBarMessage(`AppGenius AI ターミナルエラー`, 5000);
        }
    }
    /**
     * AIへの問い合わせを処理し、結果をターミナルに表示
     */
    async processQuery(query) {
        try {
            // ターミナルがなければ作成
            if (!this.terminal) {
                this.showTerminal();
                // ターミナル初期化待ち
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            logger_1.Logger.debug(`ユーザーからのクエリを処理: ${query}`);
            // ユーザー入力を入力欄として直接表示（echo コマンドを使わない）
            this.terminal?.sendText(query);
            try {
                // AIの処理を開始 - 処理中表示は簡潔に
                this.terminal?.sendText(`処理中...`);
                // AIサービスからの応答を取得
                const response = await this.aiService.processMessage(query);
                // 応答をターミナルに直接表示（echo コマンドを使わない）
                this.terminal?.sendText(`${response}`);
                // プロンプト表示も簡潔に
                this.terminal?.sendText(`> `);
                logger_1.Logger.debug('AI応答を表示しました');
            }
            catch (error) {
                logger_1.Logger.error(`AI処理中にエラーが発生: ${error.message}`);
                this.terminal?.sendText(`エラー: ${error.message}`);
                this.terminal?.sendText(`> `);
            }
        }
        catch (error) {
            logger_1.Logger.error(`クエリ処理中にエラーが発生: ${error.message}`);
            vscode.window.showErrorMessage(`AI応答エラー: ${error.message}`);
        }
    }
    /**
     * ファイル操作の開始を通知
     */
    notifyFileOperation(filePath, operation) {
        try {
            if (!this.terminal) {
                this.showTerminal();
            }
            const operationText = {
                'create': '作成',
                'modify': '修正',
                'delete': '削除'
            }[operation];
            this.terminal?.sendText(`ファイルを${operationText}しています: ${filePath}`);
            logger_1.Logger.debug(`ファイル${operationText}開始: ${filePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`ファイル操作通知エラー: ${error.message}`);
        }
    }
    /**
     * ファイル操作の完了を通知
     */
    notifyFileOperationComplete(filePath, operation) {
        try {
            if (!this.terminal) {
                this.showTerminal();
            }
            const operationText = {
                'create': '作成',
                'modify': '修正',
                'delete': '削除'
            }[operation];
            this.terminal?.sendText(`ファイルの${operationText}が完了しました: ${filePath}`);
            logger_1.Logger.debug(`ファイル${operationText}完了: ${filePath}`);
            // ファイルをエディタで開く（create か modify の場合のみ）
            if (operation === 'create' || operation === 'modify') {
                this.openFileInEditor(filePath);
            }
        }
        catch (error) {
            logger_1.Logger.error(`ファイル操作完了通知エラー: ${error.message}`);
        }
    }
    /**
     * 指定されたファイルをエディタで開く
     */
    async openFileInEditor(filePath) {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
            logger_1.Logger.debug(`ファイルをエディタで開きました: ${filePath}`);
        }
        catch (error) {
            logger_1.Logger.error(`ファイルを開く際にエラーが発生: ${error.message}`);
        }
    }
    /**
     * AIからのレスポンスを処理し表示
     * @param result 表示する結果
     */
    processResult(result) {
        try {
            if (!this.terminal) {
                this.showTerminal();
            }
            this.terminal?.sendText(result);
            this.terminal?.sendText(`> `);
            logger_1.Logger.debug('処理結果を表示しました');
        }
        catch (error) {
            logger_1.Logger.error(`結果表示中にエラーが発生: ${error.message}`);
        }
    }
    /**
     * リソースを解放
     */
    dispose() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = undefined;
        }
    }
}
exports.TerminalInterface = TerminalInterface;
//# sourceMappingURL=TerminalInterface.js.map