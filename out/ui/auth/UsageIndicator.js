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
exports.UsageIndicator = void 0;
const vscode = __importStar(require("vscode"));
const AuthenticationService_1 = require("../../core/auth/AuthenticationService");
const axios_1 = __importDefault(require("axios"));
/**
 * UsageIndicator - APIトークン使用量を表示するステータスバーアイテム
 *
 * 現在のトークン使用量を視覚的に表示し、制限に近づくと警告を表示します。
 */
class UsageIndicator {
    /**
     * コンストラクタ
     */
    constructor() {
        this._disposables = [];
        this._usageCheckInterval = null;
        this._currentUsage = 0;
        this._usageLimit = 0;
        this._warningThreshold = 0.8; // 80%のデフォルト警告閾値
        this._authService = AuthenticationService_1.AuthenticationService.getInstance();
        // ステータスバーアイテムの作成
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99 // 認証ステータスの左側に表示
        );
        // 認証状態変更時のイベントリスナー
        this._disposables.push(this._authService.onAuthStateChanged(this._handleAuthStateChange.bind(this)));
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
    static getInstance() {
        if (!UsageIndicator.instance) {
            UsageIndicator.instance = new UsageIndicator();
        }
        return UsageIndicator.instance;
    }
    /**
     * 認証状態変更のハンドラー
     */
    _handleAuthStateChange(isAuthenticated) {
        if (isAuthenticated) {
            // ログイン時に使用量チェックを開始
            this._startUsageCheck();
            // 使用量の初期取得
            this._fetchUsageData();
        }
        else {
            // ログアウト時に使用量チェックを停止
            this._stopUsageCheck();
            // ステータスバーの表示を更新
            this._updateStatusBarVisibility();
        }
    }
    /**
     * 使用量データを取得
     */
    async _fetchUsageData() {
        if (!this._authService.isAuthenticated()) {
            return;
        }
        try {
            const authHeader = await this._authService.getAuthHeader();
            if (!authHeader) {
                return;
            }
            const apiUrl = process.env.PORTAL_API_URL || 'http://localhost:3000/api';
            const response = await axios_1.default.get(`${apiUrl}/usage/current`, {
                headers: authHeader
            });
            if (response.status === 200 && response.data) {
                this._currentUsage = response.data.tokensUsed || 0;
                this._usageLimit = response.data.tokenLimit || 0;
                // ステータスバーの表示を更新
                this._updateStatusBarDisplay();
            }
        }
        catch (error) {
            console.error('使用量データ取得中にエラーが発生しました:', error);
        }
    }
    /**
     * ステータスバーの表示を更新
     */
    _updateStatusBarDisplay() {
        if (this._usageLimit <= 0) {
            // 使用制限が設定されていない場合
            this._statusBarItem.text = `$(graph) ${this._formatNumber(this._currentUsage)} トークン`;
            this._statusBarItem.tooltip = `現在の使用量: ${this._formatNumber(this._currentUsage)} トークン\n制限なし`;
        }
        else {
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
            }
            else {
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
    _updateStatusBarVisibility() {
        if (this._authService.isAuthenticated()) {
            this._statusBarItem.show();
        }
        else {
            this._statusBarItem.hide();
        }
    }
    /**
     * 使用量チェックインターバルを開始
     */
    _startUsageCheck() {
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
    _stopUsageCheck() {
        if (this._usageCheckInterval) {
            clearInterval(this._usageCheckInterval);
            this._usageCheckInterval = null;
        }
    }
    /**
     * 数値を読みやすい形式にフォーマット
     */
    _formatNumber(num) {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        }
        else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        else {
            return num.toString();
        }
    }
    /**
     * 手動での使用量更新
     */
    async refreshUsage() {
        await this._fetchUsageData();
    }
    /**
     * 使用量警告通知を表示（制限の80%に達した場合）
     */
    showUsageWarning() {
        if (!this._usageLimit) {
            return;
        }
        const usagePercentage = this._currentUsage / this._usageLimit;
        if (usagePercentage >= this._warningThreshold) {
            vscode.window.showWarningMessage(`AppGenius: トークン使用量が制限の${Math.round(usagePercentage * 100)}%に達しています。`, '詳細を表示', 'OK').then(selection => {
                if (selection === '詳細を表示') {
                    vscode.commands.executeCommand('appgenius.showUsageDetails');
                }
            });
        }
    }
    /**
     * 使用量が制限を超過した場合の通知を表示
     */
    showUsageLimitExceeded() {
        vscode.window.showErrorMessage('AppGenius: トークン使用量が制限を超過しました。管理者に連絡して制限の引き上げをリクエストしてください。', '詳細を表示', 'OK').then(selection => {
            if (selection === '詳細を表示') {
                vscode.commands.executeCommand('appgenius.showUsageDetails');
            }
        });
    }
    /**
     * リソースの解放
     */
    dispose() {
        this._stopUsageCheck();
        this._statusBarItem.dispose();
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
    }
}
exports.UsageIndicator = UsageIndicator;
//# sourceMappingURL=UsageIndicator.js.map