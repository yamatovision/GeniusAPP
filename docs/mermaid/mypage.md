```mermaid
 sequenceDiagram
      participant C as クリニック
      participant B as バックエンド
      participant P as 患者
      participant M as マイページ
      participant Pay as 決済ページ

      C->>B: 処方箋入力（患者情報含む）
      B->>B: 患者アカウント自動生成
      B->>B: 仮パスワード生成
      B->>P: SMS/メール送信
      Note over P: ログイン情報のみ送信<br/>（決済URLは含まない）

      P->>M: マイページログイン
      M->>B: 認証処理
      B-->>M: 認証成功
      M->>P: 新着処方箋の通知表示

      P->>M: 処方箋詳細を確認
      M->>B: 処方箋データ取得（認証済み）
      B-->>M: 処方箋情報

      P->>M: 「決済へ進む」ボタン
      M->>Pay: セキュアな内部遷移
      Note over Pay: 認証済みセッション内<br/>での決済処理

      Pay->>B: 決済処理（認証済み）
      B-->>Pay: 決済完了
      Pay->>M: マイページへ戻る