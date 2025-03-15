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
exports.MockupStorageService = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../utils/logger");
/**
 * モックアップの保存と取得を管理する共通ストレージサービス
 */
class MockupStorageService {
    /**
     * モックアップを名前で検索
     */
    getMockupByName(name) {
        return Array.from(this.mockups.values()).find(mockup => mockup.name === name || mockup.name === name.replace(/\.html$/, ''));
    }
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!MockupStorageService.instance) {
            MockupStorageService.instance = new MockupStorageService();
        }
        return MockupStorageService.instance;
    }
    /**
     * コンストラクタ
     */
    constructor() {
        this.mockups = new Map();
        this.storageDir = '';
        this._initialized = false;
        // 最後に初期化されたパスを追跡
        this._lastInitializedPath = '';
        // 初期化は外部から明示的に行うため、コンストラクタでは初期化しない
        logger_1.Logger.debug('MockupStorageService: インスタンス作成 (未初期化)');
    }
    /**
     * 初期化状態を確認
     * @returns 初期化済みかどうか
     */
    isInitialized() {
        return this._initialized;
    }
    /**
     * 現在のストレージパスを取得
     * @returns 初期化されたストレージパス
     */
    getStoragePath() {
        return this.storageDir;
    }
    /**
     * 指定されたプロジェクトパスでストレージを初期化
     * @param projectPath プロジェクトのパス
     */
    initializeWithPath(projectPath) {
        // 同じパスで初期化済みの場合はスキップ
        if (this._lastInitializedPath === projectPath) {
            logger_1.Logger.debug(`MockupStorageService: 既に同じパスで初期化済み: ${projectPath}`);
            return;
        }
        // プロジェクトディレクトリ内の'mockups'ディレクトリを使用
        this.storageDir = path.join(projectPath, 'mockups');
        // ディレクトリの作成
        this.ensureDirectoryExists(this.storageDir);
        // 既存のモックアップをロード
        this.loadMockups();
        this._initialized = true;
        this._lastInitializedPath = projectPath;
        logger_1.Logger.info(`MockupStorageService initialized with path: ${this.storageDir}`);
    }
    /**
     * モックアップの保存
     * @param content モックアップのコンテンツ
     * @param options 保存オプション
     * @returns 保存されたモックアップのID
     */
    async saveMockup(content, options = {}) {
        try {
            // モックアップIDの生成
            const id = options.id || `mockup_${Date.now()}`;
            const mockupDir = path.join(this.storageDir, id);
            // ディレクトリの作成
            this.ensureDirectoryExists(mockupDir);
            // HTMLファイルの保存
            const htmlPath = path.join(mockupDir, 'index.html');
            await fs.promises.writeFile(htmlPath, content.html, 'utf8');
            // CSSファイルの保存（存在する場合）
            let cssPath;
            if (content.css) {
                cssPath = path.join(mockupDir, 'style.css');
                await fs.promises.writeFile(cssPath, content.css, 'utf8');
            }
            // JSファイルの保存（存在する場合）
            let jsPath;
            if (content.js) {
                jsPath = path.join(mockupDir, 'script.js');
                await fs.promises.writeFile(jsPath, content.js, 'utf8');
            }
            // 現在時刻を取得
            const now = Date.now();
            // モックアップメタデータを作成
            const mockup = {
                id,
                name: options.name || `Mockup ${new Date(now).toLocaleString()}`,
                html: content.html,
                css: content.css,
                js: content.js,
                createdAt: now,
                updatedAt: now,
                sourceType: options.sourceType || 'manual',
                description: options.description
            };
            // メモリ上のマップに保存
            this.mockups.set(id, mockup);
            logger_1.Logger.info(`Mockup saved: ${id}`);
            return id;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to save mockup: ${error.message}`);
            throw new Error(`モックアップの保存に失敗しました: ${error.message}`);
        }
    }
    /**
     * モックアップの更新
     * @param id モックアップID
     * @param content 更新するコンテンツ
     * @returns 更新されたモックアップ
     */
    async updateMockup(id, content) {
        try {
            // 既存のモックアップを取得
            const mockup = this.mockups.get(id);
            if (!mockup) {
                logger_1.Logger.warn(`Mockup not found: ${id}`);
                return undefined;
            }
            // モックアップディレクトリのパス
            const mockupDir = path.join(this.storageDir, id);
            // HTMLの更新
            if (content.html) {
                mockup.html = content.html;
                const htmlPath = path.join(mockupDir, 'index.html');
                await fs.promises.writeFile(htmlPath, content.html, 'utf8');
            }
            // CSSの更新
            if (content.css) {
                mockup.css = content.css;
                const cssPath = path.join(mockupDir, 'style.css');
                await fs.promises.writeFile(cssPath, content.css, 'utf8');
            }
            // JSの更新
            if (content.js) {
                mockup.js = content.js;
                const jsPath = path.join(mockupDir, 'script.js');
                await fs.promises.writeFile(jsPath, content.js, 'utf8');
            }
            // 名前の更新
            if (content.name) {
                mockup.name = content.name;
            }
            // 説明の更新
            if (content.description) {
                mockup.description = content.description;
            }
            // 更新日時を設定
            mockup.updatedAt = Date.now();
            logger_1.Logger.info(`Mockup updated: ${id}`);
            return mockup;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to update mockup: ${error.message}`);
            throw new Error(`モックアップの更新に失敗しました: ${error.message}`);
        }
    }
    /**
     * モックアップの取得
     * @param id モックアップID
     * @returns モックアップデータ
     */
    getMockup(id) {
        return this.mockups.get(id);
    }
    /**
     * 全てのモックアップを取得
     * @returns モックアップの配列
     */
    getAllMockups() {
        return Array.from(this.mockups.values())
            .sort((a, b) => b.updatedAt - a.updatedAt); // 更新日時でソート
    }
    /**
     * 指定したソースタイプのモックアップを取得
     * @param sourceType ソースタイプ
     * @returns モックアップの配列
     */
    getMockupsBySourceType(sourceType) {
        return Array.from(this.mockups.values())
            .filter(mockup => mockup.sourceType === sourceType)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }
    /**
     * モックアップの削除
     * @param id モックアップID
     * @returns 削除が成功したかどうか
     */
    async deleteMockup(id) {
        try {
            // 存在確認
            if (!this.mockups.has(id)) {
                return false;
            }
            // メモリから削除
            this.mockups.delete(id);
            // ディレクトリのパス
            const mockupDir = path.join(this.storageDir, id);
            // ディレクトリが存在する場合は削除
            if (fs.existsSync(mockupDir)) {
                await this.deleteDirectory(mockupDir);
            }
            logger_1.Logger.info(`Mockup deleted: ${id}`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to delete mockup: ${error.message}`);
            return false;
        }
    }
    /**
     * モックアップのディスクからのロード
     */
    async loadMockups() {
        try {
            this.mockups.clear(); // 既存のモックアップをクリア
            // ディレクトリ内のモックアップをロード
            if (fs.existsSync(this.storageDir)) {
                // 1. まずstructured mockupをロード (mockup_ディレクトリ)
                const directories = fs.readdirSync(this.storageDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('mockup_'))
                    .map(dirent => dirent.name);
                for (const dir of directories) {
                    const mockupDir = path.join(this.storageDir, dir);
                    const htmlPath = path.join(mockupDir, 'index.html');
                    const cssPath = path.join(mockupDir, 'style.css');
                    const jsPath = path.join(mockupDir, 'script.js');
                    // HTMLファイルが存在するか確認
                    if (fs.existsSync(htmlPath)) {
                        const html = await fs.promises.readFile(htmlPath, 'utf8');
                        // CSSファイルの読み込み
                        let css;
                        if (fs.existsSync(cssPath)) {
                            css = await fs.promises.readFile(cssPath, 'utf8');
                        }
                        // JSファイルの読み込み
                        let js;
                        if (fs.existsSync(jsPath)) {
                            js = await fs.promises.readFile(jsPath, 'utf8');
                        }
                        // ディレクトリの作成日時を取得
                        const stats = fs.statSync(mockupDir);
                        const createdAt = stats.birthtimeMs;
                        const updatedAt = stats.mtimeMs;
                        // モックアップオブジェクトを作成
                        const mockup = {
                            id: dir,
                            name: `Mockup ${new Date(createdAt).toLocaleString()}`,
                            html,
                            css,
                            js,
                            createdAt,
                            updatedAt,
                            sourceType: 'imported', // ディレクトリから復元されたものはインポートとして扱う
                            status: 'review' // デフォルトのステータス
                        };
                        // マップに追加
                        this.mockups.set(dir, mockup);
                    }
                }
                // 2. 次にルートディレクトリのHTMLファイルをインポート
                const htmlFiles = fs.readdirSync(this.storageDir, { withFileTypes: true })
                    .filter(dirent => dirent.isFile() && (dirent.name.endsWith('.html') || dirent.name.endsWith('.htm')))
                    .filter(dirent => dirent.name !== 'metadata.json') // metadata.jsonを除外
                    .map(dirent => dirent.name);
                for (const htmlFile of htmlFiles) {
                    const htmlPath = path.join(this.storageDir, htmlFile);
                    const fileNameWithoutExt = htmlFile.replace(/\.[^/.]+$/, ''); // 拡張子を削除
                    // ファイル名自体をモックアップIDとして使用
                    const mockupId = fileNameWithoutExt;
                    // HTMLの内容を読み込む
                    const html = await fs.promises.readFile(htmlPath, 'utf8');
                    // ファイルの状態を取得
                    const stats = fs.statSync(htmlPath);
                    const createdAt = stats.birthtimeMs;
                    const updatedAt = stats.mtimeMs;
                    // モックアップオブジェクトを作成
                    const mockup = {
                        id: mockupId,
                        name: fileNameWithoutExt,
                        html,
                        createdAt,
                        updatedAt,
                        sourceType: 'imported',
                        description: `File: ${htmlPath}`,
                        status: 'review' // デフォルトのステータス
                    };
                    // マップに追加
                    this.mockups.set(mockupId, mockup);
                    logger_1.Logger.info(`Imported HTML file: ${htmlFile}`);
                }
                logger_1.Logger.info(`Loaded ${this.mockups.size} mockups from directory structure`);
            }
        }
        catch (error) {
            logger_1.Logger.error(`Failed to load mockups: ${error.message}`);
        }
    }
    /**
     * モックアップのステータスを更新
     * @param id モックアップID
     * @param status 新しいステータス
     * @returns 更新されたモックアップ、失敗時はundefined
     */
    async updateMockupStatus(id, status) {
        try {
            // モックアップの取得
            const mockup = this.mockups.get(id);
            if (!mockup) {
                logger_1.Logger.warn(`Mockup not found for status update: ${id}`);
                return undefined;
            }
            // ステータスを更新
            mockup.status = status;
            mockup.updatedAt = Date.now();
            logger_1.Logger.info(`Mockup status updated: ${id} -> ${status}`);
            return mockup;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to update mockup status: ${error.message}`);
            return undefined;
        }
    }
    /**
     * フィードバックを追加
     * @param id モックアップID
     * @param feedback フィードバックテキスト
     * @returns 更新されたモックアップ、失敗時はundefined
     */
    async addFeedback(id, feedback) {
        try {
            // モックアップの取得
            const mockup = this.mockups.get(id);
            if (!mockup) {
                logger_1.Logger.warn(`Mockup not found for adding feedback: ${id}`);
                return undefined;
            }
            // フィードバック配列の初期化
            if (!mockup.feedback) {
                mockup.feedback = [];
            }
            // フィードバックを追加
            mockup.feedback.push(feedback);
            mockup.updatedAt = Date.now();
            logger_1.Logger.info(`Feedback added to mockup: ${id}`);
            return mockup;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to add feedback: ${error.message}`);
            return undefined;
        }
    }
    /**
     * 実装メモを保存
     * @param id モックアップID
     * @param notes 実装メモテキスト
     * @returns 更新されたモックアップ、失敗時はundefined
     */
    async saveImplementationNotes(id, notes) {
        try {
            // モックアップの取得
            const mockup = this.mockups.get(id);
            if (!mockup) {
                logger_1.Logger.warn(`Mockup not found for saving implementation notes: ${id}`);
                return undefined;
            }
            // 実装メモを保存
            mockup.implementationNotes = notes;
            mockup.updatedAt = Date.now();
            logger_1.Logger.info(`Implementation notes saved for mockup: ${id}`);
            return mockup;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to save implementation notes: ${error.message}`);
            return undefined;
        }
    }
    /**
     * キューの状態を取得
     * @returns キュー状態オブジェクト
     */
    getQueueStatus() {
        const mockupList = Array.from(this.mockups.values());
        const pending = mockupList.filter(m => m.status === 'pending').length;
        const generating = mockupList.filter(m => m.status === 'generating').length;
        const completed = mockupList.filter(m => m.status && ['review', 'approved'].includes(m.status)).length;
        const total = mockupList.length;
        return { pending, generating, completed, total };
    }
    /**
     * ファイルパスからモックアップを取得または作成
     * @param filePath HTMLファイルパス
     * @returns モックアップオブジェクト
     */
    async getMockupByFilePath(filePath) {
        try {
            // 既に同じファイルパスに関連するモックアップが存在するか確認
            const existingMockup = Array.from(this.mockups.values()).find(mockup => mockup.description === `File: ${filePath}`);
            if (existingMockup) {
                return existingMockup;
            }
            // ファイルが存在するか確認
            if (!fs.existsSync(filePath)) {
                logger_1.Logger.error(`File not found: ${filePath}`);
                return null;
            }
            // ファイル名から情報を抽出
            const fileName = path.basename(filePath);
            const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // 拡張子を削除
            // HTMLの内容を読み込む
            const html = await fs.promises.readFile(filePath, 'utf8');
            // ファイルの状態を取得
            const stats = fs.statSync(filePath);
            const createdAt = stats.birthtimeMs;
            const updatedAt = stats.mtimeMs;
            // ファイル名自体をIDとして使用
            const mockupId = fileNameWithoutExt;
            // モックアップオブジェクトを作成
            const mockup = {
                id: mockupId,
                name: fileNameWithoutExt,
                html,
                createdAt,
                updatedAt,
                sourceType: 'imported',
                description: `File: ${filePath}`,
                status: 'review'
            };
            // マップに追加
            this.mockups.set(mockupId, mockup);
            logger_1.Logger.info(`Created mockup from file: ${filePath}`);
            return mockup;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to get mockup by file path: ${error.message}`);
            return null;
        }
    }
    /**
     * ファイルパスから直接モックアップを読み込んで表示
     * @param filePath HTMLファイルパス
     * @returns HTMLコンテンツ
     */
    async getHTMLContentFromFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                logger_1.Logger.error(`File not found: ${filePath}`);
                return null;
            }
            const html = await fs.promises.readFile(filePath, 'utf8');
            return html;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to read file: ${error.message}`);
            return null;
        }
    }
    /**
     * ディレクトリが存在することを確認し、なければ作成
     * @param dir ディレクトリパス
     */
    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    /**
     * ディレクトリを再帰的に削除
     * @param dir ディレクトリパス
     */
    async deleteDirectory(dir) {
        // Node.js v14.14.0以降であれば fs.promises.rm を使用できる
        if (fs.promises.rm) {
            await fs.promises.rm(dir, { recursive: true, force: true });
        }
        else {
            // 古いバージョンのNode.jsの場合は再帰的に削除
            const files = await fs.promises.readdir(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = await fs.promises.lstat(filePath);
                if (stat.isDirectory()) {
                    await this.deleteDirectory(filePath);
                }
                else {
                    await fs.promises.unlink(filePath);
                }
            }
            await fs.promises.rmdir(dir);
        }
    }
    /**
     * モックアップを再読み込み（ファイル変更検出時に使用）
     */
    async reloadMockups() {
        try {
            if (!this._initialized || !this.storageDir) {
                logger_1.Logger.warn('モックアップストレージが初期化されていません');
                return;
            }
            // 既存のモックアップを再読み込み
            await this.loadMockups();
            logger_1.Logger.debug('モックアップを再読み込みしました');
        }
        catch (error) {
            logger_1.Logger.error(`モックアップの再読み込みに失敗: ${error.message}`);
        }
    }
}
exports.MockupStorageService = MockupStorageService;
//# sourceMappingURL=mockupStorageService.js.map