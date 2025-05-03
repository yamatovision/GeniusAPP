// @ts-check

// VSCode API取得 
const vscode = acquireVsCodeApi();

// 外部モジュールのインポート
import { convertMarkdownToHtml, enhanceSpecialElements, setupCheckboxes } from './utils/markdownConverter.js';
import { showError, showSuccess, getStatusClass, getStatusText, getTimeAgo, showDirectoryStructure } from './utils/uiHelpers.js';

// イベントリスナーの初期化
(function() {
  const previousState = vscode.getState() || { 
    scopes: [],
    selectedScopeIndex: -1,
    selectedScope: null,
    directoryStructure: '',
    activeTab: 'prompts'
  };
  
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
  
  // 開発ツール情報
  const toolsInfo = [
    { id: "requirements-editor", name: "要件定義エディタ", icon: "fact_check", description: "要件定義書の編集と管理" },
    { id: "env-assistant", name: "環境変数アシスタント", icon: "emoji_objects", description: "環境変数の設定と管理" },
    { id: "mockup-gallery", name: "モックアップギャラリー", icon: "dashboard", description: "UIモックアップの表示と管理" },
    { id: "debug-detective", name: "デバッグ探偵", icon: "integration_instructions", description: "エラー解析と問題解決" }
  ];
  
  // ページ読み込み完了時の処理
  document.addEventListener('DOMContentLoaded', () => {
    // 初期化メッセージの送信
    vscode.postMessage({ command: 'initialize' });
    
    // イベントリスナー設定
    setupEventListeners();
    
    // タブ機能の初期化
    initializeTabs();
    
    // プロンプトカードを初期化
    initializePromptCards();
    
    // プロジェクトナビゲーションの開閉ボタン処理
    initializeProjectNav();
    
    // ClaudeCode連携エリアを初期化
    initializeClaudeCodeShareArea();
    
    // マークダウン表示の初期化
    initializeMarkdownDisplay();
    
    // 保存されたプロジェクト状態を復元（他のパネルから戻ってきた時のため）
    // ただし、初期化メッセージのレスポンスを優先するため、短いタイムアウト後に実行
    setTimeout(restoreProjectState, 100);
  });
  
  // メッセージハンドラーの設定
  window.addEventListener('message', event => {
    const message = event.data;
    
    // シェアリングパネル関連のメッセージは無視（sharingPanel.jsが処理）
    if (['showShareResult', 'updateSharingHistory', 'commandCopied', 'resetDropZone'].includes(message.command)) {
      return; // sharingPanel.jsに処理を任せる
    }
    
    console.log('メッセージ受信:', message.command);
    
    switch (message.command) {
      case 'updateState':
        handleUpdateState(message);
        break;
      case 'showError':
        showError(message.message);
        break;
      case 'showSuccess':
        showSuccess(message.message);
        break;
      case 'showDirectoryStructure':
        showDirectoryStructure(message.structure);
        break;
      case 'updateProjectPath':
        updateProjectPath(message);
        break;
      case 'updateProjectName':
        updateProjectName(message.projectName);
        break;
      case 'updateMarkdownContent':
        displayMarkdownContent(message.content);
        break;
      case 'updateProjects':
        // プロジェクト一覧を更新するだけで、ここではタブ選択は行わない
        // （selectTabコマンドが別途送信される）
        updateProjects(message.projects, message.activeProject);
        break;
      case 'selectTab':
        selectTab(message.tabId);
        break;
      case 'updateToolsTab':
        updateToolsTab(message.content);
        break;
      case 'syncProjectState':
        // ProjectManagementServiceからのプロジェクト状態同期メッセージ
        if (message.project) {
          syncProjectState(message.project);
        }
        break;
    }
  });
  
  /**
   * ProjectManagementServiceからのプロジェクト状態を同期
   * @param {Object} project プロジェクト情報
   */
  function syncProjectState(project) {
    try {
      if (!project) {
        console.warn('プロジェクト情報が空のため同期をスキップします');
        return;
      }
      
      console.log('ProjectManagementServiceからプロジェクト状態を同期:', project);
      
      // 現在の状態を取得
      const state = vscode.getState() || {};
      
      // 連続同期対策 - 短時間での重複同期を防止
      const now = Date.now();
      const lastSyncTime = state.lastProjectSyncTime || 0;
      const lastSyncId = state.lastSyncedProjectId;
      const syncThreshold = 300; // 300ms以内の同期はスキップ
      
      // 同じプロジェクトの頻繁すぎる同期はスキップ
      if (now - lastSyncTime < syncThreshold && lastSyncId === project.id) {
        console.log(`プロジェクト同期をスキップ: 直近(${now - lastSyncTime}ms前)に同期済み`);
        return;
      }
      
      // 同期状態を更新
      state.lastProjectSyncTime = now;
      state.lastSyncedProjectId = project.id;
      
      // 1. プロジェクト基本情報の更新
      if (project.name) {
        updateProjectName(project.name);
      }
      
      if (project.path) {
        const data = {
          projectPath: project.path,
          statusFilePath: project.path ? `${project.path}/docs/CURRENT_STATUS.md` : '',
          statusFileExists: true
        };
        updateProjectPath(data);
      }
      
      // 2. タブ状態の同期
      if (project.metadata && project.metadata.activeTab) {
        const activeTabFromMetadata = project.metadata.activeTab;
        
        // タブが存在するか確認
        const tabExists = Array.from(document.querySelectorAll('.tab'))
          .some(tab => tab.getAttribute('data-tab') === activeTabFromMetadata);
        
        const tabToSelect = tabExists ? activeTabFromMetadata : 'current-status';
        
        // TabStateManagerを使用して一貫した方法でタブを選択
        // フラグをfalseにして無限ループを防止（サーバーに再通知しない）
        selectTab(tabToSelect, false);
        
        console.log(`タブ状態同期: ${tabToSelect}`);
      }
      
      // 3. ローカルステートの更新（プロジェクト情報を保存）
      state.activeProjectName = project.name;
      state.activeProjectPath = project.path;
      
      if (project.metadata && project.metadata.activeTab) {
        state.activeTab = project.metadata.activeTab;
      } else if (!state.activeTab) {
        state.activeTab = 'current-status';
      }
      
      // 状態を保存
      vscode.setState(state);
      
      console.log(`プロジェクト状態同期完了: ${project.name}`);
    } catch (error) {
      console.error('プロジェクト状態の同期中にエラーが発生しました:', error);
    }
  }

  /**
   * プロジェクトパスの更新
   */
  function updateProjectPath(data) {
    const projectNameElement = document.querySelector('.project-display .project-name');
    const projectPathElement = document.querySelector('.project-path-display');
    
    // プロジェクト情報の更新
    if (data.projectPath) {
      // パスから最後のディレクトリ名を取得
      const pathParts = data.projectPath.split(/[/\\]/);
      const projectName = pathParts[pathParts.length - 1];
      
      // プロジェクト表示部分を更新
      if (projectNameElement) {
        projectNameElement.textContent = projectName || 'プロジェクト';
      }
    }
    
    if (projectPathElement) {
      projectPathElement.textContent = data.projectPath || '/path/to/project';
    }
    
    // CURRENT_STATUS.mdファイルの存在をチェック
    if (data.statusFilePath && data.statusFileExists) {
      console.log('CURRENT_STATUS.mdファイルが存在します:', data.statusFilePath);
      
      // ファイルが存在する場合はマークダウンコンテンツを取得するリクエストを送信
      vscode.postMessage({
        command: 'getMarkdownContent',
        filePath: data.statusFilePath
      });
    }
    
    // forceRefreshフラグがtrueの場合は、強制的に初期化メッセージを送信
    if (data.forceRefresh) {
      console.log('プロジェクトパスが変更されました - 強制更新のためサーバーに初期化メッセージを送信します');
      
      // 現在のスコープ情報をクリア
      const scopeList = document.getElementById('scope-list');
      if (scopeList) {
        scopeList.innerHTML = '<div class="scope-item"><span>データを更新中...</span></div>';
      }
      
      // ステータスバーのテキストを変更して更新中であることを示す
      const progressText = document.getElementById('project-progress-text');
      if (progressText) {
        progressText.textContent = '更新中...';
      }
      
      // 状態を完全にリセット
      const resetState = {
        scopes: [],
        selectedScopeIndex: -1,
        selectedScope: null,
        directoryStructure: ''
      };
      
      // 状態リセット
      console.log('状態を完全にリセットします:', resetState);
      vscode.setState(resetState);
      
      // UI要素をクリア
      const selectedScopeTitle = document.getElementById('scope-title');
      if (selectedScopeTitle) {
        selectedScopeTitle.textContent = 'スコープを選択してください';
      }
      
      // 選択されたスコープの詳細表示をクリア
      const scopeDetailContent = document.getElementById('scope-detail-content');
      if (scopeDetailContent) {
        scopeDetailContent.style.display = 'none';
      }
      
      const scopeEmptyMessage = document.getElementById('scope-empty-message');
      if (scopeEmptyMessage) {
        scopeEmptyMessage.style.display = 'block';
      }
      
      // 初期化メッセージの送信（新しいプロジェクトデータを取得するためのリクエスト）
      setTimeout(() => {
        console.log('初期化メッセージを送信します');
        vscode.postMessage({ command: 'initialize' });
      }, 300);
    }
  }
  
  /**
   * 状態更新ハンドラー
   */
  function handleUpdateState(data) {
    // デバッグログ
    console.log('状態更新受信:', 
      'スコープ数:', data.scopes ? data.scopes.length : 0, 
      '選択中インデックス:', data.selectedScopeIndex);
    
    // 初期データを保存
    vscode.setState(data);
    
    // スコープリスト更新
    updateScopeList(data.scopes);
    
    // 選択されたスコープの表示を更新
    if (data.selectedScopeIndex >= 0 && data.selectedScope) {
      updateSelectedScope(data.selectedScope);
    }
    
    // プロジェクト進捗の更新
    updateProjectProgress(data.scopes);
    
    // CURRENT_STATUS.mdのマークダウン表示（バックエンドから受け取っている場合）
    if (data.currentStatusMarkdown) {
      displayMarkdownContent(data.currentStatusMarkdown);
    } else {
      // バックエンドからマークダウンデータが取得できていない場合は
      // ファイル取得メッセージを送信
      if (data.statusFilePath) {
        vscode.postMessage({
          command: 'getMarkdownContent',
          filePath: data.statusFilePath
        });
      }
    }
  }
  
  /**
   * マークダウンコンテンツを表示
   */
  function displayMarkdownContent(markdownContent) {
    const markdownContainer = document.querySelector('.markdown-content');
    if (markdownContainer) {
      // マークダウンをHTMLに変換
      const htmlContent = convertMarkdownToHtml(markdownContent);
      
      // HTML内容を設定
      markdownContainer.innerHTML = htmlContent;
      
      // ディレクトリツリーと表の特別なスタイリングを適用
      enhanceSpecialElements();
      
      // チェックボックスのイベントリスナー設定
      setupCheckboxes();
    }
  }
  
  // スタイリングとイベントリスナー関数は外部モジュールから提供される
  // enhanceSpecialElements, setupCheckboxes 関数は./utils/markdownConverter.jsに移動
  
  /**
   * プロジェクト進捗の更新
   */
  function updateProjectProgress(scopes) {
    if (!scopes || scopes.length === 0) {
      return;
    }
    
    const progressElement = document.getElementById('project-progress');
    const progressText = document.getElementById('project-progress-text');
    
    // プロジェクト全体の進捗を計算
    const totalScopes = scopes.length;
    const completedScopes = scopes.filter(scope => scope.status === 'completed').length;
    const inProgressScopes = scopes.filter(scope => scope.status === 'in-progress').length;
    
    // 進捗率の計算 (完了=100%, 進行中=50%として計算)
    const progressPercentage = Math.round((completedScopes * 100 + inProgressScopes * 50) / totalScopes);
    
    // 進捗バーの更新
    if (progressElement) {
      progressElement.style.width = `${progressPercentage}%`;
    }
    
    // 進捗テキストの更新
    if (progressText) {
      progressText.textContent = `${progressPercentage}% 完了`;
    }
  }
  
  /**
   * スコープリストの更新
   */
  function updateScopeList(scopes) {
    const scopeList = document.getElementById('scope-list');
    if (!scopeList) return;
    
    // リストをクリア
    scopeList.innerHTML = '';
    
    // スコープがない場合は空のメッセージを表示
    if (!scopes || scopes.length === 0) {
      scopeList.innerHTML = `
        <div class="scope-item">
          <p>スコープが定義されていません</p>
          <p>CURRENT_STATUS.mdファイルにスコープを追加してください</p>
        </div>
      `;
      return;
    }
    
    // 各スコープをリストに追加
    scopes.forEach((scope, index) => {
      const statusClass = getStatusClass(scope.status);
      const progressPercentage = scope.progress || 0;
      
      // スコープアイテムの作成
      const scopeItem = document.createElement('div');
      scopeItem.className = `scope-item ${index === vscode.getState().selectedScopeIndex ? 'active' : ''}`;
      scopeItem.innerHTML = `
        <h3>${scope.name}</h3>
        <div class="scope-progress">
          <div class="scope-progress-bar ${statusClass}" style="width: ${progressPercentage}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
          <span style="font-size: 0.9rem; color: var(--app-text-secondary);">${scope.files ? scope.files.length : 0}ファイル</span>
          <span style="font-size: 0.9rem; padding: 2px 8px; background-color: var(--app-primary-light); color: var(--app-primary); border-radius: 10px;">
            ${progressPercentage}% ${getStatusText(scope.status)}
          </span>
        </div>
      `;
      
      // クリックイベントの追加
      scopeItem.addEventListener('click', () => {
        // スコープが選択されたことをバックエンドに通知
        vscode.postMessage({
          command: 'selectScope',
          index: index
        });
      });
      
      scopeList.appendChild(scopeItem);
    });
  }
  
  // タブ切り替え処理は initializeTabs に統合されたため、この関数は削除
  
  /**
   * プロンプトカードの初期化
   */
  function initializePromptCards() {
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
        // カスタムモーダルダイアログを表示
        showTerminalModeDialog(url, info.name, index);
      });
      
      // ターミナルモード選択用のカスタムダイアログ関数を追加
      function showTerminalModeDialog(url, name, index) {
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
      
      promptGrid.appendChild(card);
    });
    
    // ツールタブのコンテンツも作成
    const toolsTab = document.getElementById('tools-tab');
    if (toolsTab) {
      const toolsGrid = document.createElement('div');
      toolsGrid.className = 'prompt-grid';
      
      // 開発ツールカードを追加
      const toolsData = [
        { 
          name: "要件定義エディタ", 
          icon: "fact_check", 
          command: "openRequirementsVisualizer", 
          description: "要件定義書の編集と管理" 
        },
        { 
          name: "環境変数アシスタント", 
          icon: "emoji_objects", 
          command: "openEnvironmentVariablesAssistant", 
          description: "環境変数の設定と管理" 
        },
        { 
          name: "モックアップギャラリー", 
          icon: "dashboard", 
          command: "openMockupGallery", 
          description: "UIモックアップの表示と管理" 
        },
        { 
          name: "デバッグ探偵", 
          icon: "bug_report", 
          command: "openDebugDetective", 
          description: "エラー解析とデバッグ支援" 
        }
      ];
      
      toolsData.forEach(tool => {
        const card = document.createElement('div');
        card.className = 'prompt-card';
        card.innerHTML = `
          <span class="material-icons prompt-icon">${tool.icon}</span>
          <h3 class="prompt-title">${tool.name}</h3>
          <p class="prompt-description">${tool.description}</p>
        `;
        
        // クリックイベント
        card.addEventListener('click', () => {
          vscode.postMessage({
            command: tool.command
          });
        });
        
        toolsGrid.appendChild(card);
      });
      
      toolsTab.appendChild(toolsGrid);
    }
    
    // プロンプトタブにグリッドを追加
    promptsTab.appendChild(promptGrid);
  }
  
  /**
   * イベントリスナーの設定
   */
  function setupEventListeners() {
    // 実装開始ボタン
    const implementButton = document.getElementById('implement-button');
    if (implementButton) {
      implementButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'startImplementation' });
      });
    }
    
    // ディレクトリ構造ボタン
    const directoryButton = document.getElementById('directory-structure-button');
    if (directoryButton) {
      directoryButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'showDirectoryStructure' });
      });
    }
    
    // スコープ新規作成ボタン
    const createScopeButton = document.getElementById('create-scope-button');
    if (createScopeButton) {
      createScopeButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'addNewScope' });
      });
    }
    
    // タブ切り替えは initializeTabs で設定済み
  }
  
  /**
   * 選択されたスコープの詳細を更新
   */
  function updateSelectedScope(scope) {
    const scopeTitle = document.getElementById('scope-title');
    const scopeDescription = document.getElementById('scope-description');
    const scopeProgressBar = document.getElementById('scope-progress-bar');
    const scopeProgressText = document.getElementById('scope-progress');
    const implementationFiles = document.getElementById('implementation-files');
    
    if (scopeTitle) {
      scopeTitle.textContent = scope.name;
    }
    
    if (scopeDescription) {
      scopeDescription.textContent = scope.description || '説明がありません';
    }
    
    const progress = scope.progress || 0;
    
    if (scopeProgressBar) {
      scopeProgressBar.style.width = `${progress}%`;
      scopeProgressBar.className = `progress-fill ${getStatusClass(scope.status)}`;
    }
    
    if (scopeProgressText) {
      scopeProgressText.textContent = `${progress}%`;
    }
    
    // 実装予定ファイルのリスト更新
    if (implementationFiles) {
      implementationFiles.innerHTML = '';
      
      if (scope.files && scope.files.length > 0) {
        scope.files.forEach(file => {
          const fileItem = document.createElement('div');
          fileItem.className = 'file-item';
          fileItem.innerHTML = `
            <input type="checkbox" class="file-checkbox" ${file.completed ? 'checked' : ''} />
            <span>${file.path}</span>
          `;
          
          // チェックボックスのイベントリスナー
          const checkbox = fileItem.querySelector('.file-checkbox');
          if (checkbox) {
            checkbox.addEventListener('change', (e) => {
              vscode.postMessage({
                command: 'toggleFileStatus',
                filePath: file.path,
                completed: e.target.checked
              });
            });
          }
          
          implementationFiles.appendChild(fileItem);
        });
      } else {
        implementationFiles.innerHTML = '<div class="file-item">実装予定ファイルがありません</div>';
      }
    }
    
    // スコープ詳細カードを表示
    const scopeDetailContent = document.getElementById('scope-detail-content');
    if (scopeDetailContent) {
      scopeDetailContent.style.display = 'block';
    }
    
    // 空メッセージを非表示
    const scopeEmptyMessage = document.getElementById('scope-empty-message');
    if (scopeEmptyMessage) {
      scopeEmptyMessage.style.display = 'none';
    }
  }
  
  // getStatusClass関数はuiHelpers.jsにエクスポートした関数を使用
  
  // getStatusText関数はuiHelpers.jsにエクスポートした関数を使用
  
  // showError関数はuiHelpers.jsにエクスポートした関数を使用
  
  // showSuccess関数はuiHelpers.jsにエクスポートした関数を使用
  
  /**
   * プロジェクト名を更新
   */
  function updateProjectName(projectName) {
    const state = vscode.getState() || {};
    
    // 同じプロジェクト名が既に表示されている場合は変更しない
    if (state.currentDisplayedProject === projectName) {
      console.log(`プロジェクト名は既に更新済み: ${projectName}`);
      return;
    }
    
    // プロジェクト名をヘッダーに更新（タブバーの左側に表示されるプロジェクト名）
    const projectDisplayName = document.querySelector('.project-display .project-name');
    if (projectDisplayName) {
      console.log(`プロジェクト名を更新: ${projectName}`);
      projectDisplayName.textContent = projectName;
      
      // 現在表示中のプロジェクト名を記録
      state.currentDisplayedProject = projectName;
      vscode.setState(state);
    } else {
      console.warn('プロジェクト名表示要素が見つかりません: .project-display .project-name');
    }
  }
  
  /**
   * プロジェクト一覧を更新
   * @param {Array} projects プロジェクト一覧
   * @param {Object} activeProject アクティブなプロジェクト
   */
  function updateProjects(projects, activeProject) {
    console.log('プロジェクト一覧更新:', projects.length, '件', 'アクティブプロジェクト:', activeProject?.name);
    
    // アクティブプロジェクト情報を状態に保存（他のパネルから戻ってきた時のために）
    if (activeProject) {
      const state = vscode.getState() || {};
      state.activeProjectName = activeProject.name;
      state.activeProjectPath = activeProject.path;
      state.activeTab = activeProject.metadata?.activeTab || 'current-status';
      vscode.setState(state);
    }
    
    const projectList = document.getElementById('project-list');
    if (!projectList) return;
    
    // 既存のアクティブプロジェクトエリアがあれば削除
    const existingActiveArea = document.getElementById('active-project-area');
    if (existingActiveArea) {
      existingActiveArea.remove();
    }
    
    // 既存の他のプロジェクトラベルがあれば削除
    const existingLabel = document.getElementById('other-projects-label');
    if (existingLabel) {
      existingLabel.remove();
    }
    
    // リストをクリア
    projectList.innerHTML = '';
    
    // プロジェクトがない場合の表示
    if (!projects || projects.length === 0) {
      projectList.innerHTML = '<div class="project-item">プロジェクトがありません</div>';
      return;
    }
    
    // ソート済みのプロジェクト配列を作成（アクティブプロジェクトを先頭に）
    let sortedProjects = [...projects];
    
    // プロジェクトを作成日時順にソートする（古いものから新しいものへ）
    sortedProjects.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    // プロジェクトをリストに追加
    sortedProjects.forEach((project) => {
      const item = document.createElement('div');
      const isActive = activeProject && activeProject.id === project.id;
      
      // すべてのプロジェクトに同じスタイルを適用
      item.className = isActive ? 'project-item active' : 'project-item';
      
      // アクティブプロジェクトにはidを設定
      if (isActive) {
        item.id = 'active-project-item';
      }
      
      // プロジェクト表示名はパスの最後のディレクトリ名か設定されている名前を使用
      let displayName = project.name || '';
      if (!displayName && project.path) {
        // パスから抽出
        const pathParts = project.path.split(/[/\\]/);
        displayName = pathParts[pathParts.length - 1] || 'プロジェクト';
      }
      
      // すべてのプロジェクトで統一されたHTMLを使用
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
          <div>
            <span class="project-name" ${isActive ? 'style="font-weight: 600;"' : ''}>${displayName}</span>
            <span class="project-path" style="font-size: 10px; color: var(--app-text-secondary); display: block; margin-top: 2px;">${project.path || 'パスなし'}</span>
          </div>
          <button class="remove-project-btn" title="プロジェクトの登録を解除" style="background: none; border: none; cursor: pointer; color: var(--app-text-secondary); opacity: 0.5; font-size: 16px;">
            <span class="material-icons" style="font-size: 16px;">close</span>
          </button>
        </div>
      `;
      
      // 全体のクリックイベント
      const handleProjectClick = () => {
        // アクティブクラスを削除
        document.querySelectorAll('.project-item').forEach(pi => pi.classList.remove('active'));
        // クリックされた項目をアクティブに
        item.classList.add('active');
        
        // プロジェクト選択の進行中メッセージを表示
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.innerHTML = `
          <span class="material-icons" style="color: var(--app-warning);">hourglass_top</span>
          <span class="notification-text">プロジェクト「${displayName}」を読み込み中...</span>
        `;
        notification.style.display = 'flex';
        notification.style.opacity = '1';
        notification.style.backgroundColor = 'rgba(253, 203, 110, 0.15)';
        
        // 通知領域にメッセージを表示
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
          errorContainer.parentNode.insertBefore(notification, errorContainer);
        } else {
          document.body.appendChild(notification);
        }
        
        // 現在のアクティブタブIDを取得
        const currentActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab');
        console.log('現在のアクティブタブ:', currentActiveTab);
        
        // 状態にプロジェクト情報を保存（他のパネルから戻ってきた時に復元するため）
        const state = vscode.getState() || {};
        state.activeProjectName = displayName;
        state.activeProjectPath = project.path;
        state.activeTab = currentActiveTab || 'current-status';
        vscode.setState(state);
        console.log('プロジェクト状態を保存しました:', state);
        
        // VSCodeにプロジェクト変更のメッセージを送信（アクティブタブ情報も送信）
        vscode.postMessage({
          command: 'selectProject',
          projectName: displayName,
          projectPath: project.path,
          activeTab: currentActiveTab
        });
        
        // 3秒後に通知を削除
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 3000);
      };
      
      // リフレッシュボタンのクリックイベント（アクティブプロジェクトのみ）
      if (isActive) {
        const refreshBtn = item.querySelector('.refresh-project-btn');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', (e) => {
            // クリックイベントの伝播を停止
            e.stopPropagation();
            
            // プロジェクト名を取得
            const projectName = item.querySelector('.project-name').textContent;
            
            // リロード中のフィードバック
            const notification = document.createElement('div');
            notification.className = 'save-notification';
            notification.innerHTML = `
              <span class="material-icons" style="color: var(--app-primary);">refresh</span>
              <span class="notification-text">プロジェクト「${projectName}」をリロード中...</span>
            `;
            notification.style.display = 'flex';
            notification.style.opacity = '1';
            notification.style.backgroundColor = 'rgba(74, 105, 189, 0.15)';
            
            // 通知領域にメッセージを表示
            const errorContainer = document.getElementById('error-container');
            if (errorContainer) {
              errorContainer.parentNode.insertBefore(notification, errorContainer);
            } else {
              document.body.appendChild(notification);
            }
            
            // 現在のアクティブタブIDを取得
            const currentActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab');
            console.log('リフレッシュ時の現在のアクティブタブ:', currentActiveTab);
            
            // VSCodeにプロジェクト選択のメッセージを送信（アクティブタブ情報も送信）
            vscode.postMessage({
              command: 'selectProject',
              projectName: projectName,
              projectPath: project.path,
              activeTab: currentActiveTab
            });
            
            // 3秒後に通知を削除
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 3000);
          });
          
          // ホバー効果
          refreshBtn.addEventListener('mouseover', () => {
            refreshBtn.style.color = 'var(--app-primary-dark)';
          });
          
          refreshBtn.addEventListener('mouseout', () => {
            refreshBtn.style.color = 'var(--app-primary)';
          });
        }
      }
      
      // 削除ボタンのクリックイベント
      const removeBtn = item.querySelector('.remove-project-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          // クリックイベントの伝播を停止
          e.stopPropagation();
          
          // 確認ダイアログ
          const projectName = item.querySelector('.project-name').textContent;
          
          // シンプルな確認ダイアログを作成
          const overlay = document.createElement('div');
          overlay.className = 'dialog-overlay';
          overlay.style.zIndex = '10000';
          
          const dialog = document.createElement('div');
          dialog.className = 'dialog';
          dialog.innerHTML = `
            <div class="dialog-title">プロジェクト登録解除の確認</div>
            <div style="margin: 20px 0;">
              <p>プロジェクト「${projectName}」の登録を解除しますか？</p>
              <p style="color: var(--app-text-secondary); font-size: 0.9em; margin-top: 10px;">
                注意: この操作はプロジェクトファイルを削除するものではなく、
                AppGeniusからの登録を解除するだけです。
              </p>
            </div>
            <div class="dialog-footer">
              <button class="button button-secondary" id="cancel-remove">キャンセル</button>
              <button class="button" id="confirm-remove" style="background-color: var(--app-danger);">登録解除</button>
            </div>
          `;
          
          overlay.appendChild(dialog);
          document.body.appendChild(overlay);
          
          // キャンセルボタン
          document.getElementById('cancel-remove')?.addEventListener('click', () => {
            document.body.removeChild(overlay);
          });
          
          // 確認ボタン
          document.getElementById('confirm-remove')?.addEventListener('click', () => {
            // VSCodeにプロジェクト削除のメッセージを送信
            vscode.postMessage({
              command: 'removeProject',
              projectName: projectName,
              projectPath: project.path,
              projectId: project.id
            });
            
            // ダイアログを閉じる
            document.body.removeChild(overlay);
            
            // 削除中のフィードバック
            item.style.opacity = '0.5';
            item.style.pointerEvents = 'none';
          });
        });
        
        // ホバー効果
        removeBtn.addEventListener('mouseover', () => {
          removeBtn.style.opacity = '0.8';
          removeBtn.style.color = 'var(--app-text)';
        });
        
        removeBtn.addEventListener('mouseout', () => {
          removeBtn.style.opacity = '0.5';
          removeBtn.style.color = 'var(--app-text-secondary)';
        });
      }
      
      // 削除ボタンとリフレッシュボタン以外の領域のクリックで全体のクリックイベントを発火
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-project-btn') && !e.target.closest('.refresh-project-btn')) {
          handleProjectClick();
        }
      });
      
      projectList.appendChild(item);
    });
  }
  
  /**
   * プロジェクトナビゲーションの初期化
   */
  function initializeProjectNav() {
    const toggleNavBtn = document.getElementById('toggle-nav-btn');
    if (toggleNavBtn) {
      // 初期化時にアイコンの向きを確認・設定
      const projectNav = document.querySelector('.project-nav');
      const icon = toggleNavBtn.querySelector('.material-icons');
      
      if (projectNav && projectNav.classList.contains('collapsed')) {
        icon.textContent = 'chevron_right';
      } else if (icon) {
        icon.textContent = 'chevron_left';
      }
      
      toggleNavBtn.addEventListener('click', function() {
        const projectNav = document.querySelector('.project-nav');
        const contentArea = document.querySelector('.content-area');
        const icon = toggleNavBtn.querySelector('.material-icons');
        
        if (projectNav.classList.contains('collapsed')) {
          // パネルを展開
          projectNav.classList.remove('collapsed');
          contentArea.classList.remove('expanded');
          icon.textContent = 'chevron_left';
          toggleNavBtn.title = 'パネルを閉じる';
        } else {
          // パネルを折りたたむ
          projectNav.classList.add('collapsed');
          contentArea.classList.add('expanded');
          icon.textContent = 'chevron_right';
          toggleNavBtn.title = 'パネルを開く';
        }
      });
    }
    
    // 初期化時はバックエンドからプロジェクト一覧を要求
    // 初期化はすでに実行済みなので、この時点では何もしない

    // プロジェクトリスト初期化
    const projectList = document.getElementById('project-list');
    if (projectList) {
      // 初期状態ではローディングメッセージを表示
      projectList.innerHTML = '<div class="project-item loading">プロジェクト一覧を読み込み中...</div>';
    }
    
    // 新規プロジェクトボタンのイベント設定
    const newProjectBtn = document.getElementById('new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        console.log('新規プロジェクト作成ボタンがクリックされました');
        showNewProjectModal();
      });
    }
    
    // プロジェクトファイル読み込みボタンのイベント設定
    const loadProjectBtn = document.getElementById('load-project-btn');
    if (loadProjectBtn) {
      loadProjectBtn.addEventListener('click', () => {
        console.log('プロジェクト読み込みボタンがクリックされました');
        vscode.postMessage({
          command: 'loadExistingProject'
        });
      });
    }
  }
  
  /**
   * マークダウン表示の初期化
   */
  function initializeMarkdownDisplay() {
    // CURRENT_STATUS.mdファイルをマークダウンとして表示する処理
    // バックエンドから受け取ったマークダウンデータを表示
    // この段階では何もしない、メッセージハンドラーで処理される
    console.log('マークダウン表示の初期化完了');
  }
  
  // マークダウン変換関数は外部モジュールから提供される
  // convertMarkdownToHtml, convertMarkdownTableToHtml 関数は./utils/markdownConverter.jsに移動
  
  /**
   * 共有機能関連の関数
   * 以下の共有関連機能はsharingPanel.jsで実装されています
   * - showShareResult()
   * - updateSharingHistory()
   * - showCopySuccess()
   * - resetDropZone()
   * 
   * こちらのファイルからは除去し、重複による競合を防止します
   */
  
  /**
   * プロジェクト選択状態を復元する
   * 他のパネル（モックアップギャラリーなど）から戻ってきた時に、
   * 以前選択していたプロジェクトとタブを復元する
   */
  function restoreProjectState() {
    // 復元処理はUIのレンダリング完了後に適切なタイミングで行う
    // 遅延を少し長めにして確実にDOM要素が生成されたタイミングで実行
    setTimeout(() => {
      try {
        const currentState = vscode.getState() || {};
        const { activeProjectName, activeProjectPath, activeTab } = currentState;
        
        console.log('プロジェクト状態の復元を試みます:', { 
          activeProjectName, 
          activeProjectPath, 
          activeTab
        });
        
        // 状態がローカルに保存されていない場合はバックエンドから同期されるのを待つ
        if (!activeProjectName || !activeProjectPath) {
          console.log('ローカルにプロジェクト状態が保存されていません。バックエンドから同期を待ちます。');
          return;
        }
        
        // タブ状態の復元を行う
        if (activeTab) {
          // タブが存在するか確認する（存在しない場合はデフォルトタブにフォールバック）
          const tabExists = Array.from(document.querySelectorAll('.tab'))
            .some(tab => tab.getAttribute('data-tab') === activeTab);
          
          const tabToSelect = tabExists ? activeTab : 'current-status';
          
          // TabStateManagerを使って確実にタブ状態を選択・保存
          TabStateManager.save('scopeManager', tabToSelect);
          
          console.log(`復元完了: タブ ${tabToSelect} を選択しました`);
        }
      } catch (error) {
        console.error('プロジェクト状態の復元中にエラーが発生しました:', error);
      }
    }, 200); // 少し長めの遅延でDOM構築完了を確実に待つ
  }

  // getTimeAgo関数はuiHelpers.jsにエクスポートした関数を使用
  
  /**
   * 新規プロジェクト作成用モーダルを表示
   */
  function showNewProjectModal() {
    console.log('新規プロジェクトモーダル表示処理を開始します');
    
    try {
      // 既存のモーダルを削除
      document.querySelectorAll('#new-project-modal').forEach(m => {
        console.log('モーダル要素を削除します:', m.id);
        m.remove();
      });
      
      // モーダルを新規作成
      console.log('モーダルを新規作成します');
      const modal = document.createElement('div');
      modal.id = 'new-project-modal';
      
      // スタイルを詳細に設定
      Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '10000'
      });
      
      // シンプルなモーダル内容
      modal.innerHTML = `
        <div style="background-color: white; border-radius: 10px; width: 400px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);">
          <div style="padding: 20px; border-bottom: 1px solid #ddd;">
            <h2 style="margin: 0; font-size: 18px;">新規プロジェクト作成</h2>
          </div>
          <div style="padding: 20px;">
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px;">プロジェクト名 <span style="color: red;">*</span></label>
              <input type="text" id="project-name" required placeholder="例: MyWebApp" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
          </div>
          <div style="padding: 15px 20px; border-top: 1px solid #ddd; text-align: right;">
            <button type="button" id="cancel-new-project" style="padding: 6px 12px; margin-right: 10px; background: #f1f1f1; border: none; border-radius: 4px; cursor: pointer;">キャンセル</button>
            <button type="button" id="create-project-btn" style="padding: 6px 12px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer;">作成</button>
          </div>
        </div>
      `;
      
      // ボディにモーダルを追加
      document.body.appendChild(modal);
      
      // イベントリスナーを設定
      const cancelBtn = document.getElementById('cancel-new-project');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', hideNewProjectModal);
      }
      
      const createBtn = document.getElementById('create-project-btn');
      if (createBtn) {
        createBtn.addEventListener('click', createNewProject);
      }
      
      // 名前フィールドにフォーカス
      const projectName = document.getElementById('project-name');
      if (projectName) {
        projectName.focus();
      }
      
    } catch (e) {
      console.error('モーダル表示処理中にエラーが発生しました', e);
    }
  }
  
  /**
   * 新規プロジェクトモーダルを非表示
   */
  function hideNewProjectModal() {
    console.log('モーダルを非表示にします');
    const modal = document.getElementById('new-project-modal');
    if (modal) {
      modal.remove();
    }
  }
  
  /**
   * 新規プロジェクト作成処理
   */
  function createNewProject() {
    console.log('新規プロジェクト作成処理を開始します');
    const nameEl = document.getElementById('project-name');
    
    if (!nameEl) {
      console.error('プロジェクト名入力フィールド(#project-name)が見つかりません');
      return;
    }
    
    const name = nameEl.value.trim();
    console.log('入力されたプロジェクト名:', name);
    
    if (!name) {
      console.warn('プロジェクト名が空です');
      showError('プロジェクト名を入力してください');
      return;
    }
    
    console.log('VSCodeにメッセージを送信します: createProject');
    vscode.postMessage({
      command: 'createProject',
      name,
      description: ""
    });
    
    hideNewProjectModal();
  }
  
  // displayModelMockupとsetupMockupViewerHandlersは不要になったため削除
  
  // showDirectoryStructure関数はuiHelpers.jsにエクスポートした関数を使用
  
  /**
   * タブ機能の初期化
   */
  function initializeTabs() {
    console.log('タブ機能の初期化を開始します');
    
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // 現在の状態を取得
    const state = vscode.getState() || {};
    const savedActiveTab = state.activeTab;
    
    console.log(`タブ初期化: 保存されたアクティブタブ=${savedActiveTab || 'なし'}`);
    
    // 初期状態のUI設定（デフォルトタブまたは保存されたタブ）
    if (savedActiveTab) {
      // 保存されたタブが存在するか確認
      const tabExists = Array.from(tabs)
        .some(tab => tab.getAttribute('data-tab') === savedActiveTab);
      
      // 存在する場合はそのタブを選択し、存在しない場合はデフォルトタブを使用
      const initialTabId = tabExists ? savedActiveTab : 'current-status';
      
      console.log(`初期タブ選択: ${initialTabId} (保存値の存在: ${tabExists ? '有効' : '無効'})`);
      
      // UIの初期状態を設定
      tabs.forEach(tab => {
        const tabId = tab.getAttribute('data-tab');
        if (tabId === initialTabId) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
      
      tabContents.forEach(content => {
        if (content.id === `${initialTabId}-tab`) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
      
      // 状態を更新（初期化時に送信はしない）
      if (state.activeTab !== initialTabId) {
        state.activeTab = initialTabId;
        vscode.setState(state);
      }
    }
    
    // タブクリックイベントの設定（一貫したフローで処理）
    tabs.forEach(tab => {
      tab.addEventListener('click', (event) => {
        const tabId = tab.getAttribute('data-tab');
        
        // 「モックアップギャラリー」タブの特別処理
        if (tabId === 'tools') {
          // デフォルトのタブ切り替え動作を防止
          event.preventDefault();
          event.stopPropagation();
          
          // モックアップギャラリーを別ウィンドウで開く
          vscode.postMessage({ command: 'openOriginalMockupGallery' });
          
          // 現在アクティブなタブはそのまま維持
          return;
        }
        
        // TabStateManagerを使って一貫した方法でタブ状態を処理
        TabStateManager.save('scopeManager', tabId);
        
        // UIの更新も一貫した関数で行う
        selectTab(tabId, true);
        
        console.log(`ユーザーによるタブ選択: ${tabId}`);
      });
    });
    
    console.log('タブ機能の初期化が完了しました');
  }
  
  // 中間ページ関連のコードは不要になりました
  
  /**
   * ClaudeCode連携エリアの初期化
   * 注: 基本的な表示/非表示のトグル処理のみを担当し、
   * 詳細機能はsharingPanel.jsに任せる簡易版
   */
  function initializeClaudeCodeShareArea() {
    // トグルボタンとシェアエリア要素を取得
    const toggleBtn = document.getElementById('toggle-share-btn');
    const shareArea = document.getElementById('claude-code-share');
    const minimizeBtn = document.getElementById('minimize-share-btn');
    const shareTextarea = document.querySelector('.share-textarea');
    
    if (!toggleBtn || !shareArea || !minimizeBtn) return;
    
    // 初期状態では非表示
    shareArea.classList.add('collapsed');
    
    // トグルボタンのクリックイベント
    toggleBtn.addEventListener('click', () => {
      shareArea.classList.remove('collapsed');
      toggleBtn.style.display = 'none';
    });
    
    // 最小化ボタンのクリックイベント
    minimizeBtn.addEventListener('click', () => {
      shareArea.classList.add('collapsed');
      toggleBtn.style.display = 'flex';
    });

    // テキストエリアは標準の動作のままにする
    
    // 開発プロンプトカードを初期化
    initializePromptCardsInModal();
    
    console.log('scopeManager.js: 基本的なClaudeCode連携エリアの初期化を完了しました');
    // 詳細な機能はsharingPanel.jsに任せるため、ここでは最小限の初期化のみ行う
  }
  
  /**
   * タブ状態管理機能 - 単一責任の原則に基づいたシンプルな実装
   */
  const TabStateManager = {
    getKey: (panelId) => `tab_state_${panelId || 'scopeManager'}`,
    
    save: (panelId, tabId) => {
      // ローカルストレージと状態オブジェクトの両方に保存
      const state = vscode.getState() || {};
      const key = TabStateManager.getKey(panelId);
      
      // 状態を更新
      state.activeTab = tabId;
      state.lastSavedTab = tabId;
      
      // VSCode状態を更新
      vscode.setState(state);
      
      // バックエンドにも通知
      vscode.postMessage({
        command: 'saveTabState',
        tabId: tabId
      });
      
      console.log(`タブ状態を保存: ${tabId}, キー: ${key}`);
      return true;
    },
    
    restore: (panelId, defaultTab = 'current-status') => {
      const state = vscode.getState() || {};
      const savedTab = state.activeTab;
      return savedTab || defaultTab;
    }
  };
  
  /**
   * 指定したタブを選択状態にする (シンプル化版)
   * @param {string} tabId タブID
   * @param {boolean} saveToServer サーバーにタブ状態を保存するかどうか（デフォルトはtrue）
   */
  function selectTab(tabId, saveToServer = true) {
    if (!tabId) return;
    
    console.log(`タブ選択: ${tabId}, サーバー保存: ${saveToServer}`);
    
    // 現在の状態を取得
    const state = vscode.getState() || {};
    const currentTab = state.activeTab;
    const previouslySavedTab = state.lastSavedTab;
    
    // 既に同じタブがアクティブな場合は早期リターン（無駄な更新を防止）
    if (currentTab === tabId && document.querySelector(`.tab[data-tab="${tabId}"].active`)) {
      console.log(`既に同じタブ(${tabId})がアクティブのため処理をスキップ`);
      return;
    }
    
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // UI: タブの選択状態を更新
    tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // UI: タブコンテンツの表示状態を更新
    tabContents.forEach(content => {
      if (content.id === `${tabId}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // データ永続化: 条件に基づいてサーバーに保存
    if (saveToServer && previouslySavedTab !== tabId) {
      // TabStateManagerを使ってタブ状態を保存
      TabStateManager.save('scopeManager', tabId);
    } else {
      // ローカルのみに保存（サーバー保存なし）
      state.activeTab = tabId;
      vscode.setState(state);
      console.log(`ローカルのみに保存: ${tabId} (サーバー保存: ${saveToServer}, 前回の保存: ${previouslySavedTab || 'なし'})`);
    }
  }
  
  /**
   * ツールタブの内容を更新
   * @param {string} content HTMLコンテンツ
   */
  function updateToolsTab(content) {
    const toolsTab = document.getElementById('tools-tab');
    if (!toolsTab) {
      console.error('tools-tabが見つかりません');
      return;
    }
    
    console.log('ツールタブの内容を更新します');
    
    // 既存の内容をクリア
    toolsTab.innerHTML = '';
    
    // 新しい内容を設定
    toolsTab.innerHTML = content;
    
    console.log('ツールタブの内容を更新しました');
  }
  
  
  /**
   * 開発プロンプトモーダルにプロンプトカードを初期化
   */
  function initializePromptCardsInModal() {
    const promptGrid = document.querySelector('.claude-code-share-area .prompt-grid');
    if (!promptGrid) return;
    
    // developmentway.md に基づいた15個のプロンプト情報を使用
    const allPrompts = [
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
    
    // モーダル内にプロンプトカードを追加
    allPrompts.forEach(prompt => {
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
          // カスタムモーダルダイアログを表示
          showModalTerminalModeDialog(url, prompt.id, prompt.name);
        }
      });
      
      // ターミナルモード選択用のカスタムダイアログ関数
      function showModalTerminalModeDialog(url, promptId, promptName) {
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
      
      promptGrid.appendChild(card);
    });
  }
})();