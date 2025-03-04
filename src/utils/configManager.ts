import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * 拡張機能の設定を管理するクラス
 */
export class ConfigManager {
  private static readonly CONFIG_SECTION = 'appgeniusAI';

  /**
   * 設定値を取得する
   */
  public static get<T>(key: string, defaultValue?: T): T {
    try {
      const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
      const value = config.get<T>(key, defaultValue as T);
      return value as T;
    } catch (error) {
      Logger.error(`Failed to get config value for ${key}`, error as Error);
      return defaultValue as T;
    }
  }

  /**
   * 設定値を更新する
   */
  public static async update(key: string, value: any, global: boolean = false): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
      await config.update(key, value, global);
      Logger.debug(`Config ${key} updated to ${value}`);
    } catch (error) {
      Logger.error(`Failed to update config ${key}`, error as Error);
      throw new Error(`設定 ${key} の更新に失敗しました`);
    }
  }

  /**
   * 拡張機能のバージョンを取得する
   */
  public static getExtensionVersion(): string {
    try {
      const extension = vscode.extensions.getExtension('appgenius-ai.appgenius-ai');
      return extension ? extension.packageJSON.version : 'unknown';
    } catch (error) {
      Logger.error('Failed to get extension version', error as Error);
      return 'unknown';
    }
  }

  /**
   * デバッグモードが有効かどうかを取得する
   */
  public static isDebugMode(): boolean {
    return this.get<boolean>('debugMode', false);
  }

  /**
   * API認証情報を安全に保存する
   */
  public static async saveApiCredentials(apiKey: string): Promise<void> {
    try {
      // VSCodeのSecretsを使用して安全に保存
      await vscode.workspace.getConfiguration(this.CONFIG_SECTION).update('apiKeyExists', true, true);
      
      // 実際のキーを保存（実際のプロダクションコードではSecrets APIを使用すべき）
      // この実装はPhase 1のプロトタイプ用
      await this.update('apiKey', apiKey, true);
      
      Logger.info('API credentials saved');
    } catch (error) {
      Logger.error('Failed to save API credentials', error as Error);
      throw new Error('API認証情報の保存に失敗しました');
    }
  }

  /**
   * API認証情報を取得する
   */
  public static getApiCredentials(): string | undefined {
    try {
      // APIキーが存在するかチェック
      const apiKeyExists = this.get<boolean>('apiKeyExists', false);
      
      if (!apiKeyExists) {
        return undefined;
      }
      
      // 実際のキーを取得（実際のプロダクションコードではSecrets APIを使用すべき）
      return this.get<string>('apiKey');
    } catch (error) {
      Logger.error('Failed to get API credentials', error as Error);
      return undefined;
    }
  }

  /**
   * API認証情報を削除する
   */
  public static async clearApiCredentials(): Promise<void> {
    try {
      await vscode.workspace.getConfiguration(this.CONFIG_SECTION).update('apiKeyExists', false, true);
      await this.update('apiKey', undefined, true);
      Logger.info('API credentials cleared');
    } catch (error) {
      Logger.error('Failed to clear API credentials', error as Error);
      throw new Error('API認証情報の削除に失敗しました');
    }
  }
}