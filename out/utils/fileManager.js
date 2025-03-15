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
exports.FileManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
class FileManager {
    /**
     * ファイルを読み込む
     */
    static async readFile(filePath) {
        try {
            const uri = vscode.Uri.file(filePath);
            const content = await vscode.workspace.fs.readFile(uri);
            return Buffer.from(content).toString('utf-8');
        }
        catch (error) {
            logger_1.Logger.error(`Failed to read file ${filePath}`, error);
            throw new Error(`ファイル ${filePath} の読み込みに失敗しました`);
        }
    }
    /**
     * ファイルに書き込む
     */
    static async writeFile(filePath, content) {
        try {
            const uri = vscode.Uri.file(filePath);
            const data = Buffer.from(content, 'utf-8');
            await vscode.workspace.fs.writeFile(uri, data);
            logger_1.Logger.debug(`File ${filePath} written successfully`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to write file ${filePath}`, error);
            throw new Error(`ファイル ${filePath} の書き込みに失敗しました`);
        }
    }
    /**
     * ディレクトリを作成する
     */
    static async createDirectory(dirPath) {
        try {
            const uri = vscode.Uri.file(dirPath);
            await vscode.workspace.fs.createDirectory(uri);
            logger_1.Logger.debug(`Directory ${dirPath} created successfully`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to create directory ${dirPath}`, error);
            throw new Error(`ディレクトリ ${dirPath} の作成に失敗しました`);
        }
    }
    /**
     * ファイルが存在するか確認する
     */
    static async fileExists(filePath) {
        try {
            const uri = vscode.Uri.file(filePath);
            await vscode.workspace.fs.stat(uri);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * ディレクトリが存在するか確認する
     */
    static async directoryExists(dirPath) {
        return this.fileExists(dirPath);
    }
    /**
     * ディレクトリ内のファイル・フォルダをリストアップする
     */
    static async listDirectory(dirPath) {
        try {
            const uri = vscode.Uri.file(dirPath);
            const entries = await vscode.workspace.fs.readDirectory(uri);
            return entries.map(entry => entry[0]);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to list directory ${dirPath}`, error);
            throw new Error(`ディレクトリ ${dirPath} の読み取りに失敗しました`);
        }
    }
    /**
     * ファイルを開く
     */
    static async openFile(filePath) {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
            logger_1.Logger.debug(`File ${filePath} opened successfully`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to open file ${filePath}`, error);
            throw new Error(`ファイル ${filePath} を開くことができませんでした`);
        }
    }
    /**
     * 一時ファイルを作成する
     */
    static async createTempFile(content, extension = '.txt') {
        try {
            // 一時ディレクトリを取得
            const tempDir = path.join(process.env.TEMP || process.env.TMP || '/tmp', 'appgenius-ai');
            // 一時ディレクトリが存在しない場合は作成
            if (!await this.directoryExists(tempDir)) {
                await this.createDirectory(tempDir);
            }
            // ユニークなファイル名を生成
            const fileName = `temp_${Date.now()}${extension}`;
            const filePath = path.join(tempDir, fileName);
            // ファイルに内容を書き込む
            await this.writeFile(filePath, content);
            return filePath;
        }
        catch (error) {
            logger_1.Logger.error('Failed to create temp file', error);
            throw new Error('一時ファイルの作成に失敗しました');
        }
    }
}
exports.FileManager = FileManager;
//# sourceMappingURL=fileManager.js.map