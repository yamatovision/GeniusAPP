# ScopeManagerPanel タブ管理機能リファクタリング改善計画

## 1. 概要と課題

以前のタブ管理（TabManager）機能リファクタリングでは課題があり、GitでCODE変更を元に戻す結果となりました。本計画では、その失敗を分析し、安全かつ確実に実装するための詳細な手順を示します。

### 現状の課題
- タブ関連機能（initializeTabs, selectTab, TabStateManager）が一つのファイルに混在
- 状態管理（vscode.getState(), vscode.setState()）への強い依存
- タブ状態の保持と復元処理が複雑
- タブ切り替えとプロジェクト状態の連動が不明瞭

## 2. 失敗原因の分析

前回のリファクタリング失敗の主な原因：

1. **状態管理の連携不足**：
   - VSCode WebViewの状態管理との連携が不十分
   - 状態の保存/復元タイミングでの不整合

2. **並行実装と検証の欠如**：
   - 一度に大きな変更を行い、段階的な検証が不足
   - 新旧実装を並行動作させる仕組みがなかった

3. **依存関係の把握不足**：
   - TabManagerと他モジュールとの依存関係の把握が不十分
   - 特にプロジェクト状態との連携に問題

4. **エッジケース対応の漏れ**：
   - 別パネルからの復帰時のタブ状態復元処理が不完全
   - タブIDが無効な場合の対応が不足

## 3. 改善アプローチ

### 3.1 設計原則

1. **段階的実装**：小さな変更を積み重ね、各ステップで検証
2. **並行実行と比較**：新旧実装を一定期間共存させ、結果を比較
3. **フラグ管理**：機能切替フラグで安全に新実装をテスト
4. **可視化されたログ**：タブ状態変更を明示的にログ出力
5. **網羅的な検証**：すべてのタブ操作パターンを体系的にテスト

### 3.2 モジュール設計

```
media/
├── components/
│   └── tabManager/
│       ├── tabManager.js   // タブ管理クラス
│       └── tabManager.css  // 既存のスタイル
└── state/
    └── stateManager.js     // 状態管理アダプター
```

#### TabManagerクラス設計

```javascript
/**
 * @class TabManager
 * @description ScopeManagerパネルのタブ機能を管理
 */
export class TabManager {
  // プロパティ
  panelId;         // パネル識別子
  stateManager;    // 状態管理オブジェクト
  defaultTabId;    // デフォルトタブID
  tabElements;     // タブ要素のコレクション
  tabContentElements; // タブコンテンツ要素
  activeTabId;     // アクティブなタブID
  initialized;     // 初期化済みフラグ
  useShadowMode;   // 並行実行モードフラグ

  // メソッド
  constructor(panelId, options = {}) {}
  initialize() {}
  selectTab(tabId, saveToServer = true) {}
  saveTabState(tabId) {}
  restoreTabState(defaultTabId = null) {}
  updateToolsTab(content) {}
  getActiveTabId() {}
  _getStateKey() {}
  _setupEventListeners() {}
  
  // 検証用メソッド
  _compareWithOriginal(tabId, originalFunction) {}
  enableShadowMode(enable = true) {}
}
```

#### StateManagerアダプター設計

```javascript
/**
 * @class StateManager
 * @description ウェブビューの状態管理を抽象化
 */
export class StateManager {
  // プロパティ
  vscode;      // VSCode API
  listeners;   // 状態変更リスナー
  debugMode;   // デバッグモードフラグ

  // メソッド
  constructor() {}
  getState() {}
  setState(state) {}
  updateState(partialState) {}
  postMessage(message) {}
  addListener(listener) {}
  _notifyListeners(state) {}
  
  // デバッグ用メソッド
  enableDebug(enable = true) {}
  logStateChange(oldState, newState) {}
}
```

## 4. 実装手順

### フェーズ1: 準備と分析（1時間）

1. **詳細なコード分析**
   - タブ関連機能を特定（initializeTabs, selectTab, TabStateManager）
   - 状態管理との連携ポイントを特定（getState/setState呼び出し）
   - プロジェクト状態との関連を分析

2. **既存のタブ操作フローの整理**
   ```
   ユーザータブクリック
     → .tab要素のclick処理
       → TabStateManager.save('scopeManager', tabId)
         → vscode.setState() で状態保存
         → vscode.postMessage({command: 'saveTabState', tabId}) でバックエンドに通知
       → selectTab(tabId, true)
         → タブUIの更新（.activeクラスの付け替え）
         → タブコンテンツの表示/非表示切替
   ```

