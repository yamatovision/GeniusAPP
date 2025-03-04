import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';
import { DevelopmentPhaseManager, DevelopmentPhase } from '../../modes/developmentMode/developmentPhases';
import { DevelopmentAssistant, CodeBlock } from '../../modes/developmentMode/developmentAssistant';
import { ScopeSelector } from '../../modes/implementationMode/scopeSelector';

/**
 * 開発アシスタントパネル
 * コード開発と改善のためのWebViewインターフェース
 */
export class DevelopmentAssistantPanel {
  public static currentPanel: DevelopmentAssistantPanel | undefined;
  private static readonly viewType = 'developmentAssistant';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private _phaseManager: DevelopmentPhaseManager;
  private _developmentAssistant: DevelopmentAssistant;
  private _scopeUpdater: vscode.Disposable | undefined;
  private _scopeSelector: ScopeSelector | undefined;

  // 現在の作業状態
  private _currentDirectoryStructure: string = '';
  private _currentScope: string = '';
  private _currentFiles: string[] = [];
  private _messages: { role: string, content: string }[] = [];
  private _selectedItems: any[] = [];
  private _estimatedTime: string = '';

  /**
   * パネルを作成または表示
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService): DevelopmentAssistantPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (DevelopmentAssistantPanel.currentPanel) {
      DevelopmentAssistantPanel.currentPanel._panel.reveal(column);
      return DevelopmentAssistantPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      DevelopmentAssistantPanel.viewType,
      '開発アシスタント',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons')
        ]
      }
    );

    DevelopmentAssistantPanel.currentPanel = new DevelopmentAssistantPanel(panel, extensionUri, aiService);
    return DevelopmentAssistantPanel.currentPanel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    
    // ビジネスロジックの初期化
    this._phaseManager = new DevelopmentPhaseManager();
    this._developmentAssistant = new DevelopmentAssistant(aiService);
    this._scopeSelector = new ScopeSelector(aiService);

    // 初期メッセージを追加
    this._messages.push({
      role: 'assistant',
      content: this._developmentAssistant.getInitialMessage()
    });

    // 設定データの取得と表示
    this._showDebugConfigData();
    
    // 実装スコープのデータを読み込む
    this._loadImplementationScopeData().catch(error => {
      Logger.error('実装スコープデータのロード中にエラーが発生:', error);
    });
    
    // 項目ステータス更新メッセージの処理を登録
    this._setupScopeStatusUpdater();

    // WebViewの内容を設定
    this._update();

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
          case 'startPhase':
            await this._handleStartPhase(message.phase);
            break;
          case 'completePhase':
            await this._handleCompletePhase(message.phase, message.data);
            break;
          case 'sendChatMessage':
            await this._handleSendChatMessage(message.text);
            break;
          case 'saveCodeBlock':
            await this._handleSaveCodeBlock(message.codeBlock);
            break;
          case 'setDirectoryStructure':
            this._setDirectoryStructure(message.text);
            break;
          case 'setScope':
            this._setScope(message.text);
            break;
          case 'setFiles':
            this._setFiles(message.files);
            break;
          case 'resetAssistant':
            this._resetAssistant();
            break;
          case 'updateItemStatus':
            this._handleUpdateItemStatus(message.itemId, message.status);
            break;
          case 'updateItemProgress':
            this._handleUpdateItemProgress(message.itemId, message.progress);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * フェーズ開始の処理
   */
  private async _handleStartPhase(phase: DevelopmentPhase): Promise<void> {
    try {
      this._phaseManager.moveToPhase(phase);
      
      // フェーズに応じたプロンプトを取得して送信
      const phasePrompt = this._developmentAssistant.getPhasePrompt(phase);
      
      // プロンプトをUIに表示
      await this._addMessage('assistant', phasePrompt);
      
      await this._updateWebview();
    } catch (error) {
      Logger.error(`フェーズ開始エラー: ${phase}`, error as Error);
      await this._showError(`フェーズ開始エラー: ${(error as Error).message}`);
    }
  }

  /**
   * フェーズ完了の処理
   */
  private async _handleCompletePhase(phase: DevelopmentPhase, _data: any): Promise<void> {
    try {
      // フェーズを完了とマーク
      this._phaseManager.setPhaseCompletion(phase, true);
      
      // 次のフェーズに進む
      this._phaseManager.advanceToNextPhase();
      
      // 次のフェーズのプロンプトを取得して送信
      const nextPhase = this._phaseManager.currentPhase;
      const nextPhasePrompt = this._developmentAssistant.getPhasePrompt(nextPhase);
      
      // プロンプトをUIに表示
      await this._addMessage('assistant', nextPhasePrompt);
      
      await this._updateWebview();
    } catch (error) {
      Logger.error(`フェーズ完了エラー: ${phase}`, error as Error);
      await this._showError(`フェーズ完了エラー: ${(error as Error).message}`);
    }
  }

