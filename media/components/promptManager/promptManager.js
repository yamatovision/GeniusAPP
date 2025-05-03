// @ts-check

/**
 * プロンプトマネージャー
 * 
 * プロンプトカードの表示と管理を担当するモジュール
 */

// VSCode API取得
const vscode = acquireVsCodeApi();

// プロンプトURLリスト
const promptUrls = [
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39", // 要件定義
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/9575d0837e6b7700ab2f8887a5c4faec", // システムアーキテクチャ
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb", // モックアップ作成
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/f0f6805b80ae32f3846c35fe9df4eefe", // データモデル統合
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/bbc6e76a5f448e02bea16918fa1dc9ad", // データモデル精査
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/50eb4d1e924c9139ef685c2f39766589", // 環境変数収集
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/44b995b91e9879080c4e0169e7a51c0e", // 認証システム
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/612fc1991ca477744c4544255d40fe0b", // デプロイ設定
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/e6167ac13d15f778c0cae369b0068813", // GitHub管理
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704", // 実装タスク分析
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a", // スコープ実装
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/247df2890160a2fa8f6cc0f895413aed", // テスト管理
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09", // デバッグ探偵
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/8c09f971e4a3d020497eec099a53e0a6", // 追加機能実装
  "https://appgenius-portal-test-235426778039.asia-northeast1.run.app/api/prompts/public/af9d922c29beffe1224ac6236d083946"  // リファクタリング
];

// プロンプト情報マッピング
const promptInfo = [
  { id: 0, name: "要件定義", icon: "description", category: "計画", description: "ビジネス要件を要件定義書に変換" },
  { id: 1, name: "システムアーキテクチャ", icon: "architecture", category: "設計", description: "システム全体の設計と開発基盤の確立" },
  { id: 2, name: "モックアップ作成", icon: "web", category: "UI", description: "要件に基づいたモックアップ作成" },
  { id: 3, name: "データモデル統合", icon: "data_object", category: "設計", description: "一貫性のあるシステム全体のモデル構築" },
  { id: 4, name: "データモデル精査", icon: "psychology", category: "設計", description: "データモデルの厳格な精査と品質向上" },
  { id: 5, name: "環境変数設定", icon: "settings", category: "環境", description: "実際の本番環境用の環境変数設定" },
  { id: 6, name: "認証システム構築", icon: "security", category: "実装", description: "シンプルなJWT自社実装による認証" },
  { id: 7, name: "デプロイ設定", icon: "cloud_upload", category: "環境", description: "クラウドベースのWebアプリケーションデプロイ" },
  { id: 8, name: "GitHub管理", icon: "code", category: "管理", description: "コードの安全なアップロード・管理支援" },
  { id: 9, name: "実装タスク分析", icon: "assignment_turned_in", category: "管理", description: "実装順序の最適化と環境統一化" },
  { id: 10, name: "スコープ実装", icon: "build", category: "実装", description: "設計情報から高品質なコード生成" },
  { id: 11, name: "テスト管理", icon: "science", category: "テスト", description: "実データに基づく効率的なテスト実装" },
  { id: 12, name: "デバッグ探偵", icon: "bug_report", category: "デバッグ", description: "フロントエンドエラーとAPI連携問題の解決" },
  { id: 13, name: "追加機能実装", icon: "add_circle", category: "実装", description: "機能追加・変更・削除要望の分析" },
  { id: 14, name: "リファクタリング", icon: "tune", category: "改善", description: "技術的負債の特定と設計改善" }
];

/**
 * プロンプトマネージャークラス
 */
class PromptManager {
  constructor() {
    this.initialized = false;
  }

  /**
   * プロンプトカードの初期化
   */
  initializePromptCards() {
    console.log('プロンプトカードの初期化');
    
    const promptsTab = document.getElementById('prompts-tab');
    if (!promptsTab) return;
    
    const promptGrid = document.createElement('div');
    promptGrid.className = 'prompt-grid';
    
    // プロンプトカードを作成
    promptUrls.forEach((url, index) => {
      const info = promptInfo[index] || { 
        name: "プロンプト " + (index + 1), 
        icon: "description", 
        category: "その他", 
        description: "プロンプトを実行します" 
      };
      
      const card = document.createElement('div');
      card.className = 'prompt-card';
      card.innerHTML = `
        <span class="material-icons prompt-icon">${info.icon}</span>
        <div class="category-tag">${info.category}</div>
        <h3 class="prompt-title">${info.name}</h3>
        <p class="prompt-description">${info.description}</p>
      `;
      
      // クリックイベント
      card.addEventListener('click', () => {
        // ターミナルモード選択ダイアログを表示
        this._showTerminalModeDialog(url, info.name, index);
      });
      
      promptGrid.appendChild(card);
    });
    
    // プロンプトタブにグリッドを追加
    promptsTab.appendChild(promptGrid);
    
    this.initialized = true;
  }

