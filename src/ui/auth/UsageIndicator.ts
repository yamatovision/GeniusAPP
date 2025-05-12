import * as vscode from 'vscode';
import { SimpleAuthService } from '../../core/auth/SimpleAuthService';
import axios from 'axios';

/**
 * UsageIndicator - APIトークン使用量を表示するステータスバーアイテム
 * 
 * 現在のトークン使用量を視覚的に表示し、制限に近づくと警告を表示します。
 */
export class UsageIndicator {
  private static instance: UsageIndicator;
  private _statusBarItem: vscode.StatusBarItem;
  private _authService: SimpleAuthService;
  private _disposables: vscode.Disposable[] = [];
  private _usageCheckInterval: NodeJS.Timer | null = null;
  private _currentUsage: number = 0;
  private _usageLimit: number = 0;
  private _warningThreshold: number = 0.8; // 80%のデフォルト警告閾値
  private _isUpdating: boolean = false; // 更新中フラグ
  private _lastSuccessfulFetch: number = 0; // 最後に成功した取得時間のタイムスタンプ
  private _errorCount: number = 0; // エラー発生回数

  /**
   * コンストラクタ
   */
  private constructor() {
    try {
      const context = (global as any).appgeniusContext;
      if (context) {
        this._authService = SimpleAuthService.getInstance(context);
      } else {
        throw new Error('コンテキストが見つかりません');
      }
    } catch (error) {
      console.error('SimpleAuthServiceの初期化に失敗しました:', error);
      throw error;
    }
    
    // ステータスバーアイテムの作成
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99 // 認証ステータスの左側に表示
    );
    
    // 認証状態変更時のイベントリスナー
    this._disposables.push(
      this._authService.onStateChanged(state => {
        this._handleAuthStateChange(state.isAuthenticated);
      })
    );
    
    // 環境変数から警告閾値を設定
    const envThreshold = process.env.USAGE_WARNING_THRESHOLD;
    if (envThreshold) {
      const threshold = parseFloat(envThreshold);
      if (!isNaN(threshold) && threshold > 0 && threshold <= 1) {
        this._warningThreshold = threshold;
      }
    }
    
