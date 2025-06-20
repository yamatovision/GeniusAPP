/**
 * LPレプリカ機能のJavaScript実装
 */

// グローバル名前空間
window.lpReplica = window.lpReplica || {};

/**
 * LPレプリカマネージャー
 */
window.lpReplica.Manager = class {
    constructor() {
        console.log('[DEBUG] LPレプリカマネージャーのコンストラクタが開始されました');
        
        // VSCode APIの安全な取得（重複取得エラーを完全防止）
        console.log('[DEBUG] VSCode API状態チェック開始');
        console.log('[DEBUG] window.vscode存在確認:', typeof window.vscode, !!window.vscode);
        console.log('[DEBUG] window.vsCodeApi存在確認:', typeof window.vsCodeApi, !!window.vsCodeApi);
        
        // StateManagerが使用している可能性のある全ての名前空間をチェック
        if (window.vscode && typeof window.vscode === 'object') {
            console.log('[DEBUG] 既存のwindow.vscodeを使用します');
            this.vscode = window.vscode;
        } else if (window.vsCodeApi && typeof window.vsCodeApi === 'object') {
            console.log('[DEBUG] StateManagerの window.vsCodeApiを使用します');
            this.vscode = window.vsCodeApi;
            // 統一性のため window.vscode にも設定
            window.vscode = this.vscode;
        } else {
            console.log('[DEBUG] 既存のVSCode APIが見つかりません。新規取得を試行します');
            
            try {
                if (typeof acquireVsCodeApi === 'undefined') {
                    throw new Error('acquireVsCodeApi関数が利用できません');
                }
                
                this.vscode = acquireVsCodeApi();
                // 両方の名前空間に設定して将来の衝突を防ぐ
                window.vscode = this.vscode;
                window.vsCodeApi = this.vscode;
                console.log('[DEBUG] VSCode APIインスタンスの新規取得が完了しました');
            } catch (error) {
                console.error('[ERROR] VSCode API取得に失敗:', error);
                throw new Error('VS Code APIの取得に失敗しました: ' + error.message);
            }
        }
        this.currentProjectPath = null;
        this.isCreating = false;
        this.isCheckingReplica = false;
        
        // DOM要素をキャッシュ
        this.elements = {
            urlInput: null,
            createButton: null,
            statusDiv: null,
            createForm: null,
            viewer: null,
            iframe: null,
            refreshButton: null,
            openExternalButton: null,
            elementInfo: null,
            elementInfoContent: null,
            copyElementInfoButton: null
        };
        
        // 初期化
        this.init();
    }

    /**
     * 初期化
     */
    init() {
        // DOM要素を取得
        this.cacheElements();
        
        // イベントリスナーを設定
        this.setupEventListeners();
        
        // VSCodeからのメッセージを処理
        this.setupMessageListener();
        
        // 初期状態をチェック
        this.checkReplicaExists();
    }

    /**
     * DOM要素をキャッシュ
     */
    cacheElements() {
        console.log('[DEBUG] DOM要素のキャッシュを開始');
        
        // 要素の取得を少し待ってから実行
        const tryGetElements = () => {
            this.elements.urlInput = document.getElementById('replica-url');
            this.elements.createButton = document.getElementById('create-replica-btn');
            this.elements.statusDiv = document.getElementById('replica-status');
            this.elements.createForm = document.getElementById('replica-create-form');
            this.elements.viewer = document.getElementById('replica-viewer');
            this.elements.iframe = document.getElementById('replica-iframe');
            this.elements.refreshButton = document.getElementById('refresh-replica-btn');
            this.elements.openExternalButton = document.getElementById('open-external-btn');
            this.elements.elementInfo = document.getElementById('element-info');
            this.elements.elementInfoContent = document.getElementById('element-info-content');
            this.elements.copyElementInfoButton = document.getElementById('copy-element-info-btn');
            
            console.log('[DEBUG] キャッシュされた要素:');
            console.log('[DEBUG] - viewer:', !!this.elements.viewer);
            console.log('[DEBUG] - iframe:', !!this.elements.iframe);
            console.log('[DEBUG] - createForm:', !!this.elements.createForm);
            
            // 重要な要素が見つからない場合は少し待ってリトライ
            if (!this.elements.iframe && this.retryCount < 5) {
                this.retryCount = (this.retryCount || 0) + 1;
                console.log(`[DEBUG] iframe要素が見つかりません。リトライ ${this.retryCount}/5`);
                setTimeout(tryGetElements, 100);
                return;
            }
            
            if (!this.elements.iframe) {
                console.error('[ERROR] iframe要素が見つかりません。DOM構造を確認してください');
            }
        };
        
        tryGetElements();
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // レプリカ作成ボタン
        if (this.elements.createButton) {
            this.elements.createButton.addEventListener('click', () => this.createReplica());
        }
        
        // Enterキーでレプリカ作成
        if (this.elements.urlInput) {
            this.elements.urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.createReplica();
                }
            });
        }
        
        // 更新ボタン
        if (this.elements.refreshButton) {
            this.elements.refreshButton.addEventListener('click', () => this.refreshReplica());
        }
        
        // ブラウザで開くボタン
        if (this.elements.openExternalButton) {
            this.elements.openExternalButton.addEventListener('click', () => this.openInBrowser());
        }
        
        // 要素情報コピーボタン
        if (this.elements.copyElementInfoButton) {
            this.elements.copyElementInfoButton.addEventListener('click', () => this.copyElementInfo());
        }
    }

    /**
     * VSCodeからのメッセージリスナーを設定
     */
    setupMessageListener() {
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'replicaCreateProgress':
                    this.updateStatus(message.message, 'info');
                    break;
                    
                case 'replicaCreateSuccess':
                    this.handleCreateSuccess(message);
                    break;
                    
                case 'replicaCreateError':
                    this.handleCreateError(message);
                    break;
                    
                case 'replicaCheckResult':
                    this.handleCheckResult(message);
                    break;
                    
                case 'replicaError':
                    this.updateStatus(message.error || '処理中にエラーが発生しました', 'error');
                    break;
                    
                case 'replicaWebviewUri':
                    this.handleWebviewUri(message);
                    break;
                    
                case 'replicaHtmlContent':
                    this.handleHtmlContent(message);
                    break;
                    
                case 'replicaInfo':
                    this.handleReplicaInfo(message);
                    break;
                    
                case 'resetReplicaState':
                    this.resetReplicaState();
                    break;
                    
                case 'copyElementInfo':
                    this.handleCopyElementInfo(message);
                    break;
            }
        });
    }

    /**
     * レプリカの存在をチェック
     */
    checkReplicaExists() {
        // 既にチェック中の場合はスキップ
        if (this.isCheckingReplica) {
            console.log('[DEBUG] レプリカ存在チェックは既に実行中です');
            return;
        }
        
        this.isCheckingReplica = true;
        console.log('[DEBUG] レプリカ存在チェックを開始します');
        
        this.vscode.postMessage({
            command: 'replicaCheck'
        });
    }

    /**
     * レプリカを作成
     */
    createReplica() {
        const url = this.elements.urlInput?.value.trim();
        
        if (!url) {
            this.updateStatus('URLを入力してください', 'error');
            return;
        }
        
        // URL形式の簡単な検証
        try {
            new URL(url);
        } catch {
            this.updateStatus('有効なURLを入力してください', 'error');
            return;
        }
        
        if (this.isCreating) {
            this.updateStatus('レプリカを作成中です...', 'info');
            return;
        }
        
        this.isCreating = true;
        this.elements.createButton.disabled = true;
        this.updateStatus('レプリカの作成を開始しています...', 'info');
        
        this.vscode.postMessage({
            command: 'replicaCreate',
            url: url
        });
    }

    /**
     * 作成成功を処理
     */
    handleCreateSuccess(message) {
        this.isCreating = false;
        this.elements.createButton.disabled = false;
        this.updateStatus('レプリカの作成が完了しました！', 'success');
        
        // レプリカを表示
        this.showReplica(message.path);
    }

    /**
     * 作成エラーを処理
     */
    handleCreateError(message) {
        this.isCreating = false;
        this.elements.createButton.disabled = false;
        this.updateStatus(message.error || 'レプリカの作成に失敗しました', 'error');
    }

    /**
     * レプリカ存在チェック結果を処理
     */
    handleCheckResult(message) {
        this.isCheckingReplica = false;
        console.log('[DEBUG] レプリカ存在チェック結果:', message);
        
        if (message.exists && message.path) {
            this.showReplica(message.path);
        }
    }

    /**
     * レプリカを表示
     */
    showReplica(path) {
        if (!path) return;
        
        console.log('[DEBUG] showReplica開始:', path);
        console.log('[DEBUG] DOM要素の状態:');
        console.log('[DEBUG] - createForm:', !!this.elements.createForm, this.elements.createForm);
        console.log('[DEBUG] - viewer:', !!this.elements.viewer, this.elements.viewer);
        console.log('[DEBUG] - iframe:', !!this.elements.iframe, this.elements.iframe);
        
        // フォームを非表示
        if (this.elements.createForm) {
            this.elements.createForm.style.display = 'none';
            console.log('[DEBUG] フォームを非表示にしました');
        }
        
        // ビューアを表示
        if (this.elements.viewer) {
            this.elements.viewer.style.display = 'block';
            console.log('[DEBUG] ビューアを表示しました');
        } else {
            console.error('[ERROR] ビューア要素が見つかりません');
            // 要素を再取得
            this.elements.viewer = document.getElementById('replica-viewer');
            if (this.elements.viewer) {
                this.elements.viewer.style.display = 'block';
                console.log('[DEBUG] ビューア要素を再取得して表示しました');
            }
        }
        
        // iframeにレプリカを読み込み
        if (this.elements.iframe) {
            console.log('[DEBUG] レプリカファイルパス:', path);
            
            // VSCodeからWebview用URIを取得
            this.vscode.postMessage({
                command: 'replicaGetWebviewUri',
                path: path
            });
            
            // 暫定的に空のsrcを設定（WebviewUriレスポンス待ち）
            this.elements.iframe.src = '';
            console.log('[DEBUG] WebviewURI変換をリクエストしました');
        } else {
            console.error('[ERROR] iframe要素が見つかりません');
            // 要素を再取得
            this.elements.iframe = document.getElementById('replica-iframe');
            if (this.elements.iframe) {
                console.log('[DEBUG] iframe要素を再取得しました');
                this.vscode.postMessage({
                    command: 'replicaGetWebviewUri',
                    path: path
                });
            }
        }
    }

    /**
     * レプリカを更新
     */
    refreshReplica() {
        if (this.elements.iframe && this.elements.iframe.src) {
            // srcdoc使用を停止し、srcベースのリロードに変更
            const currentSrc = this.elements.iframe.src;
            this.elements.iframe.src = '';
            setTimeout(() => {
                this.elements.iframe.src = currentSrc;
            }, 100);
            console.log('[DEBUG] srcベースでレプリカを更新しました');
        }
    }

    /**
     * ブラウザで開く
     */
    openInBrowser() {
        this.vscode.postMessage({
            command: 'replicaOpen'
        });
    }


    /**
     * 要素情報をコピー
     */
    copyElementInfo() {
        const content = this.elements.elementInfoContent?.textContent;
        if (!content) return;
        
        // VSCodeのAPIを使用してクリップボードにコピー
        this.vscode.postMessage({
            command: 'replicaCopyElementInfo',
            text: content
        });
        
        // フィードバック
        const button = this.elements.copyElementInfoButton;
        if (button) {
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="material-icons">check</span> コピーしました';
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        }
    }

    /**
     * iframe内からのコピー要求を処理
     */
    handleCopyElementInfo(message) {
        if (!message.text) return;
        
        // VSCodeのAPIを使用してクリップボードにコピー
        this.vscode.postMessage({
            command: 'replicaCopyElementInfo',
            text: message.text
        });
    }

    /**
     * WebviewURI応答を処理
     */
    handleWebviewUri(message) {
        console.log('[DEBUG] WebviewURI処理開始:', message.webviewUri);
        
        // iframe要素を再取得（念のため）
        if (!this.elements.iframe) {
            this.elements.iframe = document.getElementById('replica-iframe');
            console.log('[DEBUG] iframe要素を再取得:', !!this.elements.iframe);
        }
        
        if (message.webviewUri && this.elements.iframe) {
            console.log('[DEBUG] WebviewURIを受信:', message.webviewUri);
            
            // iframeのロードイベントを監視
            this.elements.iframe.onload = () => {
                console.log('[DEBUG] iframeのロードが完了しました');
                console.log('[DEBUG] iframe URL:', this.elements.iframe.src);
            };
            
            this.elements.iframe.onerror = (error) => {
                console.error('[ERROR] iframeのロードに失敗しました:', error);
            };
            
            // srcを設定
            this.elements.iframe.src = message.webviewUri;
            console.log('[DEBUG] iframeのsrcを設定しました');
            
            // 5秒後にロード状況をチェック（エラーハンドリング強化）
            setTimeout(() => {
                try {
                    const iframeDoc = this.elements.iframe.contentDocument || this.elements.iframe.contentWindow?.document;
                    if (iframeDoc) {
                        console.log('[DEBUG] iframe内のドキュメント:', iframeDoc.title || 'タイトルなし', iframeDoc.body?.innerHTML?.substring(0, 200));
                        
                        // jQueryライブラリの存在確認と警告
                        this.checkjQueryDependencies(iframeDoc);
                    } else {
                        console.warn('[WARN] iframe内のドキュメントにアクセスできません（CORS制限の可能性）');
                        this.showCorsWarning();
                    }
                } catch (error) {
                    console.warn('[WARN] iframe内ドキュメントアクセスエラー:', error.message);
                    
                    // クロスオリジンエラーの場合の特別な処理
                    if (error.message.includes('cross-origin') || error.message.includes('Blocked a frame')) {
                        this.showCorsWarning();
                    }
                }
            }, 5000);
        } else {
            console.error('[ERROR] WebviewURIの設定に失敗:', {
                hasWebviewUri: !!message.webviewUri,
                hasIframe: !!this.elements.iframe,
                message: message
            });
            
            // iframe要素が見つからない場合のデバッグ情報
            if (!this.elements.iframe) {
                console.error('[ERROR] 利用可能なDOM要素:');
                console.error('- replica-iframe:', document.getElementById('replica-iframe'));
                console.error('- lp-replica-tab:', document.getElementById('lp-replica-tab'));
                console.error('- replica-viewer:', document.getElementById('replica-viewer'));
            }
        }
    }

    /**
     * HTMLコンテンツを直接処理
     */
    handleHtmlContent(message) {
        if (message.htmlContent && this.elements.iframe) {
            console.log('[DEBUG] HTMLコンテンツを受信（srcdoc使用を回避）');
            // FIXME: srcdoc属性はVSCode WebviewのCSP制約を引き起こすため使用を停止
            // 代わりにsrcのURL使用を強制し、HTMLコンテンツ処理をスキップ
            console.log('[DEBUG] srcdoc使用をスキップし、srcのURL表示を継続します');
            console.warn('[WARN] HTMLコンテンツの直接設定はスキップされました（CSP制約回避のため）');
        } else {
            console.error('[ERROR] HTMLコンテンツの設定に失敗:', message);
        }
    }

    /**
     * レプリカ情報を処理（簡易表示用）
     */
    handleReplicaInfo(message) {
        if (message.info) {
            console.log('[DEBUG] レプリカ情報を受信');
            
            // iframeの代わりにメッセージを表示
            if (this.elements.iframe) {
                this.elements.iframe.style.display = 'none';
            }
            
            // メッセージエリアを作成または更新
            let messageArea = document.getElementById('replica-message-area');
            if (!messageArea) {
                messageArea = document.createElement('div');
                messageArea.id = 'replica-message-area';
                messageArea.style.cssText = `
                    padding: 40px;
                    text-align: center;
                    background-color: #f8f9fa;
                    border-radius: 8px;
                    margin: 20px;
                `;
                this.elements.viewer.appendChild(messageArea);
            }
            
            messageArea.innerHTML = `
                <h3 style="color: #4a69bd; margin-bottom: 20px;">
                    <span class="material-icons" style="vertical-align: middle; font-size: 48px;">check_circle</span>
                </h3>
                <p style="font-size: 16px; color: #333; margin-bottom: 30px;">${message.info.message}</p>
                <div style="display: flex; gap: 20px; justify-content: center;">
                    <button id="open-in-browser-btn" class="button button-primary" style="padding: 12px 24px;">
                        <span class="material-icons" style="vertical-align: middle; margin-right: 8px;">open_in_new</span>
                        ブラウザで開く
                    </button>
                    <button id="open-folder-btn" class="button button-secondary" style="padding: 12px 24px;">
                        <span class="material-icons" style="vertical-align: middle; margin-right: 8px;">folder_open</span>
                        フォルダを開く
                    </button>
                </div>
                <p style="font-size: 14px; color: #666; margin-top: 20px;">
                    レプリカパス: <code>${message.info.path}</code>
                </p>
            `;
            
            // ボタンのイベントリスナー
            const browserBtn = document.getElementById('open-in-browser-btn');
            if (browserBtn) {
                browserBtn.addEventListener('click', () => this.openInBrowser());
            }
            
            const folderBtn = document.getElementById('open-folder-btn');
            if (folderBtn) {
                folderBtn.addEventListener('click', () => {
                    this.vscode.postMessage({
                        command: 'openReplicaFolder',
                        path: message.info.path
                    });
                });
            }
        }
    }

    /**
     * レプリカ状態をリセット（プロジェクト切り替え時）
     */
    resetReplicaState() {
        console.log('[DEBUG] レプリカ状態をリセットしています');
        
        // フォームを表示状態に戻す
        if (this.elements.createForm) {
            this.elements.createForm.style.display = 'block';
            console.log('[DEBUG] 作成フォームを表示状態にリセット');
        }
        
        // ビューアを非表示にする
        if (this.elements.viewer) {
            this.elements.viewer.style.display = 'none';
            console.log('[DEBUG] ビューアを非表示にリセット');
        }
        
        // iframeをクリア
        if (this.elements.iframe) {
            this.elements.iframe.src = '';
            // srcdoc属性の使用を停止（CSP制約回避のため）
            // this.elements.iframe.srcdoc = '';
            console.log('[DEBUG] iframeをクリア');
        }
        
        // 要素情報エリアを非表示
        if (this.elements.elementInfo) {
            this.elements.elementInfo.style.display = 'none';
        }
        
        // ステータスメッセージをクリア
        if (this.elements.statusDiv) {
            this.elements.statusDiv.style.display = 'none';
            this.elements.statusDiv.textContent = '';
        }
        
        // URLフィールドをクリア
        if (this.elements.urlInput) {
            this.elements.urlInput.value = '';
        }
        
        // 作成ボタンを有効化
        if (this.elements.createButton) {
            this.elements.createButton.disabled = false;
        }
        
        // 作成中フラグをリセット
        this.isCreating = false;
        
        // チェック中フラグもリセット
        this.isCheckingReplica = false;
        
        // メッセージエリアがあれば削除
        const messageArea = document.getElementById('replica-message-area');
        if (messageArea) {
            messageArea.remove();
        }
        
        console.log('[DEBUG] レプリカ状態のリセットが完了しました');
        
        // リセット後、新しいプロジェクトでレプリカ存在チェックを実行
        setTimeout(() => {
            this.checkReplicaExists();
        }, 100);
    }

    /**
     * jQueryライブラリ依存関係をチェック
     */
    checkjQueryDependencies(iframeDoc) {
        try {
            const scripts = iframeDoc.querySelectorAll('script[src]');
            const jqueryRequiredLibraries = ['search-filter', 'chosen.jquery', 'slick', 'stande'];
            let hasJquery = false;
            let requiresJquery = false;
            
            scripts.forEach(script => {
                const src = script.src;
                
                // jQueryライブラリの存在確認
                if (src.includes('jquery') && !src.includes('chosen.jquery')) {
                    hasJquery = true;
                }
                
                // jQuery依存ライブラリの存在確認
                jqueryRequiredLibraries.forEach(lib => {
                    if (src.includes(lib)) {
                        requiresJquery = true;
                    }
                });
            });
            
            // jQuery依存ライブラリがあるのにjQueryがない場合に警告
            if (requiresJquery && !hasJquery) {
                console.warn('[WARN] jQuery依存ライブラリが検出されましたが、jQueryが読み込まれていません');
                this.showjQueryWarning();
            }
            
        } catch (error) {
            console.warn('[WARN] jQueryチェック中にエラー:', error.message);
        }
    }

    /**
     * CORSエラー警告を表示
     */
    showCorsWarning() {
        this.updateStatus('クロスオリジン制限により、サイトの詳細分析ができません', 'warning');
    }

    /**
     * jQuery警告を表示
     */
    showjQueryWarning() {
        this.updateStatus('サイトにjQuery関連のエラーが検出されています', 'warning');
    }

    /**
     * ステータスメッセージを更新
     */
    updateStatus(message, type = 'info') {
        if (!this.elements.statusDiv) return;
        
        this.elements.statusDiv.textContent = message;
        this.elements.statusDiv.className = `status-message status-${type}`;
        this.elements.statusDiv.style.display = 'block';
        
        // 成功メッセージは3秒後に非表示、警告メッセージは10秒後に非表示
        if (type === 'success') {
            setTimeout(() => {
                if (this.elements.statusDiv) {
                    this.elements.statusDiv.style.display = 'none';
                }
            }, 3000);
        } else if (type === 'warning') {
            setTimeout(() => {
                if (this.elements.statusDiv) {
                    this.elements.statusDiv.style.display = 'none';
                }
            }, 10000);
        }
    }
};

// 初期化関数
function initLPReplicaManager() {
    // 既にインスタンスが存在する場合は何もしない
    if (window.lpReplicaManager) {
        return;
    }
    
    // タブが表示されているかチェック
    const lpReplicaTab = document.querySelector('#lp-replica-tab');
    if (lpReplicaTab) {
        window.lpReplicaManager = new window.lpReplica.Manager();
    }
}

// DOMContentLoadedイベントで初期化
document.addEventListener('DOMContentLoaded', initLPReplicaManager);

// タブ切り替え時の初期化
window.addEventListener('tab-changed', (event) => {
    if (event.detail && event.detail.tabId === 'lp-replica') {
        initLPReplicaManager();
    }
});