  /**
   * チャットメッセージの送信処理
   */
  private async _handleSendChatMessage(text: string): Promise<void> {
    try {
      Logger.info('チャットメッセージを受信:', text);
      Logger.debug(`メッセージ内容: ${text}`);
      
      // すでに同じテキストが直近で処理された場合は重複送信を防止
      let lastUserMessage: { role: string, content: string } | undefined;
      let lastAssistantMessage: { role: string, content: string } | undefined;
      
      // 直近のユーザーメッセージを探す
      for (let i = this._messages.length - 1; i >= 0; i--) {
        if (this._messages[i].role === 'user') {
          lastUserMessage = this._messages[i];
          break;
        }
      }
      
      // 直近のアシスタントメッセージを探す
      for (let i = this._messages.length - 1; i >= 0; i--) {
        if (this._messages[i].role === 'assistant') {
          lastAssistantMessage = this._messages[i];
          break;
        }
      }
      
      // 重複チェック
      if (lastUserMessage && lastUserMessage.content === text) {
        if (lastAssistantMessage && this._messages.indexOf(lastAssistantMessage) > this._messages.indexOf(lastUserMessage)) {
          Logger.info('重複メッセージを検出しました。処理をスキップします。');
          return;
        }
      }
      
      // プロジェクト情報をAIに送信するためのコンテキスト作成
      let contextMessage = '';
      
      // ディレクトリ構造の追加
      if (this._currentDirectoryStructure) {
        contextMessage += `## プロジェクト構造情報\n${this._currentDirectoryStructure}\n\n`;
      }
      
      // スコープ情報の追加
      if (this._currentScope) {
        contextMessage += `## 実装スコープ\n${this._currentScope}\n\n`;
      }
      
      // コンテキスト情報を付加したメッセージを作成
      const enhancedMessage = contextMessage ? 
        `${contextMessage}## ユーザーからの質問/指示\n${text}` : 
        text;
      
      // ユーザーメッセージはフロントエンド側で既に表示されているため、ここでは追加しない
      
      // 進捗表示
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'AIが回答を生成中...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });
          
          try {
            Logger.debug('AIサービスにメッセージを送信します');
            // 安全に文字列のプレビューを生成
            let messagePreview = 'メッセージなし';
            try {
              if (enhancedMessage && typeof enhancedMessage === 'string') {
                messagePreview = enhancedMessage.length > 100 ? enhancedMessage.slice(0, 100) : enhancedMessage;
              }
            } catch (err) {
              Logger.error('メッセージプレビュー生成エラー:', err as Error);
            }
            Logger.debug(`コンテキスト付きメッセージ: ${messagePreview}...`);
            
            // AIサービスを使用してメッセージを処理
            try {
              Logger.debug('AIサービスにリクエスト送信前...');
              
              // 実際のAIレスポンスを取得する（拡張されたメッセージを送信）
              const response = await this._developmentAssistant.processMessage(enhancedMessage);
              
              Logger.debug(`AIレスポンス取得完了: ${response ? '成功' : '失敗'}`);
              
              if (response) {
                // 安全に文字列のプレビューを生成
                let responsePreview = 'レスポンスなし';
                try {
                  if (response.message && typeof response.message === 'string') {
                    responsePreview = response.message.length > 100 ? response.message.slice(0, 100) : response.message;
                  }
                } catch (err) {
                  Logger.error('レスポンスプレビュー生成エラー:', err as Error);
                }
                Logger.debug(`応答内容: ${responsePreview}...`);
                
                // AIの応答をUIに表示
                await this._addMessage('assistant', response.message);
                
                // コードブロックがあれば処理
                if (response.codeBlocks && response.codeBlocks.length > 0) {
                  Logger.info(`${response.codeBlocks.length}件のコードブロックを検出しました`);
                  
                  // 保存確認ダイアログを表示
                  const saveChoice = await vscode.window.showInformationMessage(
                    `${response.codeBlocks.length}件のコードブロックが生成されました。保存しますか？`,
                    '全て保存',
                    '確認して保存',
                    'キャンセル'
                  );
                  
                  if (saveChoice === '全て保存') {
                    // すべてのコードブロックを保存
                    for (const block of response.codeBlocks) {
                      await this._handleSaveCodeBlock(block);
                    }
                  } else if (saveChoice === '確認して保存') {
                    // 各コードブロックを個別に確認
                    for (const block of response.codeBlocks) {
                      const confirmSave = await vscode.window.showInformationMessage(
                        `ファイル "${block.filename}" を保存しますか？`,
                        '保存',
                        'スキップ'
                      );
                      
                      if (confirmSave === '保存') {
                        await this._handleSaveCodeBlock(block);
                      }
                    }
                  }
                }
              } else {
                Logger.warn('AIサービスからnullまたは不正な応答を受信しました');
                await this._addMessage('assistant', '申し訳ありません。応答の生成中にエラーが発生しました。');
              }
            } catch (error) {
              Logger.error('AI応答処理エラー:', error as Error);
              Logger.debug(`エラー詳細: ${(error as Error).stack || 'スタックトレース無し'}`);
              await this._addMessage('assistant', `申し訳ありません。エラーが発生しました: ${(error as Error).message}`);
            }
            
            Logger.debug('AIの応答を処理しました');
            progress.report({ increment: 100 });
          } catch (error) {
            Logger.error('AI処理中にエラーが発生:', error as Error);
            Logger.debug(`エラーの詳細: ${(error as Error).stack || 'スタックトレースなし'}`);
            await this._showError(`メッセージの処理中にエラーが発生しました: ${(error as Error).message}`);
            progress.report({ increment: 100 });
          }
        }
      );
      
