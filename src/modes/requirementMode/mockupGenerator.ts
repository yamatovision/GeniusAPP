import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { AIService } from '../../core/aiService';
import { FileManager } from '../../utils/fileManager';
import { Logger } from '../../utils/logger';

export interface MockupOptions {
  description: string;
  platform: 'web' | 'mobile' | 'desktop';
  style?: string;
  includeCode?: boolean;
}

export interface MockupResult {
  htmlPath?: string;
  cssPath?: string;
  jsPath?: string;
  previewUrl?: string;
}

export class MockupGenerator {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * モックアップを生成する
   * @param options モックアップオプション
   */
  public async generateMockup(options: MockupOptions): Promise<MockupResult> {
    try {
      Logger.info(`モックアップ生成を開始: ${options.platform}, ${options.description}`);

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
    } catch (error) {
      Logger.error('モックアップ生成中にエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * モックアッププロンプトを構築
   */
  private buildMockupPrompt(options: MockupOptions): string {
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
  private async extractMockupCode(aiResponse: string): Promise<{html?: string; css?: string; js?: string}> {
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
    Logger.debug(`抽出されたHTML: ${result.html ? '成功' : '失敗'}`);
    Logger.debug(`抽出されたCSS: ${result.css ? '成功' : '失敗'}`);
    Logger.debug(`抽出されたJS: ${result.js ? '成功' : '失敗'}`);
    
    // AIレスポンスからコードを抽出できなかった場合のフォールバック
    if (!result.html) {
      Logger.warn('HTMLコードが抽出できませんでした。デフォルトのHTMLを使用します。');
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
      Logger.warn('CSSコードが抽出できませんでした。デフォルトのCSSを使用します。');
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
  private async saveMockupFiles(files: {html?: string; css?: string; js?: string}): Promise<MockupResult> {
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
      if (!await FileManager.directoryExists(appDir)) {
        await FileManager.createDirectory(appDir);
      }
      
      if (!await FileManager.directoryExists(mockupsDir)) {
        await FileManager.createDirectory(mockupsDir);
      }
      
      if (!await FileManager.directoryExists(mockupDir)) {
        await FileManager.createDirectory(mockupDir);
      }
      
      const result: MockupResult = {};
      
      // HTMLファイルを保存
      if (files.html) {
        const htmlPath = path.join(mockupDir, 'index.html');
        await FileManager.writeFile(htmlPath, files.html);
        result.htmlPath = htmlPath;
      }
      
      // CSSファイルを保存
      if (files.css) {
        const cssPath = path.join(mockupDir, 'styles.css');
        await FileManager.writeFile(cssPath, files.css);
        result.cssPath = cssPath;
      }
      
      // JSファイルを保存
      if (files.js) {
        const jsPath = path.join(mockupDir, 'script.js');
        await FileManager.writeFile(jsPath, files.js);
        result.jsPath = jsPath;
      }
      
      return result;
    } catch (error) {
      // ファイル保存に失敗した場合はメモリ内で完結する
      Logger.error('モックアップファイルの保存に失敗しました', error as Error);
      
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
  private async createInMemoryHtml(html: string, css?: string, js?: string): Promise<string> {
    try {
      // 一時ディレクトリ（通常はOSの一時ディレクトリ）を使用
      const tempDir = path.join(os.tmpdir(), 'appgenius-ai-mockups');
      
      // 一時ディレクトリを作成
      if (!await FileManager.directoryExists(tempDir)) {
        await FileManager.createDirectory(tempDir);
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
      await FileManager.writeFile(filePath, fullHtml);
      
      return filePath;
    } catch (error) {
      Logger.error('インメモリHTML生成エラー', error as Error);
      
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
  private createPreviewUrl(htmlPath: string): string {
    // ファイルURIを生成
    return vscode.Uri.file(htmlPath).toString();
  }

  /**
   * モックアッププレビューを表示
   */
  public async showPreview(mockupResult: MockupResult): Promise<void> {
    if (!mockupResult.htmlPath) {
      throw new Error('HTMLファイルが生成されていません');
    }
    
    try {
      // HTMLファイルが実際に存在するか確認
      if (!await FileManager.fileExists(mockupResult.htmlPath)) {
        Logger.error(`HTMLファイルが存在しません: ${mockupResult.htmlPath}`);
        throw new Error(`HTMLファイル ${mockupResult.htmlPath} が見つかりません`);
      }
      
      // WebViewを使用してプレビューを表示
      const panel = vscode.window.createWebviewPanel(
        'mockupPreview',
        'モックアッププレビュー',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.dirname(mockupResult.htmlPath))
          ]
        }
      );
      
      // HTMLコンテンツを読み込み
      let html = await FileManager.readFile(mockupResult.htmlPath);
      Logger.debug(`読み込まれたHTML: ${html.substring(0, 100)}...`);
      
      // CSS参照を修正
      if (mockupResult.cssPath) {
        if (await FileManager.fileExists(mockupResult.cssPath)) {
          const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(mockupResult.cssPath));
          html = html.replace('href="styles.css"', `href="${cssUri}"`);
          Logger.debug(`CSSパス置換: ${cssUri}`);
        } else {
          Logger.warn(`CSSファイルが存在しません: ${mockupResult.cssPath}`);
        }
      }
      
      // JS参照を修正
      if (mockupResult.jsPath) {
        if (await FileManager.fileExists(mockupResult.jsPath)) {
          const jsUri = panel.webview.asWebviewUri(vscode.Uri.file(mockupResult.jsPath));
          html = html.replace('src="script.js"', `src="${jsUri}"`);
          Logger.debug(`JSパス置換: ${jsUri}`);
        } else {
          Logger.warn(`JSファイルが存在しません: ${mockupResult.jsPath}`);
        }
      }
      
      // WebViewにHTMLを設定
      panel.webview.html = html;
      
      // テストとしてファイルを開く
      try {
        await FileManager.openFile(mockupResult.htmlPath);
        if (mockupResult.cssPath) await FileManager.openFile(mockupResult.cssPath);
        if (mockupResult.jsPath) await FileManager.openFile(mockupResult.jsPath);
      } catch (openError) {
        Logger.warn('ファイルを開けませんでした');
      }
      
      Logger.info('モックアッププレビューを表示しました');
    } catch (error) {
      Logger.error('プレビュー表示エラー', error as Error);
      throw new Error(`モックアッププレビューの表示に失敗しました: ${(error as Error).message}`);
    }
  }
}