import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as marked from 'marked';
import TerminalRenderer from 'marked-terminal';
import terminalLink from 'terminal-link';
import { AIMessage, ScopeData, Tool } from '../types';
import { logger } from '../utils/logger';
import { ClaudeService } from './claudeService';
import { progressService } from './progressService';
import { configManager } from '../utils/configManager';

const execAsync = promisify(exec);

// マークダウンレンダラーの設定
marked.marked.setOptions({
  renderer: new TerminalRenderer({
    code: chalk.cyan,
    blockquote: chalk.gray.italic,
    table: chalk.white,
    listitem: chalk.yellow,
    strong: chalk.bold,
    em: chalk.italic,
    heading: chalk.bold.underline.magenta,
    link: chalk.blue.underline,
    href: terminalLink
  })
});

import { 
  AgentTool, 
  BashTool, 
  BatchEditTool,
  BatchReplaceTool,
  EditTool, 
  GlobTool, 
  GrepTool, 
  LSTool, 
  NotebookEditCellTool, 
  ReadNotebookTool, 
  RefactorTool,
  ReplaceTool, 
  ViewTool 
} from '../tools/fileTools';
import { MessageBroker, MessageType } from '../utils/messageBroker';

interface InteractiveSessionOptions {
  scopeData?: ScopeData;
  welcome?: string;
  systemPrompt?: string;
  autoCommandsFile?: string;
  memoryFilePath?: string;
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
  private autoCommandsFile?: string;
  private markdownEnabled: boolean = true; // マークダウンレンダリングの有効/無効
  private memoryFilePath: string; // メモリファイルのパス (CLAUDE.md)
  private memoryContent: string = ''; // メモリの内容

  /**
   * コンストラクタ
   */
  constructor(options?: InteractiveSessionOptions) {
    // メモリファイルのパスを設定
    const config = configManager.getConfig();
    this.memoryFilePath = options?.memoryFilePath || path.join(config.projectRoot, 'CLAUDE.md');
    
    // メモリファイルを読み込み
    this.loadMemoryFile();
    
    // Claudeサービスを初期化 - メモリ内容をシステムプロンプトに追加
    let systemPrompt = options?.systemPrompt || '';
    if (this.memoryContent) {
      systemPrompt = this.addMemoryToSystemPrompt(systemPrompt);
    }
    
    this.claudeService = new ClaudeService({
      systemPrompt: systemPrompt
    });
    
    // スコープデータの設定
    this.scopeData = options?.scopeData;
    
    // 自動コマンドファイルの設定
    this.autoCommandsFile = options?.autoCommandsFile;
    
    // ツールの登録
    this.registerTools();
    
    // スピナーの初期化
    this.spinner = ora({
      text: 'AIの応答を待っています...',
      spinner: 'dots'
    });
    
    // 歓迎メッセージ
    this.welcomeMessage = options?.welcome || this.getDefaultWelcomeMessage();
    
    // ユーザー設定の読み込み
    this.loadUserPreferences();
    
    // VSCode連携からスコープを自動取得
    if (!this.scopeData) {
      this.tryAutoImportScope();
    }
    
    // メッセージブローカーを初期化
    this.initializeMessageBroker();
    
    logger.debug('インタラクティブセッションを初期化しました', {
      hasScope: !!this.scopeData,
      hasAutoCommands: !!this.autoCommandsFile,
      markdownEnabled: this.markdownEnabled,
      hasMemory: !!this.memoryContent
    });
  }
  
