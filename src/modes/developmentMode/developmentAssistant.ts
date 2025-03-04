import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIService } from '../../core/aiService';
import { AIDevelopmentService } from '../../core/aiDevelopmentService';
import { Logger } from '../../utils/logger';
import { DevelopmentPhase } from './developmentPhases';
import { FileOperationManager } from '../../utils/fileOperationManager';

/**
 * コードブロックの型定義
 */
export interface CodeBlock {
  filename: string;
  language: string;
  code: string;
}

/**
 * AIレスポンスの型定義
 */
export interface AIResponse {
  message: string;
  codeBlocks: CodeBlock[];
}

/**
 * 開発アシスタントクラス
 * AIを活用した開発支援機能を提供
 */
export class DevelopmentAssistant {
  private _aiService: AIService;
  private _devAIService: AIDevelopmentService;
  private _fileManager: FileOperationManager;
  private _currentDirectory: string = '';
  private _currentScope: string = '';
  private _currentFiles: string[] = [];
  private _chatHistory: { role: string, content: string }[] = [];

  constructor(aiService: AIService) {
    this._aiService = aiService;
    this._devAIService = new AIDevelopmentService(aiService);
    this._fileManager = FileOperationManager.getInstance();
    this.initializeSystemPrompt();
  }

  /**
   * システムプロンプトの初期化
   */
  private initializeSystemPrompt(): void {
    // チャット履歴を初期化し、システムプロンプトを追加
    this._chatHistory = [
      {
        role: 'system',
        content: `【プロンプトの掟】
1. すべての質問は1問1答形式で進める
2. PHASEは必ず順序通りに実施し、飛ばすことは禁止
3. PHASE 1、2では必ず自然言語で説明を行う
4. 既存ファイルの変更前には、必ず対象ファイルの提出を求める
5. 次のPHASEに進む前に必ずユーザーの承認を得る
あなたは追加開発を支援するアシスタントです。
以下の手順で開発を支援します。

## 情報収集フェーズ

※1問ずつ回答を待ち、確認してから次の質問に進みます

Q1: 現在のディレクトリ構造を教えてください
[current_state]
→ 回答を確認してから次に進みます

Q2: 今回のスコープを教えてください
[new_feature]
→ 回答を確認してから次に進みます

Q3: 以下の関連ファイル一覧を確認してください
<<<cat
[関連ファイルを表示]
>>>
→ これらのファイルの内容を共有していただけますでしょうか？
※ファイルの内容の確認が完了するまで次に進めません


## 開発支援フェーズ


PHASE 1: 影響範囲の特定と承認
※すべて自然言語で説明します
- 現状分析の説明
- 変更が必要な箇所の特定
- 予想される影響の説明
→ ご確認とご承認をいただけましたでしょうか？
※承認がない場合、次のPHASEには進めません

PHASE 2: 実装計画の確認
※すべて自然言語で説明します
1. 変更ファイル一覧：
- 修正が必要な既存ファイル（要提出）
- 新規作成が必要なファイル

2. ディレクトリ構造：
<<<cat
[新規ディレクトリ構造を表示]
>>>

3. 各ファイルでの変更内容の説明
4. 想定される影響の説明
→ この実装計画についてご承認をいただけますでしょうか？
※承認がない場合、次のPHASEには進めません

PHASE 3: 実装
※必要なファイルがすべて提出済みであることを確認してから開始します
承認をいただけましたら、実装フェーズに移ります。

【注意事項】
- 各フェーズでの承認は明示的に得る必要があります
- ファイルの提出がない場合は実装を開始できません
- 不明点がある場合は、必ず質問して明確にしてから進めます

"型定義は最小限に抑え、必須フィールドのみ厳密に定義してください"

ユーザーが提供した情報を受け取り、開発を支援してください。

あなたの主な責任は：
1. 質問を通じて必要な情報を収集すること
2. プロジェクトの現状を理解すること
3. 影響範囲を適切に分析すること
4. 実装計画を立案すること
5. コードを生成・修正すること

出力されたコードブロックは、必要に応じて自動的にファイルに保存されます。
\`\`\`言語名 ファイル名(必須)
コード内容
\`\`\`
の形式でコードブロックを出力してください。
`
      }
    ];

    Logger.debug('開発アシスタントのシステムプロンプトを初期化しました');
  }

