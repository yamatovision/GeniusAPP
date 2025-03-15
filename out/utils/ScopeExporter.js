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
exports.ScopeExporter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const PlatformManager_1 = require("./PlatformManager");
const logger_1 = require("./logger");
const MessageBroker_1 = require("./MessageBroker");
const types_1 = require("../types");
/**
 * スコープエクスポータークラス
 * スコープ情報の標準化と永続化を提供
 */
class ScopeExporter {
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!ScopeExporter.instance) {
            ScopeExporter.instance = new ScopeExporter();
        }
        return ScopeExporter.instance;
    }
    /**
     * コンストラクタ
     */
    constructor() {
        // スコープ保存ディレクトリのパスを構築
        const platformManager = PlatformManager_1.PlatformManager.getInstance();
        this.scopesDirPath = platformManager.getTempDirectory('scopes');
        // ディレクトリが存在しない場合は作成
        if (!fs.existsSync(this.scopesDirPath)) {
            fs.mkdirSync(this.scopesDirPath, { recursive: true });
        }
        logger_1.Logger.debug(`ScopeExporter initialized with directory: ${this.scopesDirPath}`);
    }
    /**
     * スコープを標準化して保存
     */
    exportScope(scope) {
        try {
            // スコープIDが存在しない場合は生成
            const scopeId = scope.id || `scope-${Date.now()}-${(0, uuid_1.v4)().substring(0, 8)}`;
            // スコープデータを標準化
            const standardizedScope = {
                id: scopeId,
                name: scope.name || `スコープ ${scopeId.substring(0, 8)}`,
                description: scope.description || '',
                projectPath: scope.projectPath || '',
                requirements: Array.isArray(scope.requirements) ? scope.requirements : [],
                items: this.standardizeSelectedItems(scope),
                selectedIds: Array.isArray(scope.selectedIds) ? scope.selectedIds : [],
                estimatedTime: scope.estimatedTime || "0",
                totalProgress: scope.totalProgress || 0,
                startDate: scope.startDate || new Date().toISOString().split('T')[0],
                targetDate: scope.targetDate || '',
                created: Date.now(),
                updated: Date.now()
            };
            // スコープファイルのパスを構築
            const scopeFilePath = this.getScopeFilePath(scopeId);
            // スコープをファイルに書き込む
            fs.writeFileSync(scopeFilePath, JSON.stringify(standardizedScope, null, 2), 'utf8');
            logger_1.Logger.debug(`Scope exported: ${scopeId}`);
            // メッセージブローカーを通じてスコープ作成メッセージを送信
            try {
                const messageBroker = MessageBroker_1.MessageBroker.getInstance();
                messageBroker.sendMessage(MessageBroker_1.MessageType.SCOPE_CREATE, {
                    scopeId,
                    scopeFilePath
                });
            }
            catch (error) {
                logger_1.Logger.warn('Failed to send scope creation message', error);
            }
            return scopeFilePath;
        }
        catch (error) {
            logger_1.Logger.error('Failed to export scope', error);
            throw error;
        }
    }
    /**
     * 選択された項目を標準化
     */
    standardizeSelectedItems(scope) {
        // 選択された項目がない場合は空配列を返す
        if (!scope.items && !scope.selectedItems) {
            return [];
        }
        // 通常のitems形式を優先
        if (Array.isArray(scope.items)) {
            return scope.items.map((item) => ({
                id: item.id || (0, uuid_1.v4)(),
                title: item.title || 'タイトルなし',
                description: item.description || '',
                completed: !!item.completed,
                status: item.status || (item.completed ? types_1.ScopeItemStatus.COMPLETED : types_1.ScopeItemStatus.PENDING),
                progress: item.progress || (item.completed ? 100 : 0),
                priority: item.priority || 'medium',
                complexity: item.complexity || 'medium',
                dependencies: item.dependencies || [],
                estimatedHours: item.estimatedHours || 0,
                relatedFiles: item.relatedFiles || []
            }));
        }
        // 後方互換性のためselectedItemsもサポート
        if (Array.isArray(scope.selectedItems)) {
            return scope.selectedItems.map((item) => ({
                id: item.id || (0, uuid_1.v4)(),
                title: item.title || 'タイトルなし',
                description: item.description || '',
                completed: !!item.completed,
                status: item.completed ? types_1.ScopeItemStatus.COMPLETED : types_1.ScopeItemStatus.PENDING,
                progress: item.completed ? 100 : 0,
                priority: item.priority || 'medium',
                complexity: item.complexity || 'medium',
                dependencies: item.dependencies || [],
                estimatedHours: item.estimatedHours || 0,
                relatedFiles: item.relatedFiles || []
            }));
        }
        // 選択された項目IDと全項目から選択された項目を抽出
        if (Array.isArray(scope.selectedIds) && Array.isArray(scope.items)) {
            return scope.items
                .filter((item) => scope.selectedIds.includes(item.id))
                .map((item) => ({
                id: item.id || (0, uuid_1.v4)(),
                title: item.title || 'タイトルなし',
                description: item.description || '',
                completed: !!item.completed,
                status: item.status || (item.completed ? types_1.ScopeItemStatus.COMPLETED : types_1.ScopeItemStatus.PENDING),
                progress: item.progress || (item.completed ? 100 : 0),
                priority: item.priority || 'medium',
                complexity: item.complexity || 'medium',
                dependencies: item.dependencies || [],
                estimatedHours: item.estimatedHours || 0,
                relatedFiles: item.relatedFiles || []
            }));
        }
        return [];
    }
    /**
     * スコープを読み込む
     */
    importScope(scopeIdOrPath) {
        try {
            // パスかIDかを判断
            const scopeFilePath = scopeIdOrPath.endsWith('.json')
                ? scopeIdOrPath
                : this.getScopeFilePath(scopeIdOrPath);
            // ファイルが存在するか確認
            if (!fs.existsSync(scopeFilePath)) {
                logger_1.Logger.warn(`Scope file not found: ${scopeFilePath}`);
                return null;
            }
            // スコープファイルを読み込む
            const scopeJson = fs.readFileSync(scopeFilePath, 'utf8');
            const scope = JSON.parse(scopeJson);
            logger_1.Logger.debug(`Scope imported: ${scope.id}`);
            return scope;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to import scope: ${scopeIdOrPath}`, error);
            return null;
        }
    }
    /**
     * スコープファイルのパスを取得
     */
    getScopeFilePath(scopeId) {
        return path.join(this.scopesDirPath, `${scopeId}.json`);
    }
    /**
     * 利用可能なすべてのスコープIDを取得
     */
    getAvailableScopeIds() {
        try {
            // スコープディレクトリ内のすべてのJSONファイルを取得
            const files = fs.readdirSync(this.scopesDirPath).filter(file => file.endsWith('.json'));
            // ファイル名からスコープIDを抽出
            return files.map(file => file.replace('.json', ''));
        }
        catch (error) {
            logger_1.Logger.error('Failed to get available scope IDs', error);
            return [];
        }
    }
    /**
     * 利用可能なすべてのスコープを取得
     */
    getAvailableScopes() {
        try {
            // 利用可能なすべてのスコープIDを取得
            const scopeIds = this.getAvailableScopeIds();
            // 各スコープを読み込む
            return scopeIds
                .map(id => this.importScope(id))
                .filter((scope) => scope !== null);
        }
        catch (error) {
            logger_1.Logger.error('Failed to get available scopes', error);
            return [];
        }
    }
    /**
     * スコープを削除
     */
    deleteScope(scopeId) {
        try {
            // スコープファイルのパスを取得
            const scopeFilePath = this.getScopeFilePath(scopeId);
            // ファイルが存在するか確認
            if (!fs.existsSync(scopeFilePath)) {
                logger_1.Logger.warn(`Scope file not found: ${scopeFilePath}`);
                return false;
            }
            // スコープファイルを削除
            fs.unlinkSync(scopeFilePath);
            logger_1.Logger.debug(`Scope deleted: ${scopeId}`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to delete scope: ${scopeId}`, error);
            return false;
        }
    }
    /**
     * プロジェクトパスが有効かどうかを確認
     */
    isValidProjectPath(projectPath) {
        try {
            // パスが存在するか確認
            if (!fs.existsSync(projectPath)) {
                return false;
            }
            // ディレクトリかどうか確認
            const stats = fs.statSync(projectPath);
            return stats.isDirectory();
        }
        catch (error) {
            return false;
        }
    }
    /**
     * スコープをコマンドラインに引き継ぐためのコマンドを生成
     */
    generateCliCommand(scopeId) {
        // スコープファイルのパスを取得
        const scopeFilePath = this.getScopeFilePath(scopeId);
        // スコープを読み込む
        const scope = this.importScope(scopeId);
        if (!scope) {
            return '';
        }
        // CLIコマンドを構築（ClaudeCodeを使用）
        return `claude --scope=${scopeId} "${path.join(scope.projectPath, 'CLAUDE.md')}"`;
    }
}
exports.ScopeExporter = ScopeExporter;
//# sourceMappingURL=ScopeExporter.js.map