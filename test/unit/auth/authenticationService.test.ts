import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import axios from 'axios';
import { AuthenticationService } from '../../../src/core/auth/AuthenticationService';
import { TokenManager } from '../../../src/core/auth/TokenManager';
import { AuthEventBus } from '../../../src/services/AuthEventBus';

// モック化のためのヘルパー
let mockTokenManager: any;
let mockAuthEventBus: any;
let mockAxios: any;
let mockVscode: any;
let processEnvBackup: any;

// テスト環境のセットアップ
async function setupTestEnvironment() {
  // 環境変数のバックアップと設定
  processEnvBackup = { ...process.env };
  process.env.PORTAL_API_URL = 'http://test-api.example.com/api';
  process.env.CLIENT_ID = 'test-client-id';
  process.env.CLIENT_SECRET = 'test-client-secret';
  process.env.CHECK_INTERVAL = '30';
  
  // TokenManagerのモック
  mockTokenManager = {
    getAccessToken: sinon.stub().resolves('mock-access-token'),
    getRefreshToken: sinon.stub().resolves('mock-refresh-token'),
    setAccessToken: sinon.stub().resolves(),
    setRefreshToken: sinon.stub().resolves(),
    clearTokens: sinon.stub().resolves(),
    hasToken: sinon.stub().resolves(true),
    getInstance: sinon.stub()
  };
  mockTokenManager.getInstance.returns(mockTokenManager);
  
  // AuthEventBusのモック
  mockAuthEventBus = {
    publish: sinon.stub(),
    updateAuthState: sinon.stub(),
    on: sinon.stub().returns({ dispose: () => {} }),
    once: sinon.stub().returns({ dispose: () => {} }),
    getInstance: sinon.stub()
  };
  mockAuthEventBus.getInstance.returns(mockAuthEventBus);
  
  // VSCodeのモック
  mockVscode = {
    EventEmitter: sinon.stub().returns({
      event: 'mock-event',
      fire: sinon.stub(),
      dispose: sinon.stub()
    }),
    window: {
      showInformationMessage: sinon.stub(),
      showErrorMessage: sinon.stub()
    }
  };
  
  // Axiosのモック
  mockAxios = {
    post: sinon.stub(),
    get: sinon.stub(),
    put: sinon.stub(),
    isAxiosError: sinon.stub().returns(true)
  };
  
  // 外部依存のモック注入
  sinon.stub(TokenManager, 'getInstance').returns(mockTokenManager);
  sinon.stub(AuthEventBus, 'getInstance').returns(mockAuthEventBus);
  sinon.stub(axios, 'post').callsFake(mockAxios.post);
  sinon.stub(axios, 'get').callsFake(mockAxios.get);
  sinon.stub(axios, 'put').callsFake(mockAxios.put);
  sinon.stub(axios, 'isAxiosError').callsFake(mockAxios.isAxiosError);
  
  // setIntervalのモック
  const originalSetInterval = global.setInterval;
  sinon.stub(global, 'setInterval').callsFake((callback: any, ms: number) => {
    return originalSetInterval(() => {}, ms) as any;
  });
  
  // clearIntervalのモック
  sinon.stub(global, 'clearInterval');
}

// テスト後のクリーンアップ
async function cleanupTestEnvironment() {
  // スタブの復元
  sinon.restore();
  
  // 環境変数の復元
  process.env = processEnvBackup;
}

