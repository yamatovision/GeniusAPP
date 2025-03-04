import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { v4 as uuidv4 } from 'uuid';
import { LogLevel, ScopeData } from '../types';
import { logger } from '../utils/logger';
import { configManager } from '../utils/configManager';
import { InteractiveSession } from '../services/interactiveSession';
import { progressService } from '../services/progressService';
import { ClaudeService, ClaudeModel } from '../services/claudeService';
import { ScopeExporter } from '../utils/scopeExporter';

/**
 * コマンドの登録とコマンドライン引数の処理を行う
 */
export function registerCommands(program: Command): void {
  // グローバルオプション
  program
    .version('0.1.0')
    .description('AppGenius CLI - AIによる開発支援ツール')
    .option('-d, --debug', 'デバッグモードを有効化', false)
    .option('-p, --project <path>', 'プロジェクトルートパスを指定')
    .option('-k, --api-key <key>', 'Claude APIキーを設定')
    .option('-l, --language <lang>', '言語設定 (ja:日本語, en:英語)', 'ja');
  
  // configコマンド - 設定の管理
  program
    .command('config')
    .description('設定を表示・変更する')
    .option('--show', '現在の設定を表示')
    .option('--set-api-key <key>', 'Claude APIキーを設定')
    .option('--set-project <path>', 'デフォルトのプロジェクトパスを設定')
    .option('--set-log-level <level>', 'ログレベルを設定 (debug, info, warn, error)')
    .option('--set-language <lang>', '言語設定を変更 (ja:日本語, en:英語)')
    .action(async (options) => {
      try {
        // オプションがない場合はインタラクティブモード
        if (!options.show && !options.setApiKey && !options.setProject && !options.setLogLevel && !options.setLanguage) {
          await configInteractive();
          return;
        }
        
        // 現在の設定を表示
        if (options.show) {
          showConfig();
        }
        
        // API Keyの設定
        if (options.setApiKey) {
          configManager.setApiKey(options.setApiKey);
          console.log(chalk.green('Claude APIキーを設定しました'));
        }
        
        // プロジェクトパスの設定
        if (options.setProject) {
          // パスの存在確認
          if (!fs.existsSync(options.setProject)) {
            console.error(chalk.red(`指定されたパスが存在しません: ${options.setProject}`));
            return;
          }
          
          configManager.setProjectRoot(options.setProject);
          console.log(chalk.green(`デフォルトプロジェクトパスを設定しました: ${options.setProject}`));
        }
        
        // ログレベルの設定
        if (options.setLogLevel) {
          const level = options.setLogLevel.toLowerCase();
          
          if (!['debug', 'info', 'warn', 'error'].includes(level)) {
            console.error(chalk.red('無効なログレベルです。debug, info, warn, errorのいずれかを指定してください'));
            return;
          }
          
          configManager.setLogLevel(level as LogLevel);
          logger.setLogLevel(level as LogLevel);
          console.log(chalk.green(`ログレベルを設定しました: ${level}`));
        }
        
        // 言語設定
        if (options.setLanguage) {
          const lang = options.setLanguage.toLowerCase();
          
          if (!['ja', 'en'].includes(lang)) {
            console.error(chalk.red('無効な言語設定です。"ja"(日本語)または"en"(英語)を指定してください'));
            return;
          }
          
          // 設定の初期化
          const config = configManager.getConfig();
          if (!config.userPreferences) {
            configManager.updateConfig({ userPreferences: { language: lang } });
          } else {
            config.userPreferences.language = lang;
            configManager.saveConfig();
          }
          
          console.log(chalk.green(`言語設定を変更しました: ${lang === 'ja' ? '日本語' : '英語'}`));
        }
      } catch (error) {
        logger.error('設定コマンドの実行中にエラーが発生しました', error as Error);
        console.error(chalk.red('エラーが発生しました:'), (error as Error).message);
      }
    });
  
  // chatコマンド - インタラクティブチャット
  program
    .command('chat')
    .description('AIとのインタラクティブなチャットセッションを開始')
    .option('-m, --model <model>', 'Claude AIモデルを指定 (opus, sonnet, haiku)', 'sonnet')
    .option('-s, --scope <file>', 'スコープファイルを指定')
    .option('-p, --project <path>', 'プロジェクトパスを指定')
    .option('--auto-init', '環境変数からスコープとプロジェクトを自動設定', false)
    .allowUnknownOption(true) // VSCodeからの余分な引数を許可
    .action(async (options) => {
      try {
        // グローバルオプションの処理
        handleGlobalOptions(program.opts());
        
        // コマンドライン引数をログに記録
        logger.debug(`chatコマンド実行: 引数=${JSON.stringify(options)}, argv=${JSON.stringify(process.argv)}`);
        
        // 自動初期化モードかチェック
        if (options.autoInit) {
          logger.info('自動初期化モードが有効です');
          
          // 環境変数から値を取得
          const autoProjectPath = process.env.APPGENIUS_PROJECT_PATH;
          const autoScopeFile = process.env.APPGENIUS_SCOPE_FILE;
          const autoCommandsFile = process.env.APPGENIUS_AUTO_COMMANDS;
          
          if (autoProjectPath) {
            logger.info(`環境変数からプロジェクトパスを設定: ${autoProjectPath}`);
            options.project = autoProjectPath;
          }
          
          if (autoScopeFile) {
            logger.info(`環境変数からスコープファイルを設定: ${autoScopeFile}`);
            options.scope = autoScopeFile;
          }
          
          // 自動コマンドファイルが存在する場合、その中身を処理
          if (autoCommandsFile && fs.existsSync(autoCommandsFile)) {
            logger.info(`自動コマンドファイルが見つかりました: ${autoCommandsFile}`);
            // ここではファイルを読み込むだけで、後でInteractiveSessionで処理する
          }
        }
        
        // スコープファイルの読み込み
        let scopeData: ScopeData | undefined;
        if (options.scope) {
          if (!fs.existsSync(options.scope)) {
            console.error(chalk.red(`スコープファイルが見つかりません: ${options.scope}`));
            // 続行する（ユーザーが後でロードする可能性）
          } else {
            try {
              const content = fs.readFileSync(options.scope, 'utf8');
              scopeData = JSON.parse(content);
              console.log(chalk.green(`スコープファイルを読み込みました: ${options.scope}`));
            } catch (error) {
              console.error(chalk.red('スコープファイルの解析に失敗しました'), (error as Error).message);
              // 続行する
            }
          }
        }
        
        // プロジェクトパスの処理
        if (options.project) {
          if (fs.existsSync(options.project)) {
            configManager.setProjectRoot(options.project);
            console.log(chalk.green(`プロジェクトパスを設定しました: ${options.project}`));
          } else {
            console.error(chalk.yellow(`指定されたプロジェクトパスが存在しません: ${options.project}`));
            // 続行する
          }
        }
        
        // モデルの処理
        let model = ClaudeModel.CLAUDE_3_SONNET;
        if (options.model) {
          switch (options.model.toLowerCase()) {
            case 'opus':
              model = ClaudeModel.CLAUDE_3_OPUS;
              break;
            case 'haiku':
              model = ClaudeModel.CLAUDE_3_HAIKU;
              break;
            case 'sonnet':
            default:
              model = ClaudeModel.CLAUDE_3_SONNET;
              break;
          }
        }
        
        // インタラクティブセッションを開始
        const session = new InteractiveSession({
          scopeData,
          systemPrompt: getSessionSystemPrompt(model),
          autoCommandsFile: options.autoInit ? process.env.APPGENIUS_AUTO_COMMANDS : undefined
        });
        
        await session.start();
      } catch (error) {
        logger.error('チャットセッションの実行中にエラーが発生しました', error as Error);
        console.error(chalk.red('エラーが発生しました:'), (error as Error).message);
      }
    });
  
  // scopeコマンド - スコープの管理
  program
    .command('scope')
    .description('実装スコープを管理する')
    .option('--create', '新しいスコープを作成')
    .option('--list', '保存されたスコープを一覧表示')
    .option('--show <id>', '特定のスコープを表示')
    .option('--show-items <id>', 'スコープの選択された実装項目を表示')
    .option('--delete <id>', 'スコープを削除')
    .option('--import <file>', '外部ファイルからスコープをインポート')
    .option('--export <id>', 'スコープをファイルにエクスポート')
    .option('--set-project <path>', 'スコープのプロジェクトパスを設定')
    .option('--to-memory <id>', 'スコープをCLAUDE.mdに保存')
    .option('--from-memory', 'CLAUDE.mdからスコープを読み込み')
    .option('--init-memory', 'CLAUDE.mdテンプレートを作成')
    .action(async (options) => {
      try {
        // グローバルオプションの処理
        handleGlobalOptions(program.opts());
        
        // スコープディレクトリの確保
        const scopeDir = path.join(configManager.getConfig().tempDir, 'scopes');
        if (!fs.existsSync(scopeDir)) {
          fs.mkdirSync(scopeDir, { recursive: true });
        }
        
        // オプションがない場合は一覧表示
        if (!options.create && !options.list && !options.show && !options.showItems && !options.delete 
            && !options.import && !options.export && !options.setProject && !options.toMemory 
            && !options.fromMemory && !options.initMemory) {
          options.list = true;
        }
        
        // スコープ作成
        if (options.create) {
          await createScope(scopeDir);
        }
        
        // スコープ一覧表示
        if (options.list) {
          listScopes(scopeDir);
        }
        
        // 特定のスコープを表示
        if (options.show) {
          showScope(scopeDir, options.show);
        }
        
        // スコープの選択された実装項目を表示
        if (options.showItems) {
          showSelectedItems(scopeDir, options.showItems);
        }
        
        // スコープ削除
        if (options.delete) {
          deleteScope(scopeDir, options.delete);
        }
        
        // スコープインポート
        if (options.import) {
          await importScope(scopeDir, options.import);
        }
        
        // スコープエクスポート
        if (options.export) {
          exportScope(scopeDir, options.export);
        }
        
        // プロジェクトパス設定
        if (options.setProject) {
          await setProjectForScope(scopeDir, options.show, options.setProject);
        }
        
        // スコープをCLAUDE.mdに保存
        if (options.toMemory) {
          await exportScopeToMemory(scopeDir, options.toMemory);
        }
        
        // CLAUDE.mdからスコープを読み込み
        if (options.fromMemory) {
          await importScopeFromMemory();
        }
        
        // CLAUDE.mdテンプレート作成
        if (options.initMemory) {
          await initMemoryTemplate();
        }
      } catch (error) {
        logger.error('スコープコマンドの実行中にエラーが発生しました', error as Error);
        console.error(chalk.red('エラーが発生しました:'), (error as Error).message);
      }
    });
  
  // projectコマンド - プロジェクト情報
  program
    .command('project')
    .description('現在のプロジェクト情報を表示・分析')
    .option('--info', 'プロジェクト情報を表示')
    .option('--analyze', 'プロジェクト構造を分析')
    .action(async (options) => {
      try {
        // グローバルオプションの処理
        handleGlobalOptions(program.opts());
        
        // オプションがない場合は情報表示
        if (!options.info && !options.analyze) {
          options.info = true;
        }
        
        const config = configManager.getConfig();
        const projectRoot = config.projectRoot;
        
        // プロジェクト情報の表示
        if (options.info) {
          showProjectInfo(projectRoot);
        }
        
        // プロジェクト分析
        if (options.analyze) {
          await analyzeProject(projectRoot);
        }
      } catch (error) {
        logger.error('プロジェクトコマンドの実行中にエラーが発生しました', error as Error);
        console.error(chalk.red('エラーが発生しました:'), (error as Error).message);
      }
    });
  
  // デフォルトコマンド（引数なしで実行）
  program
    .action(() => {
      // 引数がない場合はヘルプを表示
      if (process.argv.length <= 2) {
        console.log(chalk.blue('AppGenius CLI') + ' - AIによる開発支援ツール\n');
        program.help();
      }
    });
}

