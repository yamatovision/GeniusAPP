# AppGenius開発方法論 - 拡張性を最優先したコンポーネント指向アプローチ

## 概要

本ドキュメントでは、ScopeManagerリファクタリングの経験を活かした改善版の開発プロセスとシステム設計方法論を解説します。このアプローチは特に、初期設計段階から拡張性とメンテナンス性を考慮した構造設計を取り入れることで、後のリファクタリングの必要性を大幅に削減し、持続可能な開発を実現します。

## 1. 開発プロセスの全体像 - 改善版

複数AIエージェントによる開発は、以下のステップで進められます（改善点は **太字** で強調）：

```
#1: 要件定義をAIと決める
#2: 基本的なシステムアーキテクチャを設計
    ** 2.1: コンポーネント責任分離の設計（NEW） **
    ** 2.2: 状態管理とイベント処理の設計（NEW） **
#3: モックアップを作成し要件定義をさらに固める
    ** 3.1: コンポーネント単位のモックアップ構造化（NEW） **
#4: 技術スタックとインフラを選定
#5: データモデルを詳細に設計
    ** 5.1: エンティティ間の依存関係と責任境界の明確化（NEW） **
#6: 環境変数を設定し実際のエンドポイントと接続する基盤を作る
#7: 認証システムの実装と初期デプロイ
#8: CI/CDパイプラインとテスト環境の構築

【反復開発サイクル - 機能ごとに繰り返し】
#9: 実装優先順位に基づく次の機能スコープ選定
    ** 9.1: 機能のコンポーネント分解計画（NEW） **
    ** 9.2: インターフェース設計と責任境界の定義（NEW） **
#10: 機能のテストケース作成
#11: 機能の実装（バックエンド→フロントエンド統合）
    ** 11.1: コンポーネント間通信の実装（NEW） **
#12: テスト実行とデバッグ
#13: 機能をCICD経由でステージング環境にデプロイ
#14: 機能完了後のGitHubへのマージと文書更新
#15: #9に戻り次の機能へ

【プロジェクト完了フェーズ】
#16: 最終的な統合テストと品質保証
#17: 本番環境へのデプロイと引き継ぎ文書作成
```

## 2. コンポーネント指向設計の核心原則

ScopeManagerのリファクタリング経験から学んだ、初期設計段階から適用すべき核心原則：

### 2.1 単一責任の原則

各コンポーネントは明確に定義された単一の責任を持ち、その責任のためだけに変更される必要があります。

**実践ガイドライン**:
- コンポーネントごとに明示的な責任文書を作成（一文で表現できるのが理想）
- 一つのコンポーネントは500行を超えない
- 一つの関数やメソッドは50行を超えない
- 複数の責任が見つかった場合は迷わず分割

### 2.2 構造的分離の標準パターン

すべてのUIコンポーネントとバックエンド機能は、以下の観点で明確に分離します：

1. **状態管理（State）**: データとその操作を担当
2. **イベント処理（Events）**: ユーザー操作や外部イベントのハンドリング
3. **表示ロジック（UI/Rendering）**: 状態に基づく表示の更新
4. **メッセージ処理（Communication）**: 外部との通信

**実践ガイドライン**:
```
components/
├── feature/                      # 機能名
│   ├── state/                    # 状態管理
│   │   └── featureState.js       # 状態定義と操作
│   ├── events/                   # イベント処理
│   │   └── featureEvents.js      # イベントハンドラー
│   ├── ui/                       # UI表示コンポーネント
│   │   └── FeatureComponent.js   # 表示ロジック
│   └── messages/                 # メッセージ処理
│       └── featureMessages.js    # 通信処理
```

### 2.3 依存関係の明示的管理

コンポーネント間の依存関係は常に明示的に定義し、循環依存を完全に排除します。

**実践ガイドライン**:
- 依存関係グラフを作成し、常に更新
- 上位コンポーネントから下位コンポーネントへの明確な方向性を維持
- コンポーネント間の通信はイベント、メッセージング、または明示的なインターフェースを通じて行う
- 共有状態への依存は最小限にする

### 2.4 インターフェースによる疎結合

各コンポーネントは明確なインターフェースを通じてのみ他のコンポーネントと相互作用します。

**実践ガイドライン**:
- 各コンポーネントは公開APIを文書化（TypeScriptの型定義が理想的）
- 実装の詳細は内部に隠蔽
- テスト可能性を高めるためのモック可能なインターフェース設計
- 変更の影響範囲を限定するための契約ベース設計

