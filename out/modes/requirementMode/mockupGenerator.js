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
exports.MockupGenerator = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fileManager_1 = require("../../utils/fileManager");
const logger_1 = require("../../utils/logger");
class MockupGenerator {
    constructor(aiService) {
        this.aiService = aiService;
    }
    /**
     * モックアップを生成する
     * @param options モックアップオプション
     */
    async generateMockup(options) {
        try {
            logger_1.Logger.info(`モックアップ生成を開始: ${options.platform}, ${options.description}`);
            // AIサービスにプロンプトを送信
            const prompt = this.buildMockupPrompt(options);
            const aiResponse = await this.aiService.sendMessage(prompt, 'requirement');
            // AIレスポンスからモックアップコードを抽出
            const files = await this.extractMockupCode(aiResponse);
            // 結果を保存
            const result = await this.saveMockupFiles(files);
            // HTMLプレビューを作成
            if (result.htmlPath) {
                result.previewUrl = this.createPreviewUrl(result.htmlPath);
            }
            return result;
        }
        catch (error) {
            logger_1.Logger.error('モックアップ生成中にエラーが発生しました', error);
            throw error;
        }
    }
    /**
     * モックアッププロンプトを構築
     */
    buildMockupPrompt(options) {
        return `あなたはAppGenius AIのモックアップ生成エンジンです。
以下の要件に基づいてモックアップを生成してください。

要件:
- 説明: ${options.description}
- プラットフォーム: ${options.platform}
${options.style ? `- スタイル: ${options.style}` : ''}
- コード生成: ${options.includeCode ? '含める' : 'HTMLとCSSのみ'}

モックアップの生成規則:
1. モダンでクリーンなUI設計を採用してください
2. HTML、CSS、必要に応じてJavaScriptを含めてください
3. コードブロックは\`\`\`html、\`\`\`css、\`\`\`jsのように言語を指定してください
4. レスポンシブデザインを考慮してください
5. コメントで各セクションの役割を説明してください

例:
\`\`\`html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>モックアップ</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- ヘッダーセクション -->
  <header>...</header>
  
  <!-- メインコンテンツ -->
  <main>...</main>
  
  <!-- フッター -->
  <footer>...</footer>
</body>
</html>
\`\`\`

モックアップを生成してください。
`;
    }
    /**
     * AIレスポンスからモックアップコードを抽出
     */
    async extractMockupCode(aiResponse) {
        const htmlPattern = /```html\s*([\s\S]*?)```/;
        const cssPattern = /```css\s*([\s\S]*?)```/;
        const jsPattern = /```(?:js|javascript)\s*([\s\S]*?)```/;
        const htmlMatch = htmlPattern.exec(aiResponse);
        const cssMatch = cssPattern.exec(aiResponse);
        const jsMatch = jsPattern.exec(aiResponse);
        const result = {
            html: htmlMatch ? htmlMatch[1] : undefined,
            css: cssMatch ? cssMatch[1] : undefined,
            js: jsMatch ? jsMatch[1] : undefined
        };
        // デバッグログ
        logger_1.Logger.debug(`抽出されたHTML: ${result.html ? '成功' : '失敗'}`);
        logger_1.Logger.debug(`抽出されたCSS: ${result.css ? '成功' : '失敗'}`);
        logger_1.Logger.debug(`抽出されたJS: ${result.js ? '成功' : '失敗'}`);
        // AIレスポンスからコードを抽出できなかった場合のフォールバック
        if (!result.html) {
            logger_1.Logger.warn('HTMLコードが抽出できませんでした。デフォルトのHTMLを使用します。');
            result.html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>モックアップ</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <h1>モックアップ生成に問題が発生しました</h1>
  <p>AIレスポンスからHTMLコードを抽出できませんでした。</p>
  <p>以下はAIからの応答です:</p>
  <pre>${aiResponse.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
        }
        if (!result.css) {
            logger_1.Logger.warn('CSSコードが抽出できませんでした。デフォルトのCSSを使用します。');
            result.css = `body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #0066cc;
}

pre {
  background-color: #f4f4f4;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  overflow-x: auto;
}`;
        }
        return result;
    }
    /**
     * モックアップファイルを保存
     */
    async saveMockupFiles(files) {
        try {
            // ユーザーのホームディレクトリを使用
            const homeDir = process.env.HOME || process.env.USERPROFILE || '';
            // 現在のワークスペース名を取得
            const workspaceName = vscode.workspace.name || 'default';
            // 一時ディレクトリ名を生成（タイムスタンプ付き）
            const appDir = path.join(homeDir, '.appgenius-ai');
            const mockupsDir = path.join(appDir, 'mockups');
            const mockupDir = path.join(mockupsDir, `${workspaceName}_mockup_${Date.now()}`);
            // 各階層のディレクトリを確認して作成
            if (!await fileManager_1.FileManager.directoryExists(appDir)) {
                await fileManager_1.FileManager.createDirectory(appDir);
            }
            if (!await fileManager_1.FileManager.directoryExists(mockupsDir)) {
                await fileManager_1.FileManager.createDirectory(mockupsDir);
            }
            if (!await fileManager_1.FileManager.directoryExists(mockupDir)) {
                await fileManager_1.FileManager.createDirectory(mockupDir);
            }
            const result = {};
            // HTMLファイルを保存
            if (files.html) {
                const htmlPath = path.join(mockupDir, 'index.html');
                await fileManager_1.FileManager.writeFile(htmlPath, files.html);
                result.htmlPath = htmlPath;
            }
            // CSSファイルを保存
            if (files.css) {
                const cssPath = path.join(mockupDir, 'styles.css');
                await fileManager_1.FileManager.writeFile(cssPath, files.css);
                result.cssPath = cssPath;
            }
            // JSファイルを保存
            if (files.js) {
                const jsPath = path.join(mockupDir, 'script.js');
                await fileManager_1.FileManager.writeFile(jsPath, files.js);
                result.jsPath = jsPath;
            }
            return result;
        }
        catch (error) {
            // ファイル保存に失敗した場合はメモリ内で完結する
            logger_1.Logger.error('モックアップファイルの保存に失敗しました', error);
            // HTMLのみを返す代替結果
            const htmlContent = files.html || '<html><body><p>モックアップ生成に失敗しました</p></body></html>';
            // WebViewでレンダリングするためだけの一時ファイルを作成
            const htmlPath = await this.createInMemoryHtml(htmlContent, files.css, files.js);
            return {
                htmlPath
            };
        }
    }
    /**
     * メモリ内でHTMLを生成（ファイルシステムアクセスがない場合のフォールバック）
     */
    async createInMemoryHtml(html, css, js) {
        try {
            // 一時ディレクトリ（通常はOSの一時ディレクトリ）を使用
            const tempDir = path.join(os.tmpdir(), 'appgenius-ai-mockups');
            // 一時ディレクトリを作成
            if (!await fileManager_1.FileManager.directoryExists(tempDir)) {
                await fileManager_1.FileManager.createDirectory(tempDir);
            }
            // HTMLにインラインでCSSとJSを埋め込む
            let fullHtml = html;
            // CSSをインライン化
            if (css && !html.includes('<style>')) {
                const styleTag = `<style>\n${css}\n</style>`;
                fullHtml = fullHtml.replace('</head>', `${styleTag}\n</head>`);
            }
            // JSをインライン化
            if (js && !html.includes('<script>')) {
                const scriptTag = `<script>\n${js}\n</script>`;
                fullHtml = fullHtml.replace('</body>', `${scriptTag}\n</body>`);
            }
            // 一時ファイルに保存
            const filePath = path.join(tempDir, `mockup_${Date.now()}.html`);
            await fileManager_1.FileManager.writeFile(filePath, fullHtml);
            return filePath;
        }
        catch (error) {
            logger_1.Logger.error('インメモリHTML生成エラー', error);
            // 最後の手段として、一時的なドキュメントを開く
            const doc = await vscode.workspace.openTextDocument({
                content: html,
                language: 'html'
            });
            return doc.uri.fsPath;
        }
    }
    /**
     * HTMLファイルからプレビューURLを生成
     */
    createPreviewUrl(htmlPath) {
        // ファイルURIを生成
        return vscode.Uri.file(htmlPath).toString();
    }
    /**
     * モックアッププレビューを表示
     */
    async showPreview(mockupResult) {
        if (!mockupResult.htmlPath) {
            throw new Error('HTMLファイルが生成されていません');
        }
        try {
            // HTMLファイルが実際に存在するか確認
            if (!await fileManager_1.FileManager.fileExists(mockupResult.htmlPath)) {
                logger_1.Logger.error(`HTMLファイルが存在しません: ${mockupResult.htmlPath}`);
                throw new Error(`HTMLファイル ${mockupResult.htmlPath} が見つかりません`);
            }
            // WebViewを使用してプレビューを表示
            const panel = vscode.window.createWebviewPanel('mockupPreview', 'モックアッププレビュー', vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.dirname(mockupResult.htmlPath))
                ]
            });
            // HTMLコンテンツを読み込み
            let html = await fileManager_1.FileManager.readFile(mockupResult.htmlPath);
            logger_1.Logger.debug(`読み込まれたHTML: ${html.substring(0, 100)}...`);
            // CSS参照を修正
            if (mockupResult.cssPath) {
                if (await fileManager_1.FileManager.fileExists(mockupResult.cssPath)) {
                    const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(mockupResult.cssPath));
                    html = html.replace('href="styles.css"', `href="${cssUri}"`);
                    logger_1.Logger.debug(`CSSパス置換: ${cssUri}`);
                }
                else {
                    logger_1.Logger.warn(`CSSファイルが存在しません: ${mockupResult.cssPath}`);
                }
            }
            // JS参照を修正
            if (mockupResult.jsPath) {
                if (await fileManager_1.FileManager.fileExists(mockupResult.jsPath)) {
                    const jsUri = panel.webview.asWebviewUri(vscode.Uri.file(mockupResult.jsPath));
                    html = html.replace('src="script.js"', `src="${jsUri}"`);
                    logger_1.Logger.debug(`JSパス置換: ${jsUri}`);
                }
                else {
                    logger_1.Logger.warn(`JSファイルが存在しません: ${mockupResult.jsPath}`);
                }
            }
            // WebViewにHTMLを設定
            panel.webview.html = html;
            // テストとしてファイルを開く
            try {
                await fileManager_1.FileManager.openFile(mockupResult.htmlPath);
                if (mockupResult.cssPath)
                    await fileManager_1.FileManager.openFile(mockupResult.cssPath);
                if (mockupResult.jsPath)
                    await fileManager_1.FileManager.openFile(mockupResult.jsPath);
            }
            catch (openError) {
                logger_1.Logger.warn('ファイルを開けませんでした');
            }
            logger_1.Logger.info('モックアッププレビューを表示しました');
        }
        catch (error) {
            logger_1.Logger.error('プレビュー表示エラー', error);
            throw new Error(`モックアッププレビューの表示に失敗しました: ${error.message}`);
        }
    }
}
exports.MockupGenerator = MockupGenerator;
//# sourceMappingURL=mockupGenerator.js.map