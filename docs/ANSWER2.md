まず最初にこれはCURRENT_STATUSからパースして表示する形式になっているかと思いますが。どういう条件でパースが働いているのかを教えてください。

ここで気になっているのがまず実装スコープなどの色使いやホバーした時の色使いががみづらいと言うことです。ホバーして黒くなるとかなりみづらいです。

/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/mockups/dashboard-hub-spoke.html

こちらの色使いの方が見やすいと思います。大きさとかも含めてですね。

また、ディレクトリ構造を表示のボタンの場所なんですがこれは、実装スコープの同じ行にプラスボタンがあると思いますが、それ実際には使わないので、そこにボタンを移動させてもらいたいです。

あとスコープを作成する。のボタンを

新規スコープを作成する　の文言に変更してください。

エラーを解消する。


その下のボタンに
プロジェクトを分析してスコープを追加するボタンを追加してください。

こちらの実装を行って完了させる。






# スコープマネージャーのCURRENT_STATUS.mdパース処理報告

## 概要

スコープマネージャーは`CURRENT_STATUS.md`ファイルをパースして、プロジェクトのスコープ情報を視覚化しています。この報告書では、このパース処理の仕組みを詳しく解説します。

## パース処理の流れ

### 1. 処理の起点

`ScopeManagerPanel.ts`の`_parseStatusFile`メソッドが主要なパース処理を担当しています。このメソッドは以下のタイミングで呼び出されます：

- パネル初期化時（`_handleInitialize`）
- プロジェクトパス設定時（`setProjectPath`）
- ファイル変更検出時（`_setupFileWatcher`のコールバック）

### 2. 主なパース処理のステップ

1. **初期化**: スコープ配列をクリアし、変数を初期化
2. **行ごとの処理**: ファイルの内容を行単位で読み込み
3. **セクション検出**: マークダウンのヘッダー（`##`や`###`）でセクションを判別
4. **スコープ情報抽出**: セクションごとに異なるパターンでスコープ情報を抽出
5. **補足情報収集**: ディレクトリ構造、ファイルリスト、引継ぎ情報などを抽出
6. **情報統合**: すべての情報を統合してスコープオブジェクトを構築
7. **現在のスコープ選択**: 適切なスコープを現在の選択として設定

## スコープ検出のパターン

### 1. 完了済みスコープの検出

```javascript
// ### 完了済みスコープ セクション内の箇条書きを検出
const match = scopeLine.match(/- \[x\] (.+?) \(100%\)/);
if (match) {
  const name = match[1];
  completedScopes.push({
    name,
    status: 'completed',
    progress: 100
  });
}
```

### 2. 進行中スコープの検出

```javascript
// ### 進行中スコープ セクション内の箇条書きを検出
const match = scopeLine.match(/- \[ \] (.+?) \((\d+)%\)/);
if (match) {
  const name = match[1];
  const progress = parseInt(match[2]);
  inProgressScopes.push({
    name,
    status: 'in-progress',
    progress
  });
}
```

### 3. 未着手スコープの検出

```javascript
// ### 未着手スコープ セクション内の箇条書きを検出（複数のパターンに対応）
// パターン1: - [ ] スコープ名 (0%)
let match = scopeLine.match(/- \[ \] (.+?) \(0%\)/);

// パターン2: - [ ] スコープ名（進捗情報なし）
if (!match) {
  match = scopeLine.match(/^- \[ \] ([^(]+)(?:\s|$)/);
}

// パターン3: - [ ] スコープ名 (scope-xxx-xxx)（ID付き）
if (!match && scopeLine.includes('(scope-')) {
  match = scopeLine.match(/^- \[ \] (.+?) \(scope-[^)]+\)/);
}

if (match) {
  const name = match[1].trim();
  // スコープIDの抽出
  let scopeId = '';
  const idMatch = scopeLine.match(/\(scope-([^)]+)\)/);
  if (idMatch) {
    scopeId = `scope-${idMatch[1]}`;
  }
  
  // 説明の抽出
  let description = '';
  if (i + 1 < lines.length && lines[i + 1].trim().startsWith('- 説明:')) {
    description = lines[i + 1].trim().substring('- 説明:'.length).trim();
  }
  
  pendingScopes.push({
    name,
    status: 'pending',
    progress: 0,
    id: scopeId,
    description: description
  });
}
```

## ファイルリストの抽出

ファイルリストは複数のセクションから抽出されます：

