# ClaudeCode起動カウンター問題分析と修正提案

## 問題の特定

ClaudeCode起動カウンターがダッシュボードに正しく反映されない問題の調査結果は以下の通りです。

### 調査結果サマリー

1. **カウンター機能の基本動作は正常**:
   - 直接APIを呼び出すテストで確認済み - カウンターは正しく増加する
   - データモデル、APIエンドポイント、フロントエンド表示はすべて正常に実装されている

2. **問題点: イベント発行が不足している**:
   - リファクタリングされた`CoreLauncherService.ts`や`SpecializedLaunchHandlers.ts`から起動するパスでは、`CLAUDE_CODE_LAUNCH_COUNTED`イベントが発行されていない
   - 古い`ClaudeCodeLauncherService.ts`では発行されているが、新しいコードパスでは漏れている

3. **イベントリスナーの登録問題**:
   - `claude_code_counter_event_listener.ts`に分離されたイベントリスナー登録コードを`extension.ts`で呼んでいるが、コメントアウトされている可能性がある

### 現在のイベント発行場所

1. `src/services/ClaudeCodeLauncherService.ts` (旧):
   - 52-56行目: `launchClaudeCode`メソッド内
   - 73-77行目: `launchClaudeCodeWithMockup`メソッド内
   - 105-109行目: `launchClaudeCodeWithPrompt`メソッド内

2. しかし、新しい実装である以下の場所には同様のイベント発行コードがない:
   - `src/services/launcher/CoreLauncherService.ts`
   - `src/services/launcher/SpecializedLaunchHandlers.ts`

### 現在のイベントリスナー登録

1. `extension.ts` の 514-536 行目でイベントリスナーが登録されている
2. `claude_code_counter_event_listener.ts` に独立したイベントリスナー登録コードがあるが、このファイルからのインポートが正しく行われていない可能性がある

## 修正案

### 修正1: 新しいランチャーにイベント発行を追加

`src/services/launcher/CoreLauncherService.ts` の各起動メソッドに`CLAUDE_CODE_LAUNCH_COUNTED`イベント発行を追加:

```typescript
// src/services/launcher/CoreLauncherService.ts

public async launchClaudeCode(options: ScopeExecutionOptions): Promise<boolean> {
  try {
    // 起動カウンターイベントを発行
    this.eventBus.emit(
      AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
      { scope: options.scope },
      'CoreLauncherService'
    );
    
    // 前回の状態がRUNNINGのまま残っている可能性があるため、再確認を提案
    ...
```

同様に、`launchClaudeCodeWithMockup`と`launchClaudeCodeWithPrompt`メソッドにも追加。

### 修正2: SpecializedLaunchHandlers.tsにもイベント発行を追加

念のため、`src/services/launcher/SpecializedLaunchHandlers.ts`の以下のメソッドにもイベント発行を追加します:

```typescript
// src/services/launcher/SpecializedLaunchHandlers.ts

public async launchWithScope(options: ScopeExecutionOptions): Promise<{ ... }> {
  try {
    // 起動カウンターイベントを発行
    this.eventBus.emit(
      AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED,
      { scope: options.scope },
      'SpecializedLaunchHandlers'
    );
    
    // 残りのコード...
```

同様に、`launchWithMockup`と`launchWithPrompt`メソッドにも追加。

### 修正3: イベントリスナー登録の確認

`extension.ts`の末尾に以下のコードが追加されていることを確認:

```typescript
// extension.ts

// ClaudeCode起動カウントイベントリスナーの登録
import { registerClaudeCodeLaunchCountEventListener } from './claude_code_counter_event_listener';
registerClaudeCodeLaunchCountEventListener(context);
```

## 実装手順

1. `src/services/launcher/CoreLauncherService.ts`内の各起動メソッドに`AppGeniusEventType.CLAUDE_CODE_LAUNCH_COUNTED`イベント発行コードを追加
2. `src/services/launcher/SpecializedLaunchHandlers.ts`内の各起動メソッドに同様のイベント発行コードを追加
3. `extension.ts`でイベントリスナー登録が正しく行われているか確認し、必要に応じて修正
4. VSCodeを再起動してClaudeCodeを起動し、カウンターが増加するか確認

これらの修正により、新しいコードパスでも起動カウンターが正しく動作するようになります。