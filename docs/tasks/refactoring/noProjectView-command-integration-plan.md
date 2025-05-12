# NoProjectViewPanelからのコマンド呼び出し統合計画

## 概要

現状、`NoProjectViewPanel`からの「新規プロジェクト作成」および「既存プロジェクト読み込み」のコマンド実行時に「command 'appgenius-ai.createNewProject' not found」というエラーが発生しています。これは、プロジェクトナビゲーションサイドバーで使用されているコマンド名およびメッセージハンドリング方式と統一されていないことが原因です。この計画では、NoProjectViewPanelからのプロジェクト操作を完全にScopeManagerPanelと統合し、同一のフローでプロジェクト作成・読み込みが行われるようにします。

## 現状分析

### 問題点

1. **コマンド名の不一致**: NoProjectViewPanelは`appgenius-ai.createNewProject`というVSCodeコマンドを呼び出していますが、このコマンドは登録されていません。

2. **処理フローの混在**: NoProjectViewPanelのプロジェクト操作がVSCodeコマンド経由で行われている一方、ScopeManagerPanel（プロジェクトナビゲーション）はメッセージハンドラー経由で実装されています。

3. **ServiceとMessageHandlerの未連携**: NoProjectViewPanelがProjectStateServiceを直接使用する一方、ScopeManagerPanelはProjectServiceImplとProjectMessageHandlerを使用している点で不一致があります。

### 現在のフロー比較

#### NoProjectViewPanelの処理フロー（現状）:
1. ボタンクリック → vscode.postMessage({ command: 'createNewProject' })
2. extension.tsで登録されていないコマンド'appgenius-ai.createNewProject'を実行しようとする
3. コマンドが見つからずエラーが発生

#### ScopeManagerPanelの処理フロー（正常）:
1. ボタンクリック → window.parent.postMessage({ command: 'createProject', name, description })
2. ProjectMessageHandlerが'createProject'メッセージを処理
3. ProjectServiceImpl.createProject()が呼び出される
4. プロジェクト作成後、ProjectStateService.onProjectCreated()が呼ばれる

## 解決策

NoProjectViewPanelの実装をScopeManagerPanelのプロジェクト操作フローと完全に統合します。具体的には、NoProjectViewPanelからの操作がProjectServiceImplとProjectStateServiceを経由して同一のフローでプロジェクト作成・読み込みを行うようにします。

### 実装詳細

#### 1. ProjectStateServiceへのアクセス方法の確立

```typescript
// NoProjectViewPanel.tsに追加
import { ProjectServiceImpl } from '../scopeManager/services/implementations/ProjectServiceImpl';
import { ProjectStateService } from '../../services/projectState/ProjectStateService';
import { FileSystemServiceImpl } from '../scopeManager/services/implementations/FileSystemServiceImpl';

// クラス内のプロパティとして追加
private _projectService: ProjectServiceImpl;
private _projectStateService: ProjectStateService;

// コンストラクタで初期化
private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
  // 既存の初期化コード...
  
  // プロジェクトサービス初期化
  const fileSystemService = new FileSystemServiceImpl();
  this._projectService = ProjectServiceImpl.getInstance(fileSystemService);
  this._projectStateService = ProjectStateService.getInstance();
  
  // メッセージハンドラー等設定
  this._setupMessageHandler();
}
```

#### 2. メッセージハンドラーの実装

```typescript
/**
 * メッセージハンドラーをセットアップ
 */
private _setupMessageHandler(): void {
  this._panel.webview.onDidReceiveMessage(
    async (message) => {
      try {
        switch (message.command) {
          case 'createNewProject':
            Logger.info('NoProjectViewPanel: 新規プロジェクト作成モーダル表示リクエスト');
            await this._handleShowCreateProjectModal();
            break;

          case 'loadExistingProject':
            Logger.info('NoProjectViewPanel: 既存プロジェクト読み込みリクエスト');
            await this._handleLoadExistingProject();
            break;
            
          case 'createProject':
            // プロジェクト名とオプションの説明を受け取り
            Logger.info(`NoProjectViewPanel: プロジェクト作成リクエスト: ${message.name}`);
            if (message.name) {
              await this._handleCreateProject(message.name, message.description || '');
            } else {
              Logger.warn('NoProjectViewPanel: プロジェクト名が指定されていません');
              vscode.window.showErrorMessage('プロジェクト名を入力してください');
            }
            break;
        }
      } catch (error) {
        Logger.error(`NoProjectViewPanel: メッセージ処理中にエラーが発生: ${message.command}`, error as Error);
        vscode.window.showErrorMessage(`操作に失敗しました: ${(error as Error).message}`);
      }
    },
    null,
    this._disposables
  );
}
```

