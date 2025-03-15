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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyManager = void 0;
const http = __importStar(require("http"));
const axios_1 = __importDefault(require("axios"));
const url_1 = require("url");
const AuthenticationService_1 = require("../core/auth/AuthenticationService");
const logger_1 = require("./logger");
/**
 * ProxyManager - APIリクエストのプロキシ管理
 *
 * VSCode拡張とClaudeCode CLIの間でAPIリクエストを中継します。
 * 認証トークンの自動付与や使用量トラッキングなどの機能を提供します。
 */
class ProxyManager {
    /**
     * コンストラクタ
     */
    constructor() {
        this._server = null;
        this._port = 0;
        this._targetHosts = new Map();
        // プロキシサーバーの設定
        this.DEFAULT_PORT = 54321;
        this.MAX_PORT_ATTEMPTS = 10;
        this._authService = AuthenticationService_1.AuthenticationService.getInstance();
        this._initializeTargetHosts();
    }
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!ProxyManager.instance) {
            ProxyManager.instance = new ProxyManager();
        }
        return ProxyManager.instance;
    }
    /**
     * ターゲットホストの初期化
     * プロキシ対象のAPIサービスを設定
     */
    _initializeTargetHosts() {
        const portalApiUrl = process.env.PORTAL_API_URL || 'http://localhost:3000/api';
        try {
            const url = new url_1.URL(portalApiUrl);
            const host = `${url.protocol}//${url.host}`;
            // ポータルAPIをプロキシ対象に追加
            this._targetHosts.set('api', host);
            // Claude APIプロキシをプロキシ対象に追加（必要に応じて）
            this._targetHosts.set('claude', 'https://api.anthropic.com');
            logger_1.Logger.debug(`プロキシ対象ホスト: ${Array.from(this._targetHosts.entries()).map(([k, v]) => `${k} -> ${v}`).join(', ')}`);
        }
        catch (error) {
            logger_1.Logger.error(`ターゲットホストの初期化に失敗しました: ${error}`);
        }
    }
    /**
     * プロキシサーバーを起動
     */
    async startProxyServer() {
        if (this._server) {
            logger_1.Logger.info(`プロキシサーバーは既に起動しています（ポート: ${this._port}）`);
            return this._port;
        }
        return new Promise((resolve, reject) => {
            try {
                // プロキシサーバーの作成
                this._server = http.createServer(this._handleRequest.bind(this));
                // ポートを順番に試行
                this._tryBindPort(this.DEFAULT_PORT, 0, resolve, reject);
            }
            catch (error) {
                logger_1.Logger.error(`プロキシサーバーの起動に失敗しました: ${error}`);
                reject(error);
            }
        });
    }
    /**
     * ポートにバインドを試みる（再帰的に試行）
     */
    _tryBindPort(port, attempts, resolve, reject) {
        if (attempts >= this.MAX_PORT_ATTEMPTS) {
            reject(new Error(`${this.MAX_PORT_ATTEMPTS}回の試行後もポートのバインドに失敗しました`));
            return;
        }
        this._server.once('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger_1.Logger.debug(`ポート ${port} は既に使用されています。次のポートを試行します...`);
                this._tryBindPort(port + 1, attempts + 1, resolve, reject);
            }
            else {
                reject(error);
            }
        });
        this._server.listen(port, () => {
            this._port = port;
            logger_1.Logger.info(`プロキシサーバーを起動しました（ポート: ${port}）`);
            resolve(port);
        });
    }
    /**
     * プロキシサーバーを停止
     */
    async stopProxyServer() {
        return new Promise((resolve, reject) => {
            if (!this._server) {
                resolve();
                return;
            }
            this._server.close((error) => {
                if (error) {
                    logger_1.Logger.error(`プロキシサーバー停止中にエラーが発生しました: ${error}`);
                    reject(error);
                }
                else {
                    this._server = null;
                    this._port = 0;
                    logger_1.Logger.info('プロキシサーバーを停止しました');
                    resolve();
                }
            });
        });
    }
    /**
     * リクエストハンドラ
     */
    async _handleRequest(req, res) {
        try {
            if (!req.url || !req.method) {
                this._sendError(res, 400, 'Bad Request');
                return;
            }
            // パスからターゲットを抽出（例: /api/auth -> apiが対象）
            const pathParts = req.url.split('/').filter(Boolean);
            const target = pathParts[0];
            // ターゲットが登録されているか確認
            if (!this._targetHosts.has(target)) {
                this._sendError(res, 404, `Unknown target: ${target}`);
                return;
            }
            const targetHost = this._targetHosts.get(target);
            // ターゲットパスを構築（最初のセグメントを除去）
            const targetPath = '/' + pathParts.slice(1).join('/');
            const targetUrl = `${targetHost}${targetPath}`;
            logger_1.Logger.debug(`プロキシリクエスト: ${req.method} ${req.url} -> ${targetUrl}`);
            // リクエストボディの取得
            let body = null;
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                body = await this._getRequestBody(req);
            }
            // リクエストヘッダーの準備
            const headers = {};
            if (req.headers) {
                Object.entries(req.headers).forEach(([key, value]) => {
                    if (value && typeof value === 'string') {
                        headers[key] = value;
                    }
                });
            }
            // 認証ヘッダーの追加
            const authHeader = await this._authService.getAuthHeader();
            if (authHeader) {
                Object.assign(headers, authHeader);
            }
            // プロキシとしての情報を追加
            headers['X-Proxy-Source'] = 'vscode-extension';
            // APIリクエストの実行
            const response = await this._makeRequest(targetUrl, req.method, headers, body);
            // レスポンスヘッダーの設定
            res.statusCode = response.status;
            Object.entries(response.headers).forEach(([key, value]) => {
                if (value && typeof value === 'string') {
                    res.setHeader(key, value);
                }
            });
            // レスポンスボディの送信
            res.end(JSON.stringify(response.data));
        }
        catch (error) {
            logger_1.Logger.error(`プロキシリクエスト処理中にエラーが発生しました: ${error}`);
            // エラーレスポンスの送信
            const statusCode = error.response?.status || 500;
            const errorMessage = error.response?.data?.message || error.message || 'Internal Server Error';
            this._sendError(res, statusCode, errorMessage);
        }
    }
    /**
     * リクエストボディを取得
     */
    _getRequestBody(req) {
        return new Promise((resolve, reject) => {
            const bodyChunks = [];
            req.on('data', (chunk) => {
                bodyChunks.push(chunk);
            });
            req.on('end', () => {
                try {
                    const bodyString = Buffer.concat(bodyChunks).toString();
                    // ボディが空の場合はnullを返す
                    if (!bodyString) {
                        resolve(null);
                        return;
                    }
                    // Content-Typeに基づいてパース
                    const contentType = req.headers['content-type'] || '';
                    if (contentType.includes('application/json')) {
                        resolve(JSON.parse(bodyString));
                    }
                    else {
                        resolve(bodyString);
                    }
                }
                catch (error) {
                    reject(error);
                }
            });
            req.on('error', (error) => {
                reject(error);
            });
        });
    }
    /**
     * APIリクエストを実行
     */
    async _makeRequest(url, method, headers, data) {
        return (0, axios_1.default)({
            url,
            method: method,
            headers,
            data: data || undefined,
            validateStatus: () => true // すべてのステータスコードを許可
        });
    }
    /**
     * エラーレスポンスを送信
     */
    _sendError(res, statusCode, message) {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: true, message }));
    }
    /**
     * プロキシURLを取得
     * @param target ターゲット名（'api', 'claude'など）
     */
    getProxyUrl(target) {
        if (!this._server || this._port === 0) {
            return null;
        }
        // ターゲットが登録されているか確認
        if (!this._targetHosts.has(target)) {
            return null;
        }
        return `http://localhost:${this._port}/${target}`;
    }
    /**
     * APIプロキシURLを環境変数用に取得
     */
    getApiProxyEnvValue() {
        return this.getProxyUrl('api');
    }
    /**
     * Claude APIプロキシURLを環境変数用に取得
     */
    getClaudeProxyEnvValue() {
        return this.getProxyUrl('claude');
    }
    /**
     * リソースの解放
     */
    dispose() {
        this.stopProxyServer().catch(error => {
            logger_1.Logger.error(`プロキシサーバー停止中にエラーが発生しました: ${error}`);
        });
    }
}
exports.ProxyManager = ProxyManager;
//# sourceMappingURL=ProxyManager.js.map