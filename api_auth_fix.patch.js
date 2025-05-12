/**
 * このパッチは認証サービスのコマンド二重登録問題を修正します
 * 
 * extension.tsの526-527行目を修正し、SimpleAuthコマンドを除く認証コマンドのみを登録するように変更します
 * extension.tsの変更:
 * - registerAuthCommandsを使わずに、registerAuthCommandsWithoutSimpleを使用
 * - SimpleAuthCommandはSimpleAuthManagerの初期化時に既に登録済みのため
 * 
 * 修正方法:
 * 1. このファイルを実行して変更を適用
 * 2. extension.jsを再コンパイル
 * 3. 拡張機能の再起動
 */

const fs = require('fs');
const path = require('path');

// ファイルパス
const extensionPath = path.join(__dirname, 'src', 'extension.ts');
const backupPath = path.join(__dirname, 'src', 'extension.ts.pre_auth_fix');

// バックアップを作成
fs.copyFileSync(extensionPath, backupPath);
console.log(`バックアップ作成: ${backupPath}`);

// ファイル内容を読み込み
let content = fs.readFileSync(extensionPath, 'utf8');

// 該当部分を置換
const oldCode = `			// 認証コマンドの登録
			registerAuthCommands(context);
			Logger.info('Auth commands registered successfully');`;

const newCode = `			// 認証コマンドの登録（二重登録を防ぐバージョンを使用）
			const { registerAuthCommandsWithoutSimple } = require('./core/auth/authCommands');
			registerAuthCommandsWithoutSimple(context);
			Logger.info('Auth commands registered successfully (without SimpleAuth commands)');`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(extensionPath, content);
  console.log('パッチ適用成功!');
  console.log('変更内容:');
  console.log('Before: ');
  console.log(oldCode);
  console.log('After: ');
  console.log(newCode);
} else {
  console.error('該当コードが見つかりませんでした。手動での修正が必要です。');
}