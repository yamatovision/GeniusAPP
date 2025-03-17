# AppGenius UI デザインリファクタリング計画

## 概要

AppGeniusの各UIコンポーネントを一貫したデザインシステムに基づいて統一し、ライトモードを基本としたデザインに再構築する計画書です。現在はコンポーネントごとにカラースキームが異なり、テーマ対応も不統一な状態を解消します。

## 現状の問題点

1. **色彩スキームの不一致**
   - ダッシュボード: `--primary-color: #6c5ce7`
   - 環境変数アシスタント: `--primary: #4a6da7`
   - デバッグ探偵: `--detective-primary: #4a6fa5`
   - スコープマネージャー: 独自カラー変数とVSCode変数の混在
   - 各コンポーネントで個別のカラー定義

2. **テーマ対応の不統一**
   - ダッシュボード: ライトモード固定
   - 環境変数アシスタント: ダークモード対応
   - デバッグ探偵: ダークモード対応
   - スコープマネージャー: VSCodeのテーマに依存

3. **CSS変数命名の不一致**
   - 接頭辞や命名パターンが統一されていない
   - 同じ役割の変数が異なる名前で定義されている

## 実装済み対応

1. **スコープマネージャーのリファクタリング**
   - 共通デザインシステムの導入（design-system.cssのインポート）
   - ライトモードへの統一（背景色と文字色の固定）
   - `--app-primary`等の統一変数名への置き換え
   - アクセシビリティ対応の追加

2. **ダッシュボードの拡張**
   - 「更新」ボタンを「テーマ切替」ボタンに変更
   - テーマ切替機能の実装（将来的な拡張のため）
   - テーマ設定のローカルストレージへの保存

# スコープマネージャー UIUX 強化計画

## スコープマネージャーの現状分析

スコープマネージャーは、CURRENT_STATUS.mdファイルと緊密に連携して実装スコープの状態を管理するコンポーネントです。現在の実装において以下の特性があります：

### 長所
- マークダウンファイルとの連携により、シンプルなテキストベースのデータ管理
- 3種類のスコープステータス（完了済み、進行中、未着手）の管理
- 進捗の可視化
- ファイルリストの管理

### 短所
- 基本的な2カラムレイアウトにとどまっており、視覚的魅力に欠ける
- インタラクション要素が限定的
- 関連ツールとの連携が不足
- スコープカードのデザインが平面的
- フィルタリングや検索機能の欠如

## モックアップ分析で示された理想形

モックアップ（dashboard-hub-spoke.html、dashboard-redesign-mockup.html）では、よりモダンでユーザーフレンドリーなデザインが提案されています：

- ハブ&スポークスタイルのグリッドレイアウト
- スコープマネージャーを中心とした関連ツールへのアクセス
- 視覚的に強化されたスコープカード
- 明確なカラーコーディングとアイコン使用
- レスポンシブな設計

## スコープマネージャー強化計画

### 1. UIレイアウトの刷新