3. **テスト用のスクリプト準備**
   - テストシナリオの整理
   - 検証用コマンドの準備

### フェーズ2: StateManagerアダプターの実装（2時間）

1. **基本構造と実装**
   ```javascript
   export class StateManager {
     constructor() {
       this.vscode = acquireVsCodeApi();
       this.listeners = [];
       this.debugMode = false;
     }
     
     getState() {
       return this.vscode.getState() || {};
     }
     
     setState(state) {
       // デバッグモードなら変更をログ出力
       if (this.debugMode) {
         const oldState = this.getState();
         this.logStateChange(oldState, state);
       }
       
       this.vscode.setState(state);
       this._notifyListeners(state);
     }
     
     // 他のメソッド...
   }
   ```

2. **デバッグ機能の実装**
   ```javascript
   enableDebug(enable = true) {
     this.debugMode = enable;
     console.log(`StateManager: デバッグモード ${enable ? '有効' : '無効'}`);
   }
   
   logStateChange(oldState, newState) {
     console.group('StateManager: 状態変更');
     console.log('旧状態:', oldState);
     console.log('新状態:', newState);
     
     // 差分を検出して表示
     const changes = {};
     for (const key in newState) {
       if (JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])) {
         changes[key] = {
           from: oldState[key],
           to: newState[key]
         };
       }
     }
     
     console.log('変更点:', changes);
     console.groupEnd();
   }
   ```

3. **検証用スクリプト**
   - コンソールから動作確認できるコマンドを追加

### フェーズ3: TabManagerクラスの実装 - 基本機能（3時間）

1. **基本構造と初期化**
   ```javascript
   export class TabManager {
     constructor(panelId, options = {}) {
       this.panelId = panelId || 'scopeManager';
       this.stateManager = options.stateManager || window.vscode;
       this.defaultTabId = options.defaultTabId || 'current-status';
       this.tabElements = null;
       this.tabContentElements = null;
       this.activeTabId = null;
       this.initialized = false;
       this.useShadowMode = options.useShadowMode || false;
       
       // メソッドのバインド
       this.selectTab = this.selectTab.bind(this);
       this.saveTabState = this.saveTabState.bind(this);
       this.restoreTabState = this.restoreTabState.bind(this);
       this._setupEventListeners = this._setupEventListeners.bind(this);
     }
     
     initialize() {
       // DOM要素の取得
       this.tabElements = document.querySelectorAll('.tab');
       this.tabContentElements = document.querySelectorAll('.tab-content');
       
       // 保存された状態から復元
       this.activeTabId = this.restoreTabState();
       
       // イベントリスナーの設定
       this._setupEventListeners();
       
       // 初期化完了
       this.initialized = true;
       
       console.log(`TabManager: "${this.activeTabId}"タブで初期化完了`);
       return this;
     }
     
     // 他のメソッド...
   }
   ```

2. **タブ選択とUIの更新**
   ```javascript
   selectTab(tabId, saveToServer = true) {
     if (!tabId) return;
     
     console.log(`TabManager: タブ"${tabId}"を選択, サーバー保存: ${saveToServer}`);
     
     // シャドウモードなら元の実装と並行比較
     if (this.useShadowMode) {
       this._compareWithOriginal(tabId, window.originalSelectTab);
     }
     
     // 現在の状態を取得
     const state = this.stateManager.getState() || {};
     const currentTab = state.activeTab;
     const previouslySavedTab = state.lastSavedTab;
     
     // 同じタブが既にアクティブなら何もしない
     if (currentTab === tabId && document.querySelector(`.tab[data-tab="${tabId}"].active`)) {
       console.log(`TabManager: タブ"${tabId}"は既にアクティブです, スキップします`);
       return;
     }
     
     // タブUIの更新
     this.tabElements.forEach(tab => {
       if (tab.getAttribute('data-tab') === tabId) {
         tab.classList.add('active');
       } else {
         tab.classList.remove('active');
       }
     });
     
     // コンテンツUIの更新
     this.tabContentElements.forEach(content => {
       if (content.id === `${tabId}-tab`) {
         content.classList.add('active');
       } else {
         content.classList.remove('active');
       }
     });
     
     // アクティブタブIDの更新
     this.activeTabId = tabId;
     
     // 条件に基づいて状態を保存
     if (saveToServer && previouslySavedTab !== tabId) {
       // サーバーに状態を保存
       this.saveTabState(tabId);
     } else {
       // ローカル状態のみ更新
       state.activeTab = tabId;
       this.stateManager.setState(state);
       console.log(`TabManager: ローカル状態のみ保存: ${tabId}`);
     }
   }
   ```

