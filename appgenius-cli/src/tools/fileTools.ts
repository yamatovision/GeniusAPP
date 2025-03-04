import fs from 'fs-extra';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { glob } from 'glob';
import { FileOperationResult, SearchResult, Tool, BatchFileOperation, BatchOperationResult, RetryOptions } from '../types';
import { logger } from '../utils/logger';
import { configManager } from '../utils/configManager';
import { ClaudeService, ClaudeModel } from '../services/claudeService';

const execAsync = promisify(exec);

/**
 * ReplaceTool クラス - ファイル全体を上書きするツール
 */
export class ReplaceTool implements Tool {
  name = 'Replace';
  description = 'Write a file to the local filesystem. Overwrites the existing file if there is one.\n\nBefore using this tool:\n\n1. Use the ReadFile tool to understand the file\'s contents and context\n\n2. Directory Verification (only applicable when creating new files):\n   - Use the LS tool to verify the parent directory exists and is the correct location';

  async execute(args: { file_path: string; content: string }): Promise<FileOperationResult> {
    try {
      // 引数のバリデーション
      if (!args.file_path) {
        const error = 'ファイルパスが指定されていません';
        logger.error(`ReplaceTool: ${error}`);
        return {
          success: false,
          filePath: '',
          error,
          errorType: 'validation',
          suggestions: ['file_path パラメータを指定してください', '絶対パスまたはプロジェクトルートからの相対パスを使用してください']
        };
      }
      
      if (args.content === undefined) {
        const error = 'コンテンツが指定されていません';
        logger.error(`ReplaceTool: ${error}`);
        return {
          success: false,
          filePath: args.file_path,
          error,
          errorType: 'validation',
          suggestions: ['content パラメータを指定してください', '空ファイルを作成する場合は空文字列を指定してください']
        };
      }

      const config = configManager.getConfig();
      const filePath = path.isAbsolute(args.file_path) 
        ? args.file_path 
        : path.join(config.projectRoot, args.file_path);
      
      logger.debug(`ReplaceTool: ${filePath} を上書き中...`);
      
      // ディレクトリが存在するか確認して作成
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        try {
          await fs.mkdirp(dir);
          logger.debug(`ディレクトリを作成しました: ${dir}`);
        } catch (dirError) {
          const error = `ディレクトリの作成に失敗しました: ${(dirError as Error).message}`;
          logger.error(`ReplaceTool: ${error}`);
          return {
            success: false,
            filePath: args.file_path,
            error,
            errorType: 'permission',
            suggestions: ['ディレクトリの作成権限があるか確認してください', '別の場所を指定してみてください']
          };
        }
      }
      
      // ファイルに書き込み
      await fs.writeFile(filePath, args.content);
      logger.info(`ファイルを上書きしました: ${filePath}`);
      
      return {
        success: true,
        filePath: filePath
      };
    } catch (error) {
      // エラーの種類を特定して適切なエラータイプと提案を提供
      const errorMsg = (error as Error).message;
      let errorType = 'execution';
      let suggestions: string[] = [];
      
      if (errorMsg.includes('EACCES') || errorMsg.includes('permission')) {
        errorType = 'permission';
        suggestions = [
          'ファイルの書き込み権限があるか確認してください',
          '読み取り専用ファイルでないか確認してください',
          '別の場所を指定してみてください'
        ];
      } else if (errorMsg.includes('ENOENT') || errorMsg.includes('no such file')) {
        errorType = 'notFound';
        suggestions = [
          'ディレクトリパスが正しいか確認してください',
          'ファイルパスを絶対パスで指定してみてください'
        ];
      } else if (errorMsg.includes('disk') || errorMsg.includes('space')) {
        errorType = 'limit';
        suggestions = [
          'ディスク容量に空きがあるか確認してください',
          'コンテンツのサイズを小さくしてみてください'
        ];
      } else {
        suggestions = [
          'パスが正しいか確認してください',
          'コンテンツが適切か確認してください'
        ];
      }
      
      logger.error(`ReplaceTool実行エラー: ${errorMsg}`, error as Error);
      return {
        success: false,
        filePath: args.file_path,
        error: errorMsg,
        errorType,
        suggestions
      };
    }
  }
}

/**
 * ReadNotebookTool クラス - Jupyter notebook読み込みツール
 */
export class ReadNotebookTool implements Tool {
  name = 'ReadNotebook';
  description = 'Reads a Jupyter notebook (.ipynb file) and returns all of the cells with their outputs. Jupyter notebooks are interactive documents that combine code, text, and visualizations, commonly used for data analysis and scientific computing. The notebook_path parameter must be an absolute path, not a relative path.';

  async execute(args: { notebook_path: string }): Promise<{ cells: any[]; notebook_path: string }> {
    try {
      const config = configManager.getConfig();
      const notebookPath = path.isAbsolute(args.notebook_path) 
        ? args.notebook_path 
        : path.join(config.projectRoot, args.notebook_path);
      
      logger.debug(`ReadNotebookTool: ${notebookPath} を読み込み中...`);
      
      if (!fs.existsSync(notebookPath)) {
        logger.error(`ノートブックが存在しません: ${notebookPath}`);
        return {
          notebook_path: args.notebook_path,
          cells: []
        };
      }
      
      // ノートブックファイルを読み込み
      const content = await fs.readFile(notebookPath, 'utf8');
      const notebook = JSON.parse(content);
      
      // セル情報を抽出
      const cells = notebook.cells.map((cell: any, index: number) => ({
        cell_number: index,
        cell_type: cell.cell_type,
        source: Array.isArray(cell.source) ? cell.source.join('') : cell.source,
        outputs: cell.outputs || []
      }));
      
      logger.debug(`${cells.length}個のセルを読み込みました`);
      
      return {
        notebook_path: notebookPath,
        cells
      };
    } catch (error) {
      logger.error(`ReadNotebookTool実行エラー: ${(error as Error).message}`, error as Error);
      return {
        notebook_path: args.notebook_path,
        cells: []
      };
    }
  }
}

/**
 * NotebookEditCellTool クラス - Jupyter notebook編集ツール
 */
