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
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const logger_1 = require("../utils/logger");
const claudeCodeApiClient_1 = require("../api/claudeCodeApiClient");
const SimpleAuthService_1 = require("../core/auth/SimpleAuthService");
const SimpleAuthManager_1 = require("../core/auth/SimpleAuthManager");
/**
 * ClaudeCodeAuthSync - VSCode拡張機能とClaudeCode CLIの認証を同期するクラス
 *
 * VSCode拡張の認証情報をClaudeCode CLIと共有し、
 * 両環境で一貫した認証状態を維持します。
 *
 * このクラスはリファクタリングにより、SimpleAuthServiceを使用するように更新されました。
 */
class ClaudeCodeAuthSync {
    /**
     * コンストラクタ
     */
    constructor(context) {
        this._disposables = [];
        this._execPromise = (0, util_1.promisify)(child_process_1.exec);
        this._lastTokenRefresh = 0; // 最後にトークンをリフレッシュした時刻
        this._claudeCliLoginStatus = false; // Claude CLIのログイン状態
        this.API_KEY_DATA_KEY = 'appgenius.simple.apiKey'; // APIキーを保存するStorageのキー
        // 新しいSimpleAuthServiceとSimpleAuthManagerを使用
        this._authService = SimpleAuthService_1.SimpleAuthService.getInstance(context);
        this._authManager = SimpleAuthManager_1.SimpleAuthManager.getInstance(context);
        this._apiClient = claudeCodeApiClient_1.ClaudeCodeApiClient.getInstance();
        // トークン情報をグローバル変数に保存（インスタンス間での共有）
        const accessToken = this._authService.getAccessToken();
        if (accessToken) {
            // @ts-ignore - グローバル変数への代入
            global._appgenius_auth_token = accessToken;
            logger_1.Logger.info('ClaudeCodeAuthSync: アクセストークンをグローバル変数に保存しました');
        }
        this._initialize();
        logger_1.Logger.info('ClaudeCodeAuthSync initialized with SimpleAuthService');
    }
    /**
     * ClaudeCodeAuthSyncのシングルトンインスタンスを取得
     */
    static getInstance(context) {
        if (!ClaudeCodeAuthSync.instance) {
            if (!context) {
                throw new Error('ClaudeCodeAuthSyncの初期化時にはExtensionContextが必要です');
            }
            ClaudeCodeAuthSync.instance = new ClaudeCodeAuthSync(context);
        }
        return ClaudeCodeAuthSync.instance;
    }
    /**
     * 初期化
     */
    _initialize() {
        try {
            // 認証状態変更のリスナー
            this._disposables.push(this._authService.onStateChanged(state => {
                this._handleAuthStateChange(state.isAuthenticated);
            }));
            // 認証状態が既に有効であれば、すぐに同期を試行
            if (this._authService.isAuthenticated()) {
                // 少し遅延させて認証プロセスが完全に終わった後に実行
                setTimeout(() => {
                    try {
                        logger_1.Logger.info('ClaudeCodeAuthSync: 初期化時に既存の認証状態を検出しました。APIキー同期を試行します');
                        // 非同期処理をPromiseチェーンとして実行
                        this._syncTokensToClaudeCode()
                            .then(() => logger_1.Logger.info('ClaudeCodeAuthSync: 初期同期が完了しました'))
                            .catch(syncError => {
                            logger_1.Logger.error('ClaudeCodeAuthSync: 初期同期中にエラーが発生しました', syncError);
                        });
                    }
                    catch (syncError) {
                        logger_1.Logger.error('ClaudeCodeAuthSync: 初期同期準備中にエラーが発生しました', syncError);
                    }
                }, 3000); // 3秒後に実行
            }
            else {
                logger_1.Logger.info('ClaudeCodeAuthSync: 初期化時に認証されていません。認証イベント待機中');
            }
            // 定期的なトークン状態確認（10分ごと）
            // これにより、アプリが長時間開かれたままでも認証状態を維持できる
            setInterval(() => {
                this._checkAndRefreshTokenIfNeeded().catch(error => {
                    logger_1.Logger.error('ClaudeCodeAuthSync: 定期トークン確認中にエラーが発生しました', error);
                });
            }, 10 * 60 * 1000);
            // 追加の安全策：起動から1分後に一度だけ同期を試行
            setTimeout(() => {
                if (this._authService.isAuthenticated()) {
                    logger_1.Logger.info('ClaudeCodeAuthSync: 1分後のセーフティチェックでトークン同期を試行します');
                    this._syncTokensToClaudeCode().catch(error => {
                        logger_1.Logger.error('ClaudeCodeAuthSync: セーフティ同期中にエラーが発生しました', error);
                    });
                }
            }, 60000);
            logger_1.Logger.info('ClaudeCodeAuthSync: 初期化完了');
        }
        catch (initError) {
            logger_1.Logger.error('ClaudeCodeAuthSync: 初期化エラー', initError);
        }
    }
    /**
     * トークン状態を確認し、必要に応じてリフレッシュする
     */
    async _checkAndRefreshTokenIfNeeded() {
        try {
            // 最後のリフレッシュから1時間以上経過していて、認証状態の場合にのみ実行
            const now = Date.now();
            const isAuthenticated = this._authService.isAuthenticated();
            if (isAuthenticated && (now - this._lastTokenRefresh > 60 * 60 * 1000)) {
                logger_1.Logger.info('【API連携】定期的なトークン状態確認を実行します');
                const refreshSucceeded = await this._authService.verifyAuthState();
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
     * @param useIsolatedAuth 分離認証モードを使用するかどうか
     */
    async _syncTokensToClaudeCode(useIsolatedAuth = true) {
        try {
            // 分離認証モードは常に有効（シンプル化のため）
            logger_1.Logger.info(`認証同期モード: 分離認証モード (標準設定)`);
            // 環境変数で同期が無効化されている場合は何もしない
            if (process.env.CLAUDE_INTEGRATION_ENABLED === 'false') {
                logger_1.Logger.debug('ClaudeCode CLI同期が環境変数により無効化されています');
                return;
            }
            // 認証情報取得の詳細ログ
            logger_1.Logger.info('ClaudeCode CLI同期: 認証情報の取得を開始します');
            // AnthropicApiKeyモデルからAPIキーを取得（フォールバックなし）
            let apiKeyValue;
            try {
                apiKeyValue = await this._authService.getApiKey();
                if (apiKeyValue) {
                    logger_1.Logger.info(`ClaudeCode CLI同期: AnthropicApiKeyモデルからAPIキーを取得しました (${apiKeyValue.substring(0, 5)}...)`);
                }
                else {
                    // APIキーがない場合はエラーを投げる
                    throw new Error('AnthropicApiKeyモデルからAPIキーを取得できませんでした。APIキーの設定を確認してください。');
                }
            }
            catch (apiKeyError) {
                // エラーの詳細情報をログに記録
                logger_1.Logger.error('ClaudeCode CLI同期: APIキー取得エラー', apiKeyError);
                // ユーザーへの詳細なデバッグ情報
                const errorMessage = `
【APIキー取得エラー】
エラー: ${apiKeyError.message}
考えられる原因:
1. AnthropicApiKeyモデルが正しく設定されていない
2. ユーザーにAPIキーが割り当てられていない
3. APIキー取得エンドポイントへのアクセス失敗

デバッグ手順:
1. ポータル管理画面でAPIキーが設定されているか確認
2. バックエンドのログを確認
3. 管理者に連絡してAPIキーの設定を依頼

詳細エラー: ${JSON.stringify(apiKeyError)}
`;
                logger_1.Logger.error(errorMessage);
                // エラーを再スローして呼び出し元に通知
                throw new Error(`APIキー取得中にエラーが発生しました: ${apiKeyError.message}`);
            }
            // APIキーのみを使用（アクセストークンのフォールバックなし）
            const authToken = apiKeyValue;
            // APIキーの詳細情報をログに記録
            if (apiKeyValue) {
                const userInfo = this._authService.getCurrentUser();
                const userId = userInfo?.id || 'unknown';
                const userName = userInfo?.name || 'unknown';
                const userRole = userInfo?.role || 'unknown';
                const apiKeyMasked = apiKeyValue.substring(0, 5) + '...' + apiKeyValue.substring(apiKeyValue.length - 4);
                logger_1.Logger.info(`【認証情報】詳細ユーザー情報:
        ユーザーID: ${userId}
        名前: ${userName}
        ロール: ${userRole}
        APIキー: ${apiKeyMasked}
        認証方法: APIキー認証
        保存場所: ${'appgenius.simple.apiKey'}`);
                // APIキーの保存元を調査（デバッグ用）
                logger_1.Logger.debug('【認証情報】詳細分析:');
                try {
                    // SimpleAuthServiceがgetCurrentUserをサポートしているか確認
                    const hasGetCurrentUserMethod = typeof this._authService.getCurrentUser === 'function';
                    logger_1.Logger.debug(`getCurrentUserメソッド存在: ${hasGetCurrentUserMethod}`);
                    // APIキーがどのように取得されたかの履歴
                    const getApiKeyMethod = typeof this._authService.getApiKey === 'function';
                    logger_1.Logger.debug(`getApiKeyメソッド存在: ${getApiKeyMethod}`);
                    // APIキーの取得元をログ (取得元は判別できないためシンプル化)
                    logger_1.Logger.debug(`APIキー取得: 成功 (${apiKeyValue ? apiKeyValue.substring(0, 5) + '...' : 'なし'})`);
                    logger_1.Logger.debug(`APIキー種別: AnthropicApiKey対応版`);
                    // ユーザーデータがシリアライズ可能か確認
                    let userDataJson = '不明';
                    try {
                        userDataJson = JSON.stringify(userInfo);
                    }
                    catch (e) {
                        userDataJson = '取得失敗 - シリアライズエラー';
                    }
                    logger_1.Logger.debug(`ユーザーデータ: ${userDataJson}`);
                }
                catch (analyzeError) {
                    logger_1.Logger.warn('APIキー詳細分析中にエラーが発生しました', analyzeError);
                }
            }
            else {
                logger_1.Logger.warn('【認証情報】APIキーが見つかりません。アクセストークンを使用して認証します');
                logger_1.Logger.debug('【認証情報】APIキー調査');
                try {
                    // SimpleAuthServiceのデバッグ情報
                    const authServiceName = this._authService.constructor.name;
                    logger_1.Logger.debug(`使用中の認証サービス: ${authServiceName}`);
                    // 内部状態の詳細確認
                    const isAuthMethod = typeof this._authService.isAuthenticated === 'function';
                    logger_1.Logger.debug(`isAuthenticatedメソッド存在: ${isAuthMethod}`);
                    if (isAuthMethod) {
                        const isAuth = this._authService.isAuthenticated();
                        logger_1.Logger.debug(`認証状態: ${isAuth ? '認証済み' : '未認証'}`);
                    }
                    // APIキーがない理由を探る
                    logger_1.Logger.debug('可能性のある問題:');
                    logger_1.Logger.debug('1. ログイン/セッション復元時にAPIキーが取得されていない');
                    logger_1.Logger.debug('2. バックエンドがAPIキーを提供していない');
                    logger_1.Logger.debug('3. APIキーがストレージに正しく保存されていない');
                }
                catch (debugError) {
                    logger_1.Logger.warn('APIキー欠如原因分析中にエラーが発生しました', debugError);
                }
            }
            // トークンの有効性を確認（SimpleAuthServiceを使用）
            try {
                const isValid = await this._authService.verifyAuthState();
                if (!isValid) {
                    logger_1.Logger.warn('現在の認証状態が有効ではありません。CLIとの同期をスキップします');
                    return;
                }
            }
            catch (authCheckError) {
                logger_1.Logger.warn('認証状態の確認中にエラーが発生しました。CLIとの同期をスキップします', authCheckError);
                return;
            }
            // 認証情報ディレクトリとファイルパスを決定
            // AppGenius専用の認証情報ディレクトリを使用
            const authDir = this._getAppGeniusAuthDir();
            const authFileName = 'auth.json';
            logger_1.Logger.info(`分離認証モードを使用: AppGenius専用の認証情報を保存します (ディレクトリ: ${authDir})`);
            // ディレクトリが存在するか確認し、存在しなければ作成
            try {
                // fs-extraのensureDirを使用してディレクトリを確実に作成
                await fs.ensureDir(authDir, { mode: 0o700 }); // 所有者のみ読み書き実行可能
                // Unix系OSの場合は、パーミッションを明示的に設定
                if (process.platform !== 'win32') {
                    await fs.chmod(authDir, 0o700);
                    logger_1.Logger.debug(`ディレクトリのパーミッションを設定しました (700): ${authDir}`);
                }
                logger_1.Logger.info(`認証情報ディレクトリを確認/作成しました: ${authDir}`);
                // ホームディレクトリの.appgeniusフォルダも確保（標準的な場所）
                const dotAppGeniusDir = path.join(os.homedir(), '.appgenius');
                if (!fs.existsSync(dotAppGeniusDir)) {
                    await fs.ensureDir(dotAppGeniusDir, { mode: 0o700 });
                    logger_1.Logger.info(`標準の.appgeniusディレクトリを作成しました: ${dotAppGeniusDir}`);
                    if (process.platform !== 'win32') {
                        await fs.chmod(dotAppGeniusDir, 0o700);
                    }
                }
                // OSごとの標準的な設定ディレクトリも確保
                let osSpecificDir;
                if (process.platform === 'darwin') {
                    osSpecificDir = path.join(os.homedir(), 'Library', 'Application Support', 'appgenius');
                }
                else if (process.platform === 'win32') {
                    osSpecificDir = path.join(os.homedir(), 'AppData', 'Roaming', 'appgenius');
                }
                else {
                    osSpecificDir = path.join(os.homedir(), '.config', 'appgenius');
                }
                if (!fs.existsSync(osSpecificDir)) {
                    await fs.ensureDir(osSpecificDir, { mode: 0o700 });
                    logger_1.Logger.info(`OS固有の設定ディレクトリを作成しました: ${osSpecificDir}`);
                    if (process.platform !== 'win32') {
                        await fs.chmod(osSpecificDir, 0o700);
                    }
                }
            }
            catch (dirError) {
                logger_1.Logger.error(`認証情報ディレクトリの作成に失敗しました: ${authDir}`, dirError);
                // エラー発生時の代替ディレクトリを試みる（フォールバックメカニズム）
                logger_1.Logger.info('分離認証モードで代替ディレクトリを試みます');
                // 代替ディレクトリのリスト（優先順）
                const altDirs = [
                    // 1. ホームの.appgenius（標準）
                    path.join(os.homedir(), '.appgenius'),
                    // 2. OS固有の標準的な設定ディレクトリ
                    path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Application Support/appgenius' :
                        process.platform === 'win32' ? 'AppData/Roaming/appgenius' :
                            '.config/appgenius'),
                    // 3. 最終手段として一時ディレクトリ
                    path.join(os.tmpdir(), 'appgenius-auth')
                ];
                // 代替ディレクトリを順番に試す
                let success = false;
                for (const dir of altDirs) {
                    try {
                        await fs.ensureDir(dir, { mode: 0o700 });
                        if (process.platform !== 'win32') {
                            await fs.chmod(dir, 0o700);
                        }
                        // 変数に代入ではなく、現在のディレクトリを使用するよう修正
                        logger_1.Logger.info(`代替認証ディレクトリの作成に成功しました: ${dir}`);
                        success = true;
                        break;
                    }
                    catch (altError) {
                        logger_1.Logger.warn(`代替ディレクトリの作成に失敗しました: ${dir} - ${altError.message}`);
                    }
                }
                // すべての代替ディレクトリが失敗した場合
                if (!success) {
                    throw new Error(`すべての認証ディレクトリの作成に失敗しました: ${dirError.message}`);
                }
            }
            // 認証状態から有効期限を取得
            const state = this._authService.getCurrentState();
            const expiresAt = state.expiresAt || (Date.now() + 3600000); // デフォルトは1時間後
            // APIキーの取得を確実に行う
            // authTokenは既に取得済みなので、それを使用（二重取得を避ける）
            // トークン情報をJSONに変換（必ず文字列として保存）
            const authInfo = {
                accessToken: authToken, // すでに文字列として確実に取得済み
                refreshToken: 'appgenius-refresh-token', // ダミーリフレッシュトークン
                expiresAt: expiresAt,
                source: 'appgenius-extension',
                syncedAt: Date.now(),
                updatedAt: Date.now(),
                isolatedAuth: true,
                isApiKey: !!apiKeyValue // APIキーを使用しているかどうかのフラグ
            };
            // デバッグ用に変換後の型を確認
            logger_1.Logger.debug(`【認証情報】JSON変換後の認証トークン型: ${typeof authInfo.accessToken}`);
            if (authInfo.accessToken && authInfo.accessToken.length > 0) {
                logger_1.Logger.debug(`【認証情報】認証トークンのプレビュー: ${authInfo.accessToken.substring(0, 8)}...`);
            }
            else {
                logger_1.Logger.warn('【認証情報】警告: 保存されるaccessTokenが空または無効です');
            }
            // 認証情報をファイルに保存
            const authFilePath = path.join(authDir, authFileName);
            try {
                // fs-extraのwriteJsonを使用して認証情報を保存
                await fs.writeJson(authFilePath, authInfo, {
                    spaces: 2,
                    mode: 0o600 // 所有者のみ読み書き可能
                });
                logger_1.Logger.info(`認証情報ファイルを保存しました: ${authFilePath}`);
                // Unix系OSの場合は、パーミッションを明示的に設定
                if (process.platform !== 'win32') {
                    await fs.chmod(authFilePath, 0o600);
                    logger_1.Logger.debug(`ファイルのパーミッションを設定しました (600): ${authFilePath}`);
                }
                // 分離認証モードでは代替ファイルも作成（他の場所にも保存）
                try {
                    const altAuthPaths = [];
                    // ホームディレクトリの標準的な場所
                    if (authDir !== path.join(os.homedir(), '.appgenius')) {
                        altAuthPaths.push(path.join(os.homedir(), '.appgenius', 'auth.json'));
                    }
                    // OS固有のアプリケーションサポートディレクトリ
                    let osSpecificAuthPath;
                    if (process.platform === 'darwin') {
                        osSpecificAuthPath = path.join(os.homedir(), 'Library', 'Application Support', 'appgenius', 'claude-auth.json');
                    }
                    else if (process.platform === 'win32') {
                        osSpecificAuthPath = path.join(os.homedir(), 'AppData', 'Roaming', 'appgenius', 'claude-auth.json');
                    }
                    else {
                        osSpecificAuthPath = path.join(os.homedir(), '.config', 'appgenius', 'claude-auth.json');
                    }
                    if (path.join(authDir, authFileName) !== osSpecificAuthPath) {
                        altAuthPaths.push(osSpecificAuthPath);
                    }
                    // 代替パスにも書き込み
                    for (const altPath of altAuthPaths) {
                        try {
                            // 親ディレクトリの存在確認
                            const altDir = path.dirname(altPath);
                            await fs.ensureDir(altDir, { mode: 0o700 });
                            await fs.writeJson(altPath, authInfo, {
                                spaces: 2,
                                mode: 0o600
                            });
                            if (process.platform !== 'win32') {
                                await fs.chmod(altPath, 0o600);
                            }
                            logger_1.Logger.info(`代替認証ファイルを作成しました: ${altPath}`);
                        }
                        catch (altError) {
                            // 代替ファイルの書き込みエラーはログに記録するだけで続行
                            logger_1.Logger.warn(`代替認証ファイルの保存に失敗しました: ${altPath} - ${altError.message}`);
                        }
                    }
                }
                catch (replicaError) {
                    // 代替ファイル作成エラーはログに記録するだけで続行
                    logger_1.Logger.warn(`代替認証ファイルの準備中にエラーが発生しました: ${replicaError.message}`);
                }
            }
            catch (fileError) {
                logger_1.Logger.error(`認証情報ファイルの保存に失敗しました: ${authFilePath}`, fileError);
                // 代替ファイルパスへの保存を試みる
                try {
                    // エラー発生時のフォールバックとして一時ディレクトリを使用
                    const tempDir = path.join(os.tmpdir(), 'appgenius-auth');
                    await fs.ensureDir(tempDir, { mode: 0o700 });
                    const tempAuthFile = path.join(tempDir, 'auth.json');
                    await fs.writeJson(tempAuthFile, authInfo, {
                        spaces: 2,
                        mode: 0o600
                    });
                    if (process.platform !== 'win32') {
                        await fs.chmod(tempAuthFile, 0o600);
                    }
                    logger_1.Logger.warn(`一時認証ファイルに保存しました: ${tempAuthFile}`);
                    // 定数への代入ではなく、新しいパスを使用
                    logger_1.Logger.info(`認証ファイルパスを一時ファイルに更新します: ${tempAuthFile} → ${authFilePath}`);
                }
                catch (tempFileError) {
                    // すべてのフォールバックが失敗した場合のみエラーをスロー
                    throw new Error(`認証情報ファイルの保存に失敗しました: ${fileError.message}`);
                }
            }
            // 分離認証モードの場合は、.claudeディレクトリも確保
            if (process.platform === 'darwin') {
                try {
                    const dotClaudeDir = path.join(os.homedir(), '.claude');
                    if (!fs.existsSync(dotClaudeDir)) {
                        await fs.ensureDir(dotClaudeDir, { mode: 0o700 });
                        logger_1.Logger.info(`代替の.claudeディレクトリを作成しました: ${dotClaudeDir}`);
                    }
                }
                catch (dotClaudeError) {
                    // エラーはログに記録するだけで続行
                    logger_1.Logger.warn(`代替の.claudeディレクトリの作成に失敗しました: ${dotClaudeError.message}`);
                }
            }
            // 同期日時を記録
            this._lastTokenRefresh = Date.now();
            logger_1.Logger.info(`【API連携】AppGenius専用認証情報を同期しました: ${authFilePath}`);
            // 認証同期成功のログ記録（使用量記録機能は削除済み）
            logger_1.Logger.info('認証同期が完了しました - 認証情報ファイル: ' + authFilePath);
        }
        catch (error) {
            logger_1.Logger.error('認証情報の同期中にエラーが発生しました', error);
            throw error; // エラーを上位に伝播させる
        }
    }
    /**
     * AppGenius専用モードで認証情報を同期
     * 分離認証モードで認証情報を保存します
     */
    async syncTokensToAppGeniusAuth() {
        logger_1.Logger.info('分離認証モードで認証情報を同期します');
        try {
            // 認証状態がアクティブか確認
            if (!this._authService.isAuthenticated()) {
                logger_1.Logger.warn('認証されていないため、認証情報の同期をスキップします');
                return;
            }
            // 分離認証モードで同期
            await this._syncTokensToClaudeCode();
            // Claude CLI認証ファイルの存在確認
            await this._checkAndCopyClaudeCliAuth();
            return;
        }
        catch (error) {
            logger_1.Logger.error('分離認証モードでの同期に失敗しました', error);
            throw error;
        }
    }
    /**
     * Claude CLI認証ファイルの存在を確認し、必要に応じてコピー
     */
    async _checkAndCopyClaudeCliAuth() {
        try {
            const homeDir = os.homedir();
            const appGeniusAuthPath = this.getAppGeniusAuthFilePath();
            // AppGenius認証ディレクトリを確実に作成
            const appGeniusAuthDir = path.dirname(appGeniusAuthPath);
            try {
                await fs.ensureDir(appGeniusAuthDir, { mode: 0o700 });
                if (process.platform !== 'win32') {
                    await fs.chmod(appGeniusAuthDir, 0o700);
                }
                logger_1.Logger.debug(`AppGenius認証ディレクトリを確保しました: ${appGeniusAuthDir}`);
            }
            catch (dirError) {
                logger_1.Logger.warn(`AppGenius認証ディレクトリの作成に失敗しました: ${appGeniusAuthDir}`, dirError);
            }
            // AppGenius認証ファイルが存在するか確認
            const appGeniusAuthExists = await fs.pathExists(appGeniusAuthPath);
            if (!appGeniusAuthExists) {
                logger_1.Logger.info('AppGenius専用認証ファイルが見つかりません。認証情報を作成します。');
                try {
                    // 現在の認証状態から新しい認証ファイルを作成
                    const accessToken = this._authService.getAccessToken();
                    const state = this._authService.getCurrentState();
                    const expiresAt = state.expiresAt || (Date.now() + 3600000);
                    if (!accessToken) {
                        logger_1.Logger.warn('アクセストークンが取得できないため、認証ファイルの作成をスキップします');
                        return;
                    }
                    // 認証データの作成
                    const authData = {
                        accessToken,
                        refreshToken: 'appgenius-refresh-token', // ダミー
                        expiresAt,
                        source: 'appgenius-extension',
                        syncedAt: Date.now(),
                        updatedAt: Date.now(),
                        isolatedAuth: true
                    };
                    // 認証ファイルの親ディレクトリを再確認
                    await fs.ensureDir(path.dirname(appGeniusAuthPath), { mode: 0o700 });
                    // 認証ファイルを書き込み
                    await fs.writeJson(appGeniusAuthPath, authData, {
                        spaces: 2,
                        mode: 0o600 // 所有者のみ読み書き可能
                    });
                    // Unix系OSでは明示的にパーミッションを設定
                    if (process.platform !== 'win32') {
                        await fs.chmod(appGeniusAuthPath, 0o600);
                    }
                    logger_1.Logger.info(`AppGenius専用認証ファイルを作成しました: ${appGeniusAuthPath}`);
                }
                catch (createError) {
                    logger_1.Logger.error(`新しい認証ファイルの作成に失敗しました: ${appGeniusAuthPath}`, createError);
                    // エラーがあっても続行
                }
            }
            else {
                // 既存ファイルの有効性チェック
                try {
                    const existingAuthData = await fs.readJson(appGeniusAuthPath);
                    const hasValidTokens = existingAuthData.accessToken;
                    if (hasValidTokens) {
                        logger_1.Logger.info(`AppGenius専用認証ファイルが既に存在し、有効なトークンを含んでいます: ${appGeniusAuthPath}`);
                    }
                    else {
                        logger_1.Logger.warn(`AppGenius専用認証ファイルは存在しますが、有効なトークンがありません: ${appGeniusAuthPath}`);
                        // トークンを更新
                        const accessToken = this._authService.getAccessToken();
                        const state = this._authService.getCurrentState();
                        const expiresAt = state.expiresAt || (Date.now() + 3600000);
                        if (accessToken) {
                            // 既存のデータを更新
                            existingAuthData.accessToken = accessToken;
                            existingAuthData.expiresAt = expiresAt;
                            existingAuthData.updatedAt = Date.now();
                            // 更新したデータを保存
                            await fs.writeJson(appGeniusAuthPath, existingAuthData, {
                                spaces: 2,
                                mode: 0o600
                            });
                            logger_1.Logger.info(`AppGenius専用認証ファイルを更新しました: ${appGeniusAuthPath}`);
                        }
                    }
                    // Unix系OSでは、権限の確認と修正
                    if (process.platform !== 'win32') {
                        try {
                            const stats = await fs.stat(appGeniusAuthPath);
                            const currentPerms = stats.mode & 0o777; // 権限部分のみ取得
                            if (currentPerms !== 0o600) {
                                logger_1.Logger.warn(`認証ファイルの権限が不適切です (${currentPerms.toString(8)}), 600に修正します`);
                                await fs.chmod(appGeniusAuthPath, 0o600);
                            }
                        }
                        catch (statError) {
                            logger_1.Logger.warn(`権限の確認に失敗しました: ${statError.message}`);
                        }
                    }
                }
                catch (readError) {
                    logger_1.Logger.error(`既存の認証ファイルの読み込みに失敗しました: ${readError.message}`);
                }
            }
        }
        catch (error) {
            logger_1.Logger.error('認証ファイルの確認中にエラーが発生しました', error);
        }
    }
    /**
     * ClaudeCode CLIからトークンを削除
     * @param removeIsolatedAuth AppGenius専用の認証情報も削除するかどうか
     */
    async _removeTokensFromClaudeCode(removeIsolatedAuth = true) {
        try {
            // AppGenius専用の認証情報も削除する
            if (removeIsolatedAuth) {
                const appGeniusAuthFilePath = this.getAppGeniusAuthFilePath();
                if (fs.existsSync(appGeniusAuthFilePath)) {
                    fs.unlinkSync(appGeniusAuthFilePath);
                    logger_1.Logger.info('【API連携】AppGenius専用の認証情報を削除しました');
                }
                else {
                    logger_1.Logger.debug('AppGenius専用認証ファイルが存在しないため、削除操作はスキップします');
                }
            }
            // 認証削除完了のログ記録（使用量記録機能は削除済み）
            logger_1.Logger.debug('認証ファイル削除完了');
        }
        catch (error) {
            logger_1.Logger.error('認証情報の削除中にエラーが発生しました', error);
        }
    }
    /**
     * AppGenius専用の認証情報のみを削除
     */
    async removeAppGeniusAuthOnly() {
        try {
            const appGeniusAuthFilePath = this.getAppGeniusAuthFilePath();
            if (fs.existsSync(appGeniusAuthFilePath)) {
                fs.unlinkSync(appGeniusAuthFilePath);
                logger_1.Logger.info('【API連携】AppGenius専用の認証情報のみを削除しました');
            }
            else {
                logger_1.Logger.debug('AppGenius専用認証ファイルが存在しないため、削除操作はスキップします');
            }
        }
        catch (error) {
            logger_1.Logger.error('AppGenius専用認証情報の削除中にエラーが発生しました', error);
        }
    }
    /**
     * 現在の認証状態を確認し、必要に応じてトークンをリフレッシュする
     * @returns リフレッシュが成功したかどうか
     */
    async ensureValidAuth() {
        try {
            const isAuthenticated = this._authService.isAuthenticated();
            if (!isAuthenticated) {
                logger_1.Logger.warn('【API連携】認証されていません。リフレッシュを試みます');
                return await this._authService.verifyAuthState();
            }
            // 最後のリフレッシュから30分以上経過している場合、トークンをリフレッシュ
            const now = Date.now();
            if (now - this._lastTokenRefresh > 30 * 60 * 1000) {
                logger_1.Logger.info('【API連携】前回のリフレッシュから30分以上経過しているため、トークンをリフレッシュします');
                const refreshSucceeded = await this._authService.verifyAuthState();
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
     * AppGenius専用の認証情報ディレクトリを取得
     * @returns AppGenius専用の認証情報ディレクトリパス
     */
    _getAppGeniusAuthDir() {
        const homeDir = os.homedir();
        // 環境変数が設定されている場合は、それを優先
        if (process.env.APPGENIUS_AUTH_DIR) {
            return process.env.APPGENIUS_AUTH_DIR;
        }
        // まず、標準的な場所（.appgenius）を確認
        const dotAppGeniusDir = path.join(homeDir, '.appgenius');
        // ディレクトリが存在するか、作成可能な場合は.appgeniusを使用
        try {
            if (fs.existsSync(dotAppGeniusDir)) {
                return dotAppGeniusDir;
            }
            // 試験的に作成を試みる（権限がない場合は例外が発生）
            // 実際の作成は呼び出し側で行う
            const testDir = `${dotAppGeniusDir}_test`;
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true, mode: 0o700 });
                fs.rmdirSync(testDir);
            }
            // 作成可能であれば、標準の場所を返す
            return dotAppGeniusDir;
        }
        catch (error) {
            logger_1.Logger.debug(`標準認証ディレクトリに問題があります: ${error.message}`);
            // 作成できない場合は、OSごとの代替ディレクトリを使用
        }
        // OSによって設定ディレクトリの場所が異なる
        if (process.platform === 'win32') {
            // Windowsでの代替設定ディレクトリ
            const appDataDir = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
            return path.join(appDataDir, 'appgenius');
        }
        else if (process.platform === 'darwin') {
            // macOSでの代替設定ディレクトリ
            return path.join(homeDir, 'Library', 'Application Support', 'appgenius');
        }
        else {
            // Linux/Unixでの代替設定ディレクトリ
            const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
            return path.join(xdgConfigHome, 'appgenius');
        }
    }
    /**
     * AppGenius専用の認証情報ファイルパスを取得
     * @returns AppGenius専用の認証情報ファイルパス
     */
    getAppGeniusAuthFilePath() {
        // 環境変数で明示的に指定されている場合はそれを使用
        if (process.env.CLAUDE_AUTH_FILE) {
            return process.env.CLAUDE_AUTH_FILE;
        }
        // 標準のファイル名を使用
        return path.join(this._getAppGeniusAuthDir(), 'auth.json');
    }
    /**
     * ClaudeCode CLIが利用可能かチェック
     */
    async isClaudeCodeAvailable() {
        try {
            // ClaudeCode CLIパスを環境変数から取得、またはNVMパスを含めて検索
            const claudeCodePaths = [
                process.env.CLAUDE_CODE_PATH,
                'claude',
                `/Users/${os.userInfo().username}/.nvm/versions/node/v18.20.6/bin/claude`,
                '/usr/local/bin/claude' // グローバルインストール一般的な場所
            ].filter(Boolean); // undefined/nullを除去
            // 複数のパスで順番に試行
            let foundPath = null;
            for (const path of claudeCodePaths) {
                try {
                    if (!path)
                        continue;
                    logger_1.Logger.debug(`ClaudeCode CLIパスを試行中: ${path}`);
                    await this._execPromise(`${path} --version`);
                    foundPath = path;
                    logger_1.Logger.info(`ClaudeCode CLIが見つかりました: ${path}`);
                    break;
                }
                catch (pathError) {
                    logger_1.Logger.debug(`パス ${path} でのCLI検出に失敗: ${pathError.message}`);
                    // 続行して次のパスを試す
                }
            }
            if (!foundPath) {
                // すべてのパスが失敗した場合
                logger_1.Logger.warn('すべてのパスでClaudeCode CLIの検出に失敗しました');
                this._claudeCliLoginStatus = false;
                return false;
            }
            // 見つかったパスを環境変数に設定（メモリ内のみ）
            process.env.CLAUDE_CODE_PATH = foundPath;
            // 利用可能な場合、ログイン状態も確認する
            await this.checkClaudeCliLoginStatus();
            return true;
        }
        catch (error) {
            logger_1.Logger.error('ClaudeCode CLIの検出処理中にエラーが発生しました:', error);
            this._claudeCliLoginStatus = false;
            return false;
        }
    }
    /**
     * Claude CLIのログイン状態を確認
     * @returns ログインしているかどうか
     */
    async checkClaudeCliLoginStatus() {
        try {
            const appGeniusAuthPath = this.getAppGeniusAuthFilePath();
            // auth.jsonファイルが存在し、有効なトークンが含まれているか確認
            if (fs.existsSync(appGeniusAuthPath)) {
                try {
                    const authData = JSON.parse(fs.readFileSync(appGeniusAuthPath, 'utf8'));
                    // 必要なトークンが含まれていて、有効期限が切れていないかを確認
                    const isValid = authData.accessToken &&
                        authData.expiresAt &&
                        authData.expiresAt > Date.now();
                    this._claudeCliLoginStatus = isValid;
                    logger_1.Logger.debug(`Claude CLI ログイン状態確認: ${isValid ? 'ログイン済み' : '未ログインまたは期限切れ'}`);
                    return isValid;
                }
                catch (error) {
                    logger_1.Logger.warn('Claude CLI認証ファイルの解析に失敗しました:', error);
                    this._claudeCliLoginStatus = false;
                    return false;
                }
            }
            else {
                logger_1.Logger.debug('Claude CLI認証ファイルが見つかりません。未ログイン状態と判断します。');
                this._claudeCliLoginStatus = false;
                return false;
            }
        }
        catch (error) {
            logger_1.Logger.error('Claude CLIログイン状態の確認に失敗しました:', error);
            this._claudeCliLoginStatus = false;
            return false;
        }
    }
    /**
     * Claude CLIのログイン状態を取得
     * @returns 現在のログイン状態
     */
    isClaudeCliLoggedIn() {
        return this._claudeCliLoginStatus;
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