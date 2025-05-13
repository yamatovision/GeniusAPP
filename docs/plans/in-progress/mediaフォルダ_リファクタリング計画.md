# リファクタリング計画: mediaフォルダ [2025-05-13]

## 1. 現状分析

### 1.1 対象概要
mediaフォルダはAppGeniusのフロントエンド部分であるWebViewコンポーネントのスクリプトとスタイルを提供する役割を持ちます。このフォルダには、scopeManagerなどの主要コンポーネント、各種ユーティリティ、UIコンポーネントが含まれており、VSCodeのWebView機能を通じてユーザーインターフェースを構築します。

### 1.2 問題点と課題
- **類似名の異なる機能ファイルの存在**: markdownViewer関連ファイルが複数の場所に存在し、名称が類似しているが実際には異なる機能を提供している
- **バックアップファイル(.bak)の散在**: メンテナンスの痕跡として.bakファイルが複数残されている
- **非推奨コード**: 既に削除済みの機能に関するコードが残っている（ファイルブラウザ、マークダウンビューワー関連）
- **ディレクトリ構造の非一貫性**: 一部のコンポーネントはcomponentsディレクトリに移行されているが、一部はルートに残っている
- **モジュール間の依存関係の複雑さ**: 特にscopeManagerとmarkdownViewer間の依存関係が複雑
- **未使用コンポーネントの残存**: 現在は使用されていないコンポーネント（dashboard、environmentVariablesAssistant、simpleChat、referenceManager、simpleMockupEditor、claudeMdEditor、debugDetective）のファイルが残存している

### 1.3 関連ファイル一覧
- **同名だが別機能のファイル**:
  - /media/markdownViewer/markdownViewer.js: スタンドアロンのファイルビューワー機能
  - /media/components/markdownViewer/markdownViewer.js: ScopeManager内表示用のマークダウンビューワーコンポーネント
  - /media/markdownViewer/markdownViewer.css: スタンドアロンファイルビューワー用スタイル
  - /media/components/markdownViewer/markdownViewer.css: 埋め込み型マークダウン表示用スタイル
- **バックアップファイル**:
  - /media/scopeManager.js.bak と /media/scopeManager.js.bak.phase8

- **主要コンポーネント**:
  - /media/scopeManager.js (エントリーポイント)
  - /media/state/stateManager.js (状態管理)
  - /media/components/tabManager/tabManager.js (タブ管理)
  - /media/components/markdownViewer/markdownViewer.js (マークダウン表示)
  - /media/components/projectNavigation/projectNavigation.js (プロジェクトナビゲーション)
  - /media/components/dialogManager/dialogManager.js (ダイアログ管理)
  - /media/components/promptCards/promptCards.js (プロンプトカード)

- **不要なWebViewコンポーネント**:
  - /media/dashboard.js + /media/dashboard.css
  - /media/environmentVariablesAssistant.js + /media/environmentVariablesAssistant.css
  - /media/simpleChat.js + /media/simpleChat.css
  - /media/referenceManager.js + /media/referenceManager.css
  - /media/simpleMockupEditor.js + /media/simpleMockupEditor.css
  - /media/claudeMdEditor.js + /media/claudeMdEditor.css
  - /media/debugDetective.js + /media/debugDetective.css

- **使用中のWebViewコンポーネント**:
  - /media/mockupGallery.js + /media/mockupGallery.css

- **グローバルスタイル**:
  - /media/accessibility.css （他の削除対象CSSファイルからのみ参照されているため削除可能）
  - /media/components.css （ScopeManagerから間接的に参照されており維持が必要）
  - /media/design-system.css （ScopeManagerから参照されており維持が必要）
  - /media/noProjectView.css
  - /media/reset.css （ScopeManagerから参照されており維持が必要）
  - /media/scopeManager.css
  - /media/vscode.css （ScopeManagerから参照されており維持が必要）

