import * as vscode from 'vscode';
import * as path from 'path';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { FileManager } from '../../utils/fileManager';

/**
 * 会話型モックアップデザイナーパネル
 * 自然な会話を通してUIデザインを行い、モックアップを生成するためのWebViewインターフェース
 */
export class ConversationalMockupDesignerPanel {
  public static currentPanel: ConversationalMockupDesignerPanel | undefined;
  private static readonly viewType = 'conversationalMockupDesigner';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _aiService: AIService;

  // 会話履歴
  private _conversationHistory: { role: string; content: string; isCode?: boolean }[] = [];
  private _currentPhase: number = 1;
  private _activeTimestamp: number = Date.now();
  
  // モックアップ関連
  private _generatedMockups: Map<string, string> = new Map(); // id -> HTMLパス

  /**
   * パネルを作成または表示
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService): ConversationalMockupDesignerPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (ConversationalMockupDesignerPanel.currentPanel) {
      ConversationalMockupDesignerPanel.currentPanel._panel.reveal(column);
      return ConversationalMockupDesignerPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      ConversationalMockupDesignerPanel.viewType,
      'モックアップデザイナー',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist')
        ]
      }
    );

    ConversationalMockupDesignerPanel.currentPanel = new ConversationalMockupDesignerPanel(panel, extensionUri, aiService);
    return ConversationalMockupDesignerPanel.currentPanel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._aiService = aiService;

    // WebViewの内容を設定
    this._update();

    // 初期メッセージを追加
    this._addSystemMessage();

    // パネルが破棄されたときのクリーンアップ
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // パネルの状態が変更されたときに更新
    this._panel.onDidChangeViewState(
      _e => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // WebViewからのメッセージを処理
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'sendMessage':
            await this._handleUserMessage(message.text);
            break;
          case 'generateMockup':
            await this._handleGenerateMockup(message.description);
            break;
          case 'showMockupPreview':
            await this._handleShowMockupPreview(message.mockupId);
            break;
          case 'openMockupInBrowser':
            await this._handleOpenMockupInBrowser(message.mockupId);
            break;
          case 'updateMockup':
            await this._handleUpdateMockup(message.mockupId);
            break;
          case 'advancePhase':
            await this._handleAdvancePhase(message.targetPhase);
            break;
          case 'exportMockup':
            await this._handleExportMockup(message.mockupId, message.location);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * システムメッセージを追加
   */
  private async _addSystemMessage(): Promise<void> {
    try {
      // APIキーチェック
      if (!this._aiService.hasApiKey()) {
        Logger.warn('APIキーが設定されていません。初期メッセージにAPIキー設定に関する情報を含めます。');
        
        const apiKeyMessage = "こんにちは！モックアップデザイナーへようこそ。" + 
          "機能を使用するには、Claude API キーの設定が必要です。\n\n" +
          "コマンドパレットから「AppGenius AI: Claude API キーを設定」を選択してAPIキーを設定してください。\n\n" +
          "API キーを設定した後、会話を開始できます。";
        
        this._conversationHistory.push({ role: 'assistant', content: apiKeyMessage });
        
        // API Key設定を促すダイアログを表示
        vscode.window.showWarningMessage(
          'Claude API キーが設定されていません。設定しますか？',
          '設定する'
        ).then(async selection => {
          if (selection === '設定する') {
            const success = await this._aiService.setApiKey();
            if (success) {
              // APIキーの設定に成功したら、ウェルカムメッセージを表示
              await this._sendWelcomeMessage();
            }
          }
        });
        
        await this._updateConversation();
        return;
      }
      
      await this._sendWelcomeMessage();
    } catch (error) {
      Logger.error('ウェルカムメッセージの取得に失敗しました', error as Error);
      
      // エラー時はデフォルトメッセージを使用
      const defaultMessage = "こんにちは！モックアップデザイナーへようこそ。" + 
        "私はUI/UX設計のエキスパートビジュアライザーです。\n\n" +
        "**Phase 1**：まずは基本要件についてお聞かせください。\n" +
        "- 解決したい課題は何ですか？\n" +
        "- 主な利用者は誰ですか？\n" +
        "- 必須機能はありますか？";
      
      this._conversationHistory.push({ role: 'assistant', content: defaultMessage });
      await this._updateConversation();
    }
  }

  /**
   * ウェルカムメッセージをAIから取得して表示
   */
  private async _sendWelcomeMessage(): Promise<void> {
    try {
      // AIからウェルカムメッセージを取得
      const welcomePrompt = "新しいUI/UXデザインプロジェクトを開始します。ユーザーに適切な初回メッセージを返してください。Phase 1の基本要件ヒアリングから始めてください。";
      
      // ローディング表示
      await this._panel.webview.postMessage({ 
        command: 'showLoading', 
        value: true 
      });
      
      const welcomeMessage = await this._aiService.sendMessage(welcomePrompt, 'design');
      
      // ローディング非表示
      await this._panel.webview.postMessage({ 
        command: 'showLoading', 
        value: false 
      });
      
      // メッセージが取得できなかった場合はデフォルトメッセージを使用
      if (!welcomeMessage || welcomeMessage.trim() === '') {
        Logger.warn('AIからのウェルカムメッセージを取得できませんでした。デフォルトメッセージを使用します。');
        
        const defaultMessage = "こんにちは！モックアップデザイナーへようこそ。" + 
          "私はUI/UX設計のエキスパートビジュアライザーです。\n\n" +
          "**Phase 1**：まずは基本要件についてお聞かせください。\n" +
          "- 解決したい課題は何ですか？\n" +
          "- 主な利用者は誰ですか？\n" +
          "- 必須機能はありますか？";
        
        this._conversationHistory.push({ role: 'assistant', content: defaultMessage });
      } else {
        // AIからの応答を使用
        Logger.debug(`AIからのウェルカムメッセージを取得しました: ${welcomeMessage.substring(0, 100)}...`);
        this._conversationHistory.push({ role: 'assistant', content: welcomeMessage });
      }
      
      // UIを更新
      await this._updateConversation();
    } catch (error) {
      Logger.error('ウェルカムメッセージの取得に失敗しました', error as Error);
      await this._showError(`ウェルカムメッセージの取得に失敗しました: ${(error as Error).message}`);
      
      // エラー時はデフォルトメッセージを使用
      const defaultMessage = "こんにちは！モックアップデザイナーへようこそ。" + 
        "私はUI/UX設計のエキスパートビジュアライザーです。\n\n" +
        "**Phase 1**：まずは基本要件についてお聞かせください。\n" +
        "- 解決したい課題は何ですか？\n" +
        "- 主な利用者は誰ですか？\n" +
        "- 必須機能はありますか？";
      
      this._conversationHistory.push({ role: 'assistant', content: defaultMessage });
      await this._updateConversation();
      
      // ローディング非表示
      await this._panel.webview.postMessage({ 
        command: 'showLoading', 
        value: false 
      });
    }
  }

