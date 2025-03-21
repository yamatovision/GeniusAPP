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
exports.ClaudeCodeAuthSync = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const AuthenticationService_1 = require("../core/auth/AuthenticationService");
const TokenManager_1 = require("../core/auth/TokenManager");
const child_process_1 = require("child_process");
const util_1 = require("util");
const logger_1 = require("../utils/logger");
const claudeCodeApiClient_1 = require("../api/claudeCodeApiClient");
/**
 * ClaudeCodeAuthSync - VSCode拡張機能とClaudeCode CLIの認証を同期するクラス
 *
 * VSCode拡張の認証情報をClaudeCode CLIと共有し、
 * 両環境で一貫した認証状態を維持します。
 */
class ClaudeCodeAuthSync {
    /**
     * コンストラクタ
     */
    constructor() {
        this._disposables = [];
        this._execPromise = (0, util_1.promisify)(child_process_1.exec);
        this._lastTokenRefresh = 0; // 最後にトークンをリフレッシュした時刻
        this._authService = AuthenticationService_1.AuthenticationService.getInstance();
        this._tokenManager = TokenManager_1.TokenManager.getInstance();
        this._apiClient = claudeCodeApiClient_1.ClaudeCodeApiClient.getInstance();
        this._initialize();
        logger_1.Logger.info('ClaudeCodeAuthSync initialized');
    }
    /**
     * ClaudeCodeAuthSyncのシングルトンインスタンスを取得
     */
    static getInstance() {
        if (!ClaudeCodeAuthSync.instance) {
            ClaudeCodeAuthSync.instance = new ClaudeCodeAuthSync();
        }
        return ClaudeCodeAuthSync.instance;
    }
    /**
     * 初期化
     */
    _initialize() {
        // 認証状態変更のリスナー
        this._disposables.push(this._authService.onStateChanged(state => {
            this._handleAuthStateChange(state.isAuthenticated);
        }));
        // 定期的なトークン状態確認（10分ごと）
        // これにより、アプリが長時間開かれたままでも認証状態を維持できる
        setInterval(() => this._checkAndRefreshTokenIfNeeded(), 10 * 60 * 1000);
    }
    /**
     * トークン状態を確認し、必要に応じてリフレッシュする
     */
    async _checkAndRefreshTokenIfNeeded() {
        try {
            // 最後のリフレッシュから1時間以上経過していて、認証状態の場合にのみ実行
            const now = Date.now();
            const isAuthenticated = await this._authService.isAuthenticated();
            if (isAuthenticated && (now - this._lastTokenRefresh > 60 * 60 * 1000)) {
                logger_1.Logger.info('【API連携】定期的なトークン状態確認を実行します');
                const refreshSucceeded = await this._authService.refreshToken();
                if (refreshSucceeded) {
                    this._lastTokenRefresh = now;
                    logger_1.Logger.info('【API連携】トークンが正常にリフレッシュされました');
                    // CLIとのトークン同期
                    await this._syncTokensToClaudeCode();
                }
                else {
                    logger_1.Logger.warn('【API連携】トークンリフレッシュに失敗しました');
                }
            }
        }
        catch (error) {
            logger_1.Logger.error('トークン状態確認中にエラーが発生しました', error);
        }
    }
    /**
     * 認証状態変更ハンドラー
     */
    async _handleAuthStateChange(isAuthenticated) {
        if (isAuthenticated) {
            // ログイン状態になった場合、ClaudeCode CLIにトークンを同期
            await this._syncTokensToClaudeCode();
        }
        else {
            // ログアウトした場合、ClaudeCode CLIからトークンを削除
            await this._removeTokensFromClaudeCode();
        }
    }
    /**
     * トークンをClaudeCode CLIに同期
     */
    async _syncTokensToClaudeCode() {
        try {
            // 環境変数で同期が無効化されている場合は何もしない
            if (process.env.CLAUDE_INTEGRATION_ENABLED === 'false') {
                logger_1.Logger.debug('ClaudeCode CLI同期が環境変数により無効化されています');
                return;
            }
            // トークンを取得
            const accessToken = await this._tokenManager.getAccessToken();
            const refreshToken = await this._tokenManager.getRefreshToken();
            if (!accessToken || !refreshToken) {
                logger_1.Logger.warn('トークンが取得できないため、ClaudeCode CLIとの同期をスキップします');
                return;
            }
            // ClaudeCode CLI設定ディレクトリを取得
            const claudeConfigDir = this._getClaudeConfigDir();
            // ディレクトリが存在するか確認し、存在しなければ作成
            if (!fs.existsSync(claudeConfigDir)) {
                logger_1.Logger.info(`ClaudeCode CLI設定ディレクトリを作成します: ${claudeConfigDir}`);
                fs.mkdirSync(claudeConfigDir, { recursive: true });
            }
            // トークン情報をJSONに変換
            const authInfo = {
                accessToken,
                refreshToken,
                expiresAt: Date.now() + 3600000, // 1時間後
                source: 'vscode-extension',
                syncedAt: Date.now()
            };
            // 認証情報をファイルに保存
            const authFilePath = path.join(claudeConfigDir, 'auth.json');
            fs.writeFileSync(authFilePath, JSON.stringify(authInfo, null, 2), {
                encoding: 'utf8',
                mode: 0o600 // 所有者のみ読み書き可能
            });
            // 同期日時を記録
            this._lastTokenRefresh = Date.now();
            logger_1.Logger.info('【API連携】ClaudeCode CLIに認証情報を同期しました');
            // 認証同期成功をトークン使用量としても記録
            try {
                await this._apiClient.recordTokenUsage(0, 'auth-sync', 'token-sync');
                logger_1.Logger.debug('認証同期情報をトークン使用履歴に記録しました');
            }
            catch (tokenRecordError) {
                // トークン使用記録の失敗は致命的ではないのでログのみ
                logger_1.Logger.warn('認証同期情報をトークン使用履歴に記録できませんでした:', tokenRecordError);
            }
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCode CLIへの認証情報同期中にエラーが発生しました', error);
        }
    }
    /**
     * ClaudeCode CLIからトークンを削除
     */
    async _removeTokensFromClaudeCode() {
        try {
            // ClaudeCode CLI設定ディレクトリを取得
            const claudeConfigDir = this._getClaudeConfigDir();
            const authFilePath = path.join(claudeConfigDir, 'auth.json');
            // 認証ファイルが存在する場合は削除
            if (fs.existsSync(authFilePath)) {
                fs.unlinkSync(authFilePath);
                logger_1.Logger.info('【API連携】ClaudeCode CLIから認証情報を削除しました');
                // 認証削除をトークン使用量としても記録
                try {
                    await this._apiClient.recordTokenUsage(0, 'auth-logout', 'token-sync');
                    logger_1.Logger.debug('認証削除情報をトークン使用履歴に記録しました');
                }
                catch (tokenRecordError) {
                    // トークン使用記録の失敗は致命的ではないのでログのみ
                    logger_1.Logger.warn('認証削除情報をトークン使用履歴に記録できませんでした:', tokenRecordError);
                }
            }
            else {
                logger_1.Logger.debug('ClaudeCode CLI認証ファイルが存在しないため、削除操作はスキップします');
            }
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCode CLIからの認証情報削除中にエラーが発生しました', error);
        }
    }
    /**
     * 現在の認証状態を確認し、必要に応じてトークンをリフレッシュする
     * @returns リフレッシュが成功したかどうか
     */
    async ensureValidAuth() {
        try {
            const isAuthenticated = await this._authService.isAuthenticated();
            if (!isAuthenticated) {
                logger_1.Logger.warn('【API連携】認証されていません。リフレッシュを試みます');
                return await this._authService.refreshToken();
            }
            // 最後のリフレッシュから30分以上経過している場合、トークンをリフレッシュ
            const now = Date.now();
            if (now - this._lastTokenRefresh > 30 * 60 * 1000) {
                logger_1.Logger.info('【API連携】前回のリフレッシュから30分以上経過しているため、トークンをリフレッシュします');
                const refreshSucceeded = await this._authService.refreshToken();
                if (refreshSucceeded) {
                    this._lastTokenRefresh = now;
                    logger_1.Logger.info('【API連携】トークンが正常にリフレッシュされました');
                    // CLIとのトークン同期
                    await this._syncTokensToClaudeCode();
                }
                else {
                    logger_1.Logger.warn('【API連携】トークンリフレッシュに失敗しました');
                }
                return refreshSucceeded;
            }
            logger_1.Logger.debug('【API連携】認証は有効です');
            return true;
        }
        catch (error) {
            logger_1.Logger.error('認証状態の確認中にエラーが発生しました', error);
            return false;
        }
    }
    /**
     * ClaudeCodeの設定ディレクトリを取得
     */
    _getClaudeConfigDir() {
        const homeDir = os.homedir();
        // OSによって設定ディレクトリの場所が異なる
        if (process.platform === 'win32') {
            return path.join(homeDir, 'AppData', 'Roaming', 'claude-cli');
        }
        else if (process.platform === 'darwin') {
            return path.join(homeDir, 'Library', 'Application Support', 'claude-cli');
        }
        else {
            // Linux
            return path.join(homeDir, '.config', 'claude-cli');
        }
    }
    /**
     * ClaudeCode CLIが利用可能かチェック
     */
    async isClaudeCodeAvailable() {
        try {
            // ClaudeCode CLIパスを環境変数から取得、または適切なデフォルトを使用
            const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';
            // バージョン情報を取得してみる
            await this._execPromise(`${claudeCodePath} --version`);
            return true;
        }
        catch (error) {
            console.error('ClaudeCode CLIの検出に失敗しました:', error);
            return false;
        }
    }
    /**
     * VSCodeからClaudeCode CLIを実行
     */
    async executeClaudeCode(command) {
        try {
            // ClaudeCode CLIが使用可能かチェック
            const isAvailable = await this.isClaudeCodeAvailable();
            if (!isAvailable) {
                throw new Error('ClaudeCode CLIが見つかりません。インストールされていることを確認してください。');
            }
            // ClaudeCode CLIパスを環境変数から取得、またはデフォルトを使用
            const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';
            // コマンド実行
            const { stdout, stderr } = await this._execPromise(`${claudeCodePath} ${command}`);
            if (stderr) {
                console.warn('ClaudeCode CLIからの警告:', stderr);
            }
            return stdout;
        }
        catch (error) {
            console.error('ClaudeCode CLI実行中にエラーが発生しました:', error);
            throw error;
        }
    }
    /**
     * リソースの解放
     */
    dispose() {
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
    }
}
exports.ClaudeCodeAuthSync = ClaudeCodeAuthSync;
//# sourceMappingURL=ClaudeCodeAuthSync.js.map