export class NotebookEditCellTool implements Tool {
  name = 'NotebookEditCell';
  description = 'Completely replaces the contents of a specific cell in a Jupyter notebook (.ipynb file) with new source. Jupyter notebooks are interactive documents that combine code, text, and visualizations, commonly used for data analysis and scientific computing. The notebook_path parameter must be an absolute path, not a relative path. The cell_number is 0-indexed. Use edit_mode=insert to add a new cell at the index specified by cell_number. Use edit_mode=delete to delete the cell at the index specified by cell_number.';

  async execute(args: { 
    notebook_path: string; 
    cell_number: number; 
    new_source: string;
    cell_type?: string;
    edit_mode?: string 
  }): Promise<FileOperationResult> {
    try {
      const config = configManager.getConfig();
      const notebookPath = path.isAbsolute(args.notebook_path) 
        ? args.notebook_path 
        : path.join(config.projectRoot, args.notebook_path);
      
      const editMode = args.edit_mode || 'replace'; // デフォルトはセル置換
      
      logger.debug(`NotebookEditCellTool: ${notebookPath} のセル${args.cell_number}を${editMode}中...`);
      
      if (!fs.existsSync(notebookPath)) {
        logger.error(`ノートブックが存在しません: ${notebookPath}`);
        return {
          success: false,
          filePath: args.notebook_path,
          error: 'ノートブックが見つかりません'
        };
      }
      
      // ノートブックファイルを読み込み
      const content = await fs.readFile(notebookPath, 'utf8');
      const notebook = JSON.parse(content);
      
      // 編集モードに応じた処理
      if (editMode === 'replace') {
        // セルが存在するか確認
        if (args.cell_number >= notebook.cells.length) {
          return {
            success: false,
            filePath: args.notebook_path,
            error: `セル番号が範囲外です: ${args.cell_number}`
          };
        }
        
        // セルのソースコードを置換
        const cell = notebook.cells[args.cell_number];
        
        // セルタイプが指定されていれば更新
        if (args.cell_type) {
          cell.cell_type = args.cell_type;
        }
        
        // 改行で分割してセルソースを設定
        cell.source = args.new_source.split('\n').map((line: string, i: number, arr: string[]) => 
          i === arr.length - 1 ? line : line + '\n'
        );
        
        // 出力をクリア
        if (cell.cell_type === 'code') {
          cell.outputs = [];
          cell.execution_count = null;
        }
      } else if (editMode === 'insert') {
        // セルタイプが指定されていない場合はエラー
        if (!args.cell_type) {
          return {
            success: false,
            filePath: args.notebook_path,
            error: 'セル挿入にはcell_typeの指定が必要です'
          };
        }
        
        // 新しいセルを作成
        const newCell = {
          cell_type: args.cell_type,
          source: args.new_source.split('\n').map((line: string, i: number, arr: string[]) => 
            i === arr.length - 1 ? line : line + '\n'
          ),
          metadata: {}
        };
        
        // コードセルの場合は出力関連のフィールドを追加
        if (args.cell_type === 'code') {
          (newCell as any).outputs = [];
          (newCell as any).execution_count = null;
        }
        
        // 指定した位置にセルを挿入
        notebook.cells.splice(Math.min(args.cell_number, notebook.cells.length), 0, newCell);
      } else if (editMode === 'delete') {
        // セルが存在するか確認
        if (args.cell_number >= notebook.cells.length) {
          return {
            success: false,
            filePath: args.notebook_path,
            error: `セル番号が範囲外です: ${args.cell_number}`
          };
        }
        
        // セルを削除
        notebook.cells.splice(args.cell_number, 1);
      } else {
        return {
          success: false,
          filePath: args.notebook_path,
          error: `未知の編集モード: ${editMode}`
        };
      }
      
      // ノートブックを保存
      await fs.writeFile(notebookPath, JSON.stringify(notebook, null, 2));
      
      return {
        success: true,
        filePath: args.notebook_path
      };
    } catch (error) {
      logger.error(`NotebookEditCellTool実行エラー: ${(error as Error).message}`, error as Error);
      return {
        success: false,
        filePath: args.notebook_path,
        error: (error as Error).message
      };
    }
  }
}

/**
 * GlobToolクラス - ファイルパターン検索ツール
 */
export class GlobTool implements Tool {
  name = 'GlobTool';
  description = '- Fast file pattern matching tool that works with any codebase size\n- Supports glob patterns like "**/*.js" or "src/**/*.ts"\n- Returns matching file paths sorted by modification time\n- Use this tool when you need to find files by name patterns\n- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead\n';

