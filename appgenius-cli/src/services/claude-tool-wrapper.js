/**
 * Claude API強制ツール使用ラッパー
 * 
 * 通常のClaudeサービスを拡張して、ツール使用をエミュレートします。
 * 実際のAPIでツール使用が動作しない場合に、強制的にツール使用パターンを注入します。
 */
const { ClaudeService } = require('./claudeService');
const { GlobTool, ViewTool, LSTool, GrepTool } = require('../tools/fileTools');

/**
 * 拡張版ClaudeServiceクラス
 */
class ClaudeToolWrapper extends ClaudeService {
  constructor(options) {
    super(options);
    
    // 元のsendMessageメソッドを保存
    this._originalSendMessage = this.sendMessage;
    
    // sendMessageを上書き
    this.sendMessage = this._wrappedSendMessage;
    
    // handleToolsメソッドをオーバーライドして、APIを使わないモードも追加
    this._useRealAPI = options?.useRealAPI !== false; // デフォルトはtrue
    
    console.log(`ClaudeToolWrapper: ツール使用ラッパー初期化しました (API ${this._useRealAPI ? '使用' : '不使用'})`);
    
    // デフォルトツールを自動登録
    this.registerTools([
      new GlobTool(),
      new ViewTool(),
      new LSTool(),
      new GrepTool()
    ]);
  }
  
  // オリジナルのsendMessageを呼ばず直接ダミーレスポンスを返す
  async _getDirectResponse(message) {
    // メッセージパターンに基づいてレスポンスをカスタマイズ
    const messageLC = message.toLowerCase();
    
    if (messageLC.includes("マークダウン") || messageLC.includes("md") || messageLC.includes(".md")) {
      return "マークダウンファイルを検索しています。結果は以下の通りです。";
    } else if (messageLC.includes("ファイル") && (messageLC.includes("探") || messageLC.includes("検索"))) {
      return "指定されたファイルを検索しています。";
    } else if (messageLC.includes("表示") || messageLC.includes("内容") || messageLC.includes("見せて")) {
      return "ファイル内容を表示します。";
    } else if (messageLC.includes("ディレクトリ") || messageLC.includes("フォルダ") || messageLC.includes("一覧")) {
      return "ディレクトリ内容を表示します。";
    }
    
    // ダミー応答メッセージの基本セット
    const genericResponses = [
      "了解しました、それについて調べてみます。",
      "お任せください、確認してみます。",
      "調査してみますね、少々お待ちください。", 
      "ご質問について調べてみます。",
      "ファイルを確認してみますね。"
    ];
    
    // ランダムに選択
    const randomIndex = Math.floor(Math.random() * genericResponses.length);
    return genericResponses[randomIndex];
  }
  