- **ユーティリティ**:
  - /media/utils/markdownConverter.js
  - /media/utils/simpleMarkdownConverter.js
  - /media/utils/uiHelpers.js
  - /media/utils/messageHandler.js
  - /media/utils/serviceConnector.js

### 1.4 依存関係図
```
scopeManager.js (エントリーポイント)
├── state/stateManager.js (状態管理)
├── utils/uiHelpers.js (UI共通関数)
├── utils/simpleMarkdownConverter.js (マークダウン変換)
├── components/tabManager/tabManager.js (タブ管理)
│   └── state/stateManager.js
├── components/markdownViewer/markdownViewer.js (マークダウン表示)
│   ├── state/stateManager.js
│   └── utils/simpleMarkdownConverter.js
├── components/projectNavigation/projectNavigation.js (プロジェクト管理)
│   └── state/stateManager.js
├── components/dialogManager/dialogManager.js (ダイアログ)
│   └── state/stateManager.js
└── components/promptCards/promptCards.js (プロンプトカード)
    └── state/stateManager.js
```

## 2. リファクタリングの目標

### 2.1 期待される成果
- ファイル数の削減: 重複ファイルと不要ファイルの除去による総ファイル数30%減
- コード品質向上: 明確なコンポーネント分割と責任範囲の明確化
- 保守性の向上: 一貫したディレクトリ構造と命名規則の適用
- 将来の拡張性: 新機能追加時の拡張性と柔軟性の確保

### 2.2 維持すべき機能
- すべての既存機能の正常動作の維持
- ScopeManagerPanelとの連携機能
- タブ管理とステート管理の機能
- マークダウン表示の一貫性

## 3. 理想的な実装

### 3.1 全体アーキテクチャ
- **明確なレイヤー分離**:
  1. **エントリーポイント**: scopeManager.js (最小化)
  2. **コアレイヤー**: 状態管理、メッセージングなどの基本機能
  3. **コンポーネントレイヤー**: UI要素を担当する独立コンポーネント
  4. **ユーティリティレイヤー**: 共通機能とヘルパー関数
  
- **イベントベースの疎結合アーキテクチャ**:
  - CustomEventを使用したコンポーネント間通信
  - stateManagerを中心とした状態管理

### 3.2 核心的な改善ポイント
- **markdownViewerの名称変更と役割明確化**: ルートにあるmarkdownViewerをFileViewerに名称変更し、役割の違いを明確化
- **共通ライブラリの統合**: マークダウン変換機能などの共通処理を共有ライブラリに統合
- **不要な.bakファイルの完全削除**: バージョン管理で履歴を管理し、余分なバックアップファイルを除去
- **非推奨コードの削除**: ファイルブラウザなど既に削除された機能に関するコードの完全除去
- **すべての使用中コンポーネントをcomponentsディレクトリに移動**: 一貫した構造の確立
- **未使用コンポーネントの削除**: 現在使用されていないdashboard、environmentVariablesAssistant、simpleChat、referenceManager、simpleMockupEditor、claudeMdEditor、debugDetectiveの関連ファイルの削除

### 3.3 新しいディレクトリ構造
```
media/
├── scopeManager.js (エントリーポイント - 最小化)
├── fileViewer/                      ← リネームされたファイルビューワー
│   ├── fileViewer.js             ← 旧markdownViewer.js
│   └── fileViewer.css            ← 旧markdownViewer.css
├── components/
│   ├── tabManager/
│   │   ├── tabManager.js
│   │   └── tabManager.css
│   ├── markdownViewer/            ← ScopeManager内部のマークダウン表示コンポーネント
│   │   ├── markdownViewer.js
│   │   └── markdownViewer.css
│   ├── projectNavigation/
│   │   ├── projectNavigation.js
│   │   └── projectNavigation.css
│   ├── dialogManager/
│   │   ├── dialogManager.js
│   │   └── dialogManager.css
│   ├── promptCards/
│   │   ├── promptCards.js
│   │   └── promptCards.css
│   ├── sharingPanel/
│   │   ├── sharingPanel.js
│   │   └── sharingPanel.css
│   └── mockupGallery/
│       ├── mockupGallery.js
│       └── mockupGallery.css
├── core/
│   ├── stateManager.js (旧state/stateManager.js)
│   └── messageDispatcher.js (新規作成)
├── styles/
│   ├── components.css
│   ├── design-system.css
│   ├── reset.css
│   └── vscode.css
└── utils/
    ├── markdownConverter.js (共有ライブラリ)
    ├── uiHelpers.js
    └── serviceConnector.js
```

