// @ts-check

/**
 * プロンプトカード管理モジュール
 * 
 * プロンプトカードの表示と管理を担当するモジュール
 */

// 外部モジュールのインポート
import dialogManager from '../dialogManager/dialogManager.js';

// VSCode API取得
let vscode;
try {
  // グローバル変数として既に存在するか確認
  if (typeof window.vsCodeApi !== 'undefined') {
    vscode = window.vsCodeApi;
    console.log('promptCards: 既存のVSCode APIを使用します');
  } else {
    // 新規取得
    vscode = acquireVsCodeApi();
    console.log('promptCards: VSCode APIを新規取得しました');
    // グローバル変数として保存して他のスクリプトでも使えるように
    window.vsCodeApi = vscode;
  }
} catch (e) {
  console.error('promptCards: VSCode API取得エラー:', e);
  // エラー時のフォールバック
  vscode = {
    postMessage: function(msg) { 
      console.log('ダミーvscode.postMessage:', msg); 
    },
    getState: function() { return {}; },
    setState: function() {}
  };
}

// プロンプトURLリスト - 新バックエンドURLに基づく16個のプロンプト
const promptUrls = [
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39", // ★1要件定義エンジニア
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/8cdfe9875a5ab58ea5cdef0ba52ed8eb", // ★2UIUXデザイナー
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/9575d0837e6b7700ab2f8887a5c4faec", // ★3データモデリングエンジニア
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/f0f6805b80ae32f3846c35fe9df4eefe", // ★4システムアーキテクト
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/44b995b91e9879080c4e0169e7a51c0e", // ★5実装計画コンサルタント
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/50eb4d1e924c9139ef685c2f39766589", // ★6環境構築
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/e6167ac13d15f778c0cae369b0068813", // ★7プロトタイプ実装
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/b168dcd63cc12e15c2e57bce02caf704", // ★8バックエンド実装
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/5a3f08098fd5b7846602e9b5446b7d44", // ★9テスト品質検証
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/dc8d5407c9e0becc95af38d91acb22cd", // ★10API統合
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/942ec5f5b316b3fb11e2fd2b597bfb09", // ★11デバッグ探偵
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/612fc1991ca477744c4544255d40fe0b", // ★12デプロイ
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/868ba99fc6e40d643a02e0e02c5e980a", // ★13GitHub
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/247df2890160a2fa8f6cc0f895413aed", // ★14型エラー解決
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/8c09f971e4a3d020497eec099a53e0a6", // ★15機能追加
  "http://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/af9d922c29beffe1224ac6236d083946"  // ★16リファクタリング
];

// プロンプト情報マッピング - 新しいプロンプト情報リスト
const promptInfo = [
  { id: 0, name: "要件定義", icon: "description", category: "★1", description: "ビジネス要件を技術仕様に変換" },
  { id: 1, name: "モックアップ作成", icon: "palette", category: "★2", description: "要件に基づくUI/UX設計と画面実装" },
  { id: 2, name: "データモデル設計", icon: "storage", category: "★3", description: "エンティティ関係と型定義の構築" },
  { id: 3, name: "認証システム構造設計", icon: "security", category: "★4", description: "全体アーキテクチャと認証基盤の構築" },
  { id: 4, name: "実装計画書作成", icon: "assignment", category: "★5", description: "データフロー中心の実装戦略策定" },
  { id: 5, name: "環境構築", icon: "settings", category: "★6", description: "開発/本番環境と認証情報の設定" },
  { id: 6, name: "プロトタイプ実装", icon: "view_in_ar", category: "★7", description: "フロントエンドのプロトタイプを完全実装" },
  { id: 7, name: "バックエンド実装", icon: "database", category: "★8", description: "データベースからAPIエンドポイントの構築" },
  { id: 8, name: "テスト品質検証", icon: "verified", category: "★9", description: "単体・統合テストによる品質保証" },
  { id: 9, name: "API統合", icon: "sync_alt", category: "★10", description: "プロトタイプを動くシステムへ" },
  { id: 10, name: "デバッグ探偵", icon: "bug_report", category: "★11", description: "エラーの問題の特定と修正" },
  { id: 11, name: "デプロイ", icon: "cloud_upload", category: "★12", description: "クラウドサービスへの安定したデプロイ" },
  { id: 12, name: "GitHub", icon: "history", category: "★13", description: "Gitを活用した安全なコード管理" },
  { id: 13, name: "型エラー解決", icon: "rule", category: "★14", description: "TypeScript型整合性の確保と最適化" },
  { id: 14, name: "機能追加", icon: "add_circle", category: "★15", description: "新機能の設計と既存システムへの統合" },
  { id: 15, name: "リファクタリング", icon: "tune", category: "★16", description: "技術的負債の解消と保守性向上" }
];