## 3. 標準ディレクトリ構造と設計パターン

### 3.1 フロントエンドの標準構造

```
frontend/
├── src/
│   ├── components/               # 共通UIコンポーネント
│   │   ├── common/               # アプリ全体で再利用可能なコンポーネント
│   │   │   ├── Button/
│   │   │   │   ├── Button.js     # コンポーネント実装
│   │   │   │   ├── Button.css    # スタイル
│   │   │   │   └── Button.test.js # テスト
│   │   │   └── ...
│   │   └── feature/              # 特定機能向けコンポーネント
│   │       ├── state/            # 状態管理
│   │       ├── events/           # イベント処理
│   │       ├── ui/               # UI表示
│   │       └── messages/         # 通信処理
│   ├── pages/                    # ページコンポーネント
│   │   └── [PageName]/           # 特定ページ
│   │       ├── index.js          # ページエントリーポイント
│   │       └── components/       # ページ固有コンポーネント
│   ├── services/                 # サービスレイヤー
│   │   ├── api/                  # API通信
│   │   └── state/                # グローバル状態管理
│   ├── utils/                    # ユーティリティ関数
│   └── App.js                    # アプリルートコンポーネント
```

### 3.2 バックエンドの標準構造

```
backend/
├── src/
│   ├── domains/                  # ドメイン別の機能グループ
│   │   ├── auth/                 # 認証関連の機能
│   │   │   ├── controllers/      # リクエスト処理
│   │   │   ├── services/         # ビジネスロジック
│   │   │   ├── models/           # データモデル
│   │   │   └── routes/           # ルート定義
│   │   └── [domain-name]/        # 他のドメイン
│   ├── middleware/               # ミドルウェア
│   ├── utils/                    # ユーティリティ関数
│   ├── config/                   # 設定
│   └── app.js                    # アプリケーションエントリーポイント
```

## 4. ディレクトリ・ファイル命名規約

### 4.1 一般原則

- **一貫性の維持**: プロジェクト全体で同じ命名パターンを使用
- **具体的な名前**: 抽象的な名前（util, manager, handler）ではなく具体的な責任を示す名前
- **単数形と複数形**: ディレクトリは複数形、具体的なファイルは単数形
- **自己説明的**: ファイル名だけで内容が理解できるようにする

### 4.2 フロントエンド命名規則

- **コンポーネント**: PascalCase (例: `Button.js`, `UserCard.js`)
- **コンテナ/ページ**: PascalCase + Page/Container (例: `LoginPage.js`, `UserListContainer.js`)
- **カスタムフック**: use + 機能名 (例: `useAuth.js`, `useForm.js`)
- **コンテキスト**: 機能名 + Context (例: `AuthContext.js`, `ThemeContext.js`)
- **サービス**: 機能名 + Service (例: `authService.js`, `dataService.js`)
- **ユーティリティ**: 機能を示す名詞/動詞 (例: `formatDate.js`, `validator.js`)

### 4.3 バックエンド命名規則

- **コントローラー**: 名詞 + Controller (例: `userController.js`, `authController.js`)
- **サービス**: 名詞 + Service (例: `userService.js`, `emailService.js`)
- **モデル**: 単数名詞 (例: `User.js`, `Product.js`)
- **ルート**: 名詞 + Routes (例: `userRoutes.js`, `authRoutes.js`)
- **ミドルウェア**: 機能 + Middleware (例: `authMiddleware.js`, `loggingMiddleware.js`)

## 5. システム内部通信規約

### 5.1 イベントベース通信

コンポーネント間の疎結合を実現するために、イベントベースの通信パターンを標準として採用します。

**実装例**:
```javascript
// 状態変更を通知するイベント発行
const eventEmitter = {
  events: {},
  subscribe(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => this.unsubscribe(event, callback);
  },
  unsubscribe(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  },
  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
};

// 使用例
// 状態管理コンポーネント内
function updateState(newState) {
  state = { ...state, ...newState };
  eventEmitter.emit('state:updated', state);
}

// UIコンポーネント内
useEffect(() => {
  const unsubscribe = eventEmitter.subscribe('state:updated', handleStateUpdate);
  return unsubscribe;
}, []);
```

### 5.2 明示的な状態管理

状態は中央管理され、コンポーネントは明示的なAPIを通じてのみ状態を変更できます。

