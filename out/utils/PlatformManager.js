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
exports.PlatformManager = exports.PlatformEnvironment = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
/**
 * プラットフォーム環境の種類
 */
var PlatformEnvironment;
(function (PlatformEnvironment) {
    PlatformEnvironment["VSCODE"] = "vscode";
    PlatformEnvironment["CLI"] = "cli";
    PlatformEnvironment["WEB"] = "web";
})(PlatformEnvironment || (exports.PlatformEnvironment = PlatformEnvironment = {}));
/**
 * プラットフォーム管理クラス
 * VS Code、CLI、Web環境での実行を抽象化し、適切なリソース参照を提供
 */
class PlatformManager {
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!PlatformManager.instance) {
            PlatformManager.instance = new PlatformManager();
        }
        return PlatformManager.instance;
    }
    /**
     * コンストラクタ
     */
    constructor() {
        // VS Code拡張機能のコンテキスト
        this.extensionContext = null;
        // 拡張機能のパス
        this.extensionPath = null;
        // 実行環境の自動検出
        this.environment = this.detectEnvironment();
        // 拡張機能のパスを取得（VS Code環境の場合）
        if (this.environment === PlatformEnvironment.VSCODE) {
            try {
                this.extensionPath = this.findExtensionPath();
            }
            catch (error) {
                console.warn('拡張機能パスの検出に失敗しました:', error);
            }
        }
    }
    /**
     * 実行環境を検出
     */
    detectEnvironment() {
        // VS Code APIが利用可能かどうかでVS Code環境かを判定
        if (typeof vscode !== 'undefined') {
            return PlatformEnvironment.VSCODE;
        }
        // 環境変数でCLI環境かを判定
        if (process.env.APPGENIUS_CLI === 'true') {
            return PlatformEnvironment.CLI;
        }
        // それ以外はWeb環境と判定（将来的にブラウザ判定を追加予定）
        return PlatformEnvironment.WEB;
    }
    /**
     * VS Code拡張機能のパスを検出
     */
    findExtensionPath() {
        // VS Code環境でない場合はnullを返す
        if (this.environment !== PlatformEnvironment.VSCODE) {
            return null;
        }
        // vscodeが利用可能な場合、拡張機能のパスを取得
        try {
            const extension = vscode.extensions.getExtension('appgenius-ai.appgenius-ai');
            if (extension) {
                return extension.extensionPath;
            }
        }
        catch (error) {
            console.warn('拡張機能のパス取得に失敗しました:', error);
        }
        return null;
    }
    /**
     * VS Code拡張機能コンテキストを設定
     */
    setExtensionContext(context) {
        this.extensionContext = context;
        this.extensionPath = context.extensionPath;
    }
    /**
     * 現在の実行環境を取得
     */
    getEnvironment() {
        return this.environment;
    }
    /**
     * 拡張機能のパスを取得
     */
    getExtensionPath() {
        return this.extensionPath;
    }
    /**
     * リソースのURIを取得（環境に応じた形式で）
     */
    getResourceUri(relativePath) {
        // VS Code環境の場合
        if (this.environment === PlatformEnvironment.VSCODE && this.extensionPath) {
            return vscode.Uri.file(path.join(this.extensionPath, relativePath));
        }
        // CLI環境の場合
        if (this.environment === PlatformEnvironment.CLI) {
            // 実行中のスクリプトのディレクトリを基準にする
            return path.resolve(__dirname, '..', '..', relativePath);
        }
        // Web環境の場合（または他のフォールバックケース）
        return relativePath;
    }
    /**
     * リソースの絶対パスを取得
     */
    getResourcePath(relativePath) {
        // VS Code環境の場合
        if (this.environment === PlatformEnvironment.VSCODE && this.extensionPath) {
            return path.join(this.extensionPath, relativePath);
        }
        // CLI環境の場合
        if (this.environment === PlatformEnvironment.CLI) {
            return path.resolve(__dirname, '..', '..', relativePath);
        }
        // Web環境の場合（または他のフォールバックケース）
        return relativePath;
    }
    /**
     * 一時ディレクトリのパスを取得
     */
    getTempDirectory(subdirectory = '') {
        // アプリケーション共通の一時ディレクトリを構築
        const tempBasePath = path.join(os.tmpdir(), 'appgenius');
        // サブディレクトリがある場合は追加
        const tempPath = subdirectory ? path.join(tempBasePath, subdirectory) : tempBasePath;
        // ディレクトリが存在しない場合は作成
        if (!fs.existsSync(tempPath)) {
            fs.mkdirSync(tempPath, { recursive: true });
        }
        return tempPath;
    }
    /**
     * プロジェクト共有ディレクトリのパスを取得
     */
    getProjectSharedDirectory(projectId) {
        const sharedPath = path.join(this.getTempDirectory('projects'), projectId);
        // ディレクトリが存在しない場合は作成
        if (!fs.existsSync(sharedPath)) {
            fs.mkdirSync(sharedPath, { recursive: true });
        }
        return sharedPath;
    }
    /**
     * OSがWindowsかどうかを判定
     */
    isWindows() {
        return os.platform() === 'win32';
    }
    /**
     * OSがmacOSかどうかを判定
     */
    isMac() {
        return os.platform() === 'darwin';
    }
    /**
     * OSがLinuxかどうかを判定
     */
    isLinux() {
        return os.platform() === 'linux';
    }
    /**
     * ホームディレクトリのパスを取得
     */
    getHomeDir() {
        return os.homedir();
    }
}
exports.PlatformManager = PlatformManager;
//# sourceMappingURL=PlatformManager.js.map