# 環境変数アシスタント要件定義

## 概要

環境変数アシスタントは、プログラミング知識がない非技術者（「おばちゃんでも」）が安全かつ簡単に環境変数を設定できるツールです。VSCodeとClaudeCodeを連携させ、AIが実際のUI状態を正確に把握し、ユーザーを手助けするだけでなく、可能な限り自動化することで環境変数設定の複雑さを解消します。

## 核心コンセプト

**「AIと実際のUIのギャップをなくし、おばちゃんでも環境変数が設定できる」**

従来のAIアシスタントでは「ここをクリックしてください」と言われても、実際の画面では該当する要素がなかったり、違う場所にあったりして混乱が生じます。本アシスタントでは、リアルタイムのUI情報をファイルとしてClaudeCodeと共有することで、この問題を解決します。

## 主要機能

### 1. リアルタイムUI情報共有システム

- **DOM構造ファイル出力機能**: 
  - 環境変数アシスタント起動時に現在のDOM構造を自動的に取得
  - `.claude_ui_data/dom_structure.json`として保存
  - UI変更時に構造を自動更新（3秒ごとなど）

- **UI要素マッピング**:
  - 主要UI要素に固有ID/クラス割り当て
  - 操作可能なボタン、入力フィールドの自動検出
  - 各要素の状態（有効/無効/変更済み）を構造化データとして保存

- **スクリーンショット機能**:
  - 現在のUI状態のスクリーンショットを自動取得
  - `.claude_ui_data/screenshots/`フォルダに保存
  - タイムスタンプ付きで履歴管理

### 2. 自動環境変数検出・設定

- **コード分析による必要変数検出**:
  - プロジェクトコードを自動スキャン
  - 使用中のフレームワーク/ライブラリを検出
  - 必要な環境変数のリストを自動生成し`.claude_ui_data/env_variables.json`に保存

- **ワンクリック設定**:
  - 「自動設定」ボタンで標準的な値を自動入力
  - セキュアな値の自動生成（APIキー、シークレットなど）
  - データベース接続文字列など複雑な値の自動構築

- **設定テンプレート**:
  - 一般的なフレームワーク用の設定テンプレート
  - 業界標準のベストプラクティスに基づいた推奨値
  - プロジェクトタイプ（Web/モバイル/データ分析など）別の設定

### 3. VSCode操作支援機能

- **UI操作自動化**:
  - ClaudeCodeからの操作指示ファイル`.claude_ui_data/actions.json`の監視
  - 指示に基づくUI要素の自動クリック・入力・選択
  - 操作結果の`.claude_ui_data/action_results.json`への書き込み

- **視覚的ガイダンス**:
  - 画面上の操作箇所を視覚的に強調表示
  - UIへのオーバーレイでの矢印・指示表示
  - 操作手順のステップバイステップ表示

- **音声ガイダンス**:
  - 重要な手順は音声で説明（オプション）
  - シンプルな言葉で専門用語を解説
  - 次のステップを明確に指示

### 4. ワンクリック検証・トラブルシューティング

- **自動接続テスト**:
  - データベース、API、サービス接続の自動検証
  - 「テスト実行」ボタン1つで全設定を検証
  - 結果を視覚的に表示（成功/失敗/警告）

- **CURRENT_STATUS.md統合**:
  - 環境変数の設定状態をCURRENT_STATUS.mdの環境変数セクションに反映
  - 設定完了した変数は [x] マークに更新
  - プロジェクト進捗と環境変数設定状況を一元管理

- **問題の自動修正**:
  - 一般的な問題を自動検出・修正
  - 「自動修正」ボタンでAIが推奨修正を適用
  - 修正内容を非技術者にもわかる言葉で説明

- **ガイド付きトラブルシューティング**:
  - 問題発生時に段階的な解決ガイド表示
  - スクリーンショットと矢印で操作箇所を明示
  - 必要に応じてAIによる自動操作の提案

## UI/UX設計

### ワンクリックスタート画面

1. **シンプルな初期画面**
   - 大きな「環境変数を自動設定」ボタン
   - 「手動設定を開始」の選択肢も提供
   - 現在のプロジェクト名と状態を表示

2. **自動検出結果画面**
   - 検出された必要環境変数のリスト
   - 各変数の横に「自動設定」チェックボックス（デフォルトオン）
   - 「すべて自動設定する」大型ボタン

### 視覚的フィードバック

