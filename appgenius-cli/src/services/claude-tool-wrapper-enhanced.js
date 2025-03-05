/**
 * 強化版 Claude API ツール使用ラッパー
 * 
 * ClaudeCode互換の高度なツール使用パターンを実装
 * 非技術者でも自然言語でツールを使えるよう強化
 */
const { ClaudeService } = require('./claudeService');
const { GlobTool, ViewTool, LSTool, GrepTool, EditTool, ReplaceTool, BashTool } = require('../tools/fileTools');
const path = require('path');
const fs = require('fs');

/**
 * ClaudeCode互換の強化版ClaudeServiceクラス
 * 高度な自動ツール選択と実行の機能を提供
 */
class ClaudeToolWrapperEnhanced extends ClaudeService {
  constructor(options) {
    super(options);
    
    // 元のsendMessageメソッドを保存
    this._originalSendMessage = this.sendMessage;
    
    // sendMessageを上書き
    this.sendMessage = this._wrappedSendMessage;
    
    // APIを使うかどうかのフラグ
    this._useRealAPI = options?.useRealAPI !== false; // デフォルトはtrue
    
    // CLAUDE.mdの自動使用を有効化（メモリ機能）
    this._useMemory = options?.useMemory !== false; // デフォルトはtrue
    this._memoryFilePath = options?.memoryFilePath || path.join(process.cwd(), 'CLAUDE.md');
    this._memoryContent = '';
    
    // 拡張思考モードの設定
    this._useThinking = options?.useThinking || false;
    this._thinkingBudget = options?.thinkingBudget || 4096;
    
    // ログレベル（0=最小, 1=通常, 2=詳細）
    this._verboseLevel = options?.verboseLevel || 1;
    
    // ツール実行の履歴
    this._toolHistory = [];
    
    if (this._verboseLevel > 0) {
      console.log(`ClaudeToolWrapperEnhanced: 初期化完了 (API:${this._useRealAPI ? 'ON' : 'OFF'}, メモリ:${this._useMemory ? 'ON' : 'OFF'}, 拡張思考:${this._useThinking ? 'ON' : 'OFF'})`);
    }
    
    // メモリファイルを読み込み
    this._loadMemoryFile();
    
    // デフォルトツールを自動登録
    this.registerTools([
      new GlobTool(),
      new ViewTool(),
      new LSTool(),
      new GrepTool(),
      new EditTool(),
      new ReplaceTool(),
      new BashTool()
    ]);
  }
  
  /**
   * メモリファイル(CLAUDE.md)を読み込む
   */
  _loadMemoryFile() {
    if (!this._useMemory) return;
    
    try {
      if (fs.existsSync(this._memoryFilePath)) {
        this._memoryContent = fs.readFileSync(this._memoryFilePath, 'utf8');
        
        if (this._verboseLevel > 0) {
          console.log(`メモリファイルを読み込みました: ${this._memoryFilePath}`);
        }
        
        // メモリ内容をシステムプロンプトに追加
        if (this._memoryContent) {
          const currentSystemPrompt = this.getConversation()[0].content;
          const newSystemPrompt = this._addMemoryToSystemPrompt(currentSystemPrompt);
          this.updateSystemPrompt(newSystemPrompt);
        }
      } else if (this._verboseLevel > 1) {
        console.log(`メモリファイルが見つかりません: ${this._memoryFilePath}`);
      }
    } catch (error) {
      if (this._verboseLevel > 0) {
        console.error(`メモリファイルの読み込みに失敗しました: ${error.message}`);
      }
    }
  }
  