      Logger.debug('メッセージ処理完了');
    } catch (error) {
      Logger.error('チャットメッセージ処理エラー', error as Error);
      Logger.debug(`エラーの詳細: ${(error as Error).stack || 'スタックトレースなし'}`);
      await this._showError(`チャットメッセージの処理中にエラーが発生しました: ${(error as Error).message}`);
    }
  }

  /**
   * コードブロックの保存処理
   */
  private async _handleSaveCodeBlock(codeBlock: CodeBlock): Promise<void> {
    try {
      const success = await this._developmentAssistant.saveCodeBlock(codeBlock);
      
      if (success) {
        // 保存通知をUIに送信
        await this._panel.webview.postMessage({
          command: 'notifyCodeSaved',
          filename: codeBlock.filename,
          language: codeBlock.language
        });
        
        vscode.window.showInformationMessage(`コードブロックを保存しました: ${codeBlock.filename}`);
      } else {
        vscode.window.showErrorMessage(`コードブロックの保存に失敗しました: ${codeBlock.filename}`);
      }
    } catch (error) {
      Logger.error('コードブロック保存エラー', error as Error);
      await this._showError(`コードブロックの保存中にエラーが発生しました: ${(error as Error).message}`);
    }
  }

  /**
   * ディレクトリ構造の設定
   */
  private _setDirectoryStructure(text: string): void {
    this._currentDirectoryStructure = text;
    this._developmentAssistant.setCurrentDirectory(text);
    Logger.debug('ディレクトリ構造を設定しました');
  }

  /**
   * スコープの設定
   */
  private _setScope(text: string): void {
    this._currentScope = text;
    this._developmentAssistant.setCurrentScope(text);
    Logger.debug('スコープを設定しました');
  }

  /**
   * ファイル一覧の設定
   */
  private _setFiles(files: string[]): void {
    this._currentFiles = files;
    this._developmentAssistant.setCurrentFiles(files);
    Logger.debug('ファイル一覧を設定しました');
  }

  /**
   * アシスタントのリセット
   */
  private _resetAssistant(): void {
    this._messages = [];
    this._phaseManager.resetAllPhases();
    this._developmentAssistant.clearChatHistory();
    
    // 初期メッセージを追加
    this._messages.push({
      role: 'assistant',
      content: this._developmentAssistant.getInitialMessage()
    });
    
    this._updateWebview();
    Logger.info('開発アシスタントをリセットしました');
  }
  
  /**
   * 項目のステータス更新ハンドラを設定
   */
  private _setupScopeStatusUpdater(): void {
    // 既存のものがあれば破棄
    if (this._scopeUpdater) {
      this._scopeUpdater.dispose();
    }
    
    // ステータス更新メッセージの処理を登録
    this._scopeUpdater = vscode.window.onDidChangeWindowState(async () => {
      // 定期的に実装スコープの情報を設定に保存
      this._updateScopeInConfiguration();
    });
  }
  
  /**
   * 実装項目のステータス更新
   */
  private async _handleUpdateItemStatus(itemId: string, status: 'pending' | 'in-progress' | 'completed' | 'blocked'): Promise<void> {
    try {
      if (!this._scopeSelector) {
        return;
      }
      
      // 項目のステータスを更新
      this._scopeSelector.updateItemStatus(itemId, status);
      
      // 該当の項目を_selectedItemsからも更新
      const itemIndex = this._selectedItems.findIndex(item => item.id === itemId);
      if (itemIndex >= 0) {
        this._selectedItems[itemIndex].status = status;
        
        // ステータスに応じて進捗率も調整
        if (status === 'completed') {
          this._selectedItems[itemIndex].progress = 100;
        } else if (status === 'in-progress' && this._selectedItems[itemIndex].progress === 0) {
          this._selectedItems[itemIndex].progress = 10;
        }
      }
      
      // 設定に保存
      await this._updateScopeInConfiguration();
      
      // 画面を更新
      await this._updateWebview();
      
      Logger.info(`項目「${itemId}」のステータスを「${status}」に更新しました`);
    } catch (error) {
      Logger.error('項目ステータス更新エラー:', error as Error);
      await this._showError(`項目のステータス更新に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 実装項目の進捗率更新
   */
  private async _handleUpdateItemProgress(itemId: string, progress: number): Promise<void> {
    try {
      if (!this._scopeSelector) {
        return;
      }
      
      // 項目の進捗率を更新
      this._scopeSelector.updateItemProgress(itemId, progress);
      
      // 該当の項目を_selectedItemsからも更新
      const itemIndex = this._selectedItems.findIndex(item => item.id === itemId);
      if (itemIndex >= 0) {
        this._selectedItems[itemIndex].progress = progress;
        
        // 進捗率に応じてステータスも自動調整
        if (progress >= 100 && this._selectedItems[itemIndex].status !== 'completed') {
          this._selectedItems[itemIndex].status = 'completed';
        } else if (progress > 0 && progress < 100 && this._selectedItems[itemIndex].status === 'pending') {
          this._selectedItems[itemIndex].status = 'in-progress';
        }
      }
      
      // 設定に保存
      await this._updateScopeInConfiguration();
      
      // 画面を更新
      await this._updateWebview();
      
      Logger.info(`項目「${itemId}」の進捗率を「${progress}%」に更新しました`);
    } catch (error) {
      Logger.error('項目進捗率更新エラー:', error as Error);
      await this._showError(`項目の進捗率更新に失敗しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * 設定データのデバッグ表示
   */
  private _showDebugConfigData(): void {
    try {
      // すべての拡張機能設定を取得
      const allConfig = vscode.workspace.getConfiguration('appgeniusAI');
      Logger.debug('利用可能な設定キー:');
      
      // キーのリストを表示
      Object.keys(allConfig).forEach(key => {
        if (typeof key === 'string' && !key.startsWith('_')) {
          const value = allConfig.get(key);
          if (key === 'implementationScope') {
            Logger.debug(`  ${key}: ${value ? '値あり' : '値なし'}`);
          } else {
            Logger.debug(`  ${key}: ${value}`);
          }
        }
      });
      
      // 実装スコープデータを特に確認
      const scopeData = allConfig.get('implementationScope', '');
      Logger.debug(`実装スコープデータの有無: ${scopeData ? '設定あり' : '設定なし'}`);
      
      if (scopeData) {
        try {
          const parsed = JSON.parse(scopeData as string);
          // 安全に文字列化
          let logData = 'データなし';
          try {
            const jsonStr = JSON.stringify(parsed);
            logData = jsonStr.length > 100 ? jsonStr.slice(0, 100) : jsonStr;
          } catch (err) {
            Logger.error('JSONシリアライズエラー:', err as Error);
          }
          Logger.debug(`スコープデータの内容: ${logData}...`);
        } catch (error) {
          Logger.error('スコープデータのパースエラー:', error as Error);
        }
      }
    } catch (error) {
      Logger.error('設定データの取得エラー:', error as Error);
    }
  }

  /**
   * スコープ情報を設定に保存
   */
  private async _updateScopeInConfiguration(): Promise<void> {
    try {
      // 進捗率を再計算
      let totalProgress = 0;
      if (this._selectedItems.length > 0) {
        const sum = this._selectedItems.reduce((total, item) => total + (item.progress || 0), 0);
        totalProgress = Math.round(sum / this._selectedItems.length);
      }
      
      // 既存の設定を取得
      const scopeData = vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope', '');
      let config = {};
      
      if (scopeData) {
        try {
          config = JSON.parse(scopeData as string);
          // 安全に文字列化
          let configLog = 'データなし';
          try {
            const configJson = JSON.stringify(config);
            configLog = configJson.length > 100 ? configJson.slice(0, 100) : configJson;
          } catch (err) {
            Logger.error('JSONシリアライズエラー:', err as Error);
          }
          Logger.debug(`既存スコープ設定: ${configLog}...`);
        } catch (error) {
          Logger.error('既存スコープデータの解析エラー:', error as Error);
        }
      }
      
      // 更新データを作成
      const updatedData = JSON.stringify({
        ...config,
        selectedItems: this._selectedItems,
        totalProgress,
        lastUpdated: new Date().toISOString()
      });
      
      // 安全に文字列のプレビューを生成
      let dataPreview = 'データなし';
      try {
        if (updatedData) {
          dataPreview = updatedData.length > 100 ? updatedData.slice(0, 100) : updatedData;
        }
      } catch (err) {
        Logger.error('データプレビュー生成エラー:', err as Error);
      }
      Logger.debug(`更新データ: ${dataPreview}...`);
      
      // 更新した情報で設定を上書き
      await vscode.workspace.getConfiguration('appgeniusAI').update(
        'implementationScope',
        updatedData,
        true
      );
      
      // 更新後の確認
      const verifyData = vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope', '');
      Logger.debug(`更新後のデータ確認: ${verifyData ? '設定あり' : '設定なし'}`);
      
      Logger.debug('実装スコープ情報を設定に保存しました');
    } catch (error) {
      Logger.error('スコープ情報の保存エラー:', error as Error);
    }
  }

  /**
   * メッセージの追加
   */
  private async _addMessage(role: string, content: string): Promise<void> {
    this._messages.push({ role, content });
    
    // UIにメッセージを送信
    try {
      Logger.debug(`WebViewにメッセージを送信: role=${role}, content長=${content ? content.length : 0}`);
      await this._panel.webview.postMessage({
        command: role === 'user' ? 'addUserMessage' : 'addAiMessage',
        text: content
      });
      Logger.debug('WebViewにメッセージを送信完了');
    } catch (error) {
      Logger.error('WebViewへのメッセージ送信エラー:', error as Error);
      vscode.window.showErrorMessage(`WebViewへのメッセージ送信に失敗: ${(error as Error).message}`);
    }
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
   * WebViewを更新
   */
  private async _update(): Promise<void> {
    if (!this._panel.visible) {
      return;
    }

    try {
      Logger.debug('パネルHTMLを更新します');
      this._panel.webview.html = this._getHtmlForWebview();
      Logger.debug('パネルHTMLの更新完了、状態を更新します');
      
      // HTMLが設定されてからWebView側でDOM操作が可能になるまで少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await this._updateWebview();
    } catch (error) {
      Logger.error('WebView更新中のエラー:', error as Error);
      vscode.window.showErrorMessage(`WebViewの更新に失敗: ${(error as Error).message}`);
    }
  }

  /**
   * 実装スコープのデータをロード
   */
  private async _loadImplementationScopeData(): Promise<void> {
    try {
      // 設定から実装スコープデータを取得
      const scopeData = vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope', '');
      Logger.debug(`読み込まれた実装スコープデータ: ${scopeData ? 'データあり' : 'データなし'}`);
      
      if (scopeData) {
        try {
          // 安全に文字列を扱う
          let logContent = 'データなし';
          try {
            if (scopeData) {
              const scopeStr = String(scopeData);
              logContent = scopeStr.length > 100 ? scopeStr.slice(0, 100) : scopeStr;
            }
          } catch (err) {
            logContent = 'データ形式エラー';
            Logger.error('データログ生成エラー:', err as Error);
          }
          Logger.debug(`実装スコープデータ内容: ${logContent}...`);
          const parsedData = JSON.parse(scopeData as string);
          // 安全に文字列化
          let parsedLog = 'データなし';
          try {
            const parsedJson = JSON.stringify(parsedData);
            parsedLog = parsedJson.length > 100 ? parsedJson.slice(0, 100) : parsedJson;
          } catch (err) {
            Logger.error('JSONシリアライズエラー:', err as Error);
          }
          Logger.debug(`パース後のデータ: ${parsedLog}...`);
          
          if (parsedData.selectedItems && Array.isArray(parsedData.selectedItems)) {
            Logger.debug(`選択項目数: ${parsedData.selectedItems.length}`);
            
            // 各項目に進捗関連フィールドが確実に存在するようにする
            this._selectedItems = parsedData.selectedItems.map((item: any) => {
              return {
                ...item,
                // 既存のステータスか、なければ初期値として'pending'を設定
                status: item.status || 'pending',
                // 既存の進捗率か、なければ初期値として0を設定
                progress: item.progress !== undefined ? item.progress : 0,
                // 既存のメモか、なければ空文字を設定
                notes: item.notes || ''
              };
            });
            
            // スコープ文字列を構築
            const itemTitles = this._selectedItems.map((item: any) => item.title).join('\n- ');
            this._currentScope = `選択された実装項目:\n- ${itemTitles}`;
            this._developmentAssistant.setCurrentScope(this._currentScope);
            
            // 推定時間を設定
            this._estimatedTime = parsedData.estimatedTime || '';
            
            Logger.info(`実装スコープをロードしました: ${this._selectedItems.length}件の項目`);
            
            // 初期情報を追加
            this._addMessage('assistant', `実装スコープが読み込まれました。${this._selectedItems.length}件の項目が選択されています。\n推定実装時間: ${this._estimatedTime}\n\n実装を開始するには、まずプロジェクトのディレクトリ構造を共有してください。`);
            
            // スコープ状態を最新の情報で更新
            await this._updateScopeInConfiguration();
          } else {
            Logger.warn('実装スコープデータに選択項目が含まれていないか、形式が不正です');
            Logger.debug(`選択項目: ${JSON.stringify(parsedData.selectedItems)}`);
          }
        } catch (error) {
          Logger.error('実装スコープデータの解析エラー:', error as Error);
          Logger.debug(`解析エラーの詳細: ${(error as Error).stack || 'スタックトレースなし'}`);
        }
      } else {
        Logger.debug('実装スコープデータが設定されていません');
      }
      
      // プロジェクト構造を自動的に取得
      await this._loadProjectStructure();
      
    } catch (error) {
      Logger.error('実装スコープデータのロード中にエラーが発生:', error as Error);
    }
  }
  
  /**
   * プロジェクト構造の自動ロード
   */
  private async _loadProjectStructure(): Promise<void> {
    try {
      let customPath = '';
      
      // 設定から実装スコープデータを取得
      const scopeData = vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope', '');
      if (scopeData) {
        try {
          const parsedData = JSON.parse(scopeData as string);
          if (parsedData.projectPath) {
            customPath = parsedData.projectPath;
          }
        } catch (error) {
          Logger.error('実装スコープからのプロジェクトパス取得エラー:', error as Error);
        }
      }
      
      // カスタムパスが指定されている場合は、そのパスを使用
      if (customPath) {
        // カスタムパスの存在確認
        try {
          const fs = require('fs');
          if (fs.existsSync(customPath)) {
            vscode.window.showInformationMessage(`プロジェクトディレクトリを使用: ${customPath}`);
            
            // プロジェクト構造解析ツールの実行
            this._analyzeCustomDirectory(customPath);
            return;
          } else {
            vscode.window.showWarningMessage(`指定されたパスが存在しません: ${customPath}`);
          }
        } catch (error) {
          Logger.error('カスタムパス検証エラー:', error as Error);
        }
      }
      
      // 通常のワークスペースパスを使用
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const rootPath = workspaceFolders[0].uri.fsPath;
        
        // プロジェクト構造を取得するためにコマンド実行
        const dirOutput = await vscode.commands.executeCommand('appgenius-ai.getDirectoryStructure');
        if (dirOutput && typeof dirOutput === 'string') {
          this._currentDirectoryStructure = dirOutput;
          this._developmentAssistant.setCurrentDirectory(dirOutput);
          Logger.info('プロジェクト構造を自動的に読み込みました');
        }
      }
    } catch (error) {
      Logger.error('プロジェクト構造のロード中にエラーが発生:', error as Error);
    }
  }
  
  /**
   * カスタムディレクトリの構造を解析
   */
  private async _analyzeCustomDirectory(directoryPath: string): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      const util = require('util');
      const readdir = util.promisify(fs.readdir);
      const stat = util.promisify(fs.stat);
      
      // ファイル拡張子から言語を判定する関数
      const getLanguageFromExtension = (ext: string): string => {
        const mapping: {[key: string]: string} = {
          '.js': 'JavaScript',
          '.jsx': 'JavaScript',
          '.ts': 'TypeScript',
          '.tsx': 'TypeScript',
          '.html': 'HTML',
          '.css': 'CSS',
          '.scss': 'SCSS',
          '.sass': 'SASS',
          '.json': 'JSON',
          '.md': 'Markdown',
          '.py': 'Python',
          '.rb': 'Ruby',
          '.java': 'Java',
          '.c': 'C',
          '.cpp': 'C++',
          '.php': 'PHP',
          '.go': 'Go',
          '.rs': 'Rust',
          '.swift': 'Swift',
          '.kt': 'Kotlin',
          '.yml': 'YAML',
          '.yaml': 'YAML',
          '.xml': 'XML',
          '.sh': 'Shell'
        };
        
        return mapping[ext] || 'Other';
      };
      
      // ファイル数を集計する関数
      const countFiles = async (dir: string, ignorePaths: RegExp[] = [/node_modules/, /\.git/]): Promise<{ 
        files: string[], 
        dirs: string[], 
        langCount: {[key: string]: number} 
      }> => {
        const result = {
          files: [] as string[],
          dirs: [] as string[],
          langCount: {} as {[key: string]: number}
        };
        
        const processDir = async (currentDir: string, relativePath: string = '') => {
          // 無視するパスかチェック
          if (ignorePaths.some(ignorePattern => ignorePattern.test(currentDir))) {
            return;
          }
          
          const files = await readdir(currentDir);
          for (const file of files) {
            const filePath = path.join(currentDir, file);
            const fileRelativePath = path.join(relativePath, file);
            
            try {
              const fileStat = await stat(filePath);
              
              if (fileStat.isDirectory()) {
                result.dirs.push(fileRelativePath);
                // サブディレクトリを再帰的に処理
                await processDir(filePath, fileRelativePath);
              } else {
                result.files.push(fileRelativePath);
                
                // 言語をカウント
                const ext = path.extname(file);
                const lang = getLanguageFromExtension(ext);
                
                if (!result.langCount[lang]) {
                  result.langCount[lang] = 0;
                }
                result.langCount[lang]++;
              }
            } catch (err) {
              Logger.error(`ファイル解析エラー ${filePath}:`, err as Error);
            }
          }
        };
        
        await processDir(dir);
        return result;
      };
      
      // ディレクトリ構造の解析を実行
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "プロジェクト構造を解析中...",
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0 });
        
        try {
          const analysis = await countFiles(directoryPath);
          progress.report({ increment: 50 });
          
          // ディレクトリ構造のテキスト表現を構築
          let structureText = `プロジェクトディレクトリ構造:\n${directoryPath}\n\n`;
          
          // 言語別ファイル数
          structureText += `言語別ファイル数:\n`;
          Object.entries(analysis.langCount)
            .sort(([, a], [, b]) => b - a)
            .forEach(([lang, count]) => {
              structureText += `- ${lang}: ${count}\n`;
            });
            
          // 主要ディレクトリ
          structureText += `\n主要ディレクトリ:\n`;
          analysis.dirs.slice(0, 10).forEach((dir) => {
            structureText += `- ${dir}\n`;
          });
          
          // 解析結果を設定
          this._currentDirectoryStructure = structureText;
          this._developmentAssistant.setCurrentDirectory(structureText);
          
          // ファイルのパスも設定
          this._currentFiles = analysis.files;
          this._developmentAssistant.setCurrentFiles(analysis.files);
          
          Logger.info(`カスタムディレクトリの解析完了: ${directoryPath}`);
          
          // 更新を通知
          await this._updateWebview();
          
          progress.report({ increment: 100 });
        } catch (error) {
          Logger.error('ディレクトリ解析エラー:', error as Error);
          vscode.window.showErrorMessage(`ディレクトリの解析に失敗しました: ${(error as Error).message}`);
        }
      });
    } catch (error) {
      Logger.error('カスタムディレクトリ解析エラー:', error as Error);
      vscode.window.showErrorMessage(`ディレクトリの解析に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * WebViewの状態を更新
   */
  private async _updateWebview(): Promise<void> {
    try {
      Logger.debug('WebViewの状態を更新します');
      
      // 進捗情報を取得
      let totalProgress = 0;
      let startDate = '';
      let targetDate = '';
      let projectItems = [];
      
      try {
        const scopeData = vscode.workspace.getConfiguration('appgeniusAI').get('implementationScope', '');
        if (scopeData) {
          const parsedData = JSON.parse(scopeData as string);
          totalProgress = parsedData.totalProgress || 0;
          startDate = parsedData.startDate || '';
          targetDate = parsedData.targetDate || '';
          projectItems = parsedData.selectedItems || [];
          
          // アイテムの進捗状況を更新
          if (this._selectedItems.length === 0 && projectItems.length > 0) {
            this._selectedItems = projectItems;
          }
        }
      } catch (error) {
        Logger.error('スコープデータ解析エラー:', error as Error);
      }
      
      const updateData = {
        command: 'updateState',
        currentPhase: this._phaseManager.currentPhase,
        phases: this._phaseManager.allPhases,
        messages: this._messages,
        directoryStructure: this._currentDirectoryStructure,
        scope: this._currentScope,
        files: this._currentFiles,
        selectedItems: this._selectedItems,
        estimatedTime: this._estimatedTime,
        totalProgress,
        startDate,
        targetDate,
        // プロジェクト進捗状況のサマリーを追加
        progressSummary: {
          totalItems: this._selectedItems.length,
          completedItems: this._selectedItems.filter(item => item.status === 'completed').length,
          inProgressItems: this._selectedItems.filter(item => item.status === 'in-progress').length,
          pendingItems: this._selectedItems.filter(item => item.status === 'pending').length,
          blockedItems: this._selectedItems.filter(item => item.status === 'blocked').length
        }
      };
      
      Logger.debug(`updateState: currentPhase=${updateData.currentPhase}, messages=${updateData.messages.length}件, progress=${totalProgress}%`);
      
      await this._panel.webview.postMessage(updateData);
      Logger.debug('WebViewの状態更新完了');
    } catch (error) {
      Logger.error('WebView更新中のエラー:', error as Error);
      vscode.window.showErrorMessage(`WebViewの更新に失敗: ${(error as Error).message}`);
    }
  }

  /**
   * WebView用のHTMLを生成
   */
  private _getHtmlForWebview(): string {
    // CSS, JS のURI生成
    const webview = this._panel.webview;
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
    );
    const developmentAssistantCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'developmentAssistant.css')
    );
    const developmentAssistantJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'developmentAssistant.js')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
    );

    // HTMLを返す
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AppGenius 開発アシスタント</title>
  <link href="${styleResetUri}" rel="stylesheet">
  <link href="${styleVSCodeUri}" rel="stylesheet">
  <link href="${developmentAssistantCssUri}" rel="stylesheet">
  <link href="${codiconsUri}" rel="stylesheet">
  <style>
    /* 進捗バーのスタイル */
    .progress-container {
      margin-top: 10px;
      margin-bottom: 20px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 15px;
      background-color: var(--vscode-editor-background);
    }
    
    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    
    .progress-bar {
      width: 100%;
      height: 10px;
      background-color: var(--vscode-input-background);
      border-radius: 5px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    
    .progress-fill {
      height: 100%;
      background-color: var(--vscode-progressBar-background);
      transition: width 0.5s ease;
    }
    
    .progress-stats {
      display: flex;
      justify-content: space-between;
      margin-top: 5px;
      font-size: 12px;
    }
    
    .progress-item {
      display: flex;
      flex-direction: column;
      padding: 8px;
      margin-bottom: 5px;
      border-radius: 4px;
      background-color: var(--vscode-input-background);
    }
    
    .progress-item .title {
      font-weight: bold;
    }
    
    .status-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      margin-left: 10px;
      display: inline-block;
    }
    
    .status-pending {
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    
    .status-in-progress {
      background-color: var(--vscode-statusBarItem-prominentBackground);
      color: var(--vscode-statusBarItem-prominentForeground);
    }
    
    .status-completed {
      background-color: var(--vscode-terminal-ansiGreen);
      color: var(--vscode-editor-background);
    }
    
    .status-blocked {
      background-color: var(--vscode-errorForeground);
      color: var(--vscode-editor-background);
    }
    
    .item-progress-bar {
      width: 100%;
      height: 6px;
      background-color: var(--vscode-input-background);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 5px;
    }
    
    .item-progress-fill {
      height: 100%;
      background-color: var(--vscode-progressBar-background);
    }
    
    .date-info {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
    }
    
    /* タブのスタイル */
    .tab-container {
      margin-top: 10px;
    }
    
    .tab-buttons {
      display: flex;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .tab-button {
      padding: 8px 15px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      color: var(--vscode-foreground);
    }
    
    .tab-button.active {
      border-bottom: 2px solid var(--vscode-focusBorder);
      font-weight: bold;
    }
    
    .tab-content {
      display: none;
      padding: 15px 0;
    }
    
    .tab-content.active {
      display: block;
    }
    
    /* フィルターコントロール */
    .filter-controls {
      display: flex;
      margin-bottom: 10px;
      gap: 5px;
    }
    
    .filter-button {
      padding: 3px 8px;
      border-radius: 3px;
      border: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      font-size: 12px;
    }
    
    .filter-button.active {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>AppGenius 開発アシスタント</h2>
      <p>AIを活用したコード開発と改善をサポートします</p>
    </div>
    
    <div class="content">
      <div class="sidebar">
        <h3>プロジェクト進捗</h3>
        <div id="progress-dashboard" class="progress-container">
          <div class="progress-header">
            <span>全体進捗</span>
            <span id="progress-percentage">0%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
          </div>
          <div class="date-info">
            <span id="start-date">開始日: --</span>
            <span id="target-date">目標日: --</span>
          </div>
          <div class="progress-stats">
            <span id="completed-count">完了: 0</span>
            <span id="in-progress-count">進行中: 0</span>
            <span id="pending-count">未着手: 0</span>
            <span id="blocked-count">ブロック: 0</span>
          </div>
        </div>
        
        <div class="tab-container">
          <div class="tab-buttons">
            <button id="tab-items" class="tab-button active">実装項目</button>
            <button id="tab-phases" class="tab-button">フェーズ</button>
            <button id="tab-info" class="tab-button">プロジェクト情報</button>
          </div>
          
          <div id="tab-content-items" class="tab-content active">
            <div class="filter-controls">
              <button class="filter-button active" data-filter="all">すべて</button>
              <button class="filter-button" data-filter="completed">完了</button>
              <button class="filter-button" data-filter="in-progress">進行中</button>
              <button class="filter-button" data-filter="pending">未着手</button>
              <button class="filter-button" data-filter="blocked">ブロック</button>
            </div>
            <div id="implementation-items">
              <!-- 実装項目リストがここに動的に生成されます -->
              <p>実装項目がロードされていません</p>
            </div>
          </div>
          
          <div id="tab-content-phases" class="tab-content">
            <div id="phases-list">
              <!-- フェーズリストがここに動的に生成されます -->
              <p>フェーズ情報がロードされていません</p>
            </div>
          </div>
          
          <div id="tab-content-info" class="tab-content">
            <div id="project-structure-info">
              <p>ディレクトリ構造が読み込まれていません</p>
            </div>
            <div id="scope-info">
              <p>実装スコープが設定されていません</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="main" id="main-content">
        <div id="loading">読み込み中...</div>
        
        <div class="chat-container">
          <div class="chat-messages" id="chat-messages">
            <!-- チャットメッセージがここに追加されます -->
          </div>
          <div class="chat-input">
            <textarea id="chat-input" placeholder="メッセージを入力..." rows="1"></textarea>
            <button id="send-message">送信</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script src="${developmentAssistantJsUri}"></script>
</body>
</html>`;
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    DevelopmentAssistantPanel.currentPanel = undefined;
    this._panel.dispose();
    
    // スコープアップデーターも破棄
    if (this._scopeUpdater) {
      this._scopeUpdater.dispose();
      this._scopeUpdater = undefined;
    }
    
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}