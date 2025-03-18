

 要件定義ビジュアライザーのUIで要件定義を行う。

  良いなというものが出てきたら

  要件定義を保存してモックアップを生成ボタンを押す

  #1：そうすると要件定義がrequirement.md(スペル正しく）がdocs/の中に保存される。
  #2：こちらを読み込んで（requirment.mdから読み込むの？それともUIのチャット履歴から読み込むの？）ページリストぶんのCLaudeCodeに個別モックアップ作成ようプロンプトっともに立ち上がりそれぞれのページが指示されるのが受け渡される。

  という流れが確実に実現できるということで間違いない？



現状を調査しながらどのように回収すれば今回の要件を満たすことができるかを考えてくださ
  い。
  - **個別モックアップ作成用プロンプトー**
    http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/247df2890160a2fa8f6cc0f895413aed

  ここに保存しました。


 実装計画

  1. 修正箇所

  1. 要件定義ビジュアライザーの機能分割：
    - 既存の要件定義ビジュアライザープロンプト → 要件定義クリエイター（docs/prompts/requirements_creator.md）に変更
    - モックアップ生成機能 → 新しい並列モックアップ生成機能に分離
  2. UI修正：
    - SimpleChat.js/tsに「要件定義を保存してモックアップを生成」ボタンを追加
  3. 並列モックアップ生成機能の実装：
    - 要件定義からページリストを抽出
    - 各ページごとにClaudeCodeの並列起動
    - ポータルに保存された個別モックアップ作成用プロンプトを利用

  2. 具体的なコード修正

  2.1. SimpleChat.tsの修正

  // ファイルパス: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/ui/simpleChat.ts

  // 「要件定義を保存してモックアップを生成」ボタンのハンドラを追加
  private async _handleSaveRequirementsAndGenerateMockups(requirementsContent: string): Promise<void> {
    try {
      // 1. まず要件定義を保存
      const fileName = 'requirements.md';
      const filePath = path.join(this._projectPath, 'docs', fileName);

      // ディレクトリが存在しない場合は作成
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // ファイルに書き込み
      fs.writeFileSync(filePath, requirementsContent, 'utf8');

      // 2. 要件定義からページリストを抽出
      const parser = await import('../../core/requirementsParser');
      const pages = await parser.RequirementsParser.extractPagesFromRequirements(filePath);

      if (pages.length === 0) {
        throw new Error('要件定義からページ情報を抽出できませんでした。要件定義に「ページリスト」セクションが含まれていることを確認してください。');
      }

      // 3. ClaudeCodeLauncherServiceのインスタンスを取得
      const launcherService = (await import('../../services/ClaudeCodeLauncherService')).ClaudeCodeLauncherService.getInstance();

      // 4. モックアップクリエイター用のプロンプトURL
      const mockupCreatorUrl = 'http://geniemon-portal-backend-production.up.railway.app/api/prompts/public/247df2890160a2fa8f6cc0f895413aed';

      // 5. 並列モックアップ生成を開始
      await this._launchParallelMockupGeneration(pages, filePath, mockupCreatorUrl, launcherService);

      // 成功メッセージを表示
      vscode.window.showInformationMessage(`要件定義を保存し、${pages.length}ページのモックアップ生成を開始しました。`);

      // WebViewに通知
      this._panel?.webview.postMessage({
        command: 'showSuccess',
        message: `要件定義を保存し、${pages.length}ページのモックアップ生成を開始しました。`
      });

    } catch (error) {
      Logger.error('要件定義の保存とモックアップ生成に失敗しました', error as Error);
      vscode.window.showErrorMessage(`要件定義の保存とモックアップ生成に失敗しました: ${(error as Error).message}`);

      // WebViewに通知
      this._panel?.webview.postMessage({
        command: 'showError',
        message: `要件定義の保存とモックアップ生成に失敗しました: ${(error as Error).message}`
      });
    }
  }

  // 並列モックアップ生成機能
  private async _launchParallelMockupGeneration(
    pages: any[],
    requirementsPath: string,
    promptUrl: string,
    launcherService: any
  ): Promise<void> {
    // 同時実行数の制限（設定値または3をデフォルトとする）
    const maxConcurrent = 3;

    // ClaudeCodeIntegrationServiceのインスタンスを取得
    const integrationService = (await import('../../services/ClaudeCodeIntegrationService')).ClaudeCodeIntegrationService.getInstance();

    // ページごとにClaudeCodeを起動（同時実行数を考慮）
    for (let i = 0; i < pages.length; i += maxConcurrent) {
      // 現在のバッチのページを取得
      const batchPages = pages.slice(i, i + maxConcurrent);

      // バッチ内のページを並列処理
      await Promise.all(batchPages.map(async (page) => {
        try {
          // ページ情報を含む追加コンテンツを生成
          const additionalContent = `
  # 追加情報

  ## ページ情報
  - ページ名: ${page.name}
  - 説明: ${page.description || 'なし'}
  - 主要機能: ${(page.features || []).join(', ')}

  ## 要件定義ファイル
  - パス: ${requirementsPath}

  ## 指示
  このページ（${page.name}）に関するモックアップのみを作成してください。
  `;

          // ClaudeCodeを起動
          await integrationService.launchWithPublicUrl(
            promptUrl,
            path.dirname(requirementsPath),
            additionalContent
          );

          Logger.info(`モックアップ生成を開始しました: ${page.name}`);
        } catch (error) {
          Logger.error(`モックアップ生成エラー (${page.name}): ${(error as Error).message}`);
        }
      }));

      // バッチ間で少し待機（システム負荷を考慮）
      if (i + maxConcurrent < pages.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  2.2. SimpleChat.jsの修正

  // ファイルパス: /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/media/simpleChat.js

  // 「要件定義を保存してモックアップを生成」ボタンを追加
  const saveReqAndGenBtn = document.createElement('button');
  saveReqAndGenBtn.textContent = '要件定義を保存してモックアップを生成';
  saveReqAndGenBtn.className = 'action-button';
  saveReqAndGenBtn.addEventListener('click', () => {
    // 現在の要件定義エディタの内容を取得
    const requirementsContent = requirementsEditor.value;

    if (!requirementsContent.trim()) {
      showError('要件定義が空です。要件定義を入力してください。');
      return;
    }

    // 確認ダイアログを表示
    if (confirm('要件定義を保存し、モックアップ生成を開始しますか？複数のClaudeCodeターミナルが開きます。')) {
      // VSCodeに要件定義を保存してモックアップを生成するよう通知
      vscode.postMessage({
        command: 'saveRequirementsAndGenerateMockups',
        content: requirementsContent
      });

      // 処理中表示
      showLoading('要件定義を保存し、モックアップを生成しています...');
    }
  });

  // 既存のボタンコンテナに追加
  document.querySelector('.button-container').appendChild(saveReqAndGenBtn);

  // メッセージハンドラに処理を追加
  window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
      // ... 既存のケース

      case 'showSuccess':
        hideLoading();
        showSuccess(message.message);
        break;

      case 'showError':
        hideLoading();
        showError(message.message);
        break;
    }
  });

  // 成功メッセージ表示関数
  function showSuccess(message) {
    const successElement = document.createElement('div');
    successElement.className = 'success-message';
    successElement.textContent = message;

    document.body.appendChild(successElement);

    setTimeout(() => {
      successElement.remove();
    }, 5000);
  }

  // ローディング表示/非表示関数
  function showLoading(message) {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'loading-overlay';
    loadingElement.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-message">${message}</div>
    `;
    loadingElement.id = 'loading-overlay';

    document.body.appendChild(loadingElement);
  }

  function hideLoading() {
    const loadingElement = document.getElementById('loading-overlay');
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  実装手順

  1. クライアント側の修正
    - simpleChat.jsに「要件定義を保存してモックアップを生成」ボタンを追加
    - 必要なスタイル・表示関数を追加
  2. サーバー側の修正
    - simpleChat.tsに_handleSaveRequirementsAndGenerateMockupsメソッドを追加
    - _launchParallelMockupGenerationメソッドの実装
    - WebViewからのメッセージ処理に新しいコマンドを追加
  3. 既存の要件定義ビジュアライザープロンプトを要件定義クリエイターに置き換え
    - requirements_visualizer.mdの内容をrequirements_creator.mdに変更
    - 既存のUIでの参照先を更新

  バージョン管理の考慮

  この改修では以下のファイルを変更します：
  1. /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/src/ui/simpleChat.ts
  2. /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/media/simpleChat.js
  3. /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/prompts/requirements_visualizer.md（内容更新）

  また、以下の新規ファイルを追加します：
  1. /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/prompts/requirements_creator.md
  2. /Users/tatsuya/Desktop/システム開発/AppGenius2/AppGenius/docs/prompts/mockupcreater.md

  この変更は、既存の機能を拡張するものであり、リスクは比較的低いと考えられます。