3. **状態保存と復元**
   ```javascript
   saveTabState(tabId) {
     // 状態キーの取得
     const key = this._getStateKey();
     
     // 状態の更新
     const state = this.stateManager.getState() || {};
     state.activeTab = tabId;
     state.lastSavedTab = tabId;
     
     // state managerに保存
     this.stateManager.setState(state);
     
     // サーバーに通知
     this.stateManager.postMessage({
       command: 'saveTabState',
       tabId: tabId
     });
     
     console.log(`TabManager: タブ状態を保存: ${tabId}, キー: ${key}`);
     return true;
   }
   
   restoreTabState(defaultTabId = null) {
     if (!defaultTabId) {
       defaultTabId = this.defaultTabId;
     }
     
     const state = this.stateManager.getState() || {};
     const savedTab = state.activeTab;
     
     // 保存されたタブが存在し、DOM内に要素があれば使用
     if (savedTab && document.querySelector(`.tab[data-tab="${savedTab}"]`)) {
       return savedTab;
     }
     
     return defaultTabId;
   }
   ```

4. **イベントリスナーの設定**
   ```javascript
   _setupEventListeners() {
     this.tabElements.forEach(tab => {
       tab.addEventListener('click', (event) => {
         const tabId = tab.getAttribute('data-tab');
         
         // toolsタブの特別処理
         if (tabId === 'tools') {
           // デフォルトのタブ切り替え動作を防止
           event.preventDefault();
           event.stopPropagation();
           
           // モックアップギャラリーを別ウィンドウで開く
           this.stateManager.postMessage({ 
             command: 'openOriginalMockupGallery' 
           });
           
           // 現在のタブをアクティブのまま維持
           return;
         }
         
         // 通常のタブ選択
         this.selectTab(tabId, true);
         
         console.log(`TabManager: ユーザーがタブ"${tabId}"をクリックしました`);
       });
     });
   }
   ```

### フェーズ4: シャドウモードの実装（2時間）

1. **並行実行と比較機能**
   ```javascript
   _compareWithOriginal(tabId, originalFunction) {
     try {
       // 元の実装の呼び出し結果を取得（DOM状態をキャプチャ）
       const beforeState = this._captureTabState();
       
       if (typeof originalFunction === 'function') {
         // 元の関数を一時的に呼び出し
         originalFunction(tabId);
       }
       
       // 元の実装のDOM状態を保存
       const originalState = this._captureTabState();
       
       // DOM状態を元に戻す
       this._restoreTabState(beforeState);
       
       // 新実装を呼び出し
       this._originalSelectTab(tabId);
       
       // 新実装のDOM状態を取得
       const newState = this._captureTabState();
       
       // 結果を比較
       const differences = this._compareStates(originalState, newState);
       
       if (Object.keys(differences).length > 0) {
         console.warn('TabManager: 新旧実装の結果に違いがあります:', differences);
       } else {
         console.log('TabManager: 新旧実装の結果は一致しています');
       }
     } catch (error) {
       console.error('TabManager: 比較中にエラーが発生しました:', error);
     }
   }
   
   _captureTabState() {
     // 現在のタブ状態をキャプチャ
     const state = {
       activeTabId: document.querySelector('.tab.active')?.getAttribute('data-tab'),
       activeContentId: document.querySelector('.tab-content.active')?.id,
       // その他の関連状態
     };
     
     return state;
   }
   
   _restoreTabState(state) {
     // キャプチャした状態からDOM状態を復元
     this.tabElements.forEach(tab => {
       if (tab.getAttribute('data-tab') === state.activeTabId) {
         tab.classList.add('active');
       } else {
         tab.classList.remove('active');
       }
     });
     
     this.tabContentElements.forEach(content => {
       if (content.id === state.activeContentId) {
         content.classList.add('active');
       } else {
         content.classList.remove('active');
       }
     });
   }
   
   _compareStates(state1, state2) {
     const differences = {};
     
     for (const key in state1) {
       if (state1[key] !== state2[key]) {
         differences[key] = {
           original: state1[key],
           new: state2[key]
         };
       }
     }
     
     return differences;
   }
   
   enableShadowMode(enable = true) {
     this.useShadowMode = enable;
     console.log(`TabManager: シャドウモード ${enable ? '有効' : '無効'}`);
   }
   ```

