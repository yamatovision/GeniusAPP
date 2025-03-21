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
exports.FileOperationManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
/**
 * ファイル操作を管理するクラス
 * AIによるファイル作成・編集・削除を管理し、UIと連携する
 */
class FileOperationManager {
    constructor() {
        // シングルトンインスタンス
    }
    /**
     * シングルトンインスタンスを取得または作成
     */
    static getInstance() {
        if (!FileOperationManager.instance) {
            FileOperationManager.instance = new FileOperationManager();
        }
        return FileOperationManager.instance;
    }
    /**
     * ターミナルインターフェースを設定
     */
    setTerminalInterface(terminal) {
        this.terminal = terminal;
    }
    /**
     * ファイルを作成または上書き
     */
    async createFile(filePath, content) {
        try {
            // ファイル操作開始を通知
            this.notifyFileOperation(filePath, 'create');
            // ディレクトリが存在しない場合は作成
            const dirPath = path.dirname(filePath);
            await this.ensureDirectoryExists(dirPath);
            // ファイルに書き込み
            fs.writeFileSync(filePath, content, 'utf8');
            // ファイル操作完了を通知
            this.notifyFileOperationComplete(filePath, 'create');
            // エディタでファイルを開く
            await this.openFileInEditor(filePath);
            logger_1.Logger.info(`ファイルを作成しました: ${filePath}`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`ファイル作成エラー: ${error.message}`);
            vscode.window.showErrorMessage(`ファイル作成エラー: ${error.message}`);
            return false;
        }
    }
    /**
     * ファイルを修正
     */
    async updateFile(filePath, oldContent, newContent) {
        try {
            // ファイルが存在するか確認
            if (!fs.existsSync(filePath)) {
                throw new Error(`ファイルが存在しません: ${filePath}`);
            }
            // ファイル操作開始を通知
            this.notifyFileOperation(filePath, 'modify');
            // 現在のファイル内容を読み込み
            const currentContent = fs.readFileSync(filePath, 'utf8');
            // oldContentが空の場合は、ファイル全体を置き換え
            let updatedContent;
            if (!oldContent) {
                updatedContent = newContent;
            }
            else {
                // 指定された部分のみを置き換え
                if (!currentContent.includes(oldContent)) {
                    throw new Error('指定された内容がファイル内に見つかりません');
                }
                updatedContent = currentContent.replace(oldContent, newContent);
            }
            // ファイルに書き込み
            fs.writeFileSync(filePath, updatedContent, 'utf8');
            // ファイル操作完了を通知
            this.notifyFileOperationComplete(filePath, 'modify');
            // エディタでファイルを開く
            await this.openFileInEditor(filePath);
            logger_1.Logger.info(`ファイルを更新しました: ${filePath}`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`ファイル更新エラー: ${error.message}`);
            vscode.window.showErrorMessage(`ファイル更新エラー: ${error.message}`);
            return false;
        }
    }
    /**
     * ファイルを削除
     */
    async deleteFile(filePath) {
        try {
            // ファイルが存在するか確認
            if (!fs.existsSync(filePath)) {
                throw new Error(`ファイルが存在しません: ${filePath}`);
            }
            // ファイル操作開始を通知
            this.notifyFileOperation(filePath, 'delete');
            // ファイルを削除
            fs.unlinkSync(filePath);
            // ファイル操作完了を通知
            this.notifyFileOperationComplete(filePath, 'delete');
            logger_1.Logger.info(`ファイルを削除しました: ${filePath}`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`ファイル削除エラー: ${error.message}`);
            vscode.window.showErrorMessage(`ファイル削除エラー: ${error.message}`);
            return false;
        }
    }
    /**
     * ディレクトリが存在するかチェックし、存在しない場合は作成
     */
    async ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            try {
                fs.mkdirSync(dirPath, { recursive: true });
                logger_1.Logger.debug(`ディレクトリを作成しました: ${dirPath}`);
            }
            catch (error) {
                logger_1.Logger.error(`ディレクトリ作成エラー: ${error.message}`);
                throw error;
            }
        }
    }
    /**
     * ファイル操作の開始を通知
     */
    notifyFileOperation(filePath, operation) {
        if (this.terminal) {
            this.terminal.notifyFileOperation(filePath, operation);
        }
    }
    /**
     * ファイル操作の完了を通知
     */
    notifyFileOperationComplete(filePath, operation) {
        if (this.terminal) {
            this.terminal.notifyFileOperationComplete(filePath, operation);
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
     * ファイルを文字列として読み込む
     */
    async readFileAsString(filePath) {
        try {
            // ファイルが存在するか確認
            if (!fs.existsSync(filePath)) {
                throw new Error(`ファイルが存在しません: ${filePath}`);
            }
            // ファイルを読み込み
            const content = fs.readFileSync(filePath, 'utf8');
            logger_1.Logger.info(`ファイルを読み込みました: ${filePath} (サイズ: ${content.length} バイト)`);
            return content;
        }
        catch (error) {
            logger_1.Logger.error(`ファイル読み込みエラー: ${error.message}`);
            throw error;
        }
    }
    /**
     * プロジェクトルートディレクトリを選択
     */
    async selectProjectRoot() {
        try {
            // フォルダ選択ダイアログを表示
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'プロジェクトルートを選択'
            });
            if (folderUri && folderUri.length > 0) {
                const rootPath = folderUri[0].fsPath;
                logger_1.Logger.info(`プロジェクトルートを選択しました: ${rootPath}`);
                return rootPath;
            }
            return undefined;
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクトルート選択エラー: ${error.message}`);
            vscode.window.showErrorMessage(`プロジェクトルートの選択に失敗しました: ${error.message}`);
            return undefined;
        }
    }
    /**
     * プロジェクト構造を作成
     * @param rootPath プロジェクトルートパス
     * @param files ファイル情報の配列
     * @returns 成功したかどうか
     */
    async createProjectStructure(rootPath, files) {
        try {
            // 進捗表示を初期化
            const progress = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'プロジェクト構造を作成中...',
                cancellable: false
            }, async (progress) => {
                // 作成したファイル数をカウント
                let createdFiles = 0;
                // 既存のディレクトリをセット（重複作成を避けるため）
                const createdDirs = new Set();
                // 総ファイル数
                const totalFiles = files.length;
                // 各ファイルを作成
                for (const file of files) {
                    // ファイルの絶対パスを作成
                    const absolutePath = path.join(rootPath, file.path);
                    // 進捗更新
                    progress.report({
                        message: `ファイル作成中: ${file.path}`,
                        increment: (1 / totalFiles) * 100
                    });
                    // ディレクトリが存在するか確認
                    const dirPath = path.dirname(absolutePath);
                    // ディレクトリ階層を確認して、各階層が存在するか確認
                    const pathParts = dirPath.split(path.sep);
                    let currentPath = '';
                    // Windowsのドライブ文字を処理
                    if (dirPath.match(/^[A-Za-z]:\\/)) {
                        currentPath = pathParts[0] + path.sep;
                        pathParts.shift();
                    }
                    // 各階層のディレクトリを順番に作成
                    for (const part of pathParts) {
                        if (!part)
                            continue; // 空の部分をスキップ
                        currentPath = path.join(currentPath, part);
                        if (!createdDirs.has(currentPath)) {
                            logger_1.Logger.debug(`ディレクトリを確認/作成: ${currentPath}`);
                            await this.ensureDirectoryExists(currentPath);
                            createdDirs.add(currentPath);
                        }
                    }
                    // 最終的なディレクトリパスを追加
                    if (!createdDirs.has(dirPath)) {
                        createdDirs.add(dirPath);
                    }
                    // ファイルを作成
                    try {
                        fs.writeFileSync(absolutePath, file.content, 'utf8');
                        createdFiles++;
                        // ファイル操作完了を通知
                        this.notifyFileOperationComplete(absolutePath, 'create');
                    }
                    catch (fileError) {
                        logger_1.Logger.error(`ファイル作成エラー (${file.path}): ${fileError.message}`);
                    }
                }
                return { createdFiles, totalFiles };
            });
            // 結果を表示
            const { createdFiles, totalFiles } = progress;
            if (createdFiles === totalFiles) {
                vscode.window.showInformationMessage(`プロジェクト構造を作成しました。${createdFiles}個のファイルを作成しました。`);
                return true;
            }
            else {
                vscode.window.showWarningMessage(`プロジェクト構造を作成しました（警告あり）。${createdFiles}/${totalFiles}個のファイルを作成しました。`);
                return createdFiles > 0;
            }
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクト構造作成エラー: ${error.message}`);
            vscode.window.showErrorMessage(`プロジェクト構造の作成に失敗しました: ${error.message}`);
            return false;
        }
    }
}
exports.FileOperationManager = FileOperationManager;
//# sourceMappingURL=fileOperationManager.js.map