## 4. 実装計画

### フェーズ1: 名称変更とファイル整理
- **目標**: 特定ファイルの名称変更と不要ファイルの整理
- **影響範囲**: すべてのmediaフォルダとsrc/ui/内のコンポーネント
- **タスク**:
  1. **T1.1**: ルートのmarkdownViewerファイルをFileViewerにリネーム
     - 対象: 
       - /media/markdownViewer/markdownViewer.js → /media/fileViewer/fileViewer.js
       - /media/markdownViewer/markdownViewer.css → /media/fileViewer/fileViewer.css
     - 実装: 
       - 新しいディレクトリとファイル名でコピー作成
       - ファイル内部のCSSクラス名などを適切に更新
       - リネーム後の動作確認と元のファイルの削除
  
  2. **T1.2**: バックアップファイルの削除
     - 対象: 
       - /media/scopeManager.js.bak
       - /media/scopeManager.js.bak.phase8
     - 実装:
       - 変更前にGitコミットを作成して履歴保全
       - ファイルの削除
  
  3. **T1.3**: 非推奨コードブロックの削除
     - 対象: scopeManager.js内のコメントアウトされた削除済み機能
     - 実装: コード内のファイルブラウザ関連の削除済みコードを完全に除去

  4. **T1.4**: 未使用WebViewコンポーネントの削除
     - 対象:
       - /media/dashboard.js, /media/dashboard.css
       - /media/environmentVariablesAssistant.js, /media/environmentVariablesAssistant.css
       - /media/simpleChat.js, /media/simpleChat.css
       - /media/referenceManager.js, /media/referenceManager.css
       - /media/simpleMockupEditor.js, /media/simpleMockupEditor.css
       - /media/claudeMdEditor.js, /media/claudeMdEditor.css
       - /media/debugDetective.js, /media/debugDetective.css
       - /media/accessibility.css
     - 実装: ファイルの削除
     - 注意: fileViewerにリネームしたファイルは残すこと

  5. **T1.5**: TypeScriptコード内のmarkdownViewerからfileViewerへの参照更新
     - 対象: 
       - /src/ui/scopeManager/ScopeManagerPanel.ts
       - /src/ui/scopeManager/services/implementations/MessageDispatchServiceImpl.ts
       - /src/extension.ts
       - /src/commands/markdownViewerCommands.ts
     - 実装:
       - コマンド名やメソッド名の変更（openMarkdownViewer → openFileViewerなど）
       - ログメッセージおよびコメントの更新

  6. **T1.6**: 未使用TypeScriptコンポーネントの削除前の参照確認
     - 対象: 
       - /src/extension.ts（simpleChat参照あり）
       - /scripts/toolkit/toolkit-dependencies.js（EnvironmentVariablesAssistantPanel参照あり）
     - 実装:
       - 参照箇所の特定と修正
       - インポート文の削除または非アクティブ化

- **検証ポイント**:
  - リネーム後のFileViewerがスタンドアロンアプリとして正常に動作すること
  - ScopeManager内のマークダウン表示機能に影響がないこと
  - タブ管理機能が正常に動作すること
  - ビルドエラーが発生しないこと
  - 全ての参照先が新しい名称に更新されていること

