スコープマネージャーUI改善計画

  1. 現状分析

  - 現在のスコープマネージャーパネル(ScopeManagerPanel.ts)はダークテーマベースで実装されている
  - モックアップ版では新しいライトテーマベースのUI改善案が作成済み
  - CSS/JS/HTMLを更新する必要があるが、バックエンドロジック（TypeScript側）は変更不要
  - プロジェクト選択機能はダッシュボードで実装されており、その機能を移植する必要がある

  2. 変更対象ファイル

  1. /media/scopeManager.css - CSSスタイル
  2. /media/scopeManager.js - JavaScript
  3. /src/ui/scopeManager/ScopeManagerPanel.ts - HTMLテンプレート部分のみ変更

  3. 実装計画

  A. 第1段階: CSSファイルの更新

  1. scopeManager.cssをライトテーマベースに更新
    - ベースカラーを変更 (--app-background, --app-text, --app-card-backgroundなど)
    - 2カラムレイアウト用のスタイルを追加
    - プロジェクト選択パネル用のスタイルを追加

  B. 第2段階: HTMLテンプレート更新

  1. ScopeManagerPanel.tsの_getHtmlForWebviewメソッド内のHTMLテンプレートを更新
    - ヘッダーをシンプル化（不要なタイトルやボタンを削除）
    - 左側にプロジェクト選択パネルを追加
    - タブバーの左側にプロジェクト名表示を統合
    - 2カラムレイアウトの実装
    - タブ構成を変更：「プロジェクト状況」「ClaudeCode連携」「開発ツール」の3つに変更
    - プロジェクト状況タブでCURRENT_STATUS.mdの内容を直接マークダウン表示形式に変更（現在の独自パース処理を廃止）

  C. 第3段階: JavaScript機能の更新

  1. scopeManager.jsの更新
    - プロジェクト選択時の処理を追加
    - プロジェクトパネル開閉機能の実装
    - バックエンドとの通信部分は既存コードを維持

  D. 第4段階: ClaudeCode連携とプロンプト表示の入れ替え

  1. 現在のClaudeCode連携モーダルと「開発プロンプト」タブの役割を入れ替え
    - 現在のモーダル機能（ClaudeCode連携）をタブの中に移行
    - 現在のタブ機能（開発プロンプト）をモーダルの中に移行
    - UI要素間の矛盾がないよう適切に調整

  E. 第5段階: CURRENT_STATUS表示方法の変更

  1. 現在の独自パース処理を廃止し、マークダウン直接表示に変更
    - CURRENT_STATUS.mdファイルの内容をそのままマークダウンとしてレンダリング
    - CSS追加: マークダウン表示用のスタイルを強化（見出し、リスト、表など）
    - チェックボックス部分のインタラクティブな挙動は維持

  4. 詳細実装手順

  CSSファイル更新（media/scopeManager.css）

  /* ベースカラー定義をライトテーマに変更 */
  :root {
    --app-background: #f8f9fa;
    --app-text: #333333;
    --app-text-secondary: #718096;
    --app-heading-color: #2d3748;
    --app-card-background: #ffffff;
    /* 他のカラー変数も同様に更新 */
  }

  /* プロジェクトナビゲーション用スタイル追加 */
  .project-nav {
    width: 300px;
    flex-shrink: 0;
    border-right: 1px solid var(--app-border-color);
    padding: var(--app-spacing-md);
    background-color: #fff;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
    position: relative;
  }

  .project-nav.collapsed {
    width: 48px;
    overflow: visible;
    padding: var(--app-spacing-md) 0;
  }

  /* 折りたたみボタンスタイル */
  .toggle-nav-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    /* その他のスタイル */
  }

  /* モーダルとタブの入れ替えに関するスタイル */
  .claude-code-share-area {
    /* ClaudeCodeモーダルを開発プロンプトに変更するスタイル */
  }

  .claude-code-tab-content {
    /* 新しいClaudeCode連携タブ用スタイル */
  }
  
  /* マークダウン表示用スタイル強化 */
  .markdown-content {
    line-height: 1.6;
    font-size: var(--app-font-size-sm);
    padding: 0 5px;
  }

  .markdown-content h1 {
    font-size: 1.8em;
    margin-top: 1em;
    margin-bottom: 0.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--app-border-color);
  }

  .markdown-content h2 {
    font-size: 1.5em;
    margin-top: 1em;
    margin-bottom: 0.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--app-border-color);
  }
  
  .markdown-content ul, .markdown-content ol {
    margin-bottom: 1em;
    padding-left: 2em;
  }
  
  .markdown-content blockquote {
    border-left: 4px solid var(--app-primary);
    padding-left: 1em;
    margin-left: 0;
    color: var(--app-text-secondary);
  }

  HTMLテンプレート更新（ScopeManagerPanel.ts内の_getHtmlForWebview）

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // リソースURIなどの既存のコード部分は維持

    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <!-- 既存のヘッダー部分 -->
    </head>
    <body>
      <div class="scope-manager-container">
        <!-- メインコンテンツ：2カラムレイアウト -->
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
            
            <div class="project-list">
              <!-- プロジェクトリストはJSで動的に生成 -->
            </div>
          </div>
          
          <!-- 右側: コンテンツエリア -->
          <div class="content-area">
            <!-- タブ付きカード -->
            <div class="card">
              <div class="tabs">
                <div class="project-name-tab">AppGenius</div>
                <div class="tab active" data-tab="current-status">プロジェクト状況</div>
                <div class="tab" data-tab="claude-code">ClaudeCode連携</div>
                <div class="tab" data-tab="tools">開発ツール</div>
              </div>
              
              <!-- プロジェクト状況タブコンテンツ -->
              <div id="current-status-tab" class="tab-content active">
                <!-- CURRENT_STATUS.mdの内容をマークダウン表示 -->
                <div class="card-body">
                  <div class="markdown-content">
                    <!-- ここにCURRENT_STATUS.mdの内容がそのままマークダウン表示される -->
                  </div>
                </div>
              </div>

              <!-- ClaudeCode連携タブコンテンツ -->
              <div id="claude-code-tab" class="tab-content">
                <!-- 現在のモーダルの内容がここに移動 -->
                <div class="claude-share-container">
                  <!-- テキスト入力、画像アップロード、履歴などの内容 -->
                </div>
              </div>
              
              <!-- 開発ツールタブコンテンツ -->
              <div id="tools-tab" class="tab-content">
                <!-- 開発ツール一覧 -->
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 開発プロンプトモーダル（現在のClaudeCode連携モーダルを改変） -->
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
        
        <!-- 開発プロンプト一覧（現在のプロンプトタブの内容） -->
        <div class="prompt-grid">
          <!-- プロンプトカードはJSで生成 -->
        </div>
      </div>
    </body>
    </html>`;
  }

  JavaScript更新（media/scopeManager.js）

  // プロジェクトナビゲーションの開閉ボタン処理
  const toggleNavBtn = document.getElementById('toggle-nav-btn');
  if (toggleNavBtn) {
    toggleNavBtn.addEventListener('click', function() {
      const projectNav = document.querySelector('.project-nav');
      const contentArea = document.querySelector('.content-area');
      const icon = toggleNavBtn.querySelector('.material-icons');

      if (projectNav.classList.contains('collapsed')) {
        // パネルを展開
        projectNav.classList.remove('collapsed');
        contentArea.classList.remove('expanded');
        icon.textContent = 'chevron_left';
      } else {
        // パネルを折りたたむ
        projectNav.classList.add('collapsed');
        contentArea.classList.add('expanded');
        icon.textContent = 'chevron_right';
      }
    });
  }

  // プロジェクト選択処理
  function setupProjectSelection() {
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
      item.addEventListener('click', () => {
        // アクティブクラスを削除
        projectItems.forEach(pi => pi.classList.remove('active'));
        // クリックされた項目をアクティブに
        item.classList.add('active');

        // プロジェクト名を取得
        const projectName = item.querySelector('.project-name').textContent;
        // プロジェクトタブ表示を更新
        document.querySelector('.project-name-tab').textContent = projectName;

        // VSCodeにプロジェクト変更のメッセージを送信
        vscode.postMessage({
          command: 'selectProject',
          projectName: projectName
        });
      });
    });
  }

  // モーダルとタブの入れ替え処理
  function initializePromptModal() {
    // 開発プロンプトモーダルの初期化（元ClaudeCodeモーダル）
    // プロンプトカードの生成や表示/非表示の切り替えなど
  }

  function initializeClaudeCodeTab() {
    // ClaudeCode連携タブの初期化（元開発プロンプトタブ）
    // テキスト入力・画像アップロードなどのUI要素や機能の初期化
  }
  
  // CURRENT_STATUS.mdの内容を直接表示する処理
  function renderMarkdownContent(markdownText) {
    // マークダウンをHTMLに変換
    // チェックボックスをインタラクティブな要素に変換
    // ここではプラグインとして marked.js や highlight.js などを利用
    const htmlContent = convertMarkdownToHtml(markdownText);
    
    // マークダウン表示エリアを更新
    const markdownContainer = document.querySelector('.markdown-content');
    if (markdownContainer) {
      markdownContainer.innerHTML = htmlContent;
      
      // チェックボックスにイベントリスナーを追加
      setupCheckboxListeners();
    }
  }

  5. 実装スケジュール

  1. CSS更新: 1-2時間
  2. HTMLテンプレート更新: 2-3時間
  3. JavaScript機能追加: 1-2時間
  4. ClaudeCode連携とプロンプト表示の入れ替え: 2-3時間
  5. CURRENT_STATUS.md直接表示実装: 2-3時間
  6. テストとデバッグ: 2-3時間

  合計予定時間: 約10-16時間

  6. リスク管理

  1. 既存機能への影響: スコープマネージャーの主要機能（スコープ表示、フィルタリング、編集）は変更しないことで、既存機能への影響を最小限に抑える
  2. プロジェクト選択機能の統合: ダッシュボードと同様のプロジェクト選択機能を実装するが、バックエンドAPIの違いに注意する
  3. レスポンシブ対応: 異なる画面サイズでも正しく表示・動作するように、CSSメディアクエリを適切に設定する
  4. 機能入れ替えの混乱: ClaudeCode連携とプロンプト表示の入れ替えにより、ユーザーが混乱する可能性があるため、UIのラベルを明確にする
  5. マークダウン表示の互換性: CURRENT_STATUS.mdのマークダウン構文によっては表示が崩れる可能性があるため、一般的なマークダウン構文を確実に処理できるようにする
  6. パフォーマンス考慮: 大きなマークダウンファイルを表示する際に遅延が生じないよう、表示処理の最適化が必要

  7. テスト計画

  1. 各種画面サイズでのレイアウト確認（小、中、大）
  2. プロジェクト選択機能のテスト
  3. パネル開閉機能のテスト
  4. ダークモード互換性テスト（VSCodeのテーマと整合するか）
  5. ClaudeCode連携機能の継続性確認（タブに移動しても機能するか）
  6. 開発プロンプト機能のテスト（モーダルに移動しても機能するか）
  7. マークダウン表示の正確性確認（特に見出し、リスト、表、コードブロックなど）
  8. インタラクティブなチェックボックス機能の動作確認

  この計画に基づいて実装を進めることで、より使いやすく効率的なUIに改善できると考えます。既存の機能を維持しながら、視覚的・ユーザビリティの観点から大幅な改善が期待できます。

