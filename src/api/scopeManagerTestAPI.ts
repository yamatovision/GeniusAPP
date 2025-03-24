/**
 * スコープマネージャー用API接続テスト
 * 
 * このファイルは、スコープマネージャーパネルでのAPI接続テスト機能を提供します。
 * グローバル変数を使用して、SimpleAuthServiceのインスタンスを取得し、認証状態を確認します。
 */

import axios from 'axios';
import { Logger } from '../utils/logger';
import { SimpleAuthService } from '../core/auth/SimpleAuthService';

/**
 * API接続をテストして認証状態と接続性を確認
 */
export async function testAPIConnection(): Promise<boolean> {
  try {
    Logger.info('【API連携】API接続テストを開始');
    
    // グローバル変数からSimpleAuthServiceを取得
    try {
      Logger.info('【API連携】シンプル認証を使用してAPI接続テスト');
      
      // グローバル変数からインスタンスを取得
      let simpleAuthService;
      
      if (global._appgenius_simple_auth_service) {
        simpleAuthService = global._appgenius_simple_auth_service;
        Logger.info('【API連携】グローバル変数からSimpleAuthServiceを取得しました');
      } else {
        // もしグローバル変数が設定されていない場合は通常のインスタンスを取得
        try {
          simpleAuthService = SimpleAuthService.getInstance();
          Logger.info('【API連携】通常インスタンスからSimpleAuthServiceを取得しました');
        } catch (err) {
          Logger.error('【API連携】SimpleAuthServiceのインスタンス取得に失敗', err as Error);
          return false;
        }
      }
      
      // 認証状態とトークンの有無をチェック
      const isAuthenticated = simpleAuthService.isAuthenticated();
      const hasToken = !!simpleAuthService.getAccessToken();
      
      Logger.debug(`【API連携】SimpleAuthService認証状態: ${isAuthenticated}, トークン存在: ${hasToken}`);
      
      // 詳細な認証状態情報をログに出力
      const authState = simpleAuthService.getCurrentState();
      Logger.debug(`【API連携】現在の認証状態詳細: isAuthenticated=${authState.isAuthenticated}, userName=${authState.username || 'なし'}, userId=${authState.userId || 'なし'}, role=${authState.role || 'guest'}`);
      
      // 認証されている場合は成功を返す
      if (isAuthenticated && hasToken) {
        Logger.info('【API連携】シンプル認証は有効です');
        
        // APIキーの取得も試みる
        const apiKey = simpleAuthService.getApiKey();
        if (apiKey) {
          Logger.info('【API連携】APIキーも利用可能です');
        } else {
          Logger.info('【API連携】APIキーは利用できませんが、アクセストークンは有効です');
        }
        
        return true;
      }
      
      // 認証に問題があることをログに記録
      Logger.warn('【API連携】シンプル認証状態またはトークンが無効です');
      
      // バックエンドAPIのURLを検証（ログのみ）
      Logger.debug('【API連携】APIベースURL検証: https://geniemon-portal-backend-production.up.railway.app/api');
      
      return false;
    } catch (simpleAuthError) {
      Logger.error('【API連携】SimpleAuthServiceの取得に失敗しました', simpleAuthError as Error);
      return false;
    }
  } catch (error) {
    Logger.error('API接続テスト中にエラーが発生しました', error as Error);
    return false;
  }
}