  async execute(args: { pattern: string; path?: string }): Promise<SearchResult[]> {
    try {
      // 引数のバリデーション
      if (!args.pattern) {
        logger.error('GlobTool: patternパラメーターが指定されていません');
        throw {
          message: 'パターンを指定してください',
          errorType: 'validation',
          suggestions: ['ワイルドカード (**/*.js など) を使用して検索対象を指定してください'],
          retryOptions: {
            canRetry: true,
            correctArgs: { pattern: '**/*.{js,ts}', path: args.path }
          }
        };
      }

      const config = configManager.getConfig();
      const basePath = args.path || config.projectRoot;
      const searchPath = path.isAbsolute(basePath) ? basePath : path.join(config.projectRoot, basePath);

      logger.debug(`GlobTool: ${basePath} で ${args.pattern} を検索中...`);

      // パスの存在チェック
      if (!fs.existsSync(searchPath)) {
        logger.error(`検索パスが存在しません: ${searchPath}`);
        throw {
          message: `検索パスが存在しません: ${searchPath}`,
          errorType: 'notFound',
          suggestions: ['有効なディレクトリパスを指定してください', `現在のプロジェクトルート: ${config.projectRoot}`],
          retryOptions: {
            canRetry: true,
            correctArgs: { pattern: args.pattern, path: config.projectRoot }
          }
        };
      }

      // globパターンで検索
      const files = await glob(args.pattern, { 
        cwd: searchPath, 
        ignore: ['**/node_modules/**', '**/.git/**'],
        absolute: true
      });

      // 検索結果を形式に変換
      const results: SearchResult[] = files.map(filePath => ({
        filePath,
        relativePath: path.relative(config.projectRoot, filePath),
        matchType: 'filename'
      }));

      logger.debug(`GlobTool: ${results.length} 件の結果を見つけました`);
      
      // 結果が0件の場合はアドバイスを提供
      if (results.length === 0) {
        logger.warn(`GlobTool: "${args.pattern}" にマッチするファイルが見つかりませんでした`);
        const suggestions = [
          'ワイルドカードの使用法を確認してください (例: "**/*.js")',
          '検索パスが正しいか確認してください',
          '拡張子が正しいか確認してください'
        ];
        
        return {
          items: [],
          message: `パターン "${args.pattern}" にマッチするファイルが見つかりませんでした`,
          suggestions
        } as any;
      }

      return results;
    } catch (error: any) {
      const errorObj = error instanceof Error ? error : error as any;
      
      logger.error(`GlobTool実行エラー: ${errorObj.message}`, errorObj);
      
      // エラータイプが既に設定されている場合はそのまま返す
      if (errorObj.errorType) {
        throw errorObj;
      }
      
      // エラーメッセージの内容から適切なエラータイプや提案を提供
      let errorType = 'execution';
      let suggestions = [];
      let retryOptions = { canRetry: false };
      
      // エラーメッセージの内容に基づいてエラータイプを分類
      const errorMsg = errorObj.message || '';
      
      if (errorMsg.includes('ENOENT') || errorMsg.includes('no such file')) {
        errorType = 'notFound';
        suggestions = [
          'パスが存在するか確認してください',
          '絶対パスではなく相対パスを使用している場合、プロジェクトルートからの相対パスを確認してください',
          '指定したディレクトリが存在するか確認してください'
        ];
        retryOptions = {
          canRetry: true,
          correctArgs: { 
            pattern: args.pattern, 
            path: configManager.getConfig().projectRoot 
          }
        } as RetryOptions;
      } else if (errorMsg.includes('EACCES') || errorMsg.includes('permission')) {
        errorType = 'permission';
        suggestions = [
          'ファイルやディレクトリの権限設定を確認してください',
          '管理者権限が必要な場合があります',
          '読み取り専用のディレクトリでないか確認してください'
        ];
      } else if (errorMsg.includes('syntax') || errorMsg.includes('invalid pattern')) {
        errorType = 'syntax';
        suggestions = [
          'グロブパターンの構文を確認してください（例: "**/*.js"）',
          'パターンに特殊文字が含まれる場合は引用符で囲ってください',
          'より単純なパターンから始めて、徐々に複雑にしてみてください'
        ];
        retryOptions = {
          canRetry: true,
          correctArgs: { 
            pattern: args.pattern.includes('*') ? args.pattern : `**/*${args.pattern}*`, 
            path: args.path 
          }
        } as RetryOptions;
      } else if (errorMsg.includes('timeout') || errorMsg.includes('too large')) {
        errorType = 'timeout';
        suggestions = [
          '検索範囲を狭めてください',
          'より具体的なパターンを使用してください',
          '大きなディレクトリ（node_modulesなど）を除外してください'
        ];
        retryOptions = {
          canRetry: true,
          correctArgs: { 
            pattern: args.pattern, 
            path: args.path ? args.path : 'src' // srcディレクトリに絞り込む提案
          }
        } as RetryOptions;
      } else {
        // デフォルトの実行エラー
        suggestions = [
          'パターン構文が正しいか確認してください',
          'パスに特殊文字がないか確認してください',
          '別のパターンを試してください',
          '一般的な検索パターン例: "**/*.js", "src/**/*.ts", "*.{html,css}"'
        ];
      }
      
      // 拡張されたエラー情報をスローする
      throw {
        message: errorObj.message || 'GlobToolの実行中に不明なエラーが発生しました',
        errorType,
        suggestions,
        retryOptions
      };
    }
  }
}

/**
 * GrepToolクラス - ファイル内容検索ツール
 */
export class GrepTool implements Tool {
  name = 'GrepTool';
  description = '\n- Fast content search tool that works with any codebase size\n- Searches file contents using regular expressions\n- Supports full regex syntax (eg. "log.*Error", "function\\s+\\w+", etc.)\n- Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}")\n- Returns matching file paths sorted by modification time\n- Use this tool when you need to find files containing specific patterns\n- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead\n';

