import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { ClaudeMdService } from '../utils/ClaudeMdService';

export class RequirementsViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private claudeMdService = ClaudeMdService.getInstance();
  
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview();

    // メッセージハンドラの設定
    webviewView.webview.onDidReceiveMessage(async (data) => {
      Logger.debug(`Received message from Requirements view: ${JSON.stringify(data)}`);
      
      switch (data.type) {
        case 'sendMessage':
          // AIへのメッセージ送信処理
          webviewView.webview.postMessage({
            type: 'receiveMessage',
            message: `AIからの応答: ${data.message}`,
            sender: 'ai'
          });
          break;
        
        // 追加: ファイルプレビューハンドラ
        case 'previewFile':
          this.handleFilePreview(data.filePath);
          break;
        
        // 追加: ファイル更新ハンドラ
        case 'updateFile':
          this.handleFileUpdate(data.filePath, data.content);
          break;
          
        // 追加: ディレクトリツリー表示ハンドラ
        case 'showDirectoryTree':
          this.handleDirectoryTree();
          break;
          
        // 初期データロード
        case 'initialData':
          this.loadInitialData();
          break;
      }
    });
    
    // 初期データロード
    this.loadInitialData();
  }
  
  // 追加: 初期データ読み込み
  private async loadInitialData() {
    if (!this._view) return;
    
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) return;
      
      const projectRoot = workspaceFolders[0].uri.fsPath;
      const requirementsPath = path.join(projectRoot, 'docs', 'requirements.md');
      const structurePath = path.join(projectRoot, 'docs', 'structure.md');
      
      // 要件定義ファイルの読み込み
      let requirementsContent = '';
      if (fs.existsSync(requirementsPath)) {
        requirementsContent = fs.readFileSync(requirementsPath, 'utf8');
      }
      
      // ディレクトリ構造ファイルの読み込み
      let structureContent = '';
      if (fs.existsSync(structurePath)) {
        structureContent = fs.readFileSync(structurePath, 'utf8');
      }
      
      // WebViewに初期データ送信
      this._view.webview.postMessage({
        type: 'initialData',
        requirementsContent,
        structureContent,
        projectRoot
      });
    } catch (error) {
      Logger.error('初期データ読み込みエラー', error as Error);
    }
  }
  
  // 追加: ファイルプレビューハンドラ
  private async handleFilePreview(filePath: string) {
    if (!this._view) return;
    
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) return;
      
      const projectRoot = workspaceFolders[0].uri.fsPath;
      const fullPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(projectRoot, filePath);
      
      if (!fs.existsSync(fullPath)) {
        this._view.webview.postMessage({
          type: 'fileError',
          message: `ファイルが見つかりません: ${filePath}`
        });
        return;
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      
      this._view.webview.postMessage({
        type: 'fileContent',
        filePath,
        content
      });
    } catch (error) {
      Logger.error(`ファイルプレビューエラー: ${filePath}`, error as Error);
      
      if (this._view) {
        this._view.webview.postMessage({
          type: 'fileError',
          message: `ファイル読み込みエラー: ${(error as Error).message}`
        });
      }
    }
  }
  
  // 追加: ファイル更新ハンドラ
  private async handleFileUpdate(filePath: string, content: string) {
    if (!this._view) return;
    
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) return;
      
      const projectRoot = workspaceFolders[0].uri.fsPath;
      const fullPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(projectRoot, filePath);
      
      // ディレクトリが存在しない場合、作成
      const dirPath = path.dirname(fullPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // ファイル書き込み
      fs.writeFileSync(fullPath, content, 'utf8');
      
      // CLAUDE.md進捗状況も更新
      const isRequirements = filePath.includes('requirements.md');
      const isStructure = filePath.includes('structure.md');
      
      if (isRequirements || isStructure) {
        const updates: { [key: string]: boolean } = {};
        
        if (isRequirements) {
          updates['requirements'] = true;
        }
        
        if (isStructure) {
          updates['directoryStructure'] = true;
        }
        
        await this.claudeMdService.updateMultipleProgressStatus(projectRoot, updates);
        
        // 構造ファイルが更新された場合、ファイル一覧も抽出
        if (isStructure) {
          await this.claudeMdService.extractFileListFromStructure(projectRoot);
        }
      }
      
      this._view.webview.postMessage({
        type: 'fileSaved',
        filePath,
        message: `ファイルを保存しました: ${filePath}`
      });
    } catch (error) {
      Logger.error(`ファイル更新エラー: ${filePath}`, error as Error);
      
      if (this._view) {
        this._view.webview.postMessage({
          type: 'fileError',
          message: `ファイル保存エラー: ${(error as Error).message}`
        });
      }
    }
  }
  
  // 追加: ディレクトリツリー表示ハンドラ
  private async handleDirectoryTree() {
    if (!this._view) return;
    
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) return;
      
      const projectRoot = workspaceFolders[0].uri.fsPath;
      const structurePath = path.join(projectRoot, 'docs', 'structure.md');
      
      if (fs.existsSync(structurePath)) {
        const structureContent = fs.readFileSync(structurePath, 'utf8');
        
        // コードブロックを抽出
        const codeBlockRegex = /```[\s\S]*?```/g;
        const codeBlocks = structureContent.match(codeBlockRegex);
        
        if (codeBlocks && codeBlocks.length > 0) {
          // 最初のコードブロックを処理
          const treeContent = codeBlocks[0].replace(/```/g, '').trim();
          
          this._view.webview.postMessage({
            type: 'directoryTree',
            treeContent
          });
        } else {
          this._view.webview.postMessage({
            type: 'fileError',
            message: 'ディレクトリ構造のコードブロックが見つかりません'
          });
        }
      } else {
        this._view.webview.postMessage({
          type: 'fileError',
          message: 'ディレクトリ構造ファイルが見つかりません'
        });
      }
    } catch (error) {
      Logger.error('ディレクトリツリー表示エラー', error as Error);
      
      if (this._view) {
        this._view.webview.postMessage({
          type: 'fileError',
          message: `ディレクトリツリー表示エラー: ${(error as Error).message}`
        });
      }
    }
  }

  private _getHtmlForWebview() {
    // CSS と JS ファイルのURI取得
    const scriptUri = this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'requirementsVisualizer.js')
    );
    
    const styleUri = this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'requirementsVisualizer.css')
    );
    
    const resetCssUri = this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );

    return /*html*/`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>要件とディレクトリ構造プレビュー</title>
        <link rel="stylesheet" href="${resetCssUri}">
        <link rel="stylesheet" href="${styleUri}">
      </head>
      <body>
        <div class="container">
          <div class="tabs">
            <button id="tab-requirements" class="tab-button active">要件定義</button>
            <button id="tab-structure" class="tab-button">ディレクトリ構造</button>
            <button id="tab-tree" class="tab-button">視覚的ツリー</button>
          </div>
          
          <div class="tab-content" id="content-requirements">
            <div class="file-preview">
              <div class="file-preview-header">
                <h3>requirements.md</h3>
                <div class="actions">
                  <button id="edit-requirements" class="action-button">編集</button>
                  <button id="save-requirements" class="action-button" disabled>保存</button>
                </div>
              </div>
              <div class="file-preview-content">
                <div id="requirements-preview" class="preview-mode"></div>
                <textarea id="requirements-editor" class="edit-mode hidden"></textarea>
              </div>
            </div>
          </div>
          
          <div class="tab-content hidden" id="content-structure">
            <div class="file-preview">
              <div class="file-preview-header">
                <h3>structure.md</h3>
                <div class="actions">
                  <button id="edit-structure" class="action-button">編集</button>
                  <button id="save-structure" class="action-button" disabled>保存</button>
                </div>
              </div>
              <div class="file-preview-content">
                <div id="structure-preview" class="preview-mode"></div>
                <textarea id="structure-editor" class="edit-mode hidden"></textarea>
              </div>
            </div>
          </div>
          
          <div class="tab-content hidden" id="content-tree">
            <div class="directory-tree">
              <div class="tree-header">
                <h3>ディレクトリツリー</h3>
              </div>
              <div id="tree-view" class="tree-content"></div>
            </div>
          </div>
          
          <div class="chat-container">
            <div id="chat-messages" class="chat-messages"></div>
            <div class="chat-input-container">
              <textarea id="chat-input" placeholder="AIアシスタントに質問・相談してください..."></textarea>
              <button id="send-button" class="action-button">送信</button>
            </div>
          </div>
          
          <div class="status-bar">
            <span id="status-message"></span>
          </div>
        </div>

        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }
}