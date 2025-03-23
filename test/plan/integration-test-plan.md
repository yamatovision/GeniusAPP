# AppGenius 統合テスト計画書

## 目的

この文書は、AppGeniusアプリケーションの統合テスト計画を詳述します。統合テストの目的は、複数のコンポーネントが連携して正しく動作することを確認し、モジュール間の相互作用に関する問題を早期に発見することです。

## テスト対象

### 1. 認証フロー

#### 1.1 基本認証フロー
- ユーザーログイン → トークン取得 → 認証状態反映
- ログアウト処理と状態クリア
- リフレッシュトークンによる自動延長

#### 1.2 分離認証モード
- ClaudeCode CLIとの認証連携
- モード切替時の動作
- トークン同期処理

### 2. 組織・ワークスペース管理

#### 2.1 組織管理
- 組織作成・編集・アーカイブの一連の流れ
- メンバー追加・削除・権限変更
- 組織間の切り替え

#### 2.2 ワークスペース管理
- ワークスペース作成・編集・アーカイブ
- メンバー管理とAPI連携
- 組織内でのワークスペース間連携

#### 2.3 APIキー管理
- キー一覧表示と状態管理
- キー更新と無効化フロー
- ワークスペースへのキー割り当て

### 3. 使用量管理とレポート

#### 3.1 使用量記録
- API呼び出し時のトークン記録
- 組織・ワークスペース別集計
- 月次/日次リセット処理

#### 3.2 ダッシュボード表示
- フィルタリングと集計表示
- グラフ生成と表示
- CSV出力機能

#### 3.3 予算管理
- 使用制限の設定と適用
- アラート通知処理
- 制限到達時の動作確認

## テスト方法

### テストフレームワーク
- **Mocha** - 統合テスト実行
- **Supertest** - APIテスト
- **Puppeteer/Playwright** - UIテスト
- **Sinon** - モック/スタブ/スパイ

### テスト環境
- **開発環境**: ローカルモック使用
- **テスト環境**: テスト用DBとAPI接続
- **ステージング環境**: 本番同等構成

### テストアプローチ

#### 1. API統合テスト
- エンドポイント間の連携確認
- リクエスト・レスポンス検証
- ステータスコードとエラー処理
- セッション維持とステート管理

#### 2. UI統合テスト
- 画面遷移フロー確認
- フォーム送信とデータ更新
- 権限による表示制御
- 非同期イベントとローディング状態

#### 3. エンドツーエンドテスト
- 実際のユーザーシナリオ実行
- バックエンドとフロントエンドの完全統合
- データの永続化確認

## テストケース例

### 認証フロー統合テスト

```typescript
describe('Authentication Flow', function() {
  let authService, tokenManager, statusBar;
  
  before(async function() {
    // テスト環境セットアップ
    authService = new AuthenticationService();
    tokenManager = TokenManager.getInstance();
    statusBar = new AuthStatusBar();
  });
  
  it('should complete full login flow', async function() {
    // ユーザーがログインするシナリオ
    await authService.login(testCredentials);
    
    // トークンが正しく保存されているか確認
    const token = await tokenManager.getAccessToken();
    expect(token).to.not.be.null;
    
    // UIが正しく更新されているか確認
    expect(statusBar.isLoggedIn()).to.be.true;
  });
  
  it('should handle token refresh', async function() {
    // トークン有効期限切れをシミュレート
    await tokenManager.setTokenExpiration(Date.now() - 1000);
    
    // API呼び出しを実行
    await authService.callProtectedApi();
    
    // リフレッシュが実行されたか確認
    expect(tokenManager.getLastRefreshTime()).to.be.greaterThan(0);
  });
});
```

### 組織管理統合テスト

```typescript
describe('Organization Management Flow', function() {
  let adminService, organizationController;
  
  beforeEach(async function() {
    // テスト用組織データの初期化
    await setupTestOrganization();
  });
  
  it('should create organization and add members', async function() {
    // 組織作成
    const org = await adminService.createOrganization({
      name: 'Test Organization',
      description: 'For testing purposes'
    });
    
    // メンバー追加
    await organizationController.addMember(org.id, {
      email: 'test@example.com',
      role: 'member'
    });
    
    // 組織とメンバーが正しく関連付けられているか確認
    const updatedOrg = await adminService.getOrganization(org.id);
    expect(updatedOrg.members).to.have.lengthOf(1);
    expect(updatedOrg.members[0].email).to.equal('test@example.com');
  });
});
```

### 使用量ダッシュボード統合テスト

```typescript
describe('Usage Dashboard Integration', function() {
  it('should display filtered usage data', async function() {
    // ダッシュボードコンポーネントをレンダリング
    const { getByTestId, getByText } = render(<UsageDashboard />);
    
    // フィルターを適用
    fireEvent.change(getByTestId('organization-select'), {
      target: { value: 'org-123' }
    });
    
    fireEvent.click(getByText('検索'));
    
    // API呼び出しと表示の検証
    await waitFor(() => {
      expect(getByTestId('total-tokens')).toHaveTextContent('123,456');
      expect(getByTestId('usage-chart')).toBeInTheDocument();
    });
  });
});
```

## テスト実行計画

### 実行環境
- **CI/CD**: GitHub Actions
- **頻度**: 日次実行 + メイン機能PRごと
- **環境**: テスト環境 (テスト用DB)

### 実行コマンド
```bash
# すべての統合テスト実行
npm run test:integration

# 認証フローのみテスト
npm run test:integration:auth

# 組織・ワークスペース管理テスト
npm run test:integration:admin

# 使用量管理テスト
npm run test:integration:usage
```

## データ管理

### テストデータ
- 各テスト開始前にテストDBをリセット
- シード処理によるベースデータ投入
- テスト間の依存関係を最小化

### 外部依存
- Anthropic API呼び出しのモック化
- テスト用APIキーの使用 (開発環境のみ)
- 認証サーバーのモック

## 課題と対策

### 1. テスト実行の安定性
- **課題**: 非同期処理による実行順序の不確定性
- **対策**: 明示的な待機処理とテスト間の適切な分離

### 2. 外部API依存
- **課題**: Admin APIなど外部サービスへの依存
- **対策**: 綿密なモック実装と実際のAPIを使用する検証の組み合わせ

### 3. 環境差異
- **課題**: 開発環境と本番環境の差異
- **対策**: Docker環境での一貫した実行とステージング環境での検証

## スケジュール

- **初期セットアップ**: 2日
- **認証フローテスト**: 2日
- **組織・ワークスペース管理テスト**: 3日
- **使用量管理テスト**: 2日
- **E2Eテスト追加**: 3日

## 責任者

- **テスト計画**: プロジェクトリード
- **テスト実装**: 開発チーム
- **レビュー**: QAエンジニア
- **実行監視**: CIシステム管理者