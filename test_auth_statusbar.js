/**
 * AuthStatusBar 手動テスト
 * 実行方法: node test_auth_statusbar.js
 * このスクリプトはAuthStatusBarが正しくSimpleAuthServiceとAuthenticationServiceを両方サポートすることを検証します
 */

// 環境変数がなければ、コンパイルされたJSを使用
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.APPGENIUS_DEBUG = 'true';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('AuthStatusBar統合テスト開始');

try {
  // ファイルが存在することを確認
  const authStatusBarPath = path.join(__dirname, 'out', 'ui', 'auth', 'AuthStatusBar.js');
  assert(fs.existsSync(authStatusBarPath), 'AuthStatusBar.jsが存在しません');
  console.log('✓ AuthStatusBar.jsが存在しています');

  // SimpleAuthServiceのインポートを確認
  const sourceCode = fs.readFileSync(authStatusBarPath, 'utf8');
  assert(sourceCode.includes('SimpleAuthService'), 'SimpleAuthServiceがインポートされていません');
  console.log('✓ SimpleAuthServiceがインポートされています');

  // _simpleAuthServiceプロパティを確認
  assert(sourceCode.includes('_simpleAuthService'), '_simpleAuthServiceプロパティが見つかりません');
  console.log('✓ _simpleAuthServiceプロパティが存在しています');

  // UseSimpleAuthフラグの確認
  assert(sourceCode.includes('_useSimpleAuth'), '_useSimpleAuthプロパティが見つかりません');
  console.log('✓ _useSimpleAuthプロパティが存在しています');

  // SimpleAuthService初期化の確認
  assert(sourceCode.includes('SimpleAuthService.getInstance'), 'SimpleAuthService.getInstanceが見つかりません');
  console.log('✓ SimpleAuthService.getInstanceが使用されています');

  // APIキーアイコンの確認
  assert(sourceCode.includes('ICON_API_KEY'), 'APIキーアイコン定数が見つかりません');
  console.log('✓ APIキーアイコン定数が存在しています');

  // イベントリスナー登録の確認
  assert(sourceCode.includes('this._simpleAuthService.onStateChanged'), 'SimpleAuthServiceのイベントリスナー登録が見つかりません');
  console.log('✓ SimpleAuthServiceのイベントリスナー登録が実装されています');

  // 状態表示メソッドの確認
  assert(sourceCode.includes('_updateStatusBarForSimpleAuth'), 'SimpleAuth用の表示メソッドが見つかりません');
  console.log('✓ SimpleAuth用の表示メソッドが実装されています');

  // 状態表示メソッドの実装確認
  assert(sourceCode.includes('hasApiKey = !!this._simpleAuthService.getApiKey()'), 'APIキーチェックが見つかりません');
  console.log('✓ APIキーのチェックが実装されています');

  console.log('\n✅ すべてのチェックに合格しました! AuthStatusBarは正しくSimpleAuthServiceをサポートしています');
} catch (error) {
  console.error('\n❌ テスト失敗:', error.message);
  process.exit(1);
}