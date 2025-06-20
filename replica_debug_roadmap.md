# レプリカビューアー デバッグロードマップ

## 問題の概要
1. プロジェクトを切り替えても、レプリカファイルがないプロジェクトでもレプリカが表示される
2. 修正を加えると、今まで見れていたレプリカが見れなくなることが多発

## 関連ファイル依存関係マップ

### 1. エントリーポイント
```
ScopeManagerPanel.ts
└── setProjectPath() → プロジェクト切り替えの起点
```

### 2. メッセージフロー
```
ScopeManagerPanel.ts
├── MessageDispatchServiceImpl.ts
│   └── ReplicaMessageHandler.ts
│       └── updateProjectPath() → プロジェクトパス更新
└── Webview (lpReplica.js)
    ├── checkReplicaExists() → レプリカ存在確認
    └── showReplica() → レプリカ表示
```

### 3. データフロー
```
ReplicaService.ts
├── getReplicaPath() → レプリカパス取得
├── replicaExists() → 存在確認
└── Python実行 → レプリカ生成
```

## 調査結果

### 問題の原因
1. **プロジェクト切り替え時の通知不足**
   - ScopeManagerPanel.setProjectPath()でReplicaMessageHandlerのプロジェクトパスは更新される
   - しかし、フロントエンド（lpReplica.js）に切り替えが通知されない
   - 結果：古いレプリカが表示され続ける

2. **フロントエンドの状態管理**
   - lpReplica.jsはプロジェクト切り替えを検知する仕組みがない
   - 初期化時にcheckReplicaExists()を実行するが、プロジェクト切り替え時には実行されない

3. **WebviewURI変換の問題**
   - showReplica()でWebviewURI変換をリクエストするが、プロジェクトパスが古い可能性

## 修正方針

### ステップ1: プロジェクト切り替え通知の実装
1. ScopeManagerPanel.setProjectPath()から、Webviewにプロジェクト切り替えを通知
2. lpReplica.jsでプロジェクト切り替えイベントを受信し、レプリカ状態をリセット

### ステップ2: レプリカ状態のリセット処理
1. フロントエンドでレプリカビューアーを初期状態に戻す
2. 新しいプロジェクトのレプリカ存在確認を実行

### ステップ3: ログ設置による検証
1. プロジェクト切り替え時のイベント伝播を追跡
2. レプリカ存在確認の実行タイミングを記録

## デバッグ用ログポイント

### 必須ログ設置箇所
1. **プロジェクト切り替え時**
   - ScopeManagerPanel.setProjectPath() - 切り替え開始
   - ReplicaMessageHandler.updateProjectPath() - ハンドラー更新
   - lpReplica.js: プロジェクト変更イベント受信

2. **レプリカ確認時**
   - ReplicaService.replicaExists() - 存在確認
   - lpReplica.checkReplicaExists() - フロントエンド確認
   - WebviewURI変換処理

3. **レプリカ表示時**
   - showReplica()の呼び出し
   - iframe.src設定
   - エラーハンドリング

## 注意事項
- 修正は段階的に行い、各ステップで動作確認を実施
- 既存の正常動作を維持しながら修正を適用
- ログ出力で問題箇所を特定してから修正に着手