**実装例**:
```javascript
// 状態管理サービス
const stateManager = {
  state: initialState,
  listeners: new Map(),
  
  getState() {
    return this.state;
  },
  
  setState(newState, notify = true) {
    this.state = { ...this.state, ...newState };
    
    if (notify) {
      this._notifyListeners();
    }
    
    return this.state;
  },
  
  addStateChangeListener(listener) {
    const id = Date.now().toString();
    this.listeners.set(id, listener);
    return id;
  },
  
  removeStateChangeListener(id) {
    return this.listeners.delete(id);
  },
  
  _notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('リスナーエラー:', error);
      }
    });
  }
};
```

### 5.3 メッセージングアーキテクチャ

外部システム（バックエンド、拡張機能API等）との通信は専用のメッセージハンドラーを使用します。

**実装例**:
```javascript
// メッセージハンドラー
class MessageHandler {
  constructor() {
    this.handlers = new Map();
    this._setupMessageListener();
  }
  
  registerHandler(command, handler) {
    this.handlers.set(command, handler);
  }
  
  _setupMessageListener() {
    window.addEventListener('message', event => {
      const message = event.data;
      const handler = this.handlers.get(message.command);
      
      if (handler) {
        try {
          handler(message);
        } catch (error) {
          console.error(`メッセージ処理エラー: ${message.command}`, error);
        }
      }
    });
  }
  
  sendMessage(command, data = {}) {
    // 外部システムへメッセージ送信
    window.parent.postMessage({
      command,
      ...data
    }, '*');
  }
}
```

## 6. 状態管理ライフサイクル

### 6.1 状態の初期化

コンポーネントの初期化順序と状態ロードの流れは明示的に定義します。

**実装例**:
```javascript
// アプリケーション起動時の状態初期化
function initializeApp() {
  // 1. 保存された状態の復元を試みる
  const savedState = localStorage.getItem('appState');
  let initialState = defaultState;
  
  if (savedState) {
    try {
      initialState = { ...initialState, ...JSON.parse(savedState) };
    } catch (e) {
      console.error('状態の復元に失敗:', e);
    }
  }
  
  // 2. 状態管理の初期化
  stateManager.setState(initialState, false);
  
  // 3. 必要なサービスの初期化
  authService.initialize();
  dataService.initialize();
  
  // 4. UIコンポーネントの初期化
  renderApp();
  
  // 5. 初期化完了イベントの発行
  eventEmitter.emit('app:initialized', { timestamp: Date.now() });
}
```

### 6.2 状態の保存と復元

状態の永続化と復元のメカニズムを標準化します。

**実装例**:
```javascript
// 状態の自動保存
function setupStatePersistence() {
  // 状態変更をリッスン
  stateManager.addStateChangeListener(state => {
    // 保存が必要な状態のみを抽出
    const stateToSave = {
      currentTab: state.currentTab,
      preferences: state.preferences,
      // セッション固有やセキュアな情報は除外
    };
    
    // ローカルストレージに保存
    try {
      localStorage.setItem('appState', JSON.stringify(stateToSave));
    } catch (e) {
      console.error('状態の保存に失敗:', e);
    }
  });
}
```

## 7. ファイルサイズとコード複雑性の制限

### 7.1 ファイルサイズ制限

- **コンポーネントファイル**: 最大300行
- **サービスファイル**: 最大500行
- **ユーティリティファイル**: 最大200行

### 7.2 関数・メソッドサイズ制限

- **一般的な関数**: 最大30行
- **複雑なロジック関数**: 最大50行
- **イベントハンドラ**: 最大20行

### 7.3 複雑性制限

- **循環的複雑度（サイクロマティック複雑性）**: 最大10
- **ネストレベル**: 最大3
- **パラメータ数**: 最大4つ

## 8. 機能分解と実装戦略

### 8.1 垂直スライス方式の実装

機能は「垂直スライス」として実装し、バックエンドからフロントエンドまでの完全なスタックを一度に実装します。

**実装ステップ**:
1. データモデルの定義
2. バックエンドサービスの実装
3. バックエンドコントローラの実装
4. APIエンドポイントの接続
5. フロントエンドサービス層の実装
6. フロントエンドUIコンポーネントの実装
7. 統合テストの実施

### 8.2 コンポーネント間境界の設計

コンポーネント間の明確な境界と通信契約を設計します。

