import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { Logger } from './logger';
import { ErrorHandler, ErrorSeverity, ErrorCategory } from './ErrorHandler';

/**
 * セキュリティ監査の対象領域
 */
export enum SecurityScope {
  AUTHENTICATION = 'authentication',   // 認証関連
  AUTHORIZATION = 'authorization',     // 認可関連
  DATA_VALIDATION = 'data_validation', // データ検証
  API_SECURITY = 'api_security',       // API通信セキュリティ
  STORAGE_SECURITY = 'storage_security', // ストレージセキュリティ
  TOKEN_SECURITY = 'token_security',   // トークン管理セキュリティ
  XSS_PREVENTION = 'xss_prevention',   // XSS対策
  CSRF_PREVENTION = 'csrf_prevention'  // CSRF対策
}

/**
 * セキュリティ検査の重要度
 */
export enum SecuritySeverity {
  LOW = 'low',         // 低（情報提供）
  MEDIUM = 'medium',   // 中（潜在的な脆弱性）
  HIGH = 'high',       // 高（脆弱性）
  CRITICAL = 'critical' // 重大（即時対応が必要な脆弱性）
}

/**
 * セキュリティチェック結果
 */
export interface SecurityCheckResult {
  id: string;               // チェックID
  name: string;             // チェック名
  description: string;      // 説明
  scope: SecurityScope;     // 対象領域
  severity: SecuritySeverity; // 重要度
  status: 'pass' | 'fail' | 'warning'; // 結果ステータス
  message: string;          // 結果メッセージ
  details?: string;         // 詳細情報
  recommendations?: string[]; // 推奨対応策
  timestamp: number;        // チェック実施時刻
}

/**
 * セキュリティ監査設定
 */
interface SecurityAuditorConfig {
  enabledChecks: string[];     // 有効なチェックID
  excludedPaths: string[];     // 除外パス
  apiBaseUrl: string;          // API基本URL
  scanIntervalMinutes: number; // 自動スキャン間隔（分）
  autoFixEnabled: boolean;     // 自動修正の有効/無効
  notifyOnIssuesFound: boolean; // 問題発見時の通知
  logLevel: string;            // ログレベル
}

/**
 * SecurityAuditor - アプリケーションのセキュリティを検査・監査するクラス
 * 
 * このクラスは認証、トークン管理、API通信などのセキュリティをチェックし、
 * 潜在的な脆弱性や問題を検出します。
 */
export class SecurityAuditor {
  private static instance: SecurityAuditor;
  private _config: SecurityAuditorConfig;
  private _results: SecurityCheckResult[] = [];
  private _onIssueFound = new vscode.EventEmitter<SecurityCheckResult>();
  private _scanInterval: NodeJS.Timer | null = null;
  private _errorHandler: ErrorHandler;
  
  /**
   * SecurityAuditorのシングルトンインスタンスを取得
   */
  public static getInstance(): SecurityAuditor {
    if (!SecurityAuditor.instance) {
      SecurityAuditor.instance = new SecurityAuditor();
    }
    return SecurityAuditor.instance;
  }
  
  /**
   * セキュリティ問題検出時のイベント
   */
  public readonly onIssueFound = this._onIssueFound.event;
  
  private constructor() {
    this._errorHandler = ErrorHandler.getInstance();
    
    // デフォルト設定
    this._config = {
      enabledChecks: ['all'],
      excludedPaths: ['node_modules', '.git'],
      apiBaseUrl: process.env.PORTAL_API_URL || 'http://localhost:3000/api',
      scanIntervalMinutes: 60,
      autoFixEnabled: false,
      notifyOnIssuesFound: true,
      logLevel: 'info'
    };
    
    Logger.info('セキュリティ監査ツールが初期化されました');
  }
  
  /**
   * 設定を更新
   * @param config 新しい設定（部分的な更新も可能）
   */
  public updateConfig(config: Partial<SecurityAuditorConfig>): void {
    this._config = { ...this._config, ...config };
    Logger.info('セキュリティ監査設定が更新されました');
  }
  