#### HTML構造の更新
```html
<div class="scope-manager-container">
  <!-- メインコンテンツをグリッドレイアウトに変更 -->
  <div class="scope-grid-layout">
    <!-- 左側：拡張したスコープリスト -->
    <div class="scope-list-container">
      <div class="section-header">
        <h2>実装スコープ</h2>
        <button class="action-button create-scope-button">
          <i class="material-icons">add</i>スコープ作成
        </button>
      </div>
      
      <div id="scope-list" class="enhanced-scope-list">
        <!-- 強化されたスコープカードがここに生成 -->
      </div>
      
      <div class="scope-tools">
        <button id="directory-structure-button" class="tool-button">
          <i class="material-icons">folder</i>ディレクトリ構造
        </button>
      </div>
    </div>
    
    <!-- 右側：スコープ詳細と関連ツール -->
    <div class="scope-detail-container">
      <div id="scope-detail-content">
        <!-- スコープ詳細の強化表示 -->
        <div class="scope-header">
          <h2 id="scope-title"></h2>
          <div class="scope-metadata">
            <div class="metadata-item">
              <span class="metadata-label">進捗</span>
              <span id="scope-progress" class="metadata-value"></span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">ステータス</span>
              <span id="scope-status" class="metadata-value"></span>
            </div>
          </div>
        </div>
        
        <!-- ファイルリスト -->
        <div class="files-section">
          <h3>実装ファイル</h3>
          <div id="implementation-files" class="enhanced-file-list">
            <!-- 強化されたファイルリストが生成される -->
          </div>
        </div>
        
        <!-- 引継ぎ情報 -->
        <div id="inheritance-info" class="inheritance-section"></div>
        
        <!-- 関連ツール -->
        <div class="related-tools-section">
          <h3>関連ツール</h3>
          <div class="tools-grid">
            <div class="tool-card env-vars">
              <div class="tool-icon">🔑</div>
              <div class="tool-name">環境変数アシスタント</div>
              <button id="env-vars-button" class="tool-button">開く</button>
            </div>
            <!-- 他のツールカード -->
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

#### CSSの強化
```css
/* グリッドレイアウト導入 */
.scope-grid-layout {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: var(--app-spacing-lg);
}

/* スコープカードの視覚的強化 */
.scope-tree-item {
  padding: 16px;
  border-radius: var(--app-border-radius);
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: var(--app-spacing-sm);
  background-color: var(--app-card-background);
  border: 1px solid var(--app-border-color);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  transition: all var(--app-transition);
}

.scope-tree-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--app-primary);
}

/* ツールカードのグリッド */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--app-spacing-md);
  margin-top: var(--app-spacing-md);
}

.tool-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--app-spacing-md);
  background-color: var(--app-card-background);
  border: 1px solid var(--app-border-color);
  border-radius: var(--app-border-radius);
  transition: all var(--app-transition);
}

.tool-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--app-box-shadow);
}

/* レスポンシブ対応 */
@media (max-width: 768px) {
  .scope-grid-layout {
    grid-template-columns: 1fr;
  }
}
```

### 2. インタラクション強化

#### スコープアイテムの強化
```javascript
// スコープリストの項目生成を強化
function updateScopeList(scopes) {
  // ...既存コード...
  
  scopes.forEach((scope, index) => {
    // リッチなスコープカードを生成
    const scopeItem = document.createElement('div');
    scopeItem.className = `scope-tree-item ${isActive ? 'active' : ''}`;
    scopeItem.setAttribute('data-index', index.toString());
    scopeItem.innerHTML = `
      <div class="scope-header">
        <div class="scope-title">${scope.name.replace(/^実装スコープ\s*/, '')}</div>
        <div class="status-chip ${statusClass}">${getStatusText(scope.status)}</div>
      </div>
      <div class="scope-description">${scope.description || ''}</div>
      <div class="scope-progress">
        <div class="scope-progress-bar ${statusClass}" style="width: ${progress}%;"></div>
      </div>
      <div class="scope-metadata">
        <div class="scope-files-count">${scope.files ? scope.files.length : 0} ファイル</div>
        <div class="scope-priority">${scope.priority || '優先度未設定'}</div>
      </div>
    `;
    
    // アニメーション効果とインタラクション強化
    scopeItem.addEventListener('click', () => {
      // 既存のクリックハンドラー
      vscode.postMessage({ 
        command: 'selectScope',
        index
      });
      
      // 選択アニメーション
      const allItems = document.querySelectorAll('.scope-tree-item');
      allItems.forEach(item => item.classList.remove('active'));
      scopeItem.classList.add('active');
    });
    
    scopeList.appendChild(scopeItem);
  });
}
```

#### ドラッグ&ドロップの実装
```javascript
// スコープの優先順位をドラッグ&ドロップで変更できるようにする
function enableDragAndDrop() {
  const scopeList = document.getElementById('scope-list');
  if (!scopeList) return;
  
  // ドラッグ可能にする
  const scopeItems = scopeList.querySelectorAll('.scope-tree-item');
  scopeItems.forEach(item => {
    item.setAttribute('draggable', 'true');
    
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.getAttribute('data-index'));
      item.classList.add('dragging');
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
  });
  
  // ドロップターゲットとしての設定
  scopeList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(scopeList, e.clientY);
    const draggable = document.querySelector('.dragging');
    
    if (afterElement == null) {
      scopeList.appendChild(draggable);
    } else {
      scopeList.insertBefore(draggable, afterElement);
    }
  });
  
  scopeList.addEventListener('drop', (e) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const items = Array.from(scopeList.querySelectorAll('.scope-tree-item'));
    const targetIndex = items.indexOf(document.querySelector('.dragging'));
    
    // VSCodeに新しい順序を通知
    vscode.postMessage({
      command: 'reorderScopes',
      sourceIndex,
      targetIndex
    });
  });
}

