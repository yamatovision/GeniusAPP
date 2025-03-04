import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { AppConfig, LogLevel } from '../types';
import { logger } from './logger';

/**
 * 設定マネージャークラス
 * .envファイルとコマンドライン引数からアプリケーション設定を管理
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private configDir: string;
  private configFilePath: string;

  private constructor() {
    // 環境変数の読み込み
    dotenv.config();

    // 設定ディレクトリの初期化
    this.configDir = path.join(os.homedir(), '.appgenius');
    this.configFilePath = path.join(this.configDir, 'config.json');
    this.ensureConfigDir();

    // デフォルト設定の初期化
    this.config = {
      apiKey: process.env.CLAUDE_API_KEY || '',
      projectRoot: process.env.DEFAULT_PROJECT_ROOT || process.cwd(),
      logLevel: this.parseLogLevel(process.env.LOG_LEVEL),
      tempDir: process.env.TEMP_DIR || path.join(os.tmpdir(), 'appgenius')
    };

    // 保存された設定の読み込み
    this.loadConfig();
  }

  /**
   * 設定マネージャーインスタンスを取得
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 文字列をLogLevelに変換
   */
  private parseLogLevel(level: string | undefined): LogLevel {
    if (!level) return LogLevel.INFO;
    
    switch (level.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  /**
   * 設定ディレクトリの存在を確認し、必要なら作成
   */
  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * 保存された設定を読み込み
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const savedConfig = JSON.parse(fs.readFileSync(this.configFilePath, 'utf-8'));
        this.config = { ...this.config, ...savedConfig };
        logger.debug('設定ファイルを読み込みました', { configPath: this.configFilePath });
      } else {
        logger.debug('設定ファイルが見つかりません。デフォルト設定を使用します');
      }
    } catch (error) {
      logger.error('設定ファイルの読み込みに失敗しました', error as Error);
    }
  }

  /**
   * 現在の設定を保存
   */
  public saveConfig(): void {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2));
      logger.debug('設定を保存しました', { configPath: this.configFilePath });
    } catch (error) {
      logger.error('設定の保存に失敗しました', error as Error);
    }
  }

  /**
   * 設定を更新
   */
  public updateConfig(newConfig: Partial<AppConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  /**
   * 現在の設定を取得
   */
  public getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * API Keyを設定
   */
  public setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.saveConfig();
  }

  /**
   * プロジェクトルートパスを設定
   */
  public setProjectRoot(projectRoot: string): void {
    if (fs.existsSync(projectRoot)) {
      this.config.projectRoot = projectRoot;
      this.saveConfig();
      logger.info(`プロジェクトルートを設定しました: ${projectRoot}`);
    } else {
      logger.error(`指定されたプロジェクトパスが存在しません: ${projectRoot}`);
    }
  }

  /**
   * ログレベルを設定
   */
  public setLogLevel(logLevel: LogLevel): void {
    this.config.logLevel = logLevel;
    this.saveConfig();
    logger.setLogLevel(logLevel);
  }
}

// 簡易アクセス用のエクスポート
export const configManager = ConfigManager.getInstance();