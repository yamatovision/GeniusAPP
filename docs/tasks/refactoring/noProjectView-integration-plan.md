# noProjectView.html プロジェクト操作ボタン機能統合計画

## 概要

現在、`noProjectView.html`には「新規プロジェクト作成」と「既存プロジェクトを読み込む」の2つのボタンがあり、単純なメッセージを親のscopeManager.jsへ送信するだけの実装になっています。一方、サイドバーのプロジェクトナビゲーション機能には同様のボタンがあり、こちらでは完全な機能が実装されています。この2つの機能を統合し、コードの重複を避けつつ、一貫した動作を実現します。

## 現状分析

### noProjectView.htmlの現在の実装

```javascript
// プロジェクト作成ボタンのイベントハンドラー
document.getElementById('create-new-project').addEventListener('click', () => {
  // 親のscopeManager.jsとやり取りするためのメッセージ
  window.parent.postMessage({ command: 'createNewProject' }, '*');
});

// プロジェクト読み込みボタンのイベントハンドラー
document.getElementById('load-existing-project').addEventListener('click', () => {
  // 親のscopeManager.jsとやり取りするためのメッセージ
  window.parent.postMessage({ command: 'loadExistingProject' }, '*');
});
```

### projectNavigation.jsの機能（抜粋）

#### 新規プロジェクトモーダル表示関数
```javascript
/**
 * 新規プロジェクトモーダルを表示
 */
showNewProjectModal() {
  console.log('projectNavigation: 新規プロジェクトモーダル表示処理を開始します');
  
  try {
    // 既存のモーダルを削除
    document.querySelectorAll('#new-project-modal').forEach(m => {
      console.log('モーダル要素を削除します:', m.id);
      m.remove();
    });
    
    // モーダルを新規作成
    console.log('モーダルを新規作成します');
    const modal = document.createElement('div');
    modal.id = 'new-project-modal';
    
    // スタイルを詳細に設定
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '10000'
    });
    
    // シンプルなモーダル内容
    modal.innerHTML = `
      <div style="background-color: white; border-radius: 10px; width: 400px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);">
        <div style="padding: 20px; border-bottom: 1px solid #ddd;">
          <h2 style="margin: 0; font-size: 18px;">新規プロジェクト作成</h2>
        </div>
        <div style="padding: 20px;">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">プロジェクト名 <span style="color: red;">*</span></label>
            <input type="text" id="project-name" required placeholder="例: MyWebApp" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
        </div>
        <div style="padding: 15px 20px; border-top: 1px solid #ddd; text-align: right;">
          <button type="button" id="cancel-new-project" style="padding: 6px 12px; margin-right: 10px; background: #f1f1f1; border: none; border-radius: 4px; cursor: pointer;">キャンセル</button>
          <button type="button" id="create-project-btn" style="padding: 6px 12px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer;">作成</button>
        </div>
      </div>
    `;
    
    // ボディにモーダルを追加
    document.body.appendChild(modal);
    
    // イベントリスナーを設定
    const cancelBtn = document.getElementById('cancel-new-project');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hideNewProjectModal());
    }
    
    const createBtn = document.getElementById('create-project-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.createNewProject());
    }
    
    // 名前フィールドにフォーカス
    const projectNameInput = document.getElementById('project-name');
    if (projectNameInput) {
      projectNameInput.focus();
    }
    
  } catch (e) {
    console.error('モーダル表示処理中にエラーが発生しました', e);
  }
}
```

#### モーダルを閉じる関数
```javascript
/**
 * 新規プロジェクトモーダルを非表示
 */
hideNewProjectModal() {
  console.log('projectNavigation: モーダルを非表示にします');
  const modal = document.getElementById('new-project-modal');
  if (modal) {
    modal.remove();
  }
}
```

#### 新規プロジェクト作成実行関数
```javascript
/**
 * 新規プロジェクト作成処理
 */
createNewProject() {
  console.log('projectNavigation: 新規プロジェクト作成処理を開始します');
  const nameEl = document.getElementById('project-name');
  
  if (!nameEl) {
    console.error('プロジェクト名入力フィールド(#project-name)が見つかりません');
    return;
  }
  
  const name = nameEl.value.trim();
  console.log('入力されたプロジェクト名:', name);
  
  if (!name) {
    console.warn('プロジェクト名が空です');
    const event = new CustomEvent('show-error', {
      detail: { message: 'プロジェクト名を入力してください' }
    });
    document.dispatchEvent(event);
    return;
  }
  
  console.log('VSCodeにメッセージを送信します: createProject');
  this.vscode.postMessage({
    command: 'createProject',
    name,
    description: ""
  });
  
  this.hideNewProjectModal();
}
```