/**
 * グローバルオプションを処理
 */
function handleGlobalOptions(opts: any): void {
  // デバッグモード
  if (opts.debug) {
    logger.setLogLevel(LogLevel.DEBUG);
    logger.debug('デバッグモードが有効化されました');
  }
  
  // プロジェクトルート
  if (opts.project) {
    if (fs.existsSync(opts.project)) {
      configManager.setProjectRoot(opts.project);
    } else {
      console.error(chalk.red(`指定されたプロジェクトパスが存在しません: ${opts.project}`));
      process.exit(1);
    }
  }
  
  // APIキー
  if (opts.apiKey) {
    configManager.setApiKey(opts.apiKey);
    logger.debug('APIキーが設定されました');
  }
  
  // 言語設定
  if (opts.language) {
    const lang = opts.language.toLowerCase();
    if (lang === 'ja' || lang === 'en') {
      if (!configManager.getConfig().userPreferences) {
        configManager.updateConfig({ userPreferences: { language: lang } });
      } else {
        configManager.getConfig().userPreferences.language = lang;
        configManager.saveConfig();
      }
      logger.debug(`言語設定を "${lang}" に設定しました`);
    } else {
      console.error(chalk.yellow(`無効な言語設定です。"ja"または"en"を指定してください。デフォルトの"ja"を使用します。`));
    }
  }
}

