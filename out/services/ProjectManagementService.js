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
exports.ProjectManagementService = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../utils/logger");
/**
 * プロジェクト管理サービス
 * プロジェクトの作成、更新、削除、一覧表示を担当
 */
class ProjectManagementService {
    /**
     * シングルトンインスタンスを取得
     */
    static getInstance() {
        if (!ProjectManagementService.instance) {
            ProjectManagementService.instance = new ProjectManagementService();
        }
        return ProjectManagementService.instance;
    }
    /**
     * コンストラクタ
     */
    constructor() {
        this.projects = new Map();
        // ストレージディレクトリの設定
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        this.storageDir = path.join(homeDir, '.appgenius-ai', 'projects');
        this.metadataFile = path.join(this.storageDir, 'projects.json');
        // ディレクトリの作成
        this.ensureDirectoryExists(this.storageDir);
        // 既存のプロジェクトをロード
        this.loadProjects();
        logger_1.Logger.info(`ProjectManagementService initialized: ${this.storageDir}`);
    }
    /**
     * プロジェクトの作成
     * @param projectData プロジェクトの初期データ
     * @returns 作成されたプロジェクトのID
     */
    async createProject(projectData) {
        try {
            // プロジェクトIDの生成
            const id = `project_${Date.now()}`;
            const projectDir = path.join(this.storageDir, id);
            // プロジェクトの内部ディレクトリの作成
            this.ensureDirectoryExists(projectDir);
            // 現在時刻を取得
            const now = Date.now();
            // プロジェクトメタデータを作成
            const project = {
                id,
                name: projectData.name,
                description: '',
                createdAt: now,
                updatedAt: now,
                path: projectData.path || '',
                status: 'active',
                phases: {
                    requirements: false,
                    design: false,
                    implementation: false,
                    testing: false,
                    deployment: false
                },
                metadata: {}
            };
            // プロジェクトパスが指定されている場合は、プロジェクトフォルダ構造を作成
            if (project.path) {
                try {
                    // プロジェクトフォルダを作成
                    this.ensureDirectoryExists(project.path);
                    // 新しいプロジェクト構造を作成
                    this.ensureDirectoryExists(path.join(project.path, 'docs'));
                    this.ensureDirectoryExists(path.join(project.path, 'mockups'));
                    // 基本的なドキュメントファイルを作成
                    this.createInitialDocuments(project.path);
                    // CLAUDE.mdファイルを生成
                    try {
                        const { ClaudeMdService } = await Promise.resolve().then(() => __importStar(require('../utils/ClaudeMdService')));
                        const claudeMdService = ClaudeMdService.getInstance();
                        await claudeMdService.generateClaudeMd(project.path, {
                            name: project.name,
                            description: ""
                        });
                        logger_1.Logger.info(`CLAUDE.md file created for project: ${id}`);
                    }
                    catch (e) {
                        logger_1.Logger.warn(`Failed to create CLAUDE.md file: ${e.message}`);
                    }
                }
                catch (e) {
                    logger_1.Logger.error(`Failed to create project structure: ${e.message}`);
                }
            }
            // メモリ上のマップに保存
            this.projects.set(id, project);
            // メタデータファイルの更新
            await this.saveMetadata();
            logger_1.Logger.info(`Project created: ${id}`);
            // イベントバスが利用可能ならイベントを発火
            try {
                // 動的インポートを使用してAppGeniusEventBusをロード
                const { AppGeniusEventBus, AppGeniusEventType } = await Promise.resolve().then(() => __importStar(require('./AppGeniusEventBus')));
                const eventBus = AppGeniusEventBus.getInstance();
                eventBus.emit(AppGeniusEventType.PROJECT_CREATED, project, 'ProjectManagementService');
            }
            catch (e) {
                // イベントバスが利用できなくても処理は続行
                logger_1.Logger.debug('AppGeniusEventBus not available, skipping event emission');
            }
            return id;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to create project: ${error.message}`);
            throw new Error(`プロジェクトの作成に失敗しました: ${error.message}`);
        }
    }
    /**
     * 初期ドキュメントファイルを作成
     * @param projectPath プロジェクトのパス
     */
    createInitialDocuments(projectPath) {
        try {
            // 必要最小限のディレクトリ構成のみを作成
            // docs/ディレクトリの作成
            this.ensureDirectoryExists(path.join(projectPath, 'docs'));
            // mockups/ディレクトリの作成
            this.ensureDirectoryExists(path.join(projectPath, 'mockups'));
            // デバッグディレクトリの作成は不要なため削除
            // ClaudeCode データ共有ディレクトリの作成
            this.ensureDirectoryExists(path.join(projectPath, '.claude_data'));
            this.ensureDirectoryExists(path.join(projectPath, '.claude_data', 'screenshots'));
            // 一時ファイル用ディレクトリの作成は不要なため削除
            // .gitignoreに.claude_data/を追加
            const gitignorePath = path.join(projectPath, '.gitignore');
            if (!fs.existsSync(gitignorePath)) {
                fs.writeFileSync(gitignorePath, '.claude_data/\n', 'utf8');
            }
            else {
                // 既存のgitignoreがあれば内容を読み取って必要な項目が含まれていなければ追加
                const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
                let updatedContent = gitignoreContent;
                if (!gitignoreContent.includes('.claude_data')) {
                    updatedContent += '\n.claude_data/\n';
                }
                if (updatedContent !== gitignoreContent) {
                    fs.writeFileSync(gitignorePath, updatedContent, 'utf8');
                }
            }
            // CURRENT_STATUSTEMPLATE.mdの作成は不要なため削除
        }
        catch (error) {
            logger_1.Logger.error(`Failed to create initial documents: ${error.message}`);
        }
    }
    /**
     * プロジェクトのロード
     */
    loadProjects() {
        try {
            if (!fs.existsSync(this.metadataFile)) {
                // メタデータファイルが存在しない場合は空のJSONファイルを作成
                fs.writeFileSync(this.metadataFile, JSON.stringify({ projects: [] }), 'utf8');
                return;
            }
            // 同期的にファイルを読み込むが、大量のプロジェクトがある場合も考慮して最適化
            const data = fs.readFileSync(this.metadataFile, 'utf8');
            if (!data || data.trim() === '') {
                logger_1.Logger.warn('Project metadata file is empty, initializing with empty projects list');
                fs.writeFileSync(this.metadataFile, JSON.stringify({ projects: [] }), 'utf8');
                return;
            }
            try {
                const metadata = JSON.parse(data);
                if (metadata.projects && Array.isArray(metadata.projects)) {
                    // Mapをクリアしてから再構築（重複を避ける）
                    this.projects.clear();
                    // 高速にプロジェクトをロード
                    metadata.projects.forEach((project) => {
                        if (project.id) {
                            this.projects.set(project.id, project);
                        }
                    });
                }
                logger_1.Logger.info(`Loaded ${this.projects.size} projects`);
            }
            catch (parseError) {
                // JSONパースエラーの場合、ファイルが破損している可能性がある
                logger_1.Logger.error(`Failed to parse projects metadata: ${parseError.message}`);
                // バックアップを作成して新しいファイルを作成
                const backupPath = `${this.metadataFile}.backup-${Date.now()}`;
                fs.copyFileSync(this.metadataFile, backupPath);
                logger_1.Logger.info(`Created backup of corrupted metadata file: ${backupPath}`);
                // 空のプロジェクトリストで初期化
                this.projects.clear();
                fs.writeFileSync(this.metadataFile, JSON.stringify({ projects: [] }), 'utf8');
            }
        }
        catch (error) {
            logger_1.Logger.error(`Failed to load projects: ${error.message}`);
            // エラー発生時は空のプロジェクトリストを使用
            this.projects.clear();
        }
    }
    /**
     * メタデータの保存
     */
    async saveMetadata() {
        try {
            const projectsArray = Array.from(this.projects.values());
            const metadata = { projects: projectsArray };
            fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
            logger_1.Logger.debug(`Saved metadata for ${projectsArray.length} projects`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to save metadata: ${error.message}`);
        }
    }
    /**
     * ディレクトリが存在することを確認し、存在しない場合は作成する
     * @param dirPath ディレクトリのパス
     */
    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
    /**
     * プロジェクトの取得
     * @param id プロジェクトID
     * @returns プロジェクト情報
     */
    getProject(id) {
        return this.projects.get(id);
    }
    /**
     * すべてのプロジェクトの取得
     * @returns すべてのプロジェクト
     */
    getAllProjects() {
        return Array.from(this.projects.values());
    }
    /**
     * 現在アクティブなプロジェクトを取得
     * @returns アクティブなプロジェクト情報
     */
    getActiveProject() {
        // 現在のところ、最後に更新されたプロジェクトをアクティブとみなす
        const projects = this.getAllProjects();
        if (projects.length === 0) {
            return null;
        }
        // updatedAtの降順でソート
        projects.sort((a, b) => b.updatedAt - a.updatedAt);
        return projects[0];
    }
    /**
     * プロジェクトの更新
     * @param id プロジェクトID
     * @param projectData 更新するプロジェクトデータ
     * @returns 更新されたプロジェクト
     */
    async updateProject(id, projectData) {
        try {
            const existingProject = this.projects.get(id);
            if (!existingProject) {
                throw new Error(`Project with ID ${id} not found`);
            }
            // 更新するフィールドをマージ
            const updatedProject = {
                ...existingProject,
                ...projectData,
                updatedAt: Date.now()
            };
            // メモリ上のマップを更新
            this.projects.set(id, updatedProject);
            // メタデータファイルの更新
            await this.saveMetadata();
            logger_1.Logger.info(`Project updated: ${id}`);
            return updatedProject;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to update project: ${error.message}`);
            throw new Error(`プロジェクトの更新に失敗しました: ${error.message}`);
        }
    }
    /**
     * プロジェクトの削除
     * @param id プロジェクトID
     * @returns 成功した場合はtrue
     */
    async deleteProject(id) {
        try {
            if (!this.projects.has(id)) {
                throw new Error(`Project with ID ${id} not found`);
            }
            // プロジェクトの内部ディレクトリを削除（オプション）
            const projectDir = path.join(this.storageDir, id);
            if (fs.existsSync(projectDir)) {
                // 再帰的に削除（注意: node.js 12.10.0以上が必要）
                fs.rmdirSync(projectDir, { recursive: true });
            }
            // メモリ上のマップから削除
            this.projects.delete(id);
            // メタデータファイルの更新
            await this.saveMetadata();
            logger_1.Logger.info(`Project deleted: ${id}`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`Failed to delete project: ${error.message}`);
            throw new Error(`プロジェクトの削除に失敗しました: ${error.message}`);
        }
    }
    /**
     * プロジェクトの検索
     * @param query 検索クエリ
     * @returns 検索結果
     */
    searchProjects(query) {
        try {
            const searchTerm = query.toLowerCase();
            return Array.from(this.projects.values()).filter(project => {
                // プロジェクト名と説明で検索
                return (project.name.toLowerCase().includes(searchTerm) ||
                    (project.description && project.description.toLowerCase().includes(searchTerm)));
            });
        }
        catch (error) {
            logger_1.Logger.error(`Failed to search projects: ${error.message}`);
            return [];
        }
    }
    /**
     * 指定したプロジェクトをアクティブに設定
     * @param projectId プロジェクトID
     * @returns 更新されたプロジェクト
     */
    async setActiveProject(projectId) {
        try {
            const project = this.getProject(projectId);
            if (!project) {
                throw new Error(`プロジェクトID ${projectId} が見つかりません`);
            }
            // プロジェクトの最終更新日時を更新することで、getActiveProject()メソッドで
            // 自動的に最新のプロジェクトとして選択されるようにする
            const updatedProject = await this.updateProject(projectId, {
                updatedAt: Date.now()
            });
            logger_1.Logger.info(`プロジェクトをアクティブに設定: ${projectId}`);
            return updatedProject;
        }
        catch (error) {
            logger_1.Logger.error(`プロジェクトのアクティブ設定に失敗: ${error.message}`);
            throw new Error(`プロジェクトのアクティブ設定に失敗しました: ${error.message}`);
        }
    }
    /**
     * パスでプロジェクトを検索して削除
     * @param projectPath プロジェクトのパス
     * @returns 成功した場合はtrue、プロジェクトが見つからない場合はfalse
     */
    async removeProjectByPath(projectPath) {
        try {
            // パスでプロジェクトを検索
            let projectId = null;
            // 比較のために正規化したパスを使用
            const normalizedPath = path.normalize(projectPath);
            for (const [id, project] of this.projects.entries()) {
                if (project.path && path.normalize(project.path) === normalizedPath) {
                    projectId = id;
                    break;
                }
            }
            if (!projectId) {
                logger_1.Logger.warn(`プロジェクトが見つかりません: パス ${projectPath}`);
                return false;
            }
            // 見つかったIDを使用してプロジェクトを削除
            return await this.deleteProject(projectId);
        }
        catch (error) {
            logger_1.Logger.error(`パスによるプロジェクト削除に失敗: ${error.message}`);
            return false;
        }
    }
    /**
     * IDでプロジェクトを削除
     * @param projectId プロジェクトID
     * @returns 成功した場合はtrue
     */
    async removeProjectById(projectId) {
        try {
            return await this.deleteProject(projectId);
        }
        catch (error) {
            logger_1.Logger.error(`IDによるプロジェクト削除に失敗: ${error.message}`);
            return false;
        }
    }
}
exports.ProjectManagementService = ProjectManagementService;
//# sourceMappingURL=ProjectManagementService.js.map