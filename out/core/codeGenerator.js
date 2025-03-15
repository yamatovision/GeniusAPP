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
exports.CodeGenerator = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fileManager_1 = require("../utils/fileManager");
const logger_1 = require("../utils/logger");
const projectAnalyzer_1 = require("./projectAnalyzer");
class CodeGenerator {
    constructor(aiService) {
        this.aiService = aiService;
        this.projectAnalyzer = new projectAnalyzer_1.ProjectAnalyzer();
    }
    /**
     * コードを生成する
     * @param options コード生成オプション
     */
    async generateCode(options) {
        try {
            logger_1.Logger.info(`コード生成を開始: ${options.language}, ${options.description}`);
            // ターゲットディレクトリの設定
            const targetDir = options.targetDir || await this.determineTargetDirectory();
            if (!targetDir) {
                throw new Error('ターゲットディレクトリが指定されていません');
            }
            // プロジェクト構造を分析してコンテキストを強化
            const projectStructure = await this.getProjectContext(targetDir, options.contextFiles);
            // AIサービスにプロンプトを送信
            const prompt = this.buildCodeGenerationPrompt(options, projectStructure, targetDir);
            const aiResponse = await this.aiService.sendMessage(prompt, 'implementation');
            // AIレスポンスからファイル情報を抽出
            const generatedFiles = await this.parseGeneratedCode(aiResponse, targetDir);
            // コード生成を完了する
            return {
                files: generatedFiles,
                summary: `${generatedFiles.length}個のファイルが生成されました`
            };
        }
        catch (error) {
            logger_1.Logger.error('コード生成中にエラーが発生しました', error);
            throw error;
        }
    }
    /**
     * AIレスポンスからファイル情報を抽出して保存
     */
    async parseGeneratedCode(aiResponse, targetDir) {
        // コードブロックのパターン
        const codeBlockPattern = /```([a-zA-Z]+)?\s*(?:\/\/\s*([^\n]+))?\s*\n([\s\S]*?)```/g;
        const filePattern = /^ *([^\n]+)\s*$/m;
        const generatedFiles = [];
        let match;
        while ((match = codeBlockPattern.exec(aiResponse)) !== null) {
            const language = match[1] || 'text';
            const comment = match[2] || '';
            const content = match[3];
            // コメントからファイルパスを抽出
            let filePath = '';
            const fileMatch = filePattern.exec(comment);
            if (fileMatch) {
                filePath = fileMatch[1].trim();
            }
            else {
                // ファイル名が見つからない場合は言語に基づいてデフォルト名を生成
                const ext = this.getFileExtensionFromLanguage(language);
                filePath = `generated_${Date.now()}.${ext}`;
            }
            // 相対パスを絶対パスに変換
            if (!path.isAbsolute(filePath)) {
                filePath = path.join(targetDir, filePath);
            }
            // ディレクトリが存在することを確認
            const dir = path.dirname(filePath);
            if (!await fileManager_1.FileManager.directoryExists(dir)) {
                await fileManager_1.FileManager.createDirectory(dir);
            }
            // ファイルを保存
            let isCreated = true;
            if (await fileManager_1.FileManager.fileExists(filePath)) {
                // 既存ファイルの場合は確認ダイアログを表示
                const result = await vscode.window.showWarningMessage(`ファイル "${path.basename(filePath)}" は既に存在します。上書きしますか？`, { modal: true }, '上書き', 'スキップ');
                if (result !== '上書き') {
                    isCreated = false;
                }
            }
            if (isCreated) {
                await fileManager_1.FileManager.writeFile(filePath, content);
                logger_1.Logger.debug(`Generated file: ${filePath}`);
            }
            generatedFiles.push({
                path: filePath,
                content,
                language,
                isCreated
            });
        }
        return generatedFiles;
    }
    /**
     * コード生成のプロンプトを構築
     */
    buildCodeGenerationPrompt(options, projectStructure, targetDir) {
        // コンテキストファイルの内容を取得
        const contextFiles = options.contextFiles || [];
        let contextContent = '';
        // プロンプトを構築
        let prompt = `あなたはAppGenius AIのコード生成エンジンです。
以下の要件に基づいてコードを生成してください。

要件:
- 言語: ${options.language}
${options.framework ? `- フレームワーク: ${options.framework}` : ''}
${options.pattern ? `- パターン: ${options.pattern}` : ''}
- 説明: ${options.description}
- ターゲットディレクトリ: ${targetDir}

プロジェクト構造:
${JSON.stringify(projectStructure, null, 2)}

${contextContent}

コードの生成規則:
1. 各ファイルのコードは\`\`\`言語 //ファイルパス\`\`\`の形式でマークダウンコードブロックで囲んでください
2. ファイルパスは${targetDir}からの相対パスで指定してください
3. コードはプロジェクトの既存のスタイルに合わせてください
4. エラー処理とコメントを適切に含めてください
5. テストコードがある場合は対応するテストも生成してください

バックエンド構造の生成規則:
1. バックエンドは各機能ごとに以下の構造で生成してください:
   - controllers/ - 各機能のコントローラーを配置
   - services/ - 各機能のビジネスロジックを配置
   - routes/ - 各機能のルート定義を配置
   - models/ - データモデル定義を配置
   - middlewares/ - ミドルウェアを配置
2. 各機能は独立したモジュールとして実装してください
3. クリーンアーキテクチャの原則に従ってください

例:
\`\`\`typescript // controllers/user.controller.ts
export class UserController {
  constructor(private userService: UserService) {}
  
  async getUsers(req, res) {
    // ユーザー一覧を取得
    const users = await this.userService.getUsers();
    return res.json(users);
  }
}
\`\`\`

\`\`\`typescript // services/user.service.ts
export class UserService {
  async getUsers() {
    // ユーザー一覧を取得するビジネスロジック
    return [...];
  }
}
\`\`\`

\`\`\`typescript // routes/user.routes.ts
export function setupUserRoutes(app) {
  const controller = new UserController(new UserService());
  app.get('/api/users', controller.getUsers);
}
\`\`\`

生成してください。
`;
        return prompt;
    }
    /**
     * プロジェクトのコンテキスト情報を取得
     */
    async getProjectContext(targetDir, contextFiles) {
        try {
            // targetDirに関連するプロジェクト構造を分析
            const analysis = await this.projectAnalyzer.analyzeProject(targetDir);
            // コンテキストファイルがあれば内容を読み込み
            if (contextFiles && contextFiles.length > 0) {
                for (const filePath of contextFiles) {
                    // ファイルの内容をコンテキストに追加
                    await fileManager_1.FileManager.readFile(filePath);
                }
            }
            return analysis.structure;
        }
        catch (error) {
            logger_1.Logger.error('プロジェクトコンテキスト取得でエラーが発生しました', error);
            // 最小限の構造を返す
            return {
                root: {
                    name: path.basename(targetDir),
                    path: targetDir,
                    type: 'directory',
                    children: []
                }
            };
        }
    }
    /**
     * ターゲットディレクトリを決定する
     */
    async determineTargetDirectory() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('ワークスペースが開かれていません');
        }
        // 選択中のエディタからディレクトリを推測
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            return path.dirname(activeEditor.document.uri.fsPath);
        }
        // ワークスペースのルートを使用
        return workspaceFolders[0].uri.fsPath;
    }
    /**
     * 言語名からファイル拡張子を取得
     */
    getFileExtensionFromLanguage(language) {
        const languageMap = {
            'typescript': 'ts',
            'javascript': 'js',
            'jsx': 'jsx',
            'tsx': 'tsx',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'less': 'less',
            'json': 'json',
            'markdown': 'md',
            'python': 'py',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'csharp': 'cs',
            'go': 'go',
            'ruby': 'rb',
            'php': 'php',
            'swift': 'swift',
            'kotlin': 'kt',
            'rust': 'rs',
            'dart': 'dart',
            'elixir': 'ex',
            'erlang': 'erl',
            'lua': 'lua',
            'perl': 'pl',
            'shell': 'sh',
            'bash': 'sh',
            'yaml': 'yaml',
            'yml': 'yml',
            'xml': 'xml',
            'sql': 'sql',
            'vue': 'vue',
            'svelte': 'svelte'
        };
        // 小文字に変換してマッピング
        const normalizedLanguage = language.toLowerCase();
        return languageMap[normalizedLanguage] || 'txt';
    }
}
exports.CodeGenerator = CodeGenerator;
//# sourceMappingURL=codeGenerator.js.map