#### 既存プロジェクト読み込み関数
```javascript
/**
 * 既存プロジェクト読み込み
 */
loadExistingProject() {
  stateManager.sendMessage('loadExistingProject');
}
```

## 実装計画

### 1. noProjectView.htmlの修正

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>プロジェクト選択</title>
  <!-- ... 既存のスタイル定義は維持 ... -->
</head>
<body>
  <div class="no-project-container">
    <span class="material-icons no-project-icon">folder_open</span>
    <h2 class="no-project-title">プロジェクトが選択されていません</h2>
    <p class="no-project-text">
      AppGenius AIのスコープマネージャーを使うには、プロジェクトを選択するか新しいプロジェクトを作成してください。
      プロジェクトを選択すると、開発状況の管理や各種AIプロンプトを利用できるようになります。
    </p>
    <div class="project-actions">
      <button class="project-button primary-button" id="create-new-project">
        <span class="material-icons project-button-icon">add</span>
        新規プロジェクト作成
      </button>
      <button class="project-button secondary-button" id="load-existing-project">
        <span class="material-icons project-button-icon">folder</span>
        既存プロジェクトを読み込む
      </button>
    </div>
  </div>

  <script>
    // プロジェクト作成ボタンのイベントハンドラー
    document.getElementById('create-new-project').addEventListener('click', () => {
      // 親のscopeManager.jsとやり取りするためのメッセージ
      window.parent.postMessage({ command: 'createNewProject' }, '*');
    });

    // プロジェクト読み込みボタンのイベントハンドラー
    document.getElementById('load-existing-project').addEventListener('click', () => {
      // 親のscopeManager.jsとやり取りするためのメッセージ
      window.parent.postMessage({ command: 'loadExistingProject' }, '*');
    });
  </script>
</body>
</html>
```

### 2. scopeManager.jsの修正

scopeManager.jsのメッセージハンドラー部分（267行目付近のswitch文）に以下の処理を追加します：

```javascript
case 'createNewProject':
  // projectNavigationの機能を呼び出す
  if (projectNavigation) {
    projectNavigation.showNewProjectModal();
  }
  break;
case 'loadExistingProject':
  // projectNavigationの機能を呼び出す
  if (projectNavigation) {
    projectNavigation.loadExistingProject();
  }
  break;
```

## 実装メリット

1. **コード共有による一貫性の確保**
   - プロジェクト操作ロジックが一箇所にまとめられ、メンテナンスが容易になる
   - プロジェクトナビゲーション機能の変更が自動的にnoProjectViewにも反映される

2. **ユーザー体験の向上**
   - サイドバーとプロジェクトなし画面で同じUIと操作感を実現
   - 機能の重複がなくなり、システム全体の一貫性が向上

3. **開発効率の向上**
   - 同じ機能を複数実装する必要がなくなる
   - 将来的な機能拡張が容易になる

## 今後の発展性

このアプローチでは、今後もプロジェクト管理ロジックをprojectNavigation.jsに集中させることで、システム全体の保守性を高めることができます。また、必要に応じてprojectNavigation.jsをさらにモジュール化し、機能を分離することも検討できます。

## 拡張実装計画: 専用Webviewパネルとしての独立実装

現在の統合計画に加えて、将来的にはnoProjectViewを完全に独立したWebViewパネルとして実装することも検討します。この拡張実装により、アプリケーション全体の初期化処理を最適化し、エラー処理を改善することができます。

### NoProjectViewPanelクラスの設計と実装

```typescript
// src/ui/noProjectView/NoProjectViewPanel.ts
import * as vscode from 'vscode';
import { getNonce } from '../../utils/getNonce';

/**
 * プロジェクト未選択時専用のWebViewパネル
 */
export class NoProjectViewPanel {
  public static currentPanel: NoProjectViewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  /**
   * 新しいインスタンスを作成し、パネルを表示
   */
  public static createOrShow(extensionUri: vscode.Uri): NoProjectViewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // すでにパネルが存在する場合は再利用
    if (NoProjectViewPanel.currentPanel) {
      NoProjectViewPanel.currentPanel._panel.reveal(column);
      return NoProjectViewPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      'noProjectView',
      'プロジェクト選択',
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

    NoProjectViewPanel.currentPanel = new NoProjectViewPanel(panel, extensionUri);
    return NoProjectViewPanel.currentPanel;
  }

