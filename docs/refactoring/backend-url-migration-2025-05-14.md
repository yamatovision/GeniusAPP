# リファクタリング計画: バックエンドURL移行 [2025-05-14]

## 1. 現状分析

### 1.1 対象概要
現在のVSCode拡張「ブルーランプ」（旧AppGenius）はバックエンドAPIとして特定のURLを参照しています。アプリケーション名の変更に伴い、バックエンドサーバーのURLも変更する必要があります。これは認証やプロンプト管理などの機能に影響します。

### 1.2 問題点と課題
- 現在のバックエンドURL `https://appgenius-portal-test-235426778039.asia-northeast1.run.app` が複数のファイルでハードコードされている
- 新しいバックエンドURL `https://bluelamp-235426778039.asia-northeast1.run.app` へ移行が必要
- 旧アプリ「AppGenius」名を含むURLは、ブランド変更後も継続使用中
- 一部のユーザーは古いバージョンのクライアントを使用しており、急な変更はこれらのユーザーの接続を切断する
- 複数の環境変数やデフォルト値が散在しており、一元管理されていない
- メディアコンポーネント内で同じプロンプトURLリストが重複して定義されていた（promptCards.jsのみとなりました）

### 1.3 関連ファイル一覧
- `/src/core/auth/SimpleAuthService.ts` - バックエンドURL参照（認証サービス）
- `/src/api/claudeCodeApiClient.ts` - バックエンドURL参照（APIクライアント）
- `/portal/frontend/src/services/simple/simpleAuth.service.js` - フロントエンド認証サービス
- `/portal/frontend/src/services/authApi.js` - フロントエンドAPI基本URL設定
- `/media/components/promptCards/promptCards.js` - プロンプトURLリスト
- ~~`/media/components/promptManager/promptManager.js`~~ - 同一のプロンプトURLリスト（削除済み）
- `package.json` - ビルド設定
- `docs/deployment/deploy.md` - デプロイドキュメント
- `docs/deployment/deploy-history.md` - デプロイ履歴

### 1.4 依存関係図
```
VSCode拡張（ブルーランプ）
  ├── バックエンド（サーバー側）
  │    └── SimpleAuthService ─── バックエンドURL（認証API）
  │    └── ClaudeCodeApiClient ─── バックエンドURL（プロンプト管理API）
  │
  ├── フロントエンド（ポータル）
  │    └── simpleAuth.service.js ─── バックエンドURL（認証）
  │    └── authApi.js ─── バックエンドURL（API基本URL）
  │
  └── Webコンポーネント（メディア）
       └── promptCards.js ─── プロンプトURLリスト（15個のURL）
```

## 2. リファクタリングの目標

### 2.1 期待される成果
- バックエンドURLの一元管理による保守性の向上
- ブルーランプブランドに合わせたバックエンドURLへの完全移行
- 旧バックエンドURL廃止に向けた明確なスケジュールの設定
- 将来のURL変更時の影響範囲の最小化
- 重複コードの削除による保守性の向上

### 2.2 維持すべき機能
- 認証機能
- プロンプト管理機能
- 新バージョンユーザーへの安定したサービス提供
- API応答の互換性
- プロンプトカード機能

## 3. 理想的な実装

### 3.1 全体アーキテクチャ
- 環境変数による一元管理：
  ```typescript
  // 単一の環境変数または設定ファイルからURLを取得
  const API_BASE_URL = getConfigValue('API_BASE_URL', 'https://bluelamp-235426778039.asia-northeast1.run.app/api');
  ```

- 新URLへの完全移行：
  ```typescript
  // 新URLのみを使用
  const API_BASE_URL = 'https://bluelamp-235426778039.asia-northeast1.run.app/api';
  ```

- プロンプトURL設定の一元化：
  ```javascript
  // media/config/promptConfig.js
  export const PROMPT_URLS = [
    "https://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/...",
    // 残りのプロンプトURLリスト
  ];
  ```

