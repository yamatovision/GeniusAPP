import * as vscode from 'vscode';
import { ClaudeCodeApiClient } from '../../api/claudeCodeApiClient';
import { ClaudeCodeIntegrationService } from '../../services/ClaudeCodeIntegrationService';
import { Logger } from '../../utils/logger';

/**
 * プロンプト選択のためのQuickPick UI
 */
/**
 * プロンプトQuickPickアイテム
 */
interface PromptQuickPickItem extends vscode.QuickPickItem {
  id: string;
  path?: string;
}

export class PromptSelector {
  private static instance: PromptSelector;
  
  private _quickPick: vscode.QuickPick<PromptQuickPickItem>;
  private _apiClient: ClaudeCodeApiClient;
  private _integrationService: ClaudeCodeIntegrationService;
  
  /**
   * コンストラクタ - プライベート（直接インスタンス生成禁止）
   */
  private constructor() {
    this._quickPick = vscode.window.createQuickPick<PromptQuickPickItem>();
    this._apiClient = ClaudeCodeApiClient.getInstance();
    this._integrationService = ClaudeCodeIntegrationService.getInstance();
    
    this._initializeQuickPick();
  }
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): PromptSelector {
    if (!PromptSelector.instance) {
      PromptSelector.instance = new PromptSelector();
    }
    return PromptSelector.instance;
  }
  
  /**
   * QuickPickの初期化
   */
  private _initializeQuickPick(): void {
    this._quickPick.placeholder = '使用するプロンプトを選択してください';
    this._quickPick.matchOnDescription = true;
    this._quickPick.matchOnDetail = true;
    
    // QuickPickの選択変更ハンドラー
    this._quickPick.onDidAccept(async () => {
      try {
        const selectedItem = this._quickPick.selectedItems[0];
        if (!selectedItem) {
          return;
        }
        
        this._quickPick.hide();
        
        // ワークスペースの選択
        await this._selectWorkspaceAndLaunch(selectedItem.id);
      } catch (error) {
        Logger.error('プロンプト選択処理中にエラーが発生しました', error as Error);
        vscode.window.showErrorMessage(`プロンプト選択中にエラーが発生しました: ${(error as Error).message}`);
      }
    });
    
    // QuickPickが非表示になったときのハンドラー
    this._quickPick.onDidHide(() => {
      this._quickPick.items = [];
    });
  }
  
  /**
   * プロンプト選択UIを表示
   */
  public async show(): Promise<void> {
    try {
      this._quickPick.busy = true;
      
      // プロンプト一覧を取得
      const prompts = await this._apiClient.getPrompts();
      
      if (!prompts || prompts.length === 0) {
        vscode.window.showInformationMessage('利用可能なプロンプトがありません。プロンプトライブラリに追加してください。');
        return;
      }
      
      // QuickPickアイテムに変換
      const promptItems: PromptQuickPickItem[] = prompts.map(prompt => ({
        label: prompt.title,
        description: prompt.category || '',
        detail: prompt.tags ? prompt.tags.join(', ') : '',
        id: prompt.id
      }));
      
      this._quickPick.items = promptItems;
      this._quickPick.busy = false;
      this._quickPick.show();
    } catch (error) {
      Logger.error('プロンプト選択UI表示中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`プロンプト選択UI表示中にエラーが発生しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * ワークスペースの選択とClaudeCodeの起動
   */
  private async _selectWorkspaceAndLaunch(promptId: string): Promise<void> {
    try {
      // プロジェクトルートを取得
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let projectPath: string;
      
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('プロジェクトフォルダが開かれていません。');
        return;
      } else if (workspaceFolders.length === 1) {
        projectPath = workspaceFolders[0].uri.fsPath;
      } else {
        // 複数のワークスペースがある場合は選択させる
        const folderItems = workspaceFolders.map(folder => ({
          label: folder.name,
          description: folder.uri.fsPath,
          path: folder.uri.fsPath
        }));
        
        const selectedFolder = await vscode.window.showQuickPick(folderItems, {
          placeHolder: 'プロジェクトフォルダを選択してください'
        });
        
        if (!selectedFolder) {
          return;
        }
        
        projectPath = selectedFolder.path;
      }
      
      // ClaudeCodeを起動
      await this._integrationService.launchWithPrompt(promptId, projectPath);
    } catch (error) {
      Logger.error('ClaudeCode起動中にエラーが発生しました', error as Error);
      vscode.window.showErrorMessage(`ClaudeCode起動中にエラーが発生しました: ${(error as Error).message}`);
    }
  }
  
  /**
   * リソース解放
   */
  public dispose(): void {
    this._quickPick.dispose();
  }
}