  /**
   * 初期メッセージを取得
   */
  public getInitialMessage(): string {
    return `開発アシスタントへようこそ！

私はAIを活用して開発作業をサポートします。以下の手順で開発を進めていきましょう：

## 情報収集フェーズ

まず、現在のプロジェクト状況を教えてください：

Q1: 現在のディレクトリ構造を教えてください
`;
  }

  /**
   * 現在のディレクトリ構造を設定
   */
  public setCurrentDirectory(directoryStructure: string): void {
    this._currentDirectory = directoryStructure;
  }

  /**
   * 開発スコープを設定
   */
  public setCurrentScope(scope: string): void {
    this._currentScope = scope;
  }

  /**
   * 関連ファイルを設定
   */
  public setCurrentFiles(files: string[]): void {
    this._currentFiles = files;
  }

  /**
   * AIに質問を送信して応答を処理
   * 検索命令を検出した場合はファイル検索を実行
   */
  public async processMessage(message: string): Promise<AIResponse> {
    try {
      // チャット履歴にユーザーのメッセージを追加
      this._chatHistory.push({
        role: 'user',
        content: message
      });

      // 検索コマンドの検出
      const searchCommand = this.detectSearchCommand(message);
      if (searchCommand) {
        Logger.info(`検索コマンドを検出しました: ${searchCommand.type}`);
        return this.executeSearchCommand(searchCommand, message);
      }

      // 専用の開発AIサービスを使用してメッセージを処理
      Logger.debug(`開発AIサービスに質問を送信: ${message.substring(0, 100)}...`);
      const aiResponse = await this._devAIService.processMessage(message, this._chatHistory);

      // チャット履歴にAIの応答を追加
      this._chatHistory.push({
        role: 'assistant',
        content: aiResponse
      });

      // コードブロックを抽出
      const codeBlocks = this.extractCodeBlocks(aiResponse);
      
      return {
        message: aiResponse,
        codeBlocks
      };
    } catch (error) {
      Logger.error('AIからの応答処理中にエラーが発生しました', error as Error);
      throw error;
    }
  }

  /**
   * 検索コマンドを検出
   */
  private detectSearchCommand(message: string): { type: string, query?: string, path?: string } | null {
    // メッセージを小文字に変換して検索しやすくする
    const lowerMessage = message.toLowerCase();
    
    // ファイル検索コマンドの検出
    if (lowerMessage.includes('調べて') || lowerMessage.includes('検索して') || 
        lowerMessage.includes('ファイルを探して') || lowerMessage.includes('コードを探して')) {
      
      // キーワード検索（ファイル内容を検索）
      if (lowerMessage.includes('キーワード') || lowerMessage.includes('文字列検索') || 
          lowerMessage.includes('内容で検索') || lowerMessage.includes('コード内を検索')) {
        
        // 正規表現で検索キーワードを抽出
        const keywordMatch = message.match(/「([^」]+)」|"([^"]+)"|'([^']+)'|『([^』]+)』/);
        const keyword = keywordMatch ? (keywordMatch[1] || keywordMatch[2] || keywordMatch[3] || keywordMatch[4]) : null;
        
        return {
          type: 'keyword',
          query: keyword || '検索キーワードが見つかりませんでした'
        };
      }
      
      // ファイル名検索
      if (lowerMessage.includes('ファイル名') || lowerMessage.includes('拡張子') || 
          lowerMessage.includes('.ts') || lowerMessage.includes('.js') || 
          lowerMessage.includes('.html') || lowerMessage.includes('.css')) {
        
        // 拡張子やファイル名のパターンを抽出
        const patternMatch = message.match(/「([^」]+)」|"([^"]+)"|'([^']+)'|『([^』]+)』|\.(ts|js|jsx|tsx|html|css|json|md)/);
        let pattern = patternMatch ? 
          (patternMatch[1] || patternMatch[2] || patternMatch[3] || patternMatch[4] || patternMatch[5]) : null;
        
        // 拡張子のみが検出された場合
        if (pattern && pattern.length <= 3) {
          pattern = `*.${pattern}`;
        }
        
        return {
          type: 'filename',
          query: pattern || '*.{ts,js,html,css}'
        };
      }
      