    // 初期状態の設定
    this._updateStatusBarVisibility();
  }

  /**
   * UsageIndicatorのシングルトンインスタンスを取得
   */
  public static getInstance(): UsageIndicator {
    if (!UsageIndicator.instance) {
      UsageIndicator.instance = new UsageIndicator();
    }
    return UsageIndicator.instance;
  }

  /**
   * 認証状態変更のハンドラー
   */
  private _handleAuthStateChange(isAuthenticated: boolean): void {
    if (isAuthenticated) {
      // ログイン時に使用量チェックを開始
      this._startUsageCheck();
      // 使用量の初期取得
      this._fetchUsageData();
    } else {
      // ログアウト時に使用量チェックを停止
      this._stopUsageCheck();
      // ステータスバーの表示を更新
      this._updateStatusBarVisibility();
    }
  }

  /**
   * 使用量データを取得
   * 複数のAPIエンドポイントを試行し、リトライロジックとエラーハンドリングを強化
   */
  private async _fetchUsageData(): Promise<void> {
    if (!this._authService.isAuthenticated()) {
      return;
    }
    
    if (this._isUpdating) {
      return; // 既に更新中の場合は重複実行を防止
    }
    
    this._isUpdating = true;
    
    try {
      const authHeader = await this._authService.getAuthHeader();
      if (!authHeader) {
        this._isUpdating = false;
        return;
      }
      
      // フォールバック用のAPIエンドポイントリストを取得
      const apiUrls = this._getFallbackApiUrls();
      
      // 各APIエンドポイントを順番に試行
      for (const apiUrl of apiUrls) {
        if (!apiUrl) continue; // 無効なURLはスキップ
        
        // リトライロジックを追加
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 1000; // 1秒
        
        while (retryCount <= maxRetries) {
          try {
            if (retryCount > 0) {
              console.log(`使用量データ取得リトライ (${retryCount}/${maxRetries})...`);
            }
            
            // タイムアウト設定付きリクエスト
            const response = await axios.get(`${apiUrl}/proxy/usage/me`, {
              headers: authHeader,
              timeout: 15000 // 15秒タイムアウト
            });
            
            if (response.status === 200 && response.data) {
              // レスポンス構造に合わせてデータマッピングを修正
              const usage = response.data.usage?.monthly || {};
              this._currentUsage = usage.totalTokens || 0;
              this._usageLimit = response.data.limits?.monthly || 0;
              
              // 成功したエンドポイントとタイムスタンプを記録
              this._lastSuccessfulFetch = Date.now();
              this._errorCount = 0; // エラーカウントをリセット
              
              // ステータスバーの表示を更新
              this._updateStatusBarDisplay();
              this._isUpdating = false;
              return; // 成功したら終了
            }
            
            break; // 200以外のレスポンスの場合は次のエンドポイントに進む
          } catch (error) {
            retryCount++;
            
            // エラーの種類を特定
            if (axios.isAxiosError(error)) {
              const isServerError = error.response?.status === 500;
              const isTimeout = error.code === 'ECONNABORTED';
              const isNetworkError = !error.response && error.code !== 'ECONNABORTED';
              
              // サーバーエラー(500)またはタイムアウトの場合のみリトライ
              if ((isServerError || isTimeout) && retryCount <= maxRetries) {
                // 指数バックオフ（リトライ回数に応じて待ち時間を増やす）
                const waitTime = retryDelay * Math.pow(2, retryCount - 1);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              } else if (isNetworkError && retryCount > maxRetries) {
                // ネットワークエラーで最大リトライ回数に達した場合は次のエンドポイントに進む
                break;
              } else if (error.response?.status === 401 || error.response?.status === 403) {
                // 認証エラーの場合は処理を終了
                this._isUpdating = false;
                
                // 詳細なログ出力
                console.error(`認証エラーが発生しました (Status: ${error.response?.status}):`, error.message);
                
                // ステータスバーの表示を更新
                this._updateStatusBarDisplay();
                return;
              }
            }
            
            // 最大リトライ回数に達した場合は次のエンドポイントに進む
            if (retryCount > maxRetries) {
              break;
            }
          }
        }
      }
      
      // すべてのエンドポイントが失敗した場合
      this._errorCount++;
      
      // エラーをより詳細にログ出力
      console.error(`使用量データの取得に失敗しました。すべてのエンドポイントが応答しませんでした。エラー回数: ${this._errorCount}`);
      
      // エラー発生時でもUIが機能するようにデフォルト表示を設定
      this._updateStatusBarDisplay();
    } catch (error) {
      // 予期しないエラーも捕捉
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const responseData = error.response?.data;
        console.error(`使用量データ取得中にエラーが発生しました (Status: ${statusCode}):`, error.message, responseData);
      } else {
        console.error('使用量データ取得中に予期しないエラーが発生しました:', error);
      }
      
      this._errorCount++;
      
      // エラー発生時でもUIが機能するようにデフォルト表示を設定
      this._updateStatusBarDisplay();
    } finally {
      this._isUpdating = false;
    }
  }
  
  /**
   * API URLを取得
   * 環境変数から取得するか、デフォルト値を返す
   * フォールバック機構を追加し、複数のエンドポイントを試行
   */
  private _getApiUrl(): string {
    // 環境変数が設定されている場合は優先
    if (process.env.PORTAL_API_URL) {
      return process.env.PORTAL_API_URL;
    }
    
    // デフォルトは本番環境URL
    return 'https://geniemon-portal-backend-production.up.railway.app/api';
  }
  
  /**
   * フォールバックAPIエンドポイントリストを取得
   * 優先順位順に返す
   */
  private _getFallbackApiUrls(): string[] {
    return [
      process.env.PORTAL_API_URL, // 環境変数から取得（もし設定されていれば）
      'https://geniemon-portal-backend-production.up.railway.app/api', // 本番環境URL
      'https://geniemon-portal-backend-staging.up.railway.app/api'     // ステージング環境URL
    ].filter(Boolean); // undefined/nullを除外
  }

  /**
   * ステータスバーの表示を更新
   */
  private _updateStatusBarDisplay(): void {
    try {
      if (this._usageLimit <= 0) {
        // 使用制限が設定されていない場合
        this._statusBarItem.text = `$(graph) ${this._formatNumber(this._currentUsage)} トークン`;
        this._statusBarItem.tooltip = `現在の使用量: ${this._formatNumber(this._currentUsage)} トークン\n制限なし`;
      } else {
        // 使用率の計算
        const usagePercentage = this._currentUsage / this._usageLimit;
        const formattedPercentage = Math.round(usagePercentage * 100);
        
        // 残りトークン数
        const remainingTokens = Math.max(0, this._usageLimit - this._currentUsage);
        
        // 表示形式の設定
        if (usagePercentage >= this._warningThreshold) {
          // 警告表示（80%以上）
          this._statusBarItem.text = `$(warning) ${formattedPercentage}%`;
          this._statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        } else {
          // 通常表示
          this._statusBarItem.text = `$(graph) ${formattedPercentage}%`;
          this._statusBarItem.color = undefined; // デフォルトの色に戻す
        }
        
        // ツールチップの設定
        this._statusBarItem.tooltip = 
          `現在の使用量: ${this._formatNumber(this._currentUsage)} / ${this._formatNumber(this._usageLimit)} トークン\n` +
          `使用率: ${formattedPercentage}%\n` +
          `残り: ${this._formatNumber(remainingTokens)} トークン\n\n` +
          `クリックして詳細を表示`;
      }
    } catch (error) {
      // エラー発生時にはフォールバック表示を設定
      this._statusBarItem.text = `$(graph) --`;
      this._statusBarItem.tooltip = `使用量データを取得できませんでした。\nクリックして再試行`;
      this._statusBarItem.color = undefined;
      console.error('ステータスバー表示の更新中にエラーが発生しました:', error);
    }
    
    // コマンドの設定
    this._statusBarItem.command = 'appgenius.showUsageDetails';
  }

  /**
   * ステータスバーの表示/非表示を更新
   */
  private _updateStatusBarVisibility(): void {
    if (this._authService.isAuthenticated()) {
      this._statusBarItem.show();
    } else {
      this._statusBarItem.hide();
    }
  }

  /**
   * 使用量チェックインターバルを開始
   */
  private _startUsageCheck(): void {
    // 既存のインターバルがあれば停止
    this._stopUsageCheck();
    
    // 15分ごとに使用量をチェック（900000ミリ秒）
    this._usageCheckInterval = setInterval(() => {
      this._fetchUsageData();
    }, 900000);
    
    // 初回のデータ取得
    this._fetchUsageData();
  }

  /**
   * 使用量チェックインターバルを停止
   */
  private _stopUsageCheck(): void {
    if (this._usageCheckInterval) {
      clearInterval(this._usageCheckInterval);
      this._usageCheckInterval = null;
    }
  }

  /**
   * 数値を読みやすい形式にフォーマット
   */
  private _formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else {
      return num.toString();
    }
  }

  /**
   * 手動での使用量更新
   */
  public async refreshUsage(): Promise<void> {
    await this._fetchUsageData();
  }

  /**
   * 使用量警告通知を表示（制限の80%に達した場合）
   */
  public showUsageWarning(): void {
    if (!this._usageLimit) {
      return;
    }
    
    const usagePercentage = this._currentUsage / this._usageLimit;
    if (usagePercentage >= this._warningThreshold) {
      vscode.window.showWarningMessage(
        `AppGenius: トークン使用量が制限の${Math.round(usagePercentage * 100)}%に達しています。`,
        '詳細を表示',
        'OK'
      ).then(selection => {
        if (selection === '詳細を表示') {
          vscode.commands.executeCommand('appgenius.showUsageDetails');
        }
      });
    }
  }

  /**
   * 使用量が制限を超過した場合の通知を表示
   */
  public showUsageLimitExceeded(): void {
    vscode.window.showErrorMessage(
      'AppGenius: トークン使用量が制限を超過しました。管理者に連絡して制限の引き上げをリクエストしてください。',
      '詳細を表示',
      'OK'
    ).then(selection => {
      if (selection === '詳細を表示') {
        vscode.commands.executeCommand('appgenius.showUsageDetails');
      }
    });
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    this._stopUsageCheck();
    this._statusBarItem.dispose();
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }
}