#### 3. 新規プロジェクト作成モーダル表示処理

```typescript
/**
 * 新規プロジェクト作成モーダル表示
 */
private async _handleShowCreateProjectModal(): Promise<void> {
  try {
    Logger.info('NoProjectViewPanel: 新規プロジェクトモーダル表示処理');
    
    // モーダルHTML生成
    const modalHtml = this._generateNewProjectModalHtml();
    
    // モーダル表示のメッセージ送信
    this._panel.webview.postMessage({
      command: 'showModal',
      html: modalHtml
    });
  } catch (error) {
    Logger.error('NoProjectViewPanel: モーダル表示中にエラーが発生しました', error as Error);
    vscode.window.showErrorMessage(`モーダル表示に失敗しました: ${(error as Error).message}`);
  }
}

/**
 * 新規プロジェクトモーダルのHTML生成
 */
private _generateNewProjectModalHtml(): string {
  return `
    <div id="new-project-modal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>新規プロジェクト作成</h2>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="project-name">プロジェクト名 <span class="required">*</span></label>
            <input type="text" id="project-name" required placeholder="例: MyWebApp">
          </div>
          <div class="form-group">
            <label for="project-description">プロジェクト説明</label>
            <textarea id="project-description" placeholder="プロジェクトの概要を入力してください"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" id="cancel-new-project" class="secondary-button">キャンセル</button>
          <button type="button" id="create-project-btn" class="primary-button">作成</button>
        </div>
      </div>
    </div>
  `;
}
```

#### 4. プロジェクト作成処理

```typescript
/**
 * 新規プロジェクト作成処理
 * @param projectName プロジェクト名
 * @param description プロジェクトの説明
 */
private async _handleCreateProject(projectName: string, description: string): Promise<void> {
  try {
    Logger.info(`NoProjectViewPanel: 新規プロジェクト作成処理開始: ${projectName}`);
    
    if (!projectName || projectName.trim() === '') {
      Logger.warn('NoProjectViewPanel: プロジェクト名が空です');
      vscode.window.showErrorMessage('プロジェクト名を入力してください');
      return;
    }

    // ProjectServiceImplを使用してプロジェクト作成
    // これによりScopeManagerPanelと同じ処理フローになる
    const projectId = await this._projectService.createProject(projectName, description);
    
    // 作成したプロジェクトパスを取得
    const activeProject = this._projectService.getActiveProject();
    if (!activeProject || !activeProject.path) {
      throw new Error('プロジェクト作成後にプロジェクト情報が取得できませんでした');
    }
    
    // ProjectStateServiceを通じてプロジェクト作成後処理を実行
    await this._projectStateService.onProjectCreated(activeProject.path);
    
    Logger.info(`NoProjectViewPanel: 新規プロジェクト "${projectName}" が作成されました: ${activeProject.path}`);
  } catch (error) {
    Logger.error('NoProjectViewPanel: プロジェクト作成中にエラーが発生しました', error as Error);
    vscode.window.showErrorMessage(`プロジェクト作成に失敗しました: ${(error as Error).message}`);
  }
}
```

#### 5. 既存プロジェクト読み込み処理