      // ディレクトリ内検索
      if (lowerMessage.includes('ディレクトリ') || lowerMessage.includes('フォルダ') || 
          lowerMessage.includes('src/') || lowerMessage.includes('api/')) {
        
        // パスを抽出 - 絶対パスとプロジェクト相対パスの両方に対応
        let extractedPath = null;
        
        // メッセージ内にデスクトップやホームディレクトリへの言及があるかチェック
        if (lowerMessage.includes('desktop') || lowerMessage.includes('デスクトップ') || 
            lowerMessage.includes('home') || lowerMessage.includes('ホーム') ||
            lowerMessage.includes('/users/')) {
          // これらの特殊なケースでは、nullを返してデフォルトのプロジェクトディレクトリを使用
          Logger.debug(`特殊なディレクトリへの言及を検出したため、デフォルトのプロジェクトパスを使用します`);
          extractedPath = null;
        }
        // 上記のチェックでnullが設定されなかった場合のみ、パスのマッチングを試みる
        else {
          // 絶対パスのチェック（修正: これを除外）
          // 相対パスのチェック
          const relativePathMatch = message.match(/(src\/[\/\w-]+|api\/[\/\w-]+|[\w-]+\/[\w-]+)/);
          if (relativePathMatch) {
            extractedPath = relativePathMatch[1];
            Logger.debug(`相対パスを検出: ${extractedPath}`);
          }
        }
        
        return {
          type: 'directory',
          path: extractedPath || 'src',
          query: '*.{ts,js,html,css}'
        };
      }
      
