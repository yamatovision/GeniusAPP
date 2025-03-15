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
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const TokenManager_1 = require("../../../src/core/auth/TokenManager");
// モック化のためのヘルパー
let mockSecretStorage;
let mockContext;
let clock;
// テスト環境のセットアップ
function setupTestEnvironment() {
    // VSCode ExtensionContextのシークレットストレージをモック
    mockSecretStorage = {
        store: sinon.stub().resolves(),
        get: sinon.stub().resolves(),
        delete: sinon.stub().resolves()
    };
    // ExtensionContextをモック
    mockContext = {
        secrets: mockSecretStorage
    };
    // 時間を固定
    clock = sinon.useFakeTimers(new Date('2025-03-15T12:00:00Z').getTime());
    // TokenManagerのシングルトンインスタンスをリセット
    TokenManager_1.TokenManager.instance = undefined;
}
// テスト後のクリーンアップ
function cleanupTestEnvironment() {
    // スタブとモックをリストア
    sinon.restore();
    clock.restore();
}
suite('TokenManager Unit Tests', () => {
    setup(() => {
        setupTestEnvironment();
    });
    teardown(() => {
        cleanupTestEnvironment();
    });
    test('getInstance - コンテキストあり、初回呼び出し時にインスタンスを作成', () => {
        const instance = TokenManager_1.TokenManager.getInstance(mockContext);
        assert.ok(instance instanceof TokenManager_1.TokenManager, 'TokenManagerのインスタンスを返すべき');
        assert.strictEqual(TokenManager_1.TokenManager.instance, instance, 'シングルトンインスタンスが設定されるべき');
    });
    test('getInstance - コンテキストなし、既存インスタンスがある場合', () => {
        // 最初にコンテキスト付きでインスタンスを作成
        const instance1 = TokenManager_1.TokenManager.getInstance(mockContext);
        // 次にコンテキストなしでインスタンスを取得
        const instance2 = TokenManager_1.TokenManager.getInstance();
        assert.strictEqual(instance1, instance2, '同じインスタンスを返すべき');
    });
    test('getInstance - コンテキストなし、インスタンスがない場合はエラー', () => {
        assert.throws(() => {
            TokenManager_1.TokenManager.getInstance();
        }, /TokenManagerの初期化時にはExtensionContextが必要です/, 'エラーをスローすべき');
    });
    test('setAccessToken - トークンを正しく保存', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        await tokenManager.setAccessToken('test-access-token');
        sinon.assert.calledOnce(mockSecretStorage.store);
        sinon.assert.calledWith(mockSecretStorage.store, 'appgenius.accessToken', 'test-access-token');
    });
    test('setRefreshToken - トークンを正しく保存', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        await tokenManager.setRefreshToken('test-refresh-token');
        sinon.assert.calledOnce(mockSecretStorage.store);
        sinon.assert.calledWith(mockSecretStorage.store, 'appgenius.refreshToken', 'test-refresh-token');
    });
    test('getAccessToken - トークンを正しく取得', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        // モックの応答を設定
        mockSecretStorage.get.withArgs('appgenius.accessToken').resolves('saved-access-token');
        const token = await tokenManager.getAccessToken();
        assert.strictEqual(token, 'saved-access-token', '保存されたトークンを返すべき');
        sinon.assert.calledOnce(mockSecretStorage.get);
        sinon.assert.calledWith(mockSecretStorage.get, 'appgenius.accessToken');
    });
    test('getRefreshToken - トークンを正しく取得', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        // モックの応答を設定
        mockSecretStorage.get.withArgs('appgenius.refreshToken').resolves('saved-refresh-token');
        const token = await tokenManager.getRefreshToken();
        assert.strictEqual(token, 'saved-refresh-token', '保存されたトークンを返すべき');
        sinon.assert.calledOnce(mockSecretStorage.get);
        sinon.assert.calledWith(mockSecretStorage.get, 'appgenius.refreshToken');
    });
    test('clearTokens - すべてのトークンを正しく削除', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        await tokenManager.clearTokens();
        sinon.assert.calledTwice(mockSecretStorage.delete);
        sinon.assert.calledWith(mockSecretStorage.delete, 'appgenius.accessToken');
        sinon.assert.calledWith(mockSecretStorage.delete, 'appgenius.refreshToken');
    });
    test('hasToken - トークンが存在する場合はtrueを返す', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        // モックの応答を設定
        mockSecretStorage.get.withArgs('appgenius.accessToken').resolves('existing-token');
        const result = await tokenManager.hasToken();
        assert.strictEqual(result, true, 'トークンが存在する場合はtrueを返すべき');
    });
    test('hasToken - トークンが存在しない場合はfalseを返す', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        // モックの応答を設定
        mockSecretStorage.get.withArgs('appgenius.accessToken').resolves(undefined);
        const result = await tokenManager.hasToken();
        assert.strictEqual(result, false, 'トークンが存在しない場合はfalseを返すべき');
    });
    test('セキュリティ - シークレットストレージが正しく使用されているか', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        // トークンを保存
        await tokenManager.setAccessToken('sensitive-token');
        // 検証
        sinon.assert.calledWith(mockSecretStorage.store, 'appgenius.accessToken', 'sensitive-token');
        // 直接メンバー変数にアクセスできないことを確認
        assert.strictEqual(tokenManager.secretStorage, mockSecretStorage, 'secretStorageにのみアクセスできるべき');
        assert.strictEqual(Object.keys(tokenManager).length, 0, 'インスタンスにパブリックなトークン保存プロパティがないこと');
    });
    test('エラー処理 - SecretStorage.storeがエラーをスローする場合', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        // エラーをスローするようモックを設定
        mockSecretStorage.store.rejects(new Error('ストレージエラー'));
        // トークン保存時にエラーがスローされることを確認
        await assert.rejects(async () => await tokenManager.setAccessToken('test-token'), /ストレージエラー/, 'エラーが伝播するべき');
    });
    test('エラー処理 - SecretStorage.getがエラーをスローする場合', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        // エラーをスローするようモックを設定
        mockSecretStorage.get.rejects(new Error('取得エラー'));
        // トークン取得時にエラーがスローされることを確認
        await assert.rejects(async () => await tokenManager.getAccessToken(), /取得エラー/, 'エラーが伝播するべき');
    });
    test('エラー処理 - SecretStorage.deleteがエラーをスローする場合', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        // エラーをスローするようモックを設定
        mockSecretStorage.delete.rejects(new Error('削除エラー'));
        // トークンクリア時にエラーがスローされることを確認
        await assert.rejects(async () => await tokenManager.clearTokens(), /削除エラー/, 'エラーが伝播するべき');
    });
    test('セキュリティ - トークンキーが適切に分離されている', async () => {
        const tokenManager = TokenManager_1.TokenManager.getInstance(mockContext);
        await tokenManager.setAccessToken('access-123');
        await tokenManager.setRefreshToken('refresh-456');
        // 異なるキーで保存されていることを確認
        sinon.assert.calledWith(mockSecretStorage.store, 'appgenius.accessToken', 'access-123');
        sinon.assert.calledWith(mockSecretStorage.store, 'appgenius.refreshToken', 'refresh-456');
        // アプリケーション固有のプレフィックスが使用されていることを確認
        assert.ok(mockSecretStorage.store.firstCall.args[0].startsWith('appgenius.'), 'アプリケーション固有のプレフィックスを使用すべき');
    });
});
//# sourceMappingURL=tokenManager.test.js.map