  /**
   * メモリファイル (CLAUDE.md) を読み込む
   */
  private loadMemoryFile(): void {
    try {
      if (fs.existsSync(this.memoryFilePath)) {
        this.memoryContent = fs.readFileSync(this.memoryFilePath, 'utf8');
        logger.info(`メモリファイルを読み込みました: ${this.memoryFilePath}`);
      } else {
        logger.debug(`メモリファイルが見つかりません: ${this.memoryFilePath}`);
      }
    } catch (error) {
      logger.warn(`メモリファイルの読み込みに失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * メモリ内容をシステムプロンプトに追加 - ClaudeCode互換スタイル
   */
  private addMemoryToSystemPrompt(systemPrompt: string): string {
    // メモリ内容がない場合は元のシステムプロンプトを返す
    if (!this.memoryContent || this.memoryContent.trim() === '') {
      return systemPrompt;
    }
    
    // カテゴリを抽出
    const categories = this.extractCategories(this.memoryContent);
    const hasCategories = Object.keys(categories).length > 0;
    
    // 未分類コンテンツを抽出
    const uncategorizedContent = this.extractUncategorizedContent(this.memoryContent);
    
    // ClaudeCode互換のメモリプロンプト
    let memoryPrompt = `

Here is useful information about the environment you are running in:
<env>
${uncategorizedContent ? uncategorizedContent.trim() : ''}
</env>`;

    // カテゴリ内容があれば追加 (ClaudeCodeスタイルで)
    if (hasCategories) {
      for (const [category, content] of Object.entries(categories)) {
        if (content.trim()) {
          memoryPrompt += `
<context name="${category}">
${content.trim()}
</context>`;
        }
      }
    }

    return systemPrompt + memoryPrompt;
  }
  
  /**
   * ユーザー設定を読み込む
   */
  private loadUserPreferences(): void {
    const config = configManager.getConfig();
    if (config.userPreferences) {
      // マークダウンレンダリング設定
      if (config.userPreferences.markdownEnabled !== undefined) {
        this.markdownEnabled = config.userPreferences.markdownEnabled;
      }
    }
  }
  
  /**
   * VSCode連携からのスコープを自動的にインポート
   */
  private tryAutoImportScope(): void {
    try {
      // ScopeExporterを取得
      const scopeExporter = require('../utils/scopeExporter').ScopeExporter.getInstance();
      
      // PlatformManagerを取得
      const platformManager = require('../utils/platformManager').PlatformManager.getInstance();
      
      // VSCode環境からスコープパスを取得
      const vscodeEnv = platformManager.getVSCodeEnvironment();
      
      // スコープパスが指定されている場合、インポート
      if (vscodeEnv.scopePath && fs.existsSync(vscodeEnv.scopePath)) {
        // スコープをインポート
        const scopeData = scopeExporter.importScope(vscodeEnv.scopePath);
        
        if (scopeData) {
          // スコープデータを設定
          this.setScopeData(scopeData);
          
          logger.info(`自動的にスコープをインポートしました: ${scopeData.name} (${scopeData.id})`);
          
          // プロジェクトパスが設定されているが、VSCode環境のプロジェクトパスと異なる場合は、
          // VSCode環境のプロジェクトパスを優先
          if (vscodeEnv.projectPath && scopeData.projectPath !== vscodeEnv.projectPath) {
            logger.info(`プロジェクトパスを更新します: ${vscodeEnv.projectPath}`);
            
            // スコープのプロジェクトパスを更新
            scopeData.projectPath = vscodeEnv.projectPath;
            
            // スコープを更新
            scopeExporter.updateScope(scopeData);
          }
        }
      }
    } catch (error) {
      logger.warn('スコープの自動インポートに失敗しました', error as Error);
    }
  }
  
  /**
   * メッセージブローカーを初期化
   */
  private initializeMessageBroker(): void {
    try {
      // MessageBrokerを取得
      const messageBroker = MessageBroker.getInstance();
      
      // COMMAND_EXECUTEメッセージを監視
      messageBroker.onMessage(MessageType.COMMAND_EXECUTE, async (message) => {
        try {
          // コマンドを実行
          const command = message.payload.command as string;
          logger.info(`VSCodeからのコマンド実行リクエスト: ${command}`);
          
          // コマンドを処理（非推奨のメソッドのため、handleCommandを使用）
          await this.handleCommand(command);
          
          // メッセージを完了としてマーク
          messageBroker.markMessageAsCompleted(message.id);
        } catch (error) {
          logger.error('コマンド実行中にエラーが発生しました', error as Error);
          
          // メッセージを失敗としてマーク
          messageBroker.markMessageAsFailed(message.id, error as Error);
        }
      });
      
      logger.debug('メッセージブローカーを初期化しました');
    } catch (error) {
      logger.warn('メッセージブローカーの初期化に失敗しました', error as Error);
    }
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
      new LSTool(),
      new AgentTool(),
      new ReplaceTool(),
      new ReadNotebookTool(),
      new NotebookEditCellTool(),
      // 複数ファイル編集関連の新ツール
      new BatchEditTool(),
      new BatchReplaceTool(),
      new RefactorTool()
    ];
    
    this.claudeService.registerTools(tools);
    logger.debug(`${tools.length}個のツールを登録しました`);
  }

  /**
   * スコープデータを設定 - CLAUDE.md 連携対応版
   */
  public setScopeData(scopeData: ScopeData): void {
    this.scopeData = scopeData;
    
    // プロジェクトパスの確認と設定
    if (scopeData.projectPath) {
      // プロジェクトパスをconfigManagerにも設定
      configManager.setProjectRoot(scopeData.projectPath);
      logger.debug(`プロジェクトパスを設定しました: ${scopeData.projectPath}`);
    } else {
      // プロジェクトパスが設定されていない場合は、現在の設定を使用
      const config = configManager.getConfig();
      if (config.projectRoot) {
        scopeData.projectPath = config.projectRoot;
        logger.debug(`スコープにデフォルトのプロジェクトパスを設定: ${config.projectRoot}`);
      }
    }
    
    // 選択された実装項目の確認と処理
    if (scopeData.selectedItems) {
      logger.debug(`選択された実装項目数: ${scopeData.selectedItems.length}`);
      // 各項目がid/titleを持っているか確認
      for (const item of scopeData.selectedItems) {
        if (!item.id && !item.title) {
          logger.warn('選択された実装項目にIDとタイトルが見つかりません');
        }
      }
    } else {
      logger.debug('選択された実装項目がありません');
    }
    
    // スコープ情報をシステムプロンプトに追加
    const currentConversation = this.claudeService.getConversation();
    const systemPrompt = currentConversation[0].content;
    
    let selectedItemsInfo = '';
    if (scopeData.selectedItems && scopeData.selectedItems.length > 0) {
      selectedItemsInfo = '\n選択された実装項目:\n' + 
        scopeData.selectedItems.map((item, index) => {
          const title = item.title || '未設定';
          const id = item.id || '未設定';
          return `${index + 1}. ID: ${id}, タイトル: ${title}`;
        }).join('\n');
    }
    
    const scopeInfo = `
現在のスコープ情報:
ID: ${scopeData.id}
名前: ${scopeData.name}
説明: ${scopeData.description}
プロジェクトパス: ${scopeData.projectPath}
${scopeData.requirements && scopeData.requirements.length > 0 ? `要件: ${scopeData.requirements.join(', ')}` : ''}
${selectedItemsInfo}

上記のスコープに関連するタスクを支援してください。
プロジェクトパスのコードを調査し、選択された実装項目に基づいてコード生成や修正を行ってください。
適切なコーディング規約とアーキテクチャパターンに従って実装してください。`;
    
    this.claudeService.updateSystemPrompt(`${systemPrompt}\n\n${scopeInfo}`);
    
    // CLAUDE.mdファイルにスコープ情報をエクスポート
    try {
      const { ScopeExporter } = require('../utils/scopeExporter');
      const scopeExporter = ScopeExporter.getInstance();
      scopeExporter.exportScopeToMemory(scopeData, this.memoryFilePath);
      
      // メモリファイルを再読み込み
      this.loadMemoryFile();
      
      // 各セクションが存在するか確認し、存在しない場合はテンプレートから作成
      if (fs.existsSync(this.memoryFilePath)) {
        const content = fs.readFileSync(this.memoryFilePath, 'utf8');
        
        if (!content.includes('## Requirements') && scopeData.requirements) {
          const requirementsContent = scopeData.requirements.map((req, i) => `${i+1}. ${req}`).join('\n');
          scopeExporter.updateMemorySection('Requirements', requirementsContent, this.memoryFilePath);
        }
        
        if (!content.includes('## Directory Structure')) {
          scopeExporter.updateMemorySection('Directory Structure', '現在のプロジェクト構造を解析中...', this.memoryFilePath);
        }
        
        if (!content.includes('## Mockups')) {
          scopeExporter.updateMemorySection('Mockups', 'プロジェクトモックアップを設定してください。', this.memoryFilePath);
        }
        
        if (!content.includes('## Coding Conventions')) {
          scopeExporter.updateMemorySection('Coding Conventions', '- クラス名: PascalCase\n- メソッド名: camelCase\n- 変数名: camelCase\n- 定数: UPPER_SNAKE_CASE', this.memoryFilePath);
        }
        
        // メモリファイルを再読み込み
        this.loadMemoryFile();
      }
    } catch (error) {
      logger.warn('CLAUDE.mdへのスコープエクスポートに失敗しました', error as Error);
    }
    
    // 進捗データを作成/更新
    if (scopeData.id) {
      const progress = progressService.getProgress(scopeData.id);
      if (!progress) {
        progressService.createProgress(scopeData);
      } else {
        // 既存の進捗データを更新
        progressService.updateProgress(scopeData.id, {
          status: 'in-progress',
          currentTask: 'スコープ情報が更新されました'
        });
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
    
    // 自動コマンドがある場合は実行
    if (this.autoCommandsFile && fs.existsSync(this.autoCommandsFile)) {
      await this.executeAutoCommands();
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
      // ユーザー設定から言語を取得してプロンプトメッセージをカスタマイズ
      const config = configManager.getConfig();
      const language = config.userPreferences?.language || 'ja';
      
      // スコープ情報と言語に基づいたプロンプト
      const promptPrefix = this.scopeData 
        ? chalk.gray(`[${this.scopeData.name}] `) 
        : '';
      
      // ユーザーからの入力を取得
      const answers: any = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: `${promptPrefix}> `,
          prefix: ''
        }
      ]);
      
      const input = answers.input as string;
      
      // 空の入力をスキップ
      if (!input.trim()) {
        return;
      }
      
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
   * 言語設定を変更する
   */
  private changeLanguage(lang?: string): void {
    // 現在の設定を取得
    const config = configManager.getConfig();
    
    if (!lang) {
      // 現在の言語設定を表示
      const currentLanguage = config.userPreferences?.language || 'ja';
      console.log(chalk.cyan(`現在の言語設定: ${currentLanguage === 'ja' ? '日本語 (ja)' : '英語 (en)'}`));
      console.log(chalk.gray('言語を変更するには: /language ja または /language en'));
      return;
    }
    
    // 小文字に正規化
    const language = lang.toLowerCase();
    
    // 有効な言語コードかチェック
    if (language !== 'ja' && language !== 'en') {
      console.log(chalk.red('サポートされている言語コード: ja (日本語), en (英語)'));
      return;
    }
    
    // ユーザー設定の初期化（まだなければ）
    if (!config.userPreferences) {
      config.userPreferences = {};
    }
    
    // 言語設定を更新
    config.userPreferences.language = language;
    configManager.saveConfig();
    
    // 設定言語に応じたメッセージを表示
    if (language === 'ja') {
      console.log(chalk.green('言語を日本語に設定しました'));
    } else {
      console.log(chalk.green('Language has been set to English'));
    }
    
    // システムプロンプトも更新
    const systemPrompt = this.claudeService.getConversation()[0].content;
    let updatedPrompt = systemPrompt;
    
    // 既存の言語指定を削除
    updatedPrompt = updatedPrompt.replace(/\n(必ず日本語で応答してください.*|すべての回答は必ず日本語で行ってください.*|Please answer in English.*)\.?\n?/g, '');
    
    // 新しい言語指定を追加
    if (language === 'ja') {
      updatedPrompt += '\n\nすべての回答は必ず日本語で行ってください。英語での回答は避けてください。';
    } else {
      updatedPrompt += '\n\nPlease answer in English only.';
    }
    
    // システムプロンプトを更新
    this.claudeService.updateSystemPrompt(updatedPrompt);
  }

  /**
   * コマンドを処理
   */
  private async handleCommand(command: string): Promise<void> {
    // コマンドとパラメータを分離
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const params = parts.slice(1);
    const paramsContent = params.join(' ');
    
    // GitコミットのGit履歴の詳細表示コマンドを追加
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
        
      case '/show-items':
        this.showSelectedItems();
        break;
        
      case '/compact':
        await this.compactConversation();
        break;
        
      case '/language':
        this.changeLanguage(params[0]);
        break;
      
      // 拡張コマンド (ClaudeCode互換)
      case '/explain':
        if (!paramsContent) {
          console.log(chalk.yellow('説明するコードを指定してください'));
          return;
        }
        await this.handleExplainCommand(paramsContent);
        break;
        
      case '/memory':
        await this.handleMemoryCommand(params[0], paramsContent.substring(params[0]?.length || 0).trim());
        break;
        
      case '/improve':
        if (!paramsContent) {
          console.log(chalk.yellow('改善するコードを指定してください'));
          return;
        }
        await this.handleImproveCommand(paramsContent);
        break;
        
      case '/diff':
        if (params.length < 2) {
          console.log(chalk.yellow('比較する2つのファイルを指定してください'));
          return;
        }
        await this.handleDiffCommand(params[0], params[1]);
        break;
        
      case '/extend':
        if (!paramsContent) {
          console.log(chalk.yellow('拡張思考する質問を指定してください'));
          return;
        }
        await this.handleExtendCommand(paramsContent);
        break;
        
      case '/debug':
        if (!paramsContent) {
          console.log(chalk.yellow('デバッグするコードを指定してください'));
          return;
        }
        await this.handleDebugCommand(paramsContent);
        break;
        
      case '/git-history':
        await this.handleGitHistoryCommand(params[0] || '');
        break;
        
      case '/preferences':
        await this.handlePreferencesCommand(params[0], params.slice(1).join(' '));
        break;
        
      case '/markdown':
        this.toggleMarkdownRendering();
        break;
      
      default:
        console.log(chalk.yellow(`未知のコマンド: ${command}`));
        this.showHelp();
        break;
    }
  }
  
  /**
   * コード説明コマンドの処理
   */
  private async handleExplainCommand(code: string): Promise<void> {
    const prompt = `以下のコードを詳細に説明してください。コードの機能、アルゴリズム、設計パターン、パフォーマンス特性など、重要な側面について説明してください。\n\n\`\`\`\n${code}\n\`\`\``;
    await this.handleUserMessage(prompt);
  }
  
  /**
   * コード改善コマンドの処理
   */
  private async handleImproveCommand(code: string): Promise<void> {
    const prompt = `以下のコードを改善する方法を提案してください。可読性、メンテナンス性、パフォーマンス、セキュリティなどの観点から改善点を示し、改善後のコードを提供してください。\n\n\`\`\`\n${code}\n\`\`\``;
    await this.handleUserMessage(prompt);
  }
  
  /**
   * 差分コマンドの処理
   */
  private async handleDiffCommand(fileA: string, fileB: string): Promise<void> {
    try {
      // ファイルの存在確認
      const config = configManager.getConfig();
      const fullPathA = path.isAbsolute(fileA) ? fileA : path.join(config.projectRoot, fileA);
      const fullPathB = path.isAbsolute(fileB) ? fileB : path.join(config.projectRoot, fileB);
      
      if (!fs.existsSync(fullPathA)) {
        console.log(chalk.red(`ファイルが見つかりません: ${fullPathA}`));
        return;
      }
      
      if (!fs.existsSync(fullPathB)) {
        console.log(chalk.red(`ファイルが見つかりません: ${fullPathB}`));
        return;
      }
      
      // ファイル内容を読み込み
      const contentA = await fs.readFile(fullPathA, 'utf8');
      const contentB = await fs.readFile(fullPathB, 'utf8');
      
      // diffコマンドを実行して差分を取得
      const { stdout } = await execAsync(`diff -u "${fullPathA}" "${fullPathB}"`);
      
      const prompt = `以下の2つのファイル間の差分を分析し、重要な変更点を説明してください。
ファイルA: ${fileA}
ファイルB: ${fileB}

差分:
\`\`\`diff
${stdout || '差分なし'}
\`\`\`

ファイルAの内容:
\`\`\`
${contentA}
\`\`\`

ファイルBの内容:
\`\`\`
${contentB}
\`\`\``;
      
      await this.handleUserMessage(prompt);
    } catch (error) {
      console.log(chalk.red(`ファイル差分の取得に失敗しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * 拡張思考コマンドの処理
   */
  private async handleExtendCommand(question: string): Promise<void> {
    const prompt = `以下の問題について拡張思考モードで考えてください。段階的に分析を進め、考慮すべき要素、トレードオフ、代替案などを詳細に検討してください。最終的な結論や推奨事項を含めてください。\n\n問題: ${question}`;
    await this.handleUserMessage(prompt);
  }
  
  /**
   * デバッグコマンドの処理
   */
  private async handleDebugCommand(code: string): Promise<void> {
    const prompt = `以下のコードにあるバグや問題を特定し、デバッグしてください。問題の原因、影響、修正方法について詳細に説明してください。\n\n\`\`\`\n${code}\n\`\`\``;
    await this.handleUserMessage(prompt);
  }
  
  /**
   * メモリコマンドの処理
   */
  private async handleMemoryCommand(action?: string, content?: string): Promise<void> {
    // アクションが指定されていない場合はヘルプを表示
    if (!action) {
      this.showMemoryHelp();
      return;
    }
    
    // コマンドライン引数を解析
    const args = content ? content.split(/\s+/) : [];
    
    switch (action.toLowerCase()) {
      case 'show':
        // 引数がある場合はカテゴリ指定として扱う
        if (args.length > 0) {
          this.showMemoryCategory(args[0]);
        } else {
          // メモリの内容を表示
          this.showMemoryContent();
        }
        break;
        
      case 'add':
        // カテゴリ指定とコンテンツを分離
        if (args.length === 0) {
          console.log(chalk.yellow('追加する内容を指定してください'));
          return;
        } else if (args.length === 1) {
          // カテゴリ指定なしの追加
          await this.addToMemory(args[0]);
        } else {
          // カテゴリ指定あり: 最初の引数をカテゴリとして扱い、残りをコンテンツとして扱う
          const category = args[0];
          const categoryContent = args.slice(1).join(' ');
          await this.addToCategoryMemory(category, categoryContent);
        }
        break;
        
      case 'search':
        // メモリ内容を検索
        if (args.length === 0) {
          console.log(chalk.yellow('検索キーワードを指定してください'));
          return;
        }
        this.searchMemory(args.join(' '));
        break;
        
      case 'clear':
        if (args.length > 0) {
          // 特定のカテゴリをクリア
          await this.clearCategoryMemory(args[0]);
        } else {
          // メモリを全てクリア
          await this.clearMemory();
        }
        break;
        
      case 'refresh':
        // メモリを再読み込み
        this.refreshMemory();
        break;
        
      case 'edit':
        // エディタでメモリを編集
        await this.editMemoryFile();
        break;
        
      case 'export':
        // メモリ内容をエクスポート
        if (args.length === 0) {
          console.log(chalk.yellow('エクスポート先のファイルパスを指定してください'));
          return;
        }
        await this.exportMemory(args[0]);
        break;
        
      case 'import':
        // ファイルからメモリ内容をインポート
        if (args.length === 0) {
          console.log(chalk.yellow('インポート元のファイルパスを指定してください'));
          return;
        }
        await this.importMemory(args[0]);
        break;
        
      case 'category':
        // カテゴリ一覧を表示
        this.listMemoryCategories();
        break;
        
      case 'help':
      default:
        this.showMemoryHelp();
        break;
    }
  }
  
  /**
   * メモリコマンドのヘルプを表示
   */
  private showMemoryHelp(): void {
    console.log(chalk.cyan('\nメモリ機能のコマンド:'));
    console.log(chalk.green('/memory show') + ' - メモリの内容を表示');
    console.log(chalk.green('/memory show <カテゴリ>') + ' - 指定したカテゴリのメモリ内容を表示');
    console.log(chalk.green('/memory add <内容>') + ' - メモリに内容を追加');
    console.log(chalk.green('/memory add <カテゴリ> <内容>') + ' - 特定のカテゴリにメモリを追加');
    console.log(chalk.green('/memory search <キーワード>') + ' - メモリ内容を検索');
    console.log(chalk.green('/memory clear') + ' - メモリをクリア');
    console.log(chalk.green('/memory clear <カテゴリ>') + ' - 特定のカテゴリをクリア');
    console.log(chalk.green('/memory refresh') + ' - メモリファイルを再読み込み');
    console.log(chalk.green('/memory edit') + ' - エディタでメモリファイルを編集');
    console.log(chalk.green('/memory export <ファイルパス>') + ' - メモリ内容をファイルにエクスポート');
    console.log(chalk.green('/memory import <ファイルパス>') + ' - ファイルからメモリ内容をインポート');
    console.log(chalk.green('/memory category') + ' - カテゴリ一覧を表示');
    console.log(chalk.green('/memory help') + ' - このヘルプを表示');
    console.log('');
    console.log(chalk.gray('メモリファイルのパス:'), this.memoryFilePath);
    console.log('');
  }
  
  /**
   * カテゴリのセパレータ文字列
   */
  private readonly CATEGORY_SEPARATOR = '## ';
  
  /**
   * メモリの内容を表示
   */
  private showMemoryContent(): void {
    if (!this.memoryContent) {
      console.log(chalk.yellow('メモリは空です'));
      return;
    }
    
    console.log(chalk.cyan('\nメモリの内容:'));
    console.log(marked.marked.parse(this.memoryContent));
    console.log('');
  }
  
  /**
   * 特定のカテゴリのメモリ内容を表示
   */
  private showMemoryCategory(category: string): void {
    if (!this.memoryContent) {
      console.log(chalk.yellow('メモリは空です'));
      return;
    }
    
    // 大文字小文字を無視して正規表現でカテゴリセクションを検索
    const categoryRegex = new RegExp(`${this.CATEGORY_SEPARATOR}\\s*${category}\\s*\n([\\s\\S]*?)(?=${this.CATEGORY_SEPARATOR}|$)`, 'i');
    const match = this.memoryContent.match(categoryRegex);
    
    if (match && match[1]) {
      console.log(chalk.cyan(`\n「${category}」カテゴリの内容:`));
      console.log(marked.marked.parse(match[1].trim()));
      console.log('');
    } else {
      console.log(chalk.yellow(`カテゴリ「${category}」は見つかりません`));
      // カテゴリ一覧を表示
      this.listMemoryCategories();
    }
  }
  
  /**
   * メモリ内容を検索
   */
  private searchMemory(keyword: string): void {
    if (!this.memoryContent) {
      console.log(chalk.yellow('メモリは空です'));
      return;
    }
    
    // 大文字小文字を無視して検索
    const regex = new RegExp(keyword, 'gi');
    
    // 行ごとに検索
    const lines = this.memoryContent.split('\n');
    const matches: { line: number; text: string; category?: string }[] = [];
    let currentCategory = '';
    
    lines.forEach((line, index) => {
      // カテゴリ行かチェック
      if (line.trim().startsWith(this.CATEGORY_SEPARATOR)) {
        currentCategory = line.trim().substring(this.CATEGORY_SEPARATOR.length);
      }
      
      // キーワードが含まれるか確認
      if (line.match(regex)) {
        matches.push({
          line: index + 1,
          text: line,
          category: currentCategory || undefined
        });
      }
    });
    
    if (matches.length === 0) {
      console.log(chalk.yellow(`キーワード「${keyword}」は見つかりませんでした`));
      return;
    }
    
    console.log(chalk.cyan(`\nキーワード「${keyword}」の検索結果: ${matches.length}件`));
    
    // 検索結果をカテゴリごとにグループ化して表示
    const groupedMatches: { [category: string]: { line: number; text: string }[] } = {};
    
    matches.forEach(match => {
      const category = match.category || '(未分類)';
      if (!groupedMatches[category]) {
        groupedMatches[category] = [];
      }
      groupedMatches[category].push({ line: match.line, text: match.text });
    });
    
    // カテゴリごとに結果を表示
    for (const [category, items] of Object.entries(groupedMatches)) {
      console.log(chalk.green(`\n[${category}]:`));
      items.forEach(item => {
        // キーワードをハイライト表示
        const highlightedText = item.text.replace(regex, match => chalk.yellow.bold(match));
        console.log(`  行 ${item.line}: ${highlightedText}`);
      });
    }
    
    console.log('');
  }
  
  /**
   * カテゴリ一覧を表示
   */
  private listMemoryCategories(): void {
    if (!this.memoryContent) {
      console.log(chalk.yellow('メモリは空です'));
      return;
    }
    
    // カテゴリを抽出
    const categoryRegex = new RegExp(`${this.CATEGORY_SEPARATOR}([^\\n]+)`, 'g');
    const categories: string[] = [];
    let match;
    
    while ((match = categoryRegex.exec(this.memoryContent)) !== null) {
      categories.push(match[1].trim());
    }
    
    if (categories.length === 0) {
      console.log(chalk.yellow('カテゴリが定義されていません'));
      return;
    }
    
    console.log(chalk.cyan('\nカテゴリ一覧:'));
    categories.forEach((category, index) => {
      console.log(`${index + 1}. ${chalk.green(category)}`);
    });
    console.log('');
    console.log(chalk.gray('カテゴリの内容を表示するには: /memory show <カテゴリ名>'));
    console.log('');
  }
  
  /**
   * メモリに内容を追加
   */
  private async addToMemory(content: string): Promise<void> {
    try {
      // 追加する内容を整形
      const formattedContent = content.trim();
      
      // 現在のメモリ内容に追加
      const newContent = this.memoryContent
        ? `${this.memoryContent}\n\n${formattedContent}`
        : formattedContent;
      
      // ファイルに書き込み
      await fs.writeFile(this.memoryFilePath, newContent, 'utf8');
      
      // メモリを更新
      this.memoryContent = newContent;
      
      // システムプロンプトを更新
      const systemPrompt = this.claudeService.getConversation()[0].content;
      const updatedSystemPrompt = this.addMemoryToSystemPrompt(systemPrompt.replace(/# Memory File \(CLAUDE\.md\)[\s\S]*?(?=\n\n|$)/g, ''));
      this.claudeService.updateSystemPrompt(updatedSystemPrompt);
      
      console.log(chalk.green('メモリに内容を追加しました'));
    } catch (error) {
      console.log(chalk.red(`メモリへの追加に失敗しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * 特定のカテゴリにメモリ内容を追加
   */
  private async addToCategoryMemory(category: string, content: string): Promise<void> {
    try {
      // 追加する内容を整形
      const formattedContent = content.trim();
      
      // カテゴリ見出しを作成
      const categoryHeading = `${this.CATEGORY_SEPARATOR}${category}`;
      
      // カテゴリが既に存在するか確認
      const categoryRegex = new RegExp(`${this.CATEGORY_SEPARATOR}\\s*${category}\\s*\n`, 'i');
      
      let newContent;
      if (this.memoryContent && categoryRegex.test(this.memoryContent)) {
        // 既存のカテゴリが見つかった場合、そのカテゴリに内容を追加
        const categoryMatch = this.memoryContent.match(new RegExp(`(${this.CATEGORY_SEPARATOR}\\s*${category}\\s*\n[\\s\\S]*?)(?=${this.CATEGORY_SEPARATOR}|$)`, 'i'));
        
        if (categoryMatch) {
          const categoryContent = categoryMatch[1];
          const updatedCategoryContent = `${categoryContent.trim()}\n\n${formattedContent}`;
          newContent = this.memoryContent.replace(categoryContent, updatedCategoryContent);
        } else {
          // カテゴリはあるが内容が取得できない場合（通常はここに来ない）
          newContent = `${this.memoryContent}\n\n${formattedContent}`;
        }
      } else {
        // カテゴリが存在しない場合、新しいカテゴリを作成して追加
        newContent = this.memoryContent
          ? `${this.memoryContent}\n\n${categoryHeading}\n${formattedContent}`
          : `${categoryHeading}\n${formattedContent}`;
      }
      
      // ファイルに書き込み
      await fs.writeFile(this.memoryFilePath, newContent, 'utf8');
      
      // メモリを更新
      this.memoryContent = newContent;
      
      // システムプロンプトを更新
      const systemPrompt = this.claudeService.getConversation()[0].content;
      const updatedSystemPrompt = this.addMemoryToSystemPrompt(systemPrompt.replace(/# Memory File \(CLAUDE\.md\)[\s\S]*?(?=\n\n|$)/g, ''));
      this.claudeService.updateSystemPrompt(updatedSystemPrompt);
      
      console.log(chalk.green(`カテゴリ「${category}」に内容を追加しました`));
    } catch (error) {
      console.log(chalk.red(`カテゴリへのメモリ追加に失敗しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * メモリをクリア
   */
  private async clearMemory(): Promise<void> {
    try {
      // ファイルが存在する場合は空にする
      if (fs.existsSync(this.memoryFilePath)) {
        await fs.writeFile(this.memoryFilePath, '', 'utf8');
      }
      
      // メモリ内容をクリア
      this.memoryContent = '';
      
      // システムプロンプトを更新 - メモリ部分を削除
      const systemPrompt = this.claudeService.getConversation()[0].content;
      const updatedSystemPrompt = systemPrompt.replace(/# Memory File \(CLAUDE\.md\)[\s\S]*?(?=\n\n|$)/g, '').trim();
      this.claudeService.updateSystemPrompt(updatedSystemPrompt);
      
      console.log(chalk.green('メモリをクリアしました'));
    } catch (error) {
      console.log(chalk.red(`メモリのクリアに失敗しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * 特定のカテゴリをクリア
   */
  private async clearCategoryMemory(category: string): Promise<void> {
    try {
      if (!this.memoryContent) {
        console.log(chalk.yellow('メモリは空です'));
        return;
      }
      
      // カテゴリセクションを検索
      const categoryRegex = new RegExp(`(${this.CATEGORY_SEPARATOR}\\s*${category}\\s*\n[\\s\\S]*?)(?=${this.CATEGORY_SEPARATOR}|$)`, 'i');
      const match = this.memoryContent.match(categoryRegex);
      
      if (!match) {
        console.log(chalk.yellow(`カテゴリ「${category}」は見つかりません`));
        return;
      }
      
      // カテゴリセクションを削除
      const newContent = this.memoryContent.replace(match[1], '').trim();
      
      // ファイルに書き込み
      await fs.writeFile(this.memoryFilePath, newContent, 'utf8');
      
      // メモリを更新
      this.memoryContent = newContent;
      
      // システムプロンプトを更新
      const systemPrompt = this.claudeService.getConversation()[0].content;
      const updatedSystemPrompt = this.addMemoryToSystemPrompt(systemPrompt.replace(/# Memory File \(CLAUDE\.md\)[\s\S]*?(?=\n\n|$)/g, ''));
      this.claudeService.updateSystemPrompt(updatedSystemPrompt);
      
      console.log(chalk.green(`カテゴリ「${category}」をクリアしました`));
    } catch (error) {
      console.log(chalk.red(`カテゴリのクリアに失敗しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * メモリファイルを再読み込み
   */
  private refreshMemory(): void {
    // メモリファイルを再読み込み
    this.loadMemoryFile();
    
    // システムプロンプトを更新
    const systemPrompt = this.claudeService.getConversation()[0].content;
    const basePrompt = systemPrompt.replace(/# Memory File \(CLAUDE\.md\)[\s\S]*?(?=\n\n|$)/g, '').trim();
    
    // メモリがある場合のみ追加
    if (this.memoryContent) {
      const updatedSystemPrompt = this.addMemoryToSystemPrompt(basePrompt);
      this.claudeService.updateSystemPrompt(updatedSystemPrompt);
      console.log(chalk.green('メモリを再読み込みしました'));
    } else {
      this.claudeService.updateSystemPrompt(basePrompt);
      console.log(chalk.yellow('メモリファイルが空または存在しません'));
    }
  }
  
  /**
   * エディタでメモリファイルを編集
   */
  private async editMemoryFile(): Promise<void> {
    try {
      // ディレクトリを確認し、必要に応じて作成
      const memoryDir = path.dirname(this.memoryFilePath);
      if (!fs.existsSync(memoryDir)) {
        await fs.mkdirp(memoryDir);
      }
      
      // ファイルが存在しない場合は空ファイルを作成
      if (!fs.existsSync(this.memoryFilePath)) {
        await fs.writeFile(this.memoryFilePath, '', 'utf8');
      }
      
      // OSに応じたエディタコマンドを決定
      let editorCommand = '';
      if (process.platform === 'win32') {
        editorCommand = `notepad "${this.memoryFilePath}"`;
      } else if (process.platform === 'darwin') {
        editorCommand = `open -e "${this.memoryFilePath}"`;
      } else {
        // Linux系は環境変数EDITORを使用、ない場合はnano
        const editor = process.env.EDITOR || 'nano';
        editorCommand = `${editor} "${this.memoryFilePath}"`;
      }
      
      console.log(chalk.cyan('エディタを起動中...'));
      
      // エディタを起動
      const { stdout, stderr } = await execAsync(editorCommand);
      
      if (stderr) {
        console.log(chalk.yellow(`エディタ実行時の警告: ${stderr}`));
      }
      
      // 編集後にメモリを再読み込み
      this.refreshMemory();
      
    } catch (error) {
      console.log(chalk.red(`メモリファイルの編集に失敗しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * メモリ内容をファイルにエクスポート
   */
  private async exportMemory(filePath: string): Promise<void> {
    try {
      if (!this.memoryContent) {
        console.log(chalk.yellow('メモリは空です。エクスポートするデータがありません。'));
        return;
      }
      
      // パスを正規化
      const exportPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(process.cwd(), filePath);
      
      // ディレクトリを確認し、必要に応じて作成
      const exportDir = path.dirname(exportPath);
      if (!fs.existsSync(exportDir)) {
        await fs.mkdirp(exportDir);
      }
      
      // ファイルに書き込み
      await fs.writeFile(exportPath, this.memoryContent, 'utf8');
      
      console.log(chalk.green(`メモリ内容を ${exportPath} にエクスポートしました`));
      
      // エクスポートしたデータのサイズを表示
      const stats = await fs.stat(exportPath);
      const fileSizeKB = Math.round(stats.size / 1024 * 100) / 100;
      console.log(chalk.gray(`エクスポートサイズ: ${fileSizeKB} KB`));
      
      // カテゴリ数をカウント
      const categoryRegex = new RegExp(`${this.CATEGORY_SEPARATOR}([^\\n]+)`, 'g');
      const categoryMatches = this.memoryContent.match(categoryRegex) || [];
      console.log(chalk.gray(`カテゴリ数: ${categoryMatches.length}`));
      
    } catch (error) {
      console.log(chalk.red(`メモリのエクスポートに失敗しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * ファイルからメモリ内容をインポート
   */
  private async importMemory(filePath: string): Promise<void> {
    try {
      // パスを正規化
      const importPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(process.cwd(), filePath);
      
      // ファイルの存在確認
      if (!fs.existsSync(importPath)) {
        console.log(chalk.red(`インポートファイルが見つかりません: ${importPath}`));
        return;
      }
      
      // ファイル内容を読み込み
      const importContent = await fs.readFile(importPath, 'utf8');
      
      if (!importContent.trim()) {
        console.log(chalk.yellow('インポートファイルが空です'));
        return;
      }
      
      // 既存のメモリ内容がある場合は確認
      if (this.memoryContent && this.memoryContent.trim()) {
        // 確認を表示
        console.log(chalk.yellow('既存のメモリ内容があります。インポート方法を選択してください:'));
        
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'インポート方法:',
            choices: [
              { name: '既存のメモリを置き換える', value: 'replace' },
              { name: '既存のメモリに追加する', value: 'append' },
              { name: 'マージする (カテゴリごとに統合)', value: 'merge' },
              { name: 'キャンセル', value: 'cancel' }
            ]
          }
        ]);
        
        if (action === 'cancel') {
          console.log(chalk.gray('インポートをキャンセルしました'));
          return;
        }
        
        // 選択に応じた処理
        let newContent: string;
        
        switch (action) {
          case 'replace':
            // 完全に置き換え
            newContent = importContent;
            break;
            
          case 'append':
            // 単純に追加
            newContent = `${this.memoryContent}\n\n${importContent}`;
            break;
            
          case 'merge':
            // カテゴリごとにマージ
            newContent = await this.mergeMemoryContents(this.memoryContent, importContent);
            break;
            
          default:
            // ここには来ないはず
            console.log(chalk.red('無効な選択です'));
            return;
        }
        
        // ファイルに書き込み
        await fs.writeFile(this.memoryFilePath, newContent, 'utf8');
        
        // メモリを更新
        this.memoryContent = newContent;
        
      } else {
        // 既存のメモリ内容がない場合は単純に置き換え
        await fs.writeFile(this.memoryFilePath, importContent, 'utf8');
        this.memoryContent = importContent;
      }
      
      // システムプロンプトを更新
      const systemPrompt = this.claudeService.getConversation()[0].content;
      const updatedSystemPrompt = this.addMemoryToSystemPrompt(systemPrompt.replace(/# Memory File \(CLAUDE\.md\)[\s\S]*?(?=\n\n|$)/g, ''));
      this.claudeService.updateSystemPrompt(updatedSystemPrompt);
      
      console.log(chalk.green(`メモリ内容を ${importPath} からインポートしました`));
      
      // カテゴリ一覧を表示
      this.listMemoryCategories();
      
    } catch (error) {
      console.log(chalk.red(`メモリのインポートに失敗しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * 2つのメモリ内容をカテゴリごとにマージ
   */
  private async mergeMemoryContents(currentContent: string, importContent: string): Promise<string> {
    // 現在のメモリからカテゴリを抽出
    const currentCategories = this.extractCategories(currentContent);
    
    // インポートするメモリからカテゴリを抽出
    const importCategories = this.extractCategories(importContent);
    
    // 未分類コンテンツを抽出
    const currentUncategorized = this.extractUncategorizedContent(currentContent);
    const importUncategorized = this.extractUncategorizedContent(importContent);
    
    // マージ結果を構築
    let mergedContent = '';
    
    // 1. まず未分類コンテンツをマージ（両方ある場合）
    if (currentUncategorized && importUncategorized) {
      mergedContent += `${currentUncategorized}\n\n${importUncategorized}\n\n`;
    } else if (currentUncategorized) {
      mergedContent += `${currentUncategorized}\n\n`;
    } else if (importUncategorized) {
      mergedContent += `${importUncategorized}\n\n`;
    }
    
    // 2. 全てのカテゴリを結合してマージ
    const allCategoryNames = new Set([
      ...Object.keys(currentCategories),
      ...Object.keys(importCategories)
    ]);
    
    // 各カテゴリを処理
    for (const category of allCategoryNames) {
      const currentCategoryContent = currentCategories[category];
      const importCategoryContent = importCategories[category];
      
      // カテゴリ見出しを追加
      mergedContent += `${this.CATEGORY_SEPARATOR}${category}\n`;
      
      // 両方のカテゴリが存在する場合はマージ
      if (currentCategoryContent && importCategoryContent) {
        mergedContent += `${currentCategoryContent.trim()}\n\n${importCategoryContent.trim()}\n\n`;
      } else if (currentCategoryContent) {
        // 現在のメモリにのみ存在するカテゴリ
        mergedContent += `${currentCategoryContent.trim()}\n\n`;
      } else if (importCategoryContent) {
        // インポートするメモリにのみ存在するカテゴリ
        mergedContent += `${importCategoryContent.trim()}\n\n`;
      }
    }
    
    return mergedContent.trim();
  }
  
  /**
   * メモリ内容からカテゴリとその内容を抽出
   */
  private extractCategories(content: string): { [category: string]: string } {
    const categories: { [category: string]: string } = {};
    
    // カテゴリ見出しを検索
    const categoryRegex = new RegExp(`${this.CATEGORY_SEPARATOR}([^\\n]+)\\n([\\s\\S]*?)(?=${this.CATEGORY_SEPARATOR}|$)`, 'g');
    let match;
    
    while ((match = categoryRegex.exec(content)) !== null) {
      const categoryName = match[1].trim();
      const categoryContent = match[2].trim();
      categories[categoryName] = categoryContent;
    }
    
    return categories;
  }
  
  /**
   * メモリ内容から未分類コンテンツを抽出（最初のカテゴリ見出し前のテキスト）
   */
  private extractUncategorizedContent(content: string): string {
    const firstCategoryIndex = content.indexOf(this.CATEGORY_SEPARATOR);
    
    if (firstCategoryIndex === -1) {
      // カテゴリがない場合は全て未分類
      return content.trim();
    } else if (firstCategoryIndex === 0) {
      // 先頭がカテゴリの場合は未分類なし
      return '';
    } else {
      // 先頭からカテゴリまでが未分類
      return content.substring(0, firstCategoryIndex).trim();
    }
  }
  
  /**
   * Git履歴コマンドの処理
   */
  private async handleGitHistoryCommand(filePath: string): Promise<void> {
    try {
      // gitが利用可能か確認
      try {
        await execAsync('git --version');
      } catch (error) {
        console.log(chalk.red('Gitがインストールされていないか、アクセスできません。'));
        return;
      }
      
      // 現在のディレクトリがgitリポジトリかチェック
      try {
        await execAsync('git rev-parse --is-inside-work-tree');
      } catch (error) {
        console.log(chalk.red('現在のディレクトリはGitリポジトリではありません。'));
        return;
      }
      
      // コマンドとコンテンツを構築
      let gitCommand: string;
      let promptContent: string;
      
      if (filePath) {
        // ファイルパスが指定された場合は、そのファイルの履歴を取得
        const config = configManager.getConfig();
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(config.projectRoot, filePath);
        
        // ファイルの存在確認
        if (!fs.existsSync(fullPath)) {
          console.log(chalk.red(`ファイルが見つかりません: ${fullPath}`));
          return;
        }
        
        // ファイルのGit履歴を取得
        gitCommand = `git log --pretty=format:"%h - %an, %ar : %s" --follow -- "${fullPath}"`;
        const { stdout: commitHistory } = await execAsync(gitCommand);
        
        // ファイルの詳細な変更履歴も取得
        const { stdout: diffStat } = await execAsync(`git log -p --stat -- "${fullPath}" | head -n 100`);
        
        promptContent = `以下のファイルのGit履歴を分析し、主要な変更点、開発の傾向、進化の様子を説明してください。

ファイル: ${filePath}

コミット履歴:
\`\`\`
${commitHistory || 'コミット履歴が見つかりません'}
\`\`\`

詳細な変更（最新の変更のみ）:
\`\`\`
${diffStat || '詳細な変更が見つかりません'}
\`\`\`

このファイルの目的、主な変更点、開発の傾向、および今後の改善点についてアドバイスをお願いします。`;
      } else {
        // リポジトリ全体の分析
        // ブランチ情報
        const { stdout: branchInfo } = await execAsync('git branch -v');
        
        // 最近のコミット履歴
        const { stdout: recentCommits } = await execAsync('git log --pretty=format:"%h - %an, %ar : %s" -n 10');
        
        // コミット統計
        const { stdout: commitStats } = await execAsync('git shortlog -sn --no-merges');
        
        // ファイル変更統計
        const { stdout: fileStats } = await execAsync('git log --stat --oneline -n 5');
        
        promptContent = `このGitリポジトリの全体像を分析し、プロジェクトの構造、開発の傾向、主要な貢献者などについて説明してください。

ブランチ情報:
\`\`\`
${branchInfo || 'ブランチ情報が取得できません'}
\`\`\`

最近のコミット:
\`\`\`
${recentCommits || '最近のコミットが見つかりません'}
\`\`\`

コミット統計（貢献者別）:
\`\`\`
${commitStats || 'コミット統計が取得できません'}
\`\`\`

最近のファイル変更:
\`\`\`
${fileStats || 'ファイル変更情報が取得できません'}
\`\`\`

このリポジトリの開発状況、コード品質、開発プロセスについての分析とアドバイスをお願いします。`;
      }
      
      // プロンプトをAIに送信
      await this.handleUserMessage(promptContent);
    } catch (error) {
      console.log(chalk.red(`Git履歴の取得に失敗しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * 設定管理コマンドの処理
   */
  /**
   * マークダウンレンダリングの切り替え
   */
  private toggleMarkdownRendering(): void {
    this.markdownEnabled = !this.markdownEnabled;
    console.log(chalk.green(`マークダウンレンダリングを${this.markdownEnabled ? '有効' : '無効'}にしました`));
    
    // 設定を保存
    const config = configManager.getConfig();
    if (!config.userPreferences) {
      config.userPreferences = {};
    }
    config.userPreferences.markdownEnabled = this.markdownEnabled;
    configManager.saveConfig();
  }
  
  /**
   * ユーザー設定の管理
   */
  private async handlePreferencesCommand(key?: string, value?: string): Promise<void> {
    const config = configManager.getConfig();
    
    // 設定の初期化
    if (!config.userPreferences) {
      config.userPreferences = {};
    }
    
    // コマンドの種類を判別
    if (!key) {
      // キーが指定されていない場合は現在の設定を表示
      console.log(chalk.cyan('\n現在のユーザー設定:'));
      if (Object.keys(config.userPreferences).length === 0) {
        console.log(chalk.yellow('設定されている項目はありません'));
      } else {
        for (const [k, v] of Object.entries(config.userPreferences)) {
          console.log(chalk.bold(`${k}:`), v);
        }
      }
      
      // 利用可能な設定の表示
      console.log(chalk.cyan('\n利用可能な設定:'));
      console.log(chalk.green('theme') + ' - テーマ (light, dark)');
      console.log(chalk.green('codeStyle') + ' - コードスタイル (standard, prettier, eslint)');
      console.log(chalk.green('tabSize') + ' - タブサイズ (数値)');
      console.log(chalk.green('language') + ' - 言語設定 (ja, en)');
      console.log(chalk.green('streamingEnabled') + ' - ストリーミング有効化 (true, false)');
      console.log(chalk.green('markdownEnabled') + ' - マークダウンレンダリング (true, false)');
      console.log('');
      return;
    }
    
    // 設定の取得
    if (!value) {
      const currentValue = config.userPreferences[key];
      if (currentValue === undefined) {
        console.log(chalk.yellow(`設定 "${key}" は存在しません`));
      } else {
        console.log(chalk.cyan(`${key}:`), currentValue);
      }
      return;
    }
    
    // 設定の更新
    try {
      switch (key) {
        case 'theme':
          if (value !== 'light' && value !== 'dark') {
            console.log(chalk.red('テーマは "light" または "dark" で指定してください'));
            return;
          }
          config.userPreferences.theme = value;
          break;
        
        case 'codeStyle':
          if (value !== 'standard' && value !== 'prettier' && value !== 'eslint') {
            console.log(chalk.red('コードスタイルは "standard", "prettier", "eslint" のいずれかを指定してください'));
            return;
          }
          config.userPreferences.codeStyle = value;
          break;
        
        case 'tabSize':
          const tabSize = parseInt(value, 10);
          if (isNaN(tabSize) || tabSize < 1 || tabSize > 8) {
            console.log(chalk.red('タブサイズは1から8の整数で指定してください'));
            return;
          }
          config.userPreferences.tabSize = tabSize;
          break;
        
        case 'language':
          if (value !== 'ja' && value !== 'en') {
            console.log(chalk.red('言語は "ja" または "en" で指定してください'));
            return;
          }
          config.userPreferences.language = value;
          break;
        
        case 'streamingEnabled':
          if (value !== 'true' && value !== 'false') {
            console.log(chalk.red('ストリーミング設定は "true" または "false" で指定してください'));
            return;
          }
          config.userPreferences.streamingEnabled = value === 'true';
          break;
          
        case 'markdownEnabled':
          if (value !== 'true' && value !== 'false') {
            console.log(chalk.red('マークダウン設定は "true" または "false" で指定してください'));
            return;
          }
          config.userPreferences.markdownEnabled = value === 'true';
          this.markdownEnabled = value === 'true';
          break;
          
        case 'parallelToolExecution':
          if (value !== 'true' && value !== 'false') {
            console.log(chalk.red('並列ツール実行設定は "true" または "false" で指定してください'));
            return;
          }
          config.userPreferences.parallelToolExecution = value === 'true';
          this.claudeService.setParallelToolExecution(value === 'true');
          break;
        
        default:
          console.log(chalk.yellow(`未知の設定キー: ${key}`));
          return;
      }
      
      // 設定を保存
      configManager.saveConfig();
      console.log(chalk.green(`設定 "${key}" を "${value}" に更新しました`));
      
      // ストリーミング設定の場合はClaudeServiceに反映
      if (key === 'streamingEnabled' && this.claudeService) {
        this.claudeService.setStreaming(config.userPreferences.streamingEnabled || false);
        console.log(chalk.gray(`ストリーミング設定を ${config.userPreferences.streamingEnabled ? '有効' : '無効'} にしました`));
      }
    } catch (error) {
      console.log(chalk.red(`設定の更新に失敗しました: ${(error as Error).message}`));
    }
  }
  
  /**
   * 会話履歴を圧縮
   */
  private async compactConversation(): Promise<void> {
    try {
      // スピナーを開始
      this.spinner.start('会話履歴を圧縮中...');
      
      // 現在の会話を取得
      const conversation = this.claudeService.getConversation();
      
      // 会話履歴が短い場合は圧縮不要
      if (conversation.length <= 5) {
        this.spinner.stop();
        console.log(chalk.yellow('会話履歴が短いため、圧縮は不要です'));
        return;
      }
      
      // システムプロンプトを保持
      const systemPrompt = conversation[0];
      
      // 最新のユーザーメッセージと応答を保持するメッセージ数（システムプロンプト除く）
      const keepMessagesCount = 4;
      const recentMessages = conversation.slice(-keepMessagesCount);
      
      // 圧縮メッセージを作成
      const summaryRequest = 'Please summarize our conversation so far in a concise way. Focus on key points and decisions made.';
      const summaryResponse = await this.claudeService.sendMessage(summaryRequest);
      
      // 会話履歴をクリア
      this.claudeService.clearConversation();
      
      // システムプロンプトを復元
      this.claudeService.updateSystemPrompt(systemPrompt.content);
      
      // 会話サマリーをユーザーとアシスタントのメッセージとして追加
      const messages = this.claudeService.getConversation();
      messages.push({ role: 'user', content: 'Let\'s continue our conversation. Here\'s a summary of what we\'ve discussed so far:' });
      messages.push({ role: 'assistant', content: summaryResponse });
      
      // 最新のメッセージを復元
      for (const msg of recentMessages) {
        messages.push(msg);
      }
      
      this.spinner.stop();
      console.log(chalk.green('会話履歴を圧縮しました。続けて会話できます。'));
    } catch (error) {
      this.spinner.stop();
      console.log(chalk.red(`会話履歴の圧縮に失敗しました: ${(error as Error).message}`));
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
    console.log(chalk.green('/compact') + ' - 会話履歴を圧縮して続行する');
    console.log(chalk.green('/language [ja|en]') + ' - 言語設定の表示または変更');
    
    // 拡張コマンド (ClaudeCode互換)
    console.log(chalk.bold('\n拡張コマンド:'));
    console.log(chalk.green('/explain <コード>') + ' - コードの詳細な説明を提供');
    console.log(chalk.green('/improve <コード>') + ' - コードの改善案を提案');
    console.log(chalk.green('/diff <ファイルA> <ファイルB>') + ' - 2つのファイルの差分を表示して説明');
    console.log(chalk.green('/extend <質問>') + ' - 拡張思考モードで体系的に考える');
    console.log(chalk.green('/debug <コード>') + ' - コードのデバッグ支援を提供');
    console.log(chalk.green('/git-history [ファイルパス]') + ' - Gitコミット履歴を分析');
    console.log(chalk.green('/preferences <キー> <値>') + ' - ユーザー設定を管理');
    console.log(chalk.green('/markdown') + ' - マークダウンレンダリングの切り替え');
    console.log(chalk.green('/memory <操作> [内容]') + ' - メモリファイル(CLAUDE.md)を操作');
    
    // スコープ管理コマンド
    console.log(chalk.bold('\nスコープ管理:'));
    console.log(chalk.green('/load-scope <ファイルパス>') + ' - スコープファイルを読み込む');
    console.log(chalk.green('/set-project <プロジェクトパス>') + ' - プロジェクトパスを設定');
    console.log(chalk.green('/show-scope') + ' - 現在のスコープ情報を表示');
    console.log(chalk.green('/list-scopes') + ' - 利用可能なスコープの一覧を表示');
    
    // 進捗管理コマンド
    console.log(chalk.bold('\n進捗管理:'));
    console.log(chalk.green('/progress') + ' - 現在のタスク進捗を表示');
    
    // 実装項目管理
    console.log(chalk.bold('\n実装項目管理:'));
    console.log(chalk.green('/show-items') + ' - 選択された実装項目を表示\n');
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
   * 自動コマンドファイルから読み込んだコマンドを実行
   */
  private async executeAutoCommands(): Promise<void> {
    try {
      if (!this.autoCommandsFile || !fs.existsSync(this.autoCommandsFile)) {
        return;
      }
      
      // ファイルからコマンドを読み込む
      const commands = fs.readFileSync(this.autoCommandsFile, 'utf8').split('\n');
      
      console.log(chalk.cyan('\n自動セットアップを実行しています...'));
      
      // 各コマンドを実行
      for (const command of commands) {
        const trimmedCommand = command.trim();
        
        // 空行やコメント行はスキップ
        if (!trimmedCommand || trimmedCommand.startsWith('#')) {
          continue;
        }
        
        console.log(chalk.green(`コマンド実行: ${trimmedCommand}`));
        
        // コマンドを処理
        await this.handleCommand(trimmedCommand);
      }
      
      console.log(chalk.green('自動セットアップが完了しました\n'));
    } catch (error) {
      logger.error('自動コマンド実行中にエラーが発生しました', error as Error);
      console.error(chalk.red('自動コマンドの実行に失敗しました:'), (error as Error).message);
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
    
    // 選択された項目の数だけ表示（詳細は /show-items で）
    if (this.scopeData.selectedItems && this.scopeData.selectedItems.length > 0) {
      console.log(chalk.bold('\n選択された項目:'), `${this.scopeData.selectedItems.length}件`);
      console.log(chalk.gray('詳細を表示するには /show-items コマンドを使用してください'));
    } else {
      console.log(chalk.bold('\n選択された項目:'), '0件');
    }
    
    console.log(''); // 空行
  }
  
  /**
   * 選択された実装項目を表示
   */
  private showSelectedItems(): void {
    if (!this.scopeData) {
      console.log(chalk.yellow('スコープが設定されていません。/load-scope コマンドでスコープを読み込んでください。'));
      return;
    }
    
    console.log(chalk.cyan(`\nスコープ「${this.scopeData.name}」の選択された実装項目:`));
    
    if (!this.scopeData.selectedItems || this.scopeData.selectedItems.length === 0) {
      console.log(chalk.yellow('このスコープには選択された実装項目がありません。'));
      return;
    }
    
    this.scopeData.selectedItems.forEach((item, index) => {
      console.log(chalk.bold(`\n項目 ${index + 1}:`));
      console.log(chalk.bold('ID:'), item.id || '未設定');
      console.log(chalk.bold('タイトル:'), item.title || '未設定');
    });
    
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
   * エラータイプの説明を取得
   * 
   * @param errorType エラーの種類
   * @returns エラータイプの詳細な説明と対処方法
   */
  private getErrorTypeDescription(errorType: string): string {
    switch (errorType) {
      case 'validation':
        return '入力検証エラー - パラメーターが無効または不足しています。正しい引数を指定して再試行してください。';
      case 'execution':
        return '実行エラー - ツール実行中に問題が発生しました。コマンドやパラメータが正しいことを確認してください。';
      case 'timeout':
        return 'タイムアウト - 実行時間が長すぎました。処理を簡素化するか、より小さな範囲で実行してみてください。';
      case 'permission':
        return '権限エラー - 操作の権限がありません。ファイルの権限設定やアクセス権を確認してください。';
      case 'notFound':
        return '未検出 - 要求されたリソースが見つかりません。パスや名前が正しいことを確認してください。';
      case 'syntax':
        return '構文エラー - コマンドや式の構文が正しくありません。正しい構文で再試行してください。';
      case 'network':
        return 'ネットワークエラー - ネットワーク接続に問題があります。接続状態を確認してください。';
      case 'conflict':
        return '競合エラー - リソースやファイルに競合が発生しています。最新の状態と同期してから再試行してください。';
      case 'limit':
        return '制限エラー - システムやリソースの制限に達しました。使用量を減らすか、より効率的な方法を試してください。';
      case 'unsupported':
        return '未サポートエラー - この操作や機能はサポートされていません。別の方法を検討してください。';
      case 'format':
        return 'フォーマットエラー - データ形式が正しくありません。正しい形式に修正して再試行してください。';
      case 'security':
        return 'セキュリティエラー - セキュリティ上の制約により操作が拒否されました。適切な認証や権限で実行してください。';
      case 'api':
        return 'APIエラー - API呼び出し中にエラーが発生しました。APIの仕様やパラメータを確認してください。';
      case 'compatibility':
        return '互換性エラー - 互換性のない機能やバージョンを使用しています。互換性のあるバージョンを使用してください。';
      case 'unknown':
      default:
        return '不明なエラー - 特定できない問題が発生しました。詳細なエラーメッセージを確認してください。';
    }
  }
  
  /**
   * ユーザーメッセージを処理
   */
  private async handleUserMessage(message: string): Promise<void> {
    try {
      // スピナーを開始
      this.spinner.start();
      
      // ユーザー設定から言語を取得
      const config = configManager.getConfig();
      const language = config.userPreferences?.language || 'ja';
      
      // 言語設定に基づいて指示を追加
      if (language === 'ja' && !message.includes('日本語で') && !message.includes('in Japanese')) {
        // すでに日本語の指示がなければ、追加して強調
        message += '\n\n必ず日本語で回答してください。英語での回答は避けてください。';
      } else if (language === 'en' && !message.includes('in English') && !message.includes('英語で')) {
        // 英語の場合
        message += '\n\nPlease answer in English only.';
      }
      
      // 進捗状態を更新
      this.updateProgress('in-progress', 'AIの応答を生成中...', 10);
      
      // ストリーミングコールバック - メッセージをリアルタイム表示
      let isFirstChunk = true;
      let fullResponseText = '';
      
      // 改良版ストリーミングコールバック - インテリジェントなチャンク処理
      let codeBlockBuffer = '';
      let inCodeBlock = false;
      let codeBlockType = '';
      let lastLineWasEmpty = false;
      
      const streamCallback = (chunk: string) => {
        // 最初のチャンクの場合はヘッダを表示
        if (isFirstChunk) {
          // スピナーを停止
          this.spinner.stop();
          console.log(chalk.blue('\n[AI]:'));
          isFirstChunk = false;
          
          // バッファ初期化
          fullResponseText = '';
          codeBlockBuffer = '';
          inCodeBlock = false;
        }
        
        // チャンクを追加
        fullResponseText += chunk;
                
        // コードブロック検出と特殊処理 (ClaudeCode互換スタイル)
        if (this.markdownEnabled) {
          // コードブロック開始を検出
          if (chunk.includes('```') && !inCodeBlock) {
            const codeBlockStartRegex = /```(\w*)/;
            const match = chunk.match(codeBlockStartRegex);
            if (match) {
              inCodeBlock = true;
              codeBlockType = match[1] || '';
              codeBlockBuffer += chunk;
              return; // バッファリング開始
            }
          }
          
          // コードブロック終了を検出
          if (inCodeBlock && chunk.includes('```')) {
            inCodeBlock = false;
            codeBlockBuffer += chunk;
            
            // 完全なコードブロックをレンダリングして出力
            try {
              const renderedBlock = marked.marked.parse(codeBlockBuffer);
              process.stdout.write(renderedBlock as string);
            } catch (e) {
              // フォールバック: プレーンテキストとして出力
              process.stdout.write(codeBlockBuffer);
            }
            
            // バッファリセット
            codeBlockBuffer = '';
            return;
          }
          
          // コードブロック内ならバッファに追加
          if (inCodeBlock) {
            codeBlockBuffer += chunk;
            return;
          }
          
          // 通常のチャンク出力（コードブロック外）
          process.stdout.write(chunk);
        } else {
          // マークダウン無効時は単純出力
          process.stdout.write(chunk);
        }
      };
      
      // ツール使用検出を有効にしてメッセージを送信（ストリーミングコールバック付き）
      const { responseText, toolResults } = await this.claudeService.detectAndExecuteTools(message, streamCallback);
      
      // ストリーミングが行われなかった場合は通常の表示
      if (isFirstChunk) {
        // スピナーを停止
        this.spinner.stop();
        
        // ツール使用結果のサマリー - ClaudeCodeスタイルの簡潔表示
        if (toolResults.length > 0) {
          // エラーがあるかどうかチェック
          const hasErrors = toolResults.some(result => result.error);
          
          // 成功/エラー状況に応じて表示を変える
          if (hasErrors) {
            // エラーがある場合は詳細表示
            console.log(chalk.yellow(`\n[ツール実行] ${toolResults.length}個のツールを使用 (${toolResults.filter(r => r.error).length}個のエラー)`));
            
            // エラーのあるツールのみ詳細表示
            toolResults.filter(result => result.error).forEach(result => {
              // ツール名とエラー概要
              console.log(chalk.red(`❌ ${result.toolName}: ${result.error}`));
              
              // 重要な提案のみコンパクトに表示
              if (result.suggestions && result.suggestions.length > 0) {
                console.log(chalk.green(`   ヒント: ${result.suggestions[0]}`));
              }
              
              // 自動修正オプションがあれば簡潔に表示
              if (result.retryOptions && result.retryOptions.canRetry) {
                console.log(chalk.blue(`   修正: 再試行可能`));
              }
            });
          } else {
            // 全て成功の場合は極めて簡潔に
            console.log(chalk.gray(`\n[ツール実行] ${toolResults.length}個のツールを正常に実行しました`));
          }
        }
        
        // AIの応答を表示 - マークダウンレンダリングを適用
        console.log(chalk.blue('\n[AI]:'));
        
        // 設定に応じてマークダウンレンダリングを適用するか決定
        if (this.markdownEnabled) {
          // マークダウンとコードハイライトを適用
          console.log(marked.marked.parse(responseText));
        } else {
          // 通常のテキスト表示
          console.log(responseText);
        }
      } else {
        // ストリーミングの場合は改行を追加
        console.log(''); // 空行
      }
      
      console.log(''); // 空行
      
      // 進捗状態を更新
      this.updateProgress('in-progress', '会話継続中', 20);
      // メッセージングシステムへ結果を送信
      try {
        const messageBroker = MessageBroker.getInstance();
        messageBroker.sendResult({
          input: message,
          output: responseText,
          toolsUsed: toolResults.length,
          timestamp: Date.now()
        });
      } catch (error) {
        logger.warn('メッセージング機能の利用に失敗しました', error as Error);
      }
    } catch (error) {
      // スピナーを停止
      this.spinner.stop();
      
      // エラーを記録
      logger.error('AIメッセージの処理中にエラーが発生しました', error as Error);
      
      // 進捗状態を更新（エラー）
      this.updateProgress('failed', `エラーが発生しました: ${(error as Error).message}`, 0);
      
      // エラーメッセージを表示
      console.error(chalk.red('\n[エラー]: AIの応答の取得中に問題が発生しました'));
      console.error(chalk.red((error as Error).message));
      console.log(''); // 空行
    }
  }
  
  /**
   * 進捗状態を更新し、VSCodeに通知
   */
  private updateProgress(status: 'started' | 'in-progress' | 'completed' | 'failed', currentTask: string, completed: number = 0): void {
    try {
      // 進捗サービスを更新
      if (this.scopeData?.id) {
        progressService.updateProgress(this.scopeData.id, {
          status,
          currentTask,
          completed
        });
      }
      
      // メッセージブローカーを通じてVSCodeに通知
      try {
        const messageBroker = MessageBroker.getInstance();
        messageBroker.sendProgressReport(completed, currentTask);
      } catch (error) {
        logger.warn('進捗の通知に失敗しました', error as Error);
      }
    } catch (error) {
      logger.error('進捗の更新に失敗しました', error as Error);
    }
  }
}