  /**
   * 認証セキュリティの監査を実行
   * @returns 監査結果のリスト
   */
  public async auditAuthentication(): Promise<SecurityCheckResult[]> {
    Logger.info('認証セキュリティ監査を開始します');
    const results: SecurityCheckResult[] = [];
    
    try {
      // トークンストレージセキュリティのチェック
      results.push(await this._checkTokenStorageSecurity());
      
      // トークンリフレッシュメカニズムのチェック
      results.push(await this._checkTokenRefreshMechanism());
      
      // セッション管理のチェック
      results.push(await this._checkSessionManagement());
      
      // ログアウト処理のチェック
      results.push(await this._checkLogoutProcess());
      
      // 結果を保存・通知
      this._processResults(results);
      
      Logger.info(`認証セキュリティ監査が完了しました: ${results.length}件のチェックを実施`);
      return results;
    } catch (error) {
      const appError = this._errorHandler.handleError(error, 'SecurityAuditor.auditAuthentication');
      const errorObj = new Error(appError.message);
      Logger.error('認証セキュリティ監査中にエラーが発生しました', errorObj);
      
      // エラー発生時も部分的な結果を返す
      this._processResults(results);
      return results;
    }
  }
  
  /**
   * API通信セキュリティの監査を実行
   * @returns 監査結果のリスト
   */
  public async auditApiSecurity(): Promise<SecurityCheckResult[]> {
    Logger.info('API通信セキュリティ監査を開始します');
    const results: SecurityCheckResult[] = [];
    
    try {
      // HTTPS使用のチェック
      results.push(this._checkHttpsUsage());
      
      // 認証ヘッダーのチェック
      results.push(this._checkAuthHeaders());
      
      // レート制限対策のチェック
      results.push(await this._checkRateLimitingProtection());
      
      // エラー処理のチェック
      results.push(this._checkErrorHandling());
      
      // 結果を保存・通知
      this._processResults(results);
      
      Logger.info(`API通信セキュリティ監査が完了しました: ${results.length}件のチェックを実施`);
      return results;
    } catch (error) {
      const appError = this._errorHandler.handleError(error, 'SecurityAuditor.auditApiSecurity');
      const apiErrorObj = new Error(appError.message);
      Logger.error('API通信セキュリティ監査中にエラーが発生しました', apiErrorObj);
      
      // エラー発生時も部分的な結果を返す
      this._processResults(results);
      return results;
    }
  }
  
  /**
   * フロントエンドセキュリティの監査を実行
   * @returns 監査結果のリスト
   */
  public async auditFrontendSecurity(): Promise<SecurityCheckResult[]> {
    Logger.info('フロントエンドセキュリティ監査を開始します');
    const results: SecurityCheckResult[] = [];
    
    try {
      // XSS対策のチェック
      results.push(this._checkXssPrevention());
      
      // CSRF対策のチェック
      results.push(this._checkCsrfPrevention());
      
      // セキュアなローカルストレージ使用のチェック
      results.push(this._checkSecureLocalStorage());
      
      // 結果を保存・通知
      this._processResults(results);
      
      Logger.info(`フロントエンドセキュリティ監査が完了しました: ${results.length}件のチェックを実施`);
      return results;
    } catch (error) {
      const appError = this._errorHandler.handleError(error, 'SecurityAuditor.auditFrontendSecurity');
      const frontendErrorObj = new Error(appError.message);
      Logger.error('フロントエンドセキュリティ監査中にエラーが発生しました', frontendErrorObj);
      
      // エラー発生時も部分的な結果を返す
      this._processResults(results);
      return results;
    }
  }
  
  /**
   * 全セキュリティ監査を実行
   * @returns 監査結果のリスト
   */
  public async auditAll(): Promise<SecurityCheckResult[]> {
    Logger.info('全セキュリティ監査を開始します');
    
    try {
      // 各監査を実行
      const authResults = await this.auditAuthentication();
      const apiResults = await this.auditApiSecurity();
      const frontendResults = await this.auditFrontendSecurity();
      
      // 結果を統合
      const allResults = [...authResults, ...apiResults, ...frontendResults];
      
      // 結果サマリーをログ出力
      const failedChecks = allResults.filter(r => r.status === 'fail').length;
      const warningChecks = allResults.filter(r => r.status === 'warning').length;
      const passedChecks = allResults.filter(r => r.status === 'pass').length;
      
      Logger.info(`
        セキュリティ監査完了:
        - 合計チェック数: ${allResults.length}
        - 失敗: ${failedChecks}
        - 警告: ${warningChecks}
        - 成功: ${passedChecks}
      `);
      
      return allResults;
    } catch (error) {
      const appError = this._errorHandler.handleError(error, 'SecurityAuditor.auditAll');
      const securityErrorObj = new Error(appError.message);
      Logger.error('セキュリティ監査中にエラーが発生しました', securityErrorObj);
      return [];
    }
  }
  
  /**
   * 定期的な監査スケジュールを開始
   */
  public startScheduledAudits(): void {
    if (this._scanInterval) {
      this.stopScheduledAudits();
    }
    
    const intervalMinutes = this._config.scanIntervalMinutes;
    Logger.info(`定期的なセキュリティ監査スケジュールを開始します (間隔: ${intervalMinutes}分)`);
    
    this._scanInterval = setInterval(() => {
      this.auditAll().catch(error => {
        Logger.error('定期監査中にエラーが発生しました', error);
      });
    }, intervalMinutes * 60 * 1000);
  }
  
