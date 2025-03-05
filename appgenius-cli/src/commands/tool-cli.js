/**
 * AppGenius ツール使用CLI
 * 
 * 強制的にツール使用を有効にしたCLIインターフェース
 * 特にファイル探索機能を強化しています
 */
const { ClaudeToolWrapper } = require('../services/claude-tool-wrapper');
const inquirer = require('inquirer');
const ora = require('ora');
const chalk = require('chalk');
const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ログレベルを設定
logger.level = 'info';

// 簡易コマンド関数
const simpleCommands = {
  mdfiles: async () => {
    try {
      const files = await glob.glob('**/*.md', { ignore: ['node_modules/**'] });
      console.log(chalk.green('\nマークダウンファイル:'));
      files.forEach(file => console.log(file));
      return true;
    } catch (error) {
      console.error(chalk.red(`検索エラー: ${error.message}`));
      return false;
    }
  },
  
  ls: async (dirPath = process.cwd()) => {
    try {
      const files = fs.readdirSync(dirPath);
      console.log(chalk.green(`\n${dirPath} の内容:`));
      files.forEach(file => {
        const stats = fs.statSync(path.join(dirPath, file));
        console.log(`${stats.isDirectory() ? 'd' : '-'} ${file}`);
      });
      return true;
    } catch (error) {
      console.error(chalk.red(`ディレクトリ読み込みエラー: ${error.message}`));
      return false;
    }
  },
  
  view: async (filePath) => {
    if (!filePath) {
      console.error(chalk.red('ファイルパスが指定されていません'));
      return false;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(chalk.green(`\n${filePath} の内容:`));
      console.log(content);
      return true;
    } catch (error) {
      console.error(chalk.red(`ファイル読み込みエラー: ${error.message}`));
      return false;
    }
  }
};

/**
 * 対話型ツールCLIセッション
 */
