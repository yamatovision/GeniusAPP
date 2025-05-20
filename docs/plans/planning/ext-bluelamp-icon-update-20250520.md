# 機能拡張計画: ブルーランプステータスバーアイコン更新 2025-05-20

## 1. 拡張概要

VSCodeステータスバーのブルーランプを示すロケットアイコンをブルーランプのロゴアイコンまたはライトバルブアイコンに変更する。これにより、ブルーランプブランドの視覚的一貫性と認識性を向上させる。

## 2. 詳細仕様

### 2.1 現状と課題

現在、ステータスバーのブルーランプアイコンは「$(rocket)」（ロケット）という標準VSCodeアイコンを使用している。これはブルーランプのブランドイメージと一致していない。メディアフォルダにはブルーランプのロゴ（bluelamp-logo.png, bluelamp-logo3.png）が存在するが、現在のステータスバーではこれらが活用されていない。

### 2.2 拡張内容

ステータスバーのアイコンを以下のいずれかの方法で変更する：

1. **シンプルアプローチ**: VSCodeの組み込みアイコン「$(lightbulb)」または「$(lightbulb-sparkle)」を使用
2. **高度なアプローチ**: ブルーランプのSVGロゴを変換したカスタムアイコンフォントを作成して使用

今回は実装の迅速さを優先して、シンプルアプローチ（組み込みアイコン）を採用する。

### 3 ディレクトリ構造

変更が必要なファイルの構造：

```
src/
  extension.ts      <- ステータスバーの初期設定を変更
  ui/
    statusBar.ts    <- ステータスバー状態更新時のアイコンを変更
```

## 4. 技術的影響分析

### 4.1 影響範囲

- **UI**: ステータスバーのアイコン表示のみに影響
- **機能**: 機能的な影響はなし（見た目の変更のみ）
- **パフォーマンス**: 影響なし

### 4.2 変更が必要なファイル

```
- src/extension.ts: setupStatusBar関数内のアイコン参照を変更
- src/ui/statusBar.ts: StatusBarクラス内のアイコン参照を変更
```

#### extension.ts 変更箇所

```typescript
// 変更前
appGeniusStatusBarItem.text = "$(rocket) ブルーランプ";

// 変更後
appGeniusStatusBarItem.text = "$(lightbulb-sparkle) ブルーランプ";
```

#### statusBar.ts 変更箇所

```typescript
// 変更前 (Ready状態)
this.statusBarItem.text = '$(robot) ブルーランプ';

// 変更後 (Ready状態)
this.statusBarItem.text = '$(lightbulb) ブルーランプ';

// 変更前 (Active状態)
this.statusBarItem.text = '$(radio-tower) ブルーランプ';

// 変更後 (Active状態)
this.statusBarItem.text = '$(lightbulb-sparkle) ブルーランプ';
```

## 5. タスクリスト

```
- [ ] **T1**: extension.tsのアイコン参照を変更
- [ ] **T2**: statusBar.tsのアイコン参照を変更
- [ ] **T3**: 変更のテスト・確認
```

### 代替実装: カスタムアイコンフォント（将来オプション）

将来的に完全なブランド統一が必要な場合は、以下の手順でカスタムアイコンフォントを作成・導入することも可能：

1. ブルーランプのSVGロゴをIcoMoonやGlyphterなどでフォント形式に変換
2. package.jsonにcontributes.iconsセクションを追加：

```json
"contributes": { 
  "icons": { 
    "bluelamp-logo": { 
      "description": "BlueLamp icon", 
      "default": { 
        "fontPath": "./media/bluelamp-icon.woff", 
        "fontCharacter": "\\e900" 
      } 
    } 
  } 
}
```

3. フォント参照を更新：

```typescript
appGeniusStatusBarItem.text = "$(bluelamp-logo) ブルーランプ";
```

## 6 テスト計画

1. 変更後の拡張機能をローカルで実行し、ステータスバーでアイコンが正しく表示されることを確認
2. ステータスバーの各状態（Ready, Active, Busy）でアイコンが適切に表示されるか確認
3. 異なるVSCodeテーマでアイコンの視認性を確認

## 7. SCOPE_PROGRESSへの統合

SCOPE_PROGRESS.mdに以下のタスクを追加：

```markdown
- [ ] **UI-ICON-01**: ステータスバーのブルーランプアイコンを変更
  - 目標: 2025-05-21
  - 参照: [/docs/plans/planning/ext-bluelamp-icon-update-20250520.md]
  - 内容: VSCodeステータスバーのブルーランプアイコンをライトバルブアイコンに変更
```

## 8. 備考

- シンプルアプローチは最小限の変更で迅速に実装可能
- カスタムアイコンフォントアプローチはブランドの一貫性は高いが、実装コストが高い
- 今回はシンプルアプローチを推奨するが、将来的なブランド戦略に応じてカスタムアイコンフォントへの移行も検討可能