1. **直感的なステータス表示**
   - 緑色のチェックマーク: 設定完了・検証済み（CURRENT_STATUS.mdでは [x]）
   - 黄色の注意アイコン: 使用確認済み・未検証（CURRENT_STATUS.mdでは [!]）
   - 赤色の警告アイコン: 未設定または無効な設定（CURRENT_STATUS.mdでは [ ]）
   - 進行中の操作はアニメーションで明示

2. **シンプルな説明**
   - 専門用語を避けた平易な表現（「APIキー」→「サービス接続用の特別なパスワード」）
   - 画像やアイコンを活用した視覚的な説明
   - 「これは何？」ボタンで詳細説明へアクセス

### アシスタントパネル

1. **AIガイド表示エリア**
   - 現在の操作に関するシンプルな説明
   - 実際の画面上に矢印や枠で操作箇所を強調
   - 「次へ」「戻る」で手順をステップバイステップで進行

2. **自動操作コントロール**
   - 「AIに任せる」ボタン：次の数ステップを自動実行
   - 「ストップ」ボタン：自動操作を一時停止
   - 「やり直す」ボタン：直前の操作をやり直し

## データモデルと構造

### ClaudeCode共有データ構造

```typescript
// .claude_ui_data/dom_structure.json
interface DOMSnapshot {
  timestamp: number;        // スナップショット取得時刻
  elements: UIElement[];    // UI要素の配列
  activeElementId?: string; // 現在フォーカスのある要素ID
  viewport: {               // 表示領域サイズ
    width: number;
    height: number;
  };
  currentScreenshot: string; // 最新のスクリーンショットファイル名
}

interface UIElement {
  id: string;               // 要素の一意識別子
  type: string;             // ボタン、入力欄、選択肢など
  text: string;             // 表示テキスト
  isVisible: boolean;       // 表示/非表示状態
  isEnabled: boolean;       // 有効/無効状態
  rect: {                   // 画面上の位置情報
    top: number;
    left: number;
    width: number;
    height: number;
  };
  parentId?: string;        // 親要素ID
  childIds: string[];       // 子要素IDリスト
  attributes: {             // その他属性
    [key: string]: string;
  };
  value?: string;           // 入力要素の場合の現在値
}

// .claude_ui_data/actions.json
interface UIActionRequest {
  requestId: string;        // リクエスト識別子
  timestamp: number;        // リクエスト時刻
  actions: UIAction[];      // 実行すべきアクション
  timeout?: number;         // タイムアウト時間（ミリ秒）
}

interface UIAction {
  type: 'click' | 'input' | 'select' | 'scroll' | 'wait';
  targetElementId?: string; // 操作対象要素ID
  altTargetSelector?: string; // 代替セレクタ（ID見つからない場合）
  value?: string;           // 入力値など
  description: string;      // 操作の説明（ユーザー表示/ログ用）
}

// .claude_ui_data/action_results.json
interface UIActionResult {
  requestId: string;        // 対応するリクエスト識別子
  timestamp: number;        // 結果生成時刻
  success: boolean;         // 成功/失敗
  actions: {
    index: number;          // アクションのインデックス
    success: boolean;       // 個別アクションの成功/失敗
    errorMessage?: string;  // エラーメッセージ
    screenshot?: string;    // 実行後のスクリーンショットファイル名
  }[];
  newDOMSnapshot: boolean;  // 新しいDOMスナップショットが利用可能か
}
```

### 環境変数モデル

```typescript
// .claude_ui_data/env_variables.json
interface EnvironmentVariableData {
  timestamp: number;        // 更新時刻
  variables: EnvironmentVariable[];
  groups: EnvironmentVariableGroup[];
  progress: {
    total: number;
    configured: number;
    requiredTotal: number;
    requiredConfigured: number;
  };
}

interface EnvironmentVariable {
  // 基本情報
  name: string;           // 環境変数名
  value: string;          // 値（マスク処理済み場合あり）
  description: string;    // 平易な言葉での説明
  technicalDescription?: string;  // 技術的な説明（詳細表示用）
  isRequired: boolean;    // 必須か任意か
  
  // 自動化情報
  autoDetected: boolean;  // 自動検出されたかどうか
  autoConfigurable: boolean; // 自動設定可能かどうか
  autoConfigured: boolean;   // 自動設定されたかどうか
  
  // 検証情報
  validationStatus: 'unknown' | 'valid' | 'invalid' | 'warning';
  validationMessage?: string;  // 検証結果メッセージ
  
  // セキュリティ設定
  isSensitive: boolean;      // 機密情報かどうか
  
  // グループ情報
  groupId: string;          // 所属グループID
}

interface EnvironmentVariableGroup {
  id: string;
  name: string;
  description: string;
  order: number;        // 表示順序
}
```