  async execute(args: { pattern: string; path?: string; include?: string }): Promise<SearchResult[]> {
    try {
      const config = configManager.getConfig();
      const basePath = args.path || config.projectRoot;
      const searchPath = path.isAbsolute(basePath) ? basePath : path.join(config.projectRoot, basePath);
      const pattern = args.pattern;
      const includePattern = args.include || '*.{ts,js,html,css,md,json}';

      logger.debug(`GrepTool: ${searchPath} で "${pattern}" を検索中 (include: ${includePattern})...`);

      if (!fs.existsSync(searchPath)) {
        logger.error(`検索パスが存在しません: ${searchPath}`);
        return [];
      }

      // まずGlobで対象ファイルを検索
      const globTool = new GlobTool();
      const files = await globTool.execute({ 
        pattern: includePattern, 
        path: searchPath 
      });

      // 各ファイルの内容を検索
      const results: SearchResult[] = [];
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file.filePath, 'utf8');
          if (content.includes(pattern)) {
            // 一致行の周辺を抽出
            const lines = content.split('\n');
            const matchingLines: { lineNum: number; line: string }[] = [];
            
            lines.forEach((line, index) => {
              if (line.includes(pattern)) {
                matchingLines.push({ lineNum: index + 1, line });
              }
            });
            
            // 一致した行の前後2行を含めた抜粋を作成
            let excerpt = '';
            for (const match of matchingLines.slice(0, 5)) { // 最大5箇所まで
              const startLine = Math.max(0, match.lineNum - 3);
              const endLine = Math.min(lines.length - 1, match.lineNum + 2);
              
              excerpt += `// 行 ${match.lineNum}:\n`;
              excerpt += lines.slice(startLine, endLine + 1).join('\n');
              excerpt += '\n\n';
            }
            
            results.push({
              filePath: file.filePath,
              relativePath: file.relativePath,
              content: excerpt,
              matchType: 'content'
            });
          }
        } catch (err) {
          logger.warn(`ファイル読み込みエラー (${file.filePath}): ${(err as Error).message}`);
        }
      }

      logger.debug(`GrepTool: ${results.length} 件の結果を見つけました`);
      return results;
    } catch (error) {
      const errorObj = error instanceof Error ? error : error as any;
      logger.error(`GrepTool実行エラー: ${errorObj.message}`, errorObj);
      
      // エラータイプが既に設定されている場合はそのまま返す
      if (errorObj.errorType) {
        throw errorObj;
      }
      
      // エラーメッセージの内容から適切なエラータイプや提案を提供
      let errorType = 'execution';
      let suggestions = [];
      let retryOptions = { canRetry: false };
      
      // エラーメッセージの内容に基づいてエラータイプを分類
      const errorMsg = errorObj.message || '';
      
      if (errorMsg.includes('ENOENT') || errorMsg.includes('no such file')) {
        errorType = 'notFound';
        suggestions = [
          'パスが存在するか確認してください',
          '絶対パスではなく相対パスを使用している場合、プロジェクトルートからの相対パスを確認してください',
          '指定したディレクトリが存在するか確認してください'
        ];
        retryOptions = {
          canRetry: true,
          correctArgs: { 
            pattern: args.pattern, 
            path: configManager.getConfig().projectRoot,
            include: args.include
          }
        } as RetryOptions;
      } else if (errorMsg.includes('EACCES') || errorMsg.includes('permission')) {
        errorType = 'permission';
        suggestions = [
          'ファイルやディレクトリの権限設定を確認してください',
          '管理者権限が必要な場合があります',
          '読み取り専用のディレクトリでないか確認してください'
        ];
      } else if (errorMsg.includes('binary') || errorMsg.includes('encoding')) {
        errorType = 'format';
        suggestions = [
          'バイナリファイルは検索対象から除外してください',
          'テキストファイルのみを対象とするincludeパターンを使用してください',
          '例: "*.{ts,js,json,html,css,md}" など'
        ];
        retryOptions = {
          canRetry: true,
          correctArgs: { 
            pattern: args.pattern, 
            path: args.path,
            include: "*.{ts,js,json,html,css,md}"
          }
        } as RetryOptions;
      } else if (errorMsg.includes('timeout') || errorMsg.includes('too large')) {
        errorType = 'timeout';
        suggestions = [
          '検索範囲を狭めてください',
          'より具体的なパターンを使用してください',
          '大きなディレクトリ（node_modulesなど）を除外してください'
        ];
        retryOptions = {
          canRetry: true,
          correctArgs: { 
            pattern: args.pattern, 
            path: 'src', // srcディレクトリに絞り込む提案
            include: args.include
          }
        } as RetryOptions;
      } else if (errorMsg.includes('invalid regex') || errorMsg.includes('syntax')) {
        errorType = 'syntax';
        suggestions = [
          '正規表現の構文を確認してください',
          '特殊文字（*+?|()[]{}^$）はエスケープが必要な場合があります',
          'より単純な検索パターンを試してください'
        ];
        // 単純な文字列検索に変更する提案
        const simplifiedPattern = args.pattern.replace(/[.*+?^${}()|[\]\\]/g, '');
        retryOptions = {
          canRetry: true,
          correctArgs: { 
            pattern: simplifiedPattern || args.pattern, 
            path: args.path,
            include: args.include
          }
        } as RetryOptions;
      } else {
        // デフォルトの実行エラー
        suggestions = [
          '検索パターンが複雑すぎないか確認してください',
          'includeパターンを適切に設定してください',
          '検索範囲を縮小してみてください',
          '一般的なincludeパターン例: "*.{js,ts}", "src/**/*.html"'
        ];
      }
      
      const configObj = configManager.getConfig();
      const searchPathVal = args.path ? (path.isAbsolute(args.path) ? args.path : path.join(configObj.projectRoot, args.path)) : configObj.projectRoot;

      // 詳細なエラー情報を返す
      return [{
        filePath: searchPathVal,
        relativePath: path.relative(configObj.projectRoot, args.path || configObj.projectRoot),
        content: `検索中にエラーが発生しました: ${errorObj.message}\n\n【問題解決のヒント】\n` + 
                 suggestions.map(s => `- ${s}`).join('\n') + 
                 '\n\n詳細なエラータイプ: ' + errorType,
        error: errorObj.message,
        errorType,
        suggestions,
        retryOptions
      }];
    }
  }
}

/**
 * ViewToolクラス - ファイル閲覧ツール
 */
export class ViewTool implements Tool {
  name = 'View';
  description = 'Reads a file from the local filesystem. The file_path parameter must be an absolute path, not a relative path.';

