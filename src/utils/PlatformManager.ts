import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * プラットフォーム環境の種類
 */
export enum PlatformEnvironment {
  VSCODE = 'vscode',
  CLI = 'cli',
  WEB = 'web'
}

/**
 * プラットフォーム管理クラス
 * VS Code、CLI、Web環境での実行を抽象化し、適切なリソース参照を提供
 */
export class PlatformManager {
  private static instance: PlatformManager;
  
  // 実行環境
  private environment: PlatformEnvironment;
  
  // VS Code拡張機能のコンテキスト
  private extensionContext: vscode.ExtensionContext | null = null;
  
  // 拡張機能のパス
  private extensionPath: string | null = null;
  
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
    // 実行環境の自動検出
    this.environment = this.detectEnvironment();
    
    // 拡張機能のパスを取得（VS Code環境の場合）
    if (this.environment === PlatformEnvironment.VSCODE) {
      try {
        this.extensionPath = this.findExtensionPath();
      } catch (error) {
        console.warn('拡張機能パスの検出に失敗しました:', error);
      }
    }
  }
  
  /**
   * 実行環境を検出
   */
  private detectEnvironment(): PlatformEnvironment {
    // VS Code APIが利用可能かどうかでVS Code環境かを判定
    if (typeof vscode !== 'undefined') {
      return PlatformEnvironment.VSCODE;
    }
    
    // 環境変数でCLI環境かを判定
    if (process.env.APPGENIUS_CLI === 'true') {
      return PlatformEnvironment.CLI;
    }
    
    // それ以外はWeb環境と判定（将来的にブラウザ判定を追加予定）
    return PlatformEnvironment.WEB;
  }
  
  /**
   * VS Code拡張機能のパスを検出
   */
  private findExtensionPath(): string | null {
    // VS Code環境でない場合はnullを返す
    if (this.environment !== PlatformEnvironment.VSCODE) {
      return null;
    }
    
    // vscodeが利用可能な場合、拡張機能のパスを取得
    try {
      const extension = vscode.extensions.getExtension('appgenius-ai.appgenius-ai');
      if (extension) {
        return extension.extensionPath;
      }
    } catch (error) {
      console.warn('拡張機能のパス取得に失敗しました:', error);
    }
    
    return null;
  }
  
  /**
   * VS Code拡張機能コンテキストを設定
   */
  public setExtensionContext(context: vscode.ExtensionContext): void {
    this.extensionContext = context;
    this.extensionPath = context.extensionPath;
  }
  
  /**
   * 現在の実行環境を取得
   */
  public getEnvironment(): PlatformEnvironment {
    return this.environment;
  }
  
  /**
   * 拡張機能のパスを取得
   */
  public getExtensionPath(): string | null {
    return this.extensionPath;
  }
  
  /**
   * リソースのURIを取得（環境に応じた形式で）
   */
  public getResourceUri(relativePath: string): vscode.Uri | string {
    // VS Code環境の場合
    if (this.environment === PlatformEnvironment.VSCODE && this.extensionPath) {
      return vscode.Uri.file(path.join(this.extensionPath, relativePath));
    }
    
    // CLI環境の場合
    if (this.environment === PlatformEnvironment.CLI) {
      // 実行中のスクリプトのディレクトリを基準にする
      return path.resolve(__dirname, '..', '..', relativePath);
    }
    
    // Web環境の場合（または他のフォールバックケース）
    return relativePath;
  }
  
  /**
   * リソースの絶対パスを取得
   */
  public getResourcePath(relativePath: string): string {
    // VS Code環境の場合
    if (this.environment === PlatformEnvironment.VSCODE && this.extensionPath) {
      return path.join(this.extensionPath, relativePath);
    }
    
    // CLI環境の場合
    if (this.environment === PlatformEnvironment.CLI) {
      return path.resolve(__dirname, '..', '..', relativePath);
    }
    
    // Web環境の場合（または他のフォールバックケース）
    return relativePath;
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
   * OSがWindowsかどうかを判定
   */
  public isWindows(): boolean {
    return os.platform() === 'win32';
  }

  /**
   * OSがmacOSかどうかを判定
   */
  public isMac(): boolean {
    return os.platform() === 'darwin';
  }

  /**
   * OSがLinuxかどうかを判定
   */
  public isLinux(): boolean {
    return os.platform() === 'linux';
  }

  /**
   * ホームディレクトリのパスを取得
   */
  public getHomeDir(): string {
    return os.homedir();
  }
}