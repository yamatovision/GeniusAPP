import fs from 'fs-extra';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { glob } from 'glob';
import { FileOperationResult, SearchResult, Tool } from '../types';
import { logger } from '../utils/logger';
import { configManager } from '../utils/configManager';

const execAsync = promisify(exec);

/**
 * GlobToolクラス - ファイルパターン検索ツール
 */
export class GlobTool implements Tool {
  name = 'GlobTool';
  description = 'ファイルパターンに一致するファイルを検索します';

  async execute(args: { pattern: string; path?: string }): Promise<SearchResult[]> {
    try {
      const config = configManager.getConfig();
      const basePath = args.path || config.projectRoot;
      const searchPath = path.isAbsolute(basePath) ? basePath : path.join(config.projectRoot, basePath);

      logger.debug(`GlobTool: ${basePath} で ${args.pattern} を検索中...`);

      if (!fs.existsSync(searchPath)) {
        logger.error(`検索パスが存在しません: ${searchPath}`);
        return [];
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
      return results;
    } catch (error) {
      logger.error(`GlobTool実行エラー: ${(error as Error).message}`, error as Error);
      return [];
    }
  }
}

/**
 * GrepToolクラス - ファイル内容検索ツール
 */
export class GrepTool implements Tool {
  name = 'GrepTool';
  description = 'ファイル内容を検索します';

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
      logger.error(`GrepTool実行エラー: ${(error as Error).message}`, error as Error);
      return [];
    }
  }
}

/**
 * ViewToolクラス - ファイル閲覧ツール
 */
export class ViewTool implements Tool {
  name = 'ViewTool';
  description = 'ファイルの内容を表示します';

  async execute(args: { file_path: string; offset?: number; limit?: number }): Promise<{ content: string; file_path: string }> {
    try {
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
      logger.error(`ViewTool実行エラー: ${(error as Error).message}`, error as Error);
      return { file_path: args.file_path, content: `エラー: ${(error as Error).message}` };
    }
  }
}

/**
 * EditToolクラス - ファイル編集ツール
 */
export class EditTool implements Tool {
  name = 'EditTool';
  description = 'ファイルを編集します';

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
 * BashToolクラス - シェルコマンド実行ツール
 */
export class BashTool implements Tool {
  name = 'BashTool';
  description = 'シェルコマンドを実行します';

  async execute(args: { command: string; timeout?: number }): Promise<{ output: string; error?: string }> {
    try {
      logger.debug(`BashTool: コマンド実行 "${args.command}"`);
      
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
      logger.error(`BashTool実行エラー: ${(error as Error).message}`, error as Error);
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
  name = 'LSTool';
  description = 'ディレクトリの内容を一覧表示します';

  async execute(args: { path: string; ignore?: string[] }): Promise<{ files: string[] }> {
    try {
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