## 実装アーキテクチャ

### コンポーネント構成

1. **VSCode拡張（バックエンド）**
   - `src/ui/environmentVariablesAssistant/EnvironmentVariablesAssistantPanel.ts`
     - WebViewパネル管理
     - DOM構造のスナップショット取得機能
   - `src/services/EnvironmentVariableService.ts`
     - 環境変数の検出・管理・設定
   - `src/services/UIInteractionService.ts`
     - UI要素のマッピングとインタラクション処理
   - `src/utils/ClaudeDataExporter.ts`
     - ClaudeCode用データファイル出力機能

2. **WebView（フロントエンド）**
   - `media/environmentVariablesAssistant.js`
     - UI状態管理
     - DOM構造の変化監視
     - 自動操作実行機能
   - `media/environmentVariablesAssistant.css`
     - シンプルで直感的なUI設計

3. **共有データディレクトリ**
   - `.claude_ui_data/` - ClaudeCodeと共有するデータディレクトリ
     - `dom_structure.json` - DOM構造スナップショット
     - `env_variables.json` - 環境変数情報
     - `actions.json` - ClaudeCodeからの操作指示
     - `action_results.json` - 操作結果フィードバック
     - `screenshots/` - UI状態のスクリーンショット

### データフローと連携メカニズム

1. **初期化フェーズ**
   - 環境変数アシスタント起動
   - プロジェクト分析で必要な環境変数を検出
   - 初期DOMスナップショット取得・保存
   - 初期スクリーンショット保存

2. **ClaudeCode起動と連携**
   - ClaudeCodeの起動（通常のClaudeCode起動コマンド）
   - ClaudeCodeが`.claude_ui_data/`ディレクトリの情報を読み込み
   - 現在のUI状態の把握とガイダンス提供

3. **自動化連携フロー**
   - ClaudeCodeが`.claude_ui_data/actions.json`に操作指示を書き込み
   - 環境変数アシスタントが定期的（500ms間隔）にファイルを監視
   - 新しい操作指示を検出したら実行
   - 実行結果を`.claude_ui_data/action_results.json`に書き込み
   - DOM構造とスクリーンショットを更新

4. **完了フェーズ**
   - 環境変数設定完了後、.envファイル生成
   - 設定サマリーを`.claude_ui_data/env_summary.json`に出力
   - CURRENT_STATUS.mdの環境変数セクションを [x] マークで更新
   - ClaudeCodeに完了通知

## 実装詳細

### 1. ファイルベース連携の仕組み

- **ファイル監視メカニズム**
  ```typescript
  // VSCode拡張側での実装例
  const watchActions = () => {
    fs.watch('.claude_ui_data/actions.json', (eventType) => {
      if (eventType === 'change') {
        const actions = JSON.parse(fs.readFileSync('.claude_ui_data/actions.json', 'utf8'));
        executeActions(actions);
      }
    });
  };
  ```

- **スナップショット生成**
  ```typescript
  // WebView側での実装例
  const captureDOMSnapshot = () => {
    const elements = [];
    document.querySelectorAll('[data-claude-id]').forEach(el => {
      elements.push({
        id: el.getAttribute('data-claude-id'),
        type: el.tagName.toLowerCase(),
        text: el.textContent,
        isVisible: isElementVisible(el),
        // 他の属性も同様に取得
      });
    });
    
    const snapshot = {
      timestamp: Date.now(),
      elements,
      activeElementId: document.activeElement?.getAttribute('data-claude-id'),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      currentScreenshot: `screenshot_${Date.now()}.png`
    };
    
    // VSCode APIでファイルに書き込む
    vscode.postMessage({
      command: 'saveDOMSnapshot',
      data: snapshot
    });
  };
  ```

### 2. UI操作の自動化実装

- **操作実行メカニズム**
  ```typescript
  // WebView側での実装例
  const executeAction = async (action) => {
    const { type, targetElementId, value } = action;
    const element = document.querySelector(`[data-claude-id="${targetElementId}"]`);
    
    if (!element) {
      return { success: false, errorMessage: 'Element not found' };
    }
    
    switch (type) {
      case 'click':
        element.click();
        return { success: true };
        
      case 'input':
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
        
      // 他のアクションタイプも同様に実装
    }
  };
  ```