  /**
   * 定期的な監査スケジュールを停止
   */
  public stopScheduledAudits(): void {
    if (this._scanInterval) {
      clearInterval(this._scanInterval);
      this._scanInterval = null;
      Logger.info('定期的なセキュリティ監査スケジュールを停止しました');
    }
  }
  
  /**
   * 監査結果の処理（保存と通知）
   * @param results 処理する監査結果のリスト
   */
  private _processResults(results: SecurityCheckResult[]): void {
    // 結果を保存
    this._results = [...this._results, ...results];
    
    // 問題が見つかった場合の処理
    const issues = results.filter(r => r.status === 'fail' || r.status === 'warning');
    
    if (issues.length > 0 && this._config.notifyOnIssuesFound) {
      // 重要度の高い順にソート
      issues.sort((a, b) => {
        const severityOrder: { [key in SecuritySeverity]: number } = {
          'critical': 0,
          'high': 1,
          'medium': 2,
          'low': 3
        };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
      
      // 重要な問題をログに記録
      issues.forEach(issue => {
        if (issue.severity === SecuritySeverity.HIGH || issue.severity === SecuritySeverity.CRITICAL) {
          Logger.warn(`セキュリティ問題検出: [${issue.severity.toUpperCase()}] ${issue.name} - ${issue.message}`);
        }
      });
      
      // 通知を発行
      if (issues.length === 1) {
        vscode.window.showWarningMessage(`セキュリティ問題を検出: ${issues[0].message}`);
      } else {
        vscode.window.showWarningMessage(`${issues.length}件のセキュリティ問題を検出しました`);
      }
      
      // イベント発火（各問題について個別に）
      issues.forEach(issue => {
        this._onIssueFound.fire(issue);
      });
    }
  }
  
  /**
   * 最新の監査結果を取得
   * @param scope 特定のスコープでフィルタ（オプション）
   * @param severity 特定の重要度でフィルタ（オプション）
   * @param status 特定のステータスでフィルタ（オプション）
   */
  public getResults(
    scope?: SecurityScope,
    severity?: SecuritySeverity,
    status?: 'pass' | 'fail' | 'warning' | 'info'
  ): SecurityCheckResult[] {
    let filteredResults = [...this._results];
    
    if (scope) {
      filteredResults = filteredResults.filter(r => r.scope === scope);
    }
    
    if (severity) {
      filteredResults = filteredResults.filter(r => r.severity === severity);
    }
    
    if (status) {
      filteredResults = filteredResults.filter(r => r.status === status);
    }
    
    return filteredResults;
  }
  
  /**
   * トークンストレージセキュリティのチェック
   */
  private async _checkTokenStorageSecurity(): Promise<SecurityCheckResult> {
    // VSCode Secret Storage APIの利用を確認するチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = 'トークンはVSCode Secret Storage APIで安全に保存されています';
    let details = undefined;
    
    try {
      // TokenManager.tsのコードをチェック
      const extensionPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (extensionPath) {
        const tokenManagerPath = path.join(extensionPath, 'src', 'core', 'auth', 'TokenManager.ts');
        
        if (fs.existsSync(tokenManagerPath)) {
          const tokenManagerCode = fs.readFileSync(tokenManagerPath, 'utf8');
          
          // SecretStorageの使用をチェック
          if (!tokenManagerCode.includes('secretStorage') || !tokenManagerCode.includes('context.secrets')) {
            status = 'fail';
            message = 'トークン管理でVSCode Secret Storage APIが使用されていません';
            details = 'TokenManager.tsでトークンの安全な保存方法が見つかりません。セキュリティリスクがあります。';
          }
          
          // トークンの平文保存をチェック
          if (tokenManagerCode.includes('localStorage') || 
              tokenManagerCode.includes('sessionStorage') || 
              (tokenManagerCode.includes('fs.') && tokenManagerCode.includes('writeFile'))) {
            status = 'warning';
            message = 'トークンの安全でない保存方法が検出されました';
            details = 'トークンが平文でローカルストレージまたはファイルシステムに保存されている可能性があります。';
          }
        } else {
          status = 'warning';
          message = 'TokenManager.tsが見つからないため、評価できません';
        }
      } else {
        status = 'warning';
        message = 'ワークスペースが見つからないため、評価できません';
      }
    } catch (error) {
      status = 'warning';
      message = 'トークンストレージセキュリティの評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'auth-token-storage',
      name: 'トークンストレージセキュリティ',
      description: 'トークンが安全な方法で保存されているか確認します',
      scope: SecurityScope.TOKEN_SECURITY,
      severity: SecuritySeverity.HIGH,
      status,
      message,
      details,
      recommendations: status !== 'pass' ? [
        'トークンの保存にはVSCode Secret Storage APIを使用する',
        'トークンを平文でファイルシステムやローカルストレージに保存しない',
        'やむを得ず平文保存する場合は暗号化を検討する'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * トークンリフレッシュメカニズムのチェック
   */
  private async _checkTokenRefreshMechanism(): Promise<SecurityCheckResult> {
    // トークンリフレッシュメカニズムの実装をチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = 'トークンリフレッシュメカニズムが適切に実装されています';
    let details = undefined;
    
    try {
      // AuthenticationService.tsのコードをチェック
      const extensionPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (extensionPath) {
        const authServicePath = path.join(extensionPath, 'src', 'core', 'auth', 'AuthenticationService.ts');
        
        if (fs.existsSync(authServicePath)) {
          const authServiceCode = fs.readFileSync(authServicePath, 'utf8');
          
          // リフレッシュメカニズムの存在をチェック
          if (!authServiceCode.includes('refreshToken') || !authServiceCode.includes('refresh-token')) {
            status = 'fail';
            message = 'トークンリフレッシュメカニズムが見つかりません';
            details = 'AuthenticationService.tsでトークンリフレッシュの実装が見つかりません。トークンの期限切れに対応できない可能性があります。';
          }
          
          // 401エラー時の自動リフレッシュをチェック
          if (!authServiceCode.includes('401') || 
              !(authServiceCode.includes('refreshToken') && authServiceCode.includes('401'))) {
            status = 'warning';
            message = '401エラー時の自動トークンリフレッシュが見つかりません';
            details = 'APIリクエスト時の401エラーに対する自動リフレッシュ処理が実装されていない可能性があります。';
          }
        } else {
          status = 'warning';
          message = 'AuthenticationService.tsが見つからないため、評価できません';
        }
      } else {
        status = 'warning';
        message = 'ワークスペースが見つからないため、評価できません';
      }
    } catch (error) {
      status = 'warning';
      message = 'トークンリフレッシュメカニズムの評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'auth-token-refresh',
      name: 'トークンリフレッシュメカニズム',
      description: 'トークンの自動リフレッシュ機能が実装されているか確認します',
      scope: SecurityScope.TOKEN_SECURITY,
      severity: SecuritySeverity.MEDIUM,
      status,
      message,
      details,
      recommendations: status !== 'pass' ? [
        '有効期限のあるアクセストークンとリフレッシュトークンを使用する',
        '401エラー時に自動的にトークンリフレッシュを試みる処理を実装する',
        'リフレッシュトークンの有効期限切れ時はユーザーに再ログインを促す'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * セッション管理のチェック
   */
  private async _checkSessionManagement(): Promise<SecurityCheckResult> {
    // セッション管理の実装をチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = 'セッション管理が適切に実装されています';
    let details = undefined;
    
    try {
      // AuthenticationService.tsのコードをチェック
      const extensionPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (extensionPath) {
        const authServicePath = path.join(extensionPath, 'src', 'core', 'auth', 'AuthenticationService.ts');
        
        if (fs.existsSync(authServicePath)) {
          const authServiceCode = fs.readFileSync(authServicePath, 'utf8');
          
          // セッションチェック機能の存在をチェック
          if (!authServiceCode.includes('_authCheckInterval') && 
              !authServiceCode.includes('verifyToken')) {
            status = 'warning';
            message = '定期的なセッションチェック機能が見つかりません';
            details = 'AuthenticationService.tsで定期的なトークン検証またはセッションチェック機能が見つかりません。';
          }
          
          // セッションタイムアウト処理をチェック
          if (!authServiceCode.includes('tokenExpired') && 
              !authServiceCode.includes('TOKEN_EXPIRED') && 
              !authServiceCode.includes('sessionExpired')) {
            status = 'warning';
            message = 'セッションタイムアウト処理が見つかりません';
            details = 'トークンの有効期限切れやセッションタイムアウトの処理が実装されていない可能性があります。';
          }
        } else {
          status = 'warning';
          message = 'AuthenticationService.tsが見つからないため、評価できません';
        }
      } else {
        status = 'warning';
        message = 'ワークスペースが見つからないため、評価できません';
      }
    } catch (error) {
      status = 'warning';
      message = 'セッション管理の評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'auth-session-management',
      name: 'セッション管理',
      description: 'セッションのライフサイクル管理が適切に実装されているか確認します',
      scope: SecurityScope.AUTHENTICATION,
      severity: SecuritySeverity.MEDIUM,
      status,
      message,
      details,
      recommendations: status !== 'pass' ? [
        '定期的なトークン検証機能を実装する',
        'セッションタイムアウト時の処理を実装する',
        'ユーザーの長時間の非アクティブ状態を検出し適切に対応する'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * ログアウト処理のチェック
   */
  private async _checkLogoutProcess(): Promise<SecurityCheckResult> {
    // ログアウト処理の実装をチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = 'ログアウト処理が適切に実装されています';
    let details = undefined;
    
    try {
      // AuthenticationService.tsのコードをチェック
      const extensionPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (extensionPath) {
        const authServicePath = path.join(extensionPath, 'src', 'core', 'auth', 'AuthenticationService.ts');
        
        if (fs.existsSync(authServicePath)) {
          const authServiceCode = fs.readFileSync(authServicePath, 'utf8');
          
          // ログアウト機能の存在をチェック
          if (!authServiceCode.includes('logout') || 
              !authServiceCode.includes('clearTokens')) {
            status = 'fail';
            message = 'ログアウト処理が適切に実装されていません';
            details = 'AuthenticationService.tsで適切なログアウト処理またはトークンクリア機能が見つかりません。';
          }
          
          // サーバーサイドのログアウト処理をチェック
          if (!authServiceCode.includes('/auth/logout') &&
              !authServiceCode.includes('refreshToken')) {
            status = 'warning';
            message = 'サーバーサイドのログアウト処理が見つかりません';
            details = 'リフレッシュトークンの無効化などサーバーサイドのログアウト処理が実装されていない可能性があります。';
          }
        } else {
          status = 'warning';
          message = 'AuthenticationService.tsが見つからないため、評価できません';
        }
      } else {
        status = 'warning';
        message = 'ワークスペースが見つからないため、評価できません';
      }
    } catch (error) {
      status = 'warning';
      message = 'ログアウト処理の評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'auth-logout-process',
      name: 'ログアウト処理',
      description: 'ログアウト処理が適切に実装されているか確認します',
      scope: SecurityScope.AUTHENTICATION,
      severity: SecuritySeverity.MEDIUM,
      status,
      message,
      details,
      recommendations: status !== 'pass' ? [
        'クライアント側のトークンを確実に削除する',
        'サーバー側でリフレッシュトークンを無効化する',
        'ログアウト後の状態を適切にリセットする'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * HTTPS使用のチェック
   */
  private _checkHttpsUsage(): SecurityCheckResult {
    // APIエンドポイントがHTTPSを使用しているかチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = 'すべてのAPIリクエストでHTTPSが使用されています';
    let details = undefined;
    
    try {
      const apiBaseUrl = this._config.apiBaseUrl;
      
      // URLがHTTPSで始まるかチェック
      if (!apiBaseUrl.startsWith('https://') && apiBaseUrl !== 'http://localhost') {
        if (apiBaseUrl.startsWith('http://localhost') || 
            apiBaseUrl.startsWith('http://127.0.0.1')) {
          status = 'warning';
          message = 'ローカル開発環境ではHTTPが使用されています';
          details = 'ローカル開発環境ではHTTPの使用は許容されますが、本番環境では必ずHTTPSを使用してください。';
        } else {
          status = 'fail';
          message = 'APIリクエストでHTTPSが使用されていません';
          details = `API基本URL (${apiBaseUrl}) がHTTPSプロトコルを使用していません。これは重大なセキュリティリスクです。`;
        }
      }
    } catch (error) {
      status = 'warning';
      message = 'HTTPS使用状況の評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'api-https-usage',
      name: 'HTTPS通信',
      description: 'APIリクエストがHTTPSを使用しているか確認します',
      scope: SecurityScope.API_SECURITY,
      severity: SecuritySeverity.CRITICAL,
      status,
      message,
      details,
      recommendations: status !== 'pass' ? [
        'すべてのAPIエンドポイントでHTTPSを使用する',
        '開発環境でもHTTPSの使用を推奨する',
        'ローカル開発でもHTTPS証明書を使用するよう検討する'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * 認証ヘッダーのチェック
   */
  private _checkAuthHeaders(): SecurityCheckResult {
    // 認証ヘッダーが適切に使用されているかチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = '認証ヘッダーが適切に使用されています';
    let details = undefined;
    
    try {
      // AuthenticationService.tsのコードをチェック
      const extensionPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (extensionPath) {
        const authServicePath = path.join(extensionPath, 'src', 'core', 'auth', 'AuthenticationService.ts');
        
        if (fs.existsSync(authServicePath)) {
          const authServiceCode = fs.readFileSync(authServicePath, 'utf8');
          
          // 認証ヘッダーの使用をチェック
          if (!authServiceCode.includes('Authorization') || 
              !authServiceCode.includes('Bearer')) {
            status = 'warning';
            message = 'Bearer認証ヘッダーの使用が確認できません';
            details = 'AuthenticationService.tsでBearer認証トークンの使用が確認できません。';
          }
          
          // getAuthHeaderメソッドの存在をチェック
          if (!authServiceCode.includes('getAuthHeader')) {
            status = 'warning';
            message = '認証ヘッダー生成メソッドが見つかりません';
            details = '認証ヘッダーを一貫して生成するメソッドが見つかりません。認証ヘッダーの生成が分散している可能性があります。';
          }
        } else {
          status = 'warning';
          message = 'AuthenticationService.tsが見つからないため、評価できません';
        }
      } else {
        status = 'warning';
        message = 'ワークスペースが見つからないため、評価できません';
      }
    } catch (error) {
      status = 'warning';
      message = '認証ヘッダー使用状況の評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'api-auth-headers',
      name: '認証ヘッダー',
      description: 'APIリクエストで認証ヘッダーが適切に使用されているか確認します',
      scope: SecurityScope.API_SECURITY,
      severity: SecuritySeverity.HIGH,
      status,
      message,
      details,
      recommendations: status !== 'pass' ? [
        'すべての認証が必要なAPIリクエストにBearer認証ヘッダーを使用する',
        '認証ヘッダーを一貫して生成する共通メソッドを実装する',
        'トークンが無効な場合の適切なエラーハンドリングを実装する'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * レート制限対策のチェック
   */
  private async _checkRateLimitingProtection(): Promise<SecurityCheckResult> {
    // レート制限対策の実装をチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = 'レート制限対策が適切に実装されています';
    let details = undefined;
    
    try {
      // AuthenticationService.tsのコードをチェック
      const extensionPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (extensionPath) {
        const authServicePath = path.join(extensionPath, 'src', 'core', 'auth', 'AuthenticationService.ts');
        
        if (fs.existsSync(authServicePath)) {
          const authServiceCode = fs.readFileSync(authServicePath, 'utf8');
          
          // 429エラー処理の存在をチェック
          if (!authServiceCode.includes('429')) {
            status = 'warning';
            message = 'レート制限(429)エラー処理が見つかりません';
            details = 'APIリクエストのレート制限(429)エラーに対する処理が見つかりません。';
          }
          
          // リトライロジックの存在をチェック
          if (!authServiceCode.includes('retry') && 
              !authServiceCode.includes('Retry') && 
              !authServiceCode.includes('_maxRetries')) {
            status = 'warning';
            message = 'APIリクエストのリトライロジックが見つかりません';
            details = 'APIリクエスト失敗時のリトライロジックが実装されていない可能性があります。';
          }
        } else {
          status = 'warning';
          message = 'AuthenticationService.tsが見つからないため、評価できません';
        }
      } else {
        status = 'warning';
        message = 'ワークスペースが見つからないため、評価できません';
      }
    } catch (error) {
      status = 'warning';
      message = 'レート制限対策の評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'api-rate-limiting',
      name: 'レート制限対策',
      description: 'APIレート制限に対する対策が実装されているか確認します',
      scope: SecurityScope.API_SECURITY,
      severity: SecuritySeverity.MEDIUM,
      status,
      message,
      details,
      recommendations: status !== 'pass' ? [
        'レート制限(429)エラーを適切に処理する',
        '指数バックオフアルゴリズムを使用したリトライロジックを実装する',
        'リトライ回数に上限を設ける'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * エラー処理のチェック
   */
  private _checkErrorHandling(): SecurityCheckResult {
    // APIエラー処理の実装をチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = 'APIエラー処理が適切に実装されています';
    let details = undefined;
    
    try {
      // AuthenticationService.tsとErrorHandler.tsのコードをチェック
      const extensionPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (extensionPath) {
        const authServicePath = path.join(extensionPath, 'src', 'core', 'auth', 'AuthenticationService.ts');
        const errorHandlerPath = path.join(extensionPath, 'src', 'utils', 'ErrorHandler.ts');
        
        // ErrorHandlerの存在をチェック
        if (!fs.existsSync(errorHandlerPath)) {
          status = 'warning';
          message = '集中型エラーハンドリングクラスが見つかりません';
          details = 'ErrorHandler.tsが見つかりません。エラー処理が分散している可能性があります。';
        } else {
          // エラーハンドラーの内容をチェック
          const errorHandlerCode = fs.readFileSync(errorHandlerPath, 'utf8');
          
          if (!errorHandlerCode.includes('handleError') || 
              !errorHandlerCode.includes('normalizeError')) {
            status = 'warning';
            message = 'エラーハンドラーに標準化機能が見つかりません';
            details = 'ErrorHandler.tsで標準的なエラー処理メソッドが見つかりません。';
          }
        }
        
        // AuthenticationServiceのエラー処理をチェック
        if (fs.existsSync(authServicePath)) {
          const authServiceCode = fs.readFileSync(authServicePath, 'utf8');
          
          // try-catch ブロックの使用をチェック
          if (!authServiceCode.includes('try') || 
              !authServiceCode.includes('catch')) {
            status = 'warning';
            message = 'API操作でのtry-catchエラー処理が見つかりません';
            details = 'AuthenticationService.tsでAPIリクエスト時のtry-catchエラー処理が見つかりません。';
          }
        }
      } else {
        status = 'warning';
        message = 'ワークスペースが見つからないため、評価できません';
      }
    } catch (error) {
      status = 'warning';
      message = 'エラー処理の評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'api-error-handling',
      name: 'APIエラー処理',
      description: 'APIエラーが適切に処理されているか確認します',
      scope: SecurityScope.API_SECURITY,
      severity: SecuritySeverity.MEDIUM,
      status,
      message,
      details,
      recommendations: status !== 'pass' ? [
        '集中型のエラーハンドリングクラスを実装する',
        'すべてのAPIリクエストでtry-catchを使用する',
        'エラーを標準化して処理する共通ロジックを実装する'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * XSS対策のチェック
   */
  private _checkXssPrevention(): SecurityCheckResult {
    // XSS対策の実装をチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = 'XSS対策が適切に実装されています';
    let details = undefined;
    
    try {
      const extensionPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (extensionPath) {
        // WebViewプロバイダーのコードをチェック
        const webviewPaths = [
          path.join(extensionPath, 'src', 'ui', 'auth', 'LoginWebviewPanel.ts'),
          path.join(extensionPath, 'src', 'ui', 'ChatViewProvider.ts')
        ];
        
        let webviewFound = false;
        let contentSecurityFound = false;
        
        for (const webviewPath of webviewPaths) {
          if (fs.existsSync(webviewPath)) {
            webviewFound = true;
            const webviewCode = fs.readFileSync(webviewPath, 'utf8');
            
            // Content Security Policyの設定をチェック
            if (webviewCode.includes('Content-Security-Policy') || 
                webviewCode.includes('enableScripts: true') || 
                webviewCode.includes('localResourceRoots')) {
              contentSecurityFound = true;
            }
          }
        }
        
        if (!webviewFound) {
          status = 'warning';
          message = 'WebViewが使用されていないため、XSS対策は該当しません';
        } else if (!contentSecurityFound) {
          status = 'warning';
          message = 'WebViewでContent Security Policyが設定されていない可能性があります';
          details = 'WebViewでのContent Security Policyの設定が見つかりません。XSS攻撃のリスクがあります。';
        }
      } else {
        status = 'warning';
        message = 'ワークスペースが見つからないため、評価できません';
      }
    } catch (error) {
      status = 'warning';
      message = 'XSS対策の評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'frontend-xss-prevention',
      name: 'XSS対策',
      description: 'クロスサイトスクリプティング(XSS)対策が実装されているか確認します',
      scope: SecurityScope.XSS_PREVENTION,
      severity: SecuritySeverity.HIGH,
      status,
      message,
      details,
      recommendations: (status !== 'pass') ? [
        'WebViewでContent Security Policyを設定する',
        'ユーザー入力をエスケープして表示する',
        'localResourceRootsを適切に設定してリソースアクセスを制限する'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * CSRF対策のチェック
   */
  private _checkCsrfPrevention(): SecurityCheckResult {
    // CSRF対策の実装をチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = 'CSRF対策が適切に実装されています';
    let details = undefined;
    
    try {
      const extensionPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (extensionPath) {
        const authServicePath = path.join(extensionPath, 'src', 'core', 'auth', 'AuthenticationService.ts');
        
        if (fs.existsSync(authServicePath)) {
          const authServiceCode = fs.readFileSync(authServicePath, 'utf8');
          
          // CSRFトークンの使用をチェック
          if (!authServiceCode.includes('csrf') && 
              !authServiceCode.includes('CSRF') && 
              !authServiceCode.includes('xsrf') && 
              !authServiceCode.includes('XSRF')) {
            
            // VS Code拡張では一般的なWebページと異なりCSRFのリスクは低いため、警告ではなく情報として表示
            status = 'warning';
            message = 'CSRFトークンは見つかりませんが、VS Code拡張ではCSRFリスクは限定的です';
            details = 'VS Code WebViewは一般的なWebページとは異なり、CSRFのリスクが低いため、トークンが見つからなくても問題ない場合があります。';
          }
        } else {
          status = 'warning';
          message = 'AuthenticationService.tsが見つからないため、CSRF対策は評価できません';
        }
      } else {
        status = 'warning';
        message = 'ワークスペースが見つからないため、評価できません';
      }
    } catch (error) {
      status = 'warning';
      message = 'CSRF対策の評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'frontend-csrf-prevention',
      name: 'CSRF対策',
      description: 'クロスサイトリクエストフォージェリ(CSRF)対策が実装されているか確認します',
      scope: SecurityScope.CSRF_PREVENTION,
      severity: SecuritySeverity.MEDIUM,
      status,
      message,
      details,
      recommendations: (status !== 'pass') ? [
        '状態変更を伴うリクエストにCSRFトークンを使用する',
        'カスタムHTTPヘッダーを使用して制御する',
        'SameSite Cookieポリシーを実装する'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * セキュアなローカルストレージ使用のチェック
   */
  private _checkSecureLocalStorage(): SecurityCheckResult {
    // ローカルストレージの使用をチェック
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let message = 'ローカルストレージが安全に使用されています';
    let details = undefined;
    
    try {
      const extensionPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (extensionPath) {
        // WebView関連ファイルをチェック
        const webviewPaths = [
          path.join(extensionPath, 'webviews'),
          path.join(extensionPath, 'src', 'ui', 'webview')
        ];
        
        let sensitiveDataInStorage = false;
        
        for (const webviewPath of webviewPaths) {
          if (fs.existsSync(webviewPath)) {
            // ディレクトリ内のJSファイルを検索
            const jsFiles = this._findFiles(webviewPath, '.js');
            
            for (const jsFile of jsFiles) {
              const jsCode = fs.readFileSync(jsFile, 'utf8');
              
              // ローカルストレージの使用をチェック
              if ((jsCode.includes('localStorage') || jsCode.includes('sessionStorage')) &&
                  (jsCode.includes('token') || jsCode.includes('password') || 
                   jsCode.includes('credential') || jsCode.includes('auth'))) {
                sensitiveDataInStorage = true;
                details = `ファイル ${path.relative(extensionPath, jsFile)} で機密データがローカルストレージに保存されている可能性があります。`;
                break;
              }
            }
            
            if (sensitiveDataInStorage) {
              break;
            }
          }
        }
        
        if (sensitiveDataInStorage) {
          status = 'warning';
          message = '機密データがローカルストレージに保存されている可能性があります';
        }
      } else {
        status = 'warning';
        message = 'ワークスペースが見つからないため、評価できません';
      }
    } catch (error) {
      status = 'warning';
      message = 'ローカルストレージ使用状況の評価中にエラーが発生しました';
      details = (error as Error).message;
    }
    
    return {
      id: 'frontend-secure-storage',
      name: 'セキュアなストレージ',
      description: 'ローカルストレージ/セッションストレージが安全に使用されているか確認します',
      scope: SecurityScope.STORAGE_SECURITY,
      severity: SecuritySeverity.MEDIUM,
      status,
      message,
      details,
      recommendations: status !== 'pass' ? [
        'ローカルストレージに機密データを保存しない',
        'VSCode Secret Storage APIを使用して機密データを保存する',
        'どうしても必要な場合は、保存前に暗号化する'
      ] : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * 再帰的にファイルを検索するヘルパーメソッド
   * @param dir 検索対象ディレクトリ
   * @param extension 検索対象の拡張子
   * @returns 見つかったファイルパスの配列
   */
  private _findFiles(dir: string, extension: string): string[] {
    if (!fs.existsSync(dir)) {
      return [];
    }
    
    const results: string[] = [];
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          // 再帰的に検索（除外パスはスキップ）
          if (!this._config.excludedPaths.includes(item)) {
            results.push(...this._findFiles(itemPath, extension));
          }
        } else if (stat.isFile() && itemPath.endsWith(extension)) {
          results.push(itemPath);
        }
      }
    } catch (error) {
      Logger.warn(`ディレクトリ ${dir} の検索中にエラーが発生しました: ${(error as Error).message}`);
    }
    
    return results;
  }
  
  /**
   * リソースの解放
   */
  public dispose(): void {
    this.stopScheduledAudits();
    this._onIssueFound.dispose();
  }
}