2. **元の実装のバックアップ**
   ```javascript
   // scopeManager.jsの冒頭部分に追加
   
   // 元の実装をバックアップ
   window.originalSelectTab = selectTab;
   window.originalTabStateManager = TabStateManager;
   ```

### フェーズ5: 検証スクリプトの作成（2時間）

```javascript
// /test_script/test_tab_manager_refactoring.js

/**
 * TabManagerリファクタリング検証テスト
 */
function testTabManagerRefactoring() {
  console.log('%c===== TabManagerリファクタリング検証テスト =====', 'color: blue; font-weight: bold;');
  
  // 1. タブマネージャーのロード確認
  if (typeof tabManager === 'undefined') {
    console.error('❌ tabManagerモジュールが見つかりません。スクリプトが正しくロードされているか確認してください。');
    return;
  }
  console.log('✅ tabManagerモジュールが正常にロードされました');
  
  // 2. 期待されるメソッドの存在確認
  const expectedMethods = [
    'selectTab', 'saveTabState', 'restoreTabState', 'updateToolsTab', 'getActiveTabId'
  ];
  
  const missingMethods = expectedMethods.filter(method => typeof tabManager[method] !== 'function');
  if (missingMethods.length > 0) {
    console.error(`❌ 以下のtabManagerメソッドが見つかりません: ${missingMethods.join(', ')}`);
  } else {
    console.log('✅ 期待されるすべてのtabManagerメソッドが存在します');
  }
  
  // 3. アクティブタブの取得
  try {
    const activeTabId = tabManager.getActiveTabId();
    console.log(`✅ 現在のアクティブタブID: ${activeTabId}`);
  } catch (error) {
    console.error('❌ アクティブタブIDの取得に失敗しました:', error);
  }
  
  // 4. タブ選択テスト（すべてのタブ）
  const tabIds = Array.from(document.querySelectorAll('.tab'))
    .map(tab => tab.getAttribute('data-tab'))
    .filter(id => id); // nullまたは空を除外
  
  console.log(`検出されたタブ: ${tabIds.join(', ')}`);
  
  // 一時的なエラーイベントリスナーの追加
  const originalErrorHandler = window.onerror;
  let hasErrorOccurred = false;
  
  window.onerror = function(message, source, lineno, colno, error) {
    console.error('❌ タブ切り替え中にエラーが発生しました:', message);
    hasErrorOccurred = true;
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    return false;
  };
  
  // 各タブを順番にテスト
  let currentIndex = 0;
  
  function testNextTab() {
    if (currentIndex >= tabIds.length) {
      // すべてのタブをテスト済み
      window.onerror = originalErrorHandler;
      
      if (!hasErrorOccurred) {
        console.log('✅ すべてのタブ切り替えテストに合格しました');
      }
      
      // 元のアクティブタブに戻る
      try {
        const initialActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab');
        if (initialActiveTab) {
          tabManager.selectTab(initialActiveTab);
          console.log(`✅ 元のアクティブタブ (${initialActiveTab}) に戻りました`);
        }
      } catch (error) {
        console.error('❌ 元のタブに戻る際にエラーが発生しました:', error);
      }
      
      console.log('%c===== TabManagerリファクタリング検証テスト完了 =====', 'color: blue; font-weight: bold;');
      return;
    }
    
    const tabId = tabIds[currentIndex];
    console.log(`テスト: タブ"${tabId}"に切り替え中...`);
    
    try {
      tabManager.selectTab(tabId, false);
      
      // タブがアクティブかチェック
      const isActive = document.querySelector(`.tab[data-tab="${tabId}"]`)?.classList.contains('active');
      const contentActive = document.getElementById(`${tabId}-tab`)?.classList.contains('active');
      
      if (isActive && contentActive) {
        console.log(`✅ タブ"${tabId}"への切り替えに成功しました`);
      } else {
        console.error(`❌ タブ"${tabId}"への切り替えに問題があります`);
      }
    } catch (error) {
      console.error(`❌ タブ"${tabId}"切り替え中にエラーが発生しました:`, error);
      hasErrorOccurred = true;
    }
    
    // 次のタブをテスト（UI更新を許可するために非同期で）
    currentIndex++;
    setTimeout(testNextTab, 500);
  }
  
  // タブテストを開始
  testNextTab();
}

// テスト実行（ページロード後に十分な時間を取る）
setTimeout(testTabManagerRefactoring, 2000);
```

