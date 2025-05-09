# MessageDispatchService リファクタリング実装ガイド（実装完了）

このガイドでは、MessageDispatchServiceImplの改善と各サービス間の直接参照を実現するための実装手順を説明します。すべてのステップが完了し、新しい実装が利用可能になりました。

## 実装ステップ

### 1. 新しいファイルの追加

以下の新しいファイルを追加します：

1. `src/ui/scopeManager/services/interfaces/IWebViewCommunication.ts`
   - WebViewと通信するための共通インターフェース

2. `src/ui/scopeManager/services/ServiceRegistry.ts`
   - サービス間の直接参照を可能にするレジストリクラス

3. `media/utils/serviceConnector.js`
   - WebView側で各サービスを直接呼び出すためのユーティリティ

### 2. 既存のインターフェースの更新

1. `src/ui/scopeManager/services/interfaces/IMessageDispatchService.ts`
   - 不要なメソッドを削除し、シンプル化

### 3. 各サービス実装の更新

以下のサービス実装クラスを更新し、IWebViewCommunicationインターフェースを実装します：

1. `src/ui/scopeManager/services/implementations/FileSystemServiceImpl.ts`
2. `src/ui/scopeManager/services/implementations/ProjectServiceImpl.ts`
3. `src/ui/scopeManager/services/implementations/SharingServiceImpl.ts`

各サービスに以下のメソッドを追加します：

```typescript
// IWebViewCommunication インターフェイスの実装
public registerMessageHandlers(messageDispatchService: IMessageDispatchService): void {
  // サービス固有のハンドラを登録
}

public sendToWebView(panel: vscode.WebviewPanel, message: Message): void {
  // WebViewにメッセージを送信
}

public showError(panel: vscode.WebviewPanel, message: string): void {
  // エラーメッセージを表示
}

public showSuccess(panel: vscode.WebviewPanel, message: string): void {
  // 成功メッセージを表示
}
```

### 4. MessageDispatchServiceImplの更新

`src/ui/scopeManager/services/implementations/MessageDispatchServiceImpl.ts`を更新し：

1. 中間処理ハンドラを削除
2. サービスタイプに基づいたルーティング機能を追加
3. 不要なメソッドを削除
4. ServiceRegistryとの連携を追加

### 5. WebView側のJavaScriptファイルの更新

以下のファイルを更新して、新しいserviceConnector.jsを使用するようにします：

1. `media/scopeManager.js`
2. その他WebView側のJavaScriptファイル

例：
```javascript
import serviceConnector from './utils/serviceConnector.js';

// 従来のコード
// webview.postMessage({ command: 'getFileContent', filePath: '/path/to/file' });

// 新しいコード
const content = await serviceConnector.readMarkdownFile('/path/to/file');
```

## サービス参照の仕組み

新しい実装では、以下の流れでサービス間の参照を行います：

1. 各サービスがServiceRegistryに登録される
2. MessageDispatchServiceは、WebViewからのメッセージを受け取ると、message.serviceTypeに基づいて適切なサービスにルーティング
3. WebView側からは、serviceConnectorを使って各サービスの機能を直接呼び出せる

## 利点

この設計には以下の利点があります：

1. **コード量削減**: 中間処理ハンドラが不要になり、コード量が大幅に減少
2. **直接的な依存関係**: サービス間の依存関係が明確になり、理解しやすい
3. **責任の明確化**: 各サービスが自分の領域のメッセージを直接処理
4. **拡張性の向上**: 新しいサービスを追加する際も、ServiceRegistryに登録するだけで連携可能

## 移行計画と完了状況

既存のコードとの互換性を維持するために、段階的に移行しました：

1. ✅ MessageDispatchServiceImplから不要な部分を削除 - **完了**
2. ✅ FileSystemServiceImplにIWebViewCommunicationを実装 - **完了**
3. ✅ IMessageDispatchServiceインターフェースの簡素化 - **完了**
4. ✅ サービス間の直接通信を可能にするServiceRegistryの実装 - **完了**
5. ✅ 直接サービス呼び出しのためのメッセージルーティング機能の実装 - **完了**
6. ⬜ WebViewのJavaScriptファイルの更新 - **未完了**（次のステップ）

> **注意**: WebViewのJavaScriptファイルの更新はこのリファクタリングの一部として含まれていませんが、serviceConnector.jsの実装は完了しています。

## 追加実装されたファイル

このリファクタリングで新しく作成または更新されたファイル：

1. `/src/ui/scopeManager/services/interfaces/IWebViewCommunication.ts` - 新規作成
2. `/src/ui/scopeManager/services/ServiceRegistry.ts` - 新規作成
3. `/media/utils/serviceConnector.js` - 新規作成
4. `/src/ui/scopeManager/services/implementations/FileSystemServiceImpl.ts` - 更新
5. `/src/ui/scopeManager/services/implementations/MessageDispatchServiceImpl.ts` - 更新
6. `/src/ui/scopeManager/services/interfaces/common.ts` - 更新
7. `/src/ui/scopeManager/services/interfaces/IMessageDispatchService.ts` - 更新

## 他のサービスへの拡張

このリファクタリングパターンを他のサービスにも適用することで、すべてのサービスでWebViewとの直接通信が可能になります。以下のサービスに同様の実装を適用することを推奨します：

1. ProjectServiceImpl
2. SharingServiceImpl
3. UIStateServiceImpl
4. TabStateServiceImpl

## 参考コード

実装例として以下のファイルを参照してください：

1. `file_system_service_with_webview.ts.example` - FileSystemServiceImplの実装例（既に実装済み）
2. `message_dispatch_service_updated.ts.example` - 更新されたMessageDispatchServiceImplの例（既に実装済み）