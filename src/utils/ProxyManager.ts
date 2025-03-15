import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import axios from 'axios';
import { URL } from 'url';
import { AuthenticationService } from '../core/auth/AuthenticationService';
import { Logger } from './logger';

/**
 * ProxyManager - APIリクエストのプロキシ管理
 * 
 * VSCode拡張とClaudeCode CLIの間でAPIリクエストを中継します。
 * 認証トークンの自動付与や使用量トラッキングなどの機能を提供します。
 */
export class ProxyManager {
  private static instance: ProxyManager;
  private _server: http.Server | null = null;
  private _port: number = 0;
  private _authService: AuthenticationService;
  private _targetHosts: Map<string, string> = new Map();
  
  // プロキシサーバーの設定
  private readonly DEFAULT_PORT = 54321;
  private readonly MAX_PORT_ATTEMPTS = 10;

  /**
   * コンストラクタ
   */
  private constructor() {
    this._authService = AuthenticationService.getInstance();
    this._initializeTargetHosts();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager();
    }
    return ProxyManager.instance;
  }

  /**
   * ターゲットホストの初期化
   * プロキシ対象のAPIサービスを設定
   */
  private _initializeTargetHosts(): void {
    const portalApiUrl = process.env.PORTAL_API_URL || 'http://localhost:3000/api';
    try {
      const url = new URL(portalApiUrl);
      const host = `${url.protocol}//${url.host}`;
      
      // ポータルAPIをプロキシ対象に追加
      this._targetHosts.set('api', host);
      
      // Claude APIプロキシをプロキシ対象に追加（必要に応じて）
      this._targetHosts.set('claude', 'https://api.anthropic.com');
      
      Logger.debug(`プロキシ対象ホスト: ${Array.from(this._targetHosts.entries()).map(([k, v]) => `${k} -> ${v}`).join(', ')}`);
    } catch (error) {
      Logger.error(`ターゲットホストの初期化に失敗しました: ${error}`);
    }
  }

  /**
   * プロキシサーバーを起動
   */
  public async startProxyServer(): Promise<number> {
    if (this._server) {
      Logger.info(`プロキシサーバーは既に起動しています（ポート: ${this._port}）`);
      return this._port;
    }

    return new Promise<number>((resolve, reject) => {
      try {
        // プロキシサーバーの作成
        this._server = http.createServer(this._handleRequest.bind(this));
        
        // ポートを順番に試行
        this._tryBindPort(this.DEFAULT_PORT, 0, resolve, reject);
      } catch (error) {
        Logger.error(`プロキシサーバーの起動に失敗しました: ${error}`);
        reject(error);
      }
    });
  }

  /**
   * ポートにバインドを試みる（再帰的に試行）
   */
  private _tryBindPort(port: number, attempts: number, resolve: (port: number) => void, reject: (error: Error) => void): void {
    if (attempts >= this.MAX_PORT_ATTEMPTS) {
      reject(new Error(`${this.MAX_PORT_ATTEMPTS}回の試行後もポートのバインドに失敗しました`));
      return;
    }

    this._server!.once('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        Logger.debug(`ポート ${port} は既に使用されています。次のポートを試行します...`);
        this._tryBindPort(port + 1, attempts + 1, resolve, reject);
      } else {
        reject(error);
      }
    });

    this._server!.listen(port, () => {
      this._port = port;
      Logger.info(`プロキシサーバーを起動しました（ポート: ${port}）`);
      resolve(port);
    });
  }

  /**
   * プロキシサーバーを停止
   */
  public async stopProxyServer(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this._server) {
        resolve();
        return;
      }

      this._server.close((error) => {
        if (error) {
          Logger.error(`プロキシサーバー停止中にエラーが発生しました: ${error}`);
          reject(error);
        } else {
          this._server = null;
          this._port = 0;
          Logger.info('プロキシサーバーを停止しました');
          resolve();
        }
      });
    });
  }

  /**
   * リクエストハンドラ
   */
  private async _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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

      const targetHost = this._targetHosts.get(target)!;
      // ターゲットパスを構築（最初のセグメントを除去）
      const targetPath = '/' + pathParts.slice(1).join('/');
      const targetUrl = `${targetHost}${targetPath}`;

      Logger.debug(`プロキシリクエスト: ${req.method} ${req.url} -> ${targetUrl}`);

      // リクエストボディの取得
      let body: any = null;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = await this._getRequestBody(req);
      }

      // リクエストヘッダーの準備
      const headers: { [key: string]: string } = {};
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
      const response = await this._makeRequest(targetUrl, req.method as string, headers, body);

      // レスポンスヘッダーの設定
      res.statusCode = response.status;
      Object.entries(response.headers).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          res.setHeader(key, value);
        }
      });

      // レスポンスボディの送信
      res.end(JSON.stringify(response.data));

    } catch (error: any) {
      Logger.error(`プロキシリクエスト処理中にエラーが発生しました: ${error}`);
      
      // エラーレスポンスの送信
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data?.message || error.message || 'Internal Server Error';
      this._sendError(res, statusCode, errorMessage);
    }
  }

  /**
   * リクエストボディを取得
   */
  private _getRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const bodyChunks: Buffer[] = [];
      
      req.on('data', (chunk: Buffer) => {
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
          } else {
            resolve(bodyString);
          }
        } catch (error) {
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
  private async _makeRequest(
    url: string,
    method: string,
    headers: { [key: string]: string },
    data: any
  ): Promise<any> {
    return axios({
      url,
      method: method as any,
      headers,
      data: data || undefined,
      validateStatus: () => true // すべてのステータスコードを許可
    });
  }

  /**
   * エラーレスポンスを送信
   */
  private _sendError(res: http.ServerResponse, statusCode: number, message: string): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: true, message }));
  }

  /**
   * プロキシURLを取得
   * @param target ターゲット名（'api', 'claude'など）
   */
  public getProxyUrl(target: string): string | null {
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
  public getApiProxyEnvValue(): string | null {
    return this.getProxyUrl('api');
  }

  /**
   * Claude APIプロキシURLを環境変数用に取得
   */
  public getClaudeProxyEnvValue(): string | null {
    return this.getProxyUrl('claude');
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    this.stopProxyServer().catch(error => {
      Logger.error(`プロキシサーバー停止中にエラーが発生しました: ${error}`);
    });
  }
}