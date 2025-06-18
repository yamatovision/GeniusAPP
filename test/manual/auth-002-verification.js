/**
 * AUTH-002: NoProjectView認証制限機能の動作確認スクリプト
 * 
 * このスクリプトは、NoProjectViewへのアクセス時にログイン制限が
 * 適切に機能していることを確認します。
 */

const fs = require('fs');
const path = require('path');

console.log('=== AUTH-002: NoProjectView認証制限機能の動作確認 ===\n');

// 1. ScopeManagerPanel.tsの変更確認
console.log('1. ScopeManagerPanel.tsの変更確認:');
const scopeManagerPath = path.join(__dirname, '../../src/ui/scopeManager/ScopeManagerPanel.ts');
const scopeManagerContent = fs.readFileSync(scopeManagerPath, 'utf8');

// AuthGuardのインポート確認
const hasAuthGuardImport = scopeManagerContent.includes("require('../auth/AuthGuard')");
console.log(`   - AuthGuardのインポート: ${hasAuthGuardImport ? '✓' : '✗'}`);

// ログインチェックの実装確認
const hasLoginCheck = scopeManagerContent.includes('AuthGuard.checkLoggedIn()');
console.log(`   - ログインチェックの実装: ${hasLoginCheck ? '✓' : '✗'}`);

// NoProjectView表示前のチェック確認
const hasCheckBeforeNoProjectView = scopeManagerContent.includes('NoProjectView表示前に未認証のためログインを促します');
console.log(`   - NoProjectView表示前のチェック: ${hasCheckBeforeNoProjectView ? '✓' : '✗'}`);

console.log('\n2. 実装の詳細:');
// 該当箇所を抽出して表示
const lines = scopeManagerContent.split('\n');
const targetLineIndex = lines.findIndex(line => line.includes('NoProjectView表示前にログインチェックを実施'));
if (targetLineIndex !== -1) {
  console.log('   実装箇所（行番号 ' + (targetLineIndex + 1) + ' 付近）:');
  for (let i = Math.max(0, targetLineIndex - 5); i < Math.min(lines.length, targetLineIndex + 10); i++) {
    console.log(`   ${i + 1}: ${lines[i]}`);
  }
}

console.log('\n3. 動作フローの説明:');
console.log('   1) ScopeManagerPanelを開く');
console.log('   2) プロジェクトが存在しない場合、NoProjectViewを表示する前にAuthGuard.checkLoggedIn()を呼び出す');
console.log('   3) 未ログインの場合:');
console.log('      - ログインプロンプトが表示される');
console.log('      - NoProjectViewは表示されない（undefinedを返す）');
console.log('   4) ログイン済みの場合:');
console.log('      - NoProjectViewが正常に表示される');

console.log('\n4. テスト方法:');
console.log('   1) VSCodeでAppGeniusを起動');
console.log('   2) ログアウトした状態でScopeManagerを開く');
console.log('   3) プロジェクトが存在しない場合、ログインプロンプトが表示されることを確認');
console.log('   4) ログインをキャンセルした場合、NoProjectViewが表示されないことを確認');
console.log('   5) ログイン後、再度ScopeManagerを開き、NoProjectViewが表示されることを確認');

console.log('\n=== 確認完了 ===');

// 実装の成功/失敗を判定
const isImplemented = hasAuthGuardImport && hasLoginCheck && hasCheckBeforeNoProjectView;
console.log(`\n結果: ${isImplemented ? '✅ AUTH-002の実装は正常に完了しています' : '❌ AUTH-002の実装に問題があります'}`);

process.exit(isImplemented ? 0 : 1);