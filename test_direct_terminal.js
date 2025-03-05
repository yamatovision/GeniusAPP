const vscode = require('vscode');

/**
 * この関数はVSCode拡張のコンテキスト内でのみ実行可能です。
 * 実際にテストするには、このファイルの内容をVSCode拡張のコードに統合する必要があります。
 */
async function testTerminal() {
  try {
    // 新しいターミナルを作成
    const terminal = vscode.window.createTerminal({
      name: 'テスト用ターミナル'
    });
    
    // ターミナルを表示
    terminal.show(true);
    
    // 基本的なコマンドを実行
    terminal.sendText('echo "テストターミナルが起動しました"');
    terminal.sendText('pwd');
    
    // ClaudeCodeのパスを確認
    terminal.sendText('which claude');
    
    // NVMの環境を確認
    terminal.sendText('echo $NVM_DIR');
    terminal.sendText('nvm --version || echo "NVMがインストールされていません"');
    
    // NodeJSのバージョンを確認
    terminal.sendText('node --version');
    
    // PATHを確認
    terminal.sendText('echo $PATH');
    
    console.log('テストターミナルを起動しました。結果を確認してください。');
  } catch (error) {
    console.error('テストターミナルの起動に失敗しました:', error);
  }
}

// 注: このファイルはVSCode拡張のコンテキスト外では直接実行できません。
// 参考用コードとして提供しています。
console.log('これはVSCode拡張のコンテキスト内でのみ実行可能なテストファイルです。');
console.log('実際に使用するには、CLILauncherService.tsに統合してください。');