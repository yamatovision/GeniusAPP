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
    const lpReplicaScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'components', 'lpReplica', 'lpReplica.js')
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
      <title>ブルーランプ</title>
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
            <div class="card">
              <!-- LPレプリカコンテンツ（直接表示） -->
              ${this._generateLPReplicaContent()}
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
      
      <!-- LPレプリカコンポーネント専用スクリプト -->
      <script type="module" nonce="${nonce}" src="${lpReplicaScriptUri}"></script>
      
      <!-- ファイルブラウザコンポーネント専用スクリプト -->
      <!-- ファイルブラウザのスクリプトは削除済み -->
    </body>
    </html>`;
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

  /**
   * LPレプリカコンテンツを生成（タブなしで直接表示）
   */
  private static _generateLPReplicaContent(): string {
    return `
      <div id="lp-replica-content" class="lp-replica-container">
        <div class="section">
          <!-- レプリカ作成フォーム -->
          <div class="replica-create-form" id="replica-create-form">
            <div class="input-group">
              <label for="replica-url">対象ページのURL</label>
              <input 
                type="url" 
                id="replica-url" 
                class="input" 
                placeholder="https://example.com" 
                required
              />
            </div>
            
            <button id="create-replica-btn" class="button button-primary">
              <span class="material-icons">content_copy</span>
              レプリカを作成
            </button>
            
            <div id="replica-status" class="status-message" style="display: none;"></div>
          </div>
          
          <!-- レプリカビューア -->
          <div class="replica-viewer" id="replica-viewer" style="display: none;">
            <div class="viewer-header">
              <div class="viewer-title-section">
                <h4>レプリカビューア</h4>
                <p class="viewer-instruction">
                  <span class="material-icons">info</span>
                  要素をAlt+クリック（Mac: Option+クリック）すると、要素情報を取得できます。
                </p>
              </div>
              <div class="viewer-actions">
                <button id="refresh-replica-btn" class="button button-icon" title="更新">
                  <span class="material-icons">refresh</span>
                </button>
                <button id="open-external-btn" class="button button-icon" title="ブラウザで開く">
                  <span class="material-icons">open_in_new</span>
                </button>
              </div>
            </div>
            
            <iframe 
              id="replica-iframe" 
              class="replica-iframe"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation allow-downloads"
              style="width: 100%; height: 600px; border: 1px solid var(--app-border);"
            ></iframe>
          </div>
          
          <!-- 要素情報表示エリア -->
          <div class="element-info" id="element-info" style="display: none;">
            <h4>選択された要素情報</h4>
            <pre id="element-info-content"></pre>
            <button id="copy-element-info-btn" class="button button-secondary">
              <span class="material-icons">content_copy</span>
              情報をコピー
            </button>
          </div>
        </div>
      </div>
    `;
  }
}