  /**
   * ユーザーメッセージを処理
   */
  private async _handleUserMessage(text: string): Promise<void> {
    try {
      // デバッグログ
      Logger.debug(`Processing user message: ${text}`);
      
      // ユーザーメッセージを会話履歴に追加
      this._conversationHistory.push({ role: 'user', content: text });
      
      // UIを更新
      await this._updateConversation();
      
      // ローディング表示
      await this._panel.webview.postMessage({ 
        command: 'showLoading', 
        value: true 
      });
      
      // AIに質問を送信
      let prompt = this._buildPrompt(text);
      
      // デバッグログでプロンプトを記録
      Logger.debug(`Sending prompt to AI: ${prompt.substring(0, 100)}...`);
      
      // API Key チェック
      if (!this._aiService.hasApiKey()) {
        Logger.warn('APIキーが設定されていません。APIキー設定を促します。');
        await vscode.window.showWarningMessage(
          'Claude API キーが設定されていません。設定しますか？',
          '設定する'
        ).then(async selection => {
          if (selection === '設定する') {
            await vscode.commands.executeCommand('appgenius-ai.setApiKey');
          }
        });
      }
      
      // AIに質問を送信（リトライ処理付き）
      let response: string;
      try {
        response = await this._aiService.sendMessage(prompt, 'design');
        // 応答が空または極端に短い場合はエラーとみなす
        if (!response || response.trim().length < 10) {
          throw new Error('AI応答が不十分です。');
        }
        
        // デバッグログ
        Logger.debug(`AI response received: ${response.substring(0, 100)}...`);
      } catch (error) {
        Logger.error('AI応答の取得に失敗しました', error as Error);
        // エラーメッセージを表示し、デフォルトレスポンスを使用
        await this._showError(`AI応答の取得に失敗しました: ${(error as Error).message}。Claude API設定を確認してください。`);
        response = `申し訳ありません。AI応答の取得に問題が発生しました。
以下の点をご確認ください：
1. Claude API キーが正しく設定されているか
2. インターネット接続が安定しているか
3. API利用上限に達していないか

設定メニューから「AppGenius AI: Claude API キーを設定」を選択してAPIキーを設定してください。`;
      }
      
      // HTMLコードを抽出
      const { cleanedResponse, extractedHtml } = this._extractHtmlFromResponse(response);
      
      // AIレスポンスを会話履歴に追加
      this._conversationHistory.push({ role: 'assistant', content: cleanedResponse || response });
      
      // HTMLコードがあれば保存し、会話履歴に追加
      if (extractedHtml && extractedHtml.length > 0) {
        const mockupId = `mockup_${Date.now()}`;
        
        // デバッグログ
        Logger.debug(`HTML code extracted, length: ${extractedHtml.length}`);
        
        await this._saveMockupCode(mockupId, extractedHtml);
        
        // コード部分として追加
        this._conversationHistory.push({ 
          role: 'assistant', 
          content: extractedHtml,
          isCode: true 
        });
        
        // モックアップ生成通知を送信
        await this._panel.webview.postMessage({ 
          command: 'mockupGenerated', 
          mockupId,
          preview: extractedHtml
        });
      } else {
        Logger.debug(`No HTML code was extracted from the response`);
      }

      // 現在のフェーズを判定
      this._detectAndUpdatePhase(cleanedResponse);
      
      // ローディング非表示
      await this._panel.webview.postMessage({ 
        command: 'showLoading', 
        value: false 
      });
      
      // UIを更新
      await this._updateConversation();
    } catch (error) {
      Logger.error('メッセージ処理エラー', error as Error);
      await this._showError(`メッセージ処理エラー: ${(error as Error).message}`);
      
      // ローディング非表示
      await this._panel.webview.postMessage({ 
        command: 'showLoading', 
        value: false 
      });
    }
  }

  /**
   * レスポンスからHTMLコードを抽出し、クリーンなレスポンスとコードを返す
   */
  private _extractHtmlFromResponse(response: string): { cleanedResponse: string, extractedHtml: string } {
    // AIの応答がない場合は空を返す
    if (!response || response.trim() === '') {
      return { cleanedResponse: '', extractedHtml: '' };
    }
    
    Logger.debug(`Extracting HTML from response (length: ${response.length})`);
    
    // HTML/CSS/JSのコードブロックを検出するための正規表現
    const codeBlockRegex = /```(?:html|css|js|javascript)\s*([\s\S]*?)```/g;
    
    // HTML特有のパターンを検出（<!DOCTYPE html>や<html>タグなど）
    const htmlPatternRegex = /<!DOCTYPE html>|<html[\s>]/i;
    
    // 自然言語テキストへの移行を検出する正規表現
    // AIがコード生成から説明文に戻る場合の典型的なフレーズをチェック
    const naturalLanguagePatterns = [
      /このHTMLファイルは/i,
      /以上が(\s*)完全な(\s*)HTML/i,
      /このモックアップは/i,
      /このコードでは/i,
      /以上のコードを/i,
      /このデザインでは/i,
      /使用方法:/i,
      /注意事項:/i
    ];
    
    let extractedHtml = '';
    let cleanedResponse = response;
    let match;
    
    // コードブロック内のHTMLを検出
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const codeBlock = match[1];
      if (htmlPatternRegex.test(codeBlock)) {
        extractedHtml = codeBlock;
        
        // レスポンスからコードブロックを削除
        cleanedResponse = cleanedResponse.replace(match[0], '');
        
        // HTML検出に成功したらログ出力
        Logger.debug(`Extracted HTML from code block (length: ${extractedHtml.length})`);
      }
    }
    
    // コードブロックがなくてもHTMLパターンがレスポンス内にある場合
    if (!extractedHtml && htmlPatternRegex.test(response)) {
      // シンプルにHTMLらしい部分を抽出
      const htmlStart = response.indexOf('<!DOCTYPE html>');
      if (htmlStart >= 0) {
        // 自然言語への移行点を検出
        let htmlEnd = response.length;
        for (const pattern of naturalLanguagePatterns) {
          const match = response.substring(htmlStart).match(pattern);
          if (match && match.index) {
            const potentialEnd = htmlStart + match.index;
            if (potentialEnd < htmlEnd) {
              htmlEnd = potentialEnd;
              Logger.debug(`Detected natural language transition at position ${htmlEnd}`);
            }
          }
        }
        
        // 抽出範囲を決定
        extractedHtml = response.substring(htmlStart, htmlEnd);
        cleanedResponse = response.substring(0, htmlStart) + 
                         (htmlEnd < response.length ? response.substring(htmlEnd) : '');
        
        Logger.debug(`Extracted raw HTML content from position ${htmlStart} to ${htmlEnd} (length: ${extractedHtml.length})`);
      }
    }
    
