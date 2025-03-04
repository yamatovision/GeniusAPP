import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { AIMessage, ScopeData, Tool } from '../types';
import { logger } from '../utils/logger';
import { ClaudeService } from './claudeService';
import { progressService } from './progressService';
import { configManager } from '../utils/configManager';
import { BashTool, EditTool, GlobTool, GrepTool, LSTool, ViewTool } from '../tools/fileTools';

interface InteractiveSessionOptions {
  scopeData?: ScopeData;
  welcome?: string;
  systemPrompt?: string;
}

/**
 * インタラクティブセッションクラス
 * ユーザーとの対話型セッションを管理する
 */
export class InteractiveSession {
  private claudeService: ClaudeService;
  private scopeData?: ScopeData;
  private spinner: ora.Ora;
  private welcomeMessage: string;
  private exitRequested: boolean = false;

  /**
   * コンストラクタ
   */
  constructor(options?: InteractiveSessionOptions) {
    // Claudeサービスを初期化
    this.claudeService = new ClaudeService({
      systemPrompt: options?.systemPrompt
    });
    
    // スコープデータの設定
    this.scopeData = options?.scopeData;
    
    // ツールの登録
    this.registerTools();
    
    // スピナーの初期化
    this.spinner = ora({
      text: 'AIの応答を待っています...',
      spinner: 'dots'
    });
    
    // 歓迎メッセージ
    this.welcomeMessage = options?.welcome || this.getDefaultWelcomeMessage();
    
    logger.debug('インタラクティブセッションを初期化しました');
  }

  /**
   * デフォルトの歓迎メッセージを取得
   */
  private getDefaultWelcomeMessage(): string {
    return chalk.blue('AppGenius AI アシスタントへようこそ！') + '\n' +
      'AIによる開発支援を提供します。以下のコマンドが利用可能です：\n\n' +
      chalk.green('/help') + ' - ヘルプを表示\n' +
      chalk.green('/clear') + ' - 会話履歴をクリア\n' +
      chalk.green('/exit') + ' - セッションを終了\n\n' +
      'どのようにお手伝いしましょうか？';
  }

  /**
   * ツールを登録
   */
  private registerTools(): void {
    const tools: Tool[] = [
      new GlobTool(),
      new GrepTool(),
      new ViewTool(),
      new EditTool(),
      new BashTool(),
      new LSTool()
    ];
    
    this.claudeService.registerTools(tools);
    logger.debug(`${tools.length}個のツールを登録しました`);
  }

  /**
   * スコープデータを設定
   */
  public setScopeData(scopeData: ScopeData): void {
    this.scopeData = scopeData;
    
    // スコープ情報をシステムプロンプトに追加
    const currentConversation = this.claudeService.getConversation();
    const systemPrompt = currentConversation[0].content;
    
    const scopeInfo = `
現在のスコープ情報:
ID: ${scopeData.id}
名前: ${scopeData.name}
説明: ${scopeData.description}
プロジェクトパス: ${scopeData.projectPath}
${scopeData.requirements ? `要件: ${scopeData.requirements.join(', ')}` : ''}

上記のスコープに関連するタスクを支援してください。`;
    
    this.claudeService.updateSystemPrompt(`${systemPrompt}\n\n${scopeInfo}`);
    
    // 進捗データを作成/更新
    if (scopeData.id) {
      const progress = progressService.getProgress(scopeData.id);
      if (!progress) {
        progressService.createProgress(scopeData);
      }
    }
    
    logger.debug('スコープデータを設定しました', scopeData);
  }

  /**
   * セッションを開始
   */
  public async start(): Promise<void> {
    console.log(this.welcomeMessage);
    
    // スコープデータがある場合は設定
    if (this.scopeData) {
      console.log(chalk.cyan('\n現在のスコープ:'), chalk.bold(this.scopeData.name));
      console.log(chalk.cyan('説明:'), this.scopeData.description);
      console.log(chalk.cyan('プロジェクトパス:'), this.scopeData.projectPath);
      console.log('');
    }
    
    // 入力ループを開始
    this.exitRequested = false;
    while (!this.exitRequested) {
      await this.promptInput();
    }
  }