  async execute(args: { file_path: string; offset?: number; limit?: number }): Promise<{ content: string; file_path: string; error?: string; errorType?: string; suggestions?: string[] }> {
    try {
      // 必須パラメータのチェック
      if (!args.file_path) {
        logger.error('ViewTool実行エラー: The "path" argument must be of type string. Received undefined');
        return { file_path: '', content: 'エラー: ファイルパスが指定されていません' };
      }

      const config = configManager.getConfig();
      const filePath = path.isAbsolute(args.file_path) 
        ? args.file_path 
        : path.join(config.projectRoot, args.file_path);
      
      logger.debug(`ViewTool: ${filePath} を表示中...`);

      if (!fs.existsSync(filePath)) {
        logger.error(`ファイルが存在しません: ${filePath}`);
        return { file_path: args.file_path, content: 'ファイルが見つかりません' };
      }

      // ファイルの内容を読み込み
      let content = await fs.readFile(filePath, 'utf8');
      
      // オフセットと制限が指定されている場合は部分読み込み
      if (args.offset !== undefined || args.limit !== undefined) {
        const lines = content.split('\n');
        const offset = args.offset || 0;
        const limit = args.limit || 2000;
        
        const selectedLines = lines.slice(offset, offset + limit);
        content = selectedLines.join('\n');
        
        if (offset + limit < lines.length) {
          content += '\n... (continued)';
        }
      }
      
      return { file_path: filePath, content };
    } catch (error) {
      const errorObj = error instanceof Error ? error : error as any;
      logger.error(`ViewTool実行エラー: ${errorObj.message}`, errorObj);
      
      // エラーメッセージの内容から適切なエラータイプや提案を提供
      let errorType = 'execution';
      let suggestions = [];
      
      // エラーメッセージの内容に基づいてエラータイプを分類
      const errorMsg = errorObj.message || '';
      
      if (errorMsg.includes('ENOENT') || errorMsg.includes('no such file')) {
        errorType = 'notFound';
        suggestions = [
          'ファイルパスが正しいか確認してください',
          '相対パスではなく絶対パスを使用しているか確認してください',
          'まずGlobToolを使用してファイルの存在を確認することをお勧めします'
        ];
      } else if (errorMsg.includes('EACCES') || errorMsg.includes('permission')) {
        errorType = 'permission';
        suggestions = [
          'ファイルの権限設定を確認してください',
          '管理者権限が必要な場合があります',
          '読み取り専用のファイルやディレクトリでないか確認してください'
        ];
      } else if (errorMsg.includes('binary') || errorMsg.includes('encoding')) {
        errorType = 'format';
        suggestions = [
          'このファイルはバイナリファイルの可能性があります',
          'テキストファイルのみ読み込むことができます',
          '別の形式（テキスト）のファイルを選択してください'
        ];
      } else if (errorMsg.includes('too large')) {
        errorType = 'limit';
        suggestions = [
          'ファイルが大きすぎる可能性があります',
          'offset と limit パラメータを使用して部分的に読み込んでください',
          '例: { offset: 0, limit: 100 } で最初の100行を読み込みます'
        ];
      } else {
        // デフォルトの実行エラー
        suggestions = [
          'ファイルパスが正しいか確認してください',
          'ファイルが破損していないか確認してください',
          'システムリソース（メモリなど）が不足していないか確認してください'
        ];
      }
      
      // 詳細なエラーレスポンスを返す
      return { 
        file_path: args.file_path, 
        content: `ファイル読み込みエラー: ${errorObj.message}\n\n【問題解決のヒント】\n` + 
                 suggestions.map(s => `- ${s}`).join('\n') + 
                 '\n\n詳細なエラータイプ: ' + errorType,
        error: errorObj.message,
        errorType,
        suggestions
      };
    }
  }
}

/**
 * EditToolクラス - ファイル編集ツール
 */
export class EditTool implements Tool {
  name = 'Edit';
  description = "This is a tool for editing files. For moving or renaming files, you should generally use the Bash tool with the 'mv' command instead. For larger edits, use the Replace tool to overwrite files. For Jupyter notebooks (.ipynb files), use the NotebookEditCell instead.\n\nBefore using this tool:\n\n1. Use the View tool to understand the file's contents and context\n\n2. Verify the directory path is correct (only applicable when creating new files):\n   - Use the LS tool to verify the parent directory exists and is the correct location\n\nTo make a file edit, provide the following:\n1. file_path: The absolute path to the file to modify (must be absolute, not relative)\n2. old_string: The text to replace (must be unique within the file, and must match the file contents exactly, including all whitespace and indentation)\n3. new_string: The edited text to replace the old_string\n\nThe tool will replace ONE occurrence of old_string with new_string in the specified file.";

  async execute(args: { file_path: string; old_string: string; new_string: string }): Promise<FileOperationResult> {
    try {
      const config = configManager.getConfig();
      const filePath = path.isAbsolute(args.file_path) 
        ? args.file_path 
        : path.join(config.projectRoot, args.file_path);
      
      logger.debug(`EditTool: ${filePath} を編集中...`);

      // 新規ファイル作成のケース
      if (!fs.existsSync(filePath) && args.old_string === '') {
        // ディレクトリが存在するか確認して作成
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          await fs.mkdirp(dir);
        }
        
        // ファイルを作成
        await fs.writeFile(filePath, args.new_string);
        logger.info(`新規ファイルを作成しました: ${filePath}`);
        
        return {
          success: true,
          filePath: filePath
        };
      }
      
      // 既存ファイルの編集
      if (!fs.existsSync(filePath)) {
        logger.error(`ファイルが存在しません: ${filePath}`);
        return {
          success: false,
          filePath: filePath,
          error: 'ファイルが存在しません'
        };
      }
      
      // ファイルの内容を読み込み
      const content = await fs.readFile(filePath, 'utf8');
      
      // 置換前の文字列を検索
      if (args.old_string !== '' && !content.includes(args.old_string)) {
        logger.error(`置換対象の文字列がファイルに見つかりません: ${filePath}`);
        return {
          success: false,
          filePath: filePath,
          error: '置換対象の文字列がファイルに見つかりません'
        };
      }
      
      // 文字列を置換
      const newContent = args.old_string === '' 
        ? args.new_string 
        : content.replace(args.old_string, args.new_string);
      
      // ファイルに書き込み
      await fs.writeFile(filePath, newContent);
      logger.info(`ファイルを編集しました: ${filePath}`);
      
      return {
        success: true,
        filePath: filePath
      };
    } catch (error) {
      logger.error(`EditTool実行エラー: ${(error as Error).message}`, error as Error);
      return {
        success: false,
        filePath: args.file_path,
        error: (error as Error).message
      };
    }
  }
}

/**
 * BatchEditTool クラス - 複数ファイル一括編集ツール
 */
export class BatchEditTool implements Tool {
  name = 'BatchEdit';
  description = 'Edits multiple files or makes multiple edits to the same file in a single operation. This tool is useful for refactoring, making systematic changes across the codebase, or applying multiple edits to a single file.\n\nTo use this tool, provide an array of operations, where each operation specifies:\n1. file_path: The absolute path to the file to modify\n2. operations: An array of edit operations, each containing:\n   - old_string: The text to replace (must match exactly)\n   - new_string: The replacement text\n\nThe tool performs all operations in sequence and reports which ones succeeded or failed.';

