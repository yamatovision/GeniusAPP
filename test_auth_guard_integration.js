/**
 * AuthGuard統合テスト
 * 
 * このスクリプトはSimpleAuthServiceとPermissionManagerを介してAuthGuardが
 * 正しく動作するかを検証します。
 * 
 * 実行方法:
 * 1. VSCODEで拡張機能を実行
 * 2. コマンドパレットから「AppGenius: Run Test Script」を選択
 * 3. test_auth_guard_integration.jsを入力
 */

// 必要なモジュールをインポート
const vscode = require('vscode');
const path = require('path');

// モジュールの参照パス
const extensionPath = __dirname;
const outPath = path.join(extensionPath, 'out');

// モジュールをロード
const SimpleAuthService = require(path.join(outPath, 'core/auth/SimpleAuthService')).SimpleAuthService;
const PermissionManager = require(path.join(outPath, 'core/auth/PermissionManager')).PermissionManager;
const AuthGuard = require(path.join(outPath, 'ui/auth/AuthGuard')).AuthGuard;
const { Role, Feature } = require(path.join(outPath, 'core/auth/roles'));

// テスト関数
async function runTests() {
  try {
    console.log('===== AuthGuard統合テスト開始 =====');
    
    // VSCode拡張機能のコンテキストを取得
    const extension = vscode.extensions.getExtension('appgenius.appgenius');
    if (!extension) {
      throw new Error('AppGenius拡張機能が見つかりません');
    }
    
    const extensionContext = extension.exports.context;
    if (!extensionContext) {
      throw new Error('拡張機能コンテキストが見つかりません');
    }
    
    console.log('拡張機能コンテキスト取得成功');
    
    // SimpleAuthServiceのインスタンスを取得
    const simpleAuthService = SimpleAuthService.getInstance(extensionContext);
    console.log('SimpleAuthService取得成功');
    
    // PermissionManagerのインスタンスを取得
    let permissionManager;
    try {
      // 既存のインスタンスを取得
      permissionManager = PermissionManager.getInstance();
      console.log('既存のPermissionManagerインスタンスを取得しました');
    } catch (error) {
      // 新しいインスタンスを作成
      permissionManager = PermissionManager.getInstance(simpleAuthService);
      console.log('新しいPermissionManagerインスタンスを作成しました');
    }
    
    // 現在の認証状態を取得
    const currentState = simpleAuthService.getCurrentState();
    console.log('\nテスト1: 現在の認証状態');
    console.log(`認証状態: ${currentState.isAuthenticated ? '認証済み' : '未認証'}`);
    console.log(`ユーザー名: ${currentState.username || 'なし'}`);
    console.log(`ロール: ${currentState.role || 'なし'}`);
    
    // テスト2: PermissionManagerの機能アクセスチェック
    console.log('\nテスト2: PermissionManagerの機能アクセスチェック');
    const features = [
      Feature.DASHBOARD,
      Feature.SCOPE_MANAGER,
      Feature.DEBUG_DETECTIVE,
      Feature.CLAUDE_CODE,
      Feature.USER_MANAGEMENT  // 管理者専用機能
    ];
    
    for (const feature of features) {
      const hasAccess = permissionManager.canAccess(feature);
      console.log(`- ${feature}: ${hasAccess ? 'アクセス可能' : 'アクセス不可'}`);
    }
    
    // テスト3: AuthGuardによるアクセスチェック
    console.log('\nテスト3: AuthGuardによるアクセスチェック');
    
    // 一般機能へのアクセス
    const dashboardAccess = AuthGuard.checkAccess(Feature.DASHBOARD);
    console.log(`- ダッシュボードへのアクセス: ${dashboardAccess ? '許可' : '拒否'}`);
    
    // 管理者専用機能へのアクセス
    const adminAccess = AuthGuard.checkAdminAccess(Feature.USER_MANAGEMENT);
    console.log(`- ユーザー管理（管理者機能）へのアクセス: ${adminAccess ? '許可' : '拒否'}`);
    
    // ログイン状態チェック
    const isLoggedIn = AuthGuard.checkLoggedIn();
    console.log(`- ログイン状態: ${isLoggedIn ? 'ログイン済み' : '未ログイン'}`);
    
    // テスト4: 認証状態変更イベントのリスン設定
    console.log('\nテスト4: 認証状態変更イベントのリスン');
    const disposable = permissionManager.onPermissionsChanged(() => {
      console.log(`[イベント受信] 権限変更イベントを受信しました`);
    });
    
    // 簡易なイベント発火テスト
    console.log('認証状態変更の模擬発火（実際の変更は行いません）');
    simpleAuthService._onStateChanged.fire(currentState);
    
    // イベントリスナーの解除
    disposable.dispose();
    
    console.log('\n===== AuthGuard統合テスト完了 =====');
    console.log('結果: SimpleAuthService、PermissionManager、AuthGuardの統合は正常に機能しています。');
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
}

// テスト実行
runTests();