    // HTMLが検出されたが不完全な場合のリカバリー処理
    if (extractedHtml && !extractedHtml.includes('</html>')) {
      Logger.warn('HTMLタグが完全に閉じられていません。HTMLを補完します。');
      
      // 必要なタグを補完してHTMLを完成させる
      let missingTags = [];
      let openTags = [];
      
      // 主要なHTMLタグのチェック
      const checkPairs = [
        { open: '<html', close: '</html>' },
        { open: '<head', close: '</head>' },
        { open: '<body', close: '</body>' },
        { open: '<div', close: '</div>' },
        { open: '<script', close: '</script>' },
        { open: '<style', close: '</style>' }
      ];
      
      // より高度なタグのバランス検出
      for (const pair of checkPairs) {
        const openCount = (extractedHtml.match(new RegExp(pair.open, 'g')) || []).length;
        const closeCount = (extractedHtml.match(new RegExp(pair.close, 'g')) || []).length;
        
        if (openCount > closeCount) {
          // 不足している閉じタグの数を計算
          const missing = openCount - closeCount;
          for (let i = 0; i < missing; i++) {
            missingTags.push(pair.close);
          }
          
          Logger.debug(`Detected ${missing} missing ${pair.close} tags`);
        }
      }
      
      // 閉じタグを追加
      if (missingTags.length > 0) {
        // コード内で開かれた順番と逆の順序で閉じる
        // 例: <html><body> なら </body></html> の順
        extractedHtml += '\n<!-- 自動補完された閉じタグ -->\n' + missingTags.reverse().join('\n');
        
        Logger.debug(`Added missing HTML tags: ${missingTags.join(', ')}`);
      }
      
      // HTML構造の最小要件を満たしているか確認
      if (!extractedHtml.includes('<html')) {
        extractedHtml = '<html>\n' + extractedHtml;
      }
      
      if (!extractedHtml.includes('<head')) {
        const htmlPos = extractedHtml.indexOf('<html') + '<html'.length;
        const insertPos = extractedHtml.indexOf('>', htmlPos) + 1;
        extractedHtml = extractedHtml.substring(0, insertPos) + 
                       '\n<head><meta charset="UTF-8"><title>自動生成モックアップ</title></head>' + 
                       extractedHtml.substring(insertPos);
      }
      
      if (!extractedHtml.includes('<body')) {
        const headEndPos = extractedHtml.indexOf('</head>') + '</head>'.length;
        if (headEndPos > '</head>'.length) {
          extractedHtml = extractedHtml.substring(0, headEndPos) + 
                         '\n<body>' + 
                         extractedHtml.substring(headEndPos);
        } else {
          // headタグがない場合はhtmlタグの後に挿入
          const htmlPos = extractedHtml.indexOf('<html') + '<html'.length;
          const insertPos = extractedHtml.indexOf('>', htmlPos) + 1;
          extractedHtml = extractedHtml.substring(0, insertPos) + 
                         '\n<body>' + 
                         extractedHtml.substring(insertPos);
        }
      }
      
      if (!extractedHtml.includes('</body>')) {
        extractedHtml += '\n</body>';
      }
      
      if (!extractedHtml.includes('</html>')) {
        extractedHtml += '\n</html>';
      }
      
      // DOCTYPE宣言の確認
      if (!extractedHtml.includes('<!DOCTYPE')) {
        extractedHtml = '<!DOCTYPE html>\n' + extractedHtml;
      }
      
      Logger.info('HTML構造を補完しました');
    }
    
    // HTML以外の部分を整理
    cleanedResponse = cleanedResponse.replace(/\n{3,}/g, '\n\n').trim();
    
    // HTMLが検出されたかログ出力
    if (extractedHtml) {
      Logger.info(`HTML extraction successful. Content length: ${extractedHtml.length}`);
    } else {
      Logger.warn('No HTML content found in the response');
    }
    