  async execute(args: { files: BatchFileOperation[] }): Promise<BatchOperationResult> {
    try {
      logger.debug(`BatchEditTool: ${args.files.length} ファイルの一括編集を開始...`);
      
      if (!args.files || !Array.isArray(args.files) || args.files.length === 0) {
        return {
          overall_success: false,
          results: [],
          summary: '一括編集するファイルが指定されていません'
        };
      }
      
      const config = configManager.getConfig();
      const results: BatchOperationResult['results'] = [];
      let overallSuccess = true;
      
      // 各ファイルを処理
      for (const fileOp of args.files) {
        try {
          // ファイルパスの正規化
          const filePath = path.isAbsolute(fileOp.file_path) 
            ? fileOp.file_path
            : path.join(config.projectRoot, fileOp.file_path);
          
          logger.debug(`BatchEditTool: ${filePath} を処理中... （${fileOp.operations.length}個の操作）`);
          
          // 新規ファイル作成のケース（初期操作のold_stringが空の場合）
          const isNewFile = !fs.existsSync(filePath) && 
                          fileOp.operations.length > 0 && 
                          fileOp.operations[0].old_string === '';
          
          if (isNewFile) {
            // ディレクトリが存在するか確認して作成
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              await fs.mkdirp(dir);
            }
            
            // 新規ファイルを作成
            await fs.writeFile(filePath, fileOp.operations[0].new_string);
            logger.info(`新規ファイルを作成しました: ${filePath}`);
            
            results.push({
              file_path: filePath,
              success: true,
              operations_completed: 1,
              operations_total: fileOp.operations.length
            });
            
            // 次のファイルへ
            continue;
          }
          
          // 既存ファイルの編集
          if (!fs.existsSync(filePath)) {
            logger.error(`ファイルが存在しません: ${filePath}`);
            results.push({
              file_path: filePath,
              success: false,
              operations_completed: 0,
              operations_total: fileOp.operations.length,
              error: 'ファイルが存在しません'
            });
            overallSuccess = false;
            continue;
          }
          
          // ファイルの内容を読み込み
          let content = await fs.readFile(filePath, 'utf8');
          let operationsCompleted = 0;
          
          // 各編集操作を実行
          for (const operation of fileOp.operations) {
            try {
              // 置換前の文字列を検索
              if (operation.old_string !== '' && !content.includes(operation.old_string)) {
                logger.warn(`置換対象の文字列がファイルに見つかりません: ${filePath}, "${operation.old_string.substring(0, 30)}..."`);
                continue;
              }
              
              // 文字列を置換
              content = operation.old_string === '' 
                ? operation.new_string 
                : content.replace(operation.old_string, operation.new_string);
              
              operationsCompleted++;
            } catch (opError) {
              logger.error(`編集操作の実行中にエラーが発生しました: ${(opError as Error).message}`);
            }
          }
          
          // ファイルに書き込み
          await fs.writeFile(filePath, content);
          logger.info(`ファイルを編集しました（${operationsCompleted}/${fileOp.operations.length}の操作が成功）: ${filePath}`);
          
          results.push({
            file_path: filePath,
            success: operationsCompleted > 0,
            operations_completed: operationsCompleted,
            operations_total: fileOp.operations.length,
            error: operationsCompleted < fileOp.operations.length ? '一部の編集操作が失敗しました' : undefined
          });
          
          if (operationsCompleted < fileOp.operations.length) {
            overallSuccess = false;
          }
          
        } catch (fileError) {
          logger.error(`ファイル編集中にエラーが発生しました: ${(fileError as Error).message}`);
          results.push({
            file_path: fileOp.file_path,
            success: false,
            operations_completed: 0,
            operations_total: fileOp.operations.length,
            error: (fileError as Error).message
          });
          overallSuccess = false;
        }
      }
      
      // 結果のサマリーを作成
      const successCount = results.filter(r => r.success).length;
      const totalOperations = results.reduce((sum, r) => sum + r.operations_total, 0);
      const completedOperations = results.reduce((sum, r) => sum + r.operations_completed, 0);
      
      const summary = `${args.files.length}ファイル中${successCount}ファイルの編集が成功しました（${completedOperations}/${totalOperations}の操作が完了）`;
      
      logger.info(`BatchEditTool実行結果: ${summary}`);
      
      return {
        overall_success: overallSuccess,
        results,
        summary
      };
      
    } catch (error) {
      logger.error(`BatchEditTool実行エラー: ${(error as Error).message}`, error as Error);
      return {
        overall_success: false,
        results: [],
        summary: `一括編集実行中にエラーが発生しました: ${(error as Error).message}`
      };
    }
  }
}

/**
 * BashToolクラス - シェルコマンド実行ツール
 */
export class BashTool implements Tool {
  name = 'Bash';
  description = 'シェルコマンドを実行します';

  async execute(args: { command: string; timeout?: number }): Promise<{ output: string; error?: string }> {
    try {
      logger.debug(`Bash: コマンド実行 "${args.command}"`);
      
      const config = configManager.getConfig();
      const cwd = config.projectRoot;
      const timeout = args.timeout || 30000; // デフォルトは30秒
      
      // コマンドを実行
      const { stdout, stderr } = await execAsync(args.command, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });
      
      // エラー出力がある場合はログに記録
      if (stderr) {
        logger.warn(`コマンド ${args.command} のエラー出力: ${stderr}`);
      }
      
      return {
        output: stdout,
        error: stderr || undefined
      };
    } catch (error) {
      logger.error(`Bash実行エラー: ${(error as Error).message}`, error as Error);
      return {
        output: '',
        error: (error as Error).message
      };
    }
  }
}

/**
 * LSToolクラス - ディレクトリリスト表示ツール
 */
export class LSTool implements Tool {
  name = 'LS';
  description = 'Lists files and directories in a given path. The path parameter must be an absolute path, not a relative path. You can optionally provide an array of glob patterns to ignore with the ignore parameter. You should generally prefer the Glob and Grep tools, if you know which directories to search.';

