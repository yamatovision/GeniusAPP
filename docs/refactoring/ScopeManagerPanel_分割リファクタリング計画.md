# ScopeManagerPanel 分割リファクタリング計画

## UIイベント処理と状態管理の分離計画

現在の`media/scopeManager.js`は2,200行以上の巨大なファイルであり、複数の責務が密結合しています。このドキュメントでは特にUIイベント処理と状態管理の分離に焦点を当てた詳細計画を示します。

### 現状の課題

現在のscopeManager.jsでは、以下の機能が密接に結合しています：

1. ユーザーインターフェースのイベント処理
2. 状態管理（VSCodeの状態APIを使用）
3. メッセージ処理と通信
4. UI要素の更新処理

これらが結合していることで、コードの複雑性が高まり、保守性が低下しています。特に以下の問題があります：

- 状態変更がUIに直接反映される構造で、変更の追跡が困難
- メッセージハンドラが複数の責任を持ち、拡張性が低い
- イベントリスナーが分散して定義され、管理が難しい
- 同じUIロジックが複数の場所に重複

### 分離の指針

状態管理とUIイベント処理を明確に分離します：

1. **状態管理（StateManager）**
   - VSCodeの状態APIとのやり取りを一元管理
   - 状態変更の通知メカニズムを提供
   - すべての状態データのシングルソースオブトゥルース

2. **イベント管理（EventManager）**
   - DOMイベントリスナーの登録・管理
   - ユーザー操作のハンドリング
   - 状態管理層への通知

3. **メッセージ処理（MessageHandler）**
   - 外部からのメッセージの受信と処理
   - 内部状態の更新指示
   - UI更新の指示

4. **UI更新（UIRenderer）**
   - 状態に基づいたUI要素の更新
   - DOMの操作
   - UI表示ロジックの集約

## 実装計画
# ScopeManagerPanel 段階的リファクタリング実装計画 - 詳細タスクリスト

## 1. 概要

このドキュメントは、`media/scopeManager.js`ファイルを機能ごとに分割し、保守性と拡張性を向上させるための詳細なタスクリストです。依存関係を考慮した段階的アプローチにより、各ステップでのユーザー確認を取り入れながら安全にリファクタリングを進めます。

## 2. 目標

1. 単一責任の原則に従ったモジュール構造への移行
2. 依存関係の整理と明確な階層構造の実現
3. UIの安定性を維持しながらコードの品質向上
4. 将来の機能拡張をしやすくする設計の実現

## 3. ディレクトリ構造

```
media/
├── scopeManager.js → エントリーポイント（最小化）
├── components/
│   ├── tabManager/
│   │   ├── tabManager.js
│   │   └── tabManager.css
│   ├── markdownViewer/
│   │   ├── markdownViewer.js
│   │   └── markdownViewer.css
│   ├── projectNavigation/
│   │   ├── projectNavigation.js
│   │   └── projectNavigation.css
│   ├── dialogManager/
│   │   ├── dialogManager.js
│   │   └── dialogManager.css
│   ├── promptCards/
│   │   └── promptCards.js
│   └── claudeCodeShare/
│       └── claudeCodeShare.js
├── state/
│   └── stateManager.js
├── utils/
│   ├── markdownConverter.js
│   ├── messageHandler.js
│   ├── uiHelpers.js
│   └── eventManager.js
```

## 4. 詳細タスクリスト

各関数の依存関係を考慮した移行順序で、段階的にリファクタリングを進めます。各タスク完了後にはユーザー確認を行い、問題がないことを確認してから次のステップに進みます。

### フェーズ1: タブ管理関連の移行

1. [x] **タスク1.1: `selectTab(tabId, saveToServer)` [行番号 1264] の移行**
   - 移行先: `media/components/tabManager/tabManager.js`
   - 内容: タブUI操作の中核機能を移行
   - 確認ポイント: タブ切り替えが正常に動作すること
   - **完了状況**: ✅ 2025-05-03 移行完了。競合状態防止のため初期化フラグによる安全対策を追加。

2. [x] **タスク1.2: `initializeTabs()` [行番号 1105] の移行**
   - 移行先: `media/components/tabManager/tabManager.js`
   - 内容: タブ初期化機能を移行
   - 確認ポイント: 初期タブ選択とイベントリスナーが正常に動作すること
   - **完了状況**: ✅ 2025-05-03 移行完了。旧関数は非推奨として実装を簡略化し、新TabManagerに処理を委譲。

### フェーズ2: 状態管理関連の移行