  /**
   * コンストラクタ
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // コンテンツの設定
    this._update();

    // パネルが破棄された時のイベント
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // メッセージハンドラーを設定
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'createNewProject':
            vscode.commands.executeCommand('appgenius.createNewProject');
            break;
          case 'loadExistingProject':
            vscode.commands.executeCommand('appgenius.loadExistingProject');
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Webviewコンテンツを更新
   */
  private _update() {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  /**
   * リソースを破棄
   */
  public dispose() {
    NoProjectViewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Webview用のHTMLを生成
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'noProjectView.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
      <link href="${styleResetUri}" rel="stylesheet" />
      <link href="${styleVSCodeUri}" rel="stylesheet" />
      <link href="${styleMainUri}" rel="stylesheet" />
      <title>プロジェクト選択</title>
    </head>
    <body>
      <div class="no-project-container">
        <span class="material-icons no-project-icon">folder_open</span>
        <h2 class="no-project-title">プロジェクトが選択されていません</h2>
        <p class="no-project-text">
          AppGenius AIのスコープマネージャーを使うには、プロジェクトを選択するか新しいプロジェクトを作成してください。
          プロジェクトを選択すると、開発状況の管理や各種AIプロンプトを利用できるようになります。
        </p>
        <div class="project-actions">
          <button class="project-button primary-button" id="create-new-project">
            <span class="material-icons project-button-icon">add</span>
            新規プロジェクト作成
          </button>
          <button class="project-button secondary-button" id="load-existing-project">
            <span class="material-icons project-button-icon">folder</span>
            既存プロジェクトを読み込む
          </button>
        </div>
      </div>

      <script nonce="${nonce}">
        // VSCodeのWebView APIを取得
        const vscode = acquireVsCodeApi();

        // プロジェクト作成ボタンのイベントハンドラー
        document.getElementById('create-new-project').addEventListener('click', () => {
          vscode.postMessage({ command: 'createNewProject' });
        });

        // プロジェクト読み込みボタンのイベントハンドラー
        document.getElementById('load-existing-project').addEventListener('click', () => {
          vscode.postMessage({ command: 'loadExistingProject' });
        });
      </script>
    </body>
    </html>`;
  }
}
```

### プロジェクト存在チェックと状態遷移の実装

```typescript
// src/services/scopeManager/ProjectStateService.ts
import * as vscode from 'vscode';
import { NoProjectViewPanel } from '../../ui/noProjectView/NoProjectViewPanel';
import { ScopeManagerPanel } from '../../ui/scopeManager/ScopeManagerPanel';

/**
 * プロジェクト状態管理サービス
 */
export class ProjectStateService {
  private static _instance: ProjectStateService;
  private _context: vscode.ExtensionContext;
  private _hasActiveProject: boolean = false;

  private constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(context?: vscode.ExtensionContext): ProjectStateService {
    if (!ProjectStateService._instance) {
      if (!context) {
        throw new Error('ProjectStateService初期化時にはExtensionContextが必要です');
      }
      ProjectStateService._instance = new ProjectStateService(context);
    }
    return ProjectStateService._instance;
  }

  /**
   * 現在アクティブなプロジェクトがあるかチェック
   */
  public async checkActiveProject(): Promise<boolean> {
    // ProjectServiceから現在のプロジェクト情報を取得する処理を実装
    // ...

    // この例では簡易的に保存された設定から確認
    const projectPath = vscode.workspace.getConfiguration('appgenius').get<string>('currentProjectPath');
    this._hasActiveProject = !!projectPath && projectPath.length > 0;

    return this._hasActiveProject;
  }

  /**
   * 適切なビューを表示
   */
  public async showAppropriateView(): Promise<void> {
    const hasProject = await this.checkActiveProject();

    if (hasProject) {
      // プロジェクトが存在する場合はScopeManagerを表示
      ScopeManagerPanel.createOrShow(this._context.extensionUri);

      // もしNoProjectViewが開いていればそれを閉じる
      if (NoProjectViewPanel.currentPanel) {
        NoProjectViewPanel.currentPanel.dispose();
      }
    } else {
      // プロジェクトが存在しない場合はNoProjectViewを表示
      NoProjectViewPanel.createOrShow(this._context.extensionUri);

      // もしScopeManagerが開いていればそれを閉じる
      if (ScopeManagerPanel.currentPanel) {
        ScopeManagerPanel.currentPanel.dispose();
      }
    }
  }

  /**
   * プロジェクト作成後の処理
   */
  public async onProjectCreated(projectPath: string): Promise<void> {
    this._hasActiveProject = true;

    // NoProjectViewを閉じる
    if (NoProjectViewPanel.currentPanel) {
      NoProjectViewPanel.currentPanel.dispose();
    }

    // ScopeManagerを表示
    ScopeManagerPanel.createOrShow(this._context.extensionUri);
  }

  /**
   * プロジェクト読み込み後の処理
   */
  public async onProjectLoaded(projectPath: string): Promise<void> {
    this._hasActiveProject = true;

    // NoProjectViewを閉じる
    if (NoProjectViewPanel.currentPanel) {
      NoProjectViewPanel.currentPanel.dispose();
    }

    // ScopeManagerを表示
    ScopeManagerPanel.createOrShow(this._context.extensionUri);
  }

  /**
   * プロジェクト閉じた後の処理
   */
  public async onProjectClosed(): Promise<void> {
    this._hasActiveProject = false;

    // ScopeManagerを閉じる
    if (ScopeManagerPanel.currentPanel) {
      ScopeManagerPanel.currentPanel.dispose();
    }

    // NoProjectViewを表示
    NoProjectViewPanel.createOrShow(this._context.extensionUri);
  }
}
```

### 拡張機能の起動時にProjectStateServiceを初期化

```typescript
// src/extension.ts (該当部分)

export function activate(context: vscode.ExtensionContext) {
  // 最初の実行時にログを出力
  console.log('AppGenius拡張機能が有効化されました');

  // プロジェクト状態管理サービスを初期化
  const projectStateService = ProjectStateService.getInstance(context);

  // 適切なビューを表示
  projectStateService.showAppropriateView().catch(err => {
    console.error('適切なビュー表示に失敗しました:', err);
    vscode.window.showErrorMessage('AppGenius: ビューの初期化に失敗しました');
  });

  // コマンドの登録
  context.subscriptions.push(
    vscode.commands.registerCommand('appgenius.createNewProject', async () => {
      // 新規プロジェクト作成コマンドの実装
      // ...

      // 作成後の状態遷移
      await projectStateService.onProjectCreated(projectPath);
    }),

    vscode.commands.registerCommand('appgenius.loadExistingProject', async () => {
      // 既存プロジェクト読み込みコマンドの実装
      // ...

      // 読み込み後の状態遷移
      await projectStateService.onProjectLoaded(projectPath);
    }),

    vscode.commands.registerCommand('appgenius.closeProject', async () => {
      // プロジェクトを閉じるコマンドの実装
      // ...

      // 閉じた後の状態遷移
      await projectStateService.onProjectClosed();
    })
  );

  // その他の初期化処理...
}
```

## 拡張実装のメリット

1. **クリーンアーキテクチャ**
   - 各コンポーネントが明確な責任を持ち、疎結合で柔軟性が高い設計
   - プロジェクト状態に応じた適切なビュー表示を自動化

2. **エラー防止**
   - プロジェクトが存在しない場合の条件分岐をサービスレベルで一元管理
   - プロジェクト依存コンポーネントが不適切なタイミングで初期化されることを防止

3. **ユーザー体験の向上**
   - プロジェクトの状態に応じて適切なUIを自動的に表示
   - エラーメッセージの代わりにユーザーフレンドリーなガイダンスを提供

4. **パフォーマンス最適化**
   - プロジェクトが存在しない場合、不要なサービスの初期化を回避
   - リソース使用の効率化

## 実装ステップ

### 現行の統合計画（短期）
1. scopeManager.jsの変更を実装・テスト
2. noProjectView.htmlの動作確認
3. 統合テスト（プロジェクト作成・読み込みの両方のフローを確認）
4. コードのリファクタリングと最終確認

### 拡張実装計画（中長期）
1. NoProjectViewPanel.tsクラスの実装
2. ProjectStateService.tsの実装
3. 拡張機能起動時のプロジェクト状態チェックフローの改善
4. プロジェクト状態変更時の遷移処理の実装
5. 統合テストと動作確認
6. ドキュメント更新と開発チームへの引き継ぎ