# promptManager.js 削除計画 [2025-05-14]

## 1. 現状分析

### 1.1 対象の概要
`promptManager.js`と`promptCards.js`は両方ともプロンプトカードのUI表示と機能を提供するモジュールですが、重複した実装となっています。両方とも同じプロンプトURLリストを保持し、ほぼ同一の機能を備えていますが、実際に使用されているのは`promptCards.js`のみです。

### 1.2 問題点
- 同じ機能を持つ2つのモジュールが存在し、コードの冗長性とメンテナンスコストが増加
- プロンプトURLリストが2箇所に定義されており、一方のみを更新すると不整合が発生
- 使用されていない`promptManager.js`がコードベースに存在することで、理解しづらさが増す

### 1.3 関連ファイル
- `/media/components/promptCards/promptCards.js` - 使用中のモジュール
- `/media/components/promptCards/promptCards.css` - 使用中のスタイル
- `/media/components/promptManager/promptManager.js` - 未使用モジュール
- `/media/components/promptManager/promptManager.css` - 未使用スタイル
- `/media/scopeManager.js` - promptCardsを実際に使用しているファイル

### 1.4 依存関係
- `scopeManager.js` → `promptCards.js`（`initializePromptCardsInModal`メソッドを呼び出し）
- `promptCards.js` → `dialogManager.js`（ダイアログ表示に使用）
- `promptManager.js` → 直接の依存ファイルなし（どこからも参照されていない）

## 2. 削除プラン

### 2.1 削除対象
- `/media/components/promptManager/promptManager.js`
- `/media/components/promptManager/promptManager.css`

### 2.2 削除手順

#### フェーズ1: promptManagerの独自機能の確認と統合
1. `promptManager.js`と`promptCards.js`の実装を比較
2. `promptManager`固有の機能があれば、`promptCards.js`に統合
3. `promptManager.css`のスタイルを`promptCards.css`に統合（必要な場合）

#### フェーズ2: 削除の影響評価
1. 念のため`promptManager.js`をインポートしているファイルがないか確認
   - Grepコマンドで`import promptManager`や`from '../promptManager/promptManager.js'`を検索
   - 現時点での調査では依存ファイルはなし
2. 削除に関連するリスクがあれば、対応策を策定

#### フェーズ3: リダイレクトモジュールの作成（必要な場合）
1. 念のため、`promptManager.js`へのリダイレクトモジュールを作成
   ```javascript
   /**
    * @deprecated このモジュールは非推奨です。代わりに promptCards.js を使用してください。
    */
   
   // promptCards.jsからすべてをインポートして再エクスポート
   import promptCards from '../promptCards/promptCards.js';
   export default promptCards;
   ```

#### フェーズ4: 実際の削除
1. `promptManager.css`のスタイルを`promptCards.css`に統合
2. リダイレクトモジュールを作成（または既存ファイルを修正）
3. テストを実施
4. 問題がなければリダイレクトモジュールも最終的に削除

## 3. 検証手順

### 3.1 機能検証
1. アプリケーションを起動し、プロンプトカードが正常に表示されることを確認
2. 各プロンプトカードをクリックし、ダイアログが正常に表示されることを確認
3. モーダル内のプロンプトカードが正常に機能することを確認

### 3.2 UI検証
1. プロンプトカードのスタイルが正しく適用されていることを確認
2. モーダル内のプロンプトカードのスタイルが正しく適用されていることを確認
3. レスポンシブデザインが正常に機能していることを確認

### 3.3 エラー検証
1. ブラウザのコンソールにエラーが表示されていないことを確認
2. VSCode拡張機能のログにエラーが出力されていないことを確認

## 4. スケジュール

### Day 1 (2025-05-14):
- promptManager.jsの分析と比較
- promptCards.js への必要な機能の統合

### Day 2 (2025-05-15):
- リダイレクトモジュールの作成（念のため）
- 実際の削除と検証

### Day 3 (2025-05-16):
- リダイレクトモジュールも削除（問題がなければ）
- 最終確認と完了報告

## 5. 注意事項
- 直接的な依存関係がなくても、名前指定による動的インポートがある可能性があるため慎重に検証
- リダイレクトモジュールは当面残しておき、次のメジャーバージョンアップで完全に削除することも検討

## 6. 備考
- この削除は「バックエンドURL移行計画」と並行して実施可能
- promptManagerの削除後、新しい設定ファイルからURLを取得するように promptCards.js を修正する