/**
 * プロンプトカードマネージャークラス
 */
class PromptCardsManager {
  constructor() {
    this.initialized = false;
    this.modalInitialized = false;
    
    // 初期化状態を監視して必要に応じて初期化を行う
    document.addEventListener('DOMContentLoaded', () => {
      this._checkAndInitialize();
    });
  }

  /**
   * 状態を確認し必要に応じて初期化
   * @private
   */
  _checkAndInitialize() {
    // プロンプトタブの要素が存在するか確認
    setTimeout(() => {
      const promptsTab = document.getElementById('prompts-tab');
      if (promptsTab && !this.initialized) {
        this.initializePromptCards();
      }
      
      const promptGrid = document.querySelector('.claude-code-share-area .prompt-grid');
      if (promptGrid && !this.modalInitialized) {
        this.initializePromptCardsInModal();
      }
    }, 100);
  }

  /**
   * プロンプトカードの初期化
   * メインタブのプロンプトカードを初期化します
   */
  initializePromptCards() {
    console.log('promptCards: プロンプトカードの初期化を開始');
    
    const promptsTab = document.getElementById('prompts-tab');
    if (!promptsTab) {
      console.warn('promptCards: プロンプトタブが存在しないため初期化をスキップします');
      return;
    }
    
    // 既存のコンテンツをクリア（二重初期化防止）
    const existingGrid = promptsTab.querySelector('.prompt-grid');
    if (existingGrid) {
      console.log('promptCards: 既存のプロンプトグリッドを削除します');
      existingGrid.remove();
    }
    
    // 新しいグリッドを作成
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
      
      // クリックイベント - DialogManagerを使用
      card.addEventListener('click', () => {
        dialogManager.showTerminalModeDialog(url, info.name, index);
      });
      
      promptGrid.appendChild(card);
    });
    
    // プロンプトタブにグリッドを追加
    promptsTab.appendChild(promptGrid);
    
    this.initialized = true;
    console.log('promptCards: プロンプトカードの初期化が完了しました');
    
    // カスタムイベントを発行
    const event = new CustomEvent('prompt-cards-initialized');
    document.dispatchEvent(event);
  }

  /**
   * モーダル内のプロンプトカードを初期化
   * ClaudeCode共有エリア内のプロンプトカードを初期化します
   */
  initializePromptCardsInModal() {
    console.log('promptCards: モーダル内プロンプトカードの初期化を開始');
    
    const promptGrid = document.querySelector('.claude-code-share-area .prompt-grid');
    if (!promptGrid) {
      console.warn('promptCards: モーダル内プロンプトグリッドが存在しないため初期化をスキップします');
      return;
    }
    
    // 既存のコンテンツをクリア（二重初期化防止）
    while (promptGrid.firstChild) {
      promptGrid.removeChild(promptGrid.firstChild);
    }
    
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
      
      // クリックイベント - DialogManagerを使用
      card.addEventListener('click', () => {
        // プロンプトのURL
        const url = promptUrls[prompt.id];
        if (url) {
          dialogManager.showModalTerminalModeDialog(url, prompt.id, prompt.name);
        }
      });
      
      promptGrid.appendChild(card);
    });
    
    this.modalInitialized = true;
    console.log('promptCards: モーダル内プロンプトカードの初期化が完了しました');
    
    // カスタムイベントを発行
    const event = new CustomEvent('modal-prompt-cards-initialized');
    document.dispatchEvent(event);
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

// シングルトンインスタンスの作成とエクスポート
const promptCards = new PromptCardsManager();
export default promptCards;