```typescript
/**
 * 既存プロジェクト読み込み処理
 */
private async _handleLoadExistingProject(): Promise<void> {
  try {
    Logger.info('NoProjectViewPanel: 既存プロジェクト読み込み処理開始');
    
    // ProjectServiceImplを使用して既存プロジェクトをロード
    // これによりScopeManagerPanelと同じ処理フローになる
    const projectInfo = await this._projectService.loadExistingProject();
    
    // プロジェクトロード後の処理をProjectStateServiceに委譲
    if (projectInfo && projectInfo.path) {
      await this._projectStateService.onProjectLoaded(projectInfo.path);
      Logger.info(`NoProjectViewPanel: プロジェクト "${projectInfo.name}" を読み込みました: ${projectInfo.path}`);
    } else {
      Logger.warn('NoProjectViewPanel: プロジェクト情報が取得できませんでした');
    }
  } catch (error) {
    Logger.error('NoProjectViewPanel: プロジェクト読み込み中にエラーが発生しました', error as Error);
    vscode.window.showErrorMessage(`プロジェクト読み込みに失敗しました: ${(error as Error).message}`);
  }
}
```

#### 6. WebView側のJavaScriptコード更新

```typescript
// _getHtmlForWebview内のJavaScript部分を更新
const script = `
  // VSCodeのWebView APIを取得
  const vscode = acquireVsCodeApi();

  // 初期化
  document.addEventListener('DOMContentLoaded', () => {
    console.log('NoProjectView: 初期化完了');
  });

  // プロジェクト作成ボタンのイベントハンドラー
  document.getElementById('create-new-project').addEventListener('click', () => {
    console.log('新規プロジェクト作成ボタンがクリックされました');
    vscode.postMessage({ command: 'createNewProject' });
  });

  // プロジェクト読み込みボタンのイベントハンドラー
  document.getElementById('load-existing-project').addEventListener('click', () => {
    console.log('既存プロジェクト読み込みボタンがクリックされました');
    vscode.postMessage({ command: 'loadExistingProject' });
  });

  // モーダル関連のイベントハンドラー
  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
      case 'showModal':
        // モーダルをDOMに追加
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = message.html;
        document.body.appendChild(modalContainer);
        
        // イベントリスナーを設定
        document.getElementById('cancel-new-project').addEventListener('click', () => {
          hideModal();
        });
        
        document.getElementById('create-project-btn').addEventListener('click', () => {
          const projectName = document.getElementById('project-name').value.trim();
          const projectDescription = document.getElementById('project-description')?.value?.trim() || '';
          
          if (projectName) {
            vscode.postMessage({ 
              command: 'createProject', 
              name: projectName,
              description: projectDescription
            });
            hideModal();
          } else {
            // エラーメッセージ表示
            alert('プロジェクト名を入力してください');
          }
        });
        
        // フォーカス設定
        document.getElementById('project-name').focus();
        break;
    }
  });

  // モーダルを閉じる関数
  function hideModal() {
    const modal = document.getElementById('new-project-modal');
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  }
`;
```

## 実装ステップ

1. **NoProjectViewPanel.tsの更新**:
   - ProjectServiceImplとProjectStateServiceのインポートと初期化
   - メッセージハンドラーの実装
   - プロジェクト作成・読み込み処理の実装
   - モーダル表示機能の実装

2. **CSS更新**:
   - モーダル用のCSSスタイルをnoProjectView.cssに追加
   - デザインシステムとの統一性を確保

3. **動作検証**:
   - 新規プロジェクト作成フローのテスト
   - 既存プロジェクト読み込みフローのテスト
   - エラーハンドリングのテスト

## 期待される効果

1. **統一されたフロー**: NoProjectViewPanelとScopeManagerPanelで完全に同一のプロジェクト操作フローを実現
2. **エラーの解消**: 未登録コマンドによるエラーが発生しなくなる
3. **コードの一貫性**: プロジェクト操作に関するコードの管理が容易になる
4. **プロジェクト遷移の整合性**: プロジェクト作成・読み込み後の状態遷移が確実に行われる

## 技術的留意点

1. **依存性の管理**: ProjectServiceImplとProjectStateServiceの初期化順序に注意
2. **同一インスタンスの使用**: シングルトンパターンで実装されているサービスの適切な取得
3. **エラーハンドリング**: 細かい粒度でのエラーハンドリングとユーザーへのフィードバック
4. **UIの一貫性**: モーダルデザインをScopeManagerPanelと統一