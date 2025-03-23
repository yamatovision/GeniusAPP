const assert = require('assert');
const axios = require('axios');
const sinon = require('sinon');
const vscode = require('vscode');
const { ClaudeCodeApiClient } = require('../out/api/claudeCodeApiClient');
const { AuthenticationService } = require('../out/core/auth/AuthenticationService');
const { SimpleAuthService } = require('../out/core/auth/SimpleAuthService');
const { ErrorHandler } = require('../out/utils/ErrorHandler');
const { Logger } = require('../out/utils/logger');

// モック化
jest.mock('axios');
jest.mock('vscode');
jest.mock('../out/core/auth/AuthenticationService');
jest.mock('../out/core/auth/SimpleAuthService');
jest.mock('../out/utils/ErrorHandler');
jest.mock('../out/utils/logger');

describe('ClaudeCodeApiClient', () => {
  let client;
  let legacyAuthServiceMock;
  let simpleAuthServiceMock;
  let errorHandlerMock;
  
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // SimpleAuthServiceモック
    simpleAuthServiceMock = {
      getAuthHeader: jest.fn().mockReturnValue({ 'Authorization': 'Bearer simple-test-token' }),
      refreshToken: jest.fn().mockReturnValue(true),
      verifyAuthState: jest.fn().mockResolvedValue(true),
      logout: jest.fn().mockResolvedValue(),
      onStateChanged: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      isAuthenticated: jest.fn().mockReturnValue(true)
    };
    SimpleAuthService.getInstance.mockReturnValue(simpleAuthServiceMock);
    
    // レガシーAuthenticationServiceモック
    legacyAuthServiceMock = {
      getAuthHeader: jest.fn().mockResolvedValue({ 'Authorization': 'Bearer legacy-test-token' }),
      refreshToken: jest.fn().mockResolvedValue(true),
      logout: jest.fn().mockResolvedValue(),
      onStateChanged: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      isAuthenticated: jest.fn().mockResolvedValue(true)
    };
    AuthenticationService.getInstance.mockReturnValue(legacyAuthServiceMock);
    
    // ErrorHandlerモック
    errorHandlerMock = {
      handleError: jest.fn()
    };
    ErrorHandler.getInstance.mockReturnValue(errorHandlerMock);
    
    // Loggerモック
    Logger.info = jest.fn();
    Logger.error = jest.fn();
    Logger.warn = jest.fn();
    Logger.debug = jest.fn();
    
    // VSCodeモック
    vscode.window.showErrorMessage = jest.fn();
    
    // Axiosモック
    axios.isAxiosError = jest.fn().mockImplementation(error => 
      error && error.isAxiosError === true
    );
    
    // クライアントインスタンスを取得
    client = ClaudeCodeApiClient.getInstance();
  });
  
  // SimpleAuthServiceとレガシー認証の切り替えをテスト
  describe('authentication service selection', () => {
    it('SimpleAuthServiceを優先的に使用する', async () => {
      // SimpleAuthServiceの初期化成功をシミュレート
      SimpleAuthService.getInstance.mockReturnValue(simpleAuthServiceMock);
      
      // クライアントを再初期化
      const testClient = ClaudeCodeApiClient.getInstance();
      
      // APIコンフィグをテスト
      axios.get.mockResolvedValueOnce({ status: 200, data: { user: { id: 1 } } });
      await testClient.testApiConnection();
      
      // SimpleAuthServiceのgetAuthHeaderが呼ばれたことを確認
      expect(simpleAuthServiceMock.getAuthHeader).toHaveBeenCalled();
      // レガシー認証のgetAuthHeaderは呼ばれていないことを確認
      expect(legacyAuthServiceMock.getAuthHeader).not.toHaveBeenCalled();
    });
    
    it('SimpleAuthServiceの初期化に失敗した場合、レガシー認証を使用する', async () => {
      // SimpleAuthServiceの初期化エラーをシミュレート
      SimpleAuthService.getInstance.mockImplementationOnce(() => {
        throw new Error('初期化エラー');
      });
      
      // クライアントを再初期化
      const testClient = ClaudeCodeApiClient.getInstance();
      
      // APIコンフィグをテスト
      axios.get.mockResolvedValueOnce({ status: 200, data: { user: { id: 1 } } });
      await testClient.testApiConnection();
      
      // レガシー認証のgetAuthHeaderが呼ばれたことを確認
      expect(legacyAuthServiceMock.getAuthHeader).toHaveBeenCalled();
    });
  });

  describe('recordTokenUsage', () => {
    it('SimpleAuthService使用時にトークン使用量を正常に記録できる', async () => {
      // SimpleAuthServiceの初期化成功をシミュレート
      SimpleAuthService.getInstance.mockReturnValue(simpleAuthServiceMock);
      
      // クライアントを再初期化
      const testClient = ClaudeCodeApiClient.getInstance();
      
      // モックレスポンスを設定
      axios.post.mockResolvedValueOnce({ status: 201 });
      
      // テスト実行
      const result = await testClient.recordTokenUsage(1000, 'claude-3-opus-20240229', 'test-context');
      
      // 検証
      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/proxy/usage/record'),
        {
          tokenCount: 1000,
          modelId: 'claude-3-opus-20240229',
          context: 'test-context'
        },
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer simple-test-token' },
          timeout: expect.any(Number)
        })
      );
      // SimpleAuthServiceのisAuthenticatedが使われたことを確認
      expect(simpleAuthServiceMock.isAuthenticated).toHaveBeenCalled();
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('【API連携】トークン使用履歴の記録を開始'));
    });
    
    it('レガシー認証使用時にトークン使用量を正常に記録できる', async () => {
      // SimpleAuthServiceの初期化エラーをシミュレート
      SimpleAuthService.getInstance.mockImplementationOnce(() => {
        throw new Error('初期化エラー');
      });
      
      // クライアントを再初期化
      const testClient = ClaudeCodeApiClient.getInstance();
      
      // モックレスポンスを設定
      axios.post.mockResolvedValueOnce({ status: 201 });
      
      // テスト実行
      const result = await testClient.recordTokenUsage(1000, 'claude-3-opus-20240229', 'test-context');
      
      // 検証
      expect(result).toBe(true);
      // レガシー認証のisAuthenticatedが使われたことを確認
      expect(legacyAuthServiceMock.isAuthenticated).toHaveBeenCalled();
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('【API連携】トークン使用履歴の記録を開始'));
    });
    
    it('主要エンドポイントが404を返した場合、フォールバックエンドポイントを使用する', async () => {
      // 主要エンドポイントのモックレスポンスを404エラーに設定
      const axiosError = new Error('Not Found');
      axiosError.isAxiosError = true;
      axiosError.response = { status: 404 };
      axios.post.mockRejectedValueOnce(axiosError);
      
      // フォールバックエンドポイントのモックレスポンスを設定
      axios.post.mockResolvedValueOnce({ status: 201 });
      
      // テスト実行
      const result = await client.recordTokenUsage(1000, 'claude-3-opus-20240229');
      
      // 検証
      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(axios.post.mock.calls[1][0]).toContain('/tokens/usage');
      expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('【API連携】主要エンドポイントが見つかりません'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('【API連携】フォールバックエンドポイントでトークン使用履歴の記録に成功しました'));
    });
    
    it('リトライが最大回数に達した場合、falseを返す', async () => {
      // すべてのリクエストが500エラーを返すように設定
      const axiosError = new Error('Server Error');
      axiosError.isAxiosError = true;
      axiosError.response = { status: 500 };
      axios.post.mockRejectedValue(axiosError);
      
      // テスト実行
      const result = await client.recordTokenUsage(1000, 'claude-3-opus-20240229');
      
      // 検証
      expect(result).toBe(false);
      expect(axios.post).toHaveBeenCalledTimes(4); // 初回 + 3回のリトライ
      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('【API連携】トークン使用履歴の記録に失敗しました'), expect.any(Error));
    });
    
    it('認証エラー発生時にSimpleAuthServiceでトークンを検証してリトライする', async () => {
      // SimpleAuthServiceの初期化成功をシミュレート
      SimpleAuthService.getInstance.mockReturnValue(simpleAuthServiceMock);
      
      // クライアントを再初期化
      const testClient = ClaudeCodeApiClient.getInstance();
      
      // 最初のリクエストは401エラーを返すように設定
      const authError = new Error('Unauthorized');
      authError.isAxiosError = true;
      authError.response = { status: 401 };
      axios.post.mockRejectedValueOnce(authError);
      
      // 2回目のリクエストは成功
      axios.post.mockResolvedValueOnce({ status: 201 });
      
      // テスト実行
      const result = await testClient.recordTokenUsage(1000, 'claude-3-opus-20240229');
      
      // 検証
      expect(result).toBe(true);
      expect(simpleAuthServiceMock.verifyAuthState).toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('【API連携】トークンの有効期限切れ'));
    });
    
    it('認証エラー発生時にレガシー認証でトークンをリフレッシュしてリトライする', async () => {
      // SimpleAuthServiceの初期化エラーをシミュレート
      SimpleAuthService.getInstance.mockImplementationOnce(() => {
        throw new Error('初期化エラー');
      });
      
      // クライアントを再初期化
      const testClient = ClaudeCodeApiClient.getInstance();
      
      // 最初のリクエストは401エラーを返すように設定
      const authError = new Error('Unauthorized');
      authError.isAxiosError = true;
      authError.response = { status: 401 };
      axios.post.mockRejectedValueOnce(authError);
      
      // 2回目のリクエストは成功
      axios.post.mockResolvedValueOnce({ status: 201 });
      
      // テスト実行
      const result = await testClient.recordTokenUsage(1000, 'claude-3-opus-20240229');
      
      // 検証
      expect(result).toBe(true);
      expect(legacyAuthServiceMock.refreshToken).toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('【API連携】トークンの有効期限切れ'));
    });
  });
  
  describe('_retryWithExponentialBackoff', () => {
    it('指数バックオフとジッターを用いたリトライが正しく動作する', async () => {
      // 実行カウンタ
      let counter = 0;
      
      // 時間経過をモック
      jest.useFakeTimers();
      
      // 2回目で成功するオペレーション
      const operation = jest.fn().mockImplementation(() => {
        counter++;
        if (counter === 1) {
          const error = new Error('Test Error');
          error.isAxiosError = true;
          throw error;
        }
        return Promise.resolve('success');
      });
      
      // テスト実行（非同期）
      const resultPromise = client._retryWithExponentialBackoff(operation, 3, [500], 'テスト操作');
      
      // 最初の失敗
      expect(operation).toHaveBeenCalledTimes(1);
      
      // タイマーを進める（ジッターがあるため正確な時間ではない）
      jest.advanceTimersByTime(2000);
      
      // 結果を確認
      const result = await resultPromise;
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('【API連携】テスト操作を'));
      
      // タイマーをリセット
      jest.useRealTimers();
    });
  });
});