async function startToolSession() {
  console.log(chalk.blue('AppGenius ツール使用CLI - 起動中...\n'));
  
  // コマンドライン引数を処理
  const args = process.argv.slice(2);
  
  // 簡易コマンドが指定されている場合
  if (args.length > 0 && args[0] === '--simple') {
    if (args.length > 1) {
      const command = args[1];
      const commandArgs = args.slice(2);
      
      if (command in simpleCommands) {
        await simpleCommands[command](...commandArgs);
      } else if (command === 'help') {
        console.log(chalk.green('\n利用可能な簡易コマンド:'));
        console.log('mdfiles - マークダウンファイルの検索');
        console.log('ls [dirPath] - ディレクトリ内容の表示');
        console.log('view <filePath> - ファイル内容の表示');
      } else {
        console.error(chalk.red(`不明なコマンド: ${command}`));
      }
      return;
    } else {
      console.log(chalk.green('\n利用可能な簡易コマンド:'));
      console.log('mdfiles - マークダウンファイルの検索');
      console.log('ls [dirPath] - ディレクトリ内容の表示');
      console.log('view <filePath> - ファイル内容の表示');
      return;
    }
  }
  
  // オフラインモードかどうかをチェック
  const useRealAPI = !args.includes('--offline');
  
  console.log(`モード: ${useRealAPI ? 'オンライン (API使用)' : 'オフライン (API不使用)'}`);
  
  // 単発クエリが指定されている場合
  if (args.length > 0 && !args[0].startsWith('--')) {
    const query = args[0];
    
    // ラッパークラスをインスタンス化
    const claude = new ClaudeToolWrapper({
      streaming: false,
      useRealAPI: useRealAPI,
      systemPrompt: `あなたはファイル操作に特化した高度なAIアシスタントです。日本語の自然な指示からユーザーの意図を理解し、適切なツールを選択して実行してください。`
    });
    
    try {
      console.log(chalk.yellow(`クエリ: "${query}"`));
      const result = await claude.detectAndExecuteTools(query);
      console.log(chalk.blue('\nAI:'), result.responseText);
      
      if (result.toolResults.length > 0) {
        console.log(chalk.gray(`\n[${result.toolResults.length}個のツールが使用されました]`));
        
        // ファイル表示関連の特別処理 - GlobToolの結果に対するViewの自動実行
        if (result.toolResults.length === 1 && 
            result.toolResults[0].toolName === 'GlobTool' &&
            result.toolResults[0].success &&
            Array.isArray(result.toolResults[0].result) && 
            result.toolResults[0].result.length > 0) {
          
          // マークダウンファイル表示関連の処理
          const messageLC = query.toLowerCase();
          if ((messageLC.includes('readme') || 
               messageLC.includes('マークダウン') || 
               messageLC.includes('.md')) && 
              (messageLC.includes('内容') || 
               messageLC.includes('表示') || 
               messageLC.includes('見せて') || 
               messageLC.includes('中身'))) {
            
            // 最初のファイルを自動表示
            const globResult = result.toolResults[0].result;
            // GlobTool結果の処理
            let filePath = '';
            if (typeof globResult[0] === 'string') {
              filePath = globResult[0];
            } else if (typeof globResult[0] === 'object' && globResult[0].filePath) {
              filePath = globResult[0].filePath;
            }
            
            if (!filePath) {
              console.error(chalk.red('ファイルパスを取得できませんでした'));
              return;
            }
            
            console.log(`最初に見つかったファイル ${filePath} を自動表示します`);
            
            try {
              // Viewツールを実行
              const viewTool = claude.tools.get('View');
              if (viewTool) {
                const viewResult = await viewTool.execute({ file_path: filePath });
                console.log(chalk.cyan('\nファイル内容:'));
                console.log(viewResult);
              }
            } catch (err) {
              console.error(chalk.red(`ファイル表示中にエラーが発生しました: ${err.message}`));
            }
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`エラー: ${error.message}`));
    }
    return;
  }
  
  // インタラクティブモード
  // ラッパークラスをインスタンス化
  const claude = new ClaudeToolWrapper({
    streaming: true,
    useRealAPI: useRealAPI,
    systemPrompt: `あなたはファイル操作に特化した高度なAIアシスタントです。
日本語の自然な指示からユーザーの意図を理解し、適切なツールを選択して実行することが得意です。

【利用可能ツール】
- GlobTool: ファイルパターン検索（例: **/*.js, src/**/*.ts）- ファイル名やパターンでファイルを探す
- GrepTool: ファイル内容検索（特定のテキストパターンを探す）- コード内のキーワードや正規表現で検索
- View: ファイル内容表示 - ファイルの中身を読み込んで表示
- LS: ディレクトリ一覧表示 - フォルダ内のファイル一覧を表示
- dispatch_agent: 複雑な検索に使える高度なツール - 詳細な分析が必要な場合に活用

【重要指示】
1. 積極的にツールを使用すること。情報は推測せず、必ずツールで確認してください
2. 日本語の曖昧な指示でも意図を読み取り、最適なツールを選ぶこと
3. 複数のツールを組み合わせて使うこと。例えば「まずGlobToolで検索→結果をViewで確認」など
4. 見つけた情報は簡潔にまとめ、重要なポイントを強調すること
5. ユーザーの質問に直接答えること。余計な説明は避けてください

【使用パターン例】
- 「マークダウンファイル探して」→ GlobToolで**/*.mdを検索
- 「コード内でloggerを使っている部分」→ GrepToolでloggerパターンを検索
- 「設定ファイルの内容を見せて」→ GlobToolで*.json/*.yaml検索→Viewで表示
- 「srcフォルダの構造」→ LSツールでディレクトリ内容表示

情報収集は徹底的に行い、必ず複数のツールを活用してください。
ユーザーの質問の意図を汲み取り、必要に応じて質問を拡張解釈して最適な結果を導いてください。`
  });
  
  const spinner = ora('AIアシスタントを準備中...').start();
  
  try {
    // ヘルプコマンドリスト
    const helpText = `
${chalk.bold('利用可能なコマンド:')}
${chalk.green('/quit')} または ${chalk.green('/exit')} - プログラムを終了
${chalk.green('/clear')} - 会話履歴をクリア
${chalk.green('/help')} - このヘルプを表示

${chalk.bold('ツール使用例 - 自然な日本語で命令できます:')}
- ${chalk.cyan('ファイル検索:')}
  "${chalk.cyan('マークダウンファイル探して')}"
  "${chalk.cyan('このプロジェクトにあるJSONファイルは？')}"
  "${chalk.cyan('全てのマークダウンファイルを詳しく調査して')}"
  "${chalk.cyan('READMEファイルどこ？')}"

- ${chalk.cyan('ファイル内容表示:')}
  "${chalk.cyan('package.jsonの中身教えて')}"
  "${chalk.cyan('README見せて')}"
  "${chalk.cyan('設定ファイル見たい')}"

- ${chalk.cyan('コード検索:')}
  "${chalk.cyan('コード内でtoolという単語を使っている箇所は？')}"
  "${chalk.cyan('logger関数が使われている場所を見つけて')}"
  "${chalk.cyan('インポート文を全部見せて')}"

- ${chalk.cyan('ディレクトリ確認:')}
  "${chalk.cyan('srcフォルダの中身は？')}"
  "${chalk.cyan('プロジェクト構造を教えて')}"
  "${chalk.cyan('srcディレクトリを見せて')}"

- ${chalk.cyan('複合的な指示:')}
  "${chalk.cyan('マークダウンファイルを全部分析して概要を教えて')}"
  "${chalk.cyan('設定ファイルの重要な部分を抽出して')}"
  "${chalk.cyan('プロジェクトの構成と主要ファイルを教えて')}"

${chalk.bold('ヒント:')}
- 自然な日本語で指示できます。「〜を探して」「〜を見せて」「〜は？」などの表現が使えます
- "詳しく"や"全て"などの言葉を使うと、より詳細な分析が行われます
- 具体的な指示がなくても、AIがあなたの意図を推測してツールを使います
- 複数のリクエストを組み合わせると（「まず探して、次に内容を見せて」）より詳細な結果が得られます
`;
    
    spinner.succeed('AIアシスタントの準備完了');
    console.log(chalk.cyan('\nAppGenius ツール使用CLI - 準備完了\n'));
    console.log('ファイル操作やコード検索などを気軽に質問してください');
    console.log('コマンド一覧を見るには /help と入力してください\n');
    
    // 起動時にヘルプテキストの一部を表示
    console.log(chalk.cyan('使用例:') + ' 「マークダウンファイル探して」「設定ファイル見せて」「srcフォルダの中身は？」など');
    console.log(chalk.cyan('詳細な使用例は') + ' /help ' + chalk.cyan('で確認できます\n'));
    
    // 対話ループ
    while (true) {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.green('何をお手伝いしましょうか？'),
          prefix: ''
        }
      ]);
      
      // ユーザー入力を表示（質問と区別しやすいように）
      if (input.trim() && !input.trim().startsWith('/')) {
        console.log(chalk.yellow('> ') + input.trim());
      }
      
      // 特殊コマンド処理
      if (input.trim() === '/quit' || input.trim() === '/exit' || 
          input.trim() === '終了' || input.trim() === 'さようなら') {
        console.log(chalk.yellow('プログラムを終了します'));
        break;
      } else if (input.trim() === '/help' || input.trim() === 'ヘルプ' || 
                 input.trim() === '使い方' || input.trim() === 'help') {
        console.log(helpText);
        continue;
      } else if (input.trim() === '/clear' || input.trim() === 'クリア' || 
                 input.trim() === '履歴削除') {
        claude.clearConversation();
        console.log(chalk.yellow('会話履歴をクリアしました'));
        continue;
      } else if (!input.trim()) {
        continue;
      }
      
      // AIに送信
      spinner.text = '処理中...';
      spinner.start();
      
      try {
        // テキスト部分を保存するバッファ
        let responseBuffer = '';
        
        // ストリーミングコールバック
        const streamCallback = (chunk, type) => {
          if (spinner.isSpinning) {
            spinner.stop();
            console.log(chalk.blue('\nAI:'));
          }
          
          // 特殊タイプの処理
          if (type === 'thinking') {
            process.stdout.write(chalk.gray(chunk));
          } else {
            responseBuffer += chunk;
            process.stdout.write(chunk);
          }
        };
        
        // ツール検出・実行機能を使ってメッセージを送信
        const result = await claude.detectAndExecuteTools(input, streamCallback);
        
        // ストリーミングが終了していない場合は完了
        if (spinner.isSpinning) {
          spinner.stop();
          console.log(chalk.blue('\nAI:'), result.responseText || responseBuffer || "応答を取得できませんでした");
        }
        
        // ツール使用情報を表示
        if (result.toolResults.length > 0) {
          console.log(chalk.gray(`\n[${result.toolResults.length}個のツールが使用されました]`));
          
          // ファイル表示関連の特別処理 - GlobToolの結果に対するViewの自動実行
          if (result.toolResults.length === 1 && 
              result.toolResults[0].toolName === 'GlobTool' &&
              result.toolResults[0].success &&
              Array.isArray(result.toolResults[0].result) && 
              result.toolResults[0].result.length > 0) {
            
            // マークダウンファイル表示関連の処理
            const messageLC = input.toLowerCase();
            if ((messageLC.includes('readme') || 
                 messageLC.includes('マークダウン') || 
                 messageLC.includes('.md')) && 
                (messageLC.includes('内容') || 
                 messageLC.includes('表示') || 
                 messageLC.includes('見せて') || 
                 messageLC.includes('中身'))) {
              
              // 最初のファイルを自動表示
              const globResult = result.toolResults[0].result;
              // GlobTool結果の処理
              let filePath = '';
              if (typeof globResult[0] === 'string') {
                filePath = globResult[0];
              } else if (typeof globResult[0] === 'object' && globResult[0].filePath) {
                filePath = globResult[0].filePath;
              }
              
              if (!filePath) {
                console.error(chalk.red('ファイルパスを取得できませんでした'));
                return;
              }
              
              console.log(`最初に見つかったファイル ${filePath} を自動表示します`);
              
              try {
                // Viewツールを実行
                const viewTool = claude.tools.get('View');
                if (viewTool) {
                  const viewResult = await viewTool.execute({ file_path: filePath });
                  console.log(chalk.cyan('\nファイル内容:'));
                  console.log(viewResult);
                }
              } catch (err) {
                console.error(chalk.red(`ファイル表示中にエラーが発生しました: ${err.message}`));
              }
            }
          }
        }
        
        console.log(''); // 空行
      } catch (error) {
        spinner.fail('エラーが発生しました');
        console.error(chalk.red(`エラー: ${error.message}`));
      }
    }
  } catch (error) {
    spinner.fail('初期化中にエラーが発生しました');
    console.error(chalk.red(`エラー: ${error.message}`));
  }
}

module.exports = { startToolSession };