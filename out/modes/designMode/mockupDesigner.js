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
exports.MockupDesigner = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const fileManager_1 = require("../../utils/fileManager");
const logger_1 = require("../../utils/logger");
/**
 * モックアップデザイナーのクラス
 * UI設計と要件抽出を担当する
 */
class MockupDesigner {
    constructor(aiService) {
        this.pages = [];
        this.mockups = new Map(); // pageId -> mockups[]
        this.aiService = aiService;
    }
    /**
     * ページ一覧を取得
     */
    getPages() {
        return this.pages;
    }
    /**
     * ページをIDで取得
     */
    getPageById(id) {
        return this.pages.find(page => page.id === id);
    }
    /**
     * ページを追加
     */
    addPage(page) {
        if (!this.getPageById(page.id)) {
            this.pages.push(page);
            logger_1.Logger.info(`ページが追加されました: ${page.name}`);
        }
        else {
            logger_1.Logger.warn(`ページIDが重複しています: ${page.id}`);
        }
    }
    /**
     * ページを削除
     */
    removePage(id) {
        const initialLength = this.pages.length;
        this.pages = this.pages.filter(page => page.id !== id);
        if (this.pages.length < initialLength) {
            // ページに関連するモックアップも削除
            this.mockups.delete(id);
            logger_1.Logger.info(`ページが削除されました: ${id}`);
            return true;
        }
        return false;
    }
    /**
     * ページからモックアップを生成
     */
    async generateMockup(pageId, framework = 'html') {
        const page = this.getPageById(pageId);
        if (!page) {
            logger_1.Logger.error(`ページが見つかりません: ${pageId}`);
            throw new Error(`ページが見つかりません: ${pageId}`);
        }
        try {
            logger_1.Logger.info(`モックアップ生成を開始: ${page.name}, フレームワーク: ${framework}`);
            // AIにプロンプトを送信
            const prompt = this.buildMockupPrompt(page, framework);
            const aiResponse = await this.aiService.sendMessage(prompt, 'design');
            // AIレスポンスからモックアップコードを抽出
            const code = await this.extractMockupCode(aiResponse, framework);
            // モックアップファイルを保存
            const mockup = await this.saveMockupFiles(pageId, code, framework);
            // モックアップを記録
            if (!this.mockups.has(pageId)) {
                this.mockups.set(pageId, []);
            }
            this.mockups.get(pageId)?.push(mockup);
            logger_1.Logger.info(`モックアップが生成されました: ${page.name}`);
            return mockup;
        }
        catch (error) {
            logger_1.Logger.error(`モックアップ生成エラー: ${pageId}`, error);
            throw error;
        }
    }
    /**
     * モックアッププロンプトを構築
     */
    buildMockupPrompt(page, framework) {
        let prompt = `あなたはUI/UX設計のエキスパートビジュアライザーです。
以下のページ定義に基づいて、完全に動作するモックアップを生成してください。

ページ情報:
- 名前: ${page.name}
- 説明: ${page.description}
- ルート: ${page.route}
- コンポーネント: ${page.components.join(', ')}
- API エンドポイント: ${page.apiEndpoints.join(', ')}

【ライブラリ使用ポリシー】
モックアップ作成時は以下の事前定義されたライブラリセットからのみ選択して使用してください：

1. 基本セット（常に含める）
   - HTML5標準機能
   - 基本的なCSS

2. 選択可能なUIフレームワーク（一つのみ選択）
   - Bootstrap 5 (CDN: https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css)
   - Material Design Lite (CDN: https://code.getmdl.io/1.3.0/material.indigo-pink.min.css)

3. 選択可能なJSライブラリ（必要なものだけ選択）
   - jQuery (単純な操作の場合のみ)
   - Chart.js (グラフ表示が必要な場合のみ)

重要: 使用するライブラリはすべて、HTML生成を開始する前に決定し、head要素内に適切なCDNリンクとして追加してください。後からライブラリを追加することはできません。
`;
        if (framework.toLowerCase() === 'react') {
            prompt += `
【React固有のライブラリ設定】
React使用時には以下のCDNをhead内に必ず含めてください:

\`\`\`html
<!-- React の読み込み -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>

<!-- Material UI の読み込み -->
<script src="https://unpkg.com/@mui/material@5.14.0/umd/material-ui.development.js" crossorigin></script>

<!-- Framer Motion の読み込み (アニメーションに使用) -->
<script src="https://unpkg.com/framer-motion@10.16.4/dist/framer-motion.js" crossorigin></script>

<!-- Babel for JSX -->
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
\`\`\`

ライブラリの参照方法:
- Reactは「React」オブジェクトとして参照
- ReactDOMは「ReactDOM」オブジェクトとして参照
- Material UIは「MaterialUI」オブジェクトとして参照
- Framer Motionは「motion」オブジェクトとして参照（window.motionとしてグローバルに利用可能）

以下の要素を含むReactベースのモックアップを生成してください:
1. 上記の必須CDNライブラリ（すべて含める）
2. スタイリングとレイアウト用のCSS
3. モックデータとロジック
4. エラーハンドリング
5. 視覚的フィードバック用のローディング表示

テンプレート必須要素:
1. Reactの初期化コード
2. MaterialUIのセットアップ
3. グローバルスタイルの定義
4. コンポーネント定義
5. ローディング表示
6. レスポンシブ対応

コードブロックは以下の形式で返してください:
\`\`\`html
<!DOCTYPE html>...
\`\`\`

\`\`\`css
/* スタイル定義 */
\`\`\`

\`\`\`jsx
// Reactコンポーネント
\`\`\`
`;
        }
        else {
            prompt += `
【HTML/JS固有のライブラリ設定】
通常のHTML/JS使用時には使用するライブラリをhead内に明示的に含めてください。
例えば以下のようなCDNを選択して使用できます:

\`\`\`html
<!-- Bootstrap CSS (UIフレームワークとして使用する場合) -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>

<!-- もしくは Material Design Lite (UIフレームワークとして使用する場合) -->
<link rel="stylesheet" href="https://code.getmdl.io/1.3.0/material.indigo-pink.min.css">
<script defer src="https://code.getmdl.io/1.3.0/material.min.js"></script>

<!-- jQuery (必要な場合のみ) -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

<!-- Chart.js (グラフが必要な場合のみ) -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
\`\`\`

以下の要素を含む完全なHTMLモックアップを生成してください:
1. 必要なすべてのライブラリを冒頭のhead要素内に含める
2. スタイリングとレイアウト用のCSS
3. モックデータとロジック（JavaScript）
4. エラーハンドリング
5. 視覚的フィードバック用のローディング表示

品質保証項目:
・HTMLファイルを開いた直後から正常動作すること
・すべてのライブラリが正しい順序で読み込まれること
・視覚的要素が即座に表示されること
・コンソールエラーが発生しないこと
・レスポンシブ対応していること

コードブロックは以下の形式で返してください:
\`\`\`html
<!DOCTYPE html>...
\`\`\`

\`\`\`css
/* スタイル定義 */
\`\`\`

\`\`\`js
// ビジネスロジック
\`\`\`
`;
        }
        return prompt;
    }
    /**
     * AIレスポンスからモックアップコードを抽出
     */
    async extractMockupCode(aiResponse, framework) {
        const htmlPattern = /```(?:html)\s*([\s\S]*?)```/;
        const cssPattern = /```(?:css)\s*([\s\S]*?)```/;
        const jsPattern = /```(?:js|javascript|jsx)\s*([\s\S]*?)```/;
        const htmlMatch = htmlPattern.exec(aiResponse);
        const cssMatch = cssPattern.exec(aiResponse);
        const jsMatch = jsPattern.exec(aiResponse);
        const result = {
            html: htmlMatch ? htmlMatch[1] : undefined,
            css: cssMatch ? cssMatch[1] : undefined,
            js: jsMatch ? jsMatch[1] : undefined,
            framework
        };
        // デバッグログ
        logger_1.Logger.debug(`抽出されたHTML: ${result.html ? '成功' : '失敗'}`);
        logger_1.Logger.debug(`抽出されたCSS: ${result.css ? '成功' : '失敗'}`);
        logger_1.Logger.debug(`抽出されたJS: ${result.js ? '成功' : '失敗'}`);
        // AIレスポンスからコードを抽出できなかった場合のフォールバック
        if (!result.html) {
            logger_1.Logger.warn('HTMLコードが抽出できませんでした。デフォルトのHTMLを使用します。');
            // フレームワークに応じてデフォルトHTMLを生成
            if (framework.toLowerCase() === 'react') {
                result.html = this.getDefaultReactHtml(aiResponse);
            }
            else {
                result.html = this.getDefaultHtml(aiResponse);
            }
        }
        if (!result.css) {
            logger_1.Logger.warn('CSSコードが抽出できませんでした。デフォルトのCSSを使用します。');
            result.css = this.getDefaultCss();
        }
        if (!result.js && framework.toLowerCase() === 'react') {
            logger_1.Logger.warn('Reactコードが抽出できませんでした。デフォルトのReactコードを使用します。');
            result.js = this.getDefaultReactJs();
        }
        else if (!result.js) {
            logger_1.Logger.warn('JSコードが抽出できませんでした。デフォルトのJSコードを使用します。');
            result.js = this.getDefaultJs();
        }
        return result;
    }
    /**
     * デフォルトのHTMLを取得
     */
    getDefaultHtml(aiResponse) {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>モックアップ</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <h1>モックアップ</h1>
    <nav>
      <ul>
        <li><a href="#">ホーム</a></li>
        <li><a href="#">機能</a></li>
        <li><a href="#">設定</a></li>
      </ul>
    </nav>
  </header>
  
  <main>
    <section class="content">
      <h2>モックアップ生成</h2>
      <p>AIレスポンスからHTMLコードを抽出できませんでした。</p>
      <p>以下はAIからの応答です:</p>
      <pre>${aiResponse.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </section>
  </main>
  
  <footer>
    <p>&copy; 2025 AppGenius AI</p>
  </footer>
  
  <script src="script.js"></script>
</body>
</html>`;
    }
    /**
     * デフォルトのReact用HTMLを取得
     */
    getDefaultReactHtml(_unusedResponse) {
        return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React モックアップ</title>
  <link rel="stylesheet" href="styles.css">
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@mui/material@5.14.0/umd/material-ui.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  
  <script type="text/babel" src="script.js"></script>
</body>
</html>`;
    }
    /**
     * デフォルトのCSSを取得
     */
    getDefaultCss() {
        return `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
}

nav ul {
  display: flex;
  list-style: none;
}

nav ul li {
  margin-left: 20px;
}

nav ul li a {
  text-decoration: none;
  color: #333;
}

main {
  padding: 20px 0;
}

.content {
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 5px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

h1 {
  color: #0066cc;
}

h2 {
  margin-bottom: 15px;
  color: #0066cc;
}

pre {
  background-color: #f4f4f4;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  overflow-x: auto;
  margin: 15px 0;
}

footer {
  text-align: center;
  padding: 20px 0;
  margin-top: 40px;
  border-top: 1px solid #eee;
  color: #666;
}

@media (max-width: 768px) {
  header {
    flex-direction: column;
  }
  
  nav ul {
    margin-top: 15px;
  }
  
  nav ul li {
    margin-left: 10px;
    margin-right: 10px;
  }
}`;
    }
    /**
     * デフォルトのJSを取得
     */
    getDefaultJs() {
        return `document.addEventListener('DOMContentLoaded', function() {
  console.log('モックアップが読み込まれました');
  
  // モックデータ
  const mockData = {
    user: {
      name: 'ユーザー名',
      email: 'user@example.com'
    },
    items: [
      { id: 1, name: '項目1', value: 100 },
      { id: 2, name: '項目2', value: 200 },
      { id: 3, name: '項目3', value: 300 }
    ]
  };
  
  // ローディング表示の設定
  function showLoading() {
    const main = document.querySelector('main');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = '<p>読み込み中...</p>';
    main.appendChild(loadingDiv);
  }
  
  function hideLoading() {
    const loading = document.querySelector('.loading');
    if (loading) {
      loading.remove();
    }
  }
  
  // デモ用のローディング表示
  showLoading();
  setTimeout(hideLoading, 1500);
  
  // イベントリスナーの設定
  const links = document.querySelectorAll('nav a');
  links.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      alert('このリンクはモックアップでは動作しません');
    });
  });
});`;
    }
    /**
     * デフォルトのReact JSを取得
     */
    getDefaultReactJs() {
        return `const { useState, useEffect } = React;
const { 
  Button, 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Container,
  CircularProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText
} = MaterialUI;

// モックデータ
const mockData = {
  user: {
    name: 'ユーザー名',
    email: 'user@example.com'
  },
  items: [
    { id: 1, name: '項目1', value: 100 },
    { id: 2, name: '項目2', value: 200 },
    { id: 3, name: '項目3', value: 300 }
  ]
};

// メインアプリケーション
function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // APIリクエストをシミュレート
    setTimeout(() => {
      setData(mockData);
      setLoading(false);
    }, 1500);
  }, []);
  
  return (
    <Container>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">React モックアップ</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button color="inherit">ホーム</Button>
          <Button color="inherit">機能</Button>
          <Button color="inherit">設定</Button>
        </Toolbar>
      </AppBar>
      
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          モックアップ生成
        </Typography>
        
        <Card sx={{ minWidth: 275, mb: 3 }}>
          <CardContent>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Typography variant="h5" component="h2">
                  ユーザー: {data.user.name}
                </Typography>
                <Typography color="text.secondary">
                  {data.user.email}
                </Typography>
                
                <Typography variant="h6" sx={{ mt: 2 }}>
                  項目リスト:
                </Typography>
                <List>
                  {data.items.map(item => (
                    <ListItem key={item.id}>
                      <ListItemText 
                        primary={item.name} 
                        secondary={"値: " + item.value}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </CardContent>
        </Card>
        
        <Button variant="contained">アクション</Button>
      </Box>
      
      <Box component="footer" sx={{ mt: 4, py: 2, borderTop: '1px solid #eee' }}>
        <Typography variant="body2" color="text.secondary" align="center">
          © 2025 AppGenius AI
        </Typography>
      </Box>
    </Container>
  );
}

// Reactをレンダリング
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`;
    }
    /**
     * モックアップファイルを保存
     * @param pageId ページID
     * @param code モックアップコード
     * @param framework フレームワーク
     * @param options 保存オプション（カスタムファイル名、保存先等）
     */
    async saveMockupFiles(pageId, code, framework, options) {
        try {
            // ユーザーのホームディレクトリをデフォルトとして使用
            const homeDir = process.env.HOME || process.env.USERPROFILE || '';
            // ワークスペース名を取得
            const workspaceName = vscode.workspace.name || 'default';
            // タイムスタンプ
            const timestamp = Date.now();
            // ページ情報を取得（名前を保存用に使用）
            const page = this.getPageById(pageId);
            if (!page) {
                logger_1.Logger.warn(`ページ情報が見つかりません: ${pageId}`);
            }
            // ファイル名の生成（オプションで指定されていればそれを使用、なければページ名またはIDから生成）
            const fileName = options?.fileName || this._generateSafeFileName(page?.name || `page-${pageId}`);
            // ディレクトリパスを決定
            let mockupDir;
            if (options?.projectPath) {
                // プロジェクトパスが指定されていれば、その中のmockupsディレクトリに保存
                const projectMockupsDir = path.join(options.projectPath, 'mockups');
                // mockupsディレクトリが存在しなければ作成
                if (!await fileManager_1.FileManager.directoryExists(projectMockupsDir)) {
                    await fileManager_1.FileManager.createDirectory(projectMockupsDir);
                }
                // モックアップのサブディレクトリを作成（ファイル名+タイムスタンプ）
                mockupDir = path.join(projectMockupsDir, `${fileName}-${timestamp}`);
            }
            else {
                // 指定がなければデフォルトのアプリディレクトリに保存
                const appDir = path.join(homeDir, '.appgenius-ai');
                const mockupsDir = path.join(appDir, 'mockups');
                mockupDir = path.join(mockupsDir, `${workspaceName}_${fileName}_${timestamp}`);
                // 各階層のディレクトリを確認して作成
                if (!await fileManager_1.FileManager.directoryExists(appDir)) {
                    await fileManager_1.FileManager.createDirectory(appDir);
                }
                if (!await fileManager_1.FileManager.directoryExists(mockupsDir)) {
                    await fileManager_1.FileManager.createDirectory(mockupsDir);
                }
            }
            // モックアップディレクトリを作成
            if (!await fileManager_1.FileManager.directoryExists(mockupDir)) {
                await fileManager_1.FileManager.createDirectory(mockupDir);
            }
            // モックアップオブジェクトの初期化
            const mockup = {
                pageId,
                timestamp
            };
            // HTMLファイルを保存
            if (code.html) {
                const htmlPath = path.join(mockupDir, 'index.html');
                await fileManager_1.FileManager.writeFile(htmlPath, code.html);
                mockup.htmlPath = htmlPath;
            }
            // CSSファイルを保存 (名前を統一して style.css に変更)
            if (code.css) {
                const cssPath = path.join(mockupDir, 'style.css');
                await fileManager_1.FileManager.writeFile(cssPath, code.css);
                mockup.cssPath = cssPath;
            }
            // JSファイルを保存
            if (code.js) {
                const jsPath = path.join(mockupDir, 'script.js');
                await fileManager_1.FileManager.writeFile(jsPath, code.js);
                mockup.jsPath = jsPath;
            }
            // 一体型のHTMLを生成（ブラウザ表示用）
            if (code.html) {
                let fullHtml = code.html;
                // CSSをインライン化
                if (code.css && !fullHtml.includes('<style>')) {
                    const styleTag = `<style>\n${code.css}\n</style>`;
                    fullHtml = fullHtml.replace('</head>', `${styleTag}\n</head>`);
                }
                // JSをインライン化（Reactの場合は特別扱い）
                if (code.js) {
                    if (framework.toLowerCase() === 'react') {
                        if (!fullHtml.includes('<script type="text/babel">')) {
                            const scriptTag = `<script type="text/babel">\n${code.js}\n</script>`;
                            fullHtml = fullHtml.replace('</body>', `${scriptTag}\n</body>`);
                        }
                    }
                    else if (!fullHtml.includes('<script>')) {
                        const scriptTag = `<script>\n${code.js}\n</script>`;
                        fullHtml = fullHtml.replace('</body>', `${scriptTag}\n</body>`);
                    }
                }
                // 一体型HTMLを保存
                const fullHtmlPath = path.join(mockupDir, `${fileName}.html`);
                await fileManager_1.FileManager.writeFile(fullHtmlPath, fullHtml);
                mockup.fullHtmlPath = fullHtmlPath;
            }
            // プレビューURLを設定
            if (mockup.htmlPath) {
                mockup.previewUrl = vscode.Uri.file(mockup.htmlPath).toString();
            }
            logger_1.Logger.info(`モックアップを保存しました: ${mockupDir}`);
            return mockup;
        }
        catch (error) {
            logger_1.Logger.error('モックアップファイルの保存に失敗しました', error);
            throw new Error('モックアップファイルの保存に失敗しました');
        }
    }
    /**
     * ファイル名に使用できる安全な文字列を生成
     * @param name 元の名前
     * @returns ファイルシステムで使用可能な名前
     */
    _generateSafeFileName(name) {
        // スペースをハイフンに変換し、ファイル名に使用できない文字を削除
        return name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-') // スペースをハイフンに変換
            .replace(/[^\w\-]/g, '') // 英数字、アンダースコア、ハイフン以外を削除
            .replace(/\-{2,}/g, '-') // 連続するハイフンを1つにまとめる
            .replace(/^-+|-+$/g, ''); // 先頭と末尾のハイフンを削除
    }
    /**
     * モックアッププレビューを表示
     */
    async showPreview(mockup) {
        if (!mockup.htmlPath) {
            throw new Error('HTMLファイルが生成されていません');
        }
        try {
            // HTMLファイルが実際に存在するか確認
            if (!await fileManager_1.FileManager.fileExists(mockup.htmlPath)) {
                logger_1.Logger.error(`HTMLファイルが存在しません: ${mockup.htmlPath}`);
                throw new Error(`HTMLファイル ${mockup.htmlPath} が見つかりません`);
            }
            // WebViewを使用してプレビューを表示
            const panel = vscode.window.createWebviewPanel('mockupPreview', 'モックアッププレビュー', vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.dirname(mockup.htmlPath))
                ]
            });
            // HTMLコンテンツを読み込み
            let html = await fileManager_1.FileManager.readFile(mockup.htmlPath);
            logger_1.Logger.debug(`読み込まれたHTML: ${html.substring(0, 100)}...`);
            // CSS参照を修正
            if (mockup.cssPath) {
                if (await fileManager_1.FileManager.fileExists(mockup.cssPath)) {
                    const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(mockup.cssPath));
                    html = html.replace('href="styles.css"', `href="${cssUri}"`);
                    logger_1.Logger.debug(`CSSパス置換: ${cssUri}`);
                }
                else {
                    logger_1.Logger.warn(`CSSファイルが存在しません: ${mockup.cssPath}`);
                }
            }
            // JS参照を修正
            if (mockup.jsPath) {
                if (await fileManager_1.FileManager.fileExists(mockup.jsPath)) {
                    const jsUri = panel.webview.asWebviewUri(vscode.Uri.file(mockup.jsPath));
                    html = html.replace('src="script.js"', `src="${jsUri}"`);
                    logger_1.Logger.debug(`JSパス置換: ${jsUri}`);
                }
                else {
                    logger_1.Logger.warn(`JSファイルが存在しません: ${mockup.jsPath}`);
                }
            }
            // WebViewにHTMLを設定
            panel.webview.html = html;
            logger_1.Logger.info('モックアッププレビューを表示しました');
        }
        catch (error) {
            logger_1.Logger.error('プレビュー表示エラー', error);
            throw new Error(`モックアッププレビューの表示に失敗しました: ${error.message}`);
        }
    }
    /**
     * モックアップをブラウザで表示
     */
    async openInBrowser(mockup) {
        // fullHtmlPathがあればそれを使う、なければhtmlPathを使う
        const htmlPath = mockup.fullHtmlPath || mockup.htmlPath;
        if (!htmlPath) {
            throw new Error('HTMLファイルが生成されていません');
        }
        try {
            // HTMLファイルが実際に存在するか確認
            if (!await fileManager_1.FileManager.fileExists(htmlPath)) {
                logger_1.Logger.error(`HTMLファイルが存在しません: ${htmlPath}`);
                throw new Error(`HTMLファイル ${htmlPath} が見つかりません`);
            }
            // ブラウザでファイルを開く
            const uri = vscode.Uri.file(htmlPath);
            await vscode.env.openExternal(uri);
            logger_1.Logger.info('モックアップをブラウザで開きました');
        }
        catch (error) {
            logger_1.Logger.error('ブラウザ表示エラー', error);
            throw new Error('モックアップのブラウザ表示に失敗しました');
        }
    }
    /**
     * ページリストからAIにプロンプトを送信して、必要なページを抽出する
     */
    async generatePageStructure(requirementsText) {
        try {
            logger_1.Logger.info('ページ構造生成を開始');
            logger_1.Logger.debug('Requirements text:', requirementsText);
            const prompt = `あなたはUI/UX設計のエキスパートです。以下の要件定義から、必要なページ構造を抽出してください。

要件定義:
${requirementsText}

以下の形式で、必要なすべてのページのリストを返してください:

1. ホームページ
   - ID: home
   - 説明: ユーザーが最初に訪れるページで、主要機能へのアクセスを提供
   - ルート: /
   - コンポーネント: ヘッダー、フッター、メインナビゲーション、最新情報セクション
   - API エンドポイント: /api/user/status, /api/notifications

2. ログインページ
   (同様の形式で)

ページはユーザーフローに必要な最小限のものを特定し、各ページの役割と必要なコンポーネント、APIエンドポイントを明確にしてください。`;
            logger_1.Logger.debug('Sending prompt to AI:', prompt);
            // AIにプロンプトを送信
            let aiResponse;
            try {
                aiResponse = await this.aiService.sendMessage(prompt, 'design');
                logger_1.Logger.debug('AIレスポンスを受信:', aiResponse);
            }
            catch (error) {
                logger_1.Logger.error('AI API呼び出しエラー', error);
                // エラーが発生したら、モックレスポンスを使用（デバッグ用）
                aiResponse = this.getMockPageStructureResponse(requirementsText);
                logger_1.Logger.info('モックレスポンスを使用します:', aiResponse);
            }
            // ページリストを解析
            const parsedPages = this.parsePageStructureFromResponse(aiResponse);
            logger_1.Logger.debug('解析されたページ:', parsedPages);
            return parsedPages;
        }
        catch (error) {
            logger_1.Logger.error('ページ構造生成エラー', error);
            // エラーが発生した場合でもモックレスポンスを返す
            const mockResponse = this.getMockPageStructureResponse(requirementsText);
            const mockPages = this.parsePageStructureFromResponse(mockResponse);
            logger_1.Logger.info('エラー発生時のモックページを返します', mockPages);
            return mockPages;
        }
    }
    /**
     * モックのページ構造レスポンスを生成（デバッグ用）
     */
    getMockPageStructureResponse(_requirementsText) {
        // _requirementsTextの内容に基づいてカスタマイズすることも可能
        return `以下のページ構造を提案します：

1. ホームページ
   - ID: home
   - 説明: ユーザーが最初に訪れるランディングページ。主要機能への導線を提供。
   - ルート: /
   - コンポーネント: ヘッダー、ヒーローセクション、機能紹介、CTAボタン、フッター
   - API エンドポイント: /api/featured-content

2. ログインページ
   - ID: login
   - 説明: ユーザー認証を行うページ
   - ルート: /login
   - コンポーネント: ログインフォーム、ソーシャルログインボタン、パスワードリセットリンク
   - API エンドポイント: /api/auth/login, /api/auth/social-login

3. 登録ページ
   - ID: register
   - 説明: 新規ユーザー登録を行うページ
   - ルート: /register
   - コンポーネント: 登録フォーム、利用規約同意チェックボックス、ソーシャル登録ボタン
   - API エンドポイント: /api/auth/register, /api/auth/validate-email

4. ダッシュボード
   - ID: dashboard
   - 説明: ログイン後のメイン画面。ユーザーの活動概要と主要機能へのアクセスを提供
   - ルート: /dashboard
   - コンポーネント: サイドバーナビゲーション、アクティビティサマリー、クイックアクセスカード
   - API エンドポイント: /api/user/dashboard, /api/user/activities, /api/user/stats
`;
    }
    /**
     * AIレスポンスからページ構造を解析
     */
    parsePageStructureFromResponse(response) {
        const pages = [];
        // 正規表現でページを抽出
        const pagePattern = /(\d+)\.\s+(.*?)\n\s+- ID:\s+(.*?)\n\s+- 説明:\s+(.*?)\n\s+- ルート:\s+(.*?)\n\s+- コンポーネント:\s+(.*?)\n\s+- API エンドポイント:\s+(.*?)(?=\n\n\d+\.|\n*$)/gs;
        let match;
        while ((match = pagePattern.exec(response)) !== null) {
            const name = match[2].trim();
            const id = match[3].trim();
            const description = match[4].trim();
            const route = match[5].trim();
            const components = match[6].split(',').map(c => c.trim());
            const apiEndpoints = match[7].split(',').map(e => e.trim());
            pages.push({
                id,
                name,
                description,
                route,
                components,
                apiEndpoints
            });
        }
        // 正規表現で抽出できない場合は、手動でパース
        if (pages.length === 0) {
            logger_1.Logger.warn('正規表現でページ構造を抽出できませんでした。手動パース試行中...');
            // 簡易的なページ抽出
            const lines = response.split('\n');
            let currentPage = null;
            for (const line of lines) {
                const trimmedLine = line.trim();
                // 新しいページの開始を検出
                if (/^\d+\./.test(trimmedLine)) {
                    // 前のページを保存
                    if (currentPage && currentPage.id && currentPage.name) {
                        pages.push({
                            id: currentPage.id,
                            name: currentPage.name,
                            description: currentPage.description || '',
                            route: currentPage.route || '/',
                            components: currentPage.components || [],
                            apiEndpoints: currentPage.apiEndpoints || []
                        });
                    }
                    // 新しいページの初期化
                    currentPage = {
                        name: trimmedLine.replace(/^\d+\.\s+/, '')
                    };
                }
                // ID行を検出
                else if (trimmedLine.startsWith('- ID:') && currentPage) {
                    currentPage.id = trimmedLine.replace('- ID:', '').trim();
                }
                // 説明行を検出
                else if (trimmedLine.startsWith('- 説明:') && currentPage) {
                    currentPage.description = trimmedLine.replace('- 説明:', '').trim();
                }
                // ルート行を検出
                else if (trimmedLine.startsWith('- ルート:') && currentPage) {
                    currentPage.route = trimmedLine.replace('- ルート:', '').trim();
                }
                // コンポーネント行を検出
                else if (trimmedLine.startsWith('- コンポーネント:') && currentPage) {
                    currentPage.components = trimmedLine.replace('- コンポーネント:', '').split(',').map(c => c.trim());
                }
                // APIエンドポイント行を検出
                else if (trimmedLine.startsWith('- API エンドポイント:') && currentPage) {
                    currentPage.apiEndpoints = trimmedLine.replace('- API エンドポイント:', '').split(',').map(e => e.trim());
                }
            }
            // 最後のページを保存
            if (currentPage && currentPage.id && currentPage.name) {
                pages.push({
                    id: currentPage.id,
                    name: currentPage.name,
                    description: currentPage.description || '',
                    route: currentPage.route || '/',
                    components: currentPage.components || [],
                    apiEndpoints: currentPage.apiEndpoints || []
                });
            }
        }
        return pages;
    }
    /**
     * ディレクトリ構造を生成
     */
    async generateDirectoryStructure(pages) {
        try {
            logger_1.Logger.info('ディレクトリ構造生成を開始');
            const pagesList = pages.map(page => `- ${page.name} (ID: ${page.id}, ルート: ${page.route})`).join('\n');
            const prompt = `あなたはシステム設計のエキスパートです。以下のページ一覧に基づいて、最適なディレクトリ構造を提案してください。

ページ一覧:
${pagesList}

フロントエンドはページ別構造、バックエンドは機能別構造を採用し、不要なディレクトリは作成しないでください。
フロントエンドはReactとMaterial UIを使用し、バックエンドはNode.jsとExpressを使用します。

以下の形式でディレクトリ構造を出力してください:

/project-root
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── ... (説明)
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   └── ... (説明)
│   │   │   └── ... (説明)
│   │   ├── pages/
│   │   │   ├── HomePage/
│   │   │   │   ├── HomePage.tsx
│   │   │   │   └── ... (説明)
│   │   │   └── ... (他のページごとに同様)
│   │   └── ... (説明)
│   └── ... (説明)
├── backend/
│   ├── controllers/
│   │   └── ... (説明)
│   ├── models/
│   │   └── ... (説明)
│   └── ... (説明)
└── ... (説明)

必要最小限のディレクトリ構造を提案し、各ディレクトリとファイルの目的を簡潔に説明してください。`;
            const aiResponse = await this.aiService.sendMessage(prompt, 'design');
            return aiResponse;
        }
        catch (error) {
            logger_1.Logger.error('ディレクトリ構造生成エラー', error);
            throw error;
        }
    }
    /**
     * 要件定義書を生成
     */
    async generateSpecification(pages, directoryStructure) {
        try {
            logger_1.Logger.info('要件定義書生成を開始');
            const pagesList = pages.map(page => `- ${page.name} (ID: ${page.id}, ルート: ${page.route})\n  説明: ${page.description}\n  コンポーネント: ${page.components.join(', ')}\n  API エンドポイント: ${page.apiEndpoints.join(', ')}`).join('\n\n');
            const prompt = `あなたはシステム設計のエキスパートです。以下のページ一覧とディレクトリ構造に基づいて、実装可能な詳細な要件定義書を作成してください。

ページ一覧:
${pagesList}

ディレクトリ構造:
${directoryStructure}

要件定義書は以下のセクションを含めてください:

1. プロジェクト概要
2. 機能要件
   - 各ページの機能詳細
   - ユーザーフロー
3. 非機能要件
   - パフォーマンス要件
   - セキュリティ要件
4. フロントエンド実装仕様
   - 使用技術
   - コンポーネント設計
   - 状態管理
5. バックエンド実装仕様
   - API設計
   - データモデル
   - エラーハンドリング
6. 開発タスクリスト
   - 優先順位付きのタスク一覧

詳細で具体的な要件定義書を作成してください。他のAIが実装可能な形での明確な仕様を含めてください。`;
            const aiResponse = await this.aiService.sendMessage(prompt, 'design');
            return aiResponse;
        }
        catch (error) {
            logger_1.Logger.error('要件定義書生成エラー', error);
            throw error;
        }
    }
    /**
     * AIアシスタントのメッセージを処理
     * @returns 処理結果とコードブロック（存在する場合）
     */
    async processAiAssistantMessage(message, existingMockup) {
        try {
            logger_1.Logger.info('AIアシスタントへのメッセージを処理:', message);
            // システムプロンプト
            const systemPrompt = `あなたはUI/UX設計のエキスパートビジュアライザーです。
非技術者の要望を具体的な形にし、技術者が実装できる明確なモックアップと仕様に変換する役割を担います。

目的：
非技術者の要望を視覚的に具現化し、ページや機能を洗い出して完璧なモックアップを形成します。
＊モックアップはモックデータを使い、この時点でかなり精密につくりあげておくこと。

Phase#1： プロジェクト情報の収集
まず以下の情報を収集することから始めてください：
  - 業界や分野（ECサイト、SNS、情報サイト、管理ツールなど）
  - ターゲットユーザー（年齢層、技術レベルなど）
  - 競合他社やインスピレーションとなる既存サービス
  - デザインテイスト（モダン、シンプル、カラフルなど）
このフェーズは会話形式で進め、ユーザーの回答を深掘りしてください。

Phase#2： 必要なページと機能の策定
収集した情報をもとに、以下を明確にします：
  - 必要なページ一覧とその役割
  - 各ページの主要コンポーネント
  - ユーザーフロー
  - データ構造

Phase#3：各ページの詳細モックアップ作成

【生成規則】
・必ず以下の要素を含む完全なHTMLファイルを一括生成すること:
  1. 必要なすべてのCDNライブラリ（最新の安定バージョンを使用）
  2. スタイリングとレイアウト用のCSS
  3. モックデータとロジック
  4. エラーハンドリング
  5. 視覚的フィードバック用のローディング表示

【テンプレート必須要素】
1. Reactの初期化コード
2. MaterialUIのセットアップ
3. グローバルスタイルの定義
4. エラーバウンダリ
5. ローディング表示
6. レスポンシブ対応
7. アニメーションとトランジション

【品質保証項目】
・HTMLファイルを開いた直後から正常動作すること
・すべてのライブラリが正しい順序で読み込まれること
・視覚的要素が即座に表示されること
・コンソールエラーが発生しないこと

鉄の掟：
・常に1問1答を心がける
・具体的で詳細な質問を通じて、ユーザーの真のニーズを引き出す
・モックアップは常に実際のユースケースを想定した実用的なものにする
・会話の流れを優先し、必要な情報を柔軟に収集する

重要：モックアップを作成したら、それに対して即時に詳細なフィードバックを提供してください。ブラウザでの表示方法を案内し、モックアップの主要な機能や特徴を説明してください。`;
            // AIにプロンプトを送信
            let prompt = '';
            let isUpdate = false;
            if (existingMockup) {
                isUpdate = true;
                // 既存のモックアップを修正する場合
                let existingCode = {
                    html: '',
                    css: '',
                    js: ''
                };
                // 既存ファイルの読み込み
                if (existingMockup.htmlPath && fs.existsSync(existingMockup.htmlPath)) {
                    existingCode.html = fs.readFileSync(existingMockup.htmlPath, 'utf8');
                }
                if (existingMockup.cssPath && fs.existsSync(existingMockup.cssPath)) {
                    existingCode.css = fs.readFileSync(existingMockup.cssPath, 'utf8');
                }
                if (existingMockup.jsPath && fs.existsSync(existingMockup.jsPath)) {
                    existingCode.js = fs.readFileSync(existingMockup.jsPath, 'utf8');
                }
                // モックアップ更新用のプロンプト
                prompt = `${systemPrompt}

あなたは既存のモックアップを修正する任務があります。
既存のコードを与えられた指示に従って修正し、完全な修正版を返してください。
元のコードの構造と機能を維持しながら、ユーザーの要件に合わせて変更してください。

既存のHTML:
\`\`\`html
${existingCode.html}
\`\`\`

既存のCSS:
\`\`\`css
${existingCode.css}
\`\`\`

既存のJavaScript:
\`\`\`js
${existingCode.js}
\`\`\`

ユーザーの修正依頼: ${message}

上記のコードを修正し、以下のフォーマットで完全なコードブロックを返してください。
古いコードをそのまま変更せず、修正後の完全な新しいコードを返してください。

\`\`\`html
<!DOCTYPE html>
<html>
...修正後の完全なHTMLコード...
</html>
\`\`\`

\`\`\`css
/* 修正後の完全なCSSコード */
...
\`\`\`

\`\`\`js
// 修正後の完全なJavaScriptコード
...
\`\`\`

修正箇所の概要と変更点も説明してください。`;
            }
            else {
                // 新規モックアップ作成の場合
                prompt = `${systemPrompt}

ユーザーメッセージ: ${message}

以下のフォーマットで回答してください：
1. 通常のテキスト回答
2. もしコードを生成する場合は、必ずマークダウンのコードブロック記法（\`\`\`言語名）を使用してください。
3. ユーザーが要求するコードは、すぐに実行可能かつ完全な形で提供してください。

例：
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <title>モックアップ</title>
</head>
<body>
  <!-- コンテンツ -->
</body>
</html>
\`\`\`

コードブロックの直前に <!-- filename: ファイル名 --> の形式でファイル名を指定すると、そのファイル名で保存されます。
例：<!-- filename: index.html -->

回答を始めてください。`;
            }
            let aiResponse;
            try {
                aiResponse = await this.aiService.sendMessage(prompt, 'design');
                logger_1.Logger.debug('AIからの応答:', aiResponse);
            }
            catch (error) {
                logger_1.Logger.error('AI API呼び出しエラー', error);
                // エラーの場合はモックレスポンス
                aiResponse = "すみません、AIサービスとの通信に問題が発生しました。後でもう一度お試しください。";
            }
            // コードブロックを抽出
            const codeBlocks = this.extractCodeBlocks(aiResponse);
            // 更新の場合はファイル名を元のものに設定
            if (isUpdate && codeBlocks.length > 0) {
                // ファイル名を元のファイル名にマッピング
                for (const codeBlock of codeBlocks) {
                    if (codeBlock.language === 'html' && existingMockup?.htmlPath) {
                        codeBlock.filename = path.basename(existingMockup.htmlPath);
                    }
                    else if (codeBlock.language === 'css' && existingMockup?.cssPath) {
                        codeBlock.filename = path.basename(existingMockup.cssPath);
                    }
                    else if (['js', 'javascript', 'jsx'].includes(codeBlock.language) && existingMockup?.jsPath) {
                        codeBlock.filename = path.basename(existingMockup.jsPath);
                    }
                }
            }
            return {
                message: aiResponse,
                codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
                isUpdate
            };
        }
        catch (error) {
            logger_1.Logger.error('AIアシスタントメッセージ処理エラー', error);
            return {
                message: `エラーが発生しました: ${error.message}`
            };
        }
    }
    /**
     * AIレスポンスからコードブロックを抽出
     */
    extractCodeBlocks(response) {
        const codeBlocks = [];
        // コードブロック抽出用の正規表現
        const codeBlockRegex = /```(\w+)\s*([\s\S]*?)```/g;
        // ファイル名抽出用の正規表現
        const filenameRegex = /<!--\s*filename:\s*([^>\s]+)\s*-->/;
        let match;
        let lastIndex = 0;
        logger_1.Logger.debug('コードブロック抽出処理を開始: レスポンス長=' + response.length);
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const language = match[1].trim().toLowerCase();
            const code = match[2].trim();
            logger_1.Logger.debug(`コードブロック発見: 言語=${language}, コード長=${code.length}`);
            // コードブロックの前のテキストを調べてファイル名を検索
            const precedingText = response.substring(lastIndex, match.index);
            const filenameMatch = precedingText.match(filenameRegex);
            let filename = filenameMatch ? filenameMatch[1] : undefined;
            // ファイル名がない場合は適切な拡張子のあるファイル名を生成
            if (!filename) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const extension = this.getExtensionForLanguage(language);
                filename = `generated-${timestamp}${extension}`;
                logger_1.Logger.debug(`ファイル名生成: ${filename}`);
            }
            const codeBlock = {
                language,
                code,
                filename
            };
            // コードが有効かチェック
            if (code && code.trim().length > 0) {
                codeBlocks.push(codeBlock);
                logger_1.Logger.debug(`有効なコードブロックを追加: ${filename}`);
            }
            else {
                logger_1.Logger.warn(`空のコードブロックはスキップします: 言語=${language}`);
            }
            lastIndex = codeBlockRegex.lastIndex;
        }
        logger_1.Logger.info(`${codeBlocks.length}個のコードブロックを抽出しました`);
        return codeBlocks;
    }
    /**
     * 言語に対応する拡張子を取得
     */
    getExtensionForLanguage(language) {
        const languageMap = {
            'javascript': '.js',
            'js': '.js',
            'typescript': '.ts',
            'ts': '.ts',
            'html': '.html',
            'css': '.css',
            'json': '.json',
            'python': '.py',
            'py': '.py',
            'java': '.java',
            'c': '.c',
            'cpp': '.cpp',
            'csharp': '.cs',
            'cs': '.cs',
            'go': '.go',
            'ruby': '.rb',
            'php': '.php',
            'swift': '.swift',
            'kotlin': '.kt',
            'rust': '.rs',
            'shell': '.sh',
            'bash': '.sh',
            'sql': '.sql',
            'xml': '.xml',
            'yaml': '.yml',
            'markdown': '.md',
            'md': '.md'
        };
        return languageMap[language.toLowerCase()] || '.txt';
    }
}
exports.MockupDesigner = MockupDesigner;
//# sourceMappingURL=mockupDesigner.js.map