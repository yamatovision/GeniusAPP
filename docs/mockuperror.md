# モックアップ表示のCSP制限エラーと対応方針

## 発生した問題

スコープマネージャー内でモックアップを表示する際に、以下のようなContent Security Policy (CSP) 違反エラーが発生しています。

```
// インラインスクリプト実行の制限
scopeManager.js:1316 Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'nonce-ZnQ7cWLzcp39YIl0hyIM8RoFHmagLaDw'". Either the 'unsafe-inline' keyword, a hash ('sha256-VHyK5qIjLsChNDG/N9rV7lHYd5lkccHiDFxsAFk1Yug='), or a nonce ('nonce-...') is required to enable inline execution.

// 外部スタイルシート読み込みの制限
scopeManager.js:1316 Refused to load the stylesheet 'https://unpkg.com/@mui/material@5.14.7/dist/css/material-ui.min.css' because it violates the following Content Security Policy directive: "style-src 'self' https://*.vscode-cdn.net 'unsafe-inline' https://fonts.googleapis.com".

// 外部スクリプト読み込みの制限
scopeManager.js:1316 Refused to load the script 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js' because it violates the following Content Security Policy directive: "script-src 'nonce-ZnQ7cWLzcp39YIl0hyIM8RoFHmagLaDw'".
```

また、Blob URLを使用した試行でも以下のエラーが発生：

```
Refused to frame 'blob:vscode-webview://1ncckche97rcgpp186pu3ehodfrcpg3c9gdmdh5rbt533vu165g5/00f22335-c83f-4b57-a9cb-afb322a5c820' because it violates the following Content Security Policy directive: "default-src 'none'". Note that 'frame-src' was not explicitly set, so 'default-src' is used as a fallback.
```

## 問題の原因

VSCode WebViewはセキュリティのため厳格なCSP設定を適用しています：

1. **インラインスクリプトの制限**: 実行には特定のnonce値が必要
2. **外部リソース読み込みの制限**: 許可されたドメインからのみ可能
3. **iframe制限**: 許可されたソースからのみ読み込み可能
4. **VSCode側の制限優先**: 拡張機能側の設定よりVSCode側の制限が優先される

## 重要な発見: モックアップギャラリーパネルでのCSP制限回避

モックアップギャラリーパネル（`appgenius-ai.openMockupGallery`コマンドで開くパネル）ではCSP制限エラーが発生しないという重要な発見がありました。モックアップギャラリーでは、通常のJavaScriptエラーは出るものの、CSP違反によるセキュリティエラーは発生しません。

コード調査により、明確な違いが判明しました:

1. **WebViewパネルのCSP設定の違い**:
   - **スコープマネージャー**: 独自のカスタムCSPを指定している
     ```typescript
     contentSecurityPolicy: "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src *;"
     ```
   - **モックアップギャラリー**: CSP設定を指定していない = VSCodeのデフォルト設定を使用

2. **VSCodeデフォルトCSPとの関係**:
   - モックアップギャラリーではCSP設定を明示的に指定していないため、VSCodeが適切なCSP設定を行っている
   - スコープマネージャーでは独自のCSPを指定しているが、それが実際には制限的すぎる可能性がある

修正の方向性:
1. スコープマネージャーからカスタムCSP設定を削除し、VSCodeのデフォルトCSP設定に任せる
2. または、モックアップの表示をモックアップギャラリーパネルに委任する（現在の実装方針）

**調査結果**: カスタムCSP設定は時としてVSCodeのデフォルト設定よりも制限的になる可能性があり、それが問題の原因と考えられます。

## VSCodeのWebViewにおけるCSP

VSCodeのWebViewでは、セキュリティ上の理由から厳格なCSPが適用されます。公式ドキュメントによると：

1. **nonce方式の採用**: 各WebView表示時に一意のnonce値が生成され、それを持つスクリプトのみ実行可能
2. **allowScriptsの設定**: `enableScripts: true`を設定しても、厳格なCSP制限は残る
3. **localResourceRoots**: 拡張機能内の特定のディレクトリからのリソース読み込みのみ許可

