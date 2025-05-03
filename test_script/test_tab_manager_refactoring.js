/**
 * TabManagerリファクタリング検証テスト
 * このスクリプトはScopeManagerPanelのタブ管理機能リファクタリングの検証を行います
 * 拡張版: 新旧実装の切り替えテストとフォールバック機能の検証も含む
 */
function testTabManagerRefactoring() {
  console.log('%c===== TabManagerリファクタリング検証テスト（拡張版）=====', 'color: blue; font-weight: bold;');
  
  // 現在の実装モードを確認
  const currentMode = window.USE_NEW_TAB_MANAGER ? '新TabManager' : '既存実装';
  console.log(`現在のモード: ${currentMode}`);
  
  // ====== 基本テスト: モジュールとAPI ======
  
  // 1. tabManagerモジュールのロード確認
  if (window.USE_NEW_TAB_MANAGER) {
    if (typeof tabManager === 'undefined') {
      console.error('❌ tabManagerモジュールが見つかりません。スクリプトが正しくロードされているか確認してください。');
      return;
    }
    console.log('✅ tabManagerモジュールが正常にロードされました');
    
    // デバッグモードを有効化（テスト用）
    if (typeof tabManager.enableDebug === 'function') {
      tabManager.enableDebug(true);
      console.log('✅ TabManagerのデバッグモードを有効化しました');
    }
  } else {
    // 既存実装の確認
    if (typeof selectTab !== 'function' || typeof TabStateManager !== 'object') {
      console.error('❌ 既存のタブ管理実装が見つかりません');
      return;
    }
    console.log('✅ 既存のタブ管理実装が正常にロードされています');
  }
  
  // 2. 期待されるメソッドの存在確認（新実装の場合のみ）
  if (window.USE_NEW_TAB_MANAGER) {
    const expectedMethods = [
      'selectTab', 'saveTabState', 'restoreTabState', 'updateToolsTab', 'getActiveTabId', 'initialize'
    ];
    
    const missingMethods = expectedMethods.filter(method => typeof tabManager[method] !== 'function');
    if (missingMethods.length > 0) {
      console.error(`❌ 以下のtabManagerメソッドが見つかりません: ${missingMethods.join(', ')}`);
    } else {
      console.log('✅ 期待されるすべてのtabManagerメソッドが存在します');
    }
  }
  
  // 3. アクティブタブの取得
  try {
    let activeTabId;
    if (window.USE_NEW_TAB_MANAGER) {
      activeTabId = tabManager.getActiveTabId();
    } else {
      // 既存実装ではDOMから直接取得
      activeTabId = document.querySelector('.tab.active')?.getAttribute('data-tab') || 'current-status';
    }
    console.log(`✅ 現在のアクティブタブID: ${activeTabId}`);
  } catch (error) {
    console.error('❌ アクティブタブIDの取得に失敗しました:', error);
  }
  
  // ====== タブ切り替えテスト ======
  
  // 4. タブ選択テスト（すべてのタブ）
  const tabIds = Array.from(document.querySelectorAll('.tab'))
    .map(tab => tab.getAttribute('data-tab'))
    .filter(id => id); // nullまたは空を除外
  
  if (tabIds.length === 0) {
    console.error('❌ タブ要素が見つかりません。DOM構造が想定と異なる可能性があります。');
    return;
  }
  
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
  
  // 最初に現在のタブ状態を保存
  const initialActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab') || 'current-status';
  const initialActiveContent = document.querySelector('.tab-content.active')?.id;
  console.log(`テスト前のアクティブタブ: ${initialActiveTab}, アクティブコンテンツ: ${initialActiveContent}`);
  
  // 各タブを順番にテスト
  let currentIndex = 0;
  const tabTestResults = {};
  
  function testNextTab() {
    if (currentIndex >= tabIds.length) {
      // すべてのタブをテスト済み
      window.onerror = originalErrorHandler;
      
      if (!hasErrorOccurred) {
        console.log('✅ すべてのタブ切り替えテストに合格しました');
      }
      
      // 元のアクティブタブに戻る
      try {
        if (initialActiveTab) {
          if (window.USE_NEW_TAB_MANAGER) {
            tabManager.selectTab(initialActiveTab, false);
          } else {
            selectTab(initialActiveTab, false);
          }
          console.log(`✅ 元のアクティブタブ (${initialActiveTab}) に戻りました`);
        }
      } catch (error) {
        console.error('❌ 元のタブに戻る際にエラーが発生しました:', error);
      }
      
      // ステートの整合性をチェック
      try {
        const state = window.vscode?.getState() || {};
        console.log('最終状態:', state);
        if (state.activeTab !== initialActiveTab) {
          console.warn(`⚠️ 状態のアクティブタブ(${state.activeTab})が元のタブ(${initialActiveTab})と一致しません`);
        }
      } catch (e) {
        console.error('❌ 状態チェック中にエラーが発生しました:', e);
      }
      
      // すべての結果を表示
      console.log('タブ切り替えテスト結果:');
      Object.keys(tabTestResults).forEach(tabId => {
        const result = tabTestResults[tabId];
        if (result.success) {
          console.log(`✅ タブ"${tabId}": 成功 (${result.time}ms)`);
        } else {
          console.error(`❌ タブ"${tabId}": 失敗 - ${result.error}`);
        }
      });
      
      // フォールバック機能のテスト
      testFallbackFunction();
      
      return;
    }
    
    const tabId = tabIds[currentIndex];
    console.log(`テスト: タブ"${tabId}"に切り替え中...`);
    
    try {
      // パフォーマンス計測開始
      const startTime = performance.now();
      
      // タブを選択（サーバーには保存しない）
      if (window.USE_NEW_TAB_MANAGER) {
        tabManager.selectTab(tabId, false);
      } else {
        selectTab(tabId, false);
      }
      
      // パフォーマンス計測終了
      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);
      console.log(`タブ"${tabId}"切り替え時間: ${executionTime}ms`);
      
      // タブがアクティブかチェック
      const isTabActive = document.querySelector(`.tab[data-tab="${tabId}"]`)?.classList.contains('active');
      const isContentActive = document.getElementById(`${tabId}-tab`)?.classList.contains('active');
      
      if (isTabActive && isContentActive) {
        console.log(`✅ タブ"${tabId}"への切り替えに成功しました`);
        tabTestResults[tabId] = { success: true, time: executionTime };
      } else {
        console.error(`❌ タブ"${tabId}"への切り替えに問題があります:`, {
          tabActive: isTabActive,
          contentActive: isContentActive
        });
        tabTestResults[tabId] = { 
          success: false, 
          error: `UI状態の不一致: tabActive=${isTabActive}, contentActive=${isContentActive}` 
        };
      }
      
      // 状態が更新されたかチェック
      try {
        const state = window.vscode?.getState() || {};
        if (state.activeTab !== tabId) {
          console.warn(`⚠️ 状態のアクティブタブ(${state.activeTab})が選択したタブ(${tabId})と一致しません`);
        }
      } catch (e) {
        console.error('❌ 状態チェック中にエラーが発生しました:', e);
      }
      
    } catch (error) {
      console.error(`❌ タブ"${tabId}"切り替え中にエラーが発生しました:`, error);
      tabTestResults[tabId] = { success: false, error: error.message };
      hasErrorOccurred = true;
    }
    
    // 次のタブをテスト（UI更新を許可するために非同期で）
    currentIndex++;
    setTimeout(testNextTab, 500);
  }
  
  // フォールバック機能のテスト
  function testFallbackFunction() {
    console.log('%c===== フォールバック機能テスト =====', 'color: purple; font-weight: bold;');
    
    // 現在のアクティブタブを保存
    const currentActiveTab = document.querySelector('.tab.active')?.getAttribute('data-tab') || 'current-status';
    
    // 1. 新旧実装の切り替えテスト
    try {
      console.log('1. 新旧実装の切り替えテスト:');
      // 元の設定を保存
      const originalFlag = window.USE_NEW_TAB_MANAGER;
      
      // 切り替えをテスト
      window.USE_NEW_TAB_MANAGER = !originalFlag;
      console.log(`モードを ${originalFlag ? '既存実装' : '新TabManager'} に切り替えました`);
      
      // タブ選択をテスト
      selectTab('current-status', false);
      console.log('✅ 実装切り替え後のタブ選択が成功しました');
      
      // 元の設定に戻す
      window.USE_NEW_TAB_MANAGER = originalFlag;
      console.log(`モードを元の ${originalFlag ? '新TabManager' : '既存実装'} に戻しました`);
      
      // 元のタブに戻す
      selectTab(currentActiveTab, false);
    } catch (error) {
      console.error('❌ 実装切り替えテスト中にエラーが発生しました:', error);
    }
    
    // 2. エラー発生時のフォールバックテスト
    if (window.USE_NEW_TAB_MANAGER) {
      try {
        console.log('2. エラー発生時のフォールバックテスト:');
        
        // 一時的にTabManagerを破壊してエラーを発生させる
        const originalTabManager = window.tabManager;
        const originalSelectTabMethod = window.tabManager.selectTab;
        
        // selectTabメソッドを一時的に書き換えてエラーを起こす
        window.tabManager.selectTab = function() {
          throw new Error('テスト用のエラー');
        };
        
        // エラーが発生して旧実装にフォールバックするはず
        console.log('意図的にエラーを発生させます...');
        selectTab('current-status', false);
        
        // 元の実装に戻す
        window.tabManager = originalTabManager;
        window.tabManager.selectTab = originalSelectTabMethod;
        
        console.log('✅ フォールバック機能のテストが完了しました');
        
        // 元のタブに戻す
        selectTab(currentActiveTab, false);
      } catch (error) {
        console.error('❌ フォールバックテスト中にエラーが発生しました:', error);
      }
    } else {
      console.log('フォールバックテストは新TabManager使用時のみ実行されます');
    }
    
    // 3. プロジェクト状態復元テスト
    try {
      console.log('3. プロジェクト状態復元テスト:');
      
      // 手動でプロジェクト状態を復元する
      restoreProjectState();
      console.log('✅ プロジェクト状態復元テストが完了しました');
    } catch (error) {
      console.error('❌ プロジェクト状態復元テスト中にエラーが発生しました:', error);
    }
    
    console.log('%c===== フォールバック機能テスト完了 =====', 'color: purple; font-weight: bold;');
    console.log('%c===== TabManagerリファクタリング検証テスト完了 =====', 'color: blue; font-weight: bold;');
  }
  
  // エッジケーステスト: 無効なタブIDを試す
  console.log('エッジケーステスト: 無効なタブIDで選択を試みます');
  try {
    if (window.USE_NEW_TAB_MANAGER) {
      tabManager.selectTab('non-existent-tab-id', false);
    } else {
      selectTab('non-existent-tab-id', false);
    }
    console.log('✅ 無効なタブIDが安全に処理されました');
  } catch (error) {
    console.error('❌ 無効なタブIDでエラーが発生しました:', error);
  }
  
  // ローカルストレージの操作テスト
  console.log('ストレージ操作テスト: 状態の保存/復元をチェック');
  try {
    const testState = { testKey: 'testValue', activeTab: initialActiveTab };
    vscode.setState(testState);
    const retrievedState = vscode.getState();
    
    if (retrievedState && retrievedState.testKey === testState.testKey) {
      console.log('✅ 状態の保存/復元が正常に機能しています');
    } else {
      console.error('❌ 状態の保存/復元に問題があります:', { stored: testState, retrieved: retrievedState });
    }
  } catch (error) {
    console.error('❌ ストレージテスト中にエラーが発生しました:', error);
  }
  
  // タブテストを開始
  setTimeout(() => {
    console.log('メインタブ切り替えテストを開始します...');
    testNextTab();
  }, 500);
}

// テスト実行（ページロード後に十分な時間を取る）
setTimeout(() => {
  // StateManagerのデバッグモードを有効化
  if (typeof window.stateManager !== 'undefined' && typeof window.stateManager.enableDebug === 'function') {
    window.stateManager.enableDebug(true);
    console.log('StateManagerのデバッグモードを有効化しました');
  }
  
  console.log('TabManagerリファクタリング検証テストを実行します...');
  testTabManagerRefactoring();
}, 2000);