const assert = require('assert');
const axios = require('axios');
const sinon = require('sinon');
const vscode = require('vscode');
const { ClaudeCodeApiClient } = require('../out/api/claudeCodeApiClient');
const { AuthenticationService } = require('../out/core/auth/AuthenticationService');
const { ErrorHandler } = require('../out/utils/ErrorHandler');
const { Logger } = require('../out/utils/logger');

// モック化
jest.mock('axios');
jest.mock('vscode');
jest.mock('../out/core/auth/AuthenticationService');
jest.mock('../out/utils/ErrorHandler');
jest.mock('../out/utils/logger');

describe('ClaudeCodeApiClient', () => {
  let client;
  let authServiceMock;
  let errorHandlerMock;
  
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // AuthenticationServiceモック
    authServiceMock = {
      getAuthHeader: jest.fn().mockResolvedValue({ 'Authorization': 'Bearer test-token' }),
      refreshToken: jest.fn().mockResolvedValue(true),
      logout: jest.fn().mockResolvedValue(),
      onStateChanged: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      isAuthenticated: jest.fn().mockResolvedValue(true)
    };
    AuthenticationService.getInstance.mockReturnValue(authServiceMock);
    
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
  
  describe('recordTokenUsage', () => {
    it('主要エンドポイントでトークン使用量を正常に記録できる', async () => {
      // モックレスポンスを設定
      axios.post.mockResolvedValueOnce({ status: 201 });
      
      // テスト実行
      const result = await client.recordTokenUsage(1000, 'claude-3-opus-20240229', 'test-context');
      
      // 検証
      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/usage/claude-tokens'),
        {
          tokenCount: 1000,
          modelId: 'claude-3-opus-20240229',
          context: 'test-context'
        },
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer test-token' },
          timeout: 15000
        })
      );
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('【API連携】トークン使用履歴の記録を開始'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('【API連携】トークン使用履歴の記録に成功しました'));
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
    
    it('認証エラーの場合、トークンをリフレッシュしてリトライする', async () => {
      // 最初のリクエストは401エラーを返すように設定
      const authError = new Error('Unauthorized');
      authError.isAxiosError = true;
      authError.response = { status: 401 };
      axios.post.mockRejectedValueOnce(authError);
      
      // 2回目のリクエストは成功
      axios.post.mockResolvedValueOnce({ status: 201 });
      
      // テスト実行
      const result = await client.recordTokenUsage(1000, 'claude-3-opus-20240229');
      
      // 検証
      expect(result).toBe(true);
      expect(authServiceMock.refreshToken).toHaveBeenCalled();
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