### CSPの具体的な制限

```
default-src 'none';
img-src ${webview.cspSource} https: data: blob:;
script-src 'nonce-${nonce}';
style-src ${webview.cspSource} 'unsafe-inline';
font-src ${webview.cspSource};
```

## 回避方法の検討

### 1. VSCode WebViewの制限内で対応

1. **nonceの利用**: WebViewから提供されるnonceを使用する
   ```typescript
   const nonce = getNonce(); // VSCodeが提供するnonce
   
   // HTMLテンプレート内でnonceを使用
   return `<!DOCTYPE html>
     <html>
     <head>
       <meta charset="UTF-8">
       <meta http-equiv="Content-Security-Policy" content="...">
       <script nonce="${nonce}" src="${scriptUri}"></script>
     </head>
     <body>...</body>
     </html>`;
   ```

2. **アセットのローカル化**: CDNなどの外部リソースをローカルに保存して、WebViewを通じて提供
   ```typescript
   const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'chart.js');
   const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
   ```

3. **メッセージパッシング**: WebViewとの通信を使って間接的にコンテンツを表示
   ```typescript
   // 拡張機能側
   webview.postMessage({ command: 'showContent', content: htmlContent });
   
   // WebView側
   window.addEventListener('message', event => {
     const message = event.data;
     if (message.command === 'showContent') {
       // WebView側のDOMに安全に表示
       document.getElementById('content').innerHTML = sanitizeHtml(message.content);
     }
   });
   ```

### 2. 別アプローチでの対応

1. **モックアップギャラリーパネルを使用**: CSP制限が発生しないモックアップギャラリーに表示を委任
   ```typescript
   // スコープマネージャーから専用のモックアップギャラリーを呼び出す
   vscode.commands.executeCommand('appgenius-ai.openMockupGallery', projectPath);
   ```

2. **ブラウザで開く**: VSCode制限を回避するため、システムブラウザでモックアップを表示

3. **サニタイズ**: HTMLからスクリプトを除去し、純粋な表示用コンテンツにする

## 実施した対応

1. **原因特定**: スコープマネージャーとモックアップギャラリーのCSP設定の違いを特定
   - スコープマネージャー: 独自のCSP設定を使用（制限的すぎる設定）
   - モックアップギャラリー: VSCodeのデフォルトCSP設定を使用（より柔軟な設定）

2. **対応策1: カスタムCSP設定の削除**
   ```typescript
   // 修正前
   contentSecurityPolicy: "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src *;",
   
   // 修正後 - コメントアウトしてVSCodeのデフォルト設定を使用
   // contentSecurityPolicy: "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src *;",
   ```

3. **対応策2: モックアップギャラリーパネルへの委任**
   - スコープマネージャーから独立したモックアップギャラリーパネルを呼び出す方法も実装
   ```typescript
   // スコープマネージャーからモックアップギャラリーを開く
   vscode.commands.executeCommand('appgenius-ai.openMockupGallery', this._projectPath);
   ```

## まとめと教訓

1. **VSCodeのCSP設定に関する教訓**:
   - カスタムCSP設定を追加することで、意図せず制限を厳しくしてしまう可能性がある
   - VSCodeのデフォルトCSP設定は多くの場合、適切なバランスが取れている
   - CSP設定を変更する場合は、必要最小限の変更にとどめるべき

2. **モックアップ表示の対応策**:
   - 外部リソース参照とインラインスクリプトを避ける
   - 必要なスクリプトはローカルにバンドルし、必要に応じてnonceを使用
   - 複雑なHTMLコンテンツ表示には専用パネルを利用する
   - 可能なら、カスタムCSP設定を避け、VSCodeのデフォルト設定を使用する

3. **実装方針**:
   - スコープマネージャーでのカスタムCSP設定を削除
   - それでも問題が解決しない場合は、モックアップギャラリーパネルに表示を委任
   - 「ブラウザで開く」ボタンも引き続き提供し、複数の選択肢をユーザーに提供

この対応により、モックアップ表示に関するCSP制限の問題を効果的に回避できるようになりました。