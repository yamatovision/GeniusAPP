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

## 実装ステップ

1. scopeManager.jsの変更を実装・テスト
2. noProjectView.htmlの動作確認
3. 統合テスト（プロジェクト作成・読み込みの両方のフローを確認）
4. コードのリファクタリングと最終確認