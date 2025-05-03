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

3. [ ] **タスク2.1: `handleUpdateState(data)` [行番号 309] の移行**
   - 移行先: `media/state/stateManager.js`
   - 内容: 状態更新の基本機能を移行
   - 確認ポイント: 状態が正しく更新され永続化されること

4. [ ] **タスク2.2: `syncProjectState(project)` [行番号 173] の移行**
   - 移行先: `media/state/stateManager.js`
   - 内容: プロジェクト状態同期機能を移行
   - 確認ポイント: プロジェクト状態が正しく同期されること

5. [ ] **タスク2.3: `restoreProjectState()` [行番号 939] の移行**
   - 移行先: `media/state/stateManager.js`
   - 内容: 状態復元機能を移行
   - 確認ポイント: 他のパネルから戻った際に状態が正しく復元されること

### フェーズ3: マークダウン表示関連の移行

6. [ ] **タスク3.1: `displayMarkdownContent(markdownContent)` [行番号 335] の移行**
   - 移行先: `media/components/markdownViewer/markdownViewer.js`
   - 内容: マークダウン表示の基本機能を移行
   - 確認ポイント: マークダウンが正しくHTMLに変換され表示されること

7. [ ] **タスク3.2: `initializeMarkdownDisplay()` [行番号 913] の移行**
   - 移行先: `media/components/markdownViewer/markdownViewer.js`
   - 内容: マークダウン表示初期化機能を移行
   - 確認ポイント: マークダウン表示が正しく初期化されること

### フェーズ4: プロジェクトナビゲーション関連の移行

8. [ ] **タスク4.1: `updateProjectName(projectName)` [行番号 541] の移行**
   - 移行先: `media/components/projectNavigation/projectNavigation.js`
   - 内容: プロジェクト名更新機能を移行
   - 確認ポイント: プロジェクト名が正しく更新されること

9. [ ] **タスク4.2: `updateProjectPath(data)` [行番号 254] の移行**
   - 移行先: `media/components/projectNavigation/projectNavigation.js`
   - 内容: プロジェクトパス更新機能を移行
   - 確認ポイント: プロジェクトパスが正しく更新され、マークダウン取得が機能すること

10. [ ] **タスク4.3: `updateProjects(projects, activeProject)` [行番号 569] の移行**
    - 移行先: `media/components/projectNavigation/projectNavigation.js`
    - 内容: プロジェクト一覧更新機能を移行
    - 確認ポイント: プロジェクト一覧が正しく表示され選択できること

11. [ ] **タスク4.4: `initializeProjectNav()` [行番号 845] の移行**
    - 移行先: `media/components/projectNavigation/projectNavigation.js`
    - 内容: プロジェクトナビゲーション初期化機能を移行
    - 確認ポイント: プロジェクトナビゲーションが正しく初期化され操作できること

### フェーズ5: ダイアログ関連の移行

12. [ ] **タスク5.1: `hideNewProjectModal()` [行番号 1059] の移行**
    - 移行先: `media/components/dialogManager/dialogManager.js`
    - 内容: モーダル非表示機能を移行
    - 確認ポイント: モーダルが正しく非表示になること

13. [ ] **タスク5.2: `showNewProjectModal()` [行番号 983] の移行**
    - 移行先: `media/components/dialogManager/dialogManager.js`
    - 内容: 新規プロジェクトモーダル表示機能を移行
    - 確認ポイント: モーダルが正しく表示され操作できること

14. [ ] **タスク5.3: `createNewProject()` [行番号 1070] の移行**
    - 移行先: `media/components/projectNavigation/projectNavigation.js`
    - 内容: プロジェクト作成処理を移行
    - 確認ポイント: 新規プロジェクトが正しく作成できること

15. [ ] **タスク5.4: `showTerminalModeDialog(url, name, index)` [行番号 396] の移行**
    - 移行先: `media/components/dialogManager/dialogManager.js`
    - 内容: ターミナルモード選択ダイアログ表示機能を移行
    - 確認ポイント: ダイアログが正しく表示され選択できること

16. [ ] **タスク5.5: `showModalTerminalModeDialog(url, promptId, promptName)` [行番号 1365] の移行**
    - 移行先: `media/components/dialogManager/dialogManager.js`
    - 内容: モーダル内ターミナルモード選択ダイアログ表示機能を移行
    - 確認ポイント: モーダル内ダイアログが正しく表示され選択できること

### フェーズ6: プロンプトカード関連の移行

17. [ ] **タスク6.1: `initializePromptCards()` [行番号 364] の移行**
    - 移行先: `media/components/promptCards/promptCards.js`
    - 内容: プロンプトカード初期化機能を移行
    - 確認ポイント: プロンプトカードが正しく表示され選択できること

18. [ ] **タスク6.2: `initializePromptCardsInModal()` [行番号 1320] の移行**
    - 移行先: `media/components/promptCards/promptCards.js`
    - 内容: モーダル内プロンプトカード初期化機能を移行
    - 確認ポイント: モーダル内プロンプトカードが正しく表示され選択できること

### フェーズ7: その他の機能の移行

19. [ ] **タスク7.1: `initializeClaudeCodeShareArea()` [行番号 1191] の移行**
    - 移行先: `media/components/claudeCodeShare/claudeCodeShare.js`
    - 内容: ClaudeCode連携エリア初期化機能を移行
    - 確認ポイント: 連携エリアが正しく表示され操作できること

20. [ ] **タスク7.2: `setupEventListeners()` [行番号 506] の移行**
    - 移行先: `media/utils/eventManager.js`
    - 内容: イベントリスナー設定機能を移行
    - 確認ポイント: すべてのイベントが正しく機能すること

### フェーズ8: エントリーポイントの最小化

21. [ ] **タスク8.1: `scopeManager.js` のエントリーポイント化**
    - 内容: 各コンポーネントのインポートと初期化のみを行うよう最小化
    - 確認ポイント: すべての機能が引き続き正常に動作すること

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

## 6. 進捗状況 (2025年5月3日)

### 完了したタスク
- [x] マークダウン変換機能のモジュール化 (`markdownConverter.js`)
- [x] UIヘルパー関数のモジュール化 (`uiHelpers.js`)
- [x] 不要なツールタブ関連コードの削除
- [x] VSCode API取得の重複エラーを解消
- [x] **タスク1.1: `selectTab(tabId, saveToServer)` の移行**
- [x] **タスク1.2: `initializeTabs()` の移行**
- [x] タブ状態同期の初期化フラグ対応と競合状態解決

### 現在の作業中タスク
- [ ] **タスク2.1: `handleUpdateState(data)` の移行**
- [ ] **タスク2.2: `syncProjectState(project)` の最適化と移行準備**

### 次に予定されているタスク
- [ ] **タスク2.3: `restoreProjectState()` の移行**
- [ ] **タスク3.1: `displayMarkdownContent(markdownContent)` の移行**

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