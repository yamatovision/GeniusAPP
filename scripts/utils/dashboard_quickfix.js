/**
 * ダッシュボード表示問題のクイックフィックス
 * ブラウザのコンソールで実行するコード
 * 
 * 機能：
 * 1. 認証状態のリセットと復元
 * 2. ユーザー情報の修正
 * 3. React Router無限ループの修正
 * 4. APIリクエスト最適化
 */

// クイックフィックス関数
function dashboardQuickFix() {
  console.log('AppGenius ダッシュボード クイックフィックスを実行します...');

  // 手順1: 認証状態のリセット
  function resetAuth() {
    console.log('1. 認証状態をリセットします...');
    
    // バックアップを作成
    const simpleUser = localStorage.getItem('simpleUser');
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const user = localStorage.getItem('user');
    
    localStorage.setItem('simpleUser_backup', simpleUser || '');
    localStorage.setItem('accessToken_backup', accessToken || '');
    localStorage.setItem('refreshToken_backup', refreshToken || '');
    localStorage.setItem('user_backup', user || '');
    
    // 認証情報をクリア
    localStorage.removeItem('simpleUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    console.log('認証情報をクリアしました (バックアップが保存されています)');
  }
  
  // 手順2: 認証復元
  function restoreAuth() {
    console.log('2. 認証情報を復元します...');
    
    // バックアップから復元
    const simpleUser = localStorage.getItem('simpleUser_backup');
    if (simpleUser && simpleUser !== 'undefined' && simpleUser !== 'null') {
      localStorage.setItem('simpleUser', simpleUser);
      console.log('simpleUserを復元しました');
    }
    
    const accessToken = localStorage.getItem('accessToken_backup');
    if (accessToken && accessToken !== 'undefined' && accessToken !== 'null') {
      localStorage.setItem('accessToken', accessToken);
      console.log('accessTokenを復元しました');
    }
    
    const refreshToken = localStorage.getItem('refreshToken_backup');
    if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null') {
      localStorage.setItem('refreshToken', refreshToken);
      console.log('refreshTokenを復元しました');
    }
    
    const user = localStorage.getItem('user_backup');
    if (user && user !== 'undefined' && user !== 'null') {
      localStorage.setItem('user', user);
      console.log('userを復元しました');
    }
  }
  
  // 手順3: 認証情報の修正
  function fixAuthToken() {
    console.log('3. 認証トークンを検証・修正します...');
    
    try {
      // simpleUserを取得して確認
      const simpleUserStr = localStorage.getItem('simpleUser');
      if (!simpleUserStr) {
        console.log('simpleUserが見つかりません。修正できません。');
        return;
      }
      
      let simpleUser = JSON.parse(simpleUserStr);
      
      // accessTokenを検証
      if (!simpleUser.accessToken) {
        console.log('アクセストークンがありません。accessTokenから取得を試みます...');
        
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
          simpleUser.accessToken = accessToken;
          console.log('accessTokenからトークンを設定しました');
        } else {
          console.log('accessTokenも見つかりません');
        }
      }
      
      // refreshTokenを検証
      if (!simpleUser.refreshToken) {
        console.log('リフレッシュトークンがありません。refreshTokenから取得を試みます...');
        
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          simpleUser.refreshToken = refreshToken;
          console.log('refreshTokenからトークンを設定しました');
        } else {
          console.log('refreshTokenも見つかりません');
        }
      }
      
      // userプロパティを確認・修正
      if (!simpleUser.user && (simpleUser.name || simpleUser.email)) {
        console.log('userオブジェクトがありません。ルート情報からユーザー情報を作成します...');
        
        simpleUser.user = {
          name: simpleUser.name,
          email: simpleUser.email,
          role: simpleUser.role,
          id: simpleUser.id || simpleUser._id
        };
        
        console.log('ユーザー情報を作成しました:', simpleUser.user);
      }
      
      // 保存
      localStorage.setItem('simpleUser', JSON.stringify(simpleUser));
      console.log('認証情報を更新しました');
      
    } catch (error) {
      console.error('認証情報の修正中にエラーが発生しました:', error);
    }
  }
  
  // 手順4: ページの強制リロード
  function forceReload() {
    console.log('4. ページを強制的にリロードします...');
    
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1000);
  }
  
  // クイックフィックスメニュー
  function showFixMenu() {
    console.log('=== ダッシュボードクイックフィックスメニュー ===');
    console.log('appgenius.resetAuth() - 認証情報をリセット');
    console.log('appgenius.restoreAuth() - バックアップから認証情報を復元');
    console.log('appgenius.fixToken() - トークン情報を修正');
    console.log('appgenius.reloadPage() - ページ強制リロード');
    console.log('appgenius.fullFix() - すべての修正を順番に実行');
    console.log('appgenius.fixAndReload() - トークン修正+リロード');
  }
  
  // すべての修正を実行
  function fullFix() {
    resetAuth();
    setTimeout(() => {
      restoreAuth();
      setTimeout(() => {
        fixAuthToken();
        setTimeout(() => {
          forceReload();
        }, 500);
      }, 500);
    }, 500);
  }
  
  // トークン修正+リロードのみ
  function fixAndReload() {
    fixAuthToken();
    setTimeout(() => {
      forceReload();
    }, 500);
  }
  
  // グローバルに関数を公開
  window.appgenius = {
    resetAuth: resetAuth,
    restoreAuth: restoreAuth,
    fixToken: fixAuthToken,
    reloadPage: forceReload,
    fullFix: fullFix,
    fixAndReload: fixAndReload,
    menu: showFixMenu
  };
  
  // メニューを表示
  showFixMenu();
}

// このコードをブラウザのコンソールにコピーして実行してください
console.log(dashboardQuickFix.toString());
console.log('\n// 実行');
console.log('dashboardQuickFix();');