suite('AuthenticationService Unit Tests', () => {
  
  // 各テストの前後で実行
  setup(async () => {
    await setupTestEnvironment();
  });
  
  teardown(async () => {
    await cleanupTestEnvironment();
  });
  
  test('login - ログイン成功時の動作テスト', async () => {
    // ログイン成功時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/login').resolves({
      status: 200,
      data: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: { id: 'user1', name: 'Test User', email: 'test@example.com' }
      }
    });
    
    const authService = AuthenticationService.getInstance();
    const result = await authService.login('test@example.com', 'password123');
    
    // 検証
    assert.strictEqual(result, true, 'ログインは成功を返すべき');
    sinon.assert.calledWith(mockTokenManager.setAccessToken, 'test-access-token');
    sinon.assert.calledWith(mockTokenManager.setRefreshToken, 'test-refresh-token');
    assert.strictEqual(authService.isAuthenticated(), true, '認証状態がtrueになるべき');
    sinon.assert.calledOnce(mockAuthEventBus.publish);
  });
  
  test('login - ログイン失敗時の動作テスト', async () => {
    // ログイン失敗時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/login').resolves({
      status: 401,
      data: {
        error: 'Invalid credentials'
      }
    });
    
    const authService = AuthenticationService.getInstance();
    const result = await authService.login('wrong@example.com', 'wrongpassword');
    
    // 検証
    assert.strictEqual(result, false, 'ログインは失敗を返すべき');
    assert.strictEqual(authService.isAuthenticated(), false, '認証状態がfalseのままであるべき');
    sinon.assert.notCalled(mockTokenManager.setAccessToken);
    sinon.assert.notCalled(mockTokenManager.setRefreshToken);
  });
  
  test('login - ネットワークエラー時の動作テスト', async () => {
    // ネットワークエラーをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/login').rejects(
      new Error('Network error')
    );
    
    const authService = AuthenticationService.getInstance();
    const result = await authService.login('test@example.com', 'password123');
    
    // 検証
    assert.strictEqual(result, false, 'ネットワークエラー時はログインが失敗すべき');
    assert.strictEqual(authService.isAuthenticated(), false, '認証状態がfalseのままであるべき');
    const lastError = authService.getLastError();
    assert.ok(lastError, 'エラー情報が設定されるべき');
    assert.strictEqual(lastError!.code, 'unknown_error', 'エラーコードが設定されるべき');
  });
  
  test('logout - ログアウト処理の動作テスト', async () => {
    // ログアウト成功時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/logout').resolves({
      status: 200,
      data: { success: true }
    });
    
    const authService = AuthenticationService.getInstance();
    
    // 事前準備としてログイン状態に設定
    (authService as any)._isAuthenticated = true;
    (authService as any)._currentUser = { id: 'user1', name: 'Test User' };
    
    await authService.logout();
    
    // 検証
    assert.strictEqual(authService.isAuthenticated(), false, 'ログアウト後は認証状態がfalseになるべき');
    sinon.assert.calledOnce(mockTokenManager.clearTokens);
    sinon.assert.calledOnce(mockAuthEventBus.publish);
    assert.strictEqual((authService as any)._currentUser, null, 'ユーザー情報がクリアされるべき');
  });
  
  test('refreshToken - トークンリフレッシュの成功テスト', async () => {
    // リフレッシュ成功時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/refresh-token').resolves({
      status: 200,
      data: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      }
    });
    
    const authService = AuthenticationService.getInstance();
    const result = await authService.refreshToken();
    
    // 検証
    assert.strictEqual(result, true, 'トークンリフレッシュは成功を返すべき');
    sinon.assert.calledWith(mockTokenManager.setAccessToken, 'new-access-token');
    sinon.assert.calledWith(mockTokenManager.setRefreshToken, 'new-refresh-token');
    sinon.assert.calledOnce(mockAuthEventBus.publish);
  });
  
  test('refreshToken - トークンリフレッシュの失敗テスト', async () => {
    // リフレッシュ失敗時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/refresh-token').resolves({
      status: 401,
      data: {
        error: 'Invalid refresh token'
      }
    });
    
    const authService = AuthenticationService.getInstance();
    
    // 事前準備としてログイン状態に設定
    (authService as any)._isAuthenticated = true;
    (authService as any)._currentUser = { id: 'user1', name: 'Test User' };
    
    const result = await authService.refreshToken();
    
    // 検証
    assert.strictEqual(result, false, 'トークンリフレッシュは失敗を返すべき');
    sinon.assert.notCalled(mockTokenManager.setAccessToken);
  });
  
  test('verifyToken - トークン検証の成功テスト', async () => {
    // トークン検証成功時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/verify').resolves({
      status: 200,
      data: { valid: true }
    });
    
    const authService = AuthenticationService.getInstance();
    const result = await (authService as any)._verifyToken('valid-token');
    
    // 検証
    assert.strictEqual(result, true, 'トークン検証は成功を返すべき');
  });
  
  test('verifyToken - トークン検証の失敗テスト', async () => {
    // トークン検証失敗時のAPIレスポンスをモック
    mockAxios.post.withArgs('http://test-api.example.com/api/auth/verify').rejects({
      response: { status: 401 }
    });
    
    // リフレッシュも失敗するようにモック
    const authService = AuthenticationService.getInstance();
    sinon.stub(authService, 'refreshToken').resolves(false);
    
    const result = await (authService as any)._verifyToken('invalid-token');
    
    // 検証
    assert.strictEqual(result, false, 'トークン検証は失敗を返すべき');
    sinon.assert.calledOnce(authService.refreshToken as sinon.SinonStub);
  });
  
  test('getAuthHeader - 認証ヘッダー取得テスト', async () => {
    const authService = AuthenticationService.getInstance();
    const header = await authService.getAuthHeader();
    
    // 検証
    assert.deepStrictEqual(header, { 'Authorization': 'Bearer mock-access-token' }, '正しい認証ヘッダーが返されるべき');
  });
  
  test('hasPermission - 権限チェックテスト', () => {
    const authService = AuthenticationService.getInstance();
    
    // ログインしていない場合
    assert.strictEqual(authService.hasPermission('user'), false, '未ログイン状態では権限チェックはfalseを返すべき');
    
    // 一般ユーザーの場合
    (authService as any)._isAuthenticated = true;
    (authService as any)._currentUser = { id: 'user1', name: 'Test User', role: 'user' };
    assert.strictEqual(authService.hasPermission('user'), true, 'userロールではuser権限を持つべき');
    assert.strictEqual(authService.hasPermission('admin'), false, 'userロールではadmin権限を持たないべき');
    
    // 管理者の場合
    (authService as any)._currentUser = { id: 'admin1', name: 'Admin User', role: 'admin' };
    assert.strictEqual(authService.hasPermission('user'), true, 'adminロールではuser権限も持つべき');
    assert.strictEqual(authService.hasPermission('admin'), true, 'adminロールではadmin権限を持つべき');
  });
  
  test('setAuthTokenDirectly - 外部トークン設定テスト', async () => {
    // トークン検証成功をモック
    const authService = AuthenticationService.getInstance();
    sinon.stub(authService as any, '_verifyToken').resolves(true);
    sinon.stub(authService as any, '_fetchUserInfo').resolves();
    
    const result = await authService.setAuthTokenDirectly('external-token');
    
    // 検証
    assert.strictEqual(result, true, '外部トークン設定は成功を返すべき');
    sinon.assert.calledWith(mockTokenManager.setAccessToken, 'external-token');
    assert.strictEqual(authService.isAuthenticated(), true, '認証状態がtrueになるべき');
    sinon.assert.calledOnce(mockAuthEventBus.publish);
  });
});