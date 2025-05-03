 ScopeManager.js リファクタリング計画

  1. 全体アーキテクチャ

  リファクタリング後のアーキテクチャは以下のようになります：

  media/
    scopeManager.js (エントリーポイント/初期化)
    components/
      tabManager/
        tabManager.js (タブ管理)
      projectNavigation/
        projectNavigation.js (プロジェクトナビゲーション)
      markdownViewer/
        markdownViewer.js (マークダウン表示)
      dialogManager/
        dialogManager.js (ダイアログ管理)
      sharingPanel.js (共有パネル - 既存)
    state/
      stateManager.js (状態管理)
    utils/
      messageHandler.js (メッセージ処理)
      markdownConverter.js (マークダウン変換)
      uiHelpers.js (UI補助機能)

  2. 分割の基本方針

  1. モジュール間通信:
    - VSCodeとの通信は messageHandler.js に集約
    - モジュール間の通信はカスタムイベントを使用
  2. 状態管理:
    - VSCode Webviewの状態管理は stateManager.js に集約
    - 各モジュールは自身に関連する状態のみにアクセス
  3. 依存関係:
    - メインの scopeManager.js から各モジュールを初期化
    - サイクル依存を避けるため上位から下位への依存関係のみを許可
  4. インターフェース:
    - 各モジュールは明確なパブリックAPIを持つ
    - モジュール内部の実装の詳細は隠蔽

  3. 各モジュールの詳細

  3.1 stateManager.js

  - 責務:
    - VSCode Webviewの状態保存・復元
    - 統一された状態アクセスAPI提供
  - インターフェース:
  // 状態管理
  StateManager.get(key, defaultValue)
  StateManager.set(key, value)
  StateManager.update(partialState)
  StateManager.observe(key, callback)
  StateManager.getAll()

  3.2 messageHandler.js

  - 責務:
    - VSCodeとの通信統括
    - メッセージ送受信処理
    - イベント変換・配信
  - インターフェース:
  // メッセージ送信
  MessageHandler.postMessage(command, data)
  MessageHandler.registerCommandHandler(command, handler)
  MessageHandler.onCommand(command, callback)

  3.3 tabManager.js

  - 責務:
    - タブ切り替え処理
    - タブ状態の管理
  - インターフェース:
  // タブ管理
  TabManager.initialize()
  TabManager.selectTab(tabId, notifyServer)
  TabManager.onTabChanged(callback)

  3.4 projectNavigation.js

  - 責務:
    - プロジェクトリスト表示
    - プロジェクト選択処理
    - プロジェクト作成・削除UI
  - インターフェース:
  // プロジェクトナビゲーション
  ProjectNavigation.initialize()
  ProjectNavigation.updateProjects(projects, activeProject)
  ProjectNavigation.onProjectSelected(callback)

  3.5 markdownViewer.js

  - 責務:
    - マークダウン表示
    - マークダウン変換
    - マークダウン操作
  - インターフェース:
  // マークダウン表示
  MarkdownViewer.initialize()
  MarkdownViewer.displayContent(markdownContent)
  MarkdownViewer.setupCheckboxHandlers()

  3.6 dialogManager.js

  - 責務:
    - モーダルダイアログ表示
    - 通知表示
  - インターフェース:
  // ダイアログ管理
  DialogManager.showModal(title, content, buttons)
  DialogManager.showTerminalModeDialog(url, name, index)
  DialogManager.showError(message)
  DialogManager.showSuccess(message)

  4. リファクタリング実施手順

  フェーズ1: 基盤モジュールの作成

  1. components, state, utils ディレクトリを作成
  2. stateManager.js を実装（最も基本的なモジュール）
  3. messageHandler.js を実装（通信レイヤー）

  フェーズ2: UIモジュールの作成

  4. tabManager.js を実装
  5. dialogManager.js を実装
  6. markdownViewer.js を実装
  7. projectNavigation.js を実装

  フェーズ3: 統合と最適化

  8. scopeManager.js のメインファイルを更新
  9. 不要なコードの削除と最適化
  10. 統合テスト

  5. モジュール間通信の詳細

  カスタムイベントを使用したパブサブパターンを実装します。

  // messageHandler.js 内にイベントバス機能を実装
  const EventBus = {
    events: {},
    subscribe(event, callback) {
      if (!this.events[event]) this.events[event] = [];
      this.events[event].push(callback);
      return () => this.unsubscribe(event, callback);
    },
    publish(event, data) {
      if (!this.events[event]) return;
      this.events[event].forEach(callback => callback(data));
    },
    unsubscribe(event, callback) {
      if (!this.events[event]) return;
      this.events[event] = this.events[event].filter(cb => cb !==
  callback);
    }
  };

  // 使用例
  MessageHandler.onEvent = EventBus.subscribe.bind(EventBus);
  MessageHandler.emitEvent = EventBus.publish.bind(EventBus);

  6. メインファイル構造

  メインファイル（scopeManager.js）は以下のようになります：

  // @ts-check

  // VSCode API取得
  const vscode = acquireVsCodeApi();

  // 各モジュールのインポート
  import { StateManager } from './state/stateManager.js';
  import { MessageHandler } from './utils/messageHandler.js';
  import { TabManager } from './components/tabManager/tabManager.js';
  import { MarkdownViewer } from
  './components/markdownViewer/markdownViewer.js';
  import { ProjectNavigation } from
  './components/projectNavigation/projectNavigation.js';
  import { DialogManager } from
  './components/dialogManager/dialogManager.js';

  // 初期化メイン処理
  document.addEventListener('DOMContentLoaded', () => {
    // モジュールの初期化順序は依存関係に基づく
    // 1. 状態管理の初期化
    StateManager.initialize(vscode);

    // 2. メッセージハンドラーの初期化
    MessageHandler.initialize(vscode);

    // 3. UIコンポーネントの初期化
    DialogManager.initialize();
    TabManager.initialize();
    MarkdownViewer.initialize();
    ProjectNavigation.initialize();

    // 4. 初期化メッセージの送信
    MessageHandler.postMessage('initialize');
  });

  この計画に基づいて、各モジュールを順次実装していきます。

⏺ Update Todos
  ⎿  ☒ 分析：scopeManager.jsの機能と責務の理解
     ☒ 分離可能なコンポーネントと依存関係の特定
     ☒ リファクタリング計画と分割方針の作成
     ☐ モジュール用のディレクトリ構造を作成
     ☐ StateManager.jsモジュールの作成
     ☐ MessageHandler.jsモジュールの作成
     ☐ TabManager.jsモジュールの作成
     ☐ DialogManager.jsモジュールの作成
     ☐ MarkdownViewer.jsモジュールの作成
     ☐ ProjectNavigation.jsモジュールの作成
     ☐ scopeManager.jsのメインファイル更新
     ☐ 分割されたモジュールの統合テスト