    return { cleanedResponse, extractedHtml };
  }

  /**
   * 会話からフェーズを検出して更新
   */
  private _detectAndUpdatePhase(response: string): void {
    // Phase 2への移行を検出
    if (this._currentPhase === 1 && 
        (response.includes('Phase 2') || 
         response.includes('フェーズ2') || 
         response.includes('ページ一覧') || 
         response.includes('次のフェーズに進みましょう'))) {
      this._currentPhase = 2;
    }
    
    // Phase 3への移行を検出
    else if (this._currentPhase === 2 && 
             (response.includes('Phase 3') || 
              response.includes('フェーズ3') || 
              response.includes('モックアップを作成') || 
              response.includes('モックアップを生成'))) {
      this._currentPhase = 3;
    }
    
    // Phase 4への移行を検出
    else if (this._currentPhase === 3 && 
             (response.includes('Phase 4') || 
              response.includes('フェーズ4') || 
              response.includes('ディレクトリ構造') || 
              response.includes('フォルダ構成'))) {
      this._currentPhase = 4;
    }
    
    // Phase 5への移行を検出
    else if (this._currentPhase === 4 && 
             (response.includes('Phase 5') || 
              response.includes('フェーズ5') || 
              response.includes('要件定義書') || 
              response.includes('最終仕様'))) {
      this._currentPhase = 5;
    }
    
    // フェーズの変更を通知
    this._panel.webview.postMessage({ 
      command: 'updatePhase', 
      phase: this._currentPhase 
    });
  }

  /**
   * モックアップコードをファイルに保存
   */
  private async _saveMockupCode(mockupId: string, htmlCode: string): Promise<string> {
    try {
      // ユーザーのホームディレクトリを使用
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      
      // ワークスペース名を取得
      const workspaceName = vscode.workspace.name || 'default';
      
      // ディレクトリパスを生成
      const appDir = path.join(homeDir, '.appgenius-ai');
      const mockupsDir = path.join(appDir, 'mockups');
      const mockupDir = path.join(mockupsDir, `${workspaceName}_${mockupId}`);
      
      // 各階層のディレクトリを確認して作成
      if (!await FileManager.directoryExists(appDir)) {
        await FileManager.createDirectory(appDir);
      }
      
      if (!await FileManager.directoryExists(mockupsDir)) {
        await FileManager.createDirectory(mockupsDir);
      }
      
      if (!await FileManager.directoryExists(mockupDir)) {
        await FileManager.createDirectory(mockupDir);
      }
      
      // HTMLファイルのパス
      const htmlPath = path.join(mockupDir, 'index.html');
      
      // HTMLファイルを保存
      await FileManager.writeFile(htmlPath, htmlCode);
      
      // 保存したパスを記録
      this._generatedMockups.set(mockupId, htmlPath);
      
      return htmlPath;
    } catch (error) {
      Logger.error('モックアップコード保存エラー', error as Error);
      throw new Error('モックアップコードの保存に失敗しました');
    }
  }

  /**
   * モックアッププレビューの表示処理
   */
  private async _handleShowMockupPreview(mockupId: string): Promise<void> {
    try {
      const htmlPath = this._generatedMockups.get(mockupId);
      if (!htmlPath) {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }

      // HTMLファイルが実際に存在するか確認
      if (!await FileManager.fileExists(htmlPath)) {
        Logger.error(`HTMLファイルが存在しません: ${htmlPath}`);
        throw new Error(`HTMLファイル ${htmlPath} が見つかりません`);
      }
      
      // WebViewを使用してプレビューを表示
      const panel = vscode.window.createWebviewPanel(
        'mockupPreview',
        'モックアッププレビュー',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.dirname(htmlPath))
          ]
        }
      );
      
      try {
        // HTMLコンテンツを読み込み
        const html = await FileManager.readFile(htmlPath);
        
        // HTMLが有効かチェック
        if (!html || html.trim() === '') {
          throw new Error('HTMLファイルが空です');
        }
        
        if (!html.includes('<html') || !html.includes('</html>')) {
          Logger.warn('HTMLファイルが不完全です。基本的なHTMLタグを追加します。');
          
          // 基本的なHTMLタグを追加
          let enhancedHtml = html;
          if (!html.includes('<!DOCTYPE html>')) {
            enhancedHtml = '<!DOCTYPE html>\n' + enhancedHtml;
          }
          if (!html.includes('<html')) {
            enhancedHtml = enhancedHtml.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<html lang="ja">');
          }
          if (!html.includes('<head')) {
            enhancedHtml = enhancedHtml.replace('<html', '<html lang="ja">\n<head><meta charset="UTF-8"><title>モックアッププレビュー</title></head>');
          }
          if (!html.includes('<body')) {
            const headEndIndex = enhancedHtml.indexOf('</head>');
            if (headEndIndex !== -1) {
              enhancedHtml = enhancedHtml.substring(0, headEndIndex + 7) + '\n<body>\n' + enhancedHtml.substring(headEndIndex + 7);
            }
          }
          if (!html.includes('</body>')) {
            enhancedHtml += '\n</body>';
          }
          if (!html.includes('</html>')) {
            enhancedHtml += '\n</html>';
          }
          
          // 修正したHTMLを保存
          await FileManager.writeFile(htmlPath, enhancedHtml);
          panel.webview.html = enhancedHtml;
        } else {
          // WebViewにHTMLを設定
          panel.webview.html = html;
        }
        
        Logger.info('モックアッププレビューを表示しました');
      } catch (fileError) {
        Logger.error('HTMLファイル読み込みエラー', fileError as Error);
        
        // 簡易的なエラーページを表示
        panel.webview.html = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>エラー</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .error-container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffebee; border-radius: 4px; border-left: 4px solid #f44336; }
            h1 { color: #d32f2f; margin-top: 0; }
            pre { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>プレビュー表示エラー</h1>
            <p>モックアップHTMLの表示中にエラーが発生しました。</p>
            <p><strong>エラー詳細:</strong> ${(fileError as Error).message}</p>
            <p>モックアップの生成を再試行してください。</p>
          </div>
        </body>
        </html>
        `;
      }
    } catch (error) {
      Logger.error('プレビュー表示エラー', error as Error);
      await this._showError(`モックアッププレビューの表示に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップをブラウザで開く処理
   */
  private async _handleOpenMockupInBrowser(mockupId: string): Promise<void> {
    try {
      const htmlPath = this._generatedMockups.get(mockupId);
      if (!htmlPath) {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }

      // HTMLファイルが実際に存在するか確認
      if (!await FileManager.fileExists(htmlPath)) {
        Logger.error(`HTMLファイルが存在しません: ${htmlPath}`);
        throw new Error(`HTMLファイル ${htmlPath} が見つかりません`);
      }
      
      // ブラウザでファイルを開く
      const uri = vscode.Uri.file(htmlPath);
      await vscode.env.openExternal(uri);
      
      Logger.info('モックアップをブラウザで開きました');
    } catch (error) {
      Logger.error('ブラウザ表示エラー', error as Error);
      await this._showError(`モックアップのブラウザ表示に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * モックアップを更新する処理
   */
  private async _handleUpdateMockup(mockupId: string): Promise<void> {
    try {
      const htmlPath = this._generatedMockups.get(mockupId);
      if (!htmlPath) {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }

      // HTMLファイルが実際に存在するか確認
      if (!await FileManager.fileExists(htmlPath)) {
        Logger.error(`HTMLファイルが存在しません: ${htmlPath}`);
        throw new Error(`HTMLファイル ${htmlPath} が見つかりません`);
      }
      
      // 更新の指示を入力してもらう
      const updateInput = await vscode.window.showInputBox({
        prompt: 'モックアップの更新内容を入力してください',
        placeHolder: '例: ナビゲーションバーの色を青色に変更し、ボタンを丸角にしてください',
        validateInput: (value) => {
          return value && value.trim().length > 0 ? null : '更新内容を入力してください';
        }
      });
      
      if (!updateInput) {
        // キャンセルされた場合
        return;
      }
      
      // 既存のHTMLを読み込む
      const existingHtml = await FileManager.readFile(htmlPath);
      
      // 更新のメッセージ
      const updatePrompt = `既存のモックアップHTMLを以下の指示に基づいて修正してください：\n\n${updateInput}\n\n既存のHTML:\n\`\`\`html\n${existingHtml}\n\`\`\`\n\n修正後の完全なHTMLを返してください。`;
      
      // メッセージをWebViewに表示（オプション）
      await this._panel.webview.postMessage({
        command: 'addUserMessage',
        text: `モックアップ更新: ${updateInput}`
      });
      
      // 処理中の状態をWebViewに通知
      await this._panel.webview.postMessage({ 
        command: 'showLoading', 
        value: true 
      });
      
      try {
        // AIにプロンプトを送信
        const response = await this._aiService.sendMessage(updatePrompt, 'design');
        
        // HTMLを抽出
        const { cleanedResponse, extractedHtml } = this._extractHtmlFromResponse(response);
        
        // AIの応答をWebViewに表示
        await this._panel.webview.postMessage({
          command: 'addAiMessage',
          text: cleanedResponse || response
        });
        
        // HTMLが抽出できた場合
        if (extractedHtml && extractedHtml.length > 0) {
          // HTMLファイルを上書き
          await FileManager.writeFile(htmlPath, extractedHtml);
          Logger.info(`モックアップを更新しました: ${htmlPath}`);
          
          // 更新通知をWebViewに送信
          await this._panel.webview.postMessage({
            command: 'mockupUpdated',
            mockupId,
            preview: extractedHtml
          });
          
          // 成功メッセージ
          vscode.window.showInformationMessage('モックアップが更新されました');
        } else {
          Logger.warn('HTMLコードが抽出できませんでした');
          vscode.window.showWarningMessage('更新用のHTMLコードが見つかりませんでした');
        }
      } finally {
        // 処理完了を通知（エラーがあってもなくても実行）
        await this._panel.webview.postMessage({ 
          command: 'showLoading', 
          value: false 
        });
      }
    } catch (error) {
      Logger.error('モックアップ更新エラー', error as Error);
      await this._showError(`モックアップの更新に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * フェーズを進める処理
   */
  private async _handleAdvancePhase(targetPhase: number): Promise<void> {
    try {
      if (targetPhase <= this._currentPhase) {
        // 既に進んでいるフェーズには何もしない
        return;
      }

      // 次のフェーズに進むためのプロンプト
      let phasePrompt = "";
      switch (targetPhase) {
        case 2:
          phasePrompt = "これまでの要件を踏まえて、Phase 2に進みましょう。必要なページ一覧とその機能を策定してください。";
          break;
        case 3:
          phasePrompt = "ページ一覧が揃いました。Phase 3に進み、各ページのモックアップを作成していきましょう。最初のページから始めてください。";
          break;
        case 4:
          phasePrompt = "モックアップの作成が完了しました。Phase 4に進み、ディレクトリ構造を提案してください。";
          break;
        case 5:
          phasePrompt = "ディレクトリ構造が確定しました。Phase 5に進み、要件定義書をまとめてください。";
          break;
      }

      // フェーズ進行メッセージを処理
      if (phasePrompt) {
        await this._handleUserMessage(phasePrompt);
      }
    } catch (error) {
      Logger.error('フェーズ進行エラー', error as Error);
      await this._showError(`フェーズの進行に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップ生成処理
   */
  private async _handleGenerateMockup(description: string): Promise<void> {
    try {
      // モックアップ生成プロンプトを構築
      const prompt = `以下の説明に基づいて、動作する完全なHTMLモックアップを生成してください:
${description}

以下の要素を含む完全なHTMLファイルを一括生成してください:
1. 必要なすべてのCDNライブラリ（最新の安定バージョンを使用）
2. スタイリングとレイアウト用のCSS
3. モックデータとロジック
4. エラーハンドリング
5. 視覚的フィードバック用のローディング表示

React+Material UIをCDNで使用し、以下の要素を必ず含めてください:
1. Reactの初期化コード
2. MaterialUIのセットアップ
3. グローバルスタイルの定義
4. エラーバウンダリ
5. レスポンシブ対応

HTMLファイルを開いた直後から正常動作するよう、必要なすべてのコードを含めてください。

重要な指示:
1. コードブロックは必ず \`\`\`html と \`\`\` で囲んでください
2. HTMLは完全で有効なものを生成し、必ず </html> タグで終わるようにしてください
3. コードの生成が完了するまで、コード以外のテキスト説明を入れないでください
4. HTMLコードが完成した後に初めて説明文を書いてください
5. コードの途中で自然言語による説明を挟まないでください
6. トークン制限でコードが途中で切れる場合は、最低限HTMLの基本構造（DOCTYPE、html、head、body）は必ず完結させてください

このモックアップはブラウザで単体で実行可能である必要があります。`;

      // ユーザーメッセージとして処理
      await this._handleUserMessage(prompt);
    } catch (error) {
      Logger.error('モックアップ生成エラー', error as Error);
      await this._showError(`モックアップの生成に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップをファイルにエクスポート
   */
  private async _handleExportMockup(mockupId: string, location: string): Promise<void> {
    try {
      const htmlPath = this._generatedMockups.get(mockupId);
      if (!htmlPath) {
        throw new Error(`モックアップが見つかりません: ${mockupId}`);
      }

      // HTMLファイルが実際に存在するか確認
      if (!await FileManager.fileExists(htmlPath)) {
        throw new Error(`HTMLファイル ${htmlPath} が見つかりません`);
      }

      // エクスポート先を指定
      let targetPath: string;
      if (location === 'workspace') {
        // ワークスペースのルートに保存
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
          throw new Error('ワークスペースが開かれていません');
        }
        
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const mockupsDir = path.join(workspaceRoot, 'mockups');
        
        // mockupsディレクトリがなければ作成
        if (!await FileManager.directoryExists(mockupsDir)) {
          await FileManager.createDirectory(mockupsDir);
        }
        
        targetPath = path.join(mockupsDir, `mockup_${Date.now()}.html`);
      } else {
        // ユーザーにファイル保存ダイアログを表示
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`mockup_${Date.now()}.html`),
          filters: {
            'HTML Files': ['html']
          }
        });
        
        if (!uri) {
          throw new Error('エクスポートがキャンセルされました');
        }
        
        targetPath = uri.fsPath;
      }

      // HTMLファイルをコピー
      const htmlContent = await FileManager.readFile(htmlPath);
      await FileManager.writeFile(targetPath, htmlContent);
      
      // 成功メッセージ
      vscode.window.showInformationMessage(`モックアップが正常にエクスポートされました: ${path.basename(targetPath)}`);
      
    } catch (error) {
      Logger.error('モックアップエクスポートエラー', error as Error);
      await this._showError(`モックアップのエクスポートに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * AIプロンプトを構築
   */
  private _buildPrompt(userMessage: string): string {
    Logger.debug(`Building prompt for message: ${userMessage}`);
    const systemPrompt = `あなたはUI/UX設計のエキスパートビジュアライザーです。
非技術者の要望を具体的な形にし、技術者が実装できる明確なモックアップと仕様に変換する役割を担います。

目的：
非技術者の要望を視覚的に具現化し、具体的な要件定義の土台を作成し、それを動作するのに必要なページを洗い出して完璧なモックアップを形成し、その後ディレクトリ構造を提案する。
＊モックアップはモックデータを使い、この時点でかなり精密につくりあげておくこと。
＊また、ディレクトリ構造はわかりやすくするためにフロントエンドはページ別、バックエンドは機能別のフォルダ分けの構造をつくる。(絶対に1つのファイルで拡張する予定もないのに馬鹿みたいにディレクトリを作ることは避けること)

現在は Phase ${this._currentPhase} にいます。

重要: ユーザーの質問に対して必ず応答してください。AIとしての応答を決して省略しないでください。

Phase#1： 基本要件の把握
ヒアリング項目:
  目的:
    - 解決したい課題
    - 実現したい状態
  ユーザー:
    - 主な利用者
    - 利用シーン
  機能:
    - 必須機能
    - あったら嬉しい機能

Phase#2： 要件を満たす効果的なフロントエンドのページ数とその機能の策定。

Phase#3：Phase#2で満たしたページを1つずつHTMLの1枚モックアップを作る。

【ライブラリ使用ポリシー】
モックアップ作成時は以下の事前定義されたライブラリセットからのみ選択して使用してください：

1. 基本セット（常に含める）
   - HTML5標準機能
   - 基本的なCSS

2. 選択可能なUIフレームワーク（一つのみ選択）
   - Bootstrap 5 (CDN: https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css)
   - Material Design Lite (CDN: https://code.getmdl.io/1.3.0/material.indigo-pink.min.css)

3. React使用時のライブラリセット（すべて含める）
   \`\`\`html
   <!-- React の読み込み -->
   <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
   <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
   
   <!-- Material UI の読み込み -->
   <script src="https://unpkg.com/@mui/material@5.14.0/umd/material-ui.development.js" crossorigin></script>
   
   <!-- Framer Motion の読み込み (アニメーションに使用) -->
   <script src="https://unpkg.com/framer-motion@10.16.4/dist/framer-motion.umd.js" crossorigin></script>
   
   <!-- Babel for JSX -->
   <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
   \`\`\`

4. 選択可能な追加JSライブラリ（必要なものだけ選択）
   - jQuery (単純な操作の場合のみ)
   - Chart.js (グラフ表示が必要な場合のみ)

重要: 使用するライブラリはすべて、HTML生成を開始する前に決定し、head要素内に適切なCDNリンクとして追加してください。後からライブラリを追加することはできません。

【生成規則】
・必ず以下の要素を含む完全なHTMLファイルを一括生成すること:
  1. 必要なすべてのCDNライブラリを冒頭のhead要素内に含める
  2. スタイリングとレイアウト用のCSS
  3. モックデータとロジック
  4. エラーハンドリング
  5. 視覚的フィードバック用のローディング表示

【テンプレート必須要素】
1. Reactの初期化コード
2. MaterialUIのセットアップ
3. グローバルスタイルの定義
4. エラーバウンダリ
5. ローディング表示
6. レスポンシブ対応
7. アニメーションとトランジション

【品質保証項目】
・HTMLファイルを開いた直後から正常動作すること
・すべてのライブラリが正しい順序で読み込まれること
・視覚的要素が即座に表示されること
・コンソールエラーが発生しないこと

【ライブラリの参照方法】
- Reactは「React」オブジェクトとして参照
- ReactDOMは「ReactDOM」オブジェクトとして参照
- Material UIは「MaterialUI」オブジェクトとして参照
- Framer Motionは「framerMotion」オブジェクトとして参照（window.framerMotion.motion としてグローバルに利用可能）

Phase#4：ディレクトリ構造の作成
フロントエンド：ページ別構造
バックエンド：機能別構造
※不要なディレクトリは作成しない

Phase#5：要件定義書のまとめ
他のAIが実装可能な形での明確な仕様書作成`;

    // 直近の会話履歴を取得
    const recentMessages = this._getRecentMessages();
    
    // 会話履歴をプロンプトに含める
    let conversationContext = "";
    recentMessages.forEach(msg => {
      if (!msg.isCode) { // コード部分は除外
        conversationContext += `${msg.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${msg.content}\n\n`;
      }
    });

    // 最終的なプロンプト
    return `${systemPrompt}\n\n会話履歴:\n${conversationContext}\n\nユーザーの最新メッセージ: ${userMessage}`;
  }

  /**
   * 直近の会話履歴を取得
   */
  private _getRecentMessages(limit: number = 10): { role: string; content: string; isCode?: boolean }[] {
    // 最新のメッセージから遡って取得（コンテキストウィンドウを考慮）
    const totalMessages = this._conversationHistory.length;
    const startIndex = Math.max(0, totalMessages - limit);
    return this._conversationHistory.slice(startIndex);
  }

  /**
   * エラーメッセージの表示
   */
  private async _showError(message: string): Promise<void> {
    vscode.window.showErrorMessage(message);
    
    // WebViewにもエラーを表示
    await this._panel.webview.postMessage({ 
      command: 'showError', 
      message 
    });
  }

  /**
   * 会話を更新
   */
  private async _updateConversation(): Promise<void> {
    await this._panel.webview.postMessage({
      command: 'updateConversation',
      messages: this._conversationHistory
    });
  }

  /**
   * WebViewを更新
   */
  private _update(): void {
    if (!this._panel.visible) {
      return;
    }

    this._panel.webview.html = this._getHtmlForWebview();
    this._updateConversation();
  }

  /**
   * WebView用のHTMLを生成
   */
  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    // WebView内でのリソースへのパスを取得
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'mockupDesigner.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'mockupDesigner.css')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    // WebViewのHTMLを構築
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>会話型モックアップデザイナー</title>
  <link href="${styleUri}" rel="stylesheet">
  <link href="${codiconsUri}" rel="stylesheet">
  <style>
    :root {
      --main-bg-color: var(--vscode-editor-background);
      --main-fg-color: var(--vscode-editor-foreground);
      --sidebar-bg-color: var(--vscode-sideBar-background);
      --border-color: var(--vscode-panel-border);
      --accent-color: var(--vscode-button-background);
      --accent-fg-color: var(--vscode-button-foreground);
      --input-bg-color: var(--vscode-input-background);
      --input-fg-color: var(--vscode-input-foreground);
      --code-bg-color: var(--vscode-textCodeBlock-background);
      --inactive-color: var(--vscode-disabledForeground);
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background-color: var(--main-bg-color);
      color: var(--main-fg-color);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.5;
      height: 100vh;
      overflow: hidden;
    }
    
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    
    .header {
      padding: 10px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header h1 {
      font-size: 1.2rem;
      font-weight: 600;
    }
    
    .phase-indicator {
      display: flex;
      gap: 10px;
      font-size: 0.85rem;
    }
    
    .phase-step {
      padding: 4px 10px;
      border-radius: 20px;
      background-color: var(--sidebar-bg-color);
      color: var(--inactive-color);
    }
    
    .phase-step.active {
      background-color: var(--accent-color);
      color: var(--accent-fg-color);
    }
    
    .phase-step.completed {
      background-color: var(--code-bg-color);
      color: var(--main-fg-color);
    }
    
    .main-container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    
    .chat-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border-color);
      max-width: 65%;
    }
    
    .conversation {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    
    .message {
      margin-bottom: 20px;
      max-width: 85%;
    }
    
    .message-content {
      padding: 12px 16px;
      border-radius: 8px;
      word-wrap: break-word;
    }
    
    .message.user {
      margin-left: auto;
    }
    
    .message.user .message-content {
      background-color: var(--accent-color);
      color: var(--accent-fg-color);
    }
    
    .message.assistant .message-content {
      background-color: var(--sidebar-bg-color);
    }
    
    .code-block {
      background-color: var(--code-bg-color);
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: monospace;
      margin-bottom: 20px;
      white-space: pre-wrap;
    }
    
    .input-area {
      border-top: 1px solid var(--border-color);
      padding: 15px;
      display: flex;
      align-items: flex-start;
    }
    
    .input-area textarea {
      flex: 1;
      min-height: 60px;
      max-height: 150px;
      padding: 10px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      background-color: var(--input-bg-color);
      color: var(--input-fg-color);
      resize: vertical;
      font-family: inherit;
      font-size: inherit;
    }
    
    .input-area textarea:focus {
      outline: 1px solid var(--accent-color);
    }
    
    .input-area button {
      margin-left: 10px;
      background-color: var(--accent-color);
      color: var(--accent-fg-color);
      border: none;
      border-radius: 4px;
      padding: 10px 15px;
      cursor: pointer;
      align-self: flex-end;
    }
    
    .input-area button:hover {
      opacity: 0.9;
    }
    
    .preview-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 35%;
    }
    
    .preview-header {
      padding: 10px 15px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
    }
    
    .preview-header h2 {
      font-size: 1rem;
      font-weight: 600;
    }
    
    .preview-content {
      flex: 1;
      overflow: auto;
      padding: 20px;
    }
    
    .mockup-preview {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    
    .mockup-preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .mockup-preview-buttons {
      display: flex;
      gap: 10px;
    }
    
    .mockup-preview-buttons button {
      background-color: var(--sidebar-bg-color);
      color: var(--main-fg-color);
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      font-size: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    
    .mockup-preview-buttons button:hover {
      background-color: var(--border-color);
    }
    
    .mockup-preview-buttons button span {
      margin-right: 5px;
    }
    
    .mockup-preview-frame {
      width: 100%;
      height: 400px;
      border: none;
      background-color: white;
    }
    
    .loading-spinner {
      display: none;
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: var(--sidebar-bg-color);
      color: var(--main-fg-color);
      padding: 10px 15px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      z-index: 100;
    }
    
    .loading-spinner.visible {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border-color);
      border-top: 2px solid var(--accent-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .error-message {
      background-color: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      padding: 10px 15px;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    
    /* レスポンシブスタイル */
    @media (max-width: 768px) {
      .main-container {
        flex-direction: column;
      }
      
      .chat-container {
        max-width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
      
      .conversation {
        max-height: 40vh;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>会話型モックアップデザイナー</h1>
      <div class="phase-indicator">
        <div class="phase-step active" data-phase="1">Phase 1: 要件定義</div>
        <div class="phase-step" data-phase="2">Phase 2: ページ構造</div>
        <div class="phase-step" data-phase="3">Phase 3: モックアップ</div>
        <div class="phase-step" data-phase="4">Phase 4: ディレクトリ</div>
        <div class="phase-step" data-phase="5">Phase 5: 要件書</div>
      </div>
    </div>
    
    <div class="main-container">
      <div class="chat-container">
        <div class="conversation" id="conversation">
          <!-- 会話内容がここに動的に追加されます -->
        </div>
        
        <div class="input-area">
          <textarea id="message-input" placeholder="メッセージを入力してください..."></textarea>
          <button id="send-button">送信</button>
        </div>
      </div>
      
      <div class="preview-container">
        <div class="preview-header">
          <h2>モックアッププレビュー</h2>
          <div class="preview-actions">
            <button id="generate-mockup-button">モックアップを生成</button>
          </div>
        </div>
        <div class="preview-content" id="preview-content">
          <!-- モックアップのプレビューがここに表示されます -->
          <div class="mockup-placeholder">
            <p>会話の中でモックアップが生成されると、ここにプレビューが表示されます。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="loading-spinner" id="loading-spinner">
    <div class="spinner"></div>
    <span>AIが応答中...</span>
  </div>

  <script>
    (function() {
      // VSCodeのAPIを取得
      const vscode = acquireVsCodeApi();
      
      // HTML要素の参照
      const conversationEl = document.getElementById('conversation');
      const messageInputEl = document.getElementById('message-input');
      const sendButtonEl = document.getElementById('send-button');
      const loadingSpinnerEl = document.getElementById('loading-spinner');
      const previewContentEl = document.getElementById('preview-content');
      const generateMockupButtonEl = document.getElementById('generate-mockup-button');
      const phaseStepsEl = document.querySelectorAll('.phase-step');
      
      // モックアップデータを保存
      const mockups = new Map();
      
      // 現在のフェーズ
      let currentPhase = 1;
      
      // メッセージの送信
      function sendMessage() {
        const messageText = messageInputEl.value.trim();
        if (!messageText) return;
        
        // メッセージをVSCodeに送信
        vscode.postMessage({
          command: 'sendMessage',
          text: messageText
        });
        
        // 入力フィールドをクリア
        messageInputEl.value = '';
      }
      
      // モックアップの生成リクエスト
      function generateMockup() {
        // モックアップの説明を入力するダイアログを表示
        const description = prompt('モックアップの説明を入力してください:');
        if (!description) return;
        
        vscode.postMessage({
          command: 'generateMockup',
          description
        });
      }
      
      // モックアッププレビューの表示
      function showMockupPreview(mockupId) {
        vscode.postMessage({
          command: 'showMockupPreview',
          mockupId
        });
      }
      
      // モックアップをブラウザで開く
      function openMockupInBrowser(mockupId) {
        vscode.postMessage({
          command: 'openMockupInBrowser',
          mockupId
        });
      }
      
      // モックアップを更新
      function updateMockup(mockupId) {
        vscode.postMessage({
          command: 'updateMockup',
          mockupId
        });
      }
      
      // モックアップのエクスポート
      function exportMockup(mockupId) {
        const location = confirm('ワークスペースにエクスポートしますか？キャンセルを選択すると、ファイル保存ダイアログが表示されます。')
          ? 'workspace'
          : 'custom';
        
        vscode.postMessage({
          command: 'exportMockup',
          mockupId,
          location
        });
      }
      
      // フェーズの更新
      function updatePhaseIndicator(phase) {
        currentPhase = phase;
        
        phaseStepsEl.forEach(el => {
          const phaseNum = parseInt(el.dataset.phase);
          el.classList.remove('active', 'completed');
          
          if (phaseNum === phase) {
            el.classList.add('active');
          } else if (phaseNum < phase) {
            el.classList.add('completed');
          }
        });
      }
      
      // フェーズを進める
      function advancePhase(targetPhase) {
        if (targetPhase <= currentPhase) return;
        
        vscode.postMessage({
          command: 'advancePhase',
          targetPhase
        });
      }
      
      // ローディング表示の切替
      function toggleLoading(show) {
        if (show) {
          loadingSpinnerEl.classList.add('visible');
        } else {
          loadingSpinnerEl.classList.remove('visible');
        }
      }
      
      // エラーメッセージの表示
      function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        conversationEl.appendChild(errorDiv);
        conversationEl.scrollTop = conversationEl.scrollHeight;
        
        // 5秒後に自動で消去
        setTimeout(() => {
          errorDiv.remove();
        }, 5000);
      }
      
      // 会話の更新
      function updateConversation(messages) {
        // 会話コンテナをクリア
        conversationEl.innerHTML = '';
        
        // 各メッセージを追加
        messages.forEach(msg => {
          if (msg.isCode) {
            // コードブロック
            const codeBlock = document.createElement('div');
            codeBlock.className = 'code-block';
            codeBlock.textContent = msg.content;
            conversationEl.appendChild(codeBlock);
          } else {
            // 通常のメッセージ
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${msg.role}\`;
            
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            
            // Markdownのシンプルな処理（改行と強調のみ）
            let formattedContent = msg.content
              .replace(/\\n/g, '<br>')
              .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
              .replace(/\\*(.+?)\\*/g, '<em>$1</em>');
            
            messageContent.innerHTML = formattedContent;
            messageDiv.appendChild(messageContent);
            
            conversationEl.appendChild(messageDiv);
          }
        });
        
        // 一番下までスクロール
        conversationEl.scrollTop = conversationEl.scrollHeight;
      }
      
      // モックアッププレビューをUIに追加
      function addMockupPreview(mockupId, htmlPreview) {
        // プレビューコンテナを作成
        const previewDiv = document.createElement('div');
        previewDiv.className = 'mockup-preview';
        previewDiv.id = \`preview-\${mockupId}\`;
        
        // プレビューヘッダー
        const previewHeader = document.createElement('div');
        previewHeader.className = 'mockup-preview-header';
        
        const previewTitle = document.createElement('h3');
        previewTitle.textContent = \`モックアップ #\${mockupId.split('_')[1]}\`;
        
        const previewButtons = document.createElement('div');
        previewButtons.className = 'mockup-preview-buttons';
        
        // プレビューボタン
        const previewButton = document.createElement('button');
        previewButton.innerHTML = '<span class="codicon codicon-preview"></span>プレビュー';
        previewButton.addEventListener('click', () => showMockupPreview(mockupId));
        
        // ブラウザで開くボタン
        const browserButton = document.createElement('button');
        browserButton.innerHTML = '<span class="codicon codicon-browser"></span>ブラウザで開く';
        browserButton.addEventListener('click', () => openMockupInBrowser(mockupId));
        
        // エクスポートボタン
        const exportButton = document.createElement('button');
        exportButton.innerHTML = '<span class="codicon codicon-save"></span>エクスポート';
        exportButton.addEventListener('click', () => exportMockup(mockupId));
        
        // 更新ボタン
        const updateButton = document.createElement('button');
        updateButton.innerHTML = '<span class="codicon codicon-refresh"></span>更新する';
        updateButton.addEventListener('click', () => updateMockup(mockupId));
        
        // ボタンを追加
        previewButtons.appendChild(previewButton);
        previewButtons.appendChild(browserButton);
        previewButtons.appendChild(exportButton);
        previewButtons.appendChild(updateButton);
        
        // ヘッダーを組み立て
        previewHeader.appendChild(previewTitle);
        previewHeader.appendChild(previewButtons);
        
        // iframeでプレビュー表示
        const iframe = document.createElement('iframe');
        iframe.className = 'mockup-preview-frame';
        iframe.onload = () => {
          // iframeの内容にスタイルを適用
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const style = iframeDoc.createElement('style');
            style.textContent = 'body { margin: 0; padding: 0; }';
            iframeDoc.head.appendChild(style);
          } catch (e) {
            console.error('iframeアクセスエラー:', e);
          }
        };
        
        // HTMLコンテンツを設定
        iframe.srcdoc = htmlPreview;
        
        // プレビューコンテナを組み立て
        previewDiv.appendChild(previewHeader);
        previewDiv.appendChild(iframe);
        
        // プレビューエリアに追加（先頭）
        if (previewContentEl.firstChild) {
          previewContentEl.insertBefore(previewDiv, previewContentEl.firstChild);
        } else {
          previewContentEl.appendChild(previewDiv);
        }
        
        // モックアップを保存
        mockups.set(mockupId, htmlPreview);
      }
      
      // VSCodeからのメッセージ処理
      window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
          case 'updateConversation':
            updateConversation(message.messages);
            break;
            
          case 'showLoading':
            toggleLoading(message.value);
            break;
            
          case 'showError':
            showError(message.message);
            break;
            
          case 'mockupGenerated':
            addMockupPreview(message.mockupId, message.preview);
            break;
            
          case 'mockupUpdated': {
              // モックアップのプレビューを更新
              const mockupId = message.mockupId;
              const preview = message.preview;
              const selector = "#preview-" + mockupId + " iframe";
              const previewFrame = document.querySelector(selector);
              
              if (previewFrame && previewFrame instanceof HTMLIFrameElement) {
                previewFrame.srcdoc = preview;
              }
              
              // モックアップデータを更新
              mockups.set(mockupId, preview);
              break;
            }
            
          case 'updatePhase':
            updatePhaseIndicator(message.phase);
            break;
        }
      });
      
      // イベントリスナーの設定
      sendButtonEl.addEventListener('click', sendMessage);
      
      messageInputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      
      generateMockupButtonEl.addEventListener('click', generateMockup);
      
      // フェーズ切り替えボタンのイベント
      phaseStepsEl.forEach(el => {
        el.addEventListener('click', () => {
          const targetPhase = parseInt(el.dataset.phase);
          advancePhase(targetPhase);
        });
      });
      
      // VSCodeに初期化通知
      vscode.postMessage({ command: 'initialized' });
    })();
  </script>
</body>
</html>`;
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    ConversationalMockupDesignerPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}