### 3.2 核心的な改善ポイント
- 環境変数を使用した一元管理：すべてのURLは単一のソースから取得
- 新URLへの完全移行：アプリケーションは新URLのみを使用
- 明示的なAPI_VERSIONパラメータ：クライアントバージョンを識別できるように
- 重複モジュールの統合：promptManager.js を削除し、promptCards.js に一本化（完了済み）

### 3.3 新しいディレクトリ構造
```
src/
  ├── config/
  │    └── apiConfig.ts  (新規追加 - URL設定の一元管理)
  ├── core/auth/
  │    └── SimpleAuthService.ts (修正)
  ├── api/
  │    └── claudeCodeApiClient.ts (修正)
  │
media/
  └── components/
       └── promptCards/
            └── promptCards.js (修正 - 新しいURLへの更新)
```

## 4. 実装計画

### フェーズ1: 設定の一元化
- **目標**: バックエンドURLの参照を一元管理する仕組みを構築
- **影響範囲**: 新規設定ファイル、既存の参照ファイル
- **タスク**:
  1. **T1.1**: バックエンド設定ファイルの作成
     - 対象: `/src/config/apiConfig.ts`（新規）
     - 実装:
       ```typescript
       /**
        * API設定ファイル - バックエンドURL参照の一元管理
        */
       export const API_CONFIG = {
         // バックエンドURL
         API_URL: process.env.BLUELAMP_API_URL || 'https://bluelamp-235426778039.asia-northeast1.run.app/api',
         
         // ヘルパー関数: APIエンドポイントを取得
         getApiUrl: function(endpoint: string = ''): string {
           return this.API_URL + (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
         }
       };
       ```
  2. **T1.2**: promptCards.js内のURLを直接更新
     - 対象: `/media/components/promptCards/promptCards.js`
     - 実装:
       ```javascript
       // プロンプトURLリスト - 新しいバックエンドURLに基づいて更新
       const promptUrls = [
         "https://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39", // 要件定義
         "https://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/9575d0837e6b7700ab2f8887a5c4faec", // システムアーキテクチャ
         // 残りのURLも同様に更新
       ];
       
       // 既存のpromptInfoは変更なし
       ```
  3. **T1.3**: package.jsonに環境変数を追加
     - 対象: `/package.json`
     - 実装: scripts セクションでBLUELAMP_API_URLを指定
       ```json
       "scripts": {
         "dev": "webpack --mode development --watch",
         "compile": "webpack --mode production",
         "package": "NODE_ENV=production webpack --mode production"
       }
       ```
     - 代わりに、.envファイルや設定ファイルで直接指定する
       ```
       # .env または同等のファイル
       BLUELAMP_API_URL=https://bluelamp-235426778039.asia-northeast1.run.app/api
       ```
- **検証ポイント**:
  - 設定ファイルが正しく作成されていること
  - 環境変数から正しく値を取得できること
  - ヘルパー関数が期待通りに動作すること

