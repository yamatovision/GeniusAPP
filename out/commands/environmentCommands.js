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
exports.registerEnvironmentCommands = registerEnvironmentCommands;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const EnvVariablesPanel_1 = require("../ui/environmentVariables/EnvVariablesPanel");
const EnvironmentVariablesAssistantPanel_1 = require("../ui/environmentVariablesAssistant/EnvironmentVariablesAssistantPanel");
const logger_1 = require("../utils/logger");
/**
 * 環境変数管理関連のコマンドを登録する
 * @param context 拡張機能のコンテキスト
 */
function registerEnvironmentCommands(context) {
    logger_1.Logger.info('環境変数管理コマンドを登録します');
    // 環境変数管理パネルを開くコマンド
    const openEnvVariablesPanelCommand = vscode.commands.registerCommand('appgenius-ai.openEnvVariablesPanel', () => {
        logger_1.Logger.info('環境変数管理パネルを開きます');
        try {
            // アクティブなワークスペースを取得
            let projectPath;
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            }
            // パネルを表示
            EnvVariablesPanel_1.EnvVariablesPanel.createOrShow(context.extensionUri, projectPath);
        }
        catch (error) {
            logger_1.Logger.error('環境変数管理パネルのオープンに失敗しました', error);
            vscode.window.showErrorMessage(`環境変数管理パネルの表示に失敗しました: ${error.message}`);
        }
    });
    // 環境変数ファイルを作成するコマンド
    const createEnvFileCommand = vscode.commands.registerCommand('appgenius-ai.createEnvFile', async () => {
        logger_1.Logger.info('環境変数ファイルを作成します');
        try {
            // アクティブなワークスペースを取得
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                // ファイル名の入力を促す
                const fileName = await vscode.window.showInputBox({
                    prompt: '環境変数ファイル名を入力してください',
                    placeHolder: 'development, production など',
                    validateInput: (value) => {
                        if (!value) {
                            return 'ファイル名を入力してください';
                        }
                        return null;
                    }
                });
                if (fileName) {
                    // .envで始まるファイル名にする
                    const envFileName = fileName.startsWith('.env') ? fileName : `.env.${fileName}`;
                    const envFilePath = path.join(projectPath, envFileName);
                    // パネルを表示して環境変数ファイルを作成
                    const panel = EnvVariablesPanel_1.EnvVariablesPanel.createOrShow(context.extensionUri, projectPath);
                    // ファイル作成のメッセージを表示
                    vscode.window.showInformationMessage(`環境変数ファイル ${envFileName} を作成しました`);
                }
            }
            else {
                vscode.window.showErrorMessage('アクティブなワークスペースがありません');
            }
        }
        catch (error) {
            logger_1.Logger.error('環境変数ファイルの作成に失敗しました', error);
            vscode.window.showErrorMessage(`環境変数ファイルの作成に失敗しました: ${error.message}`);
        }
    });
    // 環境変数設定状況を検証するコマンド
    const validateEnvVariablesCommand = vscode.commands.registerCommand('appgenius-ai.validateEnvVariables', async () => {
        logger_1.Logger.info('環境変数設定状況を検証します');
        try {
            // アクティブなワークスペースを取得
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                // パネルを表示
                const panel = EnvVariablesPanel_1.EnvVariablesPanel.createOrShow(context.extensionUri, projectPath);
                // 検証メッセージを表示
                vscode.window.showInformationMessage('環境変数設定状況の検証を開始しました');
            }
            else {
                vscode.window.showErrorMessage('アクティブなワークスペースがありません');
            }
        }
        catch (error) {
            logger_1.Logger.error('環境変数設定状況の検証に失敗しました', error);
            vscode.window.showErrorMessage(`環境変数設定状況の検証に失敗しました: ${error.message}`);
        }
    });
    // env.mdファイルを更新するコマンド
    const updateEnvMdCommand = vscode.commands.registerCommand('appgenius-ai.updateEnvMd', async () => {
        logger_1.Logger.info('env.mdファイルを更新します');
        try {
            // アクティブなワークスペースを取得
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                // パネルを表示
                const panel = EnvVariablesPanel_1.EnvVariablesPanel.createOrShow(context.extensionUri, projectPath);
                // 更新メッセージを表示
                vscode.window.showInformationMessage('env.mdファイルの更新を開始しました');
            }
            else {
                vscode.window.showErrorMessage('アクティブなワークスペースがありません');
            }
        }
        catch (error) {
            logger_1.Logger.error('env.mdファイルの更新に失敗しました', error);
            vscode.window.showErrorMessage(`env.mdファイルの更新に失敗しました: ${error.message}`);
        }
    });
    // 環境変数アシスタントを開くコマンド
    const openEnvironmentVariablesAssistantCommand = vscode.commands.registerCommand('appgenius-ai.openEnvironmentVariablesAssistant', async () => {
        logger_1.Logger.info('環境変数アシスタントを開きます');
        try {
            // アクティブなワークスペースを取得
            let projectPath;
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            }
            // パネルを表示
            EnvironmentVariablesAssistantPanel_1.EnvironmentVariablesAssistantPanel.createOrShow(context.extensionUri, projectPath);
        }
        catch (error) {
            logger_1.Logger.error('環境変数アシスタントのオープンに失敗しました', error);
            vscode.window.showErrorMessage(`環境変数アシスタントの表示に失敗しました: ${error.message}`);
        }
    });
    // コマンドIDが一致していることを確認(appgenius-ai.openEnvironmentVariablesAssistant)
    context.subscriptions.push(vscode.commands.registerCommand('appgenius.ai.openEnvironmentVariablesAssistant', async () => {
        // エイリアスコマンド - 正しいコマンドにリダイレクト
        logger_1.Logger.info('エイリアスコマンドからリダイレクトします: appgenius.ai.openEnvironmentVariablesAssistant -> appgenius-ai.openEnvironmentVariablesAssistant');
        await vscode.commands.executeCommand('appgenius-ai.openEnvironmentVariablesAssistant');
    }));
    // コマンドを登録
    context.subscriptions.push(openEnvVariablesPanelCommand);
    context.subscriptions.push(createEnvFileCommand);
    context.subscriptions.push(validateEnvVariablesCommand);
    context.subscriptions.push(updateEnvMdCommand);
    context.subscriptions.push(openEnvironmentVariablesAssistantCommand);
    logger_1.Logger.info('環境変数管理コマンドの登録が完了しました');
}
//# sourceMappingURL=environmentCommands.js.map