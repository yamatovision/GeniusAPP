import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger';
import { PlatformManager } from '../../utils/PlatformManager';
import { TerminalOptions } from './LauncherTypes';

/**
 * ターミナル作成と環境変数設定を担当するサービス
 */
export class TerminalProvisionService {
  private platformManager: PlatformManager;
  
  constructor() {
    this.platformManager = PlatformManager.getInstance();
  }
  
  /**
   * 新しいターミナルを作成し、基本的な環境を設定
   * @param options ターミナル設定オプション
   */
  public createConfiguredTerminal(options: TerminalOptions): vscode.Terminal {
    const {
      title = 'ClaudeCode',
      cwd,
      iconPath: customIconPath
    } = options;
    
    // アイコンURIを取得
    const iconPath = customIconPath || this.getDefaultIconPath();
    
    // ターミナルの作成
    const terminalOptions: vscode.TerminalOptions = {
      name: title,
      cwd: cwd,
      iconPath: this.validateIconPath(iconPath)
    };
    
    // 分割表示の場合は、適切な位置を設定（VSCode APIの制約に注意）
    if (options.splitView && options.location) {
      // 1.68未満のVSCodeでは直接の設定はできないため、位置はVSCode自体にゆだねる
    }
    
    const terminal = vscode.window.createTerminal(terminalOptions);
    
    // ターミナルの表示（true を渡してフォーカスする）
    terminal.show(true);
    
    // 環境設定を適用
    this.setupTerminalEnvironment(terminal, cwd);
    
    return terminal;
  }
  
  /**
   * ターミナルに基本的な環境変数設定とディレクトリ移動などを行う
   * @param terminal ターミナルインスタンス
   * @param workingDirectory 作業ディレクトリ
   */
  public setupTerminalEnvironment(terminal: vscode.Terminal, workingDirectory?: string): void {
    // 最初にユーザーガイダンスを表示
    terminal.sendText('echo "\n\n*** AIが自動的に処理を開始します。自動対応と日本語指示を行います ***\n"');
    
    // macOSの場合は環境変数のソースを確保（出力を非表示）
    if (process.platform === 'darwin') {
      terminal.sendText('source ~/.zshrc || source ~/.bash_profile || source ~/.profile || echo "No profile found" > /dev/null 2>&1');
      terminal.sendText('export PATH="$PATH:$HOME/.nvm/versions/node/v18.20.6/bin:/usr/local/bin:/usr/bin"');
    }
    
    // Raw mode問題を回避するための環境変数設定
    terminal.sendText('export NODE_NO_READLINE=1');
    terminal.sendText('export TERM=xterm-256color');
    
    // 明示的にプロジェクトルートディレクトリに移動（出力を非表示）
    if (workingDirectory) {
      const escapedPath = workingDirectory.replace(/"/g, '\\"');
      terminal.sendText(`cd "${escapedPath}" > /dev/null 2>&1 && pwd > /dev/null 2>&1`);
    }
  }
  
  /**
   * 認証情報を使用するための環境変数を設定
   * @param terminal ターミナルインスタンス
   * @param authFilePath 認証情報ファイルパス
   */
  public setupAuthEnvironment(terminal: vscode.Terminal, authFilePath: string): void {
    terminal.sendText(`export CLAUDE_AUTH_FILE="${authFilePath}"`);
    Logger.info(`AppGenius認証情報を使用するよう環境変数を設定: export CLAUDE_AUTH_FILE="${authFilePath}"`);
  }
  
  /**
   * ファイルパスをコマンドライン用にエスケープ
   * @param filePath ファイルパス
   */
  public escapeFilePath(filePath: string): string {
    return filePath.replace(/ /g, '\\ ');
  }
  
  /**
   * パイプを使って自動応答を追加したコマンドを生成
   * @param baseCommand 基本コマンド
   * @param fileArg ファイル引数（既にエスケープ済みであること）
   * @param additionalParams 追加パラメータ
   */
  public buildCommandWithAutoResponse(
    baseCommand: string,
    fileArg: string,
    additionalParams?: string
  ): string {
    // 追加のコマンドラインパラメータがあればクリーンアップして追加
    const params = additionalParams ? ` ${additionalParams.trim()}` : '';
    
    // Echo と パイプを使った自動応答コマンドを構築
    return `echo "日本語で対応してください。指定されたファイルを読み込むところから始めてください。" | ${baseCommand} ${fileArg}${params}`;
  }
  
  /**
   * 規定のアイコンパスを取得
   */
  private getDefaultIconPath(): vscode.Uri | undefined {
    const resource = this.platformManager.getResourceUri('media/icon.svg');
    // 文字列の場合はURIに変換しない
    if (typeof resource === 'string') {
      return undefined;
    }
    // vscode.Uri の場合はそのまま返す
    return resource;
  }
  
  /**
   * アイコンパスを検証し、有効なものを返す
   */
  private validateIconPath(iconPath: any): vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined {
    if (!iconPath) {
      return undefined;
    }
    
    if (typeof iconPath === 'string') {
      return undefined;
    }
    
    if (iconPath instanceof vscode.Uri && fs.existsSync(iconPath.fsPath)) {
      return iconPath;
    }
    
    if (iconPath.light && iconPath.dark) {
      return iconPath;
    }
    
    return undefined;
  }
}