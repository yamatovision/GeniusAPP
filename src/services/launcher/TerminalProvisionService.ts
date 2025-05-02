import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger';
import { PlatformManager } from '../../utils/PlatformManager';
import { TerminalOptions } from './LauncherTypes';
import { AppGeniusEventBus, AppGeniusEventType } from '../../services/AppGeniusEventBus';

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
  public async createConfiguredTerminal(options: TerminalOptions): Promise<vscode.Terminal> {
    // 受け取ったオプション全体をログ出力
    Logger.debug(`TerminalProvisionService: 受け取った生のオプション: ${JSON.stringify(options)}`);
    
    // デフォルト値の設定（titleプロパティがundefinedの場合のみ'ClaudeCode'を使用）
    // promptTypeがあればそれを優先的にタイトルとして使用
    const {
      title: rawTitle = 'ClaudeCode',
      promptType,
      cwd,
      iconPath: customIconPath,
      splitTerminal = false // 分割ターミナルオプション（デフォルトはfalse）
    } = options;
    
    // promptTypeが指定されていれば、それをそのまま利用
    const title = promptType || rawTitle;
    
    // 受け取ったオプションのログを出力（デバッグ）
    Logger.debug(`TerminalProvisionService: 解析後のオプション: ${JSON.stringify({
      title,
      cwd: cwd ? cwd.substring(0, 30) + '...' : undefined,
      hasIconPath: !!customIconPath,
      splitTerminal
    })}`);
    
    // アイコンURIを取得
    const iconPath = customIconPath || this.getDefaultIconPath();
    
    // ターミナルの作成（VSCodeではnameがterminalのタイトルになる）
    const terminalOptions: vscode.TerminalOptions = {
      name: title, // VSCodeのTerminalタブに表示されるのはnameプロパティ
      cwd: cwd,
      iconPath: this.validateIconPath(iconPath)
    };
    
    // ターミナル作成前のパラメータログ
    Logger.debug(`ターミナル作成パラメータ: name=${terminalOptions.name}, splitTerminal=${splitTerminal}`);
    
    // ターミナルオブジェクトを作成
    let terminal: vscode.Terminal;
    
    if (splitTerminal && vscode.window.activeTerminal) {
      // アクティブなターミナルがある場合は、分割ターミナルを作成
      try {
        Logger.info('アクティブなターミナルを分割して新しいターミナルを作成します');
        
        // 既存のアクティブターミナルがフォーカスされた状態にする
        vscode.window.activeTerminal.show(true);
        
        // 分割コマンドを実行
        await vscode.commands.executeCommand('workbench.action.terminal.split');
        
        // 分割後のターミナルは自動的にアクティブになるため、それを使用
        terminal = vscode.window.activeTerminal;
        
        // 少し遅延してから操作（初期化時間を考慮）
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 確実に分割されたターミナルが表示されるようにする
        terminal.show(true);
        
        Logger.info('ターミナル分割に成功しました');
      } catch (error) {
        Logger.error('ターミナル分割中にエラーが発生しました', error as Error);
        // エラーが発生した場合は通常のターミナルを作成
        terminal = vscode.window.createTerminal(terminalOptions);
        terminal.show(true);
      }
    } else {
      // アクティブなターミナルがない場合は通常のターミナルを作成
      terminal = vscode.window.createTerminal(terminalOptions);
      terminal.show(true);
    }
    
    if (splitTerminal && vscode.window.activeTerminal) {
      Logger.info(`アクティブなターミナルを分割して新しいターミナルを作成しました: ${terminalOptions.name || 'unnamed'}`);
    } else {
      Logger.info(`新しいターミナルタブを作成しました: ${terminalOptions.name || 'unnamed'}`);
    }
    
    // ClaudeCode起動カウンターイベントを発行（ターミナル作成時に必ず発行）
    try {
      Logger.info('【ClaudeCode起動カウンター】ターミナル作成時のカウントイベントを発行します');
      
      // ここで直接ユーザーIDを取得してイベントに含める
      const SimpleAuthService = require('../../core/auth/SimpleAuthService').SimpleAuthService;
      const authService = SimpleAuthService.getInstance();
      
      // 特定のユーザーIDを固定値として使用（もしシラン.タツヤさんのIDが分かっていれば）
      const userId = "67e207d18ccc8aab3e3b6a8f"; // シラン.タツヤさんのID
      
      const eventBus = AppGeniusEventBus.getInstance();
      eventBus.emit(
        AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
        { 
          terminalName: terminalOptions.name, 
          promptType, 
          cwd,
          userId: userId, // 重要: ユーザーIDをイベントデータに含める
          splitTerminal // 分割ターミナル情報も追加
        },
        'TerminalProvisionService'
      );
      Logger.info(`【ClaudeCode起動カウンター】ターミナル作成時のカウントイベントを発行しました (ユーザーID: ${userId})`);
    } catch (error) {
      Logger.error('【ClaudeCode起動カウンター】イベント発行中にエラーが発生しました:', error as Error);
    }
    
    // 環境設定を適用
    // 分割ターミナルの場合は少し遅延を入れて環境設定を適用（初期化の時間を考慮）
    if (splitTerminal && vscode.window.activeTerminal) {
      // 分割ターミナルの場合は少し長めの遅延を入れる
      await new Promise(resolve => setTimeout(resolve, 500));
      this.setupTerminalEnvironment(terminal, cwd);
    } else {
      this.setupTerminalEnvironment(terminal, cwd);
    }
    
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
    
    // 日本語プロンプトとファイル読み込み要求を含むコマンドを生成
    return `${baseCommand} "${fileArg}日本語で対応してください。${fileArg}これをReadツールを使って読み込む許可をもらうところから始めてください${params}"`;
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