### フェーズ2: ディレクトリ構造の整理
- **目標**: 一貫性のあるディレクトリ構造の確立
- **影響範囲**: media/直下のコンポーネントファイル
- **タスク**:
  1. **T2.1**: stateManagerの移動
     - 対象: /media/state/stateManager.js
     - 実装:
       - /media/core/stateManager.jsとして移動
       - インポートパスの更新

  2. **T2.2**: 使用中のスタンドアロンWebViewコンポーネントの移動
     - 対象:
       - /media/mockupGallery.js + /media/mockupGallery.css
     - 実装:
       - 各コンポーネントごとに専用ディレクトリを作成
       - 例: /media/components/mockupGallery/へ移動
       - インポートパスの更新
       - HTMLテンプレートのパス参照も更新

  3. **T2.3**: グローバルスタイルの整理
     - 対象:
       - /media/components.css
       - /media/design-system.css
       - /media/reset.css
       - /media/vscode.css
     - 実装:
       - /media/styles/ディレクトリを作成
       - グローバルスタイルをこのディレクトリに集約
       - HTMLテンプレートのスタイル参照を更新

- **検証ポイント**:
  - 移動後もすべての機能が正常に動作すること
  - インポートエラーが発生していないこと

### フェーズ3: マークダウン変換ユーティリティの整理
- **目標**: 互換性レイヤーの削除とマークダウン変換処理の一元化
- **影響範囲**: 
  - /media/utils/markdownConverter.js ← 削除対象（互換性レイヤー）
  - /media/utils/simpleMarkdownConverter.js ← 維持対象（実装本体）
  - /media/state/stateManager.js ← 参照更新必要
  - /media/fileViewer/fileViewer.js ← 新名称のファイル
  - /media/components/markdownViewer/markdownViewer.js ← 影響なし（既に移行済み）
- **タスク**:
  1. **T3.1**: markdownConverter.jsの削除と参照更新
     - 対象: /media/utils/markdownConverter.js および参照元
     - 実装: 
       - state/stateManager.jsのインポートをsimpleMarkdownConverter.jsに更新
       - markdownConverter.jsを削除
       - 確認のためにビルドと動作テストを実行

- **検証ポイント**:
  - markdownConverter.jsが削除されてもstateManagerが正常に動作すること
  - FileViewerとScopeManagerのマークダウン表示が両方正しく動作すること
  - 特殊な書式や拡張機能がそれぞれのビューワーで正常に機能すること

### フェーズ4: 未使用TypeScriptコンポーネントの削除
- **目標**: 不要なTypeScriptコンポーネントを削除
- **影響範囲**: src/ui/内の未使用コンポーネント
- **タスク**:
  1. **T4.1**: MarkdownViewerPanelのFileViewerPanelへのリネーム
     - 対象: /src/ui/markdownViewer/MarkdownViewerPanel.ts
     - 実装: 
       - /src/ui/fileViewer/FileViewerPanel.tsにリネーム
       - クラス名やコメントなどの更新

  2. **T4.2**: コマンドの更新
     - 対象: /src/commands/markdownViewerCommands.ts
     - 実装: 
       - /src/commands/fileViewerCommands.tsにリネーム
       - コマンド名やパス参照の更新

  3. **T4.3**: DashboardPanelの削除
     - 対象: /src/ui/dashboard/DashboardPanel.ts及びディレクトリ
     - 実装: ファイルとディレクトリの削除

  4. **T4.4**: EnvironmentVariablesAssistantPanelの削除
     - 対象: /src/ui/environmentVariablesAssistant/EnvironmentVariablesAssistantPanel.ts及びディレクトリ
     - 実装: ファイルとディレクトリの削除

  5. **T4.5**: simpleChatコンポーネントの削除
     - 対象: /src/ui/simpleChat.ts
     - 実装: ファイルの削除

  6. **T4.6**: ReferenceManagerPanelの削除
     - 対象: /src/ui/referenceManager/ReferenceManagerPanel.ts及びディレクトリ
     - 実装: ファイルとディレクトリの削除

  7. **T4.7**: SimpleMockupEditorPanelの削除
     - 対象: /src/ui/mockupEditor/SimpleMockupEditorPanel.ts及びディレクトリ
     - 実装: ファイルとディレクトリの削除

  8. **T4.8**: ClaudeMdEditorPanelの削除
     - 対象: /src/ui/claudeMd/ClaudeMdEditorPanel.ts及びディレクトリ
     - 実装: ファイルとディレクトリの削除

  9. **T4.9**: DebugDetectivePanelの削除
     - 対象: /src/ui/debugDetective/DebugDetectivePanel.ts及びディレクトリ
     - 実装: ファイルとディレクトリの削除

