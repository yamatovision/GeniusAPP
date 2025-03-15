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
exports.CodeEditor = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fileManager_1 = require("../../utils/fileManager");
const logger_1 = require("../../utils/logger");
const projectAnalyzer_1 = require("../../core/projectAnalyzer");
class CodeEditor {
    constructor(aiService) {
        this.aiService = aiService;
        this.projectAnalyzer = new projectAnalyzer_1.ProjectAnalyzer();
    }
    /**
     * 既存コードを編集する
     * @param options コード編集オプション
     */
    async editCode(options) {
        try {
            logger_1.Logger.info(`コード編集を開始: ${options.operation}, ${options.filePath}`);
            // ファイルが存在するか確認
            if (!await fileManager_1.FileManager.fileExists(options.filePath)) {
                throw new Error(`ファイル ${options.filePath} が見つかりません`);
            }
            // ファイル内容を読み込む
            const fileContent = await fileManager_1.FileManager.readFile(options.filePath);
            if (!fileContent.trim()) {
                throw new Error(`ファイル ${options.filePath} は空です`);
            }
            // プロジェクト構造を分析してコンテキストを強化
            const projectStructure = await this.getProjectContext(path.dirname(options.filePath), options.contextFiles);
            // AIサービスにプロンプトを送信
            const prompt = this.buildCodeEditPrompt(options, fileContent, projectStructure);
            const aiResponse = await this.aiService.sendMessage(prompt, 'implementation');
            // AIレスポンスから提案された変更を抽出
            const suggestions = this.parseCodeSuggestions(aiResponse, fileContent);
            return suggestions;
        }
        catch (error) {
            logger_1.Logger.error('コード編集中にエラーが発生しました', error);
            throw error;
        }
    }
    /**
     * リファクタリングを行う
     * @param filePath ターゲットファイルパス
     * @param description リファクタリングの説明
     */
    async refactorCode(filePath, description) {
        return this.editCode({
            filePath,
            description,
            operation: 'refactor'
        });
    }
    /**
     * コードを最適化する
     * @param filePath ターゲットファイルパス
     * @param description 最適化の説明
     */
    async optimizeCode(filePath, description) {
        return this.editCode({
            filePath,
            description,
            operation: 'optimize'
        });
    }
    /**
     * バグを修正する
     * @param filePath ターゲットファイルパス
     * @param description バグの説明
     */
    async fixCode(filePath, description) {
        return this.editCode({
            filePath,
            description,
            operation: 'fix'
        });
    }
    /**
     * 新機能を追加する
     * @param filePath ターゲットファイルパス
     * @param description 機能の説明
     */
    async addFeature(filePath, description) {
        return this.editCode({
            filePath,
            description,
            operation: 'add'
        });
    }
    /**
     * AIレスポンスから提案されたコード変更を抽出
     */
    parseCodeSuggestions(aiResponse, originalCode) {
        const suggestions = [];
        const lines = originalCode.split('\n');
        // コードブロックのパターン
        const codeBlockPattern = /```(?:diff)?\s*\n([\s\S]*?)```/g;
        const suggestionPattern = /(.*?)→(.*?)(?:\n|$)/g;
        // まず、AIの全体的な説明を抽出
        const explanationMatch = aiResponse.match(/^([\s\S]*?)(?:```|変更点:|提案:)/);
        const generalExplanation = explanationMatch ? explanationMatch[1].trim() : '';
        // コードブロックをすべて抽出
        let diffBlocks = [];
        let match;
        while ((match = codeBlockPattern.exec(aiResponse)) !== null) {
            diffBlocks.push(match[1]);
        }
        // コードブロックがない場合は、テキスト内から直接変更提案を探す
        if (diffBlocks.length === 0) {
            const plainSuggestionPattern = /変更点:|提案:([\s\S]*?)(?:\n\n|$)/g;
            while ((match = plainSuggestionPattern.exec(aiResponse)) !== null) {
                diffBlocks.push(match[1]);
            }
        }
        // すべての差分ブロックを処理
        for (const block of diffBlocks) {
            // Line Nに対する変更提案パターン
            const linePattern = /Line (\d+)(?:-(\d+))?: (.*?) → (.*?)(?:\n|$)/gi;
            while ((match = linePattern.exec(block)) !== null) {
                const startLine = parseInt(match[1]) - 1; // 0-indexedに変換
                const endLine = match[2] ? parseInt(match[2]) - 1 : startLine;
                const originalText = match[3];
                const newText = match[4];
                suggestions.push({
                    original: originalText,
                    suggested: newText,
                    explanation: generalExplanation,
                    lineStart: startLine,
                    lineEnd: endLine
                });
            }
            // より自由形式の提案パターン
            const freeFormPattern = /(\d+)(?:-(\d+))?: (.*?) → (.*?)(?:\n|$)/gi;
            while ((match = freeFormPattern.exec(block)) !== null) {
                const startLine = parseInt(match[1]) - 1;
                const endLine = match[2] ? parseInt(match[2]) - 1 : startLine;
                const originalText = match[3];
                const newText = match[4];
                suggestions.push({
                    original: originalText,
                    suggested: newText,
                    explanation: generalExplanation,
                    lineStart: startLine,
                    lineEnd: endLine
                });
            }
            // それでも見つからない場合は、コンテキスト検索を試みる
            if (suggestions.length === 0) {
                const contexts = block.split('\n\n');
                for (const context of contexts) {
                    if (context.includes('→')) {
                        const parts = context.split('→');
                        const oldCode = parts[0].trim();
                        const newCode = parts.slice(1).join('→').trim();
                        // 元のコードでコンテキストを検索
                        const lineIndex = this.findContextInCode(lines, oldCode);
                        if (lineIndex >= 0) {
                            suggestions.push({
                                original: oldCode,
                                suggested: newCode,
                                explanation: generalExplanation,
                                lineStart: lineIndex,
                                lineEnd: lineIndex + oldCode.split('\n').length - 1
                            });
                        }
                    }
                }
            }
        }
        // それでも見つからない場合は、単一の提案として全体を返す
        if (suggestions.length === 0 && aiResponse.includes('```')) {
            // 新しい実装全体として提案
            const fullCodeMatch = aiResponse.match(/```(?:\w+)?\s*\n([\s\S]*?)```/);
            if (fullCodeMatch) {
                suggestions.push({
                    original: originalCode,
                    suggested: fullCodeMatch[1],
                    explanation: generalExplanation,
                    lineStart: 0,
                    lineEnd: lines.length - 1
                });
            }
        }
        return suggestions;
    }
    /**
     * コードの中からコンテキストを検索する
     */
    findContextInCode(lines, context) {
        const contextLines = context.split('\n');
        if (contextLines.length === 0) {
            return -1;
        }
        // 単一行の場合は単純に検索
        if (contextLines.length === 1) {
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(contextLines[0])) {
                    return i;
                }
            }
            return -1;
        }
        // 複数行の場合は連続したマッチを探す
        for (let i = 0; i <= lines.length - contextLines.length; i++) {
            let matched = true;
            for (let j = 0; j < contextLines.length; j++) {
                if (!lines[i + j].includes(contextLines[j])) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                return i;
            }
        }
        return -1;
    }
    /**
     * コード編集のプロンプトを構築
     */
    buildCodeEditPrompt(options, fileContent, projectStructure) {
        const fileName = path.basename(options.filePath);
        const fileExt = path.extname(options.filePath);
        const language = this.getLanguageFromExtension(fileExt);
        let operationDescription = '';
        switch (options.operation) {
            case 'refactor':
                operationDescription = 'コードのリファクタリングを行い、より読みやすく保守しやすい構造にしてください。';
                break;
            case 'optimize':
                operationDescription = 'コードの最適化を行い、パフォーマンスを向上させてください。';
                break;
            case 'fix':
                operationDescription = '以下の問題を修正してください: ' + options.description;
                break;
            case 'add':
                operationDescription = '次の機能を追加してください: ' + options.description;
                break;
            case 'modify':
                operationDescription = '次のように変更してください: ' + options.description;
                break;
        }
        // プロンプトを構築
        let prompt = `あなたはAppGenius AIのコード編集エンジンです。
次のファイルを編集してください：${fileName}

操作: ${options.operation}
${operationDescription}

言語: ${language}

現在のコード:
\`\`\`${language}
${fileContent}
\`\`\`

プロジェクト構造:
${JSON.stringify(projectStructure, null, 2)}

編集ガイドライン:
1. ファイルの主要な目的と構造を維持してください
2. コーディング規約を尊重してください
3. 既存のライブラリとインポートを活用してください
4. 変更は必要最小限にしてください
5. 変更部分を明確に特定できるよう、変更前→変更後の形式で示してください
6. ファイル内の行番号を参照してください (例: Line 10-15: ... → ...)

出力形式：
- 提案した変更の説明
- 変更点のリスト (行番号を含む)
- 必要に応じてコードブロック内に変更後の全体または部分的なコードを含めてください
`;
        return prompt;
    }
    /**
     * ファイル拡張子から言語を取得
     */
    getLanguageFromExtension(extension) {
        const extMap = {
            '.ts': 'typescript',
            '.js': 'javascript',
            '.jsx': 'jsx',
            '.tsx': 'tsx',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.json': 'json',
            '.md': 'markdown',
            '.py': 'python',
            '.java': 'java',
            '.c': 'c',
            '.cpp': 'cpp',
            '.cs': 'csharp',
            '.go': 'go',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.rs': 'rust',
            '.dart': 'dart'
        };
        return extMap[extension.toLowerCase()] || 'plaintext';
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
            return analysis;
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
     * コード編集を適用する
     * @param filePath 編集対象ファイルパス
     * @param suggestions 提案された変更
     */
    async applyCodeEdits(filePath, suggestions) {
        try {
            logger_1.Logger.info(`コード編集を適用: ${filePath}`);
            if (suggestions.length === 0) {
                return false;
            }
            // ファイル内容を読み込む
            const fileContent = await fileManager_1.FileManager.readFile(filePath);
            if (!fileContent.trim()) {
                throw new Error(`ファイル ${filePath} は空です`);
            }
            // ファイルを開く
            await fileManager_1.FileManager.openFile(filePath);
            const document = vscode.window.activeTextEditor?.document;
            if (!document) {
                throw new Error('ファイルを開けませんでした');
            }
            // ファイル全体の変更
            if (suggestions.length === 1 &&
                suggestions[0].lineStart === 0 &&
                suggestions[0].lineEnd === fileContent.split('\n').length - 1) {
                const edit = new vscode.WorkspaceEdit();
                const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(document.lineCount, 0));
                edit.replace(document.uri, range, suggestions[0].suggested);
                return await vscode.workspace.applyEdit(edit);
            }
            // 複数の小さな変更
            const edit = new vscode.WorkspaceEdit();
            // 後ろから前に適用して位置のずれを防止
            for (let i = suggestions.length - 1; i >= 0; i--) {
                const suggestion = suggestions[i];
                const startPosition = new vscode.Position(suggestion.lineStart, 0);
                const endPosition = new vscode.Position(suggestion.lineEnd + 1, 0);
                const range = new vscode.Range(startPosition, endPosition);
                edit.replace(document.uri, range, suggestion.suggested);
            }
            return await vscode.workspace.applyEdit(edit);
        }
        catch (error) {
            logger_1.Logger.error('コード編集の適用中にエラーが発生しました', error);
            throw error;
        }
    }
    /**
     * コード提案をプレビューする（差分エディタで表示）
     * @param filePath 編集対象ファイルパス
     * @param suggestions 提案された変更
     */
    async previewCodeChanges(filePath, suggestions) {
        try {
            if (suggestions.length === 0) {
                return;
            }
            // 元のファイル内容を取得
            const originalContent = await fileManager_1.FileManager.readFile(filePath);
            // 提案を適用した内容を作成
            let updatedContent = originalContent;
            const lines = originalContent.split('\n');
            // 後ろから前に適用して位置のずれを防止
            for (let i = suggestions.length - 1; i >= 0; i--) {
                const suggestion = suggestions[i];
                // 提案を適用
                const beforeLines = lines.slice(0, suggestion.lineStart);
                const afterLines = lines.slice(suggestion.lineEnd + 1);
                const newLines = suggestion.suggested.split('\n');
                // 更新されたコンテンツを構築
                updatedContent = [...beforeLines, ...newLines, ...afterLines].join('\n');
            }
            // 一時ファイルを作成して差分エディタで表示
            const extension = path.extname(filePath);
            const tempFilePath = await fileManager_1.FileManager.createTempFile(updatedContent, extension);
            // 差分エディタを開く
            const originalUri = vscode.Uri.file(filePath);
            const modifiedUri = vscode.Uri.file(tempFilePath);
            await vscode.commands.executeCommand('vscode.diff', originalUri, modifiedUri, 'Original ↔ Suggested Changes');
        }
        catch (error) {
            logger_1.Logger.error('コード変更のプレビュー中にエラーが発生しました', error);
            throw error;
        }
    }
}
exports.CodeEditor = CodeEditor;
//# sourceMappingURL=codeEditor.js.map