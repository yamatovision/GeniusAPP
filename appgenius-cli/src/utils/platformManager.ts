import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { logger } from './logger';

/**
 * 実行環境の種類
 */
export enum PlatformEnvironment {
  VSCODE = 'vscode',
  CLI = 'cli',
  WEB = 'web'
}

/**
 * プラットフォーム管理クラス（CLI用）
 * 異なる環境での実行を抽象化し、リソース参照やパス解決を統一的に提供
 */
export class PlatformManager {
  private static instance: PlatformManager;
  
  // 実行環境（CLI向けはcliで固定）
  private environment: PlatformEnvironment = PlatformEnvironment.CLI;
  
  // CLIのルートパス
  private cliRootPath: string;
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): PlatformManager {
    if (!PlatformManager.instance) {
      PlatformManager.instance = new PlatformManager();
    }
    return PlatformManager.instance;
  }
  
  /**
   * コンストラクタ
   */
  private constructor() {
    // CLI実行モードを明示的に設定
    this.environment = PlatformEnvironment.CLI;
    
    // CLIのルートパスを取得
    this.cliRootPath = this.findCliRootPath();
    
    logger.debug(`PlatformManager initialized: ${this.environment}`, {
      cliRootPath: this.cliRootPath
    });
  }
  
  /**
   * CLIルートパスを探索
   */
  private findCliRootPath(): string {
    // 現在の実行スクリプトからの相対パスでルートを検出
    try {
      // 実行中のスクリプトのディレクトリを取得
      const currentDir = __dirname;
      
      // node_modulesまたはdistディレクトリの場合は上位ディレクトリを探す
      if (currentDir.includes('node_modules') || currentDir.includes('dist')) {
        // パスを分解してnode_modulesまたはdistより上のディレクトリを見つける
        const parts = currentDir.split(path.sep);
        let rootIndex = -1;
        
        parts.forEach((part, index) => {
          if (part === 'node_modules' || part === 'dist') {
            rootIndex = index - 1;
          }
        });
        
        if (rootIndex >= 0) {
          return parts.slice(0, rootIndex + 1).join(path.sep);
        }
      }
      
      // package.jsonを探して、それが存在するディレクトリをルートとする
      let testDir = currentDir;
      const maxLevels = 5; // 最大で5階層上まで探索
      
      for (let i = 0; i < maxLevels; i++) {
        const packagePath = path.join(testDir, 'package.json');
        
        if (fs.existsSync(packagePath)) {
          return testDir;
        }
        
        // 1階層上に移動
        testDir = path.dirname(testDir);
      }
      
      // 見つからなかった場合は現在のディレクトリを返す
      return currentDir;
    } catch (error) {
      logger.warn('Failed to detect CLI root path', error as Error);
      return process.cwd();
    }
  }
  
  /**
   * 現在の実行環境を取得
   */
  public getEnvironment(): PlatformEnvironment {
    return this.environment;
  }
  
  /**
   * CLIのルートパスを取得
   */
  public getCliRootPath(): string {
    return this.cliRootPath;
  }
  
  /**
   * リソースの絶対パスを取得
   */
  public getResourcePath(relativePath: string): string {
    return path.join(this.cliRootPath, relativePath);
  }
  
  /**
   * 一時ディレクトリのパスを取得
   */
  public getTempDirectory(subdirectory: string = ''): string {
    // アプリケーション共通の一時ディレクトリを構築
    const tempBasePath = path.join(os.tmpdir(), 'appgenius');
    
    // サブディレクトリがある場合は追加
    const tempPath = subdirectory ? path.join(tempBasePath, subdirectory) : tempBasePath;
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(tempPath)) {
      fs.mkdirSync(tempPath, { recursive: true });
    }
    
    return tempPath;
  }
  
  /**
   * プロジェクト共有ディレクトリのパスを取得
   */
  public getProjectSharedDirectory(projectId: string): string {
    const sharedPath = path.join(this.getTempDirectory('projects'), projectId);
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(sharedPath)) {
      fs.mkdirSync(sharedPath, { recursive: true });
    }
    
    return sharedPath;
  }
  
  /**
   * スコープディレクトリのパスを取得
   */
  public getScopesDirectory(): string {
    return this.getTempDirectory('scopes');
  }
  
  /**
   * 進捗ディレクトリのパスを取得
   */
  public getProgressDirectory(): string {
    return this.getTempDirectory('progress');
  }
  
  /**
   * メッセージディレクトリのパスを取得
   */
  public getMessagesDirectory(projectId: string): string {
    return path.join(this.getTempDirectory('messages'), projectId);
  }
  
  /**
   * VSCode拡張機能からの環境変数を取得
   */
  public getVSCodeEnvironment(): {
    projectId: string;
    scopePath: string;
    projectPath: string;
    isDebug: boolean;
  } {
    return {
      projectId: process.env.APPGENIUS_PROJECT_ID || '',
      scopePath: process.env.APPGENIUS_SCOPE_PATH || '',
      projectPath: process.env.APPGENIUS_PROJECT_PATH || '',
      isDebug: process.env.APPGENIUS_DEBUG === 'true'
    };
  }
}