  /**
   * メモリ内容をシステムプロンプトに追加 - ClaudeCode互換スタイル
   */
  _addMemoryToSystemPrompt(systemPrompt) {
    if (!this._memoryContent || this._memoryContent.trim() === '') {
      return systemPrompt;
    }
    
    // カテゴリを抽出
    const categories = this._extractCategories(this._memoryContent);
    const hasCategories = Object.keys(categories).length > 0;
    
    // 未分類コンテンツを抽出
    const uncategorizedContent = this._extractUncategorizedContent(this._memoryContent);
    
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
   * メモリ内容からカテゴリとその内容を抽出
   */
  _extractCategories(content) {
    const categories = {};
    const categoryRegex = /##\s+([^\n]+)\n([\s\S]*?)(?=##\s+|$)/g;
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
  _extractUncategorizedContent(content) {
    const firstCategoryIndex = content.indexOf('## ');
    
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
   * CLAUDE.mdファイルにカテゴリを追加または更新
   */
  async updateMemoryCategory(category, content) {
    if (!this._useMemory) return false;
    
    try {
      // 現在のメモリ内容を取得
      let memoryContent = '';
      if (fs.existsSync(this._memoryFilePath)) {
        memoryContent = fs.readFileSync(this._memoryFilePath, 'utf8');
      }
      
      // カテゴリ見出しを作成
      const categoryHeading = `## ${category}`;
      
      // カテゴリが既に存在するか確認
      const categoryRegex = new RegExp(`##\\s*${category}\\s*\n`, 'i');
      let newContent;
      
      if (memoryContent && categoryRegex.test(memoryContent)) {
        // 既存のカテゴリが見つかった場合、そのカテゴリに内容を追加
        const categoryMatch = memoryContent.match(new RegExp(`(##\\s*${category}\\s*\n[\\s\\S]*?)(?=##|$)`, 'i'));
        
        if (categoryMatch) {
          const categoryBlock = categoryMatch[1];
          const updatedCategoryBlock = `## ${category}\n${content}\n\n`;
          newContent = memoryContent.replace(categoryBlock, updatedCategoryBlock);
        } else {
          // 通常はここに来ない
          newContent = `${memoryContent}\n\n${categoryHeading}\n${content}\n\n`;
        }
      } else {
        // カテゴリが存在しない場合、新しいカテゴリを作成
        newContent = memoryContent
          ? `${memoryContent}\n\n${categoryHeading}\n${content}\n\n`
          : `${categoryHeading}\n${content}\n\n`;
      }
      
      // ファイルに書き込み
      const dirPath = path.dirname(this._memoryFilePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(this._memoryFilePath, newContent, 'utf8');
      
      // メモリ内容を更新
      this._memoryContent = newContent;
      
      // システムプロンプトも更新
      const currentSystemPrompt = this.getConversation()[0].content;
      const updatedSystemPrompt = this._addMemoryToSystemPrompt(
        currentSystemPrompt.replace(/<env>[\s\S]*?<\/env>|<context[\s\S]*?<\/context>/g, '')
      );
      this.updateSystemPrompt(updatedSystemPrompt);
      
      if (this._verboseLevel > 0) {
        console.log(`メモリカテゴリ「${category}」を更新しました`);
      }
      
      return true;
    } catch (error) {
      console.error(`メモリの更新に失敗しました: ${error.message}`);
      return false;
    }
  }
  
  // オリジナルのsendMessageを呼ばず直接ダミーレスポンスを返す
  async _getDirectResponse(message) {
    // ダミー応答メッセージの基本セット
    const genericResponses = [
      "ご質問にお答えするために、まずファイルを検索します。",
      "その情報を調べるために、まずツールを使って確認します。",
      "お調べします。ツールを使って検索します。", 
      "その質問に答えるには、まずプロジェクト内を調査する必要があります。",
      "ファイルを確認します。少々お待ちください。"
    ];
    
    // ランダムに選択
    const randomIndex = Math.floor(Math.random() * genericResponses.length);
    return genericResponses[randomIndex];
  }
  
  /**
   * ラップされたsendMessageメソッド
   * APIレスポンスにツール使用を強制的に注入
   */
  async _wrappedSendMessage(message, streamCallback) {
    if (this._verboseLevel > 1) {
      console.log('ClaudeToolWrapperEnhanced: メッセージ送信');
    }
    
    // ダミーレスポンスの設定（API接続が失敗した場合のフォールバック）
    const dummyResponse = "ご質問にお答えするために、まずプロジェクト内を調査します。";
    
    try {
      let originalResponse;
      
      if (this._useRealAPI) {
        // 実際のAPI呼び出し - 拡張思考モードの適用
        try {
          originalResponse = await this._originalSendMessage.call(
            this, 
            message, 
            streamCallback, 
            this._useThinking, 
            this._thinkingBudget
          );
        } catch (apiError) {
          if (this._verboseLevel > 0) {
            console.log(`ClaudeToolWrapperEnhanced: API呼び出しエラー: ${apiError.message}`);
          }
          // APIエラーの場合はダミーレスポンスを使用
          originalResponse = await this._getDirectResponse(message);
        }
      } else {
        // APIを使わずにダミーレスポンスを直接生成
        originalResponse = await this._getDirectResponse(message);
      }
      
      // レスポンスが有効かチェック
      if (!originalResponse) {
        if (this._verboseLevel > 0) {
          console.log('ClaudeToolWrapperEnhanced: APIレスポンスが空です、ダミーレスポンスを使用します');
        }
        return this._injectToolUsage(message, dummyResponse);
      }
      
      // ツール使用パターンが含まれているか確認
      if (originalResponse.includes("<function_calls>")) {
        if (this._verboseLevel > 1) {
          console.log('ClaudeToolWrapperEnhanced: APIレスポンスに既にツール使用パターンが含まれています');
        }
        return originalResponse;
      }
      
      // ツール使用を注入
      return this._injectToolUsage(message, originalResponse);
    } catch (error) {
      // 何らかのエラーが発生した場合もツール使用を注入
      if (this._verboseLevel > 0) {
        console.log(`ClaudeToolWrapperEnhanced: 予期しないエラー: ${error.message}`);
      }
      return this._injectToolUsage(message, dummyResponse);
    }
  }
  
  /**
   * ツール使用を注入する補助メソッド - 原則として常にツールを使うよう強制
   */
  _injectToolUsage(message, response) {
    // ほぼ必ずツール使用を注入する
    const toolUsage = this._determineToolUsage(message, response);
    
    // ツール使用が検出されなかった場合でも、デフォルトでGlobToolを注入
    if (!toolUsage) {
      if (this._verboseLevel > 1) {
        console.log('ClaudeToolWrapperEnhanced: デフォルトツール使用を注入します');
      }
      
      // デフォルトのツール使用（最も一般的なファイル検索）
      const defaultToolUsage = {
        tool: 'GlobTool',
        intro: 'まずプロジェクト内のファイルを検索します。',
        markup: `<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">**/*.{js,ts,md,json}</parameter>
</invoke>
</function_calls>`
      };
      
      const modifiedResponse = `${defaultToolUsage.intro}
${defaultToolUsage.markup}

${response}`;
      
      return modifiedResponse;
    }
    
    // 元のレスポンスの前に、ツール使用パターンを挿入
    if (this._verboseLevel > 1) {
      console.log(`ClaudeToolWrapperEnhanced: ${toolUsage.tool}ツール使用を注入します`);
    }
    
    const modifiedResponse = `${toolUsage.intro}
${toolUsage.markup}

${response}`;
    
    return modifiedResponse;  
  }
  
  /**
   * メッセージとレスポンスからツール使用を判断
   * ClaudeCode互換の高度なパターン検出
   */
  _determineToolUsage(message, response) {
    // 簡易パターンマッチでツール使用を判断
    const messageLC = message.toLowerCase();
    const responseLC = response.toLowerCase();
    
    // CLAUDE.mdファイル操作の特別処理
    if (messageLC.includes('claude.md') || 
        (messageLC.includes('memory') && 
         (messageLC.includes('update') || messageLC.includes('edit') || 
          messageLC.includes('change') || messageLC.includes('modify')))) {
      
      // メモリファイルを検索
      return {
        tool: 'GlobTool',
        intro: 'まずCLAUDE.mdファイルを検索します。',
        markup: `<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">**/CLAUDE.md</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // 要件定義に関する質問
    if (messageLC.includes('要件') || 
        (messageLC.includes('requirement') && !messageLC.includes('requirements.txt'))) {
      
      // CLAUDE.mdファイルを検索し、要件セクションを調査
      return {
        tool: 'dispatch_agent',
        intro: '要件定義情報を調査します。',
        markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">1. プロジェクト内のCLAUDE.mdファイルを検索してください。
2. ファイルが見つかったら、その内容を読み、要件や仕様に関するセクションを特定してください。
3. 仕様や設計方針に関する情報もあれば抽出してください。
4. 見つかった情報を整理して要約してください。</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // モックアップに関する質問
    if (messageLC.includes('モックアップ') || messageLC.includes('mockup') || 
        messageLC.includes('デザイン') || messageLC.includes('ui') || 
        messageLC.includes('レイアウト')) {
      
      // モックアップ情報を調査
      return {
        tool: 'dispatch_agent',
        intro: 'モックアップ情報を調査します。',
        markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">1. CLAUDE.mdファイルを探し、Mockupsセクションがあるか確認してください。
2. また、プロジェクト内のデザインに関連するファイル(*.png, *.jpg, *.svg, *.html)も検索してください。
3. 見つかった情報からUIデザインやレイアウトに関する情報を整理してください。</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // ディレクトリ構造に関する質問
    if (messageLC.includes('ディレクトリ構造') || 
        (messageLC.includes('directory') && messageLC.includes('structure')) || 
        messageLC.includes('フォルダ構成')) {
      
      // ディレクトリ構造情報を調査
      return {
        tool: 'dispatch_agent',
        intro: 'ディレクトリ構造を調査します。',
        markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">1. CLAUDE.mdファイルを探し、Directory Structureセクションがあるか確認してください。
2. プロジェクトの主要ディレクトリをLSコマンドで調査してください。
3. 主要なソースコードディレクトリ（src/, lib/, app/等）があればその内部構造も調査してください。
4. 見つかった情報からプロジェクトのディレクトリ構造を整理し、各ディレクトリの役割を説明してください。</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // マークダウンファイル検索と詳細分析
    if ((messageLC.includes('マークダウン') || messageLC.includes('md')) && 
        (messageLC.includes('調査') || messageLC.includes('詳しく') || 
         messageLC.includes('全て') || messageLC.includes('全部'))) {
      
      return {
        tool: 'dispatch_agent',
        intro: 'マークダウンファイルを詳しく調査します。',
        markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">プロジェクト内のマークダウンファイル(*.md)を検索し、見つかったファイルの一覧とその内容の概要を詳しく調査してください。必要に応じてGlobTool、GrepTool、ViewToolを使用して、ファイルの位置、名前、内容を分析してください。特に以下の点に注目してください：
1. READMEファイルの内容
2. ドキュメントディレクトリ内のマークダウンファイル
3. 技術的な説明や設計ドキュメント</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // プロジェクト全体分析
    if (messageLC.includes('プロジェクト分析') || 
        (messageLC.includes('analyze') && messageLC.includes('project')) || 
        messageLC.includes('アーキテクチャ') || 
        messageLC.includes('全体構成')) {
      
      return {
        tool: 'dispatch_agent',
        intro: 'プロジェクト全体を分析します。',
        markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">プロジェクト全体を分析してください。以下の点に注目して調査を進めてください：
1. ディレクトリ構造と主要ファイル
2. 使用されているフレームワークや主要ライブラリ（package.jsonなど）
3. 主要なコンポーネントやモジュール
4. アーキテクチャパターン
5. 設計原則やコーディング規約
必要に応じてLS、GlobTool、GrepTool、ViewToolを使い分けて効率的に調査してください。</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // デバッグ関連の質問
    if (messageLC.includes('デバッグ') || messageLC.includes('debug') || 
        messageLC.includes('エラー') || messageLC.includes('error') || 
        messageLC.includes('バグ') || messageLC.includes('bug')) {
      
      // エラーメッセージの検出
      let errorPattern = 'error|exception|warning|failed|undefined is not|cannot read|null object';
      if (messageLC.includes('typescript') || messageLC.includes('ts')) {
        errorPattern = 'TS\\d+|type.*error|Property.*does not exist';
      } else if (messageLC.includes('javascript') || messageLC.includes('js')) {
        errorPattern = 'TypeError|ReferenceError|SyntaxError|undefined is not|cannot read';
      }
      
      return {
        tool: 'dispatch_agent',
        intro: 'エラーの原因を調査します。',
        markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">エラーの原因を調査します。以下の手順で進めてください：
1. エラーメッセージに関連するキーワードでコードを検索（GrepToolを使用）
2. 関連するファイルの内容を確認（ViewToolを使用）
3. エラーの文脈を理解し、問題箇所を特定
4. 同様のパターンや関連コードも確認

検索パターン: ${errorPattern}
特に関連ファイルやエラーログに注目してください。</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // ディレクトリ構造やプロジェクト構成に関する質問
    if (messageLC.includes('ディレクトリ') || messageLC.includes('構造') || 
        messageLC.includes('プロジェクト') || messageLC.includes('構成')) {
      return {
        tool: 'dispatch_agent',
        intro: 'プロジェクト構造を調査します。',
        markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">プロジェクトのディレクトリ構造を分析してください。主要なディレクトリとそれぞれの役割、重要なファイルとその機能について調査してください。LSとGlobToolを組み合わせて使用し、体系的に調査を進めてください。特に以下の点に注目してください：
1. ソースコードディレクトリ（src/など）の構造
2. 設定ファイル（package.json、tsconfig.jsonなど）
3. ドキュメントディレクトリ
4. テストディレクトリ
5. アセットディレクトリ
それぞれの役割と関係性を明確にまとめてください。</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // 「どのファイル」という質問パターン
    if (messageLC.includes('どのファイル')) {
      // 検索キーワードを抽出
      let searchKeyword = '';
      
      // 単語マッチ
      const keywordMatch = message.match(/「([^」]+)」|"([^"]+)"|'([^']+)'/);
      if (keywordMatch) {
        searchKeyword = keywordMatch[1] || keywordMatch[2] || keywordMatch[3] || '';
      } else {
        // 特定の単語の後の部分を抽出
        const parts = messageLC.split(/には|に|が|を/);
        if (parts.length > 1) {
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (part && !part.includes('どのファイル') && part.length > 2) {
              searchKeyword = part;
              break;
            }
          }
        }
      }
      
      // デフォルトキーワードがなければ一般的なGrepを使用
      if (!searchKeyword || searchKeyword.length < 2) {
        return {
          tool: 'GrepTool',
          intro: '関連ファイルを検索します。',
          markup: `<function_calls>
<invoke name="GrepTool">
<parameter name="pattern">function|class|const|import</parameter>
<parameter name="include">*.{js,ts}</parameter>
</invoke>
</function_calls>`
        };
      }
      
      // 詳細な検索はdispatch_agentを活用
      return {
        tool: 'dispatch_agent',
        intro: `"${searchKeyword}" に関連するファイルを詳細に検索します。`,
        markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">"${searchKeyword}" に関連するファイルを検索してください。以下の手順で調査を進めてください：
1. まずファイル名に "${searchKeyword}" が含まれるファイルをGlobToolで検索
2. 次にファイル内容に "${searchKeyword}" が含まれるファイルをGrepToolで検索
3. 最も関連性が高そうなファイルの内容をViewToolで確認
4. "${searchKeyword}" がどのような文脈で使われているかを分析

複数の検索手法を組み合わせて、最も関連性の高いファイルを特定してください。</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // ファイル名指定パターン
    if (messageLC.includes('package.json') || messageLC.includes('tsconfig') || 
        messageLC.includes('readme') || messageLC.includes('config')) {
      
      let fileName = 'package.json'; // デフォルト
      
      if (messageLC.includes('tsconfig')) fileName = 'tsconfig.json';
      else if (messageLC.includes('readme')) fileName = 'README.md';
      else if (messageLC.includes('webpack')) fileName = 'webpack.config.js';
      
      // ViewToolの自動使用も想定
      if (messageLC.includes('内容') || messageLC.includes('中身') || 
          messageLC.includes('見せて') || messageLC.includes('表示')) {
        return {
          tool: 'dispatch_agent',
          intro: `${fileName}ファイルを検索して内容を表示します。`,
          markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">1. まず**/${fileName}パターンでファイルを検索してください。
2. 見つかったファイルの内容を表示し、その主要な設定や内容を分析してください。
3. 複数のファイルが見つかった場合は、最も関連性が高いものを優先的に分析してください。</parameter>
</invoke>
</function_calls>`
        };
      }
      
      return {
        tool: 'GlobTool',
        intro: `${fileName}ファイルを検索します。`,
        markup: `<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">**/${fileName}</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // マークダウン検索の一般パターン
    if (messageLC.includes('マークダウン') || messageLC.includes('.md') || messageLC.includes('md')) {
      // 内容表示も要求されている場合
      if (messageLC.includes('内容') || messageLC.includes('中身') || 
          messageLC.includes('見せて') || messageLC.includes('表示')) {
        return {
          tool: 'dispatch_agent',
          intro: 'マークダウンファイルを検索して内容を表示します。',
          markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">1. まずプロジェクト内のマークダウンファイル(*.md)を検索してください。
2. 検索結果から最も重要そうなファイル（README.mdなど）を特定してください。
3. 特定したファイルの内容を表示し、その主要なポイントをまとめてください。</parameter>
</invoke>
</function_calls>`
        };
      }
      
      return {
        tool: 'GlobTool',
        intro: 'マークダウンファイルを検索します。',
        markup: `<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">**/*.md</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // JavaScriptファイル検索パターン
    if (messageLC.includes('javascript') || messageLC.includes('js') || 
        messageLC.includes('typescript') || messageLC.includes('ts')) {
      
      let pattern = '**/*.{js,ts}';
      let intro = 'スクリプトファイルを検索します。';
      
      if (messageLC.includes('javascript') || messageLC.includes('js')) {
        pattern = '**/*.js';
        intro = 'JavaScriptファイルを検索します。';
      } else if (messageLC.includes('typescript') || messageLC.includes('ts')) {
        pattern = '**/*.ts';
        intro = 'TypeScriptファイルを検索します。';
      }
      
      // 詳細分析の要求がある場合
      if (messageLC.includes('詳しく') || messageLC.includes('分析') || 
          messageLC.includes('調査') || messageLC.includes('全て')) {
        return {
          tool: 'dispatch_agent',
          intro: `${intro.replace('検索', '分析')}`,
          markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">プロジェクト内の${pattern}パターンに一致するファイルを検索し、その構造と内容を分析してください。
1. まずファイルの一覧を取得
2. 主要なファイル（エントリーポイント、重要なクラス/関数を含むファイルなど）を特定
3. それらのファイルの内容を確認し、コードの構造や設計パターンを分析
4. 主要なクラス、関数、インポート関係などを特定

特に以下の点に注目してください：
- メインのエントリーポイント
- 主要なクラス/関数の定義
- モジュール間の依存関係
- 使用されているデザインパターン</parameter>
</invoke>
</function_calls>`
        };
      }
      
      return {
        tool: 'GlobTool',
        intro,
        markup: `<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">${pattern}</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // 一般的なファイル検索パターン（最も広範なケース）
    if (messageLC.includes('ファイル') && (messageLC.includes('探') || messageLC.includes('検索'))) {
      // ファイル種類を抽出
      let filePattern = '**/*';
      let fileType = '全ての';
      
      if (messageLC.includes('md') || messageLC.includes('markdown') || messageLC.includes('マークダウン')) {
        filePattern = '**/*.md';
        fileType = 'マークダウン';
      } else if (messageLC.includes('js') || messageLC.includes('javascript')) {
        filePattern = '**/*.js';
        fileType = 'JavaScript';
      } else if (messageLC.includes('ts') || messageLC.includes('typescript')) {
        filePattern = '**/*.ts';
        fileType = 'TypeScript';
      } else if (messageLC.includes('json')) {
        filePattern = '**/*.json';
        fileType = 'JSON';
      } else if (messageLC.includes('yaml') || messageLC.includes('yml')) {
        filePattern = '**/*.{yaml,yml}';
        fileType = 'YAML';
      } else if (messageLC.includes('html')) {
        filePattern = '**/*.html';
        fileType = 'HTML';
      } else if (messageLC.includes('css')) {
        filePattern = '**/*.css';
        fileType = 'CSS';
      }
      
      // エージェントを使用するケース
      if (messageLC.includes('詳しく') || messageLC.includes('全て') || messageLC.includes('全部')) {
        return {
          tool: 'dispatch_agent',
          intro: `${fileType}ファイルを詳しく分析します。`,
          markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">以下のファイルパターンに一致するファイルを検索し、見つかったファイルの一覧とその内容の概要を教えてください: ${filePattern}。

分析手順:
1. 対象ファイルのリストを取得（GlobToolを使用）
2. ファイルの数や種類に応じた分析戦略を立てる
3. 代表的なファイルを選び、その内容を確認（ViewToolを使用）
4. ファイル間の関連性や全体の構造を分析
5. 重要なパターンや共通項を特定

必要に応じてGlobTool、GrepTool、ViewToolを組み合わせて使い、効率的に調査を進めてください。</parameter>
</invoke>
</function_calls>`
        };
      }
      
      return {
        tool: 'GlobTool',
        intro: `${fileType}ファイルを検索します。`,
        markup: `<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">${filePattern}</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // 内容検索関連
    if (messageLC.includes('内容') || messageLC.includes('中身') || 
        messageLC.includes('コード') || messageLC.includes('実装')) {
      
      // 検索パターンを検出
      let searchPattern = '';
      
      // wordパターンから検索ワードを抽出する簡易的な処理
      const wordMatch = message.match(/「([^」]+)」|"([^"]+)"|'([^']+)'/);
      if (wordMatch) {
        searchPattern = wordMatch[1] || wordMatch[2] || wordMatch[3] || '';
      } else if (messageLC.includes('関数') || messageLC.includes('function')) {
        searchPattern = 'function';
      } else if (messageLC.includes('クラス') || messageLC.includes('class')) {
        searchPattern = 'class';
      } else if (messageLC.includes('import')) {
        searchPattern = 'import';
      } else if (messageLC.includes('export')) {
        searchPattern = 'export';
      } else if (messageLC.includes('const')) {
        searchPattern = 'const';
      } else if (messageLC.includes('interface')) {
        searchPattern = 'interface';
      }
      
      // デフォルトパターン
      if (!searchPattern) {
        searchPattern = 'function|class|const|import';
      }
      
      // 詳細分析が必要な場合
      if (messageLC.includes('詳しく') || messageLC.includes('全て') || 
          messageLC.includes('分析') || messageLC.includes('調査')) {
        return {
          tool: 'dispatch_agent',
          intro: `"${searchPattern}" を含むコードを詳細に分析します。`,
          markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">"${searchPattern}" を含むコードを詳細に検索・分析してください。以下の手順で調査を進めてください：

1. まず "${searchPattern}" を含むファイルをGrepToolで幅広く検索
2. 検索結果を分析し、最も関連性の高いファイルを特定
3. 特定したファイルの全体の内容を確認（ViewToolを使用）
4. "${searchPattern}" がどのような文脈で使われているか詳細に分析
5. 関連するインポートや依存関係も調査

"${searchPattern}" の使用パターン、引数、返り値、呼び出し元など、コードの構造や設計についても分析してください。</parameter>
</invoke>
</function_calls>`
        };
      }
      
      return {
        tool: 'GrepTool',
        intro: `"${searchPattern}" を含むファイルを検索します。`,
        markup: `<function_calls>
<invoke name="GrepTool">
<parameter name="pattern">${searchPattern}</parameter>
<parameter name="include">*.{js,ts,md,json}</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // ディレクトリ一覧
    if (messageLC.includes('ディレクトリ') || messageLC.includes('フォルダ') || 
        messageLC.includes('一覧') || messageLC.includes('ls')) {
      // 特定のディレクトリが指定されている場合
      const dirMatch = message.match(/「([^」]+)」|"([^"]+)"|'([^']+)'/);
      let targetDir = process.cwd();
      
      if (dirMatch) {
        const specifiedDir = dirMatch[1] || dirMatch[2] || dirMatch[3] || '';
        if (specifiedDir) {
          targetDir = path.isAbsolute(specifiedDir) ? 
            specifiedDir : 
            path.join(process.cwd(), specifiedDir);
        }
      } else if (messageLC.includes('src')) {
        targetDir = path.join(process.cwd(), 'src');
      } else if (messageLC.includes('lib')) {
        targetDir = path.join(process.cwd(), 'lib');
      } else if (messageLC.includes('test')) {
        targetDir = path.join(process.cwd(), 'test');
      } else if (messageLC.includes('docs')) {
        targetDir = path.join(process.cwd(), 'docs');
      }
      
      return {
        tool: 'LS',
        intro: `${targetDir === process.cwd() ? 'カレント' : targetDir}ディレクトリの内容を一覧表示します。`,
        markup: `<function_calls>
<invoke name="LS">
<parameter name="path">${targetDir}</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // 一般的なコード検索（ClaudeCode互換の強化版）
    if (messageLC.includes('検索') || messageLC.includes('探して') || 
        messageLC.includes('find') || messageLC.includes('search')) {
      
      // 検索キーワードを抽出
      let searchPattern = '';
      const keywordMatch = message.match(/「([^」]+)」|"([^"]+)"|'([^']+)'/);
      
      if (keywordMatch) {
        searchPattern = keywordMatch[1] || keywordMatch[2] || keywordMatch[3] || '';
      }
      
      if (!searchPattern) {
        // 特定のパターンに一致する部分を検出
        const patterns = [
          'function', 'class', 'const', 'let', 'var', 'import', 'export',
          'interface', 'type', 'enum', 'namespace', 'module', 'async',
          'component', 'hook', 'service', 'controller', 'model', 'view',
          'router', 'middleware', 'plugin', 'extension'
        ];
        
        for (const pattern of patterns) {
          if (messageLC.includes(pattern)) {
            searchPattern = pattern;
            break;
          }
        }
      }
      
      // 言語フィルター
      let include = '*.{js,ts,jsx,tsx,md,json}';
      if (messageLC.includes('javascript') || messageLC.includes(' js ')) {
        include = '*.{js,jsx}';
      } else if (messageLC.includes('typescript') || messageLC.includes(' ts ')) {
        include = '*.{ts,tsx}';
      } else if (messageLC.includes('markdown') || messageLC.includes(' md ')) {
        include = '*.md';
      }
      
      // 検索パターンが見つからない場合はエージェントを使用
      if (!searchPattern) {
        return {
          tool: 'dispatch_agent',
          intro: 'プロジェクト内を検索します。',
          markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">ユーザーの質問に基づいて、プロジェクト内で関連するコードや情報を検索してください。
まずユーザーの質問を分析し、主要なキーワードや概念を特定してください。
それから、以下の手順でプロジェクト内を検索してください：

1. 関連するファイル名のパターンをGlobToolで検索
2. 関連するコード内キーワードをGrepToolで検索
3. 見つかったファイルの内容をViewToolで確認

特に主要なソースコードディレクトリ（src/など）に注目し、最も関連性の高い情報を見つけることを目指してください。</parameter>
</invoke>
</function_calls>`
        };
      }
      
      // 詳細分析の要求がある場合
      if (messageLC.includes('詳しく') || messageLC.includes('全て') || 
          messageLC.includes('分析') || messageLC.includes('細かく')) {
        return {
          tool: 'dispatch_agent',
          intro: `"${searchPattern}" の詳細な検索と分析を行います。`,
          markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">"${searchPattern}" に関するコードや情報を詳細に検索・分析してください。
以下の手順で調査を進めてください：

1. "${searchPattern}" を含むファイルをGrepToolで検索
2. 検索結果を分析し、関連性の高いファイルを特定
3. 特定したファイルの全体の内容を確認
4. "${searchPattern}" がどのように実装・使用されているか詳細に分析
5. 関連するインポートや依存関係も調査

必要に応じてGrepTool、ViewTool、LSを組み合わせて使い、徹底的に調査してください。
include: ${include}</parameter>
</invoke>
</function_calls>`
        };
      }
      
      return {
        tool: 'GrepTool',
        intro: `"${searchPattern}" を含むファイルを検索します。`,
        markup: `<function_calls>
<invoke name="GrepTool">
<parameter name="pattern">${searchPattern}</parameter>
<parameter name="include">${include}</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // 実装項目に関する質問
    if (messageLC.includes('実装') || 
        (messageLC.includes('implement') && !messageLC.includes('implementation.js'))) {
      
      // CLAUDE.mdファイルを検索し、実装関連情報を調査
      return {
        tool: 'dispatch_agent',
        intro: '実装項目情報を調査します。',
        markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">1. プロジェクト内のCLAUDE.mdファイルを検索してください。
2. ファイルが見つかったら、その内容を読み、実装項目や機能リストに関するセクションを特定してください。
3. 実装済みの機能と未実装の機能を区別できる情報があれば抽出してください。
4. 実装の優先順位や進捗状況に関する情報があれば抽出してください。
5. 見つかった情報を整理して要約してください。

また、src/directoryやapp/directoryなど、主要なソースコードディレクトリの構造も調査し、実装されている機能との対応関係を確認してください。</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // デフォルトでnullを返さず、ハイブリッドなアプローチを使用
    // ClaudeCode互換の強化されたデフォルト検索
    return {
      tool: 'dispatch_agent',
      intro: 'プロジェクト内を検索して情報を収集します。',
      markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">ユーザーの質問に答えるために必要な情報を収集してください。以下の手順で調査を進めてください：

1. まず、プロジェクトの基本構造を把握するため、主要なディレクトリをLSツールで確認してください。
2. 重要な設定ファイル（package.json、tsconfig.jsonなど）があれば、それらをViewツールで確認してください。
3. README.mdなどのドキュメントファイルがあれば、それらも確認してください。
4. ユーザーの質問に関連しそうなキーワードでGrepToolを使用して検索してください。
5. 見つかった情報を整理し、ユーザーの質問に適切な回答を提供してください。

必要に応じてGlobTool、GrepTool、ViewTool、LSを組み合わせて使い、効率的に情報を収集してください。</parameter>
</invoke>
</function_calls>`
    };
  }
  
  /**
   * ClaudeCode互換の高度なツール実行
   * 先行的な検索とコンテキスト理解を強化
   */
  async detectAndExecuteTools(message, streamCallback) {
    try {
      // 拡張思考モードが有効の場合は直接detectAndExecuteToolsを呼び出し
      if (this._useThinking) {
        const originalResult = await super.detectAndExecuteTools(
          message, 
          streamCallback,
          true,  // 拡張思考モードを有効化
          this._thinkingBudget
        );
        return originalResult;
      }
      
      // ラップされたメソッドの場合は、ツール使用を強化して検出・実行
      if (this._useRealAPI) {
        const result = await super.detectAndExecuteTools(message, streamCallback);
        
        // ツール実行履歴を更新
        if (result.toolResults) {
          for (const toolResult of result.toolResults) {
            this._toolHistory.push({
              toolName: toolResult.toolName,
              success: toolResult.success,
              timestamp: Date.now()
            });
          }
        }
        
        return result;
      } else {
        // APIを使わない場合はダミーレスポンスを返す
        const dummyResult = {
          responseText: await this._getDirectResponse(message),
          toolResults: []
        };
        return dummyResult;
      }
    } catch (error) {
      console.error(`ツール使用検出中にエラーが発生しました: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { ClaudeToolWrapperEnhanced };

module.exports = { ClaudeToolWrapperEnhanced };