/**
 * 現在の設定を表示
 */
function showConfig(): void {
  const config = configManager.getConfig();
  
  console.log(chalk.cyan('\n現在の設定:'));
  console.log(chalk.bold('APIキー:'), config.apiKey ? `${config.apiKey.substring(0, 4)}...${config.apiKey.substring(config.apiKey.length - 4)}` : '未設定');
  console.log(chalk.bold('プロジェクトルート:'), config.projectRoot || '未設定');
  console.log(chalk.bold('ログレベル:'), config.logLevel);
  console.log(chalk.bold('一時ディレクトリ:'), config.tempDir);
  console.log(chalk.bold('言語設定:'), config.userPreferences?.language === 'en' ? '英語 (en)' : '日本語 (ja)');
  console.log('');
}

/**
 * スコープの選択された実装項目を表示
 */
function showSelectedItems(scopeDir: string, scopeId: string): void {
  const filePath = path.join(scopeDir, `${scopeId}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`ID ${scopeId} のスコープが見つかりません`));
    return;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const scopeData = JSON.parse(content) as ScopeData;
    
    console.log(chalk.cyan(`\nスコープ「${scopeData.name}」の選択された実装項目:`));
    
    if (!scopeData.selectedItems || scopeData.selectedItems.length === 0) {
      console.log(chalk.yellow('このスコープには選択された実装項目がありません。'));
      return;
    }
    
    scopeData.selectedItems.forEach((item, index) => {
      console.log(chalk.bold(`\n項目 ${index + 1}:`));
      console.log(chalk.bold('ID:'), item.id || '未設定');
      console.log(chalk.bold('タイトル:'), item.title || '未設定');
    });
    
    console.log(''); // 空行
  } catch (error) {
    console.error(chalk.red('スコープファイルの読み込みに失敗しました'), (error as Error).message);
  }
}

/**
 * 設定の対話型編集
 */
async function configInteractive(): Promise<void> {
  const config = configManager.getConfig();
  
  const actionAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '設定操作を選択してください：',
      choices: [
        { name: '現在の設定を表示', value: 'show' },
        { name: 'APIキーを設定', value: 'apiKey' },
        { name: 'プロジェクトルートを設定', value: 'project' },
        { name: 'ログレベルを設定', value: 'logLevel' },
        { name: '言語設定を変更', value: 'language' },
        { name: '終了', value: 'exit' }
      ]
    }
  ]);
  
  const action = actionAnswers.action as string;
  
  switch (action) {
    case 'show':
      showConfig();
      break;
      
    case 'apiKey':
      const apiKeyAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiKey',
          message: 'Claude APIキーを入力してください：',
          default: config.apiKey || ''
        }
      ]);
      
      const apiKey = apiKeyAnswers.apiKey as string;
      
      if (apiKey) {
        configManager.setApiKey(apiKey);
        console.log(chalk.green('Claude APIキーを設定しました'));
      }
      break;
      
    case 'project':
      const projectPathAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectPath',
          message: 'プロジェクトルートパスを入力してください：',
          default: config.projectRoot || process.cwd()
        }
      ]);
      
      const projectPath = projectPathAnswers.projectPath as string;
      
      if (projectPath) {
        if (!fs.existsSync(projectPath)) {
          console.error(chalk.red(`指定されたパスが存在しません: ${projectPath}`));
        } else {
          configManager.setProjectRoot(projectPath);
          console.log(chalk.green(`プロジェクトルートを設定しました: ${projectPath}`));
        }
      }
      break;
      
    case 'logLevel':
      const logLevelAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'logLevel',
          message: 'ログレベルを選択してください：',
          choices: [
            { name: 'DEBUG - 詳細なデバッグ情報', value: LogLevel.DEBUG },
            { name: 'INFO - 通常の情報ログ', value: LogLevel.INFO },
            { name: 'WARN - 警告のみ', value: LogLevel.WARN },
            { name: 'ERROR - エラーのみ', value: LogLevel.ERROR }
          ],
          default: config.logLevel
        }
      ]);
      
      const logLevel = logLevelAnswers.logLevel as LogLevel;
      
      configManager.setLogLevel(logLevel);
      logger.setLogLevel(logLevel);
      console.log(chalk.green(`ログレベルを設定しました: ${logLevel}`));
      break;
      
    case 'language':
      const languageAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'language',
          message: '言語を選択してください：',
          choices: [
            { name: '日本語', value: 'ja' },
            { name: '英語', value: 'en' }
          ],
          default: config.userPreferences?.language || 'ja'
        }
      ]);
      
      const language = languageAnswers.language as string;
      
      // ユーザー設定の初期化
      if (!config.userPreferences) {
        config.userPreferences = {};
      }
      
      config.userPreferences.language = language;
      configManager.saveConfig();
      console.log(chalk.green(`言語設定を変更しました: ${language === 'ja' ? '日本語' : '英語'}`));
      break;
      
    case 'exit':
      // 何もしない
      break;
  }
}

/**
 * セッション用のシステムプロンプトを取得
 */
function getSessionSystemPrompt(model: ClaudeModel): string {
  // モデルに応じたプロンプトのカスタマイズ
  const modelInfo = model === ClaudeModel.CLAUDE_3_OPUS 
    ? '高精度のClaude 3 Opusモデル'
    : model === ClaudeModel.CLAUDE_3_HAIKU
      ? '高速なClaude 3 Haikuモデル'
      : 'バランスの取れたClaude 3 Sonnetモデル';
  
  // ユーザー設定から言語を取得
  const config = configManager.getConfig();
  const language = config.userPreferences?.language || 'ja'; // デフォルトを日本語に設定
  
  return `あなたはAppGeniusです。ソフトウェア開発に特化したAIアシスタントです。
あなたは${modelInfo}上で実行されています。

ユーザーがタスクを依頼したら：
1. 問題を分解する
2. 明確な説明を提供する
3. 整った構造の慣用的なコードを生成する
4. テストとベストプラクティスのガイダンスを提供する

ファイル操作のためのツールにアクセスでき、ファイルの検索、読み取り、編集ができます。
これらのツールを使用する際は、特にファイルパスに対して正確かつ慎重に扱ってください。

TypeScript、JavaScript、Node.js、ウェブ開発に特に精通していますが、ほとんどのプログラミング言語をサポートできます。
常にクリーンで保守性が高く、効率的なコードの作成を優先してください。

現在の作業ディレクトリ: ${configManager.getConfig().projectRoot}

すべての回答は必ず日本語で行ってください。英語での回答は避けてください。`;
}

/**
 * 新しいスコープを作成
 */
async function createScope(scopeDir: string): Promise<void> {
  // ユーザー入力の取得
  const scopeAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'スコープ名：',
      validate: (input: string) => input.trim() !== '' ? true : '名前を入力してください'
    },
    {
      type: 'input',
      name: 'description',
      message: 'スコープの説明：',
      validate: (input: string) => input.trim() !== '' ? true : '説明を入力してください'
    },
    {
      type: 'input',
      name: 'projectPath',
      message: 'プロジェクトパス：',
      default: configManager.getConfig().projectRoot,
      validate: (input: string) => {
        if (input.trim() === '') return 'パスを入力してください';
        if (!fs.existsSync(input)) return 'パスが存在しません';
        return true;
      }
    },
    {
      type: 'input',
      name: 'requirements',
      message: '要件（カンマ区切り）：',
      default: ''
    }
  ]);
  
  // 型キャストして直接使用
  
  // スコープIDの生成
  const scopeId = uuidv4();
  
  // スコープオブジェクトの作成
  const scopeData: ScopeData = {
    id: scopeId,
    name: scopeAnswers.name as string,
    description: scopeAnswers.description as string,
    projectPath: scopeAnswers.projectPath as string,
    requirements: (scopeAnswers.requirements as string).split(',').map(req => req.trim()).filter(req => req !== '')
  };
  
  // ファイルに保存
  const scopeFilePath = path.join(scopeDir, `${scopeId}.json`);
  fs.writeFileSync(scopeFilePath, JSON.stringify(scopeData, null, 2));
  
  console.log(chalk.green('\nスコープを作成しました：'));
  console.log(chalk.bold('ID:'), scopeId);
  console.log(chalk.bold('名前:'), scopeData.name);
  console.log(chalk.bold('保存先:'), scopeFilePath);
  console.log('');
  
  // スコープを使用するかどうか
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useScope',
      message: '今すぐこのスコープでチャットを開始しますか？',
      default: true
    }
  ]);
  
  const useScope = answers.useScope as boolean;
  
  if (useScope) {
    // インタラクティブセッションを開始
    const session = new InteractiveSession({
      scopeData,
      systemPrompt: getSessionSystemPrompt(ClaudeModel.CLAUDE_3_SONNET)
    });
    
    await session.start();
  }
}

/**
 * 保存されたスコープの一覧を表示
 */
function listScopes(scopeDir: string): void {
  // スコープディレクトリが存在しない場合
  if (!fs.existsSync(scopeDir)) {
    console.log(chalk.yellow('スコープが保存されていません'));
    return;
  }
  
  // JSONファイルの一覧を取得
  const files = fs.readdirSync(scopeDir)
    .filter(file => file.endsWith('.json'));
  
  if (files.length === 0) {
    console.log(chalk.yellow('スコープが保存されていません'));
    return;
  }
  
  console.log(chalk.cyan('\n保存されたスコープ一覧:'));
  
  // 各スコープの情報を表示
  files.forEach(file => {
    try {
      const filePath = path.join(scopeDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const scopeData = JSON.parse(content) as ScopeData;
      
      console.log(chalk.bold('\nID:'), scopeData.id);
      console.log(chalk.bold('名前:'), scopeData.name);
      console.log(chalk.bold('説明:'), scopeData.description);
      console.log(chalk.bold('プロジェクトパス:'), scopeData.projectPath);
      
      // 進捗情報があれば表示
      const progress = progressService.getProgress(scopeData.id);
      if (progress) {
        const statusColor = 
          progress.status === 'completed' ? chalk.green :
          progress.status === 'failed' ? chalk.red :
          chalk.blue;
        
        console.log(chalk.bold('進捗:'), statusColor(`${progress.completed}% (${progress.status})`));
      }
    } catch (error) {
      console.log(chalk.yellow(`[ファイル読み込みエラー: ${file}]`));
    }
  });
  
  console.log(''); // 空行
}

/**
 * 特定のスコープを表示
 */
function showScope(scopeDir: string, scopeId: string): void {
  const filePath = path.join(scopeDir, `${scopeId}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`ID ${scopeId} のスコープが見つかりません`));
    return;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const scopeData = JSON.parse(content) as ScopeData;
    
    console.log(chalk.cyan('\nスコープ情報:'));
    console.log(chalk.bold('ID:'), scopeData.id);
    console.log(chalk.bold('名前:'), scopeData.name);
    console.log(chalk.bold('説明:'), scopeData.description);
    console.log(chalk.bold('プロジェクトパス:'), scopeData.projectPath);
    
    if (scopeData.requirements && scopeData.requirements.length > 0) {
      console.log(chalk.bold('要件:'));
      scopeData.requirements.forEach((req, index) => {
        console.log(`  ${index + 1}. ${req}`);
      });
    }
    
    // 進捗情報があれば表示
    const progress = progressService.getProgress(scopeData.id);
    if (progress) {
      console.log(chalk.bold('\n進捗情報:'));
      console.log(chalk.bold('ステータス:'), progress.status);
      console.log(chalk.bold('完了率:'), `${progress.completed}%`);
      console.log(chalk.bold('現在のタスク:'), progress.currentTask || '情報なし');
      
      if (progress.error) {
        console.log(chalk.bold('エラー:'), chalk.red(progress.error));
      }
    }
    
    console.log(''); // 空行
  } catch (error) {
    console.error(chalk.red('スコープファイルの読み込みに失敗しました'), (error as Error).message);
  }
}

