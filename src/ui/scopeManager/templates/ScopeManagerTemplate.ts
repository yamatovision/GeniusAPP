import * as vscode from 'vscode';
import { HtmlTemplateGenerator } from './HtmlTemplateGenerator';
import { IProjectInfo } from '../types/ScopeManagerTypes';

/**
 * スコープマネージャーのHTML生成を担当
 */
export class ScopeManagerTemplate {
  /**
   * スコープマネージャーのHTMLを生成
   * @param params パラメータオブジェクト
   */
  public static generateHtml(params: {
    webview: vscode.Webview;
    extensionUri: vscode.Uri;
    activeTabId: string;
    activeProject: IProjectInfo | null;
  }): string {
    const { webview, extensionUri, activeTabId, activeProject } = params;

    // nonce値を生成
    const nonce = HtmlTemplateGenerator.generateNonce();

    // CSPを設定
    const csp = HtmlTemplateGenerator.generateCSP(webview, nonce);

    // スタイルシートやスクリプトのURIを取得
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'styles', 'reset.css')
    );
    const designSystemStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'styles', 'design-system.css')
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'scopeManager.css')
    );
    // DialogManagerのスタイルシート
    const dialogManagerStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'components', 'dialogManager', 'dialogManager.css')
    );
    // PromptCardsのスタイルシート
    const promptCardsStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'components', 'promptCards', 'promptCards.css')
    );
    // スクリプト
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'scopeManager.js')
    );
    const sharingPanelScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'components', 'sharingPanel', 'sharingPanel.js')
    );

    // Material Iconsの読み込み
    const materialIconsUrl = 'https://fonts.googleapis.com/icon?family=Material+Icons';

    // プロジェクト情報の取得
    const projectName = activeProject?.name || '選択なし';
    const projectPath = activeProject?.path || '';

    // HTMLを生成して返す
    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="${csp}">
      <link href="${styleResetUri}" rel="stylesheet">
      <link href="${designSystemStyleUri}" rel="stylesheet">
      <link href="${styleMainUri}" rel="stylesheet">
      <link href="${dialogManagerStyleUri}" rel="stylesheet">
      <link href="${promptCardsStyleUri}" rel="stylesheet">
      <!-- ファイルブラウザのスタイルシートは削除済み -->
      <link href="${materialIconsUrl}" rel="stylesheet">
      <title>AppGenius スコープマネージャー</title>
      <style>
        /* VSCodeのネイティブドラッグ&ドロップメッセージを非表示にする */
        .monaco-editor .dnd-overlay, 
        .monaco-editor .dnd-overlay *,
        .monaco-dnd-overlay,
        .monaco-dnd-tree-overlay,
        [role="tooltip"][aria-label*="シフト"],
        [role="tooltip"][aria-label*="ドロップ"],
        [role="tooltip"][aria-label*="⌘"],
        [role="tooltip"][aria-label*="Cmd"] {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        
        /* ドラッグ中のデフォルトポインタを変更 */
        body.dragging * {
          cursor: copy !important;
        }
        
        /* ドラッグ効果をより目立たせる */
        .drag-effect.active {
          background-color: rgba(74, 105, 189, 0.3) !important;
          z-index: 9999999 !important;
        }
        
        /* 選択中プロジェクトのスタイル */
        .project-item.active {
          background-color: rgba(74, 105, 189, 0.1);
          border-left: 3px solid var(--app-primary);
        }
        
        .file-input {
          opacity: 0;
          position: absolute;
          pointer-events: none;
        }
      </style>
      <script nonce="${nonce}">
        // 即時関数でVSCodeのドラッグ&ドロップメッセージを抑制
        (function() {
          // VSCodeのドラッグ&ドロップメッセージを検出して非表示にする
          function suppressVSCodeDragDropMessage() {
            // ドラッグ&ドロップ関連のオーバーレイを監視して非表示にする
            const observer = new MutationObserver(function(mutations) {
              document.querySelectorAll('.monaco-editor .dnd-overlay, .monaco-dnd-overlay, [aria-label*="ドロップする"], [aria-label*="⌘"]').forEach(function(el) {
                if (el) {
                  el.style.display = 'none';
                  el.style.opacity = '0';
                  el.style.visibility = 'hidden';
                  el.style.pointerEvents = 'none';
                }
              });
            });
            
            // document全体を監視
            observer.observe(document.documentElement, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style', 'class']
            });
            
            // ドラッグ&ドロップイベントをキャプチャ
            ['dragstart', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(function(eventName) {
              document.addEventListener(eventName, function(e) {
                // VSCodeのオーバーレイを強制的に非表示
                document.querySelectorAll('.monaco-editor .dnd-overlay, .monaco-dnd-overlay, [aria-label*="ドロップする"], [aria-label*="⌘"]').forEach(function(el) {
                  if (el) el.style.display = 'none';
                });
              }, true);
            });
          }
          
          // DOM読み込み完了時または既に読み込まれている場合に実行
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', suppressVSCodeDragDropMessage);
          } else {
            suppressVSCodeDragDropMessage();
          }
        })();
      </script>
    </head>
    <body>
      <div class="scope-manager-container">
        <div class="main-content">
          <!-- 左側: プロジェクトナビゲーション -->
          <div class="project-nav">
            <button class="toggle-nav-btn" id="toggle-nav-btn" title="パネルを開閉">
              <span class="material-icons">chevron_left</span>
            </button>
            <div class="project-label">PRJ</div>
            <div class="filter-bar">
              <input type="text" class="search-input" placeholder="プロジェクト検索...">
            </div>
            <h3 style="margin-top: 10px;">プロジェクト</h3>
            
            <div class="project-actions">
              <button class="button button-secondary" id="new-project-btn">
                <span class="material-icons">add</span>
                新規作成
              </button>
              <button class="button button-secondary" id="load-project-btn">
                <span class="material-icons">folder_open</span>
                読み込む
              </button>
            </div>
            
            <div id="project-list" class="project-list">
              <!-- プロジェクトリストはJSで動的に生成 -->
            </div>
          </div>
          
          <!-- 右側: コンテンツエリア -->
          <div class="content-area">
            <!-- タブ付きカード -->
            <div class="card">
              <div class="tabs">
                <div class="project-display">
                  <span class="project-name">${projectName}</span>
                  <span class="project-path-display">${projectPath}</span>
                </div>
                <div class="tabs-container">
                  <div class="tab ${activeTabId === 'scope-progress' ? 'active' : ''}" data-tab="scope-progress">進捗状況</div>
                  <div class="tab ${activeTabId === 'requirements' ? 'active' : ''}" data-tab="requirements">要件定義</div>
                  <div class="tab ${activeTabId === 'files' ? 'active' : ''}" data-tab="files">ファイル</div>
                  <div class="tab ${activeTabId === 'claude-code' ? 'active' : ''}" data-tab="claude-code">ClaudeCode連携</div>
                  <div class="tab ${activeTabId === 'tools' ? 'active' : ''}" data-tab="tools">モックアップギャラリー</div>
                </div>
              </div>
              
              <!-- 進捗状況タブコンテンツ -->
              ${this._generateProgressTabContent(activeTabId)}

              <!-- 要件定義タブコンテンツ -->
              ${this._generateRequirementsTabContent(activeTabId)}

              <!-- ファイルブラウザタブコンテンツ -->
              <!-- ファイルブラウザタブコンテンツは削除されました -->

              <!-- ClaudeCode連携タブコンテンツ -->
              ${this._generateClaudeCodeTabContent(activeTabId)}
              
              <!-- 開発ツールタブコンテンツ (モックアップギャラリー表示用のプレースホルダ) -->
              ${this._generateToolsTabContent(activeTabId)}

              <!-- ファイルタブコンテンツ -->
              ${this._generateFilesTabContent(activeTabId)}
            </div>
          </div>
        </div>
      </div>
      
      <!-- 開発プロンプトモーダル -->
      ${this._generatePromptModalContent()}
      
      <div id="error-container" style="display: none; position: fixed; bottom: 20px; right: 20px; background-color: var(--app-danger); color: white; padding: 10px; border-radius: 4px;"></div>
      
      <!-- メインスクリプト -->
      <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      
      <!-- 共有パネルコンポーネント専用スクリプト -->
      <script type="module" nonce="${nonce}" src="${sharingPanelScriptUri}"></script>
      
      <!-- ファイルブラウザコンポーネント専用スクリプト -->
      <!-- ファイルブラウザのスクリプトは削除済み -->
    </body>
    </html>`;
  }

  /**
   * 進捗状況タブのコンテンツを生成
   */
  private static _generateProgressTabContent(activeTabId: string): string {
    return `
      <div id="scope-progress-tab" class="tab-content ${activeTabId === 'scope-progress' ? 'active' : ''}">
        <div class="card-body">
          <div class="markdown-content">
            <!-- ここにSCOPE_PROGRESS.mdの内容がマークダウン表示される -->
            <p>読み込み中...</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 要件定義タブのコンテンツを生成
   */
  private static _generateRequirementsTabContent(activeTabId: string): string {
    return `
      <div id="requirements-tab" class="tab-content ${activeTabId === 'requirements' ? 'active' : ''}">
        <div class="card-body">
          <div class="markdown-content">
            <!-- ここにrequirements.mdの内容がマークダウン表示される -->
            <p>読み込み中...</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ClaudeCode連携タブのコンテンツを生成
   */
  private static _generateClaudeCodeTabContent(activeTabId: string): string {
    return `
      <div id="claude-code-tab" class="tab-content ${activeTabId === 'claude-code' ? 'active' : ''}">
        <div class="claude-share-container">
          <!-- 左側：テキスト入力エリア -->
          <div class="text-input-area">
            <textarea class="share-textarea" placeholder="ここにClaudeCodeと共有したいテキストを入力..."></textarea>
            <!-- ボタンエリア -->
            <div class="action-buttons">
              <button class="button button-secondary" id="clear-button">クリア</button>
              <button class="button" id="share-to-claude">保存</button>
            </div>
            
            <!-- 保存結果通知（成功時のみ表示） -->
            <div class="save-notification" id="save-notification" style="display: none;">
              <span class="material-icons success-icon">check_circle</span>
              <span class="notification-text">保存完了</span>
            </div>
          </div>
          
          <!-- 右側：画像アップロードエリアと履歴 -->
          <div class="image-upload-area">
            <!-- ドロップゾーン -->
            <div class="drop-zone" id="drop-zone">
              <span class="material-icons">add_photo_alternate</span>
              <p>画像をアップロード<br><span style="font-size: 12px; color: var(--app-text-secondary);">（ファイルをドラッグ＆ドロップ）</span></p>
              <button class="button-secondary" id="file-select-btn">ブラウズ...</button>
              <input type="file" id="file-input" accept="image/*" style="display: none;">
            </div>
            
            <!-- 履歴表示エリア -->
            <div class="history-container">
              <h4>共有履歴</h4>
              <div class="shared-history-list">
                <!-- 履歴アイテムはJSで動的に生成 -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ツールタブのコンテンツを生成
   */
  private static _generateToolsTabContent(activeTabId: string): string {
    return `
      <div id="tools-tab" class="tab-content ${activeTabId === 'tools' ? 'active' : ''}">
        <!-- モックアップギャラリーを表示するための空のコンテナ -->
      </div>
    `;
  }

  /**
   * ファイルタブのコンテンツを生成
   */
  private static _generateFilesTabContent(activeTabId: string): string {
    return `
      <div id="files-tab" class="tab-content ${activeTabId === 'files' ? 'active' : ''}">
        <!-- マークダウンビューワーを表示するための空のコンテナ -->
        <div class="files-container">
          <div class="files-placeholder">
            <span class="material-icons">description</span>
            <h3>マークダウンビューワーを開いています...</h3>
            <p>マークダウンビューワーが別ウィンドウで開かれます</p>
            <div class="loading-indicator">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * プロンプトモーダルのコンテンツを生成
   */
  private static _generatePromptModalContent(): string {
    return `
      <div class="toggle-share-btn" id="toggle-share-btn" style="display: flex;">
        <span class="material-icons">description</span>
        <span>開発プロンプト</span>
      </div>
      
      <div class="claude-code-share-area" id="claude-code-share">
        <div class="claude-code-share-header">
          <h3>開発プロンプト</h3>
          <div>
            <button class="button button-secondary" id="minimize-share-btn">
              <span class="material-icons">expand_more</span>
            </button>
          </div>
        </div>
        
        <!-- プロンプトグリッド - 初期表示要素なし、JSで動的に生成 -->
        <div class="prompt-grid">
          <!-- プロンプトカードはJSで動的に生成 -->
        </div>
      </div>
    `;
  }
}