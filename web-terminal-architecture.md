# Web版ターミナル + ClaudeCode 保護アーキテクチャ

## 改良版アーキテクチャ

```yaml
構成:
  ブラウザ:
    - xterm.js (Web Terminal UI)
    - WebSocket接続
  
  サーバー (各ユーザー用コンテナ):
    - 起動スクリプト (特権)
    - ClaudeCode実行環境 (制限付き)
    - ファイルシステム監視
```

## 実装方法

### 1. コンテナ起動時の処理

```bash
#!/bin/bash
# container-init.sh

# 1. プロンプトファイルを一時的に配置
cp /secure/prompts/.vqXXXXXX /workspace/.vqXXXXXX

# 2. ClaudeCodeを起動
claude-code &
CLAUDE_PID=$!

# 3. 5秒後にプロンプトファイルを削除
sleep 5
rm -f /workspace/.vqXXXXXX

# 4. ファイルシステムを監視
inotifywait -m /workspace -e create,modify |
while read path action file; do
    # プロンプトファイルへのアクセス試行を検知
    if [[ "$file" =~ \.vq[a-z0-9]+ ]]; then
        echo "不正アクセス検知！"
        kill $CLAUDE_PID
        exit 1
    fi
done
```

### 2. より安全な代替案：プロキシ方式

```python
# claude-proxy.py
class ClaudeProxy:
    def __init__(self):
        self.prompts = self.load_encrypted_prompts()
        
    def execute(self, user_command):
        # 1. ユーザーのコマンドを解析
        intent = self.parse_intent(user_command)
        
        # 2. 適切なプロンプトを選択（ユーザーには見えない）
        prompt = self.prompts[intent.type]
        
        # 3. Claude APIを直接呼び出し
        response = claude_api.complete(
            prompt=prompt + user_command,
            max_tokens=4000
        )
        
        # 4. ファイル操作を実行
        self.apply_changes(response)
        
        return "完了しました"
```

### 3. ハイブリッド方式（最も現実的）

```javascript
// 1. 簡単なタスクはプロキシ経由
if (isSimpleTask(userInput)) {
    return await claudeProxy.execute(userInput);
}

// 2. 複雑なタスクは一時的にClaudeCode起動
else {
    const session = await startSecureClaudeSession({
        timeout: 300, // 5分で強制終了
        promptAccess: 'write-only', // 読み取り不可
        monitoring: true
    });
    
    return await session.execute(userInput);
}
```

## セキュリティ強化策

### 1. カーネルレベルの保護

```c
// eBPFプログラムでシステムコールを監視
int trace_openat(struct pt_regs *ctx) {
    char filename[256];
    bpf_probe_read_str(filename, sizeof(filename), ...);
    
    if (strstr(filename, "/opt/bluelamp/prompts")) {
        // アクセスをブロック
        return -EACCES;
    }
    return 0;
}
```

### 2. 運用上の工夫

```yaml
ローテーション:
  - プロンプトファイル名を毎回変更
  - 暗号化キーを定期更新
  - アクセスログの完全記録

監視:
  - 異常なファイルアクセスパターン
  - 大量のファイル読み取り
  - 外部への通信試行
```

## コスト試算

### 初期開発
- Web Terminal基盤: 100万円（2週間）
- セキュリティ層: 150万円（3週間）
- 監視システム: 50万円（1週間）
**合計: 300万円（6週間）**

### 運用コスト（月額）
- サーバー費用: 20万円（100ユーザー想定）
- Claude API: 使用量に応じて課金
- 監視・保守: 10万円

## 推奨事項

1. **段階的アプローチ**
   - Phase 1: 基本的なWebターミナル（プロキシ方式）
   - Phase 2: ClaudeCode統合（制限付き）
   - Phase 3: 完全版（高度な監視付き）

2. **ビジネスモデル**
   - 時間課金（1時間500円〜）
   - 月額プラン（5万円〜）
   - エンタープライズ（要相談）

3. **技術選定**
   - Frontend: Next.js + xterm.js
   - Backend: Go or Rust（パフォーマンス重視）
   - Container: gVisor（セキュリティ強化）
   - Monitoring: Falco + Custom eBPF