  /**
   * モーダル内のプロンプトカードを初期化
   */
  initializePromptCardsInModal() {
    console.log('モーダル内プロンプトカードの初期化');
    
    const promptGrid = document.querySelector('.claude-code-share-area .prompt-grid');
    if (!promptGrid) return;
    
    // モーダル内にプロンプトカードを追加
    promptInfo.forEach(prompt => {
      const card = document.createElement('div');
      card.className = 'prompt-card';
      card.innerHTML = `
        <span class="material-icons prompt-icon">${prompt.icon}</span>
        <div class="category-tag">${prompt.category}</div>
        <h3 class="prompt-title">${prompt.name}</h3>
        <p class="prompt-description">${prompt.description}</p>
      `;
      
      // クリックイベント
      card.addEventListener('click', () => {
        // プロンプトのURL
        const url = promptUrls[prompt.id];
        if (url) {
          // モーダル内ターミナルモード選択ダイアログを表示
          this._showModalTerminalModeDialog(url, prompt.id, prompt.name);
        }
      });
      
      promptGrid.appendChild(card);
    });
  }

  /**
   * ターミナル表示モード選択ダイアログを表示
   * @private
   * @param {string} url プロンプトのURL
   * @param {string} name プロンプト名
   * @param {number} index プロンプトのインデックス
   */
  _showTerminalModeDialog(url, name, index) {
    // 既存のダイアログがあれば削除
    const existingDialog = document.getElementById('terminal-mode-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    // モーダルオーバーレイとダイアログを作成
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'terminal-mode-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    const dialog = document.createElement('div');
    dialog.id = 'terminal-mode-dialog';
    dialog.style.backgroundColor = 'var(--app-bg, #fff)';
    dialog.style.borderRadius = '8px';
    dialog.style.padding = '20px';
    dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    dialog.style.width = '400px';
    dialog.style.maxWidth = '90%';
    
    dialog.innerHTML = `
      <h3 style="margin-top: 0; margin-bottom: 16px;">ターミナル表示モードを選択</h3>
      <p style="margin-bottom: 20px;">ClaudeCodeの起動方法を選択してください：</p>
      <div style="display: flex; justify-content: space-between;">
        <button id="split-terminal-btn" class="button" style="flex: 1; margin-right: 8px;">分割ターミナルで表示</button>
        <button id="new-tab-terminal-btn" class="button button-secondary" style="flex: 1; margin-left: 8px;">新しいタブで表示</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // ボタンのイベントリスナーを設定
    document.getElementById('split-terminal-btn').addEventListener('click', () => {
      // 分割ターミナルモードを選択（true）
      console.log('【デバッグ】分割ターミナルボタンがクリックされました - splitTerminal=true を送信します');
      
      // デバッグメッセージを表示（開発者がダイアログの選択を確認できるように）
      const debugMessage = document.createElement('div');
      debugMessage.style.position = 'fixed';
      debugMessage.style.bottom = '20px';
      debugMessage.style.left = '20px';
      debugMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      debugMessage.style.color = 'white';
      debugMessage.style.padding = '8px 16px';
      debugMessage.style.borderRadius = '4px';
      debugMessage.style.zIndex = '999999';
      debugMessage.style.fontFamily = 'monospace';
      debugMessage.textContent = '分割ターミナルモードを選択しました (splitTerminal=true)';
      document.body.appendChild(debugMessage);
      
      // 3秒後にデバッグメッセージを消す
      setTimeout(() => {
        if (debugMessage.parentNode) {
          debugMessage.parentNode.removeChild(debugMessage);
        }
      }, 3000);
      
      vscode.postMessage({
        command: 'launchPromptFromURL',
        url: url,
        name: name,
        index: index,
        splitTerminal: true  // 分割ターミナルモード
      });
      
      // ダイアログを閉じる
      overlay.remove();
    });
    
    document.getElementById('new-tab-terminal-btn').addEventListener('click', () => {
      // 新しいタブモードを選択（false）
      vscode.postMessage({
        command: 'launchPromptFromURL',
        url: url,
        name: name,
        index: index,
        splitTerminal: false  // 新しいタブモード
      });
      
      // ダイアログを閉じる
      overlay.remove();
    });
  }

  /**
   * モーダル内ターミナル表示モード選択ダイアログを表示
   * @private
   * @param {string} url プロンプトのURL
   * @param {number} promptId プロンプトID
   * @param {string} promptName プロンプト名
   */
  _showModalTerminalModeDialog(url, promptId, promptName) {
    // 既存のダイアログがあれば削除
    const existingDialog = document.getElementById('modal-terminal-mode-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    // モーダルオーバーレイとダイアログを作成
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.id = 'modal-terminal-mode-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    const dialog = document.createElement('div');
    dialog.id = 'modal-terminal-mode-dialog';
    dialog.style.backgroundColor = 'var(--app-bg, #fff)';
    dialog.style.borderRadius = '8px';
    dialog.style.padding = '20px';
    dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    dialog.style.width = '400px';
    dialog.style.maxWidth = '90%';
    
    dialog.innerHTML = `
      <h3 style="margin-top: 0; margin-bottom: 16px;">ターミナル表示モードを選択</h3>
      <p style="margin-bottom: 20px;">ClaudeCodeの起動方法を選択してください：</p>
      <div style="display: flex; justify-content: space-between;">
        <button id="modal-split-terminal-btn" class="button" style="flex: 1; margin-right: 8px;">分割ターミナルで表示</button>
        <button id="modal-new-tab-terminal-btn" class="button button-secondary" style="flex: 1; margin-left: 8px;">新しいタブで表示</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // ボタンのイベントリスナーを設定
    document.getElementById('modal-split-terminal-btn').addEventListener('click', () => {
      // 分割ターミナルモードを選択（true）
      console.log('【デバッグ】モーダル内の分割ターミナルボタンがクリックされました - splitTerminal=true を送信します');
      
      // デバッグメッセージを表示
      const debugMessage = document.createElement('div');
      debugMessage.style.position = 'fixed';
      debugMessage.style.bottom = '20px';
      debugMessage.style.left = '20px';
      debugMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      debugMessage.style.color = 'white';
      debugMessage.style.padding = '8px 16px';
      debugMessage.style.borderRadius = '4px';
      debugMessage.style.zIndex = '999999';
      debugMessage.style.fontFamily = 'monospace';
      debugMessage.textContent = 'モーダル: 分割ターミナルモードを選択しました (splitTerminal=true)';
      document.body.appendChild(debugMessage);
      
      // 3秒後にデバッグメッセージを消す
      setTimeout(() => {
        if (debugMessage.parentNode) {
          debugMessage.parentNode.removeChild(debugMessage);
        }
      }, 3000);
      
      vscode.postMessage({
        command: 'launchPromptFromURL',
        url: url,
        index: promptId,
        name: promptName,
        splitTerminal: true  // 分割ターミナルモード
      });
      
      // ダイアログを閉じる
      overlay.remove();
    });
    
    document.getElementById('modal-new-tab-terminal-btn').addEventListener('click', () => {
      // 新しいタブモードを選択（false）
      vscode.postMessage({
        command: 'launchPromptFromURL',
        url: url,
        index: promptId,
        name: promptName,
        splitTerminal: false  // 新しいタブモード
      });
      
      // ダイアログを閉じる
      overlay.remove();
    });
  }

  /**
   * プロンプト情報の取得
   * @param {number} index プロンプトのインデックス
   * @returns {Object|null} プロンプト情報
   */
  getPromptInfo(index) {
    return promptInfo[index] || null;
  }

  /**
   * プロンプトURLの取得
   * @param {number} index プロンプトのインデックス
   * @returns {string|null} プロンプトURL
   */
  getPromptUrl(index) {
    return promptUrls[index] || null;
  }

  /**
   * 全てのプロンプト情報を取得
   * @returns {Array} プロンプト情報の配列
   */
  getAllPromptInfo() {
    return promptInfo;
  }
}

// シングルトンインスタンス
const promptManager = new PromptManager();
export default promptManager;