// Y座標に基づいて挿入位置を決定するヘルパー関数
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.scope-tree-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}
```

#### 検索とフィルター機能
```javascript
// 検索フィルタリング機能の追加
function addSearchAndFilter() {
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-filter-container';
  searchContainer.innerHTML = `
    <input type="text" id="scope-search" class="search-input" placeholder="スコープを検索...">
    <div class="filter-buttons">
      <button data-filter="all" class="filter-button active">すべて</button>
      <button data-filter="pending" class="filter-button">未着手</button>
      <button data-filter="in-progress" class="filter-button">進行中</button>
      <button data-filter="completed" class="filter-button">完了済</button>
    </div>
  `;
  
  // 検索入力のイベントリスナー
  const scopeList = document.getElementById('scope-list');
  const listContainer = scopeList.parentElement;
  listContainer.insertBefore(searchContainer, scopeList);
  
  const searchInput = document.getElementById('scope-search');
  searchInput.addEventListener('input', filterScopes);
  
  // フィルターボタンのイベントリスナー
  const filterButtons = document.querySelectorAll('.filter-button');
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      filterScopes();
    });
  });
}

// スコープをフィルタリングする関数
function filterScopes() {
  const searchTerm = document.getElementById('scope-search').value.toLowerCase();
  const activeFilter = document.querySelector('.filter-button.active').dataset.filter;
  const scopeItems = document.querySelectorAll('.scope-tree-item');
  
  scopeItems.forEach(item => {
    const scopeName = item.querySelector('.scope-title').textContent.toLowerCase();
    const scopeDescription = item.querySelector('.scope-description')?.textContent.toLowerCase() || '';
    const scopeStatus = item.classList.contains('status-completed') ? 'completed' : 
                        item.classList.contains('status-in-progress') ? 'in-progress' : 'pending';
    
    const matchesSearch = scopeName.includes(searchTerm) || scopeDescription.includes(searchTerm);
    const matchesFilter = activeFilter === 'all' || scopeStatus === activeFilter;
    
    if (matchesSearch && matchesFilter) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}
```

### 3. アニメーションとトランジションの強化

```css
/* トランジションとアニメーション強化 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.scope-tree-item {
  /* 既存のスタイル */
  animation: fadeIn 0.3s ease-out;
}

.scope-progress-bar {
  /* 既存のスタイル */
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.scope-detail-container {
  transition: all 0.3s ease;
}

/* スケルトンローディング表示 */
.skeleton-loader {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: var(--app-border-radius-sm);
  height: 16px;
  width: 100%;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

## 実装計画と優先順位

### フェーズ1: 基本レイアウトとカードデザインの刷新（優先度: 高）

**対象ファイル:**
- `/media/scopeManager.css`
- `/media/scopeManager.js`
- `/src/ui/scopeManager/ScopeManagerPanel.ts` - HTMLテンプレート部分

**対応内容:**
1. CSSグリッドレイアウトの導入
2. スコープカードのデザイン強化
3. 視覚的階層構造の明確化
4. 基本的なアニメーションとトランジションの追加

### フェーズ2: インタラクション強化とUI体験の改善（優先度: 中）

**対象ファイル:**
- `/media/scopeManager.js`

**対応内容:**
1. 検索とフィルター機能の実装
2. インタラクションフィードバックの強化
3. マイクロアニメーションの追加
4. ツールチップとヘルプテキストの改善

### フェーズ3: 関連ツール統合とレスポンシブ対応（優先度: 中）

**対象ファイル:**
- `/media/scopeManager.css`
- `/media/scopeManager.js`
- `/src/ui/scopeManager/ScopeManagerPanel.ts`

**対応内容:**
1. 関連ツールカードの追加
2. レスポンシブなグリッドレイアウトの最適化
3. メディアクエリによる画面サイズ対応
4. タッチデバイス対応の強化

### フェーズ4: 高度な機能実装（優先度: 低）

**対象ファイル:**
- `/media/scopeManager.js`
- `/src/ui/scopeManager/ScopeManagerPanel.ts`

**対応内容:**
1. ドラッグ&ドロップによる優先順位変更機能
2. インライン編集機能の強化
3. プログレスビジュアライザーの拡張
4. パフォーマンス最適化

## 技術的考慮事項

1. **CURRENT_STATUS.mdとの連携維持**
   - マークダウンファイルのパース処理は維持しつつUIのみを強化
   - ファイル形式と内容の互換性を保持

2. **VSCodeのWebView制約**
   - WebViewの限界を考慮したUI設計
   - パフォーマンスへの影響を最小限に

3. **アクセシビリティの確保**
   - キーボードナビゲーションのサポート
   - スクリーンリーダー対応
   - コントラスト比の確保

## まとめ

スコープマネージャーのUIUX強化計画は、現状の機能性を維持しながら、視覚的魅力と使いやすさを大幅に向上させることを目指します。ハブ&スポークスタイルのレイアウト、強化されたカードデザイン、モダンなインタラクション要素の導入により、開発者の生産性と満足度の向上を実現します。

---

## 次のステップ: 環境変数アシスタントのリファクタリング

ファイル: `/media/environmentVariablesAssistant.css`

```css
/* 既存のインポート文はそのまま維持 */
@import url('./design-system.css');
@import url('./components.css');
@import url('./accessibility.css');

/* コンテナにライトモードを強制 */
.container {
  background-color: white !important;
  color: #333 !important;
}

/* 以下の変数置換を実施 */
/* --primary → --app-primary */
/* --primary-light → --app-primary-light */
/* VSCode変数の直接参照を減らす */
```

主な対応ポイント:
- 背景色と文字色のライトモード固定
- ボタンやカードなどのコンポーネントを統一された変数に置き換え
- VSCodeのテーマ変数への直接依存を減らす

## デバッグ探偵のリファクタリング

ファイル: `/media/debugDetective.css`

```css
/* 既存のインポート文はそのまま維持 */
@import url('./design-system.css');
@import url('./components.css');
@import url('./accessibility.css');

/* コンテナにライトモードを強制 */
.detective-container {
  background-color: white !important;
  color: #333 !important;
}

/* 以下の変数置換を実施 */
/* --detective-primary → --app-primary */
/* --detective-secondary → --app-secondary */
/* VSCode変数の直接参照を減らす */
```

主な対応ポイント:
- 背景色と文字色のライトモード固定
- エラー表示やタブなどの色を統一された変数に置き換え
- セッションカードなどのコンポーネント背景色をライトモード用に修正

## 付録: スタイル変数対照表

| コンポーネント | 旧変数名 | 新変数名 |
|--------------|---------|---------|
| 共通 | `--primary-color` | `--app-primary` |
| 共通 | `--secondary-color` | `--app-secondary` |
| 共通 | `--accent-color` | `--app-accent` |
| 共通 | `--border-radius` | `--app-border-radius` |
| デバッグ探偵 | `--detective-primary` | `--app-primary` |
| 環境変数アシスタント | `--primary` | `--app-primary` |
| スコープマネージャー | `--primary-color` | `--app-primary` |