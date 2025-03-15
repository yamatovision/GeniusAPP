import * as vscode from 'vscode';
import { AuthenticationService } from '../../core/auth/AuthenticationService';
import axios from 'axios';

/**
 * UsageIndicator - APIトークン使用量を表示するステータスバーアイテム
 * 
 * 現在のトークン使用量を視覚的に表示し、制限に近づくと警告を表示します。
 */
export class UsageIndicator {
  private static instance: UsageIndicator;
  private _statusBarItem: vscode.StatusBarItem;
  private _authService: AuthenticationService;
  private _disposables: vscode.Disposable[] = [];
  private _usageCheckInterval: NodeJS.Timer | null = null;
  private _currentUsage: number = 0;
  private _usageLimit: number = 0;
  private _warningThreshold: number = 0.8; // 80%のデフォルト警告閾値

  /**
   * コンストラクタ
   */
  private constructor() {
    this._authService = AuthenticationService.getInstance();
    
    // ステータスバーアイテムの作成
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99 // 認証ステータスの左側に表示
    );
    
    // 認証状態変更時のイベントリスナー
    this._disposables.push(
      this._authService.onAuthStateChanged(this._handleAuthStateChange.bind(this))
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
   */
  private async _fetchUsageData(): Promise<void> {
    if (!this._authService.isAuthenticated()) {
      return;
    }
    
    try {
      const authHeader = await this._authService.getAuthHeader();
      if (!authHeader) {
        return;
      }
      
      const apiUrl = process.env.PORTAL_API_URL || 'http://localhost:3000/api';
      
      const response = await axios.get(`${apiUrl}/usage/current`, {
        headers: authHeader
      });
      
      if (response.status === 200 && response.data) {
        this._currentUsage = response.data.tokensUsed || 0;
        this._usageLimit = response.data.tokenLimit || 0;
        
        // ステータスバーの表示を更新
        this._updateStatusBarDisplay();
      }
    } catch (error) {
      console.error('使用量データ取得中にエラーが発生しました:', error);
    }
  }

  /**
   * ステータスバーの表示を更新
   */
  private _updateStatusBarDisplay(): void {
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