  /**
   * ユーザー入力を促す
   */
  private async promptInput(): Promise<void> {
    try {
      // ユーザーからの入力を取得
      const answers: any = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: '> ',
          prefix: ''
        }
      ]);
      
      const input = answers.input as string;
      
      // コマンドかどうかをチェック
      if (input.startsWith('/')) {
        await this.handleCommand(input);
      } else {
        await this.handleUserMessage(input);
      }
    } catch (error) {
      logger.error('ユーザー入力の処理中にエラーが発生しました', error as Error);
      console.error(chalk.red('エラーが発生しました:'), (error as Error).message);
    }
  }

  /**
   * コマンドを処理
   */
  private async handleCommand(command: string): Promise<void> {
    // コマンドとパラメータを分離
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const params = parts.slice(1);
    
    switch (cmd) {
      case '/help':
        this.showHelp();
        break;
      
      case '/clear':
        this.claudeService.clearConversation();
        console.log(chalk.green('会話履歴をクリアしました'));
        break;
      
      case '/exit':
        this.exitRequested = true;
        console.log(chalk.yellow('セッションを終了します...'));
        break;
      
      case '/history':
        this.showHistory();
        break;
      
      case '/progress':
        this.showProgress();
        break;
      
      case '/load-scope':
        await this.loadScopeFile(params[0]);
        break;
      
      case '/set-project':
        this.setProjectPath(params[0]);
        break;
      
      case '/show-scope':
        this.showCurrentScope();
        break;
      
      case '/list-scopes':
        await this.listAvailableScopes();
        break;
      
      default:
        console.log(chalk.yellow(`未知のコマンド: ${command}`));
        this.showHelp();
        break;
    }
  }

  /**
   * ヘルプを表示
   */
  private showHelp(): void {
    console.log(chalk.cyan('\n利用可能なコマンド:'));
    
    // 基本コマンド
    console.log(chalk.bold('\n基本コマンド:'));
    console.log(chalk.green('/help') + ' - このヘルプメッセージを表示');
    console.log(chalk.green('/clear') + ' - 会話履歴をクリアする');
    console.log(chalk.green('/history') + ' - 会話履歴を表示');
    console.log(chalk.green('/exit') + ' - セッションを終了する');
    
    // スコープ管理コマンド
    console.log(chalk.bold('\nスコープ管理:'));
    console.log(chalk.green('/load-scope <ファイルパス>') + ' - スコープファイルを読み込む');
    console.log(chalk.green('/set-project <プロジェクトパス>') + ' - プロジェクトパスを設定');
    console.log(chalk.green('/show-scope') + ' - 現在のスコープ情報を表示');
    console.log(chalk.green('/list-scopes') + ' - 利用可能なスコープの一覧を表示');
    
    // 進捗管理コマンド
    console.log(chalk.bold('\n進捗管理:'));
    console.log(chalk.green('/progress') + ' - 現在のタスク進捗を表示\n');
  }

  /**
   * スコープファイルを読み込む
   */
  private async loadScopeFile(filePath: string): Promise<void> {
    try {
      if (!filePath) {
        console.log(chalk.yellow('スコープファイルのパスを指定してください'));
        return;
      }
      
      // パスを正規化
      const normalizedPath = path.resolve(filePath);
      
      // ファイルの存在確認
      if (!fs.existsSync(normalizedPath)) {
        console.log(chalk.red(`スコープファイルが見つかりません: ${normalizedPath}`));
        return;
      }
      
      // ファイル内容を読み込み
      try {
        const content = fs.readFileSync(normalizedPath, 'utf8');
        const scopeData = JSON.parse(content) as ScopeData;
        
        // スコープデータを設定
        this.setScopeData(scopeData);
        
        console.log(chalk.green(`スコープを読み込みました: ${scopeData.name || 'Unnamed Scope'}`));
        console.log(chalk.green(`プロジェクトパス: ${scopeData.projectPath || '未設定'}`));
        
        // プロジェクトパスも同時に設定
        if (scopeData.projectPath && fs.existsSync(scopeData.projectPath)) {
          this.setProjectPath(scopeData.projectPath);
        }
      } catch (error) {
        console.log(chalk.red(`スコープファイルの解析に失敗しました: ${(error as Error).message}`));
      }
    } catch (error) {
      console.log(chalk.red(`スコープのロード中にエラーが発生しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * プロジェクトパスを設定
   */
  private setProjectPath(projectPath: string): void {
    try {
      if (!projectPath) {
        console.log(chalk.yellow('プロジェクトパスを指定してください'));
        return;
      }
      
      // パスを正規化
      const normalizedPath = path.resolve(projectPath);
      
      // ディレクトリの存在確認
      if (!fs.existsSync(normalizedPath)) {
        console.log(chalk.red(`指定されたパスが存在しません: ${normalizedPath}`));
        return;
      }
      
      // ディレクトリかどうかチェック
      if (!fs.statSync(normalizedPath).isDirectory()) {
        console.log(chalk.red(`指定されたパスはディレクトリではありません: ${normalizedPath}`));
        return;
      }
      
      // プロジェクトパスを設定
      configManager.setProjectRoot(normalizedPath);
      
      // 現在のスコープにもパスを設定（あれば）
      if (this.scopeData) {
        this.scopeData.projectPath = normalizedPath;
        
        // システムプロンプトを更新
        const currentConversation = this.claudeService.getConversation();
        const systemPrompt = currentConversation[0].content;
        
        // プロジェクトパス部分を更新
        const updatedPrompt = systemPrompt.replace(
          /プロジェクトパス: .*$/m,
          `プロジェクトパス: ${normalizedPath}`
        );
        
        this.claudeService.updateSystemPrompt(updatedPrompt);
      }
      
      console.log(chalk.green(`プロジェクトパスを設定しました: ${normalizedPath}`));
    } catch (error) {
      console.log(chalk.red(`プロジェクトパスの設定中にエラーが発生しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * 現在のスコープ情報を表示
   */
  private showCurrentScope(): void {
    if (!this.scopeData) {
      console.log(chalk.yellow('スコープが設定されていません。/load-scope コマンドでスコープを読み込んでください。'));
      return;
    }
    
    console.log(chalk.cyan('\n現在のスコープ情報:'));
    console.log(chalk.bold('名前:'), this.scopeData.name || 'Unnamed Scope');
    console.log(chalk.bold('説明:'), this.scopeData.description || '説明なし');
    console.log(chalk.bold('プロジェクトパス:'), this.scopeData.projectPath || '未設定');
    
    // 要件一覧（存在する場合）
    if (this.scopeData.requirements && this.scopeData.requirements.length > 0) {
      console.log(chalk.bold('\n要件一覧:'));
      this.scopeData.requirements.forEach((req, index) => {
        console.log(`${index + 1}. ${req}`);
      });
    }
    
    // 選択された項目（存在する場合）
    if (this.scopeData.selectedItems && this.scopeData.selectedItems.length > 0) {
      console.log(chalk.bold('\n選択された項目:'));
      this.scopeData.selectedItems.forEach((item, index) => {
        console.log(`${index + 1}. ${item.title || item.id || `項目${index + 1}`}`);
      });
    }
    
    console.log(''); // 空行
  }
  
  /**
   * 利用可能なスコープの一覧を表示
   */
  private async listAvailableScopes(): Promise<void> {
    try {
      // 一時ディレクトリのパスを取得
      const config = configManager.getConfig();
      const tempDir = path.join(config.tempDir, 'scopes');
      
      // ディレクトリが存在しない場合は作成
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log(chalk.yellow('保存されたスコープが見つかりません'));
        return;
      }
      
      // JSONファイルの一覧を取得
      const files = fs.readdirSync(tempDir).filter(file => file.endsWith('.json'));
      
      if (files.length === 0) {
        console.log(chalk.yellow('保存されたスコープが見つかりません'));
        return;
      }
      
      console.log(chalk.cyan('\n利用可能なスコープ:'));
      
      // 各スコープの情報を表示
      for (const file of files) {
        try {
          const filePath = path.join(tempDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const scopeData = JSON.parse(content) as ScopeData;
          
          console.log(chalk.bold(`\nID: ${scopeData.id}`));
          console.log(chalk.bold('名前:'), scopeData.name || 'Unnamed Scope');
          console.log(chalk.bold('説明:'), scopeData.description || '説明なし');
          console.log(chalk.bold('ファイルパス:'), filePath);
          
          // ロードコマンドを表示
          console.log(chalk.green(`/load-scope ${filePath}`));
        } catch (error) {
          console.log(chalk.red(`スコープファイル ${file} の読み込みに失敗しました`));
        }
      }
      
      console.log(''); // 空行
    } catch (error) {
      console.log(chalk.red(`スコープ一覧の取得中にエラーが発生しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * 会話履歴を表示
   */
  private showHistory(): void {
    const conversation = this.claudeService.getConversation();
    
    console.log(chalk.cyan('\n会話履歴:'));
    
    conversation.forEach((message, index) => {
      if (index === 0 && message.role === 'system') {
        return; // システムプロンプトは表示しない
      }
      
      const roleColor = message.role === 'user' ? chalk.green : chalk.blue;
      const roleText = message.role === 'user' ? 'あなた' : 'AI';
      
      console.log(roleColor(`\n[${roleText}]:`));
      console.log(message.content);
    });
    
    console.log(''); // 空行
  }

  /**
   * 進捗を表示
   */
  private showProgress(): void {
    if (!this.scopeData || !this.scopeData.id) {
      console.log(chalk.yellow('スコープが設定されていないため、進捗情報がありません'));
      return;
    }
    
    const progress = progressService.getProgress(this.scopeData.id);
    
    if (!progress) {
      console.log(chalk.yellow('このスコープの進捗情報はまだ作成されていません'));
      return;
    }
    
    console.log(chalk.cyan('\n現在の進捗:'));
    console.log(chalk.bold('ステータス:'), this.getStatusColor(progress.status)(progress.status));
    console.log(chalk.bold('完了率:'), `${progress.completed}%`);
    console.log(chalk.bold('現在のタスク:'), progress.currentTask || '情報なし');
    
    if (progress.error) {
      console.log(chalk.bold('エラー:'), chalk.red(progress.error));
    }
    
    console.log(''); // 空行
  }

  /**
   * ステータスに応じた色を取得
   */
  private getStatusColor(status: string): chalk.ChalkFunction {
    switch (status) {
      case 'completed':
        return chalk.green;
      case 'failed':
        return chalk.red;
      case 'in-progress':
        return chalk.blue;
      default:
        return chalk.white;
    }
  }

  /**
   * ユーザーメッセージを処理
   */
  private async handleUserMessage(message: string): Promise<void> {
    try {
      // スピナーを開始
      this.spinner.start();
      
      // 進捗を更新
      if (this.scopeData?.id) {
        progressService.updateProgress(this.scopeData.id, {
          status: 'in-progress',
          currentTask: 'AIの応答を生成中...'
        });
      }
      
      // ツール使用検出を有効にしてメッセージを送信
      const { responseText, toolResults } = await this.claudeService.detectAndExecuteTools(message);
      
      // スピナーを停止
      this.spinner.stop();
      
      // 進捗を更新
      if (this.scopeData?.id) {
        progressService.updateProgress(this.scopeData.id, {
          currentTask: '会話継続中'
        });
      }
      
      // ツール使用結果のサマリー
      if (toolResults.length > 0) {
        console.log(chalk.cyan(`\n[AI] ${toolResults.length}個のツールを使用しました:`));
        toolResults.forEach(result => {
          const icon = result.error ? '❌' : '✅';
          console.log(`${icon} ${result.toolName}`);
        });
        console.log('');
      }
      
      // AIの応答を表示
      console.log(chalk.blue('\n[AI]:'));
      console.log(responseText);
      console.log(''); // 空行
    } catch (error) {
      // スピナーを停止
      this.spinner.stop();
      
      // エラーを記録
      logger.error('AIメッセージの処理中にエラーが発生しました', error as Error);
      
      // 進捗を更新
      if (this.scopeData?.id) {
        progressService.updateProgress(this.scopeData.id, {
          currentTask: 'エラーが発生しました',
          error: (error as Error).message
        });
      }
      
      // エラーメッセージを表示
      console.error(chalk.red('\n[エラー]: AIの応答の取得中に問題が発生しました'));
      console.error(chalk.red((error as Error).message));
      console.log(''); // 空行
    }
  }
}