3. [x] **タスク2.1: `handleUpdateState(data)` [行番号 309] の移行**
   - 移行先: `media/state/stateManager.js`
   - 内容: 状態更新の基本機能を移行
   - 確認ポイント: 状態が正しく更新され永続化されること
   - **完了状況**: ✅ 2025-05-03 移行完了。CustomEventを使用してコンポーネント間の通信を実現。

4. [x] **タスク2.2: `syncProjectState(project)` [行番号 173] の移行**
   - 移行先: `media/state/stateManager.js`
   - 内容: プロジェクト状態同期機能を移行
   - 確認ポイント: プロジェクト状態が正しく同期されること
   - **完了状況**: ✅ 2025-05-03 移行完了。状態の変更をイベントで通知する仕組みを実装。

5. [x] **タスク2.3: `restoreProjectState()` [行番号 939] の移行**
   - 移行先: `media/state/stateManager.js`
   - 内容: 状態復元機能を移行
   - 確認ポイント: 他のパネルから戻った際に状態が正しく復元されること
   - **完了状況**: ✅ 2025-05-03 移行完了。遅延実行と非同期処理のタイミングを保持。

### フェーズ3: マークダウン表示関連の移行

6. [x] **タスク3.1: `displayMarkdownContent(markdownContent)` [行番号 335] の移行**
   - 移行先: `media/components/markdownViewer/markdownViewer.js`
   - 内容: マークダウン表示の基本機能を移行
   - 確認ポイント: マークダウンが正しくHTMLに変換され表示されること
   - **完了状況**: ✅ 2025-05-03 移行完了。convertMarkdownToHtml関数を活用し、イベントベースの通信に移行。

7. [x] **タスク3.2: `initializeMarkdownDisplay()` [行番号 913] の移行**
   - 移行先: `media/components/markdownViewer/markdownViewer.js`
   - 内容: マークダウン表示初期化機能を移行
   - 確認ポイント: マークダウン表示が正しく初期化されること
   - **完了状況**: ✅ 2025-05-03 移行完了。markdownViewerが自動初期化される形に変更し、カスタムイベントリスナーを実装。

### フェーズ4: プロジェクトナビゲーション関連の移行

8. [x] **タスク4.1: `updateProjectName(projectName)` [行番号 541] の移行**
   - 移行先: `media/components/projectNavigation/projectNavigation.js`
   - 内容: プロジェクト名更新機能を移行
   - 確認ポイント: プロジェクト名が正しく更新されること
   - **完了状況**: ✅ 2025-05-03 移行完了。イベントベースの通信で機能を保持しつつ責任を分離。

9. [x] **タスク4.2: `updateProjectPath(data)` [行番号 254] の移行**
   - 移行先: `media/components/projectNavigation/projectNavigation.js`
   - 内容: プロジェクトパス更新機能を移行
   - 確認ポイント: プロジェクトパスが正しく更新され、マークダウン取得が機能すること
   - **完了状況**: ✅ 2025-05-03 移行完了。VSCode APIとのインタラクションを保持しつつコンポーネント化。

10. [x] **タスク4.3: `updateProjects(projects, activeProject)` [行番号 569] の移行**
    - 移行先: `media/components/projectNavigation/projectNavigation.js`
    - 内容: プロジェクト一覧更新機能を移行
    - 確認ポイント: プロジェクト一覧が正しく表示され選択できること
    - **完了状況**: ✅ 2025-05-03 移行完了。大規模な機能をイベントベースの通信に変更し、プロジェクト操作の全責任をコンポーネントに委譲。

11. [x] **タスク4.4: `initializeProjectNav()` [行番号 845] の移行**
    - 移行先: `media/components/projectNavigation/projectNavigation.js`
    - 内容: プロジェクトナビゲーション初期化機能を移行
    - 確認ポイント: プロジェクトナビゲーションが正しく初期化され操作できること
    - **完了状況**: ✅ 2025-05-03 移行完了。initializeNavigation()メソッドを追加し、新規プロジェクト作成モーダル機能も完全に移行。

### フェーズ5: ダイアログ関連の移行

12. [x] **タスク5.1: `hideNewProjectModal()` [行番号 1059] の移行**
    - 移行先: `media/components/projectNavigation/projectNavigation.js`
    - 内容: モーダル非表示機能を移行
    - 確認ポイント: モーダルが正しく非表示になること
    - **完了状況**: ✅ 2025-05-04 既にprojectNavigation.jsに実装されていたので確認のみ。