### 3. 視覚的ガイダンス実装

- **オーバーレイ表示**
  ```typescript
  // WebView側での実装例
  const showGuidance = (elementId, message) => {
    const element = document.querySelector(`[data-claude-id="${elementId}"]`);
    if (!element) return;
    
    const rect = element.getBoundingClientRect();
    
    // ガイダンス要素を作成
    const overlay = document.createElement('div');
    overlay.className = 'guidance-overlay';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    
    const messageEl = document.createElement('div');
    messageEl.className = 'guidance-message';
    messageEl.textContent = message;
    
    document.body.appendChild(overlay);
    document.body.appendChild(messageEl);
    
    // アニメーション効果
    overlay.classList.add('pulse');
    
    // 一定時間後に除去
    setTimeout(() => {
      overlay.remove();
      messageEl.remove();
    }, 5000);
  };
  ```

## 実装ステップと優先順位

### フェーズ1: 基本機能（1-2週間）
1. VSCodeパネルとUI構築
2. DOM構造スナップショット機能の実装
3. `.claude_ui_data/`ディレクトリ構造の設計と実装
4. 基本的な環境変数検出機能

### フェーズ2: ファイル連携機能（1-2週間）
1. ClaudeCode用データ出力の完全実装
2. 操作指示ファイル監視メカニズム
3. スクリーンショット自動取得機能
4. 基本的なUI操作自動化

### フェーズ3: 自動化機能（2-3週間）
1. 環境変数の自動検出機能強化
2. 標準値の自動設定機能
3. シンプルなUI操作ガイダンス
4. .envファイル自動生成

### フェーズ4: ユーザー体験強化（2-3週間）
1. リアルタイム視覚的ガイダンス
2. 操作シーケンスの自動実行強化
3. 問題診断と修正提案
4. 非技術者向けユーザーテストと最適化

## 成功基準

- **おばちゃんテスト**: プログラミング経験のない50代以上の方が、説明10分以内で環境変数設定を完了できること
- **自動化率**: 一般的プロジェクトの環境変数設定の80%以上を全自動化
- **操作削減**: 従来の方法と比較して必要な操作を90%削減
- **エラー率**: 設定エラーの発生率を従来の10%以下に削減

## ユーザーシナリオ例

### シナリオ1: 完全自動モード
1. ユーザーが「環境変数アシスタント」を起動
2. 「自動設定」ボタンをクリック
3. AIがプロジェクトを分析し、必要な環境変数を検出
4. AIが安全な値を自動生成し、入力
5. 設定完了後、「接続テスト」が自動実行
6. すべて緑色チェックマークで完了
7. .envファイルが自動生成され保存

### シナリオ2: ガイド付き手動モード
1. ユーザーが「手動設定を開始」をクリック
2. AIが最初に設定すべき変数を選択し、説明表示
3. 画面上に矢印で入力欄を示し、「ここにデータベースのパスワードを入力してください」と案内
4. ユーザーが入力完了後、「次へ」をクリック
5. AIが次の変数の設定を同様にガイド
6. 最後に「すべてを保存」ボタンを示して完了案内

### シナリオ3: ClaudeCode自動操作モード
1. ユーザーが環境変数アシスタントを起動
2. 別ウィンドウでClaudeCodeを起動
3. ClaudeCodeが自動的に`.claude_ui_data/`の情報を読み込み
4. ユーザーがClaudeCodeに「環境変数を設定して」と指示
5. ClaudeCodeが`actions.json`に操作指示を書き込み
6. 環境変数アシスタントが自動的に操作を実行
7. 実行結果が`action_results.json`に書き込まれ、ClaudeCodeが確認
8. 一連の操作が完了するまで自動的に進行

## 制限事項と対策

1. **ファイル連携の同期性**
   - ファイル書き込み・読み取りのタイミング管理が重要
   - 操作リクエストにID付与で重複実行防止
   - ファイル監視の適切な間隔設定（パフォーマンスとレスポンス速度のバランス）

2. **セキュリティ考慮事項**
   - 機密情報は`.claude_ui_data/`ディレクトリに書き込まない設計
   - スクリーンショットから機密情報を自動マスク
   - `.claude_ui_data/`を`.gitignore`に自動追加

3. **UI変更への対応**
   - 静的なセレクタだけでなく、テキストや位置など複数の特徴で要素を特定
   - 操作失敗時の代替手段を用意（代替セレクタの利用）
   - 回復メカニズム実装（操作に失敗しても全体が停止しない）