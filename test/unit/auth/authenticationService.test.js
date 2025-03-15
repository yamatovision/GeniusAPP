"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const axios_1 = __importDefault(require("axios"));
const AuthenticationService_1 = require("../../../src/core/auth/AuthenticationService");
const TokenManager_1 = require("../../../src/core/auth/TokenManager");
const AuthEventBus_1 = require("../../../src/services/AuthEventBus");
// モック化のためのヘルパー
let mockTokenManager;
let mockAuthEventBus;
let mockAxios;
let mockVscode;
let processEnvBackup;
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
        on: sinon.stub().returns({ dispose: () => { } }),
        once: sinon.stub().returns({ dispose: () => { } }),
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
    sinon.stub(TokenManager_1.TokenManager, 'getInstance').returns(mockTokenManager);
    sinon.stub(AuthEventBus_1.AuthEventBus, 'getInstance').returns(mockAuthEventBus);
    sinon.stub(axios_1.default, 'post').callsFake(mockAxios.post);
    sinon.stub(axios_1.default, 'get').callsFake(mockAxios.get);
    sinon.stub(axios_1.default, 'put').callsFake(mockAxios.put);
    sinon.stub(axios_1.default, 'isAxiosError').callsFake(mockAxios.isAxiosError);
    // setIntervalのモック
    const originalSetInterval = global.setInterval;
    sinon.stub(global, 'setInterval').callsFake((callback, ms) => {
        return originalSetInterval(() => { }, ms);
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
    let clock;
    // 各テストの前後で実行
    setup(async () => {
        await setupTestEnvironment();
        // 時間を固定して、タイムスタンプが一貫するようにする
        clock = sinon.useFakeTimers(new Date('2025-03-15T12:00:00Z').getTime());
    });
    teardown(async () => {
        clock.restore();
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
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
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
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        const result = await authService.login('wrong@example.com', 'wrongpassword');
        // 検証
        assert.strictEqual(result, false, 'ログインは失敗を返すべき');
        assert.strictEqual(authService.isAuthenticated(), false, '認証状態がfalseのままであるべき');
        sinon.assert.notCalled(mockTokenManager.setAccessToken);
        sinon.assert.notCalled(mockTokenManager.setRefreshToken);
    });
    test('login - ネットワークエラー時の動作テスト', async () => {
        // ネットワークエラーをモック
        mockAxios.post.withArgs('http://test-api.example.com/api/auth/login').rejects(new Error('Network error'));
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        const result = await authService.login('test@example.com', 'password123');
        // 検証
        assert.strictEqual(result, false, 'ネットワークエラー時はログインが失敗すべき');
        assert.strictEqual(authService.isAuthenticated(), false, '認証状態がfalseのままであるべき');
        const lastError = authService.getLastError();
        assert.ok(lastError, 'エラー情報が設定されるべき');
        assert.strictEqual(lastError.code, 'unknown_error', 'エラーコードが設定されるべき');
    });
    test('logout - ログアウト処理の動作テスト', async () => {
        // ログアウト成功時のAPIレスポンスをモック
        mockAxios.post.withArgs('http://test-api.example.com/api/auth/logout').resolves({
            status: 200,
            data: { success: true }
        });
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        // 事前準備としてログイン状態に設定
        authService._isAuthenticated = true;
        authService._currentUser = { id: 'user1', name: 'Test User' };
        await authService.logout();
        // 検証
        assert.strictEqual(authService.isAuthenticated(), false, 'ログアウト後は認証状態がfalseになるべき');
        sinon.assert.calledOnce(mockTokenManager.clearTokens);
        sinon.assert.calledOnce(mockAuthEventBus.publish);
        assert.strictEqual(authService._currentUser, null, 'ユーザー情報がクリアされるべき');
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
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
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
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        // 事前準備としてログイン状態に設定
        authService._isAuthenticated = true;
        authService._currentUser = { id: 'user1', name: 'Test User' };
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
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        const result = await authService._verifyToken('valid-token');
        // 検証
        assert.strictEqual(result, true, 'トークン検証は成功を返すべき');
    });
    test('verifyToken - トークン検証の失敗テスト', async () => {
        // トークン検証失敗時のAPIレスポンスをモック
        mockAxios.post.withArgs('http://test-api.example.com/api/auth/verify').rejects({
            response: { status: 401 }
        });
        // リフレッシュも失敗するようにモック
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        sinon.stub(authService, 'refreshToken').resolves(false);
        const result = await authService._verifyToken('invalid-token');
        // 検証
        assert.strictEqual(result, false, 'トークン検証は失敗を返すべき');
        sinon.assert.calledOnce(authService.refreshToken);
    });
    test('getAuthHeader - 認証ヘッダー取得テスト', async () => {
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        const header = await authService.getAuthHeader();
        // 検証
        assert.deepStrictEqual(header, { 'Authorization': 'Bearer mock-access-token' }, '正しい認証ヘッダーが返されるべき');
    });
    test('hasPermission - 権限チェックテスト', () => {
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        // ログインしていない場合
        assert.strictEqual(authService.hasPermission('user'), false, '未ログイン状態では権限チェックはfalseを返すべき');
        // 一般ユーザーの場合
        authService._isAuthenticated = true;
        authService._currentUser = { id: 'user1', name: 'Test User', role: 'user' };
        assert.strictEqual(authService.hasPermission('user'), true, 'userロールではuser権限を持つべき');
        assert.strictEqual(authService.hasPermission('admin'), false, 'userロールではadmin権限を持たないべき');
        // 管理者の場合
        authService._currentUser = { id: 'admin1', name: 'Admin User', role: 'admin' };
        assert.strictEqual(authService.hasPermission('user'), true, 'adminロールではuser権限も持つべき');
        assert.strictEqual(authService.hasPermission('admin'), true, 'adminロールではadmin権限を持つべき');
    });
    test('setAuthTokenDirectly - 外部トークン設定テスト', async () => {
        // トークン検証成功をモック
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        sinon.stub(authService, '_verifyToken').resolves(true);
        sinon.stub(authService, '_fetchUserInfo').resolves();
        const result = await authService.setAuthTokenDirectly('external-token');
        // 検証
        assert.strictEqual(result, true, '外部トークン設定は成功を返すべき');
        sinon.assert.calledWith(mockTokenManager.setAccessToken, 'external-token');
        assert.strictEqual(authService.isAuthenticated(), true, '認証状態がtrueになるべき');
        sinon.assert.calledOnce(mockAuthEventBus.publish);
    });
    // セキュリティ強化関連のテスト追加
    test('リトライメカニズム - 一時的なエラーのリトライ処理テスト', async () => {
        // 最初の2回はエラー、3回目は成功を返すようにモック
        mockAxios.post.withArgs('http://test-api.example.com/api/auth/verify')
            .onFirstCall().rejects({ response: { status: 503 } })
            .onSecondCall().rejects({ response: { status: 503 } })
            .onThirdCall().resolves({ status: 200 });
        // _isRetryableErrorメソッドをモック
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        sinon.stub(authService, '_isRetryableError').returns(true);
        // _delayメソッドをモックして待機をスキップ
        sinon.stub(authService, '_delay').resolves();
        // テスト実行
        const result = await authService._verifyToken('token-with-server-error');
        // 検証
        assert.strictEqual(result, true, 'サーバーエラー後のリトライで成功すべき');
        assert.strictEqual(mockAxios.post.callCount, 3, '3回呼び出されるべき');
    });
    test('リトライメカニズム - 最大リトライ回数を超えた場合のテスト', async () => {
        // すべての呼び出しでエラーを返すようにモック
        mockAxios.post.withArgs('http://test-api.example.com/api/auth/verify')
            .rejects({ response: { status: 503 } });
        // _isRetryableErrorメソッドをモック
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        sinon.stub(authService, '_isRetryableError').returns(true);
        // _delayメソッドをモックして待機をスキップ
        sinon.stub(authService, '_delay').resolves();
        // メソッドのスパイを作成
        const verifyTokenSpy = sinon.spy(authService, '_verifyToken');
        // テスト実行
        const result = await authService._verifyToken('token-with-persistent-error');
        // 検証
        assert.strictEqual(result, false, '最大リトライ回数を超えた後は失敗を返すべき');
        assert.ok(mockAxios.post.callCount > 1, '複数回呼び出されるべき');
    });
    test('hasPermissions - 複数権限チェックテスト', () => {
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        // ログインしていない場合
        assert.strictEqual(authService.hasPermissions(['read', 'write']), false, '未ログイン状態では権限チェックはfalseを返すべき');
        // 一般ユーザーの場合（指定された権限を持つ）
        authService._isAuthenticated = true;
        authService._currentUser = {
            id: 'user1',
            name: 'Test User',
            role: 'user',
            permissions: ['read', 'write']
        };
        assert.strictEqual(authService.hasPermissions(['read']), true, '必要な権限を持っているべき');
        assert.strictEqual(authService.hasPermissions(['read', 'write']), true, '必要なすべての権限を持っているべき');
        assert.strictEqual(authService.hasPermissions(['read', 'write', 'delete']), false, '不足している権限があるとfalseを返すべき');
        // 一般ユーザーの場合（権限が未定義）
        authService._currentUser = {
            id: 'user2',
            name: 'Limited User',
            role: 'user'
            // permissionsが未定義
        };
        assert.strictEqual(authService.hasPermissions(['read']), false, '権限が未定義の場合はfalseを返すべき');
        // 管理者の場合
        authService._currentUser = {
            id: 'admin1',
            name: 'Admin User',
            role: 'admin',
            permissions: [] // 空の権限リストでも管理者はすべての権限を持つ
        };
        assert.strictEqual(authService.hasPermissions(['read', 'write', 'delete', 'admin']), true, '管理者はすべての権限を持つべき');
    });
    test('同時に複数のリフレッシュリクエストがあった場合は1つのリクエストのみ実行される', async () => {
        // リフレッシュ成功時のAPIレスポンスをモック
        mockAxios.post.withArgs('http://test-api.example.com/api/auth/refresh-token').resolves({
            status: 200,
            data: {
                accessToken: 'concurrent-refresh-token',
                refreshToken: 'concurrent-refresh-token'
            }
        });
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        // 同時に3つのリフレッシュリクエストを実行
        const promise1 = authService.refreshToken();
        const promise2 = authService.refreshToken();
        const promise3 = authService.refreshToken();
        // すべて解決されるまで待機
        const results = await Promise.all([promise1, promise2, promise3]);
        // 検証
        assert.deepStrictEqual(results, [true, true, true], 'すべてのリクエストが成功を返すべき');
        assert.strictEqual(mockAxios.post.callCount, 1, '実際のAPIリクエストは1回だけ実行されるべき');
        sinon.assert.calledOnce(mockTokenManager.setAccessToken);
    });
    test('セキュアな通信 - 認証ヘッダーの生成が適切に行われる', async () => {
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        // トークンが存在する場合
        mockTokenManager.getAccessToken.resolves('secure-access-token');
        const header = await authService.getAuthHeader();
        // 検証
        assert.deepStrictEqual(header, { 'Authorization': 'Bearer secure-access-token' }, '正しい認証ヘッダーが生成されるべき');
        // トークンが存在しない場合
        mockTokenManager.getAccessToken.resolves(undefined);
        const emptyHeader = await authService.getAuthHeader();
        // 検証
        assert.strictEqual(emptyHeader, null, 'トークンが存在しない場合はnullを返すべき');
    });
    test('updateProfile - プロファイル更新成功テスト', async () => {
        // API成功応答をモック
        mockAxios.put.withArgs('http://test-api.example.com/api/users/profile').resolves({
            status: 200,
            data: {
                user: {
                    id: 'user1',
                    name: 'Updated User',
                    email: 'updated@example.com'
                }
            }
        });
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        // プロファイル更新データ
        const profileData = {
            name: 'Updated User',
            email: 'updated@example.com'
        };
        const result = await authService.updateProfile(profileData);
        // 検証
        assert.strictEqual(result, true, 'プロファイル更新は成功を返すべき');
        assert.deepStrictEqual(authService._currentUser, {
            id: 'user1',
            name: 'Updated User',
            email: 'updated@example.com'
        }, 'ユーザー情報が更新されるべき');
    });
    test('updateProfile - トークン期限切れ時の自動リフレッシュテスト', async () => {
        // 初回呼び出しで401エラー
        mockAxios.put.withArgs('http://test-api.example.com/api/users/profile')
            .onFirstCall().rejects({
            response: { status: 401 }
        })
            .onSecondCall().resolves({
            status: 200,
            data: {
                user: {
                    id: 'user1',
                    name: 'Refreshed User',
                    email: 'refreshed@example.com'
                }
            }
        });
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        // リフレッシュトークン成功をモック
        sinon.stub(authService, 'refreshToken').resolves(true);
        // プロファイル更新データ
        const profileData = {
            name: 'Refreshed User',
            email: 'refreshed@example.com'
        };
        const result = await authService.updateProfile(profileData);
        // 検証
        assert.strictEqual(result, true, 'トークンリフレッシュ後のプロファイル更新は成功を返すべき');
        sinon.assert.calledOnce(authService.refreshToken);
        assert.strictEqual(mockAxios.put.callCount, 2, '認証エラー後に再試行されるべき');
    });
    test('_isRetryableError - 適切なエラー分類テスト', () => {
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        // ネットワークエラー
        const networkError = {
            isAxiosError: true,
            response: undefined
        };
        assert.strictEqual(authService._isRetryableError(networkError), true, 'ネットワークエラーはリトライ可能');
        // レート制限エラー
        const rateLimitError = {
            isAxiosError: true,
            response: { status: 429 }
        };
        assert.strictEqual(authService._isRetryableError(rateLimitError), true, 'レート制限エラーはリトライ可能');
        // サーバーエラー
        const serverError = {
            isAxiosError: true,
            response: { status: 500 }
        };
        assert.strictEqual(authService._isRetryableError(serverError), true, 'サーバーエラーはリトライ可能');
        // クライアントエラー
        const clientError = {
            isAxiosError: true,
            response: { status: 400 }
        };
        assert.strictEqual(authService._isRetryableError(clientError), false, 'クライアントエラーはリトライ不可');
        // 認証エラー
        const authError = {
            isAxiosError: true,
            response: { status: 401 }
        };
        assert.strictEqual(authService._isRetryableError(authError), false, '認証エラーはリトライ不可');
    });
    test('dispose - リソースが正しく解放されること', () => {
        const authService = AuthenticationService_1.AuthenticationService.getInstance();
        // 認証チェックインターバルを設定
        authService._authCheckInterval = 12345;
        // StatusBarItemをモック
        authService._statusBarItem = {
            dispose: sinon.stub()
        };
        // イベントエミッターをモック
        authService._onAuthStateChanged = {
            dispose: sinon.stub()
        };
        // クリーンアップを実行
        authService.dispose();
        // 検証
        sinon.assert.calledWith(global.clearInterval, 12345);
        assert.strictEqual(authService._authCheckInterval, null, 'インターバルがnullにリセットされるべき');
        sinon.assert.calledOnce(authService._statusBarItem.dispose);
        sinon.assert.calledOnce(authService._onAuthStateChanged.dispose);
    });
});
//# sourceMappingURL=authenticationService.test.js.map