### フェーズ6: scopeManager.jsの更新（2時間）

1. **最小変更によるモジュール統合**
   ```javascript
   // @ts-check
   
   // VSCode API取得 
   const vscode = acquireVsCodeApi();
   
   // 外部モジュールのインポート
   import { convertMarkdownToHtml, enhanceSpecialElements, setupCheckboxes } from './utils/markdownConverter.js';
   import { showError, showSuccess, getStatusClass, getStatusText, getTimeAgo } from './utils/uiHelpers.js';
   // 新しいモジュールをインポート
   import { tabManager } from './components/tabManager/tabManager.js';
   import { stateManager } from './state/stateManager.js';
   
   // イベントリスナーの初期化
   (function() {
     // 元の実装をグローバルにバックアップ（安全対策）
     window.originalSelectTab = selectTab;
     window.originalTabStateManager = TabStateManager;
   
     // 機能切替フラグ（開発中は false、テスト中は true）
     const USE_NEW_TAB_MANAGER = false;
   
     const previousState = vscode.getState() || { 
       scopes: [],
       selectedScopeIndex: -1,
       selectedScope: null,
       directoryStructure: '',
       activeTab: 'prompts'
     };
     
     // ... 既存コード ...
     
     // ページ読み込み完了時の処理
     document.addEventListener('DOMContentLoaded', () => {
       // 初期化メッセージの送信
       vscode.postMessage({ command: 'initialize' });
       
       // イベントリスナー設定
       setupEventListeners();
       
       // タブ機能の初期化
       if (USE_NEW_TAB_MANAGER) {
         console.log('新しいTabManagerを使用します');
         tabManager.initialize();
       } else {
         console.log('既存のタブ初期化関数を使用します');
         initializeTabs();
       }
       
       // ... 残りの初期化コード ...
     });
     
     // ... 既存コード ...
     
     /**
      * タブを選択する関数（新旧実装の橋渡し）
      */
     function selectTab(tabId, saveToServer = true) {
       if (USE_NEW_TAB_MANAGER) {
         try {
           // 新しいTabManagerを使用
           return tabManager.selectTab(tabId, saveToServer);
         } catch (error) {
           console.error('TabManager使用中にエラーが発生しました:', error);
           console.warn('既存の実装にフォールバックします');
           
           // エラー発生時は既存実装にフォールバック
           return originalSelectTab.call(this, tabId, saveToServer);
         }
       } else {
         // 既存の実装をそのまま使用
         
         // ... 元のselectTab実装 ...
       }
     }
     
     // ... 残りの既存コード ...
   
   })();
   ```

2. **restoreProjectState関数の更新**
   ```javascript
   function restoreProjectState() {
     setTimeout(() => {
       try {
         const currentState = vscode.getState() || {};
         const { activeProjectName, activeProjectPath, activeTab } = currentState;
         
         console.log('プロジェクト状態の復元を試みます:', { 
           activeProjectName, 
           activeProjectPath, 
           activeTab
         });
         
         // 状態がローカルに保存されていない場合はバックエンドから同期を待つ
         if (!activeProjectName || !activeProjectPath) {
           console.log('ローカルにプロジェクト状態が保存されていません。バックエンドから同期を待ちます。');
           return;
         }
         
         // タブ状態の復元を行う
         if (activeTab) {
           if (USE_NEW_TAB_MANAGER) {
             // 新しいTabManagerを使用
             tabManager.selectTab(activeTab, false);
           } else {
             // 既存の実装を使用
             
             // タブが存在するか確認する
             const tabExists = Array.from(document.querySelectorAll('.tab'))
               .some(tab => tab.getAttribute('data-tab') === activeTab);
             
             const tabToSelect = tabExists ? activeTab : 'current-status';
             
             // 既存の方法でタブを選択
             selectTab(tabToSelect, false);
           }
           
           console.log(`復元完了: タブ ${activeTab} を選択しました`);
         }
       } catch (error) {
         console.error('プロジェクト状態の復元中にエラーが発生しました:', error);
       }
     }, 200);
   }
   ```

3. **切り替えメカニズム**
   コンソールから設定を切り替えられるデバッグコマンドを追加
   ```javascript
   // コンソールからの設定切り替え用
   window.debugTabManager = {
     enable: function() {
       window.USE_NEW_TAB_MANAGER = true;
       console.log('新しいTabManagerを有効化しました');
     },
     disable: function() {
       window.USE_NEW_TAB_MANAGER = false;
       console.log('既存のタブ実装に戻しました');
     },
     status: function() {
       console.log(`現在のモード: ${window.USE_NEW_TAB_MANAGER ? '新TabManager' : '既存実装'}`);
     },
     test: function() {
       // テストスクリプトを読み込んで実行
       const script = document.createElement('script');
       script.src = '/test_script/test_tab_manager_refactoring.js';
       document.head.appendChild(script);
     }
   };
   ```

