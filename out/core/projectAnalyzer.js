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
exports.ProjectAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fileManager_1 = require("../utils/fileManager");
const logger_1 = require("../utils/logger");
class ProjectAnalyzer {
    constructor() { }
    /**
     * プロジェクト全体を分析し、構造と依存関係を返す
     */
    async analyzeProject(workspaceRoot) {
        try {
            // ワークスペースルートが指定されていない場合は現在のワークスペースを使用
            if (!workspaceRoot) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    throw new Error('プロジェクトが開かれていません');
                }
                workspaceRoot = workspaceFolders[0].uri.fsPath;
            }
            logger_1.Logger.info(`プロジェクト分析を開始: ${workspaceRoot}`);
            // プロジェクト構造を解析
            const structure = await this.buildProjectStructure(workspaceRoot);
            // 依存関係マップを構築
            const dependencies = await this.analyzeDependencies(structure);
            // プロジェクト統計情報を取得
            const stats = await this.collectProjectStats(structure);
            logger_1.Logger.info('プロジェクト分析が完了しました');
            return {
                structure,
                dependencies,
                stats
            };
        }
        catch (error) {
            logger_1.Logger.error('プロジェクト分析でエラーが発生しました', error);
            throw error;
        }
    }
    /**
     * 指定されたパスからプロジェクト構造ツリーを構築
     */
    async buildProjectStructure(rootPath) {
        const root = await this.buildDirectoryTree(rootPath);
        return { root };
    }
    /**
     * ディレクトリツリーを再帰的に構築
     */
    async buildDirectoryTree(dirPath) {
        try {
            const items = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            const dirName = path.basename(dirPath);
            const children = [];
            // `node_modules`や`.git`などは除外
            const ignoreDirs = ['node_modules', '.git', 'dist', 'out', 'build'];
            for (const [name, fileType] of items) {
                // 無視リストにあるディレクトリはスキップ
                if (fileType === vscode.FileType.Directory && ignoreDirs.includes(name)) {
                    continue;
                }
                const childPath = path.join(dirPath, name);
                if (fileType === vscode.FileType.Directory) {
                    // ディレクトリの場合は再帰的に処理
                    const subdirNode = await this.buildDirectoryTree(childPath);
                    children.push(subdirNode);
                }
                else if (fileType === vscode.FileType.File) {
                    // ファイルの場合は拡張子から言語を推測
                    const ext = path.extname(name).toLowerCase();
                    const language = this.getLanguageFromExtension(ext);
                    // ファイルサイズを取得
                    const fileUri = vscode.Uri.file(childPath);
                    const fileStat = await vscode.workspace.fs.stat(fileUri);
                    children.push({
                        name,
                        path: childPath,
                        type: 'file',
                        language,
                        size: fileStat.size
                    });
                }
            }
            return {
                name: dirName,
                path: dirPath,
                type: 'directory',
                children
            };
        }
        catch (error) {
            logger_1.Logger.error(`Error building directory tree for ${dirPath}`, error);
            // エラーが発生してもプロセスを続行できるように、最小限の情報を返す
            return {
                name: path.basename(dirPath),
                path: dirPath,
                type: 'directory',
                children: []
            };
        }
    }
    /**
     * ファイル拡張子から言語を推測
     */
    getLanguageFromExtension(ext) {
        const languageMap = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.jsx': 'React',
            '.tsx': 'React/TypeScript',
            '.html': 'HTML',
            '.css': 'CSS',
            '.scss': 'SCSS',
            '.less': 'LESS',
            '.json': 'JSON',
            '.md': 'Markdown',
            '.py': 'Python',
            '.java': 'Java',
            '.c': 'C',
            '.cpp': 'C++',
            '.cs': 'C#',
            '.go': 'Go',
            '.rb': 'Ruby',
            '.php': 'PHP',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.rs': 'Rust',
            '.dart': 'Dart',
            '.ex': 'Elixir',
            '.exs': 'Elixir',
            '.erl': 'Erlang',
            '.lua': 'Lua',
            '.pl': 'Perl',
            '.sh': 'Shell',
            '.yaml': 'YAML',
            '.yml': 'YAML',
            '.xml': 'XML',
            '.sql': 'SQL',
            '.vue': 'Vue',
            '.svelte': 'Svelte'
        };
        return languageMap[ext] || 'Other';
    }
    /**
     * ファイル間の依存関係を分析
     */
    async analyzeDependencies(structure) {
        const dependencies = {};
        // ファイルノードのフラット配列を取得
        const fileNodes = this.getAllFileNodes(structure.root);
        // JavaScript/TypeScriptファイルを処理
        const jstsFiles = fileNodes.filter(node => node.language === 'JavaScript' ||
            node.language === 'TypeScript' ||
            node.language === 'React' ||
            node.language === 'React/TypeScript');
        for (const fileNode of jstsFiles) {
            // ファイルの依存関係を分析
            dependencies[fileNode.path] = await this.analyzeFileDependencies(fileNode.path);
        }
        return dependencies;
    }
    /**
     * 単一ファイルの依存関係（インポート）を分析
     */
    async analyzeFileDependencies(filePath) {
        try {
            const content = await fileManager_1.FileManager.readFile(filePath);
            const deps = [];
            // import文のパターンを検出
            const importPattern = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = importPattern.exec(content)) !== null) {
                deps.push(match[1]);
            }
            // require文のパターンを検出
            const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
            while ((match = requirePattern.exec(content)) !== null) {
                deps.push(match[1]);
            }
            return deps;
        }
        catch (error) {
            logger_1.Logger.error(`Error analyzing dependencies for ${filePath}`, error);
            return [];
        }
    }
    /**
     * 全てのファイルノードを取得
     */
    getAllFileNodes(node) {
        if (node.type === 'file') {
            return [node];
        }
        if (!node.children) {
            return [];
        }
        return node.children.flatMap(child => this.getAllFileNodes(child));
    }
    /**
     * プロジェクトの統計情報を収集
     */
    async collectProjectStats(structure) {
        const fileNodes = this.getAllFileNodes(structure.root);
        // 言語ごとのファイル数をカウント
        const languageBreakdown = {};
        for (const fileNode of fileNodes) {
            const lang = fileNode.language || 'Other';
            languageBreakdown[lang] = (languageBreakdown[lang] || 0) + 1;
        }
        // ディレクトリ数をカウント
        const countDirectories = (node) => {
            if (node.type === 'file' || !node.children) {
                return 0;
            }
            return 1 + node.children.reduce((count, child) => count + countDirectories(child), 0);
        };
        const totalDirectories = countDirectories(structure.root);
        // 総行数を計算（サンプリング）
        let lineCount = 0;
        // 最大100ファイルまでサンプリング
        const sampleFiles = fileNodes.slice(0, 100);
        for (const fileNode of sampleFiles) {
            try {
                const content = await fileManager_1.FileManager.readFile(fileNode.path);
                lineCount += content.split('\n').length;
            }
            catch (error) {
                // エラーは無視して続行
            }
        }
        // サンプリングした場合は全体を推定
        if (fileNodes.length > sampleFiles.length) {
            lineCount = Math.floor(lineCount * (fileNodes.length / sampleFiles.length));
        }
        return {
            totalFiles: fileNodes.length,
            totalDirectories,
            languageBreakdown,
            lineCount
        };
    }
}
exports.ProjectAnalyzer = ProjectAnalyzer;
//# sourceMappingURL=projectAnalyzer.js.map