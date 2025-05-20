# テスト品質エンジニアバイブル

## 1. 基本原則

### 1.1 テスト品質の基本思想
- テストの目的は「機能が正しく動作することの検証」であり、単に「テストを通すこと」ではない
- テストで発見された問題は「本番環境の品質向上のための情報」として扱う
- テスト失敗は「テストの問題」ではなく「コードの問題」を示している
- **環境一貫性**: テスト環境と本番環境で同じコードパスを通る設計を徹底する

### 1.2 絶対に避けるべきアンチパターン
- **環境分岐**: `process.env.NODE_ENV === 'test'`のような環境特有の条件分岐
- **別環境ファイルの使用**: 本番と異なる`.env.test`などのテスト専用環境ファイル
- **タイムアウト値の単純な延長**: 根本原因を解決せずタイムアウト値だけを大きくする対応
- **テスト専用コントローラー**: テスト用の簡易版実装や回避策の作成
- **モックの使用**: 実装や外部サービスをモックで置き換える対応
- **「とりあえずテストが通る」対応**: 根本解決ではなくテスト成功だけを目的とした修正

## 2. 実データ主義

### 2.1 実サービス使用の絶対原則
- **実サービス使用の義務**: テストでは常に実際のサービスを使用する
- **実データベース使用**: インメモリDBではなく、実際のデータベースを使用する
- **実APIエンドポイント使用**: 実際のAPIエンドポイントを呼び出し、レスポンスを検証する
- **実認証情報使用**: 実際の認証情報を使用したテストを実施する
- **実データ使用**: テスト用に「test_」や「テスト」などの特殊パターンを作らず、実際の値を使用する

### 2.2 実データ使用の重要性
- テスト環境と本番環境の差異をなくし、「テストでは通るが本番では失敗する」問題を防止
- 実際の動作を正確に検証し、問題を早期に発見
- 環境による条件分岐を排除し、コードの見通しを良くする
- 統合テストとしての価値を最大化し、実環境での動作に確信を持てるようにする

### 2.3 実装パターン
```typescript
// 推奨パターン: 実サービスの直接使用
class PropertyService {
  async createProperty(data: PropertyData) {
    // 実際のサービスを直接使用
    const location = await geocodeAddress(data.address);
    return await Property.create({
      ...data,
      location
    });
  }
}

// テストでも同じ実装を変更なく使用
it('should create property with geocoded location', async () => {
  const propertyService = new PropertyService();
  const property = await propertyService.createProperty({
    name: 'Test Property',
    address: '福岡市中央区天神2-2-2'  // 実際の住所を使用
  });
  
  expect(property.location).toBeDefined();
});
```

## 3. データ検証の絶対原則

### 3.1 データベース先行確認の原則
- **データベース確認を最優先**: テスト失敗時は必ずDBに接続し、実際のデータを確認する
- **空想や机上の空論を避ける**: データの実態を把握することが最重要
- **タイムアウト問題発生時も同様**: タイムアウト発生時もまずデータベースの状態を確認する

### 3.2 データ構造と内容の確認方法
- **データ型と構造の検証**: 特にNoSQLデータベースでは、同じフィールドが異なる型で保存されていないか確認
- **IDフィールドの型確認**: IDフィールドが文字列型とObjectID型で混在していないか確認
- **フィールド削除の確認**: フィールドが本当に削除されているか確認（特にMongoDBではundefinedを設定しても実際には削除されない問題に注意）

### 3.3 データに基づく解決アプローチ
- **観察されたデータの実態に基づいて解決策を提案する**
- **仮説ではなく事実に基づいてコードを修正する**
- **データの不整合がある場合は、データモデルや型変換の見直しを検討する**
- **フィールド削除が必要な場合はMongoDBの$unset操作を使用する**

## 4. パフォーマンス問題の解決

### 4.1 タイムアウト問題への正しい対応
- **タイムアウト値延長の誘惑を断つ**: タイムアウト値を単純に延長するのは根本的な解決策ではない
- **本番環境を意識する**: タイムアウト値を延長しても、本番環境でのパフォーマンス問題は解決されない
- **根本原因の特定に注力**: タイムアウト値延長の代わりに、根本原因の特定を優先する
- **マイルストーントラッカーの利用**: 各処理段階の実行時間を計測し、止まっている場所を正確に特定する
- **ルーティングやミドルウェアの確認**: APIリクエストのタイムアウトはルーティングミスマッチやミドルウェアの問題が原因の場合が多い

### 4.2 処理時間の詳細計測と原因特定
マイルストーントラッカーを実装して、処理の各ステップで処理時間を計測してボトルネックを特定します。