/**
 * スコープを削除
 */
function deleteScope(scopeDir: string, scopeId: string): void {
  const filePath = path.join(scopeDir, `${scopeId}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`ID ${scopeId} のスコープが見つかりません`));
    return;
  }
  
  try {
    // スコープファイルを削除
    fs.unlinkSync(filePath);
    
    // 関連する進捗データを削除
    progressService.removeProgress(scopeId);
    
    console.log(chalk.green(`スコープ ${scopeId} を削除しました`));
  } catch (error) {
    console.error(chalk.red('スコープの削除に失敗しました'), (error as Error).message);
  }
}

/**
 * 外部ファイルからスコープをインポート
 */
async function importScope(scopeDir: string, filePath: string): Promise<void> {
  try {
    // ファイルの存在確認
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`指定されたファイルが見つかりません: ${filePath}`));
      return;
    }
    
    // ファイル内容を読み込み
    const content = fs.readFileSync(filePath, 'utf8');
    let scopeData: ScopeData;
    
    try {
      scopeData = JSON.parse(content);
    } catch (error) {
      console.error(chalk.red('スコープファイルの解析に失敗しました'), (error as Error).message);
      return;
    }
    
    // 必須フィールドの確認
    if (!scopeData.id || !scopeData.name) {
      console.error(chalk.red('無効なスコープデータです。IDと名前は必須です。'));
      return;
    }
    
    // スコープIDが既に存在するか確認
    const existingFilePath = path.join(scopeDir, `${scopeData.id}.json`);
    if (fs.existsSync(existingFilePath)) {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `ID ${scopeData.id} のスコープは既に存在します。上書きしますか？`,
          default: false
        }
      ]);
      
      if (!answers.overwrite) {
        console.log(chalk.yellow('インポートをキャンセルしました'));
        return;
      }
    }
    
    // プロジェクトパスの確認
    if (scopeData.projectPath && !fs.existsSync(scopeData.projectPath)) {
      console.log(chalk.yellow(`プロジェクトパス ${scopeData.projectPath} が存在しません`));
      
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectPath',
          message: '新しいプロジェクトパスを入力してください（空白の場合は現在の値を保持）:',
          default: scopeData.projectPath
        }
      ]);
      
      if (answers.projectPath && answers.projectPath !== scopeData.projectPath) {
        scopeData.projectPath = answers.projectPath;
      }
    }
    
    // スコープファイルを保存
    fs.writeFileSync(existingFilePath, JSON.stringify(scopeData, null, 2));
    
    console.log(chalk.green(`スコープ「${scopeData.name}」をインポートしました`));
    console.log(chalk.bold('ID:'), scopeData.id);
    console.log(chalk.bold('説明:'), scopeData.description || '説明なし');
    console.log(chalk.bold('プロジェクトパス:'), scopeData.projectPath || '未設定');
  } catch (error) {
    console.error(chalk.red('スコープのインポートに失敗しました'), (error as Error).message);
  }
}

/**
 * スコープをファイルにエクスポート
 */
function exportScope(scopeDir: string, scopeId: string): void {
  try {
    const filePath = path.join(scopeDir, `${scopeId}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`ID ${scopeId} のスコープが見つかりません`));
      return;
    }
    
    // ファイル内容を読み込み
    const content = fs.readFileSync(filePath, 'utf8');
    let scopeData: ScopeData;
    
    try {
      scopeData = JSON.parse(content);
    } catch (error) {
      console.error(chalk.red('スコープファイルの解析に失敗しました'), (error as Error).message);
      return;
    }
    
    // エクスポート先のファイル名を生成
    const exportFileName = `scope-${scopeData.name.replace(/\s+/g, '-').toLowerCase()}-${scopeId.substring(0, 8)}.json`;
    const exportFilePath = path.join(process.cwd(), exportFileName);
    
    // ファイルをエクスポート
    fs.writeFileSync(exportFilePath, JSON.stringify(scopeData, null, 2));
    
    console.log(chalk.green(`スコープ「${scopeData.name}」をエクスポートしました`));
    console.log(chalk.bold('エクスポート先:'), exportFilePath);
  } catch (error) {
    console.error(chalk.red('スコープのエクスポートに失敗しました'), (error as Error).message);
  }
}

