"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeLauncherService = void 0;
const logger_1 = require("../utils/logger");
const AppGeniusEventBus_1 = require("./AppGeniusEventBus");
const launcher_1 = require("./launcher");
/**
 * ClaudeCodeプロセス管理サービス
 * VSCode拡張からClaudeCodeを起動し、実装スコープに基づいて開発を進める
 *
 * 注: このクラスはリファクタリングされ、内部実装は ./launcher ディレクトリに移動されました。
 * このクラスは後方互換性のために維持されており、新しいコードはCorelauncherServiceを使用してください。
 */
class ClaudeCodeLauncherService {
    constructor() {
        // 並列処理用の設定
        this.maxConcurrentProcesses = 3; // 最大同時実行数
        this.coreLauncher = launcher_1.CoreLauncherService.getInstance();
        this.eventBus = AppGeniusEventBus_1.AppGeniusEventBus.getInstance();
        logger_1.Logger.info('ClaudeCodeLauncherService (リファクタリング済み) initialized');
    }
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!ClaudeCodeLauncherService.instance) {
            ClaudeCodeLauncherService.instance = new ClaudeCodeLauncherService();
        }
        return ClaudeCodeLauncherService.instance;
    }
    /**
     * スコープ情報を基にClaudeCodeを起動
     * @param scope スコープ情報（CLAUDE.md内のスコープIDでも対応可能）
     */
    async launchClaudeCode(scope) {
        // 起動前にカウンターイベントを発行
        this.eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED, { scope }, 'ClaudeCodeLauncherService');
        return this.coreLauncher.launchClaudeCode({ scope });
    }
    /**
     * モックアップを解析するためにClaudeCodeを起動
     * @param mockupFilePath モックアップHTMLファイルのパス
     * @param projectPath プロジェクトパス
     * @param options 追加オプション（ソース情報など）
     */
    async launchClaudeCodeWithMockup(mockupFilePath, projectPath, options) {
        // 起動前にカウンターイベントを発行
        this.eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED, { mockupFilePath, projectPath }, 'ClaudeCodeLauncherService');
        return this.coreLauncher.launchClaudeCodeWithMockup({
            mockupFilePath,
            projectPath,
            source: options?.source
        });
    }
    /**
     * 指定したプロンプトファイルを使用してClaudeCodeを起動
     * @param projectPath プロジェクトパス
     * @param promptFilePath プロンプトファイルの絶対パス
     * @param options 追加オプション
     */
    async launchClaudeCodeWithPrompt(projectPath, promptFilePath, options) {
        // 起動前にカウンターイベントを発行
        this.eventBus.emit(AppGeniusEventBus_1.AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED, { projectPath, promptFilePath, splitTerminal: options?.splitTerminal }, 'ClaudeCodeLauncherService');
        return this.coreLauncher.launchClaudeCodeWithPrompt({
            projectPath,
            promptFilePath,
            title: options?.title,
            additionalParams: options?.additionalParams,
            deletePromptFile: options?.deletePromptFile,
            location: options?.location,
            promptType: options?.promptType, // プロンプトタイプを渡す
            splitTerminal: options?.splitTerminal // ターミナル分割パラメータを渡す
        });
    }
    /**
     * ClaudeCodeが利用可能かチェック
     */
    async isClaudeCodeAvailable() {
        return this.coreLauncher.isClaudeCodeAvailable();
    }
    /**
     * 現在の実行状態を取得
     */
    getStatus() {
        return this.coreLauncher.getStatus();
    }
    /**
     * ClaudeCodeの状態を強制リセット
     */
    resetStatus() {
        this.coreLauncher.resetStatus();
    }
    /**
     * ClaudeCodeをインストール
     */
    async installClaudeCode() {
        return this.coreLauncher.installClaudeCode();
    }
    /**
     * 実行中のモックアップ解析プロセス一覧を取得
     */
    getRunningMockupProcesses() {
        return this.coreLauncher.getRunningMockupProcesses();
    }
    /**
     * モックアップ解析プロセスの状態を取得
     */
    getMockupProcessInfo(processId) {
        return this.coreLauncher.getMockupProcessInfo(processId);
    }
    /**
     * リソースの解放
     */
    dispose() {
        this.coreLauncher.dispose();
    }
}
exports.ClaudeCodeLauncherService = ClaudeCodeLauncherService;
//# sourceMappingURL=ClaudeCodeLauncherService.js.map