### フェーズ2: バックエンド参照の修正
- **目標**: バックエンドコードを修正して共通設定を使用するようにする
- **影響範囲**: `/src/core/auth/SimpleAuthService.ts`, `/src/api/claudeCodeApiClient.ts`
- **タスク**:
  1. **T2.1**: SimpleAuthServiceの修正
     - 対象: `/src/core/auth/SimpleAuthService.ts`
     - 実装:
       ```typescript
       import { API_CONFIG } from '../../config/apiConfig';
       
       // 22行目: APIベースURLの設定を変更
       private readonly API_BASE_URL = API_CONFIG.getApiUrl('simple');
       ```
       
       各API呼び出し部分を新URLを使用するように修正（login関数の例）:
       ```typescript
       public async login(email: string, password: string): Promise<boolean> {
         try {
           Logger.info('SimpleAuthService: ログイン開始');
           
           // 新URLでAPI呼び出し
           const url = API_CONFIG.getApiUrl('simple/auth/login');
           const response = await axios.post(url, {
             email,
             password
           });
           
           // 成功時の処理（変更なし）
           // ...
           
           return true;
         } catch (error) {
           // エラー処理（変更なし）
           // ...
           return false;
         }
       }
       ```
       
  2. **T2.2**: ClaudeCodeApiClientの修正
     - 対象: `/src/api/claudeCodeApiClient.ts`
     - 実装:
       ```typescript
       import { API_CONFIG } from '../config/apiConfig';
       
       // 42行目: APIベースURLの設定を変更
       this._baseUrl = process.env.PORTAL_API_URL || API_CONFIG.getApiUrl();
       ```
       
       通常のリトライロジックをそのまま使用:
       ```typescript
       private async _retryWithExponentialBackoff<T>(
         operation: () => Promise<T>,
         maxRetries: number = 3,
         retryableStatusCodes: number[] = [429, 500, 502, 503, 504],
         operationName: string = '操作'
       ): Promise<T> {
         let retries = 0;
         const baseDelay = 1000;
       
         while (true) {
           try {
             return await operation();
           } catch (error) {
             retries++;
             
             // エラーを適切にログに記録
             Logger.error(`【API連携】${operationName}に失敗しました (${retries}回目)`, error as Error);
             
             // リトライ回数が上限に達した場合は例外をスロー
             if (retries >= maxRetries) {
               throw error;
             }
             
             // 一時的なエラーの場合はリトライ
             const status = error.response?.status;
             if (retryableStatusCodes.includes(status)) {
               // 指数バックオフによるリトライ
               const delay = baseDelay * Math.pow(2, retries - 1);
               Logger.info(`【API連携】${operationName}: ${delay}ms後に再試行します (${retries}/${maxRetries})`);
               await new Promise(resolve => setTimeout(resolve, delay));
               continue;
             }
             
             // リトライ対象外のエラーは例外をスロー
             throw error;
           }
         }
       }
       ```
- **検証ポイント**:
  - 認証機能が新URLで正常に動作すること
  - プロンプト管理機能が新URLで正常に動作すること
  - 新URLが正常に機能すること
  - リトライロジックが拡張され、エラー処理が適切に行われること

### フェーズ3: フロントエンド参照の修正
- **目標**: フロントエンドコードを修正して設定を一元化する
- **影響範囲**: `/portal/frontend/src/services/simple/simpleAuth.service.js`, `/portal/frontend/src/services/authApi.js`
- **タスク**:
  1. **T3.1**: フロントエンド用の共通設定ファイル作成
     - 対象: `/portal/frontend/src/config/apiConfig.js`（新規）
     - 実装:
       ```javascript
       /**
        * API設定 - フロントエンド用
        */
       
       // 新しいバックエンドURL
       export const API_URL = process.env.REACT_APP_API_URL || 'https://bluelamp-235426778039.asia-northeast1.run.app/api';
       
       // API URLの取得
       export function getApiUrl(endpoint = '') {
         return API_URL + (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
       }
       ```
       
  2. **T3.2**: simpleAuth.service.jsの修正
     - 対象: `/portal/frontend/src/services/simple/simpleAuth.service.js`
     - 実装:
       ```javascript
       import { 
         API_URL, 
         getApiUrl 
       } from '../../config/apiConfig';
       
       // 9-10行目: APIベースURLの設定を変更
       const TEST_API_URL = API_URL;
       const SIMPLE_API_URL = TEST_API_URL + '/simple';
       ```
       
  3. **T3.3**: authApi.jsの修正
     - 対象: `/portal/frontend/src/services/authApi.js`
     - 実装:
       ```javascript
       import { 
         API_URL, 
         getApiUrl 
       } from '../config/apiConfig';
       
       // 9-10行目: APIベースURLの設定を変更
       const TEST_API_URL = API_URL;
       const API_BASE_URL = TEST_API_URL + '/simple';
       ```
       
- **検証ポイント**:
  - フロントエンドがサーバーAPIと正常に通信できること
  - 設定変更が適切に反映されていること