13. [x] **タスク5.2: `showNewProjectModal()` [行番号 983] の移行**
    - 移行先: `media/components/projectNavigation/projectNavigation.js`
    - 内容: 新規プロジェクトモーダル表示機能を移行
    - 確認ポイント: モーダルが正しく表示され操作できること
    - **完了状況**: ✅ 2025-05-04 既にprojectNavigation.jsに実装されていたので確認のみ。

14. [x] **タスク5.3: `createNewProject()` [行番号 1070] の移行**
    - 移行先: `media/components/projectNavigation/projectNavigation.js`
    - 内容: プロジェクト作成処理を移行
    - 確認ポイント: 新規プロジェクトが正しく作成できること
    - **完了状況**: ✅ 2025-05-04 既にprojectNavigation.jsに実装されていたので確認のみ。

15. [x] **タスク5.4: `showTerminalModeDialog(url, name, index)` [行番号 287] の移行**
    - 移行先: `media/components/dialogManager/dialogManager.js`
    - 内容: ターミナルモード選択ダイアログ表示機能を移行
    - 確認ポイント: ダイアログが正しく表示され選択できること
    - **完了状況**: ✅ 2025-05-04 移行完了。インラインスタイルからCSSクラス使用に変更し、コードを整理。

16. [x] **タスク5.5: `showModalTerminalModeDialog(url, promptId, promptName)` [行番号 619] の移行**
    - 移行先: `media/components/dialogManager/dialogManager.js`
    - 内容: モーダル内ターミナルモード選択ダイアログ表示機能を移行
    - 確認ポイント: モーダル内ダイアログが正しく表示され選択できること
    - **完了状況**: ✅ 2025-05-04 移行完了。インラインスタイルからCSSクラス使用に変更し、コードを整理。

### フェーズ6: プロンプトカード関連の移行

17. [x] **タスク6.1: `initializePromptCards()` [行番号 255] の移行**
    - 移行先: `media/components/promptCards/promptCards.js`
    - 内容: プロンプトカード初期化機能を移行
    - 確認ポイント: プロンプトカードが正しく表示され選択できること
    - **完了状況**: ✅ 2025-05-04 移行完了。旧関数は非推奨として実装を簡略化し、新promptCardsに処理を委譲。

18. [x] **タスク6.2: `initializePromptCardsInModal()` [行番号 477] の移行**
    - 移行先: `media/components/promptCards/promptCards.js`
    - 内容: モーダル内プロンプトカード初期化機能を移行
    - 確認ポイント: モーダル内プロンプトカードが正しく表示され選択できること
    - **完了状況**: ✅ 2025-05-04 移行完了。旧関数は非推奨として実装を簡略化し、新promptCardsに処理を委譲。

### フェーズ7: その他の機能の移行

19. [x] **タスク7.1: `initializeClaudeCodeShareArea()` [行番号 1191] の移行**
    - 移行先: 既存の場所に留め、非推奨とマーク
    - 内容: ClaudeCode連携エリア初期化機能を現状維持
    - 確認ポイント: 連携エリアが正しく表示され操作できること
    - **完了状況**: ✅ 2025-05-04 機能範囲が限定的であり、sharingPanel.jsとの連携が既に確立されているため、移行せずに現状維持。

20. [x] **タスク7.2: `setupEventListeners()` [行番号 506] の移行**
    - 移行先: 既存の場所に留め、非推奨とマーク
    - 内容: イベントリスナー設定機能を現状維持
    - 確認ポイント: すべてのイベントが正しく機能すること
    - **完了状況**: ✅ 2025-05-04 UIコンポーネントのイベント設定は対応するUIコンポーネントと同じファイルに配置する方が自然であるため、現状維持。

### フェーズ8: エントリーポイントの最小化

21. [x] **タスク8.1: `scopeManager.js` のエントリーポイント化**
    - 内容: 各コンポーネントのインポートと初期化のみを行うよう最小化
    - 確認ポイント: すべての機能が引き続き正常に動作すること
    - **完了状況**: ✅ 2025-05-04 エントリーポイント化完了。非推奨関数を削除し、各コンポーネントへの依存を明確化。初期化順序を最適化し、クラス間の連携を整理。

## 5. 各フェーズでのユーザー確認プロセス

各タスク完了後に以下の手順で確認を行います：

1. **動作確認**
   - 関連機能の全ての動作を確認
   - エッジケースの動作も確認

2. **UI確認**
   - 表示が崩れていないか確認
   - アニメーションやトランジションが正常か確認

3. **パフォーマンス確認**
   - 処理速度に問題がないか確認
   - メモリ使用量に問題がないか確認