      // 特定パターンがなければ一般的な検索と判断
      return {
        type: 'general',
        query: 'auth OR user OR authenticate'
      };
    }
    
    return null;
  }

  /**
   * 検索コマンドを実行
   */
  private async executeSearchCommand(
    command: { type: string, query?: string, path?: string },
    _originalMessage: string
  ): Promise<AIResponse> {
    try {
      Logger.info(`検索コマンドを実行: ${command.type}, クエリ: ${command.query}`);
      
      // 設定から実装スコープデータを取得してカスタムパスをチェック
      let customProjectPath = '';
      try {
        // まず開発アシスタントに既に設定されているディレクトリ構造情報をチェック
        if (this._currentDirectory && this._currentDirectory.includes('プロジェクトディレクトリ構造:')) {
          // プロジェクトディレクトリ構造から実際のパスを抽出
          const pathMatch = this._currentDirectory.match(/プロジェクトディレクトリ構造:[\s\n]*([^\s\n]+)/);
          if (pathMatch && pathMatch[1]) {
            const extractedProjectPath = pathMatch[1].trim();
            if (fs.existsSync(extractedProjectPath)) {
              customProjectPath = extractedProjectPath;
              Logger.info(`ディレクトリ構造情報から抽出したパスを使用: ${customProjectPath}`);
            }
          }
        }
        
        // ディレクトリ構造から取得できなかった場合は設定から取得
        if (!customProjectPath) {
          const scopeData = vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope');
          if (scopeData) {
            // scopeDataがオブジェクトとして取得される場合
            if (typeof scopeData === 'object' && scopeData !== null) {
              if ((scopeData as any).projectPath) {
                customProjectPath = (scopeData as any).projectPath;
                Logger.info(`カスタムプロジェクトパス(オブジェクト)を使用: ${customProjectPath}`);
              }
            } 
            // scopeDataが文字列として取得される場合
            else if (typeof scopeData === 'string' && scopeData !== '') {
              try {
                const parsedData = JSON.parse(scopeData);
                if (parsedData && parsedData.projectPath) {
                  customProjectPath = parsedData.projectPath;
                  Logger.info(`カスタムプロジェクトパス(文字列)を使用: ${customProjectPath}`);
                }
              } catch (parseError) {
                Logger.error('実装スコープJSONパースエラー:', parseError as Error);
              }
            }
          }
        }
        
        // customProjectPathが見つかった場合、存在確認とログ出力
        if (customProjectPath) {
          if (fs.existsSync(customProjectPath)) {
            Logger.info(`検証済みカスタムパス: ${customProjectPath} (存在します)`);
          } else {
            Logger.warn(`無効なカスタムパス: ${customProjectPath} (存在しません)`);
            customProjectPath = ''; // 無効なパスはリセット
          }
        }
      } catch (error) {
        Logger.error('実装スコープからのプロジェクトパス取得エラー:', error as Error);
      }
      
      // カスタムパスが存在しない場合は、ワークスペースのルートパスを取得
      let rootPath = '';
      
      if (customProjectPath && fs.existsSync(customProjectPath)) {
        rootPath = customProjectPath;
      } else {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          return this.createErrorResponse('ワークスペースが開かれていません。');
        }
        rootPath = workspaceFolders[0].uri.fsPath;
      }
      
      // 現在のディレクトリ構造情報を活用する
      let searchPath;
      // 現在設定されているディレクトリ構造があれば使用する
      if (this._currentDirectory && this._currentDirectory.includes('プロジェクトディレクトリ構造:')) {
        // プロジェクトディレクトリ構造から実際のパスを抽出
        const pathMatch = this._currentDirectory.match(/プロジェクトディレクトリ構造:[\s\n]*([^\s\n]+)/);
        if (pathMatch && pathMatch[1]) {
          const extractedProjectPath = pathMatch[1].trim();
          if (fs.existsSync(extractedProjectPath)) {
            rootPath = extractedProjectPath;
            Logger.info(`ディレクトリ構造情報から抽出したパスを使用: ${rootPath}`);
          }
        }
      }
      
      // コマンドでパスが指定されているか確認
      if (command.path) {
        // 特殊なパターンを処理（デスクトップやホームディレクトリなど）
        if (command.path.includes('/Users/') || command.path.includes('/Desktop/')) {
          // 特殊なパスが指定されている場合でも、プロジェクトルートパスを優先
          Logger.debug(`特殊なパスを検出したが無視: ${command.path}`);
          searchPath = rootPath;
        } else {
          // 通常のパス処理
          searchPath = path.isAbsolute(command.path) ? command.path : path.join(rootPath, command.path);
        }
        Logger.debug(`検索パス: ${searchPath} (rootPath: ${rootPath}, command.path: ${command.path})`);
      } else {
        searchPath = rootPath;
      }
      
      // 検索結果を格納する変数
      let results: { filePath: string, content?: string }[] = [];
      let searchSummary = '';
      
      switch (command.type) {
        case 'keyword':
          // ファイル内容の検索（単純な grep 相当の実装）
          results = await this.searchFileContents(searchPath, command.query || '');
          searchSummary = `"${command.query}" を含むファイルを検索しました。`;
          break;
          
        case 'filename':
          // ファイル名検索
          results = await this.searchFileNames(searchPath, command.query || '*.{ts,js}');
          searchSummary = `パターン "${command.query}" に一致するファイルを検索しました。`;
          break;
          
        case 'directory':
          // ディレクトリ内検索
          results = await this.searchFileNames(searchPath, command.query || '*.{ts,js}');
          searchSummary = `ディレクトリ "${command.path}" 内のファイルを検索しました。`;
          break;
          
        case 'general':
          // 一般的な検索（認証関連のファイルを検索する例）
          results = await this.searchFileContents(rootPath, command.query || 'auth OR user OR authenticate');
          searchSummary = `認証関連のファイルを検索しました。`;
          break;
      }
      
      // 検索結果の整形
      let responseMessage = `# 検索結果\n\n${searchSummary}\n\n`;
      
      if (results.length === 0) {
        responseMessage += '一致するファイルが見つかりませんでした。別のキーワードで再検索をお試しください。';
      } else {
        // 最大で10件まで表示
        const displayResults = results.slice(0, 10);
        
        responseMessage += `${results.length} 件のファイルが見つかりました（表示: ${displayResults.length}件）:\n\n`;
        
        // 各ファイルの内容を表示
        for (const result of displayResults) {
          const relativePath = result.filePath.replace(rootPath, '');
          
          responseMessage += `## ${relativePath}\n\n`;
          
          // ファイル内容がある場合は表示
          if (result.content) {
            responseMessage += '```\n' + result.content + '\n```\n\n';
          } else {
            try {
              // ファイル内容を読み込む
              const content = await this._fileManager.readFileAsString(result.filePath);
              // コードブロックで表示
              responseMessage += '```\n' + content + '\n```\n\n';
            } catch (error) {
              responseMessage += '（ファイルの読み込みに失敗しました）\n\n';
            }
          }
        }
        
        // 件数が多い場合は追加情報
        if (results.length > displayResults.length) {
          responseMessage += `\n※ ${results.length - displayResults.length} 件の追加結果があります。検索条件を絞り込むか、特定のファイルパスを指定してください。\n`;
        }
      }
      
      // 検索結果を履歴に追加
      this._chatHistory.push({
        role: 'assistant',
        content: responseMessage
      });
      
      return {
        message: responseMessage,
        codeBlocks: []
      };
    } catch (error) {
      Logger.error('検索コマンド実行中にエラーが発生しました', error as Error);
      return this.createErrorResponse(`検索中にエラーが発生しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * ファイル内容を検索
   */
  private async searchFileContents(
    rootPath: string,
    pattern: string
  ): Promise<{ filePath: string, content?: string }[]> {
    try {
      // 再帰的にディレクトリを検索する関数
      const searchDirectory = async (
        dirPath: string,
        pattern: string,
        ignorePatterns: RegExp[] = [/node_modules/, /\.git/, /dist/, /out/]
      ): Promise<{ filePath: string, content?: string }[]> => {
        const results: { filePath: string, content?: string }[] = [];
        
        // ディレクトリ内のファイルとサブディレクトリを取得
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          // 無視するパターンに一致する場合はスキップ
          if (ignorePatterns.some(pattern => pattern.test(fullPath))) {
            continue;
          }
          
          if (entry.isDirectory()) {
            // サブディレクトリを再帰的に検索
            const subResults = await searchDirectory(fullPath, pattern, ignorePatterns);
            results.push(...subResults);
          } else if (entry.isFile()) {
            // テキストファイルのみを検索対象にする
            const ext = path.extname(entry.name).toLowerCase();
            const textExtensions = ['.ts', '.js', '.jsx', '.tsx', '.html', '.css', '.json', '.md', '.txt', '.yml', '.yaml'];
            
            if (textExtensions.includes(ext)) {
              try {
                // ファイル内容を読み込み
                const content = fs.readFileSync(fullPath, 'utf8');
                
                // パターンに一致するか確認
                if (content.includes(pattern)) {
                  // 一致行の周辺を抽出
                  const lines = content.split('\n');
                  const matchingLines: { lineNum: number, line: string }[] = [];
                  
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
                    filePath: fullPath,
                    content: excerpt
                  });
                }
              } catch (error) {
                Logger.error(`ファイル読み込みエラー (${fullPath}): ${(error as Error).message}`);
                // エラー時は内容なしで追加
                results.push({ filePath: fullPath });
              }
            }
          }
        }
        
        return results;
      };
      
      // 検索実行
      return await searchDirectory(rootPath, pattern);
    } catch (error) {
      Logger.error(`ファイル内容検索エラー: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * ファイル名を検索
   */
  private async searchFileNames(
    rootPath: string,
    pattern: string
  ): Promise<{ filePath: string }[]> {
    try {
      // glob パターンに変換
      const globPattern = pattern.includes('*') ? pattern : `**/*${pattern}*`;
      
      // 再帰的にディレクトリを検索する関数
      const searchDirectory = (
        dirPath: string,
        pattern: string,
        ignorePatterns: RegExp[] = [/node_modules/, /\.git/, /dist/, /out/]
      ): { filePath: string }[] => {
        const results: { filePath: string }[] = [];
        
        // 簡易的なglobマッチング実装（実際はもっと複雑）
        const isGlobMatch = (filename: string, pattern: string): boolean => {
          // 単純な * を含むパターンの場合
          if (pattern.includes('*')) {
            const regexPattern = pattern
              .replace(/\./g, '\\.')
              .replace(/\*/g, '.*')
              .replace(/\?/g, '.');
            
            return new RegExp(`^${regexPattern}$`).test(filename);
          }
          
          // 単純な部分一致
          return filename.includes(pattern);
        };
        
        // ディレクトリ内のファイルとサブディレクトリを取得
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          // 無視するパターンに一致する場合はスキップ
          if (ignorePatterns.some(pattern => pattern.test(fullPath))) {
            continue;
          }
          
          if (entry.isDirectory()) {
            // サブディレクトリを再帰的に検索
            const subResults = searchDirectory(fullPath, pattern, ignorePatterns);
            results.push(...subResults);
          } else if (entry.isFile()) {
            // パターンに一致するか確認
            if (isGlobMatch(entry.name, pattern)) {
              results.push({ filePath: fullPath });
            }
          }
        }
        
        return results;
      };
      
      // 検索実行
      return searchDirectory(rootPath, globPattern);
    } catch (error) {
      Logger.error(`ファイル名検索エラー: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * エラーレスポンスを作成
   */
  private createErrorResponse(errorMessage: string): AIResponse {
    const message = `申し訳ありません。${errorMessage}\n\n別の検索条件をお試しください。`;
    
    // エラーメッセージをチャット履歴に追加
    this._chatHistory.push({
      role: 'assistant',
      content: message
    });
    
    return {
      message,
      codeBlocks: []
    };
  }

  /**
   * コードブロックを自動的にファイルに保存
   */
  public async saveCodeBlock(codeBlock: CodeBlock): Promise<boolean> {
    try {
      if (!codeBlock.filename) {
        Logger.warn('ファイル名が指定されていないため、保存をスキップします');
        return false;
      }

      // 設定から実装スコープデータを取得してカスタムパスをチェック
      let customProjectPath = '';
      try {
        // まず開発アシスタントに既に設定されているディレクトリ構造情報をチェック
        if (this._currentDirectory && this._currentDirectory.includes('プロジェクトディレクトリ構造:')) {
          // プロジェクトディレクトリ構造から実際のパスを抽出
          const pathMatch = this._currentDirectory.match(/プロジェクトディレクトリ構造:[\s\n]*([^\s\n]+)/);
          if (pathMatch && pathMatch[1]) {
            const extractedProjectPath = pathMatch[1].trim();
            if (fs.existsSync(extractedProjectPath)) {
              customProjectPath = extractedProjectPath;
              Logger.info(`ディレクトリ構造情報から抽出したパスを使用: ${customProjectPath}`);
            }
          }
        }
        
        // ディレクトリ構造から取得できなかった場合は設定から取得
        if (!customProjectPath) {
          const scopeData = vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope');
          if (scopeData) {
            // scopeDataがオブジェクトとして取得される場合
            if (typeof scopeData === 'object' && scopeData !== null) {
              if ((scopeData as any).projectPath) {
                customProjectPath = (scopeData as any).projectPath;
                Logger.info(`カスタムプロジェクトパス(オブジェクト)を使用: ${customProjectPath}`);
              }
            } 
            // scopeDataが文字列として取得される場合
            else if (typeof scopeData === 'string' && scopeData !== '') {
              try {
                const parsedData = JSON.parse(scopeData);
                if (parsedData && parsedData.projectPath) {
                  customProjectPath = parsedData.projectPath;
                  Logger.info(`カスタムプロジェクトパス(文字列)を使用: ${customProjectPath}`);
                }
              } catch (parseError) {
                Logger.error('実装スコープJSONパースエラー:', parseError as Error);
              }
            }
          }
        }
        
        // customProjectPathが見つかった場合、存在確認とログ出力
        if (customProjectPath) {
          if (fs.existsSync(customProjectPath)) {
            Logger.info(`検証済みカスタムパス: ${customProjectPath} (存在します)`);
          } else {
            Logger.warn(`無効なカスタムパス: ${customProjectPath} (存在しません)`);
            customProjectPath = ''; // 無効なパスはリセット
          }
        }
      } catch (error) {
        Logger.error('実装スコープからのプロジェクトパス取得エラー:', error as Error);
      }

      // ファイルパスを取得（絶対パスでない場合はプロジェクトルートからの相対パスとして扱う）
      let filePath = codeBlock.filename;
      if (!path.isAbsolute(filePath)) {
        // カスタムパスがある場合はそれを使用、そうでなければワークスペースフォルダ
        if (customProjectPath && fs.existsSync(customProjectPath)) {
          filePath = path.join(customProjectPath, filePath);
        } else {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders) {
            throw new Error('ワークスペースが開かれていません');
          }
          filePath = path.join(workspaceFolders[0].uri.fsPath, filePath);
        }
      }

      // ファイルを保存
      await this._fileManager.createFile(filePath, codeBlock.code);
      Logger.info(`コードブロックをファイルに保存しました: ${filePath}`);
      
      return true;
    } catch (error) {
      Logger.error(`コードブロックの保存中にエラーが発生しました: ${error}`);
      return false;
    }
  }

  /**
   * AIの応答からコードブロックを抽出
   */
  private extractCodeBlocks(response: string): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    
    // コードブロック抽出の正規表現
    const regex = /```([\w-]+)(?:\s+([^\n]+))?\n([\s\S]*?)```/g;
    
    let match;
    while ((match = regex.exec(response)) !== null) {
      const language = match[1].trim();
      const filenameOrEmpty = match[2] ? match[2].trim() : '';
      const code = match[3];
      
      // ファイル名が直接指定されているか確認
      if (filenameOrEmpty) {
        codeBlocks.push({
          language,
          filename: filenameOrEmpty,
          code
        });
      } else {
        // ファイル名が指定されていない場合は生成
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = this.getExtensionForLanguage(language);
        const filename = `generated-${timestamp}${extension}`;
        
        codeBlocks.push({
          language,
          filename,
          code
        });
      }
    }
    
    return codeBlocks;
  }

  /**
   * 言語に対応する拡張子を取得
   */
  private getExtensionForLanguage(language: string): string {
    const languageMap: { [key: string]: string } = {
      'javascript': '.js',
      'js': '.js',
      'typescript': '.ts',
      'ts': '.ts',
      'html': '.html',
      'css': '.css',
      'json': '.json',
      'python': '.py',
      'py': '.py',
      'java': '.java',
      'c': '.c',
      'cpp': '.cpp',
      'csharp': '.cs',
      'cs': '.cs',
      'go': '.go',
      'ruby': '.rb',
      'php': '.php',
      'swift': '.swift',
      'kotlin': '.kt',
      'rust': '.rs',
      'shell': '.sh',
      'bash': '.sh',
      'sql': '.sql',
      'xml': '.xml',
      'yaml': '.yml',
      'markdown': '.md',
      'md': '.md'
    };
    
    return languageMap[language.toLowerCase()] || '.txt';
  }

  /**
   * チャット履歴をクリア
   */
  public clearChatHistory(): void {
    // システムプロンプトは保持して他をクリア
    const systemPrompt = this._chatHistory.find(msg => msg.role === 'system');
    if (systemPrompt) {
      this._chatHistory = [systemPrompt];
    } else {
      this.initializeSystemPrompt();
    }
    
    Logger.debug('チャット履歴をクリアしました');
  }

  /**
   * フェーズに応じたプロンプトを取得
   */
  public getPhasePrompt(phase: DevelopmentPhase): string {
    // 専用AIサービスからフェーズに応じたプロンプトを取得
    return this._devAIService.getPhasePrompt(phase);
  }
}