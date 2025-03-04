import * as vscode from 'vscode';
import * as path from 'path';
import { FileManager } from '../utils/fileManager';
import { Logger } from '../utils/logger';

export interface ProjectStructure {
  root: ProjectNode;
}

export interface ProjectNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: ProjectNode[];
  language?: string;
  size?: number;
}

export interface DependencyMap {
  [filePath: string]: string[];
}

export interface ProjectAnalysis {
  structure: ProjectStructure;
  dependencies: DependencyMap;
  stats: ProjectStats;
  directories?: string[]; // オプショナルなディレクトリリスト
}

export interface ProjectStats {
  totalFiles: number;
  totalDirectories: number;
  languageBreakdown: { [language: string]: number };
  lineCount: number;
}

export class ProjectAnalyzer {
  constructor() {}

  /**
   * プロジェクト全体を分析し、構造と依存関係を返す
   */
  public async analyzeProject(workspaceRoot?: string): Promise<ProjectAnalysis> {
    try {
      // ワークスペースルートが指定されていない場合は現在のワークスペースを使用
      if (!workspaceRoot) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          throw new Error('プロジェクトが開かれていません');
        }
        workspaceRoot = workspaceFolders[0].uri.fsPath;
      }

      Logger.info(`プロジェクト分析を開始: ${workspaceRoot}`);

      // プロジェクト構造を解析
      const structure = await this.buildProjectStructure(workspaceRoot);
      
      // 依存関係マップを構築
      const dependencies = await this.analyzeDependencies(structure);
      
      // プロジェクト統計情報を取得
      const stats = await this.collectProjectStats(structure);

      Logger.info('プロジェクト分析が完了しました');
      
