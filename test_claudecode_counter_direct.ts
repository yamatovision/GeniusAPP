/**
 * ClaudeCode起動カウンター直接テスト用スクリプト
 * VSCodeコマンドとして登録して実行します
 */

import * as vscode from 'vscode';
import { directUpdateClaudeCodeLaunchCounter } from './claude_code_counter_debug';

// コマンドを登録して実行
export function activate(context: vscode.ExtensionContext) {
  // コンソールに情報を出力
  console.log('ClaudeCode起動カウンター直接テスト拡張機能がアクティブになりました');
  
  // コマンドを登録
  let disposable = vscode.commands.registerCommand('appgenius.testClaudeCodeCounter', () => {
    // ユーザーに通知
    vscode.window.showInformationMessage('ClaudeCode起動カウンターのテストを開始します...');
    
    // 直接更新関数を呼び出し
    directUpdateClaudeCodeLaunchCounter().then(success => {
      if (success) {
        vscode.window.showInformationMessage('ClaudeCode起動カウンターのテストが成功しました');
      } else {
        vscode.window.showErrorMessage('ClaudeCode起動カウンターのテストが失敗しました');
      }
    });
  });
  
  context.subscriptions.push(disposable);
}

// この関数はVSCodeによって呼び出される
export function deactivate() {}