  async execute(args: { path: string; ignore?: string[] }): Promise<{ files: string[] }> {
    try {
      // 必須パラメータのチェック
      if (!args.path) {
        logger.error('LSTool実行エラー: The "path" argument must be of type string. Received undefined');
        return { files: [] };
      }

      const config = configManager.getConfig();
      const dirPath = path.isAbsolute(args.path) 
        ? args.path 
        : path.join(config.projectRoot, args.path);
      
      logger.debug(`LSTool: ${dirPath} の内容を一覧表示中...`);

      if (!fs.existsSync(dirPath)) {
        logger.error(`ディレクトリが存在しません: ${dirPath}`);
        return { files: [] };
      }
      
      // デフォルトの除外パターン
      const defaultIgnore = ['node_modules', '.git', 'dist', 'build'];
      const ignorePatterns = args.ignore ? [...defaultIgnore, ...args.ignore] : defaultIgnore;
      
      // ディレクトリ内容を読み込み
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files = entries
        .filter(entry => !ignorePatterns.some(pattern => entry.name.includes(pattern)))
        .map(entry => {
          const entryPath = path.join(args.path, entry.name);
          return entry.isDirectory() ? `${entryPath}/` : entryPath;
        });
      
      return { files };
    } catch (error) {
      logger.error(`LSTool実行エラー: ${(error as Error).message}`, error as Error);
      return { files: [] };
    }
  }
}

/**
 * AgentToolクラス - 複雑なタスクを委任するためのエージェントツール
 */
export class AgentTool implements Tool {
  name = 'dispatch_agent';
  description = 'Launch a new agent that has access to the following tools: GlobTool, GrepTool, LS, View, ReadNotebook. When you are searching for a keyword or file and are not confident that you will find the right match on the first try, use the Agent tool to perform the search for you. For example:\n\n- If you are searching for a keyword like "config" or "logger", or for questions like "which file does X?", the Agent tool is strongly recommended\n- If you want to read a specific file path, use the View or GlobTool tool instead of the Agent tool, to find the match more quickly\n- If you are searching for a specific class definition like "class Foo", use the GlobTool tool instead, to find the match more quickly\n\nUsage notes:\n1. Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses\n2. When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.\n3. Each agent invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.\n4. The agent\'s outputs should generally be trusted\n5. IMPORTANT: The agent can not use Bash, Replace, Edit, NotebookEditCell, so can not modify files. If you want to use these tools, use them directly instead of going through the agent.';

