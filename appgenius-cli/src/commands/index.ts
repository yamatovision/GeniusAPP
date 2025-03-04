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
    .option('-k, --api-key <key>', 'Claude APIキーを設定');
  
  // configコマンド - 設定の管理
  program
    .command('config')
    .description('設定を表示・変更する')
    .option('--show', '現在の設定を表示')
    .option('--set-api-key <key>', 'Claude APIキーを設定')
    .option('--set-project <path>', 'デフォルトのプロジェクトパスを設定')
    .option('--set-log-level <level>', 'ログレベルを設定 (debug, info, warn, error)')
    .action(async (options) => {
      try {
        // オプションがない場合はインタラクティブモード
        if (!options.show && !options.setApiKey && !options.setProject && !options.setLogLevel) {
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
    .allowUnknownOption(true) // VSCodeからの余分な引数を許可
    .action(async (options) => {
      try {
        // グローバルオプションの処理
        handleGlobalOptions(program.opts());
        
        // コマンドライン引数をログに記録
        logger.debug(`chatコマンド実行: 引数=${JSON.stringify(options)}, argv=${JSON.stringify(process.argv)}`);
        
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
          systemPrompt: getSessionSystemPrompt(model)
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
    .option('--delete <id>', 'スコープを削除')
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
        if (!options.create && !options.list && !options.show && !options.delete) {
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
        
        // スコープ削除
        if (options.delete) {
          deleteScope(scopeDir, options.delete);
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
  console.log('');
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
  
  return `You are AppGenius, an AI assistant specialized in software development.
You help users with coding tasks, software architecture, debugging, and implementing features.
You are running on ${modelInfo}.

When a user asks for help with a task:
1. Break down the problem
2. Provide clear explanations
3. Generate well-structured, idiomatic code
4. Offer guidance on testing and best practices

You have access to tools for file operations, which allow you to search, read, and edit files.
When using these tools, be precise and careful, especially with file paths.

You specialize in TypeScript, JavaScript, Node.js, and web development, but can assist with most programming languages.
Always prioritize writing clean, maintainable, and efficient code.

Current working directory: ${configManager.getConfig().projectRoot}`;
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
    systemPrompt: `You are a project analyzer. Your task is to analyze the structure and characteristics of a software project.
Focus on:
1. Project type and architecture
2. Main technologies and frameworks
3. Code organization
4. Key components and their relationships

Keep your analysis concise and actionable. Highlight patterns, best practices, and potential areas for improvement.`
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