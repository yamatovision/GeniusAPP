import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Claude Codeにあって、BlueLamp CLIにないツールの実装例
 * これらは比較的簡単に実装できます
 */

// 1. LS Tool - ディレクトリ一覧表示（15分で実装可能）
export async function lsTool(directory: string = '.'): Promise<string> {
  try {
    const files = await fs.readdir(directory, { withFileTypes: true });
    const result = files.map(file => {
      const type = file.isDirectory() ? 'd' : 'f';
      return `[${type}] ${file.name}`;
    }).join('\n');
    
    return `✅ ディレクトリ内容:\n${result}`;
  } catch (error: any) {
    return `❌ エラー: ${error.message}`;
  }
}

// 2. GlobTool - パターンマッチング（30分で実装可能）
export async function globTool(pattern: string, options?: any): Promise<string> {
  try {
    const files = await glob(pattern, {
      ignore: ['node_modules/**', '.git/**'],
      ...options
    });
    
    if (files.length === 0) {
      return '✅ マッチするファイルが見つかりませんでした';
    }
    
    return `✅ 見つかったファイル (${files.length}件):\n${files.join('\n')}`;
  } catch (error: any) {
    return `❌ エラー: ${error.message}`;
  }
}

// 3. GrepTool - ファイル内容検索（30分で実装可能）
export async function grepTool(pattern: string, filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches: string[] = [];
    
    lines.forEach((line, index) => {
      if (line.includes(pattern) || new RegExp(pattern).test(line)) {
        matches.push(`${index + 1}: ${line}`);
      }
    });
    
    if (matches.length === 0) {
      return '✅ マッチする行が見つかりませんでした';
    }
    
    return `✅ マッチした行 (${matches.length}件):\n${matches.join('\n')}`;
  } catch (error: any) {
    return `❌ エラー: ${error.message}`;
  }
}

// 4. WebFetchTool - Web取得（30分で実装可能）
export async function webFetchTool(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return `❌ HTTPエラー: ${response.status} ${response.statusText}`;
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const json = await response.json();
      return `✅ JSON取得成功:\n${JSON.stringify(json, null, 2)}`;
    } else {
      const text = await response.text();
      const preview = text.slice(0, 500);
      return `✅ 取得成功 (${text.length}文字):\n${preview}${text.length > 500 ? '...' : ''}`;
    }
  } catch (error: any) {
    return `❌ エラー: ${error.message}`;
  }
}

// 5. BatchTool - 並列実行（1時間で実装可能）
interface BatchOperation {
  tool: string;
  params: any;
}

export async function batchTool(
  operations: BatchOperation[],
  toolExecutor: (toolName: string, params: any) => Promise<string>
): Promise<string> {
  try {
    // 全ての操作を並列実行
    const promises = operations.map(op => 
      toolExecutor(op.tool, op.params)
        .then(result => ({ tool: op.tool, success: true, result }))
        .catch(error => ({ tool: op.tool, success: false, error: error.message }))
    );
    
    const results = await Promise.all(promises);
    
    // 結果をフォーマット
    const summary = results.map((r, i) => 
      `[${i + 1}] ${r.tool}: ${r.success ? '✅ 成功' : '❌ 失敗'}`
    ).join('\n');
    
    const details = results.map((r, i) => 
      `\n--- ${i + 1}. ${r.tool} ---\n${r.success ? r.result : r.error}`
    ).join('\n');
    
    return `✅ バッチ実行完了:\n${summary}\n${details}`;
  } catch (error: any) {
    return `❌ バッチ実行エラー: ${error.message}`;
  }
}

// 6. 移動/リネームツール（10分で実装可能）
export async function mvTool(source: string, destination: string): Promise<string> {
  try {
    await fs.rename(source, destination);
    return `✅ 移動/リネーム成功: ${source} → ${destination}`;
  } catch (error: any) {
    return `❌ エラー: ${error.message}`;
  }
}

// 7. コピーツール（10分で実装可能）
export async function cpTool(source: string, destination: string): Promise<string> {
  try {
    const stats = await fs.stat(source);
    
    if (stats.isDirectory()) {
      // ディレクトリの場合は再帰的にコピー（簡易版）
      await fs.cp(source, destination, { recursive: true });
    } else {
      // ファイルの場合
      await fs.copyFile(source, destination);
    }
    
    return `✅ コピー成功: ${source} → ${destination}`;
  } catch (error: any) {
    return `❌ エラー: ${error.message}`;
  }
}

// 8. 削除ツール（セキュリティ注意！）
export async function rmTool(filePath: string, options: { force?: boolean } = {}): Promise<string> {
  try {
    // 安全性のため、確認を入れる
    if (!options.force && (filePath === '/' || filePath === '/*' || filePath.includes('../'))) {
      return '❌ 危険な操作が検出されました。削除を中止します。';
    }
    
    const stats = await fs.stat(filePath);
    
    if (stats.isDirectory()) {
      await fs.rm(filePath, { recursive: true });
    } else {
      await fs.unlink(filePath);
    }
    
    return `✅ 削除成功: ${filePath}`;
  } catch (error: any) {
    return `❌ エラー: ${error.message}`;
  }
}

// 9. ファイル情報取得ツール（5分で実装可能）
export async function statTool(filePath: string): Promise<string> {
  try {
    const stats = await fs.stat(filePath);
    
    const info = {
      type: stats.isDirectory() ? 'ディレクトリ' : 'ファイル',
      size: `${stats.size} バイト`,
      created: stats.birthtime.toLocaleString('ja-JP'),
      modified: stats.mtime.toLocaleString('ja-JP'),
      mode: stats.mode.toString(8)
    };
    
    return `✅ ファイル情報:\n${JSON.stringify(info, null, 2)}`;
  } catch (error: any) {
    return `❌ エラー: ${error.message}`;
  }
}

// 10. プロセス実行＆監視ツール（45分で実装可能）
export async function execWithTimeoutTool(
  command: string, 
  timeoutMs: number = 30000
): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs
    });
    
    return `✅ 実行成功 (${timeoutMs}ms以内):\n${stdout}${stderr ? `\nSTDERR: ${stderr}` : ''}`;
  } catch (error: any) {
    if (error.signal === 'SIGTERM') {
      return `❌ タイムアウト: ${timeoutMs}ms を超過しました`;
    }
    return `❌ エラー: ${error.message}`;
  }
}