import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DesignPhase, DesignPhaseManager } from '../../modes/designMode/designPhases';
import { MockupDesigner, PageDefinition, Mockup } from '../../modes/designMode/mockupDesigner';
import { AIService } from '../../core/aiService';
import { Logger } from '../../utils/logger';

/**
 * モックアップデザイナーパネル
 * UI設計とモックアップ生成のためのWebViewインターフェース
 */
export class MockupDesignerPanel {
  public static currentPanel: MockupDesignerPanel | undefined;
  private static readonly viewType = 'mockupDesigner';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private _phaseManager: DesignPhaseManager;
  private _mockupDesigner: MockupDesigner;

  // 現在の作業状態
  private _currentRequirements: string = '';
  private _currentPages: PageDefinition[] = [];
  private _currentMockups: Map<string, Mockup[]> = new Map();
  private _currentDirectoryStructure: string = '';
  private _currentSpecification: string = '';

  /**
   * パネルを作成または表示
   */
  public static createOrShow(extensionUri: vscode.Uri, aiService: AIService): MockupDesignerPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は、それを表示
    if (MockupDesignerPanel.currentPanel) {
      MockupDesignerPanel.currentPanel._panel.reveal(column);
      return MockupDesignerPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      MockupDesignerPanel.viewType,
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

    MockupDesignerPanel.currentPanel = new MockupDesignerPanel(panel, extensionUri, aiService);
    return MockupDesignerPanel.currentPanel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, aiService: AIService) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    
    // ビジネスロジックの初期化
    this._phaseManager = new DesignPhaseManager();
    this._mockupDesigner = new MockupDesigner(aiService);

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
          case 'setRequirements':
            this._currentRequirements = message.text;
            await this._updateWebview();
            break;
          case 'generatePageStructure':
            await this._handleGeneratePageStructure();
            break;
          case 'generateMockup':
            await this._handleGenerateMockup(message.pageId, message.framework);
            break;
          case 'showMockupPreview':
            await this._handleShowMockupPreview(message.pageId, message.mockupIndex);
            break;
          case 'openMockupInBrowser':
            await this._handleOpenMockupInBrowser(message.pageId, message.mockupIndex);
            break;
          case 'updateMockup':
            await this._handleUpdateMockup(message.pageId, message.mockupIndex);
            break;
          case 'generateDirectoryStructure':
            await this._handleGenerateDirectoryStructure();
            break;
          case 'generateSpecification':
            await this._handleGenerateSpecification();
            break;
          case 'sendChatMessage':
            await this._handleSendChatMessage(message.text);
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
  private async _handleStartPhase(phase: DesignPhase): Promise<void> {
    try {
      this._phaseManager.moveToPhase(phase);
      await this._updateWebview();
    } catch (error) {
      Logger.error(`フェーズ開始エラー: ${phase}`, error as Error);
      await this._showError(`フェーズ開始エラー: ${(error as Error).message}`);
    }
  }

  /**
   * フェーズ完了の処理
   */
  private async _handleCompletePhase(phase: DesignPhase, data: any): Promise<void> {
    try {
      // フェーズごとのデータを保存
      switch (phase) {
        case DesignPhase.REQUIREMENTS:
          this._currentRequirements = data.requirements;
          break;
        case DesignPhase.PAGE_STRUCTURE:
          this._currentPages = data.pages;
          break;
        case DesignPhase.MOCKUPS:
          // モックアップのデータは_currentMockupsに既に保存されている
          break;
        case DesignPhase.DIRECTORY_STRUCTURE:
          this._currentDirectoryStructure = data.directoryStructure;
          break;
        case DesignPhase.SPECIFICATION:
          this._currentSpecification = data.specification;
          break;
      }

      // フェーズを完了とマーク
      this._phaseManager.setPhaseCompletion(phase, true);
      
      // 次のフェーズに進む
      this._phaseManager.advanceToNextPhase();
      
      await this._updateWebview();
    } catch (error) {
      Logger.error(`フェーズ完了エラー: ${phase}`, error as Error);
      await this._showError(`フェーズ完了エラー: ${(error as Error).message}`);
    }
  }

  /**
   * ページ構造生成の処理
   */
  private async _handleGeneratePageStructure(): Promise<void> {
    try {
      if (!this._currentRequirements) {
        throw new Error('要件が入力されていません');
      }

      // 進捗表示
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ページ構造を生成中...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });
          
          // ページ構造を生成
          const pages = await this._mockupDesigner.generatePageStructure(this._currentRequirements);
          
          // 結果を保存
          this._currentPages = pages;
          
          // 各ページをデザイナーに追加
          this._mockupDesigner.getPages().forEach(page => this._mockupDesigner.removePage(page.id));
          pages.forEach(page => this._mockupDesigner.addPage(page));
          
          progress.report({ increment: 100 });
          