4. **エラー処理確認**
   - エラー時に適切なメッセージが表示されるか確認
   - エラーから正常に回復できるか確認

## 6. 進捗状況 (2025年5月4日)

### 完了したタスク
- [x] マークダウン変換機能のモジュール化 (`markdownConverter.js`)
- [x] UIヘルパー関数のモジュール化 (`uiHelpers.js`)
- [x] 不要なツールタブ関連コードの削除
- [x] VSCode API取得の重複エラーを解消
- [x] **タスク1.1: `selectTab(tabId, saveToServer)` の移行**
- [x] **タスク1.2: `initializeTabs()` の移行**
- [x] **タスク2.1: `handleUpdateState(data)` の移行**
- [x] **タスク2.2: `syncProjectState(project)` の移行**
- [x] **タスク2.3: `restoreProjectState()` の移行**
- [x] **タスク3.1: `displayMarkdownContent(markdownContent)` の移行**
- [x] **タスク3.2: `initializeMarkdownDisplay()` の移行**
- [x] **タスク4.1: `updateProjectName(projectName)` の移行**
- [x] **タスク4.2: `updateProjectPath(data)` の移行**
- [x] **タスク4.3: `updateProjects(projects, activeProject)` の移行**
- [x] **タスク4.4: `initializeProjectNav()` の移行**
- [x] **タスク5.1: `hideNewProjectModal()` の確認** (既にprojectNavigation.jsに実装済み)
- [x] **タスク5.2: `showNewProjectModal()` の確認** (既にprojectNavigation.jsに実装済み)
- [x] **タスク5.3: `createNewProject()` の確認** (既にprojectNavigation.jsに実装済み)
- [x] **タスク5.4: `showTerminalModeDialog(url, name, index)` の移行**
- [x] **タスク5.5: `showModalTerminalModeDialog(url, promptId, promptName)` の移行**
- [x] **タスク6.1: `initializePromptCards()` の移行**
- [x] **タスク6.2: `initializePromptCardsInModal()` の移行**

### 完了したタスク（追加分）
- [x] **タスク7.1: `initializeClaudeCodeShareArea()` の移行** - 現状維持として完了
- [x] **タスク7.2: `setupEventListeners()` の移行** - 現状維持として完了
- [x] **タスク8.1: `scopeManager.js` のエントリーポイント化**

### 現在の作業中タスク
- [ ] **プロジェクト全体の検証と統合テスト**

### 次に予定されているタスク
- [ ] **リファクタリング後のドキュメント更新**

## 7. リファクタリング実装における教訓と注意点

### 7.1 理論と実践のギャップ対策
- **隠れた依存関係の発見**: 表面上は独立していても、実際には複雑な相互依存関係があることが判明。特にタブ管理とプロジェクト切り替えの間には予想外の依存があった。
- **初期化タイミングの問題**: コンポーネントの初期化順序とタイミングが重要。タブマネージャーのisInitializedフラグと保留中リクエスト機能で対応。
- **コンポーネント間の状態同期**: 分割したコンポーネント間で状態を一貫して維持することが課題。新しいstateManagerを介した統一的なアプローチが必要。

### 7.2 実装上の具体的な対策
- **段階的な変更と検証**: 各関数の移行後に必ず動作確認を行い、問題発見と修正を繰り返す。予想外の動作が多く発生するため、小さな変更ごとの確認が重要。
- **非同期処理の順序制御**: DOMロード、コンポーネント初期化、状態復元の順序が重要。遅延実行とタイムアウトを適切に設定。
- **フラグによる安全対策**: 初期化完了状態、処理中状態をフラグで管理し、競合状態を防止。
- **パフォーマンス最適化**: 重複更新を防止する仕組みと、UIブロッキングを防ぐ非同期処理の導入。
- **冗長なログ出力**: 内部動作を詳細に記録し、タイミング問題の調査に活用。

### 7.3 リファクタリングプロセスの改善
- **ユーザー確認を徹底**: 各段階での変更後に必ず動作確認を行い、承認を得てから次に進むプロセスを厳守する。
- **メインスレッドブロッキング回避**: UIの応答性を維持するため、重い処理は非同期実行に変更。
- **エラー検出の強化**: 予期せぬエラー状態を早期に検出するための防御的プログラミングを導入。
- **計画と実践のバランス**: 詳細な計画は重要だが、実践から学び調整する柔軟性も必要。

各タスクは、実装 → テスト → ユーザー確認 → 次のタスクへ、というサイクルで進めてください。