  /**
   * 自然言語の指示を具体的なツール指示に拡張する
   * 簡易的な拡張思考ロジックを実装
   */
  async _enhanceUserQuery(message) {
    // 既に明示的なツール使用パターンや具体的な指示の場合はそのまま返す
    if (message.includes("GlobTool") || message.includes("GrepTool") || 
        message.includes("View") || message.includes("LS") ||
        message.includes("<function_calls>")) {
      return message;
    }
    
    const messageLC = message.toLowerCase();
    
    // ファイル検索関連の拡張
    if ((messageLC.includes('ファイル') || messageLC.includes('md') || 
         messageLC.includes('マークダウン') || messageLC.includes('探') || 
         messageLC.includes('検索'))) {
      
      console.log('ファイル検索関連のクエリを拡張します');
      
      // ファイル種類を抽出
      let fileType = 'すべて';
      let filePattern = '**/*';
      
      if (messageLC.includes('md') || messageLC.includes('マークダウン')) {
        fileType = 'マークダウン';
        filePattern = '**/*.md';
      } else if (messageLC.includes('json')) {
        fileType = 'JSON';
        filePattern = '**/*.json';
      } else if (messageLC.includes('js') || messageLC.includes('javascript')) {
        fileType = 'JavaScript';
        filePattern = '**/*.js';
      } else if (messageLC.includes('ts') || messageLC.includes('typescript')) {
        fileType = 'TypeScript';
        filePattern = '**/*.ts';
      }
      
      // 詳細度に応じた拡張指示の作成
      if (messageLC.includes('詳しく') || messageLC.includes('全て') || messageLC.includes('全部')) {
        return `以下の手順で${fileType}ファイルを詳しく調査してください:
1. まず GlobTool を使って \`${filePattern}\` パターンでファイルを検索
2. 見つかったファイルの内容を View ツールで確認
3. 特に重要な情報（設定、構造など）があれば抽出
4. ファイル間の関連性を分析
5. 全体的な概要と詳細をまとめて報告`;
      } else {
        return `${fileType}ファイルを検索するために GlobTool を使って \`${filePattern}\` パターンで検索してください。見つかったファイルの一覧とその基本情報を教えてください。`;
      }
    }
    
    // コード内容検索の拡張
    if (messageLC.includes('コード') || messageLC.includes('内容') || 
        messageLC.includes('使われている') || messageLC.includes('含まれる') ||
        (messageLC.includes('検索') && !messageLC.includes('ファイル'))) {
      
      console.log('コード内容検索のクエリを拡張します');
      
      // 検索語句を抽出
      let searchTerm = '';
      
      // 引用符で囲まれたキーワードを検索
      const wordMatch = message.match(/「([^」]+)」|"([^"]+)"|'([^']+)'/);
      if (wordMatch) {
        searchTerm = wordMatch[1] || wordMatch[2] || wordMatch[3] || '';
      }
      
      // 特定のパターンに一致する単語を検索
      if (!searchTerm) {
        const keywordMatch = message.match(/(\w+)って(単語|キーワード|コード|部分|箇所)|(単語|キーワード|コード|部分|箇所)(として|が使われている)(\w+)/);
        if (keywordMatch) {
          searchTerm = keywordMatch[1] || keywordMatch[5] || '';
        }
      }
      
      // 特定のキーワードがある場合
      if (!searchTerm) {
        if (messageLC.includes('logger')) {
          searchTerm = 'logger';
        } else if (messageLC.includes('関数') || messageLC.includes('function')) {
          searchTerm = 'function';
        } else if (messageLC.includes('クラス') || messageLC.includes('class')) {
          searchTerm = 'class';
        } else if (messageLC.includes('import')) {
          searchTerm = 'import';
        } else if (messageLC.includes('export')) {
          searchTerm = 'export';
        } else if (messageLC.includes('tool')) {
          searchTerm = 'tool';
        }
      }
      
      if (searchTerm) {
        return `コード内で「${searchTerm}」を検索するために GrepTool を使って:
1. パターン「${searchTerm}」でコードベースを検索
2. 関連ファイルを特定
3. 見つかった箇所の周辺コードの文脈を含めて表示
4. 検索結果をわかりやすく整理して説明`;
      }
      
      // searchTermが特定できない場合でもデフォルトのGrep処理を提供
      if (!searchTerm && (messageLC.includes('コード検索') || messageLC.includes('内容検索'))) {
        // 最後の手段として重要そうな単語を抽出
        const words = message.split(/\s+/).filter(w => w.length > 3);
        if (words.length > 0) {
          // 最も長い単語を選択
          searchTerm = words.reduce((a, b) => a.length > b.length ? a : b);
          return `コード内で「${searchTerm}」を検索するために GrepTool を使って:
1. パターン「${searchTerm}」でコードベースを検索
2. 関連ファイルを特定
3. 見つかった箇所の周辺コードの文脈を含めて表示
4. 検索結果をわかりやすく整理して説明`;
        }
      }
    }
    
    // ディレクトリ一覧関連の拡張
    if (messageLC.includes('ディレクトリ') || messageLC.includes('フォルダ') || 
        messageLC.includes('一覧') || messageLC.includes('ls')) {
      
      console.log('ディレクトリ一覧関連のクエリを拡張します');
      
      // ディレクトリパスを抽出
      let dirPath = process.cwd();
      const pathMatch = message.match(/「([^」]+)」|"([^"]+)"|'([^']+)'/);
      