          // UIを更新
          await this._updateWebview();
        }
      );
    } catch (error) {
      Logger.error('ページ構造生成エラー', error as Error);
      await this._showError(`ページ構造生成エラー: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップ生成の処理
   */
  private async _handleGenerateMockup(pageId: string, framework: string = 'html'): Promise<void> {
    try {
      const page = this._mockupDesigner.getPageById(pageId);
      if (!page) {
        throw new Error(`ページが見つかりません: ${pageId}`);
      }

      // 進捗表示
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `モックアップを生成中: ${page.name}`,
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });
          
          // モックアップを生成
          const mockup = await this._mockupDesigner.generateMockup(pageId, framework);
          
          progress.report({ increment: 100 });
          
          // 結果を保存
          if (mockup) {
            if (!this._currentMockups.has(pageId)) {
              this._currentMockups.set(pageId, []);
            }
            this._currentMockups.get(pageId)?.push(mockup);
          }
          
          // UIを更新
          await this._updateWebview();
          
          // 成功メッセージを表示
          vscode.window.showInformationMessage(`モックアップが生成されました: ${page.name}`);
        }
      );
    } catch (error) {
      Logger.error(`モックアップ生成エラー: ${pageId}`, error as Error);
      await this._showError(`モックアップ生成エラー: ${(error as Error).message}`);
    }
  }

  /**
   * モックアッププレビュー表示の処理
   */
  private async _handleShowMockupPreview(pageId: string, mockupIndex: number = 0): Promise<void> {
    try {
      const mockups = this._currentMockups.get(pageId);
      if (!mockups || mockups.length === 0) {
        throw new Error(`モックアップが見つかりません: ${pageId}`);
      }

      if (mockupIndex < 0 || mockupIndex >= mockups.length) {
        throw new Error(`指定されたインデックスのモックアップが見つかりません: index=${mockupIndex}`);
      }

      await this._mockupDesigner.showPreview(mockups[mockupIndex]);
    } catch (error) {
      Logger.error(`モックアッププレビューエラー: ${pageId}, index=${mockupIndex}`, error as Error);
      await this._showError(`モックアッププレビューエラー: ${(error as Error).message}`);
    }
  }

  /**
   * モックアップをブラウザで開く処理
   */
  private async _handleOpenMockupInBrowser(pageId: string, mockupIndex: number = 0): Promise<void> {
    try {
      const mockups = this._currentMockups.get(pageId);
      if (!mockups || mockups.length === 0) {
        throw new Error(`モックアップが見つかりません: ${pageId}`);
      }

      if (mockupIndex < 0 || mockupIndex >= mockups.length) {
        throw new Error(`指定されたインデックスのモックアップが見つかりません: index=${mockupIndex}`);
      }

      await this._mockupDesigner.openInBrowser(mockups[mockupIndex]);
    } catch (error) {
      Logger.error(`モックアップブラウザ表示エラー: ${pageId}, index=${mockupIndex}`, error as Error);
      await this._showError(`モックアップブラウザ表示エラー: ${(error as Error).message}`);
    }
  }
  
  /**
   * モックアップを更新する処理
   */
  private async _handleUpdateMockup(pageId: string, mockupIndex: number = 0): Promise<void> {
    try {
      const mockups = this._currentMockups.get(pageId);
      if (!mockups || mockups.length === 0) {
        throw new Error(`モックアップが見つかりません: ${pageId}`);
      }

      if (mockupIndex < 0 || mockupIndex >= mockups.length) {
        throw new Error(`指定されたインデックスのモックアップが見つかりません: index=${mockupIndex}`);
      }
      
      // 更新するモックアップ
      const mockupToUpdate = mockups[mockupIndex];
      
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
      
      // 進捗表示
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'モックアップを更新中...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });
          
          // メッセージをWebViewに表示（オプション）
          await this._panel.webview.postMessage({
            command: 'addUserMessage',
            text: `モックアップ更新: ${updateInput}`
          });
          
          // 処理中の状態をWebViewに通知
          await this._panel.webview.postMessage({
            command: 'showProcessing',
            processing: true
          });
          
          try {
            // AIを使用してモックアップを更新
            const response = await this._mockupDesigner.processAiAssistantMessage(updateInput, mockupToUpdate);
            
            // AIの応答をWebViewに表示
            await this._panel.webview.postMessage({
              command: 'addAiMessage',
              text: response.message
            });
            
            // 更新されたコードブロックが含まれている場合
            if (response.codeBlocks && response.codeBlocks.length > 0) {
              Logger.info(`${response.codeBlocks.length}個のコードブロックで更新します`);
              
              // 更新前のモックアップパスを保存
              const originalPaths = {
                htmlPath: mockupToUpdate.htmlPath,
                cssPath: mockupToUpdate.cssPath,
                jsPath: mockupToUpdate.jsPath,
                fullHtmlPath: mockupToUpdate.fullHtmlPath
              };
              
              // 各コードブロックを処理
              for (const codeBlock of response.codeBlocks) {
                try {
                  const filename = codeBlock.filename || this._generateFilename(codeBlock.language);
                  Logger.debug(`コードブロック更新: ${filename}, 言語: ${codeBlock.language}, コード長: ${codeBlock.code.length}`);
                  
                  // コードが空でないことを確認
                  if (!codeBlock.code || codeBlock.code.trim() === '') {
                    Logger.warn(`コードが空のため更新をスキップします: ${filename}`);
                    continue;
                  }
                  
                  // 更新前と同じファイルパスを使用
                  let targetPath = '';
                  if (codeBlock.language === 'html' && originalPaths.htmlPath) {
                    targetPath = originalPaths.htmlPath;
                  } else if (codeBlock.language === 'css' && originalPaths.cssPath) {
                    targetPath = originalPaths.cssPath;
                  } else if (['js', 'javascript', 'jsx'].includes(codeBlock.language) && originalPaths.jsPath) {
                    targetPath = originalPaths.jsPath;
                  } else {
                    // 該当するパスがない場合は新規ファイルとして保存
                    await this._saveCodeToFile(filename, codeBlock.code);
                    continue;
                  }
                  
                  // ファイルを上書き
                  fs.writeFileSync(targetPath, codeBlock.code);
                  Logger.info(`コードブロックを更新しました: ${targetPath}`);
                  
                  // fullHtmlPathも更新が必要な場合は再生成
                  if (codeBlock.language === 'html' && originalPaths.fullHtmlPath) {
                    // fullHtmlを再生成する処理（必要に応じて実装）
                    // ここでは単純にコピー
                    fs.writeFileSync(originalPaths.fullHtmlPath, codeBlock.code);
                  }
                  
                  // 更新通知をWebViewに送信
                  await this._panel.webview.postMessage({
                    command: 'notifyCodeUpdated',
                    filename: path.basename(targetPath),
                    language: codeBlock.language
                  });
                } catch (error) {
                  const codeError = error as Error;
                  Logger.error(`コードブロック更新エラー: ${codeError.message}`, codeError);
                  vscode.window.showErrorMessage(`コードブロックの更新に失敗しました: ${codeError.message}`);
                }
              }
              
              progress.report({ increment: 100 });
              vscode.window.showInformationMessage('モックアップが更新されました');
            } else {
              Logger.info('更新するコードブロックがありません');
              vscode.window.showWarningMessage('更新するコードブロックが見つかりませんでした');
            }
          } finally {
            // 処理完了を通知（エラーがあってもなくても実行）
            await this._panel.webview.postMessage({
              command: 'showProcessing',
              processing: false
            });
          }
        }
      );
    } catch (error) {
      Logger.error(`モックアップ更新エラー: ${pageId}, index=${mockupIndex}`, error as Error);
      await this._showError(`モックアップ更新エラー: ${(error as Error).message}`);
    }
  }

  /**
   * ディレクトリ構造生成の処理
   */
  private async _handleGenerateDirectoryStructure(): Promise<void> {
    try {
      if (this._currentPages.length === 0) {
        throw new Error('ページ構造が定義されていません');
      }

      // 進捗表示
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'ディレクトリ構造を生成中...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });
          
          // ディレクトリ構造を生成
          const directoryStructure = await this._mockupDesigner.generateDirectoryStructure(this._currentPages);
          
          // 結果を保存
          this._currentDirectoryStructure = directoryStructure;
          
          progress.report({ increment: 100 });
          
          // UIを更新
          await this._updateWebview();
        }
      );
    } catch (error) {
      Logger.error('ディレクトリ構造生成エラー', error as Error);
      await this._showError(`ディレクトリ構造生成エラー: ${(error as Error).message}`);
    }
  }

  /**
   * 要件定義書生成の処理
   */
  private async _handleGenerateSpecification(): Promise<void> {
    try {
      if (this._currentPages.length === 0) {
        throw new Error('ページ構造が定義されていません');
      }
      
      if (!this._currentDirectoryStructure) {
        throw new Error('ディレクトリ構造が定義されていません');
      }

      // 進捗表示
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '要件定義書を生成中...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0 });
          
          // 要件定義書を生成
          const specification = await this._mockupDesigner.generateSpecification(
            this._currentPages, 
            this._currentDirectoryStructure
          );
          
          // 結果を保存
          this._currentSpecification = specification;
          
          progress.report({ increment: 100 });
          
          // UIを更新
          await this._updateWebview();
        }
      );
    } catch (error) {
      Logger.error('要件定義書生成エラー', error as Error);
      await this._showError(`要件定義書生成エラー: ${(error as Error).message}`);
    }
  }

  /**
   * チャットメッセージの送信処理
   */
  private async _handleSendChatMessage(text: string): Promise<void> {
    try {
      Logger.info('チャットメッセージを受信:', text);
      
      // メッセージをWebViewに表示
      await this._panel.webview.postMessage({
        command: 'addUserMessage',
        text: text
      });
      
      // 処理中の状態をWebViewに通知
      await this._panel.webview.postMessage({
        command: 'showProcessing',
        processing: true
      });
      
      try {
        // AIサービスを使用してメッセージを処理
        const response = await this._mockupDesigner.processAiAssistantMessage(text);
        
        // AIの応答をWebViewに表示
        await this._panel.webview.postMessage({
          command: 'addAiMessage',
          text: response.message
        });
        
        // コードブロックが含まれている場合は保存処理
        if (response.codeBlocks && response.codeBlocks.length > 0) {
          Logger.info(`${response.codeBlocks.length}個のコードブロックを保存します`);
          
          for (const codeBlock of response.codeBlocks) {
            try {
              const filename = codeBlock.filename || this._generateFilename(codeBlock.language);
              Logger.debug(`コードブロック保存開始: ${filename}, 言語: ${codeBlock.language}, コード長: ${codeBlock.code.length}`);
              
              // コードが空でないことを確認
              if (!codeBlock.code || codeBlock.code.trim() === '') {
                Logger.warn(`コードが空のため保存をスキップします: ${filename}`);
                continue;
              }
              
              await this._saveCodeToFile(filename, codeBlock.code);
              Logger.info(`コードブロックを保存しました: ${filename}`);
              
              // コード保存通知をWebViewに送信
              await this._panel.webview.postMessage({
                command: 'notifyCodeSaved',
                filename,
                language: codeBlock.language
              });
            } catch (error) {
              const codeError = error as Error;
              Logger.error(`コードブロック保存エラー: ${codeError.message}`, codeError);
              vscode.window.showErrorMessage(`コードブロックの保存に失敗しました: ${codeError.message}`);
            }
          }
        } else {
          Logger.info('保存するコードブロックはありません');
        }
      } finally {
        // 処理完了を通知（エラーがあってもなくても実行）
        await this._panel.webview.postMessage({
          command: 'showProcessing',
          processing: false
        });
      }
    } catch (error) {
      Logger.error('チャットメッセージ処理エラー', error as Error);
      await this._showError(`チャットメッセージの処理中にエラーが発生しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * ファイル名を生成
   */
  private _generateFilename(language: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = this._getExtensionForLanguage(language);
    return `generated-${timestamp}${extension}`;
  }
  
  /**
   * 言語に対応する拡張子を取得
   */
  private _getExtensionForLanguage(language: string): string {
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
   * コードをファイルに保存
   */
  private async _saveCodeToFile(filename: string, code: string): Promise<void> {
    try {
      // 現在のワークスペースのルートディレクトリを取得
      let saveDir: string;
      
      // 固定のディレクトリパスを使用する
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      saveDir = path.join(homeDir, 'Desktop', 'システム開発', 'モックアップ', 'generated');
      
      // 生成コード用ディレクトリを作成
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
        Logger.info(`生成ディレクトリを作成しました: ${saveDir}`);
      }
      
      const filePath = path.join(saveDir, filename);
      
      Logger.debug(`ファイル保存パス: ${filePath}`);
      Logger.debug(`保存するコード長: ${code.length}`);
      
      // コード内容のデバッグログ（最初の100文字）
      if (code.length > 0) {
        Logger.debug(`コード内容プレビュー: ${code.substring(0, Math.min(100, code.length))}...`);
      }
      
      // ファイルに書き込み
      fs.writeFileSync(filePath, code);
      
      Logger.info(`コードをファイルに保存しました: ${filePath}`);
      vscode.window.showInformationMessage(`コードを保存しました: ${filename} (保存先: ${saveDir})`);
      
      // ファイルを開く
      const uri = vscode.Uri.file(filePath);
      await vscode.window.showTextDocument(uri);
    } catch (error) {
      Logger.error('コード保存エラー', error as Error);
      vscode.window.showErrorMessage(`コード保存エラー: ${(error as Error).message}`);
      throw error;
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

    this._panel.webview.html = this._getHtmlForWebview();
    await this._updateWebview();
  }

  /**
   * WebViewの状態を更新
   */
  private async _updateWebview(): Promise<void> {
    await this._panel.webview.postMessage({
      command: 'updateState',
      currentPhase: this._phaseManager.currentPhase,
      phases: this._phaseManager.allPhases,
      requirements: this._currentRequirements,
      pages: this._currentPages,
      mockups: Array.from(this._currentMockups.entries()).map(([pageId, mockups]) => ({
        pageId,
        versions: mockups.map((mockup, index) => ({
          id: index,
          timestamp: mockup.timestamp,
          hasPreview: !!mockup.htmlPath
        }))
      })),
      directoryStructure: this._currentDirectoryStructure,
      specification: this._currentSpecification
    });
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
  <title>モックアップデザイナー</title>
  <link href="${styleUri}" rel="stylesheet">
  <link href="${codiconsUri}" rel="stylesheet">
  <style>
    body {
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      padding: 0;
      margin: 0;
    }
    
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    
    .header {
      padding: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .content {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    
    .sidebar {
      width: 250px;
      border-right: 1px solid var(--vscode-panel-border);
      overflow-y: auto;
      padding: 10px;
    }
    
    .main {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    
    .phase-item {
      padding: 8px;
      margin-bottom: 5px;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .phase-item.active {
      background-color: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    
    .phase-item.completed {
      text-decoration: line-through;
      opacity: 0.7;
    }
    
    .button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 2px;
      cursor: pointer;
      margin-right: 5px;
      margin-bottom: 5px;
    }
    
    .button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    textarea, input {
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 5px;
      width: 100%;
      margin-bottom: 10px;
    }
    
    .chat-container {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      height: 300px;
      display: flex;
      flex-direction: column;
      margin-top: 20px;
    }
    
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    }
    
    .chat-input {
      border-top: 1px solid var(--vscode-panel-border);
      padding: 10px;
      display: flex;
    }
    
    .chat-input input {
      flex: 1;
      margin-bottom: 0;
      margin-right: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>モックアップデザイナー</h2>
      <p>プロジェクトの要件定義からモックアップを生成します</p>
    </div>
    
    <div class="content">
      <div class="sidebar">
        <h3>フェーズ</h3>
        <div id="phases-list">
          <!-- フェーズリストがここに動的に生成されます -->
        </div>
      </div>
      
      <div class="main" id="main-content">
        <!-- メインコンテンツがここに動的に生成されます -->
        <div id="loading">読み込み中...</div>
      </div>
    </div>
  </div>
  
  <script>
    // メインのロジックはここに実装
    (function() {
      const vscode = acquireVsCodeApi();
      
      // 状態を保持
      let state = {
        currentPhase: 'requirements',
        phases: [],
        requirements: '',
        pages: [],
        mockups: [],
        directoryStructure: '',
        specification: ''
      };
      
      // メッセージのハンドラーを登録
      window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
          case 'updateState':
            updateState(message);
            break;
          case 'showError':
            showError(message.message);
            break;
        }
      });
      
      // 状態の更新
      function updateState(newState) {
        state = { ...state, ...newState };
        renderPhasesList();
        renderMainContent();
      }
      
      // エラーの表示
      function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const mainContent = document.getElementById('main-content');
        mainContent.prepend(errorDiv);
        
        // 5秒後に自動で消去
        setTimeout(() => {
          errorDiv.remove();
        }, 5000);
      }
      
      // フェーズリストのレンダリング
      function renderPhasesList() {
        const phasesList = document.getElementById('phases-list');
        phasesList.innerHTML = '';
        
        state.phases.forEach(phase => {
          const phaseItem = document.createElement('div');
          phaseItem.className = 'phase-item';
          
          if (phase.id === state.currentPhase) {
            phaseItem.classList.add('active');
          }
          
          if (phase.isCompleted) {
            phaseItem.classList.add('completed');
          }
          
          phaseItem.textContent = phase.name;
          
          phaseItem.addEventListener('click', () => {
            vscode.postMessage({
              command: 'startPhase',
              phase: phase.id
            });
          });
          
          phasesList.appendChild(phaseItem);
        });
      }
      
      // メインコンテンツのレンダリング
      function renderMainContent() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = '';
        
        // 現在のフェーズに応じてコンテンツを表示
        switch (state.currentPhase) {
          case 'requirements':
            renderRequirementsPhase(mainContent);
            break;
          case 'pageStructure':
            renderPageStructurePhase(mainContent);
            break;
          case 'mockups':
            renderMockupsPhase(mainContent);
            break;
          case 'directoryStructure':
            renderDirectoryStructurePhase(mainContent);
            break;
          case 'specification':
            renderSpecificationPhase(mainContent);
            break;
          default:
            mainContent.innerHTML = '<p>不明なフェーズです</p>';
        }
        
        // チャットセクションを追加
        renderChatSection(mainContent);
      }
      
      // 要件定義フェーズのレンダリング
      function renderRequirementsPhase(container) {
        const phaseInfo = state.phases.find(p => p.id === 'requirements');
        
        const header = document.createElement('h3');
        header.textContent = phaseInfo ? phaseInfo.name : '要件定義';
        container.appendChild(header);
        
        const description = document.createElement('p');
        description.textContent = phaseInfo ? phaseInfo.description : 'プロジェクトの要件を定義します';
        container.appendChild(description);
        
        // タスクリスト
        if (phaseInfo && phaseInfo.tasks.length > 0) {
          const tasksList = document.createElement('ul');
          phaseInfo.tasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.textContent = task;
            tasksList.appendChild(taskItem);
          });
          container.appendChild(tasksList);
        }
        
        // 要件入力フォーム
        const form = document.createElement('div');
        form.innerHTML = \`
          <label for="requirements">プロジェクトの要件を入力してください:</label>
          <textarea id="requirements" rows="10">\${state.requirements}</textarea>
          <button id="save-requirements" class="button">保存</button>
          <button id="complete-requirements" class="button">次のフェーズへ</button>
        \`;
        container.appendChild(form);
        
        // イベントリスナーの登録
        document.getElementById('save-requirements').addEventListener('click', () => {
          const requirements = document.getElementById('requirements').value;
          vscode.postMessage({
            command: 'setRequirements',
            text: requirements
          });
        });
        
        document.getElementById('complete-requirements').addEventListener('click', () => {
          const requirements = document.getElementById('requirements').value;
          if (!requirements.trim()) {
            showError('要件を入力してください');
            return;
          }
          
          vscode.postMessage({
            command: 'completePhase',
            phase: 'requirements',
            data: { requirements }
          });
        });
      }
      
      // ページ構造フェーズのレンダリング
      function renderPageStructurePhase(container) {
        const phaseInfo = state.phases.find(p => p.id === 'pageStructure');
        
        const header = document.createElement('h3');
        header.textContent = phaseInfo ? phaseInfo.name : 'ページ構造と機能の策定';
        container.appendChild(header);
        
        const description = document.createElement('p');
        description.textContent = phaseInfo ? phaseInfo.description : '必要なページとその機能を明確にします';
        container.appendChild(description);
        
        // ボタン
        const buttonContainer = document.createElement('div');
        buttonContainer.innerHTML = \`
          <button id="generate-pages" class="button">ページ構造を生成</button>
          <button id="complete-pageStructure" class="button">次のフェーズへ</button>
        \`;
        container.appendChild(buttonContainer);
        
        // 現在のページ一覧
        const pagesSection = document.createElement('div');
        pagesSection.innerHTML = '<h4>ページ一覧</h4>';
        
        if (state.pages.length === 0) {
          pagesSection.innerHTML += '<p>ページが定義されていません</p>';
        } else {
          const pagesList = document.createElement('ul');
          state.pages.forEach(page => {
            const pageItem = document.createElement('li');
            pageItem.innerHTML = \`
              <strong>\${page.name}</strong> (ID: \${page.id}, ルート: \${page.route})
              <p>\${page.description}</p>
              <p>コンポーネント: \${page.components.join(', ')}</p>
              <p>API エンドポイント: \${page.apiEndpoints.join(', ')}</p>
            \`;
            pagesList.appendChild(pageItem);
          });
          pagesSection.appendChild(pagesList);
        }
        
        container.appendChild(pagesSection);
        
        // イベントリスナーの登録
        document.getElementById('generate-pages').addEventListener('click', () => {
          vscode.postMessage({
            command: 'generatePageStructure'
          });
        });
        
        document.getElementById('complete-pageStructure').addEventListener('click', () => {
          if (state.pages.length === 0) {
            showError('ページ構造を生成してください');
            return;
          }
          
          vscode.postMessage({
            command: 'completePhase',
            phase: 'pageStructure',
            data: { pages: state.pages }
          });
        });
      }
      
      // モックアップフェーズのレンダリング
      function renderMockupsPhase(container) {
        const phaseInfo = state.phases.find(p => p.id === 'mockups');
        
        const header = document.createElement('h3');
        header.textContent = phaseInfo ? phaseInfo.name : 'モックアップ作成';
        container.appendChild(header);
        
        const description = document.createElement('p');
        description.textContent = phaseInfo ? phaseInfo.description : '各ページのモックアップを作成します';
        container.appendChild(description);
        
        // ボタン
        const buttonContainer = document.createElement('div');
        buttonContainer.innerHTML = \`
          <button id="complete-mockups" class="button">次のフェーズへ</button>
        \`;
        container.appendChild(buttonContainer);
        
        // ページごとのモックアップセクション
        const mockupsSection = document.createElement('div');
        mockupsSection.innerHTML = '<h4>ページごとのモックアップ</h4>';
        
        if (state.pages.length === 0) {
          mockupsSection.innerHTML += '<p>ページが定義されていません</p>';
        } else {
          const mockupsList = document.createElement('div');
          
          state.pages.forEach(page => {
            const mockupItem = document.createElement('div');
            mockupItem.style.marginBottom = '20px';
            mockupItem.style.padding = '10px';
            mockupItem.style.border = '1px solid var(--vscode-panel-border)';
            mockupItem.style.borderRadius = '4px';
            
            // ページ情報
            const pageInfo = document.createElement('div');
            pageInfo.innerHTML = \`
              <h5>\${page.name}</h5>
              <p>\${page.description}</p>
            \`;
            mockupItem.appendChild(pageInfo);
            
            // ボタン
            const mockupButtons = document.createElement('div');
            
            // モックアップの状態に応じてボタンを表示
            const mockupData = state.mockups.find(m => m.pageId === page.id);
            
            if (mockupData && mockupData.versions && mockupData.versions.length > 0) {
              // バージョン一覧を表示
              const versionsDiv = document.createElement('div');
              versionsDiv.className = 'mockup-versions';
              versionsDiv.innerHTML = '<h6>モックアップバージョン一覧</h6>';
              
              mockupData.versions.forEach((version, idx) => {
                const versionItem = document.createElement('div');
                versionItem.className = 'mockup-version-item';
                versionItem.style.marginBottom = '10px';
                versionItem.style.padding = '5px';
                versionItem.style.border = '1px solid #eee';
                versionItem.style.borderRadius = '3px';
                
                const date = new Date(version.timestamp);
                versionItem.innerHTML = \`
                  <p>バージョン \${idx + 1} (作成: \${date.toLocaleString()})</p>
                  <div class="mockup-version-buttons">
                    <button class="button show-preview" data-page-id="\${page.id}" data-mockup-index="\${version.id}">プレビュー表示</button>
                    <button class="button open-browser" data-page-id="\${page.id}" data-mockup-index="\${version.id}">ブラウザで開く</button>
                    <button class="button update-mockup" data-page-id="\${page.id}" data-mockup-index="\${version.id}">更新する</button>
                  </div>
                \`;
                
                versionsDiv.appendChild(versionItem);
              });
              
              mockupItem.appendChild(versionsDiv);
              
              // 再生成ボタンも表示
              mockupButtons.innerHTML = \`
                <button class="button regenerate-mockup" data-page-id="\${page.id}">新バージョン生成</button>
              \`;
            } else {
              mockupButtons.innerHTML = \`
                <button class="button generate-mockup" data-page-id="\${page.id}" data-framework="html">HTMLモックアップ生成</button>
                <button class="button generate-mockup" data-page-id="\${page.id}" data-framework="react">Reactモックアップ生成</button>
              \`;
            }
            
            mockupItem.appendChild(mockupButtons);
            mockupsList.appendChild(mockupItem);
          });
          
          mockupsSection.appendChild(mockupsList);
        }
        
        container.appendChild(mockupsSection);
        
        // イベントリスナーの登録
        document.getElementById('complete-mockups').addEventListener('click', () => {
          const hasMockups = state.mockups.some(m => m.versions && m.versions.length > 0);
          if (!hasMockups) {
            showError('少なくとも1つのモックアップを生成してください');
            return;
          }
          
          vscode.postMessage({
            command: 'completePhase',
            phase: 'mockups',
            data: { mockups: state.mockups }
          });
        });
        
        // モックアップ生成ボタン
        document.querySelectorAll('.generate-mockup').forEach(button => {
          button.addEventListener('click', () => {
            const pageId = button.dataset.pageId;
            const framework = button.dataset.framework;
            
            vscode.postMessage({
              command: 'generateMockup',
              pageId,
              framework
            });
          });
        });
        
        // プレビュー表示ボタン
        document.querySelectorAll('.show-preview').forEach(button => {
          button.addEventListener('click', () => {
            const pageId = button.dataset.pageId;
            const mockupIndex = button.dataset.mockupIndex || 0;
            
            vscode.postMessage({
              command: 'showMockupPreview',
              pageId,
              mockupIndex: parseInt(mockupIndex)
            });
          });
        });
        
        // ブラウザで開くボタン
        document.querySelectorAll('.open-browser').forEach(button => {
          button.addEventListener('click', () => {
            const pageId = button.dataset.pageId;
            const mockupIndex = button.dataset.mockupIndex || 0;
            
            vscode.postMessage({
              command: 'openMockupInBrowser',
              pageId,
              mockupIndex: parseInt(mockupIndex)
            });
          });
        });
        
        // 再生成ボタン
        document.querySelectorAll('.regenerate-mockup').forEach(button => {
          button.addEventListener('click', () => {
            const pageId = button.dataset.pageId;
            
            vscode.postMessage({
              command: 'generateMockup',
              pageId,
              framework: 'html' // デフォルトはHTML
            });
          });
        });
        
        // 更新ボタン
        document.querySelectorAll('.update-mockup').forEach(button => {
          button.addEventListener('click', () => {
            const pageId = button.dataset.pageId;
            const mockupIndex = button.dataset.mockupIndex || 0;
            
            vscode.postMessage({
              command: 'updateMockup',
              pageId,
              mockupIndex: parseInt(mockupIndex)
            });
          });
        });
      }
      
      // ディレクトリ構造フェーズのレンダリング
      function renderDirectoryStructurePhase(container) {
        const phaseInfo = state.phases.find(p => p.id === 'directoryStructure');
        
        const header = document.createElement('h3');
        header.textContent = phaseInfo ? phaseInfo.name : 'ディレクトリ構造の作成';
        container.appendChild(header);
        
        const description = document.createElement('p');
        description.textContent = phaseInfo ? phaseInfo.description : 'プロジェクトのディレクトリ構造を設計します';
        container.appendChild(description);
        
        // ボタン
        const buttonContainer = document.createElement('div');
        buttonContainer.innerHTML = \`
          <button id="generate-directory" class="button">ディレクトリ構造を生成</button>
          <button id="complete-directoryStructure" class="button">次のフェーズへ</button>
        \`;
        container.appendChild(buttonContainer);
        
        // ディレクトリ構造
        const directorySection = document.createElement('div');
        directorySection.innerHTML = '<h4>ディレクトリ構造</h4>';
        
        if (!state.directoryStructure) {
          directorySection.innerHTML += '<p>ディレクトリ構造が定義されていません</p>';
        } else {
          const pre = document.createElement('pre');
          pre.textContent = state.directoryStructure;
          directorySection.appendChild(pre);
        }
        
        container.appendChild(directorySection);
        
        // イベントリスナーの登録
        document.getElementById('generate-directory').addEventListener('click', () => {
          vscode.postMessage({
            command: 'generateDirectoryStructure'
          });
        });
        
        document.getElementById('complete-directoryStructure').addEventListener('click', () => {
          if (!state.directoryStructure) {
            showError('ディレクトリ構造を生成してください');
            return;
          }
          
          vscode.postMessage({
            command: 'completePhase',
            phase: 'directoryStructure',
            data: { directoryStructure: state.directoryStructure }
          });
        });
      }
      
      // 要件定義書フェーズのレンダリング
      function renderSpecificationPhase(container) {
        const phaseInfo = state.phases.find(p => p.id === 'specification');
        
        const header = document.createElement('h3');
        header.textContent = phaseInfo ? phaseInfo.name : '要件定義書のまとめ';
        container.appendChild(header);
        
        const description = document.createElement('p');
        description.textContent = phaseInfo ? phaseInfo.description : '実装に必要な詳細な仕様を文書化します';
        container.appendChild(description);
        
        // ボタン
        const buttonContainer = document.createElement('div');
        buttonContainer.innerHTML = \`
          <button id="generate-specification" class="button">要件定義書を生成</button>
          <button id="complete-specification" class="button">完了</button>
        \`;
        container.appendChild(buttonContainer);
        
        // 要件定義書
        const specificationSection = document.createElement('div');
        specificationSection.innerHTML = '<h4>要件定義書</h4>';
        
        if (!state.specification) {
          specificationSection.innerHTML += '<p>要件定義書が作成されていません</p>';
        } else {
          const pre = document.createElement('pre');
          pre.textContent = state.specification;
          specificationSection.appendChild(pre);
        }
        
        container.appendChild(specificationSection);
        
        // イベントリスナーの登録
        document.getElementById('generate-specification').addEventListener('click', () => {
          vscode.postMessage({
            command: 'generateSpecification'
          });
        });
        
        document.getElementById('complete-specification').addEventListener('click', () => {
          if (!state.specification) {
            showError('要件定義書を生成してください');
            return;
          }
          
          vscode.postMessage({
            command: 'completePhase',
            phase: 'specification',
            data: { specification: state.specification }
          });
        });
      }
      
      // チャットセクションのレンダリング
      function renderChatSection(container) {
        const chatSection = document.createElement('div');
        chatSection.innerHTML = \`
          <h3>AIアシスタント</h3>
          <div class="chat-container">
            <div class="chat-messages" id="chat-messages">
              <div class="message system">
                <p>AIアシスタントがデザインをサポートします。質問や要望を入力してください。</p>
              </div>
            </div>
            <div class="chat-input">
              <input type="text" id="chat-input" placeholder="メッセージを入力...">
              <button id="send-message" class="button">送信</button>
            </div>
          </div>
        \`;
        container.appendChild(chatSection);
        
        // イベントリスナーの登録
        document.getElementById('send-message').addEventListener('click', () => {
          const input = document.getElementById('chat-input');
          const text = input.value.trim();
          
          if (text) {
            // ユーザーメッセージを表示
            const messagesContainer = document.getElementById('chat-messages');
            const userMessage = document.createElement('div');
            userMessage.className = 'message user';
            userMessage.innerHTML = \`<p>\${text}</p>\`;
            messagesContainer.appendChild(userMessage);
            
            // 入力をクリア
            input.value = '';
            
            // メッセージを送信
            vscode.postMessage({
              command: 'sendChatMessage',
              text
            });
          }
        });
        
        // Enter キーでの送信
        document.getElementById('chat-input').addEventListener('keypress', event => {
          if (event.key === 'Enter') {
            document.getElementById('send-message').click();
          }
        });
      }
      
      // 初期化メッセージを送信
      vscode.postMessage({
        command: 'initializeWebview'
      });
    })();
  </script>
</body>
</html>`;
  }

  /**
   * リソースの解放
   */
  public dispose(): void {
    MockupDesignerPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}