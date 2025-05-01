# VSCode分割ターミナル機能の実装計画書

## 1. ユーザーの要望
VS Code内でAppGeniusからClaudeCode起動時、新しいターミナルタブを作成する代わりに、既存のアクティブなターミナルを分割して使用する機能が求められています。この機能はユーザー体験を向上させ、限られた画面スペースを効率的に使用するために重要です。

## 2. 現状と課題

現在の実装では：
- `ClaudeCodeLauncherService.ts`は`launchClaudeCodeWithPrompt`メソッドで`splitView`パラメータをサポートしていますが、これはターミナルの分割には使用されていません。
- `TerminalProvisionService.ts`の`createConfiguredTerminal`メソッドは新しいターミナルを作成しますが、分割機能はサポートしていません。
- UI側からClaudeCodeを起動する際、ScopeManagerPanelの`_handleLaunchPromptFromURL`メソッドでは`splitView`パラメータが常に`true`に設定されていますが、ターミナル分割には使用されていません。

## 3. 理想的なデータモデル設計

`TerminalOptions`インターフェースに新しい`splitTerminal`オプションを追加する必要があります：

```typescript
export interface TerminalOptions {
  title?: string;
  cwd?: string;
  additionalParams?: string;
  deletePromptFile?: boolean;
  splitView?: boolean; // 既存の設定（非推奨）
  location?: vscode.ViewColumn;
  iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined;
  promptType?: string; // プロンプトの種類
  
  /**
   * アクティブなターミナルを分割してClaudeCodeを起動するかどうか
   * trueの場合、既存のアクティブなターミナルを分割して新しいターミナルを作成
   * falseの場合は通常通り新しいタブとしてターミナルを作成（デフォルト）
   */
  splitTerminal?: boolean;
}
```

## 4. API設計

既存のAPIを拡張するアプローチを取り、後方互換性を維持します：

1. `ClaudeCodeLauncherService.launchClaudeCodeWithPrompt`
   - 既存の`splitView`パラメータとの後方互換性を維持しつつ、新しい`splitTerminal`パラメータをサポート

2. `TerminalProvisionService.createConfiguredTerminal`
   - 新しい`splitTerminal`パラメータを処理し、VSCodeのAPIを使用してターミナルを分割

## 5. UI/UX設計方針

現在のUI実装でも、ユーザーが明示的に設定できる方法が必要です：

- UI側のJavaScriptから`splitTerminal`パラメータを渡せるようにする
- ScopeManagerPanelの`_handleLaunchPromptFromURL`メソッドを更新して、このパラメータをClaudeCodeLauncherServiceに渡す

## 6. 設計原則の適用

- **単一責任の原則**: ターミナル分割ロジックは`TerminalProvisionService`内に集約
- **関心の分離**: UI層、サービス層、実行層で責任を明確に分離
- **後方互換性**: 既存の`splitView`パラメータもサポートし続ける

## 7. 修正が必要な関連ファイル一覧

1. `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/services/launcher/LauncherTypes.ts`
   - `TerminalOptions`インターフェースに`splitTerminal`プロパティを追加

2. `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/services/launcher/TerminalProvisionService.ts`
   - `createConfiguredTerminal`メソッドを修正して、`splitTerminal`オプションに基づいてターミナル分割処理を実装

3. `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/services/ClaudeCodeLauncherService.ts`
   - `launchClaudeCodeWithPrompt`メソッドのオプションに`splitTerminal`を追加
   - 後方互換性のため、`splitView`から`splitTerminal`へのマッピングを実装

4. `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/ui/scopeManager/ScopeManagerPanel.ts`
   - `_handleLaunchPromptFromURL`メソッドを修正して`splitTerminal`パラメータを渡せるようにする

5. `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/media/scopeManager.js`
   - UIイベントハンドラに`splitTerminal`オプションを追加するための変更（必要に応じて）

## 8. コンテキスト形成に役立つファイル一覧

- `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/services/launcher/SpecializedLaunchHandlers.ts`: 
  - ClaudeCodeの様々な起動シナリオを処理するクラス
  - `TerminalProvisionService`と連携している

- `/Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/services/launcher/CoreLauncherService.ts`:
  - ClaudeCode起動の中核機能を提供

## 9. 修正するAIへの引き継ぎ事項

1. `TerminalProvisionService.createConfiguredTerminal`メソッドの実装では、`vscode.window.activeTerminal`を確認して存在する場合にのみ分割ロジックを適用する必要があります。
   
2. `splitTerminal`が`true`の場合でも、アクティブなターミナルが存在しない場合は通常の新規タブとしてターミナルを作成するフォールバック動作を実装してください。

3. 環境設定コマンドの実行タイミングに注意してください。分割ターミナルの場合、ターミナル初期化に少し時間がかかる可能性があるため、環境設定コマンドの実行を少し遅延させる必要があるかもしれません。

4. VSCodeのAPIではターミナルの分割方法として`ViewColumn.Beside`を使用します。これにより、アクティブなターミナルに隣接して新しいターミナルが表示されます。

5. `splitView`と`splitTerminal`の両方が同時に異なる値で指定された場合、`splitTerminal`の値を優先してください。

## 10. 修正を実行するためのタスクリスト

1. `LauncherTypes.ts`のインターフェースに`splitTerminal`オプションを追加する
2. `TerminalProvisionService.ts`を更新して、`splitTerminal`オプションに基づいてターミナル分割ロジックを実装
3. `ClaudeCodeLauncherService.ts`を更新して、`splitTerminal`オプションのサポートを追加
4. 必要に応じて、ターミナル分割表示でのパフォーマンスやユーザビリティの問題をテストして解決
5. UI側からの`splitTerminal`オプション指定の実装を検討（現在は直接UIからの指定方法がない）

## 11. 技術的負債への対応

- `splitView`オプションは分かりにくい名前なので、将来的には非推奨にして完全に`splitTerminal`に置き換えることを検討するとよいでしょう。
- 現在のClaudeCode起動処理は`ClaudeCodeLauncherService -> CoreLauncherService -> SpecializedLaunchHandlers -> TerminalProvisionService`と複雑な依存関係になっているため、将来的にはこの構造を簡素化することが望ましいです。