**設計ドキュメント例**:
```
コンポーネント: UserManager
責任: ユーザー情報の表示と基本操作

公開API:
- initialize(): void - コンポーネントの初期化
- setUser(user: User): void - 表示するユーザーの設定
- refreshUserData(): Promise<void> - ユーザーデータの再取得

購読イベント:
- 'auth:user-changed' - ユーザー情報変更時に更新
- 'permissions:changed' - 権限変更時にUIを更新

発行イベント:
- 'user:profile-updated' - プロフィール更新時に発行
- 'user:preferences-changed' - 設定変更時に発行

依存コンポーネント:
- AuthService - ユーザー認証情報の取得
- UserAPI - ユーザーデータの取得と更新
```

## 9. コンポーネント開発ライフサイクル

各コンポーネントは以下のライフサイクルステージに従って開発します：

### 9.1 設計段階

1. **責任の明確化**: コンポーネントの単一責任を明確に定義
2. **インターフェース設計**: 公開APIを設計
3. **状態設計**: 内部状態とライフサイクルの定義
4. **依存関係の特定**: 必要な他コンポーネントとサービスの特定

### 9.2 実装段階

1. **骨格実装**: 基本構造と公開APIの実装
2. **状態管理実装**: 内部状態と変更ロジックの実装
3. **イベントハンドリング**: イベント処理とリスナーの実装
4. **UIレンダリング**: 表示ロジックの実装
5. **メッセージング**: 外部通信の実装

### 9.3 検証段階

1. **単体テスト**: コンポーネント単独のテスト
2. **統合テスト**: 他コンポーネントとの連携テスト
3. **パフォーマンステスト**: 効率性と応答性の検証

## 10. リファクタリングの必要性判断

以下の兆候が見られる場合、プロアクティブなリファクタリングを検討します：

1. **サイズ肥大化**: ファイルサイズが制限に近づいている
2. **責任の拡大**: 単一責任を超えた機能が追加されている
3. **密結合の出現**: 他コンポーネントとの結合度が高まっている
4. **変更の困難さ**: 小さな変更に多くの修正が必要になっている
5. **テストの複雑化**: テストが複雑になり、カバレッジが低下している

## 11. 重要な実装ガイドライン

1. **早期分割の原則**: 「後で分割する」は禁句。肥大化する前に分割する
2. **明示的な依存**: 暗黙的な依存関係を作らない
3. **一方向データフロー**: 状態変更は常に一方向に流れるようにする
4. **契約ベース設計**: 実装よりもインターフェースを重視する
5. **テスト駆動開発**: コンポーネントの実装前にテストを作成する

## 12. ディレクトリ構造移行パターン

既存の単一ファイルを適切な構造に移行する標準パターン:

1. **ファイル内の責任特定**:
   - UI表示ロジック（JSX/HTMLレンダリング部分）
   - 状態管理ロジック（state, setState, useStateなど）
   - イベント処理ロジック（クリックハンドラーなど）
   - 通信ロジック（API呼び出し、メッセージングなど）

2. **ディレクトリ構造作成**:
   ```
   components/
   └── feature/
       ├── state/
       │   └── featureState.js
       ├── events/
       │   └── featureEvents.js
       ├── ui/
       │   └── FeatureComponent.js
       └── messages/
           └── featureMessages.js
   ```

3. **エントリーポイント作成**:
   ```javascript
   // components/feature/index.js
   import { initializeState } from './state/featureState.js';
   import { setupEventHandlers } from './events/featureEvents.js';
   import FeatureComponent from './ui/FeatureComponent.js';
   import { setupMessageHandlers } from './messages/featureMessages.js';

   export function initialize() {
     initializeState();
     setupEventHandlers();
     setupMessageHandlers();
   }

   export { FeatureComponent };
   ```

## 13. 実行ステップ

以上の原則と構造を適用するための具体的なステップ：

1. **コンポーネント責任マッピング**:
   - 既存コードの責任を特定
   - 最適な分離境界を決定
   - 責任ごとにコンポーネントを計画

2. **ディレクトリ構造設計**:
   - 標準構造に基づくディレクトリ計画
   - 移行パスの設計

3. **段階的実装**:
   - コアサービス（状態管理、メッセージング）を先に実装
   - コンポーネントの骨格を実装
   - 既存コードを新構造に段階的に移行

4. **継続的検証**:
   - 各ステップでの検証
   - テストカバレッジの確保

## 14. 結論

ScopeManagerリファクタリングの経験から学んだ教訓を活かし、初期設計段階から単一責任の原則とコンポーネント指向アーキテクチャを採用することで、将来的なリファクタリングの必要性を大幅に削減し、持続可能な開発を実現します。

「後でリファクタリングする」のではなく、「最初から正しく設計する」アプローチこそが、長期的には最も効率的かつ持続可能な開発を可能にします。