```javascript
// 実装完了/実装予定/実装すべきファイルセクションの処理
if (currentSection.includes('実装完了ファイル') || 
    currentSection.includes('実装すべきファイル') || 
    currentSection.includes('実装予定ファイル')) {
  
  // ファイルの完了状態を検出
  const completedMatch = fileLine.match(/- \[([ x])\] ([^\(\)]+)/);
  if (completedMatch) {
    const isCompleted = completedMatch[1] === 'x';
    const filePath = completedMatch[2].trim();
    
    // 完了済みならcompletedFilesに追加
    if (isCompleted) {
      completedFiles.push(filePath);
    }
    
    // 該当するスコープのファイルリストを更新
    const scopesToUpdate = [...completedScopes, ...inProgressScopes, ...pendingScopes];
    scopesToUpdate.forEach(scope => {
      if (scope.name === currentScopeName || fileLine.includes(scope.name)) {
        if (!scope.files) scope.files = [];
        
        // 既存のファイルリストにあれば更新、なければ追加
        const fileIndex = scope.files.findIndex((f: any) => f.path === filePath);
        if (fileIndex >= 0) {
          scope.files[fileIndex].completed = isCompleted;
        } else {
          scope.files.push({
            path: filePath,
            completed: isCompleted
          });
        }
      }
    });
  }
}
```

## 進捗率計算とステータス更新

進捗率は、スコープに関連するファイルの完了状態から計算されます：

```javascript
// _handleToggleFileStatus メソッドより抜粋
const completedCount = this._currentScope.files.filter((f: any) => f.completed).length;
const totalCount = this._currentScope.files.length;
const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

// スコープのステータスと進捗を更新
this._currentScope.progress = newProgress;
this._scopes[this._selectedScopeIndex].progress = newProgress;

// ステータスの自動更新
if (newProgress === 100) {
  this._currentScope.status = 'completed';
  this._scopes[this._selectedScopeIndex].status = 'completed';
} else if (newProgress > 0) {
  this._currentScope.status = 'in-progress';
  this._scopes[this._selectedScopeIndex].status = 'in-progress';
}
```

## 引継ぎ情報の抽出

スコープに関連する引継ぎ情報も抽出されます：

```javascript
// 引継ぎ情報セクションの処理
if (currentSection === '引継ぎ情報') {
  if (line.startsWith('### 現在のスコープ:')) {
    const scopeName = line.substring('### 現在のスコープ:'.length).trim();
    // 引継ぎ情報の内容をキャプチャ
    let sectionStartIdx = i;
    let sectionEndIdx = i;
    
    i++;
    while (i < lines.length && !lines[i].startsWith('##')) {
      // 実装すべきファイルセクションで引継ぎ情報の終わりとする
      if (lines[i].startsWith('**実装すべきファイル**:') || 
          lines[i].startsWith('**実装予定ファイル**:') || 
          lines[i].includes('実装すべきファイル') || 
          lines[i].includes('実装予定ファイル')) {
          
        sectionEndIdx = i - 1; // ファイルセクションの前の行までが引継ぎ情報
        break;
      }
      i++;
    }
    
    // 引継ぎ情報を抽出
    if (sectionEndIdx > sectionStartIdx) {
      inheritanceInfo = lines.slice(sectionStartIdx, sectionEndIdx + 1).join('\n');
    }
  }
}
```

## CURRENT_STATUS.mdの期待形式

スコープマネージャーが正しく動作するためには、CURRENT_STATUS.mdファイルが以下のセクションとフォーマットを含むことが期待されています：

```markdown
## スコープ状況

### 完了済みスコープ
- [x] 完了したスコープ名 (100%)

### 進行中スコープ
- [ ] 進行中のスコープ名 (50%)

### 未着手スコープ
- [ ] スコープ名
  - 説明: スコープの説明
  - 優先度: 高/中/低
  - 関連ファイル: ファイルパス1, ファイルパス2

## 引継ぎ情報

### 現在のスコープ: スコープ名
**スコープID**: scope-xxxx
**説明**: 説明文
**含まれる機能**:
1. 機能1
2. 機能2

**実装すべきファイル**: 
- [ ] ファイルパス1
- [x] ファイルパス2
```

## 状態が保存されるタイミング

パース処理によって構築されたスコープ情報は、以下のタイミングでCURRENT_STATUS.mdファイルに書き戻されます：

1. スコープのステータス変更時（`_handleUpdateScopeStatus`）
2. ファイルの完了状態変更時（`_handleToggleFileStatus`）
3. スコープ編集時（`_handleEditScope`）
4. 実装開始時（`_handleStartImplementation`）
5. 新しいスコープ追加時（`_handleAddNewScope`）

## まとめ

スコープマネージャーのパース処理は、マークダウンドキュメントから構造化されたデータを抽出し、WebViewでの視覚化に利用しています。様々なパターンマッチングを組み合わせた柔軟な設計により、CURRENT_STATUS.mdファイルに記載されたスコープ情報を正確に解析し、UIに反映しています。

この仕組みにより、ドキュメントとしての可読性を保ちながら、アプリケーション内での管理と視覚化を実現しています。適切なマークダウン形式でファイルを維持することで、スコープマネージャーの機能を最大限に活用できます。