### フェーズ7: テストと検証（3時間）

1. **検証プロセス**
   - 全タブの切り替えテスト
   - プロジェクト間の移動テスト
   - パネル閉じて再表示した場合のタブ状態確認
   - エラーケースのハンドリング確認

2. **検証チェックリスト**
   - [ ] すべてのタブが正常に切り替わるか
   - [ ] タブ状態がパネルを閉じ、再度開いた後も維持されるか
   - [ ] プロジェクトを切り替えても、各プロジェクトのタブ状態が記憶されるか
   - [ ] 無効なタブIDの処理が適切か
   - [ ] エラー時のフォールバックが機能するか
   - [ ] コンソールにエラーが表示されないか

3. **ログ解析**
   - 状態変更ログの確認
   - 操作前後の状態整合性の検証

### フェーズ8: 最終実装（3時間）

1. **安定機能の完全移行**
   ```javascript
   // フラグを完全に削除、新実装に移行
   // USE_NEW_TAB_MANAGER = true に固定
   
   // タブ機能の初期化
   tabManager.initialize();
   
   // タブ選択はブリッジ関数から直接新実装に置き換え
   function selectTab(tabId, saveToServer = true) {
     return tabManager.selectTab(tabId, saveToServer);
   }
   ```

2. **initializeTabsの削除**
   - 既存のinitializeTabs関数を削除
   - TabStateManagerオブジェクトを削除

3. **未使用コードのクリーンアップ**
   - デバッグコードや比較検証コードの削除
   - バックアップされた関数の参照を削除

4. **最終検証**
   - すべてのタブ操作を最終確認
   - プロジェクト切り替えでのタブ状態維持を確認

## 5. タイムライン

| フェーズ | 作業内容 | 予定時間 |
|---------|--------|---------|
| 1 | 準備と分析 | 1時間 |
| 2 | StateManagerアダプターの実装 | 2時間 |
| 3 | TabManagerクラスの実装 - 基本機能 | 3時間 |
| 4 | シャドウモードの実装 | 2時間 |
| 5 | 検証スクリプトの作成 | 2時間 |
| 6 | scopeManager.jsの更新 | 2時間 |
| 7 | テストと検証 | 3時間 |
| 8 | 最終実装 | 3時間 |
| 合計 | | 18時間 |

## 6. 安全なリファクタリングのためのガイドライン

1. **変更を小さく保つ**
   - 一度に1つの機能だけを変更
   - 各変更ごとに検証をする

2. **フォールバック機構を組み込む**
   - エラー発生時に自動的に旧実装に戻る仕組み
   - コンソールからの手動切替オプション

3. **充実したログを残す**
   - 各操作の前後でログを出力
   - 状態変更を明示的に記録

4. **テスト自動化**
   - すべてのタブ操作を自動的にテスト
   - エラー検出と報告の自動化

5. **変更のコミットを小さく**
   - 1つのフェーズごとにコミット
   - 問題発生時に特定の変更だけを元に戻せるように

## 7. リスク管理

### 潜在的なリスク

1. **状態管理の複雑性**
   - リスク: 状態更新のタイミングで新旧実装の不整合が発生
   - 対策: シャドウモードでの状態比較と差異の検出

2. **イベントハンドラの重複**
   - リスク: 同じイベントに対して複数のハンドラーが実行される
   - 対策: イベントリスナー管理の厳格化と重複検出

3. **エッジケースへの対応不足**
   - リスク: テストで捕捉できない特殊なユースケースでの失敗
   - 対策: 網羅的なテストケースの用意と手動テスト強化

4. **他モジュールとの依存関係の複雑性**
   - リスク: 予期せぬ依存関係による問題
   - 対策: 依存関係の明確な図式化と慎重な移行

## 8. まとめ

このリファクタリング計画は、タブ管理機能を安全かつ確実に分離するための体系的なアプローチを提供します。段階的な実装と詳細な検証により、前回の失敗を防ぎ、保守性が高く拡張性のあるコードベースを実現します。並行実行と検証の仕組みにより、問題を早期に検出し、確実な移行を保証します。