      if (pathMatch) {
        const matchedPath = pathMatch[1] || pathMatch[2] || pathMatch[3] || '';
        if (matchedPath) {
          dirPath = matchedPath;
        }
      } else {
        // パスらしき文字列を探す
        const words = message.split(/\s+/);
        for (const word of words) {
          if (word.includes('/') || word.includes('\\')) {
            dirPath = word;
            break;
          }
        }
      }
      
      return `LS ツールを使って ${dirPath} ディレクトリの内容を一覧表示し、以下の情報をまとめてください:
1. サブディレクトリとファイルの構造
2. 主要なファイルタイプの分布
3. 特に注目すべきファイル（設定ファイル、READMEなど）
4. ディレクトリ構造から推測されるプロジェクトの構成`;
    }
    
    // ファイル表示関連の拡張
    if (messageLC.includes('表示') || messageLC.includes('中身') || 
        messageLC.includes('内容') || messageLC.includes('開く')) {
      
      console.log('ファイル表示関連のクエリを拡張します');
      
      // ファイル名を抽出
      let fileName = '';
      const fileMatch = message.match(/「([^」]+\.\w+)」|"([^"]+\.\w+)"|'([^']+\.\w+)'/);
      
      if (fileMatch) {
        fileName = fileMatch[1] || fileMatch[2] || fileMatch[3] || '';
      } else {
        // 拡張子を含む単語を探す
        const words = message.split(/\s+/);
        for (const word of words) {
          if (word.includes('.') && !word.startsWith('http')) {
            fileName = word;
            break;
          }
        }
      }
      
      if (fileName) {
        return `View ツールを使って ${fileName} ファイルの内容を表示し、以下のポイントを解説してください:
1. ファイルの全体的な目的と役割
2. 主要な機能やコンポーネント
3. 重要な設定や定義
4. 他のファイルとの関連性`;
      }
    }
    
    // デフォルトの場合は元のメッセージを返す
    return message;
  }

  /**
   * ラップされたsendMessageメソッド
   * APIレスポンスにツール使用を強制的に注入
   */
  async _wrappedSendMessage(message) {
    console.log('ClaudeToolWrapper: メッセージ送信');
    
    // 自然言語クエリを拡張
    const enhancedMessage = await this._enhanceUserQuery(message);
    if (enhancedMessage !== message) {
      console.log('クエリを拡張しました:', enhancedMessage.substring(0, 100) + (enhancedMessage.length > 100 ? '...' : ''));
    }
    
    // ダミーレスポンスの設定（API接続が失敗した場合のフォールバック）
    const dummyResponse = "申し訳ありませんが、APIとの通信中にエラーが発生しました。代わりにツールを使用して情報を提供します。";
    
    try {
      let originalResponse;
      
      if (this._useRealAPI) {
        // 実際のAPI呼び出し
        try {
          originalResponse = await this._originalSendMessage.call(this, enhancedMessage);
        } catch (apiError) {
          console.log(`ClaudeToolWrapper: API呼び出しエラー: ${apiError.message}`);
          // APIエラーの場合はダミーレスポンスを使用
          originalResponse = await this._getDirectResponse(enhancedMessage);
        }
      } else {
        // APIを使わずにダミーレスポンスを直接生成
        originalResponse = await this._getDirectResponse(enhancedMessage);
      }
      
      // レスポンスが有効かチェック
      if (!originalResponse) {
        console.log('ClaudeToolWrapper: APIレスポンスが空です、ダミーレスポンスを使用します');
        return this._injectToolUsage(enhancedMessage, dummyResponse);
      }
      
      // ツール使用パターンが含まれているか確認
      if (originalResponse.includes("<function_calls>")) {
        console.log('ClaudeToolWrapper: APIレスポンスに既にツール使用パターンが含まれています');
        return originalResponse;
      }
      
      // README.mdファイル表示に関する特殊処理
      if (message.toLowerCase().includes("readme") && message.toLowerCase().includes("表示") || 
          message.toLowerCase().includes("readme") && message.toLowerCase().includes("内容") ||
          message.toLowerCase().includes("readme") && message.toLowerCase().includes("見せて")) {
        console.log('README表示リクエストを検出しました。直接Viewツールを注入します');
        return `まず、READMEファイルを見つけます。

<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">README.md</parameter>
<parameter name="path">${process.cwd()}</parameter>
</invoke>
</function_calls>

見つかったREADMEファイルの内容を表示します。`;
      }
      
      // マークダウンファイル表示に関する特殊処理
      if ((message.toLowerCase().includes("マークダウン") || message.toLowerCase().includes(".md")) && 
          (message.toLowerCase().includes("内容") || message.toLowerCase().includes("表示") || 
           message.toLowerCase().includes("見せて") || message.toLowerCase().includes("中身"))) {
        console.log('マークダウンファイル表示リクエストを検出しました。直接Viewツールを注入します');
        return `まず、マークダウンファイルを見つけます。

<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">**/*.md</parameter>
<parameter name="path">${process.cwd()}</parameter>
</invoke>
</function_calls>

見つかったマークダウンファイルの内容を確認します。`;
      }
      
      // ツール使用を注入
      return this._injectToolUsage(enhancedMessage, originalResponse);
    } catch (error) {
      // 何らかのエラーが発生した場合もツール使用を注入
      console.log(`ClaudeToolWrapper: 予期しないエラー: ${error.message}`);
      return this._injectToolUsage(enhancedMessage, dummyResponse);
    }
  }
  
  // ツール使用を注入する補助メソッド
  _injectToolUsage(message, response) {
    // レスポンス内容を分析して適切なツールを選択
    const toolUsage = this._determineToolUsage(message, response);
    if (!toolUsage) {
      console.log('ClaudeToolWrapper: ツール使用が必要ないと判断しました');
      return response;
    }
    
    // 元のレスポンスの前に、ツール使用パターンを挿入
    console.log(`ClaudeToolWrapper: ${toolUsage.tool}ツール使用を注入します`);
    const modifiedResponse = `${toolUsage.intro}
${toolUsage.markup}

${response}`;
    
    return modifiedResponse;  
  }
  
  /**
   * メッセージとレスポンスからツール使用を判断
   */
  _determineToolUsage(message, response) {
    // 簡易パターンマッチでツール使用を判断
    const messageLC = message.toLowerCase();
    const responseLC = response.toLowerCase();
    
    // 各ツール使用パターンの優先順位を考慮して判断する
    // デバッグ用
    console.log('_determineToolUsage - 判断開始:');
    console.log(`メッセージ: "${message.substring(0, 50)}..."`);
    console.log(`パターン検出: コード検索=${messageLC.includes('コード')}, logger=${messageLC.includes('logger')}`);
    
    
    // 詳細分析が必要な場合のdispatch_agent使用判定
    // 1. 通常の詳細検索パターン
    if ((messageLC.includes('詳しく') || messageLC.includes('詳細') || 
         messageLC.includes('全て') || messageLC.includes('全部') || 
         messageLC.includes('調査') || messageLC.includes('分析'))) {
      
      console.log('詳細分析リクエストを検出');
      
      // ファイル種類を特定
      let fileType = '';
      let filePattern = '**/*';
      let fileDesc = 'プロジェクト';
      
      if (messageLC.includes('マークダウン') || messageLC.includes('md')) {
        fileType = 'マークダウン';
        filePattern = '**/*.md';
        fileDesc = 'マークダウンファイル';
      } else if (messageLC.includes('js') || messageLC.includes('javascript')) {
        fileType = 'JavaScript';
        filePattern = '**/*.js';
        fileDesc = 'JavaScriptファイル';
      } else if (messageLC.includes('ts') || messageLC.includes('typescript')) {
        fileType = 'TypeScript';
        filePattern = '**/*.ts';
        fileDesc = 'TypeScriptファイル';
      } else if (messageLC.includes('json')) {
        fileType = 'JSON';
        filePattern = '**/*.json';
        fileDesc = 'JSONファイル';
      } else if (messageLC.includes('設定') || messageLC.includes('config')) {
        fileType = '設定ファイル';
        filePattern = '**/*.{json,yaml,yml,xml,config,conf,toml}';
        fileDesc = '設定ファイル';
      } else if (messageLC.includes('src') || messageLC.includes('ソース')) {
        fileType = 'ソースコード';
        filePattern = 'src/**/*';
        fileDesc = 'srcディレクトリ';
      }
      
      // 分析対象を決定
      let analysisTarget = fileDesc;
      let analysisPrompt = '';
      
      // 特定のキーワードがある場合、より具体的な分析を行う
      if (messageLC.includes('構造') || messageLC.includes('構成')) {
        analysisPrompt = `${fileDesc}の構造を分析し、ディレクトリ構成と主要なファイルの関係性を説明してください。`;
      } else if (messageLC.includes('概要') || messageLC.includes('まとめ')) {
        analysisPrompt = `${fileDesc}の全体像を把握し、その概要と主要な内容をまとめてください。`;
      } else if (messageLC.includes('重要') || messageLC.includes('主要')) {
        analysisPrompt = `${fileDesc}から特に重要な情報や設定を抽出し、その意味と影響を解説してください。`;
      } else if (messageLC.includes('関数') || messageLC.includes('メソッド')) {
        analysisPrompt = `${fileDesc}内で定義されている関数やメソッドを見つけ、その目的と使用方法を解説してください。`;
      } else if (messageLC.includes('インポート') || messageLC.includes('依存')) {
        analysisPrompt = `${fileDesc}内のインポート文や依存関係を分析し、外部ライブラリやモジュールの利用状況を説明してください。`;
      } else {
        // デフォルトの詳細分析
        analysisPrompt = `${fileDesc}を詳しく調査し、以下の情報をまとめてください：
1. ファイルの場所と分布
2. 内容の概要と主要なポイント
3. ファイル間の関連性
4. 特に重要だと思われる情報`;
      }
      
      return {
        tool: 'dispatch_agent',
        intro: `${fileType ? fileType + 'を' : ''}詳しく分析します。`,
        markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">プロジェクト内の${filePattern ? filePattern + 'パターンに一致する' : ''}${analysisTarget}を検索し、${analysisPrompt}

まず GlobTool を使って適切なファイルを検索し、次に必要に応じて View ツールでファイル内容を確認してください。関連性を見るために GrepTool も活用してください。結果は簡潔にまとめ、重要なポイントを強調してください。</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // マークダウン検索の特別なケース
    if (messageLC.includes('マークダウン') && (messageLC.includes('探') || messageLC.includes('検索'))) {
      console.log('マークダウン検索リクエストを検出');
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
    
    // ファイル検索関連
    if (messageLC.includes('ファイル') && (messageLC.includes('探') || messageLC.includes('検索'))) {
      // ファイル種類を抽出
      let filePattern = '**/*';
      
      if (messageLC.includes('md') || messageLC.includes('markdown') || messageLC.includes('マークダウン')) {
        filePattern = '**/*.md';
        console.log('マークダウンファイル検索パターンを設定:', filePattern);
      } else if (messageLC.includes('js') || messageLC.includes('javascript')) {
        filePattern = '**/*.js';
      } else if (messageLC.includes('ts') || messageLC.includes('typescript')) {
        filePattern = '**/*.ts';
      } else if (messageLC.includes('json')) {
        filePattern = '**/*.json';
      } else if (messageLC.includes('yaml') || messageLC.includes('yml')) {
        filePattern = '**/*.{yaml,yml}';
      } else if (messageLC.includes('html')) {
        filePattern = '**/*.html';
      } else if (messageLC.includes('css')) {
        filePattern = '**/*.css';
      } else if (messageLC.includes('readme')) {
        filePattern = '**/README.md';
      }
      
      // AgentToolを使用するケース
      if (messageLC.includes('詳しく') || messageLC.includes('全て') || messageLC.includes('全部')) {
        return {
          tool: 'dispatch_agent',
          intro: 'より詳しくファイルを検索するためにエージェントを使用します。',
          markup: `<function_calls>
<invoke name="dispatch_agent">
<parameter name="prompt">以下のファイルパターンに一致するファイルを検索し、見つかったファイルの一覧とその内容の概要を教えてください: ${filePattern}。必要に応じてGlobTool、GrepTool、LSツールを使用してください。</parameter>
</invoke>
</function_calls>`
        };
      }
      
      return {
        tool: 'GlobTool',
        intro: 'まずはファイルを検索してみます。',
        markup: `<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">${filePattern}</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // 内容検索関連 - 最優先のパターン
    // loggerの検索やコード内検索を優先的に処理する
    if (messageLC.includes('logger') || 
        (messageLC.includes('コード') && messageLC.includes('使われている')) ||
        (messageLC.includes('内容') && messageLC.includes('検索'))) {
      
      console.log('コード内容検索を優先的に処理');
      
      // 検索パターンを抽出
      let searchPattern = '';
      
      // wordパターンから検索ワードを抽出する処理
      const wordMatch = message.match(/「([^」]+)」|"([^"]+)"|'([^']+)'/);
      if (wordMatch) {
        searchPattern = wordMatch[1] || wordMatch[2] || wordMatch[3] || '';
      } else {
        // "〜って単語" パターンの検出
        const keywordMatch = message.match(/(\w+)って(単語|キーワード|コード|部分|箇所)/);
        if (keywordMatch) {
          searchPattern = keywordMatch[1] || '';
        }
      }
      
      // 特定のキーワードの検出
      if (!searchPattern) {
        if (messageLC.includes('logger')) {
          searchPattern = 'logger';
          console.log('loggerキーワードを検出しました');
        } else if (messageLC.includes('関数') || messageLC.includes('function')) {
          searchPattern = 'function';
        } else if (messageLC.includes('クラス') || messageLC.includes('class')) {
          searchPattern = 'class';
        } else if (messageLC.includes('import')) {
          searchPattern = 'import';
        } else if (messageLC.includes('tool')) {
          searchPattern = 'tool';
        }
      }
      
      if (searchPattern) {
        console.log(`検索パターンを特定しました: "${searchPattern}"`);
        return {
          tool: 'GrepTool',
          intro: `"${searchPattern}"を含むコードを検索します。`,
          markup: `<function_calls>
<invoke name="GrepTool">
<parameter name="pattern">${searchPattern}</parameter>
<parameter name="include">*.{js,ts,md,json}</parameter>
</invoke>
</function_calls>`
        };
      }
    }
    
    // ディレクトリ一覧
    if (messageLC.includes('ディレクトリ') || messageLC.includes('フォルダ') || 
        messageLC.includes('一覧') || messageLC.includes('ls')) {
      return {
        tool: 'LS',
        intro: 'ディレクトリ内容を一覧表示します。',
        markup: `<function_calls>
<invoke name="LS">
<parameter name="path">${process.cwd()}</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // ファイル表示（指定されたファイル名があれば）
    const fileNameRegex = /(\w+\.\w+)/;
    const fileMatch = message.match(fileNameRegex);
    if (fileMatch) {
      const fileName = fileMatch[1];
      return {
        tool: 'View',
        intro: `${fileName}ファイルの内容を確認します。`,
        markup: `<function_calls>
<invoke name="View">
<parameter name="file_path">${process.cwd()}/${fileName}</parameter>
</invoke>
</function_calls>`
      };
    }
    
    // 特定のファイル名検索
    if (responseLC.includes('package.json') || messageLC.includes('package.json')) {
      return {
        tool: 'GlobTool',
        intro: 'package.jsonファイルを検索します。',
        markup: `<function_calls>
<invoke name="GlobTool">
<parameter name="pattern">**/package.json</parameter>
</invoke>
</function_calls>`
      };
    }
    
    return null;
  }
}

module.exports = { ClaudeToolWrapper };