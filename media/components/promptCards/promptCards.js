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

// プロンプトURLリスト - developmentway.mdに基づいた15個のプロンプト
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

// プロンプト情報マッピング - developmentway.mdに基づいた15個のプロンプト
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