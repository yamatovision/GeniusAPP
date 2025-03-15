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
exports.ScopeSelector = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../../utils/logger");
const MarkdownManager_1 = require("../../utils/MarkdownManager");
const types_1 = require("../../types");
/**
 * スコープ選択クラス
 */
class ScopeSelector {
    constructor(aiService) {
        this._requirementsDocument = '';
        this._items = [];
        this._selectedIds = [];
        this._projectPath = '';
        this._currentScopeId = null;
        this._aiService = aiService;
        this._markdownManager = MarkdownManager_1.MarkdownManager.getInstance();
    }
    /**
     * プロジェクトパスを設定
     */
    setProjectPath(projectPath) {
        this._projectPath = projectPath;
        logger_1.Logger.info(`プロジェクトパスを設定しました: ${projectPath}`);
    }
    /**
     * 現在のプロジェクトパスを取得
     */
    getProjectPath() {
        return this._projectPath;
    }
    /**
     * 要件定義書を設定
     */
    setRequirementsDocument(document) {
        this._requirementsDocument = document;
        logger_1.Logger.info('要件定義書を設定しました');
    }
    /**
     * 要件定義書から実装項目を抽出
     */
    async extractImplementationItems() {
        try {
            if (!this._requirementsDocument) {
                throw new Error('要件定義書が設定されていません');
            }
            if (!this._projectPath) {
                throw new Error('プロジェクトパスが設定されていません');
            }
            logger_1.Logger.info('要件定義書から実装項目を抽出します');
            // 要件定義からスコープを作成
            const scopeId = await this._markdownManager.createScopeFromRequirements(this._projectPath, this._requirementsDocument, this._aiService);
            if (!scopeId) {
                throw new Error('スコープの作成に失敗しました');
            }
            // 読み込み前に少し待機（ファイル操作のタイミングの問題を軽減）
            await new Promise(resolve => setTimeout(resolve, 2000));
            // 作成されたスコープを読み込む
            const scope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, scopeId);
            if (!scope) {
                // ファイルシステムを調べるための追加ログ
                logger_1.Logger.debug(`スコープ ${scopeId} の読み込みを再試行します`);
                // 再試行
                await new Promise(resolve => setTimeout(resolve, 3000));
                const retryScope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, scopeId);
                if (!retryScope) {
                    throw new Error('作成されたスコープの読み込みに失敗しました');
                }
                // 再試行で成功した場合はそれを使用
                this._currentScopeId = scopeId;
                this._items = retryScope.items;
                this._selectedIds = retryScope.selectedIds;
            }
            else {
                // 現在のスコープIDを保存
                this._currentScopeId = scopeId;
                // アイテムとIDを更新
                this._items = scope.items;
                this._selectedIds = scope.selectedIds;
            }
            logger_1.Logger.info(`${this._items.length}件の実装項目を抽出しました`);
            return this._items;
        }
        catch (error) {
            logger_1.Logger.error('実装項目の抽出に失敗しました', error);
            throw error;
        }
    }
    /**
     * 項目の選択状態を更新
     */
    toggleItemSelection(id) {
        if (!this._projectPath || !this._currentScopeId) {
            logger_1.Logger.error('プロジェクトパスまたはスコープIDが設定されていません');
            return;
        }
        const item = this._items.find(item => item.id === id);
        if (!item) {
            logger_1.Logger.error(`項目が見つかりません: ${id}`);
            return;
        }
        const isSelected = !item.isSelected;
        // アイテム選択状態を更新
        const result = this._markdownManager.toggleScopeItemSelection(this._projectPath, this._currentScopeId, id, isSelected);
        if (result) {
            // 成功したら内部状態も更新
            item.isSelected = isSelected;
            if (isSelected) {
                this._selectedIds.push(id);
                // 新しく選択された項目はpending状態で初期化
                if (!item.status) {
                    item.status = types_1.ScopeItemStatus.PENDING;
                    item.progress = 0;
                }
            }
            else {
                this._selectedIds = this._selectedIds.filter(selectedId => selectedId !== id);
            }
            logger_1.Logger.debug(`項目「${item.title}」の選択状態を変更: ${item.isSelected}`);
        }
        else {
            logger_1.Logger.error(`項目「${item.title}」の選択状態の更新に失敗しました`);
        }
    }
    /**
     * 実装項目のステータスを更新
     */
    updateItemStatus(id, status) {
        if (!this._projectPath || !this._currentScopeId) {
            logger_1.Logger.error('プロジェクトパスまたはスコープIDが設定されていません');
            return;
        }
        const item = this._items.find(item => item.id === id);
        if (!item) {
            logger_1.Logger.error(`項目が見つかりません: ${id}`);
            return;
        }
        // ステータスを更新
        const result = this._markdownManager.updateScopeItemStatus(this._projectPath, this._currentScopeId, id, status);
        if (result) {
            // 成功したら内部状態も更新
            item.status = status;
            // ステータスに応じて進捗率を自動調整
            if (status === types_1.ScopeItemStatus.COMPLETED) {
                item.progress = 100;
            }
            else if (status === types_1.ScopeItemStatus.PENDING && item.progress === 0) {
                // 既に設定されている場合は変更しない
            }
            else if (status === types_1.ScopeItemStatus.IN_PROGRESS && item.progress === 0) {
                item.progress = 10; // 開始時は10%程度
            }
            // スコープを再読み込み
            this.reloadCurrentScope();
            logger_1.Logger.debug(`項目「${item.title}」のステータスを更新: ${status}`);
        }
        else {
            logger_1.Logger.error(`項目「${item.title}」のステータス更新に失敗しました`);
        }
    }
    /**
     * 実装項目の進捗率を更新
     */
    updateItemProgress(id, progress) {
        if (!this._projectPath || !this._currentScopeId) {
            logger_1.Logger.error('プロジェクトパスまたはスコープIDが設定されていません');
            return;
        }
        const item = this._items.find(item => item.id === id);
        if (!item) {
            logger_1.Logger.error(`項目が見つかりません: ${id}`);
            return;
        }
        // 進捗率に応じてステータスを自動調整
        let status = item.status || types_1.ScopeItemStatus.PENDING;
        if (progress >= 100) {
            status = types_1.ScopeItemStatus.COMPLETED;
        }
        else if (progress > 0 && progress < 100 && status === types_1.ScopeItemStatus.PENDING) {
            status = types_1.ScopeItemStatus.IN_PROGRESS;
        }
        // ステータスを更新（進捗率も同時に更新される）
        const result = this._markdownManager.updateScopeItemStatus(this._projectPath, this._currentScopeId, id, status, progress);
        if (result) {
            // 成功したら内部状態も更新
            item.progress = Math.max(0, Math.min(100, progress)); // 0-100の範囲に制限
            item.status = status;
            // スコープを再読み込み
            this.reloadCurrentScope();
            logger_1.Logger.debug(`項目「${item.title}」の進捗率を更新: ${progress}%`);
        }
        else {
            logger_1.Logger.error(`項目「${item.title}」の進捗率更新に失敗しました`);
        }
    }
    /**
     * 実装項目にメモを追加
     */
    updateItemNotes(id, notes) {
        if (!this._projectPath || !this._currentScopeId) {
            logger_1.Logger.error('プロジェクトパスまたはスコープIDが設定されていません');
            return;
        }
        const item = this._items.find(item => item.id === id);
        if (!item) {
            logger_1.Logger.error(`項目が見つかりません: ${id}`);
            return;
        }
        // メモを更新
        const result = this._markdownManager.updateScopeItemNotes(this._projectPath, this._currentScopeId, id, notes);
        if (result) {
            // 成功したら内部状態も更新
            item.notes = notes;
            logger_1.Logger.debug(`項目「${item.title}」のメモを更新`);
        }
        else {
            logger_1.Logger.error(`項目「${item.title}」のメモ更新に失敗しました`);
        }
    }
    /**
     * 選択された項目の一覧を取得
     */
    getSelectedItems() {
        return this._items.filter(item => item.isSelected);
    }
    /**
     * スコープの工数見積りを取得
     */
    async estimateScope() {
        try {
            const selectedItems = this.getSelectedItems();
            if (selectedItems.length === 0) {
                return '0時間';
            }
            logger_1.Logger.info('スコープの工数見積りを計算します');
            const prompt = `以下の実装項目リストについて、工数見積り（時間）を算出してください。
各項目の複雑度も考慮してください。
返答では時間の見積りのみを端的に「XX時間」という形式で返してください。

実装項目:
${JSON.stringify(selectedItems, null, 2)}`;
            const response = await this._aiService.sendMessage(prompt, 'implementation');
            // 時間の部分を抽出 (例: "約20時間")
            const timeMatch = response.match(/(\d+[\-～]?\d*)\s*(時間|日|週間)/);
            const estimatedTime = timeMatch ? timeMatch[0] : '見積り不明';
            // 現在のスコープが存在する場合、推定時間を更新
            if (this._projectPath && this._currentScopeId) {
                const scope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, this._currentScopeId);
                if (scope) {
                    scope.estimatedTime = estimatedTime;
                    this._markdownManager.saveScopeToClaudeMd(this._projectPath, scope);
                }
            }
            logger_1.Logger.info(`工数見積り結果: ${estimatedTime}`);
            return estimatedTime;
        }
        catch (error) {
            logger_1.Logger.error('工数見積りの取得に失敗しました', error);
            return '見積りエラー';
        }
    }
    /**
     * 全体の進捗率を計算
     */
    calculateTotalProgress() {
        const selectedItems = this.getSelectedItems();
        if (selectedItems.length === 0) {
            return 0;
        }
        // 各項目の進捗率の平均を計算
        const totalProgress = selectedItems.reduce((sum, item) => sum + (item.progress || 0), 0) / selectedItems.length;
        return Math.round(totalProgress);
    }
    /**
     * 現在のスコープを取得
     */
    async getCurrentScope() {
        // 現在のスコープがすでにCLAUDE.mdに保存されている場合はそれを読み込む
        if (this._projectPath && this._currentScopeId) {
            const savedScope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, this._currentScopeId);
            if (savedScope) {
                // 内部状態を更新
                this._items = savedScope.items;
                this._selectedIds = savedScope.selectedIds;
                return {
                    id: savedScope.id,
                    items: savedScope.items,
                    selectedIds: savedScope.selectedIds,
                    estimatedTime: savedScope.estimatedTime,
                    totalProgress: savedScope.totalProgress,
                    startDate: savedScope.startDate,
                    targetDate: savedScope.targetDate,
                    projectPath: this._projectPath
                };
            }
        }
        // 保存されたスコープがない場合は従来の方法で生成
        const estimatedTime = await this.estimateScope();
        const totalProgress = this.calculateTotalProgress();
        // 開始日と目標日を設定（存在しない場合は現在の日付から自動生成）
        let startDate = undefined;
        let targetDate = undefined;
        // 既存のスコープから日付情報を取得
        try {
            const config = await vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope', {});
            if (config) {
                // 文字列の場合はJSONとしてパース、オブジェクトの場合はそのまま使用
                const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
                if (parsedConfig.startDate) {
                    startDate = parsedConfig.startDate;
                }
                if (parsedConfig.targetDate) {
                    targetDate = parsedConfig.targetDate;
                }
            }
        }
        catch (error) {
            // 設定の読み込みに失敗した場合は何もしない
            logger_1.Logger.error('スコープ設定の読み込みに失敗しました', error);
        }
        // 日付が設定されていない場合は自動生成
        if (!startDate) {
            startDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
        }
        if (!targetDate) {
            // 推定時間から目標日を設定（単純に1日8時間で計算）
            const timeMatch = estimatedTime.match(/(\d+)(?:\-|\～)?(\d+)?/);
            let hours = 0;
            if (timeMatch) {
                if (timeMatch[2]) { // 範囲の場合は平均を取る
                    hours = (parseInt(timeMatch[1]) + parseInt(timeMatch[2])) / 2;
                }
                else {
                    hours = parseInt(timeMatch[1]);
                }
            }
            const days = Math.ceil(hours / 8);
            const targetDateObj = new Date();
            targetDateObj.setDate(targetDateObj.getDate() + days);
            targetDate = targetDateObj.toISOString().split('T')[0];
        }
        // 現在のスコープが存在しない場合は新規作成
        if (this._projectPath && !this._currentScopeId && this._items.length > 0) {
            // スコープを作成
            const scopeData = {
                id: `scope-${Date.now()}`,
                name: `スコープ ${new Date().toISOString().split('T')[0]}`,
                description: '手動作成されたスコープ',
                items: this._items,
                selectedIds: this._selectedIds,
                estimatedTime,
                totalProgress,
                startDate,
                targetDate,
                projectPath: this._projectPath
            };
            // CLAUDE.mdに保存
            if (this._markdownManager.saveScopeToClaudeMd(this._projectPath, scopeData)) {
                this._currentScopeId = scopeData.id;
                logger_1.Logger.info(`新規スコープをCLAUDE.mdに保存しました: ${scopeData.id}`);
            }
        }
        return {
            id: this._currentScopeId || null,
            items: this._items,
            selectedIds: this._selectedIds,
            estimatedTime,
            totalProgress,
            startDate,
            targetDate,
            projectPath: this._projectPath
        };
    }
    /**
     * 現在のスコープを再読み込み
     */
    reloadCurrentScope() {
        if (!this._projectPath || !this._currentScopeId) {
            return;
        }
        const scope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, this._currentScopeId);
        if (scope) {
            this._items = scope.items;
            this._selectedIds = scope.selectedIds;
        }
    }
    /**
     * モックアップから必要なファイル一覧を取得
     */
    async getRequiredFilesList(mockupHtml, framework = 'react') {
        try {
            if (!mockupHtml) {
                throw new Error('モックアップHTMLが提供されていません');
            }
            logger_1.Logger.info('モックアップからファイル一覧を抽出します');
            const prompt = `以下のモックアップHTMLから、実装に必要なファイル一覧を抽出してください。
フレームワークは${framework}を使用します。
返答はファイルパスのみの配列としてJSONフォーマットで返してください。

\`\`\`html
${mockupHtml}
\`\`\`

期待する出力形式:
\`\`\`json
["src/components/Login.jsx", "src/services/authService.js", ...]
\`\`\``;
            const response = await this._aiService.sendMessage(prompt, 'implementation');
            // レスポンスからJSON部分を抽出
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
            if (!jsonMatch || !jsonMatch[1]) {
                throw new Error('AIからの応答をパースできませんでした');
            }
            const files = JSON.parse(jsonMatch[1]);
            // 現在のスコープの選択済みアイテムに関連ファイルを追加
            if (this._projectPath && this._currentScopeId) {
                const scope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, this._currentScopeId);
                if (scope) {
                    let modified = false;
                    // 選択されている項目に関連ファイルを追加
                    for (const item of scope.items) {
                        if (scope.selectedIds.includes(item.id)) {
                            if (!item.relatedFiles) {
                                item.relatedFiles = [];
                            }
                            // 新しいファイルのみ追加
                            for (const file of files) {
                                if (!item.relatedFiles.includes(file)) {
                                    item.relatedFiles.push(file);
                                    modified = true;
                                }
                            }
                        }
                    }
                    // 変更があればスコープを保存
                    if (modified) {
                        this._markdownManager.saveScopeToClaudeMd(this._projectPath, scope);
                        // 内部状態を更新
                        this._items = scope.items;
                    }
                }
            }
            logger_1.Logger.info(`${files.length}個のファイルを抽出しました`);
            return files;
        }
        catch (error) {
            logger_1.Logger.error('必要なファイル一覧の抽出に失敗しました', error);
            throw error;
        }
    }
    /**
     * 選択されたアイテムに基づく実装計画を生成
     */
    async generateImplementationPlan() {
        try {
            const selectedItems = this.getSelectedItems();
            if (selectedItems.length === 0) {
                throw new Error('実装項目が選択されていません');
            }
            logger_1.Logger.info('実装計画を生成します');
            const prompt = `以下の実装項目に基づいて、実装計画を生成してください。
計画には以下を含めてください:
1. タスクの分解
2. 実装順序
3. 各タスクの所要時間見積り
4. テスト計画
5. 考えられるリスクと対策

選択された実装項目:
${JSON.stringify(selectedItems, null, 2)}`;
            const response = await this._aiService.sendMessage(prompt, 'implementation');
            // 生成された計画をスコープのノートに保存
            if (this._projectPath && this._currentScopeId) {
                const scope = this._markdownManager.getScopeFromClaudeMd(this._projectPath, this._currentScopeId);
                if (scope) {
                    // 選択されている最初の項目のメモに計画を保存
                    const firstSelected = scope.items.find(item => scope.selectedIds.includes(item.id));
                    if (firstSelected) {
                        firstSelected.notes = `## 実装計画\n\n${response}`;
                        this._markdownManager.saveScopeToClaudeMd(this._projectPath, scope);
                        // 内部状態を更新
                        this._items = scope.items;
                    }
                }
            }
            logger_1.Logger.info('実装計画の生成が完了しました');
            return response;
        }
        catch (error) {
            logger_1.Logger.error('実装計画の生成に失敗しました', error);
            throw error;
        }
    }
    /**
     * CLAUDE.mdに保存を完了し、ClaudeCodeに通知
     */
    async completeSelection() {
        // 現在のスコープを取得
        const scope = await this.getCurrentScope();
        if (!this._projectPath || !this._currentScopeId) {
            logger_1.Logger.error('プロジェクトパスまたはスコープIDが設定されていません');
            return false;
        }
        try {
            // スコープに完了通知
            this._markdownManager.notifyClaudeCodeOfScopeUpdate(this._projectPath, this._currentScopeId);
            return true;
        }
        catch (error) {
            logger_1.Logger.error('スコープ選択の完了通知に失敗しました', error);
            return false;
        }
    }
    /**
     * VSCode設定からスコープをインポート
     */
    async importFromVSCodeSettings() {
        if (!this._projectPath) {
            logger_1.Logger.error('プロジェクトパスが設定されていません');
            return false;
        }
        try {
            const result = this._markdownManager.importScopeFromVSCodeSettings(this._projectPath);
            if (result) {
                // 現在のスコープを再読み込み
                const scopes = this._markdownManager.getScopesFromClaudeMd(this._projectPath);
                if (scopes.length > 0) {
                    // 最後に追加されたスコープを使用
                    const latestScope = scopes[scopes.length - 1];
                    this._currentScopeId = latestScope.id;
                    this._items = latestScope.items;
                    this._selectedIds = latestScope.selectedIds;
                    logger_1.Logger.info(`VSCode設定からスコープをインポートしました: ${latestScope.id}`);
                    return true;
                }
            }
            return false;
        }
        catch (error) {
            logger_1.Logger.error('VSCode設定からのスコープインポートに失敗しました', error);
            return false;
        }
    }
}
exports.ScopeSelector = ScopeSelector;
//# sourceMappingURL=scopeSelector.js.map