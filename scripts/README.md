# TypeScriptエラーゼロマネージャー

複数のエージェントが同じTypeScriptエラーを重複修正することを防ぎ、効率的にエラーゼロを達成するためのツールセットです。

## 🚀 クイックスタート

```bash
# 1. エラー分析の実行
npm run ts:check

# 2. 詳細レポートの表示
npm run ts:report

# 3. 自動修正の実行（推奨パターンのみ）
npm run ts:fix

# 4. 修正後の再確認
npm run ts:check
```

## 📋 機能概要

### 🔍 エラー分析 (`npm run ts:check`)
- バックエンド、フロントエンド、sajuengine_packageの全TypeScriptエラーを収集
- エラーを既知のパターンと照合して分類
- 重複修正の警告を表示
- 修正の優先度を自動計算

### 📊 詳細レポート (`npm run ts:report`)
- エラーの分布とパターン分析
- 自動修正可能なエラーの特定
- 現在修正中の作業状況
- 推奨アクションの提示

### 🚀 自動修正 (`npm run ts:fix`)
- 安全性が確認されたパターンの自動修正
- 修正中のロック機能で重複作業を防止
- 修正履歴の記録

## 🛡️ 重複修正防止システム

### 修正パターン知識ベース
`scripts/ts-error/fix-patterns.json`で以下を管理：
- **Material-UI Grid v7**: `item`プロパティの`size`プロパティへの変換
- **型の不一致エラー**: 適切な型キャストの提案
- **存在しないプロパティ**: 型定義の修正提案

### アクティブ修正ロック
`scripts/ts-error/active-fixes.json`で以下を追跡：
- 現在修正中の作業とその担当者
- 修正開始時刻と影響ファイル
- 完了した修正の履歴

## 📁 ファイル構造

```
scripts/
├── ts-error/
│   ├── analyzer.js           # エラー収集・分析
│   ├── auto-fixer.js         # 自動修正
│   ├── report-generator.js   # レポート生成
│   ├── fix-patterns.json     # 修正パターン定義
│   ├── active-fixes.json     # アクティブ修正管理
│   └── logs/
│       ├── errors_latest.json     # 最新エラー分析結果
│       ├── errors_YYYY-MM-DD.json # 日付別エラー履歴
│       └── history/               # 過去の分析結果
└── README.md                 # このファイル
```

## 🎯 Material-UI Grid v7対応

Material-UI v7での破壊的変更に対応：

### ❌ 削除されたプロパティ
- `item`プロパティ
- `xs`, `sm`, `md`, `lg`, `xl`ブレークポイントプロパティ

### ✅ 新しい使用方法
- `size`プロパティを使用
- `container`プロパティは継続使用可能

### 自動修正例
```tsx
// ❌ 修正前
<Grid item xs={12} md={6}>
  
</Grid>

// ✅ 修正後
<Grid size={{ xs: 12, md: 6 }}>
  
</Grid>
```

## 📈 ワークフロー

1. **エラー分析**: `npm run ts:check`でエラーを収集・分類
2. **レポート確認**: `npm run ts:report`で修正計画を立案
3. **自動修正**: `npm run ts:fix`で安全なエラーを自動修正
4. **手動修正**: 残ったエラーを手動で修正
5. **再確認**: `npm run ts:check`でエラーゼロを確認

## ⚠️ 注意事項

- 修正作業は必ずロックシステムを通して行われます
- 2時間以上古いロックは自動的に期限切れとなります
- 自動修正は`automationLevel: high`かつ`riskLevel: low`のパターンのみ実行されます
- 修正後は必ずテストの実行を推奨します

## 🔧 カスタマイズ

### 新しい修正パターンの追加
`scripts/ts-error/fix-patterns.json`に新しいパターンを追加：

```json
{
  "your-pattern-name": {
    "pattern": "正規表現パターン",
    "description": "パターンの説明",
    "fixRule": "修正ルール",
    "examples": {
      "before": "修正前のコード",
      "after": "修正後のコード"
    },
    "automationLevel": "high|medium|low",
    "riskLevel": "low|medium|high",
    "confidence": "very_high|high|medium|low"
  }
}
```

## 🆘 トラブルシューティング

### エラー分析が動作しない
- `node_modules/.bin/tsc`の存在を確認
- `tsconfig.json`または`tsconfig.app.json`の存在を確認

### 自動修正が実行されない
- `npm run ts:check`を先に実行してエラー分析結果があることを確認
- パターンの`automationLevel`と`riskLevel`を確認

### ロックが解除されない
- `scripts/ts-error/active-fixes.json`を手動で編集
- または2時間待機すると自動的に期限切れになります