  async execute(args: { prompt: string }): Promise<{ result: string }> {
    try {
      logger.debug(`AgentTool: エージェントにタスク委任 "${args.prompt}"`);
      
      // 実行されるタスクの説明を取得
      const taskPrompt = args.prompt;
      
      // エージェント用のサブモデルを初期化
      const agentService = new ClaudeService({
        model: ClaudeModel.CLAUDE_3_HAIKU, // 軽量モデルを使用
        maxTokens: 2000,
        systemPrompt: this.getAgentSystemPrompt()
      });
      
      // 必要なツールをエージェントに登録
      agentService.registerTools([
        new GlobTool(),
        new GrepTool(),
        new LSTool(),
        new ViewTool(),
        // ReadNotebookTool は未実装
      ]);
      
      // エージェントにタスクを実行させる
      const response = await agentService.sendMessage(taskPrompt);
      
      logger.debug(`AgentTool: エージェントからの応答を受信`);
      
      return {
        result: response
      };
    } catch (error) {
      logger.error(`AgentTool実行エラー: ${(error as Error).message}`, error as Error);
      return {
        result: `エージェントの実行中にエラーが発生しました: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * エージェント用のシステムプロンプトを取得
   */
  private getAgentSystemPrompt(): string {
    return `You are an intelligent agent that helps with searching and analyzing code repositories.
You have access to tools for searching files, reading file contents, and analyzing code structure.

Your tasks include:
1. Finding files that match specific patterns
2. Searching for specific code snippets or patterns
3. Analyzing code structure and relationships
4. Gathering information to answer questions about the codebase

Your tools:
- GlobTool: Find files matching patterns
- GrepTool: Search through file contents
- LS: List directory contents
- View: Read file contents

Approach each task systematically:
1. Break down the request into clear steps
2. Use appropriate tools to gather information
3. Synthesize a clear, concise response

IMPORTANT NOTES:
- You cannot modify files (no Edit, Bash, or other writing operations)
- For file paths, be precise and use absolute paths when possible
- Organize your results clearly and concisely
- Return ONLY relevant information - prioritize quality over quantity`;
  }
}

/**
 * BatchReplaceTool クラス - 複数ファイル一括置換ツール
 */
export class BatchReplaceTool implements Tool {
  name = 'BatchReplace';
  description = 'Replaces the entire content of multiple files in a single operation. This tool is useful for creating or overwriting multiple files at once, such as when generating a set of related files.\n\nTo use this tool, provide an array of file replacements, where each replacement specifies:\n1. file_path: The absolute path to the file to write\n2. content: The new content for the file\n\nThe tool performs all replacements in sequence and reports which ones succeeded or failed.';

  async execute(args: { files: { file_path: string; content: string }[] }): Promise<BatchOperationResult> {
    try {
      logger.debug(`BatchReplaceTool: ${args.files.length} ファイルの一括置換を開始...`);
      
      if (!args.files || !Array.isArray(args.files) || args.files.length === 0) {
        return {
          overall_success: false,
          results: [],
          summary: '一括置換するファイルが指定されていません'
        };
      }
      
      const config = configManager.getConfig();
      const results: BatchOperationResult['results'] = [];
      let overallSuccess = true;
      
      // 各ファイルを処理
      for (const fileOp of args.files) {
        try {
          // ファイルパスの正規化
          const filePath = path.isAbsolute(fileOp.file_path) 
            ? fileOp.file_path
            : path.join(config.projectRoot, fileOp.file_path);
          
          logger.debug(`BatchReplaceTool: ${filePath} を置換中...`);
          
          // ディレクトリが存在するか確認して作成
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            await fs.mkdirp(dir);
          }
          
          // ファイルに書き込み
          await fs.writeFile(filePath, fileOp.content);
          
          const isNewFile = !fs.existsSync(filePath);
          logger.info(`${isNewFile ? '新規ファイルを作成' : 'ファイルを置換'}しました: ${filePath}`);
          
          results.push({
            file_path: filePath,
            success: true,
            operations_completed: 1,
            operations_total: 1
          });
          
        } catch (fileError) {
          logger.error(`ファイル置換中にエラーが発生しました: ${(fileError as Error).message}`);
          results.push({
            file_path: fileOp.file_path,
            success: false,
            operations_completed: 0,
            operations_total: 1,
            error: (fileError as Error).message
          });
          overallSuccess = false;
        }
      }
      
      // 結果のサマリーを作成
      const successCount = results.filter(r => r.success).length;
      
      const summary = `${args.files.length}ファイル中${successCount}ファイルの置換が成功しました`;
      
      logger.info(`BatchReplaceTool実行結果: ${summary}`);
      
      return {
        overall_success: overallSuccess,
        results,
        summary
      };
      
    } catch (error) {
      logger.error(`BatchReplaceTool実行エラー: ${(error as Error).message}`, error as Error);
      return {
        overall_success: false,
        results: [],
        summary: `一括置換実行中にエラーが発生しました: ${(error as Error).message}`
      };
    }
  }
}

/**
 * RefactorTool クラス - コードリファクタリングツール
 */
export class RefactorTool implements Tool {
  name = 'Refactor';
  description = 'Performs a codebase-wide search and replace operation, useful for refactoring symbols, renaming variables, or making consistent changes across the entire codebase. The tool first searches for all occurrences of the pattern before making any changes, then applies the changes to all matching files.\n\nTo use this tool, provide:\n1. pattern: The string or regular expression to search for\n2. replacement: The replacement string\n3. include: A glob pattern to specify which files to include in the search (e.g., "**/*.js")\n4. options: Optional parameters for controlling the operation';

  async execute(args: { 
    pattern: string; 
    replacement: string; 
    include: string;
    path?: string;
    regex?: boolean;
    dryRun?: boolean;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    maxFiles?: number;
  }): Promise<{
    success: boolean;
    filesChanged: number;
    totalMatches: number;
    matchDetails: Array<{
      filePath: string;
      matches: number;
      error?: string;
    }>;
    dryRun: boolean;
    preview?: Array<{
      filePath: string;
      before: string;
      after: string;
    }>;
  }> {
    try {
      logger.debug(`RefactorTool: パターン "${args.pattern}" を "${args.replacement}" に置換中...`);
      
      const config = configManager.getConfig();
      const basePath = args.path || config.projectRoot;
      const searchPath = path.isAbsolute(basePath) ? basePath : path.join(config.projectRoot, basePath);
      const isDryRun = args.dryRun !== false; // デフォルトはdryRun=true
      const isRegex = args.regex === true;
      const isCaseSensitive = args.caseSensitive !== false; // デフォルトはcase-sensitive=true
      const isWholeWord = args.wholeWord === true;
      const maxFiles = args.maxFiles || 100; // デフォルトは最大100ファイル
      
      // ファイルの検索
      logger.debug(`RefactorTool: ${args.include} パターンにマッチするファイルを検索中...`);
      
      const globTool = new GlobTool();
      const files = await globTool.execute({ 
        pattern: args.include, 
        path: searchPath 
      });
      
      if (files.length === 0) {
        return {
          success: false,
          filesChanged: 0,
          totalMatches: 0,
          matchDetails: [],
          dryRun: isDryRun,
          preview: []
        };
      }
      
      // 検索パターンの準備
      let searchPattern: RegExp;
      if (isRegex) {
        const flags = isCaseSensitive ? 'g' : 'gi';
        searchPattern = new RegExp(args.pattern, flags);
      } else {
        let patternStr = args.pattern;
        if (isWholeWord) {
          patternStr = `\\b${patternStr}\\b`;
        }
        const flags = isCaseSensitive ? 'g' : 'gi';
        searchPattern = new RegExp(patternStr, flags);
      }
      
      // ファイル数を制限
      const filesToProcess = files.slice(0, maxFiles);
      
      // 検索と置換
      const matchDetails: Array<{
        filePath: string;
        matches: number;
        error?: string;
      }> = [];
      
      const preview: Array<{
        filePath: string;
        before: string;
        after: string;
      }> = [];
      
      let totalMatches = 0;
      let filesChanged = 0;
      
      for (const file of filesToProcess) {
        try {
          // ファイル内容を読み込み
          const content = await fs.readFile(file.filePath, 'utf8');
          
          // マッチ数をカウント
          const matches = (content.match(searchPattern) || []).length;
          
          if (matches > 0) {
            // マッチがある場合
            totalMatches += matches;
            filesChanged++;
            
            matchDetails.push({
              filePath: file.filePath,
              matches
            });
            
            // ドライランまたはプレビュー生成の場合
            if (isDryRun) {
              // 最初のマッチの前後のテキストを抽出
              const matchIndex = content.search(searchPattern);
              const before = content.slice(Math.max(0, matchIndex - 50), Math.min(content.length, matchIndex + 100));
              
              // 置換後のテキスト
              const after = content.replace(searchPattern, args.replacement);
              const afterMatchIndex = before.replace(searchPattern, args.replacement);
              
              // プレビューに追加
              preview.push({
                filePath: file.filePath,
                before: before,
                after: afterMatchIndex
              });
            } else {
              // 実際の置換を実行
              const newContent = content.replace(searchPattern, args.replacement);
              await fs.writeFile(file.filePath, newContent);
            }
          }
        } catch (fileError) {
          logger.error(`ファイル処理中にエラーが発生しました: ${file.filePath} - ${(fileError as Error).message}`);
          matchDetails.push({
            filePath: file.filePath,
            matches: 0,
            error: (fileError as Error).message
          });
        }
      }
      
      const summaryMsg = isDryRun
        ? `ドライラン実行: ${filesChanged}ファイルで${totalMatches}箇所のマッチが見つかりました`
        : `${filesChanged}ファイルで${totalMatches}箇所を置換しました`;
      
      logger.info(`RefactorTool実行結果: ${summaryMsg}`);
      
      return {
        success: true,
        filesChanged,
        totalMatches,
        matchDetails,
        dryRun: isDryRun,
        preview: isDryRun ? preview : undefined
      };
      
    } catch (error) {
      logger.error(`RefactorTool実行エラー: ${(error as Error).message}`, error as Error);
      return {
        success: false,
        filesChanged: 0,
        totalMatches: 0,
        matchDetails: [],
        dryRun: true,
        preview: []
      };
    }
  }
}