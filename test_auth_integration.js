/**
 * 認証システム統合テスト
 * 
 * このスクリプトはSimpleAuthServiceがアプリケーション全体と正しく統合されていることを検証します。
 * PermissionManager, ClaudeCodeAuthSyncなどの連携テストを実施します。
 * 
 * 実行方法:
 * 1. VSCODEで拡張機能を実行
 * 2. コマンドパレットから「AppGenius: Run Test Script」を選択
 * 3. test_auth_integration.jsを入力
 */

// 必要なモジュールをインポート
const vscode = require('vscode');
const path = require('path');

// モジュールの参照パス
const extensionPath = __dirname;
const outPath = path.join(extensionPath, 'out');

// モジュールをロード
const SimpleAuthService = require(path.join(outPath, 'core/auth/SimpleAuthService')).SimpleAuthService;
const SimpleAuthManager = require(path.join(outPath, 'core/auth/SimpleAuthManager')).SimpleAuthManager;
const PermissionManager = require(path.join(outPath, 'core/auth/PermissionManager')).PermissionManager;
const ClaudeCodeAuthSync = require(path.join(outPath, 'services/ClaudeCodeAuthSync')).ClaudeCodeAuthSync;
const ClaudeCodeApiClient = require(path.join(outPath, 'api/claudeCodeApiClient')).ClaudeCodeApiClient;

// 各モジュールのインスタンスを取得
async function getInstances() {
  try {
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
    
    // インスタンスを取得
    const simpleAuthService = SimpleAuthService.getInstance(extensionContext);
    const simpleAuthManager = SimpleAuthManager.getInstance();
    const permissionManager = PermissionManager.getInstance();
    const claudeCodeAuthSync = ClaudeCodeAuthSync.getInstance();
    const apiClient = ClaudeCodeApiClient.getInstance();
    
    return {
      simpleAuthService,
      simpleAuthManager,
      permissionManager,
      claudeCodeAuthSync,
      apiClient
    };
  } catch (error) {
    console.error('インスタンス取得エラー:', error);
    throw error;
  }
}

// テスト関数
async function runTests() {
  try {
    console.log('===== 認証システム統合テスト開始 =====');
    
    const instances = await getInstances();
    
    // テスト1: SimpleAuthServiceのステータス
    console.log('テスト1: SimpleAuthServiceのステータス確認');
    const authState = instances.simpleAuthService.getCurrentState();
    console.log(`認証状態: ${authState.isAuthenticated ? '認証済み' : '未認証'}`);
    console.log(`ユーザー名: ${authState.username || 'なし'}`);
    console.log(`ロール: ${authState.role || 'なし'}`);
    
    // テスト2: PermissionManagerの連携確認
    console.log('\nテスト2: PermissionManagerの連携確認');
    const hasPermission = instances.permissionManager.hasPermission('VIEW_DASHBOARD');
    console.log(`VIEW_DASHBOARD権限: ${hasPermission ? 'あり' : 'なし'}`);
    
    // テスト3: ClaudeCodeAuthSyncの連携確認
    console.log('\nテスト3: ClaudeCodeAuthSyncの連携確認');
    const syncStatus = instances.claudeCodeAuthSync.getSyncStatus();
    console.log(`同期状態: ${JSON.stringify(syncStatus)}`);
    
    // テスト4: ClaudeCodeApiClientの連携確認
    console.log('\nテスト4: ClaudeCodeApiClientの連携確認');
    const apiTest = await instances.apiClient.testApiConnection();
    console.log(`API接続テスト: ${apiTest ? '成功' : '失敗'}`);
    
    // テスト5: 認証イベント連携確認
    console.log('\nテスト5: 認証イベント連携確認');
    console.log('認証状態変更をリッスンするリスナーを登録');
    const disposable = instances.simpleAuthService.onStateChanged(state => {
      console.log(`[イベント] 認証状態変更: ${state.isAuthenticated ? '認証済み' : '未認証'}`);
    });
    
    console.log('===== 認証システム統合テスト完了 =====');
    
    // リスナーを解除
    disposable.dispose();
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
  }
}

// テスト実行
runTests();