### フェーズ4: プロンプトカード機能の修正
- **目標**: プロンプトカード機能のURLを更新する
- **影響範囲**: `/media/components/promptCards/promptCards.js`
- **タスク**:
  1. **T4.1**: promptCards.jsの修正
     - 対象: `/media/components/promptCards/promptCards.js`
     - 実装:
       ```javascript
       // @ts-check
       
       // VSCode API取得（既存コード）
       
       // プロンプトURLリスト - 新URLへの更新
       const promptUrls = [
         "https://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/cdc2b284c05ebaae2bc9eb1f3047aa39", // 要件定義
         "https://bluelamp-235426778039.asia-northeast1.run.app/api/prompts/public/9575d0837e6b7700ab2f8887a5c4faec", // システムアーキテクチャ
         // 残りのURLも同様に新URLパターンに更新...
       ];
       
       // 他の既存コードはそのまま維持
       ```
       
  2. **T4.2**: promptManager.jsの削除 ✓ 完了
     - 対象: ~~`/media/components/promptManager/promptManager.js`~~ (削除済み)
     - 実装: 
       ファイルとディレクトリを削除し、参照を確認
       - ファイル削除が完了し、アプリケーションは正常に動作しています
       - 参照するコードが見つからないことを確認済み
- **検証ポイント**:
  - プロンプトカード機能が引き続き正常に動作すること
  - 重複コードが排除されていること
  - プロンプトURLが正しく表示されること

### フェーズ5: ドキュメントの更新
- **目標**: 移行に関するドキュメントを更新
- **影響範囲**: `/docs/deployment/deploy.md`, `/docs/deployment/deploy-history.md`
- **タスク**:
  1. **T5.1**: deploy.mdの更新
     - 対象: `/docs/deployment/deploy.md`
     - 実装: 新しいバックエンドURLの情報を追加
  2. **T5.2**: deploy-history.mdの更新
     - 対象: `/docs/deployment/deploy-history.md`
     - 実装: 移行の履歴とスケジュールを追加
- **検証ポイント**:
  - ドキュメントが最新の情報に更新されていること
  - 移行スケジュールが明確に記載されていること

## 5. 期待される効果

### 5.1 コード削減
- 重複したURL参照を削除することで、コードの一貫性が向上
- フォールバックロジックの共通化により、冗長なコードが減少
- promptCards.js と promptManager.js の重複排除

### 5.2 保守性向上
- バックエンドURL参照の一元管理により、今後の変更が容易に
- 設定ファイルを介したアクセスにより、依存関係が明確に
- 環境変数を使用した柔軟な設定が可能に

### 5.3 拡張性改善
- 複数環境（開発、テスト、本番）のサポートが容易に
- 将来的なURL変更に対する柔軟性向上
- 可読性と保守性の向上による開発効率の改善

## 6. リスクと対策

### 6.1 潜在的リスク
- 既存ユーザーの接続性の中断
- 新URLへの移行に伴う一時的な不安定性
- 移行期間後の互換性問題
- 環境変数が正しく設定されない場合のデフォルト値の問題
- ~promptManager.js を参照している他のコードへの影響~ (影響なし、ファイル削除済み)

### 6.2 対策
- 移行前の十分なテスト：両方のURLを並行してテスト
- モニタリングの強化：移行期間中は特にAPIリクエストのロギングを強化
- 段階的な移行：すべてのユーザーにリリースする前の小規模テスト
- 明確なドキュメント：開発者向けの移行ガイドを提供
- promptManager.js はすでに削除され、アプリケーションは問題なく動作していることを確認済み

## 7. 移行スケジュール

- **Day 1 (2025-05-14)**: リファクタリング実装と内部テスト
- **Day 2 (2025-05-15)**: 新旧両URLが動作する体制で限定リリース（テストユーザー向け）
- **Day 3-6 (2025-05-16 - 2025-05-20)**: フィードバック収集と必要な修正
- **Day 7 (2025-05-21)**: 旧URL廃止、完全移行完了

## 8. 備考
- 新バージョンのアプリは新URLのみを使用。ただし旧バックエンドURL自体はしばらく維持し、一定期間（1ヶ月程度）後に完全に閉鎖する。これにより、アップデートしていない古いバージョンのクライアントはその時点でアクセスできなくなる
- 今回の移行をベースに、将来のドメイン変更にも対応できる柔軟な仕組みを構築する
- promptManager.js はすでに完全に削除されました