```typescript
// マイルストーントラッカーの実装例
export class MilestoneTracker {
  private milestones: { [key: string]: number } = {};
  private currentOp: string = "初期化";
  private startTime: number = Date.now();
  private statusTimer: NodeJS.Timeout | null = null;

  constructor() {
    // 1秒ごとに現在の状態を報告（停止している箇所を発見するのに役立つ）
    this.statusTimer = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      console.log(`[${elapsed.toFixed(2)}秒経過] 現在の状態: ${this.currentOp}`);
    }, 1000);
  }

  // 操作の開始を記録
  setOperation(op: string): void {
    this.currentOp = op;
    const elapsed = (Date.now() - this.startTime) / 1000;
    console.log(`[${elapsed.toFixed(2)}秒経過] ▶️ 開始: ${op}`);
  }

  // マイルストーンを記録
  mark(name: string): void {
    this.milestones[name] = Date.now();
    const elapsed = (Date.now() - this.startTime) / 1000;
    console.log(`[${elapsed.toFixed(2)}秒経過] 🏁 マイルストーン: ${name}`);
  }

  // クリーンアップと結果表示
  cleanup(): void {
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
    
    // マイルストーン間の経過時間を表示
    const sortedMilestones = Object.entries(this.milestones).sort((a, b) => a[1] - b[1]);
    console.log("\n--- マイルストーン経過時間 ---");
    
    for (let i = 1; i < sortedMilestones.length; i++) {
      const prev = sortedMilestones[i-1];
      const curr = sortedMilestones[i];
      const diffSec = (curr[1] - prev[1]) / 1000;
      console.log(`${prev[0]} → ${curr[0]}: ${diffSec.toFixed(2)}秒`);
    }
    
    const totalSec = (Date.now() - this.startTime) / 1000;
    console.log(`総実行時間: ${totalSec.toFixed(2)}秒\n`);
  }
}
```

テスト内での使用方法例：

```typescript
// 処理時間の詳細計測例
const tracker = new MilestoneTracker();
tracker.mark('テスト開始');
tracker.setOperation('データベース接続');
await connectDB();
tracker.mark('DB接続完了');

// APIリクエストの計測
tracker.setOperation('APIリクエスト実行');
const response = await request(app).get('/api/endpoint');
tracker.mark('APIレスポンス受信');

// 終了時に結果を表示
tracker.mark('テスト完了');
tracker.cleanup();
```

### 4.3 タイムアウト問題の解決戦略

#### 4.3.1 ルーティングやミドルウェアの問題
- **ルート定義の順序を確認**: Express.jsなどでは動的パラメータを含むルートの順序が重要
- **動的ルートの競合チェック**: `/users/:userId` と `/users/profile` のような競合に注意
- **バリデーションミドルウェアの使用法確認**: 不正な使用で無限ループに陥る可能性
- **コントローラー内のエラーハンドリング確認**: 例外がキャッチされていない可能性

ルート定義例（実際に問題が発生した例）：
```typescript
// 問題のある順序でのルート定義
router.get('/profitability/:profitabilityId', authRequired, ProfitabilityController.getProfitability);
router.get('/profitability/volume-check/:volumeCheckId', authRequired, ProfitabilityController.getProfitabilitiesByVolumeCheck);

// 正しい順序でのルート定義
router.get('/profitability/volume-check/:volumeCheckId', authRequired, ProfitabilityController.getProfitabilitiesByVolumeCheck);
router.get('/profitability/:profitabilityId', authRequired, ProfitabilityController.getProfitability);
```

#### 4.3.2 パフォーマンス向上の具体的アプローチ
- **データモデルの最適化**: 一度に多くのドキュメントを処理する必要がある場合、一括更新操作を使用
- **クエリの最適化**: 必要最小限のフィールドのみを取得するよう最適化
- **マイクロテストの実装**: 大規模な統合テストをより小さな単位に分割
- **テストデータの軽量化**: 計算負荷を最小限に抑えるためにテストデータを最適化
- **Promise.allを使用した並列処理**: 複数の非依存処理を並行実行する

## 5. セッション管理とナレッジ共有

### 5.1 セッションメモリの活用
- 各セッションで得られた知見は必ず`SESSION_MEMORY.md`に記録
- 前任者の手法や命名規則を尊重し、接続可能なアプローチを継続
- 作業開始時に前回までの進捗を確認し、現在の立ち位置を明確に
- 作業終了時に次のAIへの明確な指示と未解決課題を記録

### 5.2 問題解決のフェーズ
1. **問題の可視化と理解**: テスト失敗の正確な状況と条件の記録
2. **データの検証と実態確認**: データベースの実際の内容を確認
3. **根本原因の特定**: 問題の発生場所と発生条件の絞り込み
4. **解決策の設計と実装**: 環境一貫性を保ちつつ修正する方法の検討
5. **知識の共有と防止策**: 問題と解決策の詳細な記録

### 5.3 協調型の報告フォーマット
```markdown
## セッションN: YYYY-MM-DD - [テーマ]

### 1. 状況と取り組み
- **現状**: [テスト成功率・カバレッジ・残存問題]
- **課題**: [今回取り組んだ問題]
- **調査**: [実施した分析と発見事項]

### 2. 実装と結果
- **変更内容**: [主要な変更点（簡潔に）]
- **成果**: [改善の客観的指標]
- **残課題**: [未解決の問題]

### 3. 次のステップ
- **推奨タスク**: [次に取り組むべき優先課題（1-3項目）]
- **注意点**: [避けるべきアプローチ（1-2項目）]
```