/**
 * スコープのプロジェクトパスを設定
 */
async function setProjectForScope(scopeDir: string, scopeId: string, projectPath: string): Promise<void> {
  try {
    // scopeIdが指定されていない場合は入力を求める
    if (!scopeId) {
      const files = fs.readdirSync(scopeDir).filter(file => file.endsWith('.json'));
      
      if (files.length === 0) {
        console.error(chalk.red('スコープが見つかりません'));
        return;
      }
      
      const scopeChoices = await Promise.all(files.map(async file => {
        const filePath = path.join(scopeDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const scopeData = JSON.parse(content) as ScopeData;
        
        return {
          name: `${scopeData.name} (${scopeData.id})`,
          value: scopeData.id
        };
      }));
      
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'scopeId',
          message: 'プロジェクトパスを設定するスコープを選択してください:',
          choices: scopeChoices
        }
      ]);
      
      scopeId = answers.scopeId;
    }
    
    const filePath = path.join(scopeDir, `${scopeId}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`ID ${scopeId} のスコープが見つかりません`));
      return;
    }
    
    // ディレクトリの存在確認
    if (!fs.existsSync(projectPath)) {
      console.error(chalk.red(`指定されたプロジェクトパスが存在しません: ${projectPath}`));
      return;
    }
    
    // ディレクトリかどうかチェック
    if (!fs.statSync(projectPath).isDirectory()) {
      console.error(chalk.red(`指定されたパスはディレクトリではありません: ${projectPath}`));
      return;
    }
    
    // スコープファイルを読み込み
    const content = fs.readFileSync(filePath, 'utf8');
    const scopeData = JSON.parse(content) as ScopeData;
    
    // プロジェクトパスを更新
    scopeData.projectPath = projectPath;
    
    // ファイルを保存
    fs.writeFileSync(filePath, JSON.stringify(scopeData, null, 2));
    
    console.log(chalk.green(`スコープ「${scopeData.name}」のプロジェクトパスを更新しました`));
    console.log(chalk.bold('新しいプロジェクトパス:'), projectPath);
  } catch (error) {
    console.error(chalk.red('プロジェクトパスの設定に失敗しました'), (error as Error).message);
  }
}

/**
 * プロジェクト情報を表示
 */
function showProjectInfo(projectRoot: string): void {
  try {
    // プロジェクトの基本情報
    const stats = fs.statSync(projectRoot);
    const packageJsonPath = path.join(projectRoot, 'package.json');
    
    console.log(chalk.cyan('\nプロジェクト情報:'));
    console.log(chalk.bold('パス:'), projectRoot);
    console.log(chalk.bold('最終更新:'), stats.mtime.toLocaleString());
    console.log(chalk.bold('サイズ:'), `${Math.round(stats.size / 1024)} KB`);
    
    // package.jsonがある場合はプロジェクト詳細を表示
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      console.log(chalk.bold('\nプロジェクト名:'), packageJson.name || '未設定');
      console.log(chalk.bold('バージョン:'), packageJson.version || '未設定');
      console.log(chalk.bold('説明:'), packageJson.description || '未設定');
      
      if (packageJson.scripts) {
        console.log(chalk.bold('\n利用可能なスクリプト:'));
        Object.entries(packageJson.scripts).forEach(([name, script]) => {
          console.log(`  ${name}: ${script}`);
        });
      }
    }
    
    console.log(''); // 空行
  } catch (error) {
    console.error(chalk.red('プロジェクト情報の取得に失敗しました'), (error as Error).message);
  }
}

/**
 * プロジェクト構造を分析
 */
async function analyzeProject(projectRoot: string): Promise<void> {
  // Claude AIサービスを初期化
  const claude = new ClaudeService({
    systemPrompt: `あなたはプロジェクト分析者です。ソフトウェアプロジェクトの構造と特性を分析するのがあなたの任務です。
以下の点に焦点を当ててください：
1. プロジェクトの種類とアーキテクチャ
2. 主要な技術とフレームワーク
3. コードの構成
4. 主要なコンポーネントとそれらの関係性

分析は簡潔で実用的なものにしてください。パターン、ベストプラクティス、そして改善の可能性がある領域を強調してください。
必ず日本語で応答してください。`
  });
  
  try {
    console.log(chalk.cyan('\nプロジェクト分析を開始しています...'));
    
    // プロジェクト構造の情報を収集
    const entries = walkSync(projectRoot, { 
      maxDepth: 3,
      ignore: ['node_modules', '.git', 'dist', 'build', 'coverage']
    });
    
    const projectSummary = `
Project Path: ${projectRoot}

Key directories and files:
${entries.slice(0, 30).join('\n')}
${entries.length > 30 ? `\n... and ${entries.length - 30} more files/directories` : ''}

This is a software project that I need you to analyze. Based on the directory structure above, please provide:
1. A brief summary of what type of project this appears to be
2. The likely main technologies/frameworks being used
3. The general architecture/code organization pattern
4. Suggestions for how this project might be organized for better maintainability (if applicable)

Keep your analysis concise and practical.
`;
    
    // AIに分析を依頼
    const analysisResponse = await claude.sendMessage(projectSummary);
    
    console.log(chalk.cyan('\nプロジェクト分析結果:'));
    console.log(analysisResponse);
    console.log(''); // 空行
  } catch (error) {
    console.error(chalk.red('プロジェクト分析に失敗しました'), (error as Error).message);
  }
}

/**
 * ディレクトリを再帰的に読み込む
 */
function walkSync(
  dir: string, 
  options: { maxDepth?: number; depth?: number; ignore?: string[]; results?: string[] } = {}
): string[] {
  const depth = options.depth || 0;
  const maxDepth = options.maxDepth || Infinity;
  const ignore = options.ignore || [];
  const results = options.results || [];
  
  if (depth > maxDepth) {
    return results;
  }
  
  // ディレクトリの内容を読み込み
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    // 無視リストにあるものはスキップ
    if (ignore.some(pattern => file.includes(pattern))) {
      return;
    }
    
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    // 相対パスを追加
    const relativePath = path.relative(path.dirname(dir), fullPath);
    results.push(relativePath);
    
    // ディレクトリの場合は再帰
    if (stat && stat.isDirectory()) {
      walkSync(fullPath, { maxDepth, depth: depth + 1, ignore, results });
    }
  });
  
  return results;
}

/**
 * スコープをCLAUDE.mdにエクスポート
 */
async function exportScopeToMemory(scopeDir: string, scopeId: string): Promise<void> {
  try {
    const filePath = path.join(scopeDir, `${scopeId}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`ID ${scopeId} のスコープが見つかりません`));
      return;
    }
    
    // スコープを読み込み
    const content = fs.readFileSync(filePath, 'utf8');
    const scopeData = JSON.parse(content) as ScopeData;
    
    // ScopeExporterインスタンスを取得
    const scopeExporter = ScopeExporter.getInstance();
    
    // メモリファイルのパスを決定
    const config = configManager.getConfig();
    const memoryPath = path.join(config.projectRoot, 'CLAUDE.md');
    
    // エクスポート実行
    const success = scopeExporter.exportScopeToMemory(scopeData, memoryPath);
    
    if (success) {
      console.log(chalk.green(`スコープ「${scopeData.name}」をCLAUDE.mdにエクスポートしました`));
      console.log(chalk.bold('CLAUDE.mdパス:'), memoryPath);
      
      // 各セクションが存在するか確認し、存在しない場合はテンプレートから作成
      const memoryContent = fs.readFileSync(memoryPath, 'utf8');
      
      if (!memoryContent.includes('## Requirements') && scopeData.requirements) {
        const requirementsContent = scopeData.requirements.map((req, i) => `${i+1}. ${req}`).join('\n');
        scopeExporter.updateMemorySection('Requirements', requirementsContent, memoryPath);
      }
      
      if (!memoryContent.includes('## Directory Structure')) {
        scopeExporter.updateMemorySection('Directory Structure', '現在のプロジェクト構造を解析中...', memoryPath);
      }
      
      if (!memoryContent.includes('## Mockups')) {
        scopeExporter.updateMemorySection('Mockups', 'プロジェクトモックアップを設定してください。', memoryPath);
      }
      
      if (!memoryContent.includes('## Coding Conventions')) {
        scopeExporter.updateMemorySection('Coding Conventions', '- クラス名: PascalCase\n- メソッド名: camelCase\n- 変数名: camelCase\n- 定数: UPPER_SNAKE_CASE', memoryPath);
      }
      
      console.log(chalk.green('CLAUDE.mdの基本セクションを初期化しました'));
    } else {
      console.error(chalk.red('CLAUDE.mdへのエクスポートに失敗しました'));
    }
  } catch (error) {
    console.error(chalk.red('スコープのCLAUDE.mdへのエクスポートに失敗しました'), (error as Error).message);
  }
}