      return {
        structure,
        dependencies,
        stats
      };
    } catch (error) {
      Logger.error('プロジェクト分析でエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * 指定されたパスからプロジェクト構造ツリーを構築
   */
  private async buildProjectStructure(rootPath: string): Promise<ProjectStructure> {
    const root = await this.buildDirectoryTree(rootPath);
    return { root };
  }

  /**
   * ディレクトリツリーを再帰的に構築
   */
  private async buildDirectoryTree(dirPath: string): Promise<ProjectNode> {
    try {
      const items = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
      const dirName = path.basename(dirPath);
      
      const children: ProjectNode[] = [];
      
      // `node_modules`や`.git`などは除外
      const ignoreDirs = ['node_modules', '.git', 'dist', 'out', 'build'];
      
      for (const [name, fileType] of items) {
        // 無視リストにあるディレクトリはスキップ
        if (fileType === vscode.FileType.Directory && ignoreDirs.includes(name)) {
          continue;
        }
        
        const childPath = path.join(dirPath, name);
        
        if (fileType === vscode.FileType.Directory) {
          // ディレクトリの場合は再帰的に処理
          const subdirNode = await this.buildDirectoryTree(childPath);
          children.push(subdirNode);
        } else if (fileType === vscode.FileType.File) {
          // ファイルの場合は拡張子から言語を推測
          const ext = path.extname(name).toLowerCase();
          const language = this.getLanguageFromExtension(ext);
          
          // ファイルサイズを取得
          const fileUri = vscode.Uri.file(childPath);
          const fileStat = await vscode.workspace.fs.stat(fileUri);
          
          children.push({
            name,
            path: childPath,
            type: 'file',
            language,
            size: fileStat.size
          });
        }
      }
      
      return {
        name: dirName,
        path: dirPath,
        type: 'directory',
        children
      };
    } catch (error) {
      Logger.error(`Error building directory tree for ${dirPath}`, error as Error);
      // エラーが発生してもプロセスを続行できるように、最小限の情報を返す
      return {
        name: path.basename(dirPath),
        path: dirPath,
        type: 'directory',
        children: []
      };
    }
  }

  /**
   * ファイル拡張子から言語を推測
   */
  private getLanguageFromExtension(ext: string): string {
    const languageMap: { [key: string]: string } = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'React',
      '.tsx': 'React/TypeScript',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.less': 'LESS',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.py': 'Python',
      '.java': 'Java',
      '.c': 'C',
      '.cpp': 'C++',
      '.cs': 'C#',
      '.go': 'Go',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.rs': 'Rust',
      '.dart': 'Dart',
      '.ex': 'Elixir',
      '.exs': 'Elixir',
      '.erl': 'Erlang',
      '.lua': 'Lua',
      '.pl': 'Perl',
      '.sh': 'Shell',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.xml': 'XML',
      '.sql': 'SQL',
      '.vue': 'Vue',
      '.svelte': 'Svelte'
    };
    
    return languageMap[ext] || 'Other';
  }

  /**
   * ファイル間の依存関係を分析
   */
  private async analyzeDependencies(structure: ProjectStructure): Promise<DependencyMap> {
    const dependencies: DependencyMap = {};
    
    // ファイルノードのフラット配列を取得
    const fileNodes = this.getAllFileNodes(structure.root);
    
    // JavaScript/TypeScriptファイルを処理
    const jstsFiles = fileNodes.filter(node => 
      node.language === 'JavaScript' || 
      node.language === 'TypeScript' || 
      node.language === 'React' || 
      node.language === 'React/TypeScript'
    );
    
    for (const fileNode of jstsFiles) {
      // ファイルの依存関係を分析
      dependencies[fileNode.path] = await this.analyzeFileDependencies(fileNode.path);
    }
    
    return dependencies;
  }

  /**
   * 単一ファイルの依存関係（インポート）を分析
   */
  private async analyzeFileDependencies(filePath: string): Promise<string[]> {
    try {
      const content = await FileManager.readFile(filePath);
      const deps: string[] = [];
      
      // import文のパターンを検出
      const importPattern = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importPattern.exec(content)) !== null) {
        deps.push(match[1]);
      }
      
      // require文のパターンを検出
      const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      
      while ((match = requirePattern.exec(content)) !== null) {
        deps.push(match[1]);
      }
      
      return deps;
    } catch (error) {
      Logger.error(`Error analyzing dependencies for ${filePath}`, error as Error);
      return [];
    }
  }

  /**
   * 全てのファイルノードを取得
   */
  private getAllFileNodes(node: ProjectNode): ProjectNode[] {
    if (node.type === 'file') {
      return [node];
    }
    
    if (!node.children) {
      return [];
    }
    
    return node.children.flatMap(child => this.getAllFileNodes(child));
  }

  /**
   * プロジェクトの統計情報を収集
   */
  private async collectProjectStats(structure: ProjectStructure): Promise<ProjectStats> {
    const fileNodes = this.getAllFileNodes(structure.root);
    
    // 言語ごとのファイル数をカウント
    const languageBreakdown: { [language: string]: number } = {};
    
    for (const fileNode of fileNodes) {
      const lang = fileNode.language || 'Other';
      languageBreakdown[lang] = (languageBreakdown[lang] || 0) + 1;
    }
    
    // ディレクトリ数をカウント
    const countDirectories = (node: ProjectNode): number => {
      if (node.type === 'file' || !node.children) {
        return 0;
      }
      
      return 1 + node.children.reduce((count, child) => count + countDirectories(child), 0);
    };
    
    const totalDirectories = countDirectories(structure.root);
    
    // 総行数を計算（サンプリング）
    let lineCount = 0;
    
    // 最大100ファイルまでサンプリング
    const sampleFiles = fileNodes.slice(0, 100);
    
    for (const fileNode of sampleFiles) {
      try {
        const content = await FileManager.readFile(fileNode.path);
        lineCount += content.split('\n').length;
      } catch (error) {
        // エラーは無視して続行
      }
    }
    
    // サンプリングした場合は全体を推定
    if (fileNodes.length > sampleFiles.length) {
      lineCount = Math.floor(lineCount * (fileNodes.length / sampleFiles.length));
    }
    
    return {
      totalFiles: fileNodes.length,
      totalDirectories,
      languageBreakdown,
      lineCount
    };
  }
}