- **検証ポイント**:
  - TypeScriptのコンパイルエラーが発生しないこと
  - FileViewerパネルが正常に動作すること
  - ScopeManagerからのリンクが正常に機能すること
  - 拡張機能全体が正常に動作すること

### フェーズ5: エントリーポイントの最適化
- **目標**: scopeManager.jsをエントリーポイントとして最小化
- **影響範囲**: /media/scopeManager.js
- **タスク**:
  1. **T5.1**: 主要コードの抽出と最適化
     - 対象: /media/scopeManager.js
     - 実装: 
       - イベントリスナー設定と初期化コードのみ残す
       - 具体的な実装をコンポーネントに委譲

- **検証ポイント**:
  - WebViewの初期化が正常に行われること
  - すべてのコンポーネントが適切に連携動作すること

## 5. 期待される効果

### 5.1 コード整理の成果
- 総ファイル数: 30%削減 (不要ファイルの削除)
- コード行数: 25%削減 (共通化と未使用コンポーネントの削除)
- 名称の明確化: 同名だが別機能のファイルの区別が更に明確に

### 5.2 保守性向上
- 明確なコンポーネント境界と責任分担
- 一貫したディレクトリ構造
- 同名ファイルの機能的な区別が明確に
- 関連コードの集約による変更の容易化
- 未使用コードの削除による混乱の減少

### 5.3 拡張性改善
- 新しいコンポーネント追加の容易化
- コンポーネント間の疎結合化によるテスト容易性
- イベントベースのアーキテクチャによる柔軟な機能拡張

## 6. リスクと対策

### 6.1 潜在的リスク
- コンポーネント間連携の崩壊
- ScopeManagerPanel.tsからの参照問題
- タイミング依存の隠れたバグの顕在化
- 未使用コンポーネント削除による間接的依存関係への影響

### 6.2 対策
- 段階的な変更実施と各フェーズ後の徹底検証
- コンポーネント変更前後の動作比較
- Gitのブランチを使用した安全な実験と検証
- ユーザー動作シミュレーションによる結合テスト
- 依存関係の徹底的な確認と段階的削除

## 7. 備考
- リファクタリング作業は、既存の「ScopeManagerPanel_分割リファクタリング計画.md」を参考にして進めることで、プロジェクト全体の方針と一貫性を保つ
- リファクタリングにおいては、機能を削除するのではなく、より良いコード構造に整理することを最優先する
- markdownViewerとFileViewerは別種のコンポーネントとして維持し、それぞれが単一責任を持つようにする
- マークダウン変換処理をsimpleMarkdownConverter.jsに一元化し、互換性レイヤーを削除する
- 共通ライブラリは共有しつつ、各コンポーネントの特性を活かした可読性の高い実装を目指す
- 未使用コンポーネント（dashboard、environmentVariablesAssistant、simpleChat、referenceManager、simpleMockupEditor、claudeMdEditor、debugDetective）は、対応するTypeScriptファイルを含めて完全に削除することで、コードベースを簡素化する
- accessibility.cssの削除が可能なのは、このスタイルシートを参照している全てのCSSファイル（debugDetective.css、environmentVariablesAssistant.css、dashboard.css）も削除対象であるため