/**
 * CLAUDE.mdからスコープを読み込み
 */
async function importScopeFromMemory(): Promise<void> {
  try {
    // ScopeExporterインスタンスを取得
    const scopeExporter = ScopeExporter.getInstance();
    
    // メモリファイルのパスを決定
    const config = configManager.getConfig();
    const memoryPath = path.join(config.projectRoot, 'CLAUDE.md');
    
    if (!fs.existsSync(memoryPath)) {
      console.error(chalk.red(`CLAUDE.mdファイルが見つかりません: ${memoryPath}`));
      
      // テンプレート作成を提案
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'createTemplate',
          message: 'CLAUDE.mdテンプレートを作成しますか？',
          default: true
        }
      ]);
      
      if (answers.createTemplate) {
        await initMemoryTemplate();
      }
      
      return;
    }
    
    // CLAUDE.mdからスコープをインポート
    const scopeData = scopeExporter.importScopeFromMemory(memoryPath);
    
    if (!scopeData) {
      console.error(chalk.red('CLAUDE.mdからスコープ情報を抽出できませんでした'));
      return;
    }
    
    // スコープディレクトリを確保
    const scopeDir = path.join(config.tempDir, 'scopes');
    if (!fs.existsSync(scopeDir)) {
      fs.mkdirSync(scopeDir, { recursive: true });
    }
    
    // スコープをファイルに保存
    const filePath = path.join(scopeDir, `${scopeData.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(scopeData, null, 2));
    
    console.log(chalk.green('CLAUDE.mdからスコープを読み込みました:'));
    console.log(chalk.bold('ID:'), scopeData.id);
    console.log(chalk.bold('名前:'), scopeData.name);
    console.log(chalk.bold('説明:'), scopeData.description);
    console.log(chalk.bold('プロジェクトパス:'), scopeData.projectPath);
    console.log(chalk.bold('スコープファイル:'), filePath);
    
    // チャットを開始するか確認
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'startChat',
        message: 'このスコープでチャットを開始しますか？',
        default: true
      }
    ]);
    
    if (answers.startChat) {
      // インタラクティブセッションを開始
      const session = new InteractiveSession({
        scopeData,
        systemPrompt: getSessionSystemPrompt(ClaudeModel.CLAUDE_3_SONNET_20250219)
      });
      
      await session.start();
    }
  } catch (error) {
    console.error(chalk.red('CLAUDE.mdからのスコープ読み込みに失敗しました'), (error as Error).message);
  }
}

/**
 * CLAUDE.mdテンプレートを作成
 */
async function initMemoryTemplate(): Promise<void> {
  try {
    // プロジェクト名を入力
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'プロジェクト名を入力してください:',
        default: path.basename(configManager.getConfig().projectRoot)
      }
    ]);
    
    const projectName = answers.projectName;
    
    // ScopeExporterインスタンスを取得
    const scopeExporter = ScopeExporter.getInstance();
    
    // テンプレートを生成
    const template = scopeExporter.generateMemoryTemplate(
      projectName, 
      configManager.getConfig().projectRoot
    );
    
    // メモリファイルのパスを決定
    const config = configManager.getConfig();
    const memoryPath = path.join(config.projectRoot, 'CLAUDE.md');
    
    // 既存ファイルの確認
    if (fs.existsSync(memoryPath)) {
      const confirmAnswers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'CLAUDE.mdファイルは既に存在します。上書きしますか？',
          default: false
        }
      ]);
      
      if (!confirmAnswers.overwrite) {
        console.log(chalk.yellow('テンプレート作成をキャンセルしました'));
        return;
      }
    }
    
    // テンプレートをファイルに書き込み
    fs.writeFileSync(memoryPath, template);
    
    console.log(chalk.green('CLAUDE.mdテンプレートを作成しました:'));
    console.log(chalk.bold('パス:'), memoryPath);
    console.log(chalk.gray('このファイルを編集してプロジェクト情報を設定してください'));
  } catch (error) {
    console.error(chalk.